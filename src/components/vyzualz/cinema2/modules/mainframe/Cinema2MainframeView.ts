/**
 * Mainframe's view motion: Camera Zoom (a push-in toward the board) and Camera Drift (a slow sway), as one pose the renderer applies to the
 * board relative to its fixed framing camera. Moving the board toward the lens and swaying it a few degrees about the DVYDRM logo is, on screen,
 * the same as moving the camera, and it brings the board's modeled 3D parts (which stand well above the plate) into view with real parallax.
 *
 * Both controls default to 0, and at 0 the pose is exactly "no motion", so the default framing is untouched. Every amplitude is bounded here so
 * the board always covers the frame (the authored cover overscan is larger than the sway can uncover) and nothing can leave the lens.
 */
export interface Cinema2MainframeViewInput {
  /** Camera Zoom, 0..1. */
  readonly zoom: number
  /** Camera Drift, 0..1. */
  readonly drift: number
  /** Deterministic playback time in seconds (frozen while paused). */
  readonly timeSec: number
  /** Track tempo, used only with `bpmSync`. */
  readonly bpm: number | null | undefined
  readonly bpmSync: boolean
}

export interface Cinema2MainframeView {
  /** World-space push toward the lens: the camera sits at z 12.2, so +z is closer. */
  readonly offset: readonly [number, number, number]
  /** World-space rotation in radians (x, y, z) about the board's centre. */
  readonly rotationRadians: readonly [number, number, number]
}

/** World units the board comes toward the lens at full Camera Zoom (the lens is 12.2 units away). */
export const CINEMA2_MAINFRAME_MAX_PUSH = 4.2
/** Largest sway at full Camera Drift, in degrees. */
export const CINEMA2_MAINFRAME_MAX_DRIFT_YAW_DEGREES = 7
export const CINEMA2_MAINFRAME_MAX_DRIFT_PITCH_DEGREES = 3.5
/** Free-running sway rate (cycles per second, one every ~14 s) and the tempo-locked one (one cycle per this many beats). */
export const CINEMA2_MAINFRAME_DRIFT_HZ = 0.07
export const CINEMA2_MAINFRAME_DRIFT_BEATS_PER_CYCLE = 16

const IDENTITY: Readonly<Cinema2MainframeView> = Object.freeze({
  offset: Object.freeze([0, 0, 0] as const),
  rotationRadians: Object.freeze([0, 0, 0] as const),
})

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const radians = (degrees: number) => degrees * Math.PI / 180

export function resolveCinema2MainframeView(input: Readonly<Cinema2MainframeViewInput>): Readonly<Cinema2MainframeView> {
  const zoom = clamp01(input.zoom)
  const drift = clamp01(input.drift)
  if (zoom === 0 && drift === 0) return IDENTITY
  const time = Number.isFinite(input.timeSec) ? input.timeSec : 0
  const tempo = input.bpmSync && typeof input.bpm === 'number' && Number.isFinite(input.bpm) && input.bpm > 0 ? input.bpm : null
  const cycles = tempo != null
    ? time * (tempo / 60) / CINEMA2_MAINFRAME_DRIFT_BEATS_PER_CYCLE
    : time * CINEMA2_MAINFRAME_DRIFT_HZ
  const phase = cycles * Math.PI * 2
  const yaw = radians(CINEMA2_MAINFRAME_MAX_DRIFT_YAW_DEGREES) * drift * Math.sin(phase)
  const pitch = radians(CINEMA2_MAINFRAME_MAX_DRIFT_PITCH_DEGREES) * drift * Math.sin(phase * 0.62 + 1.3)
  return Object.freeze({
    offset: Object.freeze([0.18 * drift * Math.sin(phase * 0.8 + 0.5), 0.1 * drift * Math.sin(phase * 0.5 + 2.1), CINEMA2_MAINFRAME_MAX_PUSH * zoom] as const),
    rotationRadians: Object.freeze([pitch, yaw, 0] as const),
  })
}

export function isIdentityCinema2MainframeView(view: Readonly<Cinema2MainframeView>): boolean {
  return view === IDENTITY
}
