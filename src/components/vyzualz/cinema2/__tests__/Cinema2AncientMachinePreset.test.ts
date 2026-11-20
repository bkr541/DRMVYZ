import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2AncientMachineNativeModule'
import { ANCIENT_MACHINE_CORE_MAX_RADIUS, ANCIENT_MACHINE_CORE_RADIUS, CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS, buildCinema2AncientMachineLayout, buildCinema2AncientMachineShaftDebris, packCinema2AncientMachineInstances } from '../modules/ancientMachine/Cinema2AncientMachineLayout'
import { CINEMA2_ANCIENT_MACHINE_PATTERN_IDS, CINEMA2_ANCIENT_MACHINE_PATTERN_STATES } from '../modules/ancientMachine/Cinema2AncientMachinePatterns'
import { Cinema2MainframePatternController, createCinema2MainframePatternCycle } from '../modules/mainframe/Cinema2MainframePatternController'
import { ANCIENT_MACHINE_ROCK_VARIANT_COUNT, buildCinema2AncientMachineRockGeometry } from '../modules/ancientMachine/Cinema2AncientMachineRockGeometry'
import { ANCIENT_MACHINE_COLLAR_CENTER_Z, ANCIENT_MACHINE_COLLAR_INNER_RADIUS, ANCIENT_MACHINE_SHAFT_VERTEX_BYTES, buildCinema2AncientMachineShaft } from '../modules/ancientMachine/Cinema2AncientMachineShaft'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID, CINEMA2_ANCIENT_MACHINE_CAMERA_ID, CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID, CINEMA2_ANCIENT_MACHINE_PRESET_ID, CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST, CINEMA2_ANCIENT_MACHINE_ROCK_LIGHT_ID, CINEMA2_ANCIENT_MACHINE_TRIGGER_ID, CINEMA2_ANCIENT_MACHINE_PATTERN_ID, CINEMA2_ANCIENT_MACHINE_REACTIVITY_ID } from '../presets/Cinema2AncientMachinePreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'
import { humMusicFrame } from './support/Cinema2HumNFrameFactory'

