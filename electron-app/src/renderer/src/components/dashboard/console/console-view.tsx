"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"

export function ConsoleView() {
  const [command, setCommand] = useState("")

  const handleSendCommand = () => {
    if (!command.trim()) return

    // In a real app, this would send the command to the server
    console.log("Sending command:", command)

    // Clear the input
    setCommand("")
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-night rounded-md p-4 h-[400px] overflow-y-auto font-mono text-sm text-cool-gray flex-1">
        <p>[12:34:56 INFO]: Server started</p>
        <p>[12:34:57 INFO]: Loading properties</p>
        <p>[12:34:58 INFO]: Starting Minecraft server on 88.77.66.55:25565</p>
        <p>[12:35:01 INFO]: Preparing level "world"</p>
        <p>[12:35:05 INFO]: Done! For help, type "help"</p>
        <p>[12:35:10 INFO]: Player jamoír joined the game</p>
        <p>[12:35:15 INFO]: Player Daleth joined the game</p>
        <p className="text-linen">[12:35:20 INFO]: Player RockDigger joined the game</p>
      </div>

      <div className="flex mt-4">
        <Input
          type="text"
          placeholder="Type a command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendCommand()}
          className="bg-night border-cool-gray/30 text-linen"
        />
        <Button onClick={handleSendCommand} className="ml-2 bg-linen text-night hover:bg-linen/90">
          <Send className="h-4 w-4" />
          <span className="sr-only">Send command</span>
        </Button>
      </div>
    </div>
  )
}
