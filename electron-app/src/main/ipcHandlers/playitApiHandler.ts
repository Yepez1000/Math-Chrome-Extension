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
  console.log('Attempting guest session initiation for claim code:', claimCode);
  try {
    const guestInitUrl = `https://playit.gg/login/create?redirect=/claim/${claimCode}?&_data=routes/login.create`;

    const guestInitBodyParams = new URLSearchParams({
      'redirect': `/claim/${claimCode}?`,
      '_data': 'routes/login.create',
      'email': '',
      'password': '',
      'confirm-password': '',
      '_action': 'guest'
    });

    const guestInitResponse = await fetch(guestInitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'easycraft-host/1.0' // Use a simple, descriptive User-Agent
      },
      body: guestInitBodyParams.toString()
    });

    console.log('Guest session initiation response status:', guestInitResponse.status);

    if (!guestInitResponse.ok) {
      const errorText = await guestInitResponse.text();
      console.error('Guest session initiation error response:', errorText);
      throw new Error(`Guest session initiation failed: ${guestInitResponse.statusText} - ${errorText}`);
    }

    // If successful, assume a session is established, though we don't have the session ID
    return {
      success: true,
      message: 'Guest session initiated successfully.',
      data: {
        claimCode,
        serverPort,
        sessionId: 'unknown' // We don't have the session ID in this simplified approach
      }
    };

  } catch (error: any) {
    console.error('Guest session initiation failed:', error);
    return {
      success: false,
      message: `Guest session initiation failed: ${error.message}`
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