// @ts-nocheck

"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Play, Square, RefreshCw, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useServerListStore } from "@/lib/servers-store"
import { IPC_CHANNELS } from "@shared/types"

export function ServerControls() {
  const { toast } = useToast()
  const { selectedServerId, servers, refresh } = useServerListStore()
  const selectedServer = servers.find(s => s.id === selectedServerId)
  const status = selectedServer?.status || "offline"

  const handleServerControl = async (action: "start" | "stop" | "restart" | "kill") => {
    if (!selectedServerId) {
      toast({
        title: "Error",
        description: "No server selected",
        variant: "destructive"
      })
      return
    }

    try {
      if (action === "stop") {
        useServerListStore.setState(state => ({
          servers: state.servers.map(s => 
            s.id === selectedServerId ? { ...s, status: "stopping" } : s
          )
        }))
        const result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.STOP_EXISTING_SERVER, { serverId: selectedServerId })
        if (result.success) {
          await refresh()
          toast({
            title: "Server stopped",
            description: "Your Minecraft server has been stopped.",
          })
        } else {
          useServerListStore.setState(state => ({
            servers: state.servers.map(s => 
              s.id === selectedServerId ? { ...s, status: "online" } : s
            )
          }))
          throw new Error(result.error || "Failed to stop server")
        }
      } else if (action === "start") {
        useServerListStore.setState(state => ({
          servers: state.servers.map(s => 
            s.id === selectedServerId ? { ...s, status: "starting" } : s
          )
        }))
        const result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.START_EXISTING_SERVER, { serverId: selectedServerId })
        if (result.success) {
          await refresh()
          toast({
            title: "Server started",
            description: "Your Minecraft server is now running.",
          })
        } else {
          useServerListStore.setState(state => ({
            servers: state.servers.map(s => 
              s.id === selectedServerId ? { ...s, status: "offline" } : s
            )
          }))
          throw new Error(result.error || "Failed to start server")
        }
      } else if (action === "restart") {
        useServerListStore.setState(state => ({
          servers: state.servers.map(s => 
            s.id === selectedServerId ? { ...s, status: "stopping" } : s
          )
        }))
        const stopResult = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.STOP_EXISTING_SERVER, { serverId: selectedServerId })
        if (!stopResult.success) {
          useServerListStore.setState(state => ({
            servers: state.servers.map(s => 
              s.id === selectedServerId ? { ...s, status: "online" } : s
            )
          }))
          throw new Error(stopResult.error || "Failed to stop server")
        }
        
        useServerListStore.setState(state => ({
          servers: state.servers.map(s => 
            s.id === selectedServerId ? { ...s, status: "starting" } : s
          )
        }))
        const startResult = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.START_EXISTING_SERVER, { serverId: selectedServerId })
        if (startResult.success) {
          await refresh()
          toast({
            title: "Server restarted",
            description: "Your Minecraft server has been restarted.",
          })
        } else {
          useServerListStore.setState(state => ({
            servers: state.servers.map(s => 
              s.id === selectedServerId ? { ...s, status: "offline" } : s
            )
          }))
          throw new Error(startResult.error || "Failed to start server")
        }
      } else if (action === "kill") {
        const result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.STOP_EXISTING_SERVER, { serverId: selectedServerId, force: true })
        if (result.success) {
          await refresh()
          toast({
            title: "Server killed",
            description: "Your Minecraft server has been forcefully terminated.",
            variant: "destructive",
          })
        } else {
          throw new Error(result.error || "Failed to kill server")
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="flex items-center justify-between p-4 border-b border-cool-gray/20">
      <h3 className="text-linen font-medium">Server Controls</h3>

      <div className="flex items-center gap-2">
        {status === "offline" && (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => handleServerControl("start")}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={status === "starting"}
            >
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
          </motion.div>
        )}

        {(status === "online" || status === "starting") && (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => handleServerControl("stop")}
              variant="outline"
              className="border-cool-gray text-linen hover:bg-cool-gray/10"
              disabled={status === "stopping"}
            >
              <Square className="h-4 w-4 mr-1" />
              Stop
            </Button>
          </motion.div>
        )}

        {status === "online" && (
          <>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => handleServerControl("restart")} className="bg-linen text-night hover:bg-linen/90">
                <RefreshCw className="h-4 w-4 mr-1" />
                Restart
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => handleServerControl("kill")} variant="destructive">
                <X className="h-4 w-4 mr-1" />
                Kill
              </Button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
