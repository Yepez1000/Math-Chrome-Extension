interface Window {
  electronAPI: {
    getTempDir: () => string;
    writeTempFile: (path: string, data: string) => Promise<void>;
    pickDirectory: () => Promise<string | null>;
    importWorld: (params: WorldImportParams) => Promise<WorldValidationResponse>;
    test: () => string;
  }
} 