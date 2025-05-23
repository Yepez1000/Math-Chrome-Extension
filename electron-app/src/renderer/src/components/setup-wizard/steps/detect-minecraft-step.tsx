import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, FolderOpen, AlertCircle, Check } from "lucide-react"
import { motion } from "framer-motion"
import type { ServerConfig } from "@/stores/server-config-store"

interface DetectMinecraftStepProps {
  config: ServerConfig
  updateConfig: (updates: Partial<ServerConfig>) => void
  onComplete: () => void
}

export function DetectMinecraftStep({ config, updateConfig, onComplete }: DetectMinecraftStepProps) {
  const [isDetecting, setIsDetecting] = useState(true)
  const [isFound, setIsFound] = useState(false)

  useEffect(() => {
    // Simulate IPC call to detect Minecraft
    const detectMinecraft = async () => {
      setIsDetecting(true)

      try {
        // In a real app, this would be an IPC call to the Electron main process
        // const result = await window.electronAPI.detectMinecraft()

        // Simulate detection process
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // For demo purposes, let's say we found Minecraft
        const mockResult = {
          found: true,
          path: config.minecraftPath || "C:\\Users\\Username\\AppData\\Roaming\\.minecraft",
        }

        setIsFound(mockResult.found)

        if (mockResult.found) {
          updateConfig({ minecraftPath: mockResult.path })
        }
      } catch (error) {
        console.error("Failed to detect Minecraft:", error)
        setIsFound(false)
      } finally {
        setIsDetecting(false)
      }
    }

    detectMinecraft()
  }, [config.minecraftPath, updateConfig])

  const handleBrowse = async () => {
    // In a real app, this would open an Electron dialog
    // const result = await window.electronAPI.openDirectoryDialog()

    // Simulate selecting a directory
    const mockPath = "C:\\Games\\Minecraft"
    updateConfig({ minecraftPath: mockPath })
    setIsFound(true)
  }

  return (
    <div className="space-y-6">
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold mb-2 text-linen">Detecting Minecraft Installation</h2>
        <p className="text-cool-gray">We're looking for your Minecraft installation to set up the server.</p>
      </motion.div>

      {isDetecting ? (
        <motion.div
          className="flex flex-col items-center justify-center py-8"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        >
          <Loader2 className="h-16 w-16 animate-spin text-linen mb-4" />
          <p className="text-cool-gray">Searching for Minecraft installation...</p>
        </motion.div>
      ) : isFound ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Alert className="border-linen/30 bg-linen/10">
            <Check className="h-4 w-4 text-linen" />
            <AlertTitle className="text-linen">Minecraft detected!</AlertTitle>
            <AlertDescription className="text-cool-gray">Found at: {config.minecraftPath}</AlertDescription>
          </Alert>

          <motion.div
            className="flex justify-center mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button onClick={onComplete} className="w-full max-w-md bg-linen text-night hover:bg-linen/90">
              Continue
            </Button>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Alert className="border-cool-gray/30 bg-night">
            <AlertCircle className="h-4 w-4 text-cool-gray" />
            <AlertTitle className="text-linen">Minecraft not found</AlertTitle>
            <AlertDescription className="text-cool-gray">
              We couldn't automatically detect your Minecraft installation.
            </AlertDescription>
          </Alert>

          <motion.div
            className="flex flex-col gap-4 items-center mt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full max-w-md">
              <Button onClick={handleBrowse} className="w-full bg-linen text-night hover:bg-linen/90">
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse for Minecraft folder
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} className="w-full max-w-md">
              <Button
                variant="outline"
                className="w-full border-cool-gray text-linen hover:bg-cool-gray/10"
                onClick={() => window.open("https://www.minecraft.net/download", "_blank")}
              >
                Install Minecraft
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
