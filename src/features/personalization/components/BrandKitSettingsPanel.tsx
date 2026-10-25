import { RailWindowHeader } from '../../../components/vyzualz/layout/RailWindowHeader'
import { RailTabs } from '../../../components/vyzualz/layout/RailTabs'
import { ToggleRow, TextInputRow, SelectRow } from '../../../components/vyzualz/react/ReactControlRows'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import { LayerRow } from '../../../components/vyzualz/react/controls/LayerRow'
import { StatusBadge } from '../../../components/vyzualz/react/controls/StatusBadge'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { useEffect, useMemo, useRef, useState } from 'react'
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
        <IconChipButton type="button" onClick={() => { clearError(); void refresh() }}>
          Retry
        </IconChipButton>
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
        <IconChipButton type="button" onClick={onReanalyze} disabled={!sourceName || analysisState === 'analyzing'}>
          {analysisState === 'analyzing' ? 'Analyzing…' : 'Re-run analysis'}
        </IconChipButton>
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
                <IconChipButton
                  key={id}
                  type="button"
                  className={`bk-candidate${selected ? ' bk-candidate--selected' : ''}`}
                  tone={selected ? 'primary' : 'default'}
                  aria-pressed={selected}
                  onClick={() => onSelectCandidate(id)}
                >
                  <strong>{CANDIDATE_LABELS[id]}</strong>
                  <span className="bk-candidate-swatches" aria-hidden="true">
                    {Object.values(palette).map((color, index) => <i key={index} style={{ background: color }} />)}
                  </span>
                </IconChipButton>
              )
            })}
          </div>
          {analysis.metadata.warnings.map(warning => <div key={warning} className="bk-inline-warning">{warning}</div>)}
          <IconChipButton type="button" onClick={onRestore}>Restore colors from {CANDIDATE_LABELS[selectedCandidate]}</IconChipButton>
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
  const rowsRef = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState(4)
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(kits.length / pageSize))
  useEffect(() => {
    const rows = rowsRef.current
    if (!rows || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setPageSize(Math.max(1, Math.floor(entry.contentRect.height / 64))))
    observer.observe(rows)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const index = kits.findIndex(kit => kit.id === selectedKitId)
    if (index >= 0) setPage(Math.floor(index / pageSize))
  }, [selectedKitId, pageSize, kits])
  useEffect(() => setPage(current => Math.min(current, pageCount - 1)), [pageCount])
  return (
    <aside className="bk-kit-list" aria-label="Brand Kits">
      <RailWindowHeader side="left" label="Brand Kits" icon={<AppIcon kind="brand" size={15} />} actions={
        <IconChipButton type="button" className="bk-icon-action" onClick={onCreate} aria-label="Create Brand Kit" disabled={syncing} icon={<AppIcon kind="plus" size={14} />} />
      } />
      {loading && kits.length === 0 && <div className="bk-kit-list-state">Loading…</div>}
      {!loading && kits.length === 0 && <div className="bk-kit-list-state">No kits yet</div>}
      <div className="bk-kit-list-rows" ref={rowsRef}>
        {kits.slice(page * pageSize, (page + 1) * pageSize).map((kit, index) => (
          <LayerRow
            key={kit.id}
            index={page * pageSize + index + 1}
            label={kit.name}
            status={activeKit?.id === kit.id ? 'Active kit' : 'Saved kit'}
            tone={kit.palette.primary}
            active={selectedKitId === kit.id}
            aria-pressed={selectedKitId === kit.id}
            onClick={() => onSelect(kit.id)}
          />
        ))}
      </div>
      <div className="bk-kit-pagination" aria-label="Brand Kit pages" aria-hidden={pageCount <= 1} style={{ visibility: pageCount > 1 ? 'visible' : 'hidden' }}>
        <IconChipButton aria-label="Previous Brand Kits" disabled={page === 0} onClick={() => setPage(page - 1)} icon={<AppIcon kind="chevronRight" style={{ transform: 'rotate(180deg)' }} size={14} />} />
        <span aria-live="polite">{page + 1} / {pageCount}</span>
        <IconChipButton aria-label="Next Brand Kits" disabled={page === pageCount - 1} onClick={() => setPage(page + 1)} icon={<AppIcon kind="chevronRight" size={14} />} />
      </div>
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
  const [editorTab, setEditorTab] = useState<'identity' | 'assets' | 'palette' | 'engines'>('identity')
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
          <div className="bk-empty-mark" aria-hidden="true"><AppIcon kind="shape" size={14} /></div>
          <h2>Make DRMVYZ feel like your booth</h2>
          <p>Create a Brand Kit from your logos or artwork, then use it across Sound Drawing, Cinema, and LaserDMX.</p>
          <label className="bk-field-label" htmlFor="bk-first-name">Brand Kit name</label>
          <DreamVizTextInput id="bk-first-name" value={newKitName} onChange={event => setNewKitName(event.target.value)} placeholder={suggestedName} />
          <IconChipButton type="button" tone="primary" onClick={() => void handleCreate()} disabled={syncing}>Create Brand Kit</IconChipButton>
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
        <div className="bk-editor-workspace">
        <RailWindowHeader side="right" label="Brand Kit Workspace" icon={<AppIcon kind="brand" size={15} />} />
        <RailTabs variant="underline" tabs={[{id:'identity',label:'Identity'},{id:'assets',label:'Assets'},{id:'palette',label:'Palette'},{id:'engines',label:'Engines'}]} activeTab={editorTab} onChange={setEditorTab} ariaLabel="Brand Kit workspace" />
        <main className="bk-editor" aria-label="Brand Kit editor" tabIndex={0}>
          {creating && (
            <div className="bk-create-bar">
              <label htmlFor="bk-new-name">New Brand Kit</label>
              <DreamVizTextInput id="bk-new-name" value={newKitName} onChange={event => setNewKitName(event.target.value)} autoFocus />
              <IconChipButton type="button" tone="primary" onClick={() => void handleCreate()} disabled={syncing}>Create</IconChipButton>
              <IconChipButton type="button" onClick={() => setCreating(false)}>Cancel</IconChipButton>
            </div>
          )}
          {kit && (
            <>
              <header className="bk-kit-header">
                <TextInputRow id="bk-kit-name" label="Brand Kit name" value={renameDraft} maxLength={120} onChange={setRenameDraft} onBlur={() => void commitRename()} />
                <div className="bk-kit-header-actions">
                  {activeKit?.id === kit.id
                    ? <StatusBadge tone="playing">ACTIVE KIT</StatusBadge>
                    : <IconChipButton type="button" tone="primary" onClick={() => void activateKit(kit.id)} disabled={syncing}>Activate</IconChipButton>}
                  {!deleteConfirm
                    ? <IconChipButton type="button" className="dv-icon-chip--danger" onClick={() => setDeleteConfirm(true)}>Delete</IconChipButton>
                    : <div className="bk-delete-confirm" role="group" aria-label={`Confirm deletion of ${kit.name}`}>
                        <span>Delete this kit?</span>
                        <IconChipButton type="button" className="dv-icon-chip--danger" onClick={async () => {
                          const deleted = await deleteKit(kit.id)
                          if (deleted) setSelectedKitId(useBrandKitStore.getState().activeKit?.id ?? useBrandKitStore.getState().kits[0]?.id ?? null)
                        }}>Confirm</IconChipButton>
                        <IconChipButton type="button" onClick={() => setDeleteConfirm(false)}>Cancel</IconChipButton>
                      </div>}
                </div>
              </header>

              <div hidden={editorTab !== 'identity'} role="tabpanel" aria-label="Identity">
              <DualRailCollapsible label="Personalization behavior">
                <p className="bk-description">Choose how this kit personalizes your visuals and interface.</p>
                <ToggleRow
                  value={kit.autoApply}
                  onChange={autoApply => void patchKit({ autoApply })}
                  label="Automatic visual personalization"
                  description="Apply this kit at render and preview time. Turn it off to keep original preset palettes."
                  disabled={syncing}
                />
                <ToggleRow
                  value={kit.useForAppAccent}
                  onChange={useForAppAccent => void patchKit({ useForAppAccent })}
                  label="Use for application accents"
                  description="Use the Brand Kit primary color for selected DRMVYZ interface accents."
                  disabled={syncing}
                />
              </DualRailCollapsible>

              <BrandPersonalizationDiagnostics />
              </div>
              <div hidden={editorTab !== 'assets'} role="tabpanel" aria-label="Assets">
              <DualRailCollapsible label="Brand assets">
                <p className="bk-description">Choose logos and artwork from your media library.</p>
                {loadingAssetsForKitId === kit.id
                  ? <div className="bk-state" role="status">Loading linked assets…</div>
                  : <BrandKitAssetsEditor kitId={kit.id} assets={assets} onPaletteAnalysis={applyAnalysis} />}
              </DualRailCollapsible>

              <BrandSoundDrawingShortcuts assets={assets} />

              </div>
              <div hidden={editorTab !== 'palette'} role="tabpanel" aria-label="Palette">
              {paletteSources.length > 1 && (
                <SelectRow id="bk-palette-source" label="Palette source to analyze" value={selectedSource?.id ?? ''} onChange={setSelectedSourceAssetId} options={paletteSources.map(source => ({value:source.id,label:items.find(item => item.dbId === source.mediaItemId)?.name ?? source.media?.name ?? 'Missing media'}))} />
              )}

              <DualRailCollapsible label="Semantic palette">
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
                <p className="bk-description">Unusual palettes are allowed. Contrast warnings are advisory, not blockers.</p>
                <BrandKitPaletteEditor
                  palette={kit.palette}
                  resetPalette={kit.extractedPalette?.candidates[selectedCandidate] ?? DEFAULT_BRAND_PALETTE}
                  onChange={palette => void patchKit({ palette })}
                />
              </DualRailCollapsible>

              </div>
              <div hidden={editorTab !== 'engines'} role="tabpanel" aria-label="Engines">
              <DualRailCollapsible label="Engine personalization">
                <p className="bk-description">Choose per-engine palette behavior for Sound Drawing and LaserDMX. Cinema uses semantic Brand Kit mappings in the Cinema Composer.</p>
                <BrandKitEngineControls kit={kit} onChange={engineRules => void patchKit({ engineRules })} />
              </DualRailCollapsible>

              </div>
            </>
          )}
        </main>
        </div>
      </div>
    </div>
  )
}
