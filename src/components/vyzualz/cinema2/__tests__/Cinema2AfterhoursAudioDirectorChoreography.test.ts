import { describe, expect, it } from 'vitest'

import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import {
  CINEMA2_AFTERHOURS_TRIGGER_IDS,
  resolveCinema2AfterhoursPulseAuthority,
  resolveCinema2AfterhoursPulseEnvelope,
  resolveCinema2AfterhoursTriggerEventIdentity,
  type Cinema2AfterhoursTriggerId,
} from '../modules/Cinema2AfterhoursNativeModule'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2AfterhoursRandomSource } from '../modules/afterhours/Cinema2AfterhoursDomain'
import { planCinema2AfterhoursShow } from '../modules/afterhours/Cinema2AfterhoursShowPlanner'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import {
  CINEMA2_AFTERHOURS_MODULE_ID,
  CINEMA2_AFTERHOURS_PRESET_ID,
} from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { compileCinema2NativePreset, type Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'

const AVAILABLE_CAPABILITIES = Object.freeze([
  'render.webgl2',
  'render.depth',
  'scene.3d',
  'camera.world',
  'audio.transport',
  'music.beat',
  'music.bar',
  'music.rhythm-events',
  'music.downbeat',
  'music.phrase',
  'music.section',
  'music.drop',
  'music.vocal-presence',
  'visual-director.significance',
] as const)

function compileProductionAfterhours(): Readonly<Cinema2CompiledPresetPlan> {
  const declaration = CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_AFTERHOURS_PRESET_ID)
  if (!declaration) throw new Error('Afterhours 2.0 is not registered in the first-party preset catalog')
  const result = compileCinema2NativePreset(declaration.manifest, { availableCapabilities: AVAILABLE_CAPABILITIES })
  if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n'))
  return result.plan
}

function moduleTarget(plan: Readonly<Cinema2CompiledPresetPlan>, property: string) {
  const target = plan.targets.targets.find(candidate => (
    candidate.kind === 'module'
    && candidate.ownerId === CINEMA2_AFTERHOURS_MODULE_ID
    && candidate.property === property
  ))
  if (!target) throw new Error(`Missing Afterhours module target ${property}`)
  return target
}

function deterministicRandom(value = 0.99): Cinema2AfterhoursRandomSource {
  return Object.freeze({ sample: () => value })
}

