import { create } from 'zustand'

interface ServerListUIState {
  searchQuery: string
  statusFilter: string | null
  gameModeFilter: string | null
  editingServerId: string | null
  editValue: string
  
  // Actions
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: string | null) => void
  setGameModeFilter: (gameMode: string | null) => void
  startEditing: (serverId: string, currentName: string) => void
  setEditValue: (value: string) => void
  stopEditing: () => void
  reset: () => void
}

export const useServerListUIStore = create<ServerListUIState>((set) => ({
  searchQuery: "",
  statusFilter: null,
  gameModeFilter: null,
  editingServerId: null,
  editValue: "",
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setGameModeFilter: (gameMode) => set({ gameModeFilter: gameMode }),
  startEditing: (serverId, currentName) => set({ 
    editingServerId: serverId, 
    editValue: currentName 
  }),
  setEditValue: (value) => set({ editValue: value }),
  stopEditing: () => set({ editingServerId: null, editValue: "" }),
  reset: () => set({ 
    searchQuery: "", 
    statusFilter: null, 
    gameModeFilter: null, 
    editingServerId: null, 
    editValue: "" 
  })
})) 