import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { devLog, devError } from '../utils/logger';
import fs from 'fs/promises';
import fsSync from 'fs';
import { ipcMain } from 'electron';
import net from 'net';
import { IPC_CHANNELS } from '../../shared/types';
import { promisify } from 'util';

export const activeProcesses = new Map<string, ChildProcess>();

// Pure function: Load config and spawn process
export async function startExistingServer(serverId: string, serverDirectory: string, javaPath: string): Promise<void> {
  // Check for port conflict first
  try {
    const portInUse = await checkPort(25565);
    if (portInUse) {
      throw new Error('Port 25565 is already in use. Close other Minecraft servers first.');
    }
  } catch (err) {
    throw new Error(`Port check failed: ${(err as Error).message}`);
  }

  // 1. Handle OneDrive sync conflicts
  const logPath = path.join(serverDirectory, 'logs', 'latest.log');
  try {
    if (fsSync.existsSync(logPath)) {
      await fs.rename(logPath, path.join(serverDirectory, 'logs', 'latest.log.bak'));
      devLog('Renamed locked log file');
    }
  } catch (err) {
    devError(`Log file handling error: ${err}`);
  }

  // Kill any existing process first
  if (activeProcesses.has(serverId)) {
    devLog(`Found existing process for ${serverId}, killing it first`);
    activeProcesses.get(serverId)?.kill('SIGTERM');
    activeProcesses.delete(serverId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup
  }

  const serverJarPath = path.win32.join(serverDirectory, 'server.jar');
  const command = `"${javaPath}" -Xmx1024M -Xms1024M -jar "${serverJarPath}" --nogui`;
  
  devLog(`Starting server ${serverId} with command: ${command}`);

  return new Promise((resolve, reject) => {
    const process = spawn(javaPath, [
      '-Xmx1024M',
      '-Xms1024M',
      '-jar',
      serverJarPath,
      '--nogui'
    ], {
      cwd: serverDirectory,
      windowsHide: true
    });

    activeProcesses.set(serverId, process);

    // Track startup success
    let startedSuccessfully = false;
    const startupTimeout = setTimeout(() => {
      if (!startedSuccessfully) {
        process.kill();
        reject(new Error('Server startup timed out'));
      }
    }, 30000); // 30 second timeout

    process.stdout.on('data', (data) => {
      const output = data.toString();
      devLog(`[Server ${serverId} stdout]: ${output}`);

      // Check for successful startup message
      if (output.includes('Done') || output.includes('For help, type "help"')) {
        startedSuccessfully = true;
        clearTimeout(startupTimeout);
        devLog(`Server ${serverId} started successfully`);
        resolve();
      }
    });

    process.stderr.on('data', (data) => {
      devError(`[Server ${serverId} stderr]: ${data}`);
    });

    process.on('close', (code) => {
      clearTimeout(startupTimeout);
      activeProcesses.delete(serverId);
      if (!startedSuccessfully) {
        reject(new Error(`Server process exited with code ${code}`));
      }
    });

    process.on('error', (err) => {
      clearTimeout(startupTimeout);
      activeProcesses.delete(serverId);
      reject(err);
    });
  });
}

// Pure function: Kill process by ID
export async function stopExistingServer(serverId: string): Promise<{success: boolean, error?: string}> {
  if (!activeProcesses.has(serverId)) {
    return {success: false, error: `No active process for ${serverId}`};
  }

  const process = activeProcesses.get(serverId);
  if (!process || process.killed) {
    activeProcesses.delete(serverId);
    return {success: false, error: 'Process not available or already killed'};
  }

  try {
    // Skip graceful shutdown if stdin isn't available
    if (!process.stdin?.writable) {
      process.kill('SIGKILL');
      return {success: true};
    }

    // Graceful shutdown sequence
    process.stdin.write('save-all\n');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for save
    process.stdin.write('stop\n');

    // Wait for exit (max 10 seconds)
    const exited = await Promise.race([
      new Promise(resolve => process.once('exit', () => resolve(true))),
      new Promise(resolve => setTimeout(() => resolve(false), 10000))
    ]);

    if (!exited) {
      process.kill('SIGKILL'); // Force kill if graceful fails
    }

    return {success: true};
  } catch (err) {
    return {success: false, error: `Shutdown failed: ${err instanceof Error ? err.message : String(err)}`};
  } finally {
    activeProcesses.delete(serverId);
  }
}

export function registerServerServiceHandlers() {
  ipcMain.handle('CHECK_FILE_EXISTS', (_, path: string) => {
    return fsSync.existsSync(path);
  });

  ipcMain.handle('HANDLE_LOG_FILE', async (_, serverDirectory: string) => {
    const logPath = path.join(serverDirectory, 'logs');
    const logFile = path.join(logPath, 'latest.log');
    
    try {
      // 1. Ensure logs directory exists
      if (!fsSync.existsSync(logPath)) {
        await fs.mkdir(logPath, { recursive: true });
        devLog(`Created logs directory: ${logPath}`);
      }

      // 2. Handle existing log file with multiple fallbacks
      if (fsSync.existsSync(logFile)) {
        try {
          // First try normal deletion
          await fs.unlink(logFile);
          devLog(`Deleted existing log file: ${logFile}`);
        } catch (deleteErr) {
          devLog(`Standard deletion failed, trying rename: ${(deleteErr as Error).message}`);
          
          // Fallback 1: Rename the file
          const backupName = `latest_${Date.now()}.log.bak`;
          const backupPath = path.join(logPath, backupName);
          
          try {
            await fs.rename(logFile, backupPath);
            devLog(`Renamed locked log file to: ${backupPath}`);
          } catch (renameErr) {
            devLog(`Rename failed, trying empty file creation: ${(renameErr as Error).message}`);
            
            // Fallback 2: Truncate the file
            try {
              await fs.writeFile(logFile, '');
              devLog(`Truncated log file: ${logFile}`);
            } catch (truncateErr) {
              throw new Error(`All log file cleanup methods failed: ${(truncateErr as Error).message}`);
            }
          }
        }
      }
    } catch (error) {
      devError(`Log file handling failed: ${(error as Error).message}`);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SERVER_STOP, async () => {
    // Log current active processes before cleanup
    devLog(`Stopping all server processes (count: ${activeProcesses.size})`);
    
    // Kill all processes with force and cleanup
    for (const [id, process] of activeProcesses) {
      try {
        devLog(`Killing process ${id} (PID: ${process.pid})`);
        process.kill('SIGTERM');
      } catch (err) {
        devError(`Failed to kill process ${id}: ${(err as Error).message}`);
      }
    }

    // Clear and verify cleanup
    activeProcesses.clear();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for OS cleanup
    
    // Verify no processes remain
    if (activeProcesses.size > 0) {
      devError(`Warning: ${activeProcesses.size} processes still in map after cleanup`);
    } else {
      devLog('All server processes stopped successfully');
    }

    await checkRunningJavaProcesses();

    return { success: true };
  });
}

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

async function checkRunningJavaProcesses(): Promise<void> {
  try {
    const { exec } = require('child_process');
    const { stdout } = await promisify(exec)('wmic process where "name=\'java.exe\'" get ProcessId,CommandLine /format:list');
    devLog('Running Java processes:\n' + stdout);
  } catch (err) {
    devError('Failed to check Java processes:', err);
  }
}
