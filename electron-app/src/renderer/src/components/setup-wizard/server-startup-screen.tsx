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
import { useServerStore } from "@/lib/store"

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
    addStatusMessage,
    updateLastStatusMessage,
    setCurrentStep,
    setIsComplete,
    setIsError,
    reset,
  } = useServerStartupStore()

  const { setTunnelStatus, setTunnelAddress, setTunnelError } = useServerStore(); // Access tunnel actions from server store

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
      message: "Setting up Playit.gg tunnel...",
      handler: "startTunnel",
      error: "Failed to set up the Playit.gg tunnel. Please check your API key and network connection."
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
        case "startTunnel":
           // TODO: Get actual API key from user input or config
           const apiKey = "YOUR_PLAYIT_API_KEY_HERE"; // Placeholder
           // TODO: Get actual server port from server config
           const serverPort = 25565; // Hardcoded for now
           result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.START_TUNNEL, { apiKey, serverPort });
           if (!result.success) {
             throw new Error(result.message);
           }
           break;
        default:
          // For all other steps, use the mock implementation for now
          result = await mockIpcCalls(step.handler)
      }

      // Update the status message to success
      updateLastStatusMessage("success")

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

    // Add listeners for tunnel status updates
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_STATUS, (data) => {
       console.log('Tunnel Status Update:', data);
       // Use the store action to set tunnel status
       setTunnelStatus(data.status === 'Error' || data.status === 'Disconnected' ? 'error' : data.status);
       addStatusMessage({ message: `Tunnel Status: ${data.message}`, status: data.status === 'Error' || data.status === 'Disconnected' ? 'error' : 'success' });
    });

    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_ADDRESS, (data) => {
       console.log('Tunnel Address:', data);
       // Use the store action to set tunnel address
       setTunnelAddress(data.address);
       addStatusMessage({ message: `Tunnel Address: ${data.address}`, status: 'success' });
       // TODO: Store the address in the store
    });

     window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_ERROR, (data) => {
       console.error('Tunnel Error:', data);
       // Use the store action to set tunnel error
       setTunnelError(data.message);
       addStatusMessage({ message: `Tunnel Error: ${data.message}`, status: 'error' });
       setIsError(true);
    });

    // Cleanup listeners
    return () => {
      window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.TUNNEL_STATUS);
      window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.TUNNEL_ADDRESS);
      window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.TUNNEL_ERROR);
    }
  }, [])

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
                {statusMessages.map((msg, index) => (
                  <div key={index} className="flex items-start gap-3">
                    {msg.status === "pending" && <Loader2 className="h-5 w-5 text-cool-gray animate-spin" />}
                    {msg.status === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {msg.status === "error" && <XCircle className="h-5 w-5 text-red-500" />}
                    <span className={`text-sm ${msg.status === "error" ? "text-red-400" : "text-linen"}`}>
                      {msg.message}
                    </span>
                  </div>
                ))}

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
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
