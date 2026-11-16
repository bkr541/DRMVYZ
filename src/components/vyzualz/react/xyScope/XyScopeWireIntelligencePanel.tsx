import { MiLevelRow, MiSection } from '../../modulation/MusicIntelligenceDiagnosticsPanel'
import { Collapsible } from '../ReactControlRows'
import { WIRE_MANUAL_NOTE } from './XyScopeWireConductor'
import { useWireLive } from './XyScopeWireLive'

const KEY_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] as const
const pct = (v: number) => `${Math.round(v * 100)}%`
const SOURCE_LABELS = { stereo: 'LIVE STEREO', mono: 'LIVE MONO', shared: 'SHARED ANALYSIS', none: 'NO SIGNAL' } as const

/**
 * What WIREFRAME is doing, shown in the REACT tab beside Audio Intelligence and styled the same way: titled sections of label and value rows
 * (the same `MiSection` and `vz-mi-*` rows). It lives here, not in Master Controls, because it is information about the music and the
 * performance, not a control. It reads the live snapshot the surface publishes about ten times a second.
 */
export function XyScopeWireIntelligencePanel() {
  const live = useWireLive()
  const kv = (label: string, value: string, tag = true) => (
    <>
      <span className="vz-mi-kv-label">{label}</span>
      <span className={`vz-mi-kv-val${tag ? ' vz-mi-kv-val--tag' : ''}`}>{value}</span>
    </>
  )

  return (
    <div className="vz-mi-panel" data-wire-intelligence="true">
      <Collapsible label="Wireframe Performance" defaultOpen>
        {!live ? (
          <div className="rv-ctrl-info rv-control-helper-copy">Appears while the WIREFRAME source is drawing.</div>
        ) : (
          <>
            <MiSection title="Performance">
              <div className="vz-mi-kv-row">{kv('Scene', `${live.state} · ${live.sceneId.toUpperCase()}`)}</div>
              <div className="vz-mi-kv-row">{kv('Motion', live.motion < .02 ? 'HOLDING' : live.beatLocked ? 'BEAT-LOCKED' : 'STEADY TEMPO')}{kv('Signal', SOURCE_LABELS[live.source])}</div>
              <div className="vz-mi-kv-row">{kv('Evidence', live.structure ? 'TRACK SECTIONS' : 'ONSETS ONLY')}{kv('Last event', live.lastEvent)}</div>
              {live.auto && <div className="vz-mi-kv-row">{kv('Feel', live.feel)}{kv('Figure', live.figure.toUpperCase())}</div>}
            </MiSection>

            <MiSection title="Mood">
              <MiLevelRow label="Energy" value={live.mood.energy} text={pct(live.mood.energy)} />
              <MiLevelRow label="Tension" value={live.mood.tension} text={pct(live.mood.tension)} />
              <MiLevelRow label="Build" value={live.mood.build} text={pct(live.mood.build)} />
              <MiLevelRow label="Drop" value={Math.max(live.mood.drop, live.shock)} text={pct(Math.max(live.mood.drop, live.shock))} />
              <MiLevelRow label="Complexity" value={live.mood.complexity} text={pct(live.mood.complexity)} />
              <MiLevelRow label="Brightness" value={live.mood.brightness} text={pct(live.mood.brightness)} />
              <MiLevelRow label="Build pulse" value={live.pulse} text={pct(live.pulse)} />
            </MiSection>

            <MiSection title="Section">
              <div className="vz-mi-kv-row">
                {kv('Section', live.mood.structured && live.mood.sectionType ? live.mood.sectionType.toUpperCase() : 'NONE')}
                {kv('Progress', live.mood.structured ? pct(live.mood.sectionProgress) : '—', false)}
              </div>
              <div className="vz-mi-kv-row">
                {kv('Phrase', live.mood.structured ? String(live.mood.phraseIndex + 1) : '—', false)}
                {kv('Key', live.mood.keyIndex != null ? `${KEY_NAMES[live.mood.keyIndex]} ${live.mood.minor ? 'MINOR' : 'MAJOR'}` : 'UNKNOWN')}
              </div>
            </MiSection>

            {live.auto && (
              <MiSection title="Driving">
                <MiLevelRow label="Chaos" value={live.effective.chaos} text={pct(live.effective.chaos)} />
                <MiLevelRow label="Wave depth" value={live.effective.waveDepth / .6} text={pct(live.effective.waveDepth)} />
                <MiLevelRow label="Wave amount" value={live.effective.waveAmount / 1.5} text={pct(live.effective.waveAmount)} />
                <MiLevelRow label="Spin" value={Math.abs(live.effective.spin) / 2} text={live.effective.spin.toFixed(2)} />
                <MiLevelRow label="Glow" value={live.effective.glow / 3} text={live.effective.glow.toFixed(2)} />
                <MiLevelRow label="Background" value={live.effective.backgroundAmount} text={pct(live.effective.backgroundAmount)} />
                <div className="vz-mi-kv-row">{kv('Layer', live.effective.background.toUpperCase())}{kv('Transition', live.effective.transition.toUpperCase())}</div>
                <p className="vz-mi-note">{WIRE_MANUAL_NOTE}</p>
              </MiSection>
            )}

            <MiSection title="Reactions">
              <div className="vz-mi-kv-row">{kv('Last', live.lastReaction)}</div>
              <div className="vz-mi-kv-row">{kv('Fired', String(live.reactionsFired), false)}{kv('Transition', live.transition ? live.transition.toUpperCase() : 'NONE')}</div>
            </MiSection>

            <MiSection title="Readability">
              <MiLevelRow label="Figure" value={live.readability} text={pct(live.readability)} />
              <MiLevelRow label="Recent" value={live.readableFraction} text={pct(live.readableFraction)} />
            </MiSection>
          </>
        )}
      </Collapsible>
    </div>
  )
}
