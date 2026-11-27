import { useId } from 'react'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import { SelectRow, type SelectOption } from '../ReactControlRows'
import { DualRailCollapsible } from '../DualRailCollapsible'
import { IconChipButton } from '../controls/IconChipButton'
import { performanceOutputSize } from './performanceOutputGeometry'
import type { OutputAspectRatio } from '../../../../native/outputBridge'
import './outputHeaderTools.css'

export const OUTPUT_ASPECTS = [
  ['16:9', 'ratio16x9'], ['16:10', 'ratio16x10'], ['4:3', 'ratio4x3'],
  ['3:2', 'ratio3x2'], ['1:1', 'ratio1x1'], ['9:16', 'ratio9x16'],
] as const satisfies readonly (readonly [OutputAspectRatio, AppIconKind])[]
export const OUTPUT_FIELDS = {
  fps: { label: 'Frame Rate', options: ['24', '30', '60'].map(value => ({ value, label: `${value} fps` })) },
  bitrate: { label: 'Video Bitrate', options: ['4', '8', '12', '16', '24', '40'].map(value => ({ value, label: `${value} Mbps` })) },
  format: { label: 'Video Format', options: ['WebM', 'MP4', 'MOV'].map(value => ({ value, label: value })) },
} satisfies Record<string, { label: string; options: SelectOption[] }>
export type OutputField = keyof typeof OUTPUT_FIELDS
export type OutputSettings = Record<OutputField, string> & { aspect: OutputAspectRatio }
export const DEFAULT_OUTPUT_SETTINGS: OutputSettings = { aspect: '16:9', fps: '30', bitrate: '8', format: 'WebM' }

interface Props {
  settings: OutputSettings
  onChange: <K extends keyof OutputSettings>(key: K, value: OutputSettings[K]) => void
  recording: boolean
  onRecord: () => void
  onScreenshot: () => void
  canRecord?: boolean
  canScreenshot?: boolean
  formatOptions?: SelectOption[]
  menuBoundarySelector: string
}

/** The approved Layout Lab 05 Header Tools, shared verbatim with production. */
export function OutputHeaderTools({ settings, onChange, recording, onRecord, onScreenshot,
  canRecord = true, canScreenshot = true, formatOptions = OUTPUT_FIELDS.format.options, menuBoundarySelector }: Props) {
  const id = useId()
  const size = performanceOutputSize(settings.aspect)
  const select = (key: OutputField) => <div className="rv-output-field" data-output-field={key}>
    <SelectRow id={`${id}-${key}`} label={OUTPUT_FIELDS[key].label} value={settings[key]}
      options={key === 'format' ? formatOptions : OUTPUT_FIELDS[key].options}
      onChange={value => onChange(key, value)} disabled={recording}
      menuBoundarySelector={menuBoundarySelector} menuClassName="rv-output-menu" />
  </div>
  const action = recording ? 'Stop & Save' : 'Start Recording'
  return <div className="rv-output-header-tools">
    <DualRailCollapsible label="Framing" icon={<AppIcon kind="crop" size={15} />} defaultOpen keepMounted>
      <fieldset className="rv-cast-rail-section rv-output-aspect" data-output-field="aspect" disabled={recording}>
        <legend>Aspect Ratio</legend>
        <div className="rv-cast-rail-group rv-cast-rail-group--aspect">
          {OUTPUT_ASPECTS.map(([ratio, icon]) => <button key={ratio} type="button"
            className={settings.aspect === ratio ? 'is-selected' : ''} aria-pressed={settings.aspect === ratio}
            disabled={recording} title={`Aspect ratio ${ratio}`} onClick={() => onChange('aspect', ratio)}>
            <AppIcon kind={icon} /><span className="rv-cast-rail-option-label">{ratio}</span>
          </button>)}
        </div>
      </fieldset>
      <div className="rv-output-resolution"><span>Output dimensions</span><strong aria-label="Output dimensions">{size.width} × {size.height}</strong></div>
    </DualRailCollapsible>
    <DualRailCollapsible label="Video Settings" icon={<AppIcon kind="image" size={15} />} defaultOpen keepMounted>
      {select('format')}<div className="rv-output-pair">{select('fps')}{select('bitrate')}</div>
    </DualRailCollapsible>
    <div className="rv-output-actions" role="group" aria-label="Capture actions">
      <IconChipButton className={`dv-icon-chip--danger rv-output-record${recording ? ' is-recording' : ''}`}
        icon={recording ? <AppIcon kind="stop" size={16} /> : (
          <svg className="app-icon" width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
            <circle cx={8} cy={8} r={6} fill="currentColor" stroke="none" />
          </svg>
        )} aria-label={action}
        aria-pressed={recording} title={action} disabled={!recording && !canRecord} onClick={onRecord}>{action}</IconChipButton>
      <IconChipButton icon={<AppIcon kind="camera" size={16} />} aria-label="Screenshot" title="Screenshot (export PNG)"
        disabled={!canScreenshot} onClick={onScreenshot}>Screenshot</IconChipButton>
    </div>
  </div>
}
