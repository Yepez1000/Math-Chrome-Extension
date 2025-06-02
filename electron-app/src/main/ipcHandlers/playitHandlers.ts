import { ipcMain, BrowserWindow, app } from 'electron'; // Import 'app'
import { spawn, ChildProcess, exec } from 'child_process';
import { IPC_CHANNELS } from '../../shared/types';
import { join } from 'path';
import fs from 'fs/promises'; // Use promises version of fs
import { URLSearchParams } from 'url'; // Import URLSearchParams

let playitProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

type StartTunnelResponse = { success: boolean; message: string; data?: { agentId?: string, tunnelId?: string, assignedDomain?: string, staticIp4?: string, portStart?: number } }; // Updated return type to allow tunnelId, assignedDomain, staticIp4, and portStart

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
    const maxFullRetries = 5; // Maximum number of full retry attempts
    let fullRetryAttempts = 0;
    let finalMessage = 'Unknown error occurred.';
    let detectedAgentId: string | undefined = undefined; // Variable to store the extracted Agent ID
    let shouldBreakRetryLoop = false; // Controls retry loop exit

    while (fullRetryAttempts < maxFullRetries && !shouldBreakRetryLoop) {
      fullRetryAttempts++;
      console.log(`Starting full setup attempt ${fullRetryAttempts}/${maxFullRetries}...`);

      // Reset cookies for a fresh attempt
      currentCookies = '';

      // 1. Clean up previous process if it exists
      cleanupPlayitProcess();
      await delay(500); // Give process a moment to terminate cleanly and port to free up

      // Add a GET request to logout before starting the new process
      console.log('Attempting to log out previous guest session...');
      try {
        const logoutUrl = 'https://playit.gg/login/logout?_data=routes%2Flogin.logout';
        const logoutResp = await fetch(logoutUrl, { method: 'GET', headers: buildHeaders({}) });
        //updateCookies(logoutResp.headers.get('set-cookie'));
        console.log('Logout request status:', logoutResp.status);
        // Note: A 204 status with X-Remix-Redirect is expected for a successful logout
      } catch (error) {
        console.error(`Logout request failed: ${error}`);
        // Decide if logout failure should prevent proceeding. For now, log and continue.
      }

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

      // 2. Spawn a new process
      let claimCode: string | undefined = undefined;
      let claimCodeHandled = false; // Correctly scoped per process
      let visitLinkNeeded = false; // Signal to immediately retry full sequence

      let claimSignalPromise: Promise<{ type: 'claimCode' | 'visitLink'; value?: string }>;

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

        // Use a Promise to wait only for the claim code or visit link from the stdout listener
        claimSignalPromise = new Promise<{
          type: 'claimCode' | 'visitLink';
          value?: string
        }>((resolve, reject) => {
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
                resolve({ type: 'claimCode', value: claimCode });
                return;
              }
              // Check for 'Visit link to setup' after claim code is seen (This signal triggers a full retry)
              if (cleanChunk.includes("Visit link to setup")) {
                console.log('[polling] Detected "Visit link to setup" in stdout, triggering retry.');
                visitLinkNeeded = true;
                resolve({ type: 'visitLink' });
                return;
              }
            }
          };
          playitProcess?.stdout?.removeAllListeners('data');
          playitProcess?.stdout?.on('data', listener);

          // Handle process exit/error - should reject the promise if it happens before claimCode/visitLink is found
          playitProcess?.on('close', (code) => {
            console.log(`Playit process closed with code ${code}.`);
            // If the process closes before we get a signal, it's an error
            if (!claimCode && !visitLinkNeeded) {
                reject(new Error(`Playit process closed unexpectedly with code ${code}.`));
            }
          });
          playitProcess?.on('error', (err) => {
            console.error(`Playit process error: ${err.message}`);
             if (!claimCode && !visitLinkNeeded) {
                reject(new Error(`Playit process error: ${err.message}`));
             }
          });
        }); // End of claimSignalPromise


      } catch (spawnError: any) {
        console.error(`Error spawning Playit process: ${spawnError.message}`);
        finalMessage = `Setup Error: ${spawnError.message}`;
        cleanupPlayitProcess();
        await delay(1000); // Wait before retrying after spawn error
        continue; // Go to next full retry attempt
      }

       // Wait for claim code or visit link from stdout (no timeout)
       const initialSignalResult = await claimSignalPromise;
       if (!initialSignalResult || initialSignalResult.type !== 'claimCode') {
           finalMessage = 'Did not receive claim code from Playit agent.';
           console.error(finalMessage);
           cleanupPlayitProcess();
           await delay(5000); // Wait before retrying after API error
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
        await delay(1000); // Wait before retrying after API error
        continue; // Go to next full retry attempt
      }

      // 2. Poll using GET requests until claim is approved (status 204 with redirect)
      console.log('Starting claim polling phase (GET requests)...');
      const getHeaders = buildHeaders({'Accept': '*/*'}); // General GET headers with latest cookies
      let pollingAttempts = 0;
      const maxPollingAttempts = 60; // Poll for max 60 attempts (approx 60 seconds with 1s delay)
      let claimPollingSuccess = false;
      while (pollingAttempts < maxPollingAttempts && !visitLinkNeeded && !claimPollingSuccess) {
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
          updateCookies(claimRoutesIndexResponse.headers.get('set-cookie')); // Update cookies after the last request
          console.log('Claim routes index GET response status:', claimRoutesIndexResponse.status);

          // Check for 204 status and X-Remix-Redirect header in the last response
          const remixRedirect = claimRoutesIndexResponse.headers.get('x-remix-redirect');
          if (claimRoutesIndexResponse.status === 204 && remixRedirect) {
            const agentIdMatch = remixRedirect.match(/\/setup\/connect\/([a-zA-Z0-9-]+)/);
            if (agentIdMatch && agentIdMatch[1]) {
              detectedAgentId = agentIdMatch[1];
              console.log('Claim polling successful. Extracted Agent ID from redirect header:', detectedAgentId);
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
          console.error(`Polling GET request failed on attempt ${pollingAttempts}: ${pollingError.message}`);
        }
        await delay(3000); // Delay before next polling attempt
      }

      // After polling, check if Agent ID was successfully obtained
      if (!detectedAgentId) {
        const errorMessage = 'Failed to obtain Agent ID after claim polling.';
        console.error(errorMessage);
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
      console.error('No agent ID available for tunnel creation.');
      return { success: false, message: 'Failed to get agent ID after all retries.' };
    }

    try {
      console.log('=== Starting Tunnel Creation Process ===');
      console.log('Using Agent ID for tunnel creation:', detectedAgentId);

      // Implement the new sequence of GET requests based on network analysis
      // 1. Polling Loop: Repeatedly fetch connect URLs until ready
      console.log('Starting polling for agent connection readiness...');
      let connectPollingSuccess = false;
      const maxConnectPollingAttempts = 60; // Poll for max 60 attempts (approx 60 seconds)
      for (let i = 0; i < maxConnectPollingAttempts; i++) {
        console.log(`Connect polling attempt ${i + 1}/${maxConnectPollingAttempts}`);

        // First GET to /setup/connect/:agentId?_data=root
        const connectRootUrl = `https://playit.gg/setup/connect/${detectedAgentId}?_data=root`;
        try {
          const connectRootResp = await fetch(connectRootUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
            'Referer': `https://playit.gg/setup/connect/${detectedAgentId}`
          }) });
          updateCookies(connectRootResp.headers.get('set-cookie'));
          console.log('Connect root GET response status:', connectRootResp.status);
        } catch (error) {
          console.error(`Connect root GET failed: ${error}`);
        }
        // Second GET to /setup/connect/:agentId?_data=routes%2Fsetup%2Fconnect.%24agentId
        const connectRouteUrl = `https://playit.gg/setup/connect/${detectedAgentId}?_data=routes%2Fsetup%2Fconnect.%24agentId`;
        try {
          const connectRouteResp = await fetch(connectRouteUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
            'Referer': `https://playit.gg/setup/connect/${detectedAgentId}`
          }) });
          updateCookies(connectRouteResp.headers.get('set-cookie'));
          console.log('Connect route GET response status:', connectRouteResp.status);

          // Check for 204 status or X-Remix-Redirect header
          if (connectRouteResp.status === 204 || connectRouteResp.headers.has('x-remix-redirect')) {
            console.log('Connect polling successful!');
            connectPollingSuccess = true;
            break; // Exit polling loop
          }

        } catch (error) {
          console.error(`Connect route GET failed: ${error}`);
        }

        await delay(3000); // Delay before next polling attempt
      }

      if (!connectPollingSuccess) {
        const errorMessage = 'Failed to poll for agent connection readiness.';
        console.error(errorMessage);
        // Decide if this should trigger a full retry or just report failure
        // For now, let's just report failure.
        return { success: false, message: errorMessage };
      }

      console.log('Agent connection readiness confirmed.');

      // 2. Tunnel Setup Requests: Fetch tunnel URLs once
      console.log('Fetching tunnel setup data...');

      // First GET to /setup/tunnel/:agentId?_data=root
      const tunnelRootUrl = `https://playit.gg/setup/tunnel/${detectedAgentId}?_data=root`;
      try {
        const tunnelRootResp = await fetch(tunnelRootUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
          'Referer': `https://playit.gg/setup/connect/${detectedAgentId}`
        }) });
        updateCookies(tunnelRootResp.headers.get('set-cookie'));
        console.log('Tunnel root GET response status:', tunnelRootResp.status);
      } catch (error) {
        console.error(`Tunnel root GET failed: ${error}`);
      }

      // Second GET to /setup/tunnel/:agentId?_data=routes%2Fsetup%2Ftunnel.%24agentId
      const tunnelRouteUrl = `https://playit.gg/setup/tunnel/${detectedAgentId}?_data=routes%2Fsetup%2Ftunnel.%24agentId`;
      try {
        const tunnelRouteResp = await fetch(tunnelRouteUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
          'Referer': `https://playit.gg/setup/tunnel/${detectedAgentId}`
        }) });
        updateCookies(tunnelRouteResp.headers.get('set-cookie'));
        console.log('Tunnel route GET response status:', tunnelRouteResp.status);
      } catch (error) {
        console.error(`Tunnel route GET failed: ${error}`);
      }

      // 3. POST to create tunnel (browser-mimic)
      console.log('\nMaking POST request to create tunnel for Agent ID:', detectedAgentId);
      const tunnelPostUrl = `https://playit.gg/account/agents/${detectedAgentId}/tunnels/add?index=&_data=routes%2Faccount%2Fagents%2F%24agentId%2Ftunnels%2Fadd%2Findex`;
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
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
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

      // 4. Extract tunnel ID from X-Remix-Redirect header
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
        // --- New Polling for Tunnel Details ---
        console.log('Starting polling for tunnel details...');
        let tunnelDetailsPollingSuccess = false;
        const maxTunnelPollingAttempts = 60; // Poll for max 60 attempts (approx 60 seconds)
        let assignedDomain: string | undefined = undefined;
        let staticIp4: string | undefined = undefined;
        let portStart: number | undefined = undefined;

        for (let i = 0; i < maxTunnelPollingAttempts; i++) {
          console.log(`Tunnel details polling attempt ${i + 1}/${maxTunnelPollingAttempts}`);

          // First GET to /account/tunnels/:tunnelId?_data=root
          const tunnelRootUrl = `https://playit.gg/account/tunnels/${tunnelId}?_data=root`;
          try {
            const tunnelRootResp = await fetch(tunnelRootUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
              'Referer': `https://playit.gg/account/tunnels/${tunnelId}`
            }) });
            updateCookies(tunnelRootResp.headers.get('set-cookie'));
            console.log('Tunnel details root GET response status:', tunnelRootResp.status);
          } catch (error) {
            console.error(`Tunnel details root GET failed: ${error}`);
          }

          // Second GET to /account/tunnels/:tunnelId?_data=routes%2Faccount
          const tunnelAccountRouteUrl = `https://playit.gg/account/tunnels/${tunnelId}?_data=routes%2Faccount`;
          let tunnelAccountRouteRespJson: any = null;
          try {
            const tunnelAccountRouteResp = await fetch(tunnelAccountRouteUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
              'Referer': `https://playit.gg/account/tunnels/${tunnelId}`
            }) });
            updateCookies(tunnelAccountRouteResp.headers.get('set-cookie'));
            console.log('Tunnel details account route GET response status:', tunnelAccountRouteResp.status);
            if (tunnelAccountRouteResp.ok) {
              try {
                 tunnelAccountRouteRespJson = await tunnelAccountRouteResp.json();
                 console.log('Tunnel details account route GET response body sample:', JSON.stringify(tunnelAccountRouteRespJson, null, 2).substring(0, 500) + '...'); // Log beginning of response
              } catch (jsonError) {
                 console.error('Failed to parse Tunnel details account route response JSON:', jsonError);
              }
            }
          } catch (error) {
            console.error(`Tunnel details account route GET failed: ${error}`);
          }

          // Third GET to /account/tunnels/:tunnelId?_data=routes%2Faccount%2Ftunnels%2F%24tunnelId
          const tunnelDetailsRouteUrl = `https://playit.gg/account/tunnels/${tunnelId}?_data=routes%2Faccount%2Ftunnels%2F%24tunnelId`;
          try {
             // We don't necessarily need the response from this one, just to make the request
            const tunnelDetailsRouteResp = await fetch(tunnelDetailsRouteUrl, { method: 'GET', headers: buildPostAgentIdHeaders({
              'Referer': `https://playit.gg/account/tunnels/${tunnelId}`
            }) });
            updateCookies(tunnelDetailsRouteResp.headers.get('set-cookie')); // Update cookies after the last request
            console.log('Tunnel details route GET response status:', tunnelDetailsRouteResp.status);
          } catch (error) {
            console.error(`Tunnel details route GET failed: ${error}`);
          }

          // Check if the tunnel data is available in the second response and extract details
          if (tunnelAccountRouteRespJson && tunnelAccountRouteRespJson.tunnels && Array.isArray(tunnelAccountRouteRespJson.tunnels.tunnels)) {
            const targetTunnel = tunnelAccountRouteRespJson.tunnels.tunnels.find((t: any) => t.id === tunnelId);
            if (targetTunnel && targetTunnel.alloc && targetTunnel.alloc.data) {
              assignedDomain = targetTunnel.alloc.data.assigned_domain;
              staticIp4 = targetTunnel.alloc.data.static_ip4;
              portStart = targetTunnel.alloc.data.port_start;
              if (assignedDomain && staticIp4 && portStart) {
                console.log('Successfully extracted assigned_domain, static_ip4, and port_start.');
                tunnelDetailsPollingSuccess = true;
                break; // Exit polling loop
              }
            }
          }

          await delay(3000); // Delay before next polling attempt
        }

        if (tunnelDetailsPollingSuccess) {
          finalMessage = `Tunnel created and details retrieved. Agent ID: ${detectedAgentId}, Tunnel ID: ${tunnelId}`;
          if (assignedDomain) finalMessage += `, Domain: ${assignedDomain}`;
          if (staticIp4) finalMessage += `, IPv4: ${staticIp4}`;
          if (portStart) finalMessage += `, Port Start: ${portStart}`;
          console.log('=== Tunnel Details Polling Successful ===');
          console.log(`Assigned Domain: ${assignedDomain}, Static IPv4: ${staticIp4}, Port Start: ${portStart}`);
          return { success: true, message: finalMessage, data: { agentId: detectedAgentId, tunnelId, assignedDomain, staticIp4, portStart } };
        } else {
           console.warn('Tunnel details (assigned_domain/static_ip4) could not be retrieved after polling.');
           finalMessage += ' (Tunnel details polling failed)';
           return { success: true, message: finalMessage, data: { agentId: detectedAgentId, tunnelId } };
        }

      } else {
        console.warn('Tunnel ID could not be extracted from X-Remix-Redirect header.');
        console.log('=== Tunnel Creation Process Completed (No Tunnel ID) ===');
        return { success: true, message: finalMessage + ' (Tunnel ID not found)', data: { agentId: detectedAgentId } };
      }
    } catch (tunnelError: any) {
      console.error('=== Tunnel Creation Process Failed ===');
      console.error('Error during tunnel creation POST or details polling:', tunnelError);
      finalMessage += ' (Tunnel creation or details polling failed)';
      // If agent ID was obtained before the failure, include it.
      return { success: false, message: finalMessage, data: { agentId: detectedAgentId } };
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