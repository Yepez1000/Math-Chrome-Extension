"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, CheckCircle, XCircle, Copy, ExternalLink, AlertTriangle } from "lucide-react"
import { useToast } from "@renderer/hooks/use-toast"
import { useServerConfigStore } from "@/stores/server-config-store"
import { useServerStartupStore } from "@/stores/server-startup-store"
import { IPC_CHANNELS } from "@shared/types"

interface ServerStartupScreenProps {
  onComplete: () => void
  onRetry: () => void
}

export function ServerStartupScreen({ onComplete, onRetry }: ServerStartupScreenProps) {
  const { toast } = useToast()
  const config = useServerConfigStore((state) => state.config)
  const {
    statusMessages,
    currentStep,
    isComplete,
    isError,
    dnsAddress,
    addStatusMessage,
    updateLastStatusMessage,
    setCurrentStep,
    setIsComplete,
    setIsError,
    setDnsAddress,
    reset,
  } = useServerStartupStore()

  // Define the startup steps
  const startupSteps = [
    {
      message: "Accepting Minecraft EULA...",
      handler: "acceptEULA",
      error: "Failed to accept the Minecraft EULA. Please check file permissions."
    },
    {
      message: "Preparing server files...",
      handler: "prepareServerFiles",
      error: "Failed to prepare server files. Please check disk space and permissions."
    },
    {
      message: `Starting ${config.isModded ? "modded" : "vanilla"} Minecraft server...`,
      handler: "startMinecraft",
      error: "Failed to start the Minecraft server. Please check your server configuration."
    },
    {
      message: "Initializing Playit.gg tunnel service...",
      handler: "startPlayitService",
      error: "Failed to start Playit.gg tunnel service. Please check your internet connection and try again."
    },
    {
      message: "Retrieving your server address...",
      handler: "getPlayitAddress",
      error: "Failed to retrieve your server address. Please try again."
    }
  ]

  // Mock IPC calls with artificial delays
  const mockIpcCalls = async (handler: string) => {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Simulate a random failure for testing (10% chance)
    const shouldFail = Math.random() < 0.1

    if (shouldFail) {
      throw new Error()
    }

    if (handler === "getPlayitAddress") {
      return "mc-server-12345.playit.gg:25565"
    }

    return true
  }

  // Function to execute a step
  const executeStep = async (stepIndex: number) => {
    if (stepIndex >= startupSteps.length) {
      setIsComplete(true)
      return
    }
    const step = startupSteps[stepIndex]

    // Add the step to status messages as pending
    addStatusMessage({ message: step.message, status: "pending" })

    try {
      let result: any

      // Handle different steps
      switch (step.handler) {
        case "startPlayitService":
          // Start the Playit tunnel
          result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.START_TUNNEL, 25565)
          if (!result.success) {
            throw new Error(result.message)
          }
          break

        case "getPlayitAddress":
          // Wait for the tunnel address to be received
          result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Timeout waiting for tunnel address"))
            }, 30000) // 30 second timeout

            const handleAddress = (_event: any, data: { address: string }) => {
              clearTimeout(timeout)
              window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.TUNNEL_ADDRESS)
              resolve(data.address)
            }

            const handleError = (_event: any, data: { message: string }) => {
              clearTimeout(timeout)
              window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.TUNNEL_ERROR)
              reject(new Error(data.message))
            }

            window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_ADDRESS, handleAddress)
            window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_ERROR, handleError)
          })
          break

        default:
          // For other steps, use the mock implementation for now
          result = await mockIpcCalls(step.handler)
      }

      // Update the status message to success
      updateLastStatusMessage("success")

      // If this is the last step, save the DNS address
      if (stepIndex === startupSteps.length - 1 && typeof result === "string") {
        setDnsAddress(result)
      }

      // Move to the next step
      setCurrentStep(stepIndex + 1)
      executeStep(stepIndex + 1)
    } catch (error) {
      // Update the status message to error
      updateLastStatusMessage("error")

      // Add error message from step definition
      addStatusMessage({
        message: `Error: ${step.error}${error instanceof Error && error.message ? ` (${error.message})` : ""}`,
        status: "error",
      })

      setIsError(true)
    }
  }

  // Start the sequence when component mounts
  const hasRun = useRef(false)
  useEffect(() => {
    if (!hasRun.current) {
      executeStep(0)
      hasRun.current = true
    }
  }, [])

  // Handle copy to clipboard
  const copyToClipboard = () => {
    if (dnsAddress) {
      navigator.clipboard.writeText(dnsAddress)
      toast({
        title: "Copied to clipboard",
        description: "Server address has been copied to your clipboard",
      })
    }
  }

  // Handle retry
  const handleRetry = () => {
    reset()
    onRetry()
    executeStep(0)
  }

  return (
    <Card className="w-full bg-space-cadet border-cool-gray/30 shadow-xl">
      <CardHeader>
        <CardTitle className="text-linen">
          {isComplete ? "Server Launch Complete!" : isError ? "Server Launch Failed" : "Launching your server..."}
        </CardTitle>
        <CardDescription className="text-cool-gray">
          {isComplete
            ? "Your Minecraft server is now running and accessible"
            : isError
              ? "We encountered an issue while setting up your server"
              : "Please wait while we set up your Minecraft server"}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6">
        <div className="space-y-6">
          <Card className="border-cool-gray/30 bg-night">
            <CardContent className="p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-linen mb-4">Status Updates</h3>

                <div className="space-y-3">
                  <AnimatePresence>
                    {statusMessages.map((status, index) => (
                      <motion.div
                        key={`${index}-${status.message}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-start gap-3"
                      >
                        {status.status === "pending" && (
                          <Loader2 className="h-5 w-5 text-cool-gray animate-spin mt-0.5" />
                        )}
                        {status.status === "success" && <CheckCircle className="h-5 w-5 text-linen mt-0.5" />}
                        {status.status === "error" && <XCircle className="h-5 w-5 text-red-400 mt-0.5" />}
                        <span
                          className={`${
                            status.status === "error"
                              ? "text-red-400"
                              : status.status === "success"
                                ? "text-linen"
                                : "text-cool-gray"
                          }`}
                        >
                          {status.message}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {!isComplete && !isError && currentStep < startupSteps.length && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                      className="text-cool-gray text-sm italic mt-2"
                    >
                      Processing...
                    </motion.div>
                  )}
                </div>

                {isComplete && dnsAddress && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="mt-6 pt-4 border-t border-cool-gray/20"
                  >
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-linen font-medium mb-2">Your Server Address</h4>
                        <div className="flex items-center gap-2">
                          <div className="bg-space-cadet p-2 rounded flex-1 text-linen font-mono">{dnsAddress}</div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={copyToClipboard}
                            className="border-linen/30 text-linen hover:bg-linen/10"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-cool-gray mt-2">
                          Share this address with friends so they can connect to your server
                        </p>
                      </div>

                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full">
                        <Button onClick={onComplete} className="w-full bg-linen text-night hover:bg-linen/90">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Continue to Dashboard
                        </Button>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {isError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.5 }}
                    className="mt-6 pt-4 border-t border-cool-gray/20"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="h-5 w-5" />
                        <span>Server launch failed</span>
                      </div>
                      <p className="text-cool-gray">
                        We encountered an issue while setting up your server. You can try again or contact support if the
                        problem persists.
                      </p>
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full">
                        <Button onClick={handleRetry} className="w-full bg-linen text-night hover:bg-linen/90">
                          Try Again
                        </Button>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
