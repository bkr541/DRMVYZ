import type { CinemaFrameCapabilities, CinemaFrameContext, CinemaMusicalClockId } from './CinemaRendererContracts'
import { cinemaNamespacedId, type CinemaEventId, type CinemaModulationSourceId } from './CinemaIdentifiers'

export const CINEMA_MODULATION_SOURCE_CATALOG_VERSION = 1 as const

export type CinemaModulationSourceKind = 'continuous' | 'impulse' | 'clock' | 'state'
export type CinemaModulationSourceCapability = keyof CinemaFrameCapabilities | 'audio' | 'transport'

export interface CinemaModulationSourceDescriptor {
  readonly id: CinemaModulationSourceId
  readonly label: string
  readonly kind: CinemaModulationSourceKind
  readonly capability: CinemaModulationSourceCapability
  readonly neutralValue: number
  readonly minimum: number
  readonly maximum: number
}

export interface CinemaModulationSourceSample {
  readonly source: Readonly<CinemaModulationSourceDescriptor>
  readonly available: boolean
  readonly value: number
  readonly active: boolean
  readonly eventId: CinemaEventId | null
  readonly disabledReason: string | null
}

function sourceId(value: string): CinemaModulationSourceId {
  return cinemaNamespacedId<CinemaModulationSourceId>(value, 'modulation source')
}

export const CINEMA_MODULATION_SOURCE_IDS = Object.freeze({
  audioVolume: sourceId('drmvyz.cinema.audio.volume'),
  audioRms: sourceId('drmvyz.cinema.audio.rms'),
  audioEnergy: sourceId('drmvyz.cinema.audio.energy'),
  audioBass: sourceId('drmvyz.cinema.audio.bass'),
  audioMid: sourceId('drmvyz.cinema.audio.mid'),
  audioHigh: sourceId('drmvyz.cinema.audio.high'),
  audioSub: sourceId('drmvyz.cinema.audio.sub'),
  audioCentroid: sourceId('drmvyz.cinema.audio.centroid'),
  audioFlux: sourceId('drmvyz.cinema.audio.flux'),
  audioHarmonicity: sourceId('drmvyz.cinema.audio.harmonicity'),
  audioComplexity: sourceId('drmvyz.cinema.audio.complexity'),
  audioTension: sourceId('drmvyz.cinema.audio.tension'),
  audioBuildProgress: sourceId('drmvyz.cinema.audio.build-progress'),
  audioDropImpact: sourceId('drmvyz.cinema.audio.drop-impact'),
  audioVocalPresence: sourceId('drmvyz.cinema.audio.vocal-presence'),
  musicBeatPhase: sourceId('drmvyz.cinema.music.beat-phase'),
  musicSectionProgress: sourceId('drmvyz.cinema.music.section-progress'),
  lyricLineProgress: sourceId('drmvyz.cinema.lyrics.line-progress'),
  lyricWordProgress: sourceId('drmvyz.cinema.lyrics.word-progress'),
  impulseBeat: sourceId('drmvyz.cinema.impulse.beat'),
  impulseDownbeat: sourceId('drmvyz.cinema.impulse.downbeat'),
  impulseKick: sourceId('drmvyz.cinema.impulse.kick'),
  impulseSnare: sourceId('drmvyz.cinema.impulse.snare'),
  impulseTransient: sourceId('drmvyz.cinema.impulse.transient'),
  impulseSectionStart: sourceId('drmvyz.cinema.impulse.section-start'),
  impulseDropStart: sourceId('drmvyz.cinema.impulse.drop-start'),
  impulseLyricCue: sourceId('drmvyz.cinema.impulse.lyric-cue'),
  impulseLyricWord: sourceId('drmvyz.cinema.impulse.lyric-word'),
  impulsePhrase4: sourceId('drmvyz.cinema.impulse.phrase-4'),
  impulsePhrase8: sourceId('drmvyz.cinema.impulse.phrase-8'),
  clockBeat: sourceId('drmvyz.cinema.clock.beat'),
  clockBeat2: sourceId('drmvyz.cinema.clock.two-beats'),
  clockBeat4: sourceId('drmvyz.cinema.clock.four-beats'),
  clockBar: sourceId('drmvyz.cinema.clock.bar'),
  clockBar4: sourceId('drmvyz.cinema.clock.four-bars'),
  clockBar8: sourceId('drmvyz.cinema.clock.eight-bars'),
  clockPhrase: sourceId('drmvyz.cinema.clock.phrase'),
  statePlaying: sourceId('drmvyz.cinema.state.playing'),
  statePaused: sourceId('drmvyz.cinema.state.paused'),
  stateVocalsActive: sourceId('drmvyz.cinema.state.vocals-active'),
  stateBuildActive: sourceId('drmvyz.cinema.state.build-active'),
  stateDropActive: sourceId('drmvyz.cinema.state.drop-active'),
} as const)

