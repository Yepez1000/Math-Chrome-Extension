"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Play, Square, RefreshCw, X } from "lucide-react"
import { useServerStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"

export function ServerControls() {
  const { status, setStatus } = useServerStore()
  const { toast } = useToast()

  const handleServerControl = (action: "start" | "stop" | "restart" | "kill") => {
    // In a real app, this would call an API or IPC
    if (action === "stop") {
      setStatus("stopping")
      setTimeout(() => setStatus("offline"), 2000)
      toast({
        title: "Server stopping",
        description: "Your Minecraft server is shutting down...",
      })
    } else if (action === "start") {
      setStatus("starting")
      setTimeout(() => setStatus("online"), 3000)
      toast({
        title: "Server starting",
        description: "Your Minecraft server is starting up...",
      })
    } else if (action === "restart") {
      setStatus("stopping")
      toast({
        title: "Server restarting",
        description: "Your Minecraft server is restarting...",
      })
      setTimeout(() => {
        setStatus("starting")
        setTimeout(() => setStatus("online"), 3000)
      }, 2000)
    } else if (action === "kill") {
      setStatus("offline")
      toast({
        title: "Server killed",
        description: "Your Minecraft server has been forcefully terminated.",
        variant: "destructive",
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
