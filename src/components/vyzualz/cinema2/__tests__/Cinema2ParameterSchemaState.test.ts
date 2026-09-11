import { describe, expect, it, vi } from 'vitest'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  CINEMA2_PARAMETER_STATE_SCHEMA_ID,
  Cinema2ParameterState,
  Cinema2PresetRegistry,
  Cinema2Runtime,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  compileCinema2NativePreset,
  type Cinema2MediaSlotId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
} from '..'

function id(value: string): Cinema2ParameterId {
  return cinema2StableId<Cinema2ParameterId>(value)
}

function manifest(): Cinema2NativePresetManifest {
  const mediaSlotId = cinema2StableId<Cinema2MediaSlotId>('hero-media')
  const enabledId = id('enabled')
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.parameter-foundation-test'),
    revision: 3,
    metadata: { name: 'Parameter Foundation Test' },
    mediaSlots: [{ id: mediaSlotId, label: 'Hero Media', accepts: ['image', 'video'] }],
    parameters: [
      { id: id('gain'), label: 'Gain', description: 'Master authored gain.', type: 'float', defaultValue: 0.5, min: 0, max: 1, step: 0.05, unit: '%', section: 'Design', group: 'Master', order: 0, exposure: 'primary', modulatable: true, choreographable: true, automatable: true },
      { id: id('count'), label: 'Count', type: 'integer', defaultValue: 4, min: 1, max: 16, step: 1, persistence: 'user' },
      { id: enabledId, label: 'Enabled', type: 'boolean', defaultValue: true },
      { id: id('mode'), label: 'Mode', type: 'enum', defaultValue: 'fan', options: [{ value: 'fan', label: 'Fan' }, { value: 'split', label: 'Split' }], enabledWhen: [{ kind: 'capability-available', capability: 'music.beat' }] },
      { id: id('color'), label: 'Color', type: 'color', defaultValue: [1, 0.5, 0.25, 1] },
      { id: id('fire'), label: 'Fire', type: 'trigger', persistence: 'runtime-only', choreographable: true },
      { id: id('label'), label: 'Label', type: 'string', defaultValue: 'DVYDRM' },
      { id: id('position'), label: 'Position', type: 'vec2', defaultValue: [0, 0] },
      { id: id('rotation'), label: 'Rotation', type: 'vec3', defaultValue: [0, 0, 0] },
      { id: id('media'), label: 'Media', type: 'media', defaultValue: null, mediaSlot: cinema2Ref(mediaSlotId), visibleWhen: [{ kind: 'parameter-equals', parameterId: enabledId, value: true }] },
      { id: id('status'), label: 'Status', type: 'status', defaultValue: 'idle', persistence: 'runtime-only', exposure: 'diagnostic' },
      { id: id('level'), label: 'Level', type: 'meter', defaultValue: 0, min: 0, max: 1, persistence: 'runtime-only', capabilities: [{ id: 'audio.bands', requirement: 'optional' }] },
    ],
    defaults: { parameterValues: { gain: 0.75 } },
  }
}

function compiledPlan() {
  const result = compileCinema2NativePreset(manifest())
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  return result.plan
}

function mockWebGL(): WebGL2RenderingContext {
  return {
    FRAMEBUFFER: 0x8d40,
    COLOR_BUFFER_BIT: 0x4000,
    SCISSOR_TEST: 0x0c11,
    BLEND: 0x0be2,
    DEPTH_TEST: 0x0b71,
    bindFramebuffer: vi.fn(),
    viewport: vi.fn(),
    disable: vi.fn(),
    colorMask: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    flush: vi.fn(),
  } as unknown as WebGL2RenderingContext
}

class FakeCanvas extends EventTarget {
  width = 300
  height = 150
  readonly getContext = vi.fn(() => mockWebGL())
}

