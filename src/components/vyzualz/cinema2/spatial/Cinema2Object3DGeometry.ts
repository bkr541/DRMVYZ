import type * as opentype from 'opentype.js'
import {
  compileCinemaOpenTypeText,
  type CinemaOpenTypeTextTessellation,
} from '../../cinema/CinemaOpenTypeTextGeometry'
import {
  compileCinemaSvgVector,
  type CinemaSvgVectorOptions,
} from '../../cinema/CinemaSvgVectorGeometry'
import type { CinemaVectorCpuMesh } from '../../cinema/CinemaVectorGeometry'

export interface Cinema2CompiledObject3DGeometry {
  key: string
  mesh: Readonly<CinemaVectorCpuMesh>
}

export type Cinema2Object3DGeometryResult =
  | { ok: true; value: Readonly<Cinema2CompiledObject3DGeometry> }
  | { ok: false; error: string }

export interface Cinema2Object3DTextGeometryRequest {
  font: opentype.Font
  fontIdentity: string
  fontRevision?: string | number
  text: string
  letterSpacing?: number
  lineHeight?: number
  alignment?: 'left' | 'center' | 'right'
  tessellation?: CinemaOpenTypeTextTessellation
}

export interface Cinema2Object3DSvgGeometryRequest {
  sourceId: string
  revision: string | number
  rawSvg: string
  options?: CinemaSvgVectorOptions
}

/** Reuses the proven outline tessellator as a pure CPU mechanic, not Cinema 1 runtime state. */
export function compileCinema2Object3DTextGeometry(
  request: Readonly<Cinema2Object3DTextGeometryRequest>,
): Cinema2Object3DGeometryResult {
  const result = compileCinemaOpenTypeText({
    font: request.font,
    fontIdentity: request.fontIdentity,
    fontRevision: request.fontRevision,
    text: request.text,
    letterSpacing: request.letterSpacing,
    lineHeight: request.lineHeight,
    alignment: request.alignment,
    tessellation: request.tessellation,
  })
  if (!result.ok) return { ok: false, error: result.error.message }
  if (!result.value.mesh) return { ok: false, error: 'Cinema 2.0 text geometry produced no drawable outline mesh.' }
  return { ok: true, value: Object.freeze({ key: result.value.cacheKey, mesh: result.value.mesh }) }
}

/** Reuses the proven SVG tessellator as a pure CPU mechanic, not Cinema 1 runtime state. */
export function compileCinema2Object3DSvgGeometry(
  request: Readonly<Cinema2Object3DSvgGeometryRequest>,
): Cinema2Object3DGeometryResult {
  const result = compileCinemaSvgVector({
    assetId: request.sourceId,
    revision: request.revision,
    rawSvg: request.rawSvg,
    options: request.options,
  })
  if (!result.ok) return { ok: false, error: result.error.message }
  return { ok: true, value: Object.freeze({ key: result.value.cacheKey, mesh: result.value.mesh }) }
}
