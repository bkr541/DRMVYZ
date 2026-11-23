import { useId, type CSSProperties } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import styles from './liveInputStudies.css?inline'

const STUDIES = [
  { id: 'meter', name: 'Level Meter', icon: 'volume' },
  { id: 'spectrum', name: 'Frequency Bars', icon: 'waveform' },
  { id: 'scope', name: 'Live Scope', icon: 'scope' },
  { id: 'expandable', name: 'Meter with Expandable Detail', icon: 'sliders' },
] as const

const BANDS = [
  { label: 'Low', levels: [.56, .68, .79, .9, .76, .68, .58, .48, .64, .74, .65, .53] },
  { label: 'Mid', levels: [.48, .57, .72, .63, .52, .57, .68, .48, .56, .45, .59, .45] },
  { label: 'High', levels: [.48, .38, .53, .4, .32, .46, .37, .3, .45, .34, .29, .39] },
]

// One fixed sample, drawn as a thin filled trace across the scope.
const scopePoints = Array.from({ length: 97 }, (_, index) => {
  const phase = index / 96 * Math.PI * 2
  const sample = (.59 * Math.sin(phase * 3) + .27 * Math.sin(phase * 8)) * (.64 + .36 * Math.sin(phase * 1.5))
  return { x: index / 96 * 100, y: 50 + sample * 42 }
})
const scopeTrace = 'polygon(' + [
  ...scopePoints.map(({ x, y }) => `${x}% ${y - 2.5}%`),
  ...scopePoints.slice().reverse().map(({ x, y }) => `${x}% ${y + 2.5}%`),
].join(', ') + ')'

function LevelMeter() {
  return <div className="ll-li-meter" role="img" aria-label="Example input level meter">
    <span className="ll-li-meter-track"><i className="ll-li-meter-fill" /><i className="ll-li-meter-peak" /></span>
    <span className="ll-li-meter-scale" aria-hidden="true"><span>−48</span><span>−24</span><span>−12</span><span>0 dBFS</span></span>
  </div>
}

function FrequencyBars() {
  return <div className="ll-li-spectrum" role="img" aria-label="Example low, mid and high frequency levels">
    {BANDS.map(({ label, levels }) => <div className="ll-li-band" key={label}>
      <div className="ll-li-bars" aria-hidden="true">
        {levels.map((level, index) => <i key={index} style={{ '--li-level': level } as CSSProperties} />)}
      </div>
      <span aria-hidden="true">{label}</span>
    </div>)}
  </div>
}

function LiveScope() {
  return <div className="ll-li-scope" role="img" aria-label="Example live input scope">
    <span style={{ clipPath: scopeTrace }} />
  </div>
}

function DockPreview({ study, expanded = false }: { study: (typeof STUDIES)[number]['id']; expanded?: boolean }) {
  return <div className="ll-li-dock">
    <div className="ll-li-row">
      <span className="ll-li-key ll-li-transport" role="img" aria-label="Stop Live Input"><AppIcon kind="stop" size={14} /></span>
      <div className="ll-li-device">
        <span>Live Input</span>
        <strong>USB Audio Interface</strong>
      </div>
      <span className="ll-li-status">Live</span>
      <div className="ll-li-signal">
        {study === 'spectrum' && <FrequencyBars />}
        {study === 'scope' && <LiveScope />}
        {(study === 'meter' || study === 'expandable') && <LevelMeter />}
      </div>
      <div className="ll-li-actions">
        {study === 'expandable' && <span className="ll-li-key" data-selected={expanded}>
          Spectrum <AppIcon kind={expanded ? 'chevronUp' : 'chevronDown'} size={13} />
        </span>}
        <span className="ll-li-key"><AppIcon kind="sliders" size={14} /> Source</span>
      </div>
    </div>
    {expanded && <div className="ll-li-expanded"><FrequencyBars /></div>}
  </div>
}

export function LiveInputStudies() {
  const id = useId()

  return <div className="ll-live-input-studies" aria-label="Live Input dock studies">
    <style>{styles}</style>
    {STUDIES.map(study => <section className="ll-li-study" key={study.id} data-live-input-study={study.id} aria-labelledby={`${id}-${study.id}`}>
      <h2 id={`${id}-${study.id}`}><AppIcon kind={study.icon} size={14} />{study.name}</h2>
      {study.id === 'expandable' ? <div className="ll-li-detail-states">
        <div className="ll-li-detail-state"><span>Collapsed</span><DockPreview study={study.id} /></div>
        <div className="ll-li-detail-state"><span>Expanded</span><DockPreview study={study.id} expanded /></div>
      </div> : <DockPreview study={study.id} />}
    </section>)}
  </div>
}
