import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { devLog, devError } from '../utils/logger';
import fs from 'fs/promises';
import fsSync from 'fs';
import { ipcMain, BrowserWindow } from 'electron';
import net from 'net';
import { IPC_CHANNELS } from '../../shared/types';
import { promisify } from 'util';
import { findAvailablePort } from '../ipcHandlers/minecraftHandlers';

export const activeProcesses = new Map<string, ChildProcess>();

// Helper function to send events to renderer
function sendToRenderer(channel: string, data: any) {
  devLog(`entered sendToRenderer funct`, data);
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Ensure data is a string or valid object
    const processedData = typeof data === 'string' ? data : 
                         data === undefined || data === null ? '' :
                         typeof data === 'object' ? JSON.stringify(data) :
                         String(data);
    
    devLog(`Sending ${channel} to renderer:`, processedData);
    mainWindow.webContents.send(channel, processedData);
  } else {
    devError(`Cannot send ${channel} to renderer: mainWindow not available`);
  }
}

// Helper functions for server cleanup
async function handleLogFileCleanup(logPath: string, serverDirectory: string): Promise<void> {
  if (fsSync.existsSync(logPath)) {
    try {
      await fs.rename(logPath, path.join(serverDirectory, 'logs', `latest_${Date.now()}.log.bak`));
      devLog('Renamed locked log file');
    } catch (err) {
      devError(`Log file handling error: ${err}`);
    }
  }
}

async function handleSessionLockCleanup(sessionPath: string): Promise<void> {
  if (fsSync.existsSync(sessionPath)) {
    try {
      await fs.unlink(sessionPath);
      devLog('Removed stale session.lock file');
    } catch (err) {
      devError(`Session lock file handling error: ${err}`);
    }
  }
}

async function handleWorldLockCleanup(worldPath: string): Promise<void> {
  if (fsSync.existsSync(worldPath)) {
    const sessionLockPath = path.join(worldPath, 'session.lock');
    if (fsSync.existsSync(sessionLockPath)) {
      try {
        await fs.unlink(sessionLockPath);
        devLog('Removed stale world session.lock file');
      } catch (err) {
        devError(`World session lock file handling error: ${err}`);
      }
    }
  }
}

