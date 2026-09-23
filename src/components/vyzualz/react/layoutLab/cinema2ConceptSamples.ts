// ── cinema2ConceptSamples ──────────────────────────────────────────────────
//
// Layout Lab / Cinema 2.0 preset-concept mockups. Pure visual data — no real
// Cinema2 module/shader code, no runtime, no parameters. Each "preset" here
// is a hand-authored set of still-frame parameter values fed to
// Cinema2ConceptStill (a self-contained SVG renderer) to sketch the visual
// range a real preset might cover, for approval before real implementation.
//
// Reference image workflow (see Cinema2RightRailMockup): the user supplies a
// reference image for a concept; a dummy preset entry is added here with 10
// stills telling a coherent visual "story" (e.g. a core blooming, rays
// extending, sparkles appearing) inspired by that reference.

export interface Cinema2ConceptSparkle {
  x: number
  y: number
  size: number
  opacity: number
}

export interface Cinema2ConceptStill {
  id: string
  /** Short frame label shown under the still's thumbnail, e.g. "1 · Dormant". */
  label: string
  coreRadius: number
  coreGlow: number
  rayCount: number
  rayLength: number
  rayOpacity: number
  sparkles: Cinema2ConceptSparkle[]
}

export interface Cinema2ConceptPreset {
  id: string
  name: string
  /** One-line source note — what reference/idea this concept sketches. */
  blurb: string
  stills: Cinema2ConceptStill[]
}

function sparkles(seed: number, count: number, spread: number): Cinema2ConceptSparkle[] {
  // Deterministic pseudo-random placement — no Math.random(), so the mockup
  // renders identically on every load.
  let state = seed
  const next = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
  return Array.from({ length: count }, () => {
    const angle = next() * Math.PI * 2
    const radius = spread * (0.3 + next() * 0.7)
    return {
      x: 100 + Math.cos(angle) * radius,
      y: 100 + Math.sin(angle) * radius,
      size: 0.8 + next() * 1.6,
      opacity: 0.35 + next() * 0.65,
    }
  })
}

/** A "core blooms, rays extend and settle, sparkles bloom outward" ten-frame arc. */
const BLOOM_PULSE_STILLS: Cinema2ConceptStill[] = [
  { id: 'f1', label: '1 · Dormant core', coreRadius: 16, coreGlow: 0.15, rayCount: 10, rayLength: 18, rayOpacity: 0.25, sparkles: [] },
  { id: 'f2', label: '2 · Core stirring', coreRadius: 20, coreGlow: 0.25, rayCount: 12, rayLength: 32, rayOpacity: 0.35, sparkles: sparkles(2, 1, 40) },
  { id: 'f3', label: '3 · First bloom', coreRadius: 26, coreGlow: 0.4, rayCount: 14, rayLength: 54, rayOpacity: 0.48, sparkles: sparkles(3, 3, 55) },
  { id: 'f4', label: '4 · Expanding', coreRadius: 32, coreGlow: 0.52, rayCount: 16, rayLength: 76, rayOpacity: 0.58, sparkles: sparkles(4, 5, 65) },
  { id: 'f5', label: '5 · Mid bloom', coreRadius: 38, coreGlow: 0.65, rayCount: 16, rayLength: 96, rayOpacity: 0.68, sparkles: sparkles(5, 8, 75) },
  { id: 'f6', label: '6 · Surge', coreRadius: 46, coreGlow: 0.78, rayCount: 18, rayLength: 116, rayOpacity: 0.78, sparkles: sparkles(6, 12, 85) },
  { id: 'f7', label: '7 · Near-full bloom', coreRadius: 52, coreGlow: 0.88, rayCount: 20, rayLength: 132, rayOpacity: 0.86, sparkles: sparkles(7, 16, 92) },
  { id: 'f8', label: '8 · Full bloom', coreRadius: 58, coreGlow: 1, rayCount: 22, rayLength: 142, rayOpacity: 0.95, sparkles: sparkles(8, 22, 95) },
  { id: 'f9', label: '9 · Contracting', coreRadius: 44, coreGlow: 0.7, rayCount: 20, rayLength: 118, rayOpacity: 0.7, sparkles: sparkles(9, 14, 90) },
  { id: 'f10', label: '10 · Afterglow', coreRadius: 34, coreGlow: 0.5, rayCount: 16, rayLength: 88, rayOpacity: 0.5, sparkles: sparkles(10, 6, 70) },
]

export const CINEMA2_CONCEPT_PRESETS: Cinema2ConceptPreset[] = [
  {
    id: 'concept-bloom-pulse',
    name: 'Bloom Pulse (concept)',
    blurb: 'Dummy concept — radiating core, extending rays, scattered sparkles.',
    stills: BLOOM_PULSE_STILLS,
  },
]
