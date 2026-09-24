import { useState } from 'react'
import { CropIcon } from 'hugeicons-react'
import { Collapsible, SliderRow, ToggleRow } from '../react/ReactControlRows'
import { IconChipButton } from '../react/controls/IconChipButton'
import { NoticeCard } from '../react/controls/NoticeCard'
import { SaveAsMediaDialog } from './SaveAsMediaDialog'
import {
  MEDIA_EDIT_RANGES,
  formatDegrees,
  formatPercent,
  formatSignedPercent,
  isMediaEditNeutral,
  mediaEditsEqual,
  createDefaultMediaEdit,
  type MediaEditSliderKey,
} from '../../../features/media/edit/mediaEditModel'
import { mediaEditUnsupportedReason } from '../../../features/media/edit/mediaEditRender'
import { suggestEditedTitle } from '../../../features/media/edit/mediaEditOutput'
import { selectMediaEditDirty, useMediaEditStore } from '../../../stores/mediaEditStore'
import type { UploadedMedia } from '../../../stores/mediaStore'

interface SliderSpec {
  key: MediaEditSliderKey
  label: string
  format: (value: number) => string
}

const COLOR_SLIDERS: SliderSpec[] = [
  { key: 'brightness', label: 'Brightness', format: formatSignedPercent },
  { key: 'contrast', label: 'Contrast', format: formatSignedPercent },
  { key: 'saturation', label: 'Saturation', format: formatSignedPercent },
  { key: 'hue', label: 'Hue', format: formatDegrees },
  { key: 'opacity', label: 'Opacity', format: formatPercent },
]

const DETAIL_SLIDERS: SliderSpec[] = [
  { key: 'sharpness', label: 'Sharpness', format: formatPercent },
  { key: 'blur', label: 'Blur', format: formatPercent },
]

interface MediaEditPanelProps {
  media: UploadedMedia
  /** Called with the new item's id after a successful Save As so the view can select it. */
  onMediaCreated: (mediaId: string) => void
}

