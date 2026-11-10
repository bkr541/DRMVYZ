import { requestTextSceneNavigation } from '../../features/cinema2Text/textSceneNavigation'
import { InfoPopover } from '../../components/shared/InfoPopover/InfoPopover'
import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactPresetCard } from '../../components/vyzualz/react/ReactPresetCard'
import { Cinema2TextLibraryPanel } from '../../components/vyzualz/react/Cinema2TextLibraryPanel'
import { LyricTrackBrowser } from '../../features/lyrics/components/LyricTrackBrowser'
import { Cinema2InspectorPanel } from '../../components/vyzualz/react/Cinema2InspectorPanel'
import { Cinema2ParameterState } from '../../components/vyzualz/cinema2/parameters/Cinema2ParameterState'
import { cinema2NativePresetRegistry } from '../../components/vyzualz/cinema2/presets/Cinema2PresetRegistry'
import { emptyTextLibrary, type Cinema2TextPresetId } from '../../components/vyzualz/cinema2/text/Cinema2TextConfiguration'
import type { Cinema2Runtime } from '../../components/vyzualz/cinema2/runtime/Cinema2Runtime'
import type { Cinema2PresetId } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { useCinema2TextLibraryStore } from '../../features/cinema2Text/cinema2TextStore'
import '../../styles.css'
import '../../styles/reference.css'
import '../../styles/vyzualz.css'
import '../../styles/reactView.css'
import '../../styles/mediaManager.css'
import '../../styles/lyricManager.css'
import '../../styles/workspaceShell.css'
import '../../styles/appearance.css'
import '../../styles/tabRows.css'
import '../../styles/groupSpacing.css'
import '../../styles/typography.css'

// Review-only account and runtime: no authentication gate or cloud behavior is replaced in the app.
useCinema2TextLibraryStore.setState({ userId: 'a4440000-0000-4000-8000-000000000001', data: emptyTextLibrary(), pending: emptyTextLibrary(), sync: async () => {} })
function makeRuntime(presetId: Cinema2TextPresetId) {
  const compiled = cinema2NativePresetRegistry.compile(presetId as Cinema2PresetId)
  if (!compiled.ok) throw new Error('Text preset unavailable')
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  return { getCompiledPresetPlan: () => compiled.plan, getParameterState: () => state, getMediaSlotRuntimeSnapshot: () => ({ slots: [] }), serializeParameterState: () => state.serialize() } as unknown as Cinema2Runtime
}
function Fixture() {
  const [preset, setPreset] = useState<Cinema2TextPresetId>('drmvyz.cinema2.say-it')
  const [runtime, setRuntime] = useState(() => makeRuntime(preset))
  const infoAnchor = useRef<HTMLButtonElement>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [mode, setMode] = useState<'source' | 'pool'>('source')
  return <main className="rv-shell" style={{ overflow: 'auto', padding: 20 }}>
    <div style={{ display: 'flex', gap: 16, paddingBottom: 16 }}>
      <select aria-label="Review preset" value={preset} onChange={event => { const next = event.target.value as Cinema2TextPresetId; requestTextSceneNavigation(() => { setPreset(next); setRuntime(makeRuntime(next)); setMode('source') }) }}>
        {['say-it', 'marquee', 'nightshift'].map(id => <option key={id} value={`drmvyz.cinema2.${id}`}>{id.toUpperCase()}</option>)}
      </select>
      <button onClick={() => { if (mode !== 'source') requestTextSceneNavigation(() => setMode('source')) }}>Source</button><button onClick={() => { if (mode !== 'pool') requestTextSceneNavigation(() => setMode('pool')) }}>Pool</button>
      <button ref={infoAnchor} onClick={() => setInfoOpen(true)}>Info Popover</button>
    </div>
    <div style={{ display: 'flex', gap: 30, alignItems: 'flex-start' }}>
      <section className="rv-context-workspace" style={{ width: 354, flex: '0 0 354px' }}>
        <div className="rv-left-tab-body"><div className="rv-engine-viewport rv-inspector" role="region" aria-label="Source review">
          <div className="rv-ctrl-group"><Cinema2TextLibraryPanel runtime={runtime} mode={mode} /></div>
        </div></div>
      </section>
      <section className="rv-engine-viewport rv-inspector" style={{ width: 354, flex: '0 0 354px' }} aria-label="Design review"><Cinema2InspectorPanel runtime={runtime} surface="design" sharedAudioAnalysis={false} /></section>
      <section className="lmv-root" style={{ width: 354, flex: '0 0 354px', height: 400 }} aria-label="Tracks reference">
        <div className="lmv-left-rail"><div className="lmv-workspace-tab-panel">
          <LyricTrackBrowser tracks={[]} selectedTrackId={null} loadedAudioTrackId={null} playingAudioTrackId={null} search="" loading={false} error={null} hasMore={false}
            onSearchChange={() => {}} onSelectTrack={() => {}} onLoadTrack={() => {}} onOpenActiveLyrics={() => {}} onOpenAiExtract={() => {}}
            onMakeOpenVersionActive={() => {}} canMakeOpenVersionActive={() => false} onDeleteTrack={() => {}} onLoadMore={() => {}} onRetry={() => {}} />
        </div></div>
      </section>
    </div>
    <section aria-label="Preset grid reference" style={{ width: 330, marginTop: 24 }}>
      <div className="rv-preset-group-cards rv-preset-group-cards--poster">
        <ReactPresetCard id={preset} title="Preset Reference" description="Shared Cinema 2.0 grid tile" onActivate={() => {}} />
      </div>
    </section>
    <InfoPopover open={infoOpen} anchorRef={infoAnchor} title="audio source settings" description="Review shared popover typography." onOpenChange={setInfoOpen} />
  </main>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
