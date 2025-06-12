"use client"

import type React from "react"
import { Server } from "@/lib/servers-store"
import { useMemo } from "react"
import { motion } from "framer-motion"
import { Plus, Search, Filter, Power, Trash2, Pencil, Sparkles, Zap, Rocket } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useServerListStore } from "@/lib/servers-store"
import { useServerListUIStore } from "@/stores/server-list-ui-store"

// Pure function for time formatting
const formatLastActive = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60000) return "Just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minute${Math.floor(diff / 60000) > 1 ? "s" : ""} ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hour${Math.floor(diff / 3600000) > 1 ? "s" : ""} ago`
  return `${Math.floor(diff / 86400000)} day${Math.floor(diff / 86400000) > 1 ? "s" : ""} ago`
}

// Separate component for empty state to flatten conditional logic
function EmptyServerState({ hasServers, onCreateServer }: { hasServers: boolean; onCreateServer: () => void }) {
  if (hasServers) {
    return (
      <div className="bg-space-cadet rounded-lg p-8 text-center border border-cool-gray/30">
        <h3 className="text-xl font-semibold text-linen mb-2">No servers match your filters</h3>
        <p className="text-cool-gray">Try adjusting your search criteria or filters.</p>
      </div>
    )
  }

  return (
    <motion.div 
      className="relative bg-gradient-to-br from-space-cadet via-space-cadet/90 to-indigo-900/20 rounded-2xl p-12 text-center border border-indigo-500/20 overflow-hidden cursor-pointer group transition-all duration-300 hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-500/10"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      onClick={onCreateServer}
      whileTap={{ scale: 0.98 }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-indigo-500/5 to-purple-500/10 group-hover:via-indigo-500/10 group-hover:to-purple-500/15 transition-all duration-300" />
      <div className="absolute top-4 right-4 text-indigo-400/20 group-hover:text-indigo-400/30 transition-colors duration-300">
        <Sparkles size={32} />
      </div>
      <div className="absolute bottom-4 left-4 text-purple-400/20 group-hover:text-purple-400/30 transition-colors duration-300">
        <Zap size={28} />
      </div>
      
      <div className="relative z-10">
        <motion.div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mb-6 border border-indigo-400/30 group-hover:border-indigo-400/50 transition-all duration-300"
          animate={{ 
            boxShadow: [
              "0 0 0 0 rgba(99, 102, 241, 0.4)",
              "0 0 0 20px rgba(99, 102, 241, 0)",
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Rocket className="text-indigo-400 group-hover:text-indigo-300 transition-colors duration-300" size={32} />
        </motion.div>
        
        <h3 className="text-2xl font-bold text-linen mb-3 bg-gradient-to-r from-linen to-indigo-200 bg-clip-text text-transparent group-hover:from-white group-hover:to-indigo-100 transition-all duration-300">
          Ready to Launch Your First Server?
        </h3>
        <p className="text-cool-gray mb-8 max-w-md mx-auto leading-relaxed group-hover:text-cool-gray/90 transition-colors duration-300">
          Create your very own Minecraft server in minutes. No technical knowledge required – 
          our wizard will guide you through every step.
        </p>
        
        <motion.div
          className="inline-block"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 border-0 px-8 py-3 rounded-lg flex items-center gap-3">
              <Plus size={20} />
              <span className="font-semibold">Create Your First Server</span>
          </div>
        </motion.div>
        
        <p className="text-xs text-cool-gray/70 mt-4 group-hover:text-cool-gray/80 transition-colors duration-300">
          ✨ Free forever • ⚡ Ready in 3 minutes • 🎮 Supports all versions
        </p>
      </div>
    </motion.div>
  )
}

// Separate component for server editing to flatten conditional logic
function ServerNameDisplay({ 
  server, 
  isEditing, 
  editValue, 
  onStartEdit, 
  onUpdateValue, 
  onSaveEdit, 
  onCancelEdit 
}: {
  server: Server
  isEditing: boolean
  editValue: string
  onStartEdit: () => void
  onUpdateValue: (value: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
}) {
  if (isEditing) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); onSaveEdit(); }}>
        <input
          className="bg-night border-cool-gray/30 text-linen rounded px-2 py-1 text-xl font-semibold w-32"
          value={editValue}
          onChange={(e) => onUpdateValue(e.target.value)}
          autoFocus
          onBlur={(e) => { e.stopPropagation(); onSaveEdit(); }}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
        />
      </form>
    )
  }

  return (
    <>
      <h3 className="text-xl font-semibold text-linen">{server.name}</h3>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStartEdit();
        }}
        className="ml-1 p-1 hover:bg-cool-gray/20 rounded transition-colors"
      >
        <Pencil className="h-4 w-4 text-cool-gray" />
      </button>
    </>
  )
}

