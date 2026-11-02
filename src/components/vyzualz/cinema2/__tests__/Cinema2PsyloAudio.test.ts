import { describe, expect, it } from 'vitest'
import { psyloChoreographyHarness as harness } from '../../../../test/support/PsyloChoreographyHarness'
import { PSYLO_MUSIC_DEFAULTS as neutral, PsyloPatternController, selectPsyloAudio, resolvePsyloEvent, resolvePsyloMusic } from '../modules/psylo/Cinema2PsyloAudio'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../modules/Cinema2AfterhoursNativeModule'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_PSYLO_PRESET_MANIFEST } from '../presets/Cinema2PsyloPreset'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'

describe('PSYLO native shared-audio delivery', () => {
  it('maps continuous facts to separate bounded geometry and spore dimensions', () => {
    const { publish } = harness()
    publish()
    const quiet = publish({ energy: .05, bass: 0, high: 0 }).output
    const loud = publish({ energy: .95, bass: 1, high: 1 }).output
    expect(loud.musicRange).toBeGreaterThan(quiet.musicRange)
    expect(loud.musicSpore).toBeGreaterThan(quiet.musicSpore)
    expect(loud.musicBend).toBeGreaterThan(quiet.musicBend)
    const vocal = publish({ energy: .95, bass: 1, high: 1, vocal: 1 }).output
    expect(vocal.musicRange).toBeLessThan(loud.musicRange)
    expect(vocal.musicSpore).toBeLessThan(loud.musicSpore)
    expect(Object.values(vocal).every(v => v >= 0 && v <= 1)).toBe(true)
  })
  it('latches activation events, deduplicates held hits and releases envelopes', () => {
    const { publish } = harness()
    expect(publish({ event: 'kick', timeSec: .1, frameId: 1 }).output.musicKick).toBe(0)
    expect(publish({ event: 'kick', timeSec: .2, frameId: 2 }).output.musicKick).toBe(0)
    expect(publish({ timeSec: .22 }).output.musicKick).toBeCloseTo(.12)
    expect(publish({ event: 'kick', timeSec: .3, frameId: 2 }).output.musicKick).toBeLessThan(.12)
    expect(publish({ event: 'snare', timeSec: .4 }).output.musicSnare).toBe(0)
    expect(publish({ timeSec: .41 }).output.musicSnare).toBeCloseTo(.15)
    expect(publish({ timeSec: .7 }).output.musicKick).toBe(0)
    expect(publish({ timeSec: .7 }).output.musicSnare).toBe(0)
  })
  it('delivers supported builds and fresh semantic drops without Director input', () => {
    const { publish } = harness(); publish({ timeSec: .1 })
    expect(publish({ timeSec: .2, build: .9 }).output.musicBuild).toBeGreaterThan(0)
    publish({ timeSec: .3, event: 'drop' })
    expect(publish({ timeSec: .32 }).output.musicDrop).toBeCloseTo(.25 * .95)
    expect(publish({ timeSec: .5 }).output.musicDropTravel).toBeGreaterThan(0)
    expect(publish({ timeSec: 1.2 }).output.musicDrop).toBe(0)
    expect(publish({ timeSec: .1 }).output.musicDrop).toBe(0)
  })
  it('holds on pause, honors response zero immediately and latches paused events', () => {
    const { publish } = harness(); publish({ timeSec: .1 })
    const hit = publish({ timeSec: .2, event: 'kick' }).output
    expect(publish({ timeSec: .2 }, 1, true).output).toEqual(hit)
    expect(publish({ timeSec: .2 }, 0, true).output).toEqual(neutral)
    publish({ timeSec: .3, frameId: 99, event: 'snare' }, 1, true)
    expect(publish({ timeSec: .3, frameId: 99, event: 'snare' }).output.musicSnare).toBe(0)
  })
  it('holds through the host pause gate and latches resume hits without erasing the active envelope', () => {
    const { publish, delivery } = harness(); publish({ timeSec: .1 })
    publish({ timeSec: .2, event: 'kick' })
    const { frame, output, channels } = publish({ timeSec: .22 })
    const paused = { ...frame, audio: null, transport: { ...frame.transport!, paused: true, playing: false, animationActive: false } }
    expect(delivery.update(paused, 1, .2, false)).toEqual(output)
    const resumed = { ...frame, audio: { ...frame.audio!, upstream: { ...frame.audio!.upstream, timeSec: .3 } } }
    const held = delivery.update(resumed, 1, .2, false, true, channels)
    expect(held.musicKick).toBeGreaterThan(0); expect(held.musicKick).toBeLessThan(1)
    expect(delivery.update(paused, 0, .3, false)).toEqual(neutral)
  })
  it('rejects missing, mismatched and stale frames and restores authored fallback', () => {
    const { publish, delivery } = harness(); const { frame } = publish({ featuresAvailable: false })
    expect(delivery.update({ ...frame, audio: null }, 1, .1, false)).toEqual(neutral)
    expect(selectPsyloAudio({ ...frame, transport: { ...frame.transport!, trackId: 'different' } })).toBeNull()
    expect(selectPsyloAudio({ ...frame, transport: { ...frame.transport!, timeSec: 99 } })).toBeNull()
    expect(publish({ featuresAvailable: false }).output.musicRange).toBe(1)
    const stale = publish({ event: 'beat', timeSec: .4 }).frame
    const old = { ...stale, audio: { ...stale.audio!, rhythm: { ...stale.audio!.rhythm, beat: { ...stale.audio!.rhythm.beat!, timeSec: 0 } } } }
    expect(resolvePsyloEvent(old, 'beat', .3)).toBeNull()
  })
  it('resolves native channels through declared targets and clamps contributions', () => {
    const compiled = compileCinema2NativePreset(CINEMA2_PSYLO_PRESET_MANIFEST)
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const resolver = new Cinema2FinalValueResolver(compiled.plan.targets)
    const target = (name: string) => compiled.plan.targets.targets.find(t => t.kind === 'module' && t.property === name)!
    const parameters = { get: () => undefined, getAuthored: () => undefined, resolve: (name: string) => resolver.resolve(target(name).id) }
    const result = resolvePsyloMusic({ ...neutral, musicRange: .6, musicKick: 9 }, parameters, { getTarget: () => null, resolve: (id, contributions) => resolver.resolve(id, contributions), dispatch: () => { throw Error('Unexpected persistent write') } })
    expect(result.musicRange).toBe(.6); expect(result.musicKick).toBe(1)
  })
  it.each([['beat2', 33, 'beat'], ['beat4', 34, 'beat'], ['bar4', 4, 'bar'], ['bar8', 16, 'bar']] as const)('rejects nonqualifying %s subdivisions', (trigger, beatIndex, event) => {
    const { publish } = harness(); publish({ timeSec: .1 })
    const { frame, previous } = publish({ timeSec: .2, event, beatIndex })
    expect(resolvePsyloEvent(frame, trigger, previous)).toBeNull()
  })
  it('does not replay a held hit after an availability gap', () => {
    const { publish, delivery } = harness(); publish({ timeSec: .1 })
    const { frame } = publish({ timeSec: .2, frameId: 30, event: 'kick' })
    delivery.update({ ...frame, audio: null }, 1, .2, false)
    expect(delivery.update(frame, 1, .2, false).musicKick).toBe(0)
  })
  it.each(CINEMA2_AFTERHOURS_TRIGGER_IDS)('uses canonical %s event resolution', trigger => {
    const { publish } = harness(); publish({ timeSec: .1 })
    const event = trigger.startsWith('bar') ? 'bar' : trigger === 'phrase' ? 'phrase' : trigger === 'drop' ? 'drop' : trigger === 'kick' ? 'kick' : trigger === 'snare' ? 'snare' : trigger === 'downbeat' ? 'downbeat' : 'beat'
    const { frame, previous } = publish({ timeSec: .2, event, beatIndex: 32, eventId: 100 })
    expect(resolvePsyloEvent(frame, trigger, previous)).toBeTruthy()
  })
})
describe('PSYLO Pattern authority', () => {
  it('holds authored selection OFF, advances only fresh events and never immediately repeats', () => {
    const p = new PsyloPatternController()
    expect(p.update(0, false, 'beat', 'a', 0, false, false)).toBe(0)
    expect(p.update(0, false, 'beat', 'b', 0, false, false)).toBe(0)
    expect(p.update(0, true, 'beat', 'b', 0, false, false)).toBe(0)
    expect(p.update(0, true, 'beat', 'c', 0, false, false)).toBe(1)
    expect(p.update(0, true, 'beat', 'c', 0, false, false)).toBe(1)
    expect(p.update(0, true, 'beat', 'd', 0, false, false)).toBe(2)
  })
  it('honors edits and same-pattern reselection while ON until the next fresh event', () => {
    const p = new PsyloPatternController(); p.update(0, true, 'beat', 'a', 0, false, false)
    p.update(0, true, 'beat', 'b', 0, false, false)
    expect(p.update(5, true, 'beat', 'b', 1, false, false)).toBe(5)
    expect(p.update(5, true, 'beat', 'b', 1, false, false)).toBe(5)
    expect(p.update(5, true, 'beat', 'c', 1, false, false)).toBe(6)
    expect(p.update(5, true, 'beat', 'c', 2, false, false)).toBe(5)
    expect(p.update(5, true, 'beat', 'd', 2, false, false)).toBe(6)
  })
  it('rearms on trigger/toggle/reset and consumes events while paused or refreshing', () => {
    const p = new PsyloPatternController(); p.update(0, true, 'beat', 'a', 0, false, false)
    p.update(0, true, 'beat', 'b', 0, false, false)
    expect(p.update(0, true, 'beat', 'c', 0, false, true)).toBe(1)
    expect(p.update(0, true, 'beat', 'c', 0, false, false)).toBe(1)
    expect(p.update(0, true, 'kick', 'd', 0, false, false)).toBe(0)
    expect(p.update(0, true, 'kick', 'e', 0, false, false)).toBe(1)
    expect(p.update(0, true, 'kick', 'e', 0, true, false)).toBe(0)
  })
})
