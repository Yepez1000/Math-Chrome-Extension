import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const { ipcRenderer } = require('electron');

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', {
      // Open a native directory picker dialog
      pickDirectory: async () => {
        return await ipcRenderer.invoke('pick-directory');
      },
      // Import a Minecraft world from a directory or zip file
      importWorld: (zipPath: string, worldName: string) => 
        ipcRenderer.invoke('import-world', zipPath, worldName),
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = {
    pickDirectory: async () => {
      return await ipcRenderer.invoke('pick-directory');
    },
    importWorld: (zipPath: string, worldName: string) => 
      ipcRenderer.invoke('import-world', zipPath, worldName),
  }
}