const CAPABILITIES = Object.freeze(['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] as const)
class FakeCanvas extends EventTarget {
  width = 640; height = 360; readonly getContext: ReturnType<typeof vi.fn>
  constructor(gl: WebGL2RenderingContext) { super(); this.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null) }
}

describe('Cinema 2.0 Ancient Machine preset', () => {
  it('builds deterministic mechanical layers that envelop the enlarged crystal in every direction', () => {
    const first = buildCinema2AncientMachineLayout(); const second = buildCinema2AncientMachineLayout()
    expect(first).toEqual(second); expect(first.instances).toHaveLength(444)
    expect(first.instances.filter(instance => instance.kind === 'tooth')).toHaveLength(36)
    expect(first.instances.filter(instance => instance.kind === 'glyph')).toHaveLength(72)
    expect(first.instances.filter(instance => instance.kind === 'plate')).toHaveLength(12)
    expect(ANCIENT_MACHINE_CORE_RADIUS).toBeCloseTo(.68 * 3)
    const octants = new Set<number>()
    for (const { center: [x, y, worldZ], kind } of first.instances) {
      const z = worldZ - ANCIENT_MACHINE_COLLAR_CENTER_Z
      const radius = Math.hypot(x, y, z)
      expect(radius).toBeGreaterThan(ANCIENT_MACHINE_CORE_MAX_RADIUS + .5)
      expect(radius).toBeLessThan(ANCIENT_MACHINE_COLLAR_INNER_RADIUS)
      if (kind === 'metal') octants.add(Number(x > 0) + 2 * Number(y > 0) + 4 * Number(z > 0))
    }
    expect(octants.size).toBe(8)
    expect(packCinema2AncientMachineInstances(first.instances)).toHaveLength(444 * CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS)
  })

  it('fills the shaft and the foreground throughout the inspection orbit', () => {
    const debris = buildCinema2AncientMachineShaftDebris()
    expect(debris).toEqual(buildCinema2AncientMachineShaftDebris())
    expect(debris.length).toBeGreaterThanOrEqual(27_000)
    for (const [min, max] of [[-31, -21], [-21, -10], [-10, 0], [0, 10], [10, 21], [21, 31]]) {
      expect(debris.filter(({ center: [, , z] }) => z >= min && z < max).length).toBeGreaterThan(3_500)
    }
    expect(debris.every(({ center: [x, y, z] }) => (
      Math.hypot(x, y) < 14 && Math.hypot(x, y, z - ANCIENT_MACHINE_COLLAR_CENTER_Z) >= 4.75
    ))).toBe(true)
    for (let degrees = -18; degrees < 342; degrees += 15) {
      const angle = degrees * Math.PI / 180
      const eye = [Math.sin(angle) * 12.48, 1.75, Math.cos(angle) * 12.48 - .4] as const
      const direction = [-eye[0], -eye[1], ANCIENT_MACHINE_COLLAR_CENTER_Z - eye[2]]
      const distance = Math.hypot(...direction)
      const foreground = debris.filter(({ center: [x, y, z] }) => {
        const offset = [x - eye[0], y - eye[1], z - eye[2]]
        const depth = (offset[0] * direction[0] + offset[1] * direction[1] + offset[2] * direction[2]) / distance
        const crossSection = offset[0] ** 2 + offset[1] ** 2 + offset[2] ** 2 - depth ** 2
        return depth > 2 && depth < distance - 4 && crossSection < (depth * .33) ** 2
      })
      expect(foreground.length, `foreground debris at ${degrees}°`).toBeGreaterThanOrEqual(10)
    }
  })

  it('ships six Patterns, the three legacy identities among them, and passes native gates', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_ANCIENT_MACHINE_PRESET_ID)).toMatchObject({ role: 'keeper' })
    expect(cinema2NativePresetRegistry.get(CINEMA2_ANCIENT_MACHINE_PRESET_ID)).not.toBeNull()
    expect(cinema2NativeModuleRegistry.get(CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_ANCIENT_MACHINE_PATTERN_ID)).toMatchObject({
      label: 'Pattern', defaultValue: 'oracle-lock',
      options: [{ value: 'oracle-lock' }, { value: 'gear-sun' }, { value: 'epoch-engine' }, { value: 'build-charge' }, { value: 'drop-impact' }, { value: 'counter-orrery' }],
    })
    expect(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST.choreography?.rules.find(rule => rule.source.signal === 'continuous' && rule.source.path === 'audio.bands.bass')).toMatchObject({
      priority: 11,
      source: { smoothingMs: 90 },
      actions: [{ target: { property: 'bassPressure' } }],
    })
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    const compiled = compileCinema2NativePreset(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    expect(compiled.ok, compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)
  })

  it('provides Mainframe-equivalent Pattern Change and conditional Trigger controls', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST, { availableCapabilities: CAPABILITIES })
    if (!compiled.ok) throw new Error('Expected Ancient Machine to compile')
    expect(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID)).toMatchObject({ type: 'boolean', defaultValue: false })
    expect(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_ANCIENT_MACHINE_TRIGGER_ID)).toMatchObject({ type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID, value: true }] })
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const labels = () => {
      const effects = createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot()).find(parent => parent.id === 'design')
      return [...(effects?.controls.map(control => control.definition.label) ?? []), ...(effects?.groups.flatMap(group => group.controls.map(control => control.definition.label)) ?? [])]
    }
    expect(labels()).not.toContain('Trigger')
    expect(state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID, true)).toMatchObject({ ok: true })
    expect(labels()).toContain('Trigger')
    expect(state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_TRIGGER_ID, 'drop')).toMatchObject({ ok: true })
    const restored = new Cinema2ParameterState(compiled.plan.parameters); expect(restored.restore(state.serialize())).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_ANCIENT_MACHINE_TRIGGER_ID)).toBe('drop')
  })

  it('cycles the six Patterns deterministically without repeats and returns authority when disabled', () => {
    const cycle = createCinema2MainframePatternCycle(index => [0.8, 0.2][index] ?? 0.5, CINEMA2_ANCIENT_MACHINE_PATTERN_IDS)
    expect([...cycle].sort()).toEqual([...CINEMA2_ANCIENT_MACHINE_PATTERN_IDS].sort())
    const controller = new Cinema2MainframePatternController(cycle, 'oracle-lock')
    const base = { authoredPattern: 'oracle-lock' as const, patternChange: true, trigger: 'bar4' as const, absoluteBeat: 0 }
    expect(controller.update({ ...base, triggerEventId: 'bar:1' }).activePattern).toBe('oracle-lock')
    const advanced = controller.update({ ...base, triggerEventId: 'bar:2' }); expect(advanced.activePattern).not.toBe('oracle-lock')
    expect(controller.update({ ...base, triggerEventId: 'bar:2' }).changed).toBe(false)
    expect(controller.update({ ...base, patternChange: false, triggerEventId: 'bar:3' }).activePattern).toBe('oracle-lock')
  })

  it('makes every Pattern a different state of the machine, and the Design tab has no Choreography group', () => {
    const states = CINEMA2_ANCIENT_MACHINE_PATTERN_IDS.map(id => JSON.stringify(CINEMA2_ANCIENT_MACHINE_PATTERN_STATES[id]))
    expect(new Set(states).size).toBe(6)
    const labels = (CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST.parameters ?? []).map(parameter => `${parameter.group ?? ''}/${parameter.label}`)
    expect(labels.some(label => label.startsWith('Choreography/'))).toBe(false)
    for (const removed of ['Rhythm Response', 'Build Charge', 'Drop Impact', 'Machine Look']) expect(labels.some(label => label.endsWith(`/${removed}`))).toBe(false)
  })

  it('renders through the production registry, orbit camera, depth and four-pass graph', () => {
    const gl = createCinemaMockWebGL(); let scheduled: FrameRequestCallback | null = null
    const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, { presetId: CINEMA2_ANCIENT_MACHINE_PRESET_ID, requestAnimationFrame: vi.fn(callback => { scheduled = callback; return 1 }), cancelAnimationFrame: vi.fn(), renderQuality: 'high' })
    expect(created.error).toBeNull(); if (!created.runtime) throw new Error('Expected Ancient Machine runtime')
    expect(created.runtime.getCameraRuntimeSnapshot()).toMatchObject({ activeCameraId: CINEMA2_ANCIENT_MACHINE_CAMERA_ID })
    expect(created.runtime.getModuleRuntimeSnapshot().estimatedGpuBytes).toBeGreaterThan(0)
    created.runtime.resize({ width: 640, height: 360, dpr: 1 }); created.runtime.start(); (scheduled as FrameRequestCallback | null)?.(16)
    expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 4, failedPassCount: 0 })
    const shaft = buildCinema2AncientMachineShaft()
    expect(shaft.every(Number.isFinite)).toBe(true)
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, shaft.byteLength / ANCIENT_MACHINE_SHAFT_VERTEX_BYTES)
    const mechanism = buildCinema2AncientMachineLayout().instances
    const accentCount = mechanism.filter(({ kind }) => kind === 'glyph' || kind === 'internal-light').length
    const rockCount = mechanism.length - accentCount + buildCinema2AncientMachineShaftDebris().length
    expect(gl.drawElementsInstanced).toHaveBeenCalledWith(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, accentCount)
    const rockDraws = vi.mocked(gl.drawElementsInstanced).mock.calls.filter(([, indexCount]) => indexCount === 60)
    expect(rockDraws).toHaveLength(ANCIENT_MACHINE_ROCK_VARIANT_COUNT)
    expect(rockDraws.reduce((total, draw) => total + draw[4], 0)).toBe(rockCount)
    expect(rockDraws.every(draw => draw[4] > 0)).toBe(true)
    created.runtime.dispose()
  })

  describe('through the production runtime', () => {
    function start(options: { build?: number; playing?: boolean } = {}) {
      const gl = createCinemaMockWebGL()
      gl.getUniformLocation = vi.fn((_program, name: string) => ({ name }) as unknown as WebGLUniformLocation)
      let scheduled: FrameRequestCallback | null = null
      let audio = humMusicFrame({ frameId: 1, timeSec: 10, energy: 0.8, buildProgress: options.build ?? 0, buildConfidence: options.build ? 1 : 0, trackId: 'ancient-machine-test' })
      const bridge = new Cinema2AudioIntelligenceBridge({
        getFrame: () => audio,
        getPublicationMeta: () => ({ sequence: audio.frameId, publishedAtMs: audio.timeSec * 1000, publisherId: 'ancient-machine-test', kind: 'frame' }),
      })
      const { runtime, error } = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
        presetId: CINEMA2_ANCIENT_MACHINE_PRESET_ID, audioIntelligenceBridge: bridge,
        transportSource: { getState: () => ({ sourcePresent: true, playing: options.playing ?? true, analysisActive: true, paused: false, trackId: audio.trackId, timeSec: audio.timeSec }) },
        requestAnimationFrame: vi.fn(callback => { scheduled = callback; return 1 }), cancelAnimationFrame: vi.fn(),
      })
      if (!runtime) throw new Error(String(error))
      runtime.resize({ width: 640, height: 360, dpr: 1 }); runtime.start()
      const frame = (extra: Partial<Parameters<typeof humMusicFrame>[0]> = {}) => {
        audio = humMusicFrame({ frameId: audio.frameId + 1, timeSec: audio.timeSec + 0.05, energy: 0.8, buildProgress: options.build ?? 0, buildConfidence: options.build ? 1 : 0, trackId: 'ancient-machine-test', ...extra })
        scheduled?.(audio.timeSec * 1000)
      }
      const uniform = (name: string, method: 'uniform1f' | 'uniform1i' = 'uniform1f') =>
        vi.mocked(gl[method]).mock.calls.filter(([location]) => (location as { name?: string } | null)?.name === name).at(-1)?.[1]
      return { runtime, state: runtime.getParameterState(), frame, uniform }
    }

    it('puts each Pattern on the shader as its own state', () => {
      const { runtime, state, frame, uniform } = start()
      state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID, false)
      const seen = new Set<string>()
      const expected = { 'oracle-lock': [0, 0, 0], 'gear-sun': [1, 0, 0], 'epoch-engine': [2, 0, 0], 'build-charge': [2, 0.85, 0], 'drop-impact': [1, 0, 0.85], 'counter-orrery': [3, 0, 0] } as const
      for (const id of CINEMA2_ANCIENT_MACHINE_PATTERN_IDS) {
        state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_PATTERN_ID, id); frame()
        const [look, build, drop] = expected[id]
        expect(uniform('u_look', 'uniform1i'), id).toBe(look)
        expect(uniform('u_build') as number, id).toBeCloseTo(build)
        expect(uniform('u_drop') as number, id).toBeCloseTo(drop)
        seen.add(JSON.stringify([uniform('u_look', 'uniform1i'), uniform('u_build'), uniform('u_drop'), uniform('u_rotationSpeed'), uniform('u_counterRotation'), uniform('u_mechanicalDepth'), uniform('u_glyphDensity')]))
      }
      expect(seen.size).toBe(6)
      runtime.dispose()
    })

    it('reacts to the music without any switch, scaled by Music Reactivity, alongside the manual rock brightness', () => {
      const { runtime, state, frame, uniform } = start()
      state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID, false)
      state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_ROCK_LIGHT_ID, 2.4)
      frame()
      expect(uniform('u_rockLightIntensity')).toBeCloseTo(2.4)
      expect(uniform('u_energy') as number).toBeGreaterThan(0)
      state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_REACTIVITY_ID, 0); frame()
      expect(uniform('u_energy')).toBe(0)
      runtime.dispose()
    })

    it('with Auto Performance on, puts Build Charge on stage during a build and returns to the authored Pattern when it ends', () => {
      const { runtime, state, frame, uniform } = start()
      state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_PATTERN_ID, 'gear-sun')
      state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID, true)
      // Auto Performance does not take over a build already under way, so it is on before this one starts.
      for (let i = 0; i < 20; i += 1) frame({ buildProgress: 0, buildConfidence: 0 })
      expect(uniform('u_look', 'uniform1i')).toBe(1)
      for (let i = 0; i < 80; i += 1) frame({ buildProgress: Math.min(0.9, i / 40), buildConfidence: 1 })
      expect(uniform('u_look', 'uniform1i'), 'a build is on stage').toBe(2)
      expect(uniform('u_build') as number).toBeGreaterThan(0.8)
      // The saved Pattern is never rewritten.
      expect(state.getValue(CINEMA2_ANCIENT_MACHINE_PATTERN_ID)).toBe('gear-sun')
      for (let i = 0; i < 400; i += 1) frame({ buildProgress: 0, buildConfidence: 0 })
      expect(uniform('u_look', 'uniform1i'), 'the authored Pattern resumes').toBe(1)
      runtime.dispose()
    })

    it('with Auto Performance on, puts Drop Impact on stage on a drop and then returns to the authored Pattern', () => {
      const { runtime, state, frame, uniform } = start()
      state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_AUTO_PERFORMANCE_ID, true)
      for (let i = 0; i < 20; i += 1) frame()
      expect(uniform('u_look', 'uniform1i')).toBe(0)
      expect(uniform('u_drop')).toBe(0)
      const at = 10 + 0.05 * 24
      for (let i = 0; i < 10; i += 1) frame({ dropMoments: [{ id: 'drop-1', timeSec: at }], dropConfidence: 1 })
      expect(uniform('u_drop') as number, 'the drop is on stage').toBeGreaterThan(0.8)
      expect(uniform('u_look', 'uniform1i')).toBe(1)
      expect(state.getValue(CINEMA2_ANCIENT_MACHINE_PATTERN_ID)).toBe('oracle-lock')
      for (let i = 0; i < 600; i += 1) frame({ dropMoments: [{ id: 'drop-1', timeSec: at }], dropConfidence: 1 })
      expect(uniform('u_look', 'uniform1i'), 'the authored Pattern resumes').toBe(0)
      expect(uniform('u_drop')).toBe(0)
      runtime.dispose()
    })
  })

  it('builds distinct rock silhouettes with outward-facing facets inside the original brick bounds', () => {
    const rocks = Array.from({ length: ANCIENT_MACHINE_ROCK_VARIANT_COUNT }, (_, variant) => buildCinema2AncientMachineRockGeometry(variant))
    expect(new Set(rocks.map(rock => rock.vertices.join(','))).size).toBe(rocks.length)
    for (const { vertices, indices } of rocks) {
      expect(indices).toHaveLength(60)
      expect(vertices.every(Number.isFinite)).toBe(true)
      for (let vertex = 0; vertex < vertices.length; vertex += 11) {
        const x = vertices[vertex]!, y = vertices[vertex + 1]!, z = vertices[vertex + 2]!
        const nx = vertices[vertex + 3]!, ny = vertices[vertex + 4]!, nz = vertices[vertex + 5]!
        expect(Math.max(Math.abs(x), Math.abs(y), Math.abs(z))).toBeLessThanOrEqual(.5)
        expect(x * nx + y * ny + z * nz).toBeGreaterThan(0)
      }
    }
  })
})
