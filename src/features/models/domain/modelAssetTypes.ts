/** Version 1 is the durable interchange contract between generation, editing and Cinema. */
export interface ModelGeneratorRecipe {
  schemaVersion: 1
  quality?: 'draft' | 'normal' | 'high'
  engine: { name: string; version: string; threeVersion: string }
  foreground: { mode: 'alpha' | 'luminance' | 'prepared'; threshold: number; invert: boolean }
  trace: { colorMode: 'silhouette' | 'color'; threshold: number; smoothing: number; maxColors: number }
  geometry: { depth: number; bevelEnabled: boolean; bevelThickness: number; bevelSize: number; bevelSegments: number; curveSegments: number }
  materials: Array<{ region: string; color: string; metalness: number; roughness: number; opacity: number; emissive: string; emissiveIntensity?: number; clearcoat?: number; clearcoatRoughness?: number }>
  transform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number]; pivot: 'center' | 'bottom' }
  preview: { background: string; lightIntensity: number; environment: 'neutral' | 'studio'; grid?: boolean; shadows?: boolean; turntable?: boolean }
}

export interface ModelGeometryStats {
  glbBytes?: number
  materialCount?: number
  source?: { width: number; height: number; mimeType: string; byteSize: number }
  triangles: number
  vertices: number
  meshes: number
  bounds: { min: [number, number, number]; max: [number, number, number] }
}

export interface ModelAsset {
  id: string
  userId: string
  sourceMediaId: string | null
  name: string
  description: string | null
  favorite: boolean
  currentVersion: number
  status: 'draft' | 'ready' | 'deletion_pending'
  createdAt: string
  updatedAt: string
}

export interface ModelAssetVersion {
  id: string
  modelAssetId: string
  version: number
  operationId: string
  glbPath: string
  sourceSnapshotPath: string
  traceSvgPath: string
  thumbnailPath: string | null
  generatorRecipe: ModelGeneratorRecipe
  geometryStats: ModelGeometryStats
  createdAt: string
}

export interface ModelSaveOperation {
  id: string
  modelAssetId: string
  expectedVersion: number
  state: 'uploading' | 'published' | 'cleanup_pending' | 'cancelled'
  sourceExtension: 'png' | 'svg'
  hasThumbnail: boolean
  generatorRecipe: ModelGeneratorRecipe
  geometryStats: ModelGeometryStats
  createdAt: string
}

export type MediaManagerSelection = { kind: 'media' | 'track' | 'font' | 'model'; id: string }
export type ModelFailureKind = 'configuration' | 'authorization' | 'validation' | 'conflict' | 'transport' | 'cleanup_pending'
export class ModelAssetError extends Error {
  constructor(public readonly kind: ModelFailureKind, message: string, public readonly operationId?: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'ModelAssetError'
  }
}

export const MODEL_MAX_FILE_BYTES = 64 * 1024 * 1024
export const MODEL_MAX_TRIANGLES = 250_000

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Expected an object.')
  return value as Record<string, unknown>
}
export function invalid(message: string): never { throw new ModelAssetError('validation', message) }
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) invalid('Invalid model UUID.')
  return value
}
export function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) invalid('Invalid model text.')
  return value
}
function number(value: unknown, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) invalid('Invalid model numeric value.')
  return value
}
export function versionNumber(value: unknown, min = 0): number { return number(value, min, 2_147_483_646, true) }
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') invalid('Invalid model boolean.'); return value }
function choice<T extends string>(value: unknown, options: readonly T[]): T {
  if (typeof value !== 'string' || !options.includes(value as T)) invalid('Unknown model option.')
  return value as T
}
function color(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) invalid('Invalid model color.')
  return value
}
function vector(value: unknown, min = -1e6, max = 1e6): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) invalid('Invalid model vector.')
  return [number(value[0], min, max), number(value[1], min, max), number(value[2], min, max)]
}
function timestamp(value: unknown): string {
  const result = text(value, 50)
  if (!Number.isFinite(Date.parse(result))) invalid('Invalid model timestamp.')
  return result
}

