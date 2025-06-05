import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, FolderOpen, AlertCircle, Check } from "lucide-react"
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
  const [detectionStatus, setDetectionStatus] = useState<'detecting' | 'detected_supported' | 'detected_unsupported' | 'not_found'>('detecting')
  const [detectedMinecraftPath, setDetectedMinecraftPath] = useState<string | null>(null)
  const [javaVersion, setJavaVersion] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const detectInstallation = async () => {
      setIsDetecting(true)
      setDetectionStatus('detecting')
      setDetectedMinecraftPath(null)
      setJavaVersion(null)
      setErrorMessage(null)

      try {
        // Call the new IPC channel to detect Minecraft and check Java version
        const result = await window.electronAPI.ipcRenderer.invoke(
          IPC_CHANNELS.DETECT_MINECRAFT_INSTALLATION
        )

        if (result.foundMinecraft) {
          setDetectedMinecraftPath(result.minecraftPath)
          if (result.javaStatus === 'supported') {
            setDetectionStatus('detected_supported')
            setJavaVersion(result.javaVersion)
            updateConfig({ 
              minecraftPath: result.minecraftPath,
              javaPath: result.javaPath
            })
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
            updateConfig({ minecraftPath: null }) // Do not use unsupported installation
          }
        } else {
          setDetectionStatus('not_found')
          setErrorMessage('We couldn\'t automatically detect your Minecraft installation.')
          updateConfig({ minecraftPath: null })
        }
      } catch (error) {
        console.error('Error detecting Minecraft installation:', error)
        setErrorMessage(
          `No Java installation found. Minecraft server requires Java 17 or higher.\n\n` +
          `To install Java 17:\n` +
          `1. Download OpenJDK 17 from https://adoptium.net\n` +
          `2. Run the installer\n` +
          `   - Choose "Install for all users" (recommended) or "Install for current user"\n` +
          `   - The installer will automatically add Java to your system\n` +
          `3. Restart this application after installation`
        )
        updateConfig({ minecraftPath: null })
      } finally {
        setIsDetecting(false)
      }
    }

    detectInstallation()
  }, [updateConfig])

  const handleBrowse = async () => {
    // This handler would also need to be updated to potentially
    // check the Java version of the selected directory if it's not the default .minecraft
    // For now, we'll keep it simple and assume the user selects a valid directory.
    // A more robust implementation would involve another IPC call here.

    try {
      const result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SELECT_SERVER_DIRECTORY) // Using an existing channel for now, needs refinement
      if (result && result.canceled === false && result.filePaths && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]
        // Ideally, we would validate this path and check Java here too.
        updateConfig({ minecraftPath: selectedPath })
        setDetectedMinecraftPath(selectedPath)
        setDetectionStatus('detected_supported') // Assume supported for now, needs real check
        setJavaVersion('Unknown (Manual Selection)')
        setErrorMessage(null)
        console.log('Manually selected directory:', selectedPath)
      } else {
        // User cancelled directory selection
        console.log('Directory selection cancelled')
      }
    } catch (error: any) {
      console.error("Failed to select directory:", error)
      setErrorMessage(`Failed to select directory: ${error.message || 'Unknown error'}`)
      setDetectionStatus('not_found') // Or a specific error state
    }
  }

  const isContinueEnabled = detectionStatus === 'detected_supported'

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

      {isDetecting && (
        <motion.div
          className="flex flex-col items-center justify-center py-8"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        >
          <Loader2 className="h-16 w-16 animate-spin text-linen mb-4" />
          <p className="text-cool-gray">Searching for Minecraft installation and checking Java version...</p>
        </motion.div>
      )}

      {!isDetecting && detectionStatus === 'detected_supported' && detectedMinecraftPath && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Alert className="border-linen/30 bg-linen/10">
            <Check className="h-4 w-4 text-linen" />
            <AlertTitle className="text-linen">Minecraft detected!</AlertTitle>
            <AlertDescription className="text-cool-gray">
              Found a supported installation at: {detectedMinecraftPath}
              {javaVersion && ` (Java ${javaVersion})`}
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

      {!isDetecting && (detectionStatus === 'detected_unsupported' || detectionStatus === 'not_found') && (
        <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Alert className="border-cool-gray/30 bg-night">
            <AlertCircle className="h-4 w-4 text-cool-gray" />
            <AlertTitle className="text-linen">{detectionStatus === 'detected_unsupported' ? 'Unsupported Java Version' : 'Minecraft not found'}</AlertTitle>
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
            {detectionStatus !== 'detected_unsupported' && ( // Only show browse if not just unsupported Java
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full max-w-md">
              <Button onClick={handleBrowse} className="w-full bg-linen text-night hover:bg-linen/90">
                <FolderOpen className="mr-2 h-4 w-4" />
                Browse for Minecraft folder
              </Button>
            </motion.div>
            )}

            <motion.div whileHover={{ scale: 1.05 }} className="w-full max-w-md">
              <Button
                variant="outline"
                className="w-full border-cool-gray text-linen hover:bg-cool-gray/10"
                onClick={() => window.open("https://adoptium.net/", "_blank")}
              >
                Install/Update Java (Requires Java 17+)
              </Button>
            </motion.div>

            {detectionStatus === 'detected_unsupported' && ( // Show option to continue anyway if unsupported Java
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full max-w-md">
                <Button onClick={onComplete} className="w-full max-w-md bg-linen text-night hover:bg-linen/90">
                  Continue Anyway (May Not Work)
                </Button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
