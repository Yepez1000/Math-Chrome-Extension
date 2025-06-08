import { create } from 'zustand'
import { IPC_CHANNELS } from '../../../shared/types';

export type WizardStep = "detect" | "flavor" | "modpack" | "world" | "performance" | "review"

export type ServerConfig = {
  isModded: boolean
  serverType: "vanilla" | "spigot" | "paper" | "forge" | "fabric" | "bukkit"
  modpackPath?: string
  modpackName?: string
  ram: number
  hostingMode: "play+host" | "host"
  javaPath: string
  serverDirectory?: string
  worldPath?: string
  worldName?: string
  worldSeed?: string
  worldType?: string
  generateStructures?: boolean
  importedWorld?: boolean
}

interface ServerConfigState {
  config: ServerConfig
  currentStep: WizardStep
  updateConfig: (updates: Partial<ServerConfig>) => void
  setStep: (step: WizardStep) => void
  nextStep: () => void
  previousStep: () => void
}

const initialConfig: ServerConfig = {
  isModded: false,
  serverType: "vanilla",
  ram: 4,
  hostingMode: "play+host",
  javaPath: "", // Will be set by Java detection
  // serverDirectory: "C:\\MinecraftServers\\MyServer", // Will be set by fetchDefaultServerDirectory if not already set
}

const stepOrder: WizardStep[] = ["detect", "flavor", "modpack", "world", "performance", "review"]

export const useServerConfigStore = create<ServerConfigState>((set, get) => ({
  config: initialConfig,
  currentStep: "detect",
  
  updateConfig: (updates) => 
    set((state) => ({
      config: { ...state.config, ...updates }
    })),

  setStep: (step) => set({ currentStep: step }),

  nextStep: () => {
    const { currentStep, config } = get()
    const currentIndex = stepOrder.indexOf(currentStep)

    // Skip modpack step if vanilla is selected
    if (currentStep === "flavor" && !config.isModded) {
      set({ currentStep: "world" })
      return
    }

    if (currentIndex < stepOrder.length - 1) {
      set({ currentStep: stepOrder[currentIndex + 1] })
    }
  },

  previousStep: () => {
    const { currentStep, config } = get()
    const currentIndex = stepOrder.indexOf(currentStep)

    // Skip modpack step if vanilla is selected when going back
    if (currentStep === "world" && !config.isModded) {
      set({ currentStep: "flavor" })
      return
    }

    if (currentIndex > 0) {
      set({ currentStep: stepOrder[currentIndex - 1] })
    }
  }
})) 

// Fetch default server directory on store initialization if not already set
async function fetchDefaultServerDirectory() {
  const currentConfig = useServerConfigStore.getState().config;
  if (!currentConfig.serverDirectory) {
    try {
      const defaultPath = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SERVER_DIRECTORY_DEFAULT);
      if (defaultPath) {
        useServerConfigStore.getState().updateConfig({ serverDirectory: defaultPath });
      }
    } catch (error) {
      console.error('Failed to fetch default server directory:', error);
    }
  }
}

fetchDefaultServerDirectory(); 