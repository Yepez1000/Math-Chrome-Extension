import { ipcMain, /* BrowserWindow, */ app } from 'electron'; // Import 'app'
import { spawn, ChildProcess, exec } from 'child_process';
import { IPC_CHANNELS } from '../../shared/types';
import { join } from 'path';
import fs from 'fs/promises'; // Use promises version of fs
import { URLSearchParams } from 'url'; // Import URLSearchParams
import { devLog, devError } from '../utils/logger'

let playitProcess: ChildProcess | null = null;
// Remove mainWindow variable
// let mainWindow: BrowserWindow | null = null;

type StartTunnelResponse = { success: boolean; message: string; data?: { agentId?: string, tunnelId?: string, assignedDomain?: string, staticIp4?: string, portStart?: number } }; // Removed loginLink from type

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

// Remove window parameter
export function registerPlayitHandlers(/* window: BrowserWindow */) {
  // Remove assignment to mainWindow
  // mainWindow = window;

  ipcMain.handle(IPC_CHANNELS.TUNNEL_START, async (event, { serverPort }) => {
    devLog('[Port Tracking] Creating tunnel with port:', serverPort);
    // Change all status updates to use event.sender.send()
    event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
      status: "Starting tunnel",
      type: "tunnel" 
    });

    // Validate serverPort
    if (typeof serverPort !== 'number' || serverPort < 1 || serverPort > 65535) {
      const errorMessage = `Invalid server port: ${serverPort}. Port must be a number between 1 and 65535.`;
      devError(errorMessage);
      event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
        status: "Error",
        type: "tunnel",
        error: errorMessage
      });
      return { success: false, message: errorMessage };
    }

    // TODO: Add validation for apiKey if it were user-provided

    const maxFullRetries = 7; // Maximum number of full retry attempts
    let fullRetryAttempts = 0;
    let finalMessage = 'Unknown error occurred.';
    let detectedAgentId: string | undefined = undefined; // Variable to store the extracted Agent ID
    let shouldBreakRetryLoop = false; // Controls retry loop exit

    while (fullRetryAttempts < maxFullRetries && !shouldBreakRetryLoop) {
      fullRetryAttempts++;
      devLog(`Starting full setup attempt ${fullRetryAttempts}/${maxFullRetries}...`);
      // Send status update for starting a new attempt
      if (fullRetryAttempts > 1) {
         event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
           status: `Retrying Connection`,
           type: "tunnel"
         });
      } else {
         event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
           status: "Connecting to Playit",
           type: "tunnel"
         });
      }

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
        devLog('Logout request status:', logoutResp.status);
      } catch (error) {
        devError(`Logout request failed: ${error}`);
      }

      // Add the specified GET request after logout
      devLog('Fetching root data after logout...');
      try {
        const rootDataUrl = 'https://playit.gg/?_data=root';
        const rootDataResp = await fetch(rootDataUrl, { method: 'GET', headers: buildHeaders({}) });
        // You might want to process the response here if needed
        devLog('Root data GET response status:', rootDataResp.status);
      } catch (error) {
        devError(`Root data GET request failed: ${error}`);
    }

    let binaryPath: string;
    try {
      binaryPath = await getPlayitBinaryPath();
    } catch (error: any) {
        const errorMessage = `Setup Error: ${error.message}`;
          devError(errorMessage);
          event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
            status: "Error",
            type: "tunnel",
            error: errorMessage
          });
        finalMessage = errorMessage;
        break;
      }

      // 2. Spawn a new process
      let claimCode: string | undefined = undefined;
      let claimCodeHandled = false;
      let visitLinkNeeded = false;

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
      
        if (!playitProcess || !playitProcess.stdout) {
           throw new Error('Failed to spawn Playit process or get stdout.');
        }

        claimSignalPromise = new Promise<{ type: 'claimCode' | 'visitLink' | 'existingAgent'; value?: string }>((resolve, reject) => {
          let claimCodeMatch: RegExpMatchArray | null = null;

          const listener = (data: any) => {
          const chunk = data.toString();
          const cleanChunk = chunk
            .replace(/\x1B/g, '')
            .replace(/\[2J/g, '')
            .replace(/\[0m/g, '')
            .replace(/8/g, '')
            .replace(/no command provided, doing auto run/g, '')
            .trim();
            devLog('cleanChunk:', cleanChunk);
          if (cleanChunk) {
              claimCodeMatch = cleanChunk.match(/Visit link to setup\s*https:\/\/playit\.gg\/claim\/([a-zA-Z0-9]+)(?:\s|$)/);
              if (claimCodeMatch && claimCodeMatch[1] && !claimCodeHandled) {
                claimCodeHandled = true;
                claimCode = claimCodeMatch[1];
                devLog('Claim code found in stdout:', claimCode);
                resolve({ type: 'claimCode', value: claimCode });
              }

              if (cleanChunk.includes("checking if secret key is valid")) {
                  devLog('Detected existing agent flow start signal.');
                  event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
                    status: "Connecting Agent",
                    type: "tunnel"
                  });
                  resolve({ type: 'existingAgent' });
                return;
              }
            }
          };
          playitProcess?.stdout?.removeAllListeners('data');
          playitProcess?.stdout?.on('data', listener);

          playitProcess?.on('close', (code) => {
            devLog(`Playit process closed with code ${code}.`);
            if (!claimCodeMatch && code !== 0) {
                reject(new Error(`Playit process closed unexpectedly with code ${code}.`));
            }
          });
          playitProcess?.on('error', (err) => {
            devError(`Playit process error: ${err.message}`);
             if (!claimCodeMatch) {
                reject(new Error(`Playit process error: ${err.message}`));
             }
          });
        });
      } catch (error) {
        devError(`Error setting up claim signal promise: ${error}`);
        claimSignalPromise = null;
      }

     const initialSignalResult = await (claimSignalPromise || Promise.reject(new Error("claimSignalPromise was not initialized.")));

     if (initialSignalResult && initialSignalResult.type === 'existingAgent') {
         devLog('Existing agent detected. Stopping current process and getting login URL...');

         // Step 1: Clean up previous process
         cleanupPlayitProcess();
         await delay(500); // Give process a moment to terminate

         // Step 2: Run 'playit account login-url' command and read output
         let loginUrl: string | undefined = undefined;
         try {
             const loginUrlCommand = 'playit account login-url';
             devLog(`Running command: ${loginUrlCommand}`);
             event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
               status: "Connecting Agent",
               type: "tunnel"
             });
             loginUrl = await new Promise<string>((resolve, reject) => {
                 exec(loginUrlCommand, (error, stdout, stderr) => {
                     if (error) {
                         devError(`Error running 'playit account login-url': ${error.message}`);
                         reject(new Error(`Failed to get login URL: ${error.message}`));
                         return;
                     }
                     if (stderr) {
                        devError(`Stderr from 'playit account login-url': ${stderr}`);
                     }
                     const url = stdout.trim();
                     if (url) {
                         devLog(`Login URL obtained: ${url}`);
                         resolve(url);
                     } else {
                         devError('playit account login-url returned no output.');
                         reject(new Error('Failed to get login URL: No output from command.'));
                     }
                 });
             });
         } catch (error: any) {
             const errorMessage = `Login URL Error: ${error.message}`;
             devError(errorMessage);
             event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
               status: "Error",
               type: "tunnel",
               error: errorMessage
             });
             finalMessage = errorMessage;
             // Trigger full retry if login URL cannot be obtained
             continue;
         }

         // Step 3: Feed the login URL into the old flow
         devLog('Making GET request with login link...');
         event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
           status: "Connecting Agent",
           type: "tunnel"
         });
         try {
             const loginLinkResp = await fetch(loginUrl as string, { method: 'GET'});
             updateCookies(loginLinkResp.headers.get('set-cookie'));
             devLog('Login link GET response status:', loginLinkResp.status);
         } catch (error) {
             devError(`GET request with login link failed: ${error}`);
             finalMessage = `Failed to use login URL: ${error}`;
             event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
               status: "Error",
               type: "tunnel",
               error: finalMessage
             });
             cleanupPlayitProcess();
             await delay(1000);
             continue;
         }

         finalMessage = 'Existing agent detected. Used login URL.';

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

         if (agentDetailsFetchSuccess && agentDetailsJson) {
           try {
             if (agentDetailsJson.agents && Array.isArray(agentDetailsJson.agents.agents) && agentDetailsJson.agents.agents.length > 0) {
               extractedAgentId = agentDetailsJson.agents.agents[0].id;
               devLog('Successfully extracted Agent ID:', extractedAgentId);
               playitProcess?.stdout?.removeAllListeners('data');
             } else {
               console.warn('Agent ID not found in the expected location in the response.');
             }
           } catch (error) {
              devError(`Error extracting Agent ID from JSON: ${error}`);
           }
         }

         if (extractedAgentId) {
             devLog(`Fetching agent index data for Agent ID: ${extractedAgentId}...`);
             const agentIndexUrl = `https://playit.gg/account/agents/${extractedAgentId}?_data=routes%2Faccount%2Fagents%2F%24agentId%2Findex`;
             try {
               const agentIndexResp = await fetch(agentIndexUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
                 'Referer': 'https://playit.gg/account/agents'
               }) });
               updateCookies(agentIndexResp.headers.get('set-cookie'));
               devLog('Agent index GET response status:', agentIndexResp.status);
             } catch (error) {
               devError(`Agent index GET failed: ${error}`);
             }

             const tunnelResult = await createAndPollForTunnelDetails(event, extractedAgentId);

             // Ensure the playit process is running to maintain the tunnel after successfully getting details
             devLog('Detected existing agent and polled for tunnel details. Ensuring playit process is running.');
             cleanupPlayitProcess(); // Clean up any potentially lingering process
             // Re-spawn the playit binary to keep the tunnel alive
             playitProcess = spawn(binaryPath, [], { // Use the binaryPath obtained earlier
                detached: false,
                windowsHide: false,
                stdio: ['ignore', 'pipe', 'pipe'], // Use ignore for stdin, pipe for stdout/stderr
                shell: false,
                env: { 
                  ...process.env, 
                  FORCE_COLOR: '0', // Disable color output from Playit agent
                  TERM: 'dumb',
                  CLICOLOR: '0',
                  NO_COLOR: '1'
                }
              });

             if (!playitProcess) {
                 devError('Failed to re-spawn Playit process after detecting existing agent.');
                 throw new Error('Failed to keep Playit process running after setup.');
             }

             // Note: Listeners are not typically needed here as the agent process handles tunnel upkeep.

            shouldBreakRetryLoop = true; // Success, exit the full retry loop
            return tunnelResult;
         } else {
             console.warn('Agent ID not obtained in existing agent flow after initial attempt. Triggering full retry.');
             cleanupPlayitProcess();
             await delay(1000);
             continue;
         }

     } else if (!initialSignalResult || initialSignalResult.type !== 'claimCode') {
           finalMessage = 'Did not receive claim code from Playit agent.';
         devError(finalMessage);
           event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
             status: "Error",
             type: "tunnel",
             error: finalMessage
           });
           cleanupPlayitProcess();
           await delay(5000);
           continue;
       }
       claimCode = initialSignalResult.value;
     devLog('Claim code found in stdout:', claimCode);

      try {
        const initialClaimUrl = `https://playit.gg/claim/${claimCode}`;
        const initialClaimResponse = await fetch(initialClaimUrl, { method: 'GET', headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9' }) });
        updateCookies(initialClaimResponse.headers.get('set-cookie'));
      devLog('Initial claim link response status:', initialClaimResponse.status);

        const loginCreateUrl = `https://playit.gg/login/create?redirect=%2Fclaim%2F${claimCode}%3F`;
        const loginCreateResponse = await fetch(loginCreateUrl, { method: 'GET', headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9' }) });
        updateCookies(loginCreateResponse.headers.get('set-cookie'));
      devLog('Login/create page response status:', loginCreateResponse.status);

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

        if (!guestInitResponse.ok && guestInitResponse.status !== 203) {
          const errorText = await guestInitResponse.text();
        devError('Guest session initiation failed:', errorText);
          throw new Error(`Guest session initiation failed: ${guestInitResponse.statusText} - ${errorText}`);
        }

      devLog('Initial API chain (Steps 1-3) completed.');

      } catch (apiError: any) {
        const errorMessage = `API Chain Error (Steps 1-3): ${apiError.message}`;
      devError(errorMessage);
        event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
          status: "Error",
          type: "tunnel",
          error: errorMessage
        });
        finalMessage = errorMessage;
        cleanupPlayitProcess();
        await delay(1000);
        continue;
      }

    devLog('Starting claim polling phase (GET requests)...');
      event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
        status: "Polling Claim",
        type: "tunnel"
      });
      const getHeaders = buildHeaders({'Accept': '*/*'});
      let pollingAttempts = 0;
      const maxPollingAttempts = 60;
      let claimPollingSuccess = false;
    let shouldExitPolling = false;

    const pollingListener = (data: any) => {
        const chunk = data.toString();
        const cleanChunk = chunk
           .replace(/\x1B/g, '')
           .replace(/\[2J/g, '')
           .replace(/\[0m/g, '')
           .replace(/8/g, '')
           .replace(/no command provided, doing auto run/g, '')
           .trim();
        devLog('Polling cleanChunk:', cleanChunk);

        if (cleanChunk.includes("Visit link to setup")) {
            devLog('[Polling Listener] Detected "Visit link to setup", triggering full retry.');
            event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
              status: "Manual Retry",
              type: "tunnel"
            });
            shouldExitPolling = true;
        }
    };

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
          updateCookies(claimRoutesIndexResponse.headers.get('set-cookie'));
        devLog('Claim routes index GET response status:', claimRoutesIndexResponse.status);

          const remixRedirect = claimRoutesIndexResponse.headers.get('x-remix-redirect');
          if (claimRoutesIndexResponse.status === 204 && remixRedirect) {
            const agentIdMatch = remixRedirect.match(/\/setup\/connect\/([a-zA-Z0-9-]+)/);
            if (agentIdMatch && agentIdMatch[1]) {
              detectedAgentId = agentIdMatch[1];
            devLog('Claim polling successful. Extracted Agent ID from redirect header:', detectedAgentId);
              event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
                status: "Setting Tunnel",
                type: "tunnel"
              });
              claimPollingSuccess = true;
              playitProcess?.stdout?.removeAllListeners('data');
              playitProcess?.removeAllListeners('close');
              playitProcess?.removeAllListeners('error');
              break;
            }
          }

        } catch (pollingError: any) {
        devError(`Polling GET request failed on attempt ${pollingAttempts}: ${pollingError.message}`);
         event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
           status: `Polling failed (Attempt ${pollingAttempts}/${maxPollingAttempts})...`,
           type: "tunnel"
         }); // Send status update
        }
        await delay(3000);
      }

      if (!detectedAgentId) {
        const errorMessage = 'Failed to obtain Agent ID after claim polling.';
      devError(errorMessage);
        finalMessage = errorMessage;
        cleanupPlayitProcess();
        await delay(5000);
        continue;
      }

      shouldBreakRetryLoop = true;
      break;
    }

    if (!detectedAgentId) {
    devError('No agent ID available for tunnel creation.');
      return { success: false, message: 'Failed to get agent ID after all retries.' };
    }

  const tunnelResult = await createAndPollForTunnelDetails(event, detectedAgentId);

  event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, {
    status: "Tunnel connected",
    type: "tunnel",
    address: tunnelResult.data?.assignedDomain || tunnelResult.data?.staticIp4
  });

  // Update port if not default
  if (serverPort !== 25565 && tunnelResult.data?.tunnelId) {
    await updateTunnelPort(
      tunnelResult.data.tunnelId,
      detectedAgentId,
      25565,
      serverPort,
      currentCookies
    );
  }

  return {
    success: true,
    data: {
      tunnelId: tunnelResult.data?.tunnelId,
      assignedDomain: tunnelResult.data?.assignedDomain,
      staticIp4: tunnelResult.data?.staticIp4,
      assignedPort: serverPort
    }
  };
  });

  ipcMain.handle('UPDATE_TUNNEL_PORT', async (_, { tunnelId, agentId, oldPort, newPort, sessionCookie}) => {
    return updateTunnelPort(tunnelId, agentId, oldPort, newPort, sessionCookie || currentCookies);
  });
}

