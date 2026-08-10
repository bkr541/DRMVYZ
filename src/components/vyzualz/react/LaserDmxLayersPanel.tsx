import { DreamVizTextInput } from './controls/DreamVizTextInput'
import { IconChipButton } from './controls/IconChipButton'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import type { LaserDmxMatrixBeam, LaserDmxReactionGroup } from './ReactTypes'
import { DropdownSelect } from '../../shared/Dropdown/Dropdown'

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupColorCss(g: LaserDmxReactionGroup, fallback = 'rgba(232,244,248,0.3)'): string {
  if (!g.colorOverrideEnabled) return fallback
  const { red: r, green: g2, blue: b, alpha: a } = g.color
  return `rgba(${r},${g2},${b},${a})`
}

function targetLabel(beam: LaserDmxMatrixBeam): string {
  if (beam.target.kind === 'grid') {
    return `→ ${beam.target.column},${beam.target.row}`
  }
  return `→ stage(${beam.target.x.toFixed(2)},${beam.target.y.toFixed(2)})`
}

// ── Filter bar ───────────────────────────────────────────────────────────────

type FilterEnabledVal = 'all' | 'enabled' | 'disabled'

interface Filters {
  name:    string
  groupId: string  // '' = all
  enabled: FilterEnabledVal
}

const DEFAULT_FILTERS: Filters = { name: '', groupId: '', enabled: 'all' }

// ── Beam list row (memoized) ──────────────────────────────────────────────────

interface BeamRowProps {
  beam:       LaserDmxMatrixBeam
  group:      LaserDmxReactionGroup | null
  selected:   boolean
  onSelect:   (id: string, additive: boolean) => void
}

function BeamRow({ beam, group, selected, onSelect }: BeamRowProps) {
  const dotColor = (beam.useGroupColor && group?.colorOverrideEnabled)
    ? groupColorCss(group)
    : `rgba(${beam.color.red},${beam.color.green},${beam.color.blue},${beam.color.alpha})`

  return (
    <div
      className={`rv-bm-layer-row${selected ? ' rv-bm-layer-row--active' : ''}${!beam.enabled ? ' rv-bm-layer-row--disabled' : ''}`}
      onClick={e => onSelect(beam.id, e.shiftKey || e.metaKey || e.ctrlKey)}
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(beam.id, false) }}
    >
      <span
        className="rv-bm-layer-dot"
        style={{ background: dotColor }}
        aria-hidden="true"
      />
      <span className="rv-bm-layer-name" title={beam.name}>{beam.name}</span>
      <span className="rv-bm-layer-seq-idx" title={`Sequence index ${beam.sequenceIndex}`}>#{beam.sequenceIndex}</span>
      <span className="rv-bm-layer-origin">{beam.origin.column},{beam.origin.row}</span>
      <span className="rv-bm-layer-target">{targetLabel(beam)}</span>
      {group && (
        <span className="rv-bm-layer-group" title={group.name}>{group.name}</span>
      )}
    </div>
  )
}

// ── Group section ─────────────────────────────────────────────────────────────

interface GroupSectionProps {
  group:       LaserDmxReactionGroup
  beamCount:   number
  selected:    boolean
  onSelect:    (id: string | null) => void
  onMute:      (id: string, v: boolean) => void
  onSolo:      (id: string, v: boolean) => void
}

