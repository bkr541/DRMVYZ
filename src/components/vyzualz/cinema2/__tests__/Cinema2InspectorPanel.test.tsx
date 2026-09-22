import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../../stores/reactStore'
import { ReactEngineBrowser } from '../../react/ReactEngineBrowser'
import { Cinema2InspectorPanel } from '../../react/Cinema2InspectorPanel'
import { Cinema2Stage } from '../../react/Cinema2Stage'
import { createCinemaMockWebGL, CinemaResizeObserverMock } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID,
  CINEMA2_AFTERHOURS_BACKGROUND_ID,
  CINEMA2_AFTERHOURS_COLOR_MODE_ID,
  CINEMA2_AFTERHOURS_MASTER_INTENSITY_ID,
  CINEMA2_AFTERHOURS_PRIMARY_COLOR_ID,
  CINEMA2_AFTERHOURS_ACCENT_COLOR_ID,
  CINEMA2_AFTERHOURS_PRESET_MANIFEST,
  CINEMA2_ELECTRIC_STORM_BACKGROUND_ID,
  CINEMA2_ELECTRIC_STORM_HAZE_ID,
  CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID,
  CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST,
  CINEMA2_INTERLOCK_PRESET_MANIFEST,
  CINEMA2_QUALITY_MODE_PARAMETER_ID,
  CINEMA2_REACTOR_PRESET_MANIFEST,
  CINEMA2_REFERENCE_VISUAL_PRESET_ID,
  CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST,
  CINEMA2_SPATIAL_REFERENCE_PRESET_MANIFEST,
  Cinema2ParameterState,
  Cinema2PresetRegistry,
  Cinema2Runtime,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  compileCinema2NativePreset,
  createCinema2DesignParentGroupModel,
  createCinema2InspectorModel,
  type Cinema2CameraId,
  type Cinema2EffectId,
  type Cinema2EffectTypeId,
  type Cinema2LightId,
  type Cinema2MediaSlotId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
} from '..'

const parameterId = (value: string) => cinema2StableId<Cinema2ParameterId>(value)
const presetId = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.inspector-test')
const enabledId = parameterId('enabled')
const intensityId = parameterId('intensity')
const conditionalId = parameterId('conditional')
const triggerId = parameterId('reseed')
const reactAmountId = parameterId('react-amount')

function instanceManifest(): Cinema2NativePresetManifest {
  const effectId = cinema2StableId<Cinema2EffectId>('stage15a-bloom')
  const effectTypeId = cinema2StableId<Cinema2EffectTypeId>('stage15a-bloom-type')
  const mediaSlotId = cinema2StableId<Cinema2MediaSlotId>('stage15a-media')
  const cameraId = cinema2StableId<Cinema2CameraId>('stage15a-camera')
  const lightId = cinema2StableId<Cinema2LightId>('stage15a-key-light')
  const designMaster = parameterId('stage15a-design-master')
  const effectMix = parameterId('stage15a-effect-mix')
  const mediaSource = parameterId('stage15a-media-source')
  const cameraFov = parameterId('stage15a-camera-fov')
  const lightIntensity = parameterId('stage15a-light-intensity')
  const environmentExposure = parameterId('stage15a-environment-exposure')
  const advanced = parameterId('stage15a-advanced')
  const diagnostic = parameterId('stage15a-diagnostic')
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.inspector-stage15a-instance-test'),
    revision: 1,
    metadata: { name: 'Inspector Stage 15A Instance Test' },
    parameters: [
      { id: designMaster, label: 'Master', type: 'float', defaultValue: 0.5, min: 0, max: 1, section: 'Design', order: 100 },
      { id: effectMix, label: 'Mix', type: 'float', defaultValue: 0.4, min: 0, max: 1, section: 'Design', group: 'Bloom', order: 20 },
      { id: mediaSource, label: 'Source', type: 'media', defaultValue: null, section: 'Design', group: 'Source', mediaSlot: cinema2Ref(mediaSlotId), order: 30 },
      { id: cameraFov, label: 'FOV', type: 'float', defaultValue: 50, min: 20, max: 100, section: 'Design', group: 'Lens', order: 40 },
      { id: lightIntensity, label: 'Intensity', type: 'float', defaultValue: 1.2, min: 0, max: 8, section: 'Lighting', group: 'Key Light', order: 50 },
      { id: environmentExposure, label: 'Exposure', type: 'float', defaultValue: 1, min: 0, max: 4, section: 'Design', group: 'Environment', order: 60 },
      { id: advanced, label: 'Advanced Quality', type: 'float', defaultValue: 0.5, min: 0, max: 1, section: 'Advanced', group: 'Quality', order: 1, exposure: 'advanced' },
      { id: diagnostic, label: 'Runtime Status', type: 'status', defaultValue: 'ready', persistence: 'runtime-only', exposure: 'diagnostic' },
    ],
    mediaSlots: [{ id: mediaSlotId, label: 'Hero Media', accepts: ['image', 'video'] }],
    cameras: [{ id: cameraId, label: 'Hero Camera', projection: 'perspective', controls: { fovDegrees: cinema2Ref(cameraFov) } }],
    defaults: { camera: cinema2Ref(cameraId) },
    effects: [{
      id: effectId,
      typeId: effectTypeId,
      version: 1,
      order: 0,
      parameters: { mix: 0.4 },
      parameterBindings: { mix: cinema2Ref(effectMix) },
    }],
    lighting: {
      lights: [{ id: lightId, type: 'directional', intensity: 1.2, controls: { intensity: cinema2Ref(lightIntensity) } }],
    },
    environment: { exposure: 1, controls: { exposure: cinema2Ref(environmentExposure) } },
  }
}

