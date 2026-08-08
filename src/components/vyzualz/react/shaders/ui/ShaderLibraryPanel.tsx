import { DreamVizTextInput } from '../../controls/DreamVizTextInput'
import React, { useCallback, useRef, useState } from 'react'
import { useShaderLibraryStore } from '../library/ShaderLibraryStore'
import { ShaderLibrary, type ShaderLibraryEntry } from '../library/ShaderLibrary'
import { ShaderImportExport } from '../library/ShaderImportExport'
import { useShaderPanelStore } from './shaderPanelStore'
import { shaderRegistry } from '../registry'
import { SelectRow, ToggleRow } from '../../ReactControlRows'
import type { ShaderCategory } from '../registry/shaderRegistryTypes'
import type { QualityTierWithAuto } from '../performance/shaderPerformanceTypes'
import { ShaderSceneThumbnail } from './ShaderSceneThumbnail'
import { resolveShaderSceneProvenance } from './ShaderSceneProvenance'
import { DropdownSelect } from '../../../../shared/Dropdown/Dropdown'

// ── Tab types ─────────────────────────────────────────────────────────────────

type LibraryTab = 'scenes' | 'favorites' | 'recent' | 'collections'

// ── Quality options ───────────────────────────────────────────────────────────

const QUALITY_OPTIONS: { value: QualityTierWithAuto; label: string }[] = [
  { value: 'auto',   label: 'Auto' },
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'ultra',  label: 'Ultra' },
]

// ── SceneCard ─────────────────────────────────────────────────────────────────

