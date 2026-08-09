import type { CinemaFrameContext, CinemaViewport } from '../CinemaRendererContracts'

export const CINEMA_MAX_FRAME_DELTA_SEC = 0.1

export interface CinemaRuntimeFrameSourceSample {
  readonly nowMs: number
  readonly deltaTimeSec: number
  readonly timingDiscontinuity: boolean
  readonly viewport: Readonly<CinemaViewport>
}

export type CinemaRuntimeFrameSource = (
  sample: Readonly<CinemaRuntimeFrameSourceSample>,
) => CinemaFrameContext | null

export interface CinemaRuntimeFrameClockState {
  readonly lastNowMs: number | null
}

export interface CinemaRuntimeFrameClockSample {
  readonly deltaTimeSec: number
  readonly timingDiscontinuity: boolean
  readonly state: CinemaRuntimeFrameClockState
}

/** Pure RAF-clock step used by the live runtime and deterministic schedule tests. */
export function sampleCinemaRuntimeFrameClock(
  previous: Readonly<CinemaRuntimeFrameClockState>,
  nowMs: number,
): CinemaRuntimeFrameClockSample {
  const finiteNowMs = Number.isFinite(nowMs) ? nowMs : previous.lastNowMs ?? 0
  if (previous.lastNowMs == null || finiteNowMs < previous.lastNowMs) {
    return {
      deltaTimeSec: 0,
      timingDiscontinuity: true,
      state: { lastNowMs: finiteNowMs },
    }
  }

  const rawDeltaTimeSec = (finiteNowMs - previous.lastNowMs) / 1000
  const timingDiscontinuity = rawDeltaTimeSec > CINEMA_MAX_FRAME_DELTA_SEC
  return {
    deltaTimeSec: timingDiscontinuity
      ? 0
      : Math.min(CINEMA_MAX_FRAME_DELTA_SEC, Math.max(0, rawDeltaTimeSec)),
    timingDiscontinuity,
    state: { lastNowMs: finiteNowMs },
  }
}
