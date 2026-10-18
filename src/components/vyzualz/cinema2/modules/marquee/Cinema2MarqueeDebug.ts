/**
 * Diagnostic look switches for MARQUEE visual validation (neutral lighting with emission off, wireframe, normal view). They are
 * development-only: in a production build the switches are ignored, so a user can never end up in a diagnostic mode.
 */
export interface Cinema2MarqueeDebugState {
  /** `off` zeroes fixture, neon, sign and interior emission, leaving only structure, materials and scene lights. */
  emission: 'on' | 'off'
  geometry: 'normal' | 'wireframe' | 'normals'
}

const DEFAULT_STATE: Readonly<Cinema2MarqueeDebugState> = Object.freeze({ emission: 'on', geometry: 'normal' })

export function getCinema2MarqueeDebug(): Readonly<Cinema2MarqueeDebugState> {
  if (!import.meta.env.DEV) return DEFAULT_STATE
  const state = (globalThis as { __CINEMA2_MARQUEE_DEBUG__?: Partial<Cinema2MarqueeDebugState> }).__CINEMA2_MARQUEE_DEBUG__
  if (!state) return DEFAULT_STATE
  return {
    emission: state.emission === 'off' ? 'off' : 'on',
    geometry: state.geometry === 'wireframe' || state.geometry === 'normals' ? state.geometry : 'normal',
  }
}
