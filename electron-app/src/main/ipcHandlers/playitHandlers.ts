import { ipcMain, BrowserWindow, app } from 'electron'; // Import 'app'
import { spawn, ChildProcess, exec } from 'child_process';
import { IPC_CHANNELS } from '../../shared/types';
import { join } from 'path';
import fs from 'fs/promises'; // Use promises version of fs
import { handlePlayitApiChain } from './playitApiHandler'; // Import the API handler

let playitProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

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
    const maxFullRetries = 5; // Maximum number of full retry attempts
    let fullRetryAttempts = 0;
    let tunnelSetupSuccess = false;
    let finalMessage = 'Unknown error occurred.';

    while (fullRetryAttempts < maxFullRetries && !tunnelSetupSuccess) {
      fullRetryAttempts++;
      console.log(`Starting full setup attempt ${fullRetryAttempts}/${maxFullRetries}...`);

      // 1. Clean up previous process if it exists
      cleanupPlayitProcess();
      await delay(100); // Give process a moment to terminate cleanly

      let binaryPath: string;
      try {
        binaryPath = await getPlayitBinaryPath();
      } catch (error: any) {
        const errorMessage = `Setup Error: ${error.message}`;;
        console.error(errorMessage);
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: errorMessage });
        finalMessage = errorMessage;
        // No point retrying if binary path cannot be determined
        break;
      }

      // 2. Spawn a new process and listen for initial stdout messages
      let claimCode: string | null = null;
      let needsFullRetrySignal = false; // Signal to immediately retry full sequence
      const stdoutTimeout = 30000; // 30 seconds timeout for initial stdout messages

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

        if (!playitProcess.stdout) {
          throw new Error('Failed to get stdout from Playit process.');
        }

        console.log('New Playit process spawned. Listening for initial stdout...');

        // Use a Promise to wait for either claim code or 'Visit link' message
        const initialStdoutPromise = new Promise<{
          type: 'claimCode' | 'visitLink';
          value?: string
        } | null>((resolve) => {
          const listener = (data: any) => {
            const chunk = data.toString();
            console.log('Initial stdout chunk:', chunk);

            const cleanChunk = chunk
               .replace(/\x1B/g, '')
               .replace(/\[2J/g, '')
               .replace(/\[0m/g, '')
               .replace(/8/g, '')
               .replace(/no command provided, doing auto run/g, '')
               .trim();

            console.log('Cleaned initial chunk:', cleanChunk);

            if (cleanChunk) {
              const claimCodeMatch = cleanChunk.match(/Visit link to setup\s*https:\/\/playit\.gg\/claim\/([a-zA-Z0-9]+)(?:\s|$)/);
              if (claimCodeMatch && claimCodeMatch[1]) {
                // Found claim code, proceed with API chain
                playitProcess!.stdout?.removeListener('data', listener);
                console.log('Claim code found in initial stdout.');
                resolve({ type: 'claimCode', value: claimCodeMatch[1] });
              } else if (cleanChunk.includes("Visit link to setup")) {
                 // Saw 'Visit link' but no claim code, signals need for full retry
                 playitProcess!.stdout?.removeListener('data', listener);
                 console.log('"Visit link to setup..." seen in initial stdout, but no claim code.');
                 resolve({ type: 'visitLink' });
              }
            }
          };
          playitProcess!.stdout?.on('data', listener);

           // Handle process exit before finding the required output
          playitProcess!.on('close', (code) => {
               console.log(`Playit process closed with code ${code} before initial stdout found.`);
               playitProcess?.stdout?.removeListener('data', listener); // Ensure listener is removed
               resolve(null); // Indicate failure to find expected output
          });

           playitProcess!.on('error', (err) => {
               console.error(`Playit process error during initial stdout wait: ${err.message}`);
               playitProcess?.stdout?.removeListener('data', listener); // Ensure listener is removed
               resolve(null); // Indicate failure
           });
        });

        // Wait for initial stdout with a timeout
        const timeoutPromise = new Promise<null>(resolve => setTimeout(() => { console.log('Initial stdout timeout.'); resolve(null); }, stdoutTimeout));
        const initialStdoutResult = await Promise.race([initialStdoutPromise, timeoutPromise]);

        if (!initialStdoutResult) {
            throw new Error('Timed out or process closed waiting for claim link or "Visit link to setup..." in stdout.');
        }

        if (initialStdoutResult.type === 'visitLink') {
            // Saw 'Visit link' without claim code, signal for full retry
            needsFullRetrySignal = true;
            finalMessage = 'Detected "Visit link to setup..." without claim code. Retrying full process.';
            console.warn(finalMessage);
            continue; // Skip API chain and go to next full retry attempt
        }

        // If we reach here, type must be 'claimCode'
        claimCode = initialStdoutResult.value || null; // Should not be null if type is 'claimCode'

        if (!claimCode) {
             throw new Error('Claim code not found in initial stdout.');
        }

        console.log('Claim code received:', claimCode);

        // Send status update that claim code is received
         mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, {
           status: 'link_received',
           message: 'Claim code received'
         });
         // Send just the claim code instead of the full URL
         mainWindow?.webContents.send(IPC_CHANNELS.CLAIM_LINK, { claimCode });


      } catch (error: any) {
        const errorMessage = `Process Spawn or Initial Stdout Error: ${error.message}`;
        console.error(errorMessage);
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: errorMessage });
        finalMessage = errorMessage;
        needsFullRetrySignal = true; // Treat spawn/initial stdout errors as needing full retry
        // Continue to next full retry attempt
        continue;
      }

      // 3. Call the API chain with the claim code
      console.log('Calling Playit API chain with claim code:', claimCode);
      // Need to ensure claimCode is not null here, which is handled by the catch block above
      const apiChainResult = await handlePlayitApiChain(claimCode!, 25565); // Assuming 25565 is the server port
      console.log('API chain result:', apiChainResult);

      if (apiChainResult.success) {
        // API chain reported success (Program approved seen)
        tunnelSetupSuccess = true;
        finalMessage = apiChainResult.message;
        console.log('Tunnel setup successful!');
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'connected', message: 'Tunnel connected!' });
        // Break the full retry loop
        break;
      } else if (apiChainResult.message.includes("Visit link to setup...")) {
         // API chain detected 'Visit link', signal for full retry
         needsFullRetrySignal = true;
         finalMessage = apiChainResult.message + ' Retrying full process.';
         console.warn(finalMessage);
         // Continue to next full retry attempt
         continue;
      } else {
        // API chain failed for other reasons (e.g., timeout waiting for Program approved)
        finalMessage = apiChainResult.message;
        console.error('API chain failed:', finalMessage);
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: finalMessage });
        // Continue to next full retry attempt unless it's the last one
         if (fullRetryAttempts >= maxFullRetries) {
             break;
         }
         await delay(5000); // Wait before retrying after a non-'Visit link' API chain failure
         continue;
      }
    }

    // --- End of Retry Loop ---

    if (!tunnelSetupSuccess) {
      console.error('Full tunnel setup failed after multiple attempts.');
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'error', message: finalMessage });
      // Ensure process is cleaned up on final failure
      cleanupPlayitProcess();
    }

    // playitProcess remains set if tunnelSetupSuccess is true, allowing cleanup on app quit

    return { success: tunnelSetupSuccess, message: finalMessage };
  });
}

// Add a small delay utility function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export function getPlayitProcess(): ChildProcess | null {
  return playitProcess;
}