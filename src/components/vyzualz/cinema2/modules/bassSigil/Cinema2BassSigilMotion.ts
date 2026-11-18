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
export const BASS_SIGIL_PALETTE = {
  wordmark: [0, 0, 0, 1], edge: [.906, .906, .906, 1], core: [1, 0, 0, 1],
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
