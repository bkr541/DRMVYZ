import { useState } from 'react'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { UnderlineDropdown } from '../react/controls/UnderlineDropdown'
import { NumericScrubField } from '../react/controls/NumericScrubField'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { IconChipButton } from '../react/controls/IconChipButton'
import { useDropPointPreviewStore } from '../../../stores/dropPointPreviewStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { useTriggerDropPointPreviewStore, type TriggerDropPoint, type TriggerSnap } from '../../../stores/triggerDropPointPreviewStore'
import { formatDropTime } from './DropPointPanel'

// Media Manager → the group under an audio track's timeline. A tab row (today just "Trigger Drop Point") over the settings
// for the selected trigger. Preview only: edits live in session stores and are not saved or played.

type PanelTab = 'trigger-drop-point'

const SNAP_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'beat', label: 'Nearest beat' },
  { value: 'bar', label: 'Nearest bar' },
] as const

const NO_LINK = ''

interface TriggerDropPointPanelProps {
  trackId: string
  duration: number
  currentTime: number
  triggers: readonly TriggerDropPoint[]
  onSeek: (timeSec: number) => void
}

export function TriggerDropPointPanel({ trackId, duration, currentTime, triggers, onSeek }: TriggerDropPointPanelProps) {
  const [tab, setTab] = useState<PanelTab>('trigger-drop-point')
  const selectedId = useTriggerDropPointPreviewStore(state => state.selectedId)
  const select = useTriggerDropPointPreviewStore(state => state.select)
  const update = useTriggerDropPointPreviewStore(state => state.update)
  const remove = useTriggerDropPointPreviewStore(state => state.remove)
  const dropPointsByMedia = useDropPointPreviewStore(state => state.byMedia)
  const mediaItems = useMediaStore(state => state.items)

  const selected = triggers.find(trigger => trigger.id === selectedId) ?? null
  const maxTime = Number.isFinite(duration) && duration > 0 ? duration : 0

  // Every Drop Point set on a video this session, labelled with the video it belongs to.
  const linkOptions = [{ value: NO_LINK, label: 'Not linked' }]
  for (const [mediaId, points] of Object.entries(dropPointsByMedia)) {
    const media = mediaItems.find(item => item.id === mediaId)
    const mediaName = media?.title ?? media?.name ?? 'Video'
    for (const point of points) linkOptions.push({ value: point.id, label: `${mediaName} · ${point.name} (${formatDropTime(point.timeSec)})` })
  }

  return (
    <div className="mms-dp">
      <div className="mms-dp-head">
        <UnderlineTabs
          className="mms-dp-tabs"
          ariaLabel="Audio track settings"
          tabs={[{ id: 'trigger-drop-point', label: 'Trigger Drop Point', buttonId: 'mms-tdp-tab', ariaControls: 'mms-tdp-panel' }]}
          activeTab={tab}
          onChange={setTab}
        />
        {triggers.length > 1 && (
          <div className="mms-dp-chips" role="group" aria-label="Trigger Drop Points">
            {triggers.map(trigger => (
              <button
                key={trigger.id}
                type="button"
                className={`mms-dp-chip mms-dp-chip--trigger${trigger.id === selectedId ? ' is-active' : ''}`}
                onClick={() => { select(trigger.id); onSeek(trigger.timeSec) }}
              >
                {trigger.name} <span>{formatDropTime(trigger.timeSec)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div id="mms-tdp-panel" className="mms-dp-body" role="tabpanel" aria-labelledby="mms-tdp-tab">
        {selected && (
          <div className="mms-dp-grid">
            <label className="mum-field">
              <span className="mum-field-label">NAME</span>
              <DreamVizTextInput value={selected.name} maxLength={60} onChange={event => update(trackId, selected.id, { name: event.target.value })} />
            </label>

            <div className="mms-dp-field">
              <NumericScrubField
                label="Time"
                unit="s"
                value={Math.round(selected.timeSec * 100) / 100}
                min={0}
                max={maxTime}
                step={0.01}
                onChange={value => update(trackId, selected.id, { timeSec: value })}
              />
            </div>

            <div className="mum-field">
              <span className="mum-field-label">SNAP TO</span>
              <UnderlineDropdown
                ariaLabel="Snap to"
                menuLabel="Snap to"
                value={selected.snap}
                options={SNAP_OPTIONS}
                onChange={value => update(trackId, selected.id, { snap: value as TriggerSnap })}
                size="compact"
                showDescriptions={false}
              />
            </div>

            <div className="mum-field">
              <span className="mum-field-label">DROP POINT</span>
              <UnderlineDropdown
                ariaLabel="Linked Drop Point"
                menuLabel="Drop Point"
                value={selected.linkedDropPointId ?? NO_LINK}
                options={linkOptions}
                onChange={value => update(trackId, selected.id, { linkedDropPointId: value === NO_LINK ? null : value })}
                size="compact"
                showDescriptions={false}
              />
            </div>

            <div className="mms-dp-actions mms-dp-actions--row">
              <IconChipButton onClick={() => { update(trackId, selected.id, { timeSec: Math.min(Math.max(currentTime, 0), maxTime) }) }}>
                Set to Playhead
              </IconChipButton>
              <IconChipButton className="dv-icon-chip--danger" onClick={() => remove(trackId, selected.id)}>Delete</IconChipButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
