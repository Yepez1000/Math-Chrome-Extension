import { ipcMain } from 'electron';
import { join } from 'path';
import fs from 'fs/promises';
import { IPC_CHANNELS } from '../../shared/types';
import { devLog, devError } from '../utils/logger';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { execAsync } from '../utils/execAsync';

let minecraftServerProcess: ChildProcessWithoutNullStreams | null = null;
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
}

// Add a new function to handle cleanup with delay and verification
async function cleanupWithDelay(serverDirectory: string): Promise<void> {
  cleanupMinecraftServerProcess();
  
  // Wait a moment for file handles to be released
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Verify no Java process is running the server.jar
  try {
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq java.exe" /FO CSV /NH');
    const javaProcesses = stdout.split('\n')
      .filter(line => line.includes('java.exe'))
      .map(line => line.split(',')[1].replace(/"/g, '').trim());
    
    if (javaProcesses.length > 0) {
      devLog('Found running Java processes, attempting to terminate them...');
      // Use Promise.all to try terminating all processes concurrently, ignoring individual errors
      await Promise.all(javaProcesses.map(pid =>
        execAsync(`taskkill /F /PID ${pid}`).catch((error) => {
           devLog(`Could not terminate Java process ${pid}: ${error instanceof Error ? error.message : String(error)}`);
        }) // Catch errors for individual taskkill commands
      ));
      // Wait again after killing processes
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    devLog(`Error checking for Java processes: ${error instanceof Error ? error.message : String(error)}`);
  }
  
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
  let output = ''; // Accumulate output for potential error reporting
  let errorOutput = ''; // Accumulate error output

  serverProcess.stdout.on('data', (data) => {
    const message = data.toString();
    output += message; // Accumulate output
    devLog(`Server stdout: ${message}`);
    event.sender.send(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT, message);

    // Check for specific fatal error patterns in stdout
    // Exclude log file deletion errors as they're not fatal
    if (
      (message.includes('Failed to start the minecraft server') ||
      message.includes('Error:') ||
      message.toLowerCase().includes('exception')) &&
      !message.includes('Unable to delete file') && // Exclude log file deletion errors
      !message.includes('FileSystemException:') // Exclude file system errors
    ) {
      const errorMsg = `Server startup failed (stdout): ${message.substring(0, 200)}...`;
      devError('Detected potential fatal server startup error in stdout. Signalling failure and attempting to terminate process.', errorMsg);
      event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { success: false, error: errorMsg });
      // Attempt to kill the process to prevent hanging
      if (minecraftServerProcess && !minecraftServerProcess.killed) {
        minecraftServerProcess.kill();
      }
      // Reject the promise to signal failure to the renderer's invoke call
      rejectStartupPromise?.(new Error(errorMsg));
    }

    // Check for successful startup (Vanilla "Done" message)
    if (serverType === 'vanilla' && message.includes('Done')) {
      devLog('Vanilla server startup detected!');
      event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { success: true, message: 'Server started successfully!' });
      // Resolve the promise to signal success to the renderer's invoke call
      resolveStartupPromise?.();
    }
  });

  serverProcess.stderr.on('data', (data) => {
    const message = data.toString();
    errorOutput += message; // Accumulate error output
    devError(`Server stderr: ${message}`);
    event.sender.send(IPC_CHANNELS.SERVER_CONSOLE_ERROR, message);

    // Check for specific fatal error patterns in stderr
    // Exclude log file deletion errors as they're not fatal
    if (
      (message.includes('Failed to start the minecraft server') ||
      message.includes('Error:') ||
      message.toLowerCase().includes('exception')) &&
      !message.includes('Unable to delete file') && // Exclude log file deletion errors
      !message.includes('FileSystemException:') // Exclude file system errors
    ) {
      const errorMsg = `Server startup failed (stderr): ${message.substring(0, 200)}...`;
      devError('Detected potential fatal server startup error in stderr. Signalling failure and attempting to terminate process.', errorMsg);
      event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { success: false, error: errorMsg });
      // Attempt to kill the process to prevent hanging
      if (minecraftServerProcess && !minecraftServerProcess.killed) {
        minecraftServerProcess.kill();
      }
      // Reject the promise to signal failure to the renderer's invoke call
      rejectStartupPromise?.(new Error(errorMsg));
    }
  });

  serverProcess.on('close', (code: number | null) => {
    devLog(`Server process closed with code ${code}`);
    // If the promise hasn't already been resolved (meaning "Done" wasn't seen),
    // then a close event indicates an unexpected shutdown/failure.
    // The server should run indefinitely until stopped via the UI.
    // We also check if the reject function exists before calling it.
    if (rejectStartupPromise && serverStartupPromise && !('hasOwnProperty' in serverStartupPromise && (serverStartupPromise.hasOwnProperty('_fulfilled') || serverStartupPromise.hasOwnProperty('_rejected')))) {
       const errorMsg = `Server process exited unexpectedly with code ${code}. Check logs for details.`;
       devError(errorMsg);
       event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { success: false, error: errorMsg });
       // Reject the promise to signal failure to the renderer's invoke call
       rejectStartupPromise(new Error(errorMsg));
    } else if (code !== 0) {
        // If the promise *was* resolved but the code is non-zero, it might be an issue,
        // but the SERVER_STATUS_UPDATE success has already been sent.
        devError(`Server process closed with non-zero code ${code} AFTER startup signal.`);
    }
  });

  // Set a timeout for the promise itself, in case the process hangs without output/closing
  const startupTimeout = setTimeout(() => {
    // If the promise hasn't already been resolved (meaning "Done" wasn't seen)
    // We also check if the reject function exists before calling it.
    if (rejectStartupPromise && serverStartupPromise && !('hasOwnProperty' in serverStartupPromise && (serverStartupPromise.hasOwnProperty('_fulfilled') || serverStartupPromise.hasOwnProperty('_rejected')))) {
       const timeoutErrorMsg = 'Server startup timed out.';
       devError(timeoutErrorMsg);
       event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { success: false, error: timeoutErrorMsg });
       // Attempt to kill the process
       if (minecraftServerProcess && !minecraftServerProcess.killed) {
           minecraftServerProcess.kill();
       }
       // Reject the promise
       rejectStartupPromise(new Error(timeoutErrorMsg));
    }
  }, 60000); // 60 second timeout

  // Clean up timeout if promise resolves or rejects normally
  serverStartupPromise?.finally(() => clearTimeout(startupTimeout));
}

