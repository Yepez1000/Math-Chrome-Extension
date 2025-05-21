// Response types for world operations
export interface WorldValidationResponse {
  success: boolean;
  message: string;
  worldPath?: string;
}

// Directory selection responses
export type DirectorySelectionResponse = string | null;

// World import parameters
export interface WorldImportParams {
  sourcePath: string;
  worldName: string;
}

// IPC Channel names as constants to prevent typos and improve maintainability
export const IPC_CHANNELS = {
  PICK_DIRECTORY: 'pick-directory',
  IMPORT_WORLD: 'import-world',
  SELECT_SERVER_DIRECTORY: 'select-server-directory'
} as const; 