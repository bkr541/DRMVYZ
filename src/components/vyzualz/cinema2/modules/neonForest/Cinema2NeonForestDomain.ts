import type { Cinema2CameraRigManifest, Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleParameterReadFacet } from '../Cinema2ModuleContracts'
export const NEON_FOREST_PATTERNS = [
  { value: 'prism-tide', label: 'Prism Tide' }, { value: 'root-resonance', label: 'Root Resonance' },
  { value: 'aisle-cascade', label: 'Aisle Cascade' }, { value: 'crown-spiral', label: 'Crown Spiral' },
  { value: 'portal-bloom', label: 'Portal Bloom' }, { value: 'crosscurrent', label: 'Crosscurrent' },
  { value: 'crystal-choir', label: 'Crystal Choir' }, { value: 'supernova-grove', label: 'Supernova Grove' },
] as const
export const NEON_FOREST_COLORS = {
  backgroundColor: [.009, .004, .027, 1], primaryColor: [.08, .88, 1, 1], secondaryColor: [.68, .12, 1, 1],
  portalColor: [1, .08, .43, 1], groundColor: [.18, .27, .38, 1], particleColor: [.6, .93, 1, 1],
} as const
export const NEON_FOREST_MAX_DISPLACEMENT = .75
export const NEON_FOREST_CAMERA_MODES = [
  { value: 'travel', label: 'Aisle Travel' }, { value: 'orbit', label: 'Grove Orbit' },
  { value: 'elevated', label: 'Elevated Passage' }, { value: 'fixed', label: 'Fixed View' },
] as const
const v = (x: number, y: number, z: number): Cinema2Vector3 => [x, y, z]
const travel = [v(-.3,2.3,17),v(-.3,2.3,8),v(-.3,2.3,1),v(-.3,2.3,-7),v(-.3,2.7,-14),v(0,2.7,-16),v(.3,2.7,-14),v(.3,2.3,-7),v(.3,2.3,1),v(.3,2.3,8),v(.3,2.3,17),v(0,2.3,20)]
export const NEON_FOREST_CAMERA_RIGS: Readonly<Record<string, Cinema2CameraRigManifest>> = {
  travel: { kind: 'fly', points: travel.map((position,i) => ({ position, target: v(position[0],2.262,position[2] + (i < 5 ? -5 : i < 10 ? 5 : -2)) })), durationSeconds: 52, loop: true },
  elevated: { kind: 'fly', points: Array.from({length:12},(_,i) => { const a=i*Math.PI/6;return { position:v(Math.sin(a)*23,16+Math.sin(a*2),Math.cos(a)*23),target:v(0,2.262,0) } }), durationSeconds: 72, loop: true },
  orbit: { kind: 'orbit', radius: 20, elevationDegrees: 40, azimuthDegrees: 0, angularVelocityDegreesPerSecond: 5 },
  fixed: { kind: 'static' },
}
export interface NeonForestControls {
  autoPerformance: boolean; musicResponse: number; master: number; motion: boolean; amount: number; speed: number; bpmSync: boolean; pattern: number
  patternChange: boolean; trigger: string; density: number; scale: number; emission: number; particles: number; portalSize: number; portalMotion: boolean
  colors: Record<keyof typeof NEON_FOREST_COLORS, readonly number[]>
}
export function readNeonForestControls(p: Cinema2ModuleParameterReadFacet): NeonForestControls {
  const num = (key: string, fallback: number, min = 0, max = 1) => { const x=p.get(key);return typeof x==='number'&&Number.isFinite(x)?Math.max(min,Math.min(max,x)):fallback }
  const bool = (key: string, fallback: boolean) => typeof p.get(key)==='boolean'?p.get(key) as boolean:fallback
  const color = (key: keyof typeof NEON_FOREST_COLORS): readonly number[] => {
    const value = p.get(key)
    return Array.isArray(value) && value.length >= 3 ? value as number[] : NEON_FOREST_COLORS[key]
  }
  return {
    autoPerformance:bool('autoPerformance',false),musicResponse:num('musicResponse',.8),master:num('master',.85),motion:bool('motion',true),amount:num('amount',.65),speed:num('speed',1,0,2),bpmSync:bool('bpmSync',true),
    pattern:Math.max(0,NEON_FOREST_PATTERNS.findIndex(x=>x.value===p.get('pattern'))),patternChange:bool('patternChange',false),trigger:String(p.get('trigger')??'bar4'),
    density:num('density',1),scale:num('scale',1,.8,1.1),emission:num('emission',.65),particles:num('particles',.45),portalSize:num('portalSize',1,.65,1.35),portalMotion:bool('portalMotion',true),
    colors: { backgroundColor: color('backgroundColor'), primaryColor: color('primaryColor'), secondaryColor: color('secondaryColor'), portalColor: color('portalColor'), groundColor: color('groundColor'), particleColor: color('particleColor') },
  }
}
