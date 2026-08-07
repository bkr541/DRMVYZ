import type { LyricPlaybackState } from '../../../features/lyrics/runtime/lyricPlaybackResolver'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import type { BrandKit } from '../../../features/personalization/BrandKitTypes'
import {
  bridgeCinemaBrandKit,
  buildCinemaFrameContext,
  createCinemaDiagnosticSnapshot,
  type CinemaFrameBuildResult,
  type CinemaFrameBuilderState,
} from '../cinema'
import type { CinemaBrandRole, CinemaColor } from '../cinema'
import { getReactPerformanceAction, type ReactPerformanceActionEvent } from './ReactPerformanceActions'
import type { ReactTrackSection } from './ReactTypes'
import type { ReactFrameContext } from './renderers/reactRenderUtils'

export interface CinemaWorkspaceFrameBridgeInput {
  width: number
  height: number
  dpr: number
  audioTimeSec: number
  durationSec: number | null
  elapsedTimeSec?: number
  deltaTimeSec?: number
  trackId: string | null
  playing: boolean
  paused: boolean
  bpm: number | null
  timingDiscontinuity?: boolean
  seeking?: boolean
  looped?: boolean
  visibilitySuspended?: boolean
  musicIntelligence?: Readonly<MusicIntelligenceFrame> | null
  authoritativeSections?: readonly ReactTrackSection[]
  lyrics?: Readonly<LyricPlaybackState> | null
  performanceEvents?: readonly ReactPerformanceActionEvent[]
  performanceToggleStates?: Readonly<Record<string, boolean>>
  brandKit?: Readonly<BrandKit> | null
  mediaAssetsAvailable?: boolean
  previousState?: Readonly<CinemaFrameBuilderState> | null
}

/**
 * Production adapter from DRMVYZ's canonical React/audio snapshots into the
 * pure Cinema frame builder. It does not subscribe, sample an analyser, or own
 * an animation loop; Stage 7's runtime may call the same public builder per frame.
 */
export function buildCinemaWorkspaceFrameBridge(
  input: CinemaWorkspaceFrameBridgeInput,
): CinemaFrameBuildResult {
  const mi = currentMusicFrame(input.musicIntelligence ?? null, input.trackId, input.audioTimeSec)
  const lyrics = currentLyricFrame(input.lyrics ?? null, input.trackId)
  const reactFrame = createCinemaReactFrameSnapshot(input, mi)
  const performanceEvents = (input.performanceEvents ?? []).filter(event => event.target.engineId === 'cinema')
  const performanceToggleStates = Object.fromEntries(
    Object.entries(input.performanceToggleStates ?? {}).filter(([actionId]) => (
      getReactPerformanceAction(actionId)?.target.engineId === 'cinema'
    )),
  )

  const brand = bridgeCinemaBrandKit(input.brandKit)

  const result = buildCinemaFrameContext({
    reactFrame,
    transport: {
      trackId: input.trackId,
      durationSec: input.durationSec,
      seeking: input.seeking,
      looped: input.looped,
      visibilitySuspended: input.visibilitySuspended,
    },
    musicIntelligence: mi,
    authoritativeSections: input.authoritativeSections ?? [],
    lyrics,
    performance: {
      available: true,
      events: performanceEvents.map(event => ({ actionId: event.actionId, sequence: event.sequence })),
      toggleStates: performanceToggleStates,
    },
    brand: {
      available: brand.available,
      colors: brand.colors,
    },
    mediaAssetsAvailable: input.mediaAssetsAvailable === true,
    previousState: input.previousState ?? null,
  })
  if (brand.diagnostics.diagnostics.length === 0) return result
  return Object.freeze({
    ...result,
    diagnostics: createCinemaDiagnosticSnapshot([
      ...result.diagnostics.diagnostics,
      ...brand.diagnostics.diagnostics,
    ]),
  })
}

