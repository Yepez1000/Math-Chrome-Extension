import type { PlayerAction } from "@/lib/store"
import { useServerStore } from "@/lib/store"
import { Trash2, UserCheck, UserMinus, Ban, ShieldCheck, ShieldX, Globe } from "lucide-react"

export const playerActions: PlayerAction[] = [
  {
    id: "kick",
    label: "Kick Player",
    description: "Disconnect the player from the server.",
    icon: UserMinus,
    handler: async (playerId, reason) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isOnline: false })
      // Optionally show toast or log reason
    },
  },
  {
    id: "whitelist",
    label: "Add to Whitelist",
    description: "Add the player to your server's whitelist.",
    icon: UserCheck,
    handler: async (playerId) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isWhitelisted: true })
    },
  },
  {
    id: "op",
    label: "Make Operator",
    description: "Give the player administrative privileges.",
    icon: ShieldCheck,
    className: "text-yellow-400 group-hover:text-yellow-400/80 hover:text-yellow-400/80",
    handler: async (playerId) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isOp: true })
    },
  },
  {
    id: "ban",
    label: "Ban Player",
    description: "Prevent the player from joining your server.",
    icon: Ban,
    // I don't know why but you must use group-hover to make the icon change color and normal hover to make the text change color
    className: "text-red-600 group-hover:text-red-600/80 hover:text-red-600/80",
    handler: async (playerId, reason) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isOnline: false, isBanned: true })
    },
  },
  {
    id: "unban",
    label: "Unban Player",
    description: "Allow the player to join your server again.",
    icon: ShieldCheck,
    className: "text-green-600 group-hover:text-green-600/80 hover:text-green-600/80",
    handler: async (playerId) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isBanned: false })
    },
  },
  {
    id: "deop",
    label: "Remove Operator",
    description: "Remove the player's administrative privileges.",
    icon: ShieldX,
    className: "text-red-600 group-hover:text-red-600/80 hover:text-red-600/80",
    handler: async (playerId) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isOp: false })
    },
  },
  {
    id: "unwhitelist",
    label: "Remove from Whitelist",
    description: "Remove the player from your server's whitelist.",
    className: "text-red-600 group-hover:text-red-600/80 hover:text-red-600/80",
    icon: UserMinus,
    handler: async (playerId) => {
      const { updatePlayer } = useServerStore.getState()
      updatePlayer(playerId, { isWhitelisted: false })
    },
  },
  {
    id: "banip",
    label: "Ban IP Address",
    description: "Ban the player's IP address from the server.",
    className: "text-red-600 group-hover:text-red-600/80 hover:text-red-600/80",
    icon: Globe,
    handler: async (playerId, reason) => {
      // Implement IP ban logic here
    },
  },
  {
    id: "delete",
    label: "Delete Player Data",
    description: "Permanently delete all data associated with the player.",
    className: "text-red-600 group-hover:text-red-600/80 hover:text-red-600/80",
    icon: Trash2,
    handler: async (playerId) => {
      // Implement delete logic here
    },
  },
]
