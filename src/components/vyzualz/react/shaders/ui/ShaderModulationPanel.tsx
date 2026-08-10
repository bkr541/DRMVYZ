import { IconMorphCheckbox } from '../../controls/IconMorphToggle'
import { IconChipButton } from '../../controls/IconChipButton'
import React, { useState } from 'react'
import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import type { ShaderModulationRoute } from '../modulation/shaderModulationTypes'
import type { ModulationEvaluationFrame } from '../modulation/shaderModulationTypes'
import type { ShaderAudioUniformFrame } from '../audio/shaderAudioTypes'
import type { ShaderPerformanceRuntimeSnapshot } from '../performance/ShaderPerformanceProgramTypes'
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
  performanceSnapshot?: ShaderPerformanceRuntimeSnapshot | null
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
  performanceSnapshot,
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
    const resolvedSource = evaluationFrame?.resolvedSourceByRouteId?.[route.id] ?? route.source
    return (audioFrame as unknown as Record<string, number>)[resolvedSource] ?? 0
  }

  function routeBadge(route: ShaderModulationRoute): string {
    if (!route.enabled) return 'Disabled'
    if (route.origin === 'built-in' || route.id.startsWith('builtin:')) {
      return route.modified ? 'Built-in · Modified' : 'Built-in'
    }
    return route.origin === 'legacy' ? 'Legacy' : 'User'
  }

  function conditionSummary(route: ShaderModulationRoute): string | null {
    const sections = route.conditions?.sectionTypes
    const phases = route.conditions?.sectionPhases
    const parts = [
      sections?.length ? sections.join('/') : null,
      phases?.length ? phases.join('/') : null,
      route.minimumConfidence != null ? `conf ≥ ${route.minimumConfidence.toFixed(2)}` : null,
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : null
  }

  function getEffectiveValue(route: ShaderModulationRoute): number | null {
    if (!evaluationFrame) return null
    const targetId = evaluationFrame.resolvedTargetByRouteId?.[route.id] ?? route.targetParamId
    const result = evaluationFrame.params[targetId]
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
        <IconChipButton
          className="shader-mod-add-btn"
          onClick={handleAdd}
          disabled={modulatableParams.length === 0}
          title={modulatableParams.length === 0
            ? 'This shader has no modulatable parameters'
            : 'Add modulation route'}
        >
          + Route
        </IconChipButton>
      </div>

      {performanceSnapshot?.active && (
        <div className="shader-mod-program-status" data-testid="shader-native-program-status">
          <strong>{performanceSnapshot.programName}</strong>
          <span>{performanceSnapshot.sectionType ?? 'unknown'} · {performanceSnapshot.sectionPhase}</span>
          <span>4-bar {performanceSnapshot.fourBarStage} · 8-bar {performanceSnapshot.eightBarStage} · 16-bar {performanceSnapshot.sixteenBarStage}</span>
          <span>{performanceSnapshot.authoredRouteCount} built-in · {performanceSnapshot.userRouteCount} user</span>
        </div>
      )}

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
                <IconMorphCheckbox
                  checked={route.enabled}
                  aria-label={`${route.enabled ? 'Disable' : 'Enable'} modulation route from ${sourceMeta?.label ?? route.source}`}
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
              <span className="shader-mod-summary-target">
                {evaluationFrame?.resolvedTargetByRouteId?.[route.id] ?? route.targetParamId}
              </span>
              <span className={`shader-mod-route-badge ${route.modified ? 'modified' : ''}`}>
                {routeBadge(route)}
              </span>
              <span className="shader-mod-summary-mode">[{route.mode}]</span>
              {conditionSummary(route) && (
                <span className="shader-mod-route-condition" title="Musical route condition">
                  {conditionSummary(route)}
                </span>
              )}
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
