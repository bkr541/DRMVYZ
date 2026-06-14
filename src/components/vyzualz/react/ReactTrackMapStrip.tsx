import { useState, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { useTrackAnalysisStore } from '../../../features/musicIntelligence/trackAnalysisStorage'
import type { ReactSectionType, ReactTrackSection } from './ReactTypes'
import { generateMockTrackAnalysis } from '../../../features/trackIntelligence/mockTrackAnalysis'
import { adaptTrackSections, adaptMIAnalysis } from '../../../features/trackIntelligence/trackMapAdapter'
import { analyzeTrackBuffer } from '../../../features/musicIntelligence/offlineTrackAnalyzer'
import type { AnalysisStatus } from '../../../features/musicIntelligence/types'

// ── Section type display metadata ─────────────────────────────────────────────

const SECTION_COLORS: Record<ReactSectionType, string> = {
  intro:     '#61d6aa',
  verse:     '#4ac7db',
  build:     '#d8b95a',
  preDrop:   '#f0a060',
  drop:      '#c0314a',
  breakdown: '#b84fc9',
  bridge:    '#5b8def',
  outro:     '#80dfc0',
  unknown:   '#6a7a8a',
}

const SECTION_ORDER: ReactSectionType[] = [
  'intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown',
]

// ── Status badge config ────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  not_analyzed: 'Not analyzed',
  queued:       'Queued',
  analyzing:    'Analyzing…',
  complete:     'Analysis complete',
  failed:       'Analysis failed',
  stale:        'Stale',
}

