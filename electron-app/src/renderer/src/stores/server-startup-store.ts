import { create } from 'zustand'
import { IPC_CHANNELS} from "@shared/types"
import { useServerConfigStore } from './server-config-store'
import { useServerListStore } from "@/lib/servers-store"
import { devLog, devError } from '@shared/utils/logger'

// Add a counter for generating unique IDs
let messageIdCounter = 0;

type StatusMessage = {
  message: string
  status: "pending" | "success" | "error"
  id: string
  data?: { port?: number }
}

type ConsoleMessage = {
  text: string
  isError: boolean
  timestamp: number
}

interface StartupStep {
  message: string;
  handler: typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS] | "prepareServerFiles" | "startMinecraft";
  error: string;
}

interface ServerStartupState {
  statusMessages: StatusMessage[]
  currentStep: number
  isComplete: boolean
  isError: boolean
  error: string | null
  dnsAddress: string | null
  minecraftServerStatusDetails: string | null
  // Console-related state - using combined array to maintain chronological order
  consoleMessages: ConsoleMessage[]
  showConsole: boolean
  consoleAutoScroll: boolean
  hasRun: boolean
  addStatusMessage: (message: Omit<StatusMessage, 'id'>) => void
  updateLastStatusMessage: (status: StatusMessage["status"], customMessage?: string) => void
  setCurrentStep: (step: number) => void
  setIsComplete: (isComplete: boolean) => void
  setIsError: (isError: boolean) => void
  setError: (error: string | null) => void
  setDnsAddress: (address: string | null) => void
  reset: () => void
  setMinecraftServerStatusDetails: (details: string | null) => void
  // Console actions
  addConsoleMessage: (message: string, isError?: boolean) => void
  setShowConsole: (show: boolean) => void
  setConsoleAutoScroll: (autoScroll: boolean) => void
  clearConsoleMessages: () => void
  setHasRun: (hasRun: boolean) => void
  setupListeners: () => void
  cleanupListeners: () => void
  copyToClipboard: (event: React.MouseEvent<HTMLButtonElement>, toast: (props: any) => void) => void
  handleRetry: () => void
  executeStep: (step: number, config: any, onComplete: () => void, onRetry: () => void) => Promise<void>
  startServerSetup: (config, onComplete, onRetry) => Promise<void>
  startupSteps: StartupStep[];
  updateStatus: (status: "pending" | "success" | "error", message?: string, portData?: { port?: number }) => void
  mainProcessError: string | null;
  setMainProcessError: (error: string | null) => void;
  handleStep: (step: StartupStep) => Promise<{ success: boolean; message?: string; port?: number }>;
  onComplete: () => void;
  onRetry: () => void;
  serverId: string;
  isIdLocked: boolean;
  lockServerId: () => void;
  nextAvailablePort: number;
  getNextAvailablePort: () => Promise<number>;
}

type ServerStartupStore = ServerStartupState;

