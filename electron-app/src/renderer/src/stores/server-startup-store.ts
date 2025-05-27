import { create } from 'zustand'

type StatusMessage = {
  message: string
  status: "pending" | "success" | "error" | "Claim Required"
}

interface ServerStartupState {
  statusMessages: StatusMessage[]
  currentStep: number
  isComplete: boolean
  isError: boolean
  dnsAddress: string | null
  addStatusMessage: (message: StatusMessage) => void
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
      statusMessages: [...state.statusMessages, message],
    })),

  updateLastStatusMessage: (status) =>
    set((state) => ({
      statusMessages: state.statusMessages.map((msg, idx) =>
        idx === state.statusMessages.length - 1 ? { ...msg, status } : msg
      ),
    })),

  setCurrentStep: (step) => set({ currentStep: step }),
  setIsComplete: (isComplete) => set({ isComplete }),
  setIsError: (isError) => set({ isError }),
  setDnsAddress: (address) => set({ dnsAddress: address }),

  reset: () => set(initialState),
})) 