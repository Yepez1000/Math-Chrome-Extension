import { contextBridge, ipcRenderer } from 'electron'
import { DirectorySelectionResponse, WorldImportParams, WorldValidationResponse, IPC_CHANNELS } from '../shared/types'

// Define the API interface for better type safety
interface ElectronAPI {
  pickDirectory: () => Promise<DirectorySelectionResponse>;
  importWorld: (params: WorldImportParams) => Promise<WorldValidationResponse>;
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => void;
    removeListener: (channel: string, func: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', {
      // Expose whitelisted ipcRenderer methods
      ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => {
          // Whitelist invoke channels
          const validInvokeChannels = [
            IPC_CHANNELS.PICK_DIRECTORY,
            IPC_CHANNELS.IMPORT_WORLD,
            IPC_CHANNELS.START_TUNNEL,
            IPC_CHANNELS.STOP_TUNNEL,
          ] as const;
          if ((validInvokeChannels as ReadonlyArray<string>).includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
          }
          throw new Error(`Unauthorized IPC invoke channel: ${channel}`);
        },
        on: (channel: string, func: (...args: any[]) => void) => {
          // Whitelist on channels
          const validOnChannels = [
            IPC_CHANNELS.TUNNEL_ADDRESS,
            IPC_CHANNELS.TUNNEL_ERROR,
            IPC_CHANNELS.TUNNEL_STATUS,
            IPC_CHANNELS.CLAIM_LINK,
          ] as const;
          if ((validOnChannels as ReadonlyArray<string>).includes(channel)) {
            // Pass the data object received from the main process
            ipcRenderer.on(channel, (_event, data) => func(data));
          }
        },
        removeListener: (channel: string, func: (...args: any[]) => void) => {
          const validRemoveListenerChannels = [
            IPC_CHANNELS.TUNNEL_ADDRESS,
            IPC_CHANNELS.TUNNEL_ERROR,
            IPC_CHANNELS.TUNNEL_STATUS,
            IPC_CHANNELS.CLAIM_LINK,
          ] as const;
          if ((validRemoveListenerChannels as ReadonlyArray<string>).includes(channel)) {
            ipcRenderer.removeListener(channel, func);
          }
        },
        removeAllListeners: (channel: string) => {
          const validRemoveAllListenersChannels = [
            IPC_CHANNELS.TUNNEL_ADDRESS,
            IPC_CHANNELS.TUNNEL_ERROR,
            IPC_CHANNELS.TUNNEL_STATUS,
            IPC_CHANNELS.CLAIM_LINK,
          ] as const;
          if ((validRemoveAllListenersChannels as ReadonlyArray<string>).includes(channel)) {
            ipcRenderer.removeAllListeners(channel);
          }
        },
      },
      // Expose other specific Electron APIs
      pickDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.PICK_DIRECTORY),
      importWorld: (params: WorldImportParams) => ipcRenderer.invoke(IPC_CHANNELS.IMPORT_WORLD, params),
    });
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electronAPI = {
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
      on: (channel: string, func: (...args: any[]) => void) => ipcRenderer.on(channel, (_event, data) => func(data)),
      removeListener: (channel: string, func: (...args: any[]) => void) => ipcRenderer.removeListener(channel, func),
      removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
    },
  };
}

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
