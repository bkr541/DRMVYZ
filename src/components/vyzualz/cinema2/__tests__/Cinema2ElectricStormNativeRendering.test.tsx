/** @vitest-environment jsdom */

import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL, CinemaResizeObserverMock } from '../../cinema/__tests__/CinemaWebGLTestUtils'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import { Cinema2InspectorPanel } from '../../react/Cinema2InspectorPanel'
import { Cinema2PresetsPanel } from '../../react/Cinema2PresetsPanel'
import { Cinema2Stage } from '../../react/Cinema2Stage'
import {
  CINEMA2_ELECTRIC_STORM_BACKGROUND_ID,
  CINEMA2_ELECTRIC_STORM_BRANCHING_ID,
  CINEMA2_ELECTRIC_STORM_HAZE_ID,
  CINEMA2_ELECTRIC_STORM_FLASH_DECAY_ID,
  CINEMA2_ELECTRIC_STORM_FLASH_DURATION_ID,
  CINEMA2_ELECTRIC_STORM_FLASH_INTENSITY_ID,
  CINEMA2_ELECTRIC_STORM_GLOW_ID,
  CINEMA2_ELECTRIC_STORM_LIGHTNING_COLOR_ID,
  CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID,
  CINEMA2_ELECTRIC_STORM_MUSIC_REACTIVITY_ID,
  CINEMA2_ELECTRIC_STORM_KICK_REACTION_ID,
  CINEMA2_ELECTRIC_STORM_TRANSIENT_REACTION_ID,
  CINEMA2_ELECTRIC_STORM_DROP_REACTION_ID,
  CINEMA2_ELECTRIC_STORM_STRUCTURE_REACTION_ID,
  CINEMA2_ELECTRIC_STORM_IMPACT_SHAKE_ID,
  CINEMA2_ELECTRIC_STORM_ZOOM_PUNCH_ID,
  CINEMA2_ELECTRIC_STORM_PRESET_ID,
  CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID,
  CINEMA2_ELECTRIC_STORM_THICKNESS_ID,
  CINEMA2_QUALITY_MODE_PARAMETER_ID,
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  Cinema2AudioIntelligenceBridge,
  Cinema2ElectricStormStrikeGenerator,
  Cinema2ElectricStormThunderController,
  Cinema2RandomService,
  Cinema2Runtime,
  cinema2NativePresetRegistry,
  type Cinema2ModuleRandomnessFacet,
  type Cinema2PresetId,
} from '..'

function createRandomness(seed = 'electric-storm-stage14a', moduleId = 'electric-storm-procedural-lightning'): Cinema2ModuleRandomnessFacet {
  const service = new Cinema2RandomService({
    presetId: String(CINEMA2_ELECTRIC_STORM_PRESET_ID),
    revision: 2,
    stateKey: '{}',
    mode: 'deterministic',
    seed,
  })
  return Object.freeze({
    sample: (purpose: string, index = 0, substream?: string) => service.sample({ moduleId, purpose, substream }, index),
    probability: (purpose: string, probability: number, index = 0, substream?: string) => service.probability({ moduleId, purpose, substream }, probability, index),
    stream: (purpose: string, substream?: string) => service.stream({ moduleId, purpose, substream }),
    eventStream: (eventId: string, purpose: string, substream?: string) => service.eventStream(moduleId, eventId, purpose, substream),
  })
}

function requestedStrikeSequence(seed: string, count = 10) {
  const generator = new Cinema2ElectricStormStrikeGenerator(createRandomness(seed))
  const strikes = []
  for (let index = 0; index < count; index += 1) {
    generator.request({ tier: index % 3 === 0 ? 'strong' : 'medium', power: 0.9, eventId: `event-${index}` })
    const frame = generator.update(index, 0)
    strikes.push(...frame.started)
  }
  return { generator, strikes }
}

function createRafHarness() {
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextId = 1
  return {
    callbacks,
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    }),
    cancelAnimationFrame: vi.fn((id: number) => callbacks.delete(id)),
    runNext(timestamp = 16.67) {
      const entry = [...callbacks.entries()][0]
      if (!entry) throw new Error('No Cinema 2.0 frame is scheduled.')
      callbacks.delete(entry[0])
      entry[1](timestamp)
    },
  }
}

class FakeCanvas extends EventTarget {
  width = 300
  height = 150
  readonly getContext: ReturnType<typeof vi.fn>
  constructor(gl: WebGL2RenderingContext) {
    super()
    this.getContext = vi.fn((kind: string) => kind === 'webgl2' ? gl : null)
  }
}

