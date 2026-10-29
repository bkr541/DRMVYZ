import { describe, expect, it } from 'vitest'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_INERTIA_PRESET_MANIFEST } from '../presets/Cinema2InertiaPreset'
import { Cinema2InertiaAudio } from '../modules/inertia/Cinema2InertiaAudio'
import { Cinema2InertiaMotion, type InertiaMotionSettings } from '../modules/inertia/Cinema2InertiaMotion'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2AfterhoursTriggerId } from '../modules/Cinema2AfterhoursNativeModule'
import { inertiaMusicFixture, type InertiaFixtureOptions } from '../../../../test/support/InertiaMusicFixture'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import { Cinema2InertiaPerformance } from '../modules/inertia/Cinema2InertiaPerformance'
import { validateCinema2PresetAuthoringConventions } from '../presets/Cinema2PresetAuthoring'

const settings: InertiaMotionSettings = { pattern: 'reference-cycle', patternChange: false, trigger: 'beat', editRevision: 0, sync: false, speed: 1, amount: 0, deformation: 0.45, damping: 0.65 }
function harness() {
  const compiled = compileCinema2NativePreset(CINEMA2_INERTIA_PRESET_MANIFEST)
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
  const state = new Cinema2ParameterState(compiled.plan.parameters)
  const resolver = new Cinema2FinalValueResolver(compiled.plan.targets, { resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId) })
  const choreography = new Cinema2ChoreographyRuntime(compiled.plan, state, resolver)
  const director = new Cinema2VisualDirector()
  let raw = inertiaMusicFixture({}, 0, 1, 'audio-test'), sequence = 0, visual = 0
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => raw, getPublicationMeta: () => ({ sequence, kind: 'frame', publisherId: 'inertia-unit', publishedAtMs: 0 }) })
  const read = (name: string) => Number(resolver.resolve(compiled.plan.targets.targets.find(t => t.kind === 'module' && t.property === name)!.id).value)
  const step = (time: number, options: InertiaFixtureOptions = {}, flags: { paused?: boolean; track?: string; sourceFrame?: number; director?: boolean } = {}): Cinema2ModuleFrameReadContext => {
    sequence++; visual++
    raw = inertiaMusicFixture(options, time, flags.sourceFrame ?? sequence, options.trackId ?? flags.track ?? 'audio-test')
    const frame: Cinema2ModuleFrameReadContext = {
      frameId: visual, timestampMs: time * 1000, elapsedTimeSec: time, deltaTimeSec: 0.05, contextGeneration: 1,
      viewport: { width: 954, height: 954, dpr: 1 }, audio: bridge.capture(visual), director: null,
      transport: { sourcePresent: true, playing: !flags.paused, paused: !!flags.paused, analysisActive: true, animationActive: !flags.paused,
        timeSec: time, bpm: 120, bpmSync: false, trackId: flags.track ?? 'audio-test' },
    }
    if (flags.director) frame.director = director.capture(frame.audio!)
    choreography.update(frame)
    return frame
  }
  return { step, read, state, choreography }
}

