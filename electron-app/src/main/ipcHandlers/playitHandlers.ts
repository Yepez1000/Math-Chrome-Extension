import { ipcMain, BrowserWindow, app } from 'electron'; // Import 'app'
import { spawn, ChildProcessWithoutNullStreams, exec } from 'child_process'; // Import 'exec'
import { IPC_CHANNELS } from '../../shared/types';
import { join } from 'path';
import fs from 'fs/promises'; // Use promises version of fs

let playitProcess: ChildProcessWithoutNullStreams | null = null;
let mainWindow: BrowserWindow | null = null;

// --- Task 3: Platform Support and Binary Handling ---
async function getPlayitBinaryPath(): Promise<string> {
  const platform = process.platform;
  let binaryName = '';
  let binaryDir = ''; // Directory where binaries are stored

  // Determine binary name and directory based on OS
  if (platform === 'win32') {
    binaryName = 'playit-windows-x64.exe';
    // Assuming binaries are in a 'bin/playit' folder relative to app root
    // In production, app.getAppPath() points to the app bundle root.
    // In development, it points to your project root.
    binaryDir = join(app.getAppPath(), 'bin', 'playit', 'win');
  } else if (platform === 'darwin') { // macOS
    binaryName = 'playit-macos-x64';
     // Assuming binaries are in 'bin/playit'
    binaryDir = join(app.getAppPath(), 'bin', 'playit', 'mac');
  } else if (platform === 'linux') {
    binaryName = 'playit-linux-x64';
     // Assuming binaries are in 'resources/playit_binaries'
     binaryDir = join(app.getAppPath(), 'resources', 'playit_binaries', 'linux');
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const binaryPath = join(binaryDir, binaryName);

  // --- Task 3: Ensure Playit is bundled or downloaded per platform ---
  // For this implementation, we assume the binaries are *bundled*
  // in the resources/playit_binaries/[os] directory.
  // TODO: If you need auto-downloading, that logic would go here.

  // --- Task 3: Set execute permissions for macOS/Linux (chmod +x) ---
  if (platform !== 'win32') {
    try {
      // Check if binary exists before trying to chmod
       await fs.access(binaryPath, fs.constants.F_OK); // Check if file exists
      console.log(`Setting execute permissions for ${binaryPath}`);
      // Use 'exec' for chmod as it's a simple command
      await new Promise<void>((resolve, reject) => {
        exec(`chmod +x "${binaryPath}"`, (error) => {
          if (error) {
            console.error(`chmod +x failed for ${binaryPath}:`, error);
             // Decide if this is a fatal error or just a warning
             // For now, we'll reject to stop the process
            reject(new Error(`Failed to set execute permissions for binary: ${error.message}`));
          } else {
            console.log(`Execute permissions set for ${binaryPath}`);
            resolve();
          }
        });
      });
    } catch (err: any) {
        // If fs.access failed, the binary wasn't found
        if (err.code === 'ENOENT') {
             throw new Error(`Playit binary not found at expected path: ${binaryPath}`);
        } else {
            // Other file system errors
             throw new Error(`Error accessing Playit binary at ${binaryPath}: ${err.message}`);
        }
    }
  } else {
      // On Windows, just check if the file exists
       try {
           await fs.access(binaryPath, fs.constants.F_OK);
       } catch (err: any) {
            if (err.code === 'ENOENT') {
                 throw new Error(`Playit binary not found at expected path: ${binaryPath}`);
            } else {
                 throw new Error(`Error accessing Playit binary at ${binaryPath}: ${err.message}`);
            }
       }
  }

  console.log('Resolved Playit binary path:', binaryPath);
  return binaryPath;
}


export function registerPlayitHandlers(window: BrowserWindow) {
  mainWindow = window;

  ipcMain.handle(IPC_CHANNELS.START_TUNNEL, async (_event, serverPort: number) => {
    if (playitProcess) {
      console.log('Playit process already running.');
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: 'Tunnel is already starting or running.' });
      return { success: false, message: 'Tunnel is already starting or running.' };
    }

    let binaryPath: string;
    try {
        binaryPath = await getPlayitBinaryPath();
    } catch (error: any) {
        console.error('Failed to get Playit binary path:', error);
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: `Setup Error: ${error.message}` });
         mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Error', message: `Setup Error: ${error.message}` });
        return { success: false, message: `Setup Error: ${error.message}` };
    }

    // --- Add API Secret Handling ---
    const playitSecret = process.env.PLAYIT_SECRET; // Read from environment variable
    if (!playitSecret) {
        const errorMessage = 'Playit.gg API secret not found. Please set the PLAYIT_SECRET environment variable.';
        console.error(errorMessage);
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: errorMessage });
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Error', message: errorMessage });
        return { success: false, message: errorMessage };
    }

    // --- Task 1: Run Playit binary via child_process.spawn ---
    // Adjust args to include the API secret
    const args = ['--secret', playitSecret, '--port', serverPort.toString()]; // Include secret and port

    console.log(`Starting Playit.gg tunnel: "${binaryPath}" ${args.join(' ')}`);

    try {
      playitProcess = spawn(binaryPath, args);

      // --- Task 2: IPC Messaging (Main ↔ Renderer) - Send Status ---
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Starting...', message: 'Locating Playit binary and preparing tunnel...' });

      // --- Task 1: Parse the Playit stdout for the public link ---
      playitProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Playit stdout: ${output}`);

        // Look for the public address pattern (e.g., 'mc.playit.gg:#####')
        // This regex might need refinement based on actual Playit output
        const match = output.match(/mc\.playit\.gg:\d+/);

        if (match && match[0]) {
          const publicAddress = match[0];
          console.log('Playit public address found:', publicAddress);

          // --- Task 2: IPC Messaging (Main ↔ Renderer) - Send Address ---
          mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ADDRESS, { address: publicAddress });

          // Optional: Send a status update indicating success
          mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Connected', address: publicAddress, message: `Tunnel active at ${publicAddress}` });

          // If you only expect one address, you might want to remove this listener
          // playitProcess?.stdout.removeAllListeners('data');
        } else {
             // Send other stdout data as status updates maybe?
             mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Starting...', message: output.trim() });
        }
      });

      // --- Task 1: Log errors and unexpected exits ---
      // --- Task 2: IPC Messaging (Main ↔ Renderer) - Send Error ---
      playitProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        console.error(`Playit stderr: ${errorOutput}`);
        // Send error details to the renderer
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: errorOutput });
         // Send a status update indicating error
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Error', message: errorOutput.trim() });
      });

      playitProcess.on('error', (err) => {
        console.error('Playit process failed to start.', err);
         // Send error to renderer
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: `Failed to start Playit process: ${err.message}` });
         // Send a status update indicating error
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Error', message: `Failed to start: ${err.message}` });
        playitProcess = null; // Reset process state
      });

      playitProcess.on('close', (code) => {
        console.log(`Playit process exited with code ${code}`);
        let statusMessage = `Playit process exited with code ${code}.`;
        if (code !== 0) {
             statusMessage += ' Check logs for errors.';
        }
         // Send exit status to renderer
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Disconnected', code, message: statusMessage });
        playitProcess = null; // Reset process state
      });

      return { success: true, message: 'Playit process spawn initiated.' };

    } catch (error: any) {
      console.error('Failed to spawn Playit process:', error);
      // Send error to renderer
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: `Failed to spawn Playit process: ${error.message}` });
       // Send a status update indicating error
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Error', message: `Spawn failed: ${error.message}` });
      playitProcess = null; // Reset process state
       return { success: false, message: `Failed to spawn Playit process: ${error.message}` };
    }
  });

  // --- Task 1: Kill Playit when server stops or app quits ---
  ipcMain.handle('stop-tunnel', async () => {
    if (playitProcess) {
      console.log('Stopping Playit process...');
       // Using 'SIGTERM' allows the process to clean up, 'SIGKILL' is immediate
      playitProcess.kill('SIGTERM');
      // Note: The 'close' event listener will handle setting playitProcess = null
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Stopping...', message: 'Shutting down tunnel...' });
      return { success: true, message: 'Playit process stop signal sent.' };
    } else {
      console.log('No Playit process running.');
       mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Idle', message: 'No tunnel is active.' });
      return { success: false, message: 'No Playit process was running.' };
    }
  });
}

// Export the process variable so it can be accessed for cleanup on app quit
// This requires modifying how playitProcess is declared or adding a cleanup function
// Alternative: Add a cleanup function to playitHandlers.ts that kills the process

export function cleanupPlayitProcess() {
    if (playitProcess) {
        console.log('Cleaning up Playit process on shutdown...');
        playitProcess.kill('SIGTERM');
        playitProcess = null;
    }
}

// The following comments were instructions for changes made in other files and are now removed. 