import { create } from "zustand"

export interface Server {
  id: string
  name: string
  status: "online" | "offline" | "starting" | "stopping"
  version: string
  gameMode: "survival" | "creative" | "adventure" | "spectator"
  onlinePlayers: number
  maxPlayers: number
  icon?: string
  lastActive: number // timestamp
}

interface ServersStore {
  servers: Server[]
  addServer: (server: Server) => void
  updateServer: (id: string, updates: Partial<Server>) => void
  deleteServer: (id: string) => void
  toggleServerStatus: (id: string) => void
}

// Sample data for demonstration
const sampleServers: Server[] = [
  {
    id: "server-1",
    name: "Survival World",
    status: "online",
    version: "1.19.2",
    gameMode: "survival",
    onlinePlayers: 3,
    maxPlayers: 20,
    lastActive: Date.now() - 1000 * 60 * 30, // 30 minutes ago
  },
  {
    id: "server-2",
    name: "Creative Building",
    status: "offline",
    version: "1.19.2",
    gameMode: "creative",
    onlinePlayers: 0,
    maxPlayers: 10,
    lastActive: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
  },
  {
    id: "server-3",
    name: "Modded Adventure",
    status: "online",
    version: "1.18.2 (Forge)",
    gameMode: "adventure",
    onlinePlayers: 2,
    maxPlayers: 15,
    lastActive: Date.now() - 1000 * 60 * 10, // 10 minutes ago
  },
]

export const useServersStore = create<ServersStore>((set) => ({
  servers: sampleServers,

  addServer: (server) =>
    set((state) => ({
      servers: [...state.servers, server],
    })),

  updateServer: (id, updates) =>
    set((state) => ({
      servers: state.servers.map((server) => (server.id === id ? { ...server, ...updates } : server)),
    })),

  deleteServer: (id) =>
    set((state) => ({
      servers: state.servers.filter((server) => server.id !== id),
    })),

  toggleServerStatus: (id) =>
    set((state) => ({
      servers: state.servers.map((server) => {
        if (server.id === id) {
          const newStatus = server.status === "online" ? "offline" : "online"
          return {
            ...server,
            status: newStatus,
            lastActive: Date.now(),
            onlinePlayers: newStatus === "offline" ? 0 : server.onlinePlayers,
          }
        }
        return server
      }),
    })),
}))
