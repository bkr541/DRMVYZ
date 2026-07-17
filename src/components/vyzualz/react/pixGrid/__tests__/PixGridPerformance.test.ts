import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import {
  buildSharedPerformanceContext,
  type SharedPerformanceActionIntent,
  type SharedPerformanceContext,
} from '../../../../../features/performanceCore'
import type { ReactTrackSection } from '../../ReactTypes'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  PIX_GRID_PERFORMANCE_PROGRAMS,
  PIX_GRID_PRESET_ID_BY_PROGRAM,
  validatePixGridPerformancePrograms,
} from '../PixGridPerformancePrograms'
import {
  limitPixGridPerformanceIntents,
  MAX_PIX_GRID_PERFORMANCE_ACTIONS,
  resolvePixGridPerformanceFrame,
} from '../PixGridPerformanceRuntime'
import { applyPixGridPresetSettings } from '../PixGridState'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { normalizePixGridState } from '../PixGridValidation'
import type { PixGridPerformanceAction } from '../PixGridPerformanceTypes'
import type { PixGridState } from '../PixGridTypes'

const HIGH_CONFIDENCE_SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.3, source: 'auto', confidence: 0.95 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 8, endSec: 24, intensity: 0.55, source: 'auto', confidence: 0.95 },
  { id: 'build', label: 'Build', type: 'build', startSec: 24, endSec: 32, intensity: 0.8, source: 'auto', confidence: 0.95 },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 32, endSec: 64, intensity: 1, source: 'auto', confidence: 0.95, interpretation: { familyId: 'drop-family', occurrenceIndex: 1 } },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 64, endSec: 80, intensity: 0.35, source: 'auto', confidence: 0.95 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 80, endSec: 112, intensity: 1, source: 'auto', confidence: 0.95, interpretation: { familyId: 'drop-family', occurrenceIndex: 2 } },
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 112, endSec: 128, intensity: 0.25, source: 'auto', confidence: 0.95 },
]

type FrameOptions = {
  beat?: boolean
  downbeat?: boolean
  kick?: boolean
  snare?: boolean
  hat?: boolean
  transient?: number
  semanticMoment?: boolean
  sectionConfidence?: number
  sectionsAvailable?: boolean
  trackId?: string
}

function frameAt(timeSec: number, options: FrameOptions = {}): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const confidence = options.sectionConfidence ?? 0.95
  const sectionsAvailable = options.sectionsAvailable ?? true
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.round(timeSec * 60)),
    sourceId: options.trackId ?? 'track-a',
    trackId: options.trackId ?? 'track-a',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      bass: 0.82,
      mid: 0.62,
      high: 0.48,
      normalizedBass: 0.82,
      normalizedMid: 0.62,
      normalizedHigh: 0.48,
      volume: 0.78,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.98,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: options.beat ?? false,
      downbeatHit: options.downbeat ?? false,
      kickHit: options.kick ?? false,
      kickStrength: options.kick ? 1 : 0,
      snareHit: options.snare ?? false,
      snareStrength: options.snare ? 1 : 0,
      hatHit: options.hat ?? false,
      hatStrength: options.hat ? 1 : 0,
      transient: options.transient ?? 0,
      transientConfidence: options.transient ? 1 : 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.84,
      shortTerm: 0.8,
      longTerm: 0.62,
      percentile: 0.86,
      buildProgress: timeSec >= 24 && timeSec < 32 ? (timeSec - 24) / 8 : 0,
      dropImpact: options.kick ? 0.8 : 0,
      tension: 0.58,
      complexity: 0.6,
      spectralFlux: options.transient ?? 0.3,
    },
    semanticMoments: options.semanticMoment
      ? [{ id: `moment-${timeSec}`, timeSec, durationSec: 0.2, type: 'major_impact', confidence: 0.96, source: 'structural_analysis' }]
      : [],
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: sectionsAvailable,
      trackEnergyCurve: true,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: Math.max(confidence, 0.8),
      rhythm: 0.98,
      section: confidence,
    },
  }
}