export function createCinemaReactFrameSnapshot(
  input: CinemaWorkspaceFrameBridgeInput,
  musicIntelligence: Readonly<MusicIntelligenceFrame> | null = input.musicIntelligence ?? null,
): ReactFrameContext {
  const mi = musicIntelligence && musicIntelligence.frameId > 0 ? musicIntelligence : null
  return {
    W: Math.max(1, Math.floor(finiteOr(input.width, 1))),
    H: Math.max(1, Math.floor(finiteOr(input.height, 1))),
    dpr: clamp(finiteOr(input.dpr, 1), 0.25, 8),
    t: (input.previousState?.frameIndex ?? -1) + 1,
    elapsedTimeSec: nonNegative(input.elapsedTimeSec ?? input.audioTimeSec),
    deltaTimeSec: clamp(finiteOr(input.deltaTimeSec, 1 / 60), 0, 0.25),
    timingDiscontinuity: input.timingDiscontinuity === true,
    timeSec: nonNegative(input.audioTimeSec),
    audioTime: nonNegative(input.audioTimeSec),
    trackKey: input.trackId,
    bpm: positiveOrZero(input.bpm ?? mi?.rhythm.bpm ?? 0),
    beatPhase: mi ? clamp01(mi.rhythm.beatPhase) : Number.NaN,
    beatHit: mi?.rhythm.beatHit === true,
    isPlaying: input.playing,
    isPaused: input.paused,
    audio: {
      bass: clamp01(mi?.bands.bass ?? 0),
      mid: clamp01(mi ? (mi.bands.lowMid + mi.bands.mid) * 0.5 : 0),
      high: clamp01(mi ? (mi.bands.high + mi.bands.air) * 0.5 : 0),
      volume: clamp01(mi?.bands.volume ?? 0),
    },
    freqData: mi?.raw.freqData ?? null,
    timeDomainData: mi?.raw.timeDomainData ?? null,
    musicIntelligence: mi,
    trackSections: input.authoritativeSections ?? [],
  }
}

export function cinemaBrandColors(kit: Readonly<BrandKit>): Partial<Record<CinemaBrandRole, CinemaColor>> {
  return bridgeCinemaBrandKit(kit).colors
}

function currentMusicFrame(
  frame: Readonly<MusicIntelligenceFrame> | null,
  trackId: string | null,
  audioTimeSec: number,
): Readonly<MusicIntelligenceFrame> | null {
  if (!frame || frame.frameId <= 0 || trackId == null) return null
  const explicitTrackMismatch = trackId != null
    && frame.trackId != null
    && frame.trackId !== trackId
    && frame.sourceId !== trackId
  if (explicitTrackMismatch) return null
  if (Math.abs(frame.timeSec - audioTimeSec) > 2) return null
  return frame
}

function currentLyricFrame(
  frame: Readonly<LyricPlaybackState> | null,
  trackId: string | null,
): Readonly<LyricPlaybackState> | null {
  if (!frame || trackId == null) return null
  if (frame.sourceIdentity == null) return frame
  return frame.sourceIdentity === trackId || frame.sourceIdentity.startsWith(`${trackId}:`)
    ? frame
    : null
}

function hexToCinemaColor(value: string): CinemaColor {
  const normalized = value.trim().replace(/^#/, '')
  const expanded = normalized.length === 3
    ? normalized.split('').map(character => character + character).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return Object.freeze([0, 0, 0, 1]) as CinemaColor
  return Object.freeze([
    Number.parseInt(expanded.slice(0, 2), 16) / 255,
    Number.parseInt(expanded.slice(2, 4), 16) / 255,
    Number.parseInt(expanded.slice(4, 6), 16) / 255,
    1,
  ]) as CinemaColor
}

function darkenCinemaColor(color: CinemaColor, amount: number): CinemaColor {
  const scale = clamp(1 - amount, 0, 1)
  return Object.freeze([
    color[0] * scale,
    color[1] * scale,
    color[2] * scale,
    color[3],
  ]) as CinemaColor
}

function finiteOr(value: number | undefined | null, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nonNegative(value: number | undefined | null): number {
  return Math.max(0, finiteOr(value, 0))
}

function positiveOrZero(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function clamp01(value: number): number {
  return clamp(finiteOr(value, 0), 0, 1)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