function musicFrame(input: {
  frameId: number
  timeSec: number
  sectionType?: MusicIntelligenceFrame['section']['type']
  sectionStartSec?: number
  buildProgress?: number
  buildConfidence?: number
  dropConfidence?: number
  vocalPresence?: number
  beatIndex?: number
  barIndex?: number
  beatHit?: boolean
  downbeatHit?: boolean
  kickHit?: boolean
  snareHit?: boolean
  phrase4Hit?: boolean
  phrase16Hit?: boolean
  phraseMarker?: boolean
  dropMoment?: boolean
}): MusicIntelligenceFrame {
  const beatIndex = input.beatIndex ?? 20
  const barIndex = input.barIndex ?? Math.floor(beatIndex / 4)
  const sectionType = input.sectionType ?? 'verse'
  const sectionStartSec = input.sectionStartSec ?? Math.max(0, input.timeSec - 2)
  const vocalPresence = input.vocalPresence ?? 0
  const phraseMarkers = input.phraseMarker
    ? [{
        id: `phrase-${input.frameId}`,
        timeSec: input.timeSec,
        phraseLength: 8 as const,
        lengthBars: 8 as const,
        barIndex,
        confidence: 0.94,
        source: 'structural_boundary' as const,
        structurallyDetected: true,
      }]
    : []
  const semanticMoments = input.dropMoment
    ? [{
        id: `drop-${input.frameId}`,
        timeSec: input.timeSec,
        type: 'drop_impact' as const,
        confidence: 0.97,
        source: 'structural_analysis' as const,
      }]
    : []

  return {
    ...DEFAULT_MI_FRAME,
    frameId: input.frameId,
    sourceId: 'afterhours-stage5-source',
    trackId: 'afterhours-stage5-track',
    timeSec: input.timeSec,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      normalizedSub: 0.72,
      normalizedBass: 0.76,
      normalizedMid: 0.58,
      normalizedHigh: 0.52,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.96,
      bpmSource: 'offline_analysis',
      beatIndex,
      beatPhase: 0,
      beatInBar: beatIndex % 4,
      barIndex,
      beatHit: input.beatHit ?? false,
      downbeatHit: input.downbeatHit ?? false,
      beatEventTimeSec: input.timeSec,
      kickHit: input.kickHit ?? false,
      kickStrength: input.kickHit ? 1 : 0,
      snareHit: input.snareHit ?? false,
      snareStrength: input.snareHit ? 0.92 : 0,
      transient: input.kickHit || input.snareHit ? 0.94 : 0.18,
      transientConfidence: 0.95,
      phrase4Hit: input.phrase4Hit ?? false,
      phrase4Progress: input.phrase4Hit ? 0 : 0.5,
      phrase16Hit: input.phrase16Hit ?? false,
      phrase16Progress: input.phrase16Hit ? 0 : 0.5,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.78,
      rms: 0.68,
      spectralFlux: input.kickHit || input.snareHit ? 0.9 : 0.28,
      buildProgress: input.buildProgress ?? 0.08,
      tension: Math.max(input.buildProgress ?? 0.08, 0.32),
      trackCurve: sectionType === 'drop' ? 0.96 : 0.72,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: sectionType,
      label: sectionType ?? 'unknown',
      startSec: sectionStartSec,
      endSec: sectionStartSec + 8,
      progress: Math.min(1, Math.max(0, (input.timeSec - sectionStartSec) / 8)),
      intensity: sectionType === 'drop' ? 0.96 : sectionType === 'build' ? 0.78 : 0.55,
      confidence: 0.93,
      source: 'analysis',
    },
    stems: {
      ...DEFAULT_MI_FRAME.stems,
      vocalActivity: vocalPresence,
    },
    semantics: {
      ...DEFAULT_MI_FRAME.semantics,
      buildConfidence: input.buildConfidence ?? (sectionType === 'build' ? 0.92 : 0.08),
      dropConfidence: input.dropConfidence ?? (sectionType === 'drop' ? 0.95 : 0.06),
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: true,
    },
    analysisCapabilities: {
      ...DEFAULT_MI_FRAME.analysisCapabilities!,
      reliableBeatGrid: true,
      reliableDownbeatGrid: true,
      barAwareSections: true,
      selfSimilarityAnalysis: true,
      semanticClassification: true,
      phraseHierarchy: phraseMarkers.length > 0,
      semanticMoments: semanticMoments.length > 0,
      legacyFallbackOnly: false,
    },
    analysisSource: 'bar_self_similarity',
    phraseMarkers,
    semanticMoments,
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 0.94,
      rhythm: 0.96,
      section: 0.93,
    },
  }
}

function transportFrame(audioFrame: ReturnType<Cinema2AudioIntelligenceBridge['capture']>, director: Cinema2VisualDirector): Readonly<Cinema2ModuleFrameReadContext> {
  return Object.freeze({
    frameId: audioFrame.visualFrameId,
    timestampMs: audioFrame.upstream.timeSec * 1000,
    deltaTimeSec: 0.1,
    elapsedTimeSec: audioFrame.upstream.timeSec,
    viewport: Object.freeze({ width: 1280, height: 720, dpr: 1 }),
    contextGeneration: 1,
    transport: Object.freeze({
      sourcePresent: true,
      playing: true,
      analysisActive: true,
      paused: false,
      animationActive: true,
      trackId: audioFrame.upstream.trackId,
      timeSec: audioFrame.upstream.timeSec,
    }),
    audio: audioFrame,
    director: director.capture(audioFrame),
  })
}

