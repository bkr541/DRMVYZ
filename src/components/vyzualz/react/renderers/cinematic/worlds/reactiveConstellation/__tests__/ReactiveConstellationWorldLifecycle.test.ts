import { describe, expect, it, vi } from 'vitest'
import {
  CINEMATIC_AUDIO_EVENT_SOURCES,
  CINEMATIC_AUDIO_SOURCES,
  type CinematicAudioSource,
} from '../../../../../CinematicWorldConfig'
import {
  REACTIVE_CONSTELLATION_DEFAULTS,
  type ReactiveConstellationSettings,
} from '../../../../../CinematicWorldSettings'
import type { CinematicNormalizedAudioFrame } from '../../../CinematicAudioModulation'
import type { CinematicFrameContext, CinematicWebGLServices } from '../../../../CinematicWorldRenderer'
import { ReactiveConstellationWorld } from '../../ReactiveConstellationWorld'

const ALL_CAPABILITIES: CinematicNormalizedAudioFrame['capabilities'] = {
  musicIntelligence: true,
  broadBands: true,
  detailedBands: true,
  transientEvents: true,
  kickEvents: true,
  snareEvents: true,
  beatTiming: true,
  downbeatTiming: true,
  barTiming: true,
  phraseTiming: true,
  sectionTiming: true,
  buildProgress: true,
  dropState: true,
  trackEnergyCurve: true,
  vocalEnergy: true,
}

function normalizedAudio(options: {
  frameId: number
  events?: Partial<CinematicNormalizedAudioFrame['events']>
  values?: Partial<Record<CinematicAudioSource, number>>
  capabilities?: Partial<CinematicNormalizedAudioFrame['capabilities']>
}): CinematicNormalizedAudioFrame {
  const values = Object.assign(
    Object.fromEntries(CINEMATIC_AUDIO_SOURCES.map(source => [source, 0])) as Record<CinematicAudioSource, number>,
    options.values,
  )
  return {
    frameId: options.frameId,
    sourceId: 'source-a',
    trackId: 'track-a',
    transportTimeSec: 48,
    isPlaying: true,
    values,
    events: {
      ...Object.fromEntries(CINEMATIC_AUDIO_EVENT_SOURCES.map(source => [source, false])) as CinematicNormalizedAudioFrame['events'],
      ...options.events,
    },
    timing: {
      bpm: 150,
      beatPhase: 0,
      beatIndex: 120,
      beatInBar: 0,
      barIndex: 30,
      barPosition: 0,
      phraseProgress: 0.75,
    },
    section: {
      type: null,
      label: '',
      startSec: 0,
      endSec: 0,
      progress: 0,
      intensity: 0,
      confidence: 0,
      source: 'unknown',
    },
    capabilities: { ...ALL_CAPABILITIES, ...options.capabilities },
    resetReasons: [],
  }
}

function burstFrame(audio: CinematicNormalizedAudioFrame, sources: CinematicAudioSource[]): CinematicFrameContext {
  return {
    musicalAudio: audio,
    config: {
      audioMapping: {
        enabled: true,
        routes: sources.map((source, index) => ({
          id: `burst-${source}-${index}`,
          source,
          target: 'burstImpulse',
          enabled: true,
          amount: 1,
        })),
      },
    },
  } as unknown as CinematicFrameContext
}

function crimsonSettings(): ReactiveConstellationSettings {
  return {
    ...REACTIVE_CONSTELLATION_DEFAULTS,
    choreographyProfile: 'crimsonLaunch',
    expansionBurstImpulse: 1.9,
  }
}

interface FakeGpuHarness {
  services: CinematicWebGLServices
  createdBuffers: WebGLBuffer[]
  createdVaos: WebGLVertexArrayObject[]
  deletedBuffers: WebGLBuffer[]
  deletedVaos: WebGLVertexArrayObject[]
  programLabels: string[]
}

function createHarness(): FakeGpuHarness {
  const createdBuffers: WebGLBuffer[] = []
  const createdVaos: WebGLVertexArrayObject[] = []
  const deletedBuffers: WebGLBuffer[] = []
  const deletedVaos: WebGLVertexArrayObject[] = []
  const programLabels: string[] = []
  const gl = {
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    DYNAMIC_DRAW: 0x88e8,
    FLOAT: 0x1406,
    createBuffer: () => {
      const buffer = { id: `buffer-${createdBuffers.length}` } as unknown as WebGLBuffer
      createdBuffers.push(buffer)
      return buffer
    },
    createVertexArray: () => {
      const vao = { id: `vao-${createdVaos.length}` } as unknown as WebGLVertexArrayObject
      createdVaos.push(vao)
      return vao
    },
    bindVertexArray: () => undefined,
    bindBuffer: () => undefined,
    bufferData: () => undefined,
    enableVertexAttribArray: () => undefined,
    vertexAttribPointer: () => undefined,
    vertexAttribDivisor: () => undefined,
    deleteBuffer: (buffer: WebGLBuffer) => deletedBuffers.push(buffer),
    deleteVertexArray: (vao: WebGLVertexArrayObject) => deletedVaos.push(vao),
  } as unknown as WebGL2RenderingContext

  const resources = {
    trackBuffer: (buffer: WebGLBuffer) => buffer,
    trackVAO: (vao: WebGLVertexArrayObject) => vao,
    untrackBuffer: () => undefined,
    untrackVAO: () => undefined,
  }
  const program = {} as never
  const services = {
    gl,
    resources,
    compileProgram: (descriptor: { label: string }) => {
      programLabels.push(descriptor.label)
      return program
    },
  } as unknown as CinematicWebGLServices

  return { services, createdBuffers, createdVaos, deletedBuffers, deletedVaos, programLabels }
}

