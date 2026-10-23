import type { Cinema2Color, Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'

// Inspector values stay compatible with saved presets; the camera now lives inside a field of large models.
export const CINEMA2_BLOCKSHIFT_BLOCK_COUNT = 15
export const CINEMA2_BLOCKSHIFT_MODEL_SCALE = 6
export const CINEMA2_BLOCKSHIFT_MAX_RADIUS = 600
export const CINEMA2_BLOCKSHIFT_DEFAULTS = Object.freeze({ blockSize: 1.35, spread: 1, depth: 0.45 })
export const CINEMA2_BLOCKSHIFT_PALETTE = Object.freeze({
  primaryEdge: [0x55 / 255, 0xe6 / 255, 1, 1] as Cinema2Color,
  secondaryEdge: [0x78 / 255, 0x66 / 255, 1, 1] as Cinema2Color,
  impactAccent: [1, 0xf1 / 255, 0xd6 / 255, 1] as Cinema2Color,
  blockBody: [0x15 / 255, 0x1a / 255, 0x24 / 255, 1] as Cinema2Color,
  background: [0x05 / 255, 0x08 / 255, 0x11 / 255, 1] as Cinema2Color,
})

export const CINEMA2_BLOCKSHIFT_PATTERN_IDS = ['stack', 'orbit', 'stagger', 'split', 'wave', 'collapse'] as const
export type Cinema2BlockshiftPattern = typeof CINEMA2_BLOCKSHIFT_PATTERN_IDS[number]

export type Cinema2BlockshiftBlockId = `block-0${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}` | `block-1${0 | 1 | 2 | 3 | 4}`
export type Cinema2BlockshiftEdgeRole = 'primaryEdge' | 'secondaryEdge' | 'impactAccent'
export interface Cinema2BlockshiftBlock {
  readonly id: Cinema2BlockshiftBlockId
  readonly index: number
  readonly row: number
  readonly column: number
  readonly edgeRole: Cinema2BlockshiftEdgeRole
}
export interface Cinema2BlockshiftInstance extends Cinema2BlockshiftBlock {
  readonly position: Cinema2Vector3
  readonly size: number
  readonly rotation: Cinema2Vector3
}

export const CINEMA2_BLOCKSHIFT_BLOCKS: readonly Readonly<Cinema2BlockshiftBlock>[] = Object.freeze(
  Array.from({ length: CINEMA2_BLOCKSHIFT_BLOCK_COUNT }, (_, index) => Object.freeze({
    id: `block-${String(index).padStart(2, '0')}` as Cinema2BlockshiftBlockId,
    index,
    row: Math.floor(index / 3),
    column: index % 3,
    edgeRole: index === 4 ? 'impactAccent' as const
      : index % 3 === 0 || index === 1 ? 'primaryEdge' as const : 'secondaryEdge' as const,
  })),
)

export function validateCinema2BlockshiftGeometry(blockSize: number, spread: number, depth: number): void {
  for (const [name, value, min, max] of [
    ['blockSize', blockSize, 1.05, 6], ['spread', spread, 0.5, 3], ['depth', depth, 0, 1],
  ] as const) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`BLOCKSHIFT ${name} must be finite and between ${min} and ${max}.`)
    }
  }
}
