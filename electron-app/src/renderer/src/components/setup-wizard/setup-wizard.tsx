"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { ScrollToBottom } from "@/components/ui/scroll-to-bottom"
import { useServerConfigStore } from "@/stores/server-config-store"

import { DetectMinecraftStep } from "./steps/detect-minecraft-step"
import { FlavorSelectionStep } from "./steps/flavor-selection-step"
import { ModpackSelectionStep } from "./steps/modpack-selection-step"
import { PerformanceSettingsStep } from "./steps/performance-settings-step"
import { ReviewStep } from "./steps/review-step"
import { WorldSetupStep } from "./steps/world-setup-step"

// Animation variants for page transitions
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

export function SetupWizard() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const footerRef = useRef<HTMLDivElement>(null)
  
  const { config, currentStep, updateConfig, nextStep, previousStep } = useServerConfigStore()

  // Define the steps array
  const steps = [
    { id: "detect", label: "Detect", isVisible: true },
    { id: "flavor", label: "Server Type", isVisible: true },
    { id: "modpack", label: "Modpack", isVisible: config.isModded },
    { id: "world", label: "World", isVisible: true },
    { id: "performance", label: "Performance", isVisible: true },
    { id: "review", label: "Review", isVisible: true },
  ]

  // Get only visible steps
  const visibleSteps = steps.filter((s) => s.isVisible)

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
    return visibleSteps.findIndex((s) => s.id === currentStep)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="w-full lg:max-w-[900px] lg:min-w-[900px] md:max-w-[800px] md:min-w-[800px] mx-auto bg-space-cadet border-cool-gray/30 shadow-xl">
        <CardHeader className="border-b border-cool-gray/20">
          <CardTitle className="text-linen">Minecraft Server Setup Wizard</CardTitle>
          <CardDescription className="text-cool-gray">Configure your server in a few simple steps</CardDescription>

          {/* Breadcrumb-style progress indicator */}
          <div className="flex items-center justify-between mt-6">
            {visibleSteps.map((s, index) => {
              const isActive = s.id === currentStep
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
                    className={`ml-2 text-sm hidden sm:block
                      ${isActive ? "text-linen font-medium" : isPast ? "text-cool-gray" : "text-cool-gray/60"}`}
                  >
                    {s.label}
                  </span>

                  {index < visibleSteps.length - 1 && (
                    <div className={`h-px lg:w-8 md:w-4 sm:w-0 mx-1 ${isPast ? "bg-cool-gray" : "bg-night"}`}></div>
                  )}
                </div>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="md:min-h-[200px] lg:min-h-[400px] pt-6">
          <motion.div
            key={currentStep}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageVariants}
            transition={{ duration: 0.3 }}
          >
            {currentStep === "detect" && (
              <DetectMinecraftStep config={config} updateConfig={updateConfig} onComplete={nextStep} />
            )}

            {currentStep === "flavor" && (
              <FlavorSelectionStep onComplete={nextStep} />
            )}

            {currentStep === "modpack" && (
              <ModpackSelectionStep onComplete={nextStep} />
            )}

            {currentStep === "world" && (
              <WorldSetupStep onComplete={nextStep} />
            )}

            {currentStep === "performance" && (
              <PerformanceSettingsStep onComplete={nextStep} />
            )}

            {currentStep === "review" && <ReviewStep onComplete={startServer} />}
          </motion.div>
        </CardContent>
        <CardFooter ref={footerRef} className="flex justify-between border-t border-cool-gray/20 pt-4">
          <Button
            variant="outline"
            onClick={previousStep}
            disabled={currentStep === "detect"}
            className="border-cool-gray text-linen hover:bg-cool-gray/10 bg-night"
          >
            Back
          </Button>

          {currentStep !== "review" ? (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={nextStep} className="bg-linen hover:bg-linen/90 text-night">
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
      <ScrollToBottom footerRef={footerRef as React.RefObject<HTMLDivElement>} />
    </motion.div>
  )
}
