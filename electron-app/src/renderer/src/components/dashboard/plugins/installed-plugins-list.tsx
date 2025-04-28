"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Power, PowerOff, Settings, Trash2, RefreshCw, AlertTriangle, Puzzle } from "lucide-react"
import { PluginDetailsDialog } from "./plugin-details-dialog"
import { ConfirmDialog } from "./confirm-dialog"
import { usePluginsStore } from "@/lib/plugins-store"
import type { Plugin } from "@/lib/plugins-store"

interface InstalledPluginsListProps {
  searchQuery: string
}

export function InstalledPluginsList({ searchQuery }: InstalledPluginsListProps) {
  const { toast } = useToast()
  const { plugins, togglePlugin, removePlugin, isServerRunning } = usePluginsStore()
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [pluginToRemove, setPluginToRemove] = useState<Plugin | null>(null)
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({})

  // Filter plugins based on search query
  const filteredPlugins = plugins.filter(
    (plugin) =>
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.author.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleTogglePlugin = async (plugin: Plugin) => {
    if (!isServerRunning) {
      toast({
        title: "Server offline",
        description: "The server must be running to enable or disable plugins.",
        variant: "destructive",
      })
      return
    }

    setIsLoading((prev) => ({ ...prev, [plugin.id]: true }))

    try {
      await togglePlugin(plugin.id)
      toast({
        title: plugin.enabled ? "Plugin disabled" : "Plugin enabled",
        description: `${plugin.name} has been ${plugin.enabled ? "disabled" : "enabled"} successfully.`,
      })
    } catch (error) {
      toast({
        title: "Action failed",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setIsLoading((prev) => ({ ...prev, [plugin.id]: false }))
    }
  }

  const handleRemovePlugin = async () => {
    if (!pluginToRemove) return

    if (!isServerRunning) {
      toast({
        title: "Server offline",
        description: "The server must be running to remove plugins.",
        variant: "destructive",
      })
      return
    }

    setIsLoading((prev) => ({ ...prev, [pluginToRemove.id]: true }))

    try {
      await removePlugin(pluginToRemove.id)
      toast({
        title: "Plugin removed",
        description: `${pluginToRemove.name} has been removed successfully.`,
      })
      setConfirmDialogOpen(false)
      setPluginToRemove(null)
    } catch (error) {
      toast({
        title: "Removal failed",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setIsLoading((prev) => ({ ...prev, [pluginToRemove.id]: false }))
    }
  }

  const openPluginDetails = (plugin: Plugin) => {
    setSelectedPlugin(plugin)
    setDetailsOpen(true)
  }

  const confirmRemovePlugin = (plugin: Plugin) => {
    setPluginToRemove(plugin)
    setConfirmDialogOpen(true)
  }

  return (
    <div className="p-0">
      {!isServerRunning && (
        <div className="mx-4 my-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium">Server is offline</p>
            <p className="text-cool-gray text-sm">
              Plugin management actions are limited while the server is offline. Start the server to enable all
              features.
            </p>
          </div>
        </div>
      )}

      {filteredPlugins.length > 0 ? (
        <div className="rounded overflow-hidden">
          <Table>
            <TableHeader className="bg-night">
              <TableRow>
                <TableHead className="text-linen">Plugin</TableHead>
                <TableHead className="text-linen">Version</TableHead>
                <TableHead className="text-linen">Author</TableHead>
                <TableHead className="text-linen">Status</TableHead>
                <TableHead className="text-linen text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlugins.map((plugin) => (
                <TableRow key={plugin.id} className="border-cool-gray/20 hover:bg-night/50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-night flex items-center justify-center">
                        <Puzzle className="h-4 w-4 text-linen" />
                      </div>
                      <div>
                        <p className="text-linen">{plugin.name}</p>
                        <p className="text-xs text-cool-gray truncate max-w-[300px]">{plugin.description}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-cool-gray">{plugin.version}</TableCell>
                  <TableCell className="text-cool-gray">{plugin.author}</TableCell>
                  <TableCell>
                    <Badge
                      className={`${
                        plugin.enabled
                          ? "bg-green-500/20 text-green-400 border-green-500/50"
                          : "bg-red-500/20 text-red-400 border-red-500/50"
                      } border`}
                    >
                      {plugin.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePlugin(plugin)}
                        disabled={isLoading[plugin.id] || !isServerRunning}
                        className="h-8 border-cool-gray/30 text-linen hover:bg-night/50"
                        title={plugin.enabled ? "Disable Plugin" : "Enable Plugin"}
                      >
                        {isLoading[plugin.id] ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : plugin.enabled ? (
                          <PowerOff className="h-4 w-4 text-red-400" />
                        ) : (
                          <Power className="h-4 w-4 text-green-400" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPluginDetails(plugin)}
                        className="h-8 border-cool-gray/30 text-linen hover:bg-night/50"
                        title="Plugin Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirmRemovePlugin(plugin)}
                        disabled={isLoading[plugin.id] || !isServerRunning}
                        className="h-8 border-cool-gray/30 text-red-400 hover:bg-night/50"
                        title="Remove Plugin"
                      >
                        {isLoading[plugin.id] ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 border border-cool-gray/30 rounded-md bg-night/50 mx-4 my-4">
          <Puzzle className="h-12 w-12 text-cool-gray mx-auto mb-4" />
          <h3 className="text-linen font-medium mb-1">No plugins found</h3>
          <p className="text-cool-gray">
            {searchQuery
              ? "No plugins match your search criteria"
              : "Your server doesn't have any plugins installed yet"}
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
        />
      )}

      {/* Confirm Remove Dialog */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="Remove Plugin"
        description={`Are you sure you want to remove ${pluginToRemove?.name}? This action cannot be undone.`}
        onConfirm={handleRemovePlugin}
      />
    </div>
  )
}
