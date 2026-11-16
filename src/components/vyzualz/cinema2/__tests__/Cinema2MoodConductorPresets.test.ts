import { describe, expect, it } from 'vitest'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { CINEMA2_MOOD_PATHS, Cinema2MoodConductor } from '../conductor/Cinema2MoodConductor'
import type { Cinema2JsonValue, Cinema2NativePresetManifest, Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2PatternAutoPerformance } from '../modules/mainframe/Cinema2PatternAutoPerformance'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { CINEMA2_DEPTH_AUTO_PERFORMANCE_ID, CINEMA2_DEPTH_INTENSITY_ID, CINEMA2_DEPTH_PRESET_MANIFEST, CINEMA2_DEPTH_RATE_ID } from '../presets/Cinema2DepthPreset'
import {
  CINEMA2_ELECTRIC_STORM_FLASH_INTENSITY_ID, CINEMA2_ELECTRIC_STORM_IMPACT_SHAKE_ID, CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID,
  CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST, CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID, CINEMA2_ELECTRIC_STORM_ZOOM_PUNCH_ID,
} from '../presets/Cinema2ElectricStormPreset'
import { CINEMA2_MAINFRAME_AUTO_PERFORMANCE_ID, CINEMA2_MAINFRAME_MASTER_INTENSITY_ID, CINEMA2_MAINFRAME_PRESET_MANIFEST } from '../presets/Cinema2MainframePreset'
import { createCinema2MoodRules, withCinema2MoodDrives } from '../presets/Cinema2MoodConductorAuthoring'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { ifritMusicFixture, type IfritFixtureOptions } from '../../../../test/support/IfritMusicFixture'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'render.history', 'scene.3d', 'camera.world', 'lighting', 'audio.bands', 'audio.features', 'music.beat', 'music.downbeat', 'music.bar',
  'music.rhythm-events', 'music.phrase', 'music.section', 'music.drop', 'visual-director.significance', 'media.image', 'media.video', 'media.svg',
] as const

type Frame = Readonly<Cinema2ModuleFrameReadContext>
interface Options extends Partial<IfritFixtureOptions> { section?: string }

/** One shared music source (one persistent bridge, director and conductor, as in the runtime) feeding every staged preset, so on/off see identical music. */
function music() {
  let serial = 0
  let published = ifritMusicFixture({ frameId: 0, timeSec: 0 })
  let meta = { sequence: 0, publishedAtMs: 0 }
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => published, getPublicationMeta: () => ({ sequence: meta.sequence, publishedAtMs: meta.publishedAtMs, publisherId: 'mood-presets', kind: 'frame' as const }) })
  const director = new Cinema2VisualDirector()
  const conductor = new Cinema2MoodConductor()
  let timeSec = 10
  const next = (options: Options = {}, dt = 1 / 30): Frame => {
    serial += 1; timeSec += dt
    const base = ifritMusicFixture({ frameId: serial, timeSec, energy: .5, bass: .5, ...options })
    published = options.section ? { ...base, section: { ...base.section, type: options.section as never } } : base
    meta = { sequence: serial, publishedAtMs: timeSec * 1000 }
    const audio = bridge.capture(serial)
    const directorFrame = director.capture(audio)
    return {
      frameId: serial, timestampMs: timeSec * 1000, deltaTimeSec: dt, elapsedTimeSec: timeSec, viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: 1,
      transport: { sourcePresent: true, playing: true, paused: false, animationActive: true, analysisActive: true, trackId: published.trackId, timeSec, bpm: 120 },
      audio, director: directorFrame, mood: conductor.capture(audio, directorFrame, dt),
    } as unknown as Frame
  }
  const silent = (dt = 1 / 30): Frame => ({
    frameId: ++serial, timestampMs: (timeSec += dt) * 1000, deltaTimeSec: dt, elapsedTimeSec: timeSec, viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: 1,
    transport: { sourcePresent: false, playing: false, paused: false, animationActive: true, analysisActive: false, trackId: null, timeSec },
    audio: null, director: null, mood: null,
  } as unknown as Frame)
  return { next, silent }
}

