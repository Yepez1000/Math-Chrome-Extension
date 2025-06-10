import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"
import type { LucideIcon } from "lucide-react"
import type { Server } from "./servers-store"

export type TunnelStatus = "idle" | "starting" | "running" | "error" | "stopping"
export type TunnelState = {
  status: TunnelStatus
  address: string | null
  error: string | null
  port: number
}

export type ServerStatus = "online" | "offline" | "starting" | "stopping"

export type PlayerData = {
  id: string
  name: string
  uuid?: string
  lastSeen?: string
  isOnline?: boolean
  isOp?: boolean
  isWhitelisted?: boolean
  isBanned?: boolean
}

// Add the missing PlayerAction type
export type PlayerAction = {
  id: string
  label: string
  description: string
  icon?: LucideIcon
  className?: string
  requiresConfirmation?: boolean
  requiresInput?: boolean
  inputLabel?: string
  inputPlaceholder?: string
  requiresOnline?: boolean
  requiresOffline?: boolean
  handler: (playerId: string, input?: string) => Promise<void>
}

export type ServerProperty = {
  key: string
  label: string
  type: "text" | "number" | "checkbox" | "select"
  value: string | number | boolean
  options?: string[]
  min?: number
  max?: number
  tooltip: string
  category: "gameplay" | "world" | "security" | "performance"
}

export type BackupFrequency = "hourly" | "every6hours" | "daily" | "weekly"

export type BackupData = {
  id: string
  name: string
  timestamp: string
  size: string
  type: "manual" | "auto"
  path: string
}

// New type for scheduled tasks
export type ScheduledTask = {
  id: string
  name: string
  commands: string
  time: string
  repeat: boolean
  enabled: boolean
  lastRun?: string
  nextRun?: string
}

interface ServerState {
  // Server info
  serverName: string
  status: ServerStatus
  version: string
  address: string
  serverPath: string

  // Performance metrics
  cpu: number
  ram: number
  uptime: number

  // Player info
  maxPlayers: number
  onlinePlayers: number
  players: PlayerData[]

  // Server properties
  serverProperties: ServerProperty[]

  // Backup settings
  backups: BackupData[]
  isBackingUp: boolean
  autoBackupEnabled: boolean
  backupFrequency: BackupFrequency
  maxBackupsToKeep: number

  // Scheduled tasks
  scheduledTasks: ScheduledTask[]

  // Tunnel state
  tunnel: TunnelState

  // Actions
  setServerName: (name: string) => void
  setStatus: (status: ServerStatus) => void
  updateServerProperty: (key: string, value: string | number | boolean) => void
  addPlayer: (player: PlayerData) => void
  removePlayer: (playerId: string) => void
  updatePlayer: (playerId: string, updates: Partial<PlayerData>) => void
  updatePerformance: (cpu: number, ram: number, uptime?: number) => void

  // Tunnel actions
  setTunnelStatus: (status: TunnelStatus) => void
  setTunnelAddress: (address: string | null) => void
  setTunnelError: (error: string | null) => void
  setTunnelPort: (port: number) => void

  // Backup actions
  createBackup: () => Promise<void>
  deleteBackup: (backupId: string) => Promise<void>
  restoreBackup: (backupId: string) => Promise<void>
  setAutoBackupEnabled: (enabled: boolean) => void
  setBackupFrequency: (frequency: BackupFrequency) => void
  setMaxBackupsToKeep: (count: number) => void

  // Scheduled task actions
  addScheduledTask: (task: Omit<ScheduledTask, "id">) => void
  updateScheduledTask: (id: string, updates: Partial<ScheduledTask>) => void
  deleteScheduledTask: (id: string) => void
  toggleTaskEnabled: (id: string) => void

  setServerDetails: (server: Server) => void
}

// Mock initial player data
const initialPlayers: PlayerData[] = [
  { id: "1", name: "jamoír", lastSeen: "Now", isOnline: true, isOp: true, isWhitelisted: true },
  { id: "2", name: "Daleth", lastSeen: "Now", isOnline: true, isWhitelisted: true },
  { id: "3", name: "RockDigger", lastSeen: "Now", isOnline: true, isWhitelisted: true },
  { id: "4", name: "spicesw", lastSeen: "Now", isOnline: true, isWhitelisted: true },
  { id: "5", name: "Thoughts3rased", lastSeen: "Now", isOnline: true, isWhitelisted: true },
  { id: "6", name: "filliravaz", lastSeen: "Now", isOnline: true, isWhitelisted: true },
  { id: "7", name: "AlxTray", lastSeen: "Now", isOnline: true, isWhitelisted: true },
  { id: "8", name: "Leonito", lastSeen: "Now", isOnline: true, isWhitelisted: true },
  { id: "9", name: "Felux137", lastSeen: "Now", isOnline: true, isWhitelisted: true },
  { id: "10", name: "MineQueen", lastSeen: "2 days ago", isOnline: false, isWhitelisted: true },
  { id: "11", name: "CraftKing", lastSeen: "5 days ago", isOnline: false, isOp: true, isWhitelisted: true },
  { id: "12", name: "DiamondHunter", lastSeen: "1 week ago", isOnline: false, isWhitelisted: true },
  { id: "13", name: "GrieferX", lastSeen: "3 days ago", isOnline: false, isBanned: true },
  { id: "14", name: "HackerBoy", lastSeen: "1 month ago", isOnline: false, isBanned: true },
]