function inspectorManifest(): Cinema2NativePresetManifest {
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: presetId,
    revision: 1,
    metadata: { name: 'Inspector Test' },
    parameters: [
      { id: parameterId('output-label'), label: 'Output Label', type: 'string', defaultValue: 'safe', section: 'Output', order: 5 },
      { id: enabledId, label: 'Enabled', type: 'boolean', defaultValue: true, section: 'Appearance', group: 'Primary', order: 10 },
      { id: intensityId, label: 'Intensity', type: 'float', defaultValue: 0.4, min: 0, max: 1, step: 0.1, section: 'Appearance', group: 'Primary', order: 11 },
      { id: parameterId('mode'), label: 'Mode', type: 'enum', defaultValue: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], section: 'Appearance', group: 'Secondary', order: 20, enabledWhen: [{ kind: 'parameter-equals', parameterId: enabledId, value: true }] },
      { id: conditionalId, label: 'Conditional', type: 'text', defaultValue: 'visible', section: 'Appearance', group: 'Secondary', order: 21, visibleWhen: [{ kind: 'parameter-equals', parameterId: enabledId, value: true }] },
      { id: parameterId('hdr-only'), label: 'HDR Only', type: 'boolean', defaultValue: false, section: 'Appearance', group: 'Secondary', order: 22, capabilities: [{ id: 'render.hdr', requirement: 'optional' }] },
      { id: parameterId('hidden'), label: 'Hidden', type: 'string', defaultValue: 'hidden', section: 'Appearance', order: 23, exposure: 'hidden' },
      { id: triggerId, label: 'Reseed', type: 'trigger', persistence: 'runtime-only', section: 'Appearance', group: 'Secondary', order: 24 },
      { id: reactAmountId, label: 'React Amount', type: 'float', defaultValue: 0.25, min: 0, max: 1, section: 'React', group: 'Audio', order: 0 },
    ],
  }
}

function compilePlan() {
  const result = compileCinema2NativePreset(inspectorManifest(), { availableCapabilities: ['render.webgl2'] })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.diagnostics.map(diagnostic => diagnostic.message).join('; '))
  return result.plan
}

function createRuntime() {
  return createRuntimeForManifest(inspectorManifest())
}

function createRuntimeForManifest(authored: Readonly<Cinema2NativePresetManifest>) {
  const registry = new Cinema2PresetRegistry()
  expect(registry.register(authored).ok).toBe(true)
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockImplementation((kind: string) => (
    kind === 'webgl2' ? createCinemaMockWebGL() as unknown as RenderingContext : null
  ))
  const result = Cinema2Runtime.create(canvas, {
    presetId: authored.id,
    presetRegistry: registry,
    requestAnimationFrame: vi.fn(() => 1),
    cancelAnimationFrame: vi.fn(),
  })
  expect(result.runtime).not.toBeNull()
  if (!result.runtime) throw new Error(result.error)
  return result.runtime
}

