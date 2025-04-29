"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"
import { useServerStore } from "@/lib/store"
import { ArrowLeft, X, Clock, Save } from "lucide-react"
import type { ScheduledTask } from "@/lib/store"

interface TaskCreationFormProps {
  task?: ScheduledTask | null
  onClose: () => void
}

export function TaskCreationForm({ task, onClose }: TaskCreationFormProps) {
  const { toast } = useToast()
  const { addScheduledTask, updateScheduledTask } = useServerStore()

  const [name, setName] = useState(task?.name || "")
  const [commands, setCommands] = useState(task?.commands || "")
  const [time, setTime] = useState(task?.time || "")
  const [repeat, setRepeat] = useState(task?.repeat || false)

  const [errors, setErrors] = useState({
    name: "",
    commands: "",
    time: "",
  })

  // Validate time format (HH:MM:SS)
  const validateTimeFormat = (value: string) => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/
    return timeRegex.test(value)
  }

  // Handle time input change with validation
  const handleTimeChange = (value: string) => {
    setTime(value)

    if (value && !validateTimeFormat(value)) {
      setErrors((prev) => ({ ...prev, time: "Time must be in 24-hour format (HH:MM:SS)" }))
    } else {
      setErrors((prev) => ({ ...prev, time: "" }))
    }
  }

  // Validate form before submission
  const validateForm = () => {
    let valid = true
    const newErrors = {
      name: "",
      commands: "",
      time: "",
    }

    if (!name.trim()) {
      newErrors.name = "Task name is required"
      valid = false
    } else if (name.length < 3) {
      newErrors.name = "Task name must be at least 3 characters"
      valid = false
    }

    if (!commands.trim()) {
      newErrors.commands = "At least one command is required"
      valid = false
    }

    if (!time) {
      newErrors.time = "Time is required"
      valid = false
    } else if (!validateTimeFormat(time)) {
      newErrors.time = "Time must be in 24-hour format (HH:MM:SS)"
      valid = false
    }

    setErrors(newErrors)
    return valid
  }

  // Handle form submission
  const handleSubmit = () => {
    if (!validateForm()) return

    if (task) {
      // Update existing task
      updateScheduledTask(task.id, {
        name,
        commands,
        time,
        repeat,
      })

      toast({
        title: "Task updated",
        description: "The scheduled task has been updated successfully.",
      })
    } else {
      // Create new task
      addScheduledTask({
        name,
        commands,
        time,
        repeat,
        enabled: true,
      })

      toast({
        title: "Task created",
        description: "The scheduled task has been created successfully.",
      })
    }

    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="border-cool-gray/30 bg-space-cadet shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-linen">{task ? "Edit Task" : "Create New Task"}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-cool-gray hover:text-linen hover:bg-night/50"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="task-name" className="text-linen">
              Task Name
            </Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Restart"
              className="bg-night border-cool-gray/30 text-linen"
            />
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="commands" className="text-linen">
              Commands
            </Label>
            <Textarea
              id="commands"
              value={commands}
              onChange={(e) => setCommands(e.target.value)}
              placeholder="/say Server will restart in 5 minutes!; /save-all; /stop"
              className="bg-night border-cool-gray/30 text-linen min-h-[100px]"
            />
            <p className="text-xs text-cool-gray">Add multiple commands by separating them with a semicolon (;)</p>
            {errors.commands && <p className="text-red-400 text-sm">{errors.commands}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="time" className="text-linen">
              Time
            </Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cool-gray" />
              <Input
                id="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                placeholder="04:00:00"
                className="bg-night border-cool-gray/30 text-linen pl-10"
              />
            </div>
            <p className="text-xs text-cool-gray">Define time in the 24-hour format (HH:MM:SS)</p>
            {errors.time && <p className="text-red-400 text-sm">{errors.time}</p>}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="repeat"
              checked={repeat}
              onCheckedChange={(checked) => setRepeat(checked as boolean)}
              className="border-cool-gray data-[state=checked]:bg-linen data-[state=checked]:text-night"
            />
            <Label htmlFor="repeat" className="text-cool-gray cursor-pointer">
              Repeat daily
            </Label>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={onClose} className="border-cool-gray text-linen hover:bg-cool-gray/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSubmit} className="bg-linen text-night hover:bg-linen/90">
              <Save className="mr-2 h-4 w-4" />
              {task ? "Update Task" : "Save Task"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
