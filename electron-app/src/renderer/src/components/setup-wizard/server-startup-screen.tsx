"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, CheckCircle, XCircle, Copy, ExternalLink, AlertTriangle } from "lucide-react"
import { useToast } from "@renderer/hooks/use-toast"
import { useServerConfigStore } from "@/stores/server-config-store"
import { useServerStartupStore } from "@/stores/server-startup-store"
import { IPC_CHANNELS, StatusMessage as StatusMessageType } from "@shared/types"
import { useServerStore } from "@/lib/store"
import React from "react"

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
    setDnsAddress,
    reset,
    dnsAddress,
  } = useServerStartupStore()

  const { setTunnelStatus, setTunnelAddress, setTunnelError, tunnel } = useServerStore()
  const tunnelAddress = tunnel.address

  // Define the startup steps
  const startupSteps = [
    {
      message: "Accepting Minecraft EULA...",
      handler: IPC_CHANNELS.ACCEPT_EULA,
      error: "Failed to accept the Minecraft EULA. Please check file permissions.",
    },
    {
      message: "Preparing server files...",
      handler: "prepareServerFiles",
      error: "Failed to prepare server files. Please check disk space and permissions.",
    },
    {
      message: `Starting ${config.isModded ? "modded" : "vanilla"} Minecraft server...`,
      handler: "startMinecraft",
      error: "Failed to start the Minecraft server. Please check your server configuration.",
    },
    {
      message: "Setting up Playit.gg tunnel...",
      handler: IPC_CHANNELS.START_TUNNEL,
      error: "Failed to set up the Playit.gg tunnel. Please check your API key and network connection.",
    },
  ]

  // Function to execute a step
  const executeStep = useCallback(async (stepIndex: number) => {
    if (stepIndex >= startupSteps.length) {
      setIsComplete(true)
      return
    }
    const step = startupSteps[stepIndex]

    addStatusMessage({ message: step.message, status: "pending" })

    try {
      let result: any

      // Handle different steps
      switch (step.handler) {
        case IPC_CHANNELS.START_TUNNEL:
          const apiKey = "YOUR_PLAYIT_API_KEY_HERE" // Placeholder
          const serverPort = 25565 // Hardcoded for now
          result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.START_TUNNEL, { apiKey, serverPort })
          if (!result.success) {
            throw new Error(result.message)
          }
          if (result.data) {
            const { assignedDomain, staticIp4, portStart } = result.data
            if (assignedDomain) {
              setDnsAddress(`${assignedDomain}:${portStart || 25565}`)
            } else if (staticIp4) {
              setDnsAddress(`${staticIp4}:${portStart || 25565}`)
            } else {
              console.warn("Tunnel created but neither domain nor static IP returned.", result.data)
              setDnsAddress("Address not available")
            }
          } else {
            console.warn("Tunnel creation reported success but missing data.", result)
            setDnsAddress("Address not available")
          }
          break
        case IPC_CHANNELS.ACCEPT_EULA:
          // Mock the EULA acceptance step
          result = await mockIpcCalls(step.handler)
          if (!result.success) {
            throw new Error("Mock EULA acceptance failed.")
          }
          break
        default:
          result = await mockIpcCalls(step.handler)
      }

      updateLastStatusMessage("success")

      setCurrentStep(stepIndex + 1)
      setTimeout(() => executeStep(stepIndex + 1), 0)
    } catch (error: any) {
      updateLastStatusMessage("error")

      addStatusMessage({
        message: `Error: ${step.error}${error instanceof Error && error.message ? ` (${error.message})` : ""}`,
        status: "error",
      })

      setIsError(true)
    }
  }, [startupSteps, addStatusMessage, updateLastStatusMessage, setCurrentStep, setIsComplete, setIsError, setDnsAddress])

  // Mock IPC calls with artificial delays
  const mockIpcCalls = async (handler: string) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    // Simulate success for mock steps
    console.log(`Mock handler called for: ${handler}`)
    return { success: true } // Mocked success response
  }

  // Use useRef to store listener functions to ensure stability
  const listeners = useRef({
    handleTunnelStatus: (_event: any, data: any) => {
      console.log("Tunnel Status Update:", data)
      setTunnelStatus(data.status === "Error" || data.status === "Disconnected" ? "error" : data.status)
    },
    handleTunnelAddress: (_event: any, data: any) => {
      console.log("Tunnel Address:", data)
      setTunnelAddress(data.address)
    },
    handleTunnelError: (_event: any, data: any) => {
      console.error("Tunnel Error:", data)
      setTunnelError(data.message)
      addStatusMessage({ message: `Tunnel Runtime Error: ${data.message}`, status: "error" })
    },
  })

  // Start the sequence when component mounts and set up listeners once
  const hasRun = useRef(false)
  useEffect(() => {
    if (!hasRun.current) {
      executeStep(0)
      hasRun.current = true
    }
    
    // Add listeners for tunnel status updates from playitHandlers
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_STATUS, listeners.current.handleTunnelStatus)
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_ADDRESS, listeners.current.handleTunnelAddress)
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_ERROR, listeners.current.handleTunnelError)

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.TUNNEL_STATUS, listeners.current.handleTunnelStatus)
      window.electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.TUNNEL_ADDRESS, listeners.current.handleTunnelAddress)
      window.electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.TUNNEL_ERROR, listeners.current.handleTunnelError)
    }
  }, []) // Remove executeStep from dependencies since it's stable

  // Handle copy to clipboard
  const copyToClipboard = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); // Prevent default button behavior
    if (dnsAddress) {
      window.electronAPI.clipboard.writeText(dnsAddress)
      toast({
        title: "Link Copied!",
        description: "Server address has been copied to your clipboard",
        variant: "default",
        className: "bg-space-cadet text-linen border-cool-gray/30",
      })
    }
  }

  // Handle retry
  const handleRetry = () => {
    reset()
    // Also reset server store tunnel state if necessary
    setTunnelStatus("idle")
    setTunnelAddress(null)
    setTunnelError(null)

    onRetry()
    executeStep(0)
  }

  // Extract server address component
  const ServerAddress = ({ address, onCopy }: { address: string, onCopy: (event: React.MouseEvent<HTMLButtonElement>) => void }) => (
    <div className="space-y-4">
      <div>
        <h4 className="text-linen font-medium mb-2">Your Server Address</h4>
        <div className="flex items-center gap-2">
          <div className="bg-space-cadet p-2 rounded flex-1 text-linen font-mono">{address}</div>
          <Button
            variant="outline"
            size="icon"
            onClick={onCopy}
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
  )

  // Extract error state component
  const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
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
          <Button onClick={onRetry} className="w-full bg-linen text-night hover:bg-linen/90">
            Try Again
          </Button>
        </motion.div>
      </div>
    </motion.div>
  )

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
                    {statusMessages.map((statusMessage) => (
                      <StatusMessage key={statusMessage.id} {...statusMessage} />
                    ))}
                  </AnimatePresence>

                  {!isComplete && !isError && currentStep < startupSteps.length && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                      className="text-cool-gray text-sm italic mt-2"
                    >
                      Processing... (Step {currentStep + 1}/{startupSteps.length})
                    </motion.div>
                  )}
                </div>

                {isComplete && dnsAddress && (
                  <motion.div
                    key="server-address-container"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    layout
                    className="mt-6 pt-4 border-t border-cool-gray/20"
                  >
                    <ServerAddress address={dnsAddress} onCopy={copyToClipboard} />
                  </motion.div>
                )}

                {isError && <ErrorState onRetry={handleRetry} />}
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}