function contextAt(
  timeSec: number,
  options: FrameOptions & {
    previous?: SharedPerformanceContext | null
    seekIdentity?: string
    loopIdentity?: string
    trackChangeIdentity?: string
    sections?: readonly ReactTrackSection[]
  } = {},
): SharedPerformanceContext {
  const trackId = options.trackId ?? 'track-a'
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec, options),
    resolvedSections: options.sections ?? (options.sectionsAvailable === false ? [] : HIGH_CONFIDENCE_SECTIONS),
    durationSec: 128,
    trackIdentity: trackId,
    seekIdentity: options.seekIdentity ?? 'seek-0',
    loopIdentity: options.loopIdentity ?? 'loop-0',
    trackChangeIdentity: options.trackChangeIdentity ?? trackId,
    previous: options.previous ?? null,
  })
}

function stateForPreset(presetId: string): PixGridState {
  const preset = PIX_GRID_PRESET_BY_ID.get(presetId)
  if (!preset) throw new Error(`Missing PixGrid preset ${presetId}`)
  return applyPixGridPresetSettings(createDefaultPixGridState(), presetId, preset.pixGridSettings)
}

function render(presetId: string, context: SharedPerformanceContext) {
  return resolvePixGridPerformanceFrame(stateForPreset(presetId), context, presetId)
}

