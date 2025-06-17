"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { motion, AnimatePresence } from "framer-motion"
import { CuboidIcon as Cube, Cpu, Zap, Leaf, Hammer, Feather, Archive, ChevronDown, ChevronUp} from "lucide-react"
import { useServerConfigStore, ServerConfig } from "@/stores/server-config-store"
import { useFlavorSelectionStore } from "@/stores/step-stores"
import { ServerTypeCard, ServerTypeInfo } from "../components/server-type-card"

interface FlavorSelectionStepProps {
  onComplete: () => void
}

type ServerType = ServerConfig["serverType"]

// Server type data moved outside component to avoid recreation
const serverTypes: ServerTypeInfo[] = [
  {
    id: "vanilla",
    name: "Vanilla",
    description: "The unmodified, official Minecraft experience as provided by Mojang.",
    icon: Cube,
    isModded: false,
    performance: 3,
    plugins: false,
    mods: false,
    recommended: true,
  },
  {
    id: "paper",
    name: "Paper",
    description: "An optimized fork of Spigot, offering better performance and additional configuration options.",
    icon: Leaf,
    isModded: false,
    performance: 5,
    plugins: true,
    mods: false,
  },
  {
    id: "forge",
    name: "Forge",
    description: "A modding platform that allows the addition of custom mods to the game.",
    icon: Hammer,
    isModded: true,
    performance: 2,
    plugins: false,
    mods: true,
  },
  {
    id: "spigot",
    name: "Spigot",
    description: "A high-performance fork of Bukkit, supporting plugins to enhance gameplay.",
    icon: Zap,
    isModded: false,
    performance: 4,
    plugins: true,
    mods: false,
  },
  {
    id: "fabric",
    name: "Fabric",
    description: "A lightweight, modular modding platform known for its quick updates and performance.",
    icon: Feather,
    isModded: true,
    performance: 3,
    plugins: false,
    mods: true,
  },
  {
    id: "bukkit",
    name: "Bukkit",
    description: "An older, plugin-based server platform that laid the foundation for Spigot and Paper.",
    icon: Archive,
    isModded: false,
    performance: 3,
    plugins: true,
    mods: false,
  },
]

// Animation variants moved outside component
const pageVariants = {
  hidden: {
    opacity: 0,
    y: 50,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
}

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
}



export function FlavorSelectionStep({ onComplete }: FlavorSelectionStepProps) {
  const { config, updateConfig } = useServerConfigStore()
  const { 
    selectedType, 
    setSelectedType, 
    isExpanded, 
    setIsExpanded, 
    isAnimating, 
    setIsAnimating,
    topRowTypes,
    bottomRowTypes,
    swapRows
  } = useFlavorSelectionStore()

  // Get server type info based on current row arrangement
  const topRowServerTypes = topRowTypes.map(id => serverTypes.find(type => type.id === id)!).filter(Boolean)
  const bottomRowServerTypes = bottomRowTypes.map(id => serverTypes.find(type => type.id === id)!).filter(Boolean)

  const handleServerTypeSelect = (type: ServerType) => {
    setSelectedType(type)
    
    const serverTypeInfo = serverTypes.find((t) => t.id === type)
    if (serverTypeInfo) {
      updateConfig({
        serverType: type,
        isModded: serverTypeInfo.isModded,
      })
    }
  }

  const handleHostingModeChange = (value: "play+host" | "host") => {
    updateConfig({ hostingMode: value })
  }

  const handleToggleExpansion = () => {
    if (!isAnimating) {
      setIsAnimating(true) // Start animation
      if (isExpanded) {
        // When collapsing, check if selected type is in bottom row
        // If so, swap rows to bring selection to top before collapsing
        const isSelectedInBottomRow = selectedType && bottomRowTypes.includes(selectedType)
        if (isSelectedInBottomRow) {
          swapRows()
        }
        setIsExpanded(false)
      } else {
        setIsExpanded(true)
      }
    }
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
        <p className="text-cool-gray">Select the type of Minecraft server you want to run</p>
      </motion.div>

      <div className="space-y-4">
        {/* Top Row - Always Visible */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          key={`top-row-${topRowTypes.join('-')}`}
        >
          {topRowServerTypes.map((type) => (
            <motion.div
              key={type.id}
              variants={itemVariants}
            >
              <ServerTypeCard
                type={type}
                isSelected={selectedType === type.id}
                onSelect={() => handleServerTypeSelect(type.id)}
              />
            </motion.div>
          ))}
        </div>

        {/* Show More/Less Toggle Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleToggleExpansion}
            disabled={isAnimating}
            className="text-linen border-linen bg-space-cadet hover:text-linen hover:bg-linen/10 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show More Server Types
              </>
            )}
          </Button>
        </div>

        {/* Bottom Row - Collapsible */}
        <AnimatePresence
          onExitComplete={() => setIsAnimating(false)} // Reset animation state when exit is complete
        >
          {isExpanded && (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              transition={{
                duration: 0.3,
                ease: "easeOut",
                staggerChildren: 0.05,
              }}
              onAnimationComplete={() => setIsAnimating(false)} // Reset animation state when enter animation is complete
              key={`bottom-row-${bottomRowTypes.join('-')}`}
            >
              {bottomRowServerTypes.map((type) => (
                <motion.div
                  key={type.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <ServerTypeCard
                    type={type}
                    isSelected={selectedType === type.id}
                    onSelect={() => handleServerTypeSelect(type.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