// Keep the mock IPC calls for other steps until they are implemented
// Renamed to avoid conflict if mockIpcCalls is defined within the component function
const globalMockIpcCalls = async (handler: string) => {
  await new Promise((resolve) => setTimeout(resolve, 500))
  // Simulate success for mock steps
  console.log(`Mock handler called for: ${handler}`)
  return { success: true } // Mocked success response
}

// Move StatusMessage component definition outside
const StatusMessage = React.memo(({ status, message, id }: StatusMessageType) => {
  return (
    <motion.div
      key={id} // Use the unique ID as the key
      initial={{ opacity: 0, x: -10 }} // Keep initial state
      animate={{ opacity: 1, x: 0 }} // Revert to static animate prop
      transition={{ duration: 0.3 }} // Revert to static transition prop
      layout // Layout remains
      className="flex items-start gap-3"
    >
      {status === "pending" && <Loader2 className="h-5 w-5 text-cool-gray animate-spin mt-0.5" />}
      {status === "success" && <CheckCircle className="h-5 w-5 text-linen mt-0.5" />}
      {status === "error" && <XCircle className="h-5 w-5 text-red-400 mt-0.5" />}
      <span className={status === "error" ? "text-red-400" : status === "success" ? "text-linen" : "text-cool-gray"}>
        {message}
      </span>
    </motion.div>
  );
});