export function parseModelRecipe(value: unknown): ModelGeneratorRecipe {
  const v = record(value)
  if (v.schemaVersion !== 1) invalid('Unsupported model recipe version.')
  const engine = record(v.engine), foreground = record(v.foreground), trace = record(v.trace)
  const geometry = record(v.geometry), transform = record(v.transform), preview = record(v.preview)
  if (!Array.isArray(v.materials) || !v.materials.length || v.materials.length > 64) invalid('Invalid model material regions.')
  const materials = v.materials.map(value => {
    const m = record(value)
    return { region: text(m.region, 80), color: color(m.color), metalness: number(m.metalness, 0, 1), roughness: number(m.roughness, 0, 1), opacity: number(m.opacity, 0, 1), emissive: color(m.emissive),
      ...(m.emissiveIntensity === undefined ? {} : { emissiveIntensity: number(m.emissiveIntensity, 0, 20) }),
      ...(m.clearcoat === undefined ? {} : { clearcoat: number(m.clearcoat, 0, 1) }),
      ...(m.clearcoatRoughness === undefined ? {} : { clearcoatRoughness: number(m.clearcoatRoughness, 0, 1) }),
    }
  })
  if (new Set(materials.map(m => m.region)).size !== materials.length) invalid('Duplicate model material region.')
  return {
    schemaVersion: 1,
    ...(v.quality === undefined ? {} : { quality: choice(v.quality, ['draft', 'normal', 'high'] as const) }),
    engine: { name: text(engine.name), version: text(engine.version), threeVersion: text(engine.threeVersion) },
    foreground: { mode: choice(foreground.mode, ['alpha', 'luminance', 'prepared']), threshold: number(foreground.threshold, 0, 1), invert: boolean(foreground.invert) },
    trace: { colorMode: choice(trace.colorMode, ['silhouette', 'color']), threshold: number(trace.threshold, 0, 1), smoothing: number(trace.smoothing, 0, 1), maxColors: number(trace.maxColors, 1, 64, true) },
    geometry: { depth: number(geometry.depth, 0.0001, 1000), bevelEnabled: boolean(geometry.bevelEnabled), bevelThickness: number(geometry.bevelThickness, 0, 1000), bevelSize: number(geometry.bevelSize, 0, 1000), bevelSegments: number(geometry.bevelSegments, 0, 16, true), curveSegments: number(geometry.curveSegments, 1, 64, true) },
    materials,
    transform: { position: vector(transform.position), rotation: vector(transform.rotation), scale: vector(transform.scale, 0.0001, 1000), pivot: choice(transform.pivot, ['center', 'bottom']) },
    preview: { background: color(preview.background), lightIntensity: number(preview.lightIntensity, 0, 100), environment: choice(preview.environment, ['neutral', 'studio']),
      ...(preview.grid === undefined ? {} : { grid: boolean(preview.grid) }),
      ...(preview.shadows === undefined ? {} : { shadows: boolean(preview.shadows) }),
      ...(preview.turntable === undefined ? {} : { turntable: boolean(preview.turntable) }),
    },
  }
}

