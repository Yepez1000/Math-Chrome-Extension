import { contextBridge, ipcRenderer } from 'electron'
import { DirectorySelectionResponse, WorldImportParams, WorldValidationResponse, IPC_CHANNELS } from '../shared/types'

// Define the API interface for better type safety
interface ElectronAPI {
  pickDirectory: () => Promise<DirectorySelectionResponse>
  importWorld: (params: WorldImportParams) => Promise<WorldValidationResponse>
  getSystemInfo: () => Promise<any>
  test: () => string

  // Expose whitelisted ipcRenderer methods
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>
    on: (channel: string, func: (...args: any[]) => void) => void
    removeListener: (channel: string, func: (...args: any[]) => void) => void
    removeAllListeners: (channel: string) => void
  }

  // Add clipboard functionality
  clipboard: {
    writeText: (text: string) => void
  }
}

// Implement the API with whitelisted IPC calls and other functionalities
const api: ElectronAPI = {
  pickDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.PICK_DIRECTORY),
  importWorld: (params: WorldImportParams) => {
    // *** IMPORTANT: Sanitize and validate params here before invoking IPC ***
    // Validate worldPath, worldName, etc.
    return ipcRenderer.invoke(IPC_CHANNELS.IMPORT_WORLD, params)
  },
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'), // Need to ensure 'get-system-info' is handled in main
  test: () => 'test', // This seems like a simple string return, not an IPC call based on original code

  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => {
      // Whitelist invoke channels
      const validInvokeChannels = [
        IPC_CHANNELS.PICK_DIRECTORY,
        IPC_CHANNELS.IMPORT_WORLD,
        IPC_CHANNELS.TUNNEL_START,
        IPC_CHANNELS.TUNNEL_STOP,
        IPC_CHANNELS.PLAYIT_API_CHAIN,
        'get-system-info',
        // Whitelist clipboard write channel
        IPC_CHANNELS.CLIPBOARD_WRITE,
        // Whitelist channel for getting default server directory
        IPC_CHANNELS.SERVER_DIRECTORY_DEFAULT,
        // Whitelist channel for preparing server files
        IPC_CHANNELS.SERVER_PREPARE_FILES,
        // Whitelist channel for starting the Minecraft server
        IPC_CHANNELS.SERVER_START,
        // Whitelist channel for detecting Java version
        IPC_CHANNELS.JAVA_DETECT_VERSION,
      ] as const
      if ((validInvokeChannels as ReadonlyArray<string>).includes(channel)) {
        return ipcRenderer.invoke(channel, ...args)
      }
      throw new Error(`Unauthorized IPC invoke channel: ${channel}`)
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      // Whitelist on channels
      const validOnChannels = [
        IPC_CHANNELS.TUNNEL_ADDRESS,
        IPC_CHANNELS.TUNNEL_ERROR,
        IPC_CHANNELS.TUNNEL_STATUS_UPDATE,
        IPC_CHANNELS.CLAIM_LINK,
        // Add channels for server console output
        IPC_CHANNELS.SERVER_CONSOLE_OUTPUT,
        IPC_CHANNELS.SERVER_CONSOLE_ERROR,
        // Add channel for server started event
        IPC_CHANNELS.SERVER_STATUS_UPDATE,
        // Add other on channels as needed
      ] as const
      if ((validOnChannels as ReadonlyArray<string>).includes(channel)) {
        // Pass the data object received from the main process
        ipcRenderer.on(channel, (_event, data) => func(data))
      }
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      const validRemoveListenerChannels = [
        IPC_CHANNELS.TUNNEL_ADDRESS,
        IPC_CHANNELS.TUNNEL_ERROR,
        IPC_CHANNELS.TUNNEL_STATUS_UPDATE,
        IPC_CHANNELS.CLAIM_LINK,
        // Add other removeListener channels as needed
      ] as const
      if ((validRemoveListenerChannels as ReadonlyArray<string>).includes(channel)) {
        ipcRenderer.removeListener(channel, func)
      }
    },
    removeAllListeners: (channel: string) => {
      const validRemoveAllListenersChannels = [
        IPC_CHANNELS.TUNNEL_ADDRESS,
        IPC_CHANNELS.TUNNEL_ERROR,
        IPC_CHANNELS.TUNNEL_STATUS_UPDATE,
        IPC_CHANNELS.CLAIM_LINK,
        // Add other removeAllListeners channels as needed
      ] as const
      if ((validRemoveAllListenersChannels as ReadonlyArray<string>).includes(channel)) {
        ipcRenderer.removeAllListeners(channel)
      }
    },
  },

  // Implement clipboard functionality using IPC invoke
  clipboard: {
    writeText: (text: string) => {
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_WRITE, text);
    }
  }
}

// Use `contextBridge` APIs to expose the API to the renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electronAPI = api
}

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
