export const MODEL_TEXTURES = {
  'brushed-metal': 'Brushed metal',
  rust: 'Rust',
  concrete: 'Concrete',
  brick: 'Brick',
  'wood-grain': 'Wood grain',
  leather: 'Leather',
  'woven-fabric': 'Woven fabric',
  rubber: 'Rubber',
  marble: 'Marble',
  'ceramic-tile': 'Ceramic tile',
  'carbon-fiber': 'Carbon fiber',
  'holographic-foil': 'Holographic foil',
} as const

export type ModelTextureId = keyof typeof MODEL_TEXTURES

export function isModelTextureId(value: unknown): value is ModelTextureId {
  return typeof value === 'string' && Object.hasOwn(MODEL_TEXTURES, value)
}

export function modelTextureUrl(id: ModelTextureId): string {
  return `${import.meta.env.BASE_URL}model-textures/${id}.webp`
}
