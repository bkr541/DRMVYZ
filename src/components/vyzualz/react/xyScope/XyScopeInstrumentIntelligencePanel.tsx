import type { ReactNode } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { MiSection } from '../../modulation/MusicIntelligenceDiagnosticsPanel'
import { Collapsible } from '../ReactControlRows'
import { useInitLive } from './XyScopeInitLive'
import { useOctaLive } from './XyScopeOctaLive'
import { useOsc1Live } from './XyScopeOsc1Live'
import { useOsc2Live } from './XyScopeOsc2Live'
import { XyScopeWireIntelligencePanel } from './XyScopeWireIntelligencePanel'

const SOURCE_LABELS = { stereo: 'LIVE STEREO', mono: 'LIVE MONO', shared: 'SHARED ANALYSIS', none: 'NO SIGNAL' } as const
type Source = keyof typeof SOURCE_LABELS

/** One reading, as Audio Intelligence's Rhythm and Beat Grid draw them: the label with its value stacked beneath it. */
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="vz-mi-summary-metric">
      <span className="vz-mi-kv-label">{label}</span>
      <span className="vz-mi-kv-val">{value}</span>
    </div>
  )
}
/** The readings in two columns, like Beat Grid. */
const Cells = ({ children }: { children: ReactNode }) => <div className="vz-mi-beat-grid-summary">{children}</div>
const evidence = (mapped: boolean | undefined, confidence: number | undefined) => `${mapped ? 'TRACK + LIVE' : 'LIVE'} · ${Math.round((confidence ?? 0) * 100)}%`

/**
 * What an instrument's Auto Performance is doing, shown in the REACT tab beneath Audio Intelligence and styled the same way: a titled
 * group of label and value rows (the same `MiSection` and `vz-mi-*` rows). It is information about the music and the performance, not a
 * control, so it is not in Master Controls. It reads the live snapshot the instrument publishes while it draws.
 */
function Group({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="vz-mi-panel" data-xyscope-instrument-intelligence={name}>
      <Collapsible label={`${name} Performance`} defaultOpen>{children}</Collapsible>
    </div>
  )
}
const AutoOnly = () => <div className="rv-ctrl-info rv-control-helper-copy">Appears while Auto Performance is on.</div>

const signal = (source: string | undefined) => SOURCE_LABELS[(source ?? 'none') as Source]

function InitPerformance() {
  const live = useInitLive()
  const auto = useReactStore(state => state.xyScopeSettings.init.autoPerformance)
  return (
    <Group name="INIT">
      {!auto ? <AutoOnly /> : (
        <MiSection title="Performance">
          <Cells>
            <Cell label="State" value={live?.state ?? 'LISTENING'} />
            <Cell label="Evidence" value={evidence(live?.mapped, live?.confidence)} />
            <Cell label="Signal" value={signal(live?.source)} />
          </Cells>
        </MiSection>
      )}
    </Group>
  )
}

function Osc1Performance() {
  const live = useOsc1Live()
  const auto = useReactStore(state => state.xyScopeSettings.osc1.autoPerformance)
  return (
    <Group name="OSC 1">
      {!auto ? <AutoOnly /> : (
        <MiSection title="Performance">
          <Cells>
            <Cell label="State" value={live?.state ?? 'LISTENING'} />
            <Cell label="Dominant" value={live?.dominant ?? '—'} />
            <Cell label="Evidence" value={evidence(live?.mapped, live?.confidence)} />
            <Cell label="Signal" value={signal(live?.source)} />
          </Cells>
        </MiSection>
      )}
    </Group>
  )
}

function Osc2Performance() {
  const live = useOsc2Live()
  const auto = useReactStore(state => state.xyScopeSettings.osc2.autoPerformance)
  return (
    <Group name="OSC 2">
      {!auto ? <AutoOnly /> : (
        <MiSection title="Performance">
          <Cells>
            <Cell label="State" value={live?.state ?? 'LISTENING'} />
            <Cell label="Evidence" value={evidence(live?.mapped, live?.confidence)} />
            <Cell label="Signal" value={signal(live?.source)} />
          </Cells>
        </MiSection>
      )}
    </Group>
  )
}

/** OCTA shows its distortion and energy whether or not Auto Performance is on; the conductor and evidence only while it is. */
function OctaPerformance() {
  const live = useOctaLive()
  const auto = useReactStore(state => state.xyScopeSettings.octa.autoPerformance)
  return (
    <Group name="OCTA">
      <MiSection title="Performance">
        <Cells>
          <Cell label="Distortion" value={live?.state ?? 'CLEAN'} />
          <Cell label="Energy" value={`${Math.round((live?.energy ?? 0) * 100)}%`} />
          {auto && <Cell label="Conductor" value={live?.conductor ?? 'LISTENING'} />}
          {auto && <Cell label="Evidence" value={evidence(live?.mapped, live?.confidence)} />}
          <Cell label="Signal" value={signal(live?.source)} />
        </Cells>
      </MiSection>
    </Group>
  )
}

/** The REACT-tab performance group of whichever Sound Drawing XY instrument is selected: nothing for the instruments that have no live readout. */
export function XyScopeInstrumentIntelligencePanel() {
  const mode = useReactStore(state => state.xyScopeSettings.sourceMode)
  if (mode === 'wire') return <XyScopeWireIntelligencePanel />
  if (mode === 'init') return <InitPerformance />
  if (mode === 'osc1') return <Osc1Performance />
  if (mode === 'osc2') return <Osc2Performance />
  if (mode === 'octa') return <OctaPerformance />
  return null
}
