import type { ReactPerformancePad } from './ReactTypes'
import { PerformancePad } from './controls/PerformancePad'
import { AppIcon } from '../../shared/icons/AppIcon'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { DualRailCollapsible } from './DualRailCollapsible'
import { resolveActivePerformanceActionTarget, useReactStore } from '../../../stores/reactStore'
import {
  getReactPerformanceActionsForTarget,
  isFormFieldKeyboardTarget,
  isReactPerformanceActionCompatible,
  type ReactPerformanceActionDefinition,
  type ReactPerformanceActionTarget,
} from './ReactPerformanceActions'

export const PERFORMANCE_PAD_KEY_MAP: Readonly<Record<string, string>> = {
  '1': 'pad-1',  '2': 'pad-2',  '3': 'pad-3',  '4': 'pad-4',  '5': 'pad-17',
  'q': 'pad-5',  'w': 'pad-6',  'e': 'pad-7',  'r': 'pad-8',  't': 'pad-18',
  'a': 'pad-9',  's': 'pad-10', 'd': 'pad-11', 'f': 'pad-12', 'g': 'pad-19',
  'z': 'pad-13', 'x': 'pad-14', 'c': 'pad-15', 'v': 'pad-16', 'b': 'pad-20',
}

// Stable slot identities for every production pad surface, independent of the
// selected preset's artwork palette or the currently browsed engine.
const PERFORMANCE_PAD_COLORS = [
  '#5993e8', '#df706d', '#64b98b', '#d9a35e', '#a855f7',
  '#eab308', '#14b8a6', '#ec4899', '#06b6d4', '#8b5cf6',
  '#84cc16', '#f59e0b', '#0ea5e9', '#6366f1', '#10b981',
  '#f43f5e', '#d946ef', '#2dd4bf', '#fb7185', '#38bdf8',
] as const

export function getPerformancePadColor(pad: ReactPerformancePad, index = 0): string {
  const slot = Number(pad.id.replace('pad-', '')) - 1
  return pad.colorAssigned ? pad.color : PERFORMANCE_PAD_COLORS[(Number.isInteger(slot) && slot >= 0 ? slot : index) % PERFORMANCE_PAD_COLORS.length]
}

const PRESSED_DURATION_MS = 40

export type PerformancePadKeyboardRoute =
  | { kind: 'action'; actionId: string }
  | { kind: 'preset'; padId: string }
  | null

export function resolvePerformancePadKeyboardRoute(
  key: string,
  actions: readonly ReactPerformanceActionDefinition[],
): PerformancePadKeyboardRoute {
  const padId = PERFORMANCE_PAD_KEY_MAP[key.toLowerCase()]
  if (!padId) return null
  const action = actions.find(candidate => candidate.padId === padId)
  return action ? { kind: 'action', actionId: action.id } : { kind: 'preset', padId }
}

function contextualHint(target: ReactPerformanceActionTarget, actions: readonly ReactPerformanceActionDefinition[]): string {
  if (actions.length === 0) return '1–5 · Q–R·T · A–F·G · Z–V·B'
  const keys = actions.map(action => action.keyBinding.toUpperCase()).join(' · ')
  const label = target.engineId === 'laserDmx'
    ? 'LaserDMX'
    : target.engineId === 'canvas'
      ? 'CANVAS'
      : 'Reactive Constellation'
  return `${keys} = ${label} actions · remaining slots = presets`
}

