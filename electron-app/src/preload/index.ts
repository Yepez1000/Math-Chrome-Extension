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
}

// Implement the API with whitelisted IPC calls and other functionalities
const api: ElectronAPI = {
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  writeTempFile: (path: string, data: string | Uint8Array) => {
    // *** IMPORTANT: Sanitize path and validate data here before invoking IPC ***
    // Ensure path is within allowed directories and data is not malicious
    return ipcRenderer.invoke('write-temp-file', path, data)
  },
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
        IPC_CHANNELS.START_TUNNEL,
        IPC_CHANNELS.STOP_TUNNEL,
        'get-temp-dir', // Whitelist get-temp-dir
        'write-temp-file', // Whitelist write-temp-file
        'get-system-info', // Whitelist get-system-info
        // Add other invoke channels as needed
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
        IPC_CHANNELS.TUNNEL_STATUS,
        IPC_CHANNELS.CLAIM_LINK,
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
        IPC_CHANNELS.TUNNEL_STATUS,
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
        IPC_CHANNELS.TUNNEL_STATUS,
        IPC_CHANNELS.CLAIM_LINK,
        // Add other removeAllListeners channels as needed
      ] as const
      if ((validRemoveAllListenersChannels as ReadonlyArray<string>).includes(channel)) {
        ipcRenderer.removeAllListeners(channel)
      }
    },
  },
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
