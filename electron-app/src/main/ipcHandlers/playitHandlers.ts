import { ipcMain, BrowserWindow, app } from 'electron'; // Import 'app'
import { spawn, ChildProcessWithoutNullStreams, exec } from 'child_process'; // Import 'exec'
import { IPC_CHANNELS } from '../../shared/types';
import { join } from 'path';
import fs from 'fs/promises'; // Use promises version of fs

let playitProcess: ChildProcessWithoutNullStreams | null = null;
let mainWindow: BrowserWindow | null = null;

type StartTunnelResponse = { success: boolean; message: string };

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

  ipcMain.handle(IPC_CHANNELS.START_TUNNEL, async (_event, { apiKey, serverPort }: { apiKey: string, serverPort: number }): Promise<StartTunnelResponse> => {
    // TODO: Implement logic to start the Playit binary
    // TODO: Pass the server port to the Playit binary
    // TODO: Listen for stdout/stderr from the Playit binary
    // TODO: Parse Playit output to extract tunnel address and status
    // TODO: Send tunnel status, address, and errors to the renderer via IPC_CHANNELS
    // TODO: Handle Playit process exit

    if (playitProcess) {
      console.log('Playit process already running.');
      // TODO: Send appropriate status/error if already running
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: 'Tunnel is already starting or running.' });
      return { success: false, message: 'Tunnel is already starting or running.' };
    }

    let binaryPath: string;
    try {
        binaryPath = await getPlayitBinaryPath();
    } catch (error: any) {
        console.error('Failed to get Playit binary path:', error);
         // TODO: Send setup error to renderer
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: `Setup Error: ${error.message}` });
         mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Error', message: `Setup Error: ${error.message}` });
        return { success: false, message: `Setup Error: ${error.message}` };
    }

    // --- Task 1: Run Playit binary via child_process.spawn ---
    // Initial spawn with no arguments to observe basic output.
    const args: string[] = ['--secret', apiKey, 'tcp', String(serverPort)]; // Add arguments

    console.log(`Starting Playit.gg tunnel: "${binaryPath}" ${args.join(' ')}`);

    try {
      playitProcess = spawn(binaryPath, args);

      // --- Task 2: IPC Messaging (Main ↔ Renderer) - Send Status ---
      console.log('Sending IPC message:', IPC_CHANNELS.TUNNEL_STATUS, { status: 'Starting...', message: 'Connecting to Playit.gg...' });
      // TODO: Send initial starting status
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Starting...', message: 'Connecting to Playit.gg...' });

      // --- Basic Playit stdout logging ---
      playitProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Playit stdout: ${output}`);
        // TODO: Parse output for tunnel address/status and send updates via IPC
        // Example parsing (adjust based on actual Playit output format):
        const addressMatch = output.match(/tcp:\/\/([^\s]+)/);
        if (addressMatch && addressMatch[1]) {
          const address = addressMatch[1];
          console.log('Detected tunnel address:', address);
          mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ADDRESS, { address });
           mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'connected', message: `Tunnel established: ${address}` });
        }

         // Look for status updates
         if (output.includes('Connecting to playit.gg...')) {
             mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'starting', message: 'Connecting to Playit.gg...' });
         } else if (output.includes('Tunnel established')) {
             // Status will be sent by the address match above
         } else if (output.includes('Disconnected')) {
             mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'disconnected', message: 'Tunnel disconnected.' });
         } else if (output.includes('Error')) {
             // Errors are handled in stderr, but could add checks here too if needed
         }
      });

      // --- Log errors and unexpected exits ---
      // --- IPC Messaging (Main ↔ Renderer) - Send Error and Status ---
      playitProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        console.error(`Playit stderr: ${errorOutput}`);
        // TODO: Send error details and status update via IPC
        console.log('Sending IPC message:', IPC_CHANNELS.TUNNEL_ERROR, { message: errorOutput });
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: errorOutput });
         console.log('Sending IPC message:', IPC_CHANNELS.TUNNEL_STATUS, { status: 'Error', message: errorOutput.trim() });
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Error', message: errorOutput.trim() });
      });

      playitProcess.on('error', (err) => {
        console.error('Playit process failed to start.', err);
         // TODO: Send startup failure error and status update via IPC
        console.log('Sending IPC message:', IPC_CHANNELS.TUNNEL_ERROR, { message: `Failed to start Playit process: ${err.message}` });
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: `Failed to start Playit process: ${err.message}` });
         console.log('Sending IPC message:', IPC_CHANNELS.TUNNEL_STATUS, { status: 'Error', message: `Failed to start: ${err.message}` });
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'Error', message: `Failed to start: ${err.message}` });
        playitProcess = null; // Reset process state
      });

      playitProcess.on('close', (code) => {
        console.log(`Playit process exited with code ${code}`);
        let statusMessage = `Playit process exited with code ${code}.`;
        if (code !== 0) {
             statusMessage += ' Check logs for errors.';
        }
         // TODO: Send disconnected status update via IPC
        console.log('Sending IPC message:', IPC_CHANNELS.TUNNEL_STATUS, { status: 'disconnected', code, message: statusMessage });
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'disconnected', code, message: statusMessage });
        playitProcess = null; // Reset process state
      });

      return { success: true, message: 'Playit process spawn initiated.' };

    } catch (error: any) { // Catch block for spawn error
      console.error('Failed to spawn Playit process:', error);
      // TODO: Send spawn failure error and status update via IPC
      console.log('Sending IPC message:', IPC_CHANNELS.TUNNEL_ERROR, { message: `Failed to spawn Playit process: ${error.message}` });
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: `Failed to spawn Playit process: ${error.message}` });
       console.log('Sending IPC message:', IPC_CHANNELS.TUNNEL_STATUS, { status: 'error', message: `Spawn failed: ${error.message}` });
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'error', message: `Spawn failed: ${error.message}` });
      playitProcess = null; // Reset process state
       return { success: false, message: `Failed to spawn Playit process: ${error.message}` };
    }
    // Fallback return to satisfy linter - should theoretically not be reached
    // TODO: Review fallback return logic
    // Removed: Unreachable fallback return after adding comprehensive error handling
    // return { success: false, message: 'Internal handler error - unexpected code path.' };
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
