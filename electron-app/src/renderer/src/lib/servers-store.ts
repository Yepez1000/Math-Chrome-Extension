import { create } from "zustand";
import { IPC_CHANNELS } from "@shared/types";

export type ServerStatus = "online" | "offline" | "starting" | "stopping";
export type GameMode = "survival" | "creative" | "adventure" | "spectator";
export type ServerType = "vanilla" | "spigot" | "paper" | "forge" | "fabric" | "bukkit";

export interface Server {
  id: string;
  name: string;
  status: ServerStatus;
  version: string;
  onlinePlayers: number;
  maxPlayers: number;
  lastActive: number; // timestamp
  serverPath: string;
  playitDomain?: string;
  gameMode: GameMode;
  serverType: ServerType;
  icon?: string;
}

interface ServerListState {
  servers: Server[];
  selectedServerId: string | null;
  refresh: () => Promise<void>;
  addServer: (server: Omit<Server, "id" | "lastActive"> & { id?: string }) => Promise<void>;
  //updateServer: (id: string, updates: Partial<Server>) => Promise<void>;
  removeServer: (serverId: string) => Promise<void>;
  renameServer: (serverId: string, newName: string) => Promise<void>;
  toggleServerStatus: (serverId: string) => void;
  selectServer: (serverId: string | null) => void;
}

const DEFAULT_ICON = "/placeholder.svg?height=40&width=40";

export const useServerListStore = create<ServerListState>((set, get) => ({
  servers: [],
  selectedServerId: null,

  refresh: async () => {
    const list = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.GET_SERVER_LIST);
    set({ servers: list });
  },

  addServer: async (server) => {
    const serverWithDefaults: Server = {
      ...server,
      id: server.id || Date.now().toString(),
      lastActive: Date.now(),
      maxPlayers: server.maxPlayers || 20,
      gameMode: server.gameMode || "survival",
      serverType: server.serverType || "vanilla",
      icon: server.icon || DEFAULT_ICON,
      status: "offline",
      onlinePlayers: 0,
    };
    const updatedList = await window.electronAPI.ipcRenderer.invoke(
      IPC_CHANNELS.ADD_SERVER,
      serverWithDefaults
    );
    set({ servers: updatedList });
  },

  /*updateServer: async (id, updates) => {
    const updatedList = await window.electronAPI.ipcRenderer.invoke(
      IPC_CHANNELS.UPDATE_SERVER,
      { id, updates }
    );
    set({ servers: updatedList });
  },*/

  removeServer: async (serverId) => {
    const updatedList = await window.electronAPI.ipcRenderer.invoke(
      IPC_CHANNELS.REMOVE_SERVER,
      serverId
    );
    set({ servers: updatedList });
  },

  renameServer: async (serverId, newName) => {
    const updatedList = await window.electronAPI.ipcRenderer.invoke(
      IPC_CHANNELS.RENAME_SERVER,
      { serverId, newName }
    );
    set({ servers: updatedList });
  },

  toggleServerStatus: (serverId) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId
          ? {
              ...s,
              status: s.status === "online" ? "offline" : "online",
              lastActive: Date.now(),
              onlinePlayers: s.status === "online" ? 0 : s.onlinePlayers,
            }
          : s
      ),
    }));
  },

  selectServer: (serverId) => set({ selectedServerId: serverId }),
}));
