import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { getProfile } from '../../../lib/profileDb'
import { createSignedMediaUrl } from '../../../lib/mediaDb'
import { useMediaStore } from '../../../stores/mediaStore'
import type {
  BrandKit,
  BrandPaletteAnalysis,
  BrandPaletteCandidateId,
} from '../BrandKitTypes'
import { BRAND_PALETTE_CANDIDATE_IDS } from '../BrandKitTypes'
import { DEFAULT_BRAND_PALETTE } from '../brandKitNormalization'
import { useBrandKitStore } from '../brandKitStore'
import {
  PALETTE_EXTRACTION_ALGORITHM_VERSION,
  extractPaletteFromImageFile,
} from '../paletteExtraction'
import { BrandKitAssetsEditor } from './BrandKitAssetsEditor'
import { BrandSoundDrawingShortcuts } from './BrandSoundDrawingShortcuts'
import { BrandPersonalizationDiagnostics } from './BrandPersonalizationDiagnostics'
import { BrandKitEngineControls } from './BrandKitEngineControls'
import { BrandKitPaletteEditor } from './BrandKitPaletteEditor'

const CANDIDATE_LABELS: Record<BrandPaletteCandidateId, string> = {
  faithful: 'Faithful',
  stageVibrant: 'Stage-vibrant',
  highContrast: 'High-contrast',
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Not yet'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString()
}

function Toggle({ checked, onChange, label, description, disabled = false }: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description: string
  disabled?: boolean
}) {
  return (
    <div className="bk-toggle-row">
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <button
        type="button"
        className={`bk-toggle${checked ? ' bk-toggle--on' : ''}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      ><span aria-hidden="true" /></button>
    </div>
  )
}

function SyncStatus() {
  const { loading, syncing, error, usingCachedActiveKit, activeMetadata, refresh, clearError } = useBrandKitStore(useShallow(state => ({
    loading: state.loading,
    syncing: state.syncing,
    error: state.error,
    usingCachedActiveKit: state.usingCachedActiveKit,
    activeMetadata: state.activeMetadata,
    refresh: state.refresh,
    clearError: state.clearError,
  })))
  const label = loading ? 'Loading from cloud'
    : syncing ? 'Syncing changes'
      : usingCachedActiveKit ? 'Using cached Brand Kit'
        : activeMetadata.source === 'database' ? 'Cloud synced'
          : 'Not synced'
  return (
    <div className={`bk-sync-status${error ? ' bk-sync-status--error' : ''}`} role="status" aria-live="polite">
      <span className="bk-sync-dot" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>{error ?? (activeMetadata.lastSyncedAt ? `Last synced ${formatTimestamp(activeMetadata.lastSyncedAt)}` : 'Changes are stored with your account.')}</span>
      </div>
      {error && (
        <button type="button" className="bk-secondary-button" onClick={() => { clearError(); void refresh() }}>
          Retry
        </button>
      )}
    </div>
  )
}

function ExtractedPalettePanel({
  analysis,
  selectedCandidate,
  analysisState,
  sourceName,
  onSelectCandidate,
  onRestore,
  onReanalyze,
}: {
  analysis: BrandPaletteAnalysis | null
  selectedCandidate: BrandPaletteCandidateId
  analysisState: 'idle' | 'analyzing' | 'error'
  sourceName: string | null
  onSelectCandidate: (id: BrandPaletteCandidateId) => void
  onRestore: () => void
  onReanalyze: () => void
}) {
  return (
    <div className="bk-analysis-panel">
      <div className="bk-section-heading">
        <div>
          <h3>Palette extraction</h3>
          <p>{sourceName ? `Source: ${sourceName}` : 'Choose a palette-source asset to extract colors.'}</p>
        </div>
        <button type="button" className="bk-secondary-button" onClick={onReanalyze} disabled={!sourceName || analysisState === 'analyzing'}>
          {analysisState === 'analyzing' ? 'Analyzing…' : 'Re-run analysis'}
        </button>
      </div>
      {analysisState === 'error' && (
        <div className="bk-inline-warning" role="alert">
          Palette analysis failed. Your manual palette remains available and unchanged.
        </div>
      )}
      {analysis ? (
        <>
          <div className="bk-analysis-meta">
            <span>Algorithm {analysis.metadata.algorithmVersion}</span>
            <span>Analyzed {formatTimestamp(analysis.metadata.analyzedAt)}</span>
            <span>{analysis.metadata.sampledPixels.toLocaleString()} sampled pixels</span>
          </div>
          <div className="bk-extracted-swatches" aria-label="Extracted color swatches">
            {analysis.swatches.map(swatch => (
              <div key={`${swatch.hex}-${swatch.population}`} className="bk-extracted-swatch">
                <span style={{ background: swatch.hex }} aria-hidden="true" />
                <strong>{swatch.hex}</strong>
                <small>{Math.round(swatch.weight * 100)}%</small>
              </div>
            ))}
          </div>
          <div className="bk-candidate-grid">
            {BRAND_PALETTE_CANDIDATE_IDS.map(id => {
              const palette = analysis.candidates[id]
              const selected = selectedCandidate === id
              return (
                <button
                  key={id}
                  type="button"
                  className={`bk-candidate${selected ? ' bk-candidate--selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => onSelectCandidate(id)}
                >
                  <strong>{CANDIDATE_LABELS[id]}</strong>
                  <span className="bk-candidate-swatches" aria-hidden="true">
                    {Object.values(palette).map((color, index) => <i key={index} style={{ background: color }} />)}
                  </span>
                </button>
              )
            })}
          </div>
          {analysis.metadata.warnings.map(warning => <div key={warning} className="bk-inline-warning">{warning}</div>)}
          <button type="button" className="bk-text-button" onClick={onRestore}>Restore colors from {CANDIDATE_LABELS[selectedCandidate]}</button>
        </>
      ) : (
        <div className="bk-state">No extraction snapshot yet. You can still create and save a manual semantic palette.</div>
      )}
    </div>
  )
}

