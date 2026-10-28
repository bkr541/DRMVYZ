import { Cinema2BeatClock } from '../Cinema2BeatClock'
import type { Cinema2ModuleUpdateContext } from '../Cinema2ModuleContracts'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../Cinema2AfterhoursNativeModule'
import { resolveNightshiftPatternEvent } from '../nightshift/Cinema2NightshiftAudio'
import { selectCinema2MainframeAudio } from '../mainframe/Cinema2MainframeAudioDelivery'

export const CRYSTALIZED_PATTERNS = [
  { value: 'prism', label: 'Prism' }, { value: 'orbit', label: 'Color Orbit' },
  { value: 'pulse', label: 'Pulse' }, { value: 'cascade', label: 'Cascade' },
] as const
export type CrystalizedPattern = typeof CRYSTALIZED_PATTERNS[number]['value']
export const CRYSTALIZED_CHANNELS = {
  audioEnergy: 0, bassPressure: 0, highGlint: 0, vocalRestraint: 0, buildPressure: 0,
  directorIntensity: 0, directorMomentum: 0, directorBuild: 0, directorImpact: 0,
  musicKick: 0, musicSnare: 0, musicBeat: 0, musicDrop: 0,
} as const
export const CRYSTALIZED_ROUTES = [
  ['audioEnergy', 'audio.features.overallEnergy', 'audio.features', 180],
  ['bassPressure', 'audio.bands.bass', 'audio.bands', 180],
  ['highGlint', 'audio.bands.high', 'audio.bands', 100],
  ['vocalRestraint', 'audio.features.vocalPresence', 'music.vocal-presence', 300],
  ['buildPressure', 'audio.features.buildProgress', 'music.build', 240],
  ['directorIntensity', 'director.intensity', 'visual-director.significance', 240],
  ['directorMomentum', 'director.momentum', 'visual-director.significance', 300],
  ['directorBuild', 'director.build', 'visual-director.significance', 240],
  ['directorImpact', 'director.impact', 'visual-director.significance', 0],
] as const
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v))

/** Shared facts arrive through Choreography targets. This owns presentation only. */
export class Cinema2CrystalizedPerformance {
  private readonly clock = new Cinema2BeatClock()
  private lastTime: number | null = null
  private lastTimestamp: number | null = null
  private identity = ''
  private generation = -1
  private discontinuity = -1
  private track: string | null | undefined
  private source: string | null = null
  private previousBeat = 0
  private phase = 0
  private base: CrystalizedPattern = 'prism'
  private authored = ''
  private revision = -1
  private readonly events = new Set<string>()
  private autoBlocked = false
  private patternChange = false
  private trigger = 'bar4'
  private music = { energy: 0, bass: 0, high: 0, vocal: 0, build: 0, momentum: 0, impact: 0, significance: 1, kick: 0, snare: 0, beat: 0, drop: 0 }
  state = { master: 1, motion: .35, crystalScale: 1, monolithHeight: 1,
    phase: 0, pattern: 'prism' as CrystalizedPattern, response: .8, ...this.music }

