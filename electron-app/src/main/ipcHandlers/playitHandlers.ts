import { ipcMain, BrowserWindow, app } from 'electron'; // Import 'app'
import { spawn, ChildProcess, exec } from 'child_process';
import { IPC_CHANNELS } from '../../shared/types';
import { join } from 'path';
import fs from 'fs/promises'; // Use promises version of fs

let playitProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let claimLinkFound = false; // Flag to ensure link status is sent only once

type StartTunnelResponse = { success: boolean; message: string };

// --- Task 3: Platform Support and Binary Handling ---
async function getPlayitBinaryPath(): Promise<string> {
  const platform = process.platform;
  let binaryName = '';
  let binaryDir = '';

  if (platform === 'win32') {
    binaryName = 'playit-windows-x64.exe';
    binaryDir = join(app.getAppPath(), 'bin', 'playit', 'win');
  } else if (platform === 'darwin') {
    binaryName = 'playit-macos-x64';
    binaryDir = join(app.getAppPath(), 'bin', 'playit', 'mac');
  } else if (platform === 'linux') {
    binaryName = 'playit-linux-x64';
    binaryDir = join(app.getAppPath(), 'resources', 'playit_binaries', 'linux');
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const binaryPath = join(binaryDir, binaryName);

  if (platform !== 'win32') {
    try {
      await fs.access(binaryPath, fs.constants.F_OK);
      await new Promise<void>((resolve, reject) => {
        exec(`chmod +x "${binaryPath}"`, (error) => {
          if (error) {
            reject(new Error(`Failed to set execute permissions for binary: ${error.message}`));
          } else {
            resolve();
          }
        });
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new Error(`Playit binary not found at expected path: ${binaryPath}`);
      } else {
        throw new Error(`Error accessing Playit binary at ${binaryPath}: ${err.message}`);
      }
    }
  } else {
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

  return binaryPath;
}


export function registerPlayitHandlers(window: BrowserWindow) {
  mainWindow = window;

  ipcMain.handle(IPC_CHANNELS.START_TUNNEL, async (_event): Promise<StartTunnelResponse> => {
    if (playitProcess) {
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { 
        status: 'error', 
        message: 'Tunnel is already running.' 
      });
      return { success: false, message: 'Tunnel is already running.' };
    }

    let binaryPath: string;
    try {
      binaryPath = await getPlayitBinaryPath();
    } catch (error: any) {
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { 
        message: `Setup Error: ${error.message}` 
      });
      return { success: false, message: `Setup Error: ${error.message}` };
    }

    try {
      playitProcess = spawn(binaryPath, [], {
        detached: false,
        windowsHide: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: { 
          ...process.env, 
          FORCE_COLOR: '0',
          TERM: 'dumb',
          CLICOLOR: '0',
          NO_COLOR: '1'
        }
      });
      
      if (playitProcess.stdout) {
        playitProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          console.log('Raw stdout chunk:', chunk); // Debug log
          
          const cleanChunk = chunk
            .replace(/\x1B/g, '')
            .replace(/\[2J/g, '')
            .replace(/\[0m/g, '')
            .replace(/8/g, '')
            .replace(/no command provided, doing auto run/g, '')
            .trim();
          
          console.log('Cleaned chunk:', cleanChunk); // Debug log
          
          if (cleanChunk) {
            // More precise pattern matching
            const claimCodeMatch = cleanChunk.match(/Visit link to setup\s*https:\/\/playit\.gg\/claim\/([a-zA-Z0-9]+)(?:\s|$)/);
            if (claimCodeMatch && claimCodeMatch[1]) {
              const claimCode = claimCodeMatch[1];
              console.log('Found claim code:', claimCode); // Debug log
              
              if (!claimLinkFound) {
                console.log('Sending claim code event...'); // Debug log
                claimLinkFound = true;
                // Send status update that claim code is received
                mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, {
                  status: 'link_received',
                  message: 'Claim code received'
                });
                // Send just the claim code instead of the full URL
                mainWindow?.webContents.send(IPC_CHANNELS.CLAIM_LINK, { claimCode });
                // Remove the stdout listener after sending the claim code
                playitProcess?.stdout?.removeAllListeners('data');
                console.log('Removed stdout listener'); // Debug log
              } else {
                console.log('Claim code already found, ignoring'); // Debug log
              }
            }
          }
        });
      } else {
        // console.error('stdout is null'); // Keep this commented out unless needed for debugging
      }

      playitProcess.on('close', (code) => {
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { 
          status: 'closed', 
          message: `Process closed with code: ${code}` 
        });
        playitProcess = null;
        claimLinkFound = false; // Reset flag on close
      });

      return { success: true, message: 'Playit process started.' };
    } catch (error: any) {
      console.error('Failed to start process:', error.message);
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { 
        message: `Failed to start process: ${error.message}` 
      });
      playitProcess = null;
      claimLinkFound = false; // Reset flag on close
      return { success: false, message: `Failed to start process: ${error.message}` };
    }
  });
}

// Export the process variable so it can be accessed for cleanup on app quit
// This requires modifying how playitProcess is declared or adding a cleanup function
// Alternative: Add a cleanup function to playitHandlers.ts that kills the process

export function cleanupPlayitProcess() {
    if (playitProcess) {
        console.log('Cleaning up Playit process on shutdown...');
        // Remove all listeners to prevent accessing the object after it's destroyed
        if (playitProcess.stdout) {
            playitProcess.stdout.removeAllListeners('data');
        }
        if (playitProcess.stderr) {
            // Add stderr listener removal back in case it was removed earlier
            playitProcess.stderr.removeAllListeners('data');
        }
        playitProcess.removeAllListeners('close');
        playitProcess.removeAllListeners('error');

        playitProcess.kill('SIGTERM');
        playitProcess = null;
    }
}

export { playitProcess };