describe('Inertia shared musical response', () => {
  it('delivers shared continuous facts through the actual target resolver and controls separate visual dimensions', () => {
    const h = harness(), audio = new Cinema2InertiaAudio()
    audio.update(h.step(0, { energy: 0, bass: 0 }), h.read, 1, 1, 1)
    let response
    for (let i = 1; i <= 20; i++) response = audio.update(h.step(i * 0.05, { energy: 1, bass: 1, high: 1, build: 1, vocal: 1 }), h.read, 1, 1, 1)
    expect(h.read('energyMotion')).toBeGreaterThan(0.9)
    expect(h.read('bassPressure')).toBeGreaterThan(0.9)
    expect(response!.displacement).toBeLessThan(-0.04)
    expect(response!.sparkle).toBeGreaterThan(0.08)
    expect(response!.drive).toBeLessThan(0.85)
    const off = audio.update(h.step(1.05, { energy: 1, bass: 1, high: 1 }), h.read, 0, 1, 1)
    expect(off).toEqual({ displacement: 0, shear: 0, corePulse: 0, sparkle: 0, drive: 1 })
  })
  it('uses shared rhythmic envelopes, avoids additive snare/transient double force, and returns to base', () => {
    const h = harness(), audio = new Cinema2InertiaAudio()
    audio.update(h.step(0, { energy: 1 }), h.read, 1, 1, 1)
    audio.update(h.step(0.1, { energy: 1, event: 'kick', eventTime: 0.1 }), h.read, 1, 1, 1)
    const kick = audio.update(h.step(0.15, { energy: 1 }), h.read, 1, 1, 1)
    expect(kick.corePulse).toBeGreaterThan(0)
    expect(kick.displacement).toBeGreaterThan(0)
    audio.update(h.step(0.2, { energy: 1, event: 'snare', eventTime: 0.2, transient: true }), h.read, 1, 1, 1)
    const snare = audio.update(h.step(0.25, { energy: 1 }), h.read, 1, 1, 1)
    expect(snare.shear).toBeGreaterThan(0)
    expect(snare.shear).toBeLessThanOrEqual(0.025)
    const settled = audio.update(h.step(0.7, { energy: 1 }), h.read, 1, 1, 1)
    expect(settled.corePulse).toBe(0); expect(settled.shear).toBe(0)
  })
  it('respects geometry zeroes, pause/resume fencing, missing signals, and source identity', () => {
    const h = harness(), audio = new Cinema2InertiaAudio()
    audio.update(h.step(0), h.read, 1, 1, 1)
    audio.update(h.step(0.1, { event: 'kick', eventTime: 0.1 }), h.read, 1, 1, 1)
    const zero = audio.update(h.step(0.15), h.read, 1, 0, 1)
    expect(zero.displacement).toBe(0); expect(zero.corePulse).toBe(0); expect(zero.drive).toBe(1)
    const paused = audio.update(h.step(0.15, {}, { paused: true }), h.read, 1, 1, 1)
    expect(paused.corePulse).toBe(0)
    expect(audio.update(h.step(0.15), h.read, 1, 1, 1).corePulse).toBe(0)
    const foreign = audio.update(h.step(0.2, { trackId: 'foreign', energy: 1 }), h.read, 1, 1, 1)
    expect(foreign.drive).toBe(1)
    expect(audio.update(h.step(0.25, { featuresAvailable: false }), h.read, 1, 1, 1).sparkle).toBe(0)
  })
  it('uses shared audio time for structural event fences when host transport runs ahead', () => {
    const h = harness(), audio = new Cinema2InertiaAudio()
    const ahead = (f: Cinema2ModuleFrameReadContext) => ({ ...f, transport: { ...f.transport!, timeSec: f.transport!.timeSec + 0.2 } })
    audio.update(ahead(h.step(0, { energy: 1 })), h.read, 1, 1, 1)
    audio.update(ahead(h.step(0.1, { energy: 1, event: 'drop', eventTime: 0.1 })), h.read, 1, 1, 1)
    const response = audio.update(ahead(h.step(0.15, { energy: 1 })), h.read, 1, 1, 1)
    expect(h.read('dropRelease')).toBeGreaterThan(0)
    expect(response.displacement).toBeGreaterThan(0)
  })
})

