"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import { devLog } from '@shared/utils/logger'
import { useServerListStore } from "@/lib/servers-store"
import { IPC_CHANNELS } from "@shared/types"

const MAX_CONSOLE_LINES = 200;
const POLLING_INTERVAL = 1000; // Poll every 1 second

export function ConsoleView() {
  const [command, setCommand] = useState("")
  const [consoleOutput, setConsoleOutput] = useState<string[]>([])
  
  const { selectedServerId, servers } = useServerListStore()
  const server = servers.find(s => s.id === selectedServerId)
  const isServerRunning = server?.status === 'online'
  
  const consoleRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Simple polling-based log fetching
  useEffect(() => {
    if (!selectedServerId || !server) {
      setConsoleOutput([]);
      return;
    }

    const fetchLogs = async () => {
      try {
        const result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.GET_LOG_CONTENT, selectedServerId);
        if (result.success) {
          // Only update if content has changed to avoid unnecessary re-renders
          setConsoleOutput(prevOutput => {
            const newContent = result.content || [];
            // Simple comparison - if lengths are different or last lines don't match, update
            if (prevOutput.length !== newContent.length || 
                (newContent.length > 0 && prevOutput[prevOutput.length - 1] !== newContent[newContent.length - 1])) {
              devLog(`Console updated: ${newContent.length} lines`);
              return newContent;
            }
            return prevOutput;
          });
        } else if (result.error) {
          devLog(`Failed to fetch logs: ${result.error}`);
        }
      } catch (error) {
        devLog('Error fetching logs:', error);
      }
    };

    // Initial fetch
    fetchLogs();

    // Set up polling only if server is running
    if (isServerRunning) {
      pollingIntervalRef.current = setInterval(fetchLogs, POLLING_INTERVAL);
      devLog(`Started polling logs for server: ${selectedServerId}`);
    }

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        devLog(`Stopped polling logs for server: ${selectedServerId}`);
      }
    };
  }, [selectedServerId, server, isServerRunning]);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [consoleOutput])

  const handleSendCommand = async () => {
    if (!command.trim() || !isServerRunning || !selectedServerId) return;

    try {
      await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SERVER_SEND_COMMAND, {
        serverId: selectedServerId,
        command: command.trim()
      });
      
      // Force a log refresh after sending command to see the response quickly
      setTimeout(async () => {
        try {
          const result = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.GET_LOG_CONTENT, selectedServerId);
          if (result.success && result.content) {
            setConsoleOutput(result.content);
          }
        } catch (error) {
          devLog('Error refreshing logs after command:', error);
        }
      }, 500);
      
    } catch (error) {
      devLog('Failed to send command:', error);
      setConsoleOutput(prev => {
        const newOutput = [...prev, `ERROR: ${error instanceof Error ? error.message : 'Failed to send command'}`];
        return newOutput.length > MAX_CONSOLE_LINES 
          ? newOutput.slice(-MAX_CONSOLE_LINES) 
          : newOutput;
      });
    }

    setCommand("");
  }

  return (
    <div className="flex flex-col h-full">
      <div 
        ref={consoleRef}
        className="bg-night rounded-md p-4 min-h-[50px] max-h-[400px] h-[50px] overflow-y-auto font-mono text-sm text-cool-gray flex-1"
      >
        {consoleOutput.length === 0 ? (
          <p className="text-cool-gray italic">
            {isServerRunning ? "Loading console output..." : "Start your server to see console output."}
          </p>
        ) : (
          consoleOutput.map((line, index) => (
            <p key={index} className="whitespace-pre-wrap">
              {line}
            </p>
          ))
        )}
      </div>

      <div className="flex mt-4">
        <Input
          type="text"
          placeholder={isServerRunning ? "Type a command..." : "Start server to send commands"}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendCommand()}
          className="bg-night border-cool-gray/30 text-linen"
          disabled={!isServerRunning}
        />
        <Button 
          onClick={handleSendCommand} 
          className="ml-2 bg-linen text-night hover:bg-linen/90"
          disabled={!isServerRunning}
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send command</span>
        </Button>
      </div>
    </div>
  )
}
