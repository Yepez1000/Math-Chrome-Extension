"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"
import { Users, Search } from "lucide-react"
import { PlayerActionsDialog } from "./player-actions-dialog"
import { playerActions } from "@/lib/player-actions"
import { useServerStore } from "@/lib/store"

interface PlayersListProps {
  showHeader?: boolean
}

export function PlayersList({ showHeader = true }: PlayersListProps) {
  const { toast } = useToast()
  const { players, onlinePlayers, maxPlayers } = useServerStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Filter players based on search query and online status
  const filteredPlayers = players
    .filter((player) => player.isOnline)
    .filter((player) => player.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handlePlayerClick = (playerId: string) => {
    setSelectedPlayer(playerId)
    setDialogOpen(true)
  }

  const handlePlayerAction = (actionId: string, playerId: string, reason?: string) => {
    const player = players.find((p) => p.id === playerId)
    if (!player) return
    const action = playerActions.find((a) => a.id === actionId)
    if (!action) return
    action.handler(playerId, reason)
    toast({
      title: `Player ${action.label}`,
      description: `${player.name} has been ${action.label}${reason ? `: ${reason}` : ""}`,
    })
  }

  const selectedPlayerData = selectedPlayer ? players.find((p) => p.id === selectedPlayer) || null : null

  return (
    <Card className="border-cool-gray/30 bg-space-cadet shadow-lg h-full">
      <CardContent className="p-0">
        {showHeader && (
          <div className="p-4 border-b border-cool-gray/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-cool-gray" />
                <h3 className="text-linen font-medium">Online Players</h3>
              </div>
              <span className="text-cool-gray text-sm">
                {onlinePlayers}/{maxPlayers}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cool-gray" />
              <Input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-night border-cool-gray/30 text-linen w-full"
              />
            </div>
          </div>
        )}

        <ScrollArea className={showHeader ? "h-[calc(100vh-300px)] min-h-[400px]" : "h-[300px]"}>
          <div className="p-2">
            {filteredPlayers.length > 0 ? (
              filteredPlayers.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex items-center gap-3 p-2 hover:bg-night/50 rounded-md transition-colors cursor-pointer"
                  onClick={() => handlePlayerClick(player.id)}
                >
                  <div className="relative">
                    <img
                      src={`https://mc-heads.net/avatar/${player.name}.png`}
                      alt={player.name}
                      className="h-10 w-10 rounded"
                    />
                    {player.isOnline && (
                      <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-space-cadet" />
                    )}
                  </div>
                  <div>
                    <p className="text-linen">{player.name}</p>
                    <p className="text-cool-gray text-xs">{player.isOnline ? "Online" : "Offline"}</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-cool-gray">No players found</p>
                {searchQuery && (
                  <Button variant="link" onClick={() => setSearchQuery("")} className="text-linen hover:text-linen/80">
                    Clear search
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Player Actions Dialog */}
      {selectedPlayerData && (
        <PlayerActionsDialog
          player={selectedPlayerData}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAction={(action, playerId, reason) => handlePlayerAction(action.id, playerId, reason)}
        />
      )}
    </Card>
  )
}
