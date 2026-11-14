import { useReactStore } from '../../../stores/reactStore'
import { AppIcon } from '../../shared/icons/AppIcon'
import { DualRailCollapsible } from '../react/DualRailCollapsible'
import { getPerformancePadColor } from '../react/ReactPerformancePads'
import { PaletteColorRow } from '../react/ReactControlRows'
import { REACT_ENGINE_CATALOG } from '../react/reactEngineCatalog'
import { getAllPerformancePresets, isPadPreset } from './performanceManagerPresets'

export function PerformancePadEditor({ padId }: { padId: string | null }) {
  const pad = useReactStore(s => s.performancePads.find(p => p.id === padId))
  const livePresets = useReactStore(s => s.reactPresets)
  if (!pad) return <div className="rv-preset-library-empty" role="status">Select a performance pad to edit.</div>
  const preset = getAllPerformancePresets(livePresets).find(p => isPadPreset(pad, p))
  const assigned = Boolean(pad.presetId || pad.destination)
  return <DualRailCollapsible label="Performance Pad" icon={<AppIcon kind="grid" size={15} />}>
    <dl className="pfm-pad-details">
      <div><dt>Pad</dt><dd>{pad.id.replace('pad-', '')}</dd></div>
      <div><dt>Number / letter</dt><dd>{pad.keyBinding.toUpperCase()}</dd></div>
      <div><dt>Assigned preset</dt><dd>{assigned ? preset?.name ?? pad.label : 'Empty'}</dd></div>
      <div><dt>Engine</dt><dd>{preset ? REACT_ENGINE_CATALOG[preset.engineId].label : pad.destination ? REACT_ENGINE_CATALOG[pad.destination.engineId]?.label : '—'}</dd></div>
    </dl>
    <PaletteColorRow key={pad.id} label="Pad color" value={getPerformancePadColor(pad)} description="The same color can be used on multiple pads." onChange={color => useReactStore.getState().updatePerformancePad(pad.id, { color, colorAssigned: true })} />
  </DualRailCollapsible>
}
