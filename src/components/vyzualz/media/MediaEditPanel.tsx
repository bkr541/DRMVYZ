import { AppIcon } from '../../shared/icons/AppIcon'

import { Collapsible, SliderRow, ToggleRow } from '../react/ReactControlRows'
import { IconChipButton } from '../react/controls/IconChipButton'
import { DrawerNotice } from '../shared/DrawerNotice'
import {
  MEDIA_EDIT_RANGES,
  formatDegrees,
  formatPercent,
  formatSignedPercent,
  mediaEditsEqual,
  createDefaultMediaEdit,
  type MediaEditSliderKey,
} from '../../../features/media/edit/mediaEditModel'
import { mediaEditUnsupportedReason } from '../../../features/media/edit/mediaEditRender'
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

/** The Edit tab for one image or video. All state lives in useMediaEditStore. */
export function MediaEditPanel({ media }: { media: UploadedMedia }) {
  const session = useMediaEditStore(state => state.mediaId === media.id ? state : null)
  const dirty = useMediaEditStore(selectMediaEditDirty)
  const busy = useMediaEditStore(state => state.busy)
  const progress = useMediaEditStore(state => state.progress)
  const error = useMediaEditStore(state => state.error)

  const unsupported = mediaEditUnsupportedReason(media)
  if (unsupported) {
    return (
      <div className="mmi-body">
        <DrawerNotice tone="warning" role="status" title="Editing unavailable">{unsupported}</DrawerNotice>
      </div>
    )
  }
  if (!session) return <div className="mmi-body" aria-busy="true" />

  const { edit, backgroundRemoval, cropMode, cutoutMode, cutoutTool, cutoutAction, cutoutTolerance, cutoutContiguous } = session
  const store = useMediaEditStore.getState()
  const working = busy !== 'idle'
  // Select & Remove shows the image before colour and transform edits, so those wait until it is applied or cancelled.
  const disabled = working || cutoutMode
  // Rotate / flip / mirror change the frame the crop rectangle is drawn on, so they wait for Apply or Cancel.
  const transformDisabled = working || cropMode || cutoutMode
  const backgroundLabel = busy === 'removing-background' ? 'Removing background…' : backgroundRemoval ? 'Restore Background' : 'Remove Background'
  const cropIsFull = mediaEditsEqual({ ...createDefaultMediaEdit(), crop: edit.crop }, createDefaultMediaEdit())

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
    : progress.stage === 'background-removal'
      ? 'Removing image background locally…'
      : progress.stage === 'uploading'
      ? 'Uploading edited media…'
      : progress.fraction !== null
        ? `Rendering video… ${Math.round(progress.fraction * 100)}%`
        : 'Rendering…'

  return (
    <div className="mmi-body">
      <Collapsible label="Transform" defaultOpen>
        <div className="mmi-edit-transform-toolbar" role="group" aria-label="Transform actions">
          <IconChipButton
            tone={cropMode ? 'primary' : 'default'}
            icon={<AppIcon kind="crop" size={16} />}
            disabled={disabled}
            title={cropMode ? 'Exit crop mode' : 'Crop'}
            aria-label="Crop"
            aria-pressed={cropMode}
            onClick={() => store.setCropMode(!cropMode)}
          />
          {!cropIsFull && !cropMode && (
            <IconChipButton
              icon={<AppIcon kind="undo" size={16} />}
              disabled={disabled}
              title="Reset crop to the full frame"
              aria-label="Reset crop to the full frame"
              onClick={() => store.resetCrop()}
            />
          )}
          <IconChipButton
            icon={<AppIcon kind="rotateLeft" size={16} />}
            disabled={transformDisabled}
            onClick={() => store.rotate(-1)}
            title="Rotate left 90°"
            aria-label="Rotate left 90 degrees"
          />
          <IconChipButton
            icon={<AppIcon kind="rotateRight" size={16} />}
            disabled={transformDisabled}
            onClick={() => store.rotate(1)}
            title="Rotate right 90°"
            aria-label="Rotate right 90 degrees"
          />
          <IconChipButton
            id="mmi-edit-flip"
            tone={edit.flip ? 'primary' : 'default'}
            icon={<AppIcon kind="flipVertical" size={16} />}
            title="Flip (top to bottom)"
            aria-label="Flip"
            aria-pressed={edit.flip}
            disabled={transformDisabled}
            onClick={() => store.toggleFlip()}
          />
          <IconChipButton
            id="mmi-edit-mirror"
            tone={edit.mirror ? 'primary' : 'default'}
            icon={<AppIcon kind="flipHorizontal" size={16} />}
            title="Mirror (left to right)"
            aria-label="Mirror"
            aria-pressed={edit.mirror}
            disabled={transformDisabled}
            onClick={() => store.toggleMirror()}
          />
          {media.type === 'image' && (
            <IconChipButton
              icon={<AppIcon kind={busy === 'removing-background' ? 'loading' : backgroundRemoval ? 'image' : 'wand'} size={16} className={busy === 'removing-background' ? 'app-icon--spinning' : undefined} />}
              disabled={transformDisabled}
              tone={backgroundRemoval ? 'primary' : 'default'}
              title={backgroundLabel}
              aria-label={backgroundLabel}
              onClick={() => {
                if (backgroundRemoval) store.restoreBackground()
                else void store.removeBackground()
              }}
            />
          )}
          {media.type === 'image' && (
            <IconChipButton
              icon={<AppIcon kind="scissors" size={16} />}
              disabled={working || cropMode}
              tone={cutoutMode ? 'primary' : 'default'}
              title={cutoutMode ? 'Close Select & Remove' : 'Select & Remove: click or outline areas to remove'}
              aria-label="Select and Remove"
              aria-pressed={cutoutMode}
              onClick={() => store.setCutoutMode(!cutoutMode)}
            />
          )}
        </div>
      </Collapsible>

      {cutoutMode && (
        <Collapsible label="Select & Remove" defaultOpen>
          <div className="mmi-cutout-choice" role="radiogroup" aria-label="Tool">
            <IconChipButton role="radio" aria-checked={cutoutTool === 'wand'} tone={cutoutTool === 'wand' ? 'primary' : 'default'} icon={<AppIcon kind="wand" size={14} />} title="Magic Wand (W): click an area of similar colour" onClick={() => store.setCutoutTool('wand')}>Magic Wand</IconChipButton>
            <IconChipButton role="radio" aria-checked={cutoutTool === 'lasso'} tone={cutoutTool === 'lasso' ? 'primary' : 'default'} icon={<AppIcon kind="paintBrush" size={14} />} title="Lasso (L): draw around an area" onClick={() => store.setCutoutTool('lasso')}>Lasso</IconChipButton>
          </div>
          <div className="mmi-cutout-choice" role="radiogroup" aria-label="Action">
            <IconChipButton role="radio" aria-checked={cutoutAction === 'remove'} tone={cutoutAction === 'remove' ? 'primary' : 'default'} title="Make the selected area transparent" onClick={() => store.setCutoutAction('remove')}>Remove</IconChipButton>
            <IconChipButton role="radio" aria-checked={cutoutAction === 'restore'} tone={cutoutAction === 'restore' ? 'primary' : 'default'} title="Bring back the original pixels in the selected area" onClick={() => store.setCutoutAction('restore')}>Restore</IconChipButton>
          </div>
          {cutoutTool === 'wand' && (
            <>
              <SliderRow
                id="mmi-cutout-tolerance"
                label="Tolerance"
                value={cutoutTolerance}
                min={0}
                max={100}
                step={1}
                resetValue={12}
                formatValue={value => `${Math.round(value)}%`}
                description="How different a colour can be from the one you click and still be selected."
                onChange={value => store.setCutoutTolerance(value)}
              />
              <ToggleRow
                id="mmi-cutout-contiguous"
                label="Connected Area Only"
                value={cutoutContiguous}
                description="Off selects that colour everywhere in the image."
                onChange={value => store.setCutoutContiguous(value)}
              />
            </>
          )}
          <p className="mmi-cutout-help">Hold Alt to switch Remove and Restore. Scroll or pinch to zoom, hold Space and drag to pan.</p>
        </Collapsible>
      )}

      <Collapsible label="Color" defaultOpen>
        {COLOR_SLIDERS.map(renderSlider)}
      </Collapsible>

      <Collapsible label="Detail" defaultOpen>
        {DETAIL_SLIDERS.map(renderSlider)}
      </Collapsible>


      {error && <DrawerNotice tone="error" role="alert" title="Edit failed">{error}</DrawerNotice>}
      {progressLabel && <div className="mmi-edit-progress" role="status" aria-live="polite">{progressLabel}</div>}

    </div>
  )
}
