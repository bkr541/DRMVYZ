import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { resolveActivePerformanceActionTarget, useReactStore } from '../../../stores/reactStore'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import { resolveEffectiveReactPresets } from '../../../features/personalization/effectivePalette'
import type { NeonLatticeTriggerType } from './ReactTypes'
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

/** Backward-compatible metadata export used by the existing Neon Lattice tests. */
export const NL_TRIGGER_PADS: Array<{
  padId: string
  trigger: NeonLatticeTriggerType
  label: string
  color: string
}> = getReactPerformanceActionsForTarget({ engineId: 'neonLattice' }).map(action => ({
  padId: action.padId,
  trigger: action.legacyNeonLatticeTrigger!,
  label: action.label,
  color: action.color,
}))

const PRESSED_DURATION_MS = 150

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
  const label = target.engineId === 'laserDmx' ? 'LaserDMX' : target.worldId === 'reactiveConstellation' ? 'Reactive Constellation' : 'Neon Lattice'
  return `${keys} = ${label} actions · remaining slots = presets`
}

export function ReactPerformancePads() {
  const [collapsed, setCollapsed] = useState(true)
  const [pressedActionId, setPressedActionId] = useState<string | null>(null)

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

  const activeBrandKit = useBrandKitStore(state => state.activeKit)
  const effectivePresets = useMemo(
    () => resolveEffectiveReactPresets(reactPresets, activeBrandKit),
    [reactPresets, activeBrandKit],
  )
  const effectivePresetById = useMemo(
    () => new Map(effectivePresets.map(preset => [preset.id, preset])),
    [effectivePresets],
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
  const contextualActions = useMemo(() => getReactPerformanceActionsForTarget(target), [target])
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
    if (route.kind === 'action') {
      const action = contextualActions.find(candidate => candidate.id === route.actionId)
      if (action) fireAction(action)
      return
    }
    setActivePadId(route.padId)
  }, [contextualActions, fireAction, setActivePadId])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div className="rv-pads-section">
      <div
        className="rv-panel-header rv-panel-header--toggle"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(value => !value)}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setCollapsed(value => !value)
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 512 512" fill="#a78bfa" style={{ flexShrink: 0 }}>
          <path d="M217.043,0.001H16.696C7.515,0.001,0,7.479,0,16.697v200.348c0,9.214,7.482,16.693,16.696,16.693h200.348c9.214,0,16.696-7.481,16.696-16.693V16.697C233.739,7.479,226.224,0.001,217.043,0.001z"/>
          <path d="M495.304,0.001H294.957c-9.18,0-16.696,7.477-16.696,16.696v200.348c0,9.214,7.482,16.693,16.696,16.693h200.348c9.214,0,16.696-7.481,16.696-16.693V16.697C512,7.479,504.485,0.001,495.304,0.001z"/>
          <path d="M217.043,278.262H16.696C7.515,278.262,0,285.739,0,294.958v200.348c0,9.214,7.482,16.693,16.696,16.693h200.348c9.214,0,16.696-7.481,16.696-16.693V294.958C233.739,285.739,226.224,278.262,217.043,278.262z"/>
          <path d="M495.304,278.262H294.957c-9.18,0-16.696,7.477-16.696,16.696v200.348c0,9.214,7.482,16.693,16.696,16.693h200.348c9.214,0,16.696-7.481,16.696-16.693V294.958C512,285.739,504.485,278.262,495.304,278.262z"/>
        </svg>
        <span className="rv-panel-title">Performance Pads</span>
        <span className="rv-pads-hint">{contextualHint(target, contextualActions)}</span>
        <span className="rv-collapse-arrow">{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <div className="rv-pads-grid">
          {performancePads.map((pad) => {
            const action = actionsByPadId.get(pad.id)
            if (action) {
              const available = isReactPerformanceActionCompatible(action, target)
              const isToggle = action.behavior === 'toggle'
              const isPressed = isToggle
                ? performanceActionToggleStates[action.id] === true
                : pressedActionId === action.id
              return (
                <button
                  key={pad.id}
                  className={`rv-pad rv-pad--action rv-pad--nl-trigger${isPressed ? ' rv-pad--pressed' : ''}`}
                  onClick={() => fireAction(action)}
                  disabled={!available}
                  aria-label={`${action.label}. ${action.description}`}
                  {...(isToggle ? { 'aria-pressed': isPressed } : {})}
                  title={`${action.label} [${action.keyBinding.toUpperCase()}]: ${action.description}`}
                  style={{ '--pad-color': action.color } as React.CSSProperties}
                >
                  <span className="rv-pad-label">{action.label}</span>
                  <span className="rv-pad-key">{action.keyBinding.toUpperCase()}</span>
                </button>
              )
            }

            const isActive = pad.id === activePadId
            return (
              <button
                key={pad.id}
                className={`rv-pad${isActive ? ' rv-pad--active' : ''}${!pad.presetId ? ' rv-pad--empty' : ''}`}
                onClick={() => pad.presetId && setActivePadId(pad.id)}
                disabled={!pad.presetId}
                title={pad.presetId ? `${pad.label} [${pad.keyBinding.toUpperCase()}]` : 'Empty pad'}
                style={{ '--pad-color': (pad.presetId ? (effectivePresetById.get(pad.presetId)?.palette.accent ?? pad.color) : pad.color) } as React.CSSProperties}
              >
                <span className="rv-pad-label">{pad.label}</span>
                <span className="rv-pad-key">{pad.keyBinding.toUpperCase()}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
