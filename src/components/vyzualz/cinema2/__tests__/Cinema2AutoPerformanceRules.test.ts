import { describe, expect, it } from 'vitest'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import type { Cinema2JsonValue, Cinema2NativePresetManifest, Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST } from '../presets/Cinema2ElectricStormPreset'
import { CINEMA2_GO_TO_PRESET_MANIFEST } from '../presets/Cinema2GoToPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { CINEMA2_REACTOR_PRESET_MANIFEST } from '../presets/Cinema2ReactorPreset'
import { CINEMA2_RELIQUARY_PRESET_MANIFEST } from '../presets/Cinema2ReliquaryPreset'
import { CINEMA2_THRESHOLD_PRESET_MANIFEST } from '../presets/Cinema2ThresholdPreset'
import { CINEMA2_WAR_OF_WORLDS_PRESET_MANIFEST } from '../presets/Cinema2WarOfWorldsPreset'
import { ifritMusicFixture } from '../../../../test/support/IfritMusicFixture'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'render.history', 'scene.3d', 'camera.world', 'lighting',
  'audio.bands', 'audio.features', 'music.beat', 'music.downbeat', 'music.bar',
  'music.rhythm-events', 'music.phrase', 'music.section', 'music.drop',
  'visual-director.significance', 'media.image', 'media.video', 'media.svg',
] as const

/** Each preset, its toggle, and the strength control that silences the added rules (the preset's own reactivity or intensity). */
const PRESETS = [
  { name: 'Electric Storm', manifest: CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST, prefix: 'electric-storm', strength: 'electric-storm-music-reactivity' },
  { name: 'Reactor', manifest: CINEMA2_REACTOR_PRESET_MANIFEST, prefix: 'reactor', strength: 'reactor-reactivity' },
  { name: 'Threshold', manifest: CINEMA2_THRESHOLD_PRESET_MANIFEST, prefix: 'threshold', strength: 'threshold-master-reactivity' },
  { name: 'GO-TO', manifest: CINEMA2_GO_TO_PRESET_MANIFEST, prefix: 'go-to', strength: 'go-to-master-intensity' },
  { name: 'Reliquary', manifest: CINEMA2_RELIQUARY_PRESET_MANIFEST, prefix: 'reliquary', strength: 'reliquary-master-intensity' },
  { name: 'War Of Worlds', manifest: CINEMA2_WAR_OF_WORLDS_PRESET_MANIFEST, prefix: 'war-of-worlds', strength: null },
] as const

type Frame = Readonly<Cinema2ModuleFrameReadContext>

/** One shared audio source feeds every runtime a test builds, so on/off comparisons see identical music. */
function sequence() {
  let serial = 0
  const director = new Cinema2VisualDirector()
  const frame = (timeSec: number, options: { event?: 'drop' | 'downbeat' | 'kick' | null; eventId?: number; build?: number; beatIndex?: number; discontinuity?: 'seek' | 'source-change' } = {}): Frame => {
    serial += 1
    const published = ifritMusicFixture({
      frameId: serial, timeSec, event: options.event ?? null, eventId: options.eventId ?? serial, beatIndex: options.beatIndex ?? Math.floor(timeSec * 2),
      energy: 0.6, build: options.build ?? 0, bass: 0.5,
    })
    const bridge = new Cinema2AudioIntelligenceBridge({
      getFrame: () => published,
      getPublicationMeta: () => ({ sequence: serial, publishedAtMs: timeSec * 1000, publisherId: 'auto-performance-test', kind: 'frame' as const }),
    })
    const captured = bridge.capture(serial)
    // A seek, loop or track change is reported by the audio bridge as a discontinuity, which is what makes the engine clear transient state.
    const audio = options.discontinuity ? { ...captured, discontinuity: { ...captured.discontinuity, occurred: true, reason: options.discontinuity, generation: captured.discontinuity.generation + 1 } } : captured
    return {
      frameId: serial, timestampMs: timeSec * 1000, deltaTimeSec: 0.25, elapsedTimeSec: timeSec,
      viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: 1,
      transport: { sourcePresent: true, playing: true, paused: false, animationActive: true, analysisActive: true, trackId: published.trackId, timeSec, bpm: 120 },
      audio, director: director.capture(audio),
    } as unknown as Frame
  }
  const silent = (timeSec: number): Frame => ({
    frameId: ++serial, timestampMs: timeSec * 1000, deltaTimeSec: 0.25, elapsedTimeSec: timeSec,
    viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: 1,
    transport: { sourcePresent: false, playing: false, paused: false, animationActive: true, analysisActive: false, trackId: null, timeSec },
    audio: null, director: null,
  } as unknown as Frame)
  return { frame, silent }
}

