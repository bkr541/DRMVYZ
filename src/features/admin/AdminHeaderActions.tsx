import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** The toolbar in the Admin Console's page header. The page owns the element; each admin tab puts its own actions in it. */
export const AdminHeaderActionsContext = createContext<HTMLElement | null>(null)

/**
 * Actions for the Admin Console's page header, shown only while the tab that renders them is open. They are portaled into the header's own toolbar, so
 * they sit exactly where every other page's actions sit and keep the tab's own state and callbacks. With no header (a standalone mount) they render nowhere.
 */
export function AdminHeaderActions({ children }: { children: ReactNode }) {
  const host = useContext(AdminHeaderActionsContext)
  return host ? createPortal(children, host) : null
}
