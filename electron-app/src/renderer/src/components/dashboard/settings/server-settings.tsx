"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { FileText, Save, HelpCircle, Check, AlertTriangle } from "lucide-react"
import { useServerStore } from "@/lib/store"
import type { ServerProperty } from "@/lib/store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ServerSettings() {
  const { toast } = useToast()
  const { serverPath, serverProperties, updateServerProperty } = useServerStore()
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Local state for properties that will only be applied when saved
  const [localProperties, setLocalProperties] = useState<ServerProperty[]>([])

  const [securityWarningOpen, setSecurityWarningOpen] = useState(false)
  const [securityWarningKey, setSecurityWarningKey] = useState<string>("")
  const [securityWarningMessage, setSecurityWarningMessage] = useState<string>("")
  const [pendingSecurityChange, setPendingSecurityChange] = useState<{ key: string; value: boolean } | null>(null)

  // Initialize local properties from store
  useEffect(() => {
    setLocalProperties([...serverProperties])
  }, [serverProperties])

  const openPropertiesFile = () => {
    // In a real app, this would use IPC to open the file
    toast({
      title: "Opening server.properties",
      description: `Opening: ${serverPath}/server.properties`,
    })
  }

  const saveProperties = async () => {
    setIsSaving(true)

    try {
      // In a real app, this would use IPC to save the properties to the server.properties file
      // await window.electronAPI.saveServerProperties(serverPath, localProperties)

      // Simulate saving
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Apply all changes to the store at once
      localProperties.forEach((prop) => {
        updateServerProperty(prop.key, prop.value)
      })

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)

      toast({
        title: "Settings saved",
        description: "Server properties have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePropertyChange = (key: string, value: string | number | boolean) => {
    // Show warning when disabling security features
    if (key === "white-list" && value === false) {
      setSecurityWarningKey(key)
      setSecurityWarningMessage(
        "Disabling the whitelist will allow any player to join your server. This may expose your server to griefers and unwanted players.",
      )
      setPendingSecurityChange({ key, value: value as boolean })
      setSecurityWarningOpen(true)
      return
    }

    if (key === "online-mode" && value === false) {
      setSecurityWarningKey(key)
      setSecurityWarningMessage(
        "Disabling online mode will allow players with cracked clients to join. This is a security risk as player identities cannot be verified.",
      )
      setPendingSecurityChange({ key, value: value as boolean })
      setSecurityWarningOpen(true)
      return
    }

    // Special handling for whitelist settings
    if (key === "white-list") {
      if (value === true) {
        // When enabling whitelist, also enable enforce whitelist
        setLocalProperties((prev) =>
          prev.map((prop) =>
            prop.key === "white-list"
              ? { ...prop, value: true }
              : prop.key === "enforce-whitelist"
                ? { ...prop, value: true }
                : prop,
          ),
        )
      } else {
        // When disabling whitelist, also disable enforce whitelist
        setLocalProperties((prev) =>
          prev.map((prop) =>
            prop.key === "white-list"
              ? { ...prop, value: false }
              : prop.key === "enforce-whitelist"
                ? { ...prop, value: false }
                : prop,
          ),
        )
      }
      return
    }

    // Update the local state
    setLocalProperties((prev) => prev.map((prop) => (prop.key === key ? { ...prop, value } : prop)))
  }

  const confirmSecurityChange = () => {
    if (pendingSecurityChange) {
      if (pendingSecurityChange.key === "white-list" && pendingSecurityChange.value === false) {
        // When disabling whitelist, also disable enforce whitelist
        setLocalProperties((prev) =>
          prev.map((prop) =>
            prop.key === "white-list"
              ? { ...prop, value: false }
              : prop.key === "enforce-whitelist"
                ? { ...prop, value: false }
                : prop,
          ),
        )
      } else {
        // For other security changes
        setLocalProperties((prev) =>
          prev.map((prop) =>
            prop.key === pendingSecurityChange.key ? { ...prop, value: pendingSecurityChange.value } : prop,
          ),
        )
      }
      setPendingSecurityChange(null)
      setSecurityWarningOpen(false)
    }
  }

  // Group properties by category
  const gameplaySettings = localProperties.filter((prop) => prop.category === "gameplay")
  const worldSettings = localProperties.filter((prop) => prop.category === "world")
  const securitySettings = localProperties.filter((prop) => prop.category === "security")
  const performanceSettings = localProperties.filter((prop) => prop.category === "performance")

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-linen">Server Settings</h2>
          <p className="text-cool-gray">Configure your Minecraft server properties</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={openPropertiesFile}
            className="border-cool-gray text-linen hover:bg-cool-gray/10"
          >
            <FileText className="h-4 w-4 mr-2" />
            Open server.properties
          </Button>

          <Button
            onClick={saveProperties}
            disabled={isSaving}
            className="bg-linen text-night hover:bg-linen/90 relative"
          >
            {saveSuccess ? <Check className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>

      <TooltipProvider>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gameplay Settings */}
          <SettingsCard title="Gameplay" description="General gameplay settings">
            {gameplaySettings.map((property) => (
              <SettingField
                key={property.key}
                property={property}
                onChange={handlePropertyChange}
                localProperties={localProperties}
              />
            ))}
          </SettingsCard>

          {/* World Settings */}
          <SettingsCard title="World" description="World generation settings">
            {worldSettings.map((property) => (
              <SettingField
                key={property.key}
                property={property}
                onChange={handlePropertyChange}
                localProperties={localProperties}
              />
            ))}
          </SettingsCard>

          {/* Security Settings */}
          <SettingsCard title="Security" description="Access control and security settings">
            {securitySettings.map((property) => (
              <SettingField
                key={property.key}
                property={property}
                onChange={handlePropertyChange}
                localProperties={localProperties}
              />
            ))}
          </SettingsCard>

          {/* Performance Settings */}
          <SettingsCard title="Performance" description="Settings that affect server performance">
            {performanceSettings.map((property) => (
              <SettingField
                key={property.key}
                property={property}
                onChange={handlePropertyChange}
                localProperties={localProperties}
              />
            ))}
          </SettingsCard>
        </div>
      </TooltipProvider>

      {/* Security Warning Dialog */}
      <Dialog open={securityWarningOpen} onOpenChange={setSecurityWarningOpen}>
        <DialogContent className="bg-space-cadet border-cool-gray/30 text-linen">
          <DialogHeader>
            <DialogTitle>Security Warning</DialogTitle>
            <DialogDescription className="text-cool-gray">
              You are about to disable an important security feature.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-night/50 p-3 rounded border border-yellow-500/30 text-cool-gray">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 mt-0.5 text-yellow-400" />
                <div>
                  <p className="text-yellow-400 font-medium">Warning</p>
                  <p className="mt-1">{securityWarningMessage}</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSecurityWarningOpen(false)}
              className="border-cool-gray text-linen hover:bg-cool-gray/10"
            >
              Cancel
            </Button>
            <Button onClick={confirmSecurityChange} className="bg-linen text-night hover:bg-linen/90">
              I Understand, Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface SettingsCardProps {
  title: string
  description: string
  children: React.ReactNode
}

function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <Card className="border-cool-gray/30 bg-space-cadet shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-linen">{title}</CardTitle>
        <CardDescription className="text-cool-gray">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

interface SettingFieldProps {
  property: {
    key: string
    label: string
    type: "text" | "number" | "checkbox" | "select"
    value: string | number | boolean
    options?: string[]
    min?: number
    max?: number
    tooltip: string
  }
  onChange: (key: string, value: string | number | boolean) => void
  localProperties?: ServerProperty[]
}

function SettingField({ property, onChange, localProperties }: SettingFieldProps) {
  const handleChange = (value: string | number | boolean) => {
    onChange(property.key, value)
  }

  // Check if enforce-whitelist should be disabled
  const isEnforceWhitelistDisabled =
    property.key === "enforce-whitelist" && localProperties?.find((prop) => prop.key === "white-list")?.value === false

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={property.key} className="text-linen">
          {property.label}
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0 text-cool-gray hover:text-linen hover:bg-transparent"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="sr-only">Info</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-night text-linen border-cool-gray/30 max-w-xs">
            <p>{property.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {property.type === "text" && (
        <Input
          id={property.key}
          value={property.value as string}
          onChange={(e) => handleChange(e.target.value)}
          className="bg-night border-cool-gray/30 text-linen"
          maxLength={property.key === "motd" ? 59 : undefined}
        />
      )}

      {property.type === "number" && (
        <Input
          id={property.key}
          type="number"
          value={property.value as number}
          onChange={(e) => {
            const value = Number.parseInt(e.target.value)
            if (isNaN(value)) return
            if (property.min !== undefined && value < property.min) return
            if (property.max !== undefined && value > property.max) return
            handleChange(value)
          }}
          min={property.min}
          max={property.max}
          className="bg-night border-cool-gray/30 text-linen"
        />
      )}

      {property.type === "checkbox" && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={property.key}
            checked={property.value as boolean}
            onCheckedChange={handleChange}
            className="border-cool-gray data-[state=checked]:bg-linen data-[state=checked]:text-night"
            disabled={isEnforceWhitelistDisabled}
          />
          <label
            htmlFor={property.key}
            className={`text-sm text-cool-gray leading-none cursor-pointer ${
              isEnforceWhitelistDisabled ? "opacity-50" : ""
            }`}
          >
            {property.value ? "Enabled" : "Disabled"}
          </label>
        </div>
      )}

      {property.type === "select" && property.options && (
        <Select value={property.value as string} onValueChange={handleChange}>
          <SelectTrigger className="bg-night border-cool-gray/30 text-linen">
            <SelectValue placeholder={`Select ${property.label}`} />
          </SelectTrigger>
          <SelectContent className="bg-space-cadet border-cool-gray/30 text-linen">
            {property.options.map((option) => (
              <SelectItem key={option} value={option} className="hover:bg-night/50 focus:bg-night/50 focus:text-linen">
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