export function parseModelGeometryStats(value: unknown): ModelGeometryStats {
  const v = record(value), bounds = record(v.bounds)
  const min = vector(bounds.min), max = vector(bounds.max)
  if (min.some((n, i) => n > max[i])) invalid('Inverted model bounds.')
  const source = v.source === undefined ? undefined : record(v.source)
  return {
    ...(v.glbBytes === undefined ? {} : { glbBytes: number(v.glbBytes, 1, MODEL_MAX_FILE_BYTES, true) }),
    ...(v.materialCount === undefined ? {} : { materialCount: number(v.materialCount, 1, 128, true) }),
    ...(source ? { source: { width: number(source.width, 0, 1e6), height: number(source.height, 0, 1e6), mimeType: choice(source.mimeType, ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp']), byteSize: number(source.byteSize, 1, MODEL_MAX_FILE_BYTES, true) } } : {}),
    triangles: number(v.triangles, 1, MODEL_MAX_TRIANGLES, true), vertices: number(v.vertices, 3, 1_000_000, true), meshes: number(v.meshes, 1, 1024, true), bounds: { min, max } }
}

export function parseModelAsset(value: unknown): ModelAsset {
  const v = record(value)
  return { id: uuid(v.id), userId: uuid(v.user_id), sourceMediaId: v.source_media_id === null ? null : uuid(v.source_media_id), name: text(v.name), description: v.description === null ? null : text(v.description, 4000), favorite: boolean(v.favorite), currentVersion: versionNumber(v.current_version), status: choice(v.status, ['draft', 'ready', 'deletion_pending']), createdAt: timestamp(v.created_at), updatedAt: timestamp(v.updated_at) }
}

export function modelStoragePaths(userId: string, modelId: string, version: number, operationId: string, sourceExtension: 'png' | 'svg', hasThumbnail: boolean) {
  const root = `${uuid(userId)}/${uuid(modelId)}/${versionNumber(version, 1)}/${uuid(operationId)}`
  choice(sourceExtension, ['png', 'svg'])
  return { glbPath: `${root}/model.glb`, sourceSnapshotPath: `${root}/source.${sourceExtension}`, traceSvgPath: `${root}/trace.svg`, thumbnailPath: hasThumbnail ? `${root}/thumbnail.png` : null }
}

export function assertOwnedModelPath(path: string, userId: string, modelId: string): void {
  const prefix = `${uuid(userId)}/${uuid(modelId)}/`
  if (!path.startsWith(prefix) || !/^[0-9a-f-]+\/[0-9a-f-]+\/[1-9][0-9]*\/[0-9a-f-]+\/(model\.glb|source\.(png|svg)|trace\.svg|thumbnail\.png)$/.test(path)) invalid('Invalid or foreign model storage path.')
  const parts = path.split('/')
  uuid(parts[3]); versionNumber(Number(parts[2]), 1)
}

export function parseModelVersion(value: unknown, userId: string): ModelAssetVersion {
  const v = record(value)
  const modelAssetId = uuid(v.model_asset_id), operationId = uuid(v.operation_id), version = versionNumber(v.version, 1)
  const glbPath = text(v.glb_path, 300), sourceSnapshotPath = text(v.source_snapshot_path, 300), traceSvgPath = text(v.trace_svg_path, 300)
  const thumbnailPath = v.thumbnail_path === null ? null : text(v.thumbnail_path, 300)
  const paths = modelStoragePaths(userId, modelAssetId, version, operationId, sourceSnapshotPath.endsWith('.svg') ? 'svg' : 'png', thumbnailPath !== null)
  if (glbPath !== paths.glbPath || sourceSnapshotPath !== paths.sourceSnapshotPath || traceSvgPath !== paths.traceSvgPath || thumbnailPath !== paths.thumbnailPath) invalid('Model version paths do not match its identity.')
  return { id: uuid(v.id), modelAssetId, operationId, version, ...paths, generatorRecipe: parseModelRecipe(v.generator_recipe), geometryStats: parseModelGeometryStats(v.geometry_stats), createdAt: timestamp(v.created_at) }
}

export function parseModelOperation(value: unknown): ModelSaveOperation {
  const v = record(value)
  return { id: uuid(v.id), modelAssetId: uuid(v.model_asset_id), expectedVersion: versionNumber(v.expected_version), state: choice(v.state, ['uploading', 'published', 'cleanup_pending', 'cancelled']), sourceExtension: choice(v.source_extension, ['png', 'svg']), hasThumbnail: boolean(v.has_thumbnail), generatorRecipe: parseModelRecipe(v.generator_recipe), geometryStats: parseModelGeometryStats(v.geometry_stats), createdAt: timestamp(v.created_at) }
}
