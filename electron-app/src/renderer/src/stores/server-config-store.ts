import { create } from 'zustand'

export type WizardStep = "detect" | "flavor" | "modpack" | "world" | "performance" | "review"

export type ServerConfig = {
  minecraftPath: string | null
  isModded: boolean
  serverType: "vanilla" | "spigot" | "paper" | "forge" | "fabric" | "bukkit"
  modpackPath?: string
  modpackName?: string
  ram: number
  hostingMode: "play+host" | "host"
  javaPath?: string
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
  minecraftPath: "C:\\Users\\Username\\AppData\\Roaming\\.minecraft",
  isModded: false,
  serverType: "vanilla",
  ram: 4,
  hostingMode: "play+host",
  serverDirectory: "C:\\MinecraftServers\\MyServer",
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