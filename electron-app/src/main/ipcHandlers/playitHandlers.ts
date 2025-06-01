import { ipcMain, BrowserWindow, app } from 'electron'; // Import 'app'
import { spawn, ChildProcess, exec } from 'child_process';
import { IPC_CHANNELS } from '../../shared/types';
import { join } from 'path';
import fs from 'fs/promises'; // Use promises version of fs
import { URLSearchParams } from 'url'; // Import URLSearchParams

let playitProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

type StartTunnelResponse = { success: boolean; message: string; data?: { agentId?: string } }; // Updated return type

// Add delay between requests to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Add cookie management (moved from playitApiHandler)
let currentCookies = '';
const updateCookies = (setCookieHeader: string | null) => {
  if (!setCookieHeader) return;
  const cookiesToSet = setCookieHeader.split(',').flatMap(cookiePart => cookiePart.split(';').map(c => c.trim())).filter(c => c.includes('='));
  const currentCookieMap = new Map(currentCookies.split(';').map(c => c.trim()).filter(c => c.includes('=')).map(c => c.split(/=(.*)/s).slice(0, 2) as [string, string]));

  for (const cookie of cookiesToSet) {
    const [key, ...valueParts] = cookie.split('=');
    const value = valueParts.join('=');
    if (!['Expires', 'Path', 'Domain', 'Max-Age', 'Secure', 'HttpOnly', 'SameSite'].includes(key)) {
      currentCookieMap.set(key, value);
    }
  }
  currentCookies = Array.from(currentCookieMap.entries()).map(([key, value]) => `${key}=${value}`).join('; ');
};

