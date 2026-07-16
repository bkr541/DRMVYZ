import { useEffect, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { CtrlSection, SelectRow, SliderRow, TextInputRow, ToggleRow } from '../ReactControlRows'
import type { PixGridBackgroundMode, PixGridQualityTier } from './PixGridTypes'

const QUALITY_OPTIONS = [
  { value: 'draft', label: 'Draft · 64 × 36' },
  { value: 'low', label: 'Low · 96 × 54' },
  { value: 'high', label: 'High · 160 × 90' },
  { value: 'ultra', label: 'Ultra · 256 × 144' },
]

const BACKGROUND_OPTIONS = [
  { value: 'preset', label: 'Preset Background' },
  { value: 'black', label: 'Pure Black' },
  { value: 'custom', label: 'Custom Color' },
]

export function PixGridControls() {
  const state = useReactStore(store => store.pixGridState)
  const setState = useReactStore(store => store.setPixGridState)
  const setOverlay = useReactStore(store => store.setPixGridAuthoringOverlayVisible)
  const [backgroundDraft, setBackgroundDraft] = useState(state.backgroundColor)

  useEffect(() => setBackgroundDraft(state.backgroundColor), [state.backgroundColor])

  const commitBackgroundColor = (value: string) => {
    if (/^#[0-9a-f]{6}$/i.test(value)) setState({ backgroundColor: value })
    else setBackgroundDraft(state.backgroundColor)
  }

  return (
    <div className="rv-pix-grid-controls">
      <CtrlSection label="MATRIX" />
      <SelectRow
        label="Quality"
        value={state.quality}
        options={QUALITY_OPTIONS}
        onChange={value => setState({ quality: value as PixGridQualityTier })}
      />
      <SliderRow label="Global Brightness" value={state.globalIntensity} onChange={value => setState({ globalIntensity: value })} />
      <SliderRow label="Cell Gap" value={state.cellGap} max={0.45} onChange={value => setState({ cellGap: value })} />
      <SliderRow label="Cell Roundness" value={state.cellRoundness} max={0.5} onChange={value => setState({ cellRoundness: value })} />
      <SliderRow label="Glow" value={state.glowAmount} onChange={value => setState({ glowAmount: value })} />

      <CtrlSection label="BACKGROUND" />
      <SelectRow
        label="Mode"
        value={state.backgroundMode}
        options={BACKGROUND_OPTIONS}
        onChange={value => setState({ backgroundMode: value as PixGridBackgroundMode })}
      />
      {state.backgroundMode === 'custom' && (
        <TextInputRow
          label="Color"
          value={backgroundDraft}
          maxLength={7}
          placeholder="#030608"
          onChange={setBackgroundDraft}
          onBlur={commitBackgroundColor}
        />
      )}

      <CtrlSection label="AUTHORING" />
      <ToggleRow
        label="Edit PixGrid"
        value={state.authoringOverlayVisible}
        onChange={setOverlay}
        description="Toggles the authoring state. The full overlay editor arrives in Patch 5."
      />
    </div>
  )
}
