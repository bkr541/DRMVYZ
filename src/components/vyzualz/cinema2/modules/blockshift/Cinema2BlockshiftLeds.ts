import { CINEMA2_BLOCKSHIFT_BLOCKS, type Cinema2BlockshiftPattern } from './Cinema2BlockshiftDomain'
import type { Cinema2BlockshiftAudioRuntime } from './Cinema2BlockshiftAudio'
import { cinema2BlockshiftDirectorGain, type Cinema2BlockshiftDirectorChannels } from './Cinema2BlockshiftPerformance'
import type { Cinema2BlockshiftMesh } from './Cinema2BlockshiftModels'

export const CINEMA2_BLOCKSHIFT_LED_BARS = 12
export const CINEMA2_BLOCKSHIFT_LED_FLOATS = 15 * CINEMA2_BLOCKSHIFT_LED_BARS * 4
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
const fract = (n: number) => n - Math.floor(n)

/** Chart the supplied triangles, without moving them. Each face follows its longest physical axis;
 * the other varying axis spans the housing/diffuser. Twelve axis/sign circuits stay local to each cube.
 * Expanding indexed frame faces prevents UV/circuit interpolation across differently oriented bars.
 */
export function chartCinema2BlockshiftLedBars(mesh: Cinema2BlockshiftMesh): Cinema2BlockshiftMesh {
  const count = mesh.indices.length, vertices = new Float32Array(count * 6), ledCoordinates = new Float32Array(count * 3)
  if (count > 65535) throw new Error('BLOCKSHIFT LED frame exceeds its indexed geometry budget.')
  for (let face = 0; face < count; face += 3) {
    const points = Array.from({ length: 3 }, (_, corner) => Array.from(mesh.vertices.subarray(mesh.indices[face + corner]! * 6, mesh.indices[face + corner]! * 6 + 3)))
    const low = [0, 1, 2].map(a => Math.min(...points.map(p => p[a]!))), high = [0, 1, 2].map(a => Math.max(...points.map(p => p[a]!)))
    const axes = [0, 1, 2].sort((a, b) => (high[b]! - low[b]!) - (high[a]! - low[a]!)), along = axes[0]!, across = axes[1]!
    const other = [0, 1, 2].filter(a => a !== along)
    const circuit = along * 4 + (low[other[0]!]! + high[other[0]!]! > 0 ? 2 : 0) + (low[other[1]!]! + high[other[1]!]! > 0 ? 1 : 0)
    for (let corner = 0; corner < 3; corner++) {
      const target = face + corner, source = mesh.indices[target]! * 6, point = points[corner]!
      vertices.set(mesh.vertices.subarray(source, source + 6), target * 6)
      ledCoordinates.set([clamp(point[along]! + 0.5), high[across]! - low[across]! > 1e-7 ? clamp((point[across]! - low[across]!) / (high[across]! - low[across]!)) : 0.5, circuit], target * 3)
    }
  }
  return { vertices, indices: Uint16Array.from({ length: count }, (_, i) => i), ledCoordinates }
}

/** GPU circuit records: level, chase head, lit occupancy, transient core accent. No private clock/events. */
export function writeCinema2BlockshiftLeds(input: { pattern: Cinema2BlockshiftPattern; phase: number; reactivity: number; audio: ReturnType<Cinema2BlockshiftAudioRuntime['inspect']>; director: Readonly<Cinema2BlockshiftDirectorChannels>; macroWeight: number }, output = new Float32Array(CINEMA2_BLOCKSHIFT_LED_FLOATS)): Float32Array {
  if (output.length !== CINEMA2_BLOCKSHIFT_LED_FLOATS) throw new Error('BLOCKSHIFT requires twelve LED circuits for each of fifteen cubes.')
  const c = input.audio.channels, e = input.audio.envelopes, beat = input.phase * 32
  const gain = clamp(input.reactivity) * input.audio.motionGain * (1 - c.vocalRestraint * 0.4)
  const director = cinema2BlockshiftDirectorGain(input.director)
  const energy = clamp(c.audioEnergy * 0.4 + c.subPressure * 0.2 + c.bassPressure * 0.25 + c.midTilt * 0.2 + c.highGlint * 0.25 + c.buildTension * 0.35)
  for (const block of CINEMA2_BLOCKSHIFT_BLOCKS) for (let bar = 0; bar < 12; bar++) {
    const axis = Math.floor(bar / 4), bank = bar % 4, local = block.index / 15 + bar / 12
    let selection: number
    switch (input.pattern) {
      case 'stack': selection = 0.5 + 0.5 * Math.cos((block.row / 5 - beat / 4 + axis / 3) * Math.PI * 2); break
      case 'orbit': selection = 0.5 + 0.5 * Math.cos((bar / 12 + block.column / 3 - beat / 8) * Math.PI * 2); break
      case 'stagger': selection = (block.index + bar + Math.floor(beat / 2)) % 2 ? 0.2 : 1; break
      case 'split': selection = (block.column + bank + Math.floor(beat / 4)) % 2 ? 0.15 : 1; break
      case 'wave': selection = 0.5 + 0.5 * Math.sin((local - beat / 8) * Math.PI * 2); break
      case 'collapse': selection = 1 - Math.abs(fract(local + beat / 8) * 2 - 1); break
    }
    // Kick selects longitudinal bars on alternating cubes; snare selects cross bars on the opposite bank.
    const kick = axis === 1 && block.index % 2 === 0 ? e.kick : 0
    const snare = axis !== 1 && block.column !== 0 ? e.snare : 0
    const structure = e.downbeat * (axis === 0 ? 0.18 : 0.06) + e.bar * bank / 24 + e.phrase * selection * 0.16 + e.section * (block.index === 4 ? 0.3 : 0.08)
    const impact = kick * 0.42 + snare * 0.36 + e.drop * (0.18 + 0.2 * selection) + structure
    output.set([
      clamp(0.36 + gain * director * (energy * (0.12 + 0.35 * selection) + impact + (block.index === 4 ? c.vocalRestraint * 0.15 : 0) + input.macroWeight * selection * 0.2)),
      gain * fract(beat / (axis === 1 ? 4 : 8) + local + e.phrase * 0.2),
      clamp(1 - gain * (energy * (0.35 + 0.35 * (1 - selection)) + c.buildTension * 0.15 - e.drop * 0.25)),
      clamp(gain * director * (impact + c.highGlint * (bar % 2 ? 0.25 : 0.08) + c.spectralGlint * 0.15)),
    ], (block.index * 12 + bar) * 4)
  }
  return output
}