function stage(manifest: Readonly<Cinema2NativePresetManifest>) {
  const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(d => `${d.path}: ${d.message}`).join('\n'))
  const plan = compiled.plan
  const state = new Cinema2ParameterState(plan.parameters)
  const resolver = new Cinema2FinalValueResolver(plan.targets, { resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId) })
  const choreography = new Cinema2ChoreographyRuntime(plan, state, resolver)
  const value = (parameter: Cinema2ParameterId): number => {
    const target = plan.targets.targets.find(candidate => candidate.channel === 'value' && candidate.parameterId === parameter)
    if (!target) throw new Error(`no target for ${parameter}`)
    return Number(resolver.resolve(target.id).value)
  }
  return { plan, state, choreography, value }
}

/** Plays the same music into an Auto Performance preset and its twin with the toggle off, and reads a value from both. */
function twin(manifest: Readonly<Cinema2NativePresetManifest>, autoId: Cinema2ParameterId, strengthId?: Cinema2ParameterId) {
  const on = stage(manifest), off = stage(manifest), m = music()
  on.state.setPersistentValue(autoId, true); off.state.setPersistentValue(autoId, false)
  if (strengthId) { /* the strength control keeps its authored value unless a test changes it */ }
  const play = (seconds: number, options: Options = {}, parameter?: Cinema2ParameterId) => {
    let last: { on: number; off: number } | null = null
    for (let i = 0; i < seconds * 30; i++) {
      const frame = m.next(options)
      on.choreography.update(frame); off.choreography.update(frame)
      if (parameter) last = { on: on.value(parameter), off: off.value(parameter) }
    }
    return last!
  }
  const frameOnce = (options: Options, parameter: Cinema2ParameterId) => {
    const frame = m.next(options)
    on.choreography.update(frame); off.choreography.update(frame)
    return { on: on.value(parameter), off: off.value(parameter) }
  }
  const silent = (seconds: number, parameter: Cinema2ParameterId) => {
    let last = { on: 0, off: 0 }
    for (let i = 0; i < seconds * 30; i++) { const frame = m.silent(); on.choreography.update(frame); off.choreography.update(frame); last = { on: on.value(parameter), off: off.value(parameter) } }
    return last
  }
  return { on, off, play, frameOnce, silent }
}

const PRESETS = [
  { name: 'Electric Storm', manifest: CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST, auto: 'electric-storm-auto-performance' as Cinema2ParameterId, prefix: 'electric-storm-auto', strength: 'electric-storm-music-reactivity' as Cinema2ParameterId },
  { name: 'Depth', manifest: CINEMA2_DEPTH_PRESET_MANIFEST, auto: CINEMA2_DEPTH_AUTO_PERFORMANCE_ID, prefix: 'depth-auto', strength: CINEMA2_DEPTH_INTENSITY_ID },
  { name: 'Mainframe', manifest: CINEMA2_MAINFRAME_PRESET_MANIFEST, auto: CINEMA2_MAINFRAME_AUTO_PERFORMANCE_ID, prefix: 'mainframe-auto', strength: undefined },
] as const

describe('the shared mood sources and authoring', () => {
  it('has a continuous mood source for every mood field the conductor reports', () => {
    expect(Object.keys(CINEMA2_MOOD_PATHS).sort()).toEqual(['mood.activity', 'mood.brightness', 'mood.build', 'mood.calm', 'mood.complexity', 'mood.drive', 'mood.energy', 'mood.momentum', 'mood.peak', 'mood.shock', 'mood.tense', 'mood.tension'])
  })

  it('turns drives into gated continuous rules, one per source, with distinct priorities and the toggle and strength references', () => {
    const rules = createCinema2MoodRules({
      idPrefix: 'x', enabledParameter: 'x-auto' as Cinema2ParameterId, strengthParameter: 'x-strength' as Cinema2ParameterId,
      drives: [
        { id: 'a', target: { kind: 'parameter', ref: { $ref: 'p1' } } as never, source: 'mood.activity', operation: 'add', value: .2 },
        { id: 'b', target: { kind: 'parameter', ref: { $ref: 'p2' } } as never, source: 'mood.activity', operation: 'add', value: -.1 },
        { id: 'c', target: { kind: 'parameter', ref: { $ref: 'p1' } } as never, source: 'mood.shock', operation: 'multiply', value: 1.5 },
      ],
    })
    expect(rules).toHaveLength(2)
    expect(rules.map(rule => rule.source.path)).toEqual(['mood.activity', 'mood.shock'])
    expect(rules[0].actions).toHaveLength(2)
    expect(new Set(rules.map(rule => rule.priority)).size).toBe(2)
    for (const rule of rules) { expect(rule.source.signal).toBe('continuous'); expect(rule.enabledParameter?.$ref).toBe('x-auto'); expect(rule.strengthParameter?.$ref).toBe('x-strength') }
  })

  it('adds nothing for no drives, and declares the Visual Director capability once', () => {
    const base = CINEMA2_DEPTH_PRESET_MANIFEST
    expect(withCinema2MoodDrives(base, { idPrefix: 'n', enabledParameter: CINEMA2_DEPTH_AUTO_PERFORMANCE_ID, drives: [] })).toBe(base)
    expect(base.capabilities!.filter(capability => capability.id === 'visual-director.significance')).toHaveLength(1)
  })
})

