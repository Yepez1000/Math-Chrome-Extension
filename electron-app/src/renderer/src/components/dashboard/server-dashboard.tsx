"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"
import { ServerHeader } from "./server-header"
import { ServerStats } from "./server-stats"
import { ServerControls } from "./server-controls"
import { PerformanceGraphs } from "./performance/performance-graphs"
import { PlayersList } from "./players/players-list"
import { PlayersManagement } from "./players/players-management"
import { ServerSettings } from "./settings/server-settings"
import { BackupManagement } from "./backups/backup-management"
import { SchedulerManagement } from "./scheduler/scheduler-management"
import { PluginsManagement } from "./plugins/plugins-management"
import { ConsoleView } from "./console/console-view"
import { LayoutDashboard, Terminal, Puzzle, Users, Archive, Calendar, Settings, Folder } from "lucide-react"
import { useServerStore } from "@/lib/store"

export function ServerDashboard() {
  const { toast } = useToast()
  const { status, serverPath, updatePerformance } = useServerStore()
  const [activeTab, setActiveTab] = useState("dashboard")

  // Simulate updating performance metrics
  useEffect(() => {
    const interval = setInterval(() => {
      // Only update if the server is online
      if (status === "online") {
        // Simulate CPU and RAM fluctuations
        const newCpu = Math.max(1, Math.min(100, Math.random() * 15 + 2)) // Between 2-17%
        const newRam = Math.floor(Math.max(1000, Math.min(4000, 2000 + Math.random() * 1000))) // Between 2000-3000 MB

        // Update the store
        updatePerformance(newCpu, newRam)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [status, updatePerformance])

  const openServerFolder = () => {
    // In a real app, this would use IPC to open the folder
    toast({
      title: "Opening server folder",
      description: `Opening: ${serverPath}`,
    })
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <ServerHeader />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          {/* Left side - Main content */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="border-cool-gray/30 bg-space-cadet shadow-lg">
              <CardContent className="p-0">
                <ServerControls />
              </CardContent>
            </Card>

            <Card className="border-cool-gray/30 bg-space-cadet shadow-lg">
              <CardContent className="p-0">
                <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="flex items-center justify-between border-b border-cool-gray/20 bg-night/20">
                    <TabsList className="rounded-none bg-transparent p-0">
                      <TabsTrigger
                        value="dashboard"
                        className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray hover:text-linen hover:bg-night/30 transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Dashboard
                      </TabsTrigger>
                      <TabsTrigger
                        value="console"
                        className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray hover:text-linen hover:bg-night/30 transition-colors"
                      >
                        <Terminal className="h-4 w-4 mr-2" />
                        Console
                      </TabsTrigger>
                      <TabsTrigger
                        value="plugins"
                        className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray hover:text-linen hover:bg-night/30 transition-colors"
                      >
                        <Puzzle className="h-4 w-4 mr-2" />
                        Plugins
                      </TabsTrigger>
                      <TabsTrigger
                        value="players"
                        className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray hover:text-linen hover:bg-night/30 transition-colors"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Players
                      </TabsTrigger>
                      <TabsTrigger
                        value="backups"
                        className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray hover:text-linen hover:bg-night/30 transition-colors"
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Backups
                      </TabsTrigger>
                      <TabsTrigger
                        value="scheduler"
                        className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray hover:text-linen hover:bg-night/30 transition-colors"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Scheduler
                      </TabsTrigger>
                      <TabsTrigger
                        value="settings"
                        className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray hover:text-linen hover:bg-night/30 transition-colors"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </TabsTrigger>
                    </TabsList>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={openServerFolder}
                      className="mr-2 text-cool-gray hover:text-linen hover:bg-night/50"
                      title="Open Server Folder"
                    >
                      <Folder className="h-5 w-5" />
                    </Button>
                  </div>

                  <TabsContent value="dashboard" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <div className="space-y-6">
                      <ServerStats />
                      <PerformanceGraphs />
                    </div>
                  </TabsContent>

                  <TabsContent value="console" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <ConsoleView />
                  </TabsContent>

                  <TabsContent value="plugins" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <PluginsManagement />
                  </TabsContent>

                  <TabsContent value="players" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <PlayersManagement serverStatus={status} />
                  </TabsContent>

                  <TabsContent value="backups" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <BackupManagement />
                  </TabsContent>

                  <TabsContent value="scheduler" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <SchedulerManagement />
                  </TabsContent>

                  <TabsContent value="settings" className="p-6 focus-visible:outline-none focus-visible:ring-0">
                    <ServerSettings />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right side - Players list */}
          <div className="lg:col-span-1">
            <PlayersList />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
