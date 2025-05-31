import { IPC_CHANNELS } from '../../shared/types';
import { getPlayitProcess } from './playitHandlers'; // ✅ Use relative path correctly

let isProcessing = false;

interface PlayitApiResponse {
  success: boolean;
  message: string;
  data?: {
    claimCode: string;
    serverPort: number;
    sessionId?: string;
    agentId?: string;
  };
}

// Add delay between requests to avoid rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

//handlePlayitApiChain for Guest Flow

export async function handlePlayitApiChain(claimCode: string, serverPort: number): Promise<PlayitApiResponse> {
  if (isProcessing) {
    return {
      success: false,
      message: 'Another setup is already being processed. Please wait.'
    };
  }
  isProcessing = true;
  console.log('Attempting guest session initiation flow for claim code:', claimCode);

  // Added back cookie management variables and function
  let currentCookies = '';
  const updateCookies = (setCookieHeader: string | null) => {
    if (!setCookieHeader) return;
    // Basic parsing: split by comma then semicolon, handle key=value
    const cookiesToSet = setCookieHeader.split(',').flatMap(cookiePart => cookiePart.split(';').map(c => c.trim())).filter(c => c.includes('='));
    const currentCookieMap = new Map(currentCookies.split(';').map(c => c.trim()).filter(c => c.includes('=')).map(c => c.split(/=(.*)/s).slice(0, 2) as [string, string]));

    for (const cookie of cookiesToSet) {
        const [key, ...valueParts] = cookie.split('=');
        const value = valueParts.join('=');
        // Only update if it's the actual cookie value part (not expires, path, etc.)
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

  try {
    // Add stdout listener at the beginning
    let programApprovedSeen = false;
    let visitLinkNeeded = false; // New flag
    const process = getPlayitProcess();
    if (process && process.stdout) {
      console.log('Attaching stdout listener at the beginning...');
      const listener = (data: any) => {
        const chunk = data.toString();
        console.log('Raw stdout chunk:', chunk);

        const cleanChunk = chunk
          .replace(/\x1B/g, '')
          .replace(/\[2J/g, '')
          .replace(/\[0m/g, '')
          .replace(/8/g, '')
          .replace(/no command provided, doing auto run/g, '')
          .trim();

        console.log('Cleaned chunk:', cleanChunk);

        if (cleanChunk.includes("Program approved")) {
          console.log('"Program approved" detected in stdout. Stopping polling.');
          programApprovedSeen = true;
          // Consider detaching listener here if appropriate for your process management
        } else if (cleanChunk.includes("Visit link to setup")) { // Check for this specific message
           console.log('"Visit link to setup..." detected in stdout. Signaling need for full retry.');
           visitLinkNeeded = true;
           // Consider detaching listener here
        }
      };
      process.stdout.on('data', listener);
      // Note: The listener is attached. It will remain active until the process exits or it's explicitly removed.
      // Consider if/how to detach the listener if needed later.
    }

    // Step 1: GET initial claim link
    console.log('Visiting initial claim link...');
    const initialClaimUrl = `https://playit.gg/claim/${claimCode}`;
    const initialClaimResponse = await fetch(initialClaimUrl, { method: 'GET', headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9' }) });
    console.log('Initial claim link response status:', initialClaimResponse.status);
    // await delay(1000); // Optional: add a small delay if needed

    // Step 2: GET login/create page
    console.log('Visiting login/create page...');
    const loginCreateUrl = `https://playit.gg/login/create?redirect=%2Fclaim%2F${claimCode}%3F`;
    const loginCreateResponse = await fetch(loginCreateUrl, { method: 'GET', headers: buildHeaders({ 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,gzip,deflate,br;q=0.9' }) });
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

    // Now proceed with the polling GET requests using accumulated cookies
    console.log('Starting polling GET requests using accumulated cookies...');
    const getHeaders = buildHeaders({'Accept': '*/*'}); // General GET headers with latest cookies
    let attempts = 0;
    const maxAttempts = 60; // Poll for max 60 attempts (approx 60 seconds with 1s delay)

    // Poll until "Program approved" is seen, "Visit link to setup" is seen, or max attempts reached
    while (!programApprovedSeen && !visitLinkNeeded && attempts < maxAttempts) {
      attempts++;
      console.log(`Polling attempt ${attempts}/${maxAttempts}...`);

      // Add GET request to /claim/{claimCode}?_data=root
      const claimGetUrl = `https://playit.gg/claim/${claimCode}?_data=root`;
      const claimGetResponse = await fetch(claimGetUrl, {
        method: 'GET',
        headers: getHeaders
      });
      console.log('Claim GET response status:', claimGetResponse.status);

      // Log the response body of the first GET request
       try {
         const claimGetData = await claimGetResponse.json();
         console.log('Claim GET response body:', claimGetData);
       } catch (error) {
         console.error('Error parsing first GET response body:', error);
       }

      // Add GET request to /claim/{claimCode}?_data=routes%2Fclaim%2F%24claimCode (hardcoded)
      const claimRoutesUrl = `https://playit.gg/claim/${claimCode}?_data=routes%2Fclaim%2F%24claimCode`;
      const claimRoutesResponse = await fetch(claimRoutesUrl, {
        method: 'GET',
        headers: getHeaders
      });
      console.log('Claim routes GET response status:', claimRoutesResponse.status);

      // Log the response body of the second GET request (the one expected to be WaitingForAgent)
      try {
          const claimRoutesData = await claimRoutesResponse.json();
          console.log('Claim routes GET response body:', claimRoutesData);
      } catch (error) {
          console.error('Error parsing second GET response body:', error);
      }

      // Add GET request to /claim/{claimCode}?_data=routes%2Fclaim%2F%24claimCode%2Findex (hardcoded)
      const claimRoutesIndexUrl = `https://playit.gg/claim/${claimCode}?_data=routes%2Fclaim%2F%24claimCode%2Findex`;
      const claimRoutesIndexResponse = await fetch(claimRoutesIndexUrl, {
        method: 'GET',
        headers: getHeaders
      });
      console.log('Claim routes index GET response status:', claimRoutesIndexResponse.status);

       // Log the response body of the third GET request
       try {
          const claimRoutesIndexData = await claimRoutesIndexResponse.json();
          console.log('Claim routes index GET response body:', claimRoutesIndexData);
       } catch (error) {
          console.error('Error parsing third GET response body:', error);
      }

      // Wait for 1 second before the next attempt
      if (!programApprovedSeen && !visitLinkNeeded && attempts < maxAttempts) {
         await delay(1000);
      }
    }

    // Check why the polling loop ended
    if (visitLinkNeeded) {
       console.warn('Polling stopped because "Visit link to setup..." was seen. Full retry needed.');
       return {
         success: false,
         message: '"Visit link to setup..." detected in Playit agent stdout. Requires full retry with new process.'
       };
    } else if (!programApprovedSeen) {
      console.warn('Polling finished without seeing "Program approved" after max attempts.');
      return {
        success: false,
        message: 'Timed out waiting for "Program approved" from Playit agent.'
      };
    }

    console.log('"Program approved" seen. Proceeding.');

    return {
      success: true,
      message: 'Guest session initiation flow completed (using cookie management).',
      data: {
        claimCode,
        serverPort,
        sessionId: 'unknown' // We\'re not sure about the session ID in this simplified approach
      }
    };

  } catch (error: any) {
    console.error('Guest session initiation flow failed:', error);
    return {
      success: false,
      message: `Guest session initiation flow failed: ${error.message}`
    };
  } finally {
    // Attach stdout listener at the end, always
    const process = getPlayitProcess();
    if (process && process.stdout) {
      console.log('Attaching stdout listener at the end...');
      process.stdout.on('data', (data) => {
        const chunk = data.toString();
        console.log('Raw stdout chunk:', chunk);

        const cleanChunk = chunk
          .replace(/\x1B/g, '')
          .replace(/\[2J/g, '')
          .replace(/\[0m/g, '')
          .replace(/8/g, '')
          .replace(/no command provided, doing auto run/g, '')
          .trim();

        console.log('Cleaned chunk:', cleanChunk);
      });
    }
    isProcessing = false;
  }
}

export function registerPlayitApiHandlers(ipcMain: any) {
  ipcMain.handle(IPC_CHANNELS.PLAYIT_API_CHAIN, async (_event: any, claimCode: string, serverPort: number) => {
    return handlePlayitApiChain(claimCode, serverPort);
  });
} 