describe('Inertia final Director and temporary performance authority', () => {
  it('uses shared Director meaning only within existing user and geometry ceilings', () => {
    const run = (useDirector: boolean, response = 1) => {
      const h = harness(), audio = new Cinema2InertiaAudio()
      let result
      for (let i = 0; i < 20; i++) result = audio.update(h.step(i * 0.05, { energy: 0.4, bass: 0.6, build: 0.5 }, { director: useDirector }), h.read, response, 0.65, 0.45)
      return { result: result!, h }
    }
    const base = run(false), directed = run(true)
    expect(directed.h.read('directorIntensity')).toBeGreaterThan(0)
    expect(directed.result.drive).toBeGreaterThan(base.result.drive)
    expect(directed.result.drive).toBeLessThanOrEqual(1)
    expect(Math.abs(directed.result.displacement)).toBeLessThanOrEqual(0.06)
    expect(run(true, 0).result).toEqual(run(false, 0).result)
  })
  it('allows fresh build/drop overrides, bounds them, and restores the current underlying base', () => {
    const h = harness(), auto = new Cinema2InertiaPerformance()
    const update = (time: number, options: InertiaFixtureOptions = {}, base = 'reference-cycle' as const) => {
      const frame = h.step(time, options)
      return auto.update(frame, base, true, 1, 0, h.read('buildCompression'))
    }
    expect(update(0).kind).toBeNull()
    expect(update(0.1, { build: 1 }).pattern).toBe('countertwist')
    expect(update(0.2, { build: 1, event: 'drop', eventTime: 0.2 }).pattern).toBe('collapse-release')
    let result
    for (let i = 3; i <= 24; i++) result = update(i * 0.1, { build: 1 })
    expect(result!.kind).toBeNull() // drop max two seconds, held build cannot restart
    expect(result!.pattern).toBe('reference-cycle')
    expect(auto.update(h.step(2.5, { build: 1 }), 'slice-shear', true, 1, 0, 1).pattern).toBe('slice-shear')
  })
  it('does not override an enable/manual-edit/resume frame with already-active build or drop', () => {
    const h = harness(), auto = new Cinema2InertiaPerformance()
    expect(auto.update(h.step(0, { build: 1 }), 'reference-cycle', true, 1, 0, 1).kind).toBeNull()
    expect(auto.update(h.step(0.1, { build: 1 }), 'reference-cycle', true, 1, 0, 1).kind).toBeNull()
    auto.update(h.step(0.2), 'reference-cycle', true, 1, 0, 0)
    expect(auto.update(h.step(0.3, { build: 1 }), 'reference-cycle', true, 1, 0, 1).kind).toBe('build')
    expect(auto.update(h.step(0.4, { build: 1 }), 'slice-shear', true, 1, 1, 1).pattern).toBe('slice-shear')
    expect(auto.update(h.step(0.5, { build: 1 }), 'slice-shear', true, 1, 1, 1).pattern).toBe('slice-shear')
    expect(auto.update(h.step(0.6, { event: 'drop', eventTime: 0.6 }), 'slice-shear', true, 1, 1, 0).kind).toBe('drop')
    expect(auto.update(h.step(0.6, {}, { paused: true }), 'slice-shear', true, 1, 1, 0).kind).toBeNull()
    expect(auto.update(h.step(0.6, { build: 1 }), 'slice-shear', true, 1, 1, 1).kind).toBeNull()
    expect(auto.update(h.step(0.7, { build: 1 }), 'slice-shear', false, 1, 1, 1).kind).toBeNull()
    expect(auto.update(h.step(0.8, { build: 1 }), 'slice-shear', true, 0, 1, 1).kind).toBeNull()
  })
  it('expires a fresh build at its bounded duration and does not restart from held context', () => {
    const h = harness(), auto = new Cinema2InertiaPerformance()
    auto.update(h.step(0), 'reference-cycle', true, 1, 0, 0)
    expect(auto.update(h.step(0.1, { build: 1 }), 'reference-cycle', true, 1, 0, 1).kind).toBe('build')
    let result
    for (let i = 2; i <= 50; i++) result = auto.update(h.step(i * 0.1, { build: 1 }), 'reference-cycle', true, 1, 0, 1)
    expect(result!.kind).toBeNull()
    expect(result!.pattern).toBe('reference-cycle')
  })
  it('lets same-value manual reselection cancel an override until a separately fresh event', () => {
    const h = harness(), motion = new Cinema2InertiaMotion()
    const s = { ...settings, patternChange: true, autoPerformance: true, audioResponse: 1 }
    motion.update(h.step(0), s)
    motion.update(h.step(0.1, { event: 'drop', eventTime: 0.1, eventId: 1 }), s)
    expect(motion.getPerformedPattern()).toBe('collapse-release')
    const manual = { ...s, editRevision: 1 }
    motion.update(h.step(0.2, { event: 'drop', eventTime: 0.1, eventId: 1 }), manual)
    expect(motion.getPerformedPattern()).toBe('reference-cycle')
    motion.update(h.step(0.25, { event: 'drop', eventTime: 0.1, eventId: 1 }), manual)
    expect(motion.getPerformedPattern()).toBe('reference-cycle')
    motion.update(h.step(0.3, { event: 'drop', eventTime: 0.3, eventId: 2 }), manual)
    expect(motion.getPerformedPattern()).toBe('collapse-release')
    expect(manual.patternChange).toBe(true)
  })
  it('advances the base under a temporary override without mutating Pattern Change or Trigger', () => {
    const h = harness(), motion = new Cinema2InertiaMotion()
    const s = { ...settings, patternChange: true, autoPerformance: true, audioResponse: 1 }
    const update = (time: number, options: InertiaFixtureOptions) => {
      const frame = h.step(time, options)
      motion.update(frame, { ...s, buildValue: h.read('buildCompression') })
    }
    update(0, {})
    update(0.1, { event: 'drop', eventTime: 0.1 })
    expect(motion.getPerformedPattern()).toBe('collapse-release')
    update(0.2, { event: 'beat', eventTime: 0.2, beatIndex: 1 })
    expect(motion.getActivePattern()).toBe('countertwist')
    expect(motion.getPerformedPattern()).toBe('collapse-release')
    for (let i = 3; i <= 23; i++) update(i * 0.1, {})
    expect(motion.getPerformedPattern()).toBe('countertwist')
    expect(s.patternChange).toBe(true); expect(s.trigger).toBe('beat'); expect(s.pattern).toBe('reference-cycle')
  })
  it('declares fully consumed final controls and hard-disabled finishing effects', () => {
    expect(validateCinema2PresetAuthoringConventions({ role: 'keeper', manifest: CINEMA2_INERTIA_PRESET_MANIFEST }).diagnostics).toEqual([])
    expect(CINEMA2_INERTIA_PRESET_MANIFEST.parameters!.find(p => p.label === 'Auto Performance')!.defaultValue).toBe(false)
    expect(CINEMA2_INERTIA_PRESET_MANIFEST.effects!.every(e => e.enabled === false)).toBe(true)
    expect(CINEMA2_INERTIA_PRESET_MANIFEST.parameters!.filter(p => p.label === 'Bloom Amount' || p.label === 'Trails Amount').every(p => p.visibleWhen?.length === 1)).toBe(true)
  })
})

