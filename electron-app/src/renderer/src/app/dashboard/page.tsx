"use client"

import { useSearchParams } from "react-router-dom"
import { useServerListStore } from "@/lib/server-list-store"
import { ServerDashboard } from "@/components/dashboard/server-dashboard"
import { useEffect } from "react"
import { useServerStore } from "@/lib/store"

export default function DashboardPage() {
  const [params] = useSearchParams();
  const serverId = params.get("serverId");
  const server = useServerListStore(s => s.servers.find(s => s.id === serverId));

  useEffect(() => {
    if (server) {
      useServerStore.getState().setServerDetails(server);
    }
  }, [server]);

  if (!server) return <div className="text-linen p-8">No server selected.</div>;

  return (
    <main className="bg-night min-h-screen">
      <ServerDashboard />
    </main>
  );
}
