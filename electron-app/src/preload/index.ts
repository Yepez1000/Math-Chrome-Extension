import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import fs from 'fs/promises';
import os from 'os';

// Custom APIs for renderer
const { ipcRenderer } = require('electron');

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', {
      // Get the system's temporary directory
      getTempDir: () => os.tmpdir(),
      // Write data to a file in the temp directory
      writeTempFile: (path: string, data: string) => fs.writeFile(path, data),
      // Open a native directory picker dialog
      pickDirectory: async () => {
        return await ipcRenderer.invoke('pick-directory');
      },
      // Import a Minecraft world from a directory or zip file
      importWorld: (zipPath: string, worldName: string) => 
        ipcRenderer.invoke('import-world', zipPath, worldName),
      test: () => 'test successful'
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = {
    getTempDir: () => os.tmpdir(),
    writeTempFile: (path: string, data: string) => fs.writeFile(path, data),
    pickDirectory: async () => {
      return await ipcRenderer.invoke('pick-directory');
    },
    importWorld: (zipPath: string, worldName: string) => 
      ipcRenderer.invoke('import-world', zipPath, worldName),
    test: () => 'test successful'
  }
}