/** The Edit tab for one image or video. All state lives in useMediaEditStore. */
export function MediaEditPanel({ media, onMediaCreated }: MediaEditPanelProps) {
  const session = useMediaEditStore(state => state.mediaId === media.id ? state : null)
  const dirty = useMediaEditStore(selectMediaEditDirty)
  const busy = useMediaEditStore(state => state.busy)
  const progress = useMediaEditStore(state => state.progress)
  const error = useMediaEditStore(state => state.error)
  const [savingAsOpen, setSavingAsOpen] = useState(false)

  const unsupported = mediaEditUnsupportedReason(media)
  if (unsupported) {
    return (
      <div className="mmi-body">
        <NoticeCard tone="warning" role="status" title="Editing unavailable">{unsupported}</NoticeCard>
      </div>
    )
  }
  if (!session) return <div className="mmi-body" aria-busy="true" />

  const { edit, cropMode } = session
  const store = useMediaEditStore.getState()
  const working = busy !== 'idle'
  const disabled = working
  // Rotate / flip / mirror change the frame the crop rectangle is drawn on, so they wait for Apply or Cancel.
  const transformDisabled = working || cropMode
  const cropIsFull = mediaEditsEqual({ ...createDefaultMediaEdit(), crop: edit.crop }, createDefaultMediaEdit())
  const canSave = dirty && !working && !cropMode && !isMediaEditNeutral(edit)

  const renderSlider = ({ key, label, format }: SliderSpec) => {
    const range = MEDIA_EDIT_RANGES[key]
    return (
      <SliderRow
        key={key}
        id={`mmi-edit-${key}`}
        label={label}
        value={edit[key]}
        min={range.min}
        max={range.max}
        step={range.step}
        resetValue={range.neutral}
        formatValue={format}
        disabled={disabled}
        onChange={value => store.setSlider(key, value)}
      />
    )
  }

  const progressLabel = busy === 'idle' || !progress
    ? null
    : progress.stage === 'uploading'
      ? 'Uploading edited media…'
      : progress.fraction !== null
        ? `Rendering video… ${Math.round(progress.fraction * 100)}%`
        : 'Rendering…'

  return (
    <div className="mmi-body">
      <Collapsible label="Transform" defaultOpen>
        <div className="rv-ctrl-row mmi-edit-action-row">
          <span className="rv-ctrl-label-cluster"><span className="rv-ctrl-label">Crop</span></span>
          <span className="mmi-edit-actions">
            {!cropIsFull && !cropMode && (
              <IconChipButton disabled={disabled} onClick={() => store.resetCrop()} aria-label="Reset crop to the full frame">
                Reset
              </IconChipButton>
            )}
            <IconChipButton
              tone={cropMode ? 'primary' : 'default'}
              icon={<CropIcon size={13} color="currentColor" />}
              disabled={disabled}
              aria-pressed={cropMode}
              onClick={() => store.setCropMode(!cropMode)}
            >
              {cropMode ? 'Cropping…' : 'Crop'}
            </IconChipButton>
          </span>
        </div>
        <div className="rv-ctrl-row mmi-edit-action-row">
          <span className="rv-ctrl-label-cluster"><span className="rv-ctrl-label">Rotate</span></span>
          <span className="mmi-edit-actions">
            <IconChipButton
              disabled={transformDisabled}
              onClick={() => store.rotate(-1)}
              title="Rotate left 90°"
              aria-label="Rotate left 90 degrees"
            >
              <span aria-hidden="true">↺ 90°</span>
            </IconChipButton>
            <IconChipButton
              disabled={transformDisabled}
              onClick={() => store.rotate(1)}
              title="Rotate right 90°"
              aria-label="Rotate right 90 degrees"
            >
              <span aria-hidden="true">↻ 90°</span>
            </IconChipButton>
          </span>
        </div>
        <ToggleRow
          id="mmi-edit-flip"
          label="Flip"
          description="Flips top to bottom."
          value={edit.flip}
          disabled={transformDisabled}
          onChange={() => store.toggleFlip()}
        />
        <ToggleRow
          id="mmi-edit-mirror"
          label="Mirror"
          description="Reflects left to right."
          value={edit.mirror}
          disabled={transformDisabled}
          onChange={() => store.toggleMirror()}
        />
      </Collapsible>

      <Collapsible label="Color" defaultOpen>
        {COLOR_SLIDERS.map(renderSlider)}
      </Collapsible>

      <Collapsible label="Detail" defaultOpen>
        {DETAIL_SLIDERS.map(renderSlider)}
      </Collapsible>

      {error && <NoticeCard tone="error" role="alert" title="Save failed">{error}</NoticeCard>}
      {progressLabel && <div className="mmi-edit-progress" role="status" aria-live="polite">{progressLabel}</div>}

      <div className="mmi-actions mmi-actions--row">
        <IconChipButton tone="primary" disabled={!canSave} onClick={() => { void store.save() }}>
          {busy === 'saving' ? 'Saving…' : 'Save'}
        </IconChipButton>
        <IconChipButton disabled={!canSave} onClick={() => { store.clearError(); setSavingAsOpen(true) }}>
          Save As
        </IconChipButton>
        {dirty && !working && (
          <IconChipButton onClick={() => store.discard()}>Reset</IconChipButton>
        )}
      </div>

      {savingAsOpen && (
        <SaveAsMediaDialog
          initialName={suggestEditedTitle(media.title ?? media.name.replace(/\.[A-Za-z0-9]{1,8}$/, ''))}
          busy={busy === 'saving-as'}
          error={error}
          onCancel={() => { if (busy !== 'saving-as') setSavingAsOpen(false) }}
          onSubmit={name => {
            void store.saveAs(name).then(outcome => {
              if (!outcome.ok) return
              setSavingAsOpen(false)
              onMediaCreated(outcome.mediaId)
            })
          }}
        />
      )}
    </div>
  )
}
