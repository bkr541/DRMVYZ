import { useEffect, useRef, useState } from 'react'
import { downloadFontFile } from '../../../lib/fontDb'
import { getBufferFromCache, storePreviewBuffer } from './renderers/fontGlyphUtils'
import type { OscillatorFontAsset } from './ReactTypes'

export type FontPreviewStatus = 'idle' | 'loading' | 'ready' | 'error'

const PREVIEW_CONCURRENCY = 1

function registerFontFace(id: string, buffer: ArrayBuffer, registered: Set<string>): void {
  if (registered.has(id)) return
  registered.add(id)
  const face = new FontFace(`drmvyz-preview-${id}`, buffer)
  document.fonts.add(face)
  face.load().catch(() => {})
}

/**
 * Background-preloads font binaries for CSS preview without selecting any font
 * and without parsing with OpenType.js.
 *
 * Concern separation:
 *   idle    – asset exists in library, not yet downloaded
 *   loading – binary is being fetched from cloud storage
 *   ready   – FontFace registered; name renders in its own typeface
 *   error   – download or blob conversion failed; name renders in fallback typeface
 *
 * When a font is later selected for rendering, selectOscillatorFont reuses the
 * cached buffer (storePreviewBuffer wrote it to fontBufferCache) and only then
 * parses with opentype.js.
 */
export function useFontPreviewPreload(assets: OscillatorFontAsset[]): Record<string, FontPreviewStatus> {
  const [status, setStatus] = useState<Record<string, FontPreviewStatus>>({})

  // Tracks which asset IDs have been enqueued so assets aren't re-queued on re-render.
  // The Font tab passes only selected/visible-nearby rows, so this queue stays small.
  const queuedRef     = useRef<Set<string>>(new Set())
  const queueRef      = useRef<OscillatorFontAsset[]>([])
  const activeRef     = useRef(0)
  // Tracks which asset IDs have had a FontFace registered in document.fonts.
  const registeredRef = useRef<Set<string>>(new Set())
  // Set to true on unmount so in-flight async work doesn't update state.
  const mountedRef    = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const immediate: Record<string, FontPreviewStatus> = {}

    for (const asset of assets) {
      if (queuedRef.current.has(asset.id)) continue
      queuedRef.current.add(asset.id)

      const cached = getBufferFromCache(asset.id)
      if (cached) {
        // Buffer already present (e.g. font was previously selected this session).
        // Register the FontFace immediately — no download needed.
        registerFontFace(asset.id, cached, registeredRef.current)
        immediate[asset.id] = 'ready'
      } else {
        immediate[asset.id] = 'idle'
        queueRef.current.push(asset)
      }
    }

    if (Object.keys(immediate).length > 0) {
      setStatus(prev => ({ ...prev, ...immediate }))
    }

    // One small queue per mounted Font tab. It survives dependency churn from
    // scrolling, so a cancelled effect cannot strand a font in queuedRef forever.
    function launchNext() {
      if (!mountedRef.current) return
      while (activeRef.current < PREVIEW_CONCURRENCY && queueRef.current.length > 0) {
        const asset = queueRef.current.shift()
        if (!asset) return
        activeRef.current++
        setStatus(prev => ({ ...prev, [asset.id]: 'loading' }))

        downloadOne(asset).finally(() => {
          activeRef.current = Math.max(0, activeRef.current - 1)
          launchNext()
        })
      }
    }

    async function downloadOne(asset: OscillatorFontAsset): Promise<void> {
      try {
        const { data: blob, error } = await downloadFontFile(asset.storagePath)
        if (!mountedRef.current) return
        if (error || !blob) throw new Error(error ?? 'no data')

        const buffer = await blob.arrayBuffer()
        if (!mountedRef.current) return

        storePreviewBuffer(asset.id, buffer)
        registerFontFace(asset.id, buffer, registeredRef.current)

        setStatus(prev => ({ ...prev, [asset.id]: 'ready' }))
      } catch {
        if (mountedRef.current) {
          setStatus(prev => ({ ...prev, [asset.id]: 'error' }))
        }
      }
    }

    launchNext()
  // assets is the only meaningful dep — queuedRef prevents re-queueing the same IDs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets])

  return status
}
