import { WorldImportParams, WorldValidationResponse, SystemInfo } from '../shared/types'

// Define the shape of our preload API
export interface ElectronAPI {
  getTempDir: () => Promise<string>;
  writeTempFile: (path: string, data: string) => Promise<void>;
  pickDirectory: () => Promise<string | null>;
  importWorld: (params: WorldImportParams) => Promise<WorldValidationResponse>;
  getSystemInfo: () => Promise<SystemInfo>;
  test: () => string;
}

// Extend the Window interface
declare global {
  interface Window {
    electronAPI: {
      getTempDir: () => Promise<string>;
      writeTempFile: (path: string, data: string) => Promise<void>;
      pickDirectory: () => Promise<string | null>;
      importWorld: (params: WorldImportParams) => Promise<WorldValidationResponse>;
      getSystemInfo: () => Promise<SystemInfo>;
      test: () => string;
    }
  }
}
