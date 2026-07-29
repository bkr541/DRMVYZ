import React, { useMemo, useSyncExternalStore } from 'react'
import { LaserDmxEnginePanel } from './LaserDmxEnginePanel'
import { CanvasEnginePanel } from './ReactCanvasEngineShell'
import { PixGridEnginePanel } from './pixGrid/PixGridEnginePanel'
import { useShallow } from 'zustand/react/shallow'
import { resolveCinematicConfigForPreset, useReactStore } from '../../../stores/reactStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useLyricPlaybackSelector } from '../../../features/lyrics/runtime/useLyricPlayback'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { SliderRow, SelectRow, ToggleRow, TextInputRow, CtrlSection, Collapsible } from './ReactControlRows'
import { getSvgVisualCacheVersion, getSvgVisualEntry, subscribeSvgVisualCache } from './renderers/svgVisualCache'
import { buildUnifiedSvgStatus, isUnifiedSvgMediaItem, resolveUnifiedSvgSource } from './svgSourceLifecycle'
import {
  SOUND_DRAWING_PERFORMANCE_SHOWS,
} from './soundDrawing/SoundDrawingPerformanceShows'
import { shouldShowLivingRibbonControls } from './soundDrawing/SoundDrawingControlVisibility'
import { resolveSoundDrawingOwnership } from './soundDrawing/SoundDrawingOwnership'
import { SoundDrawingProScopeControls } from './soundDrawing/SoundDrawingProScopeControls'
import { SOUND_DRAWING_VISUAL_SIZE_MAX, SOUND_DRAWING_VISUAL_SIZE_MIN } from './soundDrawing/SoundDrawingVisualSize'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from './soundDrawing/SoundDrawingPerformanceTypes'
import type {
  SoundDrawingGeneratorPreference,
  SoundDrawingPerformanceLockKey,
  SoundDrawingPerformanceSourceSelection,
  SoundDrawingSourceTreatment,
  SoundDrawingSourceUsePolicy,
} from './soundDrawing/SoundDrawingPerformanceTypes'
import { SharedPerformanceDiagnosticsPanel } from './SharedPerformanceDiagnosticsPanel'
import { CINEMATIC_WORLD_UI, type CinematicWorldUiDefinition } from './CinematicWorldsUi'
import type { CinematicWorldMode } from './CinematicWorldConfig'
import { resolvePresetCardNavigationIndex } from './ReactPresetCard'
import type {
  SvgRenderMode,
  ClassicScopeMode,
  BuiltinOscillatorShape,
  OscillatorGlyphAsset,
  OscillatorFontAsset,
  OscillatorSettings,
  OscillatorGlyphPoint,
  SoundDrawingTextSource,
  SoundDrawingLyricGapBehavior,
  ReactPreset,
} from './ReactTypes'

// ── Sound Drawing source chooser ──────────────────────────────────────────────

type SoundDrawingSourceChoice = 'classic' | 'builtinShape' | 'text' | 'svg'

const SOUND_DRAWING_SOURCE_OPTIONS: Array<{
  value: SoundDrawingSourceChoice
  label: string
}> = [
  { value: 'classic', label: 'Classic Scope' },
  { value: 'builtinShape', label: 'Built-in Shape' },
  { value: 'text', label: 'Text' },
  { value: 'svg', label: 'SVG' },
]

function SoundDrawingSourceIcon({ source }: { source: SoundDrawingSourceChoice }) {
  if (source === 'classic') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M3 16h4l3-8 5 16 4-12 3 8h7" />
      </svg>
    )
  }

  if (source === 'builtinShape') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="m16 3 11 7v12l-11 7L5 22V10Z" />
        <circle cx="16" cy="16" r="4" />
      </svg>
    )
  }

  if (source === 'text') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 7h18M16 7v18M11 25h10" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8 3h11l6 6v20H8Z" />
      <path d="M19 3v7h6M11 22c3-8 7 3 11-7" />
    </svg>
  )
}

function SoundDrawingSourceGrid({
  value,
  onChange,
  disabled = false,
  description,
}: {
  value: SoundDrawingSourceChoice
  onChange: (value: SoundDrawingSourceChoice) => void
  disabled?: boolean
  description?: string
}) {
  return (
    <div>
      <div
        className="rv-sound-source-grid"
        role="radiogroup"
        aria-label="Sound Drawing source"
        aria-describedby={description ? 'sound-drawing-source-ownership' : undefined}
      >
        {SOUND_DRAWING_SOURCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? 'rv-sound-source-card is-active' : 'rv-sound-source-card'}
            onClick={() => onChange(option.value)}
            disabled={disabled}
          >
            <span className="rv-sound-source-card-icon">
              <SoundDrawingSourceIcon source={option.value} />
            </span>
            <span className="rv-sound-source-card-label">{option.label}</span>
          </button>
        ))}
      </div>
      {description && <span id="sound-drawing-source-ownership" className="rv-ctrl-description">{description}</span>}
    </div>
  )
}

const CINEMATIC_WORLD_CATEGORY_ORDER = ['Cosmic', 'Architectural', 'Organic', 'Mechanical', 'Storm', 'Legacy'] as const

