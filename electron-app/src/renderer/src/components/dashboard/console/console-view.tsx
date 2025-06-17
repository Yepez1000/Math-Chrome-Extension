"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import { devLog } from '@shared/utils/logger'
import { useServerListStore } from "@/lib/servers-store"
import { IPC_CHANNELS } from "@shared/types"

export function ConsoleView() {
  const [command, setCommand] = useState("")
  const [consoleOutput, setConsoleOutput] = useState<string[]>([])
  const [isServerRunning, setIsServerRunning] = useState(false)
  const { selectedServerId } = useServerListStore()
  const consoleRef = useRef<HTMLDivElement>(null)

  // Debug selectedServerId changes
  useEffect(() => {
    console.log('selectedServerId changed:', selectedServerId);
  }, [selectedServerId]);

  // Check server status on mount and when selectedServerId changes
  useEffect(() => {
    console.log('Status check effect triggered with selectedServerId:', selectedServerId);
    
    const checkServerStatus = async () => {
      if (!selectedServerId) {
        console.log('No selectedServerId, skipping status check');
        return;
      }
      
      try {
        console.log('Fetching server list for status check...');
        const servers = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.GET_SERVER_LIST);
        const server = servers.find((s: any) => s.id === selectedServerId);
        console.log('Found server:', server);
        
        if (server?.status === 'online') {
          console.log('Server is online, enabling console');
          setIsServerRunning(true);
        } else {
          console.log('Server is not online, status:', server?.status);
        }
      } catch (error) {
        console.error('Failed to check server status:', error);
      }
    };

    checkServerStatus();
  }, [selectedServerId]);

  useEffect(() => {
    console.log('Server setup effect triggered with selectedServerId:', selectedServerId);
    
    if (!selectedServerId) {
      console.log('No selectedServerId, skipping server setup');
      return;
    }

    // Initialize console output if server is already running
    const initializeConsole = async () => {
      try {
        const servers = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.GET_SERVER_LIST);
        const server = servers.find((s: any) => s.id === selectedServerId);
        
        if (server?.status === 'online') {
          console.log('Server is already online, initializing console');
          setIsServerRunning(true);
          // Add a welcome message to the console
          setConsoleOutput(prev => [...prev, 'Server is running. Type a command to begin.']);
        }
      } catch (error) {
        console.error('Failed to initialize console:', error);
      }
    };

    initializeConsole();

    const handleConsoleOutput = (_event: any, data: string) => {
      console.log('Console output received - event:', _event);
      console.log('Console output received - data:', data);
      
      // Get the output data from either the event or data parameter
      const outputData = typeof _event === 'string' ? _event : data;
      
      // Only skip if both event and data are null/undefined
      if (!outputData) {
        console.log('Received null or undefined data, skipping');
        return;
      }
      
      // Split the output into lines and add each line separately
      const lines = outputData.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        setConsoleOutput(prev => [...prev, ...lines]);
      }
      
      // Check for server ready message
      if (outputData.includes('Done') || outputData.includes('For help, type "help"')) {
        console.log('Server ready message detected, setting isServerRunning to true');
        setIsServerRunning(true);
      }
    }

    const handleConsoleError = (_event: any, data: string) => {
      console.log('Console error received:', data);
      // Ensure data is a string and not undefined
      if (!data) {
        console.log('Received undefined or null error data, skipping');
        return;
      }
      // Split error output into lines and add each line separately
      const lines = data.split('\n').filter(line => line.trim());
      if (lines.length > 0) {
        setConsoleOutput(prev => [...prev, ...lines.map(line => `ERROR: ${line}`)]);
      }
    }

    const handleServerStatus = async (_event: any, _data: any) => {
      console.log('Server status update received - event:', _event);
      console.log('Server status update received - data:', _data);
      
      // If we receive a stop status, immediately disable the console
      if (_event?.status === "Server stopped") {
        console.log('Server stopped status detected, disabling console');
        setIsServerRunning(false);
        return;
      }
      
      // Always check current server status first
      try {
        // Refresh the server list to get the latest status
        await useServerListStore.getState().refresh();
        const servers = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.GET_SERVER_LIST);
        const server = servers.find((s: any) => s.id === selectedServerId);
        console.log('Current server status:', server?.status);
        
        // If we have a server and it's online, set running to true
        if (server?.status === 'online') {
          console.log('Server is online, enabling console');
          setIsServerRunning(true);
          return;
        }
        
        // If we have an event with status, check it
        if (_event) {
          const statusValue = typeof _event === 'string' ? _event : _event.status;
          console.log('Event status value:', statusValue);
          
          if (statusValue === "Server running") {
            console.log('Server running status detected, enabling console');
            setIsServerRunning(true);
            return;
          }
        }
        
        // If we get here, server is not running
        console.log('Server is not running, disabling console');
        setIsServerRunning(false);
      } catch (error) {
        console.error('Failed to check server status:', error);
        devLog('Failed to check server status:', error);
        setIsServerRunning(false);
      }
    }

    // Subscribe to console output
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT, handleConsoleOutput);
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.SERVER_CONSOLE_ERROR, handleConsoleError);
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.SERVER_STATUS_UPDATE, handleServerStatus);

    // Cleanup listeners
    return () => {
      console.log('Cleaning up server listeners');
      window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT);
      window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.SERVER_CONSOLE_ERROR);
      window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.SERVER_STATUS_UPDATE);
    }
  }, [selectedServerId]);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [consoleOutput])

  const handleSendCommand = async () => {
    if (!command.trim() || !isServerRunning || !selectedServerId) return;

    // Echo the command to the console
    setConsoleOutput(prev => [...prev, `> ${command.trim()}`]);

    try {
      // First check if the server process exists
      const servers = await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.GET_SERVER_LIST);
      const server = servers.find((s: any) => s.id === selectedServerId);
      
      if (!server || server.status !== 'online') {
        devLog('Cannot send command: Server is not running');
        setConsoleOutput(prev => [...prev, 'ERROR: Server is not running']);
        return;
      }

      await window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SERVER_SEND_COMMAND, {
        serverId: selectedServerId,
        command: command.trim()
      });
    } catch (error) {
      devLog('Failed to send command:', error);
      setConsoleOutput(prev => [...prev, `ERROR: ${error instanceof Error ? error.message : 'Failed to send command'}`]);
      // If we get a "Server process not found" error, update the server status
      if (error instanceof Error && error.message.includes('Server process not found')) {
        setIsServerRunning(false);
      }
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
            {isServerRunning ? "Server is running. Type a command to begin." : "Start your server to begin."}
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
          placeholder={isServerRunning ? "Type a command..." : ""}
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
