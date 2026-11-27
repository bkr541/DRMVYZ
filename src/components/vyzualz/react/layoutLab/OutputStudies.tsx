import { useId, useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { SelectRow, type SelectOption } from '../ReactControlRows'
import { DualRailCollapsible } from '../DualRailCollapsible'
import { IconChipButton } from '../controls/IconChipButton'
import { Badge } from '../controls/Badge'
import { StatusBadge } from '../controls/StatusBadge'
import { performanceOutputSize } from '../output/performanceOutputGeometry'
import type { OutputAspectRatio } from '../../../../native/outputBridge'
import railStyles from '../../layout/RailWindowHeader.css?inline'
import dropdownStyles from '../../../shared/Dropdown/Dropdown.css?inline'
import collapsibleStyles from '../DualRailCollapsible.css?inline'
import iconStyles from '../../../shared/icons/appIcon.css?inline'
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
  { id: 'media-header', name: '05 · Header Tools', description: 'Media Manager-style framing and video groups with full-width capture actions below.' },
  { id: 'media-transform', name: '06 · Capture & Transform', description: 'A compact transform-style capture row, followed by the frame and video settings.' },
  { id: 'media-summary', name: '07 · Output Details', description: 'A live composition summary with a fixed capture row; settings use collapsible details.' },
  { id: 'media-nested', name: '08 · Recording Editor', description: 'One recording group with nested, independently collapsible framing and encoding controls.' },
] as const

type Study = (typeof STUDIES)[number]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="ll-out-section"><h3>{title}</h3>{children}</section>
}

