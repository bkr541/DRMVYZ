import { describe, expect, it, vi } from 'vitest'

import { createCinemaMockWebGL } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_CATHEDRAL_NATIVE_MODULE_TYPE_ID,
} from '../modules/Cinema2CathedralNativeModule'
import {
  CINEMA2_CATHEDRAL_INSTANCE_FLOATS,
  CINEMA2_CATHEDRAL_LAYOUT_CONFIG,
  buildCinema2CathedralLayout,
  packCinema2CathedralInstances,
} from '../modules/cathedral/Cinema2CathedralLayout'
import {
  Cinema2CathedralProgramController,
  createCinema2CathedralProgramCycle,
} from '../modules/cathedral/Cinema2CathedralProgramController'
import { cinema2NativeModuleRegistry } from '../modules/Cinema2ModuleRegistry'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import {
  CINEMA2_CATHEDRAL_ACCENT_COLOR_ID,
  CINEMA2_CATHEDRAL_BACKGROUND_ID,
  CINEMA2_CATHEDRAL_CAMERA_ID,
  CINEMA2_CATHEDRAL_PRESET_ID,
  CINEMA2_CATHEDRAL_PRESET_MANIFEST,
  CINEMA2_CATHEDRAL_PRIMARY_COLOR_ID,
  CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID,
  CINEMA2_CATHEDRAL_STRUCTURE_COLOR_ID,
  CINEMA2_CATHEDRAL_TRIGGER_ID,
} from '../presets/Cinema2CathedralPreset'
import { CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS } from '../presets/Cinema2FirstPartyPresetCatalog'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2Runtime } from '../runtime/Cinema2Runtime'

