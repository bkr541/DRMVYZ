import type { Cinema2CameraRigManifest, Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleParameterReadFacet } from '../Cinema2ModuleContracts'

export const PSYLO_PATTERNS = [
  { value: 'mycelium-tide', label: 'Mycelium Tide' }, { value: 'gill-spiral', label: 'Gill Spiral' },
  { value: 'spore-choir', label: 'Spore Choir' }, { value: 'canopy-breath', label: 'Canopy Breath' },
  { value: 'fairy-ring', label: 'Fairy Ring' }, { value: 'root-relay', label: 'Root Relay' },
  { value: 'bloom-ascent', label: 'Bloom Ascent' }, { value: 'psylo-release', label: 'Psylo Release' },
] as const
export const PSYLO_COLORS = {
  backgroundColor: [.006, .009, .021, 1], primaryColor: [.55, .25, .95, 1], secondaryColor: [.15, .8, .55, 1],
  stemColor: [.55, .35, .2, 1], gillColor: [.35, .9, 1, 1], myceliumColor: [.25, .73, .64, 1], sporeColor: [.75, .88, 1, 1],
} as const
export const PSYLO_MAX_DISPLACEMENT = .75
export const PSYLO_MAX_SCALE = 1.1
export const PSYLO_CAMERA_MODES = [
  { value: 'travel', label: 'Forest Travel' }, { value: 'orbit', label: 'Grove Orbit' },
  { value: 'elevated', label: 'Canopy Passage' }, { value: 'fixed', label: 'Fixed View' },
] as const
const v = (x: number, y: number, z: number): Cinema2Vector3 => [x, y, z]
const travel = [v(.65, 2.5, 18), v(.7, 2.6, 10), v(1, 2.7, 3), v(1.1, 2.5, -1), v(1.3, 2.7, 3), v(.9, 2.6, 10)]
const elevated = Array.from({ length: 10 }, (_, i) => {
  const a = i / 10 * Math.PI * 2
  return v(Math.sin(a) * 19, 14.5 + 1.5 * Math.sin(a * 2), -8 + Math.cos(a) * 19)
})
export const PSYLO_CAMERA_RIGS: Readonly<Record<string, Cinema2CameraRigManifest>> = {
  travel: { kind: 'fly', points: travel.map(position => ({ position, target: v(0, 4.1, -8) })), durationSeconds: 52, loop: true },
  elevated: { kind: 'fly', points: elevated.map(position => ({ position, target: v(0, 3.5, -8) })), durationSeconds: 72, loop: true },
  orbit: { kind: 'orbit', radius: 18, elevationDegrees: 45, azimuthDegrees: 0, angularVelocityDegreesPerSecond: 5 },
  fixed: { kind: 'static' },
}
export interface PsyloControls {
  autoPerformance: boolean; musicResponse: number; master: number; motion: boolean; amount: number; speed: number; bpmSync: boolean; pattern: number
  patternChange: boolean; trigger: string; density: number; scale: number; emission: number; spores: number
  colors: Record<keyof typeof PSYLO_COLORS, readonly number[]>
}
export function readPsyloControls(p: Cinema2ModuleParameterReadFacet): PsyloControls {
  const num = (key: string, fallback: number, min = 0, max = 1) => { const x = p.get(key); return typeof x === 'number' && Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : fallback }
  const boolean = (key: string, fallback: boolean) => typeof p.get(key) === 'boolean' ? p.get(key) as boolean : fallback
  return {
    autoPerformance: boolean('autoPerformance', false), musicResponse: num('musicResponse', .8), master: num('master', .85), motion: boolean('motion', true), amount: num('amount', .5), speed: num('speed', 1, 0, 2), bpmSync: boolean('bpmSync', true),
    pattern: Math.max(0, PSYLO_PATTERNS.findIndex(x => x.value === p.get('pattern'))),
    patternChange: boolean('patternChange', false), trigger: String(p.get('trigger') ?? 'bar4'),
    density: num('density', 1), scale: num('scale', 1, .8, PSYLO_MAX_SCALE), emission: num('emission', .6), spores: num('spores', .6),
    colors: Object.fromEntries(Object.entries(PSYLO_COLORS).map(([key, fallback]) => {
      const color = p.get(key)
      return [key, Array.isArray(color) && color.length >= 3 ? color as number[] : fallback]
    })) as unknown as PsyloControls['colors'],
  }
}
