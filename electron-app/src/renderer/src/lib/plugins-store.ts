import { create } from "zustand"
import { devtools, persist } from "zustand/middleware"

export type Plugin = {
  id: string
  name: string
  version: string
  author: string
  description: string
  enabled: boolean
  configContent?: string
}

export type RepositoryPlugin = {
  id: string
  name: string
  version: string
  author: string
  description: string
  categories: string[]
  downloads: number
  lastUpdated: string
  fileSize: string
  license: string
  dependencies: string[]
  website?: string
  iconUrl?: string
}

interface PluginsState {
  plugins: Plugin[]
  repositoryPlugins: RepositoryPlugin[]
  isRefreshing: boolean
  isServerRunning: boolean

  // Actions
  refreshPlugins: () => Promise<void>
  togglePlugin: (id: string) => Promise<void>
  removePlugin: (id: string) => Promise<void>
  updatePluginConfig: (id: string, configContent: string) => Promise<void>
  installPlugin: (id: string) => Promise<void>
}

// Mock data for installed plugins
const mockPlugins: Plugin[] = [
  {
    id: "essentialsx",
    name: "EssentialsX",
    version: "2.19.7",
    author: "EssentialsX Team",
    description: "The essential plugin suite for Minecraft servers, providing core commands and features.",
    enabled: true,
    configContent: `# EssentialsX Configuration
# Last updated: 2025-04-27

spawn-on-join: true
disable-unlimited-anvil: false
debug: false

# Chat settings
chat:
  format: '<{DISPLAYNAME}> {MESSAGE}'
  radius: 0
  
# Economy settings
economy:
  currency-symbol: '$'
  starting-balance: 100.0
  
# Teleport settings
teleport:
  cooldown: 3
  delay: 5
  cancel-on-move: true`,
  },
  {
    id: "worldedit",
    name: "WorldEdit",
    version: "7.2.12",
    author: "EngineHub",
    description: "In-game map editor for Minecraft, allowing for complex terrain manipulation and building tools.",
    enabled: true,
    configContent: `# WorldEdit Configuration
# Last updated: 2025-04-27

limits:
  max-blocks-changed:
    default: 500000
    maximum: -1
  max-radius: 100
  max-super-pickaxe-size: 5
  max-brush-radius: 6
  
navigation:
  use-compass: true
  thru-blocks: air,grass,tall_grass,snow,snow_layer
  
history:
  size: 15
  expiration: 10`,
  },
  {
    id: "luckperms",
    name: "LuckPerms",
    version: "5.4.98",
    author: "Luck",
    description: "A permissions plugin for Minecraft servers, providing a flexible and powerful permission system.",
    enabled: true,
    configContent: `# LuckPerms Configuration
# Last updated: 2025-04-27

server: global
storage-method: h2
watch-files: true
auto-push-updates: true
sync-minutes: 3

messaging-service: auto

temporary-add-behaviour: accumulate
temporary-remove-behaviour: remove

primary-group-calculation: stored
context-calculator:
  world-permission-check: true
  server-permission-check: true`,
  },
  {
    id: "coreprotect",
    name: "CoreProtect",
    version: "21.3",
    author: "Intelli",
    description:
      "A block logging plugin that tracks and logs all player actions, allowing for rollbacks and inspections.",
    enabled: false,
    configContent: `# CoreProtect Configuration
# Last updated: 2025-04-27

check-updates: true
database:
  use-mysql: false
  table-prefix: co_
  mysql:
    hostname: localhost
    port: 3306
    database: coreprotect
    username: root
    password: password
    
settings:
  max-rollback: 1000000
  use-paper-hooks: true
  log-commands: true`,
  },
  {
    id: "vault",
    name: "Vault",
    version: "1.7.3",
    author: "Milkbowl",
    description: "A permissions, chat, and economy API to hook into for various plugins.",
    enabled: true,
    configContent: `# Vault Configuration
# Last updated: 2025-04-27

# This plugin doesn't have much configuration as it's primarily an API.
update-check: true
debug: false`,
  },
]

