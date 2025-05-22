import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { DirectorySelectionResponse, WorldImportParams, WorldValidationResponse, IPC_CHANNELS } from '../shared/types'

// Custom APIs for renderer
const { ipcRenderer } = require('electron');

// Define the API interface for better type safety
interface ElectronAPI {
  pickDirectory: () => Promise<DirectorySelectionResponse>;
  importWorld: (params: WorldImportParams) => Promise<WorldValidationResponse>;
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', {
      // Open a native directory picker dialog
      pickDirectory: async (): Promise<DirectorySelectionResponse> => {
        return await ipcRenderer.invoke(IPC_CHANNELS.PICK_DIRECTORY);
      },
      // Import a Minecraft world from a directory
      importWorld: async (params: WorldImportParams): Promise<WorldValidationResponse> => 
        await ipcRenderer.invoke(IPC_CHANNELS.IMPORT_WORLD, params),
    } as ElectronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = {
    pickDirectory: async (): Promise<DirectorySelectionResponse> => {
      return await ipcRenderer.invoke(IPC_CHANNELS.PICK_DIRECTORY);
    },
    importWorld: async (params: WorldImportParams): Promise<WorldValidationResponse> => 
      await ipcRenderer.invoke(IPC_CHANNELS.IMPORT_WORLD, params),
  } as ElectronAPI
}

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
