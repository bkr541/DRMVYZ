import React, { useState } from 'react'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'
import type { ModulationEvaluationFrame } from '../modulation/shaderModulationTypes'
import type { ShaderAudioUniformFrame } from '../audio/shaderAudioTypes'
import {
  createModulationRoute,
  MODULATION_SOURCE_META,
} from '../modulation/shaderModulationTypes'
import { ShaderModulationMatrix } from '../modulation/ShaderModulationMatrix'
import { ShaderModulationRouteEditor } from './ShaderModulationRouteEditor'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ShaderModulationPanelProps {
  /** The currently active shader scene definition. */
  definition: ShaderDefinition
  /** All modulation routes for this scene. */
  routes: readonly ShaderModulationRoute[]
  /** Live audio frame for source value readouts. */
  audioFrame: ShaderAudioUniformFrame
  /** Latest evaluation result — used for effective-value readouts. */
  evaluationFrame: ModulationEvaluationFrame | null
  onAddRoute:    (route: ShaderModulationRoute) => void
  onUpdateRoute: (id: string, patch: Partial<ShaderModulationRoute>) => void
  onRemoveRoute: (id: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ShaderModulationPanel({
  definition,
  routes,
  audioFrame,
  evaluationFrame,
  onAddRoute,
  onUpdateRoute,
  onRemoveRoute,
}: ShaderModulationPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const modulatableParams = ShaderModulationMatrix.getModulatableParams(definition)

  function handleAdd() {
    if (modulatableParams.length === 0) return
    const route = createModulationRoute({
      source:       'energy',
      targetParamId: modulatableParams[0].id,
    })
    onAddRoute(route)
    setExpandedId(route.id)
  }

  function getSourceValue(route: ShaderModulationRoute): number {
    return (audioFrame as unknown as Record<string, number>)[route.source] ?? 0
  }

  function getEffectiveValue(route: ShaderModulationRoute): number | null {
    if (!evaluationFrame) return null
    const result = evaluationFrame.params[route.targetParamId]
    if (!result) return null
    const v = result.effectiveValue
    return typeof v === 'number' ? v : null
  }

  return (
    <div className="rv-ctrl-group shader-mod-panel">
      {/* ── Header ── */}
      <div className="shader-mod-panel-header">
        <span className="shader-mod-panel-title">Modulation</span>
        <span className="shader-mod-panel-count">
          {routes.filter(r => r.enabled).length}/{routes.length} active
        </span>
        <button
          type="button"
          className="rv-glyph-upload-btn shader-mod-add-btn"
          onClick={handleAdd}
          disabled={modulatableParams.length === 0}
          title={modulatableParams.length === 0
            ? 'This shader has no modulatable parameters'
            : 'Add modulation route'}
        >
          + Route
        </button>
      </div>

      {/* ── Empty state ── */}
      {routes.length === 0 && (
        <div className="rv-ctrl-info shader-mod-empty">
          {modulatableParams.length === 0
            ? 'No modulatable parameters in this shader.'
            : 'No modulation routes. Click "+ Route" to add one.'}
        </div>
      )}

      {/* ── Route list ── */}
      {routes.map(route => {
        const isExpanded = expandedId === route.id
        const sourceVal  = getSourceValue(route)
        const effVal     = getEffectiveValue(route)
        const sourceMeta = MODULATION_SOURCE_META.find(m => m.id === route.source)

        return (
          <div
            key={route.id}
            className={`shader-mod-route ${route.enabled ? 'enabled' : 'disabled'}`}
          >
            {/* ── Collapsed summary row ── */}
            <div
              className="shader-mod-route-summary"
              onClick={() => setExpandedId(isExpanded ? null : route.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setExpandedId(isExpanded ? null : route.id)}
            >
              <span className="shader-mod-summary-toggle">{isExpanded ? '▾' : '▸'}</span>
              <span className="shader-mod-summary-enabled">
                <input
                  type="checkbox"
                  checked={route.enabled}
                  onChange={e => {
                    e.stopPropagation()
                    onUpdateRoute(route.id, { enabled: e.target.checked })
                  }}
                  onClick={e => e.stopPropagation()}
                />
              </span>
              <span className="shader-mod-summary-source">
                {sourceMeta?.label ?? route.source}
              </span>
              <span className="shader-mod-summary-arrow">→</span>
              <span className="shader-mod-summary-target">{route.targetParamId}</span>
              <span className="shader-mod-summary-mode">[{route.mode}]</span>
              {/* Mini bar for live source value */}
              <span className="shader-mod-summary-bar">
                <span
                  className="shader-mod-summary-bar-fill"
                  style={{ width: `${Math.round(sourceVal * 100)}%` }}
                />
              </span>
            </div>

            {/* ── Expanded editor ── */}
            {isExpanded && (
              <ShaderModulationRouteEditor
                route={route}
                definition={definition}
                sourceValue={sourceVal}
                effectiveValue={effVal}
                onUpdate={patch => onUpdateRoute(route.id, patch)}
                onRemove={() => {
                  onRemoveRoute(route.id)
                  setExpandedId(null)
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
