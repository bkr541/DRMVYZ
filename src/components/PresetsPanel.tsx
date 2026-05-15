import { useRef, useState } from 'react'
import { VisualPreset } from '../types'

interface Props {
  presets: VisualPreset[]
  onSave: (name: string) => void
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onExport: (id: string) => void
  onImport: (json: string) => void
  primaryColor: string
}

export function PresetsPanel({ presets, onSave, onLoad, onDelete, onExport, onImport, primaryColor }: Props) {
  const [newName, setNewName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { if (ev.target?.result) onImport(ev.target.result as string) }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="presets-panel">
      <div className="settings-section-title">VISUAL PRESETS</div>

      <div className="preset-save-row">
        <input
          className="settings-input"
          type="text"
          placeholder="Preset name..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{ '--accent': primaryColor } as React.CSSProperties}
        />
        <button
          className="btn-add"
          onClick={() => { if (newName.trim()) { onSave(newName.trim()); setNewName('') } }}
          style={{ '--accent': primaryColor } as React.CSSProperties}
        >
          Save
        </button>
      </div>

      {presets.length === 0
        ? <div className="playlist-empty">No saved presets</div>
        : (
          <ul className="preset-list">
            {presets.map(p => (
              <li key={p.id} className="preset-item">
                <span className="preset-name">{p.name}</span>
                <span className="preset-date">{new Date(p.createdAt).toLocaleDateString()}</span>
                <div className="preset-actions">
                  <button className="pl-remove" onClick={() => onLoad(p.id)} title="Load"
                    style={{ color: primaryColor }}>↓</button>
                  <button className="pl-remove" onClick={() => onExport(p.id)} title="Export JSON">⤓</button>
                  <button className="pl-remove" onClick={() => onDelete(p.id)} title="Delete">×</button>
                </div>
              </li>
            ))}
          </ul>
        )
      }

      <div className="preset-import-row">
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        <button className="btn-text" onClick={() => fileRef.current?.click()}
          style={{ '--accent': primaryColor } as React.CSSProperties}>
          ↑ Import JSON
        </button>
      </div>
    </div>
  )
}