const REQUIRED_CAPABILITIES = Object.freeze(['render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'lighting'] as const)

class FakeCanvas extends EventTarget {
  width = 640
  height = 360
  readonly getContext: ReturnType<typeof vi.fn>

  constructor(gl: WebGL2RenderingContext) {
    super()
    this.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null)
  }
}

describe('Cinema 2.0 Cathedral preset', () => {
  it('builds a deterministic pointed-arch aisle and LED transition room with seamless repeating depth', () => {
    const first = buildCinema2CathedralLayout()
    const second = buildCinema2CathedralLayout()

    expect(first).toEqual(second)
    expect(first.config).toEqual(CINEMA2_CATHEDRAL_LAYOUT_CONFIG)
    expect(first.repeatDistance).toBeCloseTo(106.8)
    expect(first.instances).toHaveLength(825)
    expect(first.instances.filter(instance => instance.kind === 'structure')).toHaveLength(424)
    expect(first.instances.filter(instance => instance.kind === 'spark')).toHaveLength(72)
    const transitionRoom = first.instances.filter(instance => instance.zone === 'transition-room')
    expect(transitionRoom).toHaveLength(105)
    expect(transitionRoom.filter(instance => instance.kind === 'primary-light' || instance.kind === 'accent-light')).toHaveLength(77)
    expect(transitionRoom.filter(instance => (
      (instance.kind === 'primary-light' || instance.kind === 'accent-light') && instance.size[2] > 20
    ))).toHaveLength(8)
    expect(transitionRoom.some(instance => instance.kind === 'structure' && instance.size[0] > 13)).toBe(true)
    expect(Math.min(...transitionRoom.map(instance => instance.center[2]))).toBeLessThan(-106)
    expect(Math.max(...transitionRoom.map(instance => instance.center[2]))).toBeLessThan(-82)
    expect(Math.max(...first.instances.map(instance => instance.center[1]))).toBeGreaterThan(4.4)

    const packed = packCinema2CathedralInstances(first.instances)
    expect(packed).toHaveLength(first.instances.length * CINEMA2_CATHEDRAL_INSTANCE_FLOATS)
  })

  it('ships as a first-party keeper with Cathedral Run defaults and editable palette controls', () => {
    expect(CINEMA2_FIRST_PARTY_PRESET_DECLARATIONS.find(candidate => candidate.manifest.id === CINEMA2_CATHEDRAL_PRESET_ID)).toMatchObject({ role: 'keeper' })
    expect(cinema2NativePresetRegistry.get(CINEMA2_CATHEDRAL_PRESET_ID)).not.toBeNull()
    expect(cinema2NativeModuleRegistry.get(CINEMA2_CATHEDRAL_NATIVE_MODULE_TYPE_ID, 1)).not.toBeNull()
    expect(CINEMA2_CATHEDRAL_PRESET_MANIFEST.modules?.[0]?.parameters).toMatchObject({
      program: 'cathedralRun',
      primaryColor: [0.03, 0.84, 1, 1],
      accentColor: [0.84, 0.58, 0.12, 1],
    })

    const paletteIds = new Set([
      CINEMA2_CATHEDRAL_BACKGROUND_ID,
      CINEMA2_CATHEDRAL_STRUCTURE_COLOR_ID,
      CINEMA2_CATHEDRAL_PRIMARY_COLOR_ID,
      CINEMA2_CATHEDRAL_ACCENT_COLOR_ID,
    ])
    const palette = (CINEMA2_CATHEDRAL_PRESET_MANIFEST.parameters ?? []).filter(parameter => paletteIds.has(parameter.id))
    expect(palette).toHaveLength(4)
    expect(palette.every(parameter => parameter.type === 'color' && parameter.designParentGroup === 'palette')).toBe(true)
  })

  it('passes keeper authoring and compilation with the complete music choreography surface', () => {
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_CATHEDRAL_PRESET_MANIFEST })).toEqual({ ok: true, diagnostics: [] })
    const compiled = compileCinema2NativePreset(CINEMA2_CATHEDRAL_PRESET_MANIFEST, { availableCapabilities: REQUIRED_CAPABILITIES })
    expect(compiled.ok, compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n')).toBe(true)

    const signals = new Set(CINEMA2_CATHEDRAL_PRESET_MANIFEST.choreography?.rules.map(rule => rule.source.signal))
    expect(signals).toEqual(new Set(['continuous', 'beat', 'kick', 'snare', 'downbeat', 'phrase', 'drop']))
    expect(CINEMA2_CATHEDRAL_PRESET_MANIFEST.cameras?.[0]?.rig).toMatchObject({
      kind: 'fly',
      loop: true,
      repeatOffset: [0, 0, -106.8],
    })
  })

  it('matches Mainframe Pattern Change and Trigger control behavior', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_CATHEDRAL_PRESET_MANIFEST, { availableCapabilities: REQUIRED_CAPABILITIES })
    if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => diagnostic.message).join('\n'))
    const parameters = CINEMA2_CATHEDRAL_PRESET_MANIFEST.parameters ?? []
    expect(parameters.find(parameter => parameter.id === CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID)).toMatchObject({
      type: 'boolean',
      defaultValue: false,
    })
    expect(parameters.find(parameter => parameter.id === CINEMA2_CATHEDRAL_TRIGGER_ID)).toMatchObject({
      type: 'enum',
      defaultValue: 'bar4',
      options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID, value: true }],
    })

    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const patternLabels = () => {
      const design = createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot()).find(parent => parent.id === 'effects')
      return [
        ...(design?.controls.map(control => control.definition.label) ?? []),
        ...(design?.groups.flatMap(group => group.controls.map(control => control.definition.label)) ?? []),
      ]
    }
    expect(patternLabels()).toContain('Light Program')
    expect(patternLabels()).toContain('Pattern Change')
    expect(patternLabels()).not.toContain('Trigger')
    expect(state.setPersistentValue(CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID, true)).toMatchObject({ ok: true })
    expect(patternLabels()).toContain('Trigger')
    expect(state.setPersistentValue(CINEMA2_CATHEDRAL_TRIGGER_ID, 'drop')).toMatchObject({ ok: true })

    const restored = new Cinema2ParameterState(compiled.plan.parameters)
    expect(restored.restore(state.serialize())).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID)).toBe(true)
    expect(restored.getValue(CINEMA2_CATHEDRAL_TRIGGER_ID)).toBe('drop')
    expect(restored.reset(CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID)).toMatchObject({ ok: true })
    expect(restored.reset(CINEMA2_CATHEDRAL_TRIGGER_ID)).toMatchObject({ ok: true })
    expect(restored.getValue(CINEMA2_CATHEDRAL_PATTERN_CHANGE_ID)).toBe(false)
    expect(restored.getValue(CINEMA2_CATHEDRAL_TRIGGER_ID)).toBe('bar4')
  })

  it('advances a deterministic no-repeat program cycle only for new qualified events', () => {
    const cycle = createCinema2CathedralProgramCycle(index => [0.7, 0.1, 0.8, 0.3][index] ?? 0.5)
    const controller = new Cinema2CathedralProgramController(cycle, 'cathedralRun')
    const base = { authoredProgram: 'cathedralRun' as const, patternChange: true, trigger: 'bar4' as const }

    expect(controller.update({ ...base, triggerEventId: 'bar4:1' }).activeProgram).toBe('cathedralRun')
    const advanced = controller.update({ ...base, triggerEventId: 'bar4:2' })
    expect(advanced.changed).toBe(true)
    expect(advanced.activeProgram).not.toBe('cathedralRun')
    expect(controller.update({ ...base, triggerEventId: 'bar4:2' })).toMatchObject({ activeProgram: advanced.activeProgram, changed: false })
    expect(controller.update({ ...base, triggerEventId: 'bar4:3', patternChange: false })).toMatchObject({ activeProgram: 'cathedralRun' })
  })

  it('activates and renders through the production registry, camera, depth and effects path', () => {
    const gl = createCinemaMockWebGL()
    let scheduledFrame: FrameRequestCallback | null = null
    const created = Cinema2Runtime.create(new FakeCanvas(gl) as unknown as HTMLCanvasElement, {
      presetId: CINEMA2_CATHEDRAL_PRESET_ID,
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        scheduledFrame = callback
        return 1
      }),
      cancelAnimationFrame: vi.fn(),
      renderQuality: 'high',
    })

    expect(created.error).toBeNull()
    expect(created.runtime).not.toBeNull()
    if (!created.runtime) return

    expect(created.runtime.getCompiledPresetPlan().presetId).toBe(CINEMA2_CATHEDRAL_PRESET_ID)
    expect(created.runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1 })
    expect(created.runtime.getModuleRuntimeSnapshot().estimatedGpuBytes).toBeGreaterThan(0)
    expect(created.runtime.getCameraRuntimeSnapshot()).toMatchObject({ activeCameraId: CINEMA2_CATHEDRAL_CAMERA_ID })

    created.runtime.resize({ width: 640, height: 360, dpr: 1 })
    created.runtime.start()
    expect(scheduledFrame).not.toBeNull()
    ;(scheduledFrame as FrameRequestCallback | null)?.(16)
    expect(created.runtime.getRenderGraphExecutorSnapshot()).toMatchObject({
      frameCount: 1,
      executedPassCount: 5,
      failedPassCount: 0,
    })
    expect(gl.drawElementsInstanced).toHaveBeenCalled()
    created.runtime.dispose()
  })
})
