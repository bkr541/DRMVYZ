import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import type { ReactSectionType, ReactTrackSection } from './ReactTypes'
import { generateMockTrackAnalysis } from '../../../features/trackIntelligence/mockTrackAnalysis'
import { adaptTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'

const SECTION_COLORS: Record<ReactSectionType, string> = {
  intro:     '#61d6aa',
  verse:     '#4ac7db',
  build:     '#d8b95a',
  drop:      '#c0314a',
  breakdown: '#b84fc9',
  outro:     '#80dfc0',
}

const SECTION_ORDER: ReactSectionType[] = ['intro', 'verse', 'build', 'drop', 'breakdown', 'outro']

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

interface AddSectionFormProps {
  onAdd: (section: ReactTrackSection) => void
  onCancel: () => void
}

function AddSectionForm({ onAdd, onCancel }: AddSectionFormProps) {
  const [type, setType] = useState<ReactSectionType>('intro')
  const [label, setLabel] = useState('')
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(30)
  const [intensity, setIntensity] = useState(0.7)

  const handleAdd = () => {
    const id = `section-${Date.now()}`
    onAdd({
      id,
      label: label.trim() || type.charAt(0).toUpperCase() + type.slice(1),
      type,
      startSec,
      endSec,
      intensity,
    })
  }

  return (
    <div className="rv-add-section-form">
      <div className="rv-form-row">
        <label className="rv-form-label">Type</label>
        <select
          className="rv-form-select"
          value={type}
          onChange={e => setType(e.target.value as ReactSectionType)}
        >
          {SECTION_ORDER.map(t => (
            <option key={t} value={t} style={{ color: SECTION_COLORS[t] }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label">Label</label>
        <input
          className="rv-form-input"
          type="text"
          placeholder="Section name…"
          value={label}
          onChange={e => setLabel(e.target.value)}
          maxLength={32}
        />
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label">Start (s)</label>
        <input
          className="rv-form-input rv-form-input--num"
          type="number"
          min={0} step={1}
          value={startSec}
          onChange={e => setStartSec(Math.max(0, parseFloat(e.target.value) || 0))}
        />
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label">End (s)</label>
        <input
          className="rv-form-input rv-form-input--num"
          type="number"
          min={0} step={1}
          value={endSec}
          onChange={e => setEndSec(Math.max(0, parseFloat(e.target.value) || 0))}
        />
      </div>
      <div className="rv-form-row">
        <label className="rv-form-label">Intensity</label>
        <input
          className="rv-form-range"
          type="range"
          min={0} max={1} step={0.05}
          value={intensity}
          onChange={e => setIntensity(parseFloat(e.target.value))}
        />
        <span className="rv-form-val">{Math.round(intensity * 100)}%</span>
      </div>
      <div className="rv-form-actions">
        <button className="rv-form-cancel-btn" onClick={onCancel}>Cancel</button>
        <button
          className="rv-form-add-btn"
          onClick={handleAdd}
          disabled={endSec <= startSec}
        >
          Add Section
        </button>
      </div>
    </div>
  )
}

interface SectionChipProps {
  section: ReactTrackSection
  isSelected: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

function SectionChip({ section, isSelected, onSelect, onRemove }: SectionChipProps) {
  const color = SECTION_COLORS[section.type]
  return (
    <div
      className={`rv-section-chip${isSelected ? ' rv-section-chip--selected' : ''}`}
      style={{ '--section-color': color } as React.CSSProperties}
      onClick={() => onSelect(section.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onSelect(section.id) }}
    >
      <div className="rv-chip-stripe" style={{ background: color }} />
      <div className="rv-chip-body">
        <span className="rv-chip-label">{section.label}</span>
        <span className="rv-chip-type" style={{ color }}>{section.type}</span>
        <span className="rv-chip-time">
          {formatTime(section.startSec)} – {formatTime(section.endSec)}
        </span>
        <div
          className="rv-chip-intensity-bar"
          style={{ width: `${section.intensity * 100}%`, background: color + '80' }}
        />
      </div>
      <button
        className="rv-chip-remove"
        onClick={e => { e.stopPropagation(); onRemove(section.id) }}
        title="Remove section"
      >×</button>
    </div>
  )
}

interface ReactTrackMapStripProps {
  audioDurationSec?: number
}

export function ReactTrackMapStrip({ audioDurationSec = 180 }: ReactTrackMapStripProps) {
  const {
    manualTrackSections,
    selectedSectionId,
    setSelectedSectionId,
    addManualSection,
    removeManualSection,
  } = useReactStore(useShallow(s => ({
    manualTrackSections:  s.manualTrackSections,
    selectedSectionId:    s.selectedSectionId,
    setSelectedSectionId: s.setSelectedSectionId,
    addManualSection:     s.addManualSection,
    removeManualSection:  s.removeManualSection,
  })))

  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = (section: ReactTrackSection) => {
    addManualSection(section)
    setIsAdding(false)
  }

  const handleGenerateTrackMap = () => {
    const analysis = generateMockTrackAnalysis(audioDurationSec * 1000)
    const sections = adaptTrackSections(analysis)
    sections.forEach(addManualSection)
  }

  return (
    <div className="rv-track-map-strip">
      <div className="rv-strip-header">
        <span className="rv-strip-title">Track Map</span>
        <div className="rv-strip-type-legend">
          {SECTION_ORDER.map(t => (
            <span key={t} className="rv-legend-item" style={{ color: SECTION_COLORS[t] }}>
              {t}
            </span>
          ))}
        </div>
        <div className="rv-strip-actions">
          {manualTrackSections.length === 0 && (
            <button
              className="rv-generate-btn"
              onClick={handleGenerateTrackMap}
              title={`Auto-generate sections for ${Math.round(audioDurationSec / 60)}:${String(Math.round(audioDurationSec % 60)).padStart(2, '0')} track`}
            >
              ⚡ Generate
            </button>
          )}
          <button
            className="rv-add-section-btn"
            onClick={() => setIsAdding(v => !v)}
            title="Add section"
          >
            {isAdding ? '✕ Cancel' : '+ Add'}
          </button>
        </div>
      </div>

      {isAdding && (
        <AddSectionForm
          onAdd={handleAdd}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {manualTrackSections.length === 0 && !isAdding ? (
        <div className="rv-strip-empty">
          No sections defined — hit <strong>⚡ Generate</strong> for an auto track map, or <strong>+ Add</strong> to add manually.
        </div>
      ) : (
        <div className="rv-section-list">
          {manualTrackSections.map(section => (
            <SectionChip
              key={section.id}
              section={section}
              isSelected={selectedSectionId === section.id}
              onSelect={setSelectedSectionId}
              onRemove={removeManualSection}
            />
          ))}
        </div>
      )}
    </div>
  )
}
