import type { Cinema2ModuleParameterReadFacet } from '../Cinema2ModuleContracts'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'

/** The six television models inside the shipped `cinema2-vacancy-set` asset (node `vacancy.tv.<id>`). */
export const VACANCY_TV_IDS = ['old-school', 'old-two', 'sony-pvm', 'retro', 'tv-set', 'vintage'] as const
export type VacancyTvId = typeof VACANCY_TV_IDS[number]

export const VACANCY_ASSET_ID = 'cinema2-vacancy-set'
export const VACANCY_ROOM_NODE = 'vacancy.room'
export const VACANCY_TV_NODE_PREFIX = 'vacancy.tv.'

export type VacancyRgb = readonly [number, number, number]

/** Palette defaults, sRGB. Background tints the room and ambient light, Screen tints the static. */
export const VACANCY_COLORS = {
  background: [0.012, 0.016, 0.024, 1],
  screen: [0.86, 0.9, 0.94, 1],
  highlight: [1, 1, 1, 1],
  glow: [0.86, 0.9, 0.94, 1],
  haze: [0.52, 0.62, 0.72, 1],
} as const

export const VACANCY_DEFAULTS = { master: 0.85, roomVisibility: 0.65, musicResponse: .7, bassRattle: .12,
  cameraMotion: .25, cameraOrbit: 0, screensLit: 1, static: 1, scanlines: 1, staticOverMedia: .12,
  bloom: .8, reflections: .62, haze: 0 } as const
export const VACANCY_PATTERNS = [
  { value: 'dead-air', label: 'Dead Air' }, { value: 'channel-hop', label: 'Channel Hop' },
  { value: 'ascent', label: 'Ascent' }, { value: 'collapse', label: 'Collapse' },
  { value: 'signal-sweep', label: 'Signal Sweep' }, { value: 'checker', label: 'Checker' },
  { value: 'vacancy', label: 'Vacancy' }, { value: 'interference', label: 'Interference' },
] as const
export type VacancyPattern = typeof VACANCY_PATTERNS[number]['value']

export interface VacancyControls {
  master: number
  roomVisibility: number
  bpmSync: boolean; musicResponse: number; bassRattle: number; autoPerformance: boolean
  pattern: VacancyPattern; patternChange: boolean; trigger: Cinema2AfterhoursTriggerId
  screensLit: number; static: number; scanlines: number; towerSize: VacancyTowerSize
  mediaOnScreens: boolean; mediaLayout: 'every-screen' | 'stack-wall'; staticOverMedia: number
  colors: Record<keyof typeof VACANCY_COLORS, VacancyRgb>
}

export function readVacancyControls(parameters: Cinema2ModuleParameterReadFacet): VacancyControls {
  const n = (name: string, fallback: number) => {
    const value = parameters.get(name)
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
  }
  return {
    master: n('master', VACANCY_DEFAULTS.master),
    roomVisibility: n('roomVisibility', VACANCY_DEFAULTS.roomVisibility),
    bpmSync: parameters.get('bpmSync') !== false,
    musicResponse: n('musicResponse', VACANCY_DEFAULTS.musicResponse), bassRattle: n('bassRattle', VACANCY_DEFAULTS.bassRattle),
    autoPerformance: parameters.get('autoPerformance') === true,
    pattern: VACANCY_PATTERNS.some(p => p.value === parameters.get('pattern')) ? parameters.get('pattern') as VacancyPattern : 'dead-air',
    patternChange: parameters.get('patternChange') === true,
    trigger: CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(parameters.get('trigger') as Cinema2AfterhoursTriggerId) ? parameters.get('trigger') as Cinema2AfterhoursTriggerId : 'bar4',
    screensLit: n('screensLit', 1), static: n('static', 1), scanlines: n('scanlines', 1),
    towerSize: parameters.get('towerSize') === 'compact' ? 'compact' : parameters.get('towerSize') === 'tall' ? 'tall' : 'standard',
    mediaOnScreens: parameters.get('mediaOnScreens') === true,
    mediaLayout: parameters.get('mediaLayout') === 'stack-wall' ? 'stack-wall' : 'every-screen', staticOverMedia: n('staticOverMedia', .12),
    colors: Object.fromEntries(Object.entries(VACANCY_COLORS).map(([name, fallback]) => {
      const v = parameters.get(`${name}Color`)
      return [name, Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(c => typeof c === 'number' && Number.isFinite(c))
        ? v.slice(0, 3).map(c => Math.min(1, Math.max(0, c as number))) : fallback.slice(0, 3)]
    })) as unknown as VacancyControls['colors'],
  }
}

/** Real-world footprint of one normalised television (metres), as written into the asset by build-vacancy-runtime.mjs. */
export interface VacancyTvSize {
  width: number
  height: number
  depth: number
  /** Height of the set's body: what the next tier rests on (antennae excluded). */
  bodyHeight: number
}

export interface VacancyScreenAnchor {
  cx: number
  cy: number
  width: number
  height: number
  /** Local z of the screen plane, just in front of the glass. */
  z: number
  radius: number
}

export interface VacancyPlacement {
  tv: VacancyTvId
  tier: number
  /** Index within this visible horizontal tier, left to right. */
  index: number
  x: number
  y: number
  z: number
  /** Turn about the vertical axis, radians. 0 faces the camera. */
  yaw: number
  /** Uniform model scale; keeps cabinet tops level within a tier. */
  scale?: number
}

export type VacancyTowerSize = 'compact' | 'standard' | 'tall'

/** Four visible rows of CRTs form a clean 4-3-2-1 pyramid. All six models remain in use. */
export const VACANCY_PYRAMID_SIDES = [4, 3, 2, 1] as const
export const VACANCY_TIER_HEIGHTS: Readonly<Record<VacancyTowerSize, number>> = { compact: 0.42, standard: 0.48, tall: 0.54 }
const tiers: readonly (readonly VacancyTvId[])[] = [
  ['old-school', 'tv-set', 'tv-set', 'retro'],
  ['old-two', 'sony-pvm', 'old-two'],
  ['sony-pvm', 'old-two'],
  ['vintage'],
]

/** All sizes retain the same silhouette; Tower Size adjusts the cabinet heights. */
export const VACANCY_TOWER_LAYOUTS: Readonly<Record<VacancyTowerSize, readonly (readonly VacancyTvId[])[]>> = {
  compact: tiers, standard: tiers, tall: tiers,
}
