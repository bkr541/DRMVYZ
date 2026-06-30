import type { MediaMetadata } from '../../types/database'
import { PALETTE_EXTRACTION_ALGORITHM_VERSION, extractPaletteFromImageFile } from './paletteExtraction'

export function mergeMediaMetadata(base: MediaMetadata, patch: Partial<MediaMetadata>): MediaMetadata {
  const merged: MediaMetadata = {
    ...base,
    ...patch,
    ...(base.svgValidation || patch.svgValidation
      ? { svgValidation: patch.svgValidation ?? base.svgValidation }
      : {}),
  }
  if (patch.paletteAnalysis) delete merged.paletteAnalysisError
  return merged
}

export async function analyzePaletteForMediaFile(file: File): Promise<Partial<MediaMetadata>> {
  try {
    const analysis = await extractPaletteFromImageFile(file)
    return {
      dominantColors: analysis.swatches.map(swatch => swatch.hex),
      paletteAnalysis: analysis,
      analyzedAt: Date.now(),
    }
  } catch (error) {
    return {
      paletteAnalysisError: {
        algorithmVersion: PALETTE_EXTRACTION_ALGORITHM_VERSION,
        attemptedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message.slice(0, 240) : 'Palette analysis failed',
      },
    }
  }
}