function CinematicWorldIcon({ mode }: { mode: CinematicWorldMode }) {
  if (mode === 'eventHorizon') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="5" />
        <ellipse cx="16" cy="16" rx="13" ry="7" transform="rotate(-18 16 16)" />
      </svg>
    )
  }
  if (mode === 'mirrorDimension') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 5h8v22H7zM17 5h8v22h-8zM15 9l2 2M15 16l2 2M15 23l2 2" />
      </svg>
    )
  }
  if (mode === 'reactiveConstellation') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="7" cy="21" r="2" />
        <circle cx="15" cy="8" r="2" />
        <circle cx="25" cy="18" r="2" />
        <circle cx="19" cy="26" r="2" />
        <path d="m8 19 6-9m3-1 7 8m-1 3-3 4M9 22l8 3" />
      </svg>
    )
  }
  if (mode === 'infiniteCorridor') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 5h24v22H4zM9 9h14v14H9zM13 13h6v6h-6z" />
      </svg>
    )
  }
  if (mode === 'fractureRift') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="m18 3-6 10 5 2-7 14 13-16-6-2z" />
      </svg>
    )
  }
  if (mode === 'ancientMachine') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="9" />
        <circle cx="16" cy="16" r="3" />
        <path d="M16 3v4M16 25v4M3 16h4M25 16h4M7 7l3 3M22 22l3 3M25 7l-3 3M10 22l-3 3" />
      </svg>
    )
  }
  if (mode === 'stormGateway') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 12c3-7 19-7 22 0M4 18c4 6 20 6 24 0M11 15h10M18 8l-5 9h5l-4 8" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="11" />
      <path d="M8 16h16M16 8v16" />
    </svg>
  )
}

function handleCinematicWorldKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
  const grid = event.currentTarget.closest<HTMLElement>('[data-cinematic-world-grid]')
  if (!grid) return
  const options = Array.from(grid.querySelectorAll<HTMLButtonElement>('[data-cinematic-world-option]'))
  const currentIndex = options.indexOf(event.currentTarget)
  const nextIndex = resolvePresetCardNavigationIndex(currentIndex, event.key, options.length, 2)
  if (nextIndex == null || nextIndex === currentIndex) return
  event.preventDefault()
  options[nextIndex]?.focus()
  options[nextIndex]?.click()
}

