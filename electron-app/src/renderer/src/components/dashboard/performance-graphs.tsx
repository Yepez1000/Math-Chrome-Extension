"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PerformanceGraphsProps {
  cpu: number
  ram: number
}

export function PerformanceGraphs({ cpu, ram }: PerformanceGraphsProps) {
  const [timeScale, setTimeScale] = useState("1m")
  const [cpuData, setCpuData] = useState<number[]>(Array(60).fill(0))
  const [ramData, setRamData] = useState<number[]>(Array(60).fill(0))
  const [playersData, setPlayersData] = useState<number[]>(Array(60).fill(9))

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Update data every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuData((prev) => [...prev.slice(1), cpu])
      setRamData((prev) => [...prev.slice(1), ram])

      // Simulate random player count changes
      const lastPlayerCount = playersData[playersData.length - 1]
      const change = Math.random() > 0.95 ? (Math.random() > 0.5 ? 1 : -1) : 0
      const newCount = Math.max(0, Math.min(40, lastPlayerCount + change))
      setPlayersData((prev) => [...prev.slice(1), newCount])
    }, 1000)

    return () => clearInterval(interval)
  }, [cpu, ram])

  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw CPU graph
    drawGraph(ctx, cpuData, canvas.width, canvas.height / 2, "rgb(59, 130, 246)", 100)

    // Draw RAM graph
    drawGraph(ctx, ramData, canvas.width, canvas.height / 2, "rgb(168, 85, 247)", 4000, canvas.height / 2)

    // Draw players graph at the bottom
    drawBarGraph(
      ctx,
      playersData,
      canvas.width,
      canvas.height / 6,
      "rgb(239, 68, 68)",
      40,
      canvas.height - canvas.height / 6,
    )
  }, [cpuData, ramData, playersData])

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

          <div className="absolute bottom-2 right-2 text-xs text-red-400">
            Players: {playersData[playersData.length - 1]}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