function createElectricStormRuntime(seed = 'runtime-seed', audioIntelligenceBridge?: Cinema2AudioIntelligenceBridge) {
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
  const raf = createRafHarness()
  const canvas = new FakeCanvas(gl)
  const result = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
    presetId: CINEMA2_ELECTRIC_STORM_PRESET_ID,
    presetRegistry: cinema2NativePresetRegistry,
    requestAnimationFrame: raf.requestAnimationFrame,
    cancelAnimationFrame: raf.cancelAnimationFrame,
    randomness: { mode: 'deterministic', seed },
    audioIntelligenceBridge,
  })
  if (!result.runtime) throw new Error(result.error)
  return { runtime: result.runtime, gl, raf, canvas }
}

function lastUniformFloat(gl: ReturnType<typeof createCinemaMockWebGL>, name: string): number | undefined {
  const calls = (gl.uniform1f as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === name)
  return calls.at(-1)?.[1] as number | undefined
}

function lastUniformVec3(gl: ReturnType<typeof createCinemaMockWebGL>, name: string): readonly number[] | undefined {
  const calls = (gl.uniform3f as ReturnType<typeof vi.fn>).mock.calls.filter((call: unknown[]) => (call[0] as { name?: string } | null)?.name === name)
  const call = calls.at(-1)
  return call ? [call[1], call[2], call[3]] as const : undefined
}

