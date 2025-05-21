interface Window {
  electronAPI: {
    getTempDir: () => string;
    writeTempFile: (path: string, data: string) => Promise<void>;
    pickDirectory: () => Promise<string | null>;
    importWorld: (zipPath: string, worldName: string) => Promise<{ success: boolean; message: string }>;
    test: () => string;
  }
} 