describe('PixGrid Shared Performance choreography', () => {
  it('validates all three authored programs without errors', () => {
    expect(PIX_GRID_PERFORMANCE_PROGRAMS.map(program => program.id)).toEqual([
      'pix-grid-bass-beacon-performance',
      'pix-grid-geometric-reactor-performance',
      'pix-grid-pixel-parade-performance',
    ])
    expect(Object.values(PIX_GRID_PRESET_ID_BY_PROGRAM)).toEqual([
      'pix-grid-bass-beacon',
      'pix-grid-geometric-reactor',
      'pix-grid-pixel-parade',
    ])
    expect(validatePixGridPerformancePrograms()).toEqual([])
  })

  it('migrates legacy preset state to its matching authored program', () => {
    const geometric = stateForPreset('pix-grid-geometric-reactor')
    const migrated = normalizePixGridState({ ...geometric, version: 6, performance: undefined })
    expect(migrated.performance.sharedPerformanceProgramId).toBe('pix-grid-geometric-reactor-performance')
    expect(migrated.performance.enabled).toBe(true)
  })

  it('matches scenes and applies entry, body, and exit phase actions', () => {
    const entry = render('pix-grid-bass-beacon', contextAt(32.1))
    const body = render('pix-grid-bass-beacon', contextAt(40))
    const exit = render('pix-grid-bass-beacon', contextAt(63.6))

    expect(entry.snapshot.sceneId).toBe('bass-drop-one')
    expect(entry.snapshot.sectionPhase).toBe('entry')
    expect(entry.snapshot.recentActionReasons).toContain('sectionEntry')
    expect(body.snapshot.sectionPhase).toBe('body')
    expect(body.snapshot.recentActionReasons).toContain('sectionBody')
    expect(exit.snapshot.sectionPhase).toBe('exit')
    expect(exit.snapshot.recentActionReasons).toContain('sectionExit')
  })

  it('routes beat, downbeat, kick, snare, hat, transient, and semantic events independently', () => {
    const intro = render('pix-grid-bass-beacon', contextAt(2, { beat: true, downbeat: true }))
    expect(intro.snapshot.recentActionReasons).toContain('downbeat')

    const drop = render('pix-grid-bass-beacon', contextAt(40, {
      beat: true,
      kick: true,
      snare: true,
      hat: true,
      transient: 0.9,
      semanticMoment: true,
    }))
    expect(drop.snapshot.recentActionReasons).toEqual(expect.arrayContaining(['kick', 'snare', 'hat', 'semanticMoment']))
    expect(drop.appliedActions.filter(action => action.type === 'flashGroup').length).toBeGreaterThanOrEqual(4)
  })

  it('applies four-bar motifs, eight-bar recruitment, and sixteen-bar evolution', () => {
    const first = render('pix-grid-geometric-reactor', contextAt(34))
    const evolved = render('pix-grid-geometric-reactor', contextAt(58))
    expect(first.snapshot.recentActionReasons).toEqual(expect.arrayContaining([
      'fourBarMotif',
      'eightBarRecruitment',
      'sixteenBarEvolution',
    ]))
    expect(evolved.snapshot.fourBarStage).toBeGreaterThan(first.snapshot.fourBarStage)
    expect(evolved.snapshot.eightBarStage).toBeGreaterThanOrEqual(first.snapshot.eightBarStage)
    expect(evolved.snapshot.sixteenBarStage).toBeGreaterThanOrEqual(first.snapshot.sixteenBarStage)
    expect(evolved.appliedActions).not.toEqual(first.appliedActions)
  })

  it('evolves repeated drops by occurrence without replacing each preset identity', () => {
    const dropOneContext = contextAt(40)
    const dropTwoContext = contextAt(88)
    expect(dropTwoContext.fineSectionOccurrence).toBe(2)
    expect(dropTwoContext.dropOccurrence).toBe(2)

    for (const presetId of ['pix-grid-bass-beacon', 'pix-grid-geometric-reactor', 'pix-grid-pixel-parade']) {
      const first = render(presetId, dropOneContext)
      const second = render(presetId, dropTwoContext)
      expect(first.snapshot.sceneId).toMatch(/drop-one$/)
      expect(second.snapshot.sceneId).toMatch(/drop-evolved$/)
      expect(second.snapshot.programId).toBe(first.snapshot.programId)
      expect(second.appliedActions).not.toEqual(first.appliedActions)
    }
  })

  it('selects deterministic variations at the same track position', () => {
    const first = render('pix-grid-pixel-parade', contextAt(40))
    const second = render('pix-grid-pixel-parade', contextAt(40))
    expect(second.snapshot.variationId).toBe(first.snapshot.variationId)
    expect(second.snapshot.deterministicIdentity).toBe(first.snapshot.deterministicIdentity)
    expect(second.state.layers).toEqual(first.state.layers)
  })

  it('uses the program attached to the active preset when persisted selection is stale', () => {
    const bass = stateForPreset('pix-grid-bass-beacon')
    const stale = {
      ...bass,
      performance: {
        ...bass.performance,
        sharedPerformanceProgramId: 'pix-grid-pixel-parade-performance' as const,
      },
    }
    const resolved = resolvePixGridPerformanceFrame(stale, contextAt(40), 'pix-grid-bass-beacon')
    expect(resolved.snapshot.programId).toBe('pix-grid-bass-beacon-performance')
    expect(resolved.snapshot.sceneId).toBe('bass-drop-one')
  })

  it('rebuilds from authored state for seeks, loop wraps, and track replacement', () => {
    const base = stateForPreset('pix-grid-bass-beacon')
    const lateDrop = contextAt(63.8)
    const dropFrame = resolvePixGridPerformanceFrame(base, lateDrop, 'pix-grid-bass-beacon')
    expect(base).not.toEqual(dropFrame.state)

    const seekContext = contextAt(10, { previous: lateDrop, seekIdentity: 'seek-back' })
    const freshContext = contextAt(10, { seekIdentity: 'seek-back' })
    expect(seekContext.seekDetected).toBe(true)
    expect(resolvePixGridPerformanceFrame(base, seekContext, 'pix-grid-bass-beacon').state.layers)
      .toEqual(resolvePixGridPerformanceFrame(base, freshContext, 'pix-grid-bass-beacon').state.layers)

    const loopContext = contextAt(32.1, { previous: lateDrop, loopIdentity: 'loop-1' })
    expect(loopContext.loopWrapDetected).toBe(true)
    const loopA = resolvePixGridPerformanceFrame(base, loopContext, 'pix-grid-bass-beacon')
    const loopB = resolvePixGridPerformanceFrame(base, loopContext, 'pix-grid-bass-beacon')
    expect(loopA.state.layers).toEqual(loopB.state.layers)

    const replaced = contextAt(40, { previous: lateDrop, trackId: 'track-b', trackChangeIdentity: 'track-b' })
    expect(replaced.trackReplacementDetected).toBe(true)
    expect(resolvePixGridPerformanceFrame(base, replaced, 'pix-grid-bass-beacon').snapshot.deterministicIdentity)
      .not.toBe(dropFrame.snapshot.deterministicIdentity)
  })

  it('uses safe grid choreography when analysis is missing or low confidence', () => {
    const missing = render('pix-grid-bass-beacon', contextAt(12, { sectionsAvailable: false, sections: [] }))
    expect(missing.snapshot.sceneId).toBe('bass-fallback')
    expect(missing.snapshot.fallbackState).toMatch(/BPM\/grid fallback/i)

    const lowConfidenceSections = HIGH_CONFIDENCE_SECTIONS.map(section => ({ ...section, confidence: 0.2 }))
    const low = render('pix-grid-bass-beacon', contextAt(40, {
      sectionConfidence: 0.2,
      sections: lowConfidenceSections,
      semanticMoment: false,
    }))
    expect(low.snapshot.sceneId).toBe('bass-fallback')
    expect(low.snapshot.fallbackState).toMatch(/Low-confidence/i)
    expect(low.snapshot.recentActionReasons).not.toContain('semanticMoment')
  })

  it('caps pathological action batches deterministically', () => {
    const intents: SharedPerformanceActionIntent<PixGridPerformanceAction>[] = Array.from(
      { length: MAX_PIX_GRID_PERFORMANCE_ACTIONS + 12 },
      (_, index) => ({ reason: 'scene', identity: `intent-${index}`, action: { type: 'setDensity', density: 1 } }),
    )
    const limited = limitPixGridPerformanceIntents(intents)
    expect(limited.intents).toHaveLength(MAX_PIX_GRID_PERFORMANCE_ACTIONS)
    expect(limited.decisions).toEqual([`PixGrid action intents clamped ${intents.length} → ${MAX_PIX_GRID_PERFORMANCE_ACTIONS}`])
    expect(limited.intents[limited.intents.length - 1]?.identity).toBe(`intent-${MAX_PIX_GRID_PERFORMANCE_ACTIONS - 1}`)
  })

  it('honors manual route locks without mutating authored state', () => {
    const base = stateForPreset('pix-grid-bass-beacon')
    const locked = {
      ...base,
      performance: { ...base.performance, lockedRoutes: ['group:bass-body-group'] },
    }
    const bodyLayer = base.layers.find(layer => layer.id === 'bass-word')
    const resolved = resolvePixGridPerformanceFrame(locked, contextAt(40), 'pix-grid-bass-beacon')
    expect(resolved.snapshot.manualOverrideRoutes).toEqual(['group:bass-body-group'])
    expect(resolved.state.layers.find(layer => layer.id === 'bass-word')?.opacity).toBe(bodyLayer?.opacity)
    expect(base.performance.lockedRoutes).toEqual([])
  })

  it('reports layer locks as clearable manual overrides', () => {
    const base = stateForPreset('pix-grid-bass-beacon')
    const lockedLayerId = base.layers[0]?.id
    const locked = {
      ...base,
      layers: base.layers.map((layer, index) => index === 0 ? { ...layer, locked: true } : layer),
    }
    const resolved = resolvePixGridPerformanceFrame(locked, contextAt(40), 'pix-grid-bass-beacon')
    expect(resolved.snapshot.manualOverrideRoutes).toContain(`layer:${lockedLayerId}`)
  })

  it('keeps the three programs visually and structurally distinct', () => {
    const context = contextAt(40)
    const frames = [
      render('pix-grid-bass-beacon', context),
      render('pix-grid-geometric-reactor', context),
      render('pix-grid-pixel-parade', context),
    ]
    expect(new Set(frames.map(frame => frame.snapshot.programId)).size).toBe(3)
    expect(new Set(frames.map(frame => frame.snapshot.sceneId)).size).toBe(3)
    expect(new Set(frames.map(frame => frame.state.layers.map(layer => layer.id).join('|'))).size).toBe(3)
  })
})
