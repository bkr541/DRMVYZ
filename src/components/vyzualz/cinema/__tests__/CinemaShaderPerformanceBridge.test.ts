import { describe, expect, it } from 'vitest'
import type { ShaderDefinition, ShaderParamValues } from '../../react/shaders/registry/shaderRegistryTypes'
import { shaderRegistry } from '../../react/shaders/registry'
import { PRODUCTION_SCENES } from '../../react/shaders/scenes'
import { LEGACY_REACTOR_SCENE_IDS, REACTOR_SCENE_ID } from '../../react/shaders/scenes/reactor'
import { CinemaShaderPerformanceBridge } from '../CinemaShaderPerformanceBridge'
import {
  cinemaShaderParameterId,
  cinemaShaderSceneTypeId,
  createCinemaShaderSceneComposition,
} from '../CinemaShaderSceneAdapter'
import {
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
} from '../CinemaFoundation'
import type { CinemaActionId, CinemaEventId } from '../CinemaIdentifiers'
import type { CinemaFrameContext } from '../CinemaRendererContracts'

describe('Cinema canonical Shader performance bridge', () => {
  it('finds a canonical performance program for every imported production Shader scene', () => {
    for (const scene of PRODUCTION_SCENES) {
      expect(shaderRegistry.get(scene.id)?.performanceProgram?.id).toBe(scene.performanceProgram?.id)
      expect(scene.performanceProgram?.authoredRoutes.length).toBeGreaterThan(0)
    }
  })

  it('executes authored Wobble Glyph Forge and Melodic Rift Bloom gestures', () => {
    const wobble = shaderRegistry.get('shader-wobble-glyph-forge')!
    const wobbleNeutral = resolveFresh(wobble, performanceFrame())
    const wobbleKick = resolveFresh(wobble, performanceFrame({ kick: true, bass: 1 }))
    expect(number(wobbleKick.values.bodyScale)).toBeGreaterThan(number(wobbleNeutral.values.bodyScale))

    const melodic = shaderRegistry.get('shader-melodic-rift-bloom')!
    const melodicNeutral = resolveFresh(melodic, performanceFrame())
    const melodicSnare = resolveFresh(melodic, performanceFrame({ snare: true, high: 1 }))
    const melodicVocal = resolveFresh(melodic, performanceFrame({ lyrics: true, vocalPresence: 1 }))
    expect(number(melodicSnare.values.emberDensity)).toBeGreaterThan(number(melodicNeutral.values.emberDensity))
    expect(number(melodicVocal.values.riftWidth)).toBeGreaterThan(number(melodicNeutral.values.riftWidth))
  })

  it('resolves Reactor kick, snare, build, drop, phrase, and energy behavior independently', () => {
    const reactor = shaderRegistry.get(REACTOR_SCENE_ID)!
    const neutral = resolveFresh(reactor, performanceFrame())
    const kick = resolveFresh(reactor, performanceFrame({ kick: true, bass: 1 }))
    const snare = resolveFresh(reactor, performanceFrame({ snare: true, mid: 1 }))
    const build = resolveFresh(reactor, performanceFrame({ sectionType: 'build', buildProgress: 1 }))
    const drop = resolveFresh(reactor, performanceFrame({ sectionType: 'drop', dropImpact: 1, dropStart: true }))
    const phrase = resolveFresh(reactor, performanceFrame({ phrase16: true }))
    const energy = resolveFresh(reactor, performanceFrame({ energy: 1 }))

    expect(number(kick.values.coreSize)).toBeGreaterThan(number(neutral.values.coreSize))
    expect(number(snare.values.shockwaveIntensity)).toBeGreaterThan(number(neutral.values.shockwaveIntensity))
    expect(number(build.values.buildContraction)).toBeLessThan(number(neutral.values.buildContraction))
    expect(number(drop.values.dropForce)).toBeGreaterThan(number(neutral.values.dropForce))
    expect(number(phrase.values.semanticResponse)).toBeGreaterThan(number(neutral.values.semanticResponse))
    expect(number(energy.values.overallGlow)).toBeGreaterThan(number(neutral.values.overallGlow))
  })

  it('falls back safely without a program and suppresses unavailable authored sources', () => {
    const programless = shaderRegistry.get('shader-dev-solid-color')!
    const fallback = resolveFresh(programless, performanceFrame({ analyser: false, musicIntelligence: false }))
    expect(fallback.snapshot.active).toBe(false)
    expect(fallback.values).toMatchObject(programless.defaults)

    const wobble = shaderRegistry.get('shader-wobble-glyph-forge')!
    const unavailable = resolveFresh(wobble, performanceFrame({ analyser: false, musicIntelligence: false, sharedPerformance: false }))
    expect(Object.values(unavailable.values).every(value => value !== undefined)).toBe(true)
  })

  it('reconstructs the same deterministic values after seek and loop resets', () => {
    const reactor = shaderRegistry.get(REACTOR_SCENE_ID)!
    const target = performanceFrame({ sectionType: 'drop', kick: true, bass: 1, dropImpact: 1, dropStart: true })
    const expected = new CinemaShaderPerformanceBridge(reactor).resolve(target, { ...reactor.defaults })
    const bridge = new CinemaShaderPerformanceBridge(reactor)
    bridge.resolve(performanceFrame(), { ...reactor.defaults })
    const seek = bridge.resolve(withReset(target, 'seek', 1), { ...reactor.defaults })
    bridge.resolve(performanceFrame(), { ...reactor.defaults })
    const loop = bridge.resolve(withReset(target, 'loop-wrap', 2), { ...reactor.defaults })
    expect(seek.values).toEqual(expected.values)
    expect(loop.values).toEqual(expected.values)
    expect(seek.snapshot.deterministicIdentity).toBe(expected.snapshot.deterministicIdentity)
    expect(loop.snapshot.deterministicIdentity).toBe(expected.snapshot.deterministicIdentity)
  })

  it('reports invalid authored routes and program targets without throwing', () => {
    const base = shaderRegistry.get(REACTOR_SCENE_ID)!
    const invalid = {
      ...base,
      performanceProgram: {
        ...base.performanceProgram!,
        authoredRoutes: [{
          ...base.performanceProgram!.authoredRoutes[0],
          targetParamId: 'missing-route-target',
          fallbackTargetParamIds: [],
        }],
        scenes: base.performanceProgram!.scenes.map((scene, index) => index === 0 ? {
          ...scene,
          actions: [{
            type: 'param' as const,
            targetParamId: 'missing-program-target',
            operation: 'addNormalized' as const,
            value: 0.5,
          }],
        } : scene),
      },
    } satisfies ShaderDefinition
    const resolution = resolveFresh(invalid, performanceFrame({ sectionType: 'intro' }))
    expect(resolution.invalidRoutes['builtin:shader-reactor:kick-core']).toBeDefined()
    expect(resolution.snapshot.invalidTargetIds).toContain('missing-program-target')
  })

  it('migrates legacy Reactor scene IDs to the canonical node and recipe values', () => {
    const composition = createCinemaShaderSceneComposition(
      LEGACY_REACTOR_SCENE_IDS.semantic,
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
    )
    const node = composition.nodes.find(candidate => candidate.family === 'shader')!
    expect(node.typeId).toBe(cinemaShaderSceneTypeId(REACTOR_SCENE_ID))
    expect(node.parameterValues[cinemaShaderParameterId('shrapnelEnabled')]).toBe(false)
    expect(composition.metadata.tags).toContain(`legacy-source:${LEGACY_REACTOR_SCENE_IDS.semantic}`)
  })
})