// Mock initial server properties
const initialServerProperties: ServerProperty[] = [
  {
    key: "server-name",
    label: "Server Name",
    type: "text",
    value: "My Purpur Server",
    tooltip: "The name of your Minecraft server",
    category: "gameplay",
  },
  {
    key: "gamemode",
    label: "Game Mode",
    type: "select",
    value: "survival",
    options: ["survival", "creative", "adventure", "spectator"],
    tooltip: "The default game mode for new players joining the server",
    category: "gameplay",
  },
  {
    key: "difficulty",
    label: "Difficulty",
    type: "select",
    value: "normal",
    options: ["peaceful", "easy", "normal", "hard"],
    tooltip: "The difficulty level of the server, affecting mob damage and hunger",
    category: "gameplay",
  },
  {
    key: "level-seed",
    label: "World Seed",
    type: "text",
    value: "",
    tooltip: "The seed used to generate the world (leave blank for random)",
    category: "world",
  },
  {
    key: "motd",
    label: "Server Message (MOTD)",
    type: "text",
    value: "A Minecraft Server",
    tooltip: "The message displayed in the server list",
    category: "gameplay",
  },
  {
    key: "max-players",
    label: "Max Players",
    type: "number",
    value: 20,
    min: 1,
    max: 100,
    tooltip: "The maximum number of players allowed on the server",
    category: "performance",
  },
  {
    key: "view-distance",
    label: "View Distance",
    type: "number",
    value: 10,
    min: 2,
    max: 16,
    tooltip: "The number of chunks sent to players (affects visibility distance)",
    category: "performance",
  },
  {
    key: "simulation-distance",
    label: "Simulation Distance",
    type: "number",
    value: 10,
    min: 2,
    max: 16,
    tooltip: "The distance at which game mechanics are processed (mobs, crops, etc.)",
    category: "performance",
  },
  {
    key: "spawn-protection",
    label: "Spawn Protection Radius",
    type: "number",
    value: 16,
    min: 0,
    max: 64,
    tooltip: "The radius around spawn where only operators can build (0 to disable)",
    category: "security",
  },
  {
    key: "pvp",
    label: "Enable PVP",
    type: "checkbox",
    value: true,
    tooltip: "Allow players to damage each other",
    category: "gameplay",
  },
  {
    key: "allow-flight",
    label: "Allow Flying",
    type: "checkbox",
    value: false,
    tooltip: "Allow players to use flight in survival mode (may enable cheating)",
    category: "gameplay",
  },
  {
    key: "enable-command-block",
    label: "Enable Command Blocks",
    type: "checkbox",
    value: false,
    tooltip: "Allow the use of command blocks on the server",
    category: "gameplay",
  },
  {
    key: "white-list",
    label: "Enable Whitelist",
    type: "checkbox",
    value: false,
    tooltip: "Only allow players on the whitelist to join",
    category: "security",
  },
  {
    key: "enforce-whitelist",
    label: "Enforce Whitelist",
    type: "checkbox",
    value: false,
    tooltip: "Kick players who aren't on the whitelist when it's enabled",
    category: "security",
  },
  {
    key: "online-mode",
    label: "Online Mode (Require Login)",
    type: "checkbox",
    value: true,
    tooltip: "Verify player identities with Minecraft account servers",
    category: "security",
  },
  {
    key: "hardcore",
    label: "Hardcore Mode",
    type: "checkbox",
    value: false,
    tooltip: "Players are banned upon death (world is set to hard difficulty)",
    category: "gameplay",
  },
  {
    key: "generate-structures",
    label: "Generate Structures",
    type: "checkbox",
    value: true,
    tooltip: "Generate villages, strongholds, and other structures",
    category: "world",
  },
  {
    key: "level-type",
    label: "World Type",
    type: "select",
    value: "default",
    options: ["default", "flat", "largebiomes", "amplified"],
    tooltip: "The type of world to generate",
    category: "world",
  },
]

