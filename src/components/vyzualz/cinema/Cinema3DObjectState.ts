import {
  isCinemaJsonValue,
  type CinemaAssetReference,
  type CinemaColor,
  type CinemaParameterDefinition,
  type CinemaParameterValues,
  type CinemaVector3,
} from './CinemaDomain'
import { cinemaStableId, type CinemaEnumOptionId, type CinemaParameterId } from './CinemaIdentifiers'
import { normalizeCinemaParameterValue } from './CinemaParameterSchema'
import type { CinemaQualityTier } from './CinemaNodeRegistry'

export type Cinema3DObjectSourceType = 'text' | 'svg'
export type Cinema3DObjectGeometryQuality = 'draft' | 'balanced' | 'high'
export type Cinema3DObjectPivotPolicy = 'center' | 'source-origin'
export type Cinema3DObjectInvalidation = 'none' | 'material' | 'transform' | 'geometry' | 'source'

export interface Cinema3DTextSourceDefinition {
  type: 'text'
  text: string
  fontIdentity: string
  font: CinemaAssetReference | null
}

export interface Cinema3DSvgSourceDefinition {
  type: 'svg'
  asset: CinemaAssetReference | null
}

export type Cinema3DObjectSourceDefinition = Cinema3DTextSourceDefinition | Cinema3DSvgSourceDefinition

export interface Cinema3DObjectDefinition {
  source: Cinema3DObjectSourceDefinition
  geometry: {
    quality: Cinema3DObjectGeometryQuality
    extrusionDepth: number
    pivotPolicy: Cinema3DObjectPivotPolicy
  }
  transform: {
    position: CinemaVector3
    rotation: CinemaVector3
    scale: CinemaVector3
  }
  appearance: {
    frontColor: CinemaColor
    sideColor: CinemaColor
    emissiveIntensity: number
  }
}

export const CINEMA_3D_OBJECT_PARAMETER_IDS = Object.freeze({
  sourceType: cinemaStableId<CinemaParameterId>('source-type', '3D object parameter'),
  text: cinemaStableId<CinemaParameterId>('text', '3D object parameter'),
  fontIdentity: cinemaStableId<CinemaParameterId>('font-identity', '3D object parameter'),
  font: cinemaStableId<CinemaParameterId>('font', '3D object parameter'),
  svgAsset: cinemaStableId<CinemaParameterId>('svg-asset', '3D object parameter'),
  geometryQuality: cinemaStableId<CinemaParameterId>('geometry-quality', '3D object parameter'),
  extrusionDepth: cinemaStableId<CinemaParameterId>('extrusion-depth', '3D object parameter'),
  pivotPolicy: cinemaStableId<CinemaParameterId>('pivot-policy', '3D object parameter'),
  position: cinemaStableId<CinemaParameterId>('position', '3D object parameter'),
  rotation: cinemaStableId<CinemaParameterId>('rotation', '3D object parameter'),
  scale: cinemaStableId<CinemaParameterId>('scale', '3D object parameter'),
  frontColor: cinemaStableId<CinemaParameterId>('front-color', '3D object parameter'),
  sideColor: cinemaStableId<CinemaParameterId>('side-color', '3D object parameter'),
  emissiveIntensity: cinemaStableId<CinemaParameterId>('emissive-intensity', '3D object parameter'),
} as const)

const SOURCE_TEXT = cinemaStableId<CinemaEnumOptionId>('text', '3D object source option')
const SOURCE_SVG = cinemaStableId<CinemaEnumOptionId>('svg', '3D object source option')
const QUALITY_DRAFT = cinemaStableId<CinemaEnumOptionId>('draft', '3D object quality option')
const QUALITY_BALANCED = cinemaStableId<CinemaEnumOptionId>('balanced', '3D object quality option')
const QUALITY_HIGH = cinemaStableId<CinemaEnumOptionId>('high', '3D object quality option')
const PIVOT_CENTER = cinemaStableId<CinemaEnumOptionId>('center', '3D object pivot option')
const PIVOT_SOURCE = cinemaStableId<CinemaEnumOptionId>('source-origin', '3D object pivot option')

