import type { CanvasMediaItem } from '../../ReactTypes'
// Local, copyright-free default. No remote request, Media Library mutation, or uploaded asset.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="g"><stop stop-color="#00b1db"/><stop offset=".55" stop-color="#c9ffff"/><stop offset="1" stop-color="#00d8e5"/></linearGradient></defs><path fill="url(#g)" d="M210 165h82l88 110 100-110h72v210h-72V264l-100 111-98-111v111h-72zM580 165h170l-80 85h80l-168 125 46-100h-48z"/></svg>`
export const MORPH_DEFAULT_SOURCE: CanvasMediaItem = {
  id: 'morph-built-in-source', name: 'MORPH default', type: 'svg', objectUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
  mimeType: 'image/svg+xml', createdAt: '2026-01-01T00:00:00.000Z', width: 960, height: 540, hasAlpha: true,
}
export function resolveMorphPoolItem(ids: readonly string[], items: readonly CanvasMediaItem[], block: number): CanvasMediaItem | null {
  const available = ids.map(id => items.find(item => item.id === id && item.objectUrl)).filter((item): item is CanvasMediaItem => Boolean(item))
  return available.length ? available[Math.max(0, Math.floor(Number.isFinite(block) ? block : 0)) % available.length] : null
}
