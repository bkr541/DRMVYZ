import { useState, useMemo } from 'react'
import type { VzPreset, PresetScope } from '../../../stores/visualStore'
import { SavePresetDialog } from './SavePresetDialog'

function presetHasScene(p: VzPreset): boolean {
  const s = p.scope
  if (!s) return false
  return !!(s.activeMedia || s.mediaOrder || s.audioSource || s.bpm || s.bpmSync || s.quality || s.modulation)
}

type PresetStripProps = {
  activePresetId: string
  presets: VzPreset[]
  onSelect: (id: string) => void
  onSave: (name: string, scope: PresetScope) => void
  onDelete: (id: string) => void
}

export function PresetStrip({ activePresetId, presets, onSelect, onSave, onDelete }: PresetStripProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch]         = useState('')
  const [category, setCategory]     = useState('all')

  const filtered = useMemo(() => {
    let out = presets
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter(p => p.name.toLowerCase().includes(q))
    }
    if (category === 'default') out = out.filter(p =>  p.isDefault)
    if (category === 'custom')  out = out.filter(p => !p.isDefault)
    if (category === 'scene')   out = out.filter(p =>  presetHasScene(p))
    return out
  }, [presets, search, category])

  return (
    <div className="vz-presets-section">
      <div className="vz-presets-header">
        <span className="vz-presets-label">Presets</span>
        <div className="vz-presets-search-wrap">
          <svg className="vz-presets-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
          </svg>
          <input
            className="vz-presets-search"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="az-select vz-presets-cat-select"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="default">Default</option>
          <option value="custom">Custom</option>
          <option value="scene">Scene</option>
        </select>
        {!dialogOpen && (
          <button className="vz-new-preset-btn" onClick={() => setDialogOpen(true)}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            New
          </button>
        )}
      </div>

      {dialogOpen && (
        <SavePresetDialog
          onSave={(name, scope) => { onSave(name, scope); setDialogOpen(false) }}
          onCancel={() => setDialogOpen(false)}
        />
      )}

      <div className="vz-preset-cards">
        {filtered.map(p => (
          <div
            key={p.id}
            className={`vz-preset-card ${activePresetId === p.id ? 'vz-preset-card--active' : ''}`}
            style={{ background: p.gradient ?? p.color }}
            onClick={() => onSelect(p.id)}
            title={p.name + (presetHasScene(p) ? ' · Scene preset' : '')}
          >
            <div className="vz-preset-card-header">
              {presetHasScene(p) && (
                <span className="vz-preset-scene-badge" title="Scene preset">◈</span>
              )}
              {!p.isDefault && (
                <button
                  className="vz-preset-del-btn"
                  onClick={e => { e.stopPropagation(); onDelete(p.id) }}
                  title="Delete"
                >✕</button>
              )}
            </div>
            <div className="vz-preset-card-body">
              <span className="vz-preset-name">{p.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
