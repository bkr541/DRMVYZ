import { useState } from 'react'
import { selectModelCanCleanup, useModelEditorStore } from '../../../features/models/state/modelEditorStore'
import { IconChipButton } from '../react/controls/IconChipButton'

/** The stage and inspector share the same selection and non-destructive recipe actions. */
export function ModelCleanupControls({ compact = false }: { compact?: boolean }) {
  const s = useModelEditorStore(), [threshold, setThreshold] = useState(0.1)
  const catalog = s.artifact?.components
  const enabled = selectModelCanCleanup(s)
  if (!catalog) return null
  const removed = s.artifact?.recipe.cleanup?.excludedComponentIds.length ?? 0
  const selected = s.selectedComponents.length
  const single = selected === 1 ? catalog.components.find(c => c.id === s.selectedComponents[0]) : undefined
  return <div className={compact ? 'mm-model-cleanup-toolbar' : 'mm-model-cleanup-controls'}>
    <div className="mm-model-cleanup-actions">
      <IconChipButton tone={s.cleanupActive ? 'primary' : 'default'} aria-pressed={s.cleanupActive} disabled={!enabled && !s.cleanupActive} onClick={() => s.setCleanupActive(!s.cleanupActive)}>Geometry Cleanup</IconChipButton>
      {s.cleanupActive && <IconChipButton className="mm-model-remove" disabled={!enabled || !selected || selected + removed >= catalog.components.length} onClick={s.removeSelectedComponents}>Remove{selected ? ` (${selected})` : ''}</IconChipButton>}
      <IconChipButton disabled={!enabled || !s.cleanupUndo.length} onClick={s.undoCleanup}>Undo</IconChipButton>
      <IconChipButton disabled={!enabled || !s.cleanupRedo.length} onClick={s.redoCleanup}>Redo</IconChipButton>
    </div>
    {(!compact || s.cleanupActive) && <p role="status">{catalog.components.length - removed} solid elements · {selected} selected · {removed} removed{single ? ` · ${(single.relativeArea * 100).toFixed(3)}% of source area` : ''}</p>}
    {s.cleanupNotice && <p role="alert">{s.cleanupNotice}</p>}
    {s.cleanupActive && <p>Click an element to select it. Shift-click for multiple; drag to orbit. Delete removes selected elements; Escape exits cleanup. At least one element must remain.</p>}
    {!compact && <><label className="mm-model-cleanup-threshold">Small element area (% of source) <output>{threshold.toFixed(2)}%</output><input type="range" min="0.01" max="5" step="0.01" value={threshold} onChange={event => setThreshold(Number(event.target.value))} disabled={!enabled} /></label>
      <IconChipButton disabled={!enabled} onClick={() => s.selectSmallComponents(threshold)}>Select Small Elements</IconChipButton>
      <IconChipButton disabled={!enabled || !removed} onClick={s.restoreComponents}>Restore All Removed Elements</IconChipButton>
      <p>Only disconnected solid elements can be removed. Holes and details attached to a larger solid are not separate elements.</p></>}
  </div>
}