function SceneCard({
  entry,
  isActive,
  isModified,
  onActivate,
  onFavorite,
  onDuplicate,
  onDelete,
  onExport,
  onRename,
}: {
  entry:       ShaderLibraryEntry
  isActive:    boolean
  isModified:  boolean
  onActivate:  (id: string) => void
  onFavorite:  (id: string) => void
  onDuplicate: (id: string) => void
  onDelete:    (id: string) => void
  onExport:    (id: string) => void
  onRename:    (id: string, name: string) => void
}) {
  const def            = entry.definition
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState(def.name)

  function submitRename() {
    if (nameInput.trim()) onRename(def.id, nameInput.trim())
    setRenaming(false)
  }

  return (
    <div
      className={`rv-shader-scene-card${isActive ? ' rv-shader-scene-card--active' : ''}`}
      onClick={() => onActivate(def.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onActivate(def.id) }}
      aria-pressed={isActive}
    >
      {/* Thumbnail */}
      <ShaderSceneThumbnail definition={def} />

      {/* Info */}
      <div className="rv-shader-scene-card-body">
        {renaming ? (
          <DreamVizTextInput
            type="text"
            className="rv-ctrl-text-input rv-shader-scene-rename"
            value={nameInput}
            aria-label="Scene name"
            autoFocus
            onChange={e => setNameInput(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(false) }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div className="rv-shader-scene-name">{def.name}</div>
        )}
        <div className="rv-shader-scene-meta">
          <span className="rv-shader-scene-category">{def.category}</span>
          {entry.bundled && <span className="rv-shader-scene-badge">bundled</span>}
          {entry.favorite && <span className="rv-shader-scene-badge rv-shader-scene-badge--fav">★</span>}
          {isActive && isModified && <span className="rv-shader-scene-badge">Modified from preset</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="rv-shader-scene-actions" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className={`rv-shader-scene-action${entry.favorite ? ' rv-shader-scene-action--active' : ''}`}
          onClick={() => onFavorite(def.id)}
          title={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-label="Toggle favorite"
        >
          ★
        </button>
        <button
          type="button"
          className="rv-shader-scene-action"
          onClick={() => onDuplicate(def.id)}
          title="Duplicate scene"
          aria-label="Duplicate"
        >
          ⧉
        </button>
        <button
          type="button"
          className="rv-shader-scene-action"
          onClick={() => onExport(def.id)}
          title="Export scene as JSON"
          aria-label="Export"
        >
          ↓
        </button>
        {!entry.bundled && (
          <>
            <button
              type="button"
              className="rv-shader-scene-action"
              onClick={() => setRenaming(true)}
              title="Rename scene"
              aria-label="Rename"
            >
              ✎
            </button>
            <button
              type="button"
              className="rv-shader-scene-action rv-shader-scene-action--danger"
              onClick={() => onDelete(def.id)}
              title="Delete scene"
              aria-label="Delete"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── ShaderLibraryPanel ────────────────────────────────────────────────────────

export function ShaderLibraryPanel() {
  const store          = useShaderLibraryStore()
  // Narrow selector: only activeShaderId and its setter (stable actions never change)
  const activeShaderId  = useShaderPanelStore(s => s.activeShaderId)
  const activeParamValues = useShaderPanelStore(s => s.paramValues)
  const setActiveShaderId = useShaderPanelStore(s => s.setActiveShaderId)
  const [tab,     setTab]     = useState<LibraryTab>('scenes')
  const [query,   setQuery]   = useState('')
  const [catFilter, setCatFilter] = useState<ShaderCategory | ''>('')
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Build the library view object
  const lib = new ShaderLibrary(
    store.getUserSceneMap(),
    store.getFavoritesSet(),
    store.getCollectionsMap(),
    store.recentlyUsed,
    store.getThumbnailsSet(),
  )

  // Get entries for the current tab
  function getEntries(): ShaderLibraryEntry[] {
    const opts = {
      query:       query || undefined,
      category:    (catFilter as ShaderCategory) || undefined,
    }
    switch (tab) {
      case 'scenes':      return lib.getAll(opts)
      case 'favorites':   return lib.getAll({ ...opts, favoritesOnly: true })
      case 'recent':      return lib.getRecentlyUsed(30).filter(e => {
        if (query && !e.definition.name.toLowerCase().includes(query.toLowerCase())) return false
        if (catFilter && e.definition.category !== catFilter) return false
        return true
      })
      case 'collections': return lib.getAll(opts)
      default:            return []
    }
  }

  const entries = getEntries()

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleActivate(id: string) {
    setActiveShaderId(id)
    store.markUsed(id)
  }

  function handleFavorite(id: string) {
    store.toggleFavorite(id)
  }

  function handleDuplicate(id: string) {
    const result = store.duplicateScene(id)
    if (!result.ok) {
      setImportError(result.error)
    }
  }

  function handleDelete(id: string) {
    store.deleteUserScene(id)
    if (activeShaderId === id) {
      setActiveShaderId(null)
    }
  }

  function handleExport(id: string) {
    const def = shaderRegistry.get(id) ?? store.getUserSceneMap().get(id)
    if (!def) return
    ShaderImportExport.downloadPackage(def, {
      presets: store.getPresetsForScene(id).map(p => ({ name: p.name, values: p.values })),
    })
  }

  function handleRename(id: string, name: string) {
    store.renameUserScene(id, name)
  }

  const handleImportClick = useCallback(() => {
    setImportError(null)
    fileInputRef.current?.click()
  }, [])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const existingIds = new Set([
      ...Array.from(store.getUserSceneMap().keys()),
    ])
    const result = await ShaderImportExport.importFile(file, existingIds)

    if (!result.ok) {
      setImportError(result.errors.join('; '))
      return
    }

    const addResult = store.addUserScene(result.package.definition)
    if (!addResult.ok) {
      setImportError(addResult.error)
    } else {
      setImportError(null)
    }
  }

  // ── Categories list ────────────────────────────────────────────────────────

  const categories = lib.getCategories()

  return (
    <div className="rv-shader-library-panel">
      {/* ── Quality setting ── */}
      <div className="rv-shader-library-quality">
        <SelectRow
          label="Quality"
          value={store.qualityPreference}
          onChange={v => store.setQualityPreference(v as QualityTierWithAuto)}
          options={QUALITY_OPTIONS}
        />
      </div>

      {/* ── Search ── */}
      <div className="rv-shader-library-search">
        <DreamVizTextInput
          type="search"
          className="rv-ctrl-text-input rv-shader-library-search-input"
          aria-label="Search shader scenes"
          placeholder="Search scenes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <DropdownSelect
          className="rv-ctrl-select rv-shader-library-cat"
          value={catFilter}
          onChange={e => setCatFilter(e.target.value as ShaderCategory | '')}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </DropdownSelect>
      </div>

      {/* ── Tabs ── */}
      <div className="rv-shader-library-tabs">
        {(['scenes', 'favorites', 'recent', 'collections'] as LibraryTab[]).map(t => (
          <button
            key={t}
            type="button"
            className={`rv-shader-library-tab${tab === t ? ' rv-shader-library-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Import error ── */}
      {importError && (
        <div className="rv-osc-status-warn rv-shader-library-import-error">
          Import failed: {importError}
          <button type="button" onClick={() => setImportError(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* ── Scene list ── */}
      <div className="rv-shader-library-list">
        {entries.length === 0 ? (
          <div className="rv-ctrl-info">
            {tab === 'favorites' ? 'No favorites yet. Click ★ on any scene.' :
             tab === 'recent'    ? 'No recently used scenes.' :
             query               ? `No scenes match "${query}".` :
                                   'No scenes in the library.'}
          </div>
        ) : (
          entries.map(entry => (
            <SceneCard
              key={entry.definition.id}
              entry={entry}
              isActive={activeShaderId === entry.definition.id}
              isModified={activeShaderId === entry.definition.id
                && resolveShaderSceneProvenance(entry.definition, activeParamValues).status === 'modified'}
              onActivate={handleActivate}
              onFavorite={handleFavorite}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onExport={handleExport}
              onRename={handleRename}
            />
          ))
        )}
      </div>

      {/* ── Import button ── */}
      <div className="rv-shader-library-footer">
        <button
          type="button"
          className="rv-shader-editor-btn"
          onClick={handleImportClick}
          title="Import a .json shader package file"
        >
          Import Scene
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
      </div>
    </div>
  )
}
