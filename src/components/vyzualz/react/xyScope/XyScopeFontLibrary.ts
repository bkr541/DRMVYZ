// Sound Drawing XY: resolves the selected font to outlines. The bundled default (Anton) needs no loading. A font
// from the user's library is read from the shared runtime cache, or downloaded and parsed once on demand using the
// same storage and cache the rest of the font system uses. While a library font loads, or if it fails, the word
// keeps drawing in the default font and the status says why.

import { useEffect, useState } from 'react'
import * as opentype from 'opentype.js'
import { downloadFontFile } from '../../../../lib/fontDb'
import { useReactStore } from '../../../../stores/reactStore'
import { getBufferFromCache, getFontFromCache, storeFontRuntime } from '../renderers/fontGlyphUtils'
import { createOpenTypeXyScopeFont, getDefaultXyScopeFont, type XyScopeFontSource } from './XyScopeGeometry'

export type XyScopeFontStatus = 'default' | 'loading' | 'ready' | 'missing' | 'error'

export interface XyScopeFontResolution {
  font: XyScopeFontSource
  status: XyScopeFontStatus
  error: string | null
  /** Display name of the font being drawn. */
  label: string
}

const DEFAULT_LABEL = 'Anton (default)'

export function useXyScopeFont(fontId: string | null): XyScopeFontResolution {
  const assets = useReactStore(state => state.oscillatorFontAssets)
  const fontsLoadState = useReactStore(state => state.fontsLoadState)
  const asset = fontId ? assets.find(candidate => candidate.id === fontId) ?? null : null
  const assetPath = asset?.storagePath ?? null
  const [resolved, setResolved] = useState<{ id: string; source: XyScopeFontSource } | null>(null)
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null)

  useEffect(() => {
    if (!fontId || !asset) return
    const cached = getFontFromCache(fontId)
    if (cached) {
      setResolved({ id: fontId, source: createOpenTypeXyScopeFont(cached, fontId) })
      setFailure(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        let buffer = getBufferFromCache(fontId)
        if (!buffer) {
          const { data, error } = await downloadFontFile(assetPath ?? '')
          if (error || !data) throw new Error(error ?? 'no data')
          buffer = await data.arrayBuffer()
        }
        const font = opentype.parse(buffer)
        if (cancelled) return
        storeFontRuntime(fontId, font, buffer)
        setResolved({ id: fontId, source: createOpenTypeXyScopeFont(font, fontId) })
        setFailure(null)
      } catch (error) {
        if (!cancelled) setFailure({ id: fontId, message: error instanceof Error ? error.message : String(error) })
      }
    })()
    return () => { cancelled = true }
    // The asset record, not its identity, decides when to reload.
  }, [fontId, asset?.id, assetPath]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!fontId) return { font: getDefaultXyScopeFont(), status: 'default', error: null, label: DEFAULT_LABEL }
  if (!asset) {
    // The library may still be loading; only call the font missing once it has loaded.
    const settled = fontsLoadState === 'loaded' || fontsLoadState === 'error'
    return { font: getDefaultXyScopeFont(), status: settled ? 'missing' : 'loading', error: settled ? 'This font is no longer in your library.' : null, label: DEFAULT_LABEL }
  }
  if (resolved?.id === fontId) return { font: resolved.source, status: 'ready', error: null, label: asset.name }
  if (failure?.id === fontId) return { font: getDefaultXyScopeFont(), status: 'error', error: failure.message, label: DEFAULT_LABEL }
  return { font: getDefaultXyScopeFont(), status: 'loading', error: null, label: DEFAULT_LABEL }
}
