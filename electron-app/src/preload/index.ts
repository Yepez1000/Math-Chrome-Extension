import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const { ipcRenderer } = require('electron');

const api = {
  /**
   * Opens a secure folder picker for server directory selection.
   * Returns the selected absolute path, or null if cancelled.
   */
  selectServerDirectory: async () => {
    return await ipcRenderer.invoke('select-server-directory');
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
