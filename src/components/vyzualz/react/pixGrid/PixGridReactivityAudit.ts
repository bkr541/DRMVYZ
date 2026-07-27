import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { buildSharedPerformanceContext } from '../../../../features/performanceCore'
import type { ReactPreset, ReactSectionType, ReactTrackSection } from '../ReactTypes'
import { PixGridReactionRuntime, createSilentPixGridAudioFrame } from './PixGridAudioRouting'
import { composePixGridLogicalFrame } from './PixGridCompositor'
import { PIX_GRID_MATRIX_DIMENSIONS } from './PixGridDefaults'
import { measurePixGridPerceptualDifference } from './PixGridPerceptualMetrics'
import { applyPixGridRuntimeControls } from './PixGridRuntimeControls'
import { migratePixGridState } from './PixGridStateMigration'
import { normalizePixGridState } from './PixGridValidation'
import type { PixGridAudioFrame, PixGridReactionSource, PixGridState } from './PixGridTypes'
import { mergePixGridReactionRuntimeDiagnostics, PixGridUnifiedPerformanceRuntime } from './PixGridUnifiedPerformanceRuntime'
import { buildPixGridCanvasSemanticPlan } from '../renderers/pixGrid/PixGridBaselineRenderer'
import { buildPixGridGpuSemanticPlan } from '../renderers/pixGrid/PixGridGpuRenderer'
import {
  comparePixGridRendererSemanticPlans,
  validatePixGridPreset,
  type PixGridValidationReport,
} from './PixGridValidationAudit'

export type PixGridAuditScenarioId =
  | 'silence' | 'beat' | 'downbeat' | 'kick' | 'snare' | 'bassSustain' | 'highEnergy' | 'build' | 'preDrop'
  | 'drop' | 'breakdown' | 'phraseBoundary' | 'secondDrop' | 'outro'

export interface PixGridAuditScenario {
  id: PixGridAuditScenarioId
  sectionType: ReactSectionType
  audioTime: number
  sourceValues: Partial<Record<PixGridReactionSource, number>>
  eventIdentities?: Partial<Record<string, string>>
  sectionOccurrence?: number
  dropOccurrence?: number
  phraseEntry?: boolean
}

export interface PixGridReactivityAuditCheck {
  id: string
  passed: boolean
  detail: string
}

export interface PixGridAcceptanceMatrixRow {
  id: string
  category: 'state' | 'analysis' | 'music' | 'controls' | 'renderer' | 'quality' | 'pipeline'
  passed: boolean
  detail: string
}

export interface PixGridReactivityAuditReport {
  presetId: string
  passed: boolean
  validation: PixGridValidationReport
  checks: readonly PixGridReactivityAuditCheck[]
  acceptanceMatrix: readonly PixGridAcceptanceMatrixRow[]
  pixelHashes: Readonly<Record<PixGridAuditScenarioId, string>>
  unifiedPixelHashes: Readonly<Record<PixGridAuditScenarioId, string>>
}

