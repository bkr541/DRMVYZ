import { describe, expect, it, vi } from 'vitest'
import { createCinematicWorldConfig } from '../../../CinematicWorldConfig'
import { AFTERHOURS_DEFAULTS } from '../../../CinematicWorldSettings'
import { DEFAULT_REACT_PRESETS } from '../../../ReactTypes'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext, CinematicWebGLServices } from '../../CinematicWorldRenderer'
import { DEFAULT_REACT_RENDER_PARAMS } from '../../reactRenderUtils'
import { AFTERHOURS_BOTTOM_EMITTERS, AFTERHOURS_MAX_BEAMS, buildAfterhoursBeamSlots } from './AfterhoursBeamGeometry'
import { afterhoursWorldDefinition } from './AfterhoursWorld'

function frame(settings: Partial<typeof AFTERHOURS_DEFAULTS> = {}): CinematicFrameContext {
  const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-afterhours')!
  const config = createCinematicWorldConfig('afterhours', settings)
  return {
    elapsedTimeSec: 2,
    deltaTimeSec: 1 / 60,
    transportTimeSec: 12,
    frameIndex: 120,
    resolution: { width: 1280, height: 720 },
    devicePixelRatio: 1,
    audio: {
      raw: { bass: 0.9, mid: 0.8, high: 0.7, volume: 0.9 },
      smoothed: { bass: 0.9, mid: 0.8, high: 0.7, volume: 0.9 },
      spectrum: null,
      waveform: null,
    },
    beat: { hit: true, phase: 0.25, bpm: 142, kick: 1, snare: 1, transient: 1, beatIndex: 12, beatInBar: 0, barIndex: 3, barProgress: 0, downbeat: true },
    section: { type: 'drop', startSec: 8, endSec: 24, progress: 0.25, changed: false, analysis: null },
    config,
    transition: { mode: config.transition.mode, active: false, progress: 1, fromWorld: null, toWorld: 'afterhours' },
    randomSeed: config.seed,
    preset,
    presetId: preset.id,
    params: DEFAULT_REACT_RENDER_PARAMS,
  }
}

function createWorldHarness() {
  const calls = new Map<string, number[][]>()
  const record = (name: string, values: number[]) => calls.set(name, [...(calls.get(name) ?? []), values])
  const program = {
    activate: vi.fn(),
    setFloat: vi.fn((name: string, value: number) => record(name, [value])),
    setVec2: vi.fn((name: string, x: number, y: number) => record(name, [x, y])),
    setVec3: vi.fn((name: string, x: number, y: number, z: number) => record(name, [x, y, z])),
    setVec4: vi.fn((name: string, x: number, y: number, z: number, w: number) => record(name, [x, y, z, w])),
  } as unknown as ShaderProgram
  const compileProgram = vi.fn(() => program)
  const run = vi.fn()
  const services = {
    compileProgram,
    fullscreenPass: { run },
  } as unknown as CinematicWebGLServices
  const world = afterhoursWorldDefinition.create()
  world.initialize({ services, config: createCinematicWorldConfig('afterhours', {}), presetId: 'preset-afterhours' })
  world.resize({ width: 1280, height: 720, dpr: 1 })
  return { world, calls, compileProgram, run }
}

function last(calls: Map<string, number[][]>, name: string): number[] {
  const values = calls.get(name) ?? []
  return values[values.length - 1] ?? []
}