export function ReactPerformancePads({ embedded = false, mirror = false, presentation = 'compact', editor }: { embedded?: boolean; mirror?: boolean; presentation?: 'compact' | 'expanded'; editor?: { selectedPadId: string | null; onSelect: (id: string) => void } }) {
  const [collapsed, setCollapsed] = useState(() => !embedded)
  const [pressedActionId, setPressedActionId] = useState<string | null>(null)
  const [heldPadIds, setHeldPadIds] = useState<Set<string>>(new Set())

  const {
    performancePads,
    activePadId,
    setActivePadId,
    activeReactEngineId,
    activeReactPresetId,
    reactPresets,
    cinematicConfigsByPresetId,
    performanceActionEvent,
    performanceActionToggleStates,
    triggerPerformanceAction,
  } = useReactStore(
    useShallow((s) => ({
      performancePads: s.performancePads,
      activePadId: s.activePadId,
      setActivePadId: s.setActivePadId,
      activeReactEngineId: s.activeReactEngineId,
      activeReactPresetId: s.activeReactPresetId,
      reactPresets: s.reactPresets,
      cinematicConfigsByPresetId: s.cinematicConfigsByPresetId,
      performanceActionEvent: s.performanceActionEvent,
      performanceActionToggleStates: s.performanceActionToggleStates,
      triggerPerformanceAction: s.triggerPerformanceAction,
    })),
  )

  const target = useMemo(
    () => resolveActivePerformanceActionTarget({
      activeReactEngineId,
      activeReactPresetId,
      reactPresets,
      cinematicConfigsByPresetId,
    }),
    [activeReactEngineId, activeReactPresetId, reactPresets, cinematicConfigsByPresetId],
  )
  const contextualActions = useMemo(() => getReactPerformanceActionsForTarget(target).filter(action => !performancePads.find(pad => pad.id === action.padId)?.assignmentOverridesAction), [target, performancePads])
  const actionsByPadId = useMemo(
    () => new Map(contextualActions.map(action => [action.padId, action])),
    [contextualActions],
  )

  useEffect(() => {
    if (!performanceActionEvent) return
    const action = contextualActions.find(candidate => candidate.id === performanceActionEvent.actionId)
    if (!action || action.behavior === 'toggle') return
    setPressedActionId(action.id)
    const timerId = window.setTimeout(() => {
      setPressedActionId(current => current === action.id ? null : current)
    }, PRESSED_DURATION_MS)
    return () => window.clearTimeout(timerId)
  }, [performanceActionEvent, contextualActions])

  const fireAction = useCallback((action: ReactPerformanceActionDefinition) => {
    if (!isReactPerformanceActionCompatible(action, target)) return
    triggerPerformanceAction(action.id)
  }, [target, triggerPerformanceAction])

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (isFormFieldKeyboardTarget(event.target) || event.repeat) return
    const route = resolvePerformancePadKeyboardRoute(event.key, contextualActions)
    if (!route) return
    event.preventDefault()
    const heldId = PERFORMANCE_PAD_KEY_MAP[event.key.toLowerCase()]
    setHeldPadIds(current => new Set(current).add(heldId))
    if (route.kind === 'action') {
      const action = contextualActions.find(candidate => candidate.id === route.actionId)
      if (action) fireAction(action)
      return
    }
    setActivePadId(route.padId)
  }, [contextualActions, fireAction, setActivePadId])

  useEffect(() => {
    if (mirror) return
    const releaseKey = (event: KeyboardEvent) => {
      const id = PERFORMANCE_PAD_KEY_MAP[event.key.toLowerCase()]
      if (!id) return
      setHeldPadIds(current => { const next = new Set(current); next.delete(id); return next })
      setPressedActionId(null)
    }
    const releaseAll = () => { setHeldPadIds(new Set()); setPressedActionId(null) }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', releaseKey)
    window.addEventListener('blur', releaseAll)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', releaseKey)
      window.removeEventListener('blur', releaseAll)
    }
  }, [handleKey, mirror])

  const padIcon = (
    <AppIcon kind="grid" size="14" style={{ flexShrink: 0 }} />
  )

  const padButtons = (
    <>
      {performancePads.map((pad, index) => {
            const padColor = getPerformancePadColor(pad, index)
            const action = editor ? undefined : actionsByPadId.get(pad.id)
            if (action) {
              const available = isReactPerformanceActionCompatible(action, target)
              const isToggle = action.behavior === 'toggle'
              const isPressed = isToggle
                ? performanceActionToggleStates[action.id] === true
                : pressedActionId === action.id
              return (
                <PerformancePad
                  key={pad.id} density={presentation} label={action.label} shortcut={action.keyBinding.toUpperCase()}
                  className="rv-pad--action" selected={isToggle && isPressed} pressed={heldPadIds.has(pad.id) || (!isToggle && isPressed)}
                  readOnly={mirror} onActivate={() => fireAction(action)} disabled={!available}
                  aria-disabled={mirror || !available} aria-label={`${action.label}. ${action.description}`}
                  {...(isToggle ? { 'aria-pressed': isPressed } : {})}
                  title={`${action.label} [${action.keyBinding.toUpperCase()}]: ${action.description}`}
                  color={padColor}
                />
              )
            }

            const hasDestination = Boolean(pad.presetId || pad.destination)
            const isActive = hasDestination && pad.id === activePadId
            return (
              <PerformancePad
                key={pad.id} density={presentation} label={pad.label} shortcut={pad.keyBinding.toUpperCase()}
                data-performance-pad-id={pad.id} data-empty={!hasDestination || undefined}
                selected={editor ? editor.selectedPadId === pad.id : isActive} pressed={heldPadIds.has(pad.id)} className={!hasDestination ? 'rv-pad--empty' : ''}
                readOnly={mirror && !editor} onActivate={() => editor ? editor.onSelect(pad.id) : setActivePadId(pad.id)} disabled={!editor && !hasDestination}
                aria-disabled={!editor && (mirror || !hasDestination)}
                title={hasDestination ? `${pad.label} [${pad.keyBinding.toUpperCase()}]` : 'Empty pad'}
                color={padColor}
              />
            )
          })}
    </>
  )

  return (
    <div className={`rv-pads-section${embedded ? ' rv-pads-section--embedded' : ''}${presentation === 'expanded' ? ' rv-pads-section--expanded' : ''}`}>
      {embedded ? (
        <div className="rv-pads-grid">{padButtons}</div>
      ) : (
        <DualRailCollapsible
          className="rv-pads-collapsible"
          open={!collapsed}
          onOpenChange={value => setCollapsed(!value)}
          bodyClassName="rv-pads-grid"
          label={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {padIcon}
              <span className="rv-panel-title">Performance Pads</span>
            </span>
          }
          headerAccessory={<span className="rv-pads-hint">{contextualHint(target, contextualActions)}</span>}
        >
          {padButtons}
        </DualRailCollapsible>
      )}
    </div>
  )
}