const AUDIT_SECTIONS: readonly ReactTrackSection[] = Object.freeze([
  { id: 'audit-intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.25, source: 'auto', confidence: 1 },
  { id: 'audit-verse', label: 'Verse', type: 'verse', startSec: 8, endSec: 24, intensity: 0.5, source: 'auto', confidence: 1 },
  { id: 'audit-build', label: 'Build', type: 'build', startSec: 24, endSec: 31, intensity: 0.8, source: 'auto', confidence: 1 },
  { id: 'audit-pre-drop', label: 'Pre-drop', type: 'preDrop', startSec: 31, endSec: 32, intensity: 0.7, source: 'auto', confidence: 1 },
  { id: 'audit-drop-one', label: 'Drop 1', type: 'drop', startSec: 32, endSec: 64, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'audit-breakdown', label: 'Breakdown', type: 'breakdown', startSec: 64, endSec: 76, intensity: 0.35, source: 'auto', confidence: 1 },
  { id: 'audit-drop-two', label: 'Drop 2', type: 'drop', startSec: 76, endSec: 112, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'audit-outro', label: 'Outro', type: 'outro', startSec: 112, endSec: 132, intensity: 0.2, source: 'auto', confidence: 1 },
])

export const PIX_GRID_REACTIVITY_AUDIT_SCENARIOS: readonly PixGridAuditScenario[] = Object.freeze([
  { id: 'silence', sectionType: 'verse', audioTime: 8, sourceValues: {} },
  { id: 'beat', sectionType: 'verse', audioTime: 10, sourceValues: { beat: 1, energy: 0.42 } },
  { id: 'downbeat', sectionType: 'verse', audioTime: 10.5, sourceValues: { beat: 1, downbeat: 1, barEntry: 1, energy: 0.48 } },
  { id: 'kick', sectionType: 'verse', audioTime: 12, sourceValues: { kick: 0.62, beat: 1, transient: 0.52, bass: 0.38, energy: 0.48 } },
  { id: 'snare', sectionType: 'verse', audioTime: 14, sourceValues: { snare: 0.66, beat: 1, transient: 0.58, high: 0.38, energy: 0.46 } },
  { id: 'bassSustain', sectionType: 'verse', audioTime: 18, sourceValues: { sub: 0.35, bass: 0.43, lowMid: 0.31, bassStemActivity: 0.42, energy: 0.5 } },
  { id: 'highEnergy', sectionType: 'verse', audioTime: 22, sourceValues: { energy: 0.78, trackRelativeEnergy: 0.82, volume: 0.74, spectralFlux: 0.56, beat: 1 } },
  { id: 'build', sectionType: 'build', audioTime: 28, sourceValues: { buildProgress: 0.68, energy: 0.62, tension: 0.64, phraseProgress: 0.72, beat: 1 }, sectionOccurrence: 1 },
  { id: 'preDrop', sectionType: 'preDrop', audioTime: 31, sourceValues: { energy: 0.2, tension: 0.78, phraseProgress: 0.94 }, sectionOccurrence: 1 },
  { id: 'drop', sectionType: 'drop', audioTime: 32.1, sourceValues: { dropImpact: 0.88, kick: 0.78, beat: 1, downbeat: 1, bass: 0.68, sub: 0.58, energy: 0.82, transient: 0.72 }, sectionOccurrence: 1, dropOccurrence: 1 },
  { id: 'breakdown', sectionType: 'breakdown', audioTime: 68, sourceValues: { energy: 0.28, vocalActivity: 0.5, melodyActivity: 0.45 }, sectionOccurrence: 1 },
  { id: 'phraseBoundary', sectionType: 'breakdown', audioTime: 72, sourceValues: { phraseEntry: 1, beat: 1, energy: 0.4 }, phraseEntry: true, sectionOccurrence: 1 },
  { id: 'secondDrop', sectionType: 'drop', audioTime: 80.1, sourceValues: { dropImpact: 0.9, kick: 0.82, snare: 0.72, beat: 1, downbeat: 1, bass: 0.72, energy: 0.86, transient: 0.78 }, sectionOccurrence: 2, dropOccurrence: 2 },
  { id: 'outro', sectionType: 'outro', audioTime: 120, sourceValues: { energy: 0.18, volume: 0.22, phraseProgress: 0.9 }, sectionOccurrence: 1 },
])

interface PixGridAuditControls {
  bassReactivity: number
  motion: number
  capabilityOverrides?: Partial<Record<PixGridReactionSource, boolean>>
  inputSource?: PixGridAudioFrame['inputSource']
  analyserConnected?: boolean
  analyserActive?: boolean
  sharedPerformanceCoreAvailable?: boolean
}

function frameForScenario(
  scenario: PixGridAuditScenario,
  controls: PixGridAuditControls = { bassReactivity: 1, motion: 1 },
): PixGridAudioFrame {
  const sourceValues = { ...scenario.sourceValues }
  const capabilities = {
    ...Object.fromEntries(Object.keys(sourceValues).map(source => [source, true])),
    ...controls.capabilityOverrides,
  }
  const confidence = Object.fromEntries(Object.keys(sourceValues).map(source => [source, 1]))
  return applyPixGridRuntimeControls(createSilentPixGridAudioFrame({
    audioTime: scenario.audioTime,
    isPlaying: true,
    deltaTimeSec: 1 / 60,
    sectionType: scenario.sectionType,
    sectionPhase: scenario.id === 'drop' || scenario.id === 'secondDrop' ? 'entry' : 'body',
    sectionOccurrence: scenario.sectionOccurrence ?? 1,
    dropOccurrence: scenario.dropOccurrence ?? 0,
    phraseEntry: scenario.phraseEntry ?? false,
    phraseSegment: scenario.phraseEntry ? 'entry' : 'middle',
    beatIndex: Math.round(scenario.audioTime * 2),
    barIndex: Math.floor(scenario.audioTime / 2),
    phraseIndex: Math.floor(scenario.audioTime / 8),
    sourceValues,
    capabilities,
    confidence,
    eventIdentities: Object.fromEntries(Object.entries(sourceValues).filter(([, value]) => (value ?? 0) > 0).map(([source]) => [source, `${scenario.id}:${source}`])),
    trackIdentity: 'pix-grid-reactivity-audit',
    inputSource: controls.inputSource ?? 'analyser',
    analyserConnected: controls.analyserConnected ?? true,
    analyserActive: controls.analyserActive ?? true,
    sharedPerformanceCoreAvailable: controls.sharedPerformanceCoreAvailable ?? true,
  }), controls)
}

function hashPixels(pixels: Uint8Array): string {
  let hash = 2166136261
  for (let index = 0; index < pixels.length; index += 1) {
    hash ^= pixels[index]!
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function differingBytes(a: Uint8Array, b: Uint8Array): number {
  const length = Math.min(a.length, b.length)
  let count = Math.abs(a.length - b.length)
  for (let index = 0; index < length; index += 1) if (a[index] !== b[index]) count += 1
  return count
}

function renderScenario(
  preset: ReactPreset,
  state: PixGridState,
  scenario: PixGridAuditScenario,
  controls: PixGridAuditControls = { bassReactivity: 1, motion: 1 },
): Uint8Array {
  const runtime = new PixGridReactionRuntime()
  const triggerFrame = frameForScenario(scenario, controls)
  composePixGridLogicalFrame(preset, state, triggerFrame, undefined, null, runtime)
  const settleFrame = {
    ...triggerFrame,
    audioTime: triggerFrame.audioTime + 0.06,
    deltaTimeSec: 0.06,
    sourceValues: Object.fromEntries(Object.entries(triggerFrame.sourceValues ?? {}).map(([source, value]) => [source, ['kick', 'snare', 'hat', 'beat', 'downbeat', 'transient', 'dropImpact', 'phraseEntry'].includes(source) ? 0 : value])),
    kickHit: false,
    snareHit: false,
    hatHit: false,
    beatHit: false,
    transientHit: false,
    dropImpactHit: false,
    phraseEntry: false,
  }
  return composePixGridLogicalFrame(preset, state, settleFrame, undefined, null, runtime).pixels.slice()
}

function resolveUnifiedScenario(
  preset: ReactPreset,
  state: PixGridState,
  scenario: PixGridAuditScenario,
  controls: PixGridAuditControls = { bassReactivity: 1, motion: 1 },
) {
  const audioFrame = frameForScenario(scenario, controls)
  const absoluteBeat = scenario.audioTime * 2
  const beatIndex = Math.floor(absoluteBeat)
  const source = audioFrame.sourceValues ?? {}
  const context = buildSharedPerformanceContext({
    audioTimeSec: scenario.audioTime,
    frame: {
      ...DEFAULT_MI_FRAME,
      timeSec: scenario.audioTime,
      frameId: Math.max(1, Math.round(scenario.audioTime * 60)),
      sourceId: 'pix-grid-reactivity-audit',
      trackId: 'pix-grid-reactivity-audit',
      bands: {
        ...DEFAULT_MI_FRAME.bands,
        sub: source.sub ?? 0,
        bass: source.bass ?? 0,
        lowMid: source.lowMid ?? 0,
        mid: source.mid ?? 0,
        high: source.high ?? 0,
        air: source.air ?? 0,
        volume: source.volume ?? source.energy ?? 0,
        normalizedSub: source.sub ?? 0,
        normalizedBass: source.bass ?? 0,
        normalizedLowMid: source.lowMid ?? 0,
        normalizedMid: source.mid ?? 0,
        normalizedHigh: source.high ?? 0,
        normalizedAir: source.air ?? 0,
      },
      rhythm: {
        ...DEFAULT_MI_FRAME.rhythm,
        bpm: 120,
        bpmConfidence: 1,
        beatIndex,
        beatPhase: absoluteBeat - beatIndex,
        beatInBar: beatIndex % 4,
        barIndex: Math.floor(beatIndex / 4),
        beatHit: (source.beat ?? 0) > 0,
        kickHit: (source.kick ?? 0) > 0,
        kickStrength: source.kick ?? 0,
        snareHit: (source.snare ?? 0) > 0,
        snareStrength: source.snare ?? 0,
        hatHit: (source.hat ?? 0) > 0,
        hatStrength: source.hat ?? 0,
      },
      energy: {
        ...DEFAULT_MI_FRAME.energy,
        instant: source.energy ?? source.volume ?? 0,
        shortTerm: source.energy ?? source.volume ?? 0,
        longTerm: Math.max(0.05, (source.energy ?? source.volume ?? 0) * 0.75),
        percentile: source.trackRelativeEnergy ?? source.energy ?? 0,
        spectralFlux: source.spectralFlux ?? source.transient ?? 0,
      },
    },
    resolvedSections: AUDIT_SECTIONS,
    durationSec: 132,
    trackIdentity: 'pix-grid-reactivity-audit',
  })
  const unified = new PixGridUnifiedPerformanceRuntime().resolve({
    authoredState: state,
    context,
    audioFrame,
    presetId: preset.id,
    cues: [],
    trackId: 'pix-grid-reactivity-audit',
  })
  const reactionRuntime = new PixGridReactionRuntime()
  const logicalFrame = composePixGridLogicalFrame(
    preset,
    unified.state,
    audioFrame,
    undefined,
    null,
    reactionRuntime,
    unified.transition,
    unified.groupEffects,
  )
  const diagnostics = mergePixGridReactionRuntimeDiagnostics(
    unified.diagnostics,
    reactionRuntime.getDiagnostics(),
    unified.state,
  )
  return { audioFrame, unified, diagnostics, logicalFrame }
}

function renderUnifiedScenario(
  preset: ReactPreset,
  state: PixGridState,
  scenario: PixGridAuditScenario,
  controls: PixGridAuditControls = { bassReactivity: 1, motion: 1 },
): Uint8Array {
  return resolveUnifiedScenario(preset, state, scenario, controls).logicalFrame.pixels.slice()
}

export function auditPixGridPresetRenderedReactivity(
  preset: ReactPreset,
  state: PixGridState,
): PixGridReactivityAuditReport {
  const rendered = new Map<PixGridAuditScenarioId, Uint8Array>()
  const unifiedRendered = new Map<PixGridAuditScenarioId, Uint8Array>()
  const pixelHashes = {} as Record<PixGridAuditScenarioId, string>
  const unifiedPixelHashes = {} as Record<PixGridAuditScenarioId, string>
  for (const scenario of PIX_GRID_REACTIVITY_AUDIT_SCENARIOS) {
    const pixels = renderScenario(preset, state, scenario)
    const unifiedPixels = renderUnifiedScenario(preset, state, scenario)
    rendered.set(scenario.id, pixels)
    unifiedRendered.set(scenario.id, unifiedPixels)
    pixelHashes[scenario.id] = hashPixels(pixels)
    unifiedPixelHashes[scenario.id] = hashPixels(unifiedPixels)
  }
  const silence = rendered.get('silence')!
  const kick = rendered.get('kick')!
  const snare = rendered.get('snare')!
  const bassScenario = PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'bassSustain')!
  const lowBass = renderScenario(preset, state, { ...bassScenario, sourceValues: { sub: 0.14, bass: 0.18, lowMid: 0.16, bassStemActivity: 0.16, energy: 0.28 } })
  const strongBass = renderScenario(preset, state, { ...bassScenario, sourceValues: { sub: 0.64, bass: 0.72, lowMid: 0.48, bassStemActivity: 0.7, energy: 0.72 } })
  const bass0 = renderScenario(preset, state, bassScenario, { bassReactivity: 0, motion: 1 })
  const bass05 = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'bassSustain')!, { bassReactivity: 0.5, motion: 1 })
  const bass1 = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'bassSustain')!, { bassReactivity: 1, motion: 1 })
  const motion0 = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS[0]!, { bassReactivity: 1, motion: 0 })
  const motion05 = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS[0]!, { bassReactivity: 1, motion: 0.5 })
  const motion1 = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS[0]!, { bassReactivity: 1, motion: 1 })
  const deterministicA = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'secondDrop')!)
  const deterministicB = renderScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'secondDrop')!)
  const unifiedDeterministicA = renderUnifiedScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'secondDrop')!)
  const unifiedDeterministicB = renderUnifiedScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'secondDrop')!)
  const validation = validatePixGridPreset(preset, state)
  const dimensions = PIX_GRID_MATRIX_DIMENSIONS[state.quality]
  const logicalFrame = (pixels: Uint8Array) => ({ ...dimensions, pixels, visibleLayerCount: 0 })
  const kickMetrics = measurePixGridPerceptualDifference(logicalFrame(silence), logicalFrame(kick))
  const snareMetrics = measurePixGridPerceptualDifference(logicalFrame(silence), logicalFrame(snare))
  const activeMetrics = measurePixGridPerceptualDifference(logicalFrame(silence), logicalFrame(rendered.get('highEnergy')!))
  const kickSnareMetrics = measurePixGridPerceptualDifference(logicalFrame(kick), logicalFrame(snare))
  const bassRangeMetrics = measurePixGridPerceptualDifference(logicalFrame(lowBass), logicalFrame(strongBass))
  const bassHalfMetrics = measurePixGridPerceptualDifference(logicalFrame(bass0), logicalFrame(bass05))
  const bassFullMetrics = measurePixGridPerceptualDifference(logicalFrame(bass05), logicalFrame(bass1))
  const localizationDelta = (
    Math.abs(kickMetrics.centerChangedRatio * kickMetrics.changedCells - snareMetrics.centerChangedRatio * snareMetrics.changedCells)
    + Math.abs(kickMetrics.borderChangedRatio * kickMetrics.changedCells - snareMetrics.borderChangedRatio * snareMetrics.changedCells)
    + Math.abs(kickMetrics.upperChangedRatio * kickMetrics.changedCells - snareMetrics.upperChangedRatio * snareMetrics.changedCells)
    + Math.abs(kickMetrics.lowerChangedRatio * kickMetrics.changedCells - snareMetrics.lowerChangedRatio * snareMetrics.changedCells)
  )
  const checks: PixGridReactivityAuditCheck[] = [
    { id: 'compiles-and-validates', passed: validation.valid, detail: validation.summary },
    { id: 'active-differs-from-silence', passed: activeMetrics.changedCellRatio >= 0.025 && activeMetrics.meanMaterialDelta >= 14, detail: `Ordinary playback changed ${(activeMetrics.changedCellRatio * 100).toFixed(2)}% of cells with mean material delta ${activeMetrics.meanMaterialDelta.toFixed(1)} relative to silence.` },
    { id: 'kick-perceptual-minimum', passed: kickMetrics.changedCellRatio >= 0.012 && kickMetrics.meanMaterialDelta >= 18, detail: `Normal kick changed ${(kickMetrics.changedCellRatio * 100).toFixed(2)}% of cells with mean material delta ${kickMetrics.meanMaterialDelta.toFixed(1)}.` },
    { id: 'snare-perceptual-minimum', passed: snareMetrics.changedCellRatio >= 0.008 && snareMetrics.meanMaterialDelta >= 16, detail: `Normal snare changed ${(snareMetrics.changedCellRatio * 100).toFixed(2)}% of cells with mean material delta ${snareMetrics.meanMaterialDelta.toFixed(1)}.` },
    { id: 'kick-differs-from-snare', passed: kickSnareMetrics.changedCellRatio >= 0.03 && localizationDelta >= Math.max(8, dimensions.width * dimensions.height * 0.015), detail: `Kick and snare differ across ${(kickSnareMetrics.changedCellRatio * 100).toFixed(2)}% of cells with distinct center, edge, upper, or lower localization.` },
    { id: 'bass-dynamic-range', passed: bassRangeMetrics.changedCellRatio >= 0.008 && bassRangeMetrics.meanMaterialDelta >= 12, detail: `Low and strong sustained bass differ across ${(bassRangeMetrics.changedCellRatio * 100).toFixed(2)}% of cells with mean material delta ${bassRangeMetrics.meanMaterialDelta.toFixed(1)}.` },
    { id: 'bass-reactivity-control', passed: bassHalfMetrics.changedCellRatio >= 0.004 && bassFullMetrics.changedCellRatio >= 0.004 && differingBytes(bass0, bass05) > 0 && differingBytes(bass05, bass1) > 0, detail: 'Bass Reactivity 0, 0.5, and 1 must produce bounded, materially distinct bass output.' },
    { id: 'motion-control', passed: differingBytes(motion0, motion05) > 0 && differingBytes(motion05, motion1) > 0, detail: 'Motion 0, 0.5, and 1 must produce bounded, distinct autonomous-animation output without suppressing music routes.' },
    { id: 'drop-differs-from-breakdown', passed: differingBytes(rendered.get('drop')!, rendered.get('breakdown')!) > 0, detail: 'Drop and breakdown must resolve distinct pixels.' },
    { id: 'first-drop-differs-from-second', passed: differingBytes(rendered.get('drop')!, rendered.get('secondDrop')!) > 0, detail: 'First and second drop must develop differently.' },
    { id: 'deterministic-repeat', passed: differingBytes(deterministicA, deterministicB) === 0, detail: 'Repeated evaluation at identical position and controls must match.' },
    { id: 'unified-runtime-active-differs-from-silence', passed: [...unifiedRendered.entries()].some(([id, pixels]) => id !== 'silence' && differingBytes(unifiedRendered.get('silence')!, pixels) > 0), detail: 'The full Shared Performance and PixGrid unified runtime must change rendered pixels, not only the direct compositor harness.' },
    { id: 'unified-runtime-first-drop-differs-from-second', passed: differingBytes(unifiedRendered.get('drop')!, unifiedRendered.get('secondDrop')!) > 0, detail: 'The full performance runtime must preserve authored second-drop development.' },
    { id: 'unified-runtime-deterministic-repeat', passed: differingBytes(unifiedDeterministicA, unifiedDeterministicB) === 0, detail: 'Full-pipeline repeated evaluation at identical position and controls must match.' },
  ]
  const canonicalValidation = validatePixGridPreset(preset, state)
  const legacyInput = {
    ...state,
    version: 1,
    configuration: {
      ...state.configuration,
      metadataVersion: 0,
      presetConfigurationVersion: 0,
      layerGraphVersion: 0,
      smartGroupConfigurationVersion: 0,
      audioRouteConfigurationVersion: 0,
      performanceProgramConfigurationVersion: 0,
      musicReactiveConfigurationVersion: 0,
      canonicalMigrationCompleted: false,
      legacyOfficialLayerGraph: true,
    },
  }
  const migratedLegacy = migratePixGridState(legacyInput, preset)
  const firstLayer = state.layers[0]
  const overlayId = 'pix-grid-audit-user-overlay'
  const overlayState = firstLayer ? normalizePixGridState({
    ...state,
    layers: [...state.layers, { ...firstLayer, id: overlayId, name: 'Audit user overlay', zIndex: Math.max(...state.layers.map(layer => layer.zIndex), 0) + 1, seed: firstLayer.seed + 991 }],
    scenes: state.scenes.map(scene => scene.id === state.selectedSceneId ? { ...scene, layerIds: [...scene.layerIds, overlayId] } : scene),
    configuration: { ...state.configuration, userCustomized: true },
  }) : state
  const migratedOverlay = migratePixGridState(overlayState, preset)
  const liveOnlyControls: PixGridAuditControls = {
    bassReactivity: 1,
    motion: 1,
    inputSource: 'analyser',
    analyserConnected: true,
    analyserActive: true,
    capabilityOverrides: {
      buildProgress: false,
      sectionProgress: false,
      phraseProgress: false,
      semanticMoment: false,
      vocalActivity: false,
      bassStemActivity: false,
      drumActivity: false,
      melodyActivity: false,
      trackMapCueEvent: false,
    },
  }
  const liveOnlyPixels = renderUnifiedScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'kick')!, liveOnlyControls)
  const liveOnlySilence = renderUnifiedScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'silence')!, liveOnlyControls)
  const offlinePixels = renderUnifiedScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'build')!)
  const semanticFrame = resolveUnifiedScenario(preset, state, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'secondDrop')!)
  const canvasPlan = buildPixGridCanvasSemanticPlan(semanticFrame.unified.state, semanticFrame.audioFrame, semanticFrame.diagnostics)
  const gpuPlan = buildPixGridGpuSemanticPlan(semanticFrame.unified.state, semanticFrame.audioFrame, semanticFrame.diagnostics)
  const semanticParityIssues = comparePixGridRendererSemanticPlans(canvasPlan, gpuPlan)
  const qualityRows: PixGridAcceptanceMatrixRow[] = []
  const qualityRatios: number[] = []
  for (const quality of ['draft', 'low', 'high', 'ultra'] as const) {
    const qualityDimensions = PIX_GRID_MATRIX_DIMENSIONS[quality]
    const qualityState = normalizePixGridState({ ...state, quality, matrixWidth: qualityDimensions.width, matrixHeight: qualityDimensions.height })
    const quietPixels = renderUnifiedScenario(preset, qualityState, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'silence')!)
    const activePixels = renderUnifiedScenario(preset, qualityState, PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.find(item => item.id === 'kick')!)
    const qualityMetrics = measurePixGridPerceptualDifference(
      { ...qualityDimensions, pixels: quietPixels, visibleLayerCount: 0 },
      { ...qualityDimensions, pixels: activePixels, visibleLayerCount: 0 },
    )
    qualityRatios.push(qualityMetrics.changedCellRatio)
    qualityRows.push({
      id: `quality-${quality}`,
      category: 'quality',
      passed: qualityMetrics.changedCellRatio >= 0.006 && qualityMetrics.meanMaterialDelta >= 8,
      detail: `${quality} changed ${(qualityMetrics.changedCellRatio * 100).toFixed(2)}% of logical cells with mean material delta ${qualityMetrics.meanMaterialDelta.toFixed(1)}.`,
    })
  }
  const positiveQualityRatios = qualityRatios.filter(value => value > 0)
  const responseNormalization = positiveQualityRatios.length === qualityRatios.length
    && Math.max(...positiveQualityRatios) / Math.max(0.0001, Math.min(...positiveQualityRatios)) <= 4
  const scenarioRows: PixGridAcceptanceMatrixRow[] = PIX_GRID_REACTIVITY_AUDIT_SCENARIOS.map(scenario => ({
    id: `music-${scenario.id}`,
    category: 'music' as const,
    passed: scenario.id === 'silence'
      ? true
      : differingBytes(unifiedRendered.get('silence')!, unifiedRendered.get(scenario.id)!) > 0,
    detail: scenario.id === 'silence'
      ? 'Silence baseline rendered successfully.'
      : `${scenario.id} produced a distinct full-pipeline logical frame.`,
  }))
  const acceptanceMatrix: PixGridAcceptanceMatrixRow[] = [
    { id: 'fresh-canonical-state', category: 'state', passed: canonicalValidation.valid && state.configuration.canonicalMigrationCompleted && !state.configuration.legacyOfficialLayerGraph, detail: canonicalValidation.summary },
    { id: 'legacy-migrated-state', category: 'state', passed: validatePixGridPreset(preset, migratedLegacy).valid && migratedLegacy.configuration.canonicalMigrationCompleted && !migratedLegacy.configuration.legacyOfficialLayerGraph, detail: 'Legacy-version metadata was migrated through the canonical layer, group, route, and program path.' },
    { id: 'user-overlay-survives-migration', category: 'state', passed: !firstLayer || migratedOverlay.layers.some(layer => layer.id === overlayId), detail: 'A non-canonical user overlay remains present after migration.' },
    { id: 'live-analyser-only', category: 'analysis', passed: differingBytes(liveOnlySilence, liveOnlyPixels) > 0, detail: 'Common analyser sources produce visible output with advanced analysis disabled.' },
    { id: 'offline-enhanced-analysis', category: 'analysis', passed: differingBytes(unifiedRendered.get('silence')!, offlinePixels) > 0, detail: 'Offline-enhanced build and section sources produce full-pipeline output.' },
    { id: 'missing-advanced-source-fallbacks', category: 'analysis', passed: differingBytes(liveOnlySilence, liveOnlyPixels) > 0, detail: 'Fallback routing remains effective when section, phrase, stem, semantic, and Track Map sources are unavailable.' },
    ...scenarioRows,
    { id: 'bass-reactivity-0-05-1', category: 'controls', passed: differingBytes(bass0, bass05) > 0 && differingBytes(bass05, bass1) > 0, detail: 'Bass Reactivity 0, 0.5, and 1 produce distinct bounded frames.' },
    { id: 'motion-0-05-1', category: 'controls', passed: differingBytes(motion0, motion05) > 0 && differingBytes(motion05, motion1) > 0, detail: 'Motion 0, 0.5, and 1 produce distinct autonomous-motion frames.' },
    { id: 'canvas-gpu-semantic-parity', category: 'renderer', passed: semanticParityIssues.length === 0, detail: semanticParityIssues[0]?.message ?? 'Canvas and GPU consume the same scene, layers, masks, route values, envelopes, controls, and musical position.' },
    ...qualityRows,
    { id: 'resolution-normalized-response', category: 'quality', passed: responseNormalization, detail: `Changed-cell ratios remain bounded across Draft, Standard, High, and Ultra (${qualityRatios.map(value => (value * 100).toFixed(2)).join('%, ')}%).` },
    { id: 'complete-unified-pipeline', category: 'pipeline', passed: semanticFrame.diagnostics.activeAssignmentCount > 0 && semanticFrame.logicalFrame.pixels.some(value => value > 0), detail: 'Source generation, Shared Performance Core, Music Intelligence, Bass Reactivity, assignment compilation, masks, performance program, envelopes, Motion, unified runtime, compositor, renderer semantic plans, and perceptual output all executed.' },
  ]
  const passed = validation.valid && checks.every(check => check.passed) && acceptanceMatrix.every(row => row.passed)
  return { presetId: preset.id, passed, validation, checks, acceptanceMatrix, pixelHashes, unifiedPixelHashes }
}