const triggerCases = [
  ['beat', 'beat', 1], ['kick', 'kick', 1], ['snare', 'snare', 1], ['downbeat', 'downbeat', 4],
  ['beat2', 'beat', 2], ['beat4', 'beat', 4], ['bar', 'bar', 4], ['bar4', 'bar', 16], ['bar8', 'bar', 32],
  ['phrase', 'phrase', 16], ['drop', 'drop', 16],
] as const
describe('Inertia canonical pattern events and manual authority', () => {
  it.each(triggerCases)('%s switches on a fresh shared event, suppresses repeats, and preserves manual selection', (trigger, event, beatIndex) => {
    const h = harness(), motion = new Cinema2InertiaMotion()
    const s = { ...settings, patternChange: true, trigger: trigger as Cinema2AfterhoursTriggerId }
    motion.update(h.step(0), s)
    motion.update(h.step(0.1, { event, eventTime: 0.1, eventId: 1, beatIndex }), s)
    expect(motion.getActivePattern()).toBe('countertwist')
    motion.update(h.step(0.15, { event, eventTime: 0.1, eventId: 1, beatIndex, holdEvent: true }, { sourceFrame: 2 }), s)
    expect(motion.getActivePattern()).toBe('countertwist')
    const manual = { ...s, editRevision: 1 }
    motion.update(h.step(0.2, { event, eventTime: 0.1, eventId: 1, beatIndex, holdEvent: true }, { sourceFrame: 2 }), manual)
    expect(motion.getActivePattern()).toBe('reference-cycle')
    motion.update(h.step(0.25, { event, eventTime: 0.1, eventId: 1, beatIndex, holdEvent: true }, { sourceFrame: 2 }), manual)
    expect(motion.getActivePattern()).toBe('reference-cycle')
    const interval = trigger === 'bar8' ? 32 : trigger === 'bar4' ? 16 : trigger === 'bar' || trigger === 'beat4' || trigger === 'downbeat' ? 4 : trigger === 'beat2' ? 2 : 1
    motion.update(h.step(0.3, { event, eventTime: 0.3, eventId: 2, beatIndex: beatIndex + interval }), manual)
    expect(motion.getActivePattern()).toBe('countertwist')
    motion.update(h.step(0.35), { ...manual, patternChange: false })
    expect(motion.getActivePattern()).toBe('reference-cycle')
    expect(manual.patternChange).toBe(true)
  })
  it('rejects unqualified intervals, holds on pause, and resets base on seek/analysis/track changes', () => {
    const h = harness(), motion = new Cinema2InertiaMotion(), s = { ...settings, trigger: 'bar4' as const, patternChange: true }
    motion.update(h.step(0), s)
    motion.update(h.step(0.1, { event: 'bar', eventTime: 0.1, beatIndex: 4 }), s)
    expect(motion.getActivePattern()).toBe('reference-cycle')
    motion.update(h.step(0.2, { event: 'bar', eventTime: 0.2, beatIndex: 16 }), s)
    expect(motion.getActivePattern()).toBe('countertwist')
    motion.update(h.step(0.2, {}, { paused: true }), s)
    expect(motion.getActivePattern()).toBe('countertwist')
    motion.update(h.step(0.2), s)
    expect(motion.getActivePattern()).toBe('countertwist')
    motion.update(h.step(0), s)
    expect(motion.getActivePattern()).toBe('reference-cycle')
    motion.update(h.step(0.1, { revision: 'updated' }), s)
    expect(motion.getActivePattern()).toBe('reference-cycle')
    motion.update(h.step(0.2, {}, { track: 'replacement' }), s)
    expect(motion.getActivePattern()).toBe('reference-cycle')
  })
})

