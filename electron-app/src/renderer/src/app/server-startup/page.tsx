"use client"

import { useState } from "react"
import { ServerStartupScreen } from "@/components/setup-wizard/server-startup-screen"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"
import { useServerConfigStore, type ServerConfig } from "@/stores/server-config-store"
import { useServerListStore } from "@/lib/server-list-store"

export default function ServerStartupPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { config } = useServerConfigStore();
  const servers = useServerListStore(s => s.servers);

  return (
    <main className="container mx-auto py-10 px-4 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-4xl">
        <ServerStartupScreen
          onComplete={() => {
            toast({
              title: "Server started successfully",
              description: "Redirecting to dashboard...",
            })
            // Find the server by directory and navigate with its id
            const server = servers.find(s => s.serverPath === config.serverDirectory);
            if (server) {
              navigate(`/dashboard?serverId=${server.id}`);
            } else {
              navigate("/dashboard");
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
