import { create } from "zustand";
import { IPC_CHANNELS } from "@shared/types";

export type Server = {
  id: string;
  name: string;
  status: "online" | "offline";
  version: string;
  onlinePlayers: number;
  maxPlayers: number;
  lastActive: number;
  serverPath: string;
  playitDomain: string;
  icon?: string;
  gameMode: "survival" | "creative" | "adventure" | "spectator";
};

type ServerListState = {
  servers: Server[];
  refresh: () => Promise<void>;
  addServer: (server: Server) => Promise<void>;
  removeServer: (serverPath: string) => Promise<void>;
  toggleServerStatus: (serverId: string) => void;
  deleteServer: (serverId: string) => void;
};

const DEFAULT_ICON = "/placeholder.svg?height=40&width=40";

export const useServerListStore = create<ServerListState>((set, get) => ({
  servers: [],
  refresh: async () => {
    const list = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.GET_SERVER_LIST);
    set({ servers: list });
  },
  addServer: async (server) => {
    const serverWithDefaults = {
      ...server,
      maxPlayers: 20,
      icon: DEFAULT_ICON,
      gameMode: "survival",
    };
    const list = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.ADD_SERVER, serverWithDefaults);
    set({ servers: list });
  },
  removeServer: async (serverPath) => {
    const list = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.REMOVE_SERVER, serverPath);
    set({ servers: list });
  },
  toggleServerStatus: (serverId) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, status: s.status === "online" ? "offline" : "online" } : s
      ),
    }));
  },
  deleteServer: (serverId) => {
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== serverId),
    }));
  },
})); 