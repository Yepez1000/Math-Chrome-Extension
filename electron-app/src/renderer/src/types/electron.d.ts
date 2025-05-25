interface Window {
  electronAPI: {
    getTempDir: () => string;
    writeTempFile: (path: string, data: string) => Promise<void>;
    pickDirectory: () => Promise<string | null>;
    importWorld: (params: WorldImportParams) => Promise<WorldValidationResponse>;
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, func: (...args: any[]) => void) => void;
      removeListener: (channel: string, func: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
    test: () => string;
  }
} 