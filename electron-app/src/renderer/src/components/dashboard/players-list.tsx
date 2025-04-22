"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { motion } from "framer-motion"
import { Users } from "lucide-react"

interface PlayersListProps {
  onlinePlayers: number
  maxPlayers: number
}

export function PlayersList({ onlinePlayers, maxPlayers }: PlayersListProps) {
  // Mock player data
  const players = [
    { id: 1, name: "jamoír", online: true },
    { id: 2, name: "Daleth", online: true },
    { id: 3, name: "RockDigger", online: true },
    { id: 4, name: "spicesw", online: true },
    { id: 5, name: "Thoughts3rased", online: true },
    { id: 6, name: "filliravaz", online: true },
    { id: 7, name: "AlxTray", online: true },
    { id: 8, name: "Leonito", online: true },
    { id: 9, name: "Felux137", online: true },
  ]

  return (
    <Card className="border-cool-gray/30 bg-space-cadet shadow-lg h-full">
      <CardContent className="p-0">
        <div className="p-4 border-b border-cool-gray/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cool-gray" />
            <h3 className="text-linen font-medium">Players</h3>
          </div>
          <span className="text-cool-gray text-sm">
            {onlinePlayers}/{maxPlayers}
          </span>
        </div>

        <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
          <div className="p-2">
            {players.map((player, index) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex items-center gap-3 p-2 hover:bg-night/50 rounded-md transition-colors"
              >
                <div className="relative">
                  <img
                    src={`/placeholder.svg?height=40&width=40&text=${player.name.charAt(0)}`}
                    alt={player.name}
                    className="h-10 w-10 rounded"
                  />
                  {player.online && (
                    <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-space-cadet" />
                  )}
                </div>
                <div>
                  <p className="text-linen">{player.name}</p>
                  <p className="text-cool-gray text-xs">{player.online ? "Online" : "Offline"}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
