import { describe, expect, it } from 'vitest'
import { Cinema2InertiaMotion, INERTIA_PATTERNS, inertiaPatternPose, type InertiaMotionSettings } from '../modules/inertia/Cinema2InertiaMotion'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { CINEMA2_INERTIA_PRESET_MANIFEST, inertiaParameterId } from '../presets/Cinema2InertiaPreset'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createCinema2DesignParentGroupModel } from '../parameters/Cinema2InspectorModel'

const defaults: InertiaMotionSettings = { pattern: 'reference-cycle', sync: true, speed: 1, amount: 0.65, deformation: 0.45, damping: 0.65, patternChange: false, trigger: 'bar4', editRevision: 0 }
let frameId = 0
function frame(time: number, options: { paused?: boolean; present?: boolean; hostSync?: boolean; bpm?: number | null; track?: string } = {}): Cinema2ModuleFrameReadContext {
  return { frameId: ++frameId, timestampMs: time * 1000, elapsedTimeSec: time, deltaTimeSec: 0.1, contextGeneration: 1,
    viewport: { width: 954, height: 954, dpr: 1 }, audio: null, director: null,
    transport: { sourcePresent: options.present ?? true, playing: !options.paused, paused: !!options.paused, animationActive: !options.paused, analysisActive: false,
      timeSec: time, bpm: options.bpm === undefined ? 120 : options.bpm, bpmSync: options.hostSync ?? true, trackId: options.track ?? 'motion-unit' } }
}
function run(settings = defaults, options: Parameters<typeof frame>[1] = {}, end = 1.4) {
  const runtime = new Cinema2InertiaMotion()
  let output = runtime.update(frame(0, options), settings)
  for (let time = 0.1; time <= end + 0.001; time += 0.1) output = runtime.update(frame(time, options), settings)
  return { runtime, output }
}

describe('Inertia native motion and controls', () => {
  it('has six distinct motion vocabularies and static selected poses', () => {
    const poses = INERTIA_PATTERNS.map(([pattern]) => inertiaPatternPose(pattern, 0.27, 0.65, 0.45, 0.65))
    expect(new Set(poses.map(p => JSON.stringify(p))).size).toBe(6)
    for (const [pattern] of INERTIA_PATTERNS) {
      expect(inertiaPatternPose(pattern, 0.2, 0.65, 0.45, 0.65)).not.toEqual(inertiaPatternPose(pattern, 0.4, 0.65, 0.45, 0.65))
    }
  })
  it('honors the host/preset Sync truth table and missing-tempo seconds fallback', () => {
    const off = run({ ...defaults, sync: false }).output
    expect(run(defaults, { hostSync: false }).output).toEqual(off)
    expect(run(defaults, { bpm: null }).output).toEqual(off)
    expect(run({ ...defaults, sync: false }, { bpm: 90 }).output).toEqual(run({ ...defaults, sync: false }, { bpm: 150 }).output)
    expect(run(defaults, { bpm: 90 }).output).not.toEqual(run(defaults, { bpm: 150 }).output)
  })
  it('freezes on pause, stays still without a track, and resets predictably on seek/track change', () => {
    const { runtime, output } = run()
    expect(runtime.update(frame(1.4, { paused: true }), defaults)).toEqual(output)
    expect(runtime.update(frame(1.4, { paused: true }), defaults)).toEqual(output)
    expect(run(defaults, { present: false }).output).toEqual(run(defaults, { present: false }, 3).output)
    expect(runtime.update(frame(0, { track: 'replacement' }), defaults)).toEqual(new Cinema2InertiaMotion().update(frame(0, { track: 'replacement' }), defaults))
  })
  it('supports stopped geometry, paused manual edits, damping and speed without changing the camera', () => {
    expect(JSON.stringify(run({ ...defaults, amount: 0 }).output)).toBe(JSON.stringify(run({ ...defaults, amount: 0 }, {}, 2.5).output))
    expect(run({ ...defaults, damping: 0 }).output).not.toEqual(run({ ...defaults, damping: 1 }).output)
    expect(run({ ...defaults, speed: 0.25 }).output).not.toEqual(run({ ...defaults, speed: 2 }).output)
    const runtime = new Cinema2InertiaMotion()
    const before = runtime.update(frame(0, { paused: true }), defaults)
    const after = runtime.update(frame(0, { paused: true }), { ...defaults, pattern: 'slice-shear', patternChange: true, editRevision: 1 })
    expect(after).not.toEqual(before)
  })
  it('places required controls under generic parents and conditionally shows the exact canonical Trigger', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_INERTIA_PRESET_MANIFEST)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const state = new Cinema2ParameterState(compiled.plan.parameters)
    const model = () => createCinema2DesignParentGroupModel(compiled.plan, state.getSnapshot())
    const controls = () => model().flatMap(parent => [...parent.controls, ...parent.groups.flatMap(group => group.controls)])
    expect(controls().find(c => c.definition.id === inertiaParameterId('trigger'))).toBeUndefined()
    expect(state.setPersistentValue(inertiaParameterId('pattern-change'), true).ok).toBe(true)
    expect(controls().find(c => c.definition.id === inertiaParameterId('trigger'))?.definition.options).toEqual(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(model().find(g => g.id === 'palette')!.controls.filter(c => c.definition.type === 'color')).toHaveLength(5)
    const sync = CINEMA2_INERTIA_PRESET_MANIFEST.parameters!.find(p => p.label === 'BPM Sync')!
    expect(sync.designParentGroup).toBe('master-controls')
    expect(CINEMA2_INERTIA_PRESET_MANIFEST.parameters!.find(p => p.label === 'Pattern')!.options).toHaveLength(6)
  })
})
