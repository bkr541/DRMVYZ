import { DreamVizTextInput } from './controls/DreamVizTextInput'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { ReactPresetCard, type ReactPresetCardChip } from './ReactPresetCard'
import { resolveLaserDmxBeamMatrixPresetProvenance } from './LaserDmxBeamMatrixPresetProvenance'
import {
  BeamMatrixPresetThumbnail,
  getBeamMatrixPresetPalette,
} from './LaserDmxPresetThumbnail'
import {
  LASER_DMX_BEAM_MATRIX_PRESETS,
  summarizePreset,
} from './laserDmxBeamMatrixPresets'
import type {
  LaserDmxBeamMatrixPreset,
  LaserDmxBeamMatrixPresetCategory,
  LaserDmxBeamSequence,
} from './ReactTypes'

const CATEGORY_LABELS: Record<LaserDmxBeamMatrixPresetCategory, string> = {
  minimal: 'Minimal',
  rhythmic: 'Rhythmic',
  multiReactive: 'Multi-Reactive',
  build: 'Build',
  drop: 'Drop',
  atmospheric: 'Atmospheric',
}

const CATEGORY_ORDER: LaserDmxBeamMatrixPresetCategory[] = [
  'minimal',
  'rhythmic',
  'multiReactive',
  'build',
  'drop',
  'atmospheric',
]

function filterChipClassName(active = false): string {
  return `rv-preset-mode-chip rv-laser-dmx-preset-filter-chip${active ? ' rv-laser-dmx-preset-filter-chip--active' : ''}`
}

function sequenceLabel(sequence: LaserDmxBeamSequence): string {
  const labels: Record<LaserDmxBeamSequence['mode'], string> = {
    all: 'All-beam',
    forward: 'Forward',
    reverse: 'Reverse',
    alternate: 'Alternate',
    centerOut: 'Center-out',
    outsideIn: 'Outside-in',
    randomSeeded: 'Seeded',
    custom: 'Custom',
  }
  return `${labels[sequence.mode]} sequence`
}

export function getBeamMatrixPresetTimingLabel(preset: LaserDmxBeamMatrixPreset): string {
  const settings = preset.createSettings()
  const activeSequence = settings.groups.find(group => group.sequence.enabled)?.sequence
  if (activeSequence) return sequenceLabel(activeSequence)

  const launchTrigger = settings.groups.map(group => group.launch.trigger).find(trigger => trigger !== 'none')
  if (launchTrigger) return `${launchTrigger} trigger`

  const motion = settings.beams.map(beam => beam.motion.mode).find(mode => mode !== 'static')
  if (motion) return `${motion} motion`

  const source = summarizePreset(preset).musicSources[0]
  return source ? `${source} reactive` : 'Static beams'
}

export function getBeamMatrixPresetChips(preset: LaserDmxBeamMatrixPreset): ReactPresetCardChip[] {
  const summary = summarizePreset(preset)
  return [
    { label: `${summary.beamCount} beams` },
    { label: CATEGORY_LABELS[preset.category] },
    { label: getBeamMatrixPresetTimingLabel(preset) },
    ...preset.tags.slice(0, 2).map(tag => ({ label: tag })),
  ]
}

export function filterLaserDmxBeamMatrixPresets(
  presets: readonly LaserDmxBeamMatrixPreset[],
  searchQuery: string,
  activeCategory: LaserDmxBeamMatrixPresetCategory | null,
  activeTags: ReadonlySet<string>,
): LaserDmxBeamMatrixPreset[] {
  const query = searchQuery.trim().toLowerCase()
  return presets.filter(preset => {
    if (activeCategory && preset.category !== activeCategory) return false
    if (activeTags.size > 0 && !preset.tags.some(tag => activeTags.has(tag))) return false
    if (!query) return true
    return preset.name.toLowerCase().includes(query)
      || preset.description.toLowerCase().includes(query)
      || preset.tags.some(tag => tag.toLowerCase().includes(query))
  })
}