// Mock initial backups
const initialBackups: BackupData[] = [
  {
    id: "1",
    name: "backup-2025-04-25_19-30.zip",
    timestamp: "2025-04-25 19:30:00",
    size: "240 MB",
    type: "manual",
    path: "/backups/backup-2025-04-25_19-30.zip",
  },
  {
    id: "2",
    name: "backup-2025-04-24_12-00.zip",
    timestamp: "2025-04-24 12:00:00",
    size: "238 MB",
    type: "auto",
    path: "/backups/backup-2025-04-24_12-00.zip",
  },
  {
    id: "3",
    name: "backup-2025-04-23_12-00.zip",
    timestamp: "2025-04-23 12:00:00",
    size: "235 MB",
    type: "auto",
    path: "/backups/backup-2025-04-23_12-00.zip",
  },
]

// Mock initial scheduled tasks
const initialScheduledTasks: ScheduledTask[] = [
  {
    id: "1",
    name: "Daily Restart",
    commands: "/say Server will restart in 5 minutes!; /save-all; /stop",
    time: "04:00:00",
    repeat: true,
    enabled: true,
    lastRun: "2025-04-25 04:00:00",
    nextRun: "2025-04-26 04:00:00",
  },
  {
    id: "2",
    name: "Welcome Message",
    commands: "/say Welcome to the server! Remember to follow the rules!",
    time: "12:00:00",
    repeat: true,
    enabled: true,
    lastRun: "2025-04-25 12:00:00",
    nextRun: "2025-04-26 12:00:00",
  },
  {
    id: "3",
    name: "Special Event",
    commands: "/say Special event starting now!; /give @a diamond 5",
    time: "18:00:00",
    repeat: false,
    enabled: false,
    nextRun: "2025-04-30 18:00:00",
  },
]

