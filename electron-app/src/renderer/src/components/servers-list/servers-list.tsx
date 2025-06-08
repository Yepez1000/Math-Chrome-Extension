"use client"

import type React from "react"
import { Server } from "@/lib/server-list-store"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Plus, Search, Filter, Power, Trash2 } from "lucide-react"
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
import { useServerListStore } from "@/lib/server-list-store"

function formatLastActive(timestamp: number) {
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60000) return "Just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minute${Math.floor(diff / 60000) > 1 ? "s" : ""} ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hour${Math.floor(diff / 3600000) > 1 ? "s" : ""} ago`
  return `${Math.floor(diff / 86400000)} day${Math.floor(diff / 86400000) > 1 ? "s" : ""} ago`
}

export function ServersList() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const servers = useServerListStore((s) => s.servers)
  const refresh = useServerListStore((s) => s.refresh)
  const toggleServerStatus = useServerListStore((s) => s.toggleServerStatus)
  const removeServer = useServerListStore((s) => s.removeServer)

  // Call refresh only once on mount to avoid infinite loop
  useEffect(() => {
    refresh()
  }, [refresh])

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [gameModeFilter, setGameModeFilter] = useState<string | null>(null)


  const filteredServers = servers.filter((server) => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.playitDomain.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter ? server.status === statusFilter : true
    const matchesGameMode = gameModeFilter ? server.gameMode === gameModeFilter : true
    return matchesSearch && matchesStatus && matchesGameMode
  })

  const handleCreateServer = () => {
    navigate("/create-server")
  }

  const handleServerClick = (serverId: string) => {
    navigate("/dashboard")
  }

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

  return (
    <div className="container mx-auto py-10 px-4 bg-night min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-linen">My Minecraft Servers</h1>

          <Button onClick={handleCreateServer} className="flex items-center gap-2">
            <Plus size={16} />
            Create New Server
          </Button>
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
                onCheckedChange={() => setStatusFilter(statusFilter === "online" ? null : "online")}
              >
                Online
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter === "offline"}
                onCheckedChange={() => setStatusFilter(statusFilter === "offline" ? null : "offline")}
              >
                Offline
              </DropdownMenuCheckboxItem>

              <div className="p-2 text-xs font-semibold text-cool-gray">Game Mode</div>
              <DropdownMenuCheckboxItem
                checked={gameModeFilter === "survival"}
                onCheckedChange={() => setGameModeFilter(gameModeFilter === "survival" ? null : "survival")}
              >
                Survival
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={gameModeFilter === "creative"}
                onCheckedChange={() => setGameModeFilter(gameModeFilter === "creative" ? null : "creative")}
              >
                Creative
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={gameModeFilter === "adventure"}
                onCheckedChange={() => setGameModeFilter(gameModeFilter === "adventure" ? null : "adventure")}
              >
                Adventure
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {filteredServers.length === 0 ? (
          <div className="bg-space-cadet rounded-lg p-8 text-center border border-cool-gray/30">
            <h3 className="text-xl font-semibold text-linen mb-2">No servers found</h3>
            <p className="text-cool-gray mb-6">
              {servers.length === 0 ? "You haven't created any servers yet." : "No servers match your search criteria."}
            </p>
            {servers.length === 0 && <Button onClick={handleCreateServer}>Create Your First Server</Button>}
          </div>
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
                    <div>
                      <h3 className="text-xl font-semibold text-linen">{server.name}</h3>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`$${
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
