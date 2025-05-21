import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import type { ServerConfig } from "../setup-wizard"
import { Check, CuboidIcon as Cube, Blocks, MemoryStickIcon as Memory, Cpu, FolderOpen, Globe } from "lucide-react"

interface ReviewStepProps {
  config: ServerConfig
  onComplete: () => void
}

export function ReviewStep({ config, onComplete }: ReviewStepProps) {
  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: 0.1 + i * 0.1,
      },
    }),
  }

  return (
    <div className="space-y-6">
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold mb-2 text-linen">Review Your Setup</h2>
        <p className="text-cool-gray">Please review your server configuration before launching.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-cool-gray/30 bg-night">
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                
              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b border-cool-gray/20">
                  <span className="text-cool-gray">Server Type</span>
                  <span className="text-linen font-medium capitalize">{config.serverType}</span>
                </div>
                {config.isModded && config.modpackName && (
                  <motion.div
                    className="flex items-center gap-3"
                    custom={1}
                    initial="hidden"
                    animate="visible"
                    variants={itemVariants}
                  >
                    <div className="h-5 w-5 flex items-center justify-center text-linen">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium text-linen">Modpack</h3>
                      <p className="text-sm text-cool-gray">{config.modpackName}</p>
                    </div>
                  </motion.div>
                )}

                <motion.div
                  className="flex items-center gap-3"
                  custom={2}
                  initial="hidden"
                  animate="visible"
                  variants={itemVariants}
                >
                  <Memory className="h-5 w-5 text-linen" />
                  <div>
                    <h3 className="font-medium text-linen">Memory Allocation</h3>
                    <p className="text-sm text-cool-gray">{config.ram} GB RAM</p>
                  </div>
                </motion.div>
              </div>

                <motion.div
                  className="flex items-center gap-3"
                  custom={3}
                  initial="hidden"
                  animate="visible"
                  variants={itemVariants}
                >
                  <Cpu className="h-5 w-5 text-linen" />
                  <div>
                    <h3 className="font-medium text-linen">Hosting Mode</h3>
                    <p className="text-sm text-cool-gray">
                      {config.hostingMode === "play+host"
                        ? "Playing and Hosting on same machine"
                        : "Dedicated Server (hosting only)"}
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  className="flex items-center gap-3"
                  custom={4}
                  initial="hidden"
                  animate="visible"
                  variants={itemVariants}
                >
                  <FolderOpen className="h-5 w-5 text-linen" />
                  <div>
                    <h3 className="font-medium text-linen">Server Location</h3>
                    <p className="text-sm text-cool-gray">{config.serverDirectory || "Default location"}</p>
                  </div>
                </motion.div>

                <motion.div
                  className="flex items-center gap-3"
                  custom={5}
                  initial="hidden"
                  animate="visible"
                  variants={itemVariants}
                >
                  <Globe className="h-5 w-5 text-linen" />
                  <div>
                    <h3 className="font-medium text-linen">World</h3>
                    <p className="text-sm text-cool-gray">
                      {config.importedWorld
                        ? `Imported: ${config.worldPath?.split("\\").pop()}`
                        : `New world: ${config.worldName || "Minecraft World"}`}
                    </p>
                  </div>
                </motion.div>

                <motion.div
                  className="flex items-center gap-3"
                  custom={5}
                  initial="hidden"
                  animate="visible"
                  variants={itemVariants}
                >
                  <div className="h-5 w-5 flex items-center justify-center text-linen">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-medium text-linen">Minecraft Installation</h3>
                    <p className="text-sm text-cool-gray">{config.minecraftPath}</p>
                  </div>
                </motion.div>
              </div>
            </div>

            <motion.div
              className="pt-4 border-t border-cool-gray/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <p className="text-sm text-cool-gray">
                Once you click "Launch Server", the configuration will be saved and your Minecraft server will start.
                You can always modify these settings later from the main dashboard.
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        className="flex justify-center mt-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full max-w-md relative">
          {/* Glow effect as a separate element behind the button */}
          <motion.div
            className="absolute inset-0 rounded-md"
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(248, 235, 227, 0)",
                "0 0 0 3px rgba(248, 235, 227, 0.3)",
                "0 0 0 0 rgba(248, 235, 227, 0)",
              ],
            }}
            transition={{ duration: 2, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
          />
          <Button onClick={onComplete} className="w-full bg-linen text-night hover:bg-linen/90 relative z-10">
            Launch Server
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
