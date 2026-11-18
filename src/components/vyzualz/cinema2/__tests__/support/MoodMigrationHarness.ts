import { Cinema2AudioIntelligenceBridge } from '../../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2ChoreographyRuntime } from '../../choreography/Cinema2ChoreographyRuntime'
import { Cinema2MoodConductor } from '../../conductor/Cinema2MoodConductor'
import type { Cinema2NativePresetManifest, Cinema2ParameterId } from '../../contracts/Cinema2NativePresetManifest'
import { Cinema2VisualDirector } from '../../director/Cinema2VisualDirector'
import type { Cinema2ModuleFrameReadContext } from '../../modules/Cinema2ModuleContracts'
import { Cinema2ParameterState } from '../../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../../presets/Cinema2PresetCompiler'
import { ifritMusicFixture, type IfritFixtureOptions } from '../../../../../test/support/IfritMusicFixture'

/**
 * The reusable test harness for migrating a preset to the shared Mood Conductor and Auto Performance enhancements: one persistent audio bridge,
 * director and conductor feed a preset with its Auto Performance toggle on and a twin with it off, so the only difference is the music's drives.
 */
export const MOOD_CAPABILITIES = [
  'render.webgl2', 'render.depth', 'render.history', 'render.hdr', 'scene.3d', 'camera.world', 'lighting', 'audio.transport', 'audio.bands', 'audio.features',
  'music.beat', 'music.downbeat', 'music.bar', 'music.rhythm-events', 'music.phrase', 'music.section', 'music.drop', 'music.build', 'music.vocal-presence',
  'visual-director.significance', 'media.image', 'media.video', 'media.svg',
] as const

export type MoodOptions = Partial<IfritFixtureOptions> & { section?: string }
type Frame = Readonly<Cinema2ModuleFrameReadContext>

export function moodMusic() {
  let serial = 0
  let published = ifritMusicFixture({ frameId: 0, timeSec: 0 })
  let meta = { sequence: 0, publishedAtMs: 0 }
  const bridge = new Cinema2AudioIntelligenceBridge({ getFrame: () => published, getPublicationMeta: () => ({ sequence: meta.sequence, publishedAtMs: meta.publishedAtMs, publisherId: 'mood-migration', kind: 'frame' as const }) })
  const director = new Cinema2VisualDirector()
  const conductor = new Cinema2MoodConductor()
  let timeSec = 10
  const next = (options: MoodOptions = {}, dt = 1 / 30): Frame => {
    serial += 1; timeSec += dt
    const base = ifritMusicFixture({ frameId: serial, timeSec, energy: 0.5, bass: 0.5, ...options })
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

export function moodStage(manifest: Readonly<Cinema2NativePresetManifest>) {
  const compiled = compileCinema2NativePreset(manifest, { availableCapabilities: MOOD_CAPABILITIES })
  if (!compiled.ok) throw new Error(compiled.diagnostics.map(d => `${d.path}: ${d.message}`).join('\n'))
  const plan = compiled.plan
  const state = new Cinema2ParameterState(plan.parameters)
  const resolver = new Cinema2FinalValueResolver(plan.targets, { resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : state.getValue(target.parameterId) })
  const choreography = new Cinema2ChoreographyRuntime(plan, state, resolver)
  /** The final value of a module or effect target, by entity id suffix (for example `reactor-bloom`) and property. */
  const target = (entity: string, property: string) => {
    const found = plan.targets.targets.find(t => t.channel === 'value' && String(t.entityId).endsWith(`/${entity}`) && t.property === property)
    if (!found) throw new Error(`no target ${entity}.${property}`)
    return found
  }
  const read = (entity: string, property: string): number => Number(resolver.resolve(target(entity, property).id).value)
  return { plan, state, resolver, choreography, read, target }
}

/** The manifest without its shared mood rules: what the preset is with Auto Performance off, or before the migration. */
export function withoutMoodRules(manifest: Readonly<Cinema2NativePresetManifest>): Readonly<Cinema2NativePresetManifest> {
  return { ...manifest, choreography: { ...(manifest.choreography ?? {}), rules: (manifest.choreography?.rules ?? []).filter(rule => !String(rule.id).includes('-mood-')) } } as Readonly<Cinema2NativePresetManifest>
}

export function moodTwin(manifest: Readonly<Cinema2NativePresetManifest>, autoId: Cinema2ParameterId, strengthId?: Cinema2ParameterId, strength?: number) {
  const on = moodStage(manifest), off = moodStage(manifest), stripped = moodStage(withoutMoodRules(manifest)), music = moodMusic()
  on.state.setPersistentValue(autoId, true); off.state.setPersistentValue(autoId, false); stripped.state.setPersistentValue(autoId, false)
  if (strengthId && strength != null) for (const s of [on, off, stripped]) s.state.setPersistentValue(strengthId, strength)
  let latest: Frame | null = null
  const update = (frame: Frame) => { latest = frame; on.choreography.update(frame); off.choreography.update(frame); stripped.choreography.update(frame) }
  const play = (seconds: number, options: MoodOptions = {}) => { for (let i = 0; i < seconds * 30; i++) update(music.next(options)) }
  const once = (options: MoodOptions) => update(music.next(options))
  const silent = (seconds: number) => { for (let i = 0; i < seconds * 30; i++) update(music.silent()) }
  return { on, off, stripped, play, once, silent, frame: () => latest! }
}
