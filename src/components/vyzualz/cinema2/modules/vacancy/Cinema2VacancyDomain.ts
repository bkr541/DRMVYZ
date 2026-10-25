import type { Cinema2ModuleParameterReadFacet } from '../Cinema2ModuleContracts'

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
} as const

export const VACANCY_DEFAULTS = { master: 0.85, roomVisibility: 0.65 } as const

export interface VacancyControls {
  master: number
  roomVisibility: number
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
  /** Index within the triangular tier, front row to back. */
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

/** Staggered triangular layers form the pile: 10 main foundation cabinets, two rear fillers, then 6, 3 and one crown. */
export const VACANCY_PYRAMID_SIDES = [4, 3, 2, 1] as const
export const VACANCY_TIER_HEIGHTS: Readonly<Record<VacancyTowerSize, number>> = { compact: 0.42, standard: 0.48, tall: 0.54 }
const tiers: readonly (readonly VacancyTvId[])[] = [
  ['tv-set', 'tv-set', 'tv-set', 'tv-set', 'tv-set', 'tv-set', 'tv-set', 'tv-set', 'tv-set', 'tv-set', 'old-school', 'retro'],
  ['old-two', 'old-two', 'old-two', 'old-two', 'old-two', 'old-two'],
  ['sony-pvm', 'sony-pvm', 'sony-pvm'],
  ['vintage'],
]

/** All sizes use the same staggered composition; cabinet height controls the overall size. */
export const VACANCY_TOWER_LAYOUTS: Readonly<Record<VacancyTowerSize, readonly (readonly VacancyTvId[])[]>> = {
  compact: tiers, standard: tiers, tall: tiers,
}