export function ServersList() {
  const navigate = useNavigate()
  const { toast } = useToast()
  
  // Store state - following thin UI wrapper pattern
  const servers = useServerListStore((s) => s.servers)
  const refresh = useServerListStore((s) => s.refresh)
  const toggleServerStatus = useServerListStore((s) => s.toggleServerStatus)
  const removeServer = useServerListStore((s) => s.removeServer)
  const renameServer = useServerListStore((s) => s.renameServer)
  
  const {
    searchQuery,
    statusFilter,
    gameModeFilter,
    editingServerId,
    editValue,
    setSearchQuery,
    setStatusFilter,
    setGameModeFilter,
    startEditing,
    setEditValue,
    stopEditing,
  } = useServerListUIStore()

  // Computed values instead of useEffect - explicit logic
  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      const matchesSearch =
        server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        server.playitDomain?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter ? server.status === statusFilter : true
      const matchesGameMode = gameModeFilter ? server.gameMode === gameModeFilter : true
      return matchesSearch && matchesStatus && matchesGameMode
    })
  }, [servers, searchQuery, statusFilter, gameModeFilter])

  // Explicit initialization instead of useEffect
  if (servers.length === 0) {
    refresh()
  }

  // Event handlers - explicit logic
  const handleCreateServer = () => navigate("/create-server")
  const handleServerClick = (serverId: string) => navigate(`/dashboard?serverId=${serverId}`)
  
  const handleToggleStatus = (e: React.MouseEvent, serverId: string, currentStatus: string) => {
    e.stopPropagation()
    toggleServerStatus(serverId)
    toast({
      title: `Server ${currentStatus === "online" ? "stopping" : "starting"}`,
      description: `${currentStatus === "online" ? "Stopping" : "Starting"} server...`,
    })
  }

  const handleDeleteServer = (e: React.MouseEvent, server: Server) => {
    e.stopPropagation()
    if (confirm(`Are you sure you want to delete "${server.name}"? This will permanently delete the server directory from disk.`)) {
      removeServer(server.serverPath)
      toast({
        title: "Server deleted",
        description: `"${server.name}" and its files have been deleted.`,
      })
    }
  }

  const handleSaveEdit = () => {
    if (editingServerId && editValue.trim()) {
      renameServer(editingServerId, editValue.trim())
    }
    stopEditing()
  }

  const handleToggleStatusFilter = (status: string) => {
    setStatusFilter(statusFilter === status ? null : status)
  }

  const handleToggleGameModeFilter = (gameMode: string) => {
    setGameModeFilter(gameModeFilter === gameMode ? null : gameMode)
  }

  return (
    <div className="container mx-auto py-10 px-4 bg-night min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-linen">My Minecraft Servers</h1>

          {servers.length > 0 && (
            <Button onClick={handleCreateServer} className="flex items-center gap-2">
              <Plus size={16} />
              Create New Server
            </Button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cool-gray h-4 w-4" />
            <Input
              placeholder="Search servers..."
              className="pl-10 bg-space-cadet border-cool-gray/30 text-linen"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter size={16} />
                Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-space-cadet border-cool-gray/30 text-linen">
              <div className="p-2 text-xs font-semibold text-cool-gray">Status</div>
              <DropdownMenuCheckboxItem
                checked={statusFilter === "online"}
                onCheckedChange={() => handleToggleStatusFilter("online")}
              >
                Online
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter === "offline"}
                onCheckedChange={() => handleToggleStatusFilter("offline")}
              >
                Offline
              </DropdownMenuCheckboxItem>

              <div className="p-2 text-xs font-semibold text-cool-gray">Game Mode</div>
              <DropdownMenuCheckboxItem
                checked={gameModeFilter === "survival"}
                onCheckedChange={() => handleToggleGameModeFilter("survival")}
              >
                Survival
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={gameModeFilter === "creative"}
                onCheckedChange={() => handleToggleGameModeFilter("creative")}
              >
                Creative
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={gameModeFilter === "adventure"}
                onCheckedChange={() => handleToggleGameModeFilter("adventure")}
              >
                Adventure
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {filteredServers.length === 0 ? (
          <EmptyServerState 
            hasServers={servers.length > 0} 
            onCreateServer={() => handleCreateServer()} 
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServers.map((server) => (
              <motion.div
                key={server.id}
                className="bg-space-cadet rounded-lg shadow-lg border border-cool-gray/30 overflow-hidden cursor-pointer hover:border-linen/50 transition-colors"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
                onClick={() => handleServerClick(server.id)}
              >
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-night flex items-center justify-center">
                      <img
                        src={server.icon || "/placeholder.svg?height=40&width=40"}
                        alt={`${server.name} icon`}
                        className="h-8 w-8 rounded-full"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <ServerNameDisplay
                        server={server}
                        isEditing={editingServerId === server.id}
                        editValue={editValue}
                        onStartEdit={() => startEditing(server.id, server.name)}
                        onUpdateValue={setEditValue}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={stopEditing}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`${
                          server.status === "online"
                            ? "bg-green-500/20 text-green-400 border-green-500/50"
                            : "bg-red-500/20 text-red-400 border-red-500/50"
                        } border`}
                      >
                        {server.status === "online" ? (
                          <motion.div
                            className="h-2 w-2 rounded-full bg-green-400 mr-1.5"
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                          />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-red-400 mr-1.5" />
                        )}
                        {server.status === "online" ? "Online" : "Offline"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-cool-gray">
                      <span className="text-linen">
                        {server.onlinePlayers}/{server.maxPlayers}
                      </span>{" "}
                      players
                    </div>
                    <div className="text-xs text-cool-gray">Last active: {formatLastActive(server.lastActive)}</div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-cool-gray">{server.version}</div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => handleToggleStatus(e, server.id, server.status)}
                      >
                        <Power size={14} className={server.status === "online" ? "text-red-400" : "text-green-400"} />
                        <span className="sr-only">{server.status === "online" ? "Stop" : "Start"} server</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => handleDeleteServer(e, server)}
                      >
                        <Trash2 size={14} className="text-red-400" />
                        <span className="sr-only">Delete server</span>
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-cool-gray mt-2">Path: {server.serverPath}</div>
                  <div className="text-xs text-cool-gray mt-1">Domain: {server.playitDomain}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
