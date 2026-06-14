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
    <div className={`rv-preset-card${isActive ? ' rv-preset-card--active' : ''}`}>
      <div className="rv-preset-card-header">
        <span className="rv-preset-name">{preset.name}</span>
        {isActive && (
          <span
            className="rv-preset-active-dot"
            title={isDirty ? 'Active (modified)' : 'Active'}
            style={{ background: isDirty ? 'var(--color-warn, #f90)' : undefined }}
          />
        )}
      </div>

      <p className="rv-preset-desc">{preset.description}</p>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
        <span className="rv-preset-mode-chip">{summary.beamCount}B / {summary.groupCount}G</span>
        {summary.lineBeamCount > 0 && (
          <span className="rv-preset-mode-chip">{summary.lineBeamCount} line{summary.lineBeamCount !== 1 ? 's' : ''}</span>
        )}
        {summary.coneBeamCount > 0 && (
          <span className="rv-preset-mode-chip">{summary.coneBeamCount} cone{summary.coneBeamCount !== 1 ? 's' : ''}</span>
        )}
        {summary.usesFog && <span className="rv-preset-mode-chip">fog</span>}
      </div>

      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4, opacity: 0.55 }}>
        {preset.tags.map(t => (
          <span key={t} style={{ fontSize: 9, color: 'var(--color-text-muted, #8aa)' }}>{t}</span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
        <button
          type="button"
          className="rv-glyph-upload-btn"
          style={{ flex: 1 }}
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
      <input
        type="search"
        className="rv-preset-search"
        placeholder="Search presets…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{ width: '100%', marginBottom: 6 }}
      />

      {/* ── Category filter ── */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 5 }}>
        <button
          type="button"
          className={`rv-preset-mode-chip${activeCategory === null ? ' rv-preset-mode-chip--active' : ''}`}
          style={{ cursor: 'pointer', border: 'none', background: activeCategory === null ? 'var(--color-accent, #4af)' : undefined }}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {CATEGORY_ORDER.map(cat => (
          <button
            key={cat}
            type="button"
            className={`rv-preset-mode-chip${activeCategory === cat ? ' rv-preset-mode-chip--active' : ''}`}
            style={{ cursor: 'pointer', border: 'none', background: activeCategory === cat ? 'var(--color-accent, #4af)' : undefined }}
            onClick={() => setActiveCategory(prev => prev === cat ? null : cat)}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* ── Tag filter chips ── */}
      {activeTags.size > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 5 }}>
          {Array.from(activeTags).map(tag => (
            <button
              key={tag}
              type="button"
              className="rv-preset-mode-chip"
              style={{ cursor: 'pointer', border: 'none', background: 'var(--color-accent, #4af)', opacity: 0.85 }}
              onClick={() => toggleTag(tag)}
              title={`Remove filter: ${tag}`}
            >
              {tag} ×
            </button>
          ))}
          <button
            type="button"
            className="rv-preset-mode-chip"
            style={{ cursor: 'pointer', border: 'none', opacity: 0.6 }}
            onClick={() => setActiveTags(new Set())}
          >
            Clear tags
          </button>
        </div>
      )}

      {/* ── Prev/Next navigation ── */}
      {allFiltered.length > 1 && (
        <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
          <button type="button" className="rv-glyph-upload-btn" style={{ flex: 1 }}
            onClick={() => navigateTo(-1)}>
            ‹ Prev
          </button>
          <span style={{ fontSize: 10, opacity: 0.6, alignSelf: 'center' }}>
            {activeIdx >= 0 ? `${activeIdx + 1} / ${allFiltered.length}` : `— / ${allFiltered.length}`}
          </span>
          <button type="button" className="rv-glyph-upload-btn" style={{ flex: 1 }}
            onClick={() => navigateTo(1)}>
            Next ›
          </button>
        </div>
      )}

      {/* ── Grouped preset list ── */}
      {grouped.length === 0 ? (
        <div className="rv-ctrl-info" style={{ marginTop: 8 }}>No presets match.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 2 }}>
          {grouped.map(({ category, presets }) => (
            <div key={category}>
              <div
                style={{ fontSize: 10, fontWeight: 600, opacity: 0.55, textTransform: 'uppercase',
                          letterSpacing: '0.06em', marginBottom: 4, cursor: 'pointer' }}
                onClick={() => setActiveCategory(prev => prev === category ? null : category)}
                title={`Filter by ${CATEGORY_LABELS[category] ?? category}`}
              >
                {CATEGORY_LABELS[category] ?? category}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
            </div>
          ))}
        </div>
      )}

      {/* ── Tag browser (collapsed under filter bar) ── */}
      <details style={{ marginTop: 8 }}>
        <summary style={{ fontSize: 10, opacity: 0.5, cursor: 'pointer' }}>Filter by tag</summary>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
          {allTags.map(tag => (
            <button
              key={tag}
              type="button"
              className="rv-preset-mode-chip"
              style={{
                cursor: 'pointer', border: 'none', fontSize: 9,
                background: activeTags.has(tag) ? 'var(--color-accent, #4af)' : undefined,
              }}
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
