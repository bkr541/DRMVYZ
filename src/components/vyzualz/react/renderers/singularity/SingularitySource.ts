import type { CanvasMediaItem } from '../../ReactTypes'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540"><g fill="#fff"><path d="M295 145H665L630 205H330Z M350 240H415L480 345L545 240H610L480 440Z M445 235H515L480 295Z"/></g></svg>`
export const SINGULARITY_DEFAULT_SOURCE: CanvasMediaItem = { id: 'singularity-built-in-source', name: 'SINGULARITY default', type: 'svg', objectUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`, mimeType: 'image/svg+xml', createdAt: '2026-01-01T00:00:00.000Z', width: 960, height: 540, hasAlpha: true }
export function resolveSingularityPoolItem(ids: readonly string[], items: readonly CanvasMediaItem[], block: number) {
  const available = ids.map(id => items.find(item => item.id === id && item.objectUrl)).filter((item): item is CanvasMediaItem => Boolean(item))
  return available.length ? available[Math.max(0, Math.floor(Number.isFinite(block) ? block : 0)) % available.length] : null
}
