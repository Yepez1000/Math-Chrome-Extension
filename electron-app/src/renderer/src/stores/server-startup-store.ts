import { create } from 'zustand'

// Add a counter for generating unique IDs
let messageIdCounter = 0;

type StatusMessage = {
  message: string
  status: "pending" | "success" | "error"
  id: string // Add unique ID
}

interface ServerStartupState {
  statusMessages: StatusMessage[]
  currentStep: number
  isComplete: boolean
  isError: boolean
  dnsAddress: string | null
  addStatusMessage: (message: Omit<StatusMessage, 'id'>) => void
  updateLastStatusMessage: (status: StatusMessage["status"]) => void
  setCurrentStep: (step: number) => void
  setIsComplete: (isComplete: boolean) => void
  setIsError: (isError: boolean) => void
  setDnsAddress: (address: string | null) => void
  reset: () => void
}

const initialState = {
  statusMessages: [],
  currentStep: 0,
  isComplete: false,
  isError: false,
  dnsAddress: null,
}

export const useServerStartupStore = create<ServerStartupState>((set) => ({
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
  setDnsAddress: (address) => set({ dnsAddress: address }),

  reset: () => set(initialState),
})) 