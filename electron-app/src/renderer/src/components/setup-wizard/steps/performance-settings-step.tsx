"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion } from "framer-motion"
import { MemoryStickIcon as Memory, FolderOpen, AlertTriangle, CheckCircle, AlertCircle, TestTube } from "lucide-react"
import { useServerConfigStore } from "@/stores/server-config-store"
import { usePerformanceSettingsStore } from "@/stores/step-stores"

interface PerformanceSettingsStepProps {
  onComplete: () => void
}

// Test case presets for development mode
const TEST_CASES = {
  "low-end": { totalRam: 4096, availableRam: 2048, description: "Low-end system (4GB total, 2GB available)" },
  "mid-range": { totalRam: 8192, availableRam: 6144, description: "Mid-range system (8GB total, 6GB available)" },
  "high-end": { totalRam: 16384, availableRam: 12288, description: "High-end system (16GB total, 12GB available)" },
  "gaming-rig": { totalRam: 32768, availableRam: 24576, description: "Gaming rig (32GB total, 24GB available)" },
  "minimal": { totalRam: 2048, availableRam: 1024, description: "Minimal system (2GB total, 1GB available)" },
  "constrained": { totalRam: 8192, availableRam: 1536, description: "Constrained system (8GB total, 1.5GB available)" },
  "optimal-vanilla": { totalRam: 16384, availableRam: 4096, description: "Optimal for vanilla (16GB total, 4GB available)" },
  "optimal-modded": { totalRam: 16384, availableRam: 8192, description: "Optimal for modded (16GB total, 8GB available)" }
}

