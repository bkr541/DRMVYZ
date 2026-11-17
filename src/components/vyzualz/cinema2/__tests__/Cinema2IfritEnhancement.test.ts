import { describe, expect, it, vi } from 'vitest'
import { createCinemaMockWebGL } from '../../../../test/support/CinemaWebGLTestUtils'
import { ifritMusicFixture, type IfritFixtureOptions } from '../../../../test/support/IfritMusicFixture'
import { Cinema2AudioIntelligenceBridge } from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../choreography/Cinema2ChoreographyRuntime'
import { Cinema2MoodConductor } from '../conductor/Cinema2MoodConductor'
import { readCinema2MoodPolicy } from '../conductor/Cinema2MoodPolicy'
import { Cinema2VisualDirector } from '../director/Cinema2VisualDirector'
import { cinema2IfritNativeModuleDefinition } from '../modules/Cinema2IfritNativeModule'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  IFRIT_CHANNELS, IFRIT_COLORS, IFRIT_EXTRA_CHANNELS, IFRIT_MECHANICS_NUMBERS, IFRIT_NUMBERS, IFRIT_PATTERNS, IFRIT_SECTORS, IFRIT_SHATTER_NUMBERS, ifritParameterId as pid,
} from '../modules/ifrit/Cinema2IfritDomain'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'
import { CINEMA2_IFRIT_PRESET_MANIFEST } from '../presets/Cinema2IfritPreset'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import type { Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'

const CAPABILITIES = [
  'render.webgl2', 'render.depth', 'scene.3d', 'camera.world', 'audio.transport', 'audio.bands', 'audio.features', 'music.beat', 'music.downbeat', 'music.bar', 'music.rhythm-events',
  'music.phrase', 'music.section', 'music.build', 'music.drop', 'music.vocal-presence', 'visual-director.significance',
] as const
const manifest = CINEMA2_IFRIT_PRESET_MANIFEST
const parameters = manifest.parameters!
const get = (key: string) => parameters.find(p => p.id === pid(key))!

describe('Ifrit revision 5: the additive manifest', () => {
  it('is revision 5, keeps the preset id and module type/version, and compiles', () => {
    expect(manifest.revision).toBe(5)
    expect(String(manifest.id)).toBe('drmvyz.cinema2.ifrit')
    expect(manifest.modules![0]).toMatchObject({ typeId: 'ifrit-native', version: 1 })
    const result = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
    expect(result.diagnostics.filter(d => d.severity === 'error')).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('keeps every original parameter id, range and default, the four palette roles, and the six patterns in order', () => {
    for (const [key, [min, defaultValue, max]] of Object.entries(IFRIT_NUMBERS)) expect(get(key), key).toMatchObject({ min, defaultValue, max })
    for (const [key, color] of Object.entries(IFRIT_COLORS)) expect(get(key), key).toMatchObject({ type: 'color', defaultValue: [...color], designParentGroup: 'palette' })
    expect(parameters.filter(p => p.type === 'color')).toHaveLength(4)
    expect(get('pattern').options!.map(o => o.value)).toEqual([...IFRIT_PATTERNS])
    expect(get('pattern')).toMatchObject({ defaultValue: 'infernalPassage' })
    expect(get('pattern-change')).toMatchObject({ defaultValue: false })
    expect(get('trigger')).toMatchObject({ defaultValue: 'phrase', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS })
    expect(get('bpm-sync')).toMatchObject({ defaultValue: true })
    expect(get('auto-performance')).toMatchObject({ defaultValue: false })
  })

  it('adds the toggles, ranges, defaults and types exactly as authored, all under the Design parent', () => {
    expect(get('mechanics-enabled')).toMatchObject({ type: 'boolean', defaultValue: true, designParentGroup: 'design', group: 'Radial Mechanics' })
    expect(get('shatter-enabled')).toMatchObject({ type: 'boolean', defaultValue: true, designParentGroup: 'design', group: 'Shatter & Reconstruction' })
    for (const [key, [min, defaultValue, max]] of [...Object.entries(IFRIT_MECHANICS_NUMBERS), ...Object.entries(IFRIT_SHATTER_NUMBERS)]) {
      const integer = key === 'blade-count' || key === 'satellite-count' || key === 'fragments-per-edge'
      expect(get(key), key).toMatchObject({ min, defaultValue, max, type: integer ? 'integer' : 'float', designParentGroup: 'design' })
      expect(get(key).visibleWhen, key).toHaveLength(1)
    }
    expect(get('shatter-trigger')).toMatchObject({ type: 'enum', defaultValue: 'drop' })
    expect(get('shatter-trigger').options!.map(o => o.value)).toEqual(['drop', 'kick', 'phrase', 'manual'])
    expect(parameters.every(p => ['master-controls', 'design', 'effects', 'palette'].includes(p.designParentGroup!))).toBe(true)
  })

  it('adds six sectors of overrides (four controls each, advanced) and a persisted JSON text control', () => {
    for (let s = 0; s < IFRIT_SECTORS; s++) {
      expect(get(`sector-${s}-enabled`)).toMatchObject({ type: 'boolean', defaultValue: true, exposure: 'advanced' })
      expect(get(`sector-${s}-arm-offset`)).toMatchObject({ type: 'float', min: -1, max: 1, defaultValue: 0 })
      expect(get(`sector-${s}-blade-offset`)).toMatchObject({ type: 'float', min: -180, max: 180, defaultValue: 0 })
      expect(get(`sector-${s}-shatter-bias`)).toMatchObject({ type: 'float', min: 0, max: 1, defaultValue: 1 })
    }
    expect(get('element-overrides')).toMatchObject({ type: 'text', defaultValue: '{}', exposure: 'advanced', persistence: 'preset' })
    expect(new Set(parameters.map(p => p.id)).size).toBe(parameters.length)
  })

  it('binds every new control to the module (a real consumer), with its default as the authored module value', () => {
    const module = manifest.modules![0]!
    const added = parameters.filter(p => /^ifrit-(mechanics|shatter|spoke|gear|blade|satellite|fragment|fragments|reassembly|sector|element)/.test(p.id))
    expect(added).toHaveLength(43)
    for (const p of added) {
      const key = p.id.slice(6)
      expect(module.parameterBindings![key], key).toEqual({ $ref: p.id })
      expect(module.parameters![key], key).toEqual(p.defaultValue)
    }
    for (const key of IFRIT_EXTRA_CHANNELS) expect(module.parameters![key]).toBe(0)
  })

  it('exposes the new shared channels and keeps every original one', () => {
    expect(IFRIT_CHANNELS).toEqual(expect.arrayContaining(['kickNear', 'kickMiddle', 'kickFar', 'snareLeft', 'snareRight', 'dropExpand', 'dropAlign', 'dropRecover', 'downbeatAccent', 'phraseAccent']))
    expect(IFRIT_EXTRA_CHANNELS).toEqual(['spokeKick', 'bladeSnare', 'gearDownbeat', 'satellitePhrase', 'shatterBurst', 'shatterRecall', 'shatterPhrase'])
    const ids = new Set(manifest.choreography!.rules.map(r => String(r.id)))
    expect(ids.size).toBe(manifest.choreography!.rules.length)
    for (const rule of manifest.choreography!.rules.filter(r => /(spoke-kick|blade-snare|gear-downbeat|satellite-phrase|shatter)/.test(String(r.id)))) expect(rule.strengthParameter).toEqual({ $ref: pid('reactivity') })
  })
})

describe('Ifrit: the shared Mood Conductor and Auto Performance enhancements', () => {
  it('tags Pattern Change, Trigger and Auto Performance for the shared policy, and compiles with its checks', () => {
    expect(readCinema2MoodPolicy(get('pattern-change').metadata)).toBe('patternChange')
    expect(readCinema2MoodPolicy(get('trigger').metadata)).toBe('trigger')
    expect(readCinema2MoodPolicy(get('auto-performance').metadata)).toBe('autoPerformance')
    expect(parameters.filter(p => readCinema2MoodPolicy(p.metadata) != null)).toHaveLength(3)
  })

  it('drives the passage and the new mechanics by the music, gated by Auto Performance and scaled by Reactivity, and never the timeline controls', () => {
    const drives = manifest.choreography!.rules.filter(r => String(r.id).includes('-mood-'))
    expect(drives.length).toBeGreaterThan(0)
    for (const rule of drives) {
      expect(rule.enabledParameter).toEqual({ $ref: pid('auto-performance') })
      expect(rule.strengthParameter).toEqual({ $ref: pid('reactivity') })
    }
    const targets = new Set(drives.flatMap(r => r.actions.map(a => `${(a.target as { property: string }).property}`)))
    for (const driven of ['spoke-extension', 'spoke-pulse', 'blade-sweep', 'satellite-orbit-radius', 'twist', 'thickness', 'intensity', 'mix']) expect(targets.has(driven), driven).toBe(true)
    for (const timeline of ['travel', 'rotation', 'gear-speed', 'satellite-orbit-speed']) expect(targets.has(timeline), timeline).toBe(false)
  })
})

function music() {
  let serial = 0, published = ifritMusicFixture({ frameId: 0, timeSec: 0 }), meta = { sequence: 0, publishedAtMs: 0 }
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => published, getPublicationMeta: () => ({ sequence: meta.sequence, publishedAtMs: meta.publishedAtMs, publisherId: 'ifrit-enhancement', kind: 'frame' as const }) })
  const director = new Cinema2VisualDirector(), conductor = new Cinema2MoodConductor()
  let timeSec = 10
  return (options: Partial<IfritFixtureOptions> = {}, dt = 1 / 30): Cinema2ModuleFrameReadContext => {
    serial += 1; timeSec += dt
    published = ifritMusicFixture({ frameId: serial, timeSec, energy: 0.5, bass: 0.5, ...options })
    meta = { sequence: serial, publishedAtMs: timeSec * 1000 }
    const audio = bridge.capture(serial), directorFrame = director.capture(audio)
    return {
      frameId: serial, timestampMs: timeSec * 1000, deltaTimeSec: dt, elapsedTimeSec: timeSec, viewport: { width: 1920, height: 1080, dpr: 1 }, contextGeneration: 1,
      transport: { sourcePresent: true, playing: true, paused: false, animationActive: true, analysisActive: true, trackId: published.trackId, timeSec, bpm: 120 },
      audio, director: directorFrame, mood: conductor.capture(audio, directorFrame, dt),
    } as unknown as Cinema2ModuleFrameReadContext
  }
}
function stage(reactivity?: number) {
  const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: CAPABILITIES })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(d => `${d.path}: ${d.message}`).join('\n'))
  const plan = compiled.plan
  const state = new Cinema2ParameterState(plan.parameters)
  if (reactivity != null) state.setPersistentValue(pid('reactivity') as Cinema2ParameterId, reactivity)
  const resolver = new Cinema2FinalValueResolver(plan.targets, { resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId) })
  const choreography = new Cinema2ChoreographyRuntime(plan, state, resolver)
  const channel = (name: string) => {
    const target = plan.targets.targets.find(t => t.kind === 'module' && t.property === name)
    return target ? Number(resolver.resolve(target.id).value) : NaN
  }
  return { choreography, channel }
}
/** Plays frames, returning the peak of each requested channel after an event frame. */
function peaks(event: Partial<IfritFixtureOptions> | null, names: readonly string[], reactivity?: number, seconds = 1.2) {
  const { choreography, channel } = stage(reactivity), next = music()
  for (let i = 0; i < 20; i++) choreography.update(next())
  const peak: Record<string, number> = Object.fromEntries(names.map(n => [n, 0]))
  for (let i = 0; i < seconds * 30; i++) {
    choreography.update(i === 0 && event ? next(event) : next())
    for (const n of names) peak[n] = Math.max(peak[n]!, channel(n))
  }
  return peak
}