describe('ReactiveConstellationWorld GPU lifecycle', () => {
  it('allocates both node and beam programs and disposes every tracked VAO and buffer once', () => {
    const harness = createHarness()
    const world = new ReactiveConstellationWorld()
    world.initialize({ services: harness.services, config: {} as never, presetId: 'test' })

    expect(harness.programLabels).toEqual([
      'cinematic/world/reactiveConstellation/nodes',
      'cinematic/world/reactiveConstellation/beams',
    ])
    expect(harness.createdBuffers.length).toBeGreaterThan(0)
    expect(harness.createdVaos.length).toBeGreaterThan(0)

    world.dispose()
    world.dispose()
    expect(harness.deletedBuffers).toHaveLength(harness.createdBuffers.length)
    expect(harness.deletedVaos).toHaveLength(harness.createdVaos.length)
  })

  it('drops invalid context-owned handles without deleting them and allows a clean restored instance', () => {
    const lostHarness = createHarness()
    const lostWorld = new ReactiveConstellationWorld()
    lostWorld.initialize({ services: lostHarness.services, config: {} as never, presetId: 'lost' })
    lostWorld.onContextLost()
    lostWorld.onContextRestored()
    lostWorld.dispose()
    expect(lostHarness.deletedBuffers).toHaveLength(0)
    expect(lostHarness.deletedVaos).toHaveLength(0)

    const restoredHarness = createHarness()
    const restoredWorld = new ReactiveConstellationWorld()
    restoredWorld.initialize({ services: restoredHarness.services, config: {} as never, presetId: 'restored' })
    restoredWorld.dispose()
    expect(restoredHarness.deletedBuffers).toHaveLength(restoredHarness.createdBuffers.length)
    expect(restoredHarness.deletedVaos).toHaveLength(restoredHarness.createdVaos.length)
  })

  it('turns one kick event into one bounded secondary radial impulse', () => {
    const world = new ReactiveConstellationWorld()
    const internals = world as unknown as {
      heldBurstImpulse: number
      resolveBurstTrigger: (
        frame: CinematicFrameContext,
        performanceSequence: number | null,
        settings: ReactiveConstellationSettings,
      ) => { sequence: number; impulse: number } | null
    }
    internals.heldBurstImpulse = 0.72
    const frame = burstFrame(normalizedAudio({ frameId: 11, events: { kick: true } }), ['kick', 'dropEntry'])

    const first = internals.resolveBurstTrigger(frame, null, crimsonSettings())
    const duplicate = internals.resolveBurstTrigger(frame, null, crimsonSettings())
    const nextFrame = burstFrame(normalizedAudio({ frameId: 12 }), ['kick', 'dropEntry'])

    expect(first?.impulse).toBeCloseTo(0.72)
    expect(first?.impulse).toBeLessThanOrEqual(1.05)
    expect(duplicate).toBeNull()
    expect(internals.resolveBurstTrigger(nextFrame, null, crimsonSettings())).toBeNull()
  })

  it('uses drop entry for the primary launch and a restrained downbeat fallback when drop data is unavailable', () => {
    const world = new ReactiveConstellationWorld()
    const internals = world as unknown as {
      heldBurstImpulse: number
      resolveBurstTrigger: (
        frame: CinematicFrameContext,
        performanceSequence: number | null,
        settings: ReactiveConstellationSettings,
      ) => { sequence: number; impulse: number } | null
    }
    internals.heldBurstImpulse = 1.56
    const settings = crimsonSettings()
    const drop = internals.resolveBurstTrigger(
      burstFrame(normalizedAudio({ frameId: 21, events: { dropEntry: true } }), ['dropEntry', 'kick']),
      null,
      settings,
    )
    const fallback = internals.resolveBurstTrigger(
      burstFrame(normalizedAudio({
        frameId: 22,
        events: { downbeat: true },
        values: { buildProgress: 0.92, overallEnergy: 0.86, transientIntensity: 0.74 },
        capabilities: { dropState: false, sectionTiming: false },
      }), ['dropEntry', 'kick']),
      null,
      settings,
    )
    const noActiveDropRoute = internals.resolveBurstTrigger(
      burstFrame(normalizedAudio({
        frameId: 23,
        events: { downbeat: true },
        values: { buildProgress: 0.95, overallEnergy: 0.9, transientIntensity: 0.8 },
        capabilities: { dropState: false, sectionTiming: false },
      }), ['kick']),
      null,
      settings,
    )

    expect(drop?.impulse).toBe(1.9)
    expect(fallback?.impulse).toBeCloseTo(1.9 * 0.44)
    expect(fallback!.impulse).toBeLessThan(drop!.impulse)
    expect(noActiveDropRoute).toBeNull()
  })

  it('restarts center expansion for manual reset, seek, loop discontinuity, and track replacement', () => {
    const harness = createHarness()
    const world = new ReactiveConstellationWorld()
    world.initialize({ services: harness.services, config: {} as never, presetId: 'paused-reset' })
    const internals = world as unknown as {
      applyPendingReset: () => void
      simulation: { resetExpansion: () => void }
      trails: { reset: () => void }
      pendingReset: string | null
    }
    const resetSimulation = vi.spyOn(internals.simulation, 'resetExpansion')
    const resetTrails = vi.spyOn(internals.trails, 'reset')

    world.reset('manualReset')
    expect(internals.pendingReset).toBe('manualReset')
    internals.applyPendingReset()
    expect(resetSimulation).toHaveBeenCalledTimes(1)
    expect(resetTrails).toHaveBeenCalledTimes(2)

    world.reset('seek')
    expect(internals.pendingReset).toBe('seek')
    expect(resetTrails).toHaveBeenCalledTimes(3)
    internals.applyPendingReset()

    expect(resetSimulation).toHaveBeenCalledTimes(2)
    expect(resetTrails).toHaveBeenCalledTimes(4)
    expect(internals.pendingReset).toBeNull()

    world.reset('timingDiscontinuity')
    expect(internals.pendingReset).toBe('timingDiscontinuity')
    internals.applyPendingReset()
    expect(resetSimulation).toHaveBeenCalledTimes(3)

    world.reset('trackReplacement')
    expect(internals.pendingReset).toBe('trackReplacement')
    internals.applyPendingReset()
    expect(resetSimulation).toHaveBeenCalledTimes(4)
    expect(resetTrails).toHaveBeenCalledTimes(8)
    expect(internals.pendingReset).toBeNull()
    world.dispose()
  })

  it('preserves the frozen physical frame across a normal pause and resume', () => {
    const harness = createHarness()
    const world = new ReactiveConstellationWorld()
    world.initialize({ services: harness.services, config: {} as never, presetId: 'pause-resume' })
    const internals = world as unknown as {
      simulation: { resetExpansion: () => void; synchronizeTiming: () => void }
      pendingReset: string | null
    }
    const resetExpansion = vi.spyOn(internals.simulation, 'resetExpansion')
    const synchronizeTiming = vi.spyOn(internals.simulation, 'synchronizeTiming')

    world.reset('transportRestart')

    expect(synchronizeTiming).toHaveBeenCalledTimes(1)
    expect(resetExpansion).not.toHaveBeenCalled()
    expect(internals.pendingReset).toBeNull()
    world.dispose()
  })

  it('restarts expansion when a track identity appears or is replaced after the world has rendered', () => {
    const harness = createHarness()
    const world = new ReactiveConstellationWorld()
    world.initialize({ services: harness.services, config: {} as never, presetId: 'track-load' })
    const internals = world as unknown as {
      observeTrackIdentity: (frame: { musicalAudio?: { trackId: string | null; sourceId: string | null } }) => void
      applyPendingReset: () => void
      simulation: { resetExpansion: () => void }
      hasRendered: boolean
      pendingReset: string | null
    }
    const resetExpansion = vi.spyOn(internals.simulation, 'resetExpansion')

    internals.observeTrackIdentity({ musicalAudio: { trackId: null, sourceId: null } })
    internals.hasRendered = true
    internals.observeTrackIdentity({ musicalAudio: { trackId: 'track-a', sourceId: 'source-a' } })
    expect(internals.pendingReset).toBe('trackReplacement')
    internals.applyPendingReset()
    expect(resetExpansion).toHaveBeenCalledTimes(1)

    internals.observeTrackIdentity({ musicalAudio: { trackId: 'track-b', sourceId: 'source-b' } })
    expect(internals.pendingReset).toBe('trackReplacement')
    internals.applyPendingReset()
    expect(resetExpansion).toHaveBeenCalledTimes(2)
    world.dispose()
  })

  it('does not leak WebGL resources across repeated preset or world switches', () => {
    const harness = createHarness()
    for (let index = 0; index < 6; index += 1) {
      const world = new ReactiveConstellationWorld()
      world.initialize({ services: harness.services, config: {} as never, presetId: `switch-${index}` })
      world.reset('presetChanged')
      world.dispose()
    }

    expect(harness.programLabels).toHaveLength(12)
    expect(harness.deletedBuffers).toHaveLength(harness.createdBuffers.length)
    expect(harness.deletedVaos).toHaveLength(harness.createdVaos.length)
    expect(new Set(harness.deletedBuffers).size).toBe(harness.deletedBuffers.length)
    expect(new Set(harness.deletedVaos).size).toBe(harness.deletedVaos.length)
  })
})
