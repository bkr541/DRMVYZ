import { useId, useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { SelectRow, type SelectOption } from '../ReactControlRows'
import { Badge } from '../controls/Badge'
import { StatusBadge } from '../controls/StatusBadge'
import { performanceOutputSize } from '../output/performanceOutputGeometry'
import type { OutputAspectRatio } from '../../../../native/outputBridge'
import railStyles from '../../layout/RailWindowHeader.css?inline'
import dropdownStyles from '../../../shared/Dropdown/Dropdown.css?inline'
import styles from './outputStudies.css?inline'

// Match OutputCastControl's six aspect choices, order and production glyphs.
// Window mode is a display destination setting, not a video encoding setting.
const ASPECTS = [
  ['16:9', 'ratio16x9'], ['16:10', 'ratio16x10'], ['4:3', 'ratio4x3'],
  ['3:2', 'ratio3x2'], ['1:1', 'ratio1x1'], ['9:16', 'ratio9x16'],
] as const satisfies readonly (readonly [OutputAspectRatio, AppIconKind])[]
const FIELDS = {
  fps: { label: 'Frame Rate', options: ['24', '30', '60'].map(value => ({ value, label: `${value} fps` })) },
  bitrate: { label: 'Video Bitrate', options: ['4', '8', '12', '16', '24', '40'].map(value => ({ value, label: `${value} Mbps` })) },
  format: { label: 'Video Format', options: ['WebM', 'MP4', 'MOV'].map(value => ({ value, label: value })) },
} satisfies Record<string, { label: string; options: SelectOption[] }>
type Field = keyof typeof FIELDS
type Settings = Record<Field, string> & { aspect: OutputAspectRatio }
const DEFAULT_SETTINGS: Settings = { aspect: '16:9', fps: '30', bitrate: '8', format: 'WebM' }
const STUDIES = [
  { id: 'command', name: '01 · Command Row', description: 'Capture actions and status at the top; framing and encoding immediately below.' },
  { id: 'dock', name: '02 · Capture Dock', description: 'Framing and compact aligned settings above a fixed, always-visible capture toolbar.' },
  { id: 'viewfinder', name: '03 · Viewfinder', description: 'A proportional framing preview with a compact aspect rail and adjacent capture tools.' },
  { id: 'direct', name: '04 · Direct Controls', description: 'Casting-style choice rails for framing, frame rate and format; one compact action row.' },
] as const

type Study = (typeof STUDIES)[number]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="ll-out-section"><h3>{title}</h3>{children}</section>
}

