import { AppIcon } from '../../shared/icons/AppIcon'
import { DreamVizTextInput } from './controls/DreamVizTextInput'
import { IconChipButton } from './controls/IconChipButton'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { DrawerNotice } from '../shared/DrawerNotice'
import { useReactStore } from '../../../stores/reactStore'
import { useFontPreviewPreload } from './useFontPreviewPreload'
import type { OscillatorFontAsset } from './ReactTypes'

const FONT_ROW_HEIGHT_PX = 42
const FONT_LIST_OVERSCAN = 6
const FONT_PRELOAD_AHEAD = 10

function dedupeFontAssets(assets: OscillatorFontAsset[]): OscillatorFontAsset[] {
  const seen = new Set<string>()
  const out: OscillatorFontAsset[] = []
  for (const asset of assets) {
    if (seen.has(asset.id)) continue
    seen.add(asset.id)
    out.push(asset)
  }
  return out
}

export function FontLibraryPanel() {
  const fontInputRef = useRef<HTMLInputElement>(null)
  const virtualListRef = useRef<HTMLDivElement>(null)

  const {
    oscillatorFontAssets,
    uploadOscillatorFont,
    fontUploadPending,
    fontUploadError,
    fontsLoadState,
    fontLoadError,
    removeOscillatorFontAsset,
    fontRemovePending,
    fontRemoveError,
    selectOscillatorFont,
    fontSelectPending,
    fontSelectError,
    textFontId,
  } = useReactStore(useShallow(s => ({
    oscillatorFontAssets:      s.oscillatorFontAssets,
    uploadOscillatorFont:      s.uploadOscillatorFont,
    fontUploadPending:         s.fontUploadPending,
    fontUploadError:           s.fontUploadError,
    fontsLoadState:            s.fontsLoadState,
    fontLoadError:             s.fontLoadError,
    removeOscillatorFontAsset: s.removeOscillatorFontAsset,
    fontRemovePending:         s.fontRemovePending,
    fontRemoveError:           s.fontRemoveError,
    selectOscillatorFont:      s.selectOscillatorFont,
    fontSelectPending:         s.fontSelectPending,
    fontSelectError:           s.fontSelectError,
    textFontId:                s.oscillatorSettings.textFontId,
  })))

  async function handleFontUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await uploadOscillatorFont(file)
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(260)

  const anyBusy = fontUploadPending || !!fontSelectPending || !!fontRemovePending
  const fontErrors = [
    { key: 'load', title: 'Font Library could not load', message: fontLoadError },
    { key: 'upload', title: 'Font upload failed', message: fontUploadError },
    { key: 'select', title: 'Font could not be applied', message: fontSelectError },
    { key: 'remove', title: 'Font could not be removed', message: fontRemoveError },
  ].filter((entry): entry is { key: string; title: string; message: string } => Boolean(entry.message))
  const searchLower = searchQuery.toLowerCase()
  const filteredAssets = useMemo(() => (
    searchQuery.length > 0
      ? oscillatorFontAssets.filter(a => a.name.toLowerCase().includes(searchLower))
      : oscillatorFontAssets
  ), [oscillatorFontAssets, searchLower, searchQuery.length])

  const totalRows = filteredAssets.length
  const visibleStart = Math.max(0, Math.floor(scrollTop / FONT_ROW_HEIGHT_PX) - FONT_LIST_OVERSCAN)
  const visibleEnd = Math.min(totalRows, Math.ceil((scrollTop + viewportH) / FONT_ROW_HEIGHT_PX) + FONT_LIST_OVERSCAN)
  const visibleAssets = filteredAssets.slice(visibleStart, visibleEnd)
  const selectedFontAsset = textFontId ? oscillatorFontAssets.find(asset => asset.id === textFontId) : undefined

  const previewAssets = useMemo(() => {
    const preloadEnd = Math.min(totalRows, visibleEnd + FONT_PRELOAD_AHEAD)
    const candidates = filteredAssets.slice(visibleStart, preloadEnd)
    if (selectedFontAsset) candidates.push(selectedFontAsset)
    return dedupeFontAssets(candidates)
  }, [filteredAssets, selectedFontAsset, totalRows, visibleEnd, visibleStart])

  const previewStatus = useFontPreviewPreload(previewAssets)

  useEffect(() => {
    setScrollTop(0)
    virtualListRef.current?.scrollTo({ top: 0 })
  }, [searchQuery])

  useEffect(() => {
    const node = virtualListRef.current
    if (!node) return
    const syncHeight = () => setViewportH(node.clientHeight || 260)
    syncHeight()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(syncHeight)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="vz-panel rv-font-library-panel">
      <div className="vz-panel-header">
        <AppIcon kind="font" size="14" style={{ flexShrink: 0, opacity: 0.7 }} />
        <span className="vz-panel-title">Font Library</span>
        <input ref={fontInputRef} type="file" accept=".ttf,.otf,font/ttf,font/otf" style={{ display: 'none' }} onChange={handleFontUpload} />
        <IconChipButton
          tone="primary"
          disabled={anyBusy || fontsLoadState === 'loading'}
          onClick={() => fontInputRef.current?.click()}
          icon={<AppIcon kind="plus" size="10" />}
        >
          {fontUploadPending ? 'Uploading…' : 'Import'}
        </IconChipButton>
      </div>

      <div className="vz-md-search-row">
        <div className="vz-md-search-wrap">
          <AppIcon kind="search" className="vz-md-search-icon" size="12" />
          <DreamVizTextInput className="vz-md-search-input" type="text" aria-label="Search fonts" placeholder="Search fonts…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchQuery.length > 0 && <button className="vz-md-search-clear" onClick={() => setSearchQuery('')} title="Clear search" aria-label="Clear font search">✕</button>}
        </div>
      </div>

      <div className="rv-font-library-body">
        <div className="rv-font-preview-input-wrap">
          <DreamVizTextInput className="rv-font-preview-input" type="text" aria-label="Font preview text" placeholder="Preview text…" value={previewText} onChange={e => setPreviewText(e.target.value)} />
        </div>

        {fontErrors.map(entry => (
          <DrawerNotice key={entry.key} tone="error" role="alert" title={entry.title}>{entry.message}</DrawerNotice>
        ))}
        {fontsLoadState === 'loading' && <div className="rv-ctrl-info" style={{ margin: '0 10px' }}>Loading font library…</div>}
        {oscillatorFontAssets.length === 0 && fontsLoadState !== 'loading' && <div className="rv-ctrl-info" style={{ margin: '0 10px' }}>No fonts uploaded yet.</div>}
        {oscillatorFontAssets.length > 0 && filteredAssets.length === 0 && <div className="rv-ctrl-info" style={{ margin: '0 10px' }}>No fonts match &ldquo;{searchQuery}&rdquo;</div>}

        {filteredAssets.length > 0 && (
          <div ref={virtualListRef} className="rv-glyph-list rv-font-list-virtual" onScroll={e => setScrollTop(e.currentTarget.scrollTop)} style={{ margin: '0 10px' }}>
            <div className="rv-font-list-virtual-spacer" style={{ height: `${totalRows * FONT_ROW_HEIGHT_PX}px` }}>
              {visibleAssets.map((asset: OscillatorFontAsset, offset) => {
                const absoluteIndex = visibleStart + offset
                const isActive = textFontId === asset.id
                const isSelecting = fontSelectPending === asset.id
                const isDeleting = fontRemovePending === asset.id
                const preview = previewStatus[asset.id] ?? 'idle'
                const previewReady = preview === 'ready'
                const previewLoading = preview === 'loading' || preview === 'idle'
                return (
                  <div
                    key={asset.id}
                    className={`rv-glyph-item rv-font-list-virtual-row${isActive ? ' rv-glyph-item--active' : ''}`}
                    onClick={async () => { if (!anyBusy) await selectOscillatorFont(asset.id) }}
                    role="button"
                    tabIndex={0}
                    aria-disabled={anyBusy}
                    style={{ top: `${absoluteIndex * FONT_ROW_HEIGHT_PX}px`, opacity: isDeleting ? 0.5 : previewLoading && !isActive ? 0.55 : undefined, cursor: anyBusy ? 'default' : undefined }}
                    onKeyDown={async e => { if (!anyBusy && (e.key === 'Enter' || e.key === ' ')) await selectOscillatorFont(asset.id) }}
                  >
                    <span className="rv-glyph-item-name" title={asset.fileName} style={previewReady ? { fontFamily: `"drmvyz-preview-${asset.id}", sans-serif` } : undefined}>
                      {isSelecting ? 'Loading…' : isDeleting ? 'Removing…' : (previewText.trim() || asset.name)}
                    </span>
                    <button type="button" className="rv-glyph-item-del" title="Remove font" disabled={anyBusy} onClick={async e => { e.stopPropagation(); await removeOscillatorFontAsset(asset.id) }}>
                      <AppIcon kind="delete" size={12} color="currentColor" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
