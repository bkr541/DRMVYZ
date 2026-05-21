import { useState } from 'react'
import { LOOK_SCOPE, SCENE_SCOPE } from '../../../stores/visualStore'
import type { PresetScope } from '../../../stores/visualStore'

const SCOPE_FIELDS: { key: keyof PresetScope; label: string; group: 'look' | 'scene' }[] = [
  { key: 'effects',     label: 'Effects',      group: 'look'  },
  { key: 'enabledFx',   label: 'FX Chain',     group: 'look'  },
  { key: 'modulation',  label: 'Modulation',   group: 'look'  },
  { key: 'activeMedia', label: 'Active Media', group: 'scene' },
  { key: 'mediaOrder',  label: 'Media Order',  group: 'scene' },
  { key: 'audioSource', label: 'Audio Source', group: 'scene' },
  { key: 'bpm',         label: 'BPM',          group: 'scene' },
  { key: 'bpmSync',     label: 'BPM Sync',     group: 'scene' },
  { key: 'quality',     label: 'Quality',      group: 'scene' },
]

type SavePresetDialogProps = {
  onSave: (name: string, scope: PresetScope) => void
  onCancel: () => void
}

export function SavePresetDialog({ onSave, onCancel }: SavePresetDialogProps) {
  const [name, setName]   = useState('')
  const [scope, setScope] = useState<PresetScope>(LOOK_SCOPE)

  const toggleField = (key: keyof PresetScope) =>
    setScope(s => ({ ...s, [key]: !s[key] }))

  const applyQuickScope = (s: PresetScope) => setScope(s)

  const hasScene = SCOPE_FIELDS.some(f => f.group === 'scene' && scope[f.key])

  return (
    <div className="vz-preset-dialog">
      <input
        className="vz-preset-dialog-name"
        placeholder="Preset name…"
        value={name}
        autoFocus
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && name.trim()) onSave(name.trim(), scope)
          if (e.key === 'Escape') onCancel()
        }}
      />

      <div className="vz-preset-dialog-quick">
        <button
          className={`vz-preset-scope-btn${!hasScene ? ' vz-preset-scope-btn--active' : ''}`}
          onClick={() => applyQuickScope(LOOK_SCOPE)}
        >Look</button>
        <button
          className={`vz-preset-scope-btn${hasScene ? ' vz-preset-scope-btn--active' : ''}`}
          onClick={() => applyQuickScope(SCENE_SCOPE)}
        >Scene</button>
      </div>

      <div className="vz-preset-dialog-scope">
        <span className="vz-preset-scope-group-label">Visual</span>
        {SCOPE_FIELDS.filter(f => f.group === 'look').map(f => (
          <label key={f.key} className="vz-preset-scope-row">
            <input type="checkbox" checked={!!scope[f.key]} onChange={() => toggleField(f.key)} />
            {f.label}
          </label>
        ))}
        <span className="vz-preset-scope-group-label" style={{ marginTop: 6 }}>Scene</span>
        {SCOPE_FIELDS.filter(f => f.group === 'scene').map(f => (
          <label key={f.key} className="vz-preset-scope-row">
            <input type="checkbox" checked={!!scope[f.key]} onChange={() => toggleField(f.key)} />
            {f.label}
          </label>
        ))}
      </div>

      <div className="vz-preset-dialog-actions">
        <button className="vz-preset-dialog-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="vz-preset-dialog-save"
          disabled={!name.trim()}
          onClick={() => name.trim() && onSave(name.trim(), scope)}
        >Save</button>
      </div>
    </div>
  )
}