// Mock data for repository plugins
const mockRepositoryPlugins: RepositoryPlugin[] = [
  {
    id: "griefprevention",
    name: "GriefPrevention",
    version: "16.18.1",
    author: "RoboMWM",
    description: "Prevents grief and theft on your server by protecting blocks and containers.",
    categories: ["Protection", "Anti-Grief", "Land Claims"],
    downloads: 5823941,
    lastUpdated: "2025-03-15",
    fileSize: "1.2 MB",
    license: "GPL-3.0",
    dependencies: ["Vault (Optional)"],
    website: "https://github.com/TechFortress/GriefPrevention",
    iconUrl: "/placeholder.svg?height=24&width=24",
  },
  {
    id: "dynmap",
    name: "Dynmap",
    version: "3.5.1",
    author: "mikeprimm",
    description: "A Google Maps-like map for your Minecraft server that can be viewed in a web browser.",
    categories: ["Mapping", "Web", "Utility"],
    downloads: 7245123,
    lastUpdated: "2025-04-02",
    fileSize: "5.7 MB",
    license: "Apache-2.0",
    dependencies: [],
    website: "https://github.com/webbukkit/dynmap",
    iconUrl: "/placeholder.svg?height=24&width=24",
  },
  {
    id: "multiverse",
    name: "Multiverse-Core",
    version: "4.3.1",
    author: "Multiverse Team",
    description: "Manage multiple worlds with different settings, game modes, and more.",
    categories: ["World Management", "Teleportation", "Utility"],
    downloads: 6123789,
    lastUpdated: "2025-02-28",
    fileSize: "2.3 MB",
    license: "BSD-3-Clause",
    dependencies: [],
    website: "https://github.com/Multiverse/Multiverse-Core",
    iconUrl: "/placeholder.svg?height=24&width=24",
  },
  {
    id: "skript",
    name: "Skript",
    version: "2.6.4",
    author: "SkriptLang",
    description: "Create custom commands, events, and more without Java knowledge using a simple scripting language.",
    categories: ["Scripting", "Development", "Customization"],
    downloads: 8932145,
    lastUpdated: "2025-04-10",
    fileSize: "3.1 MB",
    license: "GPL-3.0",
    dependencies: [],
    website: "https://github.com/SkriptLang/Skript",
    iconUrl: "/placeholder.svg?height=24&width=24",
  },
  {
    id: "worldguard",
    name: "WorldGuard",
    version: "7.0.7",
    author: "EngineHub",
    description: "Region protection plugin that allows you to define areas where certain actions are prevented.",
    categories: ["Protection", "Regions", "Anti-Grief"],
    downloads: 7123456,
    lastUpdated: "2025-03-25",
    fileSize: "1.8 MB",
    license: "LGPL-3.0",
    dependencies: ["WorldEdit"],
    website: "https://enginehub.org/worldguard",
    iconUrl: "/placeholder.svg?height=24&width=24",
  },
  {
    id: "citizens",
    name: "Citizens",
    version: "2.0.30",
    author: "fullwall",
    description: "Create and control NPCs for various purposes like quests, shops, and more.",
    categories: ["NPCs", "Roleplay", "Customization"],
    downloads: 4567890,
    lastUpdated: "2025-01-15",
    fileSize: "4.2 MB",
    license: "LGPL-3.0",
    dependencies: [],
    website: "https://github.com/CitizensDev/Citizens2",
    iconUrl: "/placeholder.svg?height=24&width=24",
  },
]

export const usePluginsStore = create<PluginsState>()(
  devtools(
    persist(
      (set, get) => ({
        plugins: mockPlugins,
        repositoryPlugins: mockRepositoryPlugins,
        isRefreshing: false,
        isServerRunning: true, // Assume server is running by default

        refreshPlugins: async () => {
          set({ isRefreshing: true })

          try {
            // In a real app, this would fetch plugins from the server
            await new Promise((resolve) => setTimeout(resolve, 1000))

            // For demo purposes, we'll just keep the existing plugins
            set({ isRefreshing: false })
            return Promise.resolve()
          } catch (error) {
            set({ isRefreshing: false })
            return Promise.reject(error)
          }
        },

        togglePlugin: async (id: string) => {
          try {
            // In a real app, this would call an API to enable/disable the plugin
            await new Promise((resolve) => setTimeout(resolve, 1000))

            set((state) => ({
              plugins: state.plugins.map((plugin) =>
                plugin.id === id ? { ...plugin, enabled: !plugin.enabled } : plugin,
              ),
            }))

            return Promise.resolve()
          } catch (error) {
            return Promise.reject(error)
          }
        },

        removePlugin: async (id: string) => {
          try {
            // In a real app, this would call an API to remove the plugin
            await new Promise((resolve) => setTimeout(resolve, 1500))

            set((state) => ({
              plugins: state.plugins.filter((plugin) => plugin.id !== id),
            }))

            return Promise.resolve()
          } catch (error) {
            return Promise.reject(error)
          }
        },

        updatePluginConfig: async (id: string, configContent: string) => {
          try {
            // In a real app, this would call an API to update the plugin config
            await new Promise((resolve) => setTimeout(resolve, 1000))

            set((state) => ({
              plugins: state.plugins.map((plugin) => (plugin.id === id ? { ...plugin, configContent } : plugin)),
            }))

            return Promise.resolve()
          } catch (error) {
            return Promise.reject(error)
          }
        },

        installPlugin: async (id: string) => {
          try {
            // In a real app, this would call an API to install the plugin
            await new Promise((resolve) => setTimeout(resolve, 2000))

            const repoPlugin = get().repositoryPlugins.find((plugin) => plugin.id === id)
            if (!repoPlugin) {
              return Promise.reject(new Error("Plugin not found in repository"))
            }

            // Check if plugin is already installed
            const existingPlugin = get().plugins.find((plugin) => plugin.id === id)
            if (existingPlugin) {
              return Promise.reject(new Error("Plugin is already installed"))
            }

            // Add the plugin to the installed plugins list
            const newPlugin: Plugin = {
              id: repoPlugin.id,
              name: repoPlugin.name,
              version: repoPlugin.version,
              author: repoPlugin.author,
              description: repoPlugin.description,
              enabled: true, // Enable by default
              configContent: `# ${repoPlugin.name} Configuration\n# Installed: ${new Date().toISOString()}\n\n# Default configuration`,
            }

            set((state) => ({
              plugins: [...state.plugins, newPlugin],
            }))

            return Promise.resolve()
          } catch (error) {
            return Promise.reject(error)
          }
        },
      }),
      {
        name: "plugins-storage",
      },
    ),
  ),
)