function descriptor(
  id: CinemaModulationSourceId,
  label: string,
  kind: CinemaModulationSourceKind,
  capability: CinemaModulationSourceCapability,
): CinemaModulationSourceDescriptor {
  return Object.freeze({ id, label, kind, capability, neutralValue: 0, minimum: 0, maximum: 1 })
}

const SOURCE_DESCRIPTORS = Object.freeze([
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioVolume, 'Volume', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioRms, 'RMS', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioEnergy, 'Energy', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioBass, 'Bass', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioMid, 'Mid', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioHigh, 'High', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioSub, 'Sub', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioCentroid, 'Spectral Centroid', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioFlux, 'Spectral Flux', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioHarmonicity, 'Harmonicity', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioComplexity, 'Complexity', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioTension, 'Tension', 'continuous', 'audio'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioBuildProgress, 'Build Progress', 'continuous', 'musicIntelligence'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioDropImpact, 'Drop Impact', 'continuous', 'musicIntelligence'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.audioVocalPresence, 'Vocal Presence', 'continuous', 'musicIntelligence'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.musicBeatPhase, 'Beat Phase', 'continuous', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.musicSectionProgress, 'Section Progress', 'continuous', 'authoritativeSections'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.lyricLineProgress, 'Lyric Line Progress', 'continuous', 'lyrics'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.lyricWordProgress, 'Lyric Word Progress', 'continuous', 'lyrics'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulseBeat, 'Beat', 'impulse', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulseDownbeat, 'Downbeat', 'impulse', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulseKick, 'Kick', 'impulse', 'musicIntelligence'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulseSnare, 'Snare', 'impulse', 'musicIntelligence'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulseTransient, 'Transient', 'impulse', 'musicIntelligence'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulseSectionStart, 'Section Start', 'impulse', 'authoritativeSections'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulseDropStart, 'Drop Start', 'impulse', 'authoritativeSections'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulseLyricCue, 'Lyric Cue', 'impulse', 'lyrics'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulseLyricWord, 'Lyric Word', 'impulse', 'lyrics'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulsePhrase4, 'Four-beat Phrase', 'impulse', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.impulsePhrase8, 'Eight-beat Phrase', 'impulse', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.clockBeat, 'Beat Clock', 'clock', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.clockBeat2, 'Two-beat Clock', 'clock', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.clockBeat4, 'Four-beat Clock', 'clock', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.clockBar, 'Bar Clock', 'clock', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.clockBar4, 'Four-bar Clock', 'clock', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.clockBar8, 'Eight-bar Clock', 'clock', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.clockPhrase, 'Phrase Clock', 'clock', 'beatGrid'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.statePlaying, 'Playing', 'state', 'transport'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.statePaused, 'Paused', 'state', 'transport'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.stateVocalsActive, 'Vocals Active', 'state', 'lyrics'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.stateBuildActive, 'Build Active', 'state', 'musicIntelligence'),
  descriptor(CINEMA_MODULATION_SOURCE_IDS.stateDropActive, 'Drop Active', 'state', 'musicIntelligence'),
] as const)

const SOURCE_BY_ID = new Map<CinemaModulationSourceId, Readonly<CinemaModulationSourceDescriptor>>(
  SOURCE_DESCRIPTORS.map(source => [source.id, source]),
)

export const CINEMA_MODULATION_SOURCE_CATALOG: readonly Readonly<CinemaModulationSourceDescriptor>[] = SOURCE_DESCRIPTORS

export function getCinemaModulationSourceDescriptor(
  sourceIdValue: CinemaModulationSourceId | string,
): Readonly<CinemaModulationSourceDescriptor> | null {
  return SOURCE_BY_ID.get(sourceIdValue as CinemaModulationSourceId) ?? null
}

