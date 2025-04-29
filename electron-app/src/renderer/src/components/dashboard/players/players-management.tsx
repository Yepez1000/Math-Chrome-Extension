"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { UserPlus, UserCheck, Shield, Ban, Search } from "lucide-react"
import { PlayerActionsDialog } from "./player-actions-dialog"
import { playerActions } from "@/lib/player-actions"
import { useServerStore } from "@/lib/store"
import type { PlayerData } from "@/lib/store"

interface PlayersManagementProps {
  serverStatus: "online" | "offline" | "starting" | "stopping"
}

export function PlayersManagement({ serverStatus }: PlayersManagementProps) {
  const { toast } = useToast()
  const { players, updatePlayer, addPlayer, serverProperties } = useServerStore()
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState("")

  // Check if whitelist is enabled
  const whitelistEnabled = serverProperties.find((prop) => prop.key === "white-list")?.value === true

  // If whitelist tab is active but whitelist is disabled, switch to "all" tab
  if (activeTab === "whitelist" && !whitelistEnabled) {
    setActiveTab("all")
  }

  // Filter players based on active tab and search query
  const getFilteredPlayers = () => {
    let filtered = [...players]

    // Filter by tab
    switch (activeTab) {
      case "whitelist":
        filtered = filtered.filter((p) => p.isWhitelisted)
        break
      case "operators":
        filtered = filtered.filter((p) => p.isOp)
        break
      case "banned":
        filtered = filtered.filter((p) => p.isBanned)
        break
      case "all":
      default:
        // No filter
        break
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(query) || (p.uuid && p.uuid.toLowerCase().includes(query)),
      )
    }

    return filtered
  }

  const handlePlayerClick = (playerId: string) => {
    setSelectedPlayer(playerId)
    setDialogOpen(true)
  }

  const handlePlayerAction = (actionId: string, playerId: string, reason?: string) => {
    const player = players.find((p) => p.id === playerId)
    if (!player) return

    // In a real app, these would call API or IPC methods
    const action = playerActions.find((a) => a.id === actionId)
    if (!action) return

    // Execute the action
    action.handler(playerId, reason)

    // Show toast notification
    toast({
      title: `Player ${action.label}`,
      description: `${player.name} has been ${action.label}${reason ? `: ${reason}` : ""}`,
    })
  }

  const addNewPlayerToList = () => {
    if (!newPlayerName.trim()) return

    // Create a new player object
    const newPlayer: PlayerData = {
      id: `new-${Date.now()}`,
      name: newPlayerName,
      lastSeen: "Never",
      isOnline: false,
      isOp: activeTab === "operators",
      isWhitelisted: activeTab === "whitelist",
      isBanned: activeTab === "banned",
    }

    // Add the player to the store
    addPlayer(newPlayer)

    // Show toast notification
    toast({
      title: `Player added`,
      description: `${newPlayerName} has been added to the ${activeTab === "operators" ? "operators" : activeTab === "banned" ? "ban list" : "whitelist"}`,
    })

    setNewPlayerName("")
  }

  const getActionButtonLabel = () => {
    switch (activeTab) {
      case "whitelist":
        return "Add to Whitelist"
      case "operators":
        return "Add as Operator"
      case "banned":
        return "Add to Ban List"
      default:
        return "Add Player"
    }
  }

  const selectedPlayerData = selectedPlayer ? players.find((p) => p.id === selectedPlayer) || null : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <h2 className="text-xl font-bold text-linen">Player Management</h2>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cool-gray" />
            <Input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-night border-cool-gray/30 text-linen w-full md:w-[250px]"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-night border border-cool-gray/30 mb-4">
          <TabsTrigger value="all" className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen">
            All
          </TabsTrigger>

          {/* Only show whitelist tab if whitelist is enabled */}
          {whitelistEnabled && (
            <TabsTrigger
              value="whitelist"
              className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Whitelist
            </TabsTrigger>
          )}

          <TabsTrigger value="operators" className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen">
            <Shield className="h-4 w-4 mr-2" />
            Operators
          </TabsTrigger>

          <TabsTrigger value="banned" className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen">
            <Ban className="h-4 w-4 mr-2" />
            Banned
          </TabsTrigger>
        </TabsList>

        <div className="flex justify-between items-center mb-4">
          <p className="text-cool-gray">
            {getFilteredPlayers().length} player{getFilteredPlayers().length !== 1 ? "s" : ""}
          </p>

          {activeTab !== "all" && (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-linen text-night hover:bg-linen/90">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {getActionButtonLabel()}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-space-cadet border-cool-gray/30 text-linen">
                <DialogHeader>
                  <DialogTitle>{getActionButtonLabel()}</DialogTitle>
                  <DialogDescription className="text-cool-gray">
                    Select a player from the list or enter a new username.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cool-gray" />
                    <Input
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Search or enter new username"
                      className="pl-9 bg-night border-cool-gray/30 text-linen"
                    />
                  </div>

                  <div className="border border-cool-gray/30 rounded-md bg-night max-h-60 overflow-y-auto">
                    {players
                      .filter(
                        (p) =>
                          (!p.isBanned && activeTab !== "banned") ||
                          (!p.isOp && activeTab !== "operators") ||
                          (!p.isWhitelisted && activeTab !== "whitelist"),
                      )
                      .filter((p) => p.name.toLowerCase().includes(newPlayerName.toLowerCase()) || !newPlayerName)
                      .map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center gap-3 p-2 hover:bg-space-cadet/50 cursor-pointer border-b border-cool-gray/10 last:border-b-0"
                          onClick={() => setNewPlayerName(player.name)}
                        >
                          <img
                            src={`https://mc-heads.net/avatar/${player.name}.png`}
                            alt={player.name}
                            className="h-8 w-8 rounded"
                          />
                          <div>
                            <p className="text-linen">{player.name}</p>
                            <p className="text-cool-gray text-xs">
                              {player.isOnline ? "Online" : `Last seen: ${player.lastSeen}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    {players.filter((p) => p.name.toLowerCase().includes(newPlayerName.toLowerCase())).length === 0 &&
                      newPlayerName && (
                        <div className="p-3 text-center text-cool-gray">
                          <p>No matching players found</p>
                          <p className="text-xs mt-1">Enter the full username to add a new player</p>
                        </div>
                      )}
                    {players.filter((p) => p.name.toLowerCase().includes(newPlayerName.toLowerCase())).length === 0 &&
                      !newPlayerName && (
                        <div className="p-3 text-center text-cool-gray">
                          <p>Start typing to search players</p>
                        </div>
                      )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={addNewPlayerToList}
                    disabled={!newPlayerName.trim()}
                    className="bg-linen text-night hover:bg-linen/90"
                  >
                    {getActionButtonLabel()}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {getFilteredPlayers().length > 0 ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {getFilteredPlayers().map((player) => (
              <Card
                key={player.id}
                className="border-cool-gray/30 bg-night hover:bg-night/70 hover:border-linen/50 transition-colors cursor-pointer"
                onClick={() => handlePlayerClick(player.id)}
              >
                <CardContent className="p-3">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-2">
                      <img
                        src={`https://mc-heads.net/avatar/${player.name}.png`}
                        alt={player.name}
                        className="h-12 w-12 rounded"
                      />
                      {player.isOnline && (
                        <div className="absolute -bottom-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-night" />
                      )}
                    </div>

                    <div>
                      <p className="text-linen font-medium truncate max-w-full" title={player.name}>
                        {player.name}
                      </p>
                      <div className="flex flex-wrap justify-center gap-1 mt-1">
                        {player.isOp && (
                          <div className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-sm flex items-center">
                            <Shield className="h-3 w-3 mr-1" />
                            OP
                          </div>
                        )}
                        {player.isBanned && (
                          <div className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-sm flex items-center">
                            <Ban className="h-3 w-3 mr-1" />
                            BANNED
                          </div>
                        )}
                        {whitelistEnabled && player.isWhitelisted && (
                          <div className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-sm flex items-center">
                            <UserCheck className="h-3 w-3 mr-1" />
                            WHITELISTED
                          </div>
                        )}
                      </div>
                      <p className="text-cool-gray text-xs mt-1">
                        {player.isOnline ? "Online now" : `Last seen: ${player.lastSeen}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
      </Tabs>

      {/* Player Actions Dialog */}
      {selectedPlayerData && (
        <PlayerActionsDialog
          player={selectedPlayerData}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAction={(action, playerId, reason) => handlePlayerAction(action.id, playerId, reason) }
        />
      )}
    </div>
  )
}