export const CINEMA_3D_OBJECT_PARAMETER_SCHEMAS: readonly CinemaParameterDefinition[] = deepFreeze([
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.sourceType,
    label: 'Source Type',
    group: 'Source',
    type: 'enum',
    default: SOURCE_TEXT,
    options: [{ id: SOURCE_TEXT, label: 'Text' }, { id: SOURCE_SVG, label: 'SVG' }],
    modulatable: false,
    ui: { control: 'select', order: 0 },
  },
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.text,
    label: 'Text',
    group: 'Source',
    type: 'string',
    default: '',
    maxLength: 2048,
    modulatable: false,
    ui: { control: 'text', order: 1 },
  },
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.fontIdentity,
    label: 'Font Identity',
    group: 'Source',
    type: 'string',
    default: '',
    maxLength: 512,
    modulatable: false,
    ui: { control: 'text', order: 2 },
  },
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.font,
    label: 'Font',
    group: 'Source',
    type: 'asset-reference',
    default: null,
    acceptedRoles: ['font'],
    modulatable: false,
    ui: { control: 'asset-picker', order: 2 },
  },
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.svgAsset,
    label: 'SVG Source',
    group: 'Source',
    type: 'asset-reference',
    default: null,
    acceptedRoles: ['logo', 'image'],
    modulatable: false,
    ui: { control: 'asset-picker', order: 2 },
  },
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.geometryQuality,
    label: 'Geometry Quality',
    group: 'Geometry',
    type: 'enum',
    default: QUALITY_BALANCED,
    options: [
      { id: QUALITY_DRAFT, label: 'Draft' },
      { id: QUALITY_BALANCED, label: 'Balanced' },
      { id: QUALITY_HIGH, label: 'High' },
    ],
    modulatable: false,
    ui: { control: 'select', order: 10 },
  },
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth,
    label: 'Extrusion Depth',
    group: 'Geometry',
    type: 'float',
    default: 0.35,
    min: 0.01,
    max: 8,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', precision: 2, order: 11 },
  },
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.pivotPolicy,
    label: 'Pivot',
    group: 'Geometry',
    type: 'enum',
    default: PIVOT_CENTER,
    options: [{ id: PIVOT_CENTER, label: 'Center' }, { id: PIVOT_SOURCE, label: 'Source Origin' }],
    modulatable: false,
    ui: { control: 'select', order: 12 },
  },
  vectorParameter(CINEMA_3D_OBJECT_PARAMETER_IDS.position, 'Position', 'Transform', [0, 0, 0], [-100, -100, -100], [100, 100, 100], true, 20),
  vectorParameter(CINEMA_3D_OBJECT_PARAMETER_IDS.rotation, 'Rotation', 'Transform', [0, 0, 0], [-1000, -1000, -1000], [1000, 1000, 1000], true, 21),
  vectorParameter(CINEMA_3D_OBJECT_PARAMETER_IDS.scale, 'Scale', 'Transform', [1, 1, 1], [-100, -100, -100], [100, 100, 100], true, 22),
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.frontColor,
    label: 'Front Color',
    group: 'Appearance',
    type: 'color',
    default: [1, 1, 1, 1],
    modulatable: true,
    ui: { control: 'color', order: 30 },
  },
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.sideColor,
    label: 'Side Color',
    group: 'Appearance',
    type: 'color',
    default: [0.42, 0.46, 0.52, 1],
    modulatable: true,
    ui: { control: 'color', order: 31 },
  },
  {
    id: CINEMA_3D_OBJECT_PARAMETER_IDS.emissiveIntensity,
    label: 'Emissive Intensity',
    group: 'Appearance',
    type: 'float',
    default: 0,
    min: 0,
    max: 8,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', precision: 2, order: 32 },
  },
])

export const CINEMA_3D_OBJECT_PARAMETER_CAPABILITIES = Object.freeze([
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.sourceType, support: 'structural' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.text, support: 'structural' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.fontIdentity, support: 'structural' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.font, support: 'structural' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.svgAsset, support: 'structural' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.geometryQuality, support: 'structural' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth, support: 'live' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.pivotPolicy, support: 'live' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.position, support: 'live' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.rotation, support: 'live' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.scale, support: 'live' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.frontColor, support: 'live' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.sideColor, support: 'live' as const },
  { parameterId: CINEMA_3D_OBJECT_PARAMETER_IDS.emissiveIntensity, support: 'live' as const },
])

