import { useEffect, useState } from 'react'
import { useMediaStore, type UploadedMedia } from '../../../../stores/mediaStore'
import { createSignedMediaUrl } from '../../../../lib/mediaDb'
import { isUnifiedSvgMediaItem } from '../../../../lib/svgMediaEligibility'
import { compileXyScopeSvg, type XyScopeSvgSource } from './XyScopeSvg'

export function isXyScopeSvgUpload(item: UploadedMedia): boolean {
  return isUnifiedSvgMediaItem(item) && !item.uploading && !item.uploadError && (!item.lifecycleStatus || item.lifecycleStatus === 'complete')
}

export async function loadXyScopeSvg(item: UploadedMedia, signal: AbortSignal): Promise<XyScopeSvgSource> {
  let raw: string | null = null
  const read = async (url: string) => {
    const response = await fetch(url, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error('The SVG file could not be downloaded.')
    return response.text()
  }
  try { if (item.url) raw = await read(item.url) } catch (error) { if (signal.aborted) throw error }
  if (raw === null && item.storagePath && !signal.aborted) {
    const signed = await createSignedMediaUrl(item.storagePath)
    if (signed.url && !signal.aborted) raw = await read(signed.url)
  }
  if (signal.aborted) throw new Error('SVG selection changed.')
  if (raw === null) throw new Error('The uploaded SVG is unavailable. Check its Media Library entry and try again.')
  return compileXyScopeSvg(item.id, raw)
}

export function useXyScopeSvg(mediaId: string | null, enabled: boolean) {
  const items = useMediaStore(state => state.items)
  const loading = useMediaStore(state => state.loading)
  const item = items.find(candidate => candidate.id === mediaId && isXyScopeSvgUpload(candidate))
  const key = enabled && item ? `${item.id}:${item.url}:${item.storagePath}:${item.revision ?? ''}` : ''
  const [result, setResult] = useState<{ key: string; source: XyScopeSvgSource | null; error: string | null } | null>(null)
  useEffect(() => {
    if (!enabled || !item) return
    const controller = new AbortController()
    void loadXyScopeSvg(item, controller.signal).then(source => {
      if (!controller.signal.aborted) setResult({ key, source, error: null })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, source: null, error: error instanceof Error ? error.message : 'The SVG could not be loaded.' })
    })
    return () => controller.abort()
    // Reload for identity/content changes, not unrelated library edits.
  }, [enabled, key]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!enabled || !mediaId) return { source: null, status: 'empty' as const, error: null }
  if (!item) return { source: null, status: loading ? 'loading' as const : 'missing' as const, error: loading ? null : 'The selected SVG is no longer available in your uploads.' }
  if (result?.key !== key) return { source: null, status: 'loading' as const, error: null }
  return { source: result.source, status: result.error ? 'error' as const : 'ready' as const, error: result.error }
}
