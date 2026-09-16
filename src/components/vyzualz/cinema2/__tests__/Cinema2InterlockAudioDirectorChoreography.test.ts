import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import {
  cinema2InterlockNativeModuleDefinition,
} from '../modules/Cinema2InterlockNativeModule'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleFrameReadContext,
  Cinema2ModuleResourceFacet,
} from '../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import {
  CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID,
  CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID,
  CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID,
  CINEMA2_INTERLOCK_MODULE_ID,
  CINEMA2_INTERLOCK_PRESET_MANIFEST,
} from '../presets/Cinema2InterlockPreset'
import { compileCinema2NativePreset, type Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'

const AVAILABLE_CAPABILITIES = Object.freeze([
  'render.webgl2', 'render.history', 'audio.transport', 'audio.bands', 'audio.features',
  'music.rhythm-events', 'music.beat', 'music.downbeat', 'music.bar', 'music.phrase',
  'music.section', 'music.drop', 'music.vocal-presence', 'visual-director.significance',
] as const)

function compileInterlock(): Readonly<Cinema2CompiledPresetPlan> {
  const result = compileCinema2NativePreset(CINEMA2_INTERLOCK_PRESET_MANIFEST, { availableCapabilities: AVAILABLE_CAPABILITIES })
  if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n'))
  return result.plan
}

function musicFrame(input: {
  frameId: number
  timeSec: number
  sectionType?: MusicIntelligenceFrame['section']['type']
  buildProgress?: number
  vocalPresence?: number
  kick?: boolean
  snare?: boolean
  drop?: boolean
}): MusicIntelligenceFrame {
  const sectionType = input.sectionType ?? 'verse'
  const beatIndex = Math.floor(input.timeSec * 2)
  return {
    ...DEFAULT_MI_FRAME,
    frameId: input.frameId,
    sourceId: 'interlock-stage6-source',
    trackId: 'interlock-stage6-track',
    timeSec: input.timeSec,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      normalizedSub: 0.75,
      normalizedBass: 0.8,
      normalizedHigh: 0.6,
      normalizedAir: 0.5,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.96,
      bpmSource: 'offline_analysis',
      beatIndex,
      beatPhase: 0,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: Boolean(input.kick || input.snare),
      downbeatHit: beatIndex % 4 === 0 && Boolean(input.kick || input.snare),
      beatEventTimeSec: input.timeSec,
      kickHit: Boolean(input.kick),
      kickStrength: input.kick ? 1 : 0,
      snareHit: Boolean(input.snare),
      snareStrength: input.snare ? 0.9 : 0,
      transient: input.kick || input.snare ? 0.95 : 0.2,
      transientConfidence: 0.96,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.86,
      rms: 0.75,
      spectralFlux: input.kick || input.snare ? 0.9 : 0.3,
      buildProgress: input.buildProgress ?? 0,
      tension: input.buildProgress ?? 0,
      trackCurve: sectionType === 'drop' ? 1 : 0.7,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: sectionType,
      label: sectionType ?? 'unknown',
      startSec: Math.max(0, input.timeSec - 0.1),
      endSec: input.timeSec + 4,
      progress: 0.1,
      intensity: sectionType === 'drop' ? 1 : sectionType === 'build' ? 0.8 : 0.55,
      confidence: 0.96,
      source: 'analysis',
    },
    stems: {
      ...DEFAULT_MI_FRAME.stems,
      vocalActivity: input.vocalPresence ?? 0.1,
    },
    semantics: {
      ...DEFAULT_MI_FRAME.semantics,
      buildConfidence: sectionType === 'build' ? 0.96 : 0.1,
      dropConfidence: sectionType === 'drop' ? 0.99 : 0.04,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      stemCurves: true,
      trackEnergyCurve: true,
    },
    analysisCapabilities: {
      ...DEFAULT_MI_FRAME.analysisCapabilities!,
      reliableBeatGrid: true,
      reliableDownbeatGrid: true,
      barAwareSections: true,
      selfSimilarityAnalysis: true,
      semanticClassification: true,
      semanticMoments: Boolean(input.drop),
      legacyFallbackOnly: false,
    },
    semanticMoments: input.drop ? [{
      id: 'interlock-drop-hero',
      timeSec: input.timeSec,
      type: 'drop_impact' as const,
      confidence: 0.99,
      source: 'structural_analysis' as const,
    }] : [],
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 0.96,
      rhythm: 0.96,
      section: 0.96,
    },
  }
}

