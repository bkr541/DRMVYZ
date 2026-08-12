import { lazy, Suspense, useCallback, useLayoutEffect, useState } from 'react'
import { useLyricsStore } from '../../stores/lyricsStore'
import { UnsavedLyricChangesDialog } from '../../features/lyrics/components/UnsavedLyricChangesDialog'
import { VyzualzSidebar } from './VyzualzSidebar'
import {
  DEFAULT_PERFORMANCE_VIEW,
  isPerformanceAppView,
  resolveAppViewNavigation,
} from './appView'
import type { AppView, PerformanceAppView } from './appView'
import type { LyricManagerNavigationIntent } from '../../features/lyrics/lyricNavigation'
import { setAudioSourcePolicyAppView } from '../../audio/audioSourcePolicy'

const VisualizerWorkspace = lazy(() =>
  import('./VisualizerWorkspace').then(module => ({ default: module.VisualizerWorkspace })),
)
const ReactView = lazy(() =>
  import('./react/ReactView').then(module => ({ default: module.ReactView })),
)
const ShowManagerView = lazy(() =>
  import('./showManager/ShowManagerView').then(module => ({ default: module.ShowManagerView })),
)
const MediaManagerView = lazy(() =>
  import('../../features/media/MediaManagerView').then(module => ({ default: module.MediaManagerView })),
)
const LyricManagerView = lazy(() =>
  import('../../features/lyrics/LyricManagerView').then(module => ({ default: module.LyricManagerView })),
)

function WorkspaceLoading({ label, standalone = false }: { label: string; standalone?: boolean }) {
  const status = (
    <div className="rv-lazy-fallback" role="status" aria-live="polite">
      Loading {label}…
    </div>
  )
  if (!standalone) return status
  return (
    <div className="az-root">
      <div className="az-shell">
        <main className="vz-main">{status}</main>
      </div>
    </div>
  )
}

function ManagedWorkspaceShell({
  appView,
  onAppViewChange,
  children,
}: {
  appView: AppView
  onAppViewChange: (view: AppView) => void
  children: React.ReactNode
}) {
  return (
    <div className="az-root">
      <div className="az-shell">
        <VyzualzSidebar compact appView={appView} onAppViewChange={onAppViewChange} />
        {children}
      </div>
    </div>
  )
}

interface Props {
  activeView: 'analyzer' | 'reference' | 'vyzualz'
  onNavigate: (view: 'analyzer' | 'reference' | 'vyzualz') => void
  initialAppView?: AppView
}

/**
 * Application-view router.
 *
 * Each major workspace is conditionally mounted so Visualizer listeners,
 * recorders, cloud sync, media automation, and animation loops exist only while
 * the Visualizer workspace is active.
 */
