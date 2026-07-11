import { useEffect, useState } from 'react'
import type { ReactLeftTab } from './reactWorkspaceComposition'

export type ReactLowerSurface = 'trackMap' | 'performancePads'

export interface ReactWorkspacePreferences {
  leftCollapsed: boolean
  rightCollapsed: boolean
  lowerWorkspaceCollapsed: boolean
  lowerSurface: ReactLowerSurface
  leftTab: ReactLeftTab
}

const STORAGE_KEY = 'drmvyz:react:workspace-preferences:v1'
const DEFAULTS: ReactWorkspacePreferences = {
  leftCollapsed: false,
  rightCollapsed: false,
  lowerWorkspaceCollapsed: true,
  lowerSurface: 'trackMap',
  leftTab: 'workspace',
}

export function readReactWorkspacePreferences(): ReactWorkspacePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<ReactWorkspacePreferences>
    return {
      leftCollapsed: typeof parsed.leftCollapsed === 'boolean' ? parsed.leftCollapsed : DEFAULTS.leftCollapsed,
      rightCollapsed: typeof parsed.rightCollapsed === 'boolean' ? parsed.rightCollapsed : DEFAULTS.rightCollapsed,
      lowerWorkspaceCollapsed: typeof parsed.lowerWorkspaceCollapsed === 'boolean'
        ? parsed.lowerWorkspaceCollapsed
        : DEFAULTS.lowerWorkspaceCollapsed,
      lowerSurface: parsed.lowerSurface === 'performancePads' ? 'performancePads' : 'trackMap',
      leftTab: parsed.leftTab === 'media' || parsed.leftTab === 'layers' || parsed.leftTab === 'fonts'
        ? parsed.leftTab
        : 'workspace',
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeReactWorkspacePreferences(preferences: ReactWorkspacePreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch (error) {
    console.warn('[ReactView] Workspace preferences could not be saved', error)
  }
}

export function useReactWorkspacePreferences() {
  const initial = readReactWorkspacePreferences()
  const [leftCollapsed, setLeftCollapsed] = useState(initial.leftCollapsed)
  const [rightCollapsed, setRightCollapsed] = useState(initial.rightCollapsed)
  const [lowerWorkspaceCollapsed, setLowerWorkspaceCollapsed] = useState(initial.lowerWorkspaceCollapsed)
  const [lowerSurface, setLowerSurface] = useState<ReactLowerSurface>(initial.lowerSurface)
  const [leftTab, setLeftTab] = useState<ReactLeftTab>(initial.leftTab)

  useEffect(() => {
    writeReactWorkspacePreferences({
      leftCollapsed,
      rightCollapsed,
      lowerWorkspaceCollapsed,
      lowerSurface,
      leftTab,
    })
  }, [leftCollapsed, leftTab, lowerSurface, lowerWorkspaceCollapsed, rightCollapsed])

  return {
    leftCollapsed,
    setLeftCollapsed,
    rightCollapsed,
    setRightCollapsed,
    lowerWorkspaceCollapsed,
    setLowerWorkspaceCollapsed,
    lowerSurface,
    setLowerSurface,
    leftTab,
    setLeftTab,
  }
}
