import { create } from 'zustand'

// Detect Minecraft Step Store
interface DetectMinecraftState {
  isDetecting: boolean
  setIsDetecting: (isDetecting: boolean) => void
  reset: () => void
}

export const useDetectMinecraftStore = create<DetectMinecraftState>((set) => ({
  isDetecting: true,
  setIsDetecting: (isDetecting) => set({ isDetecting }),
  reset: () => set({ isDetecting: true }),
}))

// Flavor Selection Step Store
interface FlavorSelectionState {
  selectedType: "vanilla" | "paper" | "forge" | "spigot" | "fabric" | "bukkit" | null
  isExpanded: boolean
  isAnimating: boolean
  topRowTypes: ("vanilla" | "paper" | "forge" | "spigot" | "fabric" | "bukkit")[]
  bottomRowTypes: ("vanilla" | "paper" | "forge" | "spigot" | "fabric" | "bukkit")[]
  setSelectedType: (type: "vanilla" | "paper" | "forge" | "spigot" | "fabric" | "bukkit" | null) => void
  setIsExpanded: (isExpanded: boolean) => void
  setIsAnimating: (isAnimating: boolean) => void
  swapRows: () => void
  reset: () => void
}

export const useFlavorSelectionStore = create<FlavorSelectionState>((set, get) => ({
  selectedType: "vanilla",
  isExpanded: false,
  isAnimating: false,
  topRowTypes: ["paper", "vanilla", "forge"],
  bottomRowTypes: ["spigot", "bukkit", "fabric"],
  setSelectedType: (type) => set({ selectedType: type }),
  setIsExpanded: (isExpanded) => set({ isExpanded }),
  setIsAnimating: (isAnimating) => set({ isAnimating }),
  swapRows: () => {
    const { topRowTypes, bottomRowTypes } = get()
    set({ 
      topRowTypes: bottomRowTypes, 
      bottomRowTypes: topRowTypes
    })
  },
  reset: () => set({ 
    selectedType: "vanilla", 
    isExpanded: false, 
    isAnimating: false,
    topRowTypes: ["paper", "vanilla", "forge"],
    bottomRowTypes: ["spigot", "bukkit", "fabric"]
  }),
}))

// Modpack Selection Step Store
interface ModpackSelectionState {
  selectedTab: string
  setSelectedTab: (tab: string) => void
  isUploading: boolean
  setIsUploading: (isUploading: boolean) => void
  isValidated: boolean
  setIsValidated: (isValidated: boolean) => void
  uploadError: string | null
  setUploadError: (error: string | null) => void
  reset: () => void
}

export const useModpackSelectionStore = create<ModpackSelectionState>((set) => ({
  selectedTab: "upload",
  setSelectedTab: (tab) => set({ selectedTab: tab }),
  isUploading: false,
  setIsUploading: (isUploading) => set({ isUploading }),
  isValidated: false,
  setIsValidated: (isValidated) => set({ isValidated }),
  uploadError: null,
  setUploadError: (error) => set({ uploadError: error }),
  reset: () =>
    set({
      selectedTab: "upload",
      isUploading: false,
      isValidated: false,
      uploadError: null,
    }),
}))

// World Setup Step Store
interface WorldSetupState {
  selectedTab: string
  setSelectedTab: (tab: string) => void
  isImporting: boolean
  setIsImporting: (isImporting: boolean) => void
  worldImported: boolean
  setWorldImported: (imported: boolean) => void
  reset: () => void
}

export const useWorldSetupStore = create<WorldSetupState>((set) => ({
  selectedTab: "create",
  setSelectedTab: (tab) => set({ selectedTab: tab }),
  isImporting: false,
  setIsImporting: (isImporting) => set({ isImporting }),
  worldImported: false,
  setWorldImported: (imported) => set({ worldImported: imported }),
  reset: () =>
    set({
      selectedTab: "create",
      isImporting: false,
      worldImported: false,
    }),
}))

// Performance Settings Step Store
interface PerformanceSettingsState {
  systemInfo: {
    totalRam: number
    cpuCores: number
    availableRam: number
  }
  setSystemInfo: (info: { totalRam: number; cpuCores: number; availableRam: number }) => void
  reset: () => void
}

export const usePerformanceSettingsStore = create<PerformanceSettingsState>((set) => ({
  systemInfo: {
    totalRam: 16384, // MB (16 GB)
    cpuCores: 8,
    availableRam: 12288, // MB (12 GB)
  },
  setSystemInfo: (info) => set({ systemInfo: info }),
  reset: () =>
    set({
      systemInfo: {
        totalRam: 16384,
        cpuCores: 8,
        availableRam: 12288,
      },
    }),
})) 