export const useServerStore = create<ServerState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        serverName: "My Purpur Server",
        status: "online",
        version: "Purpur 1.19",
        address: "88.77.66.55:25565",
        serverPath: "C:\\MinecraftServers\\MyServer",

        cpu: 6,
        ram: 2326,
        uptime: 37,

        maxPlayers: 20,
        onlinePlayers: 9,
        players: initialPlayers,

        serverProperties: initialServerProperties,

        // Backup state
        backups: initialBackups,
        isBackingUp: false,
        autoBackupEnabled: true,
        backupFrequency: "daily",
        maxBackupsToKeep: 5,

        // Scheduled tasks
        scheduledTasks: initialScheduledTasks,

        // Tunnel state
        tunnel: {
          status: "idle",
          address: null,
          error: null,
          port: 25565
        },

        // Actions
        setServerName: (name) => set({ serverName: name }),

        setStatus: (status) => set({ status }),

        updateServerProperty: (key, value) =>
          set((state) => {
            // Special case for server name
            if (key === "server-name") {
              return {
                serverName: value as string,
                serverProperties: state.serverProperties.map((prop) => (prop.key === key ? { ...prop, value } : prop)),
              }
            }

            // Special case for max players
            if (key === "max-players") {
              return {
                maxPlayers: value as number,
                serverProperties: state.serverProperties.map((prop) => (prop.key === key ? { ...prop, value } : prop)),
              }
            }

            return {
              serverProperties: state.serverProperties.map((prop) => (prop.key === key ? { ...prop, value } : prop)),
            }
          }),

        addPlayer: (player) =>
          set((state) => ({
            players: [...state.players, player],
            onlinePlayers: player.isOnline ? state.onlinePlayers + 1 : state.onlinePlayers,
          })),

        removePlayer: (playerId) =>
          set((state) => {
            const player = state.players.find((p) => p.id === playerId)
            return {
              players: state.players.filter((p) => p.id !== playerId),
              onlinePlayers: player?.isOnline ? state.onlinePlayers - 1 : state.onlinePlayers,
            }
          }),

        updatePlayer: (playerId, updates) =>
          set((state) => {
            // Check if online status is changing
            const player = state.players.find((p) => p.id === playerId)
            const onlineStatusChanged = player && updates.isOnline !== undefined && player.isOnline !== updates.isOnline

            return {
              players: state.players.map((p) => (p.id === playerId ? { ...p, ...updates } : p)),
              onlinePlayers: onlineStatusChanged
                ? updates.isOnline
                  ? state.onlinePlayers + 1
                  : state.onlinePlayers - 1
                : state.onlinePlayers,
            }
          }),

        updatePerformance: (cpu, ram, uptime) =>
          set((state) => ({
            cpu,
            ram,
            uptime: uptime !== undefined ? uptime : state.uptime + 1,
          })),

        // Tunnel actions
        setTunnelStatus: (status) => set((state) => ({
          tunnel: { ...state.tunnel, status }
        })),

        setTunnelAddress: (address) => set((state) => ({
          tunnel: { ...state.tunnel, address }
        })),

        setTunnelError: (error) => set((state) => ({
          tunnel: { ...state.tunnel, error }
        })),

        setTunnelPort: (port) => set((state) => ({
          tunnel: { ...state.tunnel, port }
        })),

        // Backup actions
        createBackup: async () => {
          set({ isBackingUp: true })

          try {
            // In a real app, this would use IPC to create a backup
            // await window.electronAPI.createBackup()

            // Simulate backup creation
            await new Promise((resolve) => setTimeout(resolve, 2000))

            // Generate a new backup entry
            const now = new Date()
            const formattedDate = now.toISOString().replace(/T/, "_").replace(/\..+/, "").replace(/:/g, "-")
            const backupName = `backup-${formattedDate}.zip`

            // Random size between 230-250 MB
            const size = `${Math.floor(230 + Math.random() * 20)} MB`

            const newBackup: BackupData = {
              id: `backup-${Date.now()}`,
              name: backupName,
              timestamp: now.toLocaleString(),
              size,
              type: "manual",
              path: `/backups/${backupName}`,
            }

            set((state) => ({
              backups: [newBackup, ...state.backups],
              isBackingUp: false,
            }))

            return Promise.resolve()
          } catch (error) {
            set({ isBackingUp: false })
            return Promise.reject(error)
          }
        },

        deleteBackup: async (backupId) => {
          try {
            // In a real app, this would use IPC to delete the backup file
            // await window.electronAPI.deleteBackup(backupId)

            // Simulate deletion
            await new Promise((resolve) => setTimeout(resolve, 500))

            set((state) => ({
              backups: state.backups.filter((backup) => backup.id !== backupId),
            }))

            return Promise.resolve()
          } catch (error) {
            return Promise.reject(error)
          }
        },

        restoreBackup: async (backupId) => {
          try {
            const backup = get().backups.find((b) => b.id === backupId)
            if (!backup) {
              throw new Error("Backup not found")
            }

            // In a real app, this would use IPC to restore the backup
            // await window.electronAPI.restoreBackup(backup.path)

            // Simulate restoration
            await new Promise((resolve) => setTimeout(resolve, 3000))

            return Promise.resolve()
          } catch (error) {
            return Promise.reject(error)
          }
        },

        setAutoBackupEnabled: (enabled) => set({ autoBackupEnabled: enabled }),

        setBackupFrequency: (frequency) => set({ backupFrequency: frequency }),

        setMaxBackupsToKeep: (count) => set({ maxBackupsToKeep: count }),

        // Scheduled task actions
        addScheduledTask: (task) => {
          const id = `task-${Date.now()}`
          const now = new Date()

          // Calculate next run time
          const [hours, minutes, seconds] = task.time.split(":").map(Number)
          const nextRun = new Date(now)
          nextRun.setHours(hours, minutes, seconds, 0)

          // If the time has already passed today, set it for tomorrow
          if (nextRun < now) {
            nextRun.setDate(nextRun.getDate() + 1)
          }

          const nextRunStr = nextRun.toLocaleString()

          set((state) => ({
            scheduledTasks: [
              ...state.scheduledTasks,
              {
                ...task,
                id,
                nextRun: nextRunStr,
              },
            ],
          }))
        },

        updateScheduledTask: (id, updates) => {
          set((state) => {
            const task = state.scheduledTasks.find((t) => t.id === id)
            if (!task) return state

            // If time is updated, recalculate next run
            let nextRun = task.nextRun
            if (updates.time) {
              const now = new Date()
              const [hours, minutes, seconds] = updates.time.split(":").map(Number)
              const nextRunDate = new Date(now)
              nextRunDate.setHours(hours, minutes, seconds, 0)

              // If the time has already passed today, set it for tomorrow
              if (nextRunDate < now) {
                nextRunDate.setDate(nextRunDate.getDate() + 1)
              }

              nextRun = nextRunDate.toLocaleString()
            }

            return {
              scheduledTasks: state.scheduledTasks.map((t) =>
                t.id === id ? { ...t, ...updates, nextRun: updates.time ? nextRun : t.nextRun } : t,
              ),
            }
          })
        },

        deleteScheduledTask: (id) => {
          set((state) => ({
            scheduledTasks: state.scheduledTasks.filter((task) => task.id !== id),
          }))
        },

        toggleTaskEnabled: (id) => {
          set((state) => ({
            scheduledTasks: state.scheduledTasks.map((task) =>
              task.id === id ? { ...task, enabled: !task.enabled } : task,
            ),
          }))
        },

        setServerDetails: (server) => set({
          serverName: server.name,
          status: server.status,
          version: server.version,
          address: server.playitDomain,
          serverPath: server.serverPath,
          maxPlayers: server.maxPlayers,
          onlinePlayers: server.onlinePlayers,
        }),
      }),
      {
        name: "server-storage",
      },
    ),
  ),
)
