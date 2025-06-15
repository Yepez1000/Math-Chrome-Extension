import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { motion } from "framer-motion"
import type { ServerConfig } from "@/stores/server-config-store"

type ServerType = ServerConfig["serverType"]

export interface ServerTypeInfo {
  id: ServerType
  name: string
  description: string
  icon: React.ElementType
  isModded: boolean
  performance: number // 1-5 scale
  plugins: boolean
  mods: boolean
  recommended?: boolean
}

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
}

// Performance bars component
const PerformanceBars = ({ level }: { level: number }) => (
  <div className="flex gap-1 mt-2">
    {[1, 2, 3, 4, 5].map((bar) => (
      <div key={bar} className={`h-1.5 w-full rounded-full ${bar <= level ? "bg-linen" : "bg-cool-gray/30"}`} />
    ))}
  </div>
)

interface ServerTypeCardProps {
  type: ServerTypeInfo
  isSelected: boolean
  onSelect: () => void
}

export const ServerTypeCard = ({ type, isSelected, onSelect }: ServerTypeCardProps) => {
  const Icon = type.icon
  return (
    <motion.div variants={itemVariants} whileHover="active" className="relative">
      {type.recommended && (
        <div className="absolute -top-1 -right-1 z-10">
          <div className="bg-linen text-night text-xs font-bold py-1 px-2 rounded-md transform rotate-3 shadow-md">
            Recommended for Beginners
          </div>
        </div>
      )}
      <Card
        className={`cursor-pointer transition-all hover:border-linen h-full ${
          isSelected ? "border-linen bg-linen/5" : "border-cool-gray/30 bg-night"
        }`}
        onClick={onSelect}
      >
        <CardHeader className="pb-2">
          <motion.div
            className="flex justify-center mb-2"
            animate={{ rotate: isSelected ? [0, 5, 0, -5, 0] : 0 }}
            transition={{ duration: 0.5, delay: 0.2, repeat: isSelected ? 1 : 0 }}
          >
            <Icon className={`h-10 w-10 ${isSelected ? "text-linen" : "text-cool-gray"}`} />
          </motion.div>
          <CardTitle className="text-center text-linen">{type.name}</CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
          <CardDescription className="text-center text-cool-gray lg:min-h-[88px] md:min-h-[110px] sm:min-h-[0px]">{type.description}</CardDescription>

          <div className="mt-4 space-y-2 text-xs text-cool-gray">
            <div>
              <div className="flex justify-between mb-1">
                <span>Performance</span>
                <span className="text-linen">
                  {["Low", "Moderate", "Good", "High", "Excellent"][type.performance - 1]}
                </span>
              </div>
              <PerformanceBars level={type.performance} />
            </div>

            <div className="flex justify-between pt-2">
              <span className={`${type.plugins ? "text-linen" : "text-cool-gray/50"}`}>
                {type.plugins ? "✓ Plugin Support" : "✗ No Plugins"}
              </span>
              <span className={`${type.mods ? "text-linen" : "text-cool-gray/50"}`}>
                {type.mods ? "✓ Mod Support" : "✗ No Mods"}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center pt-2">
          <Button
            variant={isSelected ? "default" : "outline"}
            onClick={onSelect}
            className={`w-full ${
              isSelected
                ? "bg-linen text-night hover:bg-linen/90"
                : "border-cool-gray text-linen hover:bg-cool-gray/10 bg-night"
            }`}
          >
            Select {type.name}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
} 