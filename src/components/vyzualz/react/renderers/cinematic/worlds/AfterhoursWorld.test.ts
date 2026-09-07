import { describe, expect, it, vi } from 'vitest'
import { createCinematicWorldConfig } from '../../../CinematicWorldConfig'
import { AFTERHOURS_DEFAULTS } from '../../../CinematicWorldSettings'
import { DEFAULT_REACT_PRESETS } from '../../../ReactTypes'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'
import { DEFAULT_REACT_RENDER_PARAMS } from '../../reactRenderUtils'
import { AFTERHOURS_BOTTOM_EMITTERS, AFTERHOURS_MAX_BEAMS, generateAfterhoursBeams } from './AfterhoursBeamGeometry'
import { parseAfterhoursHexColor, resolveAfterhoursPalette } from './AfterhoursColor'
import { AFTERHOURS_FRAGMENT_SOURCE } from './AfterhoursShader'
import { afterhoursWorldDefinition } from './AfterhoursWorld'

const AFTERHOURS_PRESET = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-afterhours')!

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
  } as unknown as Parameters<ReturnType<typeof afterhoursWorldDefinition.create>['initialize']>[0]['services']
  const world = afterhoursWorldDefinition.create()
  world.initialize({ services, config: createCinematicWorldConfig('afterhours', {}), presetId: 'preset-afterhours' })
  world.resize({ width: 1280, height: 720, dpr: 1 })
  return { world, calls, compileProgram, run }
}

function last(calls: Map<string, number[][]>, name: string): number[] {
  const values = calls.get(name) ?? []
  return values[values.length - 1] ?? []
}