const SCHEMA_BY_ID = new Map(CINEMA_3D_OBJECT_PARAMETER_SCHEMAS.map(schema => [schema.id, schema] as const))

export function createDefaultCinema3DObjectDefinition(): Cinema3DObjectDefinition {
  return hydrateCinema3DObjectDefinition({})
}

export function hydrateCinema3DObjectDefinition(values: Readonly<CinemaParameterValues>): Cinema3DObjectDefinition {
  const sourceType = enumValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.sourceType) === SOURCE_SVG ? 'svg' : 'text'
  const source: Cinema3DObjectSourceDefinition = sourceType === 'svg'
    ? { type: 'svg', asset: assetValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.svgAsset) }
    : {
        type: 'text',
        text: stringValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.text),
        fontIdentity: stringValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.fontIdentity),
        font: assetValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.font),
      }
  const qualityValue = enumValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.geometryQuality)
  const pivotValue = enumValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.pivotPolicy)
  return deepFreeze({
    source,
    geometry: {
      quality: qualityValue === QUALITY_DRAFT ? 'draft' : qualityValue === QUALITY_HIGH ? 'high' : 'balanced',
      extrusionDepth: numberValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth),
      pivotPolicy: pivotValue === PIVOT_SOURCE ? 'source-origin' : 'center',
    },
    transform: {
      position: vector3Value(values, CINEMA_3D_OBJECT_PARAMETER_IDS.position),
      rotation: vector3Value(values, CINEMA_3D_OBJECT_PARAMETER_IDS.rotation),
      scale: vector3Value(values, CINEMA_3D_OBJECT_PARAMETER_IDS.scale),
    },
    appearance: {
      frontColor: opaqueColor(colorValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.frontColor)),
      sideColor: opaqueColor(colorValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.sideColor)),
      emissiveIntensity: numberValue(values, CINEMA_3D_OBJECT_PARAMETER_IDS.emissiveIntensity),
    },
  })
}

export function serializeCinema3DObjectDefinition(
  definition: Readonly<Cinema3DObjectDefinition>,
  existing: Readonly<CinemaParameterValues> = {},
): CinemaParameterValues {
  if (!isCinemaJsonValue(existing)) throw new TypeError('Cinema 3D object parameter values must remain JSON-safe.')
  const values: Record<string, unknown> = {
    [CINEMA_3D_OBJECT_PARAMETER_IDS.sourceType]: definition.source.type === 'svg' ? SOURCE_SVG : SOURCE_TEXT,
    [CINEMA_3D_OBJECT_PARAMETER_IDS.geometryQuality]: qualityOption(definition.geometry.quality),
    [CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth]: definition.geometry.extrusionDepth,
    [CINEMA_3D_OBJECT_PARAMETER_IDS.pivotPolicy]: definition.geometry.pivotPolicy === 'source-origin' ? PIVOT_SOURCE : PIVOT_CENTER,
    [CINEMA_3D_OBJECT_PARAMETER_IDS.position]: definition.transform.position,
    [CINEMA_3D_OBJECT_PARAMETER_IDS.rotation]: definition.transform.rotation,
    [CINEMA_3D_OBJECT_PARAMETER_IDS.scale]: definition.transform.scale,
    [CINEMA_3D_OBJECT_PARAMETER_IDS.frontColor]: opaqueColor(definition.appearance.frontColor),
    [CINEMA_3D_OBJECT_PARAMETER_IDS.sideColor]: opaqueColor(definition.appearance.sideColor),
    [CINEMA_3D_OBJECT_PARAMETER_IDS.emissiveIntensity]: definition.appearance.emissiveIntensity,
  }
  if (definition.source.type === 'text') {
    values[CINEMA_3D_OBJECT_PARAMETER_IDS.text] = definition.source.text
    values[CINEMA_3D_OBJECT_PARAMETER_IDS.fontIdentity] = definition.source.fontIdentity
    values[CINEMA_3D_OBJECT_PARAMETER_IDS.font] = definition.source.font
    values[CINEMA_3D_OBJECT_PARAMETER_IDS.svgAsset] = null
  } else {
    values[CINEMA_3D_OBJECT_PARAMETER_IDS.text] = ''
    values[CINEMA_3D_OBJECT_PARAMETER_IDS.fontIdentity] = ''
    values[CINEMA_3D_OBJECT_PARAMETER_IDS.font] = null
    values[CINEMA_3D_OBJECT_PARAMETER_IDS.svgAsset] = definition.source.asset
  }
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(existing)) normalized[key] = value
  for (const schema of CINEMA_3D_OBJECT_PARAMETER_SCHEMAS) {
    normalized[schema.id] = normalizeCinemaParameterValue(schema, values[schema.id]).value
  }
  return Object.freeze(normalized) as CinemaParameterValues
}