const STATUS_COLORS: Record<AnalysisStatus, string> = {
  not_analyzed: '#6a7a8a',
  queued:       '#d8b95a',
  analyzing:    '#4ac7db',
  complete:     '#61d6aa',
  failed:       '#c0314a',
  stale:        '#f0a060',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function isAutoSection(s: ReactTrackSection): boolean {
  return s.source === 'auto' || s.source === 'mock'
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface AddSectionFormProps {
  onAdd:    (section: ReactTrackSection) => void
  onCancel: () => void
}

function AddSectionForm({ onAdd, onCancel }: AddSectionFormProps) {
  const [type,      setType]      = useState<ReactSectionType>('intro')
  const [label,     setLabel]     = useState('')
  const [startSec,  setStartSec]  = useState(0)
  const [endSec,    setEndSec]    = useState(30)
  const [intensity, setIntensity] = useState(0.7)

  const handleAdd = () => {
    onAdd({
      id:        `section-${Date.now()}`,
      label:     label.trim() || type.charAt(0).toUpperCase() + type.slice(1),
      type,
      startSec,
      endSec,
      intensity,
      source:    'manual',
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
  section:    ReactTrackSection
  isSelected: boolean
  onSelect:   (id: string) => void
  onRemove:   (id: string) => void
}

function SectionChip({ section, isSelected, onSelect, onRemove }: SectionChipProps) {
  const color      = SECTION_COLORS[section.type] ?? '#6a7a8a'
  const isManual   = section.source === 'manual' || section.source == null
  const confidence = section.confidence

  return (
    <div
      className={`rv-section-chip${isSelected ? ' rv-section-chip--selected' : ''}${isManual ? ' rv-section-chip--manual' : ''}`}
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
        {confidence != null && confidence < 1 && (
          <span className="rv-chip-confidence" title="Analysis confidence">
            {Math.round(confidence * 100)}%
          </span>
        )}
        {isManual && (
          <span className="rv-chip-source-badge rv-chip-source-badge--manual">manual</span>
        )}
      </div>
      <button
        className="rv-chip-remove"
        onClick={e => { e.stopPropagation(); onRemove(section.id) }}
        title="Remove section"
      >×</button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ReactTrackMapStripProps {
  audioDurationSec?: number
  audioBuffer?:      AudioBuffer   // required for offline analysis
  trackId?:          string        // key for analysis storage
}

export function ReactTrackMapStrip({
  audioDurationSec = 180,
  audioBuffer,
  trackId,
}: ReactTrackMapStripProps) {
  const {
    manualTrackSections,
    selectedSectionId,
    setSelectedSectionId,
    addManualSection,
    removeManualSection,
    updateManualSection,
  } = useReactStore(useShallow(s => ({
    manualTrackSections:  s.manualTrackSections,
    selectedSectionId:    s.selectedSectionId,
    setSelectedSectionId: s.setSelectedSectionId,
    addManualSection:     s.addManualSection,
    removeManualSection:  s.removeManualSection,
    updateManualSection:  s.updateManualSection,
  })))

  const { getAnalysisStatus, setAnalysisStatus, saveTrackAnalysis } = useTrackAnalysisStore(
    useShallow(s => ({
      getAnalysisStatus: s.getAnalysisStatus,
      setAnalysisStatus: s.setAnalysisStatus,
      saveTrackAnalysis: s.saveTrackAnalysis,
    })),
  )

  const [isAdding,    setIsAdding]    = useState(false)
  const [analysisErr, setAnalysisErr] = useState<string | null>(null)
  const [collapsed,   setCollapsed]   = useState(false)

  const storageKey    = trackId ?? '__default__'
  const analysisStatus = getAnalysisStatus(storageKey)

  // ── Generate mock ──────────────────────────────────────────────────────────
  const handleGenerateMock = useCallback(() => {
    const analysis = generateMockTrackAnalysis(audioDurationSec * 1000)
    const sections = adaptTrackSections(analysis)
    // Replace any existing non-manual sections
    const kept = manualTrackSections.filter(s => !isAutoSection(s))
    kept.forEach(s => removeManualSection(s.id))
    sections.forEach(addManualSection)
  }, [audioDurationSec, manualTrackSections, addManualSection, removeManualSection])

  // ── Real analysis ─────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    if (!audioBuffer) return
    setAnalysisErr(null)
    setAnalysisStatus(storageKey, 'analyzing')
    try {
      const analysis = await analyzeTrackBuffer(audioBuffer)
      saveTrackAnalysis(storageKey, analysis)
      const newSections = adaptMIAnalysis(analysis)
      // Preserve manual sections, replace everything else
      const kept = manualTrackSections.filter(s => !isAutoSection(s))
      manualTrackSections.filter(isAutoSection).forEach(s => removeManualSection(s.id))
      // Force-update kept sections (ids stay the same, store deduplicates)
      kept.forEach(s => updateManualSection(s.id, s))
      newSections.forEach(addManualSection)
      if (analysis.warnings.length > 0) {
        setAnalysisErr(`Warnings: ${analysis.warnings.join('; ')}`)
      }
    } catch (err) {
      setAnalysisStatus(storageKey, 'failed')
      setAnalysisErr(err instanceof Error ? err.message : 'Analysis failed')
    }
  }, [
    audioBuffer, storageKey, manualTrackSections,
    setAnalysisStatus, saveTrackAnalysis, addManualSection,
    removeManualSection, updateManualSection,
  ])

  const handleAdd = (section: ReactTrackSection) => {
    addManualSection(section)
    setIsAdding(false)
  }

  const canAnalyze = !!audioBuffer && analysisStatus !== 'analyzing'
  const isAnalyzing = analysisStatus === 'analyzing'

  return (
    <div className="rv-track-map-strip">
      <div
        className="rv-strip-header rv-strip-header--toggle"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(v => !v) } }}
      >
        <span className="rv-strip-title">Track Map</span>
        <span className="rv-collapse-arrow">{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <>
          <div className="rv-strip-subheader">
            {/* Status badge (shown when a trackId is set or analysis has run) */}
            {analysisStatus !== 'not_analyzed' && (
              <span
                className="rv-analysis-status-badge"
                style={{ color: STATUS_COLORS[analysisStatus] }}
                title={STATUS_LABELS[analysisStatus]}
              >
                {analysisStatus === 'analyzing' ? '◌ Analyzing…' : STATUS_LABELS[analysisStatus]}
              </span>
            )}

            <div className="rv-strip-type-legend">
              {SECTION_ORDER.filter(t => t !== 'unknown').map(t => (
                <span key={t} className="rv-legend-item" style={{ color: SECTION_COLORS[t] }}>
                  {t}
                </span>
              ))}
            </div>

            <div className="rv-strip-actions">
              {/* Analyze Track button — real audio analysis */}
              {canAnalyze && (
                <button
                  className="rv-analyze-btn"
                  onClick={handleAnalyze}
                  title="Analyze audio and generate sections from real features"
                >
                  Analyze Track
                </button>
              )}
              {isAnalyzing && (
                <span className="rv-analyzing-indicator">Analyzing…</span>
              )}

              {/* Generate mock — always available as fallback */}
              {manualTrackSections.filter(s => !isAutoSection(s)).length === 0 && !isAnalyzing && (
                <button
                  className="rv-generate-btn"
                  onClick={handleGenerateMock}
                  title={`Generate mock sections for ${Math.round(audioDurationSec / 60)}:${String(Math.round(audioDurationSec % 60)).padStart(2, '0')} track`}
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

          {/* Analysis error / warning */}
          {analysisErr && (
            <div
              className="rv-analysis-warning"
              style={{ color: analysisStatus === 'failed' ? STATUS_COLORS.failed : STATUS_COLORS.stale }}
            >
              {analysisErr}
            </div>
          )}

          {isAdding && (
            <AddSectionForm
              onAdd={handleAdd}
              onCancel={() => setIsAdding(false)}
            />
          )}

          {manualTrackSections.length === 0 && !isAdding ? (
            <div className="rv-strip-empty">
              No sections defined —
              {audioBuffer ? ' hit <strong>Analyze Track</strong> for real analysis, or' : ''}
              {' '}hit <strong>⚡ Generate</strong> for an auto track map, or <strong>+ Add</strong> to add manually.
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
        </>
      )}
    </div>
  )
}
