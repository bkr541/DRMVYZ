import { useState } from 'react'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { UnderlineDropdown } from '../react/controls/UnderlineDropdown'
import { NumericScrubField } from '../react/controls/NumericScrubField'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { IconChipButton } from '../react/controls/IconChipButton'
import {
  useDropPointPreviewStore,
  type DropPoint,
  type DropPointRepeatBars,
  type DropPointRepeatUntil,
  type DropPointStartMode,
} from '../../../stores/dropPointPreviewStore'

// Media Manager → the group under a video's timeline. A tab row (today just "Drop Point") over the configuration for the
// selected Drop Point. Preview only: edits live in a session store and are not saved, linked to an audio track, or played.

type PanelTab = 'drop-point'

const START_OPTIONS = [
  { value: 'cut', label: 'Cut to the marked frame' },
  { value: 'preroll', label: 'Pre-roll (video plays up to it)' },
] as const

const REPEAT_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '1', label: 'Every 1 bar' },
  { value: '2', label: 'Every 2 bars' },
  { value: '4', label: 'Every 4 bars' },
  { value: '8', label: 'Every 8 bars' },
  { value: '16', label: 'Every 16 bars' },
] as const

const UNTIL_OPTIONS = [
  { value: 'next-trigger', label: 'Until the next trigger or track end' },
  { value: 'count', label: 'A set number of times' },
] as const

export function formatDropTime(sec: number): string {
  const safe = Number.isFinite(sec) && sec > 0 ? sec : 0
  const m = Math.floor(safe / 60)
  const s = safe - m * 60
  return `${m}:${s.toFixed(2).padStart(5, '0')}`
}

interface DropPointPanelProps {
  mediaId: string
  duration: number
  currentTime: number
  dropPoints: readonly DropPoint[]
  onSeek: (timeSec: number) => void
}

export function DropPointPanel({ mediaId, duration, currentTime, dropPoints, onSeek }: DropPointPanelProps) {
  const [tab, setTab] = useState<PanelTab>('drop-point')
  const selectedId = useDropPointPreviewStore(state => state.selectedId)
  const select = useDropPointPreviewStore(state => state.select)
  const update = useDropPointPreviewStore(state => state.update)
  const updateRule = useDropPointPreviewStore(state => state.updateRule)
  const remove = useDropPointPreviewStore(state => state.remove)

  const selected = dropPoints.find(point => point.id === selectedId) ?? null
  const maxTime = Number.isFinite(duration) && duration > 0 ? duration : 0
  const repeatOn = selected !== null && selected.rule.repeatEveryBars !== 0

  return (
    <div className="mms-dp">
      <div className="mms-dp-head">
        <UnderlineTabs
        className="mms-dp-tabs"
        ariaLabel="Video media settings"
        tabs={[{ id: 'drop-point', label: 'Drop Point', buttonId: 'mms-dp-tab', ariaControls: 'mms-dp-panel' }]}
        activeTab={tab}
        onChange={setTab}
      />
        {dropPoints.length > 1 && (
          <div className="mms-dp-chips" role="group" aria-label="Drop Points">
            {dropPoints.map(point => (
              <button
                key={point.id}
                type="button"
                className={`mms-dp-chip${point.id === selectedId ? ' is-active' : ''}`}
                onClick={() => { select(point.id); onSeek(point.timeSec) }}
              >
                {point.name} <span>{formatDropTime(point.timeSec)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div id="mms-dp-panel" className="mms-dp-body" role="tabpanel" aria-labelledby="mms-dp-tab">
        {selected && (
          <>
            <div className="mms-dp-grid">
              <label className="mum-field">
                <span className="mum-field-label">NAME</span>
                <DreamVizTextInput value={selected.name} maxLength={60} onChange={event => update(mediaId, selected.id, { name: event.target.value })} />
              </label>

              <div className="mms-dp-field">
                <NumericScrubField
                  label="Time"
                  unit="s"
                  value={Math.round(selected.timeSec * 100) / 100}
                  min={0}
                  max={maxTime}
                  step={0.01}
                  onChange={value => update(mediaId, selected.id, { timeSec: value })}
                />
              </div>

              <div className="mum-field">
                <span className="mum-field-label">START</span>
                <UnderlineDropdown
                  ariaLabel="Start"
                  menuLabel="Start"
                  value={selected.rule.startMode}
                  options={START_OPTIONS}
                  onChange={value => updateRule(mediaId, selected.id, { startMode: value as DropPointStartMode })}
                  size="compact"
                  showDescriptions={false}
                />
              </div>

              <div className="mms-dp-field">
                <NumericScrubField
                  label="Lead-in"
                  unit="bars"
                  value={selected.rule.leadInBars}
                  min={1}
                  max={16}
                  step={1}
                  disabled={selected.rule.startMode !== 'preroll'}
                  onChange={value => updateRule(mediaId, selected.id, { leadInBars: value })}
                />
              </div>

              <div className="mum-field">
                <span className="mum-field-label">REPEAT</span>
                <UnderlineDropdown
                  ariaLabel="Repeat"
                  menuLabel="Repeat"
                  value={String(selected.rule.repeatEveryBars)}
                  options={REPEAT_OPTIONS}
                  onChange={value => updateRule(mediaId, selected.id, { repeatEveryBars: Number(value) as DropPointRepeatBars })}
                  size="compact"
                  showDescriptions={false}
                />
              </div>

              <div className="mum-field">
                <span className="mum-field-label">REPEAT FOR</span>
                <UnderlineDropdown
                  ariaLabel="Repeat for"
                  menuLabel="Repeat for"
                  value={selected.rule.repeatUntil}
                  options={UNTIL_OPTIONS}
                  disabled={!repeatOn}
                  onChange={value => updateRule(mediaId, selected.id, { repeatUntil: value as DropPointRepeatUntil })}
                  size="compact"
                  showDescriptions={false}
                />
              </div>

              <div className="mms-dp-field">
                <NumericScrubField
                  label="Repeat count"
                  unit="×"
                  value={selected.rule.repeatCount}
                  min={2}
                  max={64}
                  step={1}
                  disabled={!repeatOn || selected.rule.repeatUntil !== 'count'}
                  onChange={value => updateRule(mediaId, selected.id, { repeatCount: value })}
                />
              </div>
              <div className="mms-dp-actions">
                <IconChipButton onClick={() => { update(mediaId, selected.id, { timeSec: Math.min(Math.max(currentTime, 0), maxTime) }) }}>
                  Set to Playhead
                </IconChipButton>
                <IconChipButton className="dv-icon-chip--danger" onClick={() => remove(mediaId, selected.id)}>Delete</IconChipButton>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
