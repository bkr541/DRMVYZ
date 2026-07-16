import { useEffect, useState } from 'react'
import { useReactStore } from '../../../../stores/reactStore'
import { useSharedAudio } from '../../../../context/AudioEngineContext'
import { useMediaStore } from '../../../../stores/mediaStore'
import { CtrlSection, SelectRow, SliderRow, TextInputRow, ToggleRow } from '../ReactControlRows'
import { DEFAULT_PIX_GRID_CONVERSION_SETTINGS } from './PixGridDefaults'
import { SharedPerformanceDiagnosticsPanel } from '../SharedPerformanceDiagnosticsPanel'
import { PIX_GRID_PERFORMANCE_PROGRAMS, PIX_GRID_PRESET_ID_BY_PROGRAM } from './PixGridPerformancePrograms'
import { usePixGridPerformanceRuntimeStatus } from './PixGridPerformanceStatus'
import { usePixGridCueRuntimeStatus } from './PixGridCueStatus'
import { nextPixGridCueOrder, normalizePixGridActionCue, snapPixGridCueTime } from './PixGridActionCues'
import type {
  PixGridBackgroundHandling,
  PixGridBackgroundMode,
  PixGridColorMode,
  PixGridDitherMode,
  PixGridFitMode,
  PixGridPerformanceProgramId,
  PixGridQualityTier,
  PixGridSamplingMode,
} from './PixGridTypes'

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

const PERFORMANCE_PROGRAM_OPTIONS = PIX_GRID_PERFORMANCE_PROGRAMS.map(program => ({
  value: program.id,
  label: program.metadata?.name ?? program.id,
}))

const PREP_BACKGROUND_OPTIONS = [
  { value: 'transparent', label: 'Preserve Transparency' },
  { value: 'solid', label: 'Composite on Solid' },
  { value: 'remove-dark', label: 'Remove Near-Black' },
]

