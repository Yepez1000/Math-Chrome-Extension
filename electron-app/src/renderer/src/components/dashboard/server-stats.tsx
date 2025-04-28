"use client"

import type React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Cpu, MemoryStickIcon as Memory, Clock } from "lucide-react"
import { useServerStore } from "@/lib/store"

export function ServerStats() {
  const { cpu, ram, uptime } = useServerStore()

  // Format uptime
  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${minutes}m ${secs}s`
    }
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard
        icon={<Cpu className="h-6 w-6 text-blue-400" />}
        title="CPU"
        value={`${cpu.toFixed(1)}%`}
        color="blue"
      />

      <StatCard icon={<Memory className="h-6 w-6 text-purple-400" />} title="RAM" value={`${ram} MB`} color="purple" />

      <StatCard
        icon={<Clock className="h-6 w-6 text-green-400" />}
        title="UPTIME"
        value={formatUptime(uptime)}
        color="green"
      />
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  title: string
  value: string
  color: "blue" | "purple" | "green"
}

function StatCard({ icon, title, value, color }: StatCardProps) {
  const getGradient = () => {
    switch (color) {
      case "blue":
        return "from-blue-500/20 to-blue-600/5"
      case "purple":
        return "from-purple-500/20 to-purple-600/5"
      case "green":
        return "from-green-500/20 to-green-600/5"
    }
  }

  return (
    <Card className="border-cool-gray/30 bg-night overflow-hidden">
      <CardContent className="p-0">
        <div className={`bg-gradient-to-br ${getGradient()} p-4`}>
          <div className="flex items-center gap-4">
            <div className="bg-night/30 rounded-full p-3">{icon}</div>
            <div>
              <p className="text-cool-gray text-sm">{title}</p>
              <p className="text-linen text-2xl font-bold">{value}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