describe.each(PRESETS)('$name with the Mood Conductor', ({ manifest, auto, prefix, strength }) => {
  const moodRules = manifest.choreography!.rules.filter(rule => String(rule.id).startsWith(`${prefix}-mood-`))

  it('compiles, with the mood drives gated by the preset\'s own Auto Performance toggle and reading the shared mood', () => {
    expect(compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES }).ok).toBe(true)
    expect(moodRules.length).toBeGreaterThanOrEqual(3)
    for (const rule of moodRules) {
      expect(rule.enabledParameter?.$ref).toBe(auto)
      expect(rule.source).toMatchObject({ signal: 'continuous', capability: 'visual-director.significance' })
      expect(String(rule.source.path)).toMatch(/^mood\./)
      if (strength) expect(rule.strengthParameter?.$ref).toBe(strength)
    }
    // No new parameter and no revision change: saved settings from before the conductor still load.
    expect(manifest.parameters!.filter(parameter => parameter.label === 'Auto Performance')).toHaveLength(1)
  })
})

describe('Electric Storm', () => {
  const rate = CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID
  const autoId = 'electric-storm-auto-performance' as Cinema2ParameterId

  it('thins out and calms in a breakdown, and quickens and brightens at a peak, around the authored values', () => {
    const calm = twin(CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST, autoId)
    const calmed = calm.play(6, { energy: .12, section: 'breakdown' }, rate)
    expect(calmed.on).toBeLessThan(calmed.off - .1)
    const calmIntensity = calm.play(.1, { energy: .12, section: 'breakdown' }, CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID)
    expect(calmIntensity.on).toBeLessThan(calmIntensity.off)

    const peak = twin(CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST, autoId)
    const peaked = peak.play(6, { energy: .95, tension: .7, section: 'drop' }, rate)
    expect(peaked.on).toBeGreaterThan(peaked.off + .1)
    const peakIntensity = peak.play(.1, { energy: .95, tension: .7, section: 'drop' }, CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID)
    expect(peakIntensity.on).toBeGreaterThan(peakIntensity.off)
    // The authored values were never written to.
    expect(peak.on.state.getSnapshot().persistentValues[rate]).toBe(peak.off.state.getSnapshot().persistentValues[rate])
  })

  it('lands a drop as shake, zoom and flash that fall back over about two seconds', () => {
    const t = twin(CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST, autoId)
    t.play(4, { energy: .6 })
    const hit = t.frameOnce({ energy: .95, event: 'drop', eventId: 321 }, CINEMA2_ELECTRIC_STORM_IMPACT_SHAKE_ID)
    expect(hit.on).toBeGreaterThan(hit.off + .15)
    const zoom = t.frameOnce({ energy: .95 }, CINEMA2_ELECTRIC_STORM_ZOOM_PUNCH_ID)
    expect(zoom.on).toBeGreaterThan(zoom.off + .1)
    const flash = t.frameOnce({ energy: .95 }, CINEMA2_ELECTRIC_STORM_FLASH_INTENSITY_ID)
    expect(flash.on).toBeGreaterThan(flash.off)
    const settled = t.play(10, { energy: .6, section: 'verse' }, CINEMA2_ELECTRIC_STORM_IMPACT_SHAKE_ID)
    expect(settled.on).toBeCloseTo(settled.off, 1)
  })

  it('does nothing while Auto Performance is off, with no music, and with the preset\'s reactivity at zero', () => {
    const t = twin(CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST, autoId)
    t.on.state.setPersistentValue(autoId, false)
    const off = t.play(4, { energy: .95, section: 'drop' }, rate)
    expect(off.on).toBeCloseTo(off.off, 6)
    t.on.state.setPersistentValue(autoId, true)
    const none = t.silent(2, rate)
    expect(none.on).toBeCloseTo(none.off, 6)
    // The preset's reactivity at zero silences the storm's own reactions and the conductor's drives alike, so the two twins agree again.
    for (const side of [t.on, t.off]) side.state.setPersistentValue('electric-storm-music-reactivity' as Cinema2ParameterId, 0)
    const silenced = t.play(4, { energy: .95, section: 'drop' }, rate)
    expect(silenced.on).toBeCloseTo(silenced.off, 6)
    expect(silenced.on).toBeCloseTo(0.58, 6)
  })
})