const initialState = {
  statusMessages: [],
  currentStep: 0,
  isComplete: false,
  isError: false,
  error: null,
  dnsAddress: null,
  minecraftServerStatusDetails: null,
  // Console initial state
  consoleMessages: [],
  showConsole: false,
  consoleAutoScroll: true,
  hasRun: false,
  startupSteps: [
    {
      message: "Preparing server files...",
      handler: IPC_CHANNELS.SERVER_PREPARE_FILES,
      error: "Failed to prepare server files"
    },
    {
      message: "Starting Minecraft server...", 
      handler: IPC_CHANNELS.SERVER_START,
      error: "Failed to start server"
    },
    {
      message: "Setting up Playit.gg tunnel...",
      handler: IPC_CHANNELS.TUNNEL_START,
      error: "Failed to setup tunnel"
    }
  ],
  mainProcessError: null,
  onComplete: () => {},
  onRetry: () => {},
  serverId: `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate ID on creation
  isIdLocked: false, // Add this flag
  nextAvailablePort: 25565, // Starting port
}

export const useServerStartupStore = create<ServerStartupStore>((set, get) => ({
  ...initialState,

  addStatusMessage: (message) =>
    set((state) => ({
      // Generate a unique ID and add it to the message
      statusMessages: [...state.statusMessages, { ...message, id: `msg-${messageIdCounter++}` }],
    })),

  updateLastStatusMessage: (status, customMessage) => {
    set((state) => ({
      statusMessages: state.statusMessages.map((msg, idx) => 
        idx === state.statusMessages.length - 1
          ? { ...msg, status, message: customMessage || msg.message }
          : msg
      ),
    }));
  },

  setCurrentStep: (step) => set({ currentStep: step }),
  setIsComplete: (isComplete) => set({ isComplete }),
  setIsError: (isError) => set({ isError }),
  setError: (error) => set({ error }),
  setDnsAddress: (address) => set({ dnsAddress: address }),
  setHasRun: (hasRun) => set({ hasRun }),

  reset: () => {
    const currentState = get();
    const newServerId = currentState.isIdLocked 
      ? currentState.serverId 
      : `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return { 
      ...initialState,
      serverId: newServerId,
      isIdLocked: currentState.isIdLocked
    };
  },

  setMinecraftServerStatusDetails: (details) => set({ minecraftServerStatusDetails: details }),

  // Console actions
  addConsoleMessage: (message, isError = false) =>
    set((state) => {
      const newMessage = {
        text: message,
        isError,
        timestamp: Date.now()
      };
      
      const updatedMessages = [...state.consoleMessages, newMessage];
      
      // Maximum console message limit to prevent memory bloat
      const MAX_CONSOLE_MESSAGES = 1000;
      
      // Trim older messages if we exceed the limit
      const trimmedMessages = updatedMessages.length > MAX_CONSOLE_MESSAGES
        ? updatedMessages.slice(-MAX_CONSOLE_MESSAGES) // Keep the last 1000 messages
        : updatedMessages;
      
      return {
        consoleMessages: trimmedMessages,
      };
    }),

  setShowConsole: (show) => set({ showConsole: show }),

  setConsoleAutoScroll: (autoScroll) => set({ consoleAutoScroll: autoScroll }),

  clearConsoleMessages: () => set({ consoleMessages: [] }),

  setupListeners: () => {
    const { addConsoleMessage, setMinecraftServerStatusDetails } = get();

    const handleServerOutput = (data: string) => {
      addConsoleMessage(data, false);
    };

    const handleServerErrorOutput = (data: string) => {
      addConsoleMessage(data, true);
    };

    const handleServerStatusUpdate = (data: { 
      status?: string; 
      type?: string;
      address?: string;
    }) => {
      setMinecraftServerStatusDetails(data.status || null);
    };

    // Remove existing listeners first to avoid duplicates
    get().cleanupListeners();

    // Add new listeners
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT, handleServerOutput);
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.SERVER_CONSOLE_ERROR, handleServerErrorOutput);
    window.electronAPI.ipcRenderer.on(IPC_CHANNELS.SERVER_STATUS_UPDATE, handleServerStatusUpdate);

    return () => {
      get().cleanupListeners();
    };
  },

  cleanupListeners: () => {
    window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.SERVER_CONSOLE_OUTPUT);
    window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.SERVER_CONSOLE_ERROR);
    window.electronAPI.ipcRenderer.removeAllListeners(IPC_CHANNELS.SERVER_STATUS_UPDATE);
  },

  copyToClipboard: (event, toast) => {
    event.preventDefault();
    const { dnsAddress } = get();
    if (dnsAddress) {
      window.electronAPI.clipboard.writeText(dnsAddress);
      toast({
        title: "Link Copied!",
        description: "Server address has been copied to your clipboard",
        variant: "default",
        className: "bg-space-cadet text-linen border-cool-gray/30",
      });
    }
  },

  handleRetry: () => {
    const { reset, clearConsoleMessages, setupListeners, executeStep } = get();
    const { config } = useServerConfigStore.getState();
    
    // Full reset with new serverId
    const newState = reset();
    clearConsoleMessages();
    setupListeners();
    
    // Kill any existing server process
    window.electronAPI.ipcRenderer.invoke(IPC_CHANNELS.SERVER_STOP)
      .catch(() => {}); // Ignore errors if no server running
    
    // Restart the process with new serverId
    executeStep(0, config, get().onComplete, get().onRetry);
  },

  executeStep: async (stepIndex, config, onComplete, onRetry) => {
    set({ onComplete, onRetry });
    if (get().isError || get().isComplete) return;

    const step = get().startupSteps[stepIndex];
    set({ currentStep: stepIndex, mainProcessError: null });
    get().updateStatus("pending");

    // Setup listeners on the first step
    if (stepIndex === 0) {
      get().setupListeners();
    }

    try {
      const result = await get().handleStep(step);
      devLog(`[Port Tracking] Step ${stepIndex} completed with port data:`, {
        port: result.port,
        serverId: get().serverId
      });
      
      if (!result.success) {
        const errorMessage = `Error: ${result.message || "Unknown error"}`;
        get().setMainProcessError(errorMessage);
        get().updateStatus("error");
        get().cleanupListeners(); // Cleanup on error
        return;
      }

      get().updateStatus("success");
      
      // Store the port from this step's result
      const portData = result.port ? { port: result.port } : undefined;
      get().updateStatus("success", undefined, portData);

      if (stepIndex < get().startupSteps.length - 1) {
        await get().executeStep(stepIndex + 1, config, onComplete, onRetry);
      } else {
        // Cleanup listeners on successful completion (last step)
        get().cleanupListeners();
      }
    } catch (error) {
      get().setMainProcessError(error instanceof Error ? error.message : "Unknown error");
      get().updateStatus("error");
      get().cleanupListeners();
    }
  },

  startServerSetup: async (config, onComplete, onRetry) => {
    const { reset, lockServerId, executeStep } = get();
    
    // Reset but preserve ID if locked
    reset();
    lockServerId(); // Prevent ID changes during setup
    
    console.log('Starting server setup with ID:', get().serverId);
    return executeStep(0, config, onComplete, onRetry);
  },

  updateStatus: (status: "pending" | "success" | "error", message?: string, portData?: { port?: number }) => {
    const stepIndex = get().currentStep;
    const step = get().startupSteps[stepIndex];
    
    const displayMessage = status === "error" ? step.error : step.message;

    set((state) => {
      const newStatusMessages = [...state.statusMessages];
      const msg = {
        id: `msg-${messageIdCounter++}`,
        status,
        message: message || displayMessage,
        ...(portData && { data: portData }) // Properly include portData in the message
      };

      if (newStatusMessages.length > stepIndex) {
        newStatusMessages[stepIndex] = msg;
      } else {
        newStatusMessages.push(msg);
      }

      return {
        statusMessages: newStatusMessages,
        isError: status === "error",
        isComplete: status === "success" && stepIndex === state.startupSteps.length - 1
      };
    });
  },

  setMainProcessError: (error: string | null) => set({ mainProcessError: error }),

  getNextAvailablePort: async () => {
    let port = get().nextAvailablePort;
    while (await window.electronAPI.ipcRenderer.invoke('CHECK_PORT', port)) {
      port++;
    }
    set({ nextAvailablePort: port + 1 }); // Reserve next port
    return port;
  },

  handleStep: async (step) => {
    const { config } = useServerConfigStore.getState();
    const { serverId } = get();
    
    switch (step.handler) {
      case IPC_CHANNELS.SERVER_PREPARE_FILES:
        const port = await get().getNextAvailablePort();
        const prepResult = await window.electronAPI.ipcRenderer.invoke(
          IPC_CHANNELS.SERVER_PREPARE_FILES, 
          { 
            serverId,
            serverDirectory: config.serverDirectory,
            serverType: config.serverType,
            ramGB: config.ram,
            javaPath: config.javaPath,
            port
          }
        );
        return { 
          ...prepResult, 
          port: prepResult.port || port
        };

      case IPC_CHANNELS.SERVER_START:
        const startResult = await window.electronAPI.ipcRenderer.invoke(
          IPC_CHANNELS.SERVER_START,
          {
            serverId: get().serverId,
            serverDirectory: config.serverDirectory,
            serverType: config.serverType,
            ram: config.ram,
            javaPath: config.javaPath
          }
        );
        return { 
          ...startResult,
          port: startResult.port
        };

      case IPC_CHANNELS.TUNNEL_START:
        // Get port from the SERVER_START step's result
        const serverPort = get().statusMessages[get().currentStep - 1]?.data?.port;
        if (!serverPort) {
          throw new Error('No server port available for tunnel creation');
        }
        
        const tunnelResult = await window.electronAPI.ipcRenderer.invoke(
          IPC_CHANNELS.TUNNEL_START,
          { serverPort }
        );

        if (tunnelResult.success) {
          const domain = tunnelResult.data.assignedDomain || tunnelResult.data.staticIp4;
          const actualPort = tunnelResult.data.assignedPort || serverPort;
          
          // Update store with domain and complete the process
          get().setDnsAddress(domain);
          get().setIsComplete(true);

          // Update server list store
          const serverData = {
            id: get().serverId,
            name: 'Vanilla Server',
            status: 'online',
            version: '1.21.5',
            onlinePlayers: 0,
            maxPlayers: 20,
            lastActive: Date.now(),
            serverPath: config.serverDirectory,
            playitDomain: domain,
            gameMode: 'survival',
            icon: 'default.png',
            serverType: config.serverType,
            ramGB: config.ram,
            javaPath: config.javaPath,
            port: actualPort,
            playitTunnelId: tunnelResult.data.tunnelId,
          };

          // Add server to the list and select it
          const updatedServers = await window.electronAPI.ipcRenderer.invoke(
            IPC_CHANNELS.ADD_SERVER,
            serverData
          );

          useServerListStore.setState({
            servers: updatedServers,
            selectedServerId: get().serverId
          });

          return {
            ...tunnelResult,
            port: actualPort
          };
        }
        return tunnelResult;

      default:
        return { success: false, message: 'Unknown step' };
    }
  },

  lockServerId: () => set({ isIdLocked: true }),
})) 