function triggerFrame(source: MusicIntelligenceFrame): Readonly<Cinema2ModuleFrameReadContext> {
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => source,
    getPublicationMeta: () => ({ sequence: source.frameId, publishedAtMs: source.timeSec * 1000, publisherId: 'afterhours-trigger-test', kind: 'frame' as const }),
  })
  const audio = bridge.capture(source.frameId)
  return Object.freeze({
    frameId: source.frameId,
    timestampMs: source.timeSec * 1000,
    deltaTimeSec: 0.1,
    elapsedTimeSec: source.timeSec,
    viewport: Object.freeze({ width: 1280, height: 720, dpr: 1 }),
    contextGeneration: 1,
    transport: Object.freeze({
      sourcePresent: true,
      playing: true,
      analysisActive: true,
      paused: false,
      animationActive: true,
      trackId: source.trackId,
      timeSec: source.timeSec,
    }),
    audio,
    director: new Cinema2VisualDirector().capture(audio),
  })
}

describe('Cinema 2.0 Afterhours 2.0 Stage 5 Audio Director choreography', () => {
  it('routes the real first-party manifest through Choreography/Target Runtime into Show Planner performance intent', () => {
    const plan = compileProductionAfterhours()
    const parameterState = new Cinema2ParameterState(plan.parameters)
    const resolver = new Cinema2FinalValueResolver(plan.targets, {
      resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : parameterState.getValue(target.parameterId),
    })
    const choreography = new Cinema2ChoreographyRuntime(plan, parameterState, resolver)
    const director = new Cinema2VisualDirector()
    let upstream = musicFrame({ frameId: 1, timeSec: 9.5, sectionType: 'verse', beatIndex: 19, barIndex: 4 })
    let publicationSequence = 1
    const bridge = new Cinema2AudioIntelligenceBridge({
      getFrame: () => upstream,
      getPublicationMeta: () => ({ sequence: publicationSequence, publishedAtMs: upstream.timeSec * 1000, publisherId: 'afterhours-stage5-integration', kind: 'frame' as const }),
    })

    choreography.update(transportFrame(bridge.capture(1), director))

    upstream = musicFrame({
      frameId: 2,
      timeSec: 10,
      sectionType: 'build',
      sectionStartSec: 10,
      buildProgress: 0.9,
      buildConfidence: 0.95,
      vocalPresence: 0.9,
      beatIndex: 20,
      barIndex: 5,
      beatHit: true,
      downbeatHit: true,
      kickHit: true,
      snareHit: true,
      phrase4Hit: true,
      phrase16Hit: true,
      phraseMarker: true,
    })
    publicationSequence += 1
    choreography.update(transportFrame(bridge.capture(2), director))

    const resolved = (property: string) => Number(resolver.resolve(moduleTarget(plan, property).id).value)
    const performance = Object.freeze({
      intensity: resolved('directorIntensity'),
      build: resolved('directorBuild'),
      impact: resolved('directorImpact'),
      vocalPresence: resolved('vocalPresence'),
      kickAccent: resolved('kickAccent'),
      snareAccent: resolved('snareAccent'),
      downbeatAccent: resolved('downbeatAccent'),
      phraseAccent: resolved('phraseAccent'),
      sectionAccent: resolved('sectionAccent'),
      dropAccent: resolved('dropAccent'),
    })

    expect(performance.intensity).toBeGreaterThan(0)
    expect(performance.build).toBeGreaterThan(0)
    expect(performance.vocalPresence).toBeGreaterThan(0.4)
    expect(performance.kickAccent).toBeGreaterThan(0)
    expect(performance.snareAccent).toBeGreaterThan(0)
    expect(performance.downbeatAccent).toBeGreaterThan(0)
    expect(performance.phraseAccent).toBeGreaterThan(0)
    expect(performance.sectionAccent).toBeGreaterThan(0)

    const baselinePlan = planCinema2AfterhoursShow({
      pattern: 'wideFan', autoPerformance: false, beamCount: 16, symmetry: true, sideLasers: true, topLasers: true, patternChange: 'bar4',
    }, {
      sourceIdentity: 'afterhours-stage5-track', absoluteBarIndex: 5, phraseIdentity: 'phrase-2', dropIdentity: null, hardCutIntent: false,
    }, deterministicRandom())
    const choreographedPlan = planCinema2AfterhoursShow({
      pattern: 'wideFan', autoPerformance: false, beamCount: 16, symmetry: true, sideLasers: true, topLasers: true, patternChange: 'bar4',
    }, {
      sourceIdentity: 'afterhours-stage5-track', absoluteBarIndex: 5, phraseIdentity: 'phrase-2', dropIdentity: null, hardCutIntent: false, performance,
    }, deterministicRandom())

    expect(choreographedPlan.beamCount).toBeLessThan(baselinePlan.beamCount)
    expect(choreographedPlan.spreadScale).toBeLessThan(baselinePlan.spreadScale)
    expect(choreographedPlan.bottomIntensity).toBeGreaterThan(1)
    expect(choreographedPlan.sideIntensity).toBeGreaterThan(1)

    upstream = musicFrame({
      frameId: 3,
      timeSec: 10.5,
      sectionType: 'drop',
      sectionStartSec: 10.5,
      dropConfidence: 0.98,
      vocalPresence: 0.15,
      beatIndex: 21,
      barIndex: 5,
      beatHit: true,
      kickHit: true,
      dropMoment: true,
    })
    publicationSequence += 1
    choreography.update(transportFrame(bridge.capture(3), director))

    expect(resolved('directorImpact')).toBeGreaterThan(0)
    expect(resolved('dropAccent')).toBeGreaterThan(0)
  })

  it('maps every Trigger option to canonical event identity and preserves true bar4/bar8 cadence', () => {
    const frame = triggerFrame(musicFrame({
      frameId: 20,
      timeSec: 20,
      sectionType: 'drop',
      sectionStartSec: 20,
      beatIndex: 32,
      barIndex: 8,
      beatHit: true,
      downbeatHit: true,
      kickHit: true,
      snareHit: true,
      phrase4Hit: true,
      phrase16Hit: true,
      phraseMarker: true,
      dropMoment: true,
    }))

    for (const trigger of CINEMA2_AFTERHOURS_TRIGGER_IDS) {
      expect(resolveCinema2AfterhoursTriggerEventIdentity(frame, trigger, 19.5), trigger).not.toBeNull()
    }

    const nonBoundary = triggerFrame(musicFrame({
      frameId: 21,
      timeSec: 20.5,
      beatIndex: 24,
      barIndex: 6,
      beatHit: true,
      phrase4Hit: true,
    }))
    expect(resolveCinema2AfterhoursTriggerEventIdentity(nonBoundary, 'bar', 20)).not.toBeNull()
    expect(resolveCinema2AfterhoursTriggerEventIdentity(nonBoundary, 'bar4', 20)).toBeNull()
    expect(resolveCinema2AfterhoursTriggerEventIdentity(nonBoundary, 'bar8', 20)).toBeNull()
  })

  it('does not invent trigger impulses without active audio and makes Pulse Amount/Decay authoritative', () => {
    const active = triggerFrame(musicFrame({
      frameId: 30,
      timeSec: 30,
      beatIndex: 48,
      barIndex: 12,
      beatHit: true,
      kickHit: true,
      phrase4Hit: true,
    }))
    const noAudio = Object.freeze({ ...active, audio: null })
    const paused = Object.freeze({
      ...active,
      transport: Object.freeze({ ...active.transport!, playing: false, paused: true, animationActive: false }),
    })

    for (const trigger of CINEMA2_AFTERHOURS_TRIGGER_IDS as readonly Cinema2AfterhoursTriggerId[]) {
      expect(resolveCinema2AfterhoursTriggerEventIdentity(noAudio, trigger, 29.5), trigger).toBeNull()
      expect(resolveCinema2AfterhoursTriggerEventIdentity(paused, trigger, 29.5), trigger).toBeNull()
    }

    expect(resolveCinema2AfterhoursPulseAuthority(1, 0)).toBe(0)
    expect(resolveCinema2AfterhoursPulseAuthority(1, 1)).toBe(1)
    expect(resolveCinema2AfterhoursPulseAuthority(0.5, 1)).toBe(0.5)

    const lowDecay = resolveCinema2AfterhoursPulseEnvelope(active, 30.15, 30, 0)
    const highDecay = resolveCinema2AfterhoursPulseEnvelope(active, 30.15, 30, 1)
    expect(lowDecay).toBe(0)
    expect(highDecay).toBeGreaterThan(lowDecay)
  })
})
