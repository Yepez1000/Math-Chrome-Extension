"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"
import type { ServerConfig } from "../setup-wizard"
import { Blocks, CuboidIcon as Cube, Cpu } from "lucide-react"

interface FlavorSelectionStepProps {
  config: ServerConfig
  updateConfig: (updates: Partial<ServerConfig>) => void
  onComplete: () => void
}

export function FlavorSelectionStep({ config, updateConfig, onComplete }: FlavorSelectionStepProps) {
  const selectVanilla = () => {
    updateConfig({ isModded: false })
  }

  const selectModded = () => {
    updateConfig({ isModded: true })
  }

  const handleHostingModeChange = (value: "play+host" | "host") => {
    updateConfig({ hostingMode: value })
  }

  const cardVariants = {
    inactive: { scale: 1 },
    active: { scale: 1.02, transition: { type: "spring", stiffness: 300, damping: 10 } },
  }

  return (
    <div className="space-y-8">
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold mb-2 text-linen">Choose Server Type</h2>
        <p className="text-cool-gray">Would you like to run a vanilla Minecraft server or a modded one?</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          whileHover="active"
          variants={cardVariants}
        >
          <Card
            className={`cursor-pointer transition-all hover:border-linen ${
              !config.isModded ? "border-linen bg-linen/5" : "border-cool-gray/30 bg-night"
            }`}
            onClick={selectVanilla}
          >
            <CardHeader>
              <motion.div
                className="flex justify-center mb-2"
                animate={{ rotate: !config.isModded ? [0, 5, 0, -5, 0] : 0 }}
                transition={{ duration: 0.5, delay: 0.5, repeat: !config.isModded ? 1 : 0 }}
              >
                <Cube className={`h-12 w-12 ${!config.isModded ? "text-linen" : "text-cool-gray"}`} />
              </motion.div>
              <CardTitle className="text-center text-linen">Vanilla Server</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-cool-gray">
                The classic Minecraft experience without any modifications. Simple to set up and compatible with all
                vanilla clients.
              </CardDescription>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button
                variant={!config.isModded ? "default" : "outline"}
                onClick={selectVanilla}
                className={`w-full ${
                  !config.isModded
                    ? "bg-linen text-night hover:bg-linen/90"
                    : "border-cool-gray text-linen hover:bg-cool-gray/10 bg-night"
                }`}
              >
                Select Vanilla
              </Button>
            </CardFooter>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          whileHover="active"
          variants={cardVariants}
        >
          <Card
            className={`cursor-pointer transition-all hover:border-linen ${
              config.isModded ? "border-linen bg-linen/5" : "border-cool-gray/30 bg-night"
            }`}
            onClick={selectModded}
          >
            <CardHeader>
              <motion.div
                className="flex justify-center mb-2"
                animate={{ rotate: config.isModded ? [0, 5, 0, -5, 0] : 0 }}
                transition={{ duration: 0.5, delay: 0.5, repeat: config.isModded ? 1 : 0 }}
              >
                <Blocks className={`h-12 w-12 ${config.isModded ? "text-linen" : "text-cool-gray"}`} />
              </motion.div>
              <CardTitle className="text-center text-linen">Modded Server</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-cool-gray">
                Enhanced Minecraft with mods. Supports Forge and Fabric modpacks for a customized gameplay experience. Requires more RAM to run smoothly.
              </CardDescription>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button
                variant={config.isModded ? "default" : "outline"}
                onClick={selectModded}
                className={`w-full ${
                  config.isModded
                    ? "bg-linen text-night hover:bg-linen/90"
                    : "border-cool-gray text-linen hover:bg-cool-gray/10 bg-night"
                }`}
              >
                Select Modded
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>

      {/* Hosting mode selection */}
      <motion.div
        className="mt-8 pt-6 border-t border-cool-gray/20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, repeatType: "loop", ease: "linear" }}
            >
              <Cpu className="h-5 w-5 text-linen" />
            </motion.div>
            <h3 className="text-lg font-medium text-linen">How will you use this server?</h3>
          </div>

          <Card className="border-cool-gray/30 bg-night">
            <CardContent className="pt-6">
              <RadioGroup
                defaultValue={config.hostingMode}
                onValueChange={(value) => handleHostingModeChange(value as "play+host" | "host")}
                className="space-y-4"
              >
                <motion.div className="flex items-start space-x-3" whileHover={{ x: 5 }}>
                  <RadioGroupItem value="play+host" id="play-host" className="mt-1 border-linen text-linen" />
                  <div>
                    <Label htmlFor="play-host" className="font-medium text-linen cursor-pointer">
                      Playing + Hosting
                    </Label>
                    <p className="text-sm text-cool-gray mt-1">
                      I'll be playing on the same computer that's hosting the server
                    </p>
                    {config.hostingMode === "play+host" && (
                      <motion.div
                        className="mt-2 text-xs bg-linen/5 p-2 rounded border border-linen/20 text-cool-gray"
                        initial={{ opacity: 0, height: "auto" }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        <strong className="text-linen">Recommendation:</strong> For{" "}
                        {config.isModded ? "modded" : "vanilla"} servers where you're also playing, allocate at least{" "}
                        {config.isModded ? "6-8GB" : "4GB"} of RAM for optimal performance, while leaving at least{" "}
                        {config.isModded ? "6-8GB" : "4GB"} of RAM for the game client.
                      </motion.div>
                    )}
                  </div>
                </motion.div>
                <motion.div className="flex items-start space-x-3" whileHover={{ x: 5 }}>
                  <RadioGroupItem value="host" id="host-only" className="mt-1 border-linen text-linen" />
                  <div>
                    <Label htmlFor="host-only" className="font-medium text-linen cursor-pointer">
                      Hosting Only
                    </Label>
                    <p className="text-sm text-cool-gray mt-1">
                      This computer will only run the server, not the game client
                    </p>
                    {config.hostingMode === "host" && (
                      <motion.div
                        className="mt-2 text-xs bg-linen/5 p-2 rounded border border-linen/20 text-cool-gray"
                        initial={{ opacity: 0, height: "auto" }}
                        animate={{ opacity: 1, height: "auto" }}
                      >
                        <strong className="text-linen">Recommendation:</strong> For dedicated{" "}
                        {config.isModded ? "modded" : "vanilla"} servers, allocate at least{" "}
                        {config.isModded ? "4-6GB" : "2-3GB"} of RAM for optimal performance.
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      </motion.div>

    </div>
  )
}
