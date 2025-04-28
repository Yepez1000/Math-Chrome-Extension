"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useServerStore } from "@/lib/store"

export function PerformanceGraphs() {
  const { cpu, ram, onlinePlayers, updatePerformance } = useServerStore()
  const [timeScale, setTimeScale] = useState("1m")

  // Define data arrays for different time scales
  const [cpuData, setCpuData] = useState<{ [key: string]: number[] }>({
    "1m": Array(60).fill(0),
    "5m": Array(300).fill(0),
    "30m": Array(1800).fill(0),
    "1h": Array(3600).fill(0),
    "4h": Array(14400).fill(0),
  })

  const [ramData, setRamData] = useState<{ [key: string]: number[] }>({
    "1m": Array(60).fill(0),
    "5m": Array(300).fill(0),
    "30m": Array(1800).fill(0),
    "1h": Array(3600).fill(0),
    "4h": Array(14400).fill(0),
  })

  const [playersData, setPlayersData] = useState<{ [key: string]: number[] }>({
    "1m": Array(60).fill(onlinePlayers),
    "5m": Array(300).fill(onlinePlayers),
    "30m": Array(1800).fill(onlinePlayers),
    "1h": Array(3600).fill(onlinePlayers),
    "4h": Array(14400).fill(onlinePlayers),
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Update data every second
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate CPU and RAM fluctuations
      const newCpu = Math.max(1, Math.min(100, cpu + (Math.random() * 2 - 1)))
      const newRam = Math.floor(Math.max(1000, Math.min(4000, ram + (Math.random() * 100 - 50))))

      // Update the store
      updatePerformance(newCpu, newRam)

      // Update the graph data for all time scales
      setCpuData((prev) => {
        const updated = { ...prev }
        Object.keys(updated).forEach((scale) => {
          updated[scale] = [...updated[scale].slice(1), newCpu]
        })
        return updated
      })

      setRamData((prev) => {
        const updated = { ...prev }
        Object.keys(updated).forEach((scale) => {
          updated[scale] = [...updated[scale].slice(1), newRam]
        })
        return updated
      })

      setPlayersData((prev) => {
        const updated = { ...prev }
        Object.keys(updated).forEach((scale) => {
          updated[scale] = [...updated[scale].slice(1), onlinePlayers]
        })
        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [cpu, ram, onlinePlayers, updatePerformance])

  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Get current data based on timeScale
    const currentCpuData = cpuData[timeScale]
    const currentRamData = ramData[timeScale]
    const currentPlayersData = playersData[timeScale]

    // Draw CPU graph
    drawGraph(ctx, currentCpuData, canvas.width, canvas.height / 2, "rgb(59, 130, 246)", 100)

    // Draw RAM graph
    drawGraph(ctx, currentRamData, canvas.width, canvas.height / 2, "rgb(168, 85, 247)", 4000, canvas.height / 2)

    // Draw players graph at the bottom - changed from red to green
    drawBarGraph(
      ctx,
      currentPlayersData,
      canvas.width,
      canvas.height / 6,
      "rgb(34, 197, 94)", // Changed from red to green
      40,
      canvas.height - canvas.height / 6,
    )
  }, [cpuData, ramData, playersData, timeScale])

  const drawGraph = (
    ctx: CanvasRenderingContext2D,
    data: number[],
    width: number,
    height: number,
    color: string,
    maxValue: number,
    yOffset = 0,
  ) => {
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 2

    const step = width / (data.length - 1)

    data.forEach((value, i) => {
      const x = i * step
      const y = height - (value / maxValue) * height + yOffset

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    ctx.stroke()

    // Convert rgb color to rgba with proper alpha values
    // Extract the RGB values from the color string
    const rgbMatch = color.match(/rgb$$(\d+),\s*(\d+),\s*(\d+)$$/)
    let fillColorStart, fillColorEnd

    if (rgbMatch) {
      // If it's an rgb color, convert to rgba
      const [_, r, g, b] = rgbMatch
      fillColorStart = `rgba(${r}, ${g}, ${b}, 0.3)`
      fillColorEnd = `rgba(${r}, ${g}, ${b}, 0.05)`
    } else {
      // Fallback for other color formats
      fillColorStart = color
      fillColorEnd = color
    }

    // Add gradient fill with proper rgba colors
    const gradient = ctx.createLinearGradient(0, yOffset, 0, height + yOffset)
    gradient.addColorStop(0, fillColorStart)
    gradient.addColorStop(1, fillColorEnd)

    ctx.lineTo(width, height + yOffset)
    ctx.lineTo(0, height + yOffset)
    ctx.fillStyle = gradient
    ctx.fill()
  }

  const drawBarGraph = (
    ctx: CanvasRenderingContext2D,
    data: number[],
    width: number,
    height: number,
    color: string,
    maxValue: number,
    yOffset = 0,
  ) => {
    const step = width / data.length
    const barWidth = Math.max(1, step - 1)

    // Convert rgb color to rgba with proper alpha value
    const rgbMatch = color.match(/rgb$$(\d+),\s*(\d+),\s*(\d+)$$/)
    let fillColor

    if (rgbMatch) {
      // If it's an rgb color, convert to rgba
      const [_, r, g, b] = rgbMatch
      fillColor = `rgba(${r}, ${g}, ${b}, 0.5)`
    } else {
      // Fallback
      fillColor = color
    }

    data.forEach((value, i) => {
      const x = i * step
      const barHeight = (value / maxValue) * height
      const y = height - barHeight + yOffset

      ctx.fillStyle = fillColor
      ctx.fillRect(x, y, barWidth, barHeight)
    })
  }

  return (
    <Card className="border-cool-gray/30 bg-night">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <h3 className="text-linen font-medium mb-2 md:mb-0">Server Statistics</h3>

          <Tabs defaultValue="1m" value={timeScale} onValueChange={setTimeScale} className="w-auto">
            <TabsList className="bg-night border border-cool-gray/30">
              <TabsTrigger value="1m" className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen">
                1m
              </TabsTrigger>
              <TabsTrigger value="5m" className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen">
                5m
              </TabsTrigger>
              <TabsTrigger value="30m" className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen">
                30m
              </TabsTrigger>
              <TabsTrigger value="1h" className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen">
                1h
              </TabsTrigger>
              <TabsTrigger value="4h" className="data-[state=active]:bg-space-cadet data-[state=active]:text-linen">
                4h
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative h-[300px] w-full">
          <canvas ref={canvasRef} width={800} height={600} className="absolute inset-0 w-full h-full" />

          <div className="absolute top-2 left-2 text-xs text-blue-400">CPU: {cpu.toFixed(1)}%</div>

          <div className="absolute top-2 right-2 text-xs text-purple-400">RAM: {ram} MB</div>

          <div className="absolute bottom-2 right-2 text-xs text-green-400">Players: {onlinePlayers}</div>
        </div>
      </CardContent>
    </Card>
  )
}