export function VyzualzView({ initialAppView = DEFAULT_PERFORMANCE_VIEW }: Props) {
  const [appView, setAppView] = useState<AppView>(initialAppView)
  const [originatingPerformanceView, setOriginatingPerformanceView] =
    useState<PerformanceAppView>(() => isPerformanceAppView(initialAppView)
      ? initialAppView
      : DEFAULT_PERFORMANCE_VIEW)
  const [pendingAppView, setPendingAppView] = useState<AppView | null>(null)
  const [lyricNavigationIntent, setLyricNavigationIntent] = useState<LyricManagerNavigationIntent | null>(null)
  // True only immediately after a 'lyrics' → 'visualizer' transition. VyzualzView
  // never unmounts, so it recomputes this fresh on every transition rather than
  // relying on VisualizerWorkspace (which fully unmounts/remounts on navigation)
  // to detect a change relative to its own mount-reset history.
  const [lyricPreviewPending, setLyricPreviewPending] = useState(false)
  const lyricEditorDirty = useLyricsStore(state => state.editorDirty)
  const lyricEditorSaving = useLyricsStore(state => state.isSaving)

  useLayoutEffect(() => {
    setAudioSourcePolicyAppView(appView)
    return () => setAudioSourcePolicyAppView(null)
  }, [appView])

  const commitAppViewChange = useCallback((next: AppView) => {
    if (isPerformanceAppView(appView) && !isPerformanceAppView(next)) {
      setOriginatingPerformanceView(appView)
    }
    setLyricPreviewPending(appView === 'lyrics' && next === 'visualizer')
    setAppView(next)
  }, [appView])

  const requestAppViewChange = useCallback((next: AppView) => {
    const decision = resolveAppViewNavigation(appView, next, lyricEditorDirty)
    setPendingAppView(decision.pendingView)
    if (decision.nextView !== appView) commitAppViewChange(decision.nextView)
  }, [appView, commitAppViewChange, lyricEditorDirty])

  const finishPendingNavigation = useCallback((next: AppView | null) => {
    setPendingAppView(null)
    if (next) commitAppViewChange(next)
  }, [commitAppViewChange])

  const openLyricManager = useCallback((intent: LyricManagerNavigationIntent) => {
    setLyricNavigationIntent(intent)
    requestAppViewChange('lyrics')
  }, [requestAppViewChange])

  if (appView === 'visualizer') {
    return (
      <>
        <Suspense fallback={<WorkspaceLoading label="Visualizer" standalone />}>
          <VisualizerWorkspace
            onAppViewChange={requestAppViewChange}
            showLyricPreviewToastOnMount={lyricPreviewPending}
            onOpenLyricManager={openLyricManager}
          />
        </Suspense>
      </>
    )
  }

  if (appView === 'react') {
    return (
      <ManagedWorkspaceShell appView={appView} onAppViewChange={requestAppViewChange}>
        <main className="vz-main" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Suspense fallback={<WorkspaceLoading label="React View" />}>
              <ReactView
                onOpenMediaManager={() => requestAppViewChange('media')}
                onOpenLyricManager={openLyricManager}
              />
            </Suspense>
          </div>
        </main>
      </ManagedWorkspaceShell>
    )
  }

  if (appView === 'showManager') {
    return (
      <ManagedWorkspaceShell appView={appView} onAppViewChange={requestAppViewChange}>
        <main className="vz-main" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Suspense fallback={<WorkspaceLoading label="Show Manager" />}>
              <ShowManagerView />
            </Suspense>
          </div>
        </main>
      </ManagedWorkspaceShell>
    )
  }

  if (appView === 'media') {
    return (
      <ManagedWorkspaceShell appView={appView} onAppViewChange={requestAppViewChange}>
        <Suspense fallback={<WorkspaceLoading label="Media Manager" />}>
          <MediaManagerView
            onOpenLyricManager={openLyricManager}
          />
        </Suspense>
      </ManagedWorkspaceShell>
    )
  }

  return (
    <>
      <ManagedWorkspaceShell appView={appView} onAppViewChange={requestAppViewChange}>
        <Suspense fallback={<WorkspaceLoading label="Lyric Manager" />}>
          <LyricManagerView
            returnView={originatingPerformanceView}
            onBack={() => requestAppViewChange(originatingPerformanceView)}
            navigationIntent={lyricNavigationIntent}
            onNavigationIntentConsumed={(intentId) => {
              setLyricNavigationIntent(current => current?.id === intentId ? null : current)
            }}
          />
        </Suspense>
      </ManagedWorkspaceShell>
      <UnsavedLyricChangesDialog
        open={pendingAppView !== null}
        busy={lyricEditorSaving}
        message="Save your lyric edits before leaving Lyric Manager?"
        onCancel={() => setPendingAppView(null)}
        onDiscard={() => {
          const next = pendingAppView
          useLyricsStore.getState().markEditorDirty(false)
          finishPendingNavigation(next)
        }}
        onSave={() => {
          const next = pendingAppView
          void useLyricsStore.getState().saveActiveLyricDocument().then(result => {
            if (!result?.ok || !next) return
            useLyricsStore.getState().markEditorDirty(false)
            finishPendingNavigation(next)
          })
        }}
      />
    </>
  )
}
