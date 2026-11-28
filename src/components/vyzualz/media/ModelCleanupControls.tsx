import { useState } from 'react'
import { selectModelCanCleanup, useModelEditorStore } from '../../../features/models/state/modelEditorStore'
import { IconChipButton } from '../react/controls/IconChipButton'
import { AppIcon } from '../../shared/icons/AppIcon'

export function ModelCleanupControls() {
  const s = useModelEditorStore(), [threshold, setThreshold] = useState(0.1)
  const catalog = s.artifact?.components, enabled = selectModelCanCleanup(s)
  if (!catalog) return null
  const removed = s.artifact?.recipe.cleanup?.excludedComponentIds.length ?? 0
  const selected = s.selectedComponents.length
  return <div className="mm-model-cleanup-controls">
    <div className="mm-model-cleanup-actions">
      <IconChipButton icon={<AppIcon kind="pointer" size={16} />} tone={s.cleanupActive ? 'primary' : 'default'} aria-pressed={s.cleanupActive} title="Select solid elements (Shift-click for multiple)" aria-label="Select solid elements" disabled={!enabled && !s.cleanupActive} onClick={() => s.setCleanupActive(!s.cleanupActive)} />
      <IconChipButton icon={<AppIcon kind="delete" size={16} />} title="Remove selected elements (Delete)" aria-label="Remove selected elements" disabled={!enabled || !selected || selected + removed >= catalog.components.length} onClick={s.removeSelectedComponents} />
      <IconChipButton icon={<AppIcon kind="undo" size={16} />} title="Undo removal" aria-label="Undo removal" disabled={!enabled || !s.cleanupUndo.length} onClick={s.undoCleanup} />
      <IconChipButton icon={<AppIcon kind="redo" size={16} />} title="Redo removal" aria-label="Redo removal" disabled={!enabled || !s.cleanupRedo.length} onClick={s.redoCleanup} />
      <IconChipButton icon={<AppIcon kind="rotateLeft" size={16} />} title="Restore all removed elements" aria-label="Restore all removed elements" disabled={!enabled || !removed} onClick={s.restoreComponents} />
    </div>
    <div className="mm-model-cleanup-stats" role="status"><span><strong>{catalog.components.length - removed}</strong>Elements</span><span><strong>{selected}</strong>Selected</span><span><strong>{removed}</strong>Removed</span></div>
    <label className="mm-model-cleanup-threshold">Small element area <output>{threshold.toFixed(2)}%</output><input type="range" min="0.01" max="5" step="0.01" value={threshold} onChange={event => setThreshold(Number(event.target.value))} disabled={!enabled} /></label>
    <IconChipButton disabled={!enabled} onClick={() => s.selectSmallComponents(threshold)}>Select Small Elements</IconChipButton>
  </div>
}
