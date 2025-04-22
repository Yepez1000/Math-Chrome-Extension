import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Play, Square, RefreshCw, X } from "lucide-react"

interface ServerControlsProps {
  status: "online" | "offline" | "starting" | "stopping"
  onAction: (action: "start" | "stop" | "restart" | "kill") => void
}

export function ServerControls({ status, onAction }: ServerControlsProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-cool-gray/20">
      <h3 className="text-linen font-medium">Server Controls</h3>

      <div className="flex items-center gap-2">
        {status === "offline" && (
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => onAction("start")}
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
              onClick={() => onAction("stop")}
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
              <Button onClick={() => onAction("restart")} className="bg-linen text-night hover:bg-linen/90">
                <RefreshCw className="h-4 w-4 mr-1" />
                Restart
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => onAction("kill")} variant="destructive">
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
