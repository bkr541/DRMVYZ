import { createContext } from 'react'

export interface HeaderSlot {
  target: HTMLDivElement | null
  occupy: () => () => void
}

// The frame and lazy workspaces share this context even when the frame module reloads in development.
export const HeaderSlotContext = createContext<HeaderSlot | null>(null)
