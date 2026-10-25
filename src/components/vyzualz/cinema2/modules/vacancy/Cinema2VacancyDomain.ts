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

export const VACANCY_DEFAULTS = { master: 0.85, roomVisibility: 0.35 } as const

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
  /** Index within the tier, left to right. */
  index: number
  x: number
  y: number
  z: number
  /** Turn about the vertical axis, radians. 0 faces the camera. */
  yaw: number
}

export type VacancyTowerSize = 'compact' | 'standard' | 'tall'

/**
 * Which set goes where, tier by tier from the floor. Every size contains all six models. The big, boxy sets sit low; the vintage set, whose antennae
 * would otherwise poke into whatever rests above it, always crowns the tower.
 */
export const VACANCY_TOWER_LAYOUTS: Readonly<Record<VacancyTowerSize, readonly (readonly VacancyTvId[])[]>> = {
  compact: [
    ['old-school', 'retro', 'tv-set', 'sony-pvm'],
    ['sony-pvm', 'tv-set', 'old-school'],
    ['old-two', 'vintage'],
  ],
  standard: [
    ['tv-set', 'retro', 'old-school', 'tv-set'],
    ['sony-pvm', 'old-school', 'tv-set', 'sony-pvm'],
    ['retro', 'old-two', 'sony-pvm'],
    ['old-two', 'old-school'],
    ['vintage'],
  ],
  tall: [
    ['old-school', 'tv-set', 'retro', 'tv-set', 'old-school'],
    ['sony-pvm', 'old-school', 'tv-set', 'retro', 'sony-pvm'],
    ['tv-set', 'retro', 'old-two', 'sony-pvm'],
    ['old-school', 'sony-pvm', 'tv-set'],
    ['old-two', 'vintage'],
  ],
}
