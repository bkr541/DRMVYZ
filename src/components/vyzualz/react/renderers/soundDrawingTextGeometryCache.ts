import type {
  OscillatorFontAsset,
  OscillatorGlyphPoint,
} from '../ReactTypes'
import {
  parseOpenTypeFontFromAsset,
  textToOpenTypeGlyphPoints,
} from './fontGlyphUtils'

const RUNTIME_TEXT_CACHE_MAX = 32
const runtimeOpenTypeTextCache = new Map<string, OscillatorGlyphPoint[]>()
const failedRuntimeOpenTypeKeys = new Set<string>()
let runtimeGeometryBuildCount = 0

export interface RuntimeOpenTypeTextRequest {
  assets: OscillatorFontAsset[]
  preparedCache: Record<string, OscillatorGlyphPoint[]>
  fontId: string
  text: string
  resolution: number
  letterSpacing: number
  lineHeight: number
  alignment: 'left' | 'center' | 'right'
}

export function getRuntimeOpenTypeTextKey(
  request: Omit<RuntimeOpenTypeTextRequest, 'assets' | 'preparedCache'>,
): string {
  return [
    request.fontId,
    request.text,
    request.letterSpacing,
    request.lineHeight,
    request.alignment,
    request.resolution,
  ].join(':')
}

function putBounded(key: string, points: OscillatorGlyphPoint[]): void {
  runtimeOpenTypeTextCache.delete(key)
  runtimeOpenTypeTextCache.set(key, points)
  while (runtimeOpenTypeTextCache.size > RUNTIME_TEXT_CACHE_MAX) {
    const oldest = runtimeOpenTypeTextCache.keys().next().value
    if (oldest === undefined) break
    runtimeOpenTypeTextCache.delete(oldest)
  }
}

/**
 * Resolves a prepared custom-font path, compiling it only on a semantic text or
 * typography change. The animation renderer never parses font bytes directly.
 */
export function getRuntimeOpenTypeTextPoints(
  request: RuntimeOpenTypeTextRequest,
): OscillatorGlyphPoint[] | null {
  const key = getRuntimeOpenTypeTextKey(request)
  const prepared = request.preparedCache[key]
  if (prepared) return prepared

  const cached = runtimeOpenTypeTextCache.get(key)
  if (cached) return cached
  if (failedRuntimeOpenTypeKeys.has(key)) return null

  const asset = request.assets.find(candidate => candidate.id === request.fontId)
  if (!asset) return null

  try {
    const font = parseOpenTypeFontFromAsset(asset)
    const points = textToOpenTypeGlyphPoints(font, request.text, request.resolution, {
      letterSpacing: request.letterSpacing,
      lineHeight: request.lineHeight,
      alignment: request.alignment,
    })
    putBounded(key, points)
    runtimeGeometryBuildCount += 1
    return points
  } catch {
    failedRuntimeOpenTypeKeys.add(key)
    return null
  }
}

export function clearRuntimeOpenTypeTextGeometry(): void {
  runtimeOpenTypeTextCache.clear()
  failedRuntimeOpenTypeKeys.clear()
}

export function getRuntimeOpenTypeTextGeometryStats(): {
  entries: number
  buildCount: number
} {
  return {
    entries: runtimeOpenTypeTextCache.size,
    buildCount: runtimeGeometryBuildCount,
  }
}
