"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { playerActions } from "@/lib/player-actions"
import { useServerStore } from "@/lib/store"
import type { PlayerData, PlayerAction } from "@/lib/store"

interface PlayerActionsDialogProps {
  player: PlayerData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (action: PlayerAction, playerId: string, reason?: string) => void
}

export function PlayerActionsDialog({ player, open, onOpenChange, onAction }: PlayerActionsDialogProps) {
  const [actionType, setActionType] = useState<PlayerAction | null>(null)
  const [actionReason, setActionReason] = useState("")
  const { serverProperties } = useServerStore()

  // Check if whitelist is enabled
  const whitelistEnabled = serverProperties.find((prop) => prop.key === "white-list")?.value === true

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setActionType(null)
      setActionReason("")
    }
    onOpenChange(open)
  }

  // Handle action selection
  const handleSelectAction = (actionId: string) => {
    const found = playerActions.find((a) => a.id === actionId)
    if (found) {
      setActionType(found)
      setActionReason("")
    }
  }

  // Execute the selected action
  const executeAction = async () => {
    if (!player || !actionType) return
    await actionType.handler(player.id, actionReason)
    // Optionally: onAction(actionType, player.id, actionReason)
    setActionType(null)
    setActionReason("")
    onOpenChange(false)
  }

  // Go back to the main options menu
  const handleBack = () => {
    setActionType(null)
    setActionReason("")
  }

  if (!player) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-space-cadet border-cool-gray/30 text-linen">
        <DialogHeader>
          <DialogTitle>
            {!actionType ? "Player Actions" : actionType.label}
          </DialogTitle>
          <DialogDescription className="text-cool-gray">
            {!actionType ? `Select an action for ${player.name}` : actionType.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={`https://mc-heads.net/avatar/${player.name}.png`}
              alt={player.name}
              className="h-10 w-10 rounded"
            />
            <div>
              <p className="text-linen font-medium">{player.name}</p>
              {player.lastSeen && (
                <p className="text-cool-gray text-xs">
                  {player.isOnline ? "Online now" : `Last seen: ${player.lastSeen}`}
                </p>
              )}
            </div>
          </div>

          {!actionType ? (
            <div className="grid grid-cols-1 gap-2">
              {playerActions.filter(action => {
                if (action.id === "kick" && !player.isOnline) return false
                if (action.id === "banip" && !player.isOnline) return false
                if ((action.id === "whitelist" || action.id === "unwhitelist") && !whitelistEnabled) return false
                if (action.id === "ban" && player.isBanned) return false
                if (action.id === "unban" && !player.isBanned) return false
                if (action.id === "op" && player.isOp) return false
                if (action.id === "deop" && !player.isOp) return false
                if (action.id === "whitelist" && player.isWhitelisted) return false
                if (action.id === "unwhitelist" && !player.isWhitelisted) return false
                return true
              }).map(action => (
                <Button
                  key={action.id}
                  onClick={() => handleSelectAction(action.id)}
                  variant="outline"
                  className={`justify-start border-cool-gray/30 text-linen hover:bg-night/50${action.id === "delete" ? " text-red-400" : ""}`}
                >
                  {/* You can add icons here if needed using action.icon */}
                  {action.label}
                </Button>
              ))}
            </div>
          ) : (
            <>
              {/* Show reason input for kick, ban, and banip actions */}
              {["kick", "ban", "banip"].includes(actionType.id) && (
                <div className="space-y-2">
                  <Label htmlFor="action-reason" className="text-linen">
                    Reason (Optional)
                  </Label>
                  <Textarea
                    id="action-reason"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={`Enter reason for ${actionType.label.toLowerCase()}`}
                    className="bg-night border-cool-gray/30 text-linen"
                  />
                </div>
              )}
              {/* Show warning for delete action */}
              {actionType.id === "delete" && (
                <div className="bg-night/50 p-3 rounded border border-red-500/30 text-cool-gray">
                  <p className="text-red-400 font-medium mb-1">Warning: This action cannot be undone</p>
                  <p>
                    This will permanently delete all data associated with {player.name}, including their player file,
                    statistics, and advancements.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {actionType ? (
            <>
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-cool-gray text-linen hover:bg-cool-gray/10"
              >
                Back
              </Button>
              <Button
                onClick={executeAction}
                className={
                  actionType.id === "kick" || actionType.id === "ban" || actionType.id === "banip" || actionType.id === "delete"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-linen text-night hover:bg-linen/90"
                }
              >
                Confirm
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-cool-gray text-linen hover:bg-cool-gray/10"
            >
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
