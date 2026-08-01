import { useEffect, useMemo, useState } from 'react'
import {
  defaultPixGridCueAction,
  normalizePixGridActionCue,
  type PixGridActionCue,
  type PixGridActionCueAction,
  type PixGridCueTarget,
  type PixGridCueTransition,
} from './PixGridActionCues'
import type { PixGridState } from './PixGridTypes'
import { DropdownSelect } from '../../../shared/Dropdown/Dropdown'

const ACTION_OPTIONS: ReadonlyArray<{ value: PixGridActionCueAction['type']; label: string }> = [
  { value: 'selectScene', label: 'Select scene' },
  { value: 'setLayerVisible', label: 'Show / hide layer' },
  { value: 'setGroupVisible', label: 'Show / hide group' },
  { value: 'flashGroup', label: 'Flash group' },
  { value: 'revealRows', label: 'Row reveal' },
  { value: 'revealColumns', label: 'Column reveal' },
  { value: 'dissolveGroup', label: 'Dissolve group' },
  { value: 'setPaletteMode', label: 'Set palette mode' },
  { value: 'setBackground', label: 'Set background' },
  { value: 'resetBackground', label: 'Reset background' },
  { value: 'startAnimation', label: 'Start animation' },
  { value: 'stopAnimation', label: 'Stop animation' },
  { value: 'reverseAnimation', label: 'Reverse animation' },
  { value: 'setAnimationSpeed', label: 'Set animation speed' },
  { value: 'jumpAnimationFrame', label: 'Jump animation frame' },
  { value: 'moveTarget', label: 'Move target' },
  { value: 'setTargetScale', label: 'Set target scale' },
  { value: 'setTargetRotation', label: 'Set target rotation' },
  { value: 'freeze', label: 'Freeze / continue' },
  { value: 'clearScreen', label: 'Clear screen' },
  { value: 'restoreScene', label: 'Restore scene' },
  { value: 'setAutoPerformance', label: 'Auto Performance' },
  { value: 'applyManualOverride', label: 'Temporary manual override' },
  { value: 'clearManualOverride', label: 'Clear manual override' },
]

const TRANSITIONS: ReadonlyArray<{ value: PixGridCueTransition; label: string }> = [
  { value: 'cut', label: 'Cut' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'rowWipe', label: 'Row wipe' },
  { value: 'columnWipe', label: 'Column wipe' },
  { value: 'checkerWipe', label: 'Checker wipe' },
  { value: 'pixelDissolve', label: 'Pixel dissolve' },
  { value: 'radialReveal', label: 'Radial reveal' },
  { value: 'paletteFade', label: 'Palette fade' },
  { value: 'powerOn', label: 'Power on' },
  { value: 'powerOff', label: 'Power off' },
]