function resolveFresh(definition: ShaderDefinition, frame: Readonly<CinemaFrameContext>) {
  return new CinemaShaderPerformanceBridge(definition).resolve(frame, { ...definition.defaults } as ShaderParamValues)
}

function performanceFrame(options: Partial<{
  sectionType: string
  kick: boolean
  snare: boolean
  dropStart: boolean
  phrase16: boolean
  bass: number
  mid: number
  high: number
  energy: number
  buildProgress: number
  dropImpact: number
  vocalPresence: number
  analyser: boolean
  musicIntelligence: boolean
  sharedPerformance: boolean
  lyrics: boolean
}> = {}): Readonly<CinemaFrameContext> {
  const sectionType = options.sectionType ?? 'verse'
  const clock = (spanBeats: number, hit = false) => ({
    available: true,
    spanBeats,
    index: 1,
    phase: 0.25,
    hit,
    eventId: hit ? `clock-${spanBeats}` as CinemaEventId : null,
  })
  const eventId = (active: boolean, name: string) => active ? name as CinemaEventId : null
  return {
    version: 1,
    viewport: { width: 1280, height: 720, dpr: 1 },
    timing: {
      frameIndex: 10,
      elapsedTimeSec: 4,
      deltaTimeSec: 1 / 60,
      seeds: { composition: 11, track: 12, musicalPosition: 13, event: 14 },
    },
    transport: {
      trackId: 'shader-performance-test',
      audioTimeSec: 4,
      durationSec: 64,
      playing: true,
      paused: false,
      seeking: false,
      looped: false,
      visibilitySuspended: false,
      discontinuity: false,
      discontinuityReasons: [],
      reset: { required: false, reconstruct: false, generation: 0, reasons: [], actionIds: [], identity: null },
    },
    audio: {
      available: options.analyser ?? true,
      volume: options.energy ?? 0,
      rms: options.energy ?? 0,
      energy: options.energy ?? 0,
      bass: options.bass ?? 0,
      mid: options.mid ?? 0,
      high: options.high ?? 0,
      sub: options.bass ?? 0,
      centroid: 0,
      flux: 0,
      harmonicity: 0,
      complexity: 0,
      tension: options.buildProgress ?? 0,
      buildProgress: options.buildProgress ?? 0,
      dropImpact: options.dropImpact ?? 0,
      vocalPresence: options.vocalPresence ?? 0,
      fft: null,
      waveform: null,
    },
    music: {
      available: true,
      source: 'music-intelligence',
      bpm: 120,
      beatIndex: 8,
      beatPhase: 0,
      beatInBar: 0,
      barIndex: 2,
      phraseIndex: 0,
      sectionId: `section-${sectionType}`,
      sectionType,
      sectionProgress: 0.25,
      resolvedSections: [{
        id: `section-${sectionType}`,
        label: sectionType,
        type: sectionType,
        startSec: 0,
        endSec: 16,
        intensity: options.energy ?? 0.5,
        confidence: 1,
        source: 'auto',
        dropConfidence: options.dropImpact ?? 0,
        familyId: null,
        occurrenceIndex: 1,
      }],
      clocks: {
        beat: false,
        beat2: false,
        beat4: false,
        bar: false,
        bar4: false,
        bar8: false,
        phrase: options.phrase16 ?? false,
        states: {
          beat: clock(1),
          beat2: clock(2),
          beat4: clock(4),
          bar: clock(4),
          bar4: clock(16),
          bar8: clock(32),
          phrase: clock(16, options.phrase16 ?? false),
        },
      },
    },
    impulses: {
      beat: options.kick === true || options.snare === true,
      downbeat: false,
      kick: options.kick ?? false,
      snare: options.snare ?? false,
      transient: options.kick === true || options.snare === true,
      sectionStart: options.dropStart ?? false,
      dropStart: options.dropStart ?? false,
      lyricCue: false,
      lyricWord: false,
      phrase4: false,
      phrase8: false,
      eventIds: {
        beat: eventId(options.kick === true || options.snare === true, 'beat-1'),
        downbeat: null,
        kick: eventId(options.kick === true, 'kick-1'),
        snare: eventId(options.snare === true, 'snare-1'),
        transient: eventId(options.kick === true || options.snare === true, 'transient-1'),
        sectionStart: eventId(options.dropStart === true, 'section-1'),
        dropStart: eventId(options.dropStart === true, 'drop-1'),
        lyricCue: null,
        lyricWord: null,
        phrase4: null,
        phrase8: null,
      },
    },
    lyrics: {
      available: options.lyrics ?? false,
      sourceIdentity: options.lyrics ? 'lyrics-1' : null,
      lineId: options.lyrics ? 'line-1' : null,
      lineText: options.lyrics ? 'test lyric' : null,
      wordId: null,
      wordText: null,
      lineProgress: options.lyrics ? 0.5 : 0,
      wordProgress: 0,
      lineActive: options.lyrics ?? false,
      lineAbsent: !(options.lyrics ?? false),
      vocalsActive: options.vocalPresence ? options.vocalPresence > 0 : false,
    },
    performance: { events: [], actionIds: [] as CinemaActionId[], toggleStates: {} },
    brand: { available: false, colors: {} },
    capabilities: {
      analyser: options.analyser ?? true,
      musicIntelligence: options.musicIntelligence ?? true,
      beatGrid: true,
      authoritativeSections: true,
      lyrics: options.lyrics ?? false,
      brandKit: false,
      sharedPerformance: options.sharedPerformance ?? true,
      mediaAssets: false,
    },
    activeCameraId: null,
    camera: null,
  }
}

function number(value: unknown): number {
  expect(typeof value).toBe('number')
  return value as number
}

function withReset(
  frame: Readonly<CinemaFrameContext>,
  reason: 'seek' | 'loop-wrap',
  generation: number,
): Readonly<CinemaFrameContext> {
  return {
    ...frame,
    transport: {
      ...frame.transport,
      seeking: reason === 'seek',
      looped: reason === 'loop-wrap',
      discontinuity: true,
      discontinuityReasons: [reason],
      reset: {
        required: true,
        reconstruct: true,
        generation,
        reasons: [reason],
        actionIds: [reason === 'seek' ? 'cinema.reset.seek' : 'cinema.reset.loop-wrap'],
        identity: `${reason}-${generation}`,
      },
    },
  }
}