  update({ frame: input, parameters: p }: Cinema2ModuleUpdateContext): void {
    const number = (name: string, fallback: number, min = 0, max = 1) => {
      const value = p.get(name)
      return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback
    }
    const audio = selectCinema2MainframeAudio(input.audio, input.transport?.trackId)
    const frame = { ...input, audio, director: audio ? input.director : null }
    const time = frame.transport?.timeSec ?? audio?.upstream.timeSec ?? 0
    const track = frame.transport?.trackId ?? audio?.upstream.trackId
    const identity = JSON.stringify([track, audio?.upstream.sourceId ?? this.source])
    const reset = this.generation !== frame.contextGeneration || (this.generation !== -1 && this.track !== track) || (this.lastTime != null && (time < this.lastTime - .05 || time - this.lastTime > 1))
      || (this.identity && identity !== this.identity && audio != null)
      || audio?.discontinuity.occurred === true && audio.discontinuity.reason !== 'activation' && audio.discontinuity.generation !== this.discontinuity
    if (reset) { this.clock.reset(); this.phase = 0; this.previousBeat = 0; this.events.clear(); this.authored = ''; this.autoBlocked = false; this.music = { energy: 0, bass: 0, high: 0, vocal: 0, build: 0, momentum: 0, impact: 0, significance: 1, kick: 0, snare: 0, beat: 0, drop: 0 } }
    const active = !frame.transport || (!frame.transport.paused && (!frame.transport.sourcePresent || frame.transport.playing))
    const dt = reset || this.lastTimestamp == null || !active ? 0 : clamp((frame.timestampMs - this.lastTimestamp) / 1000, 0, .1)
    const motion = number('motion', .35), response = number('reactivity', .8, 0, 2)
    const beats = this.clock.update({ ...frame, deltaTimeSec: dt, elapsedTimeSec: 0,
      ...(frame.transport ? { transport: { ...frame.transport, animationActive: active } } : {}) }, p.get('bpmSync') !== false, 120).beats
    const delta = Math.max(0, beats - this.previousBeat)
    this.previousBeat = beats
    const selected = p.get('pattern')
    const authored = CRYSTALIZED_PATTERNS.some(pattern => pattern.value === selected) ? selected as CrystalizedPattern : 'prism'
    const revision = p.getEditRevision?.('pattern') ?? 0
    const manual = authored !== this.authored || revision !== this.revision
    if (manual || p.get('patternChange') !== true) { this.base = authored; if (!reset && manual) this.autoBlocked = true }
    const trigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.find(trigger => trigger === p.get('trigger')) ?? 'bar4'
    const changed = this.patternChange !== (p.get('patternChange') === true) || this.trigger !== trigger
    if (changed) this.base = authored
    const eventFrame = !active && frame.transport ? { ...frame, transport: { ...frame.transport, paused: false, playing: true } } : frame
    const event = resolveNightshiftPatternEvent(eventFrame, trigger, reset ? null : this.lastTime)
    if (event && !this.events.has(event)) {
      if (active && !reset && !manual && !changed && p.get('patternChange') === true) {
        const index = CRYSTALIZED_PATTERNS.findIndex(pattern => pattern.value === this.base)
        this.base = CRYSTALIZED_PATTERNS[(index + 1) % CRYSTALIZED_PATTERNS.length].value
      }
      this.events.add(event)
    }
    while (this.events.size > 128) this.events.delete(this.events.values().next().value!)
    if (active) {
      const validDirector = audio && frame.director?.visualFrameId === audio.visualFrameId && frame.director.discontinuityGeneration === audio.discontinuity.generation
      this.music = {
        energy: audio ? number('audioEnergy', 0) * response : 0,
        bass: audio ? number('bassPressure', 0) * response : 0,
        high: audio ? number('highGlint', 0) * response : 0,
        vocal: audio ? number('vocalRestraint', 0) * response : 0,
        build: audio ? Math.max(number('buildPressure', 0), validDirector ? number('directorBuild', 0) : 0) * response : 0,
        momentum: validDirector ? number('directorMomentum', 0) * response : 0,
        significance: validDirector ? 1 - .15 * response * (1 - number('directorIntensity', 1)) : 1,
        impact: validDirector && frame.director?.authority.impact.available && frame.director.authority.impact.occurred && (frame.director.authority.impact.confidence ?? 0) >= .45 ? number('directorImpact', 0) * response : 0,
        kick: audio ? number('musicKick', 0, 0, 2) : 0,
        snare: audio ? number('musicSnare', 0, 0, 2) : 0,
        beat: audio ? number('musicBeat', 0, 0, 2) : 0,
        drop: audio ? number('musicDrop', 0, 0, 2) : 0,
      }
    }
    if (response === 0) for (const key of Object.keys(this.music) as (keyof typeof this.music)[]) this.music[key] = key === 'significance' ? 1 : 0
    if (this.music.build < .25 && this.music.drop < .05) this.autoBlocked = false
    this.phase += delta * motion / .35 * (1 + .12 * this.music.momentum)
    const auto = p.get('autoPerformance') === true && !this.autoBlocked && response > 0
    const pattern = auto && this.music.drop > .1 ? 'pulse' : auto && this.music.build > .5 ? 'cascade' : this.base
    this.state = { master: number('master', 1), motion, response, crystalScale: number('crystalScale', 1, .5, 1.5), monolithHeight: number('monolithHeight', 1, .6, 1.4),
      phase: this.phase, pattern, ...this.music }
    this.track = track; if (audio) { this.source = audio.upstream.sourceId; this.discontinuity = audio.discontinuity.generation }
    this.lastTime = time; this.lastTimestamp = frame.timestampMs; this.identity = identity; this.generation = frame.contextGeneration
    this.authored = authored; this.revision = revision; this.patternChange = p.get('patternChange') === true; this.trigger = trigger
  }
}
