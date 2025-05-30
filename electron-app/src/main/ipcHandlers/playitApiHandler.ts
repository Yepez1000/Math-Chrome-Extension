import { IPC_CHANNELS } from '../../shared/types';

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

// Lock mechanism to prevent duplicate API calls
let isProcessing = false;

// New handlePlayitApiChain for Guest Flow
async function handlePlayitApiChain(claimCode: string, serverPort: number): Promise<PlayitApiResponse> {
  if (isProcessing) {
    return {
      success: false,
      message: 'Another setup is already being processed. Please wait.'
    };
  }
  isProcessing = true;
  let guestSessionId: string | null = null; // Declare guestSessionId here
  try {
    console.log('Starting Playit.gg Guest Setup Chain with claim code:', claimCode);

    // Step 1: Fetch initial login page to get session cookie
    console.log('Step 1: Fetching /login to get session cookie...');
    const loginPageResponse = await fetch('https://playit.gg/login', {
      method: 'GET',
      headers: {
        'Host': 'playit.gg',
        'Sec-Ch-Ua': '"Chromium";v="135", "Not-A.Brand";v="8"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Accept-Language': 'en-US,en;q=0.9',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Accept-Encoding': 'gzip, deflate, br',
        'Priority': 'u=0, i',
        'Connection': 'keep-alive'
      },
    });
    console.log('Login page fetch response status:', loginPageResponse.status);

    if (!loginPageResponse.ok) {
      const errorText = await loginPageResponse.text();
      console.error('Login page fetch error response:', errorText);
      throw new Error(`Failed to fetch login page: ${loginPageResponse.statusText} - ${errorText}`);
    }

    // Extract the session cookie
    const setCookieHeader = loginPageResponse.headers.get('Set-Cookie');
    if (setCookieHeader) {
      const sessionCookieMatch = setCookieHeader.match(/__session=([^;]+)/);
      if (sessionCookieMatch && sessionCookieMatch[1]) {
        guestSessionId = sessionCookieMatch[1];
        console.log('Extracted Session ID from login page:', guestSessionId);
      }
    }

    if (!guestSessionId) {
      console.error('Set-Cookie header from login page:', setCookieHeader);
      throw new Error('Failed to extract session cookie from login page response.');
    }

    console.log('Step 1 completed.');
    await delay(1000); // Add a small delay

    // Step 2: Initiate Guest Session (using the obtained session cookie)
    console.log('Step 2: Initiating guest session...');
    const guestInitUrlParams = new URLSearchParams({
      'redirect': `/claim/${claimCode}?`,
      '_data': 'routes%2Flogin.create'
    });

    const guestInitBodyParams = new URLSearchParams({
      'redirect': `/claim/${claimCode}?`,
      '_data': 'routes/login.create',
      'email': '',
      'password': '',
      'confirm-password': '',
      '_action': 'guest'
    });

    const guestInitResponse = await fetch(`https://playit.gg/login/create?${guestInitUrlParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': `https://playit.gg/login/create?redirect=%2Fclaim%2F${claimCode}%3F`,
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://playit.gg',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Cookie': `__session=${guestSessionId}`
      },
      body: guestInitBodyParams.toString()
    });
    console.log('Guest session initiation response status:', guestInitResponse.status);

    if (!guestInitResponse.ok) {
      const errorText = await guestInitResponse.text();
      console.error('Guest session initiation error response:', errorText);
      throw new Error(`Failed to initiate guest session: ${guestInitResponse.statusText} - ${errorText}`);
    }

    // Note: We don't need to re-extract session cookie here, it should be the same or updated by server if needed.
    console.log('Step 2 completed. Proceeding with guest session.');

    // For now, just return success after step 2
    return {
      success: true,
      message: 'Guest session initiated successfully.',
      data: {
        claimCode,
        serverPort,
        sessionId: guestSessionId // Return the session ID obtained from Step 1
      }
    };
  } catch (error: any) {
    // Adjust step number in error message based on which step failed
    const failedStep = !guestSessionId ? 1 : 2;
    return {
      success: false,
      message: `Playit.gg Guest Setup Chain failed at step ${failedStep}: ${error.message}`
    };
  } finally {
    isProcessing = false;
  }
}

export function registerPlayitApiHandlers(ipcMain: any) {
  ipcMain.handle(IPC_CHANNELS.PLAYIT_API_CHAIN, async (_event: any, claimCode: string, serverPort: number) => {
    return handlePlayitApiChain(claimCode, serverPort);
  });
} 