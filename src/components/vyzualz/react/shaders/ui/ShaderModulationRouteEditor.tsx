import React from 'react'
import { SliderRow, SelectRow, ToggleRow } from '../../../react/ReactControlRows'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'
import {
  MODULATION_SOURCE_META,
  type ModulationCurve,
  type ModulationMode,
  type ModulationCombineMode,
} from '../modulation/shaderModulationTypes'
import { ShaderModulationMatrix } from '../modulation/ShaderModulationMatrix'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ShaderModulationRouteEditorProps {
  route: ShaderModulationRoute
  definition: ShaderDefinition
  /** Current 0–1 value of the route's source, for live readout. */
  sourceValue: number
  /** Current effective value of the target param (number for float/int, null otherwise). */
  effectiveValue: number | null
  onUpdate: (patch: Partial<ShaderModulationRoute>) => void
  onRemove: () => void
}

// ── Option lists ──────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = MODULATION_SOURCE_META.map(m => ({
  value: m.id,
  label: `${m.group} · ${m.label}`,
}))

const CURVE_OPTIONS: { value: ModulationCurve; label: string }[] = [
  { value: 'linear',      label: 'Linear' },
  { value: 'easeIn',      label: 'Ease In' },
  { value: 'easeOut',     label: 'Ease Out' },
  { value: 'easeInOut',   label: 'Ease In/Out' },
  { value: 'exponential', label: 'Exponential' },
  { value: 'logarithmic', label: 'Logarithmic' },
  { value: 'stepped',     label: 'Stepped' },
]

const MODE_OPTIONS: { value: ModulationMode; label: string }[] = [
  { value: 'continuous', label: 'Continuous' },
  { value: 'trigger',    label: 'Trigger' },
  { value: 'envelope',   label: 'Envelope' },
  { value: 'phase',      label: 'Phase' },
]

const COMBINE_OPTIONS: { value: ModulationCombineMode; label: string }[] = [
  { value: 'add',      label: 'Add' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'replace',  label: 'Replace' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function ShaderModulationRouteEditor({
  route,
  definition,
  sourceValue,
  effectiveValue,
  onUpdate,
  onRemove,
}: ShaderModulationRouteEditorProps) {
  const targetOptions = ShaderModulationMatrix.getModulatableParams(definition).map(p => ({
    value: p.id,
    label: p.label,
  }))

  const isTriggerMode  = route.mode === 'trigger'
  const isEnvelopeMode = route.mode === 'trigger' || route.mode === 'envelope'

  return (
    <div className="shader-mod-route-editor">
      {/* ── Header row ── */}
      <div className="shader-mod-route-header">
        <span className="shader-mod-route-title">
          {route.source} → {route.targetParamId || '(none)'}
        </span>
        <div className="shader-mod-route-header-actions">
          <ToggleRow
            label="On"
            value={route.enabled}
            onChange={v => onUpdate({ enabled: v })}
          />
          <button
            type="button"
            className="shader-mod-route-remove"
            onClick={onRemove}
            title="Remove route"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Live readouts ── */}
      <div className="shader-mod-readouts">
        <span className="shader-mod-readout">
          <span className="shader-mod-readout-label">Source</span>
          <span className="shader-mod-readout-bar">
            <span
              className="shader-mod-readout-fill"
              style={{ width: `${Math.round(sourceValue * 100)}%` }}
            />
          </span>
          <span className="shader-mod-readout-val">{(sourceValue * 100).toFixed(0)}%</span>
        </span>
        {effectiveValue !== null && (
          <span className="shader-mod-readout">
            <span className="shader-mod-readout-label">Effective</span>
            <span className="shader-mod-readout-val">{effectiveValue.toFixed(3)}</span>
          </span>
        )}
      </div>

      {/* ── Routing ── */}
      <SelectRow
        label="Source"
        value={route.source}
        onChange={v => onUpdate({ source: v as ShaderModulationRoute['source'] })}
        options={SOURCE_OPTIONS}
      />
      <SelectRow
        label="Target"
        value={route.targetParamId}
        onChange={v => onUpdate({ targetParamId: v })}
        options={targetOptions}
      />

      {/* ── Signal shaping ── */}
      <SelectRow
        label="Mode"
        value={route.mode}
        onChange={v => onUpdate({ mode: v as ModulationMode })}
        options={MODE_OPTIONS}
      />
      <SelectRow
        label="Curve"
        value={route.curve}
        onChange={v => onUpdate({ curve: v as ModulationCurve })}
        options={CURVE_OPTIONS}
      />
      <SelectRow
        label="Combine"
        value={route.combineMode}
        onChange={v => onUpdate({ combineMode: v as ModulationCombineMode })}
        options={COMBINE_OPTIONS}
      />
      <SliderRow
        label="Amount"
        value={route.amount}
        min={-1} max={1} step={0.01}
        onChange={v => onUpdate({ amount: v })}
      />
      <SliderRow
        label="Out Min"
        value={route.outputMin}
        min={0} max={1} step={0.01}
        onChange={v => onUpdate({ outputMin: v })}
      />
      <SliderRow
        label="Out Max"
        value={route.outputMax}
        min={0} max={1} step={0.01}
        onChange={v => onUpdate({ outputMax: v })}
      />
      <ToggleRow
        label="Invert"
        value={route.invert}
        onChange={v => onUpdate({ invert: v })}
      />

      {/* ── Timing (shown for continuous, trigger, envelope — not phase) ── */}
      {route.mode !== 'phase' && (
        <>
          <SliderRow
            label="Attack (ms)"
            value={route.attackMs}
            min={0} max={2000} step={1}
            onChange={v => onUpdate({ attackMs: v })}
          />
          <SliderRow
            label="Release (ms)"
            value={route.releaseMs}
            min={0} max={5000} step={1}
            onChange={v => onUpdate({ releaseMs: v })}
          />
        </>
      )}
      {isEnvelopeMode && (
        <SliderRow
          label="Hold (ms)"
          value={route.holdMs}
          min={0} max={2000} step={1}
          onChange={v => onUpdate({ holdMs: v })}
        />
      )}
      {isTriggerMode && (
        <ToggleRow
          label="Retrigger"
          value={route.retrigger}
          onChange={v => onUpdate({ retrigger: v })}
        />
      )}
    </div>
  )
}