describe('Depth', () => {
  it('travels faster at a peak and slower in a calm passage, and speeds up for a drop, around the authored rate', () => {
    const calm = twin(CINEMA2_DEPTH_PRESET_MANIFEST, CINEMA2_DEPTH_AUTO_PERFORMANCE_ID)
    const calmed = calm.play(6, { energy: .12, section: 'breakdown' }, CINEMA2_DEPTH_RATE_ID)
    expect(calmed.on).toBeLessThan(calmed.off)
    const peak = twin(CINEMA2_DEPTH_PRESET_MANIFEST, CINEMA2_DEPTH_AUTO_PERFORMANCE_ID)
    const peaked = peak.play(6, { energy: .95, section: 'drop' }, CINEMA2_DEPTH_RATE_ID)
    expect(peaked.on).toBeGreaterThan(peaked.off + .2)
    const t = twin(CINEMA2_DEPTH_PRESET_MANIFEST, CINEMA2_DEPTH_AUTO_PERFORMANCE_ID)
    t.play(4, { energy: .5 })
    const quiet = t.frameOnce({ energy: .5 }, CINEMA2_DEPTH_RATE_ID)
    const hit = t.frameOnce({ energy: .5, event: 'drop', eventId: 55 }, CINEMA2_DEPTH_RATE_ID)
    expect(hit.on - hit.off).toBeGreaterThan(quiet.on - quiet.off + .3)
    const settled = t.play(10, { energy: .5, section: 'verse' }, CINEMA2_DEPTH_RATE_ID)
    expect(settled.on - settled.off).toBeLessThan(.4)
  })

  it('is untouched with Auto Performance off and with no music', () => {
    const t = twin(CINEMA2_DEPTH_PRESET_MANIFEST, CINEMA2_DEPTH_AUTO_PERFORMANCE_ID)
    t.on.state.setPersistentValue(CINEMA2_DEPTH_AUTO_PERFORMANCE_ID, false)
    const off = t.play(3, { energy: .95, section: 'drop' }, CINEMA2_DEPTH_RATE_ID)
    expect(off.on).toBeCloseTo(off.off, 6)
    t.on.state.setPersistentValue(CINEMA2_DEPTH_AUTO_PERFORMANCE_ID, true)
    expect(t.silent(2, CINEMA2_DEPTH_RATE_ID).on).toBeCloseTo(t.silent(1, CINEMA2_DEPTH_RATE_ID).off, 6)
  })
})

describe('Mainframe', () => {
  it('lifts its light at a peak, settles it in a calm passage, and returns to the authored value after a drop', () => {
    const intensity = CINEMA2_MAINFRAME_MASTER_INTENSITY_ID
    const calm = twin(CINEMA2_MAINFRAME_PRESET_MANIFEST, CINEMA2_MAINFRAME_AUTO_PERFORMANCE_ID)
    const calmed = calm.play(6, { energy: .12, section: 'breakdown' }, intensity)
    expect(calmed.on).toBeLessThan(calmed.off)
    const peak = twin(CINEMA2_MAINFRAME_PRESET_MANIFEST, CINEMA2_MAINFRAME_AUTO_PERFORMANCE_ID)
    const peaked = peak.play(6, { energy: .95, section: 'drop' }, intensity)
    expect(peaked.on).toBeGreaterThan(peaked.off)
    const t = twin(CINEMA2_MAINFRAME_PRESET_MANIFEST, CINEMA2_MAINFRAME_AUTO_PERFORMANCE_ID)
    t.play(4, { energy: .5, section: 'verse' })
    const hit = t.frameOnce({ energy: .5, event: 'drop', eventId: 9, section: 'verse' }, intensity)
    expect(hit.on).toBeGreaterThan(hit.off)
    expect(t.play(10, { energy: .5, section: 'verse' }, intensity).on).toBeCloseTo(t.off.value(intensity), 1)
  })
})