function OutputStudy({ study }: { study: Study }) {
  const id = useId()
  const mediaInspired = study.id.startsWith('media-')
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
    <div className="ll-out-frame" style={{ width: size.width * scale, aspectRatio: `${size.width} / ${size.height}` }}><span>{settings.aspect}</span></div>
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
  const toggleRecording = () => {
    setRecording(!recording)
    setFeedback(recording ? 'Recording saved (simulation)' : 'Recording started (simulation)')
  }
  const exportPng = () => setFeedback('PNG frame exported (simulation)')
  const status = <div className="ll-out-capture-state" role="status" aria-label="Recording status">
    {recording ? <Badge tone="#ff6575" label="Recording" /> : <StatusBadge tone="loaded">Ready</StatusBadge>}
    <span className="ll-out-audio" title="Simulated program audio available"><AppIcon kind="volume" size={13} /> Audio ready</span>
  </div>
  const tools = <span className="ll-out-actions" role="group" aria-label="Capture actions">
    <IconChipButton className={`ll-out-record${recording ? ' is-recording' : ''}`}
      icon={<AppIcon kind={recording ? 'stop' : 'record'} size={16} />}
      aria-label={actionLabel} aria-pressed={recording} title={actionLabel} onClick={toggleRecording} />
    <IconChipButton icon={<AppIcon kind="camera" size={16} />} aria-label="Export PNG frame" title="Export PNG frame"
      onClick={exportPng} />
  </span>
  const actions = <div className="ll-out-capture" data-recording={recording}>{status}{tools}</div>
  const mediaActions = <div className="ll-out-media-actions" data-recording={recording}>{tools}{status}</div>
  const group = (label: string, icon: AppIconKind, children: ReactNode) => (
    <DualRailCollapsible label={label} icon={<AppIcon kind={icon} size={15} />}
      defaultOpen keepMounted>
      {children}
    </DualRailCollapsible>
  )
  const frameSettings = <>{rail}{resolution}</>
  const encodingSettings = <>{select('format')}<div className="ll-out-pair">{select('fps')}{select('bitrate')}</div></>
  const summary = <div className="ll-out-media-summary">
    {preview}
    <div className="ll-out-media-summary-copy">
      <span className="ll-out-summary-caption">Output dimensions</span>
      <strong aria-label="Output dimensions">{dimensions}</strong>
      <span>{settings.format} · {settings.fps} fps</span>
      <span>{settings.bitrate} Mbps</span>
    </div>
  </div>

  return <section className="ll-out-study" data-output-study={study.id} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{study.name}</h2>
    <p className="ll-out-description">{study.description}</p>
    <div className={`ll-out-inspector${mediaInspired ? ' ll-out-media-inspector' : ''}`} data-output-variant={study.id}>
      <RailWindowHeader side="right" icon={<AppIcon kind="settings" size={15} />} label="Inspector" />
      <div className="dv-underline-tabs ll-out-tabs" aria-label="Inspector tabs (preview)">
        {['Presets', 'Design', 'React', 'Output'].map(tab => <span key={tab} className={`dv-underline-tab${tab === 'Output' ? ' is-active' : ''}`} aria-current={tab === 'Output' ? 'page' : undefined}>{tab}</span>)}
      </div>
      <div className={`ll-out-scroll${mediaInspired ? ' ll-out-media-body' : ''}`}>
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
        {study.id === 'media-header' && <>
          {group('Framing', 'crop', frameSettings)}
          {group('Video Settings', 'image', encodingSettings)}
          <div className="ll-out-header-actions" role="group" aria-label="Capture actions">
            <IconChipButton className={`dv-icon-chip--danger ll-out-record${recording ? ' is-recording' : ''}`}
              icon={<AppIcon kind={recording ? 'stop' : 'record'} size={16} />}
              aria-label={actionLabel} aria-pressed={recording} title={actionLabel} onClick={toggleRecording}>
              {actionLabel}
            </IconChipButton>
            <IconChipButton icon={<AppIcon kind="camera" size={16} />} aria-label="Screenshot"
              title="Screenshot (export PNG)" onClick={exportPng}>
              Screenshot
            </IconChipButton>
          </div>
        </>}
        {study.id === 'media-transform' && <>
          <div className="ll-out-media-transform-toolbar">{mediaActions}</div>
          {group('Framing', 'crop', frameSettings)}
          {group('Encoding', 'settings', <div className="ll-out-aligned">{select('format')}{select('fps')}{select('bitrate')}</div>)}
        </>}
        {study.id === 'media-summary' && <>
          {group('Output Details', 'info', summary)}
          {group('Framing', 'crop', rail)}
          {group('Video Settings', 'image', encodingSettings)}
        </>}
        {study.id === 'media-nested' && <>
          <div className="ll-out-media-transform-toolbar">{mediaActions}</div>
          {group('Recording', 'image', <>
            <DualRailCollapsible label="Framing" defaultOpen keepMounted headerAccessory={settings.aspect}>
              {frameSettings}
            </DualRailCollapsible>
            <DualRailCollapsible label="Encoding" defaultOpen keepMounted headerAccessory={`${settings.format} · ${settings.fps} fps`}>
              {select('format')}{select('fps')}{select('bitrate')}
            </DualRailCollapsible>
          </>)}
        </>}
      </div>
      {study.id === 'dock' && <div className="ll-out-dock">{actions}</div>}
      {study.id === 'media-summary' && <div className="ll-out-media-dock">{mediaActions}</div>}
      <div className="ll-out-feedback" aria-live="polite">{feedback}</div>
    </div>
  </section>
}

export function OutputStudies() {
  return <div className="ll-out-gallery" aria-label="Output Inspector studies">
    <style>{railStyles + dropdownStyles + collapsibleStyles + iconStyles + styles}</style>
    <p className="ll-out-intro">Preset-independent Output concepts. Framing uses the Cast Output ratios and geometry. Recording, audio status, export and proposed video formats are simulated.</p>
    <h2 className="ll-out-gallery-heading">Media Manager studies</h2>
    <div className="ll-out-studies">{STUDIES.filter(study => study.id.startsWith('media-')).map(study => <OutputStudy key={study.id} study={study} />)}</div>
    <h2 className="ll-out-gallery-heading">Previous studies</h2>
    <div className="ll-out-studies">{STUDIES.filter(study => !study.id.startsWith('media-')).map(study => <OutputStudy key={study.id} study={study} />)}</div>
  </div>
}