const buildHeaders = (additionalHeaders?: Record<string, string>) => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'en-US,en;q=0.9',
  ...
  (currentCookies ? { 'Cookie': currentCookies } : {}), // Include cookies if available
  ...(additionalHeaders || {})
});

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
    let detectedAgentId: string | undefined = undefined; // Variable to store the extracted Agent ID
    let needsFullRetrySignal = false; // Declare needsFullRetrySignal here

    while (fullRetryAttempts < maxFullRetries && !tunnelSetupSuccess) {
      fullRetryAttempts++;
      console.log(`Starting full setup attempt ${fullRetryAttempts}/${maxFullRetries}...`);

      // Reset cookies for a fresh attempt
      currentCookies = '';

      // 1. Clean up previous process if it exists
      cleanupPlayitProcess();
      await delay(500); // Give process a moment to terminate cleanly and port to free up

    let binaryPath: string;
    try {
      binaryPath = await getPlayitBinaryPath();
    } catch (error: any) {
        const errorMessage = `Setup Error: ${error.message}`;
        console.error(errorMessage);
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: errorMessage });
        finalMessage = errorMessage;
        // No point retrying if binary path cannot be determined
        break;
      }

      // 2. Spawn a new process and attach the single comprehensive stdout listener
      let claimCode: string | undefined = undefined;
      let programApprovedSeen = false;
      let visitLinkNeeded = false; // Signal to immediately retry full sequence
      let initialStdoutReceived = false; // Flag to indicate initial messages processed
      const stdoutTimeout = 30000; // 30 seconds timeout for initial stdout messages
      let pollingActive = false; // Track if we are in the polling phase

      // Use a Promise to wait for specific signals from the stdout listener
      const stdoutSignalPromise = new Promise<{
        type: 'claimCode' | 'visitLink' | 'programApproved' | 'agentId';
        value?: string
      } | null>((resolve, reject) => {
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
            reject(new Error('Failed to get stdout from Playit process.'));
            return;
          }

          console.log('New Playit process spawned. Attaching comprehensive stdout listener...');

          const listener = (data: any) => {
            const chunk = data.toString();

            const cleanChunk = chunk
               .replace(/\x1B/g, '')
               .replace(/\[2J/g, '')
               .replace(/\[0m/g, '')
               .replace(/8/g, '')
               .replace(/no command provided, doing auto run/g, '')
               .trim();

            if (cleanChunk) {
              const claimCodeMatch = cleanChunk.match(/Visit link to setup\s*https:\/\/playit\.gg\/claim\/([a-zA-Z0-9]+)(?:\s|$)/);
              if (claimCodeMatch && claimCodeMatch[1]) {
                claimCode = claimCodeMatch[1];
                console.log('Claim code found in stdout.', claimCode);
                if (!initialStdoutReceived) {
                    initialStdoutReceived = true;
                    resolve({ type: 'claimCode', value: claimCode });
                }
              }
              if (cleanChunk.includes("Visit link to setup")) {
                if (pollingActive) {
                  visitLinkNeeded = true;
                }
                if (!initialStdoutReceived) {
                    initialStdoutReceived = true;
                    resolve({ type: 'visitLink' });
                }
              } else if (cleanChunk.includes("Program approved")) {
                console.log('"Program approved" detected in stdout.');
                programApprovedSeen = true;
                if (!initialStdoutReceived) {
                    initialStdoutReceived = true;
                    resolve({ type: 'programApproved' });
                }
              } else {
                const agentIdMatch = cleanChunk.match(/https:\/\/playit\.gg\/account\/agents\/([a-zA-Z0-9-]+)/);
                if (agentIdMatch && agentIdMatch[1]) {
                    detectedAgentId = agentIdMatch[1];
                    console.log('Extracted Playit Agent ID from stdout:', detectedAgentId);
                    playitProcess?.stdout?.removeListener('data', listener); // Remove listener after extracting agent ID
                    if (!initialStdoutReceived) {
                        initialStdoutReceived = true;
                        resolve({ type: 'agentId', value: detectedAgentId });
                    }
                }
              }
            }
          };
          playitProcess.stdout.on('data', listener);

          // Handle process exit/error
          playitProcess.on('close', (code) => {
            console.log(`Playit process closed with code ${code}.`);
            // Signal failure if process closes before setup is complete
            if (!tunnelSetupSuccess) {
                reject(new Error(`Playit process closed unexpectedly with code ${code}.`));
            }
          });

          playitProcess.on('error', (err) => {
            console.error(`Playit process error: ${err.message}`);
            // Signal failure on process error
            if (!tunnelSetupSuccess) {
                reject(new Error(`Playit process error: ${err.message}`));
            }
          });

        } catch (spawnError: any) {
          reject(new Error(`Failed to spawn Playit process: ${spawnError.message}`));
        }
      });

      // Wait for initial stdout signal or timeout
      const initialSignalResult = await Promise.race([
          stdoutSignalPromise,
          new Promise<null>(resolve => setTimeout(() => { console.log('Initial stdout wait timed out.'); resolve(null); }, stdoutTimeout))
      ]);

      if (!initialSignalResult) {
          finalMessage = 'Timed out waiting for initial stdout signal from Playit agent.';
          console.error(finalMessage);
          needsFullRetrySignal = true; // Treat timeout as needing full retry
          cleanupPlayitProcess();
          continue; // Go to next full retry attempt
      }

      if (initialSignalResult.type === 'visitLink') {
          finalMessage = 'Detected "Visit link to setup..." early in stdout. Retrying full process.';
          console.warn(finalMessage);
          needsFullRetrySignal = true;
          cleanupPlayitProcess();
          continue; // Go to next full retry attempt
      }

      // If we got here, we likely have a claim code or Program Approved/Agent ID appeared early
      if (initialSignalResult.type === 'claimCode') {
          claimCode = initialSignalResult.value!;
          console.log('Proceeding with API chain using claim code:', claimCode);
                // Send status update that claim code is received
                mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, {
                  status: 'link_received',
                  message: 'Claim code received'
                });
          // Send just the claim code
                mainWindow?.webContents.send(IPC_CHANNELS.CLAIM_LINK, { claimCode });

      } else if (initialSignalResult.type === 'programApproved') {
          console.log('Program Approved appeared early. Assuming tunnel is ready.');
          tunnelSetupSuccess = true; // Tunnel is ready based on early signal
          finalMessage = 'Tunnel connected based on early Program Approved signal.';
          // The listener will continue running to capture agentId if it appears after
          // Break the full retry loop
          break;
      } else if (initialSignalResult.type === 'agentId') {
          console.log('Agent ID appeared early. Assuming tunnel is ready.');
          detectedAgentId = initialSignalResult.value;
          tunnelSetupSuccess = true; // Tunnel is ready based on early signal
          finalMessage = 'Tunnel connected based on early Agent ID signal.';
          // Break the full retry loop
          break;
      }

      // 3. Make API Calls (Steps 1-3)
      console.log('Starting API chain (Steps 1-3)...');

      try {
          // Step 1: GET initial claim link (already handled by initial stdout for claim code)
          // We only need the cookie from the response header here if claimCode was the signal
          if (initialSignalResult.type === 'claimCode') {
              const initialClaimUrl = `https://playit.gg/claim/${claimCode}`; // Use the found claimCode
              const initialClaimResponse = await fetch(initialClaimUrl, { method: 'GET', headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9' }) });
              updateCookies(initialClaimResponse.headers.get('set-cookie'));
              console.log('Initial claim link response status:', initialClaimResponse.status);
              // await delay(1000); // Optional: add a small delay if needed
          }

          // Step 2: GET login/create page
          console.log('Visiting login/create page...');
          const loginCreateUrl = `https://playit.gg/login/create?redirect=%2Fclaim%2F${claimCode}%3F`;
          const loginCreateResponse = await fetch(loginCreateUrl, { method: 'GET', headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9' }) });
          updateCookies(loginCreateResponse.headers.get('set-cookie'));
          console.log('Login/create page response status:', loginCreateResponse.status);
          // await delay(1000); // Optional: add a small delay if needed

          // Step 3: POST guest session initiation
          console.log('Initiating guest session POST...');
          const guestInitUrl = `https://playit.gg/login/create?redirect=/claim/${claimCode}?&_data=routes/login.create`;
          const guestInitBodyParams = new URLSearchParams({
            'email': '',
            'password': '',
            'confirm-password': '',
            '_action': 'guest'
          });

          const guestInitResponse = await fetch(guestInitUrl, {
            method: 'POST',
            headers: buildHeaders({
              'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
              'Accept': '*/*',
              'Origin': 'https://playit.gg',
              'Referer': `https://playit.gg/login/create?redirect=%2Fclaim%2F${claimCode}%3F`,
            }),
            body: guestInitBodyParams.toString()
          });
          updateCookies(guestInitResponse.headers.get('set-cookie'));
          console.log('Guest session initiation POST response status:', guestInitResponse.status);

          if (!guestInitResponse.ok && guestInitResponse.status !== 302) { // 302 is a successful redirect here
              const errorText = await guestInitResponse.text();
              console.error('Guest session initiation failed:', errorText);
              throw new Error(`Guest session initiation failed: ${guestInitResponse.statusText} - ${errorText}`);
          }
          // Assuming fetch follows 302 automatically, the cookies are updated above.

          console.log('Initial API chain (Steps 1-3) completed.');

      } catch (apiError: any) {
          const errorMessage = `API Chain Error (Steps 1-3): ${apiError.message}`;
          console.error(errorMessage);
          mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: errorMessage });
          finalMessage = errorMessage;
          needsFullRetrySignal = true; // API errors often require a full retry
          cleanupPlayitProcess();
          await delay(5000); // Wait before retrying after API error
          continue; // Go to next full retry attempt
      }

      // 4. Poll using GET requests until Program Approved or Agent ID is seen
      console.log('Starting polling phase (GET requests)...');
      const getHeaders = buildHeaders({'Accept': '*/*'}); // General GET headers with latest cookies
      let pollingAttempts = 0;
      const maxPollingAttempts = 60; // Poll for max 60 attempts (approx 60 seconds with 1s delay)

      pollingActive = true; // Set pollingActive to true before polling starts
      // Poll until Program Approved or Agent ID is seen via the stdout listener
      while (!programApprovedSeen && detectedAgentId === undefined && pollingAttempts < maxPollingAttempts && !visitLinkNeeded) {
        pollingAttempts++;
        // Only log the attempt number, not the state or body
        console.log(`Polling attempt ${pollingAttempts}/${maxPollingAttempts}`);

        try {
              // Only care about status, don't read body
              const claimGetUrl = `https://playit.gg/claim/${claimCode}?_data=root`;
              const claimGetResponse = await fetch(claimGetUrl, { method: 'GET', headers: getHeaders });
              console.log('Claim GET response status:', claimGetResponse.status);

              const claimRoutesUrl = `https://playit.gg/claim/${claimCode}?_data=routes%2Fclaim%2F%24claimCode`;
              const claimRoutesResponse = await fetch(claimRoutesUrl, { method: 'GET', headers: getHeaders });
              console.log('Claim routes GET response status:', claimRoutesResponse.status);

              const claimRoutesIndexUrl = `https://playit.gg/claim/${claimCode}?_data=routes%2Fclaim%2F%24claimCode%2Findex`;
              const claimRoutesIndexResponse = await fetch(claimRoutesIndexUrl, { method: 'GET', headers: getHeaders });
              console.log('Claim routes index GET response status:', claimRoutesIndexResponse.status);

        } catch (pollingError: any) {
            console.error(`Polling GET request failed on attempt ${pollingAttempts}: ${pollingError.message}`);
        }

        // Wait for 1 second before the next polling attempt
        if (!programApprovedSeen && detectedAgentId === undefined && pollingAttempts < maxPollingAttempts && !visitLinkNeeded) {
            await delay(1000);
              }
            }
      pollingActive = false; // Set pollingActive to false after polling ends

      // 5. Check outcome of polling
      if (programApprovedSeen || detectedAgentId !== undefined) {
          console.log('Polling successful. Tunnel is likely connected.');
          tunnelSetupSuccess = true;
          finalMessage = 'Tunnel connected!';
          mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'connected', message: finalMessage });
          // Break the full retry loop
          break;
      } else if (visitLinkNeeded) {
          console.warn('Polling stopped because "Visit link to setup..." was seen.');
          finalMessage = 'Detected "Visit link to setup..." during polling. Retrying full process.';
          needsFullRetrySignal = true;
          cleanupPlayitProcess();
          continue; // Go to next full retry attempt
      } else {
          console.error('Polling timed out waiting for Program Approved or Agent ID.');
          finalMessage = 'Timed out waiting for tunnel to connect.';
           // This attempt failed, continue to next full retry unless max retries reached
           if (fullRetryAttempts >= maxFullRetries) {
               break; // Break full retry loop if max attempts reached
           }
           cleanupPlayitProcess(); // Clean up process before next full retry
           await delay(5000); // Wait before next full retry attempt
           needsFullRetrySignal = true; // Ensure signal is set for retry
           continue; // Go to next full retry attempt
      }
    }

    // --- End of Retry Loop ---

    if (!tunnelSetupSuccess) {
      console.error('Full tunnel setup failed after multiple attempts.');
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_STATUS, { status: 'error', message: finalMessage });
      // Ensure process is cleaned up on final failure
      cleanupPlayitProcess();
    } else {
        // If successful, send the agent ID back
         return { success: true, message: finalMessage, data: { agentId: detectedAgentId } };
    }

    // Return failure if loop completed without success
    return { success: false, message: finalMessage };
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

export function getPlayitProcess(): ChildProcess | null {
  return playitProcess;
}