export function classifyCinema3DObjectInvalidation(
  previous: Readonly<Cinema3DObjectDefinition>,
  next: Readonly<Cinema3DObjectDefinition>,
): Cinema3DObjectInvalidation {
  if (JSON.stringify(previous.source) !== JSON.stringify(next.source)) return 'source'
  if (previous.geometry.quality !== next.geometry.quality) return 'geometry'
  if (previous.geometry.extrusionDepth !== next.geometry.extrusionDepth
    || previous.geometry.pivotPolicy !== next.geometry.pivotPolicy
    || !tupleEqual(previous.transform.position, next.transform.position)
    || !tupleEqual(previous.transform.rotation, next.transform.rotation)
    || !tupleEqual(previous.transform.scale, next.transform.scale)) return 'transform'
  if (!tupleEqual(previous.appearance.frontColor, next.appearance.frontColor)
    || !tupleEqual(previous.appearance.sideColor, next.appearance.sideColor)
    || previous.appearance.emissiveIntensity !== next.appearance.emissiveIntensity) return 'material'
  return 'none'
}

export function getCinema3DObjectTextTessellation(quality: Cinema3DObjectGeometryQuality): Readonly<{ curveTolerance: number; maxCurveDepth: number }> {
  if (quality === 'draft') return Object.freeze({ curveTolerance: 0.8, maxCurveDepth: 8 })
  if (quality === 'high') return Object.freeze({ curveTolerance: 0.15, maxCurveDepth: 16 })
  return Object.freeze({ curveTolerance: 0.35, maxCurveDepth: 12 })
}

export function getCinema3DObjectSvgCurveTolerance(quality: Cinema3DObjectGeometryQuality): number {
  if (quality === 'draft') return 4
  if (quality === 'high') return 0.75
  return 2
}

export function getCinema3DObjectSvgComplexityLimits(quality: Cinema3DObjectGeometryQuality): Readonly<{
  maxSourceCharacters: number
  maxElements: number
  maxContours: number
  maxPointsPerContour: number
  maxTotalPoints: number
  maxOutputIndices: number
  maxTraversalDepth: number
}> {
  if (quality === 'draft') return Object.freeze({ maxSourceCharacters: 131_072, maxElements: 256, maxContours: 64, maxPointsPerContour: 384, maxTotalPoints: 4_096, maxOutputIndices: 98_304, maxTraversalDepth: 24 })
  if (quality === 'high') return Object.freeze({ maxSourceCharacters: 524_288, maxElements: 512, maxContours: 128, maxPointsPerContour: 512, maxTotalPoints: 8_192, maxOutputIndices: 196_608, maxTraversalDepth: 32 })
  return Object.freeze({ maxSourceCharacters: 262_144, maxElements: 384, maxContours: 96, maxPointsPerContour: 448, maxTotalPoints: 6_144, maxOutputIndices: 147_456, maxTraversalDepth: 28 })
}

export function applyCinema3DObjectRuntimeQuality(
  values: Readonly<CinemaParameterValues>,
  runtimeTier: CinemaQualityTier | undefined,
): Readonly<CinemaParameterValues> {
  if (!runtimeTier) return values
  const definition = hydrateCinema3DObjectDefinition(values)
  const qualityRank: Readonly<Record<Cinema3DObjectGeometryQuality, number>> = { draft: 0, balanced: 1, high: 2 }
  const maximum = runtimeTier === 'low' ? 'draft' : runtimeTier === 'medium' ? 'balanced' : 'high'
  if (qualityRank[definition.geometry.quality] <= qualityRank[maximum]) return values
  return serializeCinema3DObjectDefinition({
    ...definition,
    geometry: { ...definition.geometry, quality: maximum },
  }, values)
}

