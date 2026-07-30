import { useState, useMemo } from 'react'
import type { VzPreset, PresetScope } from '../../../stores/visualStore'
import { SavePresetDialog } from './SavePresetDialog'
import { DropdownSelect } from '../../shared/Dropdown/Dropdown'

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
  onClear: () => void
}

export function PresetStrip({ activePresetId, presets, onSelect, onSave, onDelete, onClear }: PresetStripProps) {
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
      {/* Search row — styled like the Media Deck search row */}
      <div className="vz-md-search-row vz-presets-search-row">
        <div className="vz-md-search-wrap">
          <svg className="vz-md-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            className="vz-md-search-input"
            type="text"
            placeholder="Search presets…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search.length > 0 && (
            <button className="vz-md-search-clear" onClick={() => setSearch('')} title="Clear search">✕</button>
          )}
        </div>
        <DropdownSelect
          className="az-select vz-presets-cat-select"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="all">All</option>
          <option value="default">Default</option>
          <option value="custom">Custom</option>
          <option value="scene">Scene</option>
        </DropdownSelect>
        {!dialogOpen && (
          <button className="vz-new-preset-btn" onClick={() => setDialogOpen(true)} title="Save new preset">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        )}
      </div>

      {dialogOpen && (
        <SavePresetDialog
          onSave={(name, scope) => { onSave(name, scope); setDialogOpen(false) }}
          onCancel={() => setDialogOpen(false)}
        />
      )}

      <div className="vz-preset-list">
        {filtered.map(p => {
          const isActive = activePresetId === p.id
          const hasScene = presetHasScene(p)
          return (
            <div
              key={p.id}
              className={`vz-preset-row${isActive ? ' vz-preset-row--active' : ''}`}
              onClick={() => onSelect(p.id)}
              title={p.name + (hasScene ? ' · Scene preset' : '')}
            >
              <span
                className="vz-preset-row-swatch"
                style={{ background: p.gradient ?? p.color }}
              />
              <span className="vz-preset-row-name">{p.name}</span>
              {hasScene && <span className="vz-preset-scene-badge" title="Scene preset">◈</span>}
              <div className="vz-preset-row-actions">
                {isActive && (
                  <button
                    className="vz-preset-action-btn vz-preset-action-btn--clear"
                    onClick={e => { e.stopPropagation(); onClear() }}
                    title="Clear preset"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
                {!p.isDefault && (
                  <button
                    className="vz-preset-action-btn vz-preset-action-btn--delete"
                    onClick={e => { e.stopPropagation(); onDelete(p.id) }}
                    title="Delete preset"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