function numeric(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function targetValue(target: PixGridCueTarget): string {
  if (target === 'all') return 'all'
  if ('layerId' in target) return `layer:${target.layerId}`
  return `group:${target.groupId}`
}

function parseTarget(value: string): PixGridCueTarget {
  if (value.startsWith('layer:')) return { layerId: value.slice(6) }
  if (value.startsWith('group:')) return { groupId: value.slice(6) }
  return 'all'
}

interface TargetFieldProps {
  value: PixGridCueTarget
  state: PixGridState
  onChange: (target: PixGridCueTarget) => void
}

function TargetField({ value, state, onChange }: TargetFieldProps) {
  return (
    <label className="rv-pix-grid-cue-field">
      <span>Target</span>
      <DropdownSelect value={targetValue(value)} onChange={event => onChange(parseTarget(event.target.value))}>
        <option value="all">All layers</option>
        {state.layers.map(layer => <option key={layer.id} value={`layer:${layer.id}`}>Layer · {layer.name}</option>)}
        {state.groups.map(group => <option key={group.id} value={`group:${group.id}`}>Group · {group.name}</option>)}
      </DropdownSelect>
    </label>
  )
}

function ActionFields({ action, state, onChange }: {
  action: PixGridActionCueAction
  state: PixGridState
  onChange: (action: PixGridActionCueAction) => void
}) {
  const layerOptions = state.layers
  const groupOptions = state.groups
  switch (action.type) {
    case 'selectScene':
      return <label className="rv-pix-grid-cue-field"><span>Scene</span><DropdownSelect value={action.sceneId} onChange={event => onChange({ ...action, sceneId: event.target.value })}>{state.scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</DropdownSelect></label>
    case 'setLayerVisible':
      return <><label className="rv-pix-grid-cue-field"><span>Layer</span><DropdownSelect value={action.layerId} onChange={event => onChange({ ...action, layerId: event.target.value })}>{layerOptions.map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}</DropdownSelect></label><label className="rv-pix-grid-cue-check"><input type="checkbox" checked={action.visible} onChange={event => onChange({ ...action, visible: event.target.checked })} /> Visible</label></>
    case 'setGroupVisible':
      return <><label className="rv-pix-grid-cue-field"><span>Group</span><DropdownSelect value={action.groupId} onChange={event => onChange({ ...action, groupId: event.target.value })}>{groupOptions.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</DropdownSelect></label><label className="rv-pix-grid-cue-check"><input type="checkbox" checked={action.visible} onChange={event => onChange({ ...action, visible: event.target.checked })} /> Visible</label></>
    case 'flashGroup':
      return <><label className="rv-pix-grid-cue-field"><span>Group</span><DropdownSelect value={action.groupId} onChange={event => onChange({ ...action, groupId: event.target.value })}>{groupOptions.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</DropdownSelect></label><label className="rv-pix-grid-cue-field"><span>Amount</span><input type="number" min="0" max="2" step="0.05" value={action.amount} onChange={event => onChange({ ...action, amount: numeric(event.target.value, 1) })} /></label></>
    case 'revealRows':
      return <><TargetField value={action.target} state={state} onChange={target => onChange({ ...action, target })} /><label className="rv-pix-grid-cue-field"><span>Origin</span><DropdownSelect value={action.from} onChange={event => onChange({ ...action, from: event.target.value as typeof action.from })}><option value="top">Top</option><option value="bottom">Bottom</option><option value="center">Center</option></DropdownSelect></label></>
    case 'revealColumns':
      return <><TargetField value={action.target} state={state} onChange={target => onChange({ ...action, target })} /><label className="rv-pix-grid-cue-field"><span>Origin</span><DropdownSelect value={action.from} onChange={event => onChange({ ...action, from: event.target.value as typeof action.from })}><option value="left">Left</option><option value="right">Right</option><option value="center">Center</option></DropdownSelect></label></>
    case 'dissolveGroup':
      return <><label className="rv-pix-grid-cue-field"><span>Group</span><DropdownSelect value={action.groupId} onChange={event => onChange({ ...action, groupId: event.target.value })}>{groupOptions.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</DropdownSelect></label><label className="rv-pix-grid-cue-field"><span>Amount</span><input type="number" min="0" max="1" step="0.05" value={action.amount} onChange={event => onChange({ ...action, amount: numeric(event.target.value, 1) })} /></label></>
    case 'setPaletteMode':
      return <label className="rv-pix-grid-cue-field"><span>Palette</span><DropdownSelect value={action.mode} onChange={event => onChange({ ...action, mode: event.target.value as typeof action.mode })}><option value="original">Original</option><option value="hybrid">Hybrid</option><option value="brand">Brand Kit</option><option value="preset">Preset</option></DropdownSelect></label>
    case 'setBackground':
      return <><label className="rv-pix-grid-cue-field"><span>Mode</span><DropdownSelect value={action.mode} onChange={event => onChange({ ...action, mode: event.target.value as typeof action.mode })}><option value="preset">Preset</option><option value="black">Black</option><option value="custom">Custom</option></DropdownSelect></label>{action.mode === 'custom' && <label className="rv-pix-grid-cue-field"><span>Color</span><input type="color" value={action.color ?? '#000000'} onChange={event => onChange({ ...action, color: event.target.value })} /></label>}<label className="rv-pix-grid-cue-field"><span>Brightness</span><input type="number" min="0" max="1" step="0.05" value={action.brightness ?? 0} onChange={event => onChange({ ...action, brightness: numeric(event.target.value, 0) })} /></label></>
    case 'startAnimation':
      return <><TargetField value={action.target} state={state} onChange={target => onChange({ ...action, target })} /><label className="rv-pix-grid-cue-field"><span>Animation</span><DropdownSelect value={action.animation} onChange={event => onChange({ ...action, animation: event.target.value as typeof action.animation })}>{['pulse','bounce','horizontalScroll','verticalScroll','pingPong','rotate','paletteCycle','blink','revealRow','revealColumn','checkerAlternate','columnMeter','frameCycle','audioAmplitudeScale','beatStepMovement'].map(mode => <option key={mode} value={mode}>{mode.replace(/([A-Z])/g, ' $1')}</option>)}</DropdownSelect></label><label className="rv-pix-grid-cue-field"><span>Clock</span><DropdownSelect value={action.clock} onChange={event => onChange({ ...action, clock: event.target.value as typeof action.clock })}><option value="time">Time</option><option value="beat">Beat</option><option value="bar">Bar</option><option value="cue">Cue</option></DropdownSelect></label><label className="rv-pix-grid-cue-field"><span>Speed</span><input type="number" min="-20" max="20" step="0.05" value={action.speed} onChange={event => onChange({ ...action, speed: numeric(event.target.value, 1) })} /></label><label className="rv-pix-grid-cue-field"><span>Amount</span><input type="number" min="-4" max="4" step="0.05" value={action.amount} onChange={event => onChange({ ...action, amount: numeric(event.target.value, 0.25) })} /></label></>
    case 'stopAnimation':
    case 'reverseAnimation':
      return <TargetField value={action.target} state={state} onChange={target => onChange({ ...action, target })} />
    case 'setAnimationSpeed':
      return <><TargetField value={action.target} state={state} onChange={target => onChange({ ...action, target })} /><label className="rv-pix-grid-cue-field"><span>Speed</span><input type="number" min="-20" max="20" step="0.05" value={action.speed} onChange={event => onChange({ ...action, speed: numeric(event.target.value, 1) })} /></label></>
    case 'jumpAnimationFrame':
      return <><TargetField value={action.target} state={state} onChange={target => onChange({ ...action, target })} /><label className="rv-pix-grid-cue-field"><span>Frame</span><input type="number" min="0" max="4096" step="1" value={action.frame} onChange={event => onChange({ ...action, frame: numeric(event.target.value, 0) })} /></label></>
    case 'moveTarget':
      return <><TargetField value={action.target} state={state} onChange={target => onChange({ ...action, target })} /><label className="rv-pix-grid-cue-field"><span>X</span><input type="number" min="-1" max="2" step="0.01" value={action.x ?? 0.5} onChange={event => onChange({ ...action, x: numeric(event.target.value, 0.5) })} /></label><label className="rv-pix-grid-cue-field"><span>Y</span><input type="number" min="-1" max="2" step="0.01" value={action.y ?? 0.5} onChange={event => onChange({ ...action, y: numeric(event.target.value, 0.5) })} /></label></>
    case 'setTargetScale':
      return <><TargetField value={action.target} state={state} onChange={target => onChange({ ...action, target })} /><label className="rv-pix-grid-cue-field"><span>Scale X</span><input type="number" min="0.01" max="4" step="0.01" value={action.x} onChange={event => onChange({ ...action, x: numeric(event.target.value, 1) })} /></label><label className="rv-pix-grid-cue-field"><span>Scale Y</span><input type="number" min="0.01" max="4" step="0.01" value={action.y} onChange={event => onChange({ ...action, y: numeric(event.target.value, 1) })} /></label></>
    case 'setTargetRotation':
      return <><TargetField value={action.target} state={state} onChange={target => onChange({ ...action, target })} /><label className="rv-pix-grid-cue-field"><span>Degrees</span><input type="number" min="-3600" max="3600" step="1" value={action.degrees} onChange={event => onChange({ ...action, degrees: numeric(event.target.value, 0) })} /></label></>
    case 'freeze':
      return <label className="rv-pix-grid-cue-check"><input type="checkbox" checked={action.active} onChange={event => onChange({ ...action, active: event.target.checked })} /> Freeze animation clocks</label>
    case 'setAutoPerformance':
      return <label className="rv-pix-grid-cue-check"><input type="checkbox" checked={action.enabled} onChange={event => onChange({ ...action, enabled: event.target.checked })} /> Auto Performance enabled</label>
    case 'applyManualOverride':
      return <><TargetField value={action.target} state={state} onChange={target => onChange({ ...action, target })} /><label className="rv-pix-grid-cue-field"><span>Route</span><input value={action.route} onChange={event => onChange({ ...action, route: event.target.value })} /></label><label className="rv-pix-grid-cue-field"><span>Duration</span><input type="number" min="0.05" max="3600" step="0.05" value={action.durationSec} onChange={event => onChange({ ...action, durationSec: numeric(event.target.value, 4) })} /></label><label className="rv-pix-grid-cue-field"><span>Opacity</span><input type="number" min="0" max="1" step="0.05" value={action.patch.opacity ?? 1} onChange={event => onChange({ ...action, patch: { ...action.patch, opacity: numeric(event.target.value, 1) } })} /></label></>
    case 'clearManualOverride':
      return <label className="rv-pix-grid-cue-field"><span>Route (optional)</span><input value={action.route ?? ''} onChange={event => onChange({ ...action, route: event.target.value || undefined })} /></label>
    case 'resetBackground':
    case 'clearScreen':
    case 'restoreScene':
      return <p className="rv-pix-grid-cue-note">This action has no additional parameters.</p>
  }
}

export interface PixGridTrackMapCueEditorProps {
  cue: PixGridActionCue
  state: PixGridState
  isNew: boolean
  onSave: (cue: PixGridActionCue) => void
  onCancel: () => void
  onDelete?: () => void
  onDuplicate?: () => void
}

export function PixGridTrackMapCueEditor({ cue, state, isNew, onSave, onCancel, onDelete, onDuplicate }: PixGridTrackMapCueEditorProps) {
  const [draft, setDraft] = useState(cue)
  useEffect(() => setDraft(cue), [cue])
  const actionLabel = useMemo(() => ACTION_OPTIONS.find(option => option.value === draft.action.type)?.label ?? 'PixGrid action', [draft.action.type])
  const setAction = (action: PixGridActionCueAction) => setDraft(current => ({ ...current, action }))

  return (
    <div className="rv-pix-grid-cue-editor" role="dialog" aria-label={`${isNew ? 'Create' : 'Edit'} PixGrid action cue`}>
      <div className="rv-timeline-editor-heading">
        <span>{isNew ? 'New PixGrid Cue' : 'PixGrid Cue'}</span>
        <button type="button" className="rv-timeline-editor-close" onClick={onCancel} aria-label="Close PixGrid cue editor">×</button>
      </div>
      <div className="rv-pix-grid-cue-grid">
        <label className="rv-pix-grid-cue-field"><span>Label</span><input value={draft.label} onChange={event => setDraft(current => ({ ...current, label: event.target.value }))} /></label>
        <label className="rv-pix-grid-cue-field"><span>Time</span><input type="number" min="0" step="0.001" value={draft.timeSec} onChange={event => setDraft(current => ({ ...current, timeSec: numeric(event.target.value, 0) }))} /></label>
        <label className="rv-pix-grid-cue-field"><span>Action</span><DropdownSelect value={draft.action.type} onChange={event => setAction(defaultPixGridCueAction(event.target.value as PixGridActionCueAction['type']))}>{ACTION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownSelect></label>
        <label className="rv-pix-grid-cue-field"><span>Quantize</span><DropdownSelect value={draft.quantization} onChange={event => setDraft(current => ({ ...current, quantization: event.target.value as PixGridActionCue['quantization'] }))}><option value="none">Free</option><option value="beat">Beat</option><option value="bar">Bar</option><option value="fourBars">4 bars</option></DropdownSelect></label>
        <label className="rv-pix-grid-cue-field"><span>Transition</span><DropdownSelect value={draft.transition} onChange={event => setDraft(current => ({ ...current, transition: event.target.value as PixGridCueTransition }))}>{TRANSITIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</DropdownSelect></label>
        <label className="rv-pix-grid-cue-field"><span>Transition sec</span><input type="number" min="0" max="60" step="0.05" value={draft.transitionDurationSec} onChange={event => setDraft(current => ({ ...current, transitionDurationSec: numeric(event.target.value, 0) }))} /></label>
        <label className="rv-pix-grid-cue-field"><span>Action sec</span><input type="number" min="0.02" max="60" step="0.05" value={draft.oneShotDurationSec} onChange={event => setDraft(current => ({ ...current, oneShotDurationSec: numeric(event.target.value, 0.5) }))} /></label>
        <label className="rv-pix-grid-cue-field"><span>Loop</span><DropdownSelect value={draft.loopBehavior} onChange={event => setDraft(current => ({ ...current, loopBehavior: event.target.value as PixGridActionCue['loopBehavior'] }))}><option value="retrigger">Retrigger</option><option value="once">Once per load</option></DropdownSelect></label>
        <label className="rv-pix-grid-cue-check"><input type="checkbox" checked={draft.enabled} onChange={event => setDraft(current => ({ ...current, enabled: event.target.checked }))} /> Enabled</label>
        <label className="rv-pix-grid-cue-field"><span>Marker</span><input type="color" value={draft.color ?? '#4ac7db'} onChange={event => setDraft(current => ({ ...current, color: event.target.value }))} /></label>
      </div>
      <div className="rv-pix-grid-cue-action-heading">{actionLabel}</div>
      <div className="rv-pix-grid-cue-grid rv-pix-grid-cue-grid--action">
        <ActionFields action={draft.action} state={state} onChange={setAction} />
      </div>
      <div className="rv-pix-grid-cue-actions">
        {!isNew && onDelete && <button type="button" className="rv-timeline-tool-btn rv-timeline-tool-btn--danger" onClick={onDelete}>Delete</button>}
        {!isNew && onDuplicate && <button type="button" className="rv-timeline-tool-btn" onClick={onDuplicate}>Duplicate</button>}
        <span />
        <button type="button" className="rv-timeline-tool-btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="rv-timeline-tool-btn rv-timeline-tool-btn--accent" onClick={() => onSave(normalizePixGridActionCue(draft, draft.order) ?? draft)}>Save Cue</button>
      </div>
    </div>
  )
}
