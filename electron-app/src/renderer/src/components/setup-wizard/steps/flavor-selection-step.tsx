"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { motion, AnimatePresence } from "framer-motion"
import { CuboidIcon as Cube, Cpu, Zap, Leaf, Hammer, Feather, Archive} from "lucide-react"
import { useServerConfigStore } from "@/stores/server-config-store"
import { useFlavorSelectionStore } from "@/stores/step-stores"

interface FlavorSelectionStepProps {
  onComplete: () => void
}

type ServerType = "vanilla" | "paper" | "forge" | "spigot" | "fabric" | "bukkit"

type ServerTypeInfo = {
  id: ServerType
  name: string
  description: string
  icon: React.ElementType
  isModded: boolean
  performance: number // 1-5 scale
  plugins: boolean
  mods: boolean
  recommended?: boolean
}

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

// Performance bars component
const PerformanceBars = ({ level }: { level: number }) => (
  <div className="flex gap-1 mt-2">
    {[1, 2, 3, 4, 5].map((bar) => (
      <div key={bar} className={`h-1.5 w-full rounded-full ${bar <= level ? "bg-linen" : "bg-cool-gray/30"}`} />
    ))}
  </div>
)

// Server type card component
const ServerTypeCard = ({ type, isSelected, onSelect }: { type: ServerTypeInfo; isSelected: boolean; onSelect: () => void }) => {
  const Icon = type.icon
  return (
    <motion.div variants={itemVariants} whileHover="active" className="relative">
      {type.recommended && (
        <div className="absolute -top-1 -right-1 z-10">
          <div className="bg-linen text-night text-xs font-bold py-1 px-2 rounded-md transform rotate-3 shadow-md">
            Recommended for Beginners
          </div>
        </div>
      )}
      <Card
        className={`cursor-pointer transition-all hover:border-linen h-full ${
          isSelected ? "border-linen bg-linen/5" : "border-cool-gray/30 bg-night"
        }`}
        onClick={onSelect}
      >
        <CardHeader className="pb-2">
          <motion.div
            className="flex justify-center mb-2"
            animate={{ rotate: isSelected ? [0, 5, 0, -5, 0] : 0 }}
            transition={{ duration: 0.5, delay: 0.2, repeat: isSelected ? 1 : 0 }}
          >
            <Icon className={`h-10 w-10 ${isSelected ? "text-linen" : "text-cool-gray"}`} />
          </motion.div>
          <CardTitle className="text-center text-linen">{type.name}</CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
          <CardDescription className="text-center text-cool-gray lg:min-h-[88px] md:min-h-[110px] sm:min-h-[0px]">{type.description}</CardDescription>

          <div className="mt-4 space-y-2 text-xs text-cool-gray">
            <div>
              <div className="flex justify-between mb-1">
                <span>Performance</span>
                <span className="text-linen">
                  {["Low", "Moderate", "Good", "High", "Excellent"][type.performance - 1]}
                </span>
              </div>
              <PerformanceBars level={type.performance} />
            </div>

            <div className="flex justify-between pt-2">
              <span className={`${type.plugins ? "text-linen" : "text-cool-gray/50"}`}>
                {type.plugins ? "✓ Plugin Support" : "✗ No Plugins"}
              </span>
              <span className={`${type.mods ? "text-linen" : "text-cool-gray/50"}`}>
                {type.mods ? "✓ Mod Support" : "✗ No Mods"}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center pt-2">
          <Button
            variant={isSelected ? "default" : "outline"}
            onClick={onSelect}
            className={`w-full ${
              isSelected
                ? "bg-linen text-night hover:bg-linen/90"
                : "border-cool-gray text-linen hover:bg-cool-gray/10 bg-night"
            }`}
          >
            Select {type.name}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

export function FlavorSelectionStep({ onComplete }: FlavorSelectionStepProps) {
  const { config, updateConfig } = useServerConfigStore()
  const { selectedType, setSelectedType, carouselPage, setCarouselPage, isAnimating, setIsAnimating } = useFlavorSelectionStore()

  // Page 1: Vanilla, Paper, Forge
  // Page 2: Spigot, Fabric, Bukkit
  const page1Types = serverTypes.slice(0, 3)
  const page2Types = serverTypes.slice(3, 6)

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

  const handleNextPage = () => {
    if (!isAnimating) {
      setIsAnimating(true)
      setCarouselPage(2)
    }
  }

  const handlePrevPage = () => {
    if (!isAnimating) {
      setIsAnimating(true)
      setCarouselPage(1)
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

      <div className="relative overflow-hidden py-3">
        <AnimatePresence initial={false} mode="wait" onExitComplete={() => setIsAnimating(false)}>
          {carouselPage === 1 ? (
            <motion.div
              key="page1"
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={pageVariants}
            >
              {page1Types.map((type) => (
                <ServerTypeCard
                  key={type.id}
                  type={type}
                  isSelected={selectedType === type.id}
                  onSelect={() => handleServerTypeSelect(type.id)}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="page2"
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={pageVariants}
            >
              {page2Types.map((type) => (
                <ServerTypeCard
                  key={type.id}
                  type={type}
                  isSelected={selectedType === type.id}
                  onSelect={() => handleServerTypeSelect(type.id)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center mt-4 gap-2">
          <button
            className={`h-2 w-8 rounded-full transition-colors ${carouselPage === 1 ? "bg-linen" : "bg-cool-gray/30"}`}
            onClick={() => carouselPage !== 1 && handlePrevPage()}
            aria-label="Go to page 1"
          />
          <button
            className={`h-2 w-8 rounded-full transition-colors ${carouselPage === 2 ? "bg-linen" : "bg-cool-gray/30"}`}
            onClick={() => carouselPage !== 2 && handleNextPage()}
            aria-label="Go to page 2"
          />
        </div>
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
