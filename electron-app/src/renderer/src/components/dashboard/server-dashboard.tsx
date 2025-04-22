"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useToast } from "@/lib/hooks/use-toast"
import { motion } from "framer-motion"
import { ServerHeader } from "./server-header"
import { ServerStats } from "./server-stats"
import { ServerControls } from "./server-controls"
import { PerformanceGraphs } from "./performance-graphs"
import { PlayersList } from "./players-list"
import { LayoutDashboard, Terminal, Puzzle, Users, Archive, Calendar, Settings } from "lucide-react"

export function ServerDashboard() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [serverStatus, setServerStatus] = useState<"online" | "offline" | "starting" | "stopping">("online")
  const [serverStats, setServerStats] = useState({
    cpu: 6,
    ram: 2326,
    uptime: 37,
    maxPlayers: 40,
    onlinePlayers: 9,
    version: "Purpur 1.19",
    address: "88.77.66.55:25565",
  })

  // Mock function to update stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setServerStats((prev) => ({
        ...prev,
        cpu: Math.max(1, Math.min(100, prev.cpu + (Math.random() * 2 - 1))),
        ram: Math.floor(Math.max(1000, Math.min(4000, prev.ram + (Math.random() * 100 - 50)))),
        uptime: prev.uptime + 1,
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleServerControl = (action: "start" | "stop" | "restart" | "kill") => {
    // In a real app, this would call an API or IPC
    if (action === "stop") {
      setServerStatus("stopping")
      setTimeout(() => setServerStatus("offline"), 2000)
      toast({
        title: "Server stopping",
        description: "Your Minecraft server is shutting down...",
      })
    } else if (action === "start") {
      setServerStatus("starting")
      setTimeout(() => setServerStatus("online"), 3000)
      toast({
        title: "Server starting",
        description: "Your Minecraft server is starting up...",
      })
    } else if (action === "restart") {
      setServerStatus("stopping")
      toast({
        title: "Server restarting",
        description: "Your Minecraft server is restarting...",
      })
      setTimeout(() => {
        setServerStatus("starting")
        setTimeout(() => setServerStatus("online"), 3000)
      }, 2000)
    } else if (action === "kill") {
      setServerStatus("offline")
      toast({
        title: "Server killed",
        description: "Your Minecraft server has been forcefully terminated.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <ServerHeader
          serverName="My Purpur Server"
          status={serverStatus}
          version={serverStats.version}
          address={serverStats.address}
          playerCount={`${serverStats.onlinePlayers}/${serverStats.maxPlayers}`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          {/* Left side - Main content */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="border-cool-gray/30 bg-space-cadet shadow-lg">
              <CardContent className="p-0">
                <ServerControls status={serverStatus} onAction={handleServerControl} />
              </CardContent>
            </Card>

            <Card className="border-cool-gray/30 bg-space-cadet shadow-lg">
              <CardContent className="p-0">
                <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full justify-start rounded-none border-b border-cool-gray/20 bg-night/20 p-0">
                    <TabsTrigger
                      value="dashboard"
                      className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray"
                    >
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      Dashboard
                    </TabsTrigger>
                    <TabsTrigger
                      value="console"
                      className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray"
                    >
                      <Terminal className="h-4 w-4 mr-2" />
                      Console
                    </TabsTrigger>
                    <TabsTrigger
                      value="plugins"
                      className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray"
                    >
                      <Puzzle className="h-4 w-4 mr-2" />
                      Plugins
                    </TabsTrigger>
                    <TabsTrigger
                      value="players"
                      className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Players
                    </TabsTrigger>
                    <TabsTrigger
                      value="backups"
                      className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Backups
                    </TabsTrigger>
                    <TabsTrigger
                      value="scheduler"
                      className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Scheduler
                    </TabsTrigger>
                    <TabsTrigger
                      value="settings"
                      className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="dashboard" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className="space-y-6">
                      <ServerStats cpu={serverStats.cpu} ram={serverStats.ram} uptime={serverStats.uptime} />

                      <PerformanceGraphs cpu={serverStats.cpu} ram={serverStats.ram} />
                    </div>
                  </TabsContent>

                  <TabsContent value="console" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className="bg-night rounded-md p-4 h-[400px] overflow-y-auto font-mono text-sm text-cool-gray">
                      <p>[12:34:56 INFO]: Server started</p>
                      <p>[12:34:57 INFO]: Loading properties</p>
                      <p>[12:34:58 INFO]: Starting Minecraft server on 88.77.66.55:25565</p>
                      <p>[12:35:01 INFO]: Preparing level "world"</p>
                      <p>[12:35:05 INFO]: Done! For help, type "help"</p>
                      <p>[12:35:10 INFO]: Player jamoír joined the game</p>
                      <p>[12:35:15 INFO]: Player Daleth joined the game</p>
                      <p className="text-linen">[12:35:20 INFO]: Player RockDigger joined the game</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="plugins" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className="text-cool-gray">
                      <p>Plugins content will go here</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="players" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className="text-cool-gray">
                      <p>Players management content will go here</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="backups" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className="text-cool-gray">
                      <p>Backups content will go here</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="scheduler" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className="text-cool-gray">
                      <p>Scheduler content will go here</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="settings" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className="text-cool-gray">
                      <p>Settings content will go here</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right side - Players list */}
          <div className="lg:col-span-1">
            <PlayersList onlinePlayers={serverStats.onlinePlayers} maxPlayers={serverStats.maxPlayers} />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