describe('Cinema 2.0 Electric Storm keeper production behavior', () => {
  it('authors production metadata and safe thunder defaults through schema metadata', () => {
    const manifest = cinema2NativePresetRegistry.get(CINEMA2_ELECTRIC_STORM_PRESET_ID)
    expect(manifest?.revision).toBe(2)
    expect(manifest?.metadata.tags).toContain('keeper')
    const definitions = new Map((manifest?.parameters ?? []).map(definition => [definition.id, definition]))
    expect(definitions.get(CINEMA2_ELECTRIC_STORM_FLASH_INTENSITY_ID)).toMatchObject({ defaultValue: 0.78, min: 0, max: 1.5 })
    expect(definitions.get(CINEMA2_ELECTRIC_STORM_FLASH_DURATION_ID)).toMatchObject({ defaultValue: 0.46, min: 0, max: 1 })
    expect(definitions.get(CINEMA2_ELECTRIC_STORM_FLASH_DECAY_ID)).toMatchObject({ defaultValue: 0.62, min: 0, max: 1 })
  })

  it('generates bounded strike candidates with the preserved topology vocabulary', () => {
    const generator = new Cinema2ElectricStormStrikeGenerator(createRandomness())
    generator.request({ tier: 'hero', power: 1, count: 2, detail: 0.9, eventId: 'hero-a' })
    const frame = generator.update(0, 0)
    expect(frame.started).toHaveLength(2)
    for (const strike of frame.started) {
      expect(strike.start.x).toBeGreaterThanOrEqual(-1)
      expect(strike.start.x).toBeLessThanOrEqual(1)
      expect(strike.end.y).toBeGreaterThanOrEqual(-1)
      expect(strike.end.y).toBeLessThanOrEqual(1)
      expect(['vertical', 'horizontal', 'diagonal']).toContain(strike.orientation)
      expect(['edgeToEdge', 'edgeToInterior', 'interiorToEdge', 'interiorToInterior']).toContain(strike.placement)
      expect(['short', 'medium', 'long']).toContain(strike.lengthClass)
      expect(strike.branchDetail).toBeGreaterThanOrEqual(0)
      expect(strike.branchDetail).toBeLessThanOrEqual(1)
    }
  })

  it('replays the same strike candidates for the same engine seed and diverges for another seed', () => {
    const first = requestedStrikeSequence('same-seed', 8).strikes
    const second = requestedStrikeSequence('same-seed', 8).strikes
    const different = requestedStrikeSequence('different-seed', 8).strikes
    expect(second).toEqual(first)
    expect(different).not.toEqual(first)
  })

  it('preserves local anti-repeat history and stays bounded under high-density stress', () => {
    const { generator, strikes } = requestedStrikeSequence('anti-repeat', 24)
    expect(strikes).toHaveLength(24)
    for (let index = 1; index < strikes.length; index += 1) expect(strikes[index].signature).not.toBe(strikes[index - 1].signature)
    expect(generator.getDiagnostics().historyCount).toBeLessThanOrEqual(8)

    for (let index = 0; index < 5000; index += 1) {
      const frame = generator.update(24 + index / 60, 1)
      expect(frame.active.length).toBeLessThanOrEqual(3)
    }
    expect(generator.getDiagnostics()).toMatchObject({ historyCount: 8, pendingRequestCount: 0 })
  })

  it('resets thunder local state without introducing shared musical event authority', () => {
    const strike = requestedStrikeSequence('thunder', 1).strikes[0]
    if (!strike) throw new Error('Expected a strike fixture.')
    const thunder = new Cinema2ElectricStormThunderController()
    thunder.trigger({ ...strike, tier: 'strong' }, { intensity: 0.8, duration: 0.5, decay: 0.6 })
    expect(thunder.update(0.02).illumination).toBeGreaterThan(0)
    thunder.trigger({ ...strike, tier: 'hero', startedAtSec: strike.startedAtSec + 0.08 }, { intensity: 1, duration: 1, decay: 1 })
    for (let index = 0; index < 20; index += 1) thunder.update(0.02)
    expect(thunder.update(0.02).illumination).toBe(0)
    thunder.reset()
    expect(thunder.update(0.02)).toEqual({ illumination: 0, active: false })
  })

  it('renders through the native runtime, consumes shared Environment state, and releases tracked resources', () => {
    const { runtime, gl, raf, canvas } = createElectricStormRuntime()
    runtime.resize({ width: 960, height: 540, dpr: 1 })
    runtime.start()
    raf.runNext(16.67)

    expect(runtime.getCompiledPresetPlan().presetId).toBe(CINEMA2_ELECTRIC_STORM_PRESET_ID)
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, failedModuleCount: 0, activeResourceLeaseCount: 2 })
    expect(runtime.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 1, failedPassCount: 0 })
    expect(lastUniformVec3(gl, 'u_background')).toEqual([0.004, 0.007, 0.014])
    expect(lastUniformFloat(gl, 'u_fogDensity')).toBeCloseTo(0.08)

    expect(runtime.getParameterState().setPersistentValue(CINEMA2_QUALITY_MODE_PARAMETER_ID, 'performance').ok).toBe(true)
    raf.runNext(25.005)
    expect(runtime.getPerformanceSnapshot()).toMatchObject({ resolvedQuality: 'low', renderTargetScale: 0.67 })
    expect(runtime.getResourceManagerSnapshot().renderTargetScale).toBe(0.67)

    expect(runtime.getParameterState().setPersistentValue(CINEMA2_ELECTRIC_STORM_BACKGROUND_ID, [0.12, 0.04, 0.02, 1]).ok).toBe(true)
    expect(runtime.getParameterState().setPersistentValue(CINEMA2_ELECTRIC_STORM_HAZE_ID, 0.2).ok).toBe(true)
    raf.runNext(33.34)
    expect(lastUniformVec3(gl, 'u_background')).toEqual([0.12, 0.04, 0.02])
    expect(lastUniformFloat(gl, 'u_fogDensity')).toBeCloseTo(0.2)

    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    expect(runtime.getModuleRuntimeSnapshot().activeResourceLeaseCount).toBe(0)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, activeResourceLeaseCount: 0 })
    runtime.dispose()
    expect(gl.__calls.deletedPrograms).toBe(gl.__calls.createdPrograms)
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 0, activeResourceLeaseCount: 0 })
  })

  it('routes canonical drop intent through Audio -> Director -> Choreography -> typed module action and shared Environment targets', () => {
    let frameId = 0
    let sequence = 0
    let timeSec = 1
    let dropActive = false
    let momentTimeSec = 1.5
    const bridge = new Cinema2AudioIntelligenceBridge({
      getFrame: () => ({
        ...DEFAULT_MI_FRAME,
        frameId: ++frameId,
        sourceId: 'electric-storm-14b-test',
        timeSec,
        bands: { ...DEFAULT_MI_FRAME.bands, normalizedBass: 0.86, normalizedHigh: 0.64 },
        energy: { ...DEFAULT_MI_FRAME.energy, instant: 0.9, shortTerm: 0.82, buildProgress: dropActive ? 0.96 : 0.45, dropImpact: dropActive ? 1 : 0 },
        rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, bpmConfidence: 0.96, beatIndex: frameId, beatPhase: 0, beatInBar: frameId % 4, barIndex: Math.floor(frameId / 4), transientConfidence: 0.96 },
        section: { ...DEFAULT_MI_FRAME.section, type: dropActive ? 'drop' : 'build', label: dropActive ? 'Drop' : 'Build', startSec: 0, endSec: 32, progress: 0.5, intensity: dropActive ? 1 : 0.75, confidence: 0.96 },
        semanticMoments: dropActive ? [{ id: 'drop-impact-1', type: 'drop_impact', timeSec: momentTimeSec, confidence: 0.99, source: 'heuristic' }] : [],
        capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: true, sections: true, trackEnergyCurve: true },
        analysisCapabilities: { ...DEFAULT_MI_FRAME.analysisCapabilities!, semanticMoments: true },
        confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.96, rhythm: 0.96, section: 0.96 },
      }),
      getPublicationMeta: () => ({ sequence: ++sequence, publishedAtMs: timeSec * 1000, publisherId: 'electric-storm-14b-test', kind: 'frame' as const }),
    })
    const { runtime, gl, raf } = createElectricStormRuntime('music-route', bridge)
    expect(runtime.getParameterState().setPersistentValue(CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID, 0).ok).toBe(true)
    runtime.start()
    raf.runNext(16.67)

    dropActive = true
    timeSec = 1.5
    raf.runNext(33.34)

    expect(runtime.getVisualDirectorFrame()?.authority.impact).toMatchObject({ available: true, occurred: true })
    expect(runtime.getChoreographyRuntimeSnapshot()).toMatchObject({ dispatchedActionCount: 1 })
    expect(runtime.getModuleRuntimeSnapshot()).toMatchObject({ activeModuleCount: 1, failedModuleCount: 0 })
    expect(lastUniformFloat(gl, 'u_exposure')).toBeGreaterThan(1)
    expect(lastUniformFloat(gl, 'u_fogDensity')).toBeGreaterThan(0.08)

    // Upstream may refine a marker's timestamp while retaining its canonical ID.
    // Choreography must deduplicate the repeated event identity instead of spawning twice.
    momentTimeSec = 1.55
    timeSec = 1.6
    raf.runNext(50.01)
    expect(runtime.getChoreographyRuntimeSnapshot()).toMatchObject({ dispatchedActionCount: 1 })
    expect(runtime.getChoreographyRuntimeSnapshot().deduplicatedEventCount).toBeGreaterThan(0)
    expect(lastUniformFloat(gl, 'u_impactStrength')).toBeGreaterThan(0)

    dropActive = false
    timeSec = 5
    raf.runNext(66.68)
    expect(runtime.getAudioIntelligenceFrame()?.discontinuity.occurred).toBe(true)
    expect(runtime.getChoreographyRuntimeSnapshot().resetCount).toBeGreaterThan(0)
    expect(lastUniformFloat(gl, 'u_impactStrength')).toBe(0)
    runtime.dispose()
  })

  it('authors stable kick/transient/downbeat/phrase/section/drop routes with shared cooldown/probability policy and no duplicate drop section route', () => {
    const plan = cinema2NativePresetRegistry.compile(CINEMA2_ELECTRIC_STORM_PRESET_ID)
    expect(plan.ok).toBe(true)
    if (!plan.ok) throw new Error('Expected Electric Storm preset to compile.')
    const rules = plan.plan.manifest.choreography?.rules ?? []
    expect(rules.map(rule => rule.source.signal)).toEqual(expect.arrayContaining(['kick', 'transient', 'downbeat', 'phrase', 'section-change', 'drop']))
    const downbeat = rules.find(rule => rule.source.signal === 'downbeat')
    const drop = rules.find(rule => rule.source.signal === 'drop')
    expect(downbeat?.actions[0]).toMatchObject({ operation: 'spawn', cooldownBeats: 2, quantizeBeats: 1 })
    expect(drop?.actions).toEqual(expect.arrayContaining([expect.objectContaining({ operation: 'envelope', composition: 'add' })]))
    expect(rules.filter(rule => rule.source.signal === 'kick' || rule.source.signal === 'transient').every(rule => rule.actions[0]?.probability != null)).toBe(true)
    const section = rules.find(rule => rule.source.signal === 'section-change')
    expect(section?.conditions).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'section-type' })]))
    expect(JSON.stringify(section?.conditions)).not.toContain('"drop"')
  })

  it('keeps deterministic selection reproducible while session-organic activation entropy changes the sequence', () => {
    const deterministicA = new Cinema2RandomService({ presetId: String(CINEMA2_ELECTRIC_STORM_PRESET_ID), revision: 2, stateKey: '{}', mode: 'deterministic', seed: '14b' })
    const deterministicB = new Cinema2RandomService({ presetId: String(CINEMA2_ELECTRIC_STORM_PRESET_ID), revision: 2, stateKey: '{}', mode: 'deterministic', seed: '14b' })
    const namespace = { moduleId: 'choreography', eventId: 'event-14b', purpose: 'strike-probability' }
    expect(deterministicB.sample(namespace, 0)).toBe(deterministicA.sample(namespace, 0))

    const organicA = new Cinema2RandomService({ presetId: String(CINEMA2_ELECTRIC_STORM_PRESET_ID), revision: 2, stateKey: '{}', mode: 'session-organic', seed: '14b', activationEntropy: () => 'activation-a' })
    const organicB = new Cinema2RandomService({ presetId: String(CINEMA2_ELECTRIC_STORM_PRESET_ID), revision: 2, stateKey: '{}', mode: 'session-organic', seed: '14b', activationEntropy: () => 'activation-b' })
    expect(organicB.sample(namespace, 0)).not.toBe(organicA.sample(namespace, 0))
  })

  it('keeps generic runtime owners free of Electric Storm identity branches', () => {
    expect(Cinema2Runtime.toString().toLowerCase()).not.toContain('electricstorm')
    expect(Cinema2Runtime.toString().toLowerCase()).not.toContain('electric-storm')
  })
})

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