export function LaserDmxBeamMatrixPresetBrowser() {
  const {
    activeLaserDmxBeamMatrixPresetId,
    laserDmxBeamMatrix,
    applyLaserDmxBeamMatrixPreset,
  } = useReactStore(useShallow(state => ({
    activeLaserDmxBeamMatrixPresetId: state.activeLaserDmxBeamMatrixPresetId,
    laserDmxBeamMatrix: state.laserDmxBeamMatrix,
    applyLaserDmxBeamMatrixPreset: state.applyLaserDmxBeamMatrixPreset,
  })))

  const activePresetProvenance = useMemo(
    () => resolveLaserDmxBeamMatrixPresetProvenance(laserDmxBeamMatrix, activeLaserDmxBeamMatrixPresetId),
    [activeLaserDmxBeamMatrixPresetId, laserDmxBeamMatrix],
  )

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<LaserDmxBeamMatrixPresetCategory | null>(null)
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const preset of LASER_DMX_BEAM_MATRIX_PRESETS) {
      for (const tag of preset.tags) tags.add(tag)
    }
    return Array.from(tags).sort()
  }, [])

  const filtered = useMemo(
    () => filterLaserDmxBeamMatrixPresets(
      LASER_DMX_BEAM_MATRIX_PRESETS,
      searchQuery,
      activeCategory,
      activeTags,
    ),
    [searchQuery, activeCategory, activeTags],
  )

  const grouped = useMemo(() => {
    const map = new Map<LaserDmxBeamMatrixPresetCategory, LaserDmxBeamMatrixPreset[]>()
    for (const preset of filtered) {
      const list = map.get(preset.category) ?? []
      list.push(preset)
      map.set(preset.category, list)
    }
    return CATEGORY_ORDER
      .filter(category => map.has(category))
      .map(category => ({ category, presets: map.get(category)! }))
  }, [filtered])

  const activeIndex = activeLaserDmxBeamMatrixPresetId
    ? filtered.findIndex(preset => preset.id === activeLaserDmxBeamMatrixPresetId)
    : -1

  function handleApply(presetId: string) {
    const hasContent = laserDmxBeamMatrix.beams.length > 0
    const replacesModifiedPreset = hasContent
      && activePresetProvenance.status === 'modified'
      && activeLaserDmxBeamMatrixPresetId !== presetId
    if (replacesModifiedPreset) {
      setPendingId(presetId)
      return
    }
    applyLaserDmxBeamMatrixPreset(presetId)
  }

  function navigateTo(direction: -1 | 1) {
    if (filtered.length === 0) return
    const nextIndex = activeIndex === -1
      ? direction === 1 ? 0 : filtered.length - 1
      : (activeIndex + direction + filtered.length) % filtered.length
    handleApply(filtered[nextIndex].id)
  }

  function toggleTag(tag: string) {
    setActiveTags(previous => {
      const next = new Set(previous)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  return (
    <>
      {pendingId && (
        <div className="rv-bm-confirm">
          <span>Replace modified program with preset?</span>
          <button
            type="button"
            className="rv-glyph-upload-btn rv-glyph-upload-btn--danger"
            onClick={() => {
              applyLaserDmxBeamMatrixPreset(pendingId)
              setPendingId(null)
            }}
          >
            Replace
          </button>
          <button type="button" className="rv-glyph-upload-btn" onClick={() => setPendingId(null)}>
            Cancel
          </button>
        </div>
      )}

      <div className="vz-md-search-wrap rv-laser-dmx-search-wrap">
        <svg className="vz-md-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <DreamVizTextInput
          className="vz-md-search-input"
          type="text"
          aria-label="Search Beam Matrix presets"
          placeholder="Search presets…"
          value={searchQuery}
          onChange={event => setSearchQuery(event.target.value)}
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            className="vz-md-search-clear"
            onClick={() => setSearchQuery('')}
            title="Clear search"
            aria-label="Clear preset search"
          >
            ✕
          </button>
        )}
      </div>

      <div className="rv-laser-dmx-preset-filter-row" aria-label="Beam Matrix preset categories">
        <button
          type="button"
          className={filterChipClassName(activeCategory === null)}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {CATEGORY_ORDER.map(category => (
          <button
            key={category}
            type="button"
            className={filterChipClassName(activeCategory === category)}
            onClick={() => setActiveCategory(previous => previous === category ? null : category)}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

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

      {filtered.length > 1 && (
        <div className="rv-laser-dmx-preset-nav">
          <button
            type="button"
            className="rv-glyph-upload-btn rv-laser-dmx-preset-nav-btn"
            onClick={() => navigateTo(-1)}
          >
            ‹ Prev
          </button>
          <span className="rv-laser-dmx-preset-nav-count">
            {activeIndex >= 0 ? `${activeIndex + 1} / ${filtered.length}` : `— / ${filtered.length}`}
          </span>
          <button
            type="button"
            className="rv-glyph-upload-btn rv-laser-dmx-preset-nav-btn"
            onClick={() => navigateTo(1)}
          >
            Next ›
          </button>
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="rv-ctrl-info rv-laser-dmx-preset-empty">No presets match.</div>
      ) : (
        <div className="rv-laser-dmx-preset-groups">
          {grouped.map(({ category, presets }) => (
            <section key={category} className="rv-laser-dmx-preset-category">
              <button
                type="button"
                className="rv-laser-dmx-preset-category-heading"
                onClick={() => setActiveCategory(previous => previous === category ? null : category)}
                title={`Filter by ${CATEGORY_LABELS[category]}`}
              >
                {CATEGORY_LABELS[category]}
              </button>
              <div className="rv-preset-group-cards rv-laser-dmx-preset-category-list" data-preset-grid>
                {presets.map(preset => {
                  const isActive = preset.id === activeLaserDmxBeamMatrixPresetId
                  const isModified = isActive && activePresetProvenance.status === 'modified'
                  return (
                    <ReactPresetCard
                      key={preset.id}
                      id={preset.id}
                      title={preset.name}
                      description={preset.description}
                      thumbnail={<BeamMatrixPresetThumbnail preset={preset} />}
                      chips={getBeamMatrixPresetChips(preset)}
                      palette={getBeamMatrixPresetPalette(preset).map(color => ({ color }))}
                      isActive={isActive}
                      isModified={isModified}
                      activateLabel={`Load Beam Matrix preset ${preset.name}`}
                      onActivate={() => handleApply(preset.id)}
                      secondaryActions={isActive ? [{
                        id: isModified ? 'restore' : 'reload',
                        label: isModified ? 'Restore' : 'Reload',
                        ariaLabel: `${isModified ? 'Restore' : 'Reload'} Beam Matrix preset ${preset.name}`,
                        onSelect: () => applyLaserDmxBeamMatrixPreset(preset.id),
                      }] : []}
                      showMore={false}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

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
