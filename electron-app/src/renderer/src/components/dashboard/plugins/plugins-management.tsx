"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Puzzle, Search, RefreshCw, Plus } from "lucide-react"
import { InstalledPluginsList } from "./installed-plugins-list"
import { PluginRepository } from "./plugin-repository"
import { usePluginsStore } from "@/lib/plugins-store"

export function PluginsManagement() {
  const { toast } = useToast()
  const { refreshPlugins, isRefreshing } = usePluginsStore()
  const [activeTab, setActiveTab] = useState("installed")
  const [searchQuery, setSearchQuery] = useState("")

  const handleRefreshPlugins = async () => {
    try {
      await refreshPlugins()
      toast({
        title: "Plugins refreshed",
        description: "Plugin list has been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: String(error),
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-linen">Plugin Management</h2>
          <p className="text-cool-gray">Install, configure, and manage your server plugins</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefreshPlugins}
            disabled={isRefreshing}
            className="border-cool-gray text-linen hover:bg-cool-gray/10"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {activeTab === "installed" && (
            <Button onClick={() => setActiveTab("repository")} className="bg-linen text-night hover:bg-linen/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Plugin
            </Button>
          )}
        </div>
      </div>

      <Card className="border-cool-gray/30 bg-space-cadet shadow-lg">
        <CardContent className="p-0">
          <Tabs defaultValue="installed" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between border-b border-cool-gray/20 bg-night/20 px-4">
              <TabsList className="rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="installed"
                  className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray hover:text-linen hover:bg-night/30 transition-colors"
                >
                  <Puzzle className="h-4 w-4 mr-2" />
                  Installed Plugins
                </TabsTrigger>
                <TabsTrigger
                  value="repository"
                  className="data-[state=active]:bg-night data-[state=active]:text-linen rounded-none border-b-2 border-transparent data-[state=active]:border-linen py-3 text-cool-gray hover:text-linen hover:bg-night/30 transition-colors"
                >
                  <Puzzle className="h-4 w-4 mr-2" />
                  Plugin Repository
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4 border-b border-cool-gray/20">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-cool-gray" />
                <Input
                  type="text"
                  placeholder={`Search ${activeTab === "installed" ? "installed plugins" : "plugin repository"}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-night border-cool-gray/30 text-linen w-full"
                />
              </div>
            </div>

            <TabsContent value="installed" className="p-0 focus-visible:outline-none focus-visible:ring-0">
              <InstalledPluginsList searchQuery={searchQuery} />
            </TabsContent>

            <TabsContent value="repository" className="p-0 focus-visible:outline-none focus-visible:ring-0">
              <PluginRepository searchQuery={searchQuery} onInstallSuccess={() => setActiveTab("installed")} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