export function resolveCinemaModulationSourceSample(
  sourceIdValue: CinemaModulationSourceId | string,
  frame: Readonly<CinemaFrameContext>,
): Readonly<CinemaModulationSourceSample> | null {
  const source = getCinemaModulationSourceDescriptor(sourceIdValue)
  if (!source) return null
  const resolved = resolveValue(source.id, frame)
  const available = resolveAvailability(source, frame)
  return Object.freeze({
    source,
    available,
    value: available ? clamp01(resolved.value) : source.neutralValue,
    active: available && resolved.active,
    eventId: available ? resolved.eventId : null,
    disabledReason: available ? null : unavailableReason(source),
  })
}

function resolveValue(
  id: CinemaModulationSourceId,
  frame: Readonly<CinemaFrameContext>,
): { value: number; active: boolean; eventId: CinemaEventId | null } {
  const active = (value: boolean, eventId: CinemaEventId | null = null) => ({ value: value ? 1 : 0, active: value, eventId })
  switch (id) {
    case CINEMA_MODULATION_SOURCE_IDS.audioVolume: return scalar(frame.audio.volume)
    case CINEMA_MODULATION_SOURCE_IDS.audioRms: return scalar(frame.audio.rms)
    case CINEMA_MODULATION_SOURCE_IDS.audioEnergy: return scalar(frame.audio.energy)
    case CINEMA_MODULATION_SOURCE_IDS.audioBass: return scalar(frame.audio.bass)
    case CINEMA_MODULATION_SOURCE_IDS.audioMid: return scalar(frame.audio.mid)
    case CINEMA_MODULATION_SOURCE_IDS.audioHigh: return scalar(frame.audio.high)
    case CINEMA_MODULATION_SOURCE_IDS.audioSub: return scalar(frame.audio.sub)
    case CINEMA_MODULATION_SOURCE_IDS.audioCentroid: return scalar(frame.audio.centroid)
    case CINEMA_MODULATION_SOURCE_IDS.audioFlux: return scalar(frame.audio.flux)
    case CINEMA_MODULATION_SOURCE_IDS.audioHarmonicity: return scalar(frame.audio.harmonicity)
    case CINEMA_MODULATION_SOURCE_IDS.audioComplexity: return scalar(frame.audio.complexity)
    case CINEMA_MODULATION_SOURCE_IDS.audioTension: return scalar(frame.audio.tension)
    case CINEMA_MODULATION_SOURCE_IDS.audioBuildProgress: return scalar(frame.audio.buildProgress)
    case CINEMA_MODULATION_SOURCE_IDS.audioDropImpact: return scalar(frame.audio.dropImpact)
    case CINEMA_MODULATION_SOURCE_IDS.audioVocalPresence: return scalar(frame.audio.vocalPresence)
    case CINEMA_MODULATION_SOURCE_IDS.musicBeatPhase: return scalar(frame.music.beatPhase)
    case CINEMA_MODULATION_SOURCE_IDS.musicSectionProgress: return scalar(frame.music.sectionProgress)
    case CINEMA_MODULATION_SOURCE_IDS.lyricLineProgress: return scalar(frame.lyrics.lineProgress)
    case CINEMA_MODULATION_SOURCE_IDS.lyricWordProgress: return scalar(frame.lyrics.wordProgress)
    case CINEMA_MODULATION_SOURCE_IDS.impulseBeat: return active(frame.impulses.beat, frame.impulses.eventIds.beat)
    case CINEMA_MODULATION_SOURCE_IDS.impulseDownbeat: return active(frame.impulses.downbeat, frame.impulses.eventIds.downbeat)
    case CINEMA_MODULATION_SOURCE_IDS.impulseKick: return active(frame.impulses.kick, frame.impulses.eventIds.kick)
    case CINEMA_MODULATION_SOURCE_IDS.impulseSnare: return active(frame.impulses.snare, frame.impulses.eventIds.snare)
    case CINEMA_MODULATION_SOURCE_IDS.impulseTransient: return active(frame.impulses.transient, frame.impulses.eventIds.transient)
    case CINEMA_MODULATION_SOURCE_IDS.impulseSectionStart: return active(frame.impulses.sectionStart, frame.impulses.eventIds.sectionStart)
    case CINEMA_MODULATION_SOURCE_IDS.impulseDropStart: return active(frame.impulses.dropStart, frame.impulses.eventIds.dropStart)
    case CINEMA_MODULATION_SOURCE_IDS.impulseLyricCue: return active(frame.impulses.lyricCue, frame.impulses.eventIds.lyricCue)
    case CINEMA_MODULATION_SOURCE_IDS.impulseLyricWord: return active(frame.impulses.lyricWord, frame.impulses.eventIds.lyricWord)
    case CINEMA_MODULATION_SOURCE_IDS.impulsePhrase4: return active(frame.impulses.phrase4, frame.impulses.eventIds.phrase4)
    case CINEMA_MODULATION_SOURCE_IDS.impulsePhrase8: return active(frame.impulses.phrase8, frame.impulses.eventIds.phrase8)
    case CINEMA_MODULATION_SOURCE_IDS.clockBeat: return clock(frame, 'beat')
    case CINEMA_MODULATION_SOURCE_IDS.clockBeat2: return clock(frame, 'beat2')
    case CINEMA_MODULATION_SOURCE_IDS.clockBeat4: return clock(frame, 'beat4')
    case CINEMA_MODULATION_SOURCE_IDS.clockBar: return clock(frame, 'bar')
    case CINEMA_MODULATION_SOURCE_IDS.clockBar4: return clock(frame, 'bar4')
    case CINEMA_MODULATION_SOURCE_IDS.clockBar8: return clock(frame, 'bar8')
    case CINEMA_MODULATION_SOURCE_IDS.clockPhrase: return clock(frame, 'phrase')
    case CINEMA_MODULATION_SOURCE_IDS.statePlaying: return active(frame.transport.playing)
    case CINEMA_MODULATION_SOURCE_IDS.statePaused: return active(frame.transport.paused)
    case CINEMA_MODULATION_SOURCE_IDS.stateVocalsActive: return active(frame.lyrics.vocalsActive || frame.audio.vocalPresence > 0.05)
    case CINEMA_MODULATION_SOURCE_IDS.stateBuildActive: return active(isSection(frame, 'build') || frame.audio.buildProgress > 0.05)
    case CINEMA_MODULATION_SOURCE_IDS.stateDropActive: return active(isSection(frame, 'drop') || frame.audio.dropImpact > 0.05)
    default: return scalar(0)
  }
}

