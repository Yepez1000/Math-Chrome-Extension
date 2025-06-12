import { create } from 'zustand'
import { ServerStatus, ServerType } from '@/lib/servers-store'

interface ServerListUIState {
  searchQuery: string
  statusFilter: ServerStatus | null
  serverTypeFilter: ServerType | null
  editingServerId: string | null
  editValue: string
  
  // Actions
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: ServerStatus | null) => void
  setServerTypeFilter: (serverType: ServerType | null) => void
  startEditing: (serverId: string, currentName: string) => void
  setEditValue: (value: string) => void
  stopEditing: () => void
  reset: () => void
}

export const useServerListUIStore = create<ServerListUIState>((set) => ({
  searchQuery: "",
  statusFilter: null,
  serverTypeFilter: null,
  editingServerId: null,
  editValue: "",
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setServerTypeFilter: (serverType) => set({ serverTypeFilter: serverType }),
  startEditing: (serverId, currentName) => set({ 
    editingServerId: serverId, 
    editValue: currentName 
  }),
  setEditValue: (value) => set({ editValue: value }),
  stopEditing: () => set({ editingServerId: null, editValue: "" }),
  reset: () => set({ 
    searchQuery: "", 
    statusFilter: null, 
    serverTypeFilter: null, 
    editingServerId: null, 
    editValue: "" 
  })
})) 