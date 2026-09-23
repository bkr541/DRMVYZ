import type { CanvasMediaItem } from '../../ReactTypes'
import type { CanvasMediaPool } from '../../canvasPerformance/CanvasPerformanceTypes'
import type { CanvasCutbankMediaMode } from './CutbankSettings'

export type CutbankContentKind = 'image' | 'svg' | 'video' | 'text'

export interface CutbankContentItem {
  /** Stable key: `media:<id>` or `text:<id>`. Text edits keep the key. */
  key: string
  kind: CutbankContentKind
  mediaId: string | null
  text: string | null
  media: CanvasMediaItem | null
  /** Best-known width/height ratio; the renderer refines it from the decoded source. */
  aspect: number
}

export type CutbankContentStatus =
  | 'ready'
  | 'no-pool'
  | 'empty-pool'
  | 'no-available-content'

export interface CutbankContentSnapshot {
  status: CutbankContentStatus
  poolId: string | null
  poolName: string | null
  /** Every usable pool entry (media that resolved + text), pool order. */
  all: CutbankContentItem[]
  /** Entries allowed by Media Mode, or `all` when the mode had no match. */
  eligible: CutbankContentItem[]
  /** True when Media Mode matched nothing and CUTBANK fell back to all pool content. */
  modeFallback: boolean
  missingMediaIds: string[]
  /** Changes whenever membership, text, or media sources change. */
  signature: string
}

const MODE_KINDS: Record<CanvasCutbankMediaMode, readonly CutbankContentKind[] | null> = {
  mixed: null,
  images: ['image'],
  text: ['text'],
  svg: ['svg'],
  video: ['video'],
}

export function resolveCutbankContent({
  pool,
  mediaItems,
  mode,
  failedMediaIds,
}: {
  pool: CanvasMediaPool | null | undefined
  mediaItems: readonly CanvasMediaItem[]
  mode: CanvasCutbankMediaMode
  failedMediaIds?: ReadonlySet<string>
}): CutbankContentSnapshot {
  if (!pool) {
    return { status: 'no-pool', poolId: null, poolName: null, all: [], eligible: [], modeFallback: false, missingMediaIds: [], signature: 'none' }
  }
  const byId = new Map(mediaItems.map(item => [item.id, item]))
  const all: CutbankContentItem[] = []
  const missing: string[] = []
  for (const mediaId of pool.mediaIds) {
    const media = byId.get(mediaId)
    if (!media || !media.objectUrl || failedMediaIds?.has(mediaId)) {
      missing.push(mediaId)
      continue
    }
    const kind: CutbankContentKind = media.type === 'video' ? 'video' : media.type === 'svg' ? 'svg' : 'image'
    const aspect = media.width && media.height ? media.width / media.height : 16 / 9
    all.push({ key: `media:${mediaId}`, kind, mediaId, text: null, media, aspect })
  }
  for (const item of pool.textItems) {
    all.push({ key: `text:${item.id}`, kind: 'text', mediaId: null, text: item.text, media: null, aspect: 1 })
  }

  const signature = [
    pool.id,
    ...all.map(item => item.kind === 'text' ? `${item.key}=${item.text}` : `${item.key}@${item.media?.mediaRevision ?? 0}:${item.media?.objectUrl ?? ''}`),
  ].join('|')

  if (pool.mediaIds.length === 0 && pool.textItems.length === 0) {
    return { status: 'empty-pool', poolId: pool.id, poolName: pool.name, all, eligible: [], modeFallback: false, missingMediaIds: missing, signature }
  }
  if (all.length === 0) {
    return { status: 'no-available-content', poolId: pool.id, poolName: pool.name, all, eligible: [], modeFallback: false, missingMediaIds: missing, signature }
  }
  const kinds = MODE_KINDS[mode]
  const filtered = kinds ? all.filter(item => kinds.includes(item.kind)) : all
  const modeFallback = filtered.length === 0
  return {
    status: 'ready',
    poolId: pool.id,
    poolName: pool.name,
    all,
    eligible: modeFallback ? all : filtered,
    modeFallback,
    missingMediaIds: missing,
    signature,
  }
}

export function hasCutbankKind(items: readonly CutbankContentItem[], kind: CutbankContentKind): boolean {
  return items.some(item => item.kind === kind)
}
