"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Download, RefreshCw, Save, AlertTriangle, FileText, Info, Link2 } from "lucide-react"
import { usePluginsStore } from "@/lib/plugins-store"
import type { Plugin, RepositoryPlugin } from "@/lib/plugins-store"

interface PluginDetailsDialogProps {
  plugin: Plugin | RepositoryPlugin
  open: boolean
  onOpenChange: (open: boolean) => void
  isServerRunning: boolean
  isRepository?: boolean
}

export function PluginDetailsDialog({
  plugin,
  open,
  onOpenChange,
  isServerRunning,
  isRepository = false,
}: PluginDetailsDialogProps) {
  const { toast } = useToast()
  const { updatePluginConfig, installPlugin } = usePluginsStore()
  const [activeTab, setActiveTab] = useState("details")
  const [configValue, setConfigValue] = useState(
    isRepository ? "" : (plugin as Plugin).configContent || "# No configuration available",
  )
  const [isSaving, setSaving] = useState(false)
  const [isInstalling, setInstalling] = useState(false)

  const handleSaveConfig = async () => {
    if (!isServerRunning) {
      toast({
        title: "Server offline",
        description: "The server must be running to update plugin configuration.",
        variant: "destructive",
      })
      return
    }

    if (isRepository) return

    setSaving(true)

    try {
      await updatePluginConfig(plugin.id, configValue)
      toast({
        title: "Configuration saved",
        description: `${plugin.name} configuration has been updated successfully.`,
      })
    } catch (error) {
      toast({
        title: "Save failed",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleInstallPlugin = async () => {
    if (!isServerRunning) {
      toast({
        title: "Server offline",
        description: "The server must be running to install plugins.",
        variant: "destructive",
      })
      return
    }

    if (!isRepository) return

    setInstalling(true)

    try {
      await installPlugin(plugin.id)
      toast({
        title: "Plugin installed",
        description: `${plugin.name} has been installed successfully.`,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Installation failed",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setInstalling(false)
    }
  }

  // Repository plugin specific properties
  const repoPlugin = isRepository ? (plugin as RepositoryPlugin) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-space-cadet border-cool-gray/30 text-linen max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-night flex items-center justify-center">
              {isRepository && repoPlugin?.iconUrl ? (
                <img src={repoPlugin.iconUrl || "/placeholder.svg"} alt={plugin.name} className="h-6 w-6" />
              ) : (
                <FileText className="h-5 w-5 text-linen" />
              )}
            </div>
            <div>
              <DialogTitle className="text-linen">{plugin.name}</DialogTitle>
              <DialogDescription className="text-cool-gray">
                Version {plugin.version} by {plugin.author}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="bg-night border border-cool-gray/30 mb-4">
            <TabsTrigger value="details" className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen">
              <Info className="h-4 w-4 mr-2" />
              Details
            </TabsTrigger>
            {!isRepository && (
              <TabsTrigger value="config" className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen">
                <FileText className="h-4 w-4 mr-2" />
                Configuration
              </TabsTrigger>
            )}
          </TabsList>

          <div className="overflow-y-auto pr-2" style={{ maxHeight: "calc(90vh - 220px)" }}>
            <TabsContent value="details" className="focus-visible:outline-none focus-visible:ring-0 mt-0">
              <div className="space-y-4">
                <div>
                  <h3 className="text-linen font-medium mb-2">Description</h3>
                  <p className="text-cool-gray">{plugin.description}</p>
                </div>

                {isRepository && repoPlugin && (
                  <>
                    <div>
                      <h3 className="text-linen font-medium mb-2">Categories</h3>
                      <div className="flex flex-wrap gap-2">
                        {repoPlugin.categories.map((category) => (
                          <Badge key={category} className="bg-night text-cool-gray border border-cool-gray/30">
                            {category}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-linen font-medium mb-2">Details</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between border-b border-cool-gray/20 pb-1">
                          <span className="text-cool-gray">Downloads</span>
                          <span className="text-linen">{repoPlugin.downloads.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-cool-gray/20 pb-1">
                          <span className="text-cool-gray">Last Updated</span>
                          <span className="text-linen">{repoPlugin.lastUpdated}</span>
                        </div>
                        <div className="flex justify-between border-b border-cool-gray/20 pb-1">
                          <span className="text-cool-gray">File Size</span>
                          <span className="text-linen">{repoPlugin.fileSize}</span>
                        </div>
                        <div className="flex justify-between border-b border-cool-gray/20 pb-1">
                          <span className="text-cool-gray">License</span>
                          <span className="text-linen">{repoPlugin.license}</span>
                        </div>
                      </div>
                    </div>

                    {repoPlugin.dependencies.length > 0 && (
                      <div>
                        <h3 className="text-linen font-medium mb-2">Dependencies</h3>
                        <ul className="list-disc list-inside text-cool-gray">
                          {repoPlugin.dependencies.map((dep) => (
                            <li key={dep}>{dep}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {repoPlugin.website && (
                      <div>
                        <h3 className="text-linen font-medium mb-2">Website</h3>
                        <Button
                          variant="outline"
                          className="border-cool-gray/30 text-linen hover:bg-night/50"
                          onClick={() => window.open(repoPlugin.website, "_blank")}
                        >
                          <Link2 className="h-4 w-4 mr-2" />
                          Visit Website
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {!isRepository && (
                  <div>
                    <h3 className="text-linen font-medium mb-2">Status</h3>
                    <Badge
                      className={`${
                        (plugin as Plugin).enabled
                          ? "bg-green-500/20 text-green-400 border-green-500/50"
                          : "bg-red-500/20 text-red-400 border-red-500/50"
                      } border`}
                    >
                      {(plugin as Plugin).enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                )}
              </div>
            </TabsContent>

            {!isRepository && (
              <TabsContent value="config" className="focus-visible:outline-none focus-visible:ring-0 mt-0">
                <div className="space-y-4">
                  {!isServerRunning && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-yellow-400 font-medium">Server is offline</p>
                        <p className="text-cool-gray text-sm">
                          You can view the configuration, but cannot save changes while the server is offline.
                        </p>
                      </div>
                    </div>
                  )}

                  <Textarea
                    value={configValue}
                    onChange={(e) => setConfigValue(e.target.value)}
                    className="font-mono text-sm bg-night border-cool-gray/30 text-linen min-h-[300px]"
                    disabled={!isServerRunning}
                  />

                  <p className="text-xs text-cool-gray">
                    Edit the configuration file directly. Changes will be applied after saving.
                  </p>
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>

        <DialogFooter className="mt-4">
          {activeTab === "config" && !isRepository ? (
            <Button
              onClick={handleSaveConfig}
              disabled={isSaving || !isServerRunning}
              className="bg-linen text-night hover:bg-linen/90"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
          ) : isRepository ? (
            <Button
              onClick={handleInstallPlugin}
              disabled={isInstalling || !isServerRunning}
              className="bg-linen text-night hover:bg-linen/90"
            >
              {isInstalling ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Install Plugin
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-cool-gray/30 text-linen hover:bg-night/50"
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
