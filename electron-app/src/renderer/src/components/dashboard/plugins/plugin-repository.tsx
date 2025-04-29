"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Download, RefreshCw, AlertTriangle, Info } from "lucide-react"
import { PluginDetailsDialog } from "./plugin-details-dialog"
import { usePluginsStore } from "@/lib/plugins-store"
import type { RepositoryPlugin } from "@/lib/plugins-store"

interface PluginRepositoryProps {
  searchQuery: string
  onInstallSuccess: () => void
}

export function PluginRepository({ searchQuery, onInstallSuccess }: PluginRepositoryProps) {
  const { toast } = useToast()
  const { repositoryPlugins, installPlugin, isServerRunning } = usePluginsStore()
  const [selectedPlugin, setSelectedPlugin] = useState<RepositoryPlugin | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({})

  // Filter plugins based on search query
  const filteredPlugins = repositoryPlugins.filter(
    (plugin) =>
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.categories.some((category) => category.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const handleInstallPlugin = async (plugin: RepositoryPlugin) => {
    if (!isServerRunning) {
      toast({
        title: "Server offline",
        description: "The server must be running to install plugins.",
        variant: "destructive",
      })
      return
    }

    setIsLoading((prev) => ({ ...prev, [plugin.id]: true }))

    try {
      await installPlugin(plugin.id)
      toast({
        title: "Plugin installed",
        description: `${plugin.name} has been installed successfully.`,
      })
      onInstallSuccess()
    } catch (error) {
      toast({
        title: "Installation failed",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setIsLoading((prev) => ({ ...prev, [plugin.id]: false }))
    }
  }

  const openPluginDetails = (plugin: RepositoryPlugin) => {
    setSelectedPlugin(plugin)
    setDetailsOpen(true)
  }

  return (
    <div className="p-4">
      {!isServerRunning && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">Server is offline</p>
            <p className="text-cool-gray text-sm">
              You cannot install plugins while the server is offline. Start the server to enable installation.
            </p>
          </div>
        </div>
      )}

      {filteredPlugins.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlugins.map((plugin) => (
            <Card
              key={plugin.id}
              className="border-cool-gray/30 bg-night hover:bg-night/70 hover:border-linen/50 transition-colors"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-space-cadet flex items-center justify-center">
                      <img
                        src={plugin.iconUrl || "/placeholder.svg?height=40&width=40"}
                        alt={plugin.name}
                        className="h-6 w-6"
                      />
                    </div>
                    <div>
                      <h3 className="text-linen font-medium">{plugin.name}</h3>
                      <p className="text-xs text-cool-gray">by {plugin.author}</p>
                    </div>
                  </div>
                  <Badge className="bg-linen/10 text-linen border border-linen/30">{plugin.version}</Badge>
                </div>

                <p className="text-cool-gray text-sm mb-3 line-clamp-2">{plugin.description}</p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {plugin.categories.map((category) => (
                    <Badge
                      key={category}
                      className="bg-space-cadet/50 text-cool-gray border border-cool-gray/30 text-xs"
                    >
                      {category}
                    </Badge>
                  ))}
                </div>

                <div className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPluginDetails(plugin)}
                    className="h-8 border-cool-gray/30 text-linen hover:bg-space-cadet/50"
                  >
                    <Info className="h-4 w-4 mr-1" />
                    Details
                  </Button>

                  <Button
                    onClick={() => handleInstallPlugin(plugin)}
                    disabled={isLoading[plugin.id] || !isServerRunning}
                    className="bg-linen text-night hover:bg-linen/90"
                    size="sm"
                  >
                    {isLoading[plugin.id] ? (
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    Install
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border border-cool-gray/30 rounded-md bg-night/50">
          <Download className="h-12 w-12 text-cool-gray mx-auto mb-4" />
          <h3 className="text-linen font-medium mb-1">No plugins found</h3>
          <p className="text-cool-gray">
            {searchQuery ? "No plugins match your search criteria" : "The plugin repository is currently empty"}
          </p>
        </div>
      )}

      {/* Plugin Details Dialog */}
      {selectedPlugin && (
        <PluginDetailsDialog
          plugin={selectedPlugin}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          isServerRunning={isServerRunning}
          isRepository
        />
      )}
    </div>
  )
}