describe('Ifrit: new shared channels through real Choreography', () => {
  const NEW = [...IFRIT_EXTRA_CHANNELS]
  it('each cue drives its own channel: kicks extend spokes, snares strike blades, downbeats snap gears, phrases move satellites and fracture, drops shatter then recall', () => {
    expect(peaks({ event: 'kick', eventId: 101 }, NEW).spokeKick).toBeGreaterThan(0.5)
    expect(peaks({ event: 'snare', eventId: 102 }, NEW).bladeSnare).toBeGreaterThan(0.5)
    // Downbeats and phrases come from the shared tempo clock (BPM Sync on): a bar boundary every 2 s and a phrase boundary every 8 s at 120 BPM.
    expect(peaks(null, NEW, undefined, 3).gearDownbeat).toBeGreaterThan(0.5)
    const phrase = peaks(null, NEW, undefined, 9)
    expect(phrase.satellitePhrase).toBeGreaterThan(0.5)
    expect(phrase.shatterPhrase).toBeGreaterThan(0.5)
    const drop = peaks({ event: 'drop', eventId: 105 }, NEW)
    expect(drop.shatterBurst).toBeGreaterThan(0.5)
    expect(drop.shatterRecall).toBeGreaterThan(0.3)
    // A kick does not fire the drop channels, and a drop does not fire the kick channel.
    expect(peaks({ event: 'kick', eventId: 106 }, NEW).shatterBurst).toBe(0)
    expect(peaks({ event: 'drop', eventId: 107 }, NEW).gearDownbeat).toBe(0)
  })

  it('the recall rises after the burst (delayed by half a shared beat), so the shatter has time to read before it rebuilds', () => {
    const { choreography, channel } = stage(), next = music()
    for (let i = 0; i < 20; i++) choreography.update(next())
    choreography.update(next({ event: 'drop', eventId: 108 }))
    let firstBurst = -1, firstRecall = -1, maxBurst = 0
    for (let i = 1; i < 90; i++) {
      choreography.update(next())
      if (firstBurst < 0 && channel('shatterBurst') > 0.05) firstBurst = i
      if (firstRecall < 0 && channel('shatterRecall') > 0.05) firstRecall = i
      maxBurst = Math.max(maxBurst, channel('shatterBurst'))
    }
    expect(maxBurst).toBeGreaterThan(0.3)
    expect(firstBurst).toBeGreaterThan(0)
    expect(firstRecall).toBeGreaterThan(firstBurst + 3)
  })

  it('is silent at Reactivity 0, present at low non-zero Reactivity, and quiet with no event', () => {
    for (const [event, name, seconds] of [[{ event: 'kick', eventId: 111 }, 'spokeKick', 1.2], [{ event: 'drop', eventId: 112 }, 'shatterBurst', 1.2], [null, 'shatterPhrase', 9]] as const) {
      expect(peaks(event, [name], 0, seconds)[name], name).toBe(0)
      expect(peaks(event, [name], 0.1, seconds)[name], name).toBeGreaterThan(0)
    }
    // With no event frames in the first 1.2 s the event-driven channels stay at 0 (kick, snare, drop have nothing to fire on).
    const quiet = peaks(null, ['spokeKick', 'bladeSnare', 'shatterBurst', 'shatterRecall'])
    expect(Object.values(quiet).every(v => v === 0)).toBe(true)
  })
})

