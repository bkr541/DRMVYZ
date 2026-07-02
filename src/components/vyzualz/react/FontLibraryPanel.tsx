import { useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Delete02Icon } from 'hugeicons-react'
import { useReactStore } from '../../../stores/reactStore'
import { useFontPreviewPreload } from './useFontPreviewPreload'
import type { OscillatorFontAsset } from './ReactTypes'

export function FontLibraryPanel() {
  const fontInputRef = useRef<HTMLInputElement>(null)

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

  const previewStatus = useFontPreviewPreload(oscillatorFontAssets)

  async function handleFontUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await uploadOscillatorFont(file)
  }

  const [searchQuery,   setSearchQuery]   = useState('')
  const [previewText,   setPreviewText]   = useState('')

  const anyBusy       = fontUploadPending || !!fontSelectPending || !!fontRemovePending
  const errs          = [fontLoadError, fontUploadError, fontSelectError, fontRemoveError].filter(Boolean)
  const searchLower   = searchQuery.toLowerCase()
  const filteredAssets = searchQuery.length > 0
    ? oscillatorFontAssets.filter(a => a.name.toLowerCase().includes(searchLower))
    : oscillatorFontAssets

  return (
    <div className="vz-panel rv-font-library-panel">
      <div className="vz-panel-header">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ flexShrink: 0, opacity: 0.7 }}>
          <path d="M9.93 13.5h4.14L12 7.98 9.93 13.5zM20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-4.05 16.5-1.14-3H9.17l-1.12 3H5.96l5.11-13h1.86l5.11 13h-2.09z"/>
        </svg>
        <span className="vz-panel-title">Font Library</span>
        <input
          ref={fontInputRef}
          type="file"
          accept=".ttf,.otf,font/ttf,font/otf"
          style={{ display: 'none' }}
          onChange={handleFontUpload}
        />
        <button
          type="button"
          className="vz-import-btn"
          disabled={anyBusy || fontsLoadState === 'loading'}
          onClick={() => fontInputRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          {fontUploadPending ? 'Uploading…' : 'Import'}
        </button>
      </div>

      <div className="vz-md-search-row">
        <div className="vz-md-search-wrap">
          <svg className="vz-md-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            className="vz-md-search-input"
            type="text"
            aria-label="Search fonts"
            placeholder="Search fonts…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery.length > 0 && (
            <button className="vz-md-search-clear" onClick={() => setSearchQuery('')} title="Clear search" aria-label="Clear font search">✕</button>
          )}
        </div>
      </div>

      <div className="rv-font-library-body">
        <div className="rv-font-preview-input-wrap">
          <input
            className="rv-font-preview-input"
            type="text"
            aria-label="Font preview text"
            placeholder="Preview text…"
            value={previewText}
            onChange={e => setPreviewText(e.target.value)}
          />
        </div>

        {errs.length > 0 && (
          <div className="rv-osc-status-warn" style={{ margin: '0 10px 6px' }}>
            {errs.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}

        {fontsLoadState === 'loading' && (
          <div className="rv-ctrl-info" style={{ margin: '0 10px' }}>Loading font library…</div>
        )}

        {oscillatorFontAssets.length === 0 && fontsLoadState !== 'loading' && (
          <div className="rv-ctrl-info" style={{ margin: '0 10px' }}>
            No fonts uploaded yet.
          </div>
        )}

        {oscillatorFontAssets.length > 0 && filteredAssets.length === 0 && (
          <div className="rv-ctrl-info" style={{ margin: '0 10px' }}>
            No fonts match &ldquo;{searchQuery}&rdquo;
          </div>
        )}

        {filteredAssets.length > 0 && (
          <div className="rv-glyph-list" style={{ margin: '0 10px' }}>
            {filteredAssets.map((asset: OscillatorFontAsset) => {
              const isActive    = textFontId === asset.id
              const isSelecting = fontSelectPending === asset.id
              const isDeleting  = fontRemovePending === asset.id
              const preview     = previewStatus[asset.id] ?? 'idle'
              const previewReady = preview === 'ready'
              const previewLoading = preview === 'loading' || preview === 'idle'
              return (
                <div
                  key={asset.id}
                  className={`rv-glyph-item${isActive ? ' rv-glyph-item--active' : ''}`}
                  onClick={async () => { if (!anyBusy) await selectOscillatorFont(asset.id) }}
                  role="button"
                  tabIndex={0}
                  aria-disabled={anyBusy}
                  style={{
                    opacity: isDeleting ? 0.5 : previewLoading && !isActive ? 0.55 : undefined,
                    cursor: anyBusy ? 'default' : undefined,
                  }}
                  onKeyDown={async e => { if (!anyBusy && (e.key === 'Enter' || e.key === ' ')) await selectOscillatorFont(asset.id) }}
                >
                  <span
                    className="rv-glyph-item-name"
                    title={asset.fileName}
                    style={previewReady ? { fontFamily: `"drmvyz-preview-${asset.id}", sans-serif` } : undefined}
                  >
                    {isSelecting ? 'Loading…' : isDeleting ? 'Removing…' : (previewText.trim() || asset.name)}
                  </span>
                  <button
                    type="button"
                    className="rv-glyph-item-del"
                    title="Remove font"
                    disabled={anyBusy}
                    onClick={async e => { e.stopPropagation(); await removeOscillatorFontAsset(asset.id) }}
                  >
                    <Delete02Icon size={12} color="currentColor" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
