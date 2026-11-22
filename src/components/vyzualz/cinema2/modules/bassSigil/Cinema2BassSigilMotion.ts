/** Native programs operate only on the supplied meshes; no substitute environment. */
export const BASS_SIGIL_PATTERNS = [
  { value: 'reference-vortex', label: 'Reference Vortex' },
  { value: 'countercurrent', label: 'Countercurrent' },
  { value: 'axial-pressure', label: 'Axial Pressure' },
  { value: 'orbital-weave', label: 'Orbital Weave' },
  { value: 'broken-crown', label: 'Sector Crown' },
  { value: 'tidal-ribbon', label: 'Tidal Twist' },
  { value: 'lens-collapse', label: 'Lens Collapse' },
  { value: 'shock-bloom', label: 'Shock Bloom' },
] as const
export type BassSigilPattern = typeof BASS_SIGIL_PATTERNS[number]['value']
export const BASS_SIGIL_PATTERN_IDS = BASS_SIGIL_PATTERNS.map(p => p.value)
/** The colors of the sphere and its particles. The model in the middle keeps its own materials. */
export const BASS_SIGIL_PALETTE = {
  membrane: [1, 1, 1, 1], particles: [.36, .557, 1, 1],
} as const
export function deformBassSigilPoint(pattern: BassSigilPattern, x: number, y: number, z: number, phase: number, extent: number): readonly [number, number, number] {
  const a = Math.atan2(y, x), pulse = Math.sin(phase), strength = extent
  switch (pattern) {
    case 'reference-vortex': return [x, y, z] // Source sphere rotates; its original UV cells are unchanged.
    case 'countercurrent': return [x * (1 + .10 * strength), y, z * (1 - .10 * strength)]
    case 'axial-pressure': return [x, y, z * (1 - strength * (.20 + .18 * (pulse * .5 + .5)))]
    case 'orbital-weave': return [x * (1 + .16 * strength), y * (1 - .15 * strength), z * (1 + .08 * strength * pulse)]
    case 'broken-crown': {
      const r = 1 + strength * .18 * (.5 + .5 * Math.cos(8 * a + phase))
      return [x * r, y * r, z * (1 - .12 * strength)]
    }
    case 'tidal-ribbon': {
      const twist = strength * .55 * Math.sin(z * 3 + phase), c = Math.cos(twist), s = Math.sin(twist)
      return [x * c - y * s, x * s + y * c, z]
    }
    case 'lens-collapse': return [x * (1 - strength * (.14 + .10 * (pulse * .5 + .5))), y * (1 - strength * .12), z * (1 - strength * .4)]
    case 'shock-bloom': {
      const wave = Math.pow(.5 + .5 * Math.cos(phase), 4), r = 1 + strength * .22 * wave
      return [x * r, y * r, z * (1 + strength * .16 * wave)]
    }
  }
}

const easeInOutCubic = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
/** Beats a spin takes: quick, so the logo whips round and is back looking at the camera before the next beat's worth of music has passed. */
export const BASS_SIGIL_SPIN_BEATS = 1.5
/** How much of the camera's angle the logo follows while Auto Performance is on: most of it, so it stays somewhat centered on the viewer rather than pinned to it. */
export const BASS_SIGIL_CAMERA_PRESENCE = .85
/**
 * The extra heading, in radians, Auto Performance gives the logo on top of facing the camera: a quick full turn every `2 / spinRate` beats (1 to 16; alternating
 * direction), then a hold facing the camera, and on a drop two quick turns in 2 beats. Every turn is a whole number of revolutions, so the logo is always back
 * facing the camera when a turn ends. Spin Rate 0 turns the spinning off.
 */
export function bassSigilPresenceTurn(beats: number, spinRate: number, beatsSinceDrop: number | null): number {
  if (!(spinRate > 0) || !(beats >= 0)) return 0
  const period = Math.min(16, Math.max(1, 2 / spinRate)), turn = Math.min(BASS_SIGIL_SPIN_BEATS, period * .45)
  const cycle = Math.floor(beats / period), t = (beats - cycle * period) / turn
  let angle = t < 1 ? (cycle % 2 ? -1 : 1) * Math.PI * 2 * easeInOutCubic(t) : 0
  if (beatsSinceDrop != null && beatsSinceDrop >= 0 && beatsSinceDrop < 2) angle += Math.PI * 4 * easeInOutCubic(beatsSinceDrop / 2)
  return angle
}
