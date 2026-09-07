import type { AfterhoursSettings } from '../../../CinematicWorldSettings'

export const AFTERHOURS_BOTTOM_EMITTERS = Object.freeze([
  Object.freeze({ x: 0.07, y: 0.025 }),
  Object.freeze({ x: 0.165, y: 0.025 }),
  Object.freeze({ x: 0.26, y: 0.025 }),
  Object.freeze({ x: 0.355, y: 0.025 }),
  Object.freeze({ x: 0.45, y: 0.025 }),
  Object.freeze({ x: 0.55, y: 0.025 }),
  Object.freeze({ x: 0.645, y: 0.025 }),
  Object.freeze({ x: 0.74, y: 0.025 }),
  Object.freeze({ x: 0.835, y: 0.025 }),
  Object.freeze({ x: 0.93, y: 0.025 }),
] as const)

export const AFTERHOURS_MAX_BEAMS = 16

export interface AfterhoursBeamDescriptor {
  readonly active: boolean
  readonly origin: Readonly<{ x: number; y: number }>
  readonly target: Readonly<{ x: number; y: number }>
  readonly accent: boolean
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function deterministicUnit(index: number): number {
  let value = (index + 1) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0
  value ^= value >>> 16
  return (value >>> 0) / 4294967296
}

export function buildAfterhoursBeamSlots(
  settings: Pick<AfterhoursSettings, 'beamCount' | 'spread' | 'accentMix'>,
): readonly AfterhoursBeamDescriptor[] {
  const count = Math.max(2, Math.min(AFTERHOURS_MAX_BEAMS, Math.round(settings.beamCount)))
  const spread = clamp01(settings.spread)
  const accentMix = clamp01(settings.accentMix)
  return Object.freeze(Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => {
    const origin = AFTERHOURS_BOTTOM_EMITTERS[index % AFTERHOURS_BOTTOM_EMITTERS.length]
    if (index >= count) {
      return Object.freeze({ active: false, origin, target: Object.freeze({ x: 0, y: 0 }), accent: false })
    }
    const ordinal = count <= 1 ? 0.5 : index / (count - 1)
    const fanX = 0.08 + ordinal * 0.84
    const compactX = 0.5 + (origin.x - 0.5) * 0.12
    const targetX = compactX + (fanX - compactX) * spread
    const targetY = 0.84 + deterministicUnit(index * 7 + 3) * 0.11
    return Object.freeze({
      active: true,
      origin,
      target: Object.freeze({ x: targetX, y: targetY }),
      accent: accentMix >= 1 || (accentMix > 0 && deterministicUnit(index * 13 + 11) < accentMix),
    })
  }))
}
