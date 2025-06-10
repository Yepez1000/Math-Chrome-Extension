"use client"

import { useEffect } from "react"
import { ServerStartupScreen } from "@/components/setup-wizard/server-startup-screen"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"
import { useServerListStore } from "@/lib/servers-store"

export default function ServerStartupPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const selectedServerId = useServerListStore(state => state.selectedServerId)

  return (
    <main className="container mx-auto py-10 px-4 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-4xl">
        <ServerStartupScreen
          onComplete={() => {
            if (selectedServerId) {
              navigate(`/dashboard?serverId=${selectedServerId}`)
            } else {
              console.error("No server selected after creation")
              navigate("/dashboard")
            }
          }}
          onRetry={() => {
            toast({
              title: "Retrying server startup",
              description: "Attempting to start the server again...",
            })
          }}
        />
      </div>
    </main>
  )
}
