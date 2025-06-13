import { ipcMain } from 'electron';
import { join } from 'path';
import fs from 'fs/promises';
import { IPC_CHANNELS } from '../../shared/types';
import { devLog, devError } from '../utils/logger';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { activeProcesses } from '../services/serverService';
import { checkPort } from '../services/serverService';
import { readServerList } from './serverListHandlers';

let minecraftServerProcess: ChildProcessWithoutNullStreams | null = null;
let minecraftServerPid: number | null = null;
let serverStartupPromise: Promise<void> | null = null; // Track the startup promise
let rejectStartupPromise: ((reason?: any) => void) | null = null; // Function to reject the promise
let resolveStartupPromise: (() => void) | null = null; // Function to resolve the promise

function cleanupMinecraftServerProcess() {
  if (minecraftServerProcess) {
    devLog('Attempting to terminate existing Minecraft server process...');
    if (!minecraftServerProcess.killed) {
      minecraftServerProcess.kill();
      devLog('Minecraft server process terminated.');
    } else {
      devLog('Minecraft server process was already killed.');
    }
    minecraftServerProcess = null;
  }
  // Extra safety: kill by PID if still running
  if (minecraftServerPid) {
    try {
      process.kill(minecraftServerPid);
      devLog(`Killed Minecraft server process by PID: ${minecraftServerPid}`);
    } catch (e) {
      // It's OK if the process is already dead
    }
    minecraftServerPid = null;
  }
}

