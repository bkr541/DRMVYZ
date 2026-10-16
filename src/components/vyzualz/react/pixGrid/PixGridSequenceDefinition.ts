import type { ReactSectionType } from '../ReactTypes'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID, samplePixGridBuiltInAsset } from './PixGridArtwork'
import {
  PIX_GRID_DECK_SCHEMA_VERSION,
  normalizePixGridDeckConfiguration,
  type PixGridDeckConfiguration,
  type PixGridDeckDefinition,
  type PixGridDeckSourceSnapshot,
  type PixGridDeckTransitionPolicy,
} from './PixGridDeckDomain'
import type { PixGridBuiltInAssetId, PixGridPaletteRole } from './PixGridTypes'

export const PIX_GRID_SEQUENCE_SCHEMA_VERSION = 1 as const
export const PIX_GRID_SEQUENCE_SOURCE_PREFIX = 'pix-grid-sequence-source:' as const

export type PixGridSequenceSource =
  | { id: string; kind: 'media'; mediaId: string; snapshot: PixGridDeckSourceSnapshot }
  | { id: string; kind: 'asset'; assetId: PixGridBuiltInAssetId; palette?: Partial<Record<PixGridPaletteRole, string>> }
  | { id: string; kind: 'generatedSvg'; svg: string; width: number; height: number; hasAlpha?: boolean }

export interface PixGridSequenceItemDefinition {
  id: string
  sourceId: string
  enabled?: boolean
  durationBeats?: number | null
  seed?: number
}

export interface PixGridSequenceDefinition {
  schemaVersion: typeof PIX_GRID_SEQUENCE_SCHEMA_VERSION
  id: string
  revision: number
  name: string
  sources: readonly PixGridSequenceSource[]
  items: readonly PixGridSequenceItemDefinition[]
  playbackOrder?: PixGridDeckConfiguration['playbackOrder']
  loop?: boolean
  defaultItemDurationBeats?: number
  sectionTimingBeats?: Partial<Record<ReactSectionType, number>>
  sectionItemAssignments?: Partial<Record<ReactSectionType, string[]>>
  sceneItemAssignments?: Record<string, string[]>
  transitionPolicy?: Partial<PixGridDeckTransitionPolicy>
  motionProfileId?: string
  sceneMotionProfileIds?: Record<string, string>
  animationSeed?: number
}

const DEFAULT_PALETTE: Record<PixGridPaletteRole, string> = {
  primary: '#36d9ff', secondary: '#39e69b', accent: '#d8b95a', highlight: '#f2feff', background: '#020608',
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function pixGridSequenceSourceMediaId(sequenceId: string, sourceId: string): string {
  return `${PIX_GRID_SEQUENCE_SOURCE_PREFIX}${stableHash(sequenceId)}:${sourceId}`
}

function sourceSnapshot(sequence: PixGridSequenceDefinition, source: PixGridSequenceSource): PixGridDeckSourceSnapshot {
  if (source.kind === 'media') return source.snapshot
  const manifest = source.kind === 'asset' ? PIX_GRID_BUILT_IN_ASSET_BY_ID.get(source.assetId) : null
  const width = source.kind === 'generatedSvg' ? source.width : manifest?.nativeSize.width ?? null
  const height = source.kind === 'generatedSvg' ? source.height : manifest?.nativeSize.height ?? null
  const identity = source.kind === 'asset' ? `${source.assetId}:${JSON.stringify(source.palette ?? {})}` : source.svg
  return {
    mediaRevision: sequence.revision,
    fingerprint: `legacy:sequence-${stableHash(`${sequence.id}:${source.id}:${identity}`)}`,
    fileName: `${source.id}.svg`, mimeType: 'image/svg+xml', width, height,
    hasAlpha: source.kind === 'generatedSvg' ? source.hasAlpha !== false : true,
    transparentBackground: '#000000',
  }
}

/** Compatibility adapter: the existing compiler/clock/compositor consume this projection unchanged. */
export function materializePixGridSequenceDeck(sequence: PixGridSequenceDefinition, presetId: string): PixGridDeckDefinition {
  const sources = new Map(sequence.sources.map(source => [source.id, source]))
  const items = sequence.items.map((item, order) => {
    const source = sources.get(item.sourceId)
    if (!source) throw new Error(`PixGrid sequence "${sequence.id}" item "${item.id}" references missing source "${item.sourceId}".`)
    return {
      id: item.id,
      mediaId: source.kind === 'media' ? source.mediaId : pixGridSequenceSourceMediaId(sequence.id, source.id),
      enabled: item.enabled !== false,
      order,
      revision: sequence.revision,
      timingOverrideBeats: item.durationBeats ?? null,
      source: sourceSnapshot(sequence, source),
    }
  })
  const itemIds = new Set(items.map(item => item.id))
  return {
    schemaVersion: PIX_GRID_DECK_SCHEMA_VERSION,
    id: `pix-grid-sequence:${sequence.id}`,
    name: sequence.name,
    revision: sequence.revision,
    generatedPresetId: presetId,
    presetCreated: true,
    items,
    configuration: normalizePixGridDeckConfiguration({
      playbackOrder: sequence.playbackOrder ?? 'forward', loop: sequence.loop ?? true,
      defaultItemDurationBeats: sequence.defaultItemDurationBeats ?? 4,
      sectionTimingBeats: sequence.sectionTimingBeats ?? {},
      sectionItemAssignments: sequence.sectionItemAssignments ?? {},
      sceneItemAssignments: sequence.sceneItemAssignments ?? {},
      transitionPolicy: sequence.transitionPolicy ?? {},
      motionProfileId: sequence.motionProfileId ?? 'balanced',
      sceneMotionProfileIds: sequence.sceneMotionProfileIds ?? {},
      reactionProfileId: 'balanced', preDropBehavior: 'hold',
    }, itemIds),
  }
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function assetSvg(source: Extract<PixGridSequenceSource, { kind: 'asset' }>): string {
  const manifest = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(source.assetId)
  if (!manifest) throw new Error(`Unknown PixGrid asset source: ${source.assetId}`)
  const width = manifest.nativeSize.width
  const height = manifest.nativeSize.height
  const palette = { ...DEFAULT_PALETTE, ...(source.palette ?? {}) }
  const cells: string[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample = samplePixGridBuiltInAsset(source.assetId, (x + 0.5) / width, (y + 0.5) / height, 0, 1)
      if (sample.alpha <= 0.02) continue
      const color = sample.color ? `rgb(${sample.color.join(',')})` : palette[sample.role]
      cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${escapeXml(color)}" fill-opacity="${Math.max(0, Math.min(1, sample.alpha)).toFixed(3)}"/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${cells.join('')}</svg>`
}

export function createPixGridSequenceSourceResolver(sequences: readonly PixGridSequenceDefinition[]) {
  const entries = new Map<string, Exclude<PixGridSequenceSource, { kind: 'media' }>>()
  for (const sequence of sequences) for (const source of sequence.sources) {
    if (source.kind !== 'media') entries.set(pixGridSequenceSourceMediaId(sequence.id, source.id), source)
  }
  return (mediaId: string): Blob | null => {
    const source = entries.get(mediaId)
    if (!source) return null
    const svg = source.kind === 'asset' ? assetSvg(source) : source.svg
    return new Blob([svg], { type: 'image/svg+xml' })
  }
}