// Pure function: Load config and spawn process
export async function startExistingServer(serverId: string, serverDirectory: string, javaPath: string): Promise<void> {
  // First check if there's already a process running
  if (activeProcesses.has(serverId)) {
    devLog(`Found existing process for ${serverId}, killing it first`);
    activeProcesses.get(serverId)?.kill('SIGTERM');
    activeProcesses.delete(serverId);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for cleanup
  }

  const properties = await fs.readFile(path.join(serverDirectory, 'server.properties'), 'utf8');
  const portMatch = properties.match(/server-port=(\d+)/);
  let port = portMatch ? parseInt(portMatch[1]) : 25565;
  devLog('[Port Tracking] Starting existing server with initial port:', port);

  port = await findAvailablePort(port);
  // Update server.properties with new port
  const updatedProperties = properties.replace(
    /server-port=\d+/g,
    `server-port=${port}`
  );
  await fs.writeFile(path.join(serverDirectory, 'server.properties'), updatedProperties);

  devLog('[Port Tracking] Final server port:', port);

  // Handle file locking issues
  const logPath = path.join(serverDirectory, 'logs', 'latest.log');
  const worldPath = path.join(serverDirectory, 'world');
  const sessionPath = path.join(serverDirectory, 'session.lock');

  try {
    await handleLogFileCleanup(logPath, serverDirectory);
    await handleSessionLockCleanup(sessionPath);
    await handleWorldLockCleanup(worldPath);
  } catch (err) {
    devError(`File cleanup error: ${err}`);
  }

  const serverJarPath = path.win32.join(serverDirectory, 'server.jar');
  
  devLog(`Starting server ${serverId} on port ${port}`);

  return new Promise((resolve, reject) => {
    const process = spawn(javaPath, [
      '-Xmx1024M',
      '-Xms1024M',
      '-jar',
      serverJarPath,
      '--nogui'
    ], {
      cwd: serverDirectory,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Add process to activeProcesses immediately
    activeProcesses.set(serverId, process);

    // Track startup success
    let startedSuccessfully = false;

    // Cleanup function to remove all listeners
    const cleanup = () => {
      clearTimeout(startupTimeout);
      process.stdout?.removeAllListeners('data');
      process.stderr?.removeAllListeners('data');
      process.removeAllListeners('close');
      process.removeAllListeners('error');
      process.stdin?.removeAllListeners('error');
    };

    const startupTimeout = setTimeout(() => {
      if (!startedSuccessfully) {
        devError(`Server ${serverId} startup timed out after 120 seconds`);
        process.kill();
        activeProcesses.delete(serverId);
        cleanup(); // Clean up listeners
        reject(new Error('Server startup timed out after 120 seconds'));
      }
    }, 30000); // 120 second timeout

    // Ensure stdout is available
    if (!process.stdout) {
      devError('Server process stdout is not available');
      cleanup(); // Clean up listeners
      reject(new Error('Server process stdout is not available'));
      return;
    }

    // Ensure stderr is available
    if (!process.stderr) {
      devError('Server process stderr is not available');
      cleanup(); // Clean up listeners
      reject(new Error('Server process stderr is not available'));
      return;
    }

    // Set up stdout handler
    const onStdout = (data: Buffer) => {
      const output = data.toString();
      devLog(`[Server ${serverId} stdout]: ${output}`);

      // Send output to renderer
      sendToRenderer(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT, output);

      // Check for successful startup message
      if (output.includes('Done') || output.includes('For help, type "help"')) {
        startedSuccessfully = true;
        clearTimeout(startupTimeout);
        devLog(`Server ${serverId} started successfully`);
        // Send status update to renderer
        sendToRenderer(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
          status: "Server running",
          type: "minecraft"
        });
        resolve();
      }
    };

    // Set up stderr handler
    const onStderr = (data: Buffer) => {
      const output = data.toString();
      devError(`[Server ${serverId} stderr]: ${output}`);
      
      // Send error output to renderer
      sendToRenderer(IPC_CHANNELS.SERVER_CONSOLE_ERROR, output);
      
      // Check for file locking errors
      if (output.includes('cannot access the file because another process has locked')) {
        devError('Detected file locking issue, attempting cleanup...');
        // We'll let the process continue and handle the error in the close event
      }
    };

    // Set up process event handlers
    const onClose = (code: number) => {
      devLog(`Server ${serverId} process closed with code ${code}`);
      if (!startedSuccessfully) {
        clearTimeout(startupTimeout);
        activeProcesses.delete(serverId);
        cleanup(); // Clean up listeners
        reject(new Error(`Server process exited with code ${code}`));
      }
    };

    const onError = (error: Error) => {
      devError(`Server ${serverId} process error: ${error.message}`);
      if (!startedSuccessfully) {
        clearTimeout(startupTimeout);
        activeProcesses.delete(serverId);
        cleanup(); // Clean up listeners
        reject(error);
      }
    };

    // Attach all listeners
    process.stdout.on('data', onStdout);
    process.stderr.on('data', onStderr);
    process.on('close', onClose);
    process.on('error', onError);

    // Set up stdin error handler
    process.stdin.on('error', (error) => {
      devError(`Server ${serverId} stdin error: ${error.message}`);
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
      // Send status update
      sendToRenderer(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
        status: "Server stopped",
        type: "minecraft"
      });
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

    // Send status update
    sendToRenderer(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
      status: "Server stopped",
      type: "minecraft"
    });

    return {success: true};
  } catch (err) {
    return {success: false, error: `Shutdown failed: ${err instanceof Error ? err.message : String(err)}`};
  } finally {
    activeProcesses.delete(serverId);
  }
}

export async function sendCommand(serverId: string, command: string): Promise<void> {
  devLog(`Attempting to send command to server ${serverId}: ${command}`);
  devLog(`Current active processes: ${Array.from(activeProcesses.keys()).join(', ')}`);

  const process = activeProcesses.get(serverId);
  if (!process) {
    devError(`Server process not found for ID: ${serverId}`);
    throw new Error('Server process not found');
  }

  if (!process.stdin?.writable) {
    devError(`Server stdin not available for ID: ${serverId}`);
    throw new Error('Server stdin not available');
  }

  try {
    // Add newline to command if not present
    const commandWithNewline = command.endsWith('\n') ? command : `${command}\n`;
    devLog(`Writing command to server stdin: ${commandWithNewline}`);
    
    // Write command to stdin and wait for it to complete
    await new Promise<void>((resolve, reject) => {
      process.stdin!.write(commandWithNewline, (error) => {
        if (error) {
          devError(`Error writing command to server stdin: ${error}`);
          reject(error);
        } else {
          devLog(`Successfully wrote command to server stdin`);
          resolve();
        }
      });
    });
  } catch (error) {
    devError(`Failed to write command to server ${serverId}: ${error}`);
    throw error;
  }
}

export function registerServerServiceHandlers() {
  ipcMain.handle('CHECK_FILE_EXISTS', (_, path: string) => {
    return fsSync.existsSync(path);
  });

  ipcMain.handle('CHECK_PORT', (_, port: number) => checkPort(port));

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

  ipcMain.handle(IPC_CHANNELS.SERVER_SEND_COMMAND, async (_, { serverId, command }) => {
    try {
      await sendCommand(serverId, command);
      return { success: true };
    } catch (error) {
      devError(`Failed to send command: ${error}`);
      throw error;
    }
  });
}

export async function checkPort(port: number): Promise<boolean> {
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