// Add a new function to handle cleanup with delay and verification
async function cleanupWithDelay(serverDirectory: string): Promise<void> {
  cleanupMinecraftServerProcess();
  
  // Wait a moment for file handles to be released
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Attempt to delete the latest.log file
  const latestLogPath = join(serverDirectory, 'logs', 'latest.log');
  try {
    await fs.unlink(latestLogPath);
    devLog(`Successfully deleted ${latestLogPath}`);
  } catch (error) {
    // If we can't delete the file, it's not critical - the server will handle it
    devLog(`Could not delete ${latestLogPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to set up listeners for server process output and events
function setupServerProcessListeners(
  serverProcess: ChildProcessWithoutNullStreams,
  event: Electron.IpcMainInvokeEvent,
  serverType: string
) {
  let output = '';
  let errorOutput = '';

  // Cleanup function to remove all listeners
  const cleanup = () => {
    serverProcess.stdout?.removeAllListeners('data');
    serverProcess.stderr?.removeAllListeners('data');
    serverProcess.removeAllListeners('close');
    serverProcess.removeAllListeners('error');
  };

  const onStdout = (data: Buffer) => {
    const message = data.toString();
    output += message;
    devLog(`Server stdout: ${message}`);
    event.sender.send(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT, message);

    if (serverType === 'vanilla' && message.includes('Done')) {
      devLog('Vanilla server startup detected!');
      event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
        status: "Server running",
        type: "minecraft"
      });
      resolveStartupPromise?.();
      cleanup(); // Cleanup listeners after successful startup
    }
  };

  const onStderr = (data: Buffer) => {
    const message = data.toString();
    errorOutput += message;
    devError(`Server stderr: ${message}`);
    event.sender.send(IPC_CHANNELS.SERVER_CONSOLE_ERROR, message);
  };

  const onClose = (code: number | null) => {
    devLog(`Server process closed with code ${code}`);
    if (rejectStartupPromise && !resolveStartupPromise) {
      const errorMsg = `Server process exited unexpectedly with code ${code}. Check logs for details.`;
      devError(errorMsg);
      event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { success: false, error: errorMsg });
      rejectStartupPromise(new Error(errorMsg));
    }
    cleanup(); // Cleanup listeners on process close
  };

  const onError = (err: Error) => {
    devError(`Server process error: ${err.message}`);
    if (rejectStartupPromise) {
      rejectStartupPromise(err);
    }
    cleanup(); // Cleanup listeners on error
  };

  // Attach listeners
  serverProcess.stdout.on('data', onStdout);
  serverProcess.stderr.on('data', onStderr);
  serverProcess.on('close', onClose);
  serverProcess.on('error', onError);

  // Set a timeout for the promise itself
  const startupTimeout = setTimeout(() => {
    if (rejectStartupPromise) {
      const timeoutErrorMsg = 'Server startup timed out.';
      devError(timeoutErrorMsg);
      event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { success: false, error: timeoutErrorMsg });
      rejectStartupPromise(new Error(timeoutErrorMsg));
      cleanup(); // Cleanup listeners on timeout
    }
  }, 120000);

  // Clean up timeout if promise resolves or rejects normally
  serverStartupPromise?.finally(() => {
    clearTimeout(startupTimeout);
    cleanup(); // Extra cleanup for safety
  });
}

// Add this helper function
async function cleanupServerFiles(serverDirectory: string) {
  try {
    const files = await fs.readdir(serverDirectory);
    await Promise.all(files.map(async file => {
      if (file.endsWith('.lock') || file === 'session.lock') {
        await fs.unlink(join(serverDirectory, file));
      }
    }));
  } catch (error) {
    devLog('Cleanup warning:', error instanceof Error ? error.message : String(error));
  }
}

// Add port checking utility
export async function findAvailablePort(startPort: number, existingPorts: number[] = []) {
  let port = startPort;
  while (await checkPort(port) || existingPorts.includes(port)) {
    port++;
    if (port > 65535) {
      port = 1024; // Wrap around to avoid overflow
    }
  }
  return port;
}

async function getExistingServers() {
  return await readServerList();
}

export function registerMinecraftHandlers() {
  // Handle preparing server files
  ipcMain.handle(IPC_CHANNELS.SERVER_PREPARE_FILES, async (_event, { serverDirectory, serverType, ramGB, worldPath, importedWorld, javaPath, port }: { serverDirectory: string; serverType: string; ramGB: number; worldPath?: string; importedWorld?: boolean; javaPath: string; port: number }) => {
    devLog('[Port Tracking] Preparing files with port:', port);
    try {
      // Fetch existing server ports from the server list
      const existingServers = await getExistingServers();
      const existingPorts = existingServers.map(server => server.port).filter(Boolean);

      // Use the updated findAvailablePort function
      const assignedPort = await findAvailablePort(port, existingPorts);
      devLog('[Port Tracking] Assigned unique port:', assignedPort);

      // Validate input
      if (!serverDirectory || typeof serverDirectory !== 'string') {
        throw new Error('Invalid server directory provided');
      }
      if (!serverType || typeof serverType !== 'string') {
        throw new Error('Invalid server type provided');
      }
      if (!ramGB || typeof ramGB !== 'number') {
        throw new Error('Invalid RAM amount provided');
      }
      if (!javaPath || typeof javaPath !== 'string') {
        throw new Error('Invalid Java path provided');
      }

      devLog(`Preparing server files for type: ${serverType} in ${serverDirectory}`);

      // Ensure the server directory exists
      await fs.mkdir(serverDirectory, { recursive: true });
      _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { status: 'Creating directories' });

      if (serverType === 'vanilla') {
        const serverJarPath = join(serverDirectory, 'server.jar');
        if (!serverJarPath) {
          throw new Error('Failed to construct server jar path');
        }
        const serverPropertiesPath = join(serverDirectory, 'server.properties');

        // Handle world directory based on whether a world was imported
        const serverWorldPath = join(serverDirectory, 'world');
        if (importedWorld && worldPath) {
          // Normalize paths for comparison to avoid issues with different path separators or trailing slashes
          const normalizedWorldPath = worldPath.endsWith('/') || worldPath.endsWith('\\') ? worldPath.slice(0, -1) : worldPath;
          const normalizedServerWorldPath = serverWorldPath.endsWith('/') || serverWorldPath.endsWith('\\') ? serverWorldPath.slice(0, -1) : serverWorldPath;

          if (normalizedWorldPath === normalizedServerWorldPath) {
            devLog(`World directory already exists at target location: ${serverWorldPath}. Skipping copy operation.`);
          } else {
            devLog(`Importing existing world from ${worldPath} to ${serverWorldPath}`);
            _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { status: 'Importing world' });
            // Ensure the target world directory is clean before copying
            try {
              await fs.rm(serverWorldPath, { recursive: true, force: true });
              devLog(`Cleaned up existing server world directory at ${serverWorldPath} for import.`);
            } catch (error) {
              devLog(`Could not clean up server world directory for import: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Copy the world contents
            await fs.cp(worldPath, serverWorldPath, { recursive: true });
            devLog(`Copied world from ${worldPath} to ${serverWorldPath}`);
          }
        } else {
          // Clean up existing world directory if it exists (for new world generation)
          try {
            await fs.rm(serverWorldPath, { recursive: true, force: true });
            devLog(`Cleaned up existing world directory at ${serverWorldPath} for new world generation.`);
          } catch (error) {
            devLog(`Could not clean up world directory for new world generation: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        devLog(`Attempting to download vanilla server.jar to ${serverJarPath}`);
        _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { status: 'Downloading server' });

        // Download the server.jar using the hardcoded URL
        const hardcodedServerDownloadUrl = 'https://piston-data.mojang.com/v1/objects/e6ec2f64e6080b9b5d9b471b291c33cc7f509733/server.jar'; // Hardcoded URL for 1.21.5
        devLog(`Downloading vanilla server.jar from hardcoded URL: ${hardcodedServerDownloadUrl}`);
        const response = await fetch(hardcodedServerDownloadUrl);
        if (!response.ok) throw new Error(`Failed to download server.jar: ${response.statusText}`);
        
        const buffer = await response.arrayBuffer();
        await fs.writeFile(serverJarPath, Buffer.from(buffer));
        devLog(`Downloaded server.jar successfully to ${serverJarPath}`);

        // Create basic server.properties
        _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { status: 'Configuring server' });
        const defaultProperties = [
          `server-port=${assignedPort}`,
          'server-ip=0.0.0.0', // Explicitly bind to all network interfaces
          'gamemode=survival',
          'difficulty=easy',
          'max-players=20',
          'online-mode=true',
          'white-list=false',
          'enforce-whitelist=false', // Don't enforce whitelist by default
          'blacklist-enabled=false', // Don't enable blacklist by default
          'spawn-protection=16',
          'view-distance=10',
          'simulation-distance=10',
          'motd=Welcome to EasyCraft Server!',
          'enable-status=true', // Prevent server from pausing when empty
          'pause-when-empty-seconds=0'
        ].join('\n');
        await fs.writeFile(serverPropertiesPath, defaultProperties);
        devLog(`Created basic server.properties at ${serverPropertiesPath}`);

        // Create eula.txt (Moved from ACCEPT_EULA handler)
        const eulaPath = join(serverDirectory, 'eula.txt');
        const eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).\n#Generated for Minecraft Server\neula=true\n`;
        await fs.writeFile(eulaPath, eulaContent, 'utf-8');
        devLog(`Created or updated eula.txt at ${eulaPath} with acceptance.`);

        // Validate RAM allocation
        const maxRamMB = Math.min(ramGB * 1024, 16384); // Cap at 16GB
        const minRamMB = Math.min(1024, maxRamMB); // Minimum 1GB or max if lower

        // Start the server to generate world files
        devLog(`Attempting to start ${serverType} server in ${serverDirectory} with ${maxRamMB}MB RAM.`);
        _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { status: 'Generating world' });
        const command = `${javaPath} -Xmx${maxRamMB}M -Xms${minRamMB}M -jar "${serverJarPath}" --nogui`;
        devLog(`Starting server with command: ${command}`);

        // Clean up any existing server process before starting a new one
        cleanupMinecraftServerProcess();

        // Log a message about potential connection issues
        devLog('Note: If players cannot connect, check Windows Firewall settings for port 25565');

        // Attempt to delete the latest.log file to clear potential locks
        const latestLogPath = join(serverDirectory, 'logs', 'latest.log');
        try {
          await fs.unlink(latestLogPath);
          devLog(`Successfully deleted ${latestLogPath}`);
        } catch (error) {
          // Ignore if the file doesn't exist or cannot be deleted
          devLog(`Could not delete ${latestLogPath}: ${error instanceof Error ? error.message : String(error)}`);
        }

        const serverProcess = spawn(javaPath, [
          `-Xmx${maxRamMB}M`,
          `-Xms${minRamMB}M`,
          '-jar',
          serverJarPath,
          '--nogui'
        ], {
          cwd: serverDirectory,
          stdio: ['pipe', 'pipe', 'pipe']
        }) as ChildProcessWithoutNullStreams;

        // Check if the process was successfully spawned and streams are available
        if (!serverProcess || !serverProcess.stdout || !serverProcess.stderr) {
          devError('Failed to spawn server process or get streams');
          _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
            success: false, 
            error: 'Failed to start server process streams are missing' 
          });
          // No process to kill, just return
          return { success: false, message: 'Failed to start server process streams are missing' };
        }

        // Wait for server to start and generate files
        await new Promise<void>((resolve, reject) => {
          let output = '';
          let errorOutput = '';

          serverProcess.stdout?.on('data', (data) => {
            const message = data.toString();
            output += message;
            devLog(`Server stdout: ${message}`);
            // Send console output to renderer
            _event.sender.send(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT, message);
            
            // Check for successful startup
            if (message.includes('Done') || message.includes('For help, type "help"')) {
              resolve();
            }
          });

          serverProcess.stderr?.on('data', (data) => {
            const message = data.toString();
            errorOutput += message;
            devError(`Server stderr: ${message}`);
            // Send console error output to renderer
            _event.sender.send(IPC_CHANNELS.SERVER_CONSOLE_ERROR, message);

            // Check for specific fatal error patterns to proactively stop the process
            if (
              message.includes('FileSystemException') ||
              message.includes('Failed to start the minecraft server') ||
              message.includes('Error:')
            ) {
              devError('Detected fatal server startup error. Signalling failure and attempting to terminate process.');
              _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
                success: false, 
                error: `Server startup failed: ${message}` 
              });
              // Attempt to kill the process to prevent hanging
              if (minecraftServerProcess && !minecraftServerProcess.killed) {
                minecraftServerProcess.kill();
              }
            }
          });

          serverProcess.on('close', (code) => {
            devLog(`Server process closed with code ${code}`);
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Server process exited with code ${code}\nOutput: ${output}\nError: ${errorOutput}`));
            }
          });

          // Set a timeout for the entire startup process
          setTimeout(() => {
            serverProcess.kill();
            reject(new Error('Server startup timed out'));
          }, 300000); // 300 second timeout
        });

        minecraftServerPid = serverProcess.pid ?? null;
        return { success: true, message: 'Vanilla server files prepared successfully.', port: assignedPort };
      } else {
        // Mock behavior for other server types
        devLog(`Mock preparation for ${serverType} server.`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work
        return { success: true, message: `Preparation step simulated for ${serverType} server.` };
      }

    } catch (error) {
      devError('Failed to prepare server files:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to prepare server files' 
      };
    }
  });

  // Handle starting the Minecraft server
  ipcMain.handle(IPC_CHANNELS.SERVER_START, async (_event, { serverId, serverDirectory, serverType, ram, javaPath }: { serverId: string; serverDirectory: string; serverType: string; ram: number; javaPath: string }) => {
    if (!serverId) {
      throw new Error('Server startup failed: no server ID provided');
    }

    console.log('Starting server with ID:', serverId);
    await cleanupServerFiles(serverDirectory); // Add this line
    
    // Create a new promise for this startup attempt
    serverStartupPromise = new Promise<void>((resolve, reject) => {
      resolveStartupPromise = resolve; // Store resolve function
      rejectStartupPromise = reject; // Store reject function
    });

    try {
      // Validate input
      if (!serverDirectory || typeof serverDirectory !== 'string') {
        throw new Error('Invalid server directory provided');
      }
      if (!serverType || typeof serverType !== 'string') {
        throw new Error('Invalid server type provided');
      }
      if (!ram || typeof ram !== 'number') {
        throw new Error('Invalid RAM amount provided');
      }
      if (!javaPath || typeof javaPath !== 'string') {
        throw new Error('Invalid Java path provided');
      }

      _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { status: 'Allocating memory' });

      const serverJarPath = join(serverDirectory, 'server.jar');
      // No need to check serverJarPath existence here, PREPARE_SERVER_FILES handles download

      // Validate RAM allocation
      const maxRamMB = Math.min(ram * 1024, 16384); // Cap at 16GB
      const minRamMB = Math.min(1024, maxRamMB); // Minimum 1GB or max if lower

      devLog(`Starting ${serverType} server in ${serverDirectory} with ${maxRamMB}MB RAM.`);

      // Clean up any existing server process and wait for file handles to be released
      _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { status: 'Cleaning up' });
      await cleanupWithDelay(serverDirectory);

      _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { status: 'Launching server' });

      // Clean up any existing process with this ID first
      if (activeProcesses.has(serverId)) {
        activeProcesses.get(serverId)?.kill();
        activeProcesses.delete(serverId);
      }

      // Read the assigned port from server.properties
      const serverPropertiesPath = join(serverDirectory, 'server.properties');
      const properties = await fs.readFile(serverPropertiesPath, 'utf8');
      const portMatch = properties.match(/server-port=(\d+)/);
      let port = portMatch ? parseInt(portMatch[1]) : 25565;
      devLog('[Port Tracking] Starting server with port from server.properties:', port);
      
      // Verify port is available
      if (await checkPort(port)) {
        port = await findAvailablePort(port);
        // Update server.properties with new port
        const updatedProperties = properties.replace(
          /server-port=\d+/g, 
          `server-port=${port}`
        );
        await fs.writeFile(serverPropertiesPath, updatedProperties);
      }

      const serverProcess = spawn(javaPath, [
        `-Xmx${maxRamMB}M`,
        `-Xms${minRamMB}M`,
        '-jar',
        serverJarPath,
        '--nogui'
      ], {
        cwd: serverDirectory,
        stdio: ['pipe', 'pipe', 'pipe']
      }) as ChildProcessWithoutNullStreams;

      activeProcesses.set(serverId, serverProcess); // Track with serverId

      // Check if the process was successfully spawned and streams are available
      if (!serverProcess || !serverProcess.stdout || !serverProcess.stderr) {
        const errorMsg = 'Failed to spawn Minecraft server process or get streams';
        devError(errorMsg);
        // Send failure to renderer immediately
        _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { success: false, error: errorMsg });
        // Reject the promise to signal failure to the renderer's invoke call
        rejectStartupPromise?.(new Error(errorMsg));
        // No process to kill, just return
        return { success: false, message: 'Failed to start server process streams are missing' };
      }

      // Set up event listeners for server output and events using the helper
      setupServerProcessListeners(serverProcess, _event, serverType);

      // Wait for the serverStartupPromise to resolve (indicating 'Done') or reject (indicating error/timeout)
      await serverStartupPromise;

      // If we reach here, the promise resolved successfully.
      // The SERVER_STATUS_UPDATE success message was already sent by the stdout listener.
      minecraftServerPid = serverProcess.pid ?? null;
      return { 
        success: true,
        message: 'Server started successfully',
        port: port
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unexpected error';
      // Only send via IPC, don't re-throw
      _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
        success: false, 
        error: errorMsg 
      });
      return { success: false, message: errorMsg }; // Return instead of throw
    }
  });

  // Add IPC handler for CHECK_PORT
  ipcMain.handle(IPC_CHANNELS.CHECK_PORT, async (_event, port: number) => {
    return await checkPort(port);  // Use the existing checkPort function
  });
} 