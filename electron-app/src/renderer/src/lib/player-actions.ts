import type { PlayerAction } from "@/lib/store"
import { useServerStore } from "@/lib/store"

export const playerActions: PlayerAction[] = [
  {
    id: "kick",
    label: "Kick Player",
    description: "Disconnect the player from the server.",
    icon: "UserMinus",
    handler: async (playerId, reason) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isOnline: false })
      // Optionally show toast or log reason
    },
  },
  {
    id: "ban",
    label: "Ban Player",
    description: "Prevent the player from joining your server.",
    icon: "Ban",
    handler: async (playerId, reason) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isOnline: false, isBanned: true })
    },
  },
  {
    id: "unban",
    label: "Unban Player",
    description: "Allow the player to join your server again.",
    icon: "ShieldCheck",
    handler: async (playerId) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isBanned: false })
    },
  },
  {
    id: "op",
    label: "Make Operator",
    description: "Give the player administrative privileges.",
    icon: "ShieldCheck",
    handler: async (playerId) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isOp: true })
    },
  },
  {
    id: "deop",
    label: "Remove Operator",
    description: "Remove the player's administrative privileges.",
    icon: "ShieldX",
    handler: async (playerId) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isOp: false })
    },
  },
  {
    id: "whitelist",
    label: "Add to Whitelist",
    description: "Add the player to your server's whitelist.",
    icon: "UserCheck",
    handler: async (playerId) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isWhitelisted: true })
    },
  },
  {
    id: "unwhitelist",
    label: "Remove from Whitelist",
    description: "Remove the player from your server's whitelist.",
    icon: "UserMinus",
    handler: async (playerId) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isWhitelisted: false })
    },
  },
  {
    id: "banip",
    label: "Ban IP Address",
    description: "Ban the player's IP address from the server.",
    icon: "Globe",
    handler: async (playerId, reason) => {
      // Implement IP ban logic here
    },
  },
  {
    id: "delete",
    label: "Delete Player Data",
    description: "Permanently delete all data associated with the player.",
    icon: "Trash2",
    handler: async (playerId) => {
      // Implement delete logic here
    },
  },
]
