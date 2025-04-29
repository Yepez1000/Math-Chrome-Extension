"use client"

import { useState } from "react"
import { ServerStartupScreen } from "@/components/setup-wizard/server-startup-screen"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"
import type { ServerConfig } from "@/components/setup-wizard/setup-wizard"

export default function ServerStartupPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  // Mock config for demonstration purposes
  // In a real app, this would be fetched from a store or passed via state
  const [config] = useState<ServerConfig>({
    minecraftPath: "C:\\Users\\Username\\AppData\\Roaming\\.minecraft",
    isModded: false,
    serverType: "vanilla",
    ram: 4,
    hostingMode: "play+host",
    serverDirectory: "C:\\MinecraftServers\\MyServer",
  })

  return (
    <main className="container mx-auto py-10 px-4 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-4xl">
        <ServerStartupScreen
          config={config}
          onComplete={() => {
            toast({
              title: "Server started successfully",
              description: "Redirecting to dashboard...",
            })
            // Navigate to dashboard
            navigate("/dashboard")
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