function KitList({ selectedKitId, onSelect, onCreate }: {
  selectedKitId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
}) {
  const { kits, activeKit, loading, syncing } = useBrandKitStore(useShallow(state => ({
    kits: state.kits,
    activeKit: state.activeKit,
    loading: state.loading,
    syncing: state.syncing,
  })))
  return (
    <aside className="bk-kit-list" aria-label="Brand Kits">
      <div className="bk-kit-list-heading">
        <span>Brand Kits</span>
        <button type="button" className="bk-icon-button" onClick={onCreate} aria-label="Create Brand Kit" disabled={syncing}>＋</button>
      </div>
      {loading && kits.length === 0 && <div className="bk-kit-list-state">Loading…</div>}
      {!loading && kits.length === 0 && <div className="bk-kit-list-state">No kits yet</div>}
      {kits.map(kit => {
        const active = activeKit?.id === kit.id
        const selected = selectedKitId === kit.id
        return (
          <button
            key={kit.id}
            type="button"
            className={`bk-kit-list-item${selected ? ' bk-kit-list-item--selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onSelect(kit.id)}
          >
            <span className="bk-kit-mini-swatch" style={{ background: kit.palette.primary }} aria-hidden="true" />
            <span><strong>{kit.name}</strong><small>{active ? 'Active kit' : 'Saved kit'}</small></span>
            {active && <span className="bk-active-badge">ACTIVE</span>}
          </button>
        )
      })}
    </aside>
  )
}

export function BrandKitSettingsPanel() {
  const {
    currentUserId,
    kits,
    activeKit,
    assetsByKitId,
    loadingAssetsForKitId,
    loading,
    syncing,
    error,
    createKit,
    updateKit,
    deleteKit,
    activateKit,
    loadAssetsForKit,
  } = useBrandKitStore(useShallow(state => ({
    currentUserId: state.currentUserId,
    kits: state.kits,
    activeKit: state.activeKit,
    assetsByKitId: state.assetsByKitId,
    loadingAssetsForKitId: state.loadingAssetsForKitId,
    loading: state.loading,
    syncing: state.syncing,
    error: state.error,
    createKit: state.createKit,
    updateKit: state.updateKit,
    deleteKit: state.deleteKit,
    activateKit: state.activateKit,
    loadAssetsForKit: state.loadAssetsForKit,
  })))
  const { items, updateMediaMetadata } = useMediaStore(useShallow(state => ({
    items: state.items,
    updateMediaMetadata: state.updateMediaMetadata,
  })))
  const [selectedKitId, setSelectedKitId] = useState<string | null>(activeKit?.id ?? kits[0]?.id ?? null)
  const [suggestedName, setSuggestedName] = useState('My Brand Kit')
  const [creating, setCreating] = useState(false)
  const [newKitName, setNewKitName] = useState('')
  const [renameDraft, setRenameDraft] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<BrandPaletteCandidateId>('faithful')
  const [selectedSourceAssetId, setSelectedSourceAssetId] = useState<string | null>(null)
  const [analysisState, setAnalysisState] = useState<'idle' | 'analyzing' | 'error'>('idle')
  const [notice, setNotice] = useState<string | null>(null)

  const kit = useMemo(
    () => kits.find(candidate => candidate.id === selectedKitId) ?? activeKit ?? kits[0] ?? null,
    [kits, selectedKitId, activeKit],
  )
  const kitId = kit?.id ?? null
  const kitName = kit?.name ?? ''
  const assets = useMemo(
    () => kitId ? (assetsByKitId[kitId] ?? []) : [],
    [assetsByKitId, kitId],
  )
  const paletteSources = useMemo(
    () => assets.filter(asset => asset.role === 'paletteSource' || asset.isPaletteSource),
    [assets],
  )
  const selectedSource = paletteSources.find(asset => asset.id === selectedSourceAssetId) ?? paletteSources[0] ?? null
  const sourceMediaItem = selectedSource
    ? items.find(item => item.dbId === selectedSource.mediaItemId) ?? null
    : null

  useEffect(() => {
    if (!selectedKitId && (activeKit?.id || kits[0]?.id)) setSelectedKitId(activeKit?.id ?? kits[0].id)
  }, [selectedKitId, activeKit?.id, kits])

  useEffect(() => {
    if (!kitId) return
    setRenameDraft(kitName)
    setDeleteConfirm(false)
    void loadAssetsForKit(kitId)
  }, [kitId, kitName, loadAssetsForKit])

  useEffect(() => {
    if (!currentUserId) return
    let alive = true
    void getProfile(currentUserId).then(({ profile }) => {
      if (!alive) return
      const base = profile?.artist_name?.trim() || profile?.display_name?.trim()
      const next = base ? `${base} Brand Kit` : 'My Brand Kit'
      setSuggestedName(next)
      setNewKitName(current => current || next)
    })
    return () => { alive = false }
  }, [currentUserId])

  useEffect(() => {
    if (!paletteSources.some(asset => asset.id === selectedSourceAssetId)) {
      setSelectedSourceAssetId(paletteSources[0]?.id ?? null)
    }
  }, [paletteSources, selectedSourceAssetId])

  async function handleCreate() {
    const name = (newKitName || suggestedName).trim()
    if (!name) return
    const created = await createKit({ name })
    if (!created) return
    setSelectedKitId(created.id)
    setCreating(false)
    setNewKitName(suggestedName)
    await activateKit(created.id)
  }

  async function commitRename() {
    if (!kit) return
    const name = renameDraft.trim()
    if (!name || name === kit.name) { setRenameDraft(kit.name); return }
    await updateKit(kit.id, { name })
  }

  async function patchKit(patch: Partial<BrandKit>) {
    if (!kit) return
    await updateKit(kit.id, patch)
  }

  function applyAnalysis(analysis: BrandPaletteAnalysis) {
    if (!kit) return
    void patchKit({ extractedPalette: analysis, extractionMetadata: analysis.metadata })
    setAnalysisState('idle')
  }

  async function reanalyze() {
    if (!kit || !selectedSource) return
    setAnalysisState('analyzing')
    setNotice(null)
    try {
      let url = sourceMediaItem?.url ?? ''
      if (!url && selectedSource.media?.storagePath) {
        const signed = await createSignedMediaUrl(selectedSource.media.storagePath)
        url = signed.url ?? ''
      }
      if (!url) throw new Error('Palette source is unavailable')
      const response = await fetch(url)
      if (!response.ok) throw new Error('Palette source could not be downloaded')
      const blob = await response.blob()
      const file = new File(
        [blob],
        sourceMediaItem?.name ?? selectedSource.media?.name ?? 'palette-source',
        { type: sourceMediaItem?.mimeType ?? selectedSource.media?.mimeType ?? blob.type },
      )
      const analysis = await extractPaletteFromImageFile(file)
      if (sourceMediaItem) {
        await updateMediaMetadata(sourceMediaItem.id, {
          paletteAnalysis: analysis,
          dominantColors: analysis.swatches.map(swatch => swatch.hex),
          analyzedAt: Date.now(),
        })
      }
      await patchKit({ extractedPalette: analysis, extractionMetadata: analysis.metadata })
      setAnalysisState('idle')
      setNotice('Palette analysis updated. Your current manual palette was preserved.')
    } catch (caught) {
      if (sourceMediaItem) {
        await updateMediaMetadata(sourceMediaItem.id, {
          paletteAnalysisError: {
            algorithmVersion: PALETTE_EXTRACTION_ALGORITHM_VERSION,
            attemptedAt: new Date().toISOString(),
            message: caught instanceof Error ? caught.message.slice(0, 240) : 'Palette analysis failed',
          },
        })
      }
      setAnalysisState('error')
    }
  }

  if (!currentUserId && !loading) {
    return <div className="bk-state bk-state--error">Sign in to create and sync Brand Kits.</div>
  }

  if (!kit && !loading) {
    return (
      <div className="bk-settings">
        <SyncStatus />
        <div className="bk-empty">
          <div className="bk-empty-mark" aria-hidden="true">◇</div>
          <h2>Make DRMVYZ feel like your booth</h2>
          <p>Create a Brand Kit from your logos or artwork, then apply its palette to Sound Drawing, Neon Lattice, and Cinematic Worlds.</p>
          <label className="bk-field-label" htmlFor="bk-first-name">Brand Kit name</label>
          <input id="bk-first-name" value={newKitName} onChange={event => setNewKitName(event.target.value)} placeholder={suggestedName} />
          <button type="button" className="bk-primary-button" onClick={() => void handleCreate()} disabled={syncing}>Create Brand Kit</button>
          {error && <div className="bk-inline-warning" role="alert">{error}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="bk-settings">
      <SyncStatus />
      <div className="bk-workspace">
        <KitList selectedKitId={kit?.id ?? null} onSelect={setSelectedKitId} onCreate={() => { setCreating(true); setNewKitName(suggestedName) }} />
        <main className="bk-editor">
          {creating && (
            <div className="bk-create-bar">
              <label htmlFor="bk-new-name">New Brand Kit</label>
              <input id="bk-new-name" value={newKitName} onChange={event => setNewKitName(event.target.value)} autoFocus />
              <button type="button" className="bk-primary-button" onClick={() => void handleCreate()} disabled={syncing}>Create</button>
              <button type="button" className="bk-text-button" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          )}
          {kit && (
            <>
              <header className="bk-kit-header">
                <div className="bk-kit-title-field">
                  <label htmlFor="bk-kit-name">Brand Kit name</label>
                  <input
                    id="bk-kit-name"
                    value={renameDraft}
                    maxLength={120}
                    onChange={event => setRenameDraft(event.target.value)}
                    onBlur={() => void commitRename()}
                    onKeyDown={event => {
                      if (event.key === 'Enter') { event.preventDefault(); void commitRename() }
                    }}
                  />
                </div>
                <div className="bk-kit-header-actions">
                  {activeKit?.id === kit.id
                    ? <span className="bk-active-badge">ACTIVE KIT</span>
                    : <button type="button" className="bk-primary-button" onClick={() => void activateKit(kit.id)} disabled={syncing}>Activate</button>}
                  {!deleteConfirm
                    ? <button type="button" className="bk-danger-button" onClick={() => setDeleteConfirm(true)}>Delete</button>
                    : <div className="bk-delete-confirm" role="group" aria-label={`Confirm deletion of ${kit.name}`}>
                        <span>Delete this kit?</span>
                        <button type="button" className="bk-danger-button" onClick={async () => {
                          const deleted = await deleteKit(kit.id)
                          if (deleted) setSelectedKitId(useBrandKitStore.getState().activeKit?.id ?? useBrandKitStore.getState().kits[0]?.id ?? null)
                        }}>Confirm</button>
                        <button type="button" className="bk-text-button" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                      </div>}
                </div>
              </header>

              <section className="bk-section" aria-labelledby="bk-behavior-heading">
                <div className="bk-section-heading"><div><h3 id="bk-behavior-heading">Personalization behavior</h3><p>These controls never rewrite built-in presets.</p></div></div>
                <Toggle
                  checked={kit.autoApply}
                  onChange={autoApply => void patchKit({ autoApply })}
                  label="Automatic visual personalization"
                  description="Apply this kit at render and preview time. Turn it off to keep original preset palettes."
                  disabled={syncing}
                />
                <Toggle
                  checked={kit.useForAppAccent}
                  onChange={useForAppAccent => void patchKit({ useForAppAccent })}
                  label="Use for application accents"
                  description="Use the Brand Kit primary color for selected DRMVYZ interface accents."
                  disabled={syncing}
                />
              </section>

              <section className="bk-section" aria-labelledby="bk-assets-heading">
                <div className="bk-section-heading"><div><h3 id="bk-assets-heading">Brand assets</h3><p>Links point to your existing media library. No duplicate uploads or storage buckets are created.</p></div></div>
                {loadingAssetsForKitId === kit.id
                  ? <div className="bk-state" role="status">Loading linked assets…</div>
                  : <BrandKitAssetsEditor kitId={kit.id} assets={assets} onPaletteAnalysis={applyAnalysis} />}
              </section>

              <BrandSoundDrawingShortcuts assets={assets} />

              {paletteSources.length > 1 && (
                <div className="bk-source-selector">
                  <label htmlFor="bk-palette-source">Palette source to analyze</label>
                  <select id="bk-palette-source" value={selectedSource?.id ?? ''} onChange={event => setSelectedSourceAssetId(event.target.value)}>
                    {paletteSources.map(source => (
                      <option key={source.id} value={source.id}>{items.find(item => item.dbId === source.mediaItemId)?.name ?? source.media?.name ?? 'Missing media'}</option>
                    ))}
                  </select>
                </div>
              )}

              <section className="bk-section" aria-labelledby="bk-palette-heading">
                <ExtractedPalettePanel
                  analysis={kit.extractedPalette}
                  selectedCandidate={selectedCandidate}
                  analysisState={analysisState}
                  sourceName={sourceMediaItem?.title || sourceMediaItem?.name || selectedSource?.media?.name || null}
                  onSelectCandidate={id => {
                    setSelectedCandidate(id)
                    const palette = kit.extractedPalette?.candidates[id]
                    if (palette) void patchKit({ palette })
                  }}
                  onRestore={() => {
                    const palette = kit.extractedPalette?.candidates[selectedCandidate]
                    if (palette) void patchKit({ palette })
                  }}
                  onReanalyze={() => void reanalyze()}
                />
                {notice && <div className="bk-inline-success" role="status">{notice}</div>}
                <div className="bk-section-heading bk-section-heading--sub"><div><h3 id="bk-palette-heading">Semantic palette</h3><p>Unusual palettes are allowed. Contrast warnings are advisory, not blockers.</p></div></div>
                <BrandKitPaletteEditor
                  palette={kit.palette}
                  resetPalette={kit.extractedPalette?.candidates[selectedCandidate] ?? DEFAULT_BRAND_PALETTE}
                  onChange={palette => void patchKit({ palette })}
                />
              </section>

              <section className="bk-section" aria-labelledby="bk-engines-heading">
                <div className="bk-section-heading"><div><h3 id="bk-engines-heading">Engine personalization</h3><p>Choose how each palette-native engine interprets this Brand Kit.</p></div></div>
                <BrandKitEngineControls kit={kit} onChange={engineRules => void patchKit({ engineRules })} />
              </section>

              <BrandPersonalizationDiagnostics />
            </>
          )}
        </main>
      </div>
    </div>
  )
}