function transportFrame(
  audio: ReturnType<Cinema2AudioIntelligenceBridge['capture']>,
  director: Cinema2VisualDirector,
): Readonly<Cinema2ModuleFrameReadContext> {
  return Object.freeze({
    frameId: audio.visualFrameId,
    timestampMs: audio.upstream.timeSec * 1000,
    deltaTimeSec: 0.1,
    elapsedTimeSec: audio.upstream.timeSec,
    viewport: Object.freeze({ width: 1280, height: 720, dpr: 1 }),
    contextGeneration: 1,
    transport: Object.freeze({
      sourcePresent: true,
      playing: true,
      analysisActive: true,
      paused: false,
      animationActive: true,
      trackId: audio.upstream.trackId,
      timeSec: audio.upstream.timeSec,
    }),
    audio,
    director: director.capture(audio),
  })
}

function moduleTarget(plan: Readonly<Cinema2CompiledPresetPlan>, ownerId: string, property: string) {
  const target = plan.targets.targets.find(candidate => candidate.kind === 'module' && candidate.ownerId === ownerId && candidate.property === property)
  if (!target) throw new Error(`Missing Interlock target ${ownerId}.${property}`)
  return target
}

class TestResources implements Cinema2ModuleResourceFacet {
  private readonly leases = new Map<string, { value: unknown; dispose: (value: never) => void }>()
  constructor(private readonly gl: WebGL2RenderingContext) {}
  acquire<T>(key: string, _kind: string, create: (gl: WebGL2RenderingContext) => T, dispose: (value: T) => void): T {
    const existing = this.leases.get(key)
    if (existing) return existing.value as T
    const value = create(this.gl)
    this.leases.set(key, { value, dispose: dispose as (value: never) => void })
    return value
  }
  getSnapshot() { return { activeLeaseCount: this.leases.size, disposedLeaseCount: 0 } }
}

