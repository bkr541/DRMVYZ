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
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  Cinema2ParameterState,
  Cinema2PresetRegistry,
  Cinema2Runtime,
  cinema2NamespacedId,
  cinema2StableId,
  compileCinema2NativePreset,
  createCinema2InspectorModel,
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
  const registry = new Cinema2PresetRegistry()
  expect(registry.register(inspectorManifest()).ok).toBe(true)
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockImplementation((kind: string) => (
    kind === 'webgl2' ? createCinemaMockWebGL() as unknown as RenderingContext : null
  ))
  const result = Cinema2Runtime.create(canvas, {
    presetId,
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
  it('projects ordered sections/groups, conditions, exposure and capabilities without preset identity logic', () => {
    const plan = compilePlan()
    const state = new Cinema2ParameterState(plan.parameters)
    const design = createCinema2InspectorModel(plan, state.getSnapshot(), 'design')

    expect(design.map(section => section.label)).toEqual(['Output', 'Appearance'])
    expect(design[1]?.groups.map(group => group.label)).toEqual(['Primary', 'Secondary'])
    expect(design.flatMap(section => section.groups.flatMap(group => group.controls.map(control => control.definition.id)))).not.toContain(parameterId('hidden'))
    expect(design[1]?.groups[1]?.controls.find(control => control.definition.id === parameterId('hdr-only'))).toMatchObject({ enabled: false })
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
    expect(host?.querySelector('[data-cinema2-section="Output"]')).not.toBeNull()
    expect(host?.querySelector('[data-cinema2-section="Appearance"]')).not.toBeNull()
    expect(host?.querySelector('[data-cinema2-control-id="hidden"]')).toBeNull()
    expect(host?.querySelector('[data-cinema2-control-id="hdr-only"] button')?.hasAttribute('disabled')).toBe(true)

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
    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
    expect(host?.querySelector('[data-cinema2-inspector="empty"]')?.textContent).toContain('No Cinema 2.0 parameters')
  })
})