describe('Cinema 2.0 parameter schema and persistent state foundation', () => {
  it('compiles every v1 type plus exposure, conditions, capability and eligibility metadata', () => {
    const plan = compiledPlan()

    expect(plan.parameters.definitions.map(definition => definition.type)).toEqual([
      'float', 'integer', 'boolean', 'enum', 'color', 'trigger', 'string', 'vec2', 'vec3', 'media', 'status', 'meter',
    ])
    const gain = plan.parameters.definitions[0]
    expect(gain).toMatchObject({
      section: 'Design',
      group: 'Master',
      order: 0,
      exposure: 'primary',
      persistence: 'preset',
      reset: 'authored-default',
      modulatable: true,
      choreographable: true,
      automatable: true,
      readOnly: false,
    })
    expect(plan.parameters.definitions.find(definition => definition.id === id('mode'))?.enabledWhen).toEqual([{ kind: 'capability-available', capability: 'music.beat' }])
    expect(plan.parameters.authoredDefaults.gain).toBe(0.75)
    expect(plan.parameters.runtimeOnlyParameterIds).toEqual(expect.arrayContaining([id('fire'), id('status'), id('level')]))
    expect(plan.capabilities.optional).toContain('audio.bands')
    expect(Object.isFrozen(plan.parameters)).toBe(true)
  })

  it('rejects invalid defaults, ranges, enum options, references and read-only eligibility deterministically', () => {
    const invalid = manifest()
    invalid.parameters = [
      { id: id('bad-float'), label: 'Bad Float', type: 'float', defaultValue: 2, min: 0, max: 1 },
      { id: id('bad-range'), label: 'Bad Range', type: 'integer', defaultValue: 4, min: 8, max: 2, step: 0 },
      { id: id('bad-enum'), label: 'Bad Enum', type: 'enum', defaultValue: 'missing', options: [{ value: 'same', label: 'A' }, { value: 'same', label: 'B' }] },
      { id: id('bad-status'), label: 'Bad Status', type: 'status', defaultValue: 'idle', persistence: 'runtime-only', modulatable: true },
      { id: id('bad-media'), label: 'Bad Media', type: 'media', defaultValue: null, mediaSlot: cinema2Ref(cinema2StableId<Cinema2MediaSlotId>('missing-slot')) },
      { id: id('bad-condition'), label: 'Bad Condition', type: 'boolean', defaultValue: true, visibleWhen: [{ kind: 'parameter-equals', parameterId: id('missing-parameter'), value: true }] },
      { id: id('bad-capability-shape'), label: 'Bad Capability Shape', type: 'boolean', defaultValue: true, capabilities: ['audio.bands'] as never[] },
    ]
    invalid.defaults = undefined

    const result = compileCinema2NativePreset(invalid)
    expect(result.ok).toBe(false)
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_VALUE_RANGE_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_RANGE_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_STEP_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_OPTION_DUPLICATE' }),
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_VALUE_OPTION_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_READ_ONLY_ELIGIBILITY_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_MEDIA_SLOT_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_CONDITION_REFERENCE_MISSING' }),
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_CAPABILITY_INVALID' }),
    ]))
  })

  it('round-trips persistent values, clamps runtime user input, excludes runtime-only channels, and resets to authored defaults', () => {
    const state = new Cinema2ParameterState(compiledPlan().parameters)

    expect(state.getValue(id('gain'))).toBe(0.75)
    expect(state.setPersistentValue(id('gain'), 2)).toEqual({ ok: true, diagnostics: [] })
    expect(state.getValue(id('gain'))).toBe(1)
    expect(state.setPersistentValue(id('count'), 7.6)).toEqual({ ok: true, diagnostics: [] })
    expect(state.getValue(id('count'))).toBe(8)
    expect(state.setRuntimeOnlyValue(id('status'), 'running').ok).toBe(true)
    expect(state.setRuntimeOnlyValue(id('level'), 0.8).ok).toBe(true)

    const serialized = state.serialize()
    const payload = JSON.parse(serialized) as { schemaId: string; values: Record<string, unknown> }
    expect(payload.schemaId).toBe(CINEMA2_PARAMETER_STATE_SCHEMA_ID)
    expect(payload.values).toMatchObject({ gain: 1, count: 8 })
    expect(payload.values).not.toHaveProperty('status')
    expect(payload.values).not.toHaveProperty('level')
    expect(payload.values).not.toHaveProperty('fire')

    const restored = new Cinema2ParameterState(compiledPlan().parameters)
    expect(restored.restore(serialized).ok).toBe(true)
    expect(restored.getValue(id('gain'))).toBe(1)
    expect(restored.getValue(id('count'))).toBe(8)
    expect(restored.getValue(id('status'))).toBe('idle')
    expect(restored.reset(id('gain')).ok).toBe(true)
    expect(restored.getValue(id('gain'))).toBe(0.75)
  })

  it('rejects malformed serialized state atomically without overwriting canonical values', () => {
    const state = new Cinema2ParameterState(compiledPlan().parameters)
    expect(state.setPersistentValue(id('gain'), 0.25).ok).toBe(true)
    const before = state.getSnapshot()
    const payload = JSON.parse(state.serialize()) as { values: Record<string, unknown> }
    payload.values.gain = 'invalid'
    payload.values.status = 'should-never-persist'

    const restored = state.restore(JSON.stringify(payload))
    expect(restored.ok).toBe(false)
    expect(restored.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_VALUE_TYPE_INVALID' }),
      expect.objectContaining({ code: 'CINEMA2_PARAMETER_STATE_RUNTIME_ONLY_PERSISTED' }),
    ]))
    expect(state.getSnapshot()).toEqual(before)
  })

  it('creates the canonical parameter store through the actual Cinema2Runtime activation service before WebGL ownership', () => {
    const registry = new Cinema2PresetRegistry()
    const authored = manifest()
    expect(registry.register(authored).ok).toBe(true)
    const canvas = new FakeCanvas()
    const runtimeResult = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
      presetId: authored.id,
      presetRegistry: registry,
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
    })

    expect(runtimeResult.runtime).not.toBeNull()
    if (!runtimeResult.runtime) throw new Error(runtimeResult.error)
    expect(runtimeResult.runtime.getParameterState().getValue(id('gain'))).toBe(0.75)
    expect(JSON.parse(runtimeResult.runtime.serializeParameterState()).values.gain).toBe(0.75)
    runtimeResult.runtime.dispose()
  })

  it('rejects malformed persisted state through runtime activation before requesting a WebGL context', () => {
    const registry = new Cinema2PresetRegistry()
    const authored = manifest()
    expect(registry.register(authored).ok).toBe(true)
    const canvas = new FakeCanvas()
    const invalidPayload = {
      schemaId: CINEMA2_PARAMETER_STATE_SCHEMA_ID,
      schemaVersion: 1,
      presetId: authored.id,
      presetRevision: authored.revision,
      values: { status: 'persisted-runtime-state' },
    }
    const runtimeResult = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
      presetId: authored.id,
      presetRegistry: registry,
      serializedParameterState: JSON.stringify(invalidPayload),
    })

    expect(runtimeResult.runtime).toBeNull()
    expect(runtimeResult.error).toContain('Runtime-only parameter "status" cannot be restored')
    expect(canvas.getContext).not.toHaveBeenCalled()
  })
})