describe('Cinema 2.0 Interlock Stage 6 Audio Intelligence and choreography', () => {
  it('follows Audio Bridge -> Director -> Choreography -> module target -> native renderer on a first drop', () => {
    const plan = compileInterlock()
    const state = new Cinema2ParameterState(plan.parameters)
    const resolver = new Cinema2FinalValueResolver(plan.targets, {
      resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
    })
    const choreography = new Cinema2ChoreographyRuntime(plan, state, resolver)
    const director = new Cinema2VisualDirector()

    let upstream = musicFrame({ frameId: 1, timeSec: 9.5 })
    let sequence = 1
    const bridge = new Cinema2AudioIntelligenceBridge({
      getFrame: () => upstream,
      getPublicationMeta: () => ({ sequence, publishedAtMs: upstream.timeSec * 1000, publisherId: 'interlock-stage6-integration', kind: 'frame' as const }),
    })

    const moduleManifest = plan.manifest.modules?.find(module => module.id === CINEMA2_INTERLOCK_MODULE_ID)
    if (!moduleManifest) throw new Error('Missing Interlock native module manifest')
    const moduleTargets = new Map(plan.targets.targets
      .filter(target => target.kind === 'module' && target.ownerId === CINEMA2_INTERLOCK_MODULE_ID)
      .map(target => [target.property, target]))
    const parameterFacet = {
      getAuthored: (name: string) => moduleManifest.parameters?.[name],
      resolve: (name: string) => {
        const target = moduleTargets.get(name)
        return target ? resolver.resolve(target.id) : null
      },
      get: (name: string) => {
        const target = moduleTargets.get(name)
        if (!target) return undefined
        const resolved = resolver.resolve(target.id)
        return resolved.ok ? resolved.value : undefined
      },
    }
    const targetFacet = {
      getTarget: (targetId: Parameters<typeof resolver.getTarget>[0]) => resolver.getTarget(targetId),
      resolve: (targetId: Parameters<typeof resolver.resolve>[0], contributions = [], authority = 'base' as const) => resolver.resolve(targetId, contributions, authority),
      dispatch: (targetId: Parameters<typeof resolver.dispatch>[0], contributions: Parameters<typeof resolver.dispatch>[1]) => resolver.dispatch(targetId, contributions),
    }
    const gl = createCinemaMockWebGL()
    gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
    const stream = { next: () => 0.2, nextInt: () => 0, probability: () => false }
    const createContext: Cinema2ModuleCreateContext = {
      module: moduleManifest,
      parameters: parameterFacet,
      targets: targetFacet,
      media: { get: () => null, getSlot: () => null },
      resources: new TestResources(gl),
      randomness: {
        sample: () => 0.2,
        probability: (_purpose, probability) => probability > 0.2,
        stream: () => stream as never,
        eventStream: () => stream as never,
      },
    }
    const instance = cinema2InterlockNativeModuleDefinition.create(createContext)
    const provider = instance.render?.providers[0]
    if (!provider) throw new Error('Expected Interlock native provider')

    const runFrame = () => {
      const frame = transportFrame(bridge.capture(upstream.frameId), director)
      choreography.update(frame)
      instance.lifecycle.update({ frame, parameters: parameterFacet, targets: targetFacet })
      provider.execute({ frame, target: null, width: frame.viewport.width, height: frame.viewport.height, depthAvailable: false })
      return frame
    }

    runFrame()
    upstream = musicFrame({ frameId: 2, timeSec: 10, sectionType: 'build', buildProgress: 0.95, vocalPresence: 0.8, kick: true, snare: true })
    sequence += 1
    runFrame()

    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_MODULE_ID, 'directorBuild').id).value)).toBeGreaterThan(0)
    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_MODULE_ID, 'kickAccent').id).value)).toBeGreaterThan(0)
    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_MODULE_ID, 'snareAccent').id).value)).toBeGreaterThan(0)
    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID, 'backgroundBuild').id).value)).toBeGreaterThan(0)

    upstream = musicFrame({ frameId: 3, timeSec: 10.5, sectionType: 'drop', drop: true, kick: true })
    sequence += 1
    runFrame()

    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_MODULE_ID, 'dropAccent').id).value)).toBeGreaterThan(0)
    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_BACKGROUND_MODULE_ID, 'backgroundDropImpact').id).value)).toBeGreaterThan(0)
    const programCalls = (gl.uniform1i as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .filter(call => (call[0] as { name?: string } | null)?.name === 'uSegmentProgram')
    const impactCalls = (gl.uniform1f as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .filter(call => (call[0] as { name?: string } | null)?.name === 'uSegmentImpact')
    expect(programCalls.at(-1)?.[1]).toBe(8) // Impact Burst on the first significant drop hero.
    expect(Number(impactCalls.at(-1)?.[1])).toBeGreaterThan(0)
    expect((gl.drawArraysInstanced as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)?.[3]).toBe(28)

    expect(state.setPersistentValue(CINEMA2_INTERLOCK_AUTO_PERFORMANCE_ID, false)).toMatchObject({ ok: true })
    upstream = musicFrame({ frameId: 4, timeSec: 11, sectionType: 'verse' })
    sequence += 1
    runFrame()
    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_MODULE_ID, 'directorIntensity').id).value)).toBeGreaterThan(0)
    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_MODULE_ID, 'bassEnergy').id).value)).toBeGreaterThan(0)

    expect(state.setPersistentValue(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID, 0)).toMatchObject({ ok: true })
    upstream = musicFrame({ frameId: 5, timeSec: 11.5, sectionType: 'verse' })
    sequence += 1
    runFrame()
    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_MODULE_ID, 'directorIntensity').id).value)).toBe(0)
    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_MODULE_ID, 'bassEnergy').id).value)).toBe(0)

    expect(state.setPersistentValue(CINEMA2_INTERLOCK_MASTER_REACTIVITY_ID, 1)).toMatchObject({ ok: true })
    upstream = musicFrame({ frameId: 6, timeSec: 12, sectionType: 'verse' })
    sequence += 1
    runFrame()
    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_MODULE_ID, 'directorIntensity').id).value)).toBeGreaterThan(0)
    expect(Number(resolver.resolve(moduleTarget(plan, CINEMA2_INTERLOCK_MODULE_ID, 'bassEnergy').id).value)).toBeGreaterThan(0)

    instance.lifecycle.dispose()
    choreography.dispose()
  })
})