export function getVisibleCinema3DObjectParameterSchemas(
  values: Readonly<CinemaParameterValues>,
): readonly CinemaParameterDefinition[] {
  const sourceType = hydrateCinema3DObjectDefinition(values).source.type
  return Object.freeze(CINEMA_3D_OBJECT_PARAMETER_SCHEMAS.filter(schema => {
    if (schema.id === CINEMA_3D_OBJECT_PARAMETER_IDS.fontIdentity) return false
    if (schema.id === CINEMA_3D_OBJECT_PARAMETER_IDS.text || schema.id === CINEMA_3D_OBJECT_PARAMETER_IDS.font) return sourceType === 'text'
    if (schema.id === CINEMA_3D_OBJECT_PARAMETER_IDS.svgAsset) return sourceType === 'svg'
    return true
  }))
}

export function filterCinema3DObjectParameterSchemasForSource(
  schemas: readonly CinemaParameterDefinition[],
  values: Readonly<CinemaParameterValues>,
): readonly CinemaParameterDefinition[] {
  const visible = new Set(getVisibleCinema3DObjectParameterSchemas(values).map(schema => schema.id))
  return Object.freeze(schemas.filter(schema => !SCHEMA_BY_ID.has(schema.id) || visible.has(schema.id)))
}

function vectorParameter(
  id: CinemaParameterId,
  label: string,
  group: string,
  defaultValue: CinemaVector3,
  min: CinemaVector3,
  max: CinemaVector3,
  modulatable: boolean,
  order = 0,
): CinemaParameterDefinition {
  return { id, label, group, type: 'vector3', default: defaultValue, min, max, step: [0.01, 0.01, 0.01], modulatable, ui: { control: 'vector', precision: 2, order } }
}

function normalizedValue(values: Readonly<CinemaParameterValues>, id: CinemaParameterId) {
  const schema = SCHEMA_BY_ID.get(id)
  if (!schema) throw new Error(`Missing Cinema 3D object parameter schema: ${id}`)
  return normalizeCinemaParameterValue(schema, values[id]).value
}

function stringValue(values: Readonly<CinemaParameterValues>, id: CinemaParameterId): string {
  const value = values[id]
  if (value === undefined) return normalizedValue({}, id) as string
  return normalizedValue(values, id) as string
}

function numberValue(values: Readonly<CinemaParameterValues>, id: CinemaParameterId): number {
  const value = values[id]
  if (value === undefined) return normalizedValue({}, id) as number
  return normalizedValue(values, id) as number
}

function enumValue(values: Readonly<CinemaParameterValues>, id: CinemaParameterId): CinemaEnumOptionId {
  const value = values[id]
  if (value === undefined) return normalizedValue({}, id) as CinemaEnumOptionId
  return normalizedValue(values, id) as CinemaEnumOptionId
}

function assetValue(values: Readonly<CinemaParameterValues>, id: CinemaParameterId): CinemaAssetReference | null {
  if (values[id] === undefined) return normalizedValue({}, id) as CinemaAssetReference | null
  return normalizedValue(values, id) as CinemaAssetReference | null
}

function vector3Value(values: Readonly<CinemaParameterValues>, id: CinemaParameterId): CinemaVector3 {
  if (values[id] === undefined) return normalizedValue({}, id) as CinemaVector3
  return normalizedValue(values, id) as CinemaVector3
}

function colorValue(values: Readonly<CinemaParameterValues>, id: CinemaParameterId): CinemaColor {
  if (values[id] === undefined) return normalizedValue({}, id) as CinemaColor
  return normalizedValue(values, id) as CinemaColor
}

function opaqueColor(color: CinemaColor): CinemaColor {
  return [color[0], color[1], color[2], 1]
}

function qualityOption(quality: Cinema3DObjectGeometryQuality): CinemaEnumOptionId {
  return quality === 'draft' ? QUALITY_DRAFT : quality === 'high' ? QUALITY_HIGH : QUALITY_BALANCED
}

function tupleEqual(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  }
  return value
}
