import { contextBridge, ipcRenderer } from 'electron'
import { WorldImportParams } from '../shared/types'

// Custom APIs for renderer
const api = {
  getTempDir: () => ipcRenderer.invoke('get-temp-dir') as Promise<string>,
  writeTempFile: (path: string, data: string) => ipcRenderer.invoke('write-temp-file', path, data) as Promise<void>,
  pickDirectory: () => ipcRenderer.invoke('pick-directory') as Promise<string | null>,
  importWorld: (params: WorldImportParams) => ipcRenderer.invoke('import-world', params),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  test: () => 'test'
} as const

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
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
    electronAPI: typeof api;
  }
}
