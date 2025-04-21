import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, CheckCircle, XCircle, Copy, ExternalLink, AlertTriangle } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"
import type { ServerConfig } from "./setup-wizard"

interface ServerStartupScreenProps {
  config: ServerConfig
  onComplete: () => void
  onRetry: () => void
}

export function ServerStartupScreen({ config, onComplete, onRetry }: ServerStartupScreenProps) {
  const { toast } = useToast()
  const [statusMessages, setStatusMessages] = useState<
    Array<{ message: string; status: "pending" | "success" | "error" }>
  >([])
  const [currentStep, setCurrentStep] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [isError, setIsError] = useState(false)
  const [dnsAddress, setDnsAddress] = useState<string | null>(null)

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
  ];

  // Mock IPC calls with artificial delays
  const mockIpcCalls = async (handler: string) => {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Simulate a random failure for testing (100% chance for demo)
    const shouldFail = Math.random() < .1;

    if (shouldFail) {
      throw new Error(); // Error message is now handled in startupSteps
    }

    if (handler === "getPlayitAddress") {
      return "mc-server-12345.playit.gg:25565";
    }

    return true;
  }

  // Function to execute a step
  const executeStep = async (stepIndex: number) => {
    if (stepIndex >= startupSteps.length) {
      setIsComplete(true)
      return
    }
    const step = startupSteps[stepIndex]

    // Add the step to status messages as pending
    setStatusMessages((prev) => [...prev, { message: step.message, status: "pending" }])

    try {
      // Call the mock IPC handler
      const result = await mockIpcCalls(step.handler)

      // Update the status message to success
      setStatusMessages((prev) =>
        prev.map((msg, idx) => (idx === prev.length - 1 ? { ...msg, status: "success" } : msg)),
      )

      // If this is the last step, save the DNS address
      if (stepIndex === startupSteps.length - 1 && typeof result === "string") {
        setDnsAddress(result)
      }

      // Move to the next step
      setCurrentStep(stepIndex + 1)
      executeStep(stepIndex + 1)
    } catch (error) {
      // Update the status message to error
      setStatusMessages((prev) => prev.map((msg, idx) => (idx === prev.length - 1 ? { ...msg, status: "error" } : msg)));

      // Add error message from step definition
      setStatusMessages((prev) => [
        ...prev,
        {
          message: `Error: ${step.error}${error instanceof Error && error.message ? ` (${error.message})` : ""}`,
          status: "error",
        },
      ]);

      setIsError(true);
    }
  }

  // Start the sequence when component mounts
  const hasRun = useRef(false);
  useEffect(() => {
    if (!hasRun.current) {
      executeStep(0);
      hasRun.current = true;
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
    setStatusMessages([])
    setCurrentStep(0)
    setIsComplete(false)
    setIsError(false)
    setDnsAddress(null)
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
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="mt-6 pt-4 border-t border-cool-gray/20"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 bg-night/50 p-3 rounded border border-cool-gray/20">
                        <AlertTriangle className="h-5 w-5 text-linen mt-0.5" />
                        <div>
                          <h4 className="text-linen font-medium">Launch Failed</h4>
                          <p className="text-sm text-cool-gray">
                            We encountered an issue while setting up your server. You can try again or check the logs
                            for more details.
                          </p>
                        </div>
                      </div>

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
