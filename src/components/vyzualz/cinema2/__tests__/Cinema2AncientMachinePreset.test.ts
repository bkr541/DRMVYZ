import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2AncientMachineNativeModule'
import { CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS, buildCinema2AncientMachineLayout, packCinema2AncientMachineInstances } from '../modules/ancientMachine/Cinema2AncientMachineLayout'
import { Cinema2AncientMachineProgramController, createCinema2AncientMachineLookCycle } from '../modules/ancientMachine/Cinema2AncientMachineProgramController'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_ANCIENT_MACHINE_CAMERA_ID, CINEMA2_ANCIENT_MACHINE_LOOK_ID, CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID, CINEMA2_ANCIENT_MACHINE_PRESET_ID, CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST, CINEMA2_ANCIENT_MACHINE_TRIGGER_ID } from '../presets/Cinema2AncientMachinePreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'

const CAPABILITIES = Object.freeze(['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] as const)
class FakeCanvas extends EventTarget {
  width = 640; height = 360; readonly getContext: ReturnType<typeof vi.fn>
  constructor(gl: WebGL2RenderingContext) { super(); this.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null) }
}

describe('Cinema 2.0 Ancient Machine preset', () => {
  it('builds deterministic concentric mechanical geometry with stable addresses', () => {
    const first = buildCinema2AncientMachineLayout(); const second = buildCinema2AncientMachineLayout()
    expect(first).toEqual(second); expect(first.instances).toHaveLength(444)
    expect(first.instances.filter(instance => instance.kind === 'tooth')).toHaveLength(36)
    expect(first.instances.filter(instance => instance.kind === 'glyph')).toHaveLength(72)
    expect(first.instances.filter(instance => instance.kind === 'plate')).toHaveLength(12)
    expect(first.instances.filter(instance => instance.kind === 'plate').every(instance => Math.hypot(instance.center[0], instance.center[1]) > 4.5)).toBe(true)
    expect(packCinema2AncientMachineInstances(first.instances)).toHaveLength(444 * CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS)
  })

  it('ships all three legacy identities as authored looks and passes native gates', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_ANCIENT_MACHINE_PRESET_ID)).toMatchObject({ role: 'keeper' })
    expect(cinema2NativePresetRegistry.get(CINEMA2_ANCIENT_MACHINE_PRESET_ID)).not.toBeNull()
    expect(cinema2NativeModuleRegistry.get(CINEMA2_ANCIENT_MACHINE_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(CINEMA2_ANCIENT_MACHINE_PRESET_MANIFEST.parameters?.find(parameter => parameter.id === CINEMA2_ANCIENT_MACHINE_LOOK_ID)).toMatchObject({
      defaultValue: 'oracleLock', options: [{ value: 'oracleLock' }, { value: 'gearSun' }, { value: 'epochEngine' }],
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
      const effects = createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot()).find(parent => parent.id === 'effects')
      return [...(effects?.controls.map(control => control.definition.label) ?? []), ...(effects?.groups.flatMap(group => group.controls.map(control => control.definition.label)) ?? [])]
    }
    expect(labels()).not.toContain('Trigger')
    expect(state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_PATTERN_CHANGE_ID, true)).toMatchObject({ ok: true })
    expect(labels()).toContain('Trigger')
    expect(state.setPersistentValue(CINEMA2_ANCIENT_MACHINE_TRIGGER_ID, 'drop')).toMatchObject({ ok: true })
    const restored = new Cinema2ParameterState(compiled.plan.parameters); expect(restored.restore(state.serialize())).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_ANCIENT_MACHINE_TRIGGER_ID)).toBe('drop')
  })

  it('cycles deterministically without repeats and returns authority when disabled', () => {
    const cycle = createCinema2AncientMachineLookCycle(index => [0.8, 0.2][index] ?? 0.5)
    const controller = new Cinema2AncientMachineProgramController(cycle)
    const base = { authoredLook: 'oracleLock' as const, patternChange: true, trigger: 'bar4' as const }
    expect(controller.update({ ...base, triggerEventId: 'bar:1' }).activeLook).toBe('oracleLock')
    const advanced = controller.update({ ...base, triggerEventId: 'bar:2' }); expect(advanced.activeLook).not.toBe('oracleLock')
    expect(controller.update({ ...base, triggerEventId: 'bar:2' }).changed).toBe(false)
    expect(controller.update({ ...base, patternChange: false, triggerEventId: 'bar:3' }).activeLook).toBe('oracleLock')
  })

  it('renders through the production registry, orbit camera, depth and four-pass graph', () => {
    const gl = createCinemaMockWebGL(); let scheduled: FrameRequestCallback | null = null
    const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, { presetId: CINEMA2_ANCIENT_MACHINE_PRESET_ID, requestAnimationFrame: vi.fn(callback => { scheduled = callback; return 1 }), cancelAnimationFrame: vi.fn(), renderQuality: 'high' })
    expect(created.error).toBeNull(); if (!created.runtime) throw new Error('Expected Ancient Machine runtime')
    expect(created.runtime.getCameraRuntimeSnapshot()).toMatchObject({ activeCameraId: CINEMA2_ANCIENT_MACHINE_CAMERA_ID })
    expect(created.runtime.getModuleRuntimeSnapshot().estimatedGpuBytes).toBeGreaterThan(0)
    created.runtime.resize({ width: 640, height: 360, dpr: 1 }); created.runtime.start(); (scheduled as FrameRequestCallback | null)?.(16)
    expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 4, failedPassCount: 0 })
    expect(gl.drawElementsInstanced).toHaveBeenCalled(); created.runtime.dispose()
  })
})
