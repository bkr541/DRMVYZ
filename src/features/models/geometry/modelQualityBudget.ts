import { ModelAssetError } from '../domain/modelAssetTypes'
export type ModelQuality = 'draft' | 'normal' | 'high'
export const MODEL_INPUT_LIMITS = { bytes: 16 * 1024 * 1024, svgBytes: 1024 * 1024, edge: 4096, pixels: 4_194_304, paths: 256, commands: 12_000, points: 6_000 } as const
export const MODEL_QUALITY = {
  draft: { curveSegments: 4, bevelSegments: 1, triangles: 20_000, traceEdge: 256 },
  normal: { curveSegments: 12, bevelSegments: 3, triangles: 80_000, traceEdge: 768 },
  high: { curveSegments: 24, bevelSegments: 6, triangles: 200_000, traceEdge: 1024 },
} as const
export interface ModelDiagnostic { code: string; message: string }
export class ModelGenerationError extends ModelAssetError {
  constructor(public readonly code: string, message: string, public readonly preview?: Blob) { super('validation', message); this.name = 'ModelGenerationError' }
}
export function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Model generation cancelled.', 'AbortError')
}
export function checkDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MODEL_INPUT_LIMITS.edge || height > MODEL_INPUT_LIMITS.edge || width * height > MODEL_INPUT_LIMITS.pixels) {
    throw new ModelGenerationError('input_budget', 'Model source exceeds the 4096-edge or 4-megapixel input budget.')
  }
}
