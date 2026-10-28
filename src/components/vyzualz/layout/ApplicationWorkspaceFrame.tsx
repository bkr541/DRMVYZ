import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AppView } from '../appView'
import { APP_VIEW_LABELS } from '../appView'
import { VyzualzSidebar } from '../VyzualzSidebar'
import { FloatingWorkspaceFrame, WorkspaceRegion, WorkspaceSurface } from './FloatingWorkspace'

interface HeaderSlot {
  target: HTMLDivElement | null
  setOccupied: (occupied: boolean) => void
}

const HeaderSlotContext = createContext<HeaderSlot | null>(null)

/**
 * Render a feature-owned control group into the global header when its workspace
 * opts in. The portal preserves the feature's own React context and callbacks.
 * Mount it inside the feature's existing provider/Suspense boundary, not above it.
 */
export function ApplicationHeaderControls({ children, fallbackWhenUnavailable = false }: { children: ReactNode; fallbackWhenUnavailable?: boolean }) {
  const slot = useContext(HeaderSlotContext)
  const target = slot?.target
  const setOccupied = slot?.setOccupied

  useLayoutEffect(() => {
    if (!target || !setOccupied) return
    setOccupied(true)
    return () => setOccupied(false)
  }, [target, setOccupied])

  return target ? createPortal(children, target) : fallbackWhenUnavailable ? children : null
}

interface ApplicationWorkspaceFrameProps {
  appView: AppView
  onAppViewChange: (view: AppView) => void
  sidebarCollapsed: boolean
  onSidebarCollapsedChange: (collapsed: boolean) => void
  children: ReactNode
}

/** Outer chrome only: individual features still compose their own internal UI. */
export function ApplicationWorkspaceFrame({
  appView,
  onAppViewChange,
  sidebarCollapsed,
  onSidebarCollapsedChange,
  children,
}: ApplicationWorkspaceFrameProps) {
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null)
  const [headerOccupied, setHeaderOccupied] = useState(false)
  const setTarget = useCallback((target: HTMLDivElement | null) => setHeaderTarget(target), [])
  const headerSlot = useMemo<HeaderSlot>(
    () => ({ target: headerTarget, setOccupied: setHeaderOccupied }),
    [headerTarget],
  )

  return (
    <HeaderSlotContext.Provider value={headerSlot}>
      <FloatingWorkspaceFrame className="az-root fw-app-frame" data-app-workspace={appView}>
        <div className="az-shell fw-app-shell">
          <WorkspaceRegion slot="header" className="fw-app-header">
            <WorkspaceSurface className="fw-app-header-surface">
              <div className="fw-app-header-inner">
                {appView !== 'presetManager' && <span className="fw-app-header-fallback" hidden={headerOccupied}>
                  {APP_VIEW_LABELS[appView]}
                </span>}
                <div ref={setTarget} className="fw-app-header-controls" data-app-header-slot="controls" />
              </div>
            </WorkspaceSurface>
          </WorkspaceRegion>
          <div className="fw-app-body">
            <WorkspaceRegion slot="navigation" className="fw-app-navigation">
              <VyzualzSidebar
                variant="floating"
                compact
                collapsed={sidebarCollapsed}
                onCollapsedChange={onSidebarCollapsedChange}
                appView={appView}
                onAppViewChange={onAppViewChange}
              />
            </WorkspaceRegion>
            <WorkspaceRegion slot="stage" className="fw-app-content">
              {children}
            </WorkspaceRegion>
          </div>
        </div>
      </FloatingWorkspaceFrame>
    </HeaderSlotContext.Provider>
  )
}