export function PixGridControls() {
  const engine = useSharedAudio()
  const state = useReactStore(store => store.pixGridState)
  const setState = useReactStore(store => store.setPixGridState)
  const pixGridActionCuesByTrackId = useReactStore(store => store.pixGridActionCuesByTrackId)
  const addPixGridActionCue = useReactStore(store => store.addPixGridActionCue)
  const selectReactPreset = useReactStore(store => store.selectReactPreset)
  const setOverlay = useReactStore(store => store.setPixGridAuthoringOverlayVisible)
  const performanceStatus = usePixGridPerformanceRuntimeStatus()
  const cueStatus = usePixGridCueRuntimeStatus()
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

  const clearManualOverride = () => {
    setState({
      performance: { ...state.performance, lockedRoutes: [] },
      layers: state.layers.map(layer => layer.locked ? { ...layer, locked: false } : layer),
    })
    const trackId = engine.currentTrackId
    if (!trackId || cueStatus.manualOverrideRoutes.length === 0) return
    const authoredTime = Math.max(0, engine.getCurrentTime())
    const timeSec = snapPixGridCueTime(authoredTime, 'beat', engine.currentEffectiveBeatGrid)
    const cues = pixGridActionCuesByTrackId[trackId] ?? []
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `pixgrid-clear-override-${Date.now()}`
    const cue = normalizePixGridActionCue({
      version: 1,
      id,
      timeSec,
      label: 'Clear Manual Override',
      enabled: true,
      engineId: 'pixGrid',
      action: { type: 'clearManualOverride' },
      quantization: 'beat',
      transition: 'cut',
      transitionDurationSec: 0,
      oneShotDurationSec: 0.25,
      loopBehavior: 'retrigger',
      order: nextPixGridCueOrder(cues, timeSec),
      provenance: { kind: 'manual' },
      color: '#4ac7db',
    }, cues.length)
    if (cue) addPixGridActionCue(trackId, cue)
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
        onChange={enabled => setState({ performance: { ...state.performance, enabled } })}
        description="Runs the selected PixGrid program through the engine-neutral Shared Performance Core."
      />
      <SliderRow
        label="Performance Intensity"
        value={state.performance.intensity}
        onChange={intensity => setState({ performance: { ...state.performance, intensity } })}
      />
      <SelectRow
        label="Program"
        value={state.performance.sharedPerformanceProgramId ?? PERFORMANCE_PROGRAM_OPTIONS[0]?.value ?? ''}
        options={PERFORMANCE_PROGRAM_OPTIONS}
        onChange={value => {
          const programId = value as PixGridPerformanceProgramId
          const presetId = PIX_GRID_PRESET_ID_BY_PROGRAM[programId]
          if (presetId) selectReactPreset(presetId)
          else setState({ performance: { ...state.performance, sharedPerformanceProgramId: programId } })
        }}
      />
      <div className="rv-ctrl-info" data-testid="pix-grid-performance-status">
        <strong>{performanceStatus.sceneId ?? 'Awaiting playback'}</strong>
        <span>{performanceStatus.section} · {performanceStatus.sectionPhase} · variation {performanceStatus.variationId ?? 'base'}</span>
        <span>4 / 8 / 16 stage: {performanceStatus.fourBarStage} / {performanceStatus.eightBarStage} / {performanceStatus.sixteenBarStage}</span>
        <span>Override: {[...new Set([...performanceStatus.manualOverrideRoutes, ...cueStatus.manualOverrideRoutes])].length ? `${[...new Set([...performanceStatus.manualOverrideRoutes, ...cueStatus.manualOverrideRoutes])].length} locked route${[...new Set([...performanceStatus.manualOverrideRoutes, ...cueStatus.manualOverrideRoutes])].length === 1 ? '' : 's'}` : 'Auto'}</span>
        <span>Cue: {cueStatus.mostRecentCueLabel ?? 'None'}{cueStatus.activeOneShotCueIds.length ? ` · ${cueStatus.activeOneShotCueIds.length} active` : ''}</span>
        <span>Transition: {cueStatus.transition ? `${cueStatus.transition.type} · ${Math.round(cueStatus.transition.progress * 100)}%` : 'Idle'}</span>
      </div>
      {(performanceStatus.manualOverrideRoutes.length > 0 || cueStatus.manualOverrideRoutes.length > 0) && (
        <div className="rv-ctrl-action-row">
          <button
            type="button"
            className="rv-reset-btn"
            onClick={clearManualOverride}
          >
            Clear Override
          </button>
        </div>
      )}
      <SharedPerformanceDiagnosticsPanel engine="pixGrid" label="PixGrid Diagnostics" />

      <CtrlSection label="LED MATRIX" />
      <SelectRow
        label="Quality"
        value={state.quality}
        options={QUALITY_OPTIONS}
        onChange={value => setState({ quality: value as PixGridQualityTier })}
      />
      <SliderRow label="Cell Gap" value={state.cellGap} max={0.45} onChange={value => setState({ cellGap: value })} />
      <SliderRow label="Cell Roundness" value={state.cellRoundness} max={0.5} onChange={value => setState({ cellRoundness: value })} />
      <SliderRow label="Cell Brightness" value={state.cellBrightness} onChange={value => setState({ cellBrightness: value })} />
      <SliderRow label="Glow" value={state.glowAmount} onChange={value => setState({ glowAmount: value })} />
      <SliderRow label="Diffusion" value={state.diffusion} onChange={value => setState({ diffusion: value })} />
      <ToggleRow
        label="RGB Subpixel Mode"
        value={state.rgbSubpixelMode}
        onChange={value => setState({ rgbSubpixelMode: value })}
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
        <button type="button" className="rv-reset-btn" onClick={resetConversion}>Reset Conversion</button>
        {state.conversion.selectedMediaId && (
          <button type="button" className="rv-reset-btn" onClick={() => updateConversion({ selectedMediaId: null })}>Clear Media</button>
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
      <SliderRow
        label="Global PixGrid Intensity"
        value={state.globalIntensity}
        onChange={value => setState({ globalIntensity: value })}
      />

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
