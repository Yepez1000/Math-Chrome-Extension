import { ipcMain, BrowserWindow, app } from 'electron'; // Import 'app'
import { spawn, ChildProcess, exec } from 'child_process';
import { IPC_CHANNELS } from '../../shared/types';
import { join } from 'path';
import fs from 'fs/promises'; // Use promises version of fs
import { URLSearchParams } from 'url'; // Import URLSearchParams

let playitProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

type StartTunnelResponse = { success: boolean; message: string; data?: { agentId?: string, tunnelId?: string } }; // Updated return type to allow tunnelId

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
    let finalMessage = 'Unknown error occurred.';
    let detectedAgentId: string | undefined = undefined; // Variable to store the extracted Agent ID
    let shouldBreakRetryLoop = false; // Controls retry loop exit
    let programApprovedSeen = false; // Declare outside loop to retain value after loop
    let resolveAgentIdWait: ((value: string | undefined) => void) | undefined;
    const waitForAgentIdPromise = new Promise<string | undefined>(resolve => { resolveAgentIdWait = resolve; });

    while (fullRetryAttempts < maxFullRetries && !shouldBreakRetryLoop) {
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
      let claimCodeHandled = false; // Correctly scoped per process
      let visitLinkNeeded = false; // Signal to immediately retry full sequence
      let initialStdoutReceived = false; // Flag to indicate initial messages processed
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
          // Attach the listener only once per process spawn
          const listener = (data: any) => {
            const chunk = data.toString();
            const cleanChunk = chunk
               .replace(/\x1B/g, '')
               .replace(/\[2J/g, '')
               .replace(/\[0m/g, '')
               .replace(/8/g, '')
               .replace(/no command provided, doing auto run/g, '')
               .trim();
            // Log all cleaned chunks
            console.log('cleanChunk:', cleanChunk);
            if (cleanChunk) {
              const claimCodeMatch = cleanChunk.match(/Visit link to setup\s*https:\/\/playit\.gg\/claim\/([a-zA-Z0-9]+)(?:\s|$)/);
              if (claimCodeMatch && claimCodeMatch[1] && !claimCodeHandled) {
                claimCodeHandled = true; // Set synchronously before any async/resolve
                claimCode = claimCodeMatch[1];
                console.log('Claim code found in stdout:', claimCode);
                if (!initialStdoutReceived) {
                    initialStdoutReceived = true;
                    resolve({ type: 'claimCode', value: claimCode });
                }
                return;
              }
              // Only check for 'Visit link to setup' during polling
              if (pollingActive && cleanChunk.includes("Visit link to setup")) {
                console.log('[polling] Detected "Visit link to setup" in stdout, triggering retry.');
                visitLinkNeeded = true;
                if (!initialStdoutReceived) {
                    initialStdoutReceived = true;
                    resolve({ type: 'visitLink' });
                }
                return;
              }
              if (cleanChunk.includes("Program approved")) {
                console.log('"Program approved" detected in stdout.');
                programApprovedSeen = true;
                if (!initialStdoutReceived) {
                    initialStdoutReceived = true;
                    resolve({ type: 'programApproved' });
                }
                // Signal to break out of retry loop when we see "Program approved"
                shouldBreakRetryLoop = true;
              }
              const agentIdMatch = cleanChunk.match(/https:\/\/playit\.gg\/account\/agents\/([a-zA-Z0-9-]+)/);
              if (agentIdMatch && agentIdMatch[1]) {
                detectedAgentId = agentIdMatch[1];
                console.log('Extracted Playit Agent ID from stdout:', detectedAgentId);
                if (!initialStdoutReceived) {
                  initialStdoutReceived = true;
                  resolve({ type: 'agentId', value: detectedAgentId });
                }
                // Stop listening to stdout once Agent ID is found
                if (playitProcess && playitProcess.stdout) {
                  playitProcess.stdout.removeAllListeners('data');
                }
                // If program approved was seen, resolve the specific wait promise
                if (programApprovedSeen && resolveAgentIdWait) {
                  resolveAgentIdWait(detectedAgentId);
                }
              }
            }
          };
          playitProcess.stdout.removeAllListeners('data'); // Extra safety: remove any listeners before attaching
          playitProcess.stdout.on('data', listener);

          // Handle process exit/error
          playitProcess.on('close', (code) => {
            console.log(`Playit process closed with code ${code}.`);
            if (!shouldBreakRetryLoop) {
                reject(new Error(`Playit process closed unexpectedly with code ${code}.`));
            }
          });
          playitProcess.on('error', (err) => {
            console.error(`Playit process error: ${err.message}`);
            if (!shouldBreakRetryLoop) {
                reject(new Error(`Playit process error: ${err.message}`));
            }
          });
        } catch (spawnError: any) {
          reject(new Error(`Failed to spawn Playit process: ${spawnError.message}`));
        }
      });

      // Wait for claim code, agent ID, or program approved (no timeout)
      const initialSignalResult = await stdoutSignalPromise;
      if (!initialSignalResult || initialSignalResult.type !== 'claimCode') {
          finalMessage = 'Did not receive claim code from Playit agent.';
          console.error(finalMessage);
          cleanupPlayitProcess();
          continue; // Go to next full retry attempt
      }
      claimCode = initialSignalResult.value;
      console.log('Claim code found in stdout:', claimCode);

      // 1. Make initial requests to claim the agent (GET claim link, GET login/create, POST guest session)
      try {
          // Step 1: GET initial claim link
          const initialClaimUrl = `https://playit.gg/claim/${claimCode}`;
          const initialClaimResponse = await fetch(initialClaimUrl, { method: 'GET', headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9' }) });
          updateCookies(initialClaimResponse.headers.get('set-cookie'));
          console.log('Initial claim link response status:', initialClaimResponse.status);

          // Step 2: GET login/create page
          const loginCreateUrl = `https://playit.gg/login/create?redirect=%2Fclaim%2F${claimCode}%3F`;
          const loginCreateResponse = await fetch(loginCreateUrl, { method: 'GET', headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9' }) });
          updateCookies(loginCreateResponse.headers.get('set-cookie'));
          console.log('Login/create page response status:', loginCreateResponse.status);

          // Step 3: POST guest session initiation
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

          if (!guestInitResponse.ok && guestInitResponse.status !== 203) { // 203 is a successful redirect here
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
          cleanupPlayitProcess();
          await delay(5000); // Wait before retrying after API error
          continue; // Go to next full retry attempt
      }

      // 2. Poll using GET requests until Program Approved or Agent ID is seen
      console.log('Starting polling phase (GET requests)...');
      const getHeaders = buildHeaders({'Accept': '*/*'}); // General GET headers with latest cookies
      let pollingAttempts = 0;
      const maxPollingAttempts = 60; // Poll for max 60 attempts (approx 60 seconds with 1s delay)
      pollingActive = true; // Set pollingActive to true before polling starts
      visitLinkNeeded = false;
      while (!programApprovedSeen && !detectedAgentId && pollingAttempts < maxPollingAttempts && !visitLinkNeeded) {
        pollingAttempts++;
        console.log(`Polling attempt ${pollingAttempts}/${maxPollingAttempts}`);
        try {
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
        await delay(1000);
      }
      pollingActive = false; // Set pollingActive to false after polling ends

      // If we've seen "Program approved", we can proceed to tunnel creation
      if (programApprovedSeen) {
        break;
      }

      // If we haven't seen "Program approved" and we're out of polling attempts, retry
      if (!programApprovedSeen) {
        finalMessage = 'Program not approved after polling.';
        console.error(finalMessage);
        cleanupPlayitProcess();
        continue; // Go to next full retry attempt
      }
    }

    // --- End of Retry Loop ---

    // If the loop broke because Program Approved was seen, wait briefly for Agent ID if not already found
    if (programApprovedSeen && !detectedAgentId) {
      console.log('Program approved seen, waiting indefinitely for Agent ID in stdout...');
      detectedAgentId = await waitForAgentIdPromise;
    }

    // Now that we have an agent ID (or not), attempt tunnel creation or report failure
    if (!detectedAgentId) {
      console.error('No agent ID available for tunnel creation after waiting.');
      return { success: false, message: 'Failed to get agent ID after all retries.' };
    }

    try {
      console.log('=== Starting Tunnel Creation Process ===');
      console.log('Making GET request to agent page with Agent ID:', detectedAgentId);
      // 1. GET the agent page to establish session/cookies
      const agentUrl = `https://playit.gg/account/agents/${detectedAgentId}`;
      console.log('GET Request URL:', agentUrl);
      const agentGetResp = await fetch(agentUrl, {
        method: 'GET',
        headers: buildHeaders({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9',
          'Referer': 'https://playit.gg/account',
        })
      });
      updateCookies(agentGetResp.headers.get('set-cookie'));
      console.log('GET agent page response status:', agentGetResp.status);
      console.log('GET agent page response headers:', JSON.stringify(Object.fromEntries(agentGetResp.headers.entries()), null, 2));

      // 2. POST to create tunnel (browser-mimic)
      console.log('\nMaking POST request to create tunnel for Agent ID:', detectedAgentId);
      const tunnelPostUrl = `https://playit.gg/account/agents/${detectedAgentId}/tunnels/add?index=&_data=routes%2Faccount%2Fagents%2F$agentId%2Ftunnels%2Fadd%2Findex`;
      console.log('POST Request URL:', tunnelPostUrl);
      const tunnelPostBody = new URLSearchParams({
        region: 'global',
        tunnel_type: 'minecraft-java',
        enabled: 'on',
      });
      console.log('POST Request Body:', tunnelPostBody.toString());
      const tunnelPostResp = await fetch(tunnelPostUrl, {
        method: 'POST',
        headers: buildHeaders({
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://playit.gg',
          'Referer': `https://playit.gg/account/agents/${detectedAgentId}/tunnels/add`,
          'Accept': '*/*',
        }),
        body: tunnelPostBody.toString(),
        redirect: 'manual', // So we can read the X-Remix-Redirect header
      });
      updateCookies(tunnelPostResp.headers.get('set-cookie'));
      console.log('POST tunnel creation response status:', tunnelPostResp.status);
      console.log('POST tunnel creation response headers:', JSON.stringify(Object.fromEntries(tunnelPostResp.headers.entries()), null, 2));

      // 3. Extract tunnel ID from X-Remix-Redirect header
      let tunnelId: string | undefined = undefined;
      const remixRedirect = tunnelPostResp.headers.get('x-remix-redirect');
      console.log('\nChecking for tunnel ID in X-Remix-Redirect header:', remixRedirect);
      if (remixRedirect) {
        const tunnelIdMatch = remixRedirect.match(/\/account\/tunnels\/([a-f0-9\-]+)/);
        if (tunnelIdMatch) {
          tunnelId = tunnelIdMatch[1];
          console.log('Successfully extracted Tunnel ID:', tunnelId);
        }
      }
      if (tunnelId) {
        finalMessage += ` Tunnel ID: ${tunnelId}`;
        console.log('=== Tunnel Creation Process Completed Successfully ===');
        return { success: true, message: finalMessage, data: { agentId: detectedAgentId, tunnelId } };
      } else {
        console.warn('Tunnel ID could not be extracted from X-Remix-Redirect header.');
        console.log('=== Tunnel Creation Process Completed (No Tunnel ID) ===');
        return { success: true, message: finalMessage + ' (Tunnel ID not found)', data: { agentId: detectedAgentId } };
      }
    } catch (tunnelError: any) {
      console.error('=== Tunnel Creation Process Failed ===');
      console.error('Error during tunnel creation POST:', tunnelError);
      finalMessage += ' (Tunnel creation POST failed)';
      return { success: true, message: finalMessage, data: { agentId: detectedAgentId } };
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