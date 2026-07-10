import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  LASER_DMX_BEAM_MATRIX_PRESETS,
  summarizePreset,
} from './laserDmxBeamMatrixPresets'
import type { LaserDmxBeamMatrixPreset } from './ReactTypes'

// ── Category display names ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  minimal:       'Minimal',
  rhythmic:      'Rhythmic',
  multiReactive: 'Multi-Reactive',
  build:         'Build',
  drop:          'Drop',
  atmospheric:   'Atmospheric',
}

const CATEGORY_ORDER = ['minimal', 'rhythmic', 'multiReactive', 'build', 'drop', 'atmospheric']

function filterChipClassName(active = false): string {
  return `rv-preset-mode-chip rv-laser-dmx-preset-filter-chip${active ? ' rv-laser-dmx-preset-filter-chip--active' : ''}`
}

// ── Preset card ───────────────────────────────────────────────────────────────

function PresetCard({
  preset,
  isActive,
  isDirty,
  onApply,
  onRestore,
}: {
  preset:    LaserDmxBeamMatrixPreset
  isActive:  boolean
  isDirty:   boolean
  onApply:   (id: string) => void
  onRestore: (id: string) => void
}) {
  const summary = useMemo(() => summarizePreset(preset), [preset])

  return (
    <div className="rv-preset-card-shell rv-laser-dmx-preset-card-shell">
      <article className={`rv-preset-card rv-laser-dmx-preset-card${isActive ? ' rv-preset-card--active rv-laser-dmx-preset-card--active' : ''}`}>
        <div className="rv-preset-card-content rv-laser-dmx-preset-card-content">
          <div className="rv-preset-card-header">
            <span className="rv-preset-name">{preset.name}</span>
            {isActive && (
              <span
                className={`rv-preset-active-dot${isDirty ? ' rv-preset-active-dot--dirty' : ''}`}
                title={isDirty ? 'Active (modified)' : 'Active'}
              />
            )}
          </div>

          <div className="rv-preset-chip-row rv-laser-dmx-preset-chip-row">
            <span className="rv-preset-mode-chip">{summary.beamCount}B / {summary.groupCount}G</span>
            {summary.lineBeamCount > 0 && (
              <span className="rv-preset-mode-chip">{summary.lineBeamCount} line{summary.lineBeamCount !== 1 ? 's' : ''}</span>
            )}
            {summary.coneBeamCount > 0 && (
              <span className="rv-preset-mode-chip">{summary.coneBeamCount} cone{summary.coneBeamCount !== 1 ? 's' : ''}</span>
            )}
            {summary.usesFog && <span className="rv-preset-mode-chip">fog</span>}
          </div>

          <p className="rv-preset-desc">{preset.description}</p>

          <div className="rv-laser-dmx-preset-tags" aria-label={`${preset.name} tags`}>
            {preset.tags.map(tag => (
              <span key={tag}>{tag}</span>
            ))}
          </div>

          <div className="rv-laser-dmx-preset-actions">
            <button
              type="button"
              className="rv-glyph-upload-btn rv-laser-dmx-preset-action"
              onClick={() => onApply(preset.id)}
            >
              {isActive && !isDirty ? 'Reload' : 'Apply'}
            </button>
            {isActive && isDirty && (
              <button
                type="button"
                className="rv-glyph-upload-btn"
                title="Restore preset (discard edits)"
                onClick={() => onRestore(preset.id)}
              >
                Restore
              </button>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}

// ── Main browser ──────────────────────────────────────────────────────────────

export function LaserDmxBeamMatrixPresetBrowser() {
  const {
    activeLaserDmxBeamMatrixPresetId,
    laserDmxBeamMatrixPresetDirty,
    laserDmxBeamMatrix,
    applyLaserDmxBeamMatrixPreset,
  } = useReactStore(useShallow(s => ({
    activeLaserDmxBeamMatrixPresetId: s.activeLaserDmxBeamMatrixPresetId,
    laserDmxBeamMatrixPresetDirty:    s.laserDmxBeamMatrixPresetDirty,
    laserDmxBeamMatrix:               s.laserDmxBeamMatrix,
    applyLaserDmxBeamMatrixPreset:    s.applyLaserDmxBeamMatrixPreset,
  })))

  const [pendingId,       setPendingId]       = useState<string | null>(null)
  const [searchQuery,     setSearchQuery]     = useState('')
  const [activeCategory,  setActiveCategory]  = useState<string | null>(null)
  const [activeTags,      setActiveTags]      = useState<Set<string>>(new Set())

  // Collect all unique tags across all presets
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const p of LASER_DMX_BEAM_MATRIX_PRESETS) for (const t of p.tags) tags.add(t)
    return Array.from(tags).sort()
  }, [])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return LASER_DMX_BEAM_MATRIX_PRESETS.filter(p => {
      if (activeCategory && p.category !== activeCategory) return false
      if (activeTags.size > 0 && !p.tags.some(t => activeTags.has(t))) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.includes(q))
      )
    })
  }, [searchQuery, activeCategory, activeTags])

  // Group filtered results by category in display order
  const grouped = useMemo(() => {
    const map = new Map<string, LaserDmxBeamMatrixPreset[]>()
    for (const p of filtered) {
      const list = map.get(p.category) ?? []
      list.push(p)
      map.set(p.category, list)
    }
    return CATEGORY_ORDER.filter(c => map.has(c)).map(c => ({ category: c, presets: map.get(c)! }))
  }, [filtered])

  // Find active preset index for prev/next navigation
  const allFiltered = filtered
  const activeIdx   = activeLaserDmxBeamMatrixPresetId
    ? allFiltered.findIndex(p => p.id === activeLaserDmxBeamMatrixPresetId)
    : -1

  function navigateTo(dir: -1 | 1) {
    if (allFiltered.length === 0) return
    const next = activeIdx === -1
      ? dir === 1 ? 0 : allFiltered.length - 1
      : (activeIdx + dir + allFiltered.length) % allFiltered.length
    handleApply(allFiltered[next].id)
  }

  function handleApply(presetId: string) {
    const hasContent     = laserDmxBeamMatrix.beams.length > 0
    const isModifiedOther = hasContent && laserDmxBeamMatrixPresetDirty && activeLaserDmxBeamMatrixPresetId !== presetId
    if (isModifiedOther) { setPendingId(presetId); return }
    applyLaserDmxBeamMatrixPreset(presetId)
  }

  function handleRestore(presetId: string) {
    applyLaserDmxBeamMatrixPreset(presetId)
  }

  function toggleTag(tag: string) {
    setActiveTags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag); else next.add(tag)
      return next
    })
  }

  return (
    <>
      {pendingId && (
        <div className="rv-bm-confirm">
          <span>Replace modified program with preset?</span>
          <button type="button" className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
            onClick={() => { applyLaserDmxBeamMatrixPreset(pendingId); setPendingId(null) }}>
            Replace
          </button>
          <button type="button" className="rv-glyph-upload-btn" onClick={() => setPendingId(null)}>
            Cancel
          </button>
        </div>
      )}

      {/* ── Search ── */}
      <div className="vz-md-search-wrap rv-laser-dmx-search-wrap">
        <svg className="vz-md-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input
          className="vz-md-search-input"
          type="text"
          aria-label="Search Beam Matrix presets"
          placeholder="Search presets…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery.length > 0 && (
          <button className="vz-md-search-clear" onClick={() => setSearchQuery('')} title="Clear search" aria-label="Clear preset search">✕</button>
        )}
      </div>

      {/* ── Category filter ── */}
      <div className="rv-laser-dmx-preset-filter-row" aria-label="Beam Matrix preset categories">
        <button
          type="button"
          className={filterChipClassName(activeCategory === null)}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {CATEGORY_ORDER.map(cat => (
          <button
            key={cat}
            type="button"
            className={filterChipClassName(activeCategory === cat)}
            onClick={() => setActiveCategory(prev => prev === cat ? null : cat)}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* ── Tag filter chips ── */}
      {activeTags.size > 0 && (
        <div className="rv-laser-dmx-preset-filter-row" aria-label="Active Beam Matrix tag filters">
          {Array.from(activeTags).map(tag => (
            <button
              key={tag}
              type="button"
              className={filterChipClassName(true)}
              onClick={() => toggleTag(tag)}
              title={`Remove filter: ${tag}`}
            >
              {tag} ×
            </button>
          ))}
          <button
            type="button"
            className="rv-preset-mode-chip rv-laser-dmx-preset-filter-chip rv-laser-dmx-preset-filter-chip--muted"
            onClick={() => setActiveTags(new Set())}
          >
            Clear tags
          </button>
        </div>
      )}

      {/* ── Prev/Next navigation ── */}
      {allFiltered.length > 1 && (
        <div className="rv-laser-dmx-preset-nav">
          <button type="button" className="rv-glyph-upload-btn rv-laser-dmx-preset-nav-btn"
            onClick={() => navigateTo(-1)}>
            ‹ Prev
          </button>
          <span className="rv-laser-dmx-preset-nav-count">
            {activeIdx >= 0 ? `${activeIdx + 1} / ${allFiltered.length}` : `— / ${allFiltered.length}`}
          </span>
          <button type="button" className="rv-glyph-upload-btn rv-laser-dmx-preset-nav-btn"
            onClick={() => navigateTo(1)}>
            Next ›
          </button>
        </div>
      )}

      {/* ── Grouped preset list ── */}
      {grouped.length === 0 ? (
        <div className="rv-ctrl-info rv-laser-dmx-preset-empty">No presets match.</div>
      ) : (
        <div className="rv-laser-dmx-preset-groups">
          {grouped.map(({ category, presets }) => (
            <section key={category} className="rv-laser-dmx-preset-category">
              <button
                type="button"
                className="rv-laser-dmx-preset-category-heading"
                onClick={() => setActiveCategory(prev => prev === category ? null : category)}
                title={`Filter by ${CATEGORY_LABELS[category] ?? category}`}
              >
                {CATEGORY_LABELS[category] ?? category}
              </button>
              <div className="rv-laser-dmx-preset-category-list">
                {presets.map(preset => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    isActive={preset.id === activeLaserDmxBeamMatrixPresetId}
                    isDirty={laserDmxBeamMatrixPresetDirty}
                    onApply={handleApply}
                    onRestore={handleRestore}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Tag browser (collapsed under filter bar) ── */}
      <details className="rv-laser-dmx-preset-tag-browser">
        <summary className="rv-laser-dmx-preset-tag-summary">Filter by tag</summary>
        <div className="rv-laser-dmx-preset-filter-row rv-laser-dmx-preset-filter-row--tags">
          {allTags.map(tag => (
            <button
              key={tag}
              type="button"
              className={filterChipClassName(activeTags.has(tag))}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </details>
    </>
  )
}