function GroupSection({ group, beamCount, selected, onSelect, onMute, onSolo }: GroupSectionProps) {
  return (
    <div
      className={`rv-bm-grp-header${selected ? ' rv-bm-grp-header--active' : ''}${group.muted ? ' rv-bm-grp-header--muted' : ''}`}
      onClick={() => onSelect(group.id === (selected ? group.id : '') ? null : group.id)}
      role="button"
      tabIndex={0}
      aria-label={`Group ${group.name}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(group.id) }}
    >
      <span
        className="rv-bm-layer-dot rv-bm-layer-dot--lg"
        style={{ background: groupColorCss(group) }}
        aria-hidden="true"
      />
      <span className="rv-bm-layer-name">{group.name}</span>
      <span className="rv-bm-layer-count">{beamCount}</span>
      <button
        type="button"
        className={`rv-bm-group-btn${group.muted ? ' rv-bm-group-btn--active' : ''}`}
        title={group.muted ? 'Unmute' : 'Mute'}
        aria-label={`${group.muted ? 'Unmute' : 'Mute'} ${group.name}`}
        onClick={e => { e.stopPropagation(); onMute(group.id, !group.muted) }}
      >M</button>
      <button
        type="button"
        className={`rv-bm-group-btn${group.soloed ? ' rv-bm-group-btn--active' : ''}`}
        title={group.soloed ? 'Unsolo' : 'Solo'}
        aria-label={`${group.soloed ? 'Unsolo' : 'Solo'} ${group.name}`}
        onClick={e => { e.stopPropagation(); onSolo(group.id, !group.soloed) }}
      >S</button>
      <span className={`rv-bm-layer-enabled ${group.enabled ? '' : 'rv-bm-layer-disabled-badge'}`}>
        {group.enabled ? '' : 'off'}
      </span>
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export function LaserDmxLayersPanel() {
  const {
    laserDmxBeamMatrix,
    selectLaserDmxMatrixBeam,
    selectLaserDmxReactionGroup,
    setLaserDmxReactionGroupMuted,
    setLaserDmxReactionGroupSoloed,
  } = useReactStore(useShallow(s => ({
    laserDmxBeamMatrix:              s.laserDmxBeamMatrix,
    selectLaserDmxMatrixBeam:        s.selectLaserDmxMatrixBeam,
    selectLaserDmxReactionGroup:     s.selectLaserDmxReactionGroup,
    setLaserDmxReactionGroupMuted:   s.setLaserDmxReactionGroupMuted,
    setLaserDmxReactionGroupSoloed:  s.setLaserDmxReactionGroupSoloed,
  })))

  const { beams, groups, selectedBeamIds, selectedGroupId } = laserDmxBeamMatrix

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)

  const groupMap = useMemo(
    () => new Map(groups.map(g => [g.id, g])),
    [groups]
  )

  const filteredBeams = useMemo(() => {
    return beams.filter(b => {
      if (filters.name && !b.name.toLowerCase().includes(filters.name.toLowerCase())) return false
      if (filters.groupId && b.groupId !== filters.groupId) return false
      if (filters.enabled === 'enabled'  && !b.enabled) return false
      if (filters.enabled === 'disabled' &&  b.enabled) return false
      return true
    })
  }, [beams, filters])

  const groupBeamCount = useMemo(() => {
    const counts = new Map<string, number>()
    beams.forEach(b => {
      if (b.groupId) counts.set(b.groupId, (counts.get(b.groupId) ?? 0) + 1)
    })
    return counts
  }, [beams])

  const groupOptions = [
    { value: '', label: 'All Groups' },
    ...groups.map(g => ({ value: g.id, label: g.name })),
  ]

  const enabledOptions: Array<{ value: FilterEnabledVal; label: string }> = [
    { value: 'all',      label: 'All'      },
    { value: 'enabled',  label: 'Enabled'  },
    { value: 'disabled', label: 'Disabled' },
  ]

  return (
    <div className="rv-bm-layers">
      {/* Header */}
      <div className="rv-bm-layers-header">
        <span className="rv-bm-layers-title">LAYERS</span>
        <button
          type="button"
          className={`rv-bm-editor-btn${showFilters ? ' rv-bm-editor-btn--active' : ''}`}
          onClick={() => setShowFilters(v => !v)}
          aria-label="Toggle filters"
        >
          Filter
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rv-bm-layers-filters">
          <DreamVizTextInput
            type="text"
            className="rv-ctrl-text-input"
            placeholder="Filter by name…"
            value={filters.name}
            onChange={e => setFilters(f => ({ ...f, name: e.target.value }))}
            aria-label="Filter beams by name"
          />
          <DropdownSelect
            className="rv-ctrl-select"
            value={filters.groupId}
            onChange={e => setFilters(f => ({ ...f, groupId: e.target.value }))}
            aria-label="Filter by group"
          >
            {groupOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </DropdownSelect>
          <DropdownSelect
            className="rv-ctrl-select"
            value={filters.enabled}
            onChange={e => setFilters(f => ({ ...f, enabled: e.target.value as FilterEnabledVal }))}
            aria-label="Filter by enabled state"
          >
            {enabledOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </DropdownSelect>
          <IconChipButton
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            Clear
          </IconChipButton>
        </div>
      )}

      {/* Groups section */}
      <div className="rv-bm-layers-section-label">Groups ({groups.length})</div>
      <div className="rv-bm-layer-list" role="list">
        {groups.length === 0 && (
          <div className="rv-ctrl-info">No groups — add one in the ENGINE tab.</div>
        )}
        {groups.map(g => (
          <GroupSection
            key={g.id}
            group={g}
            beamCount={groupBeamCount.get(g.id) ?? 0}
            selected={selectedGroupId === g.id}
            onSelect={selectLaserDmxReactionGroup}
            onMute={setLaserDmxReactionGroupMuted}
            onSolo={setLaserDmxReactionGroupSoloed}
          />
        ))}
      </div>

      {/* Beams section */}
      <div className="rv-bm-layers-section-label">
        Beams ({filteredBeams.length}{filteredBeams.length !== beams.length ? ` / ${beams.length}` : ''})
      </div>
      <div
        className="rv-bm-layer-list"
        role="listbox"
        aria-label="Beam list"
        aria-multiselectable="true"
      >
        {filteredBeams.length === 0 && (
          <div className="rv-ctrl-info">
            {beams.length === 0 ? 'No beams — add one in the ENGINE tab.' : 'No beams match the current filter.'}
          </div>
        )}
        {filteredBeams.map(b => (
          <BeamRow
            key={b.id}
            beam={b}
            group={b.groupId ? (groupMap.get(b.groupId) ?? null) : null}
            selected={selectedBeamIds.includes(b.id)}
            onSelect={selectLaserDmxMatrixBeam}
          />
        ))}
      </div>
    </div>
  )
}
