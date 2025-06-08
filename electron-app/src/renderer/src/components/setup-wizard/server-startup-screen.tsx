"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, CheckCircle, XCircle, Copy, ExternalLink, AlertTriangle, ChevronDown, ChevronUp, Terminal } from "lucide-react"
import { useToast } from "@renderer/hooks/use-toast"
import { useServerConfigStore } from "@/stores/server-config-store"
import { useServerStartupStore } from "@/stores/server-startup-store"
import { IPC_CHANNELS, StatusMessage as StatusMessageType } from "@shared/types"
import { useServerStore, TunnelStatus } from "@/lib/store"
import React from "react"
import { useServerListStore } from "@/lib/server-list-store"

const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

interface ServerStartupScreenProps {
  onComplete: () => void
  onRetry: () => void
}

// Define a type for the startup steps
interface StartupStep {
  message: string;
  handler: typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS] | "prepareServerFiles" | "startMinecraft"; // Corrected type to include string values from IPC_CHANNELS
  error: string;
}

// Console component
const ServerConsole = React.memo(() => {
  const { 
    consoleMessages, 
    showConsole, 
    consoleAutoScroll,
    setShowConsole, 
    setConsoleAutoScroll 
  } = useServerStartupStore()
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const mutationObserverRef = useRef<MutationObserver | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScrollingToBottomRef = useRef(false)

  // Throttled scroll handler to avoid excessive state updates
  const throttledScrollHandler = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollRef.current && !isScrollingToBottomRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5 // Reduced threshold for better detection
        
        if (isAtBottom && userScrolled) {
          setUserScrolled(false)
          setConsoleAutoScroll(true)
        } else if (!isAtBottom && !userScrolled) {
          setUserScrolled(true)
          setConsoleAutoScroll(false)
        }
      }
    }, 100) // 100ms throttle
  }, [userScrolled, setConsoleAutoScroll])

  // Reliable scroll to bottom function
  const scrollToBottomReliably = useCallback(() => {
    if (scrollRef.current) {
      isScrollingToBottomRef.current = true
      
      // Use requestAnimationFrame to ensure DOM is painted
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            // Reset flag after a short delay
            setTimeout(() => {
              isScrollingToBottomRef.current = false
            }, 50)
          }
        })
      })
    }
  }, [])

  // Manual scroll to bottom button handler
  const handleScrollToBottom = useCallback(() => {
    setUserScrolled(false)
    setConsoleAutoScroll(true)
    scrollToBottomReliably()
  }, [scrollToBottomReliably, setConsoleAutoScroll])

  // Set up MutationObserver to watch for DOM changes
  useEffect(() => {
    const scrollContainer = scrollRef.current
    if (!scrollContainer) return

    // MutationObserver to watch for content changes
    mutationObserverRef.current = new MutationObserver(() => {
      if (consoleAutoScroll && !userScrolled) {
        scrollToBottomReliably()
      }
    })

    // ResizeObserver to watch for container size changes
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (consoleAutoScroll && !userScrolled) {
          scrollToBottomReliably()
        }
      })
      resizeObserverRef.current.observe(scrollContainer)
    }

    // Start observing
    mutationObserverRef.current.observe(scrollContainer, {
      childList: true,
      subtree: true,
      characterData: true
    })

    return () => {
      mutationObserverRef.current?.disconnect()
      resizeObserverRef.current?.disconnect()
    }
  }, [consoleAutoScroll, userScrolled, scrollToBottomReliably])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (consoleAutoScroll && !userScrolled && consoleMessages.length > 0) {
      scrollToBottomReliably()
    }
  }, [consoleMessages.length, consoleAutoScroll, userScrolled, scrollToBottomReliably])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  const toggleConsole = () => {
    setShowConsole(!showConsole)
  }

  return (
    <div className="mt-4 space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={toggleConsole}
        className="flex items-center gap-2 text-cool-gray border-cool-gray/30 hover:bg-cool-gray/10"
      >
        <Terminal className="h-4 w-4" />
        {showConsole ? 'Hide Console' : 'Show Console'}
        {showConsole ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      <AnimatePresence>
        {showConsole && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <Card className="border-cool-gray/30 bg-night">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-linen">Server Console</h4>
                                     {userScrolled && (
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={handleScrollToBottom}
                       className="text-xs border-cool-gray/30 text-cool-gray hover:bg-cool-gray/10"
                     >
                       Scroll to bottom
                     </Button>
                   )}
                </div>
                                 <div
                   ref={scrollRef}
                   onScroll={throttledScrollHandler}
                   className="bg-space-cadet rounded p-3 h-72 overflow-y-auto font-mono text-sm text-linen"
                   style={{ scrollBehavior: consoleAutoScroll ? 'smooth' : 'auto' }}
                 >
                   {consoleMessages.length === 0 ? (
                     <div className="text-cool-gray italic">Waiting for server output...</div>
                   ) : (
                     consoleMessages.map((message, index) => (
                       <div
                         key={`${message.timestamp}-${index}`}
                         className={`mb-1 whitespace-pre-wrap ${
                           message.isError ? 'text-red-400' : 'text-linen'
                         }`}
                       >
                         {message.isError ? `ERROR: ${message.text}` : message.text}
                       </div>
                     ))
                   )}
                 </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

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
    playitTunnelStatusDetails,
    setPlayitTunnelStatusDetails,
    minecraftServerStatusDetails,
    setMinecraftServerStatusDetails,
    // Console state
    addConsoleMessage,
    clearConsoleMessages,
  } = useServerStartupStore()

  const { setTunnelStatus, setTunnelAddress, setTunnelError, tunnel } = useServerStore()
  const tunnelAddress = tunnel.address

  // Define the startup steps
  const startupSteps: StartupStep[] = [
    {
      message: "Preparing server files...",
      handler: IPC_CHANNELS.SERVER_PREPARE_FILES,
      error: "Failed to prepare server files. Please check disk space and permissions.",
    },
    {
      message: `Starting ${config.isModded ? "modded" : "vanilla"} Minecraft server...`,
      handler: IPC_CHANNELS.SERVER_START,
      error: "Failed to start the Minecraft server. Please check your server configuration.",
    },
    {
      message: "Setting up Playit.gg tunnel...",
      handler: IPC_CHANNELS.TUNNEL_START,
      error: "Failed to set up the Playit.gg tunnel. Please check your API key and network connection.",
    },
  ]

  // Helper functions for each step
  const handleTunnelStep = async () => {
    const result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.TUNNEL_START, { 
      serverPort: 25565 // Default Minecraft port
    })
    if (result.success && result.data) {
      const { assignedDomain, staticIp4 } = result.data
      if (assignedDomain) {
        setDnsAddress(assignedDomain) // Remove port number
        // Add server to the list after successful tunnel creation
        const addServer = useServerListStore.getState().addServer;
        await addServer({
          id: Date.now().toString(),
          name: "Vanilla World",
          status: "online",
          version: "1.21.5",
          onlinePlayers: 0,
          maxPlayers: 20,
          lastActive: Date.now(),
          serverPath: config.serverDirectory || "",
          playitDomain: assignedDomain,
          gameMode: "survival"
        });
        // Refresh the server list after adding
        await useServerListStore.getState().refresh();
      } else if (staticIp4) {
        setDnsAddress(staticIp4) // Remove port number
      } else {
        console.warn("Tunnel created but neither domain nor static IP returned.", result.data)
        setDnsAddress("Address not available")
      }
    }
    return result; // Return result for error checking in executeStep
  };

  const handlePrepareFilesStep = async () => {
    // Check for javaPath before proceeding
    devLog('Java path being used for prepare:', config.javaPath);
    if (!config.javaPath) {
      throw new Error('Java path is missing from config. Please re-run Java detection.');
    }
    // Call the real prepare server files handler
    const result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SERVER_PREPARE_FILES, { 
      serverDirectory: config.serverDirectory, 
      serverType: config.serverType,
      ramGB: config.ram,
      worldPath: config.worldPath,
      importedWorld: config.importedWorld,
      javaPath: config.javaPath,
    })
    return result; // Return result for error checking in executeStep
  };

  const handleStartServerStep = async () => {
    // Check for javaPath before proceeding
    devLog('Java path being used for start:', config.javaPath);
    if (!config.javaPath) {
      throw new Error('Java path is missing from config. Please re-run Java detection.');
    }
    // Call the real start Minecraft server handler
    const result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SERVER_START, {
      serverDirectory: config.serverDirectory,
      serverType: config.serverType,
      ram: config.ram,
      javaPath: config.javaPath,
    });
    return result; // Return result for error checking in executeStep
  };

  // Unified step handling function
  const handleStep = async (step: StartupStep) => {
    switch (step.handler) {
      case IPC_CHANNELS.TUNNEL_START:
        return handleTunnelStep();
      case IPC_CHANNELS.SERVER_PREPARE_FILES:
        return handlePrepareFilesStep();
      case IPC_CHANNELS.SERVER_START:
        return handleStartServerStep();
      default:
        return { success: true }
    }
  };

  // Function to execute a step
  const executeStep = useCallback(async (stepIndex: number) => {
    if (stepIndex >= startupSteps.length) {
      setIsComplete(true)
      return
    }
    const step = startupSteps[stepIndex]

    addStatusMessage({ message: step.message, status: "pending" })

    try {
      // Use the unified handleStep function
      const result = await handleStep(step);

      // Check the success property returned by the handler
      if (!result.success) {
        throw new Error(result.message || `Step failed for handler: ${step.handler}`);
      }

      // If no error was thrown, the step was successful
      updateLastStatusMessage("success");

      setCurrentStep(stepIndex + 1);
      // Only proceed to the next step if the current one was successful
      setTimeout(() => executeStep(stepIndex + 1), 0);

    } catch (error: any) {
      // If an error was caught (either from throw or IPC result.success === false)
      console.error('Error caught during step execution:', error);
      updateLastStatusMessage("error");

      addStatusMessage({
        message: `Error: ${step.error}${error instanceof Error && error.message ? ` (${error.message})` : ""}`,
        status: "error",
      })

      setIsError(true)
    }
  }, [startupSteps, addStatusMessage, updateLastStatusMessage, setCurrentStep, setIsComplete, setIsError, setDnsAddress, config.serverDirectory, config.serverType, config.ram, config.javaPath]); // Added config dependencies

  // Use useRef to store listener functions to ensure stability
  const listeners = useRef({
    handleTunnelStatus: (data: { status: string; address?: string }) => {
      devLog("Tunnel Status Update:", data)

      // Map the incoming status string to a valid TunnelStatus type
      let mappedStatus: TunnelStatus = "starting"; // Default to starting

      if (data.status === "Error" || data.status.includes("Error:")) {
        mappedStatus = "error";
      } else if (data.status === "Setting Tunnel" || data.status === "Getting Tunnel Details") {
        mappedStatus = "starting";
      } else if (data.status === "Connected" || data.status.includes("Tunnel created")) {
        mappedStatus = "running";
      } else if (data.status === "Disconnected") {
        mappedStatus = "error";
      }

      // Update the detailed tunnel status in the startup store
      setPlayitTunnelStatusDetails(data.status);

      // Update overall tunnel status in useServerStore
      setTunnelStatus(mappedStatus);

      // If we have an address, update it
      if (data.address) {
        setTunnelAddress(data.address);
      }
    },
    handleTunnelAddress: (_event: any, data: any) => {
      devLog("Tunnel Address:", data)
      setTunnelAddress(data.address)
    },
    handleTunnelError: (_event: any, data: any) => {
      console.error("Tunnel Error:", data)
      setTunnelError(data.message)
      addStatusMessage({ message: `Tunnel Runtime Error: ${data.message}`, status: "error" })
    },
    // Handler for server stdout
    handleServerOutput: (data: string) => {
      addConsoleMessage(data, false);
    },
    // Handler for server stderr
    handleServerErrorOutput: (data: string) => {
      addConsoleMessage(data, true);
    },
    // Handler for server status updates
    handleServerStatusUpdate: (data: { status?: string }) => {
      if (data.status) {
        setMinecraftServerStatusDetails(data.status);
      }
    },
  })

  // Start the sequence when component mounts and set up listeners once
  const hasRun = useRef(false)
  useEffect(() => {
    if (!hasRun.current) {
      executeStep(0)
      hasRun.current = true
    }

    // Clear previous console output when starting
    clearConsoleMessages()

    // Add listeners for tunnel status updates from playitHandlers
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_STATUS_UPDATE, listeners.current.handleTunnelStatus)
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_ADDRESS, listeners.current.handleTunnelAddress)
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.TUNNEL_ERROR, listeners.current.handleTunnelError)

    // Add listener for server status updates
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.SERVER_STATUS_UPDATE, listeners.current.handleServerStatusUpdate);

    // Add listeners for server console output
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT, listeners.current.handleServerOutput);
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.SERVER_CONSOLE_ERROR, listeners.current.handleServerErrorOutput);

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.TUNNEL_STATUS_UPDATE, listeners.current.handleTunnelStatus)
      window.electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.TUNNEL_ADDRESS, listeners.current.handleTunnelAddress)
      window.electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.TUNNEL_ERROR, listeners.current.handleTunnelError)
      window.electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.SERVER_STATUS_UPDATE, listeners.current.handleServerStatusUpdate);
      window.electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT, listeners.current.handleServerOutput);
      window.electronAPI.ipcRenderer.removeListener(IPC_CHANNELS.SERVER_CONSOLE_ERROR, listeners.current.handleServerErrorOutput);
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

  // Determine the text for the final status/progress line
  const renderProgressText = () => {
    if (currentStep === 2 && playitTunnelStatusDetails && !isComplete && !isError) {
      return `${playitTunnelStatusDetails}... (Step 3/3)`;
    } else if (currentStep === 1 && minecraftServerStatusDetails && !isComplete && !isError) {
      return `${minecraftServerStatusDetails}... (Step 2/3)`;
    } else if (currentStep === 0 && minecraftServerStatusDetails && !isComplete && !isError) {
      return `${minecraftServerStatusDetails}... (Step 1/3)`;
    } else if (!isComplete && !isError && currentStep < startupSteps.length) {
      return `Processing (Step ${currentStep + 1}/${startupSteps.length})`;
    } else if (isComplete && !isError) {
      return null;
    } else if (isError) {
      const errorFromStore = useServerStartupStore.getState().error;
      return `Setup Failed: ${errorFromStore || 'An unknown error occurred.'}`;
    }
    return null;
  };

  // Determine if console should be shown (during any server operation)
  const shouldShowConsoleToggle = currentStep >= 0 && !isComplete && !isError;

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

                  {/* Show console toggle and console after "Preparing server files..." */}
                  {shouldShowConsoleToggle && <ServerConsole />}

                  {renderProgressText() && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                        className="text-cool-gray text-sm italic mt-2"
                      >
                        {renderProgressText()}
                      </motion.div>
                  )}

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
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
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