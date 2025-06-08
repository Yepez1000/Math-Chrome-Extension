import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Check, Info } from "lucide-react"
import { motion } from "framer-motion"
import type { ServerConfig } from "@/stores/server-config-store"
import { IPC_CHANNELS } from "../../../../../shared/types"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DetectMinecraftStepProps {
  config: ServerConfig
  updateConfig: (updates: Partial<ServerConfig>) => void
  onComplete: () => void
}

function ManualJavaSelectButton({ onClick, isLoading, error }: {
  onClick: () => void,
  isLoading: boolean,
  error: string | null
}) {
  return (
    <>
      <Button
        variant="outline"
        className="w-full max-w-md border-cool-gray text-linen hover:bg-cool-gray/10 flex items-center justify-center gap-2"
        onClick={onClick}
        disabled={isLoading}
      >
        {isLoading ? 'Selecting...' : 'Select Java Manually'}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-1 cursor-pointer"><Info className="h-4 w-4 text-cool-gray" /></span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-sm">
              You can select either a <b>java.exe</b> file directly, or a folder that contains it.<br />
              If you select a folder, the app will search inside (up to 4 levels deep) for a valid <b>java.exe</b>.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Button>
      {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
    </>
  );
}

export function DetectMinecraftStep({ config, updateConfig, onComplete }: DetectMinecraftStepProps) {
  const [isDetecting, setIsDetecting] = useState(true)
  const [detectionStatus, setDetectionStatus] = useState<'detecting' | 'detected_supported' | 'detected_unsupported'>('detecting')
  const [javaVersion, setJavaVersion] = useState<string | null>(null)
  const [javaPath, setJavaPath] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)
  const [isManualLoading, setIsManualLoading] = useState(false)

  useEffect(() => {
    const detectJava = async () => {
      setIsDetecting(true)
      setDetectionStatus('detecting')
      setJavaVersion(null)
      setJavaPath(null)
      setErrorMessage(null)
      setManualError(null)

      try {
        const result = await window.electronAPI.ipcRenderer.invoke(
          IPC_CHANNELS.JAVA_DETECT_VERSION
        )

        if (result.success) {
          setDetectionStatus('detected_supported')
          setJavaVersion(result.version)
          setJavaPath(result.path)
          updateConfig({ javaPath: result.path })
        } else {
          setDetectionStatus('detected_unsupported')
          setJavaVersion(result.version || null)
          setJavaPath(result.path || null)
          setErrorMessage(
            `No compatible Java found. Minecraft server requires Java 17 or higher.\n\n` +
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
          `1. Download OpenJDK from https://adoptium.net\n` +
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

  const handleManualSelect = async () => {
    setManualError(null)
    setIsManualLoading(true)
    try {
      const result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.JAVA_SELECT_MANUAL)
      if (result.success) {
        setDetectionStatus('detected_supported')
        setJavaVersion(result.version)
        setJavaPath(result.path)
        updateConfig({ javaPath: result.path })
      } else {
        setManualError(result.message || 'Failed to validate selected Java executable.')
      }
    } catch (err) {
      setManualError('Error selecting Java executable.')
    } finally {
      setIsManualLoading(false)
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
              {javaPath && (
                <div className="mt-2 text-xs text-cool-gray/70">Path: {javaPath}</div>
              )}
            </AlertDescription>
          </Alert>

          <motion.div className="flex flex-col gap-4 items-center mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <Button onClick={onComplete} className="w-full max-w-md bg-linen text-night hover:bg-linen/90" disabled={!isContinueEnabled}>
              Continue
            </Button>
            <ManualJavaSelectButton onClick={handleManualSelect} isLoading={isManualLoading} error={manualError} />
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
              {javaPath && (
                <div className="mt-2 text-xs text-cool-gray/70">Found: {javaPath}</div>
              )}
            </AlertDescription>
          </Alert>

          <motion.div className="flex flex-col gap-4 items-center mt-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Button
              variant="outline"
              className="w-full max-w-md border-cool-gray text-linen hover:bg-cool-gray/10"
              onClick={() => window.open("https://adoptium.net/", "_blank")}
            >
              Install/Update Java (Requires Java 17+)
            </Button>
            <Button
              className="w-full max-w-md bg-linen text-night hover:bg-linen/90"
              onClick={onComplete}
            >
              Continue Anyway (May Not Work)
            </Button>
            <ManualJavaSelectButton onClick={handleManualSelect} isLoading={isManualLoading} error={manualError} />
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
