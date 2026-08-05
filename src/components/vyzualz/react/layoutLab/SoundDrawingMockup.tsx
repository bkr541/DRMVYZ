import { useMemo, useState } from 'react'
import { RailTabs, type RailTabOption } from '../../layout/RailTabs'
import { SliderRow, SelectRow, ToggleRow, TextInputRow, CtrlSection, Collapsible } from '../ReactControlRows'
import { Dropdown } from '../../../shared/Dropdown/Dropdown'
import { HelpInfoTrigger } from '../../../shared/InfoPopover'
import { resolveUnifiedSvgSource } from '../svgSourceLifecycle'
import { SOUND_DRAWING_PERFORMANCE_SHOWS } from '../soundDrawing/SoundDrawingPerformanceShows'
import { shouldShowLivingRibbonControls } from '../soundDrawing/SoundDrawingControlVisibility'
import { resolveSoundDrawingOwnership } from '../soundDrawing/SoundDrawingOwnership'
import { SOUND_DRAWING_VISUAL_SIZE_MAX, SOUND_DRAWING_VISUAL_SIZE_MIN } from '../soundDrawing/SoundDrawingVisualSize'
import {
  resolveSoundDrawingSectionScopeMode,
  soundDrawingSectionScopeModeLabel,
} from '../soundDrawing/SoundDrawingSectionMode'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from '../soundDrawing/SoundDrawingPerformanceTypes'
import { SoundDrawingProScopeMockup } from './SoundDrawingProScopeMockup'
import { MockEngineDropdown } from './MockEngineDropdown'
import type { SoundDrawingMockState } from './useSoundDrawingMockState'
import {
  type SvgRenderMode,
  type ClassicScopeMode,
  type BuiltinOscillatorShape,
  type SoundDrawingTextSource,
  type SoundDrawingLyricGapBehavior,
  type ReactSectionType,
  type ReactEngineId,
} from '../ReactTypes'

// ── SoundDrawingMockup ─────────────────────────────────────────────────────
//
// A disconnected copy of the Sound Drawing branch of ReactEnginePanel.tsx
// (and its SOURCE / MEDIA / FONTS left-rail tab bar) for Layout Lab. Same
// control components, same labels, same group order, same conditional
// disclosure — driven entirely by local useState instead of useReactStore,
// useSharedAudio, useMediaStore, or the lyric playback store. Font/glyph/SVG
// asset lists are always empty (no media/font library is wired up), so
// those sections render their real "no assets yet" empty states.

type SoundDrawingSourceChoice = 'classic' | 'builtinShape' | 'text' | 'svg'

const SOUND_DRAWING_SOURCE_OPTIONS: Array<{ value: SoundDrawingSourceChoice, label: string }> = [
  { value: 'classic', label: 'Classic Scope' },
  { value: 'builtinShape', label: 'Built-in Shape' },
  { value: 'text', label: 'Text' },
  { value: 'svg', label: 'SVG' },
]

function getSoundDrawingSourceLabel(value: SoundDrawingSourceChoice): string {
  return SOUND_DRAWING_SOURCE_OPTIONS.find(option => option.value === value)?.label ?? 'Classic Scope'
}