export function PerformanceSettingsStep({ onComplete }: PerformanceSettingsStepProps) {
  const { config, updateConfig } = useServerConfigStore()
  const { systemInfo, setSystemInfo } = usePerformanceSettingsStore()
  
  // Debug mode state for development
  const [isDebugMode, setIsDebugMode] = useState(false)
  const [customTotalRam, setCustomTotalRam] = useState(systemInfo.totalRam.toString())
  const [customAvailableRam, setCustomAvailableRam] = useState(systemInfo.availableRam.toString())
  
  // Local state for RAM input to allow temporary values during typing
  const [ramInputValue, setRamInputValue] = useState(config.ram.toString())
  
  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV

  // Calculate recommended RAM based on server type and hosting mode - memoized to avoid recalculation
  const recommendedRamRange = useMemo(() => {
    if (config.isModded) {
      return config.hostingMode === "play+host" ? [6144, 8192] : [4096, 6144] // 6-8GB or 4-6GB
    } else {
      return config.hostingMode === "play+host" ? [3072, 4096] : [2048, 3072] // 3-4GB or 2-3GB
    }
  }, [config.isModded, config.hostingMode])

  const recommendedRamMiddle = useMemo(() => {
    const [min, max] = recommendedRamRange
    return Math.round((min + max) / 2)
  }, [recommendedRamRange])

  // Set default RAM to the recommended middle if not set - only run once on mount
  useEffect(() => {
    if (!config.ram || config.ram < 512) {
      updateConfig({ ram: recommendedRamMiddle })
    }
  }, []) // Empty dependency array - only run on mount

  // Sync local input value when config.ram changes (from slider or other sources)
  useEffect(() => {
    setRamInputValue(config.ram.toString())
  }, [config.ram])

  // Check if RAM is in recommended range
  const ramStatus = useMemo(() => {
    const [min, max] = recommendedRamRange
    const isInRecommended = config.ram >= min && config.ram <= max
    const isOverAvailable = config.ram > systemInfo.availableRam
    const optimalRangeConflictsWithRed = min > systemInfo.availableRam
    
    return {
      isInRecommended,
      isOverAvailable,
      isOptimal: isInRecommended && !isOverAvailable,
      optimalRangeConflictsWithRed
    }
  }, [config.ram, recommendedRamRange, systemInfo.availableRam])

  const handleRamSliderChange = (value: number[]) => {
    updateConfig({ ram: value[0] })
  }

  const handleRamInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Just update the local state, don't commit to config yet
    setRamInputValue(e.target.value)
  }

  const commitRamValue = () => {
    const value = parseInt(ramInputValue) || 0
    // Clamp between minimum and maximum (total RAM)
    const clampedValue = Math.max(512, Math.min(value, systemInfo.totalRam))
    updateConfig({ ram: clampedValue })
    // Update local state to reflect the clamped value
    setRamInputValue(clampedValue.toString())
  }

  const handleRamInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitRamValue()
      e.currentTarget.blur() // Remove focus after Enter
    }
  }

  const handleRamInputBlur = () => {
    commitRamValue()
  }

  const handleBrowseServerDir = async () => {
    try {
      const chosenDirectory = await window.electronAPI?.pickDirectory();
      if (chosenDirectory) {
        updateConfig({ serverDirectory: chosenDirectory });
      }
    } catch (error: any) {
      console.error('Error picking server directory:', error);
      alert('Failed to select server directory: ' + error.message);
    }
  }

  // Debug functions
  const applyTestCase = (testCaseKey: string) => {
    const testCase = TEST_CASES[testCaseKey as keyof typeof TEST_CASES]
    if (testCase) {
      setSystemInfo({
        ...systemInfo,
        totalRam: testCase.totalRam,
        availableRam: testCase.availableRam
      })
      // Also reset RAM allocation to a reasonable default for the new system
      updateConfig({ ram: Math.min(recommendedRamMiddle, testCase.availableRam) })
    }
  }

  const applyCustomTestCase = () => {
    const totalRam = Math.max(1024, parseInt(customTotalRam) || 4096)
    const availableRam = Math.max(512, Math.min(parseInt(customAvailableRam) || 2048, totalRam))
    
    setSystemInfo({
      ...systemInfo,
      totalRam,
      availableRam
    })
    
    setCustomTotalRam(totalRam.toString())
    setCustomAvailableRam(availableRam.toString())
    
    // Reset RAM allocation to a reasonable default
    updateConfig({ ram: Math.min(recommendedRamMiddle, availableRam) })
  }

  const getStatusCard = () => {
    if (ramStatus.optimalRangeConflictsWithRed) {
      return {
        icon: <AlertTriangle className="h-5 w-5 text-red-400" />,
        title: "Insufficient Available RAM",
        message: `Your system only has ${systemInfo.availableRam} MB available, but the optimal range for ${config.isModded ? 'modded' : 'vanilla'} servers with ${config.hostingMode === "play+host" ? "playing and hosting" : "hosting only"} is ${recommendedRamRange[0]}-${recommendedRamRange[1]} MB. Consider closing other programs.`,
        cardClass: "border-red-400/50 bg-red-400/10",
        titleClass: "text-red-400"
      }
    } else if (ramStatus.isOverAvailable) {
      return {
        icon: <AlertTriangle className="h-5 w-5 text-red-400" />,
        title: "Exceeds Available RAM",
        message: `Allocation exceeds your available RAM (${systemInfo.availableRam} MB). Your computer's performance will suffer significantly. Consider closing other programs before continuing.`,
        cardClass: "border-red-400/50 bg-red-400/10",
        titleClass: "text-red-400"
      }
    } else if (ramStatus.isInRecommended) {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-400" />,
        title: "Optimal RAM Setting",
        message: `You're in the optimal range of ${recommendedRamRange[0]}-${recommendedRamRange[1]} MB for ${config.isModded ? 'modded' : 'vanilla'} servers with ${config.hostingMode === "play+host" ? "playing and hosting" : "hosting only"}.`,
        cardClass: "border-green-400/50 bg-green-400/10",
        titleClass: "text-green-400"
      }
    } else if (config.ram < recommendedRamRange[0]) {
      return {
        icon: <AlertCircle className="h-5 w-5 text-yellow-400" />,
        title: "Below Optimal",
        message: `For optimal performance on ${config.isModded ? 'modded' : 'vanilla'} servers with ${config.hostingMode === "play+host" ? "playing and hosting" : "hosting only"}, we recommend ${recommendedRamRange[0]}-${recommendedRamRange[1]} MB of RAM. Consider increasing your allocation for better performance.`,
        cardClass: "border-yellow-400/50 bg-yellow-400/10",
        titleClass: "text-yellow-400"
      }
    } else {
      return {
        icon: <AlertCircle className="h-5 w-5 text-orange-400" />,
        title: "Above Optimal",
        message: `Your allocation exceeds the optimal range of ${recommendedRamRange[0]}-${recommendedRamRange[1]} MB for ${config.isModded ? 'modded' : 'vanilla'} servers. This may not provide additional benefits and could waste system resources.`,
        cardClass: "border-orange-400/50 bg-orange-400/10",
        titleClass: "text-orange-400"
      }
    }
  }

  const statusCard = getStatusCard()

  // Create a stable animation key that only changes when the actual status type changes
  const getStatusAnimationKey = () => {
    if (ramStatus.optimalRangeConflictsWithRed) return "insufficient-ram"
    if (ramStatus.isOverAvailable) return "exceeds-available"
    if (ramStatus.isInRecommended) return "optimal"
    if (config.ram < recommendedRamRange[0]) return "below-optimal"
    return "above-optimal"
  }

  // Calculate zone boundaries to prevent overlaps
  const getZoneBoundaries = () => {
    const [optimalMin, optimalMax] = recommendedRamRange
    const availableRam = systemInfo.availableRam
    
    // If optimal range conflicts with red zone, don't show green
    if (optimalMin > availableRam) {
      return {
        yellowEnd: availableRam,
        showGreen: false,
        greenStart: 0,
        greenEnd: 0,
        orangeStart: 0,
        orangeEnd: 0,
        redStart: availableRam
      }
    }
    
    // Green zone ends where orange zone begins - minimum of optimal max and available RAM
    const greenEnd = Math.min(optimalMax, availableRam)
    // Orange zone starts after green zone and goes to available RAM
    const orangeStart = greenEnd
    const orangeEnd = availableRam
    // Red zone starts at available RAM
    const redStart = availableRam
    
    const result = {
      yellowEnd: optimalMin,
      showGreen: true,
      greenStart: optimalMin,
      greenEnd: greenEnd,
      orangeStart: orangeStart,
      orangeEnd: orangeEnd,
      redStart: redStart
    }
    
    return result
  }

  const zones = getZoneBoundaries()

  // Function to convert RAM value to slider position percentage
  // This matches how Radix UI slider calculates positions
  const valueToPosition = (value: number) => {
    const min = 512
    const max = systemInfo.totalRam
    const clampedValue = Math.max(min, Math.min(max, value))
    return ((clampedValue - min) / (max - min)) * 100
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

          <div className="space-y-4">
            {/* RAM Input and Slider */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-linen mb-2 block">RAM Allocation (MB)</Label>
                  <Input
                    type="number"
                    min={512}
                    max={systemInfo.totalRam}
                    value={ramInputValue}
                    onChange={handleRamInputChange}
                    onKeyDown={handleRamInputKeyDown}
                    onBlur={handleRamInputBlur}
                    className="border-cool-gray/30 bg-night text-linen placeholder:text-cool-gray/50"
                  />
                </div>
              </div>

              <div>
                <motion.div className="relative">
                  {/* Custom colored track slider */}
                  <div className="relative w-full">
                    {/* Background track with zones */}
                    <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-cool-gray/20">
                      {/* Yellow zone (below optimal) */}
                      <div 
                        className="absolute inset-y-0 bg-yellow-400/80"
                        style={{
                          left: `${valueToPosition(512)}%`,
                          width: `${valueToPosition(zones.yellowEnd) - valueToPosition(512)}%`
                        }}
                      />
                      
                      {/* Green zone (optimal range) */}
                      {zones.showGreen && zones.greenEnd > zones.greenStart && (
                        <div 
                          className="absolute inset-y-0 bg-green-400/80"
                          style={{
                            left: `${valueToPosition(zones.greenStart)}%`,
                            width: `${valueToPosition(zones.greenEnd) - valueToPosition(zones.greenStart)}%`
                          }}
                        />
                      )}
                      
                      {/* Orange zone (above optimal) */}
                      {zones.orangeEnd > zones.orangeStart && (
                        <div 
                          className="absolute inset-y-0 bg-orange-400/80"
                          style={{
                            left: `${valueToPosition(zones.orangeStart)}%`,
                            width: `${valueToPosition(zones.orangeEnd) - valueToPosition(zones.orangeStart)}%`
                          }}
                        />
                      )}
                      
                      {/* Red zone (exceeds available RAM) */}
                      <div 
                        className="absolute inset-y-0 bg-red-400/80"
                        style={{
                          left: `${valueToPosition(zones.redStart)}%`,
                          width: `${valueToPosition(systemInfo.totalRam) - valueToPosition(zones.redStart)}%`
                        }}
                      />
                    </div>
                    
                    {/* Slider overlay with custom styling */}
                    <div className="absolute inset-0 -mt-0.5">
                      <div className="relative w-full h-2 flex items-center">
                        <div className="w-full" style={{
                          '--track-bg': 'transparent',
                          '--range-bg': 'transparent'
                        } as React.CSSProperties}>
                          <Slider
                            value={[config.ram]}
                            max={systemInfo.totalRam}
                            min={512}
                            step={16}
                            onValueChange={handleRamSliderChange}
                            className="w-full [&>span:first-child]:bg-transparent [&>span:first-child>span]:bg-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Labels below the slider */}
                  <div className="relative mt-4">
                    <div className="flex justify-between text-xs text-cool-gray">
                      <span>512 MB</span>
                      <span className="text-linen">Available: {systemInfo.availableRam} MB</span>
                      <span>{systemInfo.totalRam} MB</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Status Card */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              key={getStatusAnimationKey()} // Only re-animate when status type actually changes
            >
              <Card className={statusCard.cardClass}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <motion.div
                      className="mt-1"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {statusCard.icon}
                    </motion.div>
                    <div className="text-sm">
                      <p className={`font-medium ${statusCard.titleClass}`}>
                        {statusCard.title}
                      </p>
                      <p className="text-cool-gray">
                        {statusCard.message}
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

        {/* Debug Testing Panel - Only visible in development mode */}
        {isDevelopment && (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-purple-400/50 bg-purple-400/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-400">
                  <TestTube className="h-5 w-5" />
                  Debug Testing Panel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-cool-gray mb-4">
                  <p>Current System: {systemInfo.totalRam} MB total, {systemInfo.availableRam} MB available</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-linen mb-2 block">Test Case Presets</Label>
                    <Select onValueChange={applyTestCase}>
                      <SelectTrigger className="border-cool-gray/30 bg-night text-linen">
                        <SelectValue placeholder="Select a test case..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TEST_CASES).map(([key, testCase]) => (
                          <SelectItem key={key} value={key}>
                            {testCase.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-linen mb-2 block">Custom Total RAM (MB)</Label>
                      <Input
                        type="number"
                        min={1024}
                        value={customTotalRam}
                        onChange={(e) => setCustomTotalRam(e.target.value)}
                        className="border-cool-gray/30 bg-night text-linen"
                        placeholder="16384"
                      />
                    </div>
                    <div>
                      <Label className="text-linen mb-2 block">Custom Available RAM (MB)</Label>
                      <Input
                        type="number"
                        min={512}
                        value={customAvailableRam}
                        onChange={(e) => setCustomAvailableRam(e.target.value)}
                        className="border-cool-gray/30 bg-night text-linen"
                        placeholder="12288"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={applyCustomTestCase}
                    variant="outline"
                    className="border-purple-400/30 text-purple-400 hover:bg-purple-400/10 bg-night"
                  >
                    Apply Custom Test Case
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}
