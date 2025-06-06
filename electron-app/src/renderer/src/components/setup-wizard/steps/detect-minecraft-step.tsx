import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Check } from "lucide-react"
import { motion } from "framer-motion"
import type { ServerConfig } from "@/stores/server-config-store"
import { IPC_CHANNELS } from "../../../../../shared/types"

interface DetectMinecraftStepProps {
  config: ServerConfig
  updateConfig: (updates: Partial<ServerConfig>) => void
  onComplete: () => void
}

export function DetectMinecraftStep({ config, updateConfig, onComplete }: DetectMinecraftStepProps) {
  const [isDetecting, setIsDetecting] = useState(true)
  const [detectionStatus, setDetectionStatus] = useState<'detecting' | 'detected_supported' | 'detected_unsupported'>('detecting')
  const [javaVersion, setJavaVersion] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const detectJava = async () => {
      setIsDetecting(true)
      setDetectionStatus('detecting')
      setJavaVersion(null)
      setErrorMessage(null)

      try {
        const result = await window.electronAPI.ipcRenderer.invoke(
          IPC_CHANNELS.DETECT_MINECRAFT_INSTALLATION
        )

        if (result.javaStatus === 'supported') {
          setDetectionStatus('detected_supported')
          setJavaVersion(result.javaVersion)
          updateConfig({ javaPath: result.javaPath })
        } else {
          setDetectionStatus('detected_unsupported')
          setJavaVersion(result.javaVersion)
          setErrorMessage(
            `Found Java ${result.javaVersion}. Minecraft server requires Java 17 or higher.\n\n` +
            `To install Java 17:\n` +
            `1. Download OpenJDK 17 from https://adoptium.net\n` +
            `2. Run the installer\n` +
            `   - Choose "Install for all users" (recommended) or "Install for current user"\n` +
            `   - The installer will automatically add Java to your system\n` +
            `3. Restart this application after installation`
          )
        }
      } catch (error) {
        console.error('Error detecting Java:', error)
        setErrorMessage(
          `No Java installation found. Minecraft server requires Java 17 or higher.\n\n` +
          `To install Java 17:\n` +
          `1. Download OpenJDK 17 from https://adoptium.net\n` +
          `2. Run the installer\n` +
          `   - Choose "Install for all users" (recommended) or "Install for current user"\n` +
          `   - The installer will automatically add Java to your system\n` +
          `3. Restart this application after installation`
        )
      }
      setIsDetecting(false)
    }

    detectJava()
  }, [updateConfig])

  const isContinueEnabled = detectionStatus === 'detected_supported'

  return (
    <div className="space-y-6">
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold mb-2 text-linen">Checking Java Installation</h2>
        <p className="text-cool-gray">We're checking if you have Java 17 or higher installed, which is required to run a Minecraft server.</p>
      </motion.div>

      {isDetecting && (
        <motion.div
          className="flex flex-col items-center justify-center py-8"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        >
          <Loader2 className="h-16 w-16 animate-spin text-linen mb-4" />
          <p className="text-cool-gray">Checking Java version...</p>
        </motion.div>
      )}

      {!isDetecting && detectionStatus === 'detected_supported' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Alert className="border-linen/30 bg-linen/10">
            <Check className="h-4 w-4 text-linen" />
            <AlertTitle className="text-linen">Java detected!</AlertTitle>
            <AlertDescription className="text-cool-gray">
              Found compatible Java version: {javaVersion}
            </AlertDescription>
          </Alert>

          <motion.div
            className="flex justify-center mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Button onClick={onComplete} className="w-full max-w-md bg-linen text-night hover:bg-linen/90" disabled={!isContinueEnabled}>
              Continue
            </Button>
          </motion.div>
        </motion.div>
      )}

      {!isDetecting && detectionStatus === 'detected_unsupported' && (
        <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Alert className="border-cool-gray/30 bg-night">
            <AlertCircle className="h-4 w-4 text-cool-gray" />
            <AlertTitle className="text-linen">Unsupported Java Version</AlertTitle>
            <AlertDescription className="text-cool-gray">
              {errorMessage}
            </AlertDescription>
          </Alert>

          <motion.div
            className="flex flex-col gap-4 items-center mt-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.div whileHover={{ scale: 1.05 }} className="w-full max-w-md">
              <Button
                variant="outline"
                className="w-full border-cool-gray text-linen hover:bg-cool-gray/10"
                onClick={() => window.open("https://adoptium.net/", "_blank")}
              >
                Install/Update Java (Requires Java 17+)
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full max-w-md">
              <Button onClick={onComplete} className="w-full max-w-md bg-linen text-night hover:bg-linen/90">
                Continue Anyway (May Not Work)
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