function scalar(value: number): { value: number; active: boolean; eventId: null } {
  const normalized = Number.isFinite(value) ? clamp01(value) : 0
  return { value: normalized, active: normalized > 0, eventId: null }
}

function clock(
  frame: Readonly<CinemaFrameContext>,
  id: CinemaMusicalClockId,
): { value: number; active: boolean; eventId: CinemaEventId | null } {
  const state = frame.music.clocks.states[id]
  return { value: state.hit ? 1 : 0, active: state.hit, eventId: state.eventId }
}

function resolveAvailability(
  source: Readonly<CinemaModulationSourceDescriptor>,
  frame: Readonly<CinemaFrameContext>,
): boolean {
  switch (source.capability) {
    case 'audio': return frame.audio.available
    case 'transport': return true
    case 'authoritativeSections': return frame.capabilities.authoritativeSections || frame.music.sectionId != null
    default: return frame.capabilities[source.capability]
  }
}

function unavailableReason(source: Readonly<CinemaModulationSourceDescriptor>): string {
  switch (source.capability) {
    case 'audio': return 'Normalized audio data is unavailable for this frame.'
    case 'transport': return 'Transport state is unavailable for this frame.'
    case 'musicIntelligence': return 'Music Intelligence data is unavailable for this frame.'
    case 'beatGrid': return 'A reliable musical beat grid is unavailable for this frame.'
    case 'authoritativeSections': return 'An authoritative section timeline is unavailable for this frame.'
    case 'lyrics': return 'Lyrics data is unavailable for this frame.'
    case 'brandKit': return 'Brand Kit data is unavailable for this frame.'
    case 'sharedPerformance': return 'Shared Performance data is unavailable for this frame.'
    case 'mediaAssets': return 'Media assets are unavailable for this frame.'
    case 'analyser': return 'Analyser data is unavailable for this frame.'
  }
}

function isSection(frame: Readonly<CinemaFrameContext>, expected: string): boolean {
  return frame.music.sectionType?.toLowerCase().includes(expected) === true
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}
