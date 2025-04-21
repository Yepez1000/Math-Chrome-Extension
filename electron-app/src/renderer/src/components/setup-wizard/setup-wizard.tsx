"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/lib/hooks/use-toast"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"

import { DetectMinecraftStep } from "./steps/detect-minecraft-step"
import { FlavorSelectionStep } from "./steps/flavor-selection-step"
import { ModpackSelectionStep } from "./steps/modpack-selection-step"
import { PerformanceSettingsStep } from "./steps/performance-settings-step"
import { ReviewStep } from "./steps/review-step"

export type WizardStep = "detect" | "flavor" | "modpack" | "performance" | "review"

export type ServerConfig = {
  minecraftPath: string | null
  isModded: boolean
  modpackPath?: string
  modpackName?: string
  ram: number
  hostingMode: "play+host" | "host"
  javaPath?: string
  serverDirectory?: string
}

// Animation variants for page transitions
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

export function SetupWizard() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState<WizardStep>("detect")
  const [config, setConfig] = useState<ServerConfig>({
    minecraftPath: "C:\\Users\\Username\\AppData\\Roaming\\.minecraft", // Pre-filled for testing
    isModded: false,
    ram: 4,
    hostingMode: "play+host",
    serverDirectory: "C:\\MinecraftServers\\MyServer", // Pre-filled for testing
  })

  // Define all steps and their visibility conditions
  const steps: { id: WizardStep; label: string; isVisible: boolean }[] = [
    { id: "detect", label: "Detect", isVisible: true },
    { id: "flavor", label: "Server Type", isVisible: true },
    { id: "modpack", label: "Modpack", isVisible: config.isModded },
    { id: "performance", label: "Performance", isVisible: true },
    { id: "review", label: "Review", isVisible: true },
  ]

  // Get only visible steps
  const visibleSteps = steps.filter((s) => s.isVisible)

  const handleNext = () => {
    const stepOrder: WizardStep[] = ["detect", "flavor", "modpack", "performance", "review"]
    const currentIndex = stepOrder.indexOf(step)

    // Skip modpack step if vanilla is selected
    if (step === "flavor" && !config.isModded) {
      setStep("performance")
      return
    }

    if (currentIndex < stepOrder.length - 1) {
      setStep(stepOrder[currentIndex + 1])
    }
  }

  const handleBack = () => {
    const stepOrder: WizardStep[] = ["detect", "flavor", "modpack", "performance", "review"]
    const currentIndex = stepOrder.indexOf(step)

    // Skip modpack step if vanilla is selected when going back
    if (step === "performance" && !config.isModded) {
      setStep("flavor")
      return
    }

    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1])
    }
  }

  const updateConfig = (updates: Partial<ServerConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }))
  }

  const startServer = async () => {
    try {
      // In a real app, this would use IPC to communicate with the Electron main process
      // window.electronAPI.startServer(config)
      console.log("Starting server with config:", config)

      // Navigate to the standalone server startup page
      navigate("/server-startup")
    } catch (error) {
      toast({
        title: "Failed to start server",
        description: String(error),
        variant: "destructive",
      })
    }
  }

  // Get current step index (for breadcrumb)
  const getCurrentStepIndex = () => {
    return visibleSteps.findIndex((s) => s.id === step)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="w-full max-w-4xl mx-auto bg-space-cadet border-cool-gray/30 shadow-xl">
        <CardHeader className="border-b border-cool-gray/20">
          <CardTitle className="text-linen">Minecraft Server Setup Wizard</CardTitle>
          <CardDescription className="text-cool-gray">Configure your server in a few simple steps</CardDescription>

          {/* Breadcrumb-style progress indicator */}
          <div className="flex items-center justify-between mt-6">
            {visibleSteps.map((s, index) => {
              const isActive = s.id === step
              const isPast = getCurrentStepIndex() > index

              return (
                <div key={s.id} className="flex items-center">
                  <motion.div
                    className={`flex items-center justify-center rounded-full w-8 h-8 text-xs font-medium transition-colors
                      ${
                        isActive
                          ? "bg-linen text-night"
                          : isPast
                            ? "bg-cool-gray text-night"
                            : "bg-night text-cool-gray"
                      }`}
                    whileHover={{ scale: 1.1 }}
                    animate={isActive ? { boxShadow: "0 0 0 3px rgba(248, 235, 227, 0.3)" } : {}}
                  >
                    {index + 1}
                  </motion.div>
                  <span
                    className={`ml-2 text-sm hidden md:block
                      ${isActive ? "text-linen font-medium" : isPast ? "text-cool-gray" : "text-cool-gray/60"}`}
                  >
                    {s.label}
                  </span>

                  {index < visibleSteps.length - 1 && (
                    <div className={`h-px w-8 md:w-12 mx-1 ${isPast ? "bg-cool-gray" : "bg-night"}`}></div>
                  )}
                </div>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="min-h-[400px] pt-6">
          <motion.div
            key={step}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={{ duration: 0.3 }}
          >
            {step === "detect" && (
              <DetectMinecraftStep config={config} updateConfig={updateConfig} onComplete={() => setStep("flavor")} />
            )}

            {step === "flavor" && (
              <FlavorSelectionStep config={config} updateConfig={updateConfig} onComplete={handleNext} />
            )}

            {step === "modpack" && (
              <ModpackSelectionStep config={config} updateConfig={updateConfig} onComplete={handleNext} />
            )}

            {step === "performance" && (
              <PerformanceSettingsStep config={config} updateConfig={updateConfig} onComplete={handleNext} />
            )}

            {step === "review" && <ReviewStep config={config} onComplete={startServer} />}
          </motion.div>
        </CardContent>
        <CardFooter className="flex justify-between border-t border-cool-gray/20 pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === "detect"}
            className="border-cool-gray text-linen hover:bg-cool-gray/10 bg-night"
          >
            Back
          </Button>

          {step !== "review" ? (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={handleNext} className="bg-linen hover:bg-linen/90 text-night">
                Next
              </Button>
            </motion.div>
          ) : (
            <div className="opacity-0">
              {/* Hidden placeholder to maintain layout */}
              <Button disabled className="invisible">
                Next
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  )
}
