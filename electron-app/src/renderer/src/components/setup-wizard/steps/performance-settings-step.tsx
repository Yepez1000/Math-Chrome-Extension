"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { motion } from "framer-motion"
import type { ServerConfig } from "../setup-wizard"
// Import the CheckCircle icon
import { MemoryStickIcon as Memory, FolderOpen, AlertCircle, CheckCircle } from "lucide-react"

interface PerformanceSettingsStepProps {
  config: ServerConfig
  updateConfig: (updates: Partial<ServerConfig>) => void
  onComplete: () => void
}

export function PerformanceSettingsStep({ config, updateConfig, onComplete }: PerformanceSettingsStepProps) {
  const [systemInfo, setSystemInfo] = useState({
    totalRam: 16384, // MB (16 GB)
    cpuCores: 8,
    availableRam: 12288, // MB (12 GB)
  })

  // Helper to get the middle value of the recommended RAM range
  const getRecommendedRamMiddle = () => {
    const rec = getRecommendedRam()
    if (rec.includes('-')) {
      const [min, max] = rec.split('-').map(Number)
      return Math.round((min + max) / 2)
    }
    return Number(rec)
  }

  // Set default RAM to the recommended middle if not set
  useEffect(() => {
    if (!config.ram || config.ram < 512) {
      updateConfig({ ram: getRecommendedRamMiddle() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // In a real app, this would use IPC to get system information
    // const getSystemInfo = async () => {
    //   const info = await window.electronAPI.getSystemInfo()
    //   setSystemInfo(info)
    // }
    // getSystemInfo()
    // For demo purposes, we'll use the mock data already set
  }, [])

  const handleRamChange = (value: number[]) => {
    updateConfig({ ram: value[0] })
  }

  const handleBrowseServerDir = async () => {
    try {
      // Open directory picker using the exposed Electron API
      const chosenDirectory = await window.electronAPI?.pickDirectory();

      if (chosenDirectory) {
        // Update the serverDirectory in the config with the selected path
        updateConfig({ serverDirectory: chosenDirectory });
        // You might want to add some visual feedback here that a directory was selected
        console.log('Server directory selected:', chosenDirectory);
      } else {
        console.log('Server directory selection cancelled.');
        // Handle cancellation - maybe show a message or just do nothing
      }
    } catch (error: any) {
      console.error('Error picking server directory:', error);
      // Show an error message to the user
      alert('Failed to select server directory: ' + error.message);
    }
  }

  // Calculate recommended RAM based on server type and hosting mode
  // Returns recommended RAM range in MB as a string
  const getRecommendedRam = () => {
    if (config.isModded) {
      return config.hostingMode === "play+host" ? "6144-8192" : "4096-6144" // 6-8GB or 4-6GB
    } else {
      return config.hostingMode === "play+host" ? "3072-4096" : "2048-3072" // 4GB or 2-3GB
    }
  }

  // Add a function to check if RAM is within recommended range
  // Checks if RAM is within recommended MB range
  const isRamInRecommendedRange = () => {
    if (config.isModded) {
      if (config.hostingMode === "play+host") {
        return config.ram >= 6144 && config.ram <= 8192 // 6-8GB
      } else {
        return config.ram >= 4096 && config.ram <= 6144 // 4-6GB
      }
    } else {
      if (config.hostingMode === "play+host") {
        return config.ram >= 3072 && config.ram <= 4096 // 3-4GB
      } else {
        return config.ram >= 2048 && config.ram <= 3072 // 2-3GB
      }
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold mb-2 text-linen">Performance Settings</h2>
        <p className="text-cool-gray">
          Configure your server's performance settings based on your system capabilities.
        </p>
      </motion.div>

      <div className="space-y-8">
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2">
            <Memory className="h-5 w-5 text-linen" />
            <h3 className="text-lg font-medium text-linen">Memory Allocation</h3>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-linen">RAM Allocation: {config.ram} MB</Label>
                <span className="text-sm text-cool-gray">Available: {systemInfo.availableRam} MB</span>
              </div>
              <motion.div whileHover={{ scale: 1.02 }}>
                <Slider
                  defaultValue={[config.ram]}
                  max={systemInfo.availableRam}
                  min={512}
                  step={16}
                  onValueChange={handleRamChange}
                  className="w-full"
                />
              </motion.div>
              <div className="flex justify-between mt-1 text-xs text-cool-gray">
                <span>512 MB (Minimum)</span>
                <span>{systemInfo.availableRam} MB (Maximum)</span>
              </div>
            </div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card
                className={`border-${isRamInRecommendedRange() ? "linen" : "linen/30"} bg-${isRamInRecommendedRange() ? "linen/10" : "linen/5"}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <motion.div
                      className="mt-1"
                      initial={false}
                      animate={{ scale: [0.8, 1] }}
                      transition={{ duration: 0.3 }}
                      key={isRamInRecommendedRange() ? "check" : "warning"}
                    >
                      {isRamInRecommendedRange() ? (
                        <CheckCircle className="h-5 w-5 text-linen" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-linen" />
                      )}
                    </motion.div>
                    <div className="text-sm">
                      <p className="font-medium text-linen">
                        {isRamInRecommendedRange() ? "Optimal RAM Setting" : "Recommendation"}
                      </p>
                      <p className="text-cool-gray">
                        {config.isModded
                          ? `For modded servers with ${config.hostingMode === "play+host" ? "playing and hosting" : "hosting only"}, we recommend ${getRecommendedRam()} MB of RAM for optimal performance.`
                          : `For vanilla servers with ${config.hostingMode === "play+host" ? "playing and hosting" : "hosting only"}, ${getRecommendedRam()} MB of RAM is usually sufficient.`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-linen" />
            <h3 className="text-lg font-medium text-linen">Server Location</h3>
          </div>

          <div className="flex gap-2">
            <Input
              value={config.serverDirectory || ""}
              placeholder="Select server directory..."
              readOnly
              className="flex-1 border-cool-gray/30 bg-night text-linen placeholder:text-cool-gray/50"
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="outline"
                onClick={handleBrowseServerDir}
                className="border-linen/30 text-linen hover:bg-linen/10 bg-night"
              >
                Browse
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
