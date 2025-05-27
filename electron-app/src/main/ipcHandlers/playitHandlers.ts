import { ipcMain, BrowserWindow, app } from 'electron'; // Import 'app'
import { spawn, ChildProcessWithoutNullStreams, exec } from 'child_process'; // Import 'exec'
import { IPC_CHANNELS } from '../../shared/types';
import { join } from 'path';
import fs from 'fs/promises'; // Use promises version of fs

let playitProcess: ChildProcessWithoutNullStreams | null = null;
let mainWindow: BrowserWindow | null = null;

// Buffer to accumulate stdout data chunks
let stdoutBuffer = '';

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

  ipcMain.handle(IPC_CHANNELS.START_TUNNEL, async (_event): Promise<StartTunnelResponse> => {
    console.log('START_TUNNEL handler called.'); // Log when handler is called
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
    const args: string[] = []; // Run without arguments to get claim link

    console.log(`Starting Playit.gg tunnel: "${binaryPath}" ${args.join(' ')}`);

    try {
      console.log('Attempting to spawn Playit process...');
      // Comment out actual playit process for testing
      /*
      playitProcess = spawn(binaryPath, args, {
        detached: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsVerbatimArguments: true,
        env: { ...process.env, FORCE_COLOR: '0' }
      });
      */

      // Simulate playit output for testing
      const simulatedOutput = "Visit link to setup https://playit.gg/claim?token=test123";
      console.log('Simulated Playit output:', simulatedOutput);
      
      // Process the simulated output
      const claimLinkMatch = simulatedOutput.match(/Visit link to setup\s*(https:\/\/playit.gg\/claim\?token=[^\s]+)/);
      if (claimLinkMatch && claimLinkMatch[1]) {
        const claimLink = claimLinkMatch[1];
        console.log('Found claim link:', claimLink);
        mainWindow?.webContents.send(IPC_CHANNELS.CLAIM_LINK, { url: claimLink });
      }

      return { success: true, message: 'Playit process simulated.' };

      /* Comment out the rest of the process handling
      console.log('Playit process spawned successfully. Process ID:', playitProcess.pid);

      // Add error handler for spawn
      playitProcess.on('error', (err) => {
        console.error('Error in Playit process:', err);
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { 
          message: `Process error: ${err.message}` 
        });
      });

      // --- Basic Playit stdout logging ---
      let buffer = '';
      playitProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        buffer += chunk;
        
        // Process the buffer for complete lines
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || ''; // Keep the last potentially incomplete line

        for (const line of lines) {
          console.log('Playit output:', line);
          
          // Look for the claim link in each line
          const claimLinkMatch = line.match(/Visit link to setup\s*(https:\/\/playit.gg\/claim\?token=[^\s]+)/);
          if (claimLinkMatch && claimLinkMatch[1]) {
            const claimLink = claimLinkMatch[1];
            console.log('Found claim link:', claimLink);
            mainWindow?.webContents.send(IPC_CHANNELS.CLAIM_LINK, { url: claimLink });
            // Don't kill the process - let it continue running
          }
        }
      });

      // Handle stderr
      playitProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        console.error('Playit error:', errorOutput);
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: errorOutput });
      });

      playitProcess.on('close', (code) => {
        console.log(`Playit process exited with code ${code}`);
        playitProcess = null;
      });
      */

    } catch (error: any) {
      console.error('Failed to spawn Playit process:', error);
      // TODO: Send spawn failure error and status update via IPC
      console.log('Sending IPC message:', IPC_CHANNELS.TUNNEL_ERROR, { message: `Failed to spawn Playit process: ${error.message}` });
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: `Failed to spawn Playit process: ${error.message}` });
      console.log('Sending IPC message:', IPC_CHANNELS.TUNNEL_STATUS, { status: 'error', message: `Spawn failed: ${error.message}` });
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'error', message: `Spawn failed: ${error.message}` });
      playitProcess = null; // Reset process state
      return { success: false, message: `Failed to spawn Playit process: ${error.message}` };
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
