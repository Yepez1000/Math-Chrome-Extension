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

// Java version detection response
export interface JavaVersionResponse {
  javaStatus: 'supported' | 'unsupported' | 'error';
  javaVersion: string | null;
  javaPath?: string;
  message: string;
  error?: string;
}

// IPC Channel names as constants to prevent typos and improve maintainability
export enum IPC_CHANNELS {
  PICK_DIRECTORY = 'pick-directory',
  IMPORT_WORLD = 'import-world',
  SERVER_DIRECTORY_SELECT = 'server-directory-select',
  TUNNEL_START = 'tunnel-start',
  TUNNEL_STOP = 'tunnel-stop',
  TUNNEL_STATUS_UPDATE = 'tunnel-status-update',
  TUNNEL_ERROR = 'tunnel-error',
  TUNNEL_ADDRESS = 'tunnel-address',
  CLAIM_LINK = 'claim-link',
  PLAYIT_API_CHAIN = 'playit-api-chain',
  CLIPBOARD_WRITE = 'clipboard-write',
  SERVER_PREPARE_FILES = 'server-prepare-files',
  SERVER_START = 'server-start',
  SERVER_DIRECTORY_DEFAULT = 'server-directory-default',
  SERVER_CONSOLE_OUTPUT = 'server-console-output',
  SERVER_CONSOLE_ERROR = 'server-console-error',
  SERVER_STATUS_UPDATE = 'server-status-update',
  JAVA_DETECT_VERSION = 'java-detect-version',
  //server list handlers
  GET_SERVER_LIST = 'GET_SERVER_LIST',
  ADD_SERVER = 'ADD_SERVER',
  REMOVE_SERVER = 'REMOVE_SERVER',
  JAVA_SELECT_MANUAL = 'java-select-manual',
  RENAME_SERVER = 'rename-server',
  UPDATE_SERVER = 'update-server',
  APP_CLOSING = 'app-closing',
  APP_CLOSING_ACK = 'app-closing-ack',
  START_EXISTING_SERVER = 'start-existing-server',
  STOP_EXISTING_SERVER = 'stop-existing-server',
  SERVER_STOP = 'server-stop',
}

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
  javaPath: string; // Required Java path
}