describe('Afterhours Stage 2 world integration', () => {
  it('registers a real WebGL2 fullscreen world with no generic modulation or LaserDMX dependency contract', () => {
    expect(afterhoursWorldDefinition).toMatchObject({ id: 'afterhours', label: 'Afterhours', backend: 'webgl2' })
    expect(afterhoursWorldDefinition.capabilities).toMatchObject({
      cameraRigs: ['locked'], modulationTargets: [], supportsFullscreenPasses: true, supportsGeometryPasses: false,
    })
  })

  it('writes exactly the generator output into beam uniforms and zeroes inactive slots', () => {
    const harness = createWorldHarness()
    const settings = { pattern: 'cross' as const, sideLasers: true, beamCount: 6, spread: 0.4, accentMix: 1, atmosphere: 0.8 }
    harness.world.render(frame(settings), { framebuffer: null, texture: null, width: 1280, height: 720 })

    const expected = generateAfterhoursBeams({ ...AFTERHOURS_DEFAULTS, ...settings })
    for (let index = 0; index < AFTERHOURS_MAX_BEAMS; index += 1) {
      const beam = expected[index]
      if (beam.active) {
        expect(last(harness.calls, `uAfterhoursBeam${index}`)).toEqual([beam.origin.x, beam.origin.y, beam.target.x, beam.target.y])
        expect(last(harness.calls, `uAfterhoursBeamMeta${index}`)).toEqual([1, beam.accent ? 1 : 0])
      } else {
        expect(last(harness.calls, `uAfterhoursBeam${index}`)).toEqual([0, 0, 0, 0])
        expect(last(harness.calls, `uAfterhoursBeamMeta${index}`)).toEqual([0, 0])
      }
    }
    harness.world.dispose()
  })

  it('re-clears slots that were active on a previous frame and compiles once per lifecycle', () => {
    const harness = createWorldHarness()
    harness.world.render(frame({ beamCount: 16, pattern: 'fan' }), { framebuffer: null, texture: null, width: 1280, height: 720 })
    harness.world.render(frame({ beamCount: 3, pattern: 'fan' }), { framebuffer: null, texture: null, width: 1280, height: 720 })

    expect(harness.compileProgram).toHaveBeenCalledTimes(1)
    expect(harness.run).toHaveBeenCalledTimes(2)
    expect(last(harness.calls, 'uAfterhoursBeamMeta15')).toEqual([0, 0])
    expect(last(harness.calls, 'uAfterhoursBeam15')).toEqual([0, 0, 0, 0])
    expect(last(harness.calls, 'uAfterhoursBeamMeta2')).toEqual([1, 0])
    harness.world.dispose()
  })

  it('keeps Stage-1 color and atmosphere uniforms working', () => {
    const harness = createWorldHarness()
    harness.world.render(frame({ backgroundColor: '#000000', atmosphere: 0.1 }), { framebuffer: null, texture: null, width: 1280, height: 720 })
    expect(last(harness.calls, 'uAfterhoursBackground')).toEqual([0, 0, 0])
    expect(last(harness.calls, 'uAfterhoursAtmosphere')).toEqual([0.1])
    harness.world.dispose()
  })

  it('Manual color mode sends the persisted Primary/Accent hues to the shader', () => {
    const harness = createWorldHarness()
    harness.world.render(frame({ colorMode: 'manual', primaryColor: '#204060', accentColor: '#a0c0e0' }), { framebuffer: null, texture: null, width: 1280, height: 720 })
    expect(last(harness.calls, 'uAfterhoursPrimary')).toEqual([0x20 / 255, 0x40 / 255, 0x60 / 255])
    expect(last(harness.calls, 'uAfterhoursAccent')).toEqual([0xa0 / 255, 0xc0 / 255, 0xe0 / 255])
    harness.world.dispose()
  })

  it('Auto color mode derives from the Cinema preset palette and ignores persisted Primary/Accent', () => {
    const harness = createWorldHarness()
    harness.world.render(frame({ colorMode: 'auto', primaryColor: '#111111', accentColor: '#222222' }), { framebuffer: null, texture: null, width: 1280, height: 720 })
    const expected = resolveAfterhoursPalette(
      { colorMode: 'auto', primaryColor: '#111111', accentColor: '#222222' },
      { primary: AFTERHOURS_PRESET.palette.primary, accent: AFTERHOURS_PRESET.palette.accent, secondary: AFTERHOURS_PRESET.palette.secondary },
    )
    expect(last(harness.calls, 'uAfterhoursPrimary')).toEqual([expected.primary.r, expected.primary.g, expected.primary.b])
    expect(last(harness.calls, 'uAfterhoursPrimary')).not.toEqual([0x11 / 255, 0x11 / 255, 0x11 / 255])
    // Background is unaffected by Color Mode.
    harness.world.render(frame({ colorMode: 'auto', backgroundColor: '#0a0b0c' }), { framebuffer: null, texture: null, width: 1280, height: 720 })
    expect(last(harness.calls, 'uAfterhoursBackground')).toEqual([parseAfterhoursHexColor('#0a0b0c', { r: 0, g: 0, b: 0 })].flatMap(c => [c.r, c.g, c.b]))
    harness.world.dispose()
  })

  it('clamps Atmosphere to 0..1 and never emits a non-finite uniform', () => {
    const harness = createWorldHarness()
    harness.world.render(frame({ atmosphere: 5 }), { framebuffer: null, texture: null, width: 1280, height: 720 })
    expect(last(harness.calls, 'uAfterhoursAtmosphere')).toEqual([1])
    harness.world.render(frame({ atmosphere: -3 }), { framebuffer: null, texture: null, width: 1280, height: 720 })
    expect(last(harness.calls, 'uAfterhoursAtmosphere')).toEqual([0])
    for (const [name, values] of harness.calls) {
      for (const row of values) for (const v of row) expect(Number.isFinite(v), `${name} finite`).toBe(true)
    }
    harness.world.dispose()
  })

  it('renders a layered laser model with a bounded, tone-mapped haze floor', () => {
    // Distinguishable core / body / envelope / scatter layers + emitter bloom.
    expect(AFTERHOURS_FRAGMENT_SOURCE).toContain('float core = exp(')
    expect(AFTERHOURS_FRAGMENT_SOURCE).toContain('float body = exp(')
    expect(AFTERHOURS_FRAGMENT_SOURCE).toContain('float envelope = exp(')
    expect(AFTERHOURS_FRAGMENT_SOURCE).toContain('float sourceBloom = exp(')
    // Haze is a low-frequency field, not a flat overlay, and Atmosphere-gated.
    expect(AFTERHOURS_FRAGMENT_SOURCE).toContain('valueNoise(')
    expect(AFTERHOURS_FRAGMENT_SOURCE).toContain('atmosphere * atmosphere')
    // Output is tone-mapped and clamped so Atmosphere 1 cannot wash to solid.
    expect(AFTERHOURS_FRAGMENT_SOURCE).toContain('color = color / (color + vec3(0.85))')
    expect(AFTERHOURS_FRAGMENT_SOURCE).toContain('clamp(color, vec3(0.0), vec3(1.0))')
    // Inactive slots contribute exactly zero.
    expect(AFTERHOURS_FRAGMENT_SOURCE).toContain('if (meta.x <= 0.0) return vec3(0.0)')
  })

  it('bottom-emitter contract stays the single source of truth', () => {
    expect(AFTERHOURS_BOTTOM_EMITTERS).toHaveLength(10)
    const beams = generateAfterhoursBeams({ ...AFTERHOURS_DEFAULTS, pattern: 'fan', beamCount: 10 }).filter(b => b.active)
    expect(beams.map(b => b.origin)).toEqual([...AFTERHOURS_BOTTOM_EMITTERS])
  })
})