describe('Ifrit module: both systems wired to the shared frame', () => {
  const defaults = () => ({ ...(manifest.modules![0]!.parameters as Record<string, unknown>) })
  function mount(over: Record<string, unknown> = {}, channels: Record<string, number> = {}) {
    const gl = createCinemaMockWebGL()
    const values: Record<string, unknown> = { ...defaults(), ...over }
    const context = {
      module: { id: 'ifrit-tunnel' }, parameters: { get: (key: string) => key in channels ? channels[key] : values[key], getEditRevision: () => 0 },
      resources: { acquire: (_k: string, _l: string, factory: (gl: WebGL2RenderingContext) => unknown) => factory(gl), reportGpuBytes: vi.fn() },
    }
    const instance = cinema2IfritNativeModuleDefinition.create(context as never) as unknown as {
      lifecycle: { update(c: { frame: Cinema2ModuleFrameReadContext }): void; dispose(): void }
      render: { providers: { execute(exec: unknown): void }[] }
      inspect(): { mechanicalParts: number; shards: number; detachedEdges: number; effectivePatternChange: boolean | null; effectiveTrigger: string | null; patternControlsAutomatic: boolean }
    }
    const exec = { camera: { viewProjectionMatrix: Array.from({ length: 16 }, (_, i) => i % 5 === 0 ? 1 : 0) }, depthAvailable: true, lightingEnvironment: { quality: 'high' } }
    const next = music()
    const run = (frames = 3, options: Partial<IfritFixtureOptions> = {}) => { for (let i = 0; i < frames; i++) instance.lifecycle.update({ frame: next(options) }); instance.render.providers[0]!.execute(exec) }
    return { gl, instance, run, values, context }
  }

  it('shows the machinery by default, with every edge whole until a cue, and draws the tunnel plus the instanced parts', () => {
    const { gl, instance, run } = mount()
    run()
    expect(instance.inspect()).toMatchObject({ mechanicalParts: 5 * 6 * 7, shards: 0, detachedEdges: 0 })
    expect(gl.__calls.drawCount).toBe(1)
    expect(gl.__calls.drawInstancedCount).toBe(4)
  })

  it('restores the original visualizer with both toggles off: no extra parts, no instanced draws', () => {
    const { gl, instance, run } = mount({ 'mechanics-enabled': false, 'shatter-enabled': false }, { shatterBurst: 1, spokeKick: 1 })
    run()
    expect(instance.inspect()).toMatchObject({ mechanicalParts: 0, shards: 0, detachedEdges: 0 })
    expect(gl.__calls.drawCount).toBe(1)
    expect(gl.__calls.drawInstancedCount).toBe(0)
  })

  it('each system is independent: mechanics only, shatter only', () => {
    const a = mount({ 'shatter-enabled': false }, { shatterBurst: 1 }); a.run()
    expect(a.instance.inspect()).toMatchObject({ shards: 0, detachedEdges: 0 }); expect(a.instance.inspect().mechanicalParts).toBeGreaterThan(0)
    const b = mount({ 'mechanics-enabled': false }, { shatterBurst: 1 }); b.run()
    expect(b.instance.inspect().mechanicalParts).toBe(0); expect(b.instance.inspect().shards).toBeGreaterThan(0)
    expect(b.gl.__calls.drawInstancedCount).toBe(1)
  })

  it('breaks the edges on the drop channel, retires the originals for exactly those sectors, and is whole again when the cue is gone', () => {
    const channels: Record<string, number> = { shatterBurst: 1 }
    const { instance, run } = mount({}, channels)
    run()
    expect(instance.inspect().shards).toBeGreaterThan(0)
    expect(instance.inspect().detachedEdges).toBeGreaterThan(0)
    channels.shatterBurst = 0
    run(1)
    expect(instance.inspect()).toMatchObject({ shards: 0, detachedEdges: 0 })
  })

  it('Manual shatter shows the authored hold and never needs an event; changing Trigger edits the routing', () => {
    const manual = mount({ 'shatter-trigger': 'manual', 'shatter-hold': 0.9 }); manual.run()
    expect(manual.instance.inspect().shards).toBeGreaterThan(0)
    const drop = mount({ 'shatter-trigger': 'drop', 'shatter-hold': 0.9 }); drop.run()
    expect(drop.instance.inspect().shards).toBe(0)
  })

  it('reads persisted overrides (parsed only when the text changes) and per-sector controls', () => {
    const { instance, run, values } = mount({ 'sector-2-enabled': false })
    run()
    const without = instance.inspect().mechanicalParts
    expect(without).toBe(5 * 5 * 7)
    values['element-overrides'] = '{"ring-00/sector-0":{"enabled":false}}'
    run(1)
    expect(instance.inspect().mechanicalParts).toBe(5 * 5 * 7 - 7)
    values['element-overrides'] = 'garbage'
    run(1)
    expect(instance.inspect().mechanicalParts).toBe(without)
  })

  it('lets the music choose Pattern Change and Trigger while Auto Performance is on, and leaves the saved values alone', () => {
    const on = mount({ 'auto-performance': true, 'pattern-change': false, trigger: 'bar8' })
    on.run(30)
    expect(on.instance.inspect()).toMatchObject({ patternControlsAutomatic: true })
    expect(on.instance.inspect().effectiveTrigger).toMatch(/^(bar8|bar4|bar|beat2|beat)$/)
    expect(on.values.trigger).toBe('bar8')
    expect(on.values['pattern-change']).toBe(false)
    const off = mount({ 'auto-performance': false, 'pattern-change': true, trigger: 'bar8' })
    off.run(30)
    expect(off.instance.inspect()).toMatchObject({ patternControlsAutomatic: false, effectivePatternChange: true, effectiveTrigger: 'bar8' })
  })
})
