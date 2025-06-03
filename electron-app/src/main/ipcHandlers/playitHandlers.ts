import { ipcMain, BrowserWindow, app } from 'electron'; // Import 'app'
import { spawn, ChildProcess, exec } from 'child_process';
import { IPC_CHANNELS } from '../../shared/types';
import { join } from 'path';
import fs from 'fs/promises'; // Use promises version of fs
import { URLSearchParams } from 'url'; // Import URLSearchParams
import { devLog, devError } from '../utils/logger'

let playitProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

type StartTunnelResponse = { success: boolean; message: string; data?: { agentId?: string, tunnelId?: string, assignedDomain?: string, staticIp4?: string, portStart?: number, loginLink?: string } }; // Updated return type to include loginLink

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

// Headers used for requests after Agent ID is obtained (polling and tunnel setup)
const buildPostAgentIdHeaders = (additionalHeaders?: Record<string, string>) => ({
  ...buildHeaders({
    'Accept': '*/*',
    'Priority': 'u=1, i',
    'Sec-Ch-Ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty', 
    'Sec-Fetch-Mode': 'cors', 
    'Sec-Fetch-Site': 'same-origin', 
  }),
  // Include any additional headers specific to a request (overrides or additions)
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
    const maxFullRetries = 7; // Maximum number of full retry attempts
    let fullRetryAttempts = 0;
    let finalMessage = 'Unknown error occurred.';
    let detectedAgentId: string | undefined = undefined; // Variable to store the extracted Agent ID
    let shouldBreakRetryLoop = false; // Controls retry loop exit

    while (fullRetryAttempts < maxFullRetries && !shouldBreakRetryLoop) {
      fullRetryAttempts++;
      devLog(`Starting full setup attempt ${fullRetryAttempts}/${maxFullRetries}...`);

      // Reset cookies for a fresh attempt
      currentCookies = '';

      // 1. Clean up previous process if it exists
      cleanupPlayitProcess();
      await delay(500); // Give process a moment to terminate cleanly and port to free up

      // Add a GET request to logout before starting the new process
      devLog('Attempting to log out previous guest session...');
      try {
        const logoutUrl = 'https://playit.gg/login/logout?_data=routes%2Flogin.logout';
        const logoutResp = await fetch(logoutUrl, { method: 'GET', headers: buildHeaders({}) });
        //updateCookies(logoutResp.headers.get('set-cookie'));
        devLog('Logout request status:', logoutResp.status);
        // Note: A 204 status with X-Remix-Redirect is expected for a successful logout
      } catch (error) {
        devError(`Logout request failed: ${error}`);
        // Decide if logout failure should prevent proceeding. For now, log and continue.
      }

    let binaryPath: string;
    try {
      binaryPath = await getPlayitBinaryPath();
    } catch (error: any) {
        const errorMessage = `Setup Error: ${error.message}`;
        devError(errorMessage);
        mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: errorMessage });
        finalMessage = errorMessage;
        // No point retrying if binary path cannot be determined
        break;
      }

      // 2. Spawn a new process
      let claimCode: string | undefined = undefined;
      let claimCodeHandled = false; // Correctly scoped per process
      let visitLinkNeeded = false; // Signal to immediately retry full sequence

      // Use a Promise to wait only for the claim code or visit link from the stdout listener
      let claimSignalPromise: Promise<{ type: 'claimCode' | 'visitLink' | 'existingAgent'; value?: string }> | null = null;

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

        // Check if process and stdout are valid before setting up listeners and promise
        if (!playitProcess || !playitProcess.stdout) {
           throw new Error('Failed to spawn Playit process or get stdout.');
        }

        claimSignalPromise = new Promise<{ type: 'claimCode' | 'visitLink' | 'existingAgent'; value?: string }>((resolve, reject) => {
          let claimCodeMatch: RegExpMatchArray | null = null; // Declare outside listener
          let loginLinkMatch: RegExpMatchArray | null = null; // Declare outside listener
          let visitLinkDetectedInitially = false; // Flag to track initial visit link detection

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
            devLog('cleanChunk:', cleanChunk);
            if (cleanChunk) {
              // New Agent Flow: Detect claim code (appears after 'Visit link to setup')
              claimCodeMatch = cleanChunk.match(/Visit link to setup\s*https:\/\/playit\.gg\/claim\/([a-zA-Z0-9]+)(?:\s|$)/); // Assign here
              if (claimCodeMatch && claimCodeMatch[1] && !claimCodeHandled) {
                claimCodeHandled = true; // Set synchronously before any async/resolve
                claimCode = claimCodeMatch[1];
                devLog('Claim code found in stdout:', claimCode);
                resolve({ type: 'claimCode', value: claimCode });
                return;
              }

              // Existing Agent Flow: Detect 'checking if secret key is valid' or the login link directly
              if (cleanChunk.includes("checking if secret key is valid")) {
                  devLog('Detected existing agent flow start signal.');
                  // No need to resolve yet, continue listening for the login link
                  return; // Continue listening for the login link
              }

              loginLinkMatch = cleanChunk.match(/login:\s*(https:\/\/playit\.gg\/login\/guest-account\/[a-zA-Z0-9=-]+)/); // Assign here
              if (loginLinkMatch && loginLinkMatch[1]) {
                devLog('Detected existing agent login link.');
                // Resolve with the login link and type 'existingAgent'
                resolve({ type: 'existingAgent', value: loginLinkMatch[1] });
                return;
              }


            }
          };
          playitProcess?.stdout?.removeAllListeners('data');
          playitProcess?.stdout?.on('data', listener);

          // Handle process exit/error - should reject the promise if it happens before a signal is found
          playitProcess?.on('close', (code) => {
            devLog(`Playit process closed with code ${code}.`);
            // If the process closes before we get a signal, it's an error
            // Only reject if no signal indicating either flow has been received
            if (!claimCodeMatch && !loginLinkMatch && !visitLinkDetectedInitially) { // Use declared variables
                reject(new Error(`Playit process closed unexpectedly with code ${code}.`));
            }
          });
          playitProcess?.on('error', (err) => {
            devError(`Playit process error: ${err.message}`);
             // Only reject if no signal indicating either flow has been received
             if (!claimCodeMatch && !loginLinkMatch && !visitLinkDetectedInitially) { // Use declared variables
                reject(new Error(`Playit process error: ${err.message}`));
             }
          });
        });
      } catch (error) {
        devError(`Error setting up claim signal promise: ${error}`);
        claimSignalPromise = null;
      }

     // Wait for claim code, visit link, or existing agent signal from stdout
     // Ensure claimSignalPromise is not null before awaiting
     const initialSignalResult = await (claimSignalPromise || Promise.reject(new Error("claimSignalPromise was not initialized.")));

     if (initialSignalResult && initialSignalResult.type === 'existingAgent') {
         // --- Existing Agent Flow ---
         devLog('Existing agent detected. Login link:', initialSignalResult.value);

         // Make a basic GET request with the login link
         devLog('Making GET request with login link...');
         try {
             const loginLinkResp = await fetch(initialSignalResult.value as string, { method: 'GET'});
             updateCookies(loginLinkResp.headers.get('set-cookie'));
             devLog('Login link GET response status:', loginLinkResp.status);
             // We don't necessarily need to check the response body here, just ensure the request is made and cookies are updated
         } catch (error) {
             devError(`GET request with login link failed: ${error}`);
             // Decide if this failure should stop the process. For now, log and continue.
         }

         finalMessage = 'Existing agent detected. Using provided login link.';

         // Make GET request to get agent details (no inner retry loop here)
         devLog('Fetching agent details...');
         const agentDetailsUrl = 'https://playit.gg/account/agents?_data=routes%2Faccount';
         let agentDetailsJson: any = null;
         let extractedAgentId: string | undefined = undefined;
         let agentDetailsFetchSuccess = false;

         try {
           const agentDetailsResp = await fetch(agentDetailsUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
             'Referer': 'https://playit.gg/login/guest-'
           }) });
           updateCookies(agentDetailsResp.headers.get('set-cookie'));
           devLog('Agent details GET response status:', agentDetailsResp.status);
           if (agentDetailsResp.ok) {
             agentDetailsFetchSuccess = true;
             try {
               agentDetailsJson = await agentDetailsResp.json();
               devLog('Agent details response body sample:', JSON.stringify(agentDetailsJson, null, 2).substring(0, 500) + '...');
             } catch (jsonError) {
               devError('Failed to parse agent details response JSON:', jsonError);
             }
           }
         } catch (error) {
           devError(`Agent details GET failed: ${error}`);
         }

         // Attempt to extract agent ID from the JSON response if fetch was successful and JSON parsed
         if (agentDetailsFetchSuccess && agentDetailsJson) {
           try {
             // Correct path is agentDetailsJson.agents.agents[0].id
             if (agentDetailsJson.agents && Array.isArray(agentDetailsJson.agents.agents) && agentDetailsJson.agents.agents.length > 0) {
               extractedAgentId = agentDetailsJson.agents.agents[0].id;
               devLog('Successfully extracted Agent ID:', extractedAgentId);
               // Turn off stdout listener after getting Agent ID in existing agent flow
               playitProcess?.stdout?.removeAllListeners('data');
             } else {
               console.warn('Agent ID not found in the expected location in the response.');
             }
           } catch (error) {
              devError(`Error extracting Agent ID from JSON: ${error}`);
           }
         }

         // Check if Agent ID was successfully obtained. If not, trigger a full retry.
         if (extractedAgentId) {
             // Make GET request to /account/agents/:agentId?_data=routes%2Faccount%2Fagents%2F%24agentId%2Findex
             devLog(`Fetching agent index data for Agent ID: ${extractedAgentId}...`);
             const agentIndexUrl = `https://playit.gg/account/agents/${extractedAgentId}?_data=routes%2Faccount%2Fagents%2F%24agentId%2Findex`;
             try {
               const agentIndexResp = await fetch(agentIndexUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
                 'Referer': 'https://playit.gg/account/agents'
               }) });
               updateCookies(agentIndexResp.headers.get('set-cookie'));
               devLog('Agent index GET response status:', agentIndexResp.status);
               // We don't necessarily need the response body for this step, just making the request and updating cookies
             } catch (error) {
               devError(`Agent index GET failed: ${error}`);
               // Decide if this failure should stop the process. For now, log and continue with success.
             }

             // Now that we have the agent ID and have made the index request, create and poll for the tunnel
             devLog('Calling createAndPollForTunnelDetails for existing agent...');
             const tunnelResult = await createAndPollForTunnelDetails(extractedAgentId);

             // Return the result from the tunnel creation and polling process
             return tunnelResult;
         } else {
             console.warn('Agent ID not obtained in existing agent flow after initial attempt. Triggering full retry.');
             // Clean up current process and continue to the next full retry attempt
             cleanupPlayitProcess();
             await delay(1000); // Short delay before next retry attempt
             continue; // Go to the next full retry attempt in the main while loop
         }

     } else if (!initialSignalResult || initialSignalResult.type !== 'claimCode') {
         // --- Handle cases where claim code is not received (original flow error handling) ---
         finalMessage = 'Did not receive claim code from Playit agent.';
         devError(finalMessage);
         cleanupPlayitProcess();
         await delay(5000); // Wait before retrying after API error
         continue; // Go to next full retry attempt
     }
     // If we reached here, it means initialSignalResult is 'claimCode'
     claimCode = initialSignalResult.value;
     devLog('Claim code found in stdout:', claimCode);

    // 1. Make initial requests to claim the agent (GET claim link, GET login/create, POST guest session)
    try {
      // Step 1: GET initial claim link
      const initialClaimUrl = `https://playit.gg/claim/${claimCode}`;
      const initialClaimResponse = await fetch(initialClaimUrl, { method: 'GET', headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9' }) });
      updateCookies(initialClaimResponse.headers.get('set-cookie'));
      devLog('Initial claim link response status:', initialClaimResponse.status);

      // Step 2: GET login/create page
      const loginCreateUrl = `https://playit.gg/login/create?redirect=%2Fclaim%2F${claimCode}%3F`;
      const loginCreateResponse = await fetch(loginCreateUrl, { method: 'GET', headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9' }) });
      updateCookies(loginCreateResponse.headers.get('set-cookie'));
      devLog('Login/create page response status:', loginCreateResponse.status);

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
      devLog('Guest session initiation POST response status:', guestInitResponse.status);

      if (!guestInitResponse.ok && guestInitResponse.status !== 203) { // 203 is a successful redirect here
        const errorText = await guestInitResponse.text();
        devError('Guest session initiation failed:', errorText);
        throw new Error(`Guest session initiation failed: ${guestInitResponse.statusText} - ${errorText}`);
      }
      // Assuming fetch follows 302 automatically, the cookies are updated above.

      devLog('Initial API chain (Steps 1-3) completed.');

    } catch (apiError: any) {
      const errorMessage = `API Chain Error (Steps 1-3): ${apiError.message}`;
      devError(errorMessage);
      mainWindow?.webContents.send(IPC_CHANNELS.TUNNEL_ERROR, { message: errorMessage });
      finalMessage = errorMessage;
      cleanupPlayitProcess();
      await delay(1000); // Wait before retrying after API error
      continue; // Go to next full retry attempt
    }

    // 2. Poll using GET requests until claim is approved (status 204 with redirect)
    devLog('Starting claim polling phase (GET requests)...');
    const getHeaders = buildHeaders({'Accept': '*/*'}); // General GET headers with latest cookies
    let pollingAttempts = 0;
    const maxPollingAttempts = 60; // Poll for max 60 attempts (approx 60 seconds with 1s delay)
    let claimPollingSuccess = false;
    let shouldExitPolling = false; // Flag to control polling loop exit

    // Add a listener specifically for stdout messages during the polling phase
    const pollingListener = (data: any) => {
        const chunk = data.toString();
        const cleanChunk = chunk
           .replace(/\x1B/g, '')
           .replace(/\[2J/g, '')
           .replace(/\[0m/g, '')
           .replace(/8/g, '')
           .replace(/no command provided, doing auto run/g, '')
           .trim();
        devLog('Polling cleanChunk:', cleanChunk); // Log polling chunks

        if (cleanChunk.includes("Visit link to setup")) {
            devLog('[Polling Listener] Detected "Visit link to setup", triggering full retry.');
            shouldExitPolling = true; // Set flag instead of breaking
        }
    };

    // Ensure playitProcess and its stdout are valid before adding listener
    if (playitProcess?.stdout) {
        playitProcess.stdout.on('data', pollingListener);
    }

    while (pollingAttempts < maxPollingAttempts && !visitLinkNeeded && !claimPollingSuccess && !shouldExitPolling) {
      pollingAttempts++;
      devLog(`Polling attempt ${pollingAttempts}/${maxPollingAttempts}`);
      try {
        const claimGetUrl = `https://playit.gg/claim/${claimCode}?_data=root`;
        const claimGetResponse = await fetch(claimGetUrl, { method: 'GET', headers: getHeaders });
        devLog('Claim GET response status:', claimGetResponse.status);

        const claimRoutesUrl = `https://playit.gg/claim/${claimCode}?_data=routes%2Fclaim%2F%24claimCode`;
        const claimRoutesResponse = await fetch(claimRoutesUrl, { method: 'GET', headers: getHeaders });
        devLog('Claim routes GET response status:', claimRoutesResponse.status);

        const claimRoutesIndexUrl = `https://playit.gg/claim/${claimCode}?_data=routes%2Fclaim%2F%24claimCode%2Findex`;
        const claimRoutesIndexResponse = await fetch(claimRoutesIndexUrl, { method: 'GET', headers: getHeaders });
        updateCookies(claimRoutesIndexResponse.headers.get('set-cookie')); // Update cookies after the last request
        devLog('Claim routes index GET response status:', claimRoutesIndexResponse.status);

        // Check for 204 status and X-Remix-Redirect header in the last response
        const remixRedirect = claimRoutesIndexResponse.headers.get('x-remix-redirect');
        if (claimRoutesIndexResponse.status === 204 && remixRedirect) {
          const agentIdMatch = remixRedirect.match(/\/setup\/connect\/([a-zA-Z0-9-]+)/);
          if (agentIdMatch && agentIdMatch[1]) {
            detectedAgentId = agentIdMatch[1];
            devLog('Claim polling successful. Extracted Agent ID from redirect header:', detectedAgentId);
            claimPollingSuccess = true;
            // Turn off stdout listener and other process listeners after getting Agent ID from HTTP
            playitProcess?.stdout?.removeAllListeners('data');
            // Remove close and error listeners as well
            playitProcess?.removeAllListeners('close');
            playitProcess?.removeAllListeners('error');
            break; // Exit polling loop
          }
        }

      } catch (pollingError: any) {
        devError(`Polling GET request failed on attempt ${pollingAttempts}: ${pollingError.message}`);
      }
      await delay(3000); // Delay before next polling attempt
    }

    // After polling, check if a full retry is needed or if Agent ID was obtained
    if (!detectedAgentId) {
      const errorMessage = 'Failed to obtain Agent ID after claim polling.';
      devError(errorMessage);
      finalMessage = errorMessage;
      cleanupPlayitProcess();
      await delay(5000); // Wait before retrying after polling failure
      continue; // Go to next full retry attempt
    }

    // If Agent ID was obtained, break the full retry loop
    shouldBreakRetryLoop = true;
    break; // Exit the full retry loop
  }

  // --- End of Retry Loop ---

  // Now that we have an agent ID, attempt tunnel creation
  if (!detectedAgentId) {
    devError('No agent ID available for tunnel creation.');
    return { success: false, message: 'Failed to get agent ID after all retries.' };
  }

  // Call the refactored function to create and poll for tunnel details
  const tunnelResult = await createAndPollForTunnelDetails(detectedAgentId);

  // Return the result from the refactored function
  return tunnelResult;
});
}

// Export the process variable so it can be accessed for cleanup on app quit
// This requires modifying how playitProcess is declared or adding a cleanup function
// Alternative: Add a cleanup function to playitHandlers.ts that kills the process

export function cleanupPlayitProcess() {
    if (playitProcess) {
        devLog('Cleaning up Playit process on shutdown...');
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

async function createAndPollForTunnelDetails(agentId: string): Promise<StartTunnelResponse> {
  let finalMessage = ''; // Message for this function's result
  let tunnelId: string | undefined = undefined;
  let assignedDomain: string | undefined = undefined;
  let staticIp4: string | undefined = undefined;
  let portStart: number | undefined = undefined;

  // 3. POST to create tunnel (browser-mimic)
  devLog('\nMaking POST request to create tunnel for Agent ID:', agentId);
  const tunnelPostUrl = `https://playit.gg/account/agents/${agentId}/tunnels/add?index=&_data=routes%2Faccount%2Fagents%2F%24agentId%2Ftunnels%2Fadd%2Findex`;
  devLog('POST Request URL:', tunnelPostUrl);
  const tunnelPostBody = new URLSearchParams({
    region: 'global',
    tunnel_type: 'minecraft-java',
    enabled: 'on',
  });
  devLog('POST Request Body:', tunnelPostBody.toString());
  try {
    const tunnelPostResp = await fetch(tunnelPostUrl, {
      method: 'POST',
      headers: buildHeaders({
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Origin': 'https://playit.gg',
        'Referer': `https://playit.gg/account/agents/${agentId}/tunnels/add`,
        'Accept': '*/*',
      }),
      body: tunnelPostBody.toString(),
      redirect: 'manual', // So we can read the X-Remix-Redirect header
    });
    updateCookies(tunnelPostResp.headers.get('set-cookie'));
    devLog('POST tunnel creation response status:', tunnelPostResp.status);
    devLog('POST tunnel creation response headers:', JSON.stringify(Object.fromEntries(tunnelPostResp.headers.entries()), null, 2));

    // 4. Extract tunnel ID from X-Remix-Redirect header
    const remixRedirect = tunnelPostResp.headers.get('x-remix-redirect');
    devLog('\nChecking for tunnel ID in X-Remix-Redirect header:', remixRedirect);
    if (remixRedirect) {
      const tunnelIdMatch = remixRedirect.match(/\/account\/tunnels\/([a-f0-9\-]+)/);
      if (tunnelIdMatch) {
        tunnelId = tunnelIdMatch[1];
        devLog('Successfully extracted Tunnel ID:', tunnelId);
      }
    }
  } catch (error) {
    devError(`Tunnel creation POST failed: ${error}`);
    finalMessage = 'Tunnel creation POST failed.';
    // Return failure from this function if POST fails
    return { success: false, message: finalMessage, data: { agentId } };
  }

  if (tunnelId) {
    // --- Polling for Tunnel Details ---
    devLog('Starting polling for tunnel details...');
    let tunnelDetailsPollingSuccess = false;
    const maxTunnelPollingAttempts = 60; // Poll for max 60 attempts (approx 60 seconds)

    for (let i = 0; i < maxTunnelPollingAttempts; i++) {
      devLog(`Tunnel details polling attempt ${i + 1}/${maxTunnelPollingAttempts}`);

      // First GET to /account/tunnels/:tunnelId?_data=root
      const tunnelRootUrl = `https://playit.gg/account/tunnels/${tunnelId}?_data=root`;
      try {
        const tunnelRootResp = await fetch(tunnelRootUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
          'Referer': `https://playit.gg/account/tunnels/${tunnelId}`
        }) });
        updateCookies(tunnelRootResp.headers.get('set-cookie'));
        devLog('Tunnel details root GET response status:', tunnelRootResp.status);
      } catch (error) {
        devError(`Tunnel details root GET failed: ${error}`);
      }

      // Second GET to /account/tunnels/:tunnelId?_data=routes%2Faccount
      const tunnelAccountRouteUrl = `https://playit.gg/account/tunnels/${tunnelId}?_data=routes%2Faccount`;
      let tunnelAccountRouteRespJson: any = null;
      try {
        const tunnelAccountRouteResp = await fetch(tunnelAccountRouteUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
          'Referer': `https://playit.gg/account/tunnels/${tunnelId}`
        }) });
        updateCookies(tunnelAccountRouteResp.headers.get('set-cookie'));
        devLog('Tunnel details account route GET response status:', tunnelAccountRouteResp.status);
        if (tunnelAccountRouteResp.ok) {
          try {
             tunnelAccountRouteRespJson = await tunnelAccountRouteResp.json();
             devLog('Tunnel details account route GET response body sample:', JSON.stringify(tunnelAccountRouteRespJson, null, 2).substring(0, 500) + '...'); // Log beginning of response
          } catch (jsonError) {
             devError('Failed to parse Tunnel details account route response JSON:', jsonError);
          }
        }
      } catch (error) {
        devError(`Tunnel details account route GET failed: ${error}`);
      }

      // Third GET to /account/tunnels/:tunnelId?_data=routes%2Faccount%2Ftunnels%2F%24tunnelId
      const tunnelDetailsRouteUrl = `https://playit.gg/account/tunnels/${tunnelId}?_data=routes%2Faccount%2Ftunnels%2F%24tunnelId`;
      try {
         // We don't necessarily need the response from this one, just to make the request
        const tunnelDetailsRouteResp = await fetch(tunnelDetailsRouteUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
          'Referer': `https://playit.gg/account/tunnels/${tunnelId}`
        }) });
        updateCookies(tunnelDetailsRouteResp.headers.get('set-cookie')); // Update cookies after the last request
        devLog('Tunnel details route GET response status:', tunnelDetailsRouteResp.status);
      } catch (error) {
        devError(`Tunnel details route GET failed: ${error}`);
      }

      // Check if the tunnel data is available in the second response and extract details
      if (tunnelAccountRouteRespJson && tunnelAccountRouteRespJson.tunnels && Array.isArray(tunnelAccountRouteRespJson.tunnels.tunnels)) {
        const targetTunnel = tunnelAccountRouteRespJson.tunnels.tunnels.find((t: any) => t.id === tunnelId);
        if (targetTunnel && targetTunnel.alloc && targetTunnel.alloc.data) {
          assignedDomain = targetTunnel.alloc.data.assigned_domain;
          staticIp4 = targetTunnel.alloc.data.static_ip4;
          portStart = targetTunnel.alloc.data.port_start;
          if (assignedDomain && staticIp4 && portStart) {
            devLog('Successfully extracted assigned_domain, static_ip4, and port_start.');
            tunnelDetailsPollingSuccess = true;
            break; // Exit polling loop
          }
        }
      }

      await delay(3000); // Delay before next polling attempt
    }

    if (tunnelDetailsPollingSuccess) {
      finalMessage = `Tunnel created and details retrieved. Agent ID: ${agentId}, Tunnel ID: ${tunnelId}`;
      if (assignedDomain) finalMessage += `, Domain: ${assignedDomain}`;
      if (staticIp4) finalMessage += `, IPv4: ${staticIp4}`;
      if (portStart) finalMessage += `, Port Start: ${portStart}`;
      devLog('=== Tunnel Details Polling Successful ===');
      devLog(`Assigned Domain: ${assignedDomain}, Static IPv4: ${staticIp4}, Port Start: ${portStart}`);
      return { success: true, message: finalMessage, data: { agentId, tunnelId, assignedDomain, staticIp4, portStart } };
    } else {
       console.warn('Tunnel details (assigned_domain/static_ip4) could not be retrieved after polling.');
       finalMessage = 'Tunnel details polling failed.';
       // Decide if failure here should trigger full retry or just report failure
       // For now, report failure but include agentId and loginLink
       return { success: false, message: finalMessage, data: { agentId } };
    }

  } else {
    console.warn('Tunnel ID could not be extracted from X-Remix-Redirect header after POST.');
    finalMessage = 'Tunnel ID not found after creation POST.';
    // Decide if failure here should trigger full retry or just report failure
    // For now, report failure but include agentId and loginLink
    return { success: false, message: finalMessage, data: { agentId } };
  }
}