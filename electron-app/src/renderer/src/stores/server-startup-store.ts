import { create } from 'zustand'

// Add a counter for generating unique IDs
let messageIdCounter = 0;

type StatusMessage = {
  message: string
  status: "pending" | "success" | "error"
  id: string // Add unique ID
}

type ConsoleMessage = {
  text: string
  isError: boolean
  timestamp: number
}

interface ServerStartupState {
  statusMessages: StatusMessage[]
  currentStep: number
  isComplete: boolean
  isError: boolean
  error: string | null
  dnsAddress: string | null
  playitTunnelStatusDetails: string | null
  minecraftServerStatusDetails: string | null
  // Console-related state - using combined array to maintain chronological order
  consoleMessages: ConsoleMessage[]
  showConsole: boolean
  consoleAutoScroll: boolean
  addStatusMessage: (message: Omit<StatusMessage, 'id'>) => void
  updateLastStatusMessage: (status: StatusMessage["status"]) => void
  setCurrentStep: (step: number) => void
  setIsComplete: (isComplete: boolean) => void
  setIsError: (isError: boolean) => void
  setError: (error: string | null) => void
  setDnsAddress: (address: string | null) => void
  reset: () => void
  setPlayitTunnelStatusDetails: (details: string | null) => void
  setMinecraftServerStatusDetails: (details: string | null) => void
  // Console actions
  addConsoleMessage: (message: string, isError?: boolean) => void
  setShowConsole: (show: boolean) => void
  setConsoleAutoScroll: (autoScroll: boolean) => void
  clearConsoleMessages: () => void
}

type ServerStartupStore = ServerStartupState;

const initialState = {
  statusMessages: [],
  currentStep: 0,
  isComplete: false,
  isError: false,
  error: null,
  dnsAddress: null,
  playitTunnelStatusDetails: null,
  minecraftServerStatusDetails: null,
  // Console initial state
  consoleMessages: [],
  showConsole: false,
  consoleAutoScroll: true,
}

export const useServerStartupStore = create<ServerStartupStore>((set, get) => ({
  ...initialState,

  addStatusMessage: (message) =>
    set((state) => ({
      // Generate a unique ID and add it to the message
      statusMessages: [...state.statusMessages, { ...message, id: `msg-${messageIdCounter++}` }],
    })),

  updateLastStatusMessage: (status) =>
    set((state) => ({
      statusMessages: state.statusMessages.map((msg, idx) => {
        if (idx === state.statusMessages.length - 1) {
          // Create a new object only for the last message
          return { ...msg, status };
        } else {
          // Return the original object for all other messages
          return msg;
        }
      }),
    })),

  setCurrentStep: (step) => set({ currentStep: step }),
  setIsComplete: (isComplete) => set({ isComplete }),
  setIsError: (isError) => set({ isError }),
  setError: (error) => set({ error }),
  setDnsAddress: (address) => set({ dnsAddress: address }),

  reset: () => set(initialState),

  setPlayitTunnelStatusDetails: (details) => set({ playitTunnelStatusDetails: details }),

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

  // Note: The executeStartupSequence action is defined and used in the component for now.
  // IPC listeners will be set up in the component and call store actions to update state.
})) 