function stage(manifest: Readonly<Cinema2NativePresetManifest>, ignoredParameter: string | null = null) {
  const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('\n'))
  const plan = compiled.plan
  const state = new Cinema2ParameterState(plan.parameters)
  const resolver = new Cinema2FinalValueResolver(plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId),
  })
  const choreography = new Cinema2ChoreographyRuntime(plan, state, resolver)
  const values = (): Record<string, Cinema2JsonValue | undefined> => Object.fromEntries(
    // The toggle's own parameter target is excluded: a comparison of on against off would otherwise differ by the toggle itself.
    plan.targets.targets.filter(target => target.channel === 'value' && (ignoredParameter == null || target.parameterId !== ignoredParameter))
      .map(target => [target.id as string, resolver.resolve(target.id).value]),
  )
  return { plan, state, resolver, choreography, values }
}

/** The preset exactly as it was before Auto Performance: no toggle and none of its rules. */
function withoutAutoPerformance(manifest: Readonly<Cinema2NativePresetManifest>, autoId: string): Readonly<Cinema2NativePresetManifest> {
  return {
    ...manifest,
    parameters: manifest.parameters!.filter(parameter => parameter.id !== autoId),
    choreography: { ...manifest.choreography, rules: manifest.choreography!.rules.filter(rule => rule.enabledParameter?.$ref !== autoId) },
  }
}

const numeric = (value: Cinema2JsonValue | undefined) => typeof value === 'number' ? value : Number.NaN

describe.each(PRESETS)('$name Auto Performance', ({ manifest, prefix, strength }) => {
  const autoId = `${prefix}-auto-performance` as Cinema2ParameterId
  const autoRules = manifest.choreography!.rules.filter(rule => rule.enabledParameter?.$ref === autoId)

  it('is an Auto Performance toggle under Design > Master Controls, off by default, with preset-specific gated rules', () => {
    const parameter = manifest.parameters!.find(candidate => candidate.id === autoId)!
    expect(parameter).toMatchObject({ label: 'Auto Performance', type: 'boolean', defaultValue: false, designParentGroup: 'master-controls', persistence: 'preset', reset: 'authored-default' })
    expect(manifest.parameters!.filter(candidate => candidate.label === 'Auto Performance')).toHaveLength(1)
    expect(autoRules.length).toBeGreaterThanOrEqual(3)
    // Every rule it adds is a shared-signal rule: the Director's build or the canonical drop and downbeat events, once per event.
    for (const rule of autoRules) {
      expect(['continuous', 'drop', 'downbeat']).toContain(rule.source.signal)
      if (rule.source.signal !== 'continuous') expect(rule.conditions).toContainEqual({ kind: 'once-per-event' })
    }
  })

  it('keeps the revision, so saved settings from before the toggle still load, with it off', () => {
    const current = stage(manifest, autoId)
    current.state.setPersistentValue(autoId, true)
    const saved = JSON.parse(current.state.serialize()) as { values: Record<string, Cinema2JsonValue> }
    delete saved.values[autoId]
    const reloaded = stage(manifest, autoId)
    expect(reloaded.state.restore(JSON.stringify(saved)).ok).toBe(true)
    expect(reloaded.state.getValue(autoId)).toBe(false)
    const before = stage(withoutAutoPerformance(manifest, autoId))
    expect(JSON.parse(before.state.serialize()).presetRevision).toBe(JSON.parse(reloaded.state.serialize()).presetRevision)
  })

  it('behaves exactly like the preset without Auto Performance while it is off, through a build, a drop and a bar lift', () => {
    const music = sequence()
    const frames = [
      music.frame(10), music.frame(11, { build: 0.9 }), music.frame(11.5, { build: 0.9, event: 'downbeat', beatIndex: 60 }),
      music.frame(12, { build: 0.9, event: 'drop', eventId: 900, beatIndex: 61 }), music.frame(14, { event: 'downbeat', beatIndex: 64 }),
    ]
    const withToggle = stage(manifest, autoId)
    const original = stage(withoutAutoPerformance(manifest, autoId))
    for (const frame of frames) {
      withToggle.choreography.update(frame)
      original.choreography.update(frame)
      const a = withToggle.values()
      const b = original.values()
      for (const [id, value] of Object.entries(b)) expect(a[id], `${id} at ${frame.elapsedTimeSec}s`).toEqual(value)
    }
    expect(withToggle.choreography.getSnapshot().dispatchedActionCount).toBe(original.choreography.getSnapshot().dispatchedActionCount)
  })

  it('moves the preset on a build, a pre-drop downbeat, a drop and a bar lift when on, without rewriting any authored value', () => {
    const music = sequence()
    const on = stage(manifest, autoId)
    const off = stage(manifest, autoId)
    on.state.setPersistentValue(autoId, true)
    const authored = on.state.getSnapshot().persistentValues
    const targetsOf = (name: string) => autoRules.find(rule => rule.id === `${prefix}-auto-${name}`)?.actions.map(action => action.id) ?? []
    const moved = (frame: Frame) => {
      on.choreography.update(frame); off.choreography.update(frame)
      const a = on.values(), b = off.values()
      return Object.keys(a).filter(id => JSON.stringify(a[id]) !== JSON.stringify(b[id]))
    }
    const quiet = music.frame(10)
    expect(moved(quiet)).toEqual([])
    expect(moved(music.frame(11, { build: 0.9 })).length, 'build').toBeGreaterThan(0)
    const peak = music.frame(11.5, { build: 0.9, event: 'downbeat', beatIndex: 60 })
    on.choreography.update(peak); off.choreography.update(peak)
    expect(on.choreography.getSnapshot().activeContributionCount, 'peak').toBeGreaterThan(off.choreography.getSnapshot().activeContributionCount)
    const drop = music.frame(12, { build: 0.9, event: 'drop', eventId: 901, beatIndex: 61 })
    on.choreography.update(drop); off.choreography.update(drop)
    expect(on.choreography.getSnapshot().dispatchedActionCount, 'drop').toBeGreaterThanOrEqual(off.choreography.getSnapshot().dispatchedActionCount)
    expect(on.choreography.getSnapshot().activeContributionCount, 'drop').toBeGreaterThan(off.choreography.getSnapshot().activeContributionCount)
    const lift = music.frame(20, { event: 'downbeat', beatIndex: 64 })
    on.choreography.update(lift); off.choreography.update(lift)
    expect(on.choreography.getSnapshot().activeContributionCount, 'lift').toBeGreaterThan(off.choreography.getSnapshot().activeContributionCount)
    // The authored parameter values were never written to; the music only ever contributed transient values.
    expect(on.state.getSnapshot().persistentValues).toEqual(authored)
    expect(targetsOf('build-rise').length).toBeGreaterThan(0)
  })

  it('returns to the authored state as soon as it is switched off, and on a seek, a track change or silence', () => {
    const music = sequence()
    const on = stage(manifest, autoId)
    const off = stage(manifest, autoId)
    on.state.setPersistentValue(autoId, true)
    const frame = music.frame(11, { build: 0.9 })
    on.choreography.update(frame); off.choreography.update(frame)
    expect(on.values()).not.toEqual(off.values())
    on.state.setPersistentValue(autoId, false)
    const next = music.frame(11.25, { build: 0.9 })
    on.choreography.update(next); off.choreography.update(next)
    expect(on.values()).toEqual(off.values())

    const seeking = stage(manifest, autoId)
    const reference = stage(manifest, autoId)
    seeking.state.setPersistentValue(autoId, true)
    const drop = music.frame(30, { build: 0.9, event: 'drop', eventId: 902, beatIndex: 61 })
    seeking.choreography.update(drop); reference.choreography.update(drop)
    expect(seeking.values()).not.toEqual(reference.values())
    const earlier = music.frame(2, { discontinuity: 'seek' })
    seeking.choreography.update(earlier); reference.choreography.update(earlier)
    expect(seeking.values()).toEqual(reference.values())

    const changed = stage(manifest, autoId)
    const unchanged = stage(manifest, autoId)
    changed.state.setPersistentValue(autoId, true)
    const again = music.frame(50, { build: 0.9, event: 'drop', eventId: 906, beatIndex: 61 })
    changed.choreography.update(again); unchanged.choreography.update(again)
    expect(changed.values()).not.toEqual(unchanged.values())
    const other = music.frame(51, { discontinuity: 'source-change' })
    changed.choreography.update(other); unchanged.choreography.update(other)
    expect(changed.values()).toEqual(unchanged.values())

    const quiet = stage(manifest, autoId)
    const baseline = stage(manifest, autoId)
    quiet.state.setPersistentValue(autoId, true)
    quiet.choreography.update(music.silent(1)); baseline.choreography.update(music.silent(1))
    expect(quiet.values()).toEqual(baseline.values())
  })

  it('releases a drop pulse that is still in flight the moment it is switched off', () => {
    const music = sequence()
    const on = stage(manifest, autoId)
    const off = stage(manifest, autoId)
    on.state.setPersistentValue(autoId, true)
    for (const frame of [music.frame(11.9, { build: 0.9 }), music.frame(12, { build: 0.9, event: 'drop', eventId: 907, beatIndex: 61 })]) {
      on.choreography.update(frame); off.choreography.update(frame)
    }
    expect(on.values()).not.toEqual(off.values())
    on.state.setPersistentValue(autoId, false)
    const next = music.frame(12.1, { build: 0.9 })
    on.choreography.update(next); off.choreography.update(next)
    expect(on.values()).toEqual(off.values())
  })

  it('uses each musical event once: a drop published again under the same identity does not fire a second time', () => {
    const music = sequence()
    const run = stage(manifest, autoId)
    run.state.setPersistentValue(autoId, true)
    run.choreography.update(music.frame(11.9, { build: 0.9 }))
    run.choreography.update(music.frame(12, { build: 0.9, event: 'drop', eventId: 905, beatIndex: 61 }))
    const used = run.choreography.getSnapshot()
    run.choreography.update(music.frame(12.05, { build: 0.9, event: 'drop', eventId: 905, beatIndex: 61 }))
    const after = run.choreography.getSnapshot()
    expect(after.dispatchedActionCount).toBe(used.dispatchedActionCount)
    expect(after.deduplicatedEventCount).toBeGreaterThan(used.deduplicatedEventCount)
  })

  it.skipIf(strength == null)('is silenced by the preset\'s own reactivity or intensity control when that control is zero', () => {
    const music = sequence()
    const on = stage(manifest, autoId)
    const off = stage(manifest, autoId)
    on.state.setPersistentValue(autoId, true)
    on.state.setPersistentValue(strength as Cinema2ParameterId, 0)
    off.state.setPersistentValue(strength as Cinema2ParameterId, 0)
    for (const frame of [music.frame(11, { build: 0.9 }), music.frame(12, { build: 0.9, event: 'drop', eventId: 904, beatIndex: 61 })]) {
      on.choreography.update(frame); off.choreography.update(frame)
      const a = on.values(), b = off.values()
      for (const id of Object.keys(b)) {
        const x = numeric(a[id]), y = numeric(b[id])
        if (Number.isFinite(x) && Number.isFinite(y)) expect(x, id).toBeCloseTo(y, 6)
      }
    }
  })
})
