import type { CanvasMediaPool } from '../../canvasPerformance'
import type { CanvasMediaItem } from '../../ReactTypes'
import type { CanvasShiftgridSettings } from './ShiftgridSettings'

export interface ShiftgridSourceSet {
  mode: 'single' | 'pool'
  poolId: string | null
  media: readonly CanvasMediaItem[]
  identity: string
}

export function isShiftgridP1ImageSource(item: CanvasMediaItem): boolean {
  if (item.type === 'svg') return true
  if (item.type !== 'image') return false
  const mime = item.mimeType?.toLowerCase() ?? ''
  if (mime) return mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/webp' || mime === 'image/svg+xml'
  return /\.(png|jpe?g|webp|svg)(?:$|[?#])/i.test(item.objectUrl) || item.objectUrl.startsWith('blob:') || item.objectUrl.startsWith('data:image/')
}

function seededUnit(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  return ((value ^ (value >>> 15)) >>> 0) / 0x100000000
}

function deterministicShuffle<T>(values: readonly T[], seed: number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(seededUnit(seed, index) * (index + 1))
    ;[result[index], result[swap]] = [result[swap]!, result[index]!]
  }
  return result
}

/**
 * Resolves IDs from the canonical active CANVAS Media Pool and active-media
 * owner. No URLs, decoded pixels, textures, or parallel library records are
 * persisted by SHIFTGRID. Pool source counts are independent of the four-layer
 * authored compositor limit.
 */
export function resolveShiftgridSourceSet({
  settings,
  activeMediaId,
  activePool,
  mediaItems,
}: {
  settings: Pick<CanvasShiftgridSettings, 'sourceMode' | 'poolSelectionMode' | 'poolSourceLimit' | 'deterministicSeed'>
  activeMediaId: string | null
  activePool: CanvasMediaPool | null
  mediaItems: readonly CanvasMediaItem[]
}): ShiftgridSourceSet {
  const byId = new Map(mediaItems.map(item => [item.id, item]))
  const activeMedia = activeMediaId ? byId.get(activeMediaId) ?? null : null
  const poolMedia = activePool
    ? Array.from(new Set(activePool.mediaIds)).flatMap(id => byId.get(id) ?? []).filter(isShiftgridP1ImageSource)
    : []
  const wantsPool = settings.sourceMode === 'pool' || (settings.sourceMode === 'auto' && poolMedia.length > 1)
  let selected = wantsPool ? poolMedia : activeMedia && isShiftgridP1ImageSource(activeMedia) ? [activeMedia] : poolMedia.slice(0, 1)
  if (wantsPool && settings.poolSelectionMode !== 'sequential') {
    const seed = settings.poolSelectionMode === 'random'
      ? settings.deterministicSeed ^ 0x51f15e
      : settings.deterministicSeed
    selected = deterministicShuffle(selected, seed)
  }
  selected = selected.slice(0, Math.min(10, settings.poolSourceLimit))
  const mode = wantsPool ? 'pool' : 'single'
  const poolId = wantsPool ? activePool?.id ?? null : null
  return Object.freeze({
    mode,
    poolId,
    media: Object.freeze(selected),
    identity: `${mode}:${poolId ?? activeMediaId ?? 'empty'}:${selected.map(item => `${item.id}@${item.mediaRevision ?? 0}`).join('|')}`,
  })
}
