import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useReactStore } from '../../../stores/reactStore'
import { useVisualStore } from '../../../stores/visualStore'
import { AppIcon } from '../../shared/icons/AppIcon'
import { RailWindowHeader } from '../layout/RailWindowHeader'
import { HeaderNotificationsButton } from '../shared/HeaderNotificationsButton'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { Cinema2Stage } from '../react/Cinema2Stage'
import { useCinema2WorkspaceRestoreState } from '../react/useCinema2WorkspaceRestoreState'
import { isReactTransportPaused } from '../react/reactTransportState'
import {
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  cinema2NativePresetRegistry,
  getCinema2WorkspacePresetState,
  type Cinema2PresetId,
  type Cinema2Runtime,
  type Cinema2WorkspacePresetState,
} from '../cinema2'
import { MOBILE_ENGINE_ID, MOBILE_PAGES, MOBILE_STAGE_ASPECT, type MobilePage } from './mobilePages'
import { MobilePerformPage } from './MobilePerformPage'
import { MobilePadsPage } from './MobilePadsPage'
import { MobileRemotePage } from './MobileRemotePage'
import { MobileVisualizerPage } from './MobileVisualizerPage'
import '../../../styles/reactView.css'
import '../layout/mobileScreens.css'
import './mobileApp.css'

interface Rect { left: number; top: number; width: number; height: number }

/**
 * The mobile app a phone gets after signing in: Perform, Remote, Pads and Visualizer, built from the same stores and components as the
 * desktop. The Cinema 2.0 stage lives here, not on a page, so it keeps running (and keeps casting) while the user moves between pages.
 */
export function MobileApp() {
  const engine = useSharedAudio()
  const bpmSync = useVisualStore(state => state.bpmSync)
  const { cinema2Workspace, storeCinema2WorkspacePresetState, activeReactEngineId, selectReactEngine } = useReactStore(useShallow(state => ({
    cinema2Workspace: state.cinema2Workspace,
    storeCinema2WorkspacePresetState: state.storeCinema2WorkspacePresetState,
    activeReactEngineId: state.activeReactEngineId,
    selectReactEngine: state.selectReactEngine,
  })))
  const [page, setPage] = useState<MobilePage>('Performance')
  const [runtime, setRuntime] = useState<Cinema2Runtime | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const [rect, setRect] = useState<Rect>(() => {
    const width = Math.min(typeof window === 'undefined' ? 393 : window.innerWidth, 600)
    return { left: 0, top: 0, width, height: Math.round(width / MOBILE_STAGE_ASPECT) }
  })
  const visible = page === 'Visualizer'

  // The mobile app runs Cinema 2.0 only; a store restored from an older session may name another engine.
  useEffect(() => { if (activeReactEngineId !== MOBILE_ENGINE_ID) selectReactEngine(MOBILE_ENGINE_ID) }, [activeReactEngineId, selectReactEngine])

  // No preset is chosen for the user: with nothing selected the stage stays empty and says so.
  const activeId = cinema2Workspace.activePresetId
  const presetId: Cinema2PresetId | null = activeId && cinema2NativePresetRegistry.has(activeId) ? activeId : null
  const restoreState = useCinema2WorkspaceRestoreState(
    presetId ?? CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
    getCinema2WorkspacePresetState(cinema2Workspace, presetId ?? CINEMA2_RUNTIME_FOUNDATION_PRESET_ID),
    cinema2Workspace.activationRevision,
  )
  const handleRetiring = useCallback((state: Readonly<Cinema2WorkspacePresetState>) => storeCinema2WorkspacePresetState(state), [storeCinema2WorkspacePresetState])

  const transportPaused = engine.source === 'file' && isReactTransportPaused({
    isPlaying: engine.isPlaying,
    currentTimeSec: engine.currentTime,
    durationSec: Number.isFinite(engine.duration) && engine.duration > 0 ? engine.duration : 180,
  })

  // Place the stage over the Visualizer page's slot. When another page is showing, the stage keeps its last size, hidden.
  useLayoutEffect(() => {
    if (!visible || !slot) return
    const measure = () => {
      const root = rootRef.current?.getBoundingClientRect()
      const box = slot.getBoundingClientRect()
      if (!root || box.width < 1 || box.height < 1) return
      const next = { left: Math.round(box.left - root.left), top: Math.round(box.top - root.top), width: Math.round(box.width), height: Math.round(box.height) }
      setRect(current => current.left === next.left && current.top === next.top && current.width === next.width && current.height === next.height ? current : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(slot)
    if (rootRef.current) observer.observe(rootRef.current)
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('orientationchange', measure) }
  }, [visible, slot])

  // Rendering is the expensive part on a phone: it runs only while the stage is on screen (and the page is showing).
  useEffect(() => {
    if (!runtime) return
    const apply = () => runtime.setSuspended(!visible || document.visibilityState === 'hidden')
    apply()
    document.addEventListener('visibilitychange', apply)
    return () => document.removeEventListener('visibilitychange', apply)
  }, [runtime, visible])

  const current = MOBILE_PAGES.find(item => item.id === page)!
  return <div className="mpm mpm--production mobile-app" ref={rootRef} data-mobile-page={page} data-workspace-layout="floating" aria-label={`${current.label} page`}>
    <section className="mpm-window fw-surface mpm-page-window" aria-label={`${current.label} header`}>
      <RailWindowHeader side="left" label={current.label} icon={null} actions={<HeaderNotificationsButton page="react" iconOnly />} />
    </section>
    <div className="mpm-body" key={page} data-mobile-page={page}>
      {page === 'Performance' && <MobilePerformPage presetId={presetId} runtime={runtime} />}
      {page === 'Remote' && <MobileRemotePage />}
      {page === 'Pads' && <MobilePadsPage />}
      {page === 'Visualizer' && <MobileVisualizerPage ref={setSlot} hasPreset={presetId !== null} />}
    </div>
    <nav className="mpm-navigation" aria-label="Mobile navigation">
      <UnderlineTabs className="dv-underline-tabs--equal mpm-tabs" tabs={MOBILE_PAGES.map(item => ({ id: item.id, label: item.label, icon: <AppIcon kind={item.icon} size={26} /> }))}
        activeTab={page} onChange={id => setPage(id as MobilePage)} ariaLabel="Mobile pages" />
    </nav>
    {presetId && <div className="mobile-stage-host" data-visible={visible} aria-hidden={!visible} style={rect}>
      <Cinema2Stage
        presetId={presetId}
        restoreState={restoreState}
        isPlaying={engine.isPlaying}
        analysisActive={engine.analysisActive}
        isPaused={transportPaused}
        analyser={engine.analyserMaster}
        audioIntelligenceTrackId={engine.currentTrackId}
        activeAudioTrackId={engine.currentAudioTrackId ?? engine.currentTrackId}
        bpmSync={engine.source !== 'microphone' && bpmSync}
        bpm={engine.currentEffectiveBpm}
        getAudioTime={engine.getCurrentTime}
        onRuntimeReady={setRuntime}
        onRuntimeRetiring={handleRetiring}
      />
    </div>}
  </div>
}