export function cleanupPlayitProcess() {
    if (playitProcess) {
        devLog('Cleaning up Playit process on shutdown...');
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

async function createAndPollForTunnelDetails(event: Electron.IpcMainInvokeEvent, agentId: string): Promise<StartTunnelResponse> {
  try {
    devLog(`Creating and polling for tunnel details for Agent ID: ${agentId}...`);
    event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
      status: "Setting Tunnel",
      type: "tunnel"
    });
    let finalMessage = '';
    let tunnelId: string | undefined = undefined;
    let assignedDomain: string | undefined = undefined;
    let staticIp4: string | undefined = undefined;
    let portStart: number | undefined = undefined;

    devLog('Making POST request to create tunnel for Agent ID:', agentId);
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
        redirect: 'manual',
      });
      updateCookies(tunnelPostResp.headers.get('set-cookie'));
      devLog('POST tunnel creation response status:', tunnelPostResp.status);
      devLog('POST tunnel creation response headers:', JSON.stringify(Object.fromEntries(tunnelPostResp.headers.entries()), null, 2));

      const remixRedirect = tunnelPostResp.headers.get('x-remix-redirect');
      devLog('Checking for tunnel ID in X-Remix-Redirect header:', remixRedirect);
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
      return { success: false, message: finalMessage, data: { agentId } };
    }

    if (!tunnelId) {
      return { 
        success: false, 
        message: 'Failed to create tunnel', 
        data: { agentId } 
      };
    }

    devLog('Starting polling for tunnel details...');
    event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
      status: "Getting Tunnel Details",
      type: "tunnel"
    });
    let tunnelDetailsPollingSuccess = false;
    const maxTunnelPollingAttempts = 60;

    for (let i = 0; i < maxTunnelPollingAttempts; i++) {
      devLog(`Tunnel details polling attempt ${i + 1}/${maxTunnelPollingAttempts}`);

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
             devLog('Tunnel details account route GET response body sample:', JSON.stringify(tunnelAccountRouteRespJson, null, 2).substring(0, 500) + '...');
          } catch (jsonError) {
             devError('Failed to parse Tunnel details account route response JSON:', jsonError);
          }
        }
      } catch (error) {
        devError(`Tunnel details account route GET failed: ${error}`);
      }

      const tunnelDetailsRouteUrl = `https://playit.gg/account/tunnels/${tunnelId}?_data=routes%2Faccount%2Ftunnels%2F%24tunnelId`;
      try {
        const tunnelDetailsRouteResp = await fetch(tunnelDetailsRouteUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
          'Referer': `https://playit.gg/account/tunnels/${tunnelId}`
        }) });
        updateCookies(tunnelDetailsRouteResp.headers.get('set-cookie'));
        devLog('Tunnel details route GET response status:', tunnelDetailsRouteResp.status);
      } catch (error) {
        devError(`Tunnel details route GET failed: ${error}`);
      }

      if (tunnelAccountRouteRespJson && tunnelAccountRouteRespJson.tunnels && Array.isArray(tunnelAccountRouteRespJson.tunnels.tunnels)) {
        const targetTunnel = tunnelAccountRouteRespJson.tunnels.tunnels.find((t: any) => t.id === tunnelId);
        if (targetTunnel && targetTunnel.alloc && targetTunnel.alloc.data) {
          assignedDomain = targetTunnel.alloc.data.assigned_domain;
          staticIp4 = targetTunnel.alloc.data.static_ip4;
          portStart = targetTunnel.alloc.data.port_start;
          if (assignedDomain || staticIp4) { // Check if either domain or static IP is available
            devLog('Successfully extracted assigned_domain, static_ip4, and port_start.');
            tunnelDetailsPollingSuccess = true;
            break;
          }
        }
      }

      await delay(3000);
    }

    if (tunnelDetailsPollingSuccess) {
      event.sender.send(IPC_CHANNELS.SERVER_STATUS_UPDATE, { 
        status: "",
        type: "tunnel"
      });
      finalMessage = `Tunnel created and details retrieved. Agent ID: ${agentId}, Tunnel ID: ${tunnelId}`
      return { 
        success: true, 
        message: finalMessage, 
        data: { agentId, tunnelId, assignedDomain, staticIp4, portStart } 
      };
    } else {
      return { 
        success: false, 
        message: 'Failed to retrieve tunnel details after polling', 
        data: { agentId } 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      data: { agentId } 
    };
  }
}