describe('Mainframe pattern choice by mood', () => {
  type P = 'radar-sweep' | 'inward-boot' | 'bank-alternator' | 'quadrant-relay' | 'outward-bus' | 'system-surge'
  const options = { calm: ['radar-sweep', 'inward-boot'], driving: ['bank-alternator', 'quadrant-relay', 'outward-bus'], tense: ['system-surge', 'quadrant-relay'], peak: ['outward-bus', 'bank-alternator', 'quadrant-relay'] } as const
  const make = () => new Cinema2PatternAutoPerformance<P>({ buildPattern: 'system-surge', dropPattern: 'outward-bus', mood: { options: options as never, minHoldSec: 0 } })
  const moodFrame = (boundary: 'drop' | 'section' | 'phrase' | null, id: string, feel: 'calm' | 'driving' | 'tense' | 'peak') => ({
    version: 1 as const, structured: true, energy: .5, tension: .2, build: 0, momentum: .3, complexity: .3, brightness: .5, activity: .5, calm: 0, drive: .5, tense: 0, peak: 0, shock: 0, feel,
    section: { id: 's', type: 'verse', progress: .3 }, drop: { occurred: boundary === 'drop', eventId: boundary === 'drop' ? id : null }, boundary: boundary ? { id, kind: boundary } : null,
  })
  const input = (beat: number, over: object = {}) => ({ enabled: true, absoluteBeat: beat, buildCharge: 0, dropEventId: null, patternEdited: false, reset: false, basePattern: 'outward-bus' as P, patternChange: false, deltaTimeSec: 1, seed: 'track', ...over })

  it('leaves the user\'s pattern until a boundary, then puts a pattern that suits the feel on stage and holds it', () => {
    const c = make()
    expect(c.update(input(1, { mood: moodFrame(null, '', 'calm') }))).toMatchObject({ pattern: null })
    const chosen = c.update(input(2, { mood: moodFrame('section', 'sec1', 'calm') }))
    expect(['radar-sweep', 'inward-boot']).toContain(chosen.pattern)
    expect(chosen.reason).toBe('mood')
    expect(chosen.startBeat).toBe(2)
    expect(c.update(input(5, { mood: moodFrame(null, '', 'calm') })).pattern).toBe(chosen.pattern)
  })

  it('never repeats the pattern on stage, and is repeatable for the same track', () => {
    const run = (seed: string) => { const c = make(); const picks: (P | null)[] = []; for (let i = 0; i < 12; i++) picks.push(c.update(input(i, { seed, mood: moodFrame('phrase', `p${i}`, 'driving') })).pattern); return picks }
    const a = run('t1')
    for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1])
    expect(run('t1')).toEqual(a)
  })

  it('lets a build or a drop take the stage and resumes the chosen pattern afterward', () => {
    const c = make()
    const chosen = c.update(input(1, { mood: moodFrame('section', 's1', 'calm') })).pattern
    const dropped = c.update(input(2, { dropEventId: 'drop-1', mood: moodFrame('drop', 'drop-1', 'peak') }))
    expect(dropped).toMatchObject({ pattern: 'outward-bus', reason: 'drop' })
    const after = c.update(input(2 + 9, { mood: moodFrame(null, '', 'peak') }))
    expect(after.reason).toBe('mood')
    expect(after.pattern).not.toBe(chosen)
  })

  it('stays out of the way with Pattern Change on, after a Pattern edit, with Auto Performance off, and without a mood', () => {
    const c = make()
    expect(c.update(input(1, { patternChange: true, mood: moodFrame('section', 's', 'calm') })).pattern).toBeNull()
    expect(c.update(input(2, { enabled: false, mood: moodFrame('section', 's2', 'calm') })).pattern).toBeNull()
    expect(c.update(input(3, { mood: null })).pattern).toBeNull()
    const chosen = c.update(input(4, { mood: moodFrame('section', 's3', 'calm') }))
    expect(chosen.pattern).not.toBeNull()
    expect(c.update(input(5, { patternEdited: true, mood: moodFrame(null, '', 'calm') })).pattern).toBeNull()
    expect(c.update(input(6, { reset: true, mood: moodFrame(null, '', 'calm') })).pattern).toBeNull()
  })

  it('works exactly as before when the config has no mood', () => {
    const c = new Cinema2PatternAutoPerformance<P>({ buildPattern: 'system-surge', dropPattern: 'outward-bus' })
    expect(c.update(input(1, { mood: moodFrame('section', 's', 'calm') })).pattern).toBeNull()
  })
})

// Kept so an unused import never hides a real regression in the shared helpers.
void ({} as Cinema2JsonValue)