let host: HTMLDivElement | null = null
let root: Root | null = null

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  host?.remove()
  host = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Cinema 2.0 schema-driven Inspector', () => {
  it('projects Electric Storm into the exact four declarative Design parents without changing runtime ownership', () => {
    const result = compileCinema2NativePreset(CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const state = new Cinema2ParameterState(result.plan.parameters)
    const parents = createCinema2DesignParentGroupModel(result.plan, state.getSnapshot())
    const labelsFor = (parentLabel: string) => {
      const parent = parents.find(candidate => candidate.label === parentLabel)
      return [
        ...(parent?.controls.map(control => control.definition.label) ?? []),
        ...(parent?.groups.flatMap(group => group.controls.map(control => control.definition.label)) ?? []),
      ]
    }

    expect(parents.map(parent => parent.label)).toEqual(['Master Controls', 'Design', 'Effects', 'Palette'])
    expect(labelsFor('Master Controls')).toEqual(['Master Intensity'])
    expect(labelsFor('Design')).toEqual(['Strike Rate', 'Branching', 'Thickness', 'Media Influence'])
    expect(labelsFor('Effects')).toEqual(['Glow', 'Haze', 'Flash Intensity', 'Flash Duration', 'Flash Decay'])
    expect(labelsFor('Palette')).toEqual(['Lightning Color', 'Background'])
    expect(parents.flatMap(parent => [
      ...parent.controls,
      ...parent.groups.flatMap(group => group.controls),
    ])).toHaveLength(12)

    const legacyDesignControls = createCinema2InspectorModel(result.plan, state.getSnapshot(), 'design')
      .flatMap(section => section.groups.flatMap(group => group.controls))
    expect(legacyDesignControls.map(control => control.definition.id)).toEqual([CINEMA2_QUALITY_MODE_PARAMETER_ID])
    expect(legacyDesignControls.map(control => control.definition.label)).not.toContain('Background')
    expect(legacyDesignControls.map(control => control.definition.label)).not.toContain('Haze')

    const reactLabels = createCinema2InspectorModel(result.plan, state.getSnapshot(), 'react')
      .flatMap(section => section.groups.flatMap(group => group.controls.map(control => control.definition.label)))
    expect(reactLabels).toEqual([
      'Music Reactivity',
      'Kick Reaction',
      'Transient Reaction',
      'Drop Reaction',
      'Structure Reaction',
      'Impact Shake',
      'Zoom Punch',
    ])
    expect(CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST.environment?.controls).toMatchObject({
      backgroundColor: { $ref: CINEMA2_ELECTRIC_STORM_BACKGROUND_ID },
      fogDensity: { $ref: CINEMA2_ELECTRIC_STORM_HAZE_ID },
    })
  })

  it('renders Electric Storm parent placement through the real runtime Inspector and edits the canonical parameter state', async () => {
    const runtime = createRuntimeForManifest(CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST)
    await act(async () => root?.render(<Cinema2InspectorPanel runtime={runtime} surface="design" />))

    expect([...(host?.querySelectorAll<HTMLElement>('[data-cinema2-parent-group]') ?? [])].map(element => element.dataset.cinema2ParentGroup)).toEqual([
      'master-controls',
      'design',
      'effects',
      'palette',
    ])
    expect(host?.querySelectorAll(`[data-cinema2-control-id="${CINEMA2_ELECTRIC_STORM_BACKGROUND_ID}"]`)).toHaveLength(1)
    expect(host?.querySelectorAll(`[data-cinema2-control-id="${CINEMA2_ELECTRIC_STORM_HAZE_ID}"]`)).toHaveLength(1)
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_QUALITY_MODE_PARAMETER_ID}"]`)).toBeNull()

    const masterIntensity = host?.querySelector<HTMLInputElement>(`#cinema2-parameter-${CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID}`)
    expect(masterIntensity).not.toBeNull()
    await act(async () => {
      if (!masterIntensity) return
      masterIntensity.value = '0.91'
      masterIntensity.dispatchEvent(new Event('input', { bubbles: true }))
      masterIntensity.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(runtime.getParameterState().getValue(CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID)).toBe(0.91)

    runtime.dispose()
  })

  it('keeps Reactor parent presentation generic while leaving Interlock on its existing path', () => {
    const reactorResult = compileCinema2NativePreset(CINEMA2_REACTOR_PRESET_MANIFEST)
    expect(reactorResult.ok).toBe(true)
    if (!reactorResult.ok) return
    const reactorState = new Cinema2ParameterState(reactorResult.plan.parameters)
    const reactorParents = createCinema2DesignParentGroupModel(reactorResult.plan, reactorState.getSnapshot())
    expect(reactorParents.find(parent => parent.id === 'master-controls')?.controls.map(control => control.definition.label)).toEqual([
      'Reactivity',
      'Build Contraction',
    ])
    expect(reactorParents.find(parent => parent.id === 'design')?.groups.map(group => group.label)).toEqual(['Core', 'Shrapnel', 'Composite'])
    expect(reactorParents.find(parent => parent.id === 'effects')?.controls.map(control => control.definition.label)).toEqual([
      'Persistence',
      'Reset Trails',
      'Intensity',
    ])
    expect(reactorParents.find(parent => parent.id === 'palette')?.controls.map(control => control.definition.label)).toEqual([
      'Primary',
      'Secondary',
      'Accent',
      'Background',
    ])

    const result = compileCinema2NativePreset(CINEMA2_INTERLOCK_PRESET_MANIFEST)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const state = new Cinema2ParameterState(result.plan.parameters)
    expect(createCinema2DesignParentGroupModel(result.plan, state.getSnapshot()).every(parent => (
      parent.controls.length === 0 && parent.groups.length === 0
    ))).toBe(true)
    expect(createCinema2InspectorModel(result.plan, state.getSnapshot(), 'design').length).toBeGreaterThan(0)
  })

  it('renders Afterhours through the real runtime Inspector with the four parents and no duplicate legacy controls', async () => {
    const runtime = createRuntimeForManifest(CINEMA2_AFTERHOURS_PRESET_MANIFEST)
    await act(async () => root?.render(<Cinema2InspectorPanel runtime={runtime} surface="design" />))

    expect([...(host?.querySelectorAll<HTMLElement>('[data-cinema2-parent-group]') ?? [])].map(element => element.dataset.cinema2ParentGroup)).toEqual([
      'master-controls',
      'design',
      'effects',
      'palette',
    ])
    expect(host?.querySelectorAll('[data-cinema2-section]')).toHaveLength(0)
    expect(host?.querySelectorAll(`[data-cinema2-control-id="${CINEMA2_AFTERHOURS_BACKGROUND_ID}"]`)).toHaveLength(1)
    expect(host?.querySelectorAll(`[data-cinema2-control-id="${CINEMA2_AFTERHOURS_AUTO_PERFORMANCE_ID}"]`)).toHaveLength(1)
    expect(host?.querySelectorAll('[data-cinema2-control-id="afterhours-reset-trails"]')).toHaveLength(0)
    expect(host?.querySelector(`button#cinema2-parameter-${CINEMA2_AFTERHOURS_BACKGROUND_ID}[data-palette-row-label="Background"]`)).not.toBeNull()
    expect(host?.querySelector(`button#cinema2-parameter-${CINEMA2_AFTERHOURS_PRIMARY_COLOR_ID}[data-palette-row-label="Primary Color"]`)).not.toBeNull()
    expect(host?.querySelector(`button#cinema2-parameter-${CINEMA2_AFTERHOURS_ACCENT_COLOR_ID}[data-palette-row-label="Accent Color"]`)).not.toBeNull()

    const masterIntensity = host?.querySelector<HTMLInputElement>(`#cinema2-parameter-${CINEMA2_AFTERHOURS_MASTER_INTENSITY_ID}`)
    expect(masterIntensity).not.toBeNull()
    await act(async () => {
      if (!masterIntensity) return
      masterIntensity.value = '0.86'
      masterIntensity.dispatchEvent(new Event('input', { bubbles: true }))
      masterIntensity.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(runtime.getParameterState().getValue(CINEMA2_AFTERHOURS_MASTER_INTENSITY_ID)).toBe(0.86)

    expect(runtime.getParameterState().setPersistentValue(CINEMA2_AFTERHOURS_COLOR_MODE_ID, 'auto')).toMatchObject({ ok: true })
    await act(async () => root?.render(<Cinema2InspectorPanel runtime={runtime} surface="design" />))
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_AFTERHOURS_PRIMARY_COLOR_ID}"]`)).toBeNull()
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_AFTERHOURS_ACCENT_COLOR_ID}"]`)).toBeNull()

    runtime.dispose()
  })

  it('projects ordered sections/groups, conditions, exposure and capabilities without preset identity logic', () => {
    const plan = compilePlan()
    const state = new Cinema2ParameterState(plan.parameters)
    const design = createCinema2InspectorModel(plan, state.getSnapshot(), 'design')

    expect(design.map(section => section.label)).toEqual(['Design'])
    expect(design[0]?.groups.map(group => group.label)).toEqual([null, 'Primary', 'Secondary'])
    expect(design.flatMap(section => section.groups.flatMap(group => group.controls.map(control => control.definition.id)))).not.toContain(parameterId('hidden'))
    expect(design[0]?.groups[2]?.controls.find(control => control.definition.id === parameterId('hdr-only'))).toMatchObject({ enabled: false })
    expect(createCinema2InspectorModel(plan, state.getSnapshot(), 'react')[0]?.groups[0]?.controls[0]?.definition.id).toBe(reactAmountId)

    expect(state.setPersistentValue(enabledId, false).ok).toBe(true)
    const disabled = createCinema2InspectorModel(plan, state.getSnapshot(), 'design')
    expect(disabled.flatMap(section => section.groups.flatMap(group => group.controls.map(control => control.definition.id)))).not.toContain(conditionalId)
    expect(disabled.flatMap(section => section.groups.flatMap(group => group.controls)).find(control => control.definition.label === 'Mode')).toMatchObject({ enabled: false })
  })

  it('renders representative controls, updates canonical persistent state, resets it, and dispatches triggers without persisting them', async () => {
    const runtime = createRuntime()
    const resolverDispatch = vi.spyOn(runtime.getTargetResolver(), 'dispatch')

    await act(async () => root?.render(<Cinema2InspectorPanel runtime={runtime} surface="design" />))
    expect(host?.querySelector('[data-cinema2-section="Design"]')).not.toBeNull()
    expect(host?.querySelectorAll('[data-cinema2-section]').length).toBe(1)
    expect(host?.querySelector('[data-cinema2-control-id="hidden"]')).toBeNull()
    expect(host?.querySelector('[data-cinema2-control-id="hdr-only"] button')?.hasAttribute('disabled')).toBe(true)

    const primaryDisclosure = [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(button => button.textContent?.includes('Primary'))
    expect(primaryDisclosure?.getAttribute('aria-expanded')).toBe('true')
    expect(primaryDisclosure?.getAttribute('aria-controls')).toBeTruthy()
    primaryDisclosure?.focus()
    expect(document.activeElement).toBe(primaryDisclosure)
    await act(async () => primaryDisclosure?.click())
    expect(primaryDisclosure?.getAttribute('aria-expanded')).toBe('false')
    await act(async () => primaryDisclosure?.click())

    const intensity = host?.querySelector<HTMLInputElement>(`#cinema2-parameter-${intensityId}`)
    expect(intensity).not.toBeNull()
    await act(async () => {
      if (!intensity) return
      intensity.value = '0.8'
      intensity.dispatchEvent(new Event('input', { bubbles: true }))
      intensity.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(runtime.getParameterState().getValue(intensityId)).toBe(0.8)

    const enabled = host?.querySelector<HTMLButtonElement>(`#cinema2-parameter-${enabledId}`)
    await act(async () => enabled?.click())
    expect(runtime.getParameterState().getValue(enabledId)).toBe(false)
    expect(host?.querySelector(`[data-cinema2-control-id="${conditionalId}"]`)).toBeNull()

    const trigger = host?.querySelector<HTMLButtonElement>(`#cinema2-parameter-${triggerId}`)
    await act(async () => trigger?.click())
    expect(resolverDispatch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(runtime.serializeParameterState()).values).not.toHaveProperty(String(triggerId))

    const reset = [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(button => button.textContent?.includes('Reset Parameters'))
    await act(async () => reset?.click())
    expect(runtime.getParameterState().getValue(intensityId)).toBe(0.4)
    expect(runtime.getParameterState().getValue(enabledId)).toBe(true)

    runtime.dispose()
  })

  it('builds stable semantic sections and effect/media/camera/environment instances from native bindings', () => {
    const result = compileCinema2NativePreset(instanceManifest(), {
      availableCapabilities: ['camera.world', 'lighting', 'media.image', 'media.video'],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const state = new Cinema2ParameterState(result.plan.parameters)
    const design = createCinema2InspectorModel(result.plan, state.getSnapshot(), 'design')

    expect(design.map(section => section.label)).toEqual(['Design', 'Camera', 'Media', 'Effects', 'Environment', 'Advanced'])
    expect(design[0]?.groups[0]).toMatchObject({ kind: 'group', label: null })
    expect(design.find(section => section.label === 'Camera')?.groups[0]).toMatchObject({ kind: 'instance', instanceKind: 'camera', label: 'Hero Camera' })
    expect(design.find(section => section.label === 'Media')?.groups[0]).toMatchObject({ kind: 'instance', instanceKind: 'media', label: 'Hero Media' })
    expect(design.find(section => section.label === 'Effects')?.groups[0]).toMatchObject({ kind: 'instance', instanceKind: 'effect', label: 'Bloom' })
    expect(design.find(section => section.label === 'Environment')?.groups.map(entry => entry.kind === 'instance' ? entry.instanceKind : entry.kind)).toEqual(['light', 'environment'])
    expect(design.find(section => section.label === 'Advanced')?.groups[0]).toMatchObject({ kind: 'group', label: 'Quality', advanced: true })
    expect(design.flatMap(section => section.groups.flatMap(entry => entry.controls.map(control => control.definition.label)))).not.toContain('Runtime Status')
  })

  it('projects all four reference complexity classes through the same generic Inspector architecture', () => {
    const cases = [
      { manifest: CINEMA2_REFERENCE_VISUAL_PRESET_MANIFEST, design: ['Design', 'Effects'], react: [] },
      { manifest: CINEMA2_REACTOR_PRESET_MANIFEST, design: ['Advanced'], react: [] },
      { manifest: CINEMA2_SPATIAL_REFERENCE_PRESET_MANIFEST, design: ['Scene', 'Camera', 'Effects', 'Environment'], react: ['React'] },
      { manifest: CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST, design: ['Advanced'], react: ['React'] },
    ] as const

    for (const testCase of cases) {
      const result = compileCinema2NativePreset(testCase.manifest)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      const state = new Cinema2ParameterState(result.plan.parameters)
      expect(createCinema2InspectorModel(result.plan, state.getSnapshot(), 'design').map(section => section.label)).toEqual(testCase.design)
      expect(createCinema2InspectorModel(result.plan, state.getSnapshot(), 'react').map(section => section.label)).toEqual(testCase.react)
    }
  })

  it('enters the production selector -> Stage -> runtime -> Inspector path', async () => {
    CinemaResizeObserverMock.reset()
    vi.stubGlobal('ResizeObserver', CinemaResizeObserverMock)
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => (
      kind === 'webgl2' ? createCinemaMockWebGL() as unknown as RenderingContext : null
    ))
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960,
      height: 540,
      top: 0,
      left: 0,
      right: 960,
      bottom: 540,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    useReactStore.getState().resetReactView()
    // A holder object, not a bare `let`, because TS's control-flow narrowing
    // can't see assignments made inside a closure that's only invoked
    // indirectly (here, by React via the onRuntimeReady prop) — it keeps
    // treating the variable as its literal `null` initializer at every read
    // after this point, so `activeRuntime?.foo()` type-checks as a property
    // access on `never`. Property access on an object field isn't narrowed
    // the same way, so this sidesteps the bug entirely.
    const activeRuntimeRef: { current: Cinema2Runtime | null } = { current: null }

    function ProductionInspectorHarness() {
      const engineId = useReactStore(state => state.activeReactEngineId)
      const [runtime, setRuntime] = useState<Cinema2Runtime | null>(null)
      return (
        <>
          <ReactEngineBrowser />
          {engineId === 'cinema2' && (
            <>
              <Cinema2Stage
                presetId={CINEMA2_REFERENCE_VISUAL_PRESET_ID}
                onRuntimeReady={next => {
                  activeRuntimeRef.current = next
                  setRuntime(next)
                }}
              />
              <Cinema2InspectorPanel runtime={runtime} surface="design" />
            </>
          )}
        </>
      )
    }

    await act(async () => root?.render(<ProductionInspectorHarness />))
    await act(async () => useReactStore.getState().selectReactEngine('cinema2'))
    expect(host?.querySelector('[data-cinema2-stage="runtime"]')).not.toBeNull()
    expect(activeRuntimeRef.current).not.toBeNull()
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_REFERENCE_VISUAL_PRESET_ID)
    expect(host?.querySelector('[data-cinema2-section="Design"]')).not.toBeNull()
    expect(host?.querySelector('[data-cinema2-section="Effects"]')).not.toBeNull()
    expect(host?.querySelector('[data-cinema2-instance-kind="effect"]')).not.toBeNull()
  })
})
