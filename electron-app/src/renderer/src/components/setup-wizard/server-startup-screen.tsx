"use client"

import { useEffect, useRef, useState } from "react"
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

  const { setTunnelStatus, setTunnelAddress, setTunnelError, tunnelAddress } = useServerStore();

  const [claimLink, setClaimLink] = useState<string | null>(null); // State for storing the claim link

  // Function to copy the server address to the clipboard
  const copyToClipboard = async () => {
    if (tunnelAddress) {
      try {
        await navigator.clipboard.writeText(tunnelAddress);
        toast({
          title: "Copied!",
          description: "Server address copied to clipboard.",
        });
      } catch (err) {
        console.error('Failed to copy:', err);
        toast({
          title: "Copy Failed",
          description: "Could not copy server address to clipboard.",
          variant: "destructive",
        });
      }
    }
  };

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
       setIsComplete(false); // Ensure isComplete is false on tunnel error
    });

    // Add listener for claim link
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.CLAIM_LINK, (data) => {
       console.log('Claim Link Received:', data);
       // setClaimLink(data.url); // Store the claim link - commented out
       console.log(`Captured Claim Link: ${data.url}`); // Log the captured link
       addStatusMessage({ message: `Claim link received. Please authorize the agent.`, status: 'pending' }); // Add a status message
       // We don't set tunnel status here, as it's still in a 'claiming' phase
    });

    // Cleanup listeners
    return () => {
      window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.TUNNEL_STATUS);
      window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.TUNNEL_ADDRESS);
      window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.TUNNEL_ERROR);
      window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.CLAIM_LINK); // Cleanup claim link listener
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

                {isComplete && tunnelAddress && (
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
                          <div className="bg-space-cadet p-2 rounded flex-1 text-linen font-mono">{tunnelAddress}</div>
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
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