describe('Inertia bounded force and recovery choreography', () => {
  function trajectory(event: 'kick' | 'snare' | 'drop', samples: number[], damping = 0.65, build = 0) {
    const h = harness(), audio = new Cinema2InertiaAudio()
    const before = audio.update(h.step(0, { energy: 1, build }), h.read, 1, 1, 1, damping)
    const saved = h.state.serialize()
    audio.update(h.step(0.1, { energy: 1, build, event, eventTime: 0.1 }), h.read, 1, 1, 1, damping)
    const values = samples.map(time => audio.update(h.step(time, { energy: 1, build }), h.read, 1, 1, 1, damping))
    expect(h.state.serialize()).toBe(saved)
    return { before, values }
  }
  it('separates kick body force, core pulse, opposing recoil, and exact settlement', () => {
    const { values: [strike, recoil, settled] } = trajectory('kick', [0.13, 0.315, 0.55])
    expect(strike.displacement).toBeGreaterThan(0.02)
    expect(strike.corePulse).toBeGreaterThan(0)
    expect(recoil.displacement).toBeLessThan(0)
    expect(recoil.corePulse).toBe(0)
    expect(settled.displacement).toBe(0); expect(settled.corePulse).toBe(0)
  })
  it('gives snare shear opposing follow-through without lingering deformation', () => {
    const { values: [strike, recoil, settled] } = trajectory('snare', [0.12, 0.315, 0.60])
    expect(strike.shear).toBeGreaterThan(0)
    expect(recoil.shear).toBeLessThan(0)
    expect(settled.shear).toBe(0)
  })
  it('releases build tension at impact, settles through a small recoil, and resumes current shared build facts', () => {
    const { before, values: [strike, recoil, restored] } = trajectory('drop', [0.14, 0.62, 1.0], 0.65, 1)
    expect(before.displacement).toBeLessThan(0)
    expect(strike.displacement).toBeGreaterThan(0.04)
    expect(recoil.displacement).toBeLessThan(0)
    expect(recoil.displacement).toBeGreaterThan(-0.02)
    expect(restored.displacement).toBeCloseTo(before.displacement, 8)
  })
  it('makes higher Damping reduce recoil without removing the force or extending authority', () => {
    const low = trajectory('kick', [0.13, 0.30, 0.55], 0).values
    const high = trajectory('kick', [0.13, 0.30, 0.55], 1).values
    expect(low[0].displacement).toBeGreaterThan(0); expect(high[0].displacement).toBeGreaterThan(0)
    expect(Math.abs(low[1].displacement)).toBeGreaterThan(Math.abs(high[1].displacement))
    expect(low[2].displacement).toBe(0); expect(high[2].displacement).toBe(0)
  })
  it('coalesces snare/transient front and recovery stages and cancels both on disable', () => {
    const run = (transient: boolean) => {
      const h = harness(), audio = new Cinema2InertiaAudio()
      audio.update(h.step(0, { energy: 1 }), h.read, 1, 1, 1)
      audio.update(h.step(0.1, { energy: 1, event: 'snare', transient, eventTime: 0.1 }), h.read, 1, 1, 1)
      return [0.12, 0.315, 0.4].map(time => audio.update(h.step(time, { energy: 1 }), h.read, time === 0.4 ? 0 : 1, 1, 1))
    }
    expect(run(true)).toEqual(run(false))
    expect(run(true)[2].shear).toBe(0)
  })
  it('keeps rapid overlapping cues bounded and naturally clears every envelope', () => {
    const h = harness(), audio = new Cinema2InertiaAudio()
    audio.update(h.step(0, { energy: 1 }), h.read, 1, 1, 1, 0)
    for (let i = 0; i < 64; i++) {
      const time = 0.1 + i * 0.04, event = (['kick', 'snare', 'drop'] as const)[i % 3]
      audio.update(h.step(time, { energy: 1, event, eventTime: time, eventId: i, transient: event === 'snare' }), h.read, 1, 1, 1, 0)
      const response = audio.update(h.step(time + 0.01, { energy: 1 }), h.read, 1, 1, 1, 0)
      expect(Math.abs(response.displacement)).toBeLessThanOrEqual(0.06)
      expect(Math.abs(response.shear)).toBeLessThanOrEqual(0.025)
      expect(response.corePulse).toBeLessThanOrEqual(0.035)
      expect(h.choreography.getSnapshot().activeEnvelopeCount).toBeLessThanOrEqual(9)
      expect(h.choreography.getSnapshot().pendingEventCount).toBe(0)
    }
    let settled
    for (let i = 1; i <= 10; i++) settled = audio.update(h.step(2.64 + i * 0.1, { energy: 1 }), h.read, 1, 1, 1, 0)
    expect(settled!.displacement).toBe(0); expect(settled!.shear).toBe(0); expect(settled!.corePulse).toBe(0)
    expect(h.choreography.getSnapshot().activeEnvelopeCount).toBe(0)
  })
})