async function updateTunnelPort(
  tunnelId: string,
  agentId: string,
  oldPort: number,
  newPort: number,
  sessionCookie: string
): Promise<boolean> {
  devLog('[Port Tracking] Attempting port update:', { oldPort, newPort });
  try {
    const url = `https://playit.gg/account/tunnels/${tunnelId}?_data=routes%2Faccount%2Ftunnels%2F%24tunnelId`;
    const headers = {
      "accept": "*/*",
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "cookie": `__session=${sessionCookie}`
    };
    const body = `_action=local-address&agent_id=${agentId}&local_ip_og=127.0.0.1&local_port_og=${oldPort}&local_ip=&local_port=${newPort}`;

    devLog(`Updating tunnel port: ${oldPort} -> ${newPort}`);
    devLog(`Request URL: ${url}`);
    devLog(`Request headers: ${JSON.stringify(headers, null, 2)}`);
    devLog(`Request body: ${body}`);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body
    });

    devLog(`Response status: ${response.status}`);
    devLog(`Response headers: ${JSON.stringify([...response.headers.entries()], null, 2)}`);
    
    const responseText = await response.text();
    devLog(`Response body: ${responseText}`);

    if (!response.ok) {
      devError(`Port update failed with status ${response.status}: ${responseText}`);
      return false;
    }

    devLog('Port update successful');
    return true;
  } catch (error) {
    devError('Port update failed:', error instanceof Error ? error.message : String(error));
    return false;
  }
}