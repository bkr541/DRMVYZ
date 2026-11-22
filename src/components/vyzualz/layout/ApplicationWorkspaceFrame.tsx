import { lazy, Suspense, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AppView } from '../appView'
import { APP_VIEW_LABELS } from '../appView'
import { AppIcon } from '../../shared/icons/AppIcon'
import type { AppPageId } from '../../../stores/pageActivityStore'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
import { HeaderControlGroup } from './HeaderControlGroup'
import { MobileAppPreviewLauncher } from './MobileAppPreviewLauncher'
import { isMobileAppPreviewFrame } from './mobileAppPreview'
import { LayoutLabModal } from '../react/LayoutLabModal'
import { VyzualzSidebar } from '../VyzualzSidebar'
import { FloatingWorkspaceFrame, WorkspaceRegion, WorkspaceSurface } from './FloatingWorkspace'
import { HeaderSlotContext } from './applicationHeaderSlot'

// Development only: the app-level review notes button in the middle of the header (see docs/review-notes.md). In a production build `import.meta.env.DEV` is false, so this and the module it imports are removed.
const AppReviewNotes = import.meta.env.DEV ? lazy(() => import('../../../dev/reviewNotes/AppReviewNotes').then(module => ({ default: module.AppReviewNotes }))) : null

/** The page a view reports its status readouts under. */
const HEADER_PAGE_IDS: Readonly<Record<AppView, AppPageId>> = {
  react: 'react',
  performanceManager: 'performance-manager',
  presetManager: 'preset-manager',
  showManager: 'show-manager',
  lyrics: 'lyric-manager',
  media: 'media-manager',
  admin: 'admin',
}

/**
 * Render a feature-owned control group into the global header when its workspace
 * opts in. The portal preserves the feature's own React context and callbacks.
 * Mount it inside the feature's existing provider/Suspense boundary, not above it.
 */
export function ApplicationHeaderControls({ children, fallbackWhenUnavailable = false }: { children: ReactNode; fallbackWhenUnavailable?: boolean }) {
  const slot = useContext(HeaderSlotContext)
  const target = slot?.target
  const occupy = slot?.occupy

  useLayoutEffect(() => {
    if (target) return occupy?.()
  }, [target, occupy])

  if (slot) return target ? createPortal(children, target) : null
  return fallbackWhenUnavailable ? children : null
}

interface ApplicationWorkspaceFrameProps {
  appView: AppView
  onAppViewChange: (view: AppView) => void
  children: ReactNode
}

/** Outer chrome only: individual features still compose their own internal UI. */
export function ApplicationWorkspaceFrame({
  appView,
  onAppViewChange,
  children,
}: ApplicationWorkspaceFrameProps) {
  const [layoutLabOpen, setLayoutLabOpen] = useState(false)
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null)
  const [occupants, setOccupants] = useState(0)
  const occupy = useCallback(() => {
    setOccupants(count => count + 1)
    return () => setOccupants(count => Math.max(0, count - 1))
  }, [])
  const headerSlot = useMemo(() => ({ target: headerTarget, occupy }), [headerTarget, occupy])
  const headerEmpty = occupants === 0

  return (
    <HeaderSlotContext.Provider value={headerSlot}>
      <FloatingWorkspaceFrame className="az-root fw-app-frame" data-app-workspace={appView}>
        <div className="az-shell fw-app-shell">
          <WorkspaceRegion slot="header" className="fw-app-header">
            <WorkspaceSurface className="fw-app-header-surface">
              <div className="fw-app-header-inner">
                {/* Every page always has its own header. While a page's own controls are not in the slot (its code is still loading, or it has none), this
                    stands in with the same brand, page name and status readouts, laid out the same way, so the header never turns into a bare label. */}
                <div className="fw-app-header-fallback" hidden={!headerEmpty} data-app-header-fallback={appView}>
                  {headerEmpty && <div className="vz-header">
                    <HeaderControlGroup label={`${APP_VIEW_LABELS[appView]} controls`}>{null}</HeaderControlGroup>
                    <VyzualzHeaderActions page={HEADER_PAGE_IDS[appView]} />
                  </div>}
                </div>
                <div ref={setHeaderTarget} className="fw-app-header-controls" data-app-header-slot="controls" />
                {AppReviewNotes && <div className="fw-app-header-center"><Suspense fallback={null}><AppReviewNotes page={{ id: appView, label: APP_VIEW_LABELS[appView] }} /></Suspense></div>}
              </div>
            </WorkspaceSurface>
          </WorkspaceRegion>
          <div className="fw-app-body">
            <WorkspaceRegion slot="navigation" className="fw-app-navigation">
              <VyzualzSidebar
                variant="floating"
                appView={appView}
                onAppViewChange={onAppViewChange}
                utilityControls={<>
                  {!isMobileAppPreviewFrame() && <MobileAppPreviewLauncher />}
                  <button type="button" className="fw-layout-lab-launcher az-sidebar-utility" aria-label="Layout Lab"
                    title="Layout Lab" aria-haspopup="dialog" onClick={() => setLayoutLabOpen(true)}>
                    <AppIcon kind="sliders" size={20} />
                  </button>
                </>}
              />
            </WorkspaceRegion>
            <WorkspaceRegion slot="stage" className="fw-app-content">
              {children}
            </WorkspaceRegion>
          </div>
        </div>
        {layoutLabOpen && <LayoutLabModal onClose={() => setLayoutLabOpen(false)} />}
      </FloatingWorkspaceFrame>
    </HeaderSlotContext.Provider>
  )
}