describe('Afterhours Stage 1B world foundation', () => {
  it('owns exactly 10 stable fixed bottom emitters and deterministically reuses them above 10 beams', () => {
    expect(AFTERHOURS_BOTTOM_EMITTERS).toHaveLength(10)
    expect(Object.isFrozen(AFTERHOURS_BOTTOM_EMITTERS)).toBe(true)
    expect(AFTERHOURS_BOTTOM_EMITTERS.map(origin => origin.x)).toEqual([0.07, 0.165, 0.26, 0.355, 0.45, 0.55, 0.645, 0.74, 0.835, 0.93])
    expect(AFTERHOURS_BOTTOM_EMITTERS.every(origin => origin.y === 0.025 && Object.isFrozen(origin))).toBe(true)

    for (const beamCount of [2, 8, 10, 16]) {
      const slots = buildAfterhoursBeamSlots({ beamCount, spread: 0.65, accentMix: 0.25 })
      expect(slots).toHaveLength(AFTERHOURS_MAX_BEAMS)
      expect(slots.filter(slot => slot.active)).toHaveLength(beamCount)
      expect(slots.slice(beamCount).every(slot => !slot.active)).toBe(true)
    }
    const sixteen = buildAfterhoursBeamSlots({ beamCount: 16, spread: 0.65, accentMix: 0.25 })
    expect(sixteen[10].origin).toEqual(AFTERHOURS_BOTTOM_EMITTERS[0])
    expect(sixteen[15].origin).toEqual(AFTERHOURS_BOTTOM_EMITTERS[5])
    expect(buildAfterhoursBeamSlots({ beamCount: 16, spread: 0.65, accentMix: 0.25 })).toEqual(sixteen)
  })

  it('keeps Spread 0 and 1 bounded, upward, finite, and nondegenerate', () => {
    const compact = buildAfterhoursBeamSlots({ beamCount: 16, spread: 0, accentMix: 0.25 }).filter(slot => slot.active)
    const wide = buildAfterhoursBeamSlots({ beamCount: 16, spread: 1, accentMix: 0.25 }).filter(slot => slot.active)
    for (const slot of [...compact, ...wide]) {
      expect(Number.isFinite(slot.target.x) && Number.isFinite(slot.target.y)).toBe(true)
      expect(slot.target.x).toBeGreaterThanOrEqual(0)
      expect(slot.target.x).toBeLessThanOrEqual(1)
      expect(slot.target.y).toBeGreaterThan(slot.origin.y)
      expect(slot.target.y).toBeLessThanOrEqual(1)
      expect(Math.hypot(slot.target.x - slot.origin.x, slot.target.y - slot.origin.y)).toBeGreaterThan(0.1)
    }
    const width = (slots: typeof compact) => Math.max(...slots.map(slot => slot.target.x)) - Math.min(...slots.map(slot => slot.target.x))
    expect(width(wide)).toBeGreaterThan(width(compact))
  })

  it('maps Accent Mix 0 and 1 to deterministic all-primary and all-accent roles', () => {
    expect(buildAfterhoursBeamSlots({ beamCount: 16, spread: 0.65, accentMix: 0 }).filter(slot => slot.active).every(slot => !slot.accent)).toBe(true)
    expect(buildAfterhoursBeamSlots({ beamCount: 16, spread: 0.65, accentMix: 1 }).filter(slot => slot.active).every(slot => slot.accent)).toBe(true)
  })

  it('writes parameter-dependent production uniforms, clears inactive slots, and compiles once per lifecycle', () => {
    const harness = createWorldHarness()
    harness.world.render(frame({
      backgroundColor: '#102030',
      primaryColor: '#204060',
      accentColor: '#80a0c0',
      accentMix: 1,
      beamCount: 2,
      spread: 1,
      atmosphere: 0.9,
    }), { framebuffer: null, texture: null, width: 1280, height: 720 })
    harness.world.render(frame({ beamCount: 16, spread: 0, accentMix: 0, atmosphere: 0.1 }), { framebuffer: null, texture: null, width: 1280, height: 720 })

    expect(harness.compileProgram).toHaveBeenCalledTimes(1)
    expect(harness.run).toHaveBeenCalledTimes(2)
    expect(last(harness.calls, 'uAfterhoursBackground')).toEqual([0, 0, 0])
    expect(last(harness.calls, 'uAfterhoursAtmosphere')).toEqual([0.1])
    expect(last(harness.calls, 'uAfterhoursBeamMeta0')).toEqual([1, 0])
    expect(last(harness.calls, 'uAfterhoursBeamMeta15')).toEqual([1, 0])

    const firstPassMeta15 = harness.calls.get('uAfterhoursBeamMeta15')?.[0]
    const firstPassBeam15 = harness.calls.get('uAfterhoursBeam15')?.[0]
    expect(firstPassMeta15).toEqual([0, 0])
    expect(firstPassBeam15).toEqual([0, 0, 0, 0])
    harness.world.dispose()
  })

  it('registers a real WebGL2 fullscreen world with no generic modulation or LaserDMX dependency contract', () => {
    expect(afterhoursWorldDefinition).toMatchObject({ id: 'afterhours', label: 'Afterhours', backend: 'webgl2' })
    expect(afterhoursWorldDefinition.capabilities).toMatchObject({
      cameraRigs: ['locked'], modulationTargets: [], supportsFullscreenPasses: true, supportsGeometryPasses: false,
    })
  })
})
