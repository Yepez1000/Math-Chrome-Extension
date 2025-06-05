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
  SELECT_SERVER_DIRECTORY: 'select-server-directory',
  START_TUNNEL: 'start-tunnel',
  STOP_TUNNEL: 'stop-tunnel',
  TUNNEL_STATUS: 'tunnel-status',
  TUNNEL_ERROR: 'tunnel-error',
  TUNNEL_ADDRESS: 'tunnel-address',
  CLAIM_LINK: 'claim-link',
  PLAYIT_API_CHAIN: 'playit-api-chain',
  ACCEPT_EULA: 'accept-eula',
  CLIPBOARD_WRITE: 'clipboard-write',
  PREPARE_SERVER_FILES: 'prepare-server-files',
  START_MINECRAFT_SERVER: 'start-minecraft-server',
  GET_DEFAULT_SERVER_DIRECTORY: 'get-default-server-directory',
  SERVER_OUTPUT: 'server-output',
  SERVER_ERROR_OUTPUT: 'server-error-output',
  SERVER_STARTED: 'server-started',
  DETECT_MINECRAFT_INSTALLATION: 'detect-minecraft-installation',
} as const; 

export interface SystemInfo {
  totalRam: number;
  availableRam: number;
  cpuCores: number;
}

export type StatusMessage = {
  message: string
  status: "pending" | "success" | "error"
  id: string // Add unique ID
}

// Interface for the server configuration passed to main process handlers
export interface StartServerConfig {
  serverDirectory: string;
  serverType: "vanilla" | "spigot" | "paper" | "forge" | "fabric" | "bukkit";
  ram: number;
  javaPath?: string | null; // Optional Java path
}