describe('Cinema 2.0 Electric Storm production selection path', () => {
  it('selects Electric Storm 2.0 through the real preset browser, activates Stage, and exposes Stage 17A schema-driven Design and React controls', async () => {
    CinemaResizeObserverMock.reset()
    vi.stubGlobal('ResizeObserver', CinemaResizeObserverMock)
    const raf = createRafHarness()
    vi.stubGlobal('requestAnimationFrame', raf.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', raf.cancelAnimationFrame)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind: string) => kind === 'webgl2' ? createCinemaMockWebGL() as unknown as RenderingContext : null)
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0, toJSON: () => ({}),
    })
    const activeRuntimeRef: { current: Cinema2Runtime | null } = { current: null }

    function Harness() {
      const [presetId, setPresetId] = useState<Cinema2PresetId>(CINEMA2_RUNTIME_FOUNDATION_PRESET_ID)
      const [runtime, setRuntime] = useState<Cinema2Runtime | null>(null)
      return <>
        <Cinema2PresetsPanel activePresetId={presetId} onSelectPreset={setPresetId} />
        <Cinema2Stage presetId={presetId} onRuntimeReady={next => { activeRuntimeRef.current = next; setRuntime(next) }} />
        <Cinema2InspectorPanel runtime={runtime} surface="design" />
        <Cinema2InspectorPanel runtime={runtime} surface="react" />
      </>
    }

    await act(async () => root?.render(<Harness />))
    const button = host?.querySelector<HTMLButtonElement>(`[data-cinema2-preset-id="${CINEMA2_ELECTRIC_STORM_PRESET_ID}"]`)
    expect(button?.textContent).toContain('Electric Storm 2.0')
    await act(async () => button?.click())

    expect(activeRuntimeRef.current?.getCompiledPresetPlan().presetId).toBe(CINEMA2_ELECTRIC_STORM_PRESET_ID)
    for (const id of [
      CINEMA2_ELECTRIC_STORM_LIGHTNING_COLOR_ID,
      CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID,
      CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID,
      CINEMA2_ELECTRIC_STORM_BRANCHING_ID,
      CINEMA2_ELECTRIC_STORM_THICKNESS_ID,
      CINEMA2_ELECTRIC_STORM_BACKGROUND_ID,
      CINEMA2_ELECTRIC_STORM_HAZE_ID,
      CINEMA2_ELECTRIC_STORM_FLASH_DECAY_ID,
      CINEMA2_ELECTRIC_STORM_FLASH_DURATION_ID,
      CINEMA2_ELECTRIC_STORM_FLASH_INTENSITY_ID,
      CINEMA2_ELECTRIC_STORM_GLOW_ID,
      CINEMA2_ELECTRIC_STORM_MUSIC_REACTIVITY_ID,
      CINEMA2_ELECTRIC_STORM_KICK_REACTION_ID,
      CINEMA2_ELECTRIC_STORM_TRANSIENT_REACTION_ID,
      CINEMA2_ELECTRIC_STORM_DROP_REACTION_ID,
      CINEMA2_ELECTRIC_STORM_STRUCTURE_REACTION_ID,
      CINEMA2_ELECTRIC_STORM_IMPACT_SHAKE_ID,
      CINEMA2_ELECTRIC_STORM_ZOOM_PUNCH_ID,
      CINEMA2_QUALITY_MODE_PARAMETER_ID,
    ]) expect(host?.querySelector(`[data-cinema2-control-id="${id}"]`)).not.toBeNull()
    expect(host?.querySelector(`[data-cinema2-control-id="${CINEMA2_ELECTRIC_STORM_STRUCTURE_REACTION_ID}"]`)).not.toBeNull()

    await act(async () => raf.runNext())
    expect(activeRuntimeRef.current?.getRenderGraphExecutorSnapshot()).toMatchObject({ frameCount: 1, executedPassCount: 1, failedPassCount: 0 })
  })
})
