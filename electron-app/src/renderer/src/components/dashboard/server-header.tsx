"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Users, Globe } from "lucide-react"

interface ServerHeaderProps {
  serverName: string
  status: "online" | "offline" | "starting" | "stopping"
  version: string
  address: string
  playerCount: string
}

export function ServerHeader({ serverName, status, version, address, playerCount }: ServerHeaderProps) {
  return (
    <motion.div
      className="bg-space-cadet rounded-lg shadow-lg p-6 border border-cool-gray/30"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-night flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            >
              <img src="/placeholder.svg?height=48&width=48" alt="Server icon" className="h-10 w-10 rounded-full" />
            </motion.div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-linen">{serverName}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-cool-gray text-sm">{version}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-cool-gray" />
            <span className="text-linen font-mono text-sm">{address}</span>
          </div>

          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cool-gray" />
            <span className="text-linen">{playerCount} players</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function StatusBadge({ status }: { status: "online" | "offline" | "starting" | "stopping" }) {
  const getStatusColor = () => {
    switch (status) {
      case "online":
        return "bg-green-500/20 text-green-400 border-green-500/50"
      case "offline":
        return "bg-red-500/20 text-red-400 border-red-500/50"
      case "starting":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
      case "stopping":
        return "bg-orange-500/20 text-orange-400 border-orange-500/50"
    }
  }

  const getStatusText = () => {
    switch (status) {
      case "online":
        return "Online"
      case "offline":
        return "Offline"
      case "starting":
        return "Starting"
      case "stopping":
        return "Stopping"
    }
  }

  return (
    <Badge className={`${getStatusColor()} border`}>
      {status === "online" && (
        <motion.div
          className="h-2 w-2 rounded-full bg-green-400 mr-1.5"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        />
      )}
      {status === "starting" && (
        <motion.div
          className="h-2 w-2 rounded-full bg-yellow-400 mr-1.5"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
        />
      )}
      {status === "stopping" && (
        <motion.div
          className="h-2 w-2 rounded-full bg-orange-400 mr-1.5"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
        />
      )}
      {status === "offline" && <div className="h-2 w-2 rounded-full bg-red-400 mr-1.5" />}
      {getStatusText()}
    </Badge>
  )
}
