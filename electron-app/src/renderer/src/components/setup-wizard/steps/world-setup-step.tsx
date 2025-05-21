import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { motion } from "framer-motion"
import { FolderOpen, Globe, Sparkles, Layers } from "lucide-react"
import type { ServerConfig } from "../setup-wizard"

interface WorldSetupStepProps {
  config: ServerConfig
  updateConfig: (updates: Partial<ServerConfig>) => void
  onComplete: () => void
}

export function WorldSetupStep({ config, updateConfig, onComplete }: WorldSetupStepProps) {
  const [selectedTab, setSelectedTab] = useState("create")
  const [isImporting, setIsImporting] = useState(false)
  const [worldImported, setWorldImported] = useState(false)

  // Handle world import
  const handleImportWorld = async () => {
    setIsImporting(true);
  
    try {
      // Open file dialog for world folder
      const chosen = await window.electronAPI?.pickDirectory();
      if (!chosen) {
        setIsImporting(false);
        return;
      }
  
      const worldName = chosen.split(/[\\/]/).pop() || 'New World';
  
      // Import the world
      const result = await window.electronAPI.importWorld(chosen, worldName);
      if (!result.success) throw new Error(result.message);
  
      // Update config
      updateConfig({
        worldPath: chosen,
        worldName,
        importedWorld: true,
      });
      setWorldImported(true);
  
    } catch (err: any) {
      console.error('Import failed:', err);
      alert('Import failed: ' + err.message);
      setIsImporting(false);
      setWorldImported(false);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle world name change
  const handleWorldNameChange = (name: string) => {
    updateConfig({ worldName: name })
  }

  // Handle seed change
  const handleSeedChange = (seed: string) => {
    updateConfig({ worldSeed: seed })
  }

  // Handle world type change
  const handleWorldTypeChange = (type: string) => {
    updateConfig({ worldType: type })
  }

  // Handle generate structures toggle
  const handleGenerateStructuresChange = (checked: boolean) => {
    updateConfig({ generateStructures: checked })
  }

  return (
    <div className="space-y-6">
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold mb-2 text-linen">World Setup</h2>
        <p className="text-cool-gray">
          {config.isModded
            ? "Import an existing world or create a new one for your modded server"
            : "Import an existing world or create a new one for your vanilla server"}
        </p>
      </motion.div>

      <Tabs defaultValue="create" value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-night">
          <TabsTrigger
            value="create"
            className="data-[state=active]:bg-linen data-[state=active]:text-night text-cool-gray"
          >
            Create New World
          </TabsTrigger>
          <TabsTrigger
            value="import"
            className="data-[state=active]:bg-linen data-[state=active]:text-night text-cool-gray"
          >
            Import Existing World
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4 py-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-cool-gray/30 bg-night">
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-linen" />
                    <Label htmlFor="world-name" className="text-linen">
                      World Name
                    </Label>
                  </div>
                  <Input
                    id="world-name"
                    value={config.worldName || ""}
                    onChange={(e) => handleWorldNameChange(e.target.value)}
                    placeholder="My Minecraft World"
                    className="bg-space-cadet border-cool-gray/30 text-linen"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-linen" />
                    <Label htmlFor="world-seed" className="text-linen">
                      World Seed (Optional)
                    </Label>
                  </div>
                  <Input
                    id="world-seed"
                    value={config.worldSeed || ""}
                    onChange={(e) => handleSeedChange(e.target.value)}
                    placeholder="Leave blank for random seed"
                    className="bg-space-cadet border-cool-gray/30 text-linen"
                  />
                  <p className="text-xs text-cool-gray">
                    Enter a seed value to generate a specific world, or leave blank for a random world
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-linen" />
                    <Label htmlFor="world-type" className="text-linen">
                      World Type
                    </Label>
                  </div>
                  <Select value={config.worldType || "default"} onValueChange={handleWorldTypeChange}>
                    <SelectTrigger id="world-type" className="bg-space-cadet border-cool-gray/30 text-linen">
                      <SelectValue placeholder="Select world type" />
                    </SelectTrigger>
                    <SelectContent className="bg-space-cadet border-cool-gray/30 text-linen">
                      <SelectItem value="default" className="hover:bg-night/50 focus:bg-night/50 focus:text-linen">
                        Default
                      </SelectItem>
                      <SelectItem value="flat" className="hover:bg-night/50 focus:bg-night/50 focus:text-linen">
                        Flat
                      </SelectItem>
                      <SelectItem value="largebiomes" className="hover:bg-night/50 focus:bg-night/50 focus:text-linen">
                        Large Biomes
                      </SelectItem>
                      <SelectItem value="amplified" className="hover:bg-night/50 focus:bg-night/50 focus:text-linen">
                        Amplified
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="generate-structures"
                    checked={config.generateStructures !== false}
                    onCheckedChange={handleGenerateStructuresChange}
                    className="border-cool-gray data-[state=checked]:bg-linen data-[state=checked]:text-night"
                  />
                  <Label htmlFor="generate-structures" className="text-cool-gray cursor-pointer">
                    Generate structures (villages, temples, etc.)
                  </Label>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="import" className="space-y-4 py-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-cool-gray/30 bg-night">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-cool-gray/30 rounded-lg">
                  {!worldImported ? (
                    <>
                      <motion.div
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
                      >
                        <FolderOpen className="h-12 w-12 text-cool-gray mb-4" />
                      </motion.div>
                      <p className="mb-2 text-sm text-cool-gray">Select an existing Minecraft world folder</p>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          onClick={handleImportWorld}
                          disabled={isImporting}
                          className="mt-2 bg-linen text-night hover:bg-linen/90"
                        >
                          {isImporting ? "Importing..." : "Browse for World Folder"}
                        </Button>
                      </motion.div>
                      <p className="mt-4 text-xs text-cool-gray">Typically located in .minecraft/saves/ folder</p>
                    </>
                  ) : (
                    <motion.div
                      className="text-center"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <div className="bg-linen/10 p-3 rounded-full inline-flex mb-4">
                        <Globe className="h-10 w-10 text-linen" />
                      </div>
                      <h3 className="text-linen font-medium text-lg mb-1">World Imported</h3>
                      <p className="text-cool-gray mb-2">{config.worldPath?.split("\\").pop()}</p>
                      <p className="text-xs text-cool-gray">{config.worldPath}</p>
                      <Button
                        variant="outline"
                        onClick={handleImportWorld}
                        className="mt-4 border-cool-gray text-linen hover:bg-cool-gray/10"
                      >
                        Change World
                      </Button>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