function CinematicWorldSourceGrid({
  groups,
  activeWorldMode,
  activePresetId,
  onSelect,
}: {
  groups: Array<{ world: CinematicWorldUiDefinition; presets: ReactPreset[] }>
  activeWorldMode: CinematicWorldMode | null
  activePresetId: string | null
  onSelect: (presetId: string) => void
}) {
  const hasActiveWorld = groups.some((group) => group.world.id === activeWorldMode)
  const orderedGroups = CINEMATIC_WORLD_CATEGORY_ORDER.flatMap(category =>
    groups.filter(group => group.world.category === category),
  )

  return (
    <div
      className="rv-sound-source-grid rv-cinematic-world-source-grid"
      role="radiogroup"
      aria-label="Cinematic worlds"
      data-cinematic-world-grid
      data-grid-columns="2"
    >
      {orderedGroups.map((group, optionIndex) => {
        const isActive = group.world.id === activeWorldMode
        const activePresetInWorld = group.presets.find((preset) => preset.id === activePresetId)
        const targetPreset = activePresetInWorld ?? group.presets[0]
        return (
          <button
            id={`cinematic-world-group-${group.world.id}`}
            key={group.world.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive || (!hasActiveWorld && optionIndex === 0) ? 0 : -1}
            aria-label={`${group.world.label}, ${group.world.category} category, ${group.presets.length} presets`}
            className={`rv-sound-source-card rv-cinematic-world-source-card${isActive ? ' is-active' : ''}`}
            title={group.world.description}
            data-cinematic-world-option
            data-cinematic-world-category={group.world.category}
            onKeyDown={handleCinematicWorldKeyDown}
            onClick={() => {
              if (targetPreset && !isActive) onSelect(targetPreset.id)
            }}
          >
            <span className="rv-cinematic-world-source-category-badge">{group.world.category}</span>
            <span className="rv-sound-source-card-icon">
              <CinematicWorldIcon mode={group.world.id} />
            </span>
            <span className="rv-sound-source-card-label">{group.world.label}</span>
            <span className="rv-cinematic-world-source-count">
              {group.presets.length} preset
              {group.presets.length === 1 ? '' : 's'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function OscillatorSourceDiagnostics({
  osc,
  glyphAssets,
  fontAssets,
  glyphCache,
  allMediaItems,
}: {
  osc: OscillatorSettings
  glyphAssets: OscillatorGlyphAsset[]
  fontAssets: OscillatorFontAsset[]
  glyphCache: Record<string, OscillatorGlyphPoint[]>
  allMediaItems: UploadedMedia[]
}) {
  useSyncExternalStore(subscribeSvgVisualCache, getSvgVisualCacheVersion, getSvgVisualCacheVersion)

  const svgSource = resolveUnifiedSvgSource(osc)
  const svgEntry = svgSource?.mediaId ? getSvgVisualEntry(svgSource.mediaId) : null
  const svgStatus = buildUnifiedSvgStatus(osc, glyphAssets, glyphCache, allMediaItems, svgEntry)
  const selectedGlyph =
    osc.sourceType === 'svgGlyph' && !svgStatus && osc.selectedGlyphId
      ? glyphAssets.find((asset) => asset.id === osc.selectedGlyphId)
      : undefined
  const selectedFont = osc.textFontId ? fontAssets.find((font) => font.id === osc.textFontId) : undefined

  const hasSvgDiagnostics = Boolean(
    svgStatus?.loading ||
    (svgStatus && !svgStatus.mediaId) ||
    svgStatus?.error ||
    (osc.sourceType === 'svgGlyph' && !svgStatus && !selectedGlyph),
  )
  const hasTextDiagnostics = Boolean(
    osc.sourceType === 'text' && (!osc.text.trim() || selectedFont?.parseError),
  )

  if (!hasSvgDiagnostics && !hasTextDiagnostics) return null

  return (
    <div className="rv-osc-source-diagnostics" role="status" aria-live="polite">
      {svgStatus?.loading && <div className="rv-ctrl-info">Loading SVG caches…</div>}
      {svgStatus && !svgStatus.mediaId && (
        <div className="rv-osc-status-warn">No SVG selected — choose one below</div>
      )}
      {svgStatus?.error && <div className="rv-osc-status-warn">Load error: {svgStatus.error}</div>}
      {osc.sourceType === 'svgGlyph' && !svgStatus && !selectedGlyph && (
        <div className="rv-osc-status-warn">No SVG glyph selected</div>
      )}
      {osc.sourceType === 'text' && !osc.text.trim() && (
        <div className="rv-osc-status-warn">Text is empty</div>
      )}
      {osc.sourceType === 'text' && selectedFont?.parseError && (
        <div className="rv-osc-status-warn">{selectedFont.parseError}</div>
      )}
    </div>
  )
}

// ── Contextual engine workspace ──────────────────────────────────────────────────────────────

export function ReactEnginePanel() {
  const engine = useSharedAudio()
  const {
    activeReactEngineId,
    reactPresets,
    activeReactPresetId,
    reactTrailDecay,
    cinematicConfigsByPresetId,
    selectReactPreset,
    oscillatorSettings,
    setOscillatorSettings,
    soundDrawingPerformanceSettings,
    setSoundDrawingPerformanceSettings,
    setSoundDrawingPerformanceLock,
    resetSoundDrawingPerformanceSettings,
    requestSoundDrawingRibbonReset,
    oscillatorGlyphAssets,
    oscillatorGlyphPointCache,
    selectSvgAsset,
    oscillatorFontAssets,
    fontUploadPending,
    fontRemovePending,
    selectOscillatorFont,
    fontSelectPending,
    glyphLostNotice,
    clearGlyphLostNotice,
  } = useReactStore(
    useShallow((s) => ({
    activeReactEngineId:        s.activeReactEngineId,
    reactPresets:               s.reactPresets,
    activeReactPresetId:        s.activeReactPresetId,
    reactTrailDecay:            s.reactTrailDecay,
    cinematicConfigsByPresetId: s.cinematicConfigsByPresetId,
    selectReactPreset:          s.selectReactPreset,
    oscillatorSettings:         s.oscillatorSettings,
    setOscillatorSettings:      s.setOscillatorSettings,
    soundDrawingPerformanceSettings: s.soundDrawingPerformanceSettings,
    setSoundDrawingPerformanceSettings: s.setSoundDrawingPerformanceSettings,
    setSoundDrawingPerformanceLock: s.setSoundDrawingPerformanceLock,
    resetSoundDrawingPerformanceSettings: s.resetSoundDrawingPerformanceSettings,
      requestSoundDrawingRibbonReset: s.requestSoundDrawingRibbonReset,
    oscillatorGlyphAssets:      s.oscillatorGlyphAssets,
    oscillatorGlyphPointCache:  s.oscillatorGlyphPointCache,
    selectSvgAsset:             s.selectSvgAsset,
    oscillatorFontAssets:       s.oscillatorFontAssets,
    fontUploadPending:          s.fontUploadPending,
    fontRemovePending:          s.fontRemovePending,
    selectOscillatorFont:       s.selectOscillatorFont,
    fontSelectPending:          s.fontSelectPending,
    glyphLostNotice:            s.glyphLostNotice,
    clearGlyphLostNotice:       s.clearGlyphLostNotice,
    })),
  )

  const osc = oscillatorSettings
  const set = setOscillatorSettings
  const showLivingRibbonControls = shouldShowLivingRibbonControls(soundDrawingPerformanceSettings)
  const selectedSoundDrawingShow = SOUND_DRAWING_PERFORMANCE_SHOWS.find(
    (show) => show.id === soundDrawingPerformanceSettings.selectedShowId,
  )
  const soundDrawingOwnership = resolveSoundDrawingOwnership(soundDrawingPerformanceSettings)
  const authoredScopeOwnsControls = soundDrawingOwnership.manualScopeControlsDisabled
  const ribbon = soundDrawingPerformanceSettings.livingRibbon
  const setRibbon = (patch: Partial<typeof ribbon>) => setSoundDrawingPerformanceSettings({ livingRibbon: patch })
  const cinematicWorldGroups = useMemo(
    () =>
      CINEMATIC_WORLD_UI.map((world) => ({
      world,
        presets: reactPresets.filter(
          (preset) =>
            preset.engine === 'cinematicPortal' && (preset.cinematicConfig?.worldMode ?? 'legacyPortal') === world.id,
        ),
      })).filter((group) => group.presets.length > 0),
    [reactPresets],
  )
  const activeCinematicPreset = useMemo(
    () =>
      reactPresets.find((preset) => preset.id === activeReactPresetId && preset.engine === 'cinematicPortal') ?? null,
    [activeReactPresetId, reactPresets],
  )
  const activeCinematicWorldMode = activeCinematicPreset
    ? (resolveCinematicConfigForPreset(activeCinematicPreset, cinematicConfigsByPresetId)?.worldMode ?? null)
    : null
  const activeLyricCue = useLyricPlaybackSelector((state) => state.activeCue)
  const activeLyricWord = useLyricPlaybackSelector((state) => state.activeWord)
  const activeLyricDocumentId = useLyricPlaybackSelector((state) => state.documentId)
  const activeLyricSourceIdentity = useLyricPlaybackSelector((state) => state.sourceIdentity)
  const lyricsBelongToLoadedTrack = Boolean(
    engine.currentAudioTrackId &&
    activeLyricSourceIdentity?.startsWith(`${engine.currentAudioTrackId}:`) &&
    activeLyricDocumentId,
  )

  // SVG Visual rehydration is handled by useSvgVisualRehydration in ReactView —
  // that hook always runs regardless of which panel tab is active.

  const allMediaItems = useMediaStore((state) => state.items)
  const svgMediaItems = allMediaItems.filter(isUnifiedSvgMediaItem)
  const activeSvgSource = resolveUnifiedSvgSource(osc)
  const selectedSvgMediaId = activeSvgSource?.mediaId ?? null

  return (
    <div className="rv-ctrl-group">
      {/* Cinematic Worlds source selection lives in the left rail. */}
      {activeReactEngineId === 'cinematicPortal' && (
        <>
          <CtrlSection label="Worlds" />
          <CinematicWorldSourceGrid
            groups={cinematicWorldGroups}
            activeWorldMode={activeCinematicWorldMode}
            activePresetId={activeReactPresetId}
            onSelect={selectReactPreset}
          />
        </>
      )}

      {/* ── Engine Mode: GLSL Shader ──────────────────────────────────── */}
      {activeReactEngineId === 'shaderPads' && (
        <Collapsible label="Shader Scenes" defaultOpen>
          <div className="rv-ctrl-info rv-control-helper-copy">
            Shader uses Scenes rather than React presets. Choose and manage the active scene from the SCENES tab in the
            right rail.
          </div>
        </Collapsible>
      )}

      {/* ── Engine Mode: CANVAS ──────────────────────────────────────── */}
      {activeReactEngineId === 'canvas' && <CanvasEnginePanel />}

      {/* ── Engine Mode: PixGrid ──────────────────────────────────────── */}
      {activeReactEngineId === 'pixGrid' && <PixGridEnginePanel />}

      {/* ── Engine Mode: LaserDMX ─────────────────────────────────────── */}
      {activeReactEngineId === 'laserDmx' && <LaserDmxEnginePanel />}

      {/* ── Engine Mode: Oscilloscope ──────────────────────────────────── */}
      {activeReactEngineId === 'oscilloscope' && (
        <>
          <CtrlSection label="Authored Performance" />
          <SelectRow
            label="Performance Show"
            value={soundDrawingPerformanceSettings.selectedShowId}
            onChange={(value) =>
              setSoundDrawingPerformanceSettings({
                selectedShowId: value as typeof soundDrawingPerformanceSettings.selectedShowId,
              })
            }
            options={SOUND_DRAWING_PERFORMANCE_SHOWS.map((show) => ({
              value: show.id,
              label: show.name,
            }))}
          />
          <ToggleRow
            label="Auto Performance"
            value={soundDrawingPerformanceSettings.autoPerformance}
            onChange={(value) => setSoundDrawingPerformanceSettings({ autoPerformance: value })}
          />
          <div
            className="rv-ctrl-info rv-control-helper-copy"
            role="status"
            aria-live="polite"
            id="sound-drawing-performance-ownership"
          >
            {soundDrawingOwnership.status}
          </div>
          {soundDrawingPerformanceSettings.autoPerformance && (
            <>
              <CtrlSection label="Source Integration" />
              <SelectRow
                label="Performance Source"
                value={soundDrawingPerformanceSettings.performanceSource}
                onChange={(value) =>
                  setSoundDrawingPerformanceSettings({
                    performanceSource: value as SoundDrawingPerformanceSourceSelection,
                  })
                }
                options={[
                  { value: 'generatedVisual', label: 'Generated Visual' },
                  { value: 'activeText', label: 'Active Text' },
                  { value: 'activeSvg', label: 'Active SVG' },
                  { value: 'activeUserSource', label: 'Active User Source' },
                ]}
              />
              <SelectRow
                label="Source Treatment"
                value={soundDrawingPerformanceSettings.sourceTreatment}
                onChange={(value) =>
                  setSoundDrawingPerformanceSettings({
                    sourceTreatment: value as SoundDrawingSourceTreatment,
                  })
                }
                options={[
                  { value: 'preserveIdentity', label: 'Preserve Identity' },
                  { value: 'controlledReactive', label: 'Controlled Reactive' },
                  { value: 'liquidContour', label: 'Liquid Contour' },
                  {
                    value: 'abstractDeformation',
                    label: 'Abstract Deformation',
                  },
                ]}
              />
              <SelectRow
                label="Use Source As"
                value={soundDrawingPerformanceSettings.useSourceAs}
                onChange={(value) =>
                  setSoundDrawingPerformanceSettings({
                    useSourceAs: value as SoundDrawingSourceUsePolicy,
                  })
                }
                options={[
                  { value: 'primaryMotif', label: 'Primary Motif' },
                  { value: 'supportingLayer', label: 'Supporting Layer' },
                  { value: 'both', label: 'Both' },
                ]}
              />
              <ToggleRow
                label={osc.sourceType === 'text' ? 'Preserve Readability' : 'Preserve Identity'}
                value={soundDrawingPerformanceSettings.preserveIdentity}
                onChange={(value) =>
                  setSoundDrawingPerformanceSettings({
                    preserveIdentity: value,
                  })
                }
              />
              {soundDrawingPerformanceSettings.sourceTreatment !== 'preserveIdentity' && (
                <SliderRow
                  label="Contour Reactivity"
                  value={soundDrawingPerformanceSettings.contourReactivity}
                  onChange={(value) =>
                    setSoundDrawingPerformanceSettings({
                      contourReactivity: value,
                    })
                  }
                  min={0}
                  max={1}
                  step={0.01}
                  color="#b84fc9"
                />
              )}
              <SliderRow
                label="Whole-Object Motion"
                value={soundDrawingPerformanceSettings.wholeObjectMotion}
                onChange={(value) =>
                  setSoundDrawingPerformanceSettings({
                    wholeObjectMotion: value,
                  })
                }
                min={0}
                max={1}
                step={0.01}
                color="#4ac7db"
              />
              <SliderRow
                label="Echo Strength"
                value={soundDrawingPerformanceSettings.echoStrength}
                onChange={(value) => setSoundDrawingPerformanceSettings({ echoStrength: value })}
                min={0}
                max={1}
                step={0.01}
                color="#9ddcff"
              />
              <SliderRow
                label="Source Trail Strength"
                value={soundDrawingPerformanceSettings.sourceTrailStrength}
                onChange={(value) =>
                  setSoundDrawingPerformanceSettings({
                    sourceTrailStrength: value,
                  })
                }
                min={0}
                max={1}
                step={0.01}
                color="#9ddcff"
              />
              <SliderRow
                label="Supporting Visual Reactivity"
                value={soundDrawingPerformanceSettings.supportingVisualReactivity}
                onChange={(value) =>
                  setSoundDrawingPerformanceSettings({
                    supportingVisualReactivity: value,
                  })
                }
                min={0}
                max={1}
                step={0.01}
                color="#61d6aa"
              />
              <ToggleRow
                label="Source Lock"
                value={soundDrawingPerformanceSettings.locks.sourceSelection}
                onChange={(value) => setSoundDrawingPerformanceLock('sourceSelection', value)}
              />
              <button
                type="button"
                className="rv-reset-btn"
                onClick={() =>
                  setSoundDrawingPerformanceSettings({
                  sourceTreatment: DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.sourceTreatment,
                  useSourceAs: DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.useSourceAs,
                  preserveIdentity: DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.preserveIdentity,
                  contourReactivity: DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.contourReactivity,
                  wholeObjectMotion: DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.wholeObjectMotion,
                  echoStrength: DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.echoStrength,
                  sourceTrailStrength: DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.sourceTrailStrength,
                  supportingVisualReactivity: DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.supportingVisualReactivity,
                  })
                }
              >
                Reset Source Treatment
              </button>
              <CtrlSection label="Show Choreography" />
              <SliderRow
                label="Complexity"
                value={soundDrawingPerformanceSettings.complexity}
                onChange={(value) => setSoundDrawingPerformanceSettings({ complexity: value })}
                min={0}
                max={1}
                step={0.01}
                color="#61d6aa"
              />
              <SliderRow
                label="Motion Intensity"
                value={soundDrawingPerformanceSettings.motionIntensity}
                onChange={(value) => setSoundDrawingPerformanceSettings({ motionIntensity: value })}
                min={0}
                max={1}
                step={0.01}
                color="#4ac7db"
              />
              <SliderRow
                label="Reaction Intensity"
                value={soundDrawingPerformanceSettings.reactionIntensity}
                onChange={(value) =>
                  setSoundDrawingPerformanceSettings({
                    reactionIntensity: value,
                  })
                }
                min={0}
                max={1}
                step={0.01}
                color="#ff4fd8"
              />
              <SliderRow
                label="Trail Intensity"
                value={soundDrawingPerformanceSettings.trailIntensity}
                onChange={(value) => setSoundDrawingPerformanceSettings({ trailIntensity: value })}
                min={0}
                max={1}
                step={0.01}
                color="#9ddcff"
              />
              <SelectRow
                label="Generator Preference"
                value={soundDrawingPerformanceSettings.generatorPreference}
                onChange={(value) =>
                  setSoundDrawingPerformanceSettings({
                    generatorPreference: value as SoundDrawingGeneratorPreference,
                  })
                }
                options={[
                  { value: 'authored', label: 'Authored by Show' },
                  {
                    value: 'horizontalOscilloscope',
                    label: 'Horizontal Oscilloscope',
                  },
                  {
                    value: 'mirroredOscilloscope',
                    label: 'Mirrored Oscilloscope',
                  },
                  { value: 'radialOscilloscope', label: 'Radial Oscilloscope' },
                  { value: 'polarWaveform', label: 'Polar Waveform' },
                  { value: 'lissajousFigure', label: 'Lissajous Figure' },
                  { value: 'phaseScopeKnot', label: 'Phase-Scope Knot' },
                  { value: 'harmonicRibbon', label: 'Harmonic Ribbon' },
                  { value: 'livingRibbon', label: 'Living Ribbon' },
                  { value: 'spectralContour', label: 'Spectral Contour' },
                  {
                    value: 'circularBassMembrane',
                    label: 'Circular Bass Membrane',
                  },
                  { value: 'kaleidoscopicTrace', label: 'Kaleidoscopic Trace' },
                  { value: 'particleSpline', label: 'Particle Spline' },
                  {
                    value: 'vectorFieldStreamlines',
                    label: 'Vector-Field Streamlines',
                  },
                  {
                    value: 'audioReactiveAttractor',
                    label: 'Audio-Reactive Attractor',
                  },
                  { value: 'tunnelTrace', label: 'Tunnel Trace' },
                  {
                    value: 'stackedWaveformBands',
                    label: 'Stacked Waveform Bands',
                  },
                  { value: 'professionalScope', label: 'Professional Scope' },
                ]}
              />
              {showLivingRibbonControls && (
                <>
                  <Collapsible label="Living Ribbon Controls" defaultOpen>
                    <SelectRow
                      label="Ribbon Quality"
                      value={ribbon.quality}
                      onChange={(value) => setRibbon({ quality: value as typeof ribbon.quality })}
                      options={[
                        { value: 'auto', label: 'Auto' },
                        { value: 'low', label: 'Low' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'high', label: 'High' },
                ]}
              />
                    <SliderRow
                      label="Point Density"
                      value={ribbon.pointDensity}
                      onChange={(value) => setRibbon({ pointDensity: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#4ac7db"
                    />
                    <SliderRow
                      label="Tension"
                      value={ribbon.tension}
                      onChange={(value) => setRibbon({ tension: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#61d6aa"
                    />
                    <SliderRow
                      label="Turbulence"
                      value={ribbon.turbulence}
                      onChange={(value) => setRibbon({ turbulence: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#ff4fd8"
                    />
                    <SliderRow
                      label="Body Width"
                      value={ribbon.bodyWidth}
                      onChange={(value) => setRibbon({ bodyWidth: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#4ac7db"
                    />
                    <SliderRow
                      label="Trail Persistence"
                      value={ribbon.trailPersistence}
                      onChange={(value) => setRibbon({ trailPersistence: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#9ddcff"
                    />
                    <SliderRow
                      label="Bloom"
                      value={ribbon.bloom}
                      onChange={(value) => setRibbon({ bloom: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#b84fc9"
                    />
                    <SliderRow
                      label="Spark Amount"
                      value={ribbon.sparkAmount}
                      onChange={(value) => setRibbon({ sparkAmount: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#ffd166"
                    />
                    <SliderRow
                      label="Center Attraction"
                      value={ribbon.centerAttraction}
                      onChange={(value) => setRibbon({ centerAttraction: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#61d6aa"
                    />
                    <SliderRow
                      label="Audio Reaction Depth"
                      value={ribbon.audioReactionDepth}
                      onChange={(value) => setRibbon({ audioReactionDepth: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#ff4fd8"
                    />
                    <button type="button" className="rv-reset-btn" onClick={requestSoundDrawingRibbonReset}>
                      Reset Ribbon Simulation
                    </button>
                  </Collapsible>
                </>
              )}
              <Collapsible label="Parameter Locks" defaultOpen={false}>
                {(
                  [
                  ['generator', 'Generator'],
                  ['layerRecruitment', 'Layer Recruitment'],
                  ['topology', 'Topology & Symmetry'],
                  ['trail', soundDrawingPerformanceSettings.trailLockContract.mode === 'legacyRecipe'
                    ? 'Legacy Performance Trail Recipe'
                    : 'Protect Manual Trail State'],
                  ['feedback', 'Feedback'],
                  ['transform', 'Transform'],
                  ['camera', 'Camera'],
                  ['color', 'Color Role'],
                  ['reaction', 'Audio Reactions'],
                  ['sourceTreatment', 'Source Treatment'],
                  ['preserveIdentity', 'Identity Protection'],
                  ['wholeObjectMotion', 'Whole-Object Motion'],
                  ['contourReactivity', 'Contour Reactivity'],
                  ['rotation', 'Rotation'],
                  ['scale', 'Scale'],
                  ['glow', 'Glow'],
                  ['echoBehavior', 'Echo Behavior'],
                  ['trailBehavior', 'Source Trail Behavior'],
                    ['ribbonStructure', 'Ribbon Structure & Quality'],
                    ['ribbonMovement', 'Ribbon Movement'],
                    ['ribbonWidth', 'Ribbon Width'],
                    ['ribbonTrail', 'Ribbon Trails'],
                    ['ribbonGlow', 'Ribbon Glow'],
                    ['ribbonReaction', 'Ribbon Audio Reaction'],
                  ] as Array<[SoundDrawingPerformanceLockKey, string]>
                ).map(([key, label]) => (
                  <ToggleRow
                    key={key}
                    label={label}
                    value={soundDrawingPerformanceSettings.locks[key]}
                    onChange={(value) => setSoundDrawingPerformanceLock(key, value)}
                    description={key === 'trail'
                      ? soundDrawingPerformanceSettings.trailLockContract.mode === 'legacyRecipe'
                        ? 'Compatibility mode for historical shows. Protects the old authored recipe, not the visible manual Trail Decay.'
                        : 'Snapshots Trail Decay, Auto Section mode, and Ribbon Trail Persistence. Final Trail Decay is protected; Ribbon Trails remain separately lockable.'
                      : undefined}
                  />
                ))}
                {soundDrawingPerformanceSettings.trailLockContract.mode === 'legacyRecipe' && (
                  <button
                    type="button"
                    className="rv-reset-btn"
                    onClick={() => setSoundDrawingPerformanceSettings({
                      trailLockContract: {
                        version: 2,
                        mode: 'manualResolved',
                        snapshot: {
                          trailDecay: reactTrailDecay,
                          autoSectionMode: osc.autoSectionMode,
                          ribbonTrailPersistence: ribbon.trailPersistence,
                        },
                      },
                    })}
                  >
                    Use Corrected Manual Trail Protection
                  </button>
                )}
              </Collapsible>
              <SharedPerformanceDiagnosticsPanel engine="soundDrawing" />
              <button type="button" className="rv-reset-btn" onClick={resetSoundDrawingPerformanceSettings}>
                Reset to Authored State
              </button>
            </>
          )}
          {!soundDrawingPerformanceSettings.autoPerformance && (
            <div className="rv-ctrl-info rv-control-helper-copy">
              Manual Sound Drawing sources, presets, timeline layers, and clips remain authoritative while Auto
              Performance is off.
            </div>
          )}

          <CtrlSection label="Engine Mode" />

          {glyphLostNotice && (
            <div className="rv-glyph-lost-notice">
              <span>
                <strong>"{glyphLostNotice}"</strong> was removed from your library. Select a new source below.
              </span>
              <button
                type="button"
                className="rv-glyph-lost-dismiss"
                onClick={clearGlyphLostNotice}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          <OscillatorSourceDiagnostics
            osc={osc}
            glyphAssets={oscillatorGlyphAssets}
            fontAssets={oscillatorFontAssets}
            glyphCache={oscillatorGlyphPointCache}
            allMediaItems={allMediaItems}
          />

          <SoundDrawingSourceGrid
            value={osc.sourceType === 'svgGlyph' || osc.sourceType === 'svgVisual' ? 'svg' : osc.sourceType}
            onChange={(sourceType) => set({ sourceType })}
            disabled={!soundDrawingOwnership.domains.source.editable}
            description={soundDrawingOwnership.domains.source.ariaDescription}
          />

          {osc.sourceType === 'classic' &&
            !osc.autoSectionMode &&
            osc.classicMode === 'professionalScope' &&
            authoredScopeOwnsControls && (
              <SliderRow
                label="Trace Size"
                value={osc.pathScale}
                onChange={value => set({ pathScale: value })}
                min={SOUND_DRAWING_VISUAL_SIZE_MIN}
                max={SOUND_DRAWING_VISUAL_SIZE_MAX}
                step={0.01}
                description={soundDrawingOwnership.domains.geometry.ariaDescription}
              />
            )}

          <fieldset
            disabled={!soundDrawingOwnership.domains.source.editable}
            aria-describedby="sound-drawing-source-ownership"
            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
          >
            {/* Classic Scope mode */}
            {osc.sourceType === 'classic' && (
              <>
              <ToggleRow
                label="Auto Section Mode"
                value={osc.autoSectionMode}
                onChange={(v) => set({ autoSectionMode: v })}
              />
              {!osc.autoSectionMode && (
                <SelectRow
                  label="Classic Mode"
                  value={osc.classicMode === 'sectionAuto' ? 'waveform' : osc.classicMode}
                  onChange={(v) => set({ classicMode: v as ClassicScopeMode })}
                  options={[
                    { value: 'waveform',          label: 'Waveform' },
                    // Named for what it does: this mode plots the signal against
                    // a delayed copy of itself, which is a phase portrait, not a
                    // stereo measurement. True stereo lives under Pro Scope.
                    { value: 'monoDelayXY',       label: 'Mono Delay Portrait' },
                    { value: 'radialScope',       label: 'Radial Scope' },
                    { value: 'spiralScope',       label: 'Spiral Scope' },
                    { value: 'professionalScope', label: 'Pro Scope' },
                  ]}
                />
              )}
              {!osc.autoSectionMode && osc.classicMode === 'professionalScope' && (
                <>
                  <fieldset
                    disabled={authoredScopeOwnsControls}
                    aria-describedby="sound-drawing-performance-ownership"
                    style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
                  >
                    {authoredScopeOwnsControls && (
                      <div className="rv-ctrl-info rv-control-helper-copy">
                        {soundDrawingOwnership.professionalScopeOwner === 'authored'
                          ? `Signal, trigger, phosphor, and CRT controls are owned by ${selectedSoundDrawingShow?.name ?? 'the active show'}. Trace Size remains a live mixed input.`
                          : `Pro Scope signal controls are inactive because ${selectedSoundDrawingShow?.name ?? 'the active show'} has no scope layer. Trace Size still controls the authored base geometry.`}
                      </div>
                    )}
                    <SoundDrawingProScopeControls osc={osc} set={set} hideTraceSize={authoredScopeOwnsControls} />
                  </fieldset>
                </>
              )}
              </>
            )}

            {/* Built-in shape picker */}
            {osc.sourceType === 'builtinShape' && (
            <SelectRow
              label="Shape"
              value={osc.builtinShape}
              onChange={(v) => set({ builtinShape: v as BuiltinOscillatorShape })}
              options={[
                { value: 'circle',   label: 'Circle' },
                { value: 'square',   label: 'Square' },
                { value: 'triangle', label: 'Triangle' },
                { value: 'star',     label: 'Star' },
                { value: 'hexagon',  label: 'Hexagon' },
                { value: 'infinity', label: 'Infinity' },
                { value: 'spiral',   label: 'Spiral' },
                { value: 'line',     label: 'Line' },
              ]}
            />
            )}

            {/* Text source */}
            {osc.sourceType === 'text' && (
            <>
              <SelectRow
                label="Text Source"
                value={osc.textSource ?? 'static'}
                onChange={(value) => set({ textSource: value as SoundDrawingTextSource })}
                options={[
                  { value: 'static', label: 'Static Text' },
                  { value: 'activeLyricLine', label: 'Active Lyric Line' },
                  { value: 'activeLyricWord', label: 'Active Lyric Word' },
                ]}
              />
              {(osc.textSource ?? 'static') === 'static' ? (
                <TextInputRow
                  label="Static Text"
                  value={osc.text}
                  onChange={(v) => set({ text: v })}
                  maxLength={128}
                  placeholder="DRMVYZ"
                />
              ) : (
                <>
                  <div className="rv-ctrl-info rv-lyric-source-status" role="status" aria-live="polite">
                    {lyricsBelongToLoadedTrack ? (
                      <>
                        <strong>Active lyrics linked</strong>
                        <span>{activeLyricSourceIdentity ?? activeLyricDocumentId}</span>
                        <span>Line: {activeLyricCue?.text ?? 'No lyric at the current playhead'}</span>
                        {osc.textSource === 'activeLyricWord' && (
                          <span>
                            Word:{' '}
                            {activeLyricWord?.text ?? (activeLyricCue ? 'Line fallback or timed-word gap' : 'None')}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <strong>No active lyric document</strong>
                        <span>
                          Load a persisted track with an active lyric version, or create one in Lyric Manager.
                        </span>
                      </>
                    )}
                  </div>
                  <SelectRow
                    label="When No Lyric Is Active"
                    value={osc.lyricGapBehavior ?? 'hide'}
                    onChange={(value) =>
                      set({
                        lyricGapBehavior: value as SoundDrawingLyricGapBehavior,
                      })
                    }
                    options={[
                      { value: 'hide', label: 'Hide Text' },
                      { value: 'keepPrevious', label: 'Keep Previous Lyric' },
                      { value: 'fallback', label: 'Show Fallback Text' },
                    ]}
                  />
                  {osc.lyricGapBehavior === 'fallback' && (
                    <TextInputRow
                      label="Fallback Text"
                      value={osc.lyricFallbackText ?? ''}
                      onChange={(value) => set({ lyricFallbackText: value })}
                      maxLength={128}
                      placeholder="Instrumental"
                    />
                  )}
                </>
              )}
              <ToggleRow label="Auto Rotate" value={osc.autoRotate === true} onChange={(v) => set({ autoRotate: v })} />
              {oscillatorFontAssets.length > 0 && (
                <SelectRow
                  label="Font"
                  value={osc.textFontId ?? ''}
                  onChange={(v) => selectOscillatorFont(v || null)}
                  disabled={fontUploadPending || !!fontSelectPending || !!fontRemovePending}
                  options={[
                    { value: '', label: '— canvas fallback —' },
                    ...oscillatorFontAssets.map((f: OscillatorFontAsset) => ({
                      value: f.id,
                      label: f.name,
                    })),
                  ]}
                />
              )}
              {osc.sourceType === 'text' && (
                <SliderRow
                  label="Font Size"
                  value={osc.textFontSize}
                  onChange={(v) => set({ textFontSize: Math.round(v) })}
                  min={48}
                  max={320}
                  step={8}
                  color="#61d6aa"
                />
              )}
              <SliderRow
                label="Spacing"
                value={osc.textLetterSpacing}
                onChange={(v) => set({ textLetterSpacing: Math.round(v) })}
                min={-20}
                max={80}
                step={1}
                color="#d8b95a"
              />
            </>
            )}

            {/* Unified SVG picker (source type 'svg', or legacy svgGlyph/svgVisual) */}
            {(osc.sourceType === 'svg' || osc.sourceType === 'svgGlyph' || osc.sourceType === 'svgVisual') &&
            (svgMediaItems.length === 0 ? (
              <div className="rv-ctrl-info">No SVG files yet — import from the Media tab.</div>
            ) : (
              <>
                <SelectRow
                  label="SVG File"
                  value={selectedSvgMediaId ?? ''}
                  onChange={(v) => {
                    if (v) selectSvgAsset(v)
                  }}
                  options={[
                    ...(selectedSvgMediaId ? [] : [{ value: '', label: '— select SVG —' }]),
                    ...svgMediaItems.map((m) => ({
                      value: m.id,
                      label: m.title ?? m.name,
                    })),
                  ]}
                />
                <SelectRow
                  label="Render As"
                  value={osc.svgRenderMode ?? 'auto'}
                  onChange={(v) => set({ svgRenderMode: v as SvgRenderMode })}
                  options={[
                    { value: 'auto',            label: 'Auto (Recommended)' },
                    { value: 'reactivePath',    label: 'Reactive Path' },
                    { value: 'originalArtwork', label: 'Original Artwork' },
                  ]}
                />
                <ToggleRow
                  label="React Palette"
                  value={osc.svgUseReactPalette !== false}
                  onChange={(v) => set({ svgUseReactPalette: v })}
                />
                <ToggleRow
                  label="Auto Rotate"
                  value={osc.autoRotate !== false}
                  onChange={(v) => set({ autoRotate: v })}
                />
                {(osc.svgRenderMode === 'auto' || osc.svgRenderMode === 'reactivePath') && (
                  <div className="rv-ctrl-info rv-control-helper-copy" style={{ marginTop: 2 }}>
                    Reactive Path deforms the SVG outline with audio. Original Artwork renders it at full fidelity with
                    whole-object reactions.
                  </div>
                )}
              </>
              ))}

            {/* ── Source: path resolution (non-classic; hide for pure originalArtwork modes) ── */}
            {osc.sourceType !== 'classic' && activeSvgSource?.renderMode !== 'originalArtwork' && (
            <>
              <CtrlSection label="Source" />
              <SliderRow
                label="Resolution"
                value={osc.pathResolution}
                onChange={(v) => set({ pathResolution: Math.round(v) })}
                min={64}
                max={2048}
                step={64}
                color="#4ac7db"
              />
            </>
              )}
          </fieldset>
        </>
      )}
    </div>
  )
}
