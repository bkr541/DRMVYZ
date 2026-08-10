import { useEffect, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { useMediaStore } from '../../../../stores/mediaStore'
import { CtrlSection, SelectRow, SliderRow, TextInputRow, ToggleRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'
import { DEFAULT_PIX_GRID_CONVERSION_SETTINGS } from './PixGridDefaults'
import { PIX_GRID_PERFORMANCE_PROGRAMS } from './PixGridPerformancePrograms'
import { usePixGridReactivityRuntimeStatus } from './PixGridReactivityStatus'
import { PIX_GRID_QUALITY_OPTIONS } from './PixGridControlContract'
import { PixGridHistoryGesture } from './PixGridHistoryGesture'
import { requestPixGridWorkspace } from './PixGridWorkspaceNavigation'
import type {
  PixGridBackgroundHandling,
  PixGridBackgroundMode,
  PixGridColorMode,
  PixGridDitherMode,
  PixGridFitMode,
  PixGridPerformanceProgramId,
  PixGridSamplingMode,
} from './PixGridTypes'

const BACKGROUND_OPTIONS = [
  { value: 'preset', label: 'Preset Background' },
  { value: 'black', label: 'Pure Black' },
  { value: 'custom', label: 'Custom Color' },
]

const FIT_OPTIONS = [
  { value: 'contain', label: 'Contain' },
  { value: 'cover', label: 'Cover / Crop' },
  { value: 'stretch', label: 'Stretch' },
]

const SAMPLING_OPTIONS = [
  { value: 'crisp', label: 'Crisp Pixel Prep' },
  { value: 'smooth', label: 'Smooth Downsample' },
]

const COLOR_MODE_OPTIONS = [
  { value: 'original', label: 'Original Colors' },
  { value: 'hybrid', label: 'Hybrid · Original + Brand' },
  { value: 'brand', label: 'Brand Palette' },
  { value: 'preset', label: 'Custom / Preset Palette' },
]

const DITHER_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'ordered-bayer', label: 'Ordered Bayer' },
  { value: 'atkinson', label: 'Atkinson Error Diffusion' },
]

const PERFORMANCE_PROGRAM_OPTIONS = [
  { value: '', label: 'Choose preset to load…', disabled: true },
  ...PIX_GRID_PERFORMANCE_PROGRAMS.filter(program => program.id !== 'pix-grid-media-deck-performance').map(program => ({
    value: program.id,
    label: program.metadata?.name ?? program.id,
  })),
]

const PREP_BACKGROUND_OPTIONS = [
  { value: 'transparent', label: 'Preserve Transparency' },
  { value: 'solid', label: 'Composite on Solid' },
  { value: 'remove-dark', label: 'Remove Near-Black' },
]

