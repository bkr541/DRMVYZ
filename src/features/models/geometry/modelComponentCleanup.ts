import { ShapeUtils, type Shape } from 'three'
import type { ModelCleanupRecipe } from '../domain/modelAssetTypes'
import type { ModelContours } from './extractContours'

export interface ModelComponent { id: string; area: number; relativeArea: number }
export interface ModelComponentCatalog { fingerprint: string; components: ModelComponent[] }
// Two independent 32-bit accumulators, deterministic across runs. Fingerprint includes the entire sampled contour set; never use mesh ordinals as persistent IDs.
function fingerprint(value: string): string {
  let a = 2166136261, b = 5381
  for (let i = 0; i < value.length; i++) { const c = value.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b, 33) ^ c }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0')
}
function shapeKey(shape: Shape): string {
  return JSON.stringify([shape.getPoints(1), ...shape.holes.map(h => h.getPoints(1))].map(r => r.map(p => [p.x, p.y])))
}
export function catalogModelComponents(contours: ModelContours): ModelComponentCatalog {
  const components = contours.shapes.map(shape => ({ id: fingerprint(shapeKey(shape)), area: Math.max(0, Math.abs(ShapeUtils.area(shape.getPoints(1))) - shape.holes.reduce((sum, hole) => sum + Math.abs(ShapeUtils.area(hole.getPoints(1))), 0)) }))
  const area = components.reduce((sum, c) => sum + c.area, 0)
  return { fingerprint: fingerprint(components.map(c => c.id).sort().join(':')), components: components.map(c => ({ ...c, relativeArea: area ? c.area / area : 0 })) }
}
/** Exact matches only; ambiguous or changed outlines are restored, never guessed by array position. */
export function resolveComponentCleanup(catalog: ModelComponentCatalog, cleanup?: ModelCleanupRecipe) {
  const ids = new Set(catalog.components.map(c => c.id))
  if (!cleanup?.excludedComponentIds.length) return { excluded: new Set<string>(), changed: false }
  const excluded = new Set(cleanup.excludedComponentIds.filter(id => ids.has(id)))
  if (ids.size !== catalog.components.length || excluded.size >= ids.size) return { excluded: new Set<string>(), changed: true }
  return { excluded, changed: cleanup.sourceTraceFingerprint !== catalog.fingerprint || excluded.size !== cleanup.excludedComponentIds.length }
}