function getClassicScopeModeLabel(value: ClassicScopeMode): string {
  if (value === 'monoDelayXY') return 'Mono Delay Portrait'
  if (value === 'radialScope') return 'Radial Scope'
  if (value === 'spiralScope') return 'Spiral Scope'
  if (value === 'professionalScope') return 'Pro Scope'
  return 'Waveform'
}

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
        {SOUND_DRAWING_SOURCE_OPTIONS.map(option => (
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

const LEFT_TABS: RailTabOption<'workspace' | 'media' | 'fonts'>[] = [
  { id: 'workspace', label: 'SOURCE' },
  { id: 'media', label: 'MEDIA' },
  { id: 'fonts', label: 'FONTS' },
]

function SoundDrawingSourceTabPlaceholder({ label, hint }: { label: string, hint: string }) {
  return (
    <div className="rv-ctrl-group">
      <CtrlSection label={label} />
      <div className="rv-ctrl-info rv-control-helper-copy">{hint}</div>
    </div>
  )
}

export function SoundDrawingMockup({
  engineId,
  onSelectEngine,
  state,
}: {
  engineId: ReactEngineId
  onSelectEngine: (id: ReactEngineId) => void
  state: SoundDrawingMockState
}) {
  const [leftTab, setLeftTab] = useState<'workspace' | 'media' | 'fonts'>('workspace')
  const {
    osc,
    set,
    perf,
    setSoundDrawingPerformanceSettings,
    resetSoundDrawingPerformanceSettings,
    requestSoundDrawingRibbonReset,
    glyphLostNotice,
    clearGlyphLostNotice,
    selectOscillatorFont,
    selectSvgAsset,
  } = state

  const showLivingRibbonControls = shouldShowLivingRibbonControls(perf)
  const selectedSoundDrawingShow = SOUND_DRAWING_PERFORMANCE_SHOWS.find(show => show.id === perf.selectedShowId)
  const soundDrawingOwnership = resolveSoundDrawingOwnership(perf)
  const authoredScopeOwnsControls = soundDrawingOwnership.manualScopeControlsDisabled
  const ribbon = perf.livingRibbon
  const setRibbon = (patch: Partial<typeof ribbon>) =>
    setSoundDrawingPerformanceSettings({ livingRibbon: { ...ribbon, ...patch } })

  // No live track, section analysis, or lyric playback in the mockup.
  const currentAnalyzedSection = null as { label: string, type: ReactSectionType } | null
  const followedScopeMode = resolveSoundDrawingSectionScopeMode(currentAnalyzedSection?.type)
  const lyricsBelongToLoadedTrack = false
  const activeLyricSourceIdentity = null as string | null
  const activeLyricDocumentId = null as string | null
  const activeLyricCue = null as { text: string } | null
  const activeLyricWord = null as { text: string } | null

  // No media library or font library wired up — these always resolve empty.
  const oscillatorFontAssets: Array<{ id: string, name: string }> = []
  const svgMediaItems: never[] = []
  const activeSvgSource = useMemo(() => resolveUnifiedSvgSource(osc), [osc])
  const selectedSvgMediaId = activeSvgSource?.mediaId ?? null

  return (
    <div className="rv-left-workspace-shell" data-description-density="compact">
      <section className="rv-context-workspace">
        <header className="rv-context-workspace-header">
          <MockEngineDropdown engineId={engineId} onSelect={onSelectEngine} />
        </header>
        <div className="rv-sound-drawing-workspace-tabs-help drm-help-overlay-anchor">
          <RailTabs
            tabs={LEFT_TABS}
            activeTab={leftTab}
            onChange={setLeftTab}
            ariaLabel="Sound Drawing workspace tabs"
            className="rv-context-workspace-tabs"
          />
          <HelpInfoTrigger
            helpId="react.soundDrawing.workspace.tabs"
            currentValue={LEFT_TABS.find(tab => tab.id === leftTab)?.label ?? 'Source'}
            placement="right"
          />
        </div>
        <div className="rv-left-tab-body">
          <div className="rv-engine-viewport rv-inspector rv-inspector-scroll">
            {leftTab === 'media' && (
              <SoundDrawingSourceTabPlaceholder
                label="Media"
                hint="Media library placeholder — Layout Lab does not load the shared Media Manager."
              />
            )}
            {leftTab === 'fonts' && (
              <SoundDrawingSourceTabPlaceholder
                label="Fonts"
                hint="Font library placeholder — Layout Lab does not load the shared Font Library."
              />
            )}
            {leftTab === 'workspace' && (
              <div className="rv-ctrl-group">
                <CtrlSection label="Authored Performance" />
                <div className="rv-sound-drawing-control-help drm-help-overlay-anchor">
                  <ToggleRow
                    label="Auto Performance"
                    value={perf.autoPerformance}
                    disabled={perf.selectedShowId == null}
                    onChange={value =>
                      setSoundDrawingPerformanceSettings({
                        autoPerformance: value && perf.selectedShowId != null,
                        ...(value
                          ? {
                              performanceSource: 'generatedVisual',
                              generatorPreference: 'authored',
                              locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks },
                            }
                          : {}),
                      })
                    }
                    description={perf.selectedShowId == null
                      ? 'Select a Performance Show preset first. Until then, the base Classic Scope, Built-in Shape, Text, or SVG source remains active.'
                      : 'Adds section-aware choreography to the selected show. Turn it off to keep the same show loaded in its stable base-design state.'}
                  />
                  <HelpInfoTrigger
                    helpId="react.soundDrawing.authoredPerformance.autoPerformance"
                    currentValue={perf.autoPerformance ? 'On' : 'Off'}
                    currentValueLabel="Status"
                    currentValueTone={perf.autoPerformance ? 'accent' : 'default'}
                    placement="right"
                  />
                </div>
                <div className="rv-sound-drawing-control-help drm-help-overlay-anchor">
                  <div className="rv-ctrl-row">
                    <Dropdown
                      id="sound-drawing-performance-show"
                      label="Performance Show"
                      menuLabel="Performance Shows"
                      value={perf.selectedShowId}
                      onChange={value => {
                        setSoundDrawingPerformanceSettings({
                          selectedShowId: value as NonNullable<typeof perf.selectedShowId>,
                          performanceSource: 'generatedVisual',
                          generatorPreference: 'authored',
                          locks: { ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks },
                        })
                      }}
                      options={SOUND_DRAWING_PERFORMANCE_SHOWS.map(show => ({
                        value: show.id,
                        label: show.name,
                        description: show.description,
                      }))}
                      placeholder="Select a Performance Show…"
                      ariaDescribedBy="sound-drawing-performance-show-description"
                      size="compact"
                    />
                    <span id="sound-drawing-performance-show-description" className="rv-ctrl-description">
                      Selecting a Performance Show loads its base visual design without enabling Auto Performance. Auto Performance separately controls section choreography.
                    </span>
                  </div>
                  <HelpInfoTrigger
                    helpId="react.soundDrawing.authoredPerformance.performanceShow"
                    currentValue={selectedSoundDrawingShow?.name ?? 'No show selected'}
                    currentValueTone={selectedSoundDrawingShow ? 'accent' : 'default'}
                    placement="right"
                  />
                </div>
                <div
                  className="rv-ctrl-info rv-control-helper-copy"
                  role="status"
                  aria-live="polite"
                  id="sound-drawing-performance-ownership"
                >
                  {soundDrawingOwnership.status}
                </div>

                {perf.autoPerformance && (
                  <>
                    <CtrlSection label="Show Choreography" />
                    <SliderRow
                      label="Complexity"
                      value={perf.complexity}
                      onChange={value => setSoundDrawingPerformanceSettings({ complexity: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#61d6aa"
                    />
                    <SliderRow
                      label="Motion Intensity"
                      value={perf.motionIntensity}
                      onChange={value => setSoundDrawingPerformanceSettings({ motionIntensity: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#4ac7db"
                    />
                    <SliderRow
                      label="Reaction Intensity"
                      value={perf.reactionIntensity}
                      onChange={value => setSoundDrawingPerformanceSettings({ reactionIntensity: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#ff4fd8"
                    />
                    <SliderRow
                      label="Trail Intensity"
                      value={perf.trailIntensity}
                      onChange={value => setSoundDrawingPerformanceSettings({ trailIntensity: value })}
                      min={0}
                      max={1}
                      step={0.01}
                      color="#9ddcff"
                    />
                    <SliderRow
                      label="Show Size"
                      value={osc.pathScale}
                      onChange={value => set({ pathScale: value })}
                      min={SOUND_DRAWING_VISUAL_SIZE_MIN}
                      max={SOUND_DRAWING_VISUAL_SIZE_MAX}
                      step={0.01}
                      color="#4ac7db"
                      description="Scales the authored composition without replacing its generator, layers, or source identity."
                    />
                    {showLivingRibbonControls && (
                      <Collapsible label="Living Ribbon Controls" defaultOpen>
                        <SelectRow
                          label="Ribbon Quality"
                          value={ribbon.quality}
                          onChange={value => setRibbon({ quality: value as typeof ribbon.quality })}
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
                          onChange={value => setRibbon({ pointDensity: value })}
                          min={0}
                          max={1}
                          step={0.01}
                          color="#4ac7db"
                        />
                        <SliderRow
                          label="Tension"
                          value={ribbon.tension}
                          onChange={value => setRibbon({ tension: value })}
                          min={0}
                          max={1}
                          step={0.01}
                          color="#61d6aa"
                        />
                        <SliderRow
                          label="Turbulence"
                          value={ribbon.turbulence}
                          onChange={value => setRibbon({ turbulence: value })}
                          min={0}
                          max={1}
                          step={0.01}
                          color="#ff4fd8"
                        />
                        <SliderRow
                          label="Body Width"
                          value={ribbon.bodyWidth}
                          onChange={value => setRibbon({ bodyWidth: value })}
                          min={0}
                          max={1}
                          step={0.01}
                          color="#4ac7db"
                        />
                        <SliderRow
                          label="Bloom"
                          value={ribbon.bloom}
                          onChange={value => setRibbon({ bloom: value })}
                          min={0}
                          max={1}
                          step={0.01}
                          color="#b84fc9"
                        />
                        <SliderRow
                          label="Spark Amount"
                          value={ribbon.sparkAmount}
                          onChange={value => setRibbon({ sparkAmount: value })}
                          min={0}
                          max={1}
                          step={0.01}
                          color="#ffd166"
                        />
                        <SliderRow
                          label="Center Attraction"
                          value={ribbon.centerAttraction}
                          onChange={value => setRibbon({ centerAttraction: value })}
                          min={0}
                          max={1}
                          step={0.01}
                          color="#61d6aa"
                        />
                        <SliderRow
                          label="Audio Reaction Depth"
                          value={ribbon.audioReactionDepth}
                          onChange={value => setRibbon({ audioReactionDepth: value })}
                          min={0}
                          max={1}
                          step={0.01}
                          color="#ff4fd8"
                        />
                        <button type="button" className="rv-reset-btn" onClick={requestSoundDrawingRibbonReset}>
                          Reset Ribbon Simulation
                        </button>
                      </Collapsible>
                    )}
                    <Collapsible label="Performance Diagnostics" defaultOpen={false}>
                      <div className="rv-ctrl-info rv-control-helper-copy">
                        Runtime diagnostics appear while Auto Performance is active and the engine is rendering.
                      </div>
                    </Collapsible>
                    <button type="button" className="rv-reset-btn" onClick={resetSoundDrawingPerformanceSettings}>
                      Reset to Authored State
                    </button>
                  </>
                )}

                {perf.selectedShowId != null && !perf.autoPerformance && (
                  <>
                    <CtrlSection label="Base Design" />
                    <SliderRow
                      label="Show Size"
                      value={osc.pathScale}
                      onChange={value => set({ pathScale: value })}
                      min={SOUND_DRAWING_VISUAL_SIZE_MIN}
                      max={SOUND_DRAWING_VISUAL_SIZE_MAX}
                      step={0.01}
                      color="#4ac7db"
                      description="Scales the selected show's stable base design. Auto Performance can be enabled separately without replacing this visual family."
                    />
                    <div className="rv-ctrl-info rv-control-helper-copy">
                      {selectedSoundDrawingShow?.name ?? 'The selected Performance Show'} is active in its stable base-design state. Auto Performance is off, so section transitions and authored choreography are paused.
                    </div>
                  </>
                )}
                {perf.selectedShowId == null && (
                  <div className="rv-ctrl-info rv-control-helper-copy">
                    No Performance Show is selected. Manual Sound Drawing sources, presets, timeline layers, and clips own the output.
                  </div>
                )}

                {perf.selectedShowId == null && (
                  <>
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

                    <div className="rv-sound-drawing-source-grid-help drm-help-overlay-anchor">
                      <SoundDrawingSourceGrid
                        value={osc.sourceType === 'svgGlyph' || osc.sourceType === 'svgVisual' ? 'svg' : osc.sourceType}
                        onChange={sourceType => set({ sourceType })}
                        disabled={!soundDrawingOwnership.domains.source.editable}
                        description={soundDrawingOwnership.domains.source.ariaDescription}
                      />
                      <HelpInfoTrigger
                        helpId="react.soundDrawing.engineMode.overview"
                        currentValue={getSoundDrawingSourceLabel(
                          osc.sourceType === 'svgGlyph' || osc.sourceType === 'svgVisual' ? 'svg' : osc.sourceType,
                        )}
                        placement="right"
                      />
                    </div>

                    <div className="rv-sound-drawing-control-help drm-help-overlay-anchor">
                      <SliderRow
                        label="Visual Size"
                        value={osc.pathScale}
                        onChange={value => set({ pathScale: value })}
                        min={SOUND_DRAWING_VISUAL_SIZE_MIN}
                        max={SOUND_DRAWING_VISUAL_SIZE_MAX}
                        step={0.01}
                        disabled={!soundDrawingOwnership.domains.geometry.editable}
                        description={`Sets the base size for the selected manual Engine Mode. ${soundDrawingOwnership.domains.geometry.ariaDescription}`}
                      />
                      <HelpInfoTrigger
                        helpId="react.soundDrawing.engineMode.visualSize"
                        currentValue={`${osc.pathScale.toFixed(2)}×`}
                        placement="right"
                      />
                    </div>

                    <fieldset
                      className="rv-ctrl-fieldset-stack"
                      disabled={!soundDrawingOwnership.domains.source.editable}
                      aria-describedby="sound-drawing-source-ownership"
                    >
                      {osc.sourceType === 'classic' && (
                        <>
                          {!perf.autoPerformance && (
                            <>
                              <div className="rv-sound-drawing-control-help drm-help-overlay-anchor">
                                <ToggleRow
                                  label="Follow Track Sections"
                                  value={osc.autoSectionMode}
                                  onChange={v => set({ autoSectionMode: v })}
                                  description="Automatically changes the manual Classic Scope topology from the analyzed section at the playhead."
                                />
                                <HelpInfoTrigger
                                  helpId="react.soundDrawing.engineMode.followTrackSections"
                                  currentValue={osc.autoSectionMode ? 'On' : 'Off'}
                                  currentValueLabel="Status"
                                  currentValueTone={osc.autoSectionMode ? 'accent' : 'default'}
                                  placement="right"
                                />
                              </div>
                              {osc.autoSectionMode && (
                                <div className="rv-ctrl-info" role="status" aria-live="polite">
                                  {currentAnalyzedSection
                                    ? `Detected ${currentAnalyzedSection.label || currentAnalyzedSection.type} · Effective visual ${soundDrawingSectionScopeModeLabel(followedScopeMode)}`
                                    : `No analyzed section at the playhead · Effective visual ${soundDrawingSectionScopeModeLabel(followedScopeMode)}`}
                                </div>
                              )}
                            </>
                          )}
                          {(!osc.autoSectionMode || perf.autoPerformance) && (
                            <div className="rv-sound-drawing-control-help drm-help-overlay-anchor">
                              <SelectRow
                                label="Classic Mode"
                                value={osc.classicMode === 'sectionAuto' ? 'waveform' : osc.classicMode}
                                onChange={v => set({ classicMode: v as ClassicScopeMode })}
                                options={[
                                  { value: 'waveform', label: 'Waveform' },
                                  { value: 'monoDelayXY', label: 'Mono Delay Portrait' },
                                  { value: 'radialScope', label: 'Radial Scope' },
                                  { value: 'spiralScope', label: 'Spiral Scope' },
                                  { value: 'professionalScope', label: 'Pro Scope' },
                                ]}
                              />
                              <HelpInfoTrigger
                                helpId="react.soundDrawing.engineMode.classicMode"
                                currentValue={getClassicScopeModeLabel(
                                  osc.classicMode === 'sectionAuto' ? 'waveform' : osc.classicMode,
                                )}
                                placement="right"
                              />
                            </div>
                          )}
                          {(!osc.autoSectionMode || perf.autoPerformance) && osc.classicMode === 'professionalScope' && (
                            <fieldset
                              className="rv-ctrl-fieldset-stack"
                              disabled={authoredScopeOwnsControls}
                              aria-describedby="sound-drawing-performance-ownership"
                            >
                              {authoredScopeOwnsControls && (
                                <div className="rv-ctrl-info rv-control-helper-copy">
                                  {soundDrawingOwnership.professionalScopeOwner === 'authored'
                                    ? `Signal, trigger, phosphor, and CRT controls are owned by ${selectedSoundDrawingShow?.name ?? 'the active show'}. Visual Size remains a live mixed input.`
                                    : `Pro Scope signal controls are inactive because ${selectedSoundDrawingShow?.name ?? 'the active show'} has no scope layer. Visual Size still controls the authored base geometry.`}
                                </div>
                              )}
                              <SoundDrawingProScopeMockup osc={osc} set={set} hideTraceSize />
                            </fieldset>
                          )}
                        </>
                      )}

                      {osc.sourceType === 'builtinShape' && (
                        <SelectRow
                          label="Shape"
                          value={osc.builtinShape}
                          onChange={v => set({ builtinShape: v as BuiltinOscillatorShape })}
                          options={[
                            { value: 'circle', label: 'Circle' },
                            { value: 'square', label: 'Square' },
                            { value: 'triangle', label: 'Triangle' },
                            { value: 'star', label: 'Star' },
                            { value: 'hexagon', label: 'Hexagon' },
                            { value: 'infinity', label: 'Infinity' },
                            { value: 'spiral', label: 'Spiral' },
                            { value: 'line', label: 'Line' },
                          ]}
                        />
                      )}

                      {osc.sourceType === 'text' && (
                        <>
                          <SelectRow
                            label="Text Source"
                            value={osc.textSource ?? 'static'}
                            onChange={value => set({ textSource: value as SoundDrawingTextSource })}
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
                              onChange={v => set({ text: v })}
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
                                onChange={value => set({ lyricGapBehavior: value as SoundDrawingLyricGapBehavior })}
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
                                  onChange={value => set({ lyricFallbackText: value })}
                                  maxLength={128}
                                  placeholder="Instrumental"
                                />
                              )}
                            </>
                          )}
                          <ToggleRow label="Auto Rotate" value={osc.autoRotate === true} onChange={v => set({ autoRotate: v })} />
                          {oscillatorFontAssets.length > 0 && (
                            <SelectRow
                              label="Font"
                              value={osc.textFontId ?? ''}
                              onChange={v => selectOscillatorFont(v || null)}
                              options={[
                                { value: '', label: '— canvas fallback —' },
                                ...oscillatorFontAssets.map(f => ({
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
                              onChange={v => set({ textFontSize: Math.round(v) })}
                              min={48}
                              max={320}
                              step={8}
                              color="#61d6aa"
                            />
                          )}
                          <SliderRow
                            label="Spacing"
                            value={osc.textLetterSpacing}
                            onChange={v => set({ textLetterSpacing: Math.round(v) })}
                            min={-20}
                            max={80}
                            step={1}
                            color="#d8b95a"
                          />
                        </>
                      )}

                      {(osc.sourceType === 'svg' || osc.sourceType === 'svgGlyph' || osc.sourceType === 'svgVisual') && (
                        svgMediaItems.length === 0 ? (
                          <div className="rv-ctrl-info">No SVG files yet — import from the Media tab.</div>
                        ) : (
                          <>
                            <SelectRow
                              label="SVG File"
                              value={selectedSvgMediaId ?? ''}
                              onChange={v => { if (v) selectSvgAsset(v) }}
                              options={[{ value: '', label: '— select SVG —' }]}
                            />
                            <SelectRow
                              label="Render As"
                              value={osc.svgRenderMode ?? 'auto'}
                              onChange={v => set({ svgRenderMode: v as SvgRenderMode })}
                              options={[
                                { value: 'auto', label: 'Auto (Recommended)' },
                                { value: 'reactivePath', label: 'Reactive Path' },
                                { value: 'originalArtwork', label: 'Original Artwork' },
                              ]}
                            />
                            <ToggleRow
                              label="React Palette"
                              value={osc.svgUseReactPalette !== false}
                              onChange={v => set({ svgUseReactPalette: v })}
                            />
                            <ToggleRow
                              label="Auto Rotate"
                              value={osc.autoRotate !== false}
                              onChange={v => set({ autoRotate: v })}
                            />
                            {(osc.svgRenderMode === 'auto' || osc.svgRenderMode === 'reactivePath') && (
                              <div className="rv-ctrl-info rv-control-helper-copy" style={{ marginTop: 2 }}>
                                Reactive Path deforms the SVG outline with audio. Original Artwork renders it at full fidelity with
                                whole-object reactions.
                              </div>
                            )}
                          </>
                        )
                      )}

                      {osc.sourceType !== 'classic' && activeSvgSource?.renderMode !== 'originalArtwork' && (
                        <>
                          <CtrlSection label="Source" />
                          <SliderRow
                            label="Resolution"
                            value={osc.pathResolution}
                            onChange={v => set({ pathResolution: Math.round(v) })}
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
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