export function PixGridControls() {
  const state = useReactStore(store => store.pixGridState)
  const setState = useReactStore(store => store.setPixGridState)
  const setRequestedQuality = useReactStore(store => store.setPixGridRequestedQuality)
  const setQualityMode = useReactStore(store => store.setPixGridQualityMode)
  const setPresentation = useReactStore(store => store.setPixGridPresentation)
  const setPerformance = useReactStore(store => store.setPixGridPerformance)
  const loadProgramPreset = useReactStore(store => store.loadPixGridProgramPreset)
  const clearManualOverride = useReactStore(store => store.clearPixGridManualOverride)
  const setOverlay = useReactStore(store => store.setPixGridAuthoringOverlayVisible)
  const reactivityStatus = usePixGridReactivityRuntimeStatus()
  const runtimeStatus = reactivityStatus.runtime
  const selectedMedia = useMediaStore(store => state.conversion.selectedMediaId
    ? store.items.find(item => item.id === state.conversion.selectedMediaId) ?? null
    : null)
  const [backgroundDraft, setBackgroundDraft] = useState(state.backgroundColor)
  const [prepBackgroundDraft, setPrepBackgroundDraft] = useState(state.conversion.backgroundColor)

  useEffect(() => setBackgroundDraft(state.backgroundColor), [state.backgroundColor])
  useEffect(() => setPrepBackgroundDraft(state.conversion.backgroundColor), [state.conversion.backgroundColor])

  const updateConversion = (patch: Partial<typeof state.conversion>) => {
    setState({ conversion: { ...state.conversion, ...patch } })
  }

  const commitBackgroundColor = (value: string) => {
    if (/^#[0-9a-f]{6}$/i.test(value)) setState({ backgroundColor: value })
    else setBackgroundDraft(state.backgroundColor)
  }

  const commitPrepBackgroundColor = (value: string) => {
    if (/^#[0-9a-f]{6}$/i.test(value)) updateConversion({ backgroundColor: value })
    else setPrepBackgroundDraft(state.conversion.backgroundColor)
  }
  const resetConversion = () => updateConversion({
    ...DEFAULT_PIX_GRID_CONVERSION_SETTINGS,
    selectedMediaId: state.conversion.selectedMediaId,
  })

  return (
    <div className="rv-pix-grid-controls">
      <CtrlSection label="PERFORMANCE" />
      <ToggleRow
        label="Auto Performance"
        value={state.performance.enabled}
        onChange={enabled => setPerformance({ enabled })}
        description="Runs the selected PixGrid program through the engine-neutral Shared Performance Core."
      />
      <PixGridHistoryGesture><SliderRow
        label="Performance Intensity"
        value={state.performance.intensity}
        onChange={intensity => setPerformance({ intensity })}
      /></PixGridHistoryGesture>
      <SelectRow
        label="Load Program Preset"
        value=""
        options={PERFORMANCE_PROGRAM_OPTIONS}
        onChange={value => {
          if (value) loadProgramPreset(value as PixGridPerformanceProgramId)
        }}
        description="Loads the complete matching PixGrid preset, including artwork, presentation, and performance configuration."
      />
      <div className="rv-ctrl-info" data-testid="pix-grid-performance-status" role="status" aria-label="PixGrid live performance summary">
        <strong>{runtimeStatus?.activeProgramName ?? 'Awaiting playback'}</strong>
        <span>Owner: {runtimeStatus?.activeCueActions.length ? 'Track Map cue' : runtimeStatus?.manualOverrides.length ? 'Manual override' : 'Performance program'}</span>
        <span>Section: {runtimeStatus?.sectionName || 'Unknown'} · {runtimeStatus?.sectionPhase ?? 'none'}</span>
        <span>{runtimeStatus?.programBindingWarnings.length ? runtimeStatus.programBindingWarnings[0] : runtimeStatus?.manualOverrides.length ? 'Override active' : 'No live warnings'}</span>
      </div>
      <div className="rv-ctrl-action-row">
        {(state.performance.lockedRoutes.length > 0 || state.layers.some(layer => layer.locked)) && (
          <IconChipButton onClick={clearManualOverride}>Clear Override</IconChipButton>
        )}
        <IconChipButton onClick={() => requestPixGridWorkspace('analysis')} aria-label="Open full PixGrid diagnostics">Open Full Diagnostics</IconChipButton>
      </div>

      <CtrlSection label="LED MATRIX" />
      <ToggleRow
        label="Adaptive Quality"
        value={state.qualityMode === 'adaptive'}
        onChange={enabled => setQualityMode(enabled ? 'adaptive' : 'fixed')}
        description="Protects live frame rate by reducing secondary LED effects first and then lowering the effective runtime matrix."
      />
      <SelectRow
        label={state.qualityMode === 'adaptive' ? 'Starting Quality' : 'Fixed Quality'}
        value={state.quality}
        options={PIX_GRID_QUALITY_OPTIONS}
        onChange={value => setRequestedQuality(value as typeof state.quality)}
      />
      <div className="rv-ctrl-info" role="status" aria-label="PixGrid requested and effective quality">
        <span>Requested: {state.quality} · Effective: {reactivityStatus.renderer?.effectiveQuality ?? state.quality}</span>
        <span>Resolution: {reactivityStatus.renderer?.logicalWidth ?? state.matrixWidth} × {reactivityStatus.renderer?.logicalHeight ?? state.matrixHeight} · {reactivityStatus.renderer?.path ?? 'renderer pending'}</span>
        {reactivityStatus.renderer?.qualityPromotionReason && <span>{reactivityStatus.renderer.qualityPromotionReason}</span>}
        {reactivityStatus.renderer?.adaptiveReason && <span>Adaptive status: {reactivityStatus.renderer.adaptiveReason}</span>}
      </div>
      <PixGridHistoryGesture><SliderRow label="Cell Gap" value={state.cellGap} max={0.45} onChange={value => setPresentation({ cellGap: value })} /></PixGridHistoryGesture>
      <PixGridHistoryGesture><SliderRow label="Cell Roundness" value={state.cellRoundness} max={0.5} onChange={value => setPresentation({ cellRoundness: value })} /></PixGridHistoryGesture>
      <PixGridHistoryGesture><SliderRow label="Glow" value={state.glowAmount} onChange={value => setPresentation({ glowAmount: value })} description="Controls emitter halo strength." /></PixGridHistoryGesture>
      <PixGridHistoryGesture><SliderRow label="Diffusion" value={state.diffusion} onChange={value => setPresentation({ diffusion: value })} description="Softens emitter edges without changing halo radius." /></PixGridHistoryGesture>
      <ToggleRow
        label="RGB Subpixel Mode"
        value={state.rgbSubpixelMode}
        onChange={value => setPresentation({ rgbSubpixelMode: value })}
        description="Previews red, green, and blue emitter stripes inside each logical LED cell."
      />

      <CtrlSection label="USER ARTWORK" />
      <div className="rv-ctrl-info rv-pix-grid-selected-media">
        <strong>{selectedMedia?.title ?? selectedMedia?.name ?? (state.conversion.selectedMediaId ? 'Missing media item' : 'No media selected')}</strong>
        <span>{state.conversion.selectedMediaId ? 'Use the MEDIA tab to replace the source.' : 'Choose a compatible still image or SVG from the MEDIA tab.'}</span>
      </div>
      <SelectRow
        label="Fit"
        value={state.conversion.fitMode}
        options={FIT_OPTIONS}
        onChange={value => updateConversion({ fitMode: value as PixGridFitMode })}
      />
      <SliderRow label="Position X" value={state.conversion.positionX} onChange={value => updateConversion({ positionX: value })} />
      <SliderRow label="Position Y" value={state.conversion.positionY} onChange={value => updateConversion({ positionY: value })} />
      <SliderRow label="Scale" value={state.conversion.scale} min={0.1} max={4} step={0.01} onChange={value => updateConversion({ scale: value })} />
      <SelectRow
        label="Pixel Preparation"
        value={state.conversion.sampling}
        options={SAMPLING_OPTIONS}
        onChange={value => updateConversion({ sampling: value as PixGridSamplingMode })}
      />
      <SelectRow
        label="Color Mode"
        value={state.conversion.colorMode}
        options={COLOR_MODE_OPTIONS}
        onChange={value => updateConversion({ colorMode: value as PixGridColorMode })}
      />
      <SliderRow label="Palette Size" value={state.conversion.paletteSize} min={2} max={64} step={1} onChange={value => updateConversion({ paletteSize: Math.round(value) })} />
      <SelectRow
        label="Dither"
        value={state.conversion.ditherMode}
        options={DITHER_OPTIONS}
        onChange={value => updateConversion({ ditherMode: value as PixGridDitherMode })}
      />
      <SliderRow label="Alpha Threshold" value={state.conversion.alphaThreshold} onChange={value => updateConversion({ alphaThreshold: value })} />
      <ToggleRow label="Preserve Alpha" value={state.conversion.preserveAlpha} onChange={value => updateConversion({ preserveAlpha: value })} />
      <SliderRow label="Contrast" value={state.conversion.contrast} min={0.25} max={2} step={0.01} onChange={value => updateConversion({ contrast: value })} />
      <SliderRow label="Brightness" value={state.conversion.brightness} min={0.25} max={2} step={0.01} onChange={value => updateConversion({ brightness: value })} />
      <SliderRow label="Saturation" value={state.conversion.saturation} max={2} step={0.01} onChange={value => updateConversion({ saturation: value })} />
      <SliderRow label="Edge Enhancement" value={state.conversion.edgeEnhancement} onChange={value => updateConversion({ edgeEnhancement: value })} />
      <SelectRow
        label="Artwork Background"
        value={state.conversion.backgroundHandling}
        options={PREP_BACKGROUND_OPTIONS}
        onChange={value => updateConversion({ backgroundHandling: value as PixGridBackgroundHandling })}
      />
      {state.conversion.backgroundHandling === 'solid' && (
        <TextInputRow
          label="Artwork Background Color"
          value={prepBackgroundDraft}
          maxLength={7}
          placeholder="#000000"
          onChange={setPrepBackgroundDraft}
          onBlur={commitPrepBackgroundColor}
        />
      )}
      {state.conversion.colorMode !== 'original' && (
        <SliderRow label="Brand Strength" value={state.conversion.brandStrength} onChange={value => updateConversion({ brandStrength: value })} />
      )}
      <ToggleRow label="Preserve Black" value={state.conversion.preserveBlack} onChange={value => updateConversion({ preserveBlack: value })} />
      <ToggleRow label="Preserve White" value={state.conversion.preserveWhite} onChange={value => updateConversion({ preserveWhite: value })} />
      <div className="rv-ctrl-action-row">
        <IconChipButton onClick={resetConversion}>Reset Conversion</IconChipButton>
        {state.conversion.selectedMediaId && (
          <IconChipButton onClick={() => updateConversion({ selectedMediaId: null })}>Clear Media</IconChipButton>
        )}
      </div>

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
      <SliderRow
        label="Background Brightness"
        value={state.backgroundBrightness}
        onChange={value => setState({ backgroundBrightness: value })}
      />

      <CtrlSection label="OUTPUT" />
      <PixGridHistoryGesture><SliderRow
        label="Output Intensity"
        value={state.globalIntensity}
        onChange={value => setPresentation({ globalIntensity: value })}
        description="Primary PixGrid output brightness before advanced cell calibration and authored performance trim."
      /></PixGridHistoryGesture>

      <CtrlSection label="AUTHORING" />
      <ToggleRow
        label="Edit PixGrid"
        value={state.authoringOverlayVisible}
        onChange={setOverlay}
        description="Opens the interactive PixGrid authoring overlay over the live center output."
      />
    </div>
  )
}
