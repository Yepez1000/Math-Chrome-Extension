"use client"

import { useCallback, useState, useRef, useLayoutEffect, useEffect } from "react"
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
import { useServerListStore } from "@/lib/servers-store"
import { ErrorBoundary } from "react-error-boundary"

const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

interface ServerStartupScreenProps {
  onComplete: () => void
  onRetry: () => void
}

interface StartupStep {
  message: string;
  handler: typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS] | "prepareServerFiles" | "startMinecraft";
  error: string;
}

interface StatusMessageProps extends StatusMessageType {
  errorText?: string;
}

const ServerConsole = React.memo(() => {
  const { 
    consoleMessages, 
    showConsole, 
    consoleAutoScroll,
    setShowConsole, 
    setConsoleAutoScroll 
  } = useServerStartupStore()
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Only auto-scroll if `consoleAutoScroll` is true AND the user hasn't scrolled up
  useEffect(() => {
    if (consoleAutoScroll && scrollRef.current && !userScrolled) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [consoleMessages, consoleAutoScroll, userScrolled])

  const throttledScrollHandler = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5
        
        if (!isAtBottom && !userScrolled) {
          setUserScrolled(true)
          setConsoleAutoScroll(false)
        } else if (isAtBottom && userScrolled) {
          setUserScrolled(false)
          setConsoleAutoScroll(true)
        }
      }
    }, 100)
  }, [userScrolled, setConsoleAutoScroll])

  const scrollToBottomReliably = useCallback(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    setUserScrolled(false)
    setConsoleAutoScroll(true)
    }
  }, [setConsoleAutoScroll])

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
                      onClick={scrollToBottomReliably}
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
    isComplete,
    isError,
    dnsAddress,
    copyToClipboard,
    reset,
    startupSteps,
    startServerSetup,
    minecraftServerStatusDetails,
    mainProcessError,
    currentStep,
  } = useServerStartupStore()


  // One-time initialization using ref
  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    initializedRef.current = true;
    startServerSetup(config, onComplete, onRetry);
  }

  const handleRetry = () => {
    handleRetry(); // Call the store's retry handler
  };

  // Determine if console should be shown
  const shouldShowConsoleToggle = statusMessages.length > 0 && !isComplete;

  const getStatusText = () => {
    if (mainProcessError) return mainProcessError;
    
    const stepText = `... (Step ${currentStep + 1}/${startupSteps.length})`;
    
    if (minecraftServerStatusDetails) return `${minecraftServerStatusDetails}${stepText}`;
    
    return null;
  };

  return (
    <ErrorBoundary 
      fallback={<ErrorFallback onRetry={handleRetry} />}
    >
      <Card className="w-full bg-space-cadet border-cool-gray/30 shadow-xl">
        <CardHeader>
          <CardTitle className="text-linen">
            {minecraftServerStatusDetails}
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
                      {statusMessages.map((statusMessage, index) => (
                          <StatusMessage
                            key={statusMessage.id}
                            {...statusMessage}
                          errorText={statusMessage.status === "error" 
                            ? startupSteps[index]?.error 
                            : undefined}
                          />
                      ))}
                    </AnimatePresence>

                    {shouldShowConsoleToggle && <ServerConsole />}

                    {getStatusText() && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                        className={`text-sm italic mt-2 ${
                          mainProcessError ? 'text-red-400' : 'text-cool-gray'
                        }`}
                      >
                        {getStatusText()}
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
                        <ServerAddress 
                          address={dnsAddress} 
                          onCopy={(event) => copyToClipboard(event, toast)} 
                          onComplete={onComplete}
                        />
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
    </ErrorBoundary>
  )
}

const StatusMessage = React.memo(({ status, message, id, errorText }: StatusMessageProps) => {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      layout
      className="flex items-start gap-3"
    >
      {status === "pending" && <Loader2 className="h-5 w-5 text-cool-gray animate-spin mt-0.5" />}
      {status === "success" && <CheckCircle className="h-5 w-5 text-linen mt-0.5" />}
      {status === "error" && <XCircle className="h-5 w-5 text-red-400 mt-0.5" />}
      <span className={status === "error" ? "text-red-400" : status === "success" ? "text-linen" : "text-cool-gray"}>
        {status === "error" ? errorText || message : message}
      </span>
    </motion.div>
  )
})

const ServerAddress = ({ 
  address, 
  onCopy, 
  onComplete 
}: { 
  address: string, 
  onCopy: (event: React.MouseEvent<HTMLButtonElement>) => void,
  onComplete: () => void 
}) => (
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

const ErrorFallback = ({ onRetry }: { onRetry: () => void }) => (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: "auto" }}
    transition={{ duration: 0.5 }}
    className="mt-6 pt-4 border-t border-cool-gray/20"
  >
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-red-400">
        <AlertTriangle className="h-5 w-5" />
        <span>An error occurred</span>
      </div>
      <p className="text-cool-gray">
        We encountered an error while setting up your server. You can try again or contact support if the
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