import { useId, useState, type ReactNode } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { CtrlSection, SelectRow, type SelectOption } from '../ReactControlRows'
import { Badge } from '../controls/Badge'
import { IconChipButton } from '../controls/IconChipButton'
import { StatusBadge } from '../controls/StatusBadge'
import railStyles from '../../layout/RailWindowHeader.css?inline'
import dropdownStyles from '../../../shared/Dropdown/Dropdown.css?inline'
import styles from './outputStudies.css?inline'

// Proposed export choices, not a declaration of MediaRecorder/encoder support.
// Every study uses the same contract and local defaults. No production stores,
// canvas streams, downloads, casting or preset mutations are involved.
const FIELDS = {
  aspect: { label: 'Aspect Ratio', options: ['16:9', '9:16', '1:1', '4:3', '21:9'].map(value => ({ value, label: value })) },
  fps: { label: 'Frame Rate', options: ['24', '30', '60'].map(value => ({ value, label: `${value} fps` })) },
  bitrate: { label: 'Video Bitrate', options: ['4', '8', '12', '16', '24', '40'].map(value => ({ value, label: `${value} Mbps` })) },
  format: { label: 'Video Format', options: ['WebM', 'MP4', 'MOV'].map(value => ({ value, label: value })) },
} satisfies Record<string, { label: string; options: SelectOption[] }>
type Field = keyof typeof FIELDS
type Settings = Record<Field, string>
const DEFAULT_SETTINGS: Settings = { aspect: '16:9', fps: '30', bitrate: '8', format: 'WebM' }
const STUDIES = [
  { id: 'classic', name: '01 · Classic Inspector', description: 'Familiar, full-width controls in a single vertical stack.' },
  { id: 'paired', name: '02 · Compact Grid', description: 'Paired framing and encoding controls with less scrolling.' },
  { id: 'quick', name: '03 · Quick Select', description: 'Direct frame-rate and format choices; precise dropdowns for the rest.' },
  { id: 'framing', name: '04 · Framing First', description: 'An aspect-ratio preview and aligned settings before recording.' },
] as const

type Study = (typeof STUDIES)[number]

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <div className="ll-out-group"><CtrlSection label={title} />{children}</div>
}

function AspectPreview({ aspect }: { aspect: string }) {
  const [width, height] = aspect.split(':').map(Number)
  const scale = Math.min(154 / width, 86 / height)
  return <div className="ll-out-aspect-preview" role="img" aria-label={`Output framing: ${aspect}`}>
    <div className="ll-out-aspect-frame" style={{ width: width * scale, height: height * scale }}><span>{aspect}</span></div>
  </div>
}

function OutputStudy({ study }: { study: Study }) {
  const id = useId()
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [recording, setRecording] = useState(false)
  const [feedback, setFeedback] = useState('')
  const change = (field: Field, value: string) => {
    setSettings(previous => ({ ...previous, [field]: value }))
    setFeedback('')
  }
  const field = (key: Field) => <div className="ll-out-field" data-output-field={key} key={key}>
    <SelectRow id={`${id}-${key}`} label={FIELDS[key].label} value={settings[key]}
      options={FIELDS[key].options} onChange={value => change(key, value)} disabled={recording}
      menuBoundarySelector=".ll-out-inspector" menuClassName="ll-out-menu" />
  </div>
  const choices = (key: 'fps' | 'format') => <div className="ll-out-choice-field" data-output-field={key}>
    <span className="rv-ctrl-label" id={`${id}-${key}-label`}>{FIELDS[key].label}</span>
    <div className="ll-out-choices" role="group" aria-labelledby={`${id}-${key}-label`}>
      {FIELDS[key].options.map(option => <IconChipButton key={option.value}
        tone={settings[key] === option.value ? 'primary' : 'default'}
        aria-pressed={settings[key] === option.value} disabled={recording}
        onClick={() => change(key, option.value)}>{option.label}</IconChipButton>)}
    </div>
  </div>
  const record = <Group title="Record">
    <div className="ll-out-status"><span className="rv-ctrl-label">Status</span>
      {recording ? <Badge tone="#e0687d" label="Recording" /> : <StatusBadge tone="loaded">Ready</StatusBadge>}
    </div>
    <div className="ll-out-status"><span className="rv-ctrl-label">Audio</span><StatusBadge tone="playing">Available</StatusBadge></div>
    <IconChipButton className={`ll-out-record${recording ? ' dv-icon-chip--danger' : ''}`}
      tone={recording ? 'default' : 'primary'} icon={<AppIcon kind={recording ? 'stop' : 'record'} />}
      onClick={() => { setRecording(!recording); setFeedback(recording ? 'Recording saved (simulation)' : 'Recording started (simulation)') }}>
      {recording ? 'Stop & Save' : 'Start Recording'}
    </IconChipButton>
  </Group>
  const exportFrame = <Group title="Export">
    <IconChipButton icon={<AppIcon kind="camera" />} onClick={() => setFeedback('PNG frame exported (simulation)')}>PNG Frame</IconChipButton>
  </Group>

  return <section className="ll-out-study" data-output-study={study.id} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{study.name}</h2>
    <p className="ll-out-description">{study.description}</p>
    <div className="ll-out-inspector" data-output-variant={study.id}>
      <RailWindowHeader side="right" icon={<AppIcon kind="settings" size={15} />} label="Inspector" />
      <div className="dv-underline-tabs ll-out-tabs" aria-label="Inspector tabs (preview)">
        {['Presets', 'Design', 'React', 'Output'].map(tab => <span key={tab} className={`dv-underline-tab${tab === 'Output' ? ' is-active' : ''}`} aria-current={tab === 'Output' ? 'page' : undefined}>{tab}</span>)}
      </div>
      <div className="ll-out-subtab"><span>Recording</span></div>
      <div className="ll-out-scroll">
        {study.id === 'classic' && <>
          {record}
          <Group title="Video Settings">{field('aspect')}{field('fps')}{field('bitrate')}{field('format')}</Group>
          {exportFrame}
        </>}
        {study.id === 'paired' && <>
          {record}
          <Group title="Video Settings">
            <div className="ll-out-pair">{field('aspect')}{field('fps')}</div>
            <div className="ll-out-pair">{field('format')}{field('bitrate')}</div>
          </Group>
          {exportFrame}
        </>}
        {study.id === 'quick' && <>
          {record}
          <Group title="Video Settings">{choices('fps')}{choices('format')}{field('aspect')}{field('bitrate')}</Group>
          {exportFrame}
        </>}
        {study.id === 'framing' && <>
          <Group title="Framing"><AspectPreview aspect={settings.aspect} />{field('aspect')}</Group>
          <Group title="Encoding">{field('fps')}{field('bitrate')}{field('format')}</Group>
          {record}{exportFrame}
        </>}
        <div className="ll-out-feedback" aria-live="polite">{feedback}</div>
      </div>
    </div>
  </section>
}

export function OutputStudies() {
  return <div className="ll-out-gallery" aria-label="Output Inspector studies">
    <style>{railStyles + dropdownStyles + styles}</style>
    <p className="ll-out-intro">One preset-independent recording layout per study. Controls are interactive previews; recording, audio status, export and proposed formats are simulated. Engine-specific production controls are outside these studies.</p>
    <div className="ll-out-studies">{STUDIES.map(study => <OutputStudy key={study.id} study={study} />)}</div>
  </div>
}