function OutputStudy({ study }: { study: Study }) {
  const id = useId()
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [recording, setRecording] = useState(false)
  const [feedback, setFeedback] = useState('')
  const size = performanceOutputSize(settings.aspect)
  const dimensions = `${size.width} × ${size.height}`
  const change = <K extends keyof Settings,>(key: K, value: Settings[K]) => {
    if (recording) return
    setSettings(previous => ({ ...previous, [key]: value }))
    setFeedback('')
  }
  const select = (key: Field) => <div className="ll-out-field" data-output-field={key} key={key}>
    <SelectRow id={`${id}-${key}`} label={FIELDS[key].label} value={settings[key]}
      options={FIELDS[key].options} onChange={value => change(key, value)} disabled={recording}
      menuBoundarySelector=".ll-out-inspector" menuClassName="ll-out-menu" />
  </div>
  const rail = <fieldset className="rv-cast-rail-section ll-out-aspect" data-output-field="aspect" disabled={recording}>
    <legend>Aspect Ratio</legend>
    <div className="rv-cast-rail-group rv-cast-rail-group--aspect">
      {ASPECTS.map(([ratio, icon]) => <button key={ratio} type="button"
        className={settings.aspect === ratio ? 'is-selected' : ''} aria-pressed={settings.aspect === ratio}
        disabled={recording} title={`Aspect ratio ${ratio}`} onClick={() => change('aspect', ratio)}>
        <AppIcon kind={icon} /><span className="rv-cast-rail-option-label">{ratio}</span>
      </button>)}
    </div>
  </fieldset>
  const resolution = <div className="ll-out-resolution"><span>Output dimensions</span><strong aria-label="Output dimensions">{dimensions}</strong></div>
  const scale = Math.min(100 / size.width, 74 / size.height)
  const preview = <div className="ll-out-viewfinder" role="img" aria-label={`Output framing: ${settings.aspect}`}>
    <div className="ll-out-frame" style={{ width: size.width * scale, height: size.height * scale }}><span>{settings.aspect}</span></div>
  </div>
  const options = (key: 'fps' | 'format') => <fieldset className="rv-cast-rail-section ll-out-encoding-rail" data-output-field={key} disabled={recording}>
    <legend>{FIELDS[key].label}</legend>
    <div className="rv-cast-rail-group">
      {FIELDS[key].options.map(option => <button key={option.value} type="button" disabled={recording}
        className={settings[key] === option.value ? 'is-selected' : ''} aria-pressed={settings[key] === option.value}
        onClick={() => change(key, option.value)}><span className="rv-cast-rail-option-label">{option.label}</span></button>)}
    </div>
  </fieldset>
  const actionLabel = recording ? 'Stop & Save' : 'Start Recording'
  const actions = <div className="ll-out-capture" data-recording={recording}>
    <div className="ll-out-capture-state">
      {recording ? <Badge tone="#ff8b94" label="Recording" /> : <StatusBadge tone="loaded">Ready</StatusBadge>}
      <span className="ll-out-audio" title="Simulated program audio available"><AppIcon kind="volume" size={13} /> Audio ready</span>
    </div>
    <div className="ll-out-actions" role="group" aria-label="Capture actions">
      <button className={`rv-cast-icon-btn ll-out-record${recording ? ' is-recording' : ''}`} type="button"
        aria-label={actionLabel} title={actionLabel} onClick={() => {
          setRecording(!recording)
          setFeedback(recording ? 'Recording saved (simulation)' : 'Recording started (simulation)')
        }}><AppIcon kind={recording ? 'stop' : 'record'} /></button>
      <button className="rv-cast-icon-btn" type="button" aria-label="Export PNG frame" title="Export PNG frame"
        onClick={() => setFeedback('PNG frame exported (simulation)')}><AppIcon kind="camera" /></button>
    </div>
  </div>

  return <section className="ll-out-study" data-output-study={study.id} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{study.name}</h2>
    <p className="ll-out-description">{study.description}</p>
    <div className="ll-out-inspector" data-output-variant={study.id}>
      <RailWindowHeader side="right" icon={<AppIcon kind="settings" size={15} />} label="Inspector" />
      <div className="dv-underline-tabs ll-out-tabs" aria-label="Inspector tabs (preview)">
        {['Presets', 'Design', 'React', 'Output'].map(tab => <span key={tab} className={`dv-underline-tab${tab === 'Output' ? ' is-active' : ''}`} aria-current={tab === 'Output' ? 'page' : undefined}>{tab}</span>)}
      </div>
      <div className="ll-out-scroll">
        {study.id === 'command' && <>
          {actions}
          <Section title="Framing">{rail}{resolution}</Section>
          <Section title="Encoding"><div className="ll-out-pair">{select('fps')}{select('bitrate')}</div>{select('format')}</Section>
        </>}
        {study.id === 'dock' && <>
          <Section title="Framing">{rail}{resolution}</Section>
          <Section title="Encoding"><div className="ll-out-aligned">{select('format')}{select('fps')}{select('bitrate')}</div></Section>
        </>}
        {study.id === 'viewfinder' && <>
          <Section title="Framing"><div className="ll-out-framing-split">{preview}{rail}</div>{resolution}{actions}</Section>
          <Section title="Encoding">{select('format')}<div className="ll-out-pair">{select('fps')}{select('bitrate')}</div></Section>
        </>}
        {study.id === 'direct' && <>
          {actions}
          <Section title="Framing">{rail}{resolution}</Section>
          <Section title="Encoding">{options('format')}{options('fps')}{select('bitrate')}</Section>
        </>}
      </div>
      {study.id === 'dock' && <div className="ll-out-dock">{actions}</div>}
      <div className="ll-out-feedback" aria-live="polite">{feedback}</div>
    </div>
  </section>
}

export function OutputStudies() {
  return <div className="ll-out-gallery" aria-label="Output Inspector studies">
    <style>{railStyles + dropdownStyles + styles}</style>
    <p className="ll-out-intro">Preset-independent Output concepts. Framing uses the Cast Output ratios and geometry. Recording, audio status, export and proposed video formats are simulated.</p>
    <div className="ll-out-studies">{STUDIES.map(study => <OutputStudy key={study.id} study={study} />)}</div>
  </div>
}