export function registerMinecraftHandlers() {
  // Handle preparing server files
  ipcMain.handle(IPC_CHANNELS.SERVER_PREPARE_FILES, async (_event, { serverDirectory, serverType, ramGB, worldPath, importedWorld, javaPath }: { serverDirectory: string; serverType: string; ramGB: number; worldPath?: string; importedWorld?: boolean; javaPath: string }) => {
    try {
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
          'server-port=25565',
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
            
            // Check for successful startup
            if (message.includes('Done') || message.includes('For help, type "help"')) {
              resolve();
            }
          });

          serverProcess.stderr?.on('data', (data) => {
            const message = data.toString();
            errorOutput += message;
            devError(`Server stderr: ${message}`);

            // Check for specific fatal error patterns to proactively stop the process
            if (
              message.includes('FileSystemException') ||
              message.includes('Failed to start the minecraft server') ||
              message.includes('Error:')
            ) {
              devError('Detected fatal server startup error. Signalling failure and attempting to terminate process.');
              _event.sender.send(IPC_CHANNELS.SERVER_CONSOLE_ERROR, message);
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
          }, 30000); // 30 second timeout
        });

        return { success: true, message: 'Vanilla server files prepared successfully.' };
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
  ipcMain.handle(IPC_CHANNELS.SERVER_START, async (_event, { serverDirectory, serverType, ram, javaPath }: { serverDirectory: string; serverType: string; ram: number; javaPath: string }) => {
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
      minecraftServerProcess = spawn(javaPath, [
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
      if (!minecraftServerProcess?.stdout || !minecraftServerProcess?.stderr) {
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
      setupServerProcessListeners(minecraftServerProcess, _event, serverType);

      // Wait for the serverStartupPromise to resolve (indicating 'Done') or reject (indicating error/timeout)
      await serverStartupPromise;

      // If we reach here, the promise resolved successfully.
      // The SERVER_STATUS_UPDATE success message was already sent by the stdout listener.
      return { success: true, message: 'Minecraft server startup process completed successfully.' };

    } catch (error) {
      // Catch errors that happen *before* the promise or spawn (e.g., invalid inputs, cleanup errors)
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred during server startup setup.';
      devError('Caught error during server startup setup:', error);
      // Send failure to renderer if not already sent by listeners
      _event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { success: false, error: errorMsg });
      // Reject the promise if it hasn't been already
      rejectStartupPromise?.(new Error(errorMsg));

      // Rethrow the error so the invoke call also rejects in the renderer
      throw error;
    }
  });
} 