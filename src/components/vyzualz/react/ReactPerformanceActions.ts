import type { CinematicWorldMode } from './CinematicWorldConfig'
import type { NeonLatticeTriggerType, ReactEngineId } from './ReactTypes'

export type ReactPerformanceActionBehavior = 'momentary' | 'toggle' | 'oneShot'

export interface ReactPerformanceActionEnvelope {
  attackMs: number
  holdMs: number
  releaseMs: number
}

export interface ReactPerformanceActionTarget {
  engineId: ReactEngineId
  worldId?: CinematicWorldMode
}

export interface ReactPerformanceActionDefinition {
  id: string
  label: string
  description: string
  color: string
  padId: string
  keyBinding: string
  behavior: ReactPerformanceActionBehavior
  target: ReactPerformanceActionTarget
  envelope?: ReactPerformanceActionEnvelope
  exclusiveGroup?: string
  /** Compatibility metadata used only by the legacy Neon Lattice wrapper. */
  legacyNeonLatticeTrigger?: NeonLatticeTriggerType
}

export interface ReactPerformanceActionEvent {
  actionId: string
  sequence: number
  target: ReactPerformanceActionTarget
  triggeredAtMs: number
  toggleState?: boolean
}

const PAD_KEY_BINDINGS: Readonly<Record<string, string>> = {
  'pad-1': '1', 'pad-2': '2', 'pad-3': '3', 'pad-4': '4', 'pad-17': '5',
  'pad-5': 'q', 'pad-6': 'w', 'pad-7': 'e', 'pad-8': 'r', 'pad-18': 't',
  'pad-9': 'a', 'pad-10': 's', 'pad-11': 'd', 'pad-12': 'f', 'pad-19': 'g',
  'pad-13': 'z', 'pad-14': 'x', 'pad-15': 'c', 'pad-16': 'v', 'pad-20': 'b',
}

const NL_ACTIONS: readonly ReactPerformanceActionDefinition[] = [
  { id: 'neonLattice.railBurst',    padId: 'pad-1', keyBinding: '1', label: 'Rail Burst',  description: 'Launch a bounded burst of vertical and horizontal neon rails.', color: '#4ac7db', behavior: 'oneShot', target: { engineId: 'neonLattice' }, legacyNeonLatticeTrigger: 'railBurst' },
  { id: 'neonLattice.blockCascade', padId: 'pad-2', keyBinding: '2', label: 'Cascade',     description: 'Launch one deterministic neon block cascade pattern.', color: '#61d6aa', behavior: 'oneShot', target: { engineId: 'neonLattice' }, legacyNeonLatticeTrigger: 'blockCascade' },
  { id: 'neonLattice.crossFlare',   padId: 'pad-3', keyBinding: '3', label: 'Cross Flare', description: 'Flash a bright crossing flare at active rail intersections.', color: '#e8f4f8', behavior: 'oneShot', target: { engineId: 'neonLattice' }, legacyNeonLatticeTrigger: 'crossFlare' },
  { id: 'neonLattice.whiteout',     padId: 'pad-4', keyBinding: '4', label: 'Whiteout',    description: 'Fire the existing bounded Neon Lattice whiteout sequence.', color: '#ffffff', behavior: 'oneShot', target: { engineId: 'neonLattice' }, legacyNeonLatticeTrigger: 'whiteout' },
  { id: 'neonLattice.blackout',     padId: 'pad-5', keyBinding: 'q', label: 'Blackout',    description: 'Fire the existing bounded Neon Lattice blackout sequence.', color: '#1a0a2e', behavior: 'oneShot', target: { engineId: 'neonLattice' }, legacyNeonLatticeTrigger: 'blackout' },
  { id: 'neonLattice.reseed',       padId: 'pad-6', keyBinding: 'w', label: 'Reseed',      description: 'Regenerate the Neon Lattice from its deterministic trigger sequence.', color: '#b84fc9', behavior: 'oneShot', target: { engineId: 'neonLattice' }, legacyNeonLatticeTrigger: 'reseed' },
  { id: 'neonLattice.freezeTrails', padId: 'pad-7', keyBinding: 'e', label: 'Freeze',      description: 'Fire the existing bounded trail-freeze sequence.', color: '#80c8ff', behavior: 'oneShot', target: { engineId: 'neonLattice' }, legacyNeonLatticeTrigger: 'freezeTrails' },
  { id: 'neonLattice.cyanStrike',   padId: 'pad-8', keyBinding: 'r', label: 'Cyan Strike', description: 'Temporarily drive the lattice into its cyan strike look.', color: '#00ffee', behavior: 'oneShot', target: { engineId: 'neonLattice' }, legacyNeonLatticeTrigger: 'cyanStrike' },
]

const RC_TARGET: ReactPerformanceActionTarget = {
  engineId: 'cinematicPortal',
  worldId: 'reactiveConstellation',
}

const RC_ACTIONS: readonly ReactPerformanceActionDefinition[] = [
  { id: 'reactiveConstellation.collapse',    padId: 'pad-1',  keyBinding: '1', label: 'Collapse',     description: 'Pull the crystalline network inward, then release it elastically.', color: '#d94a8c', behavior: 'momentary', envelope: { attackMs: 70, holdMs: 180, releaseMs: 620 }, target: RC_TARGET },
  { id: 'reactiveConstellation.burst',       padId: 'pad-2',  keyBinding: '2', label: 'Burst',        description: 'Kick the connected sculpture outward with a bright impulse.', color: '#ff5c7a', behavior: 'momentary', envelope: { attackMs: 25, holdMs: 90, releaseMs: 520 }, target: RC_TARGET },
  { id: 'reactiveConstellation.reseed',      padId: 'pad-3',  keyBinding: '3', label: 'Reseed',       description: 'Build one deterministic new graph from the action sequence.', color: '#b75cff', behavior: 'oneShot', target: RC_TARGET },
  { id: 'reactiveConstellation.freeze',      padId: 'pad-4',  keyBinding: '4', label: 'Freeze',       description: 'Hold simulation and historical trails while audio transport continues.', color: '#74c7ff', behavior: 'toggle', target: RC_TARGET },
  { id: 'reactiveConstellation.beamFan',     padId: 'pad-5',  keyBinding: 'q', label: 'Beam Fan',     description: 'Open a persistent fan of brighter, wider historical beams.', color: '#ff3ea5', behavior: 'toggle', target: RC_TARGET },
  { id: 'reactiveConstellation.crystalOnly', padId: 'pad-6',  keyBinding: 'w', label: 'Crystal Only', description: 'Temporarily hide the network beams and leave the crystal sculpture.', color: '#8ddcff', behavior: 'toggle', exclusiveGroup: 'reactiveConstellation.renderMode', target: RC_TARGET },
  { id: 'reactiveConstellation.edgesOnly',   padId: 'pad-7',  keyBinding: 'e', label: 'Edges Only',   description: 'Temporarily hide crystal faces and leave the emissive network.', color: '#ff4fa3', behavior: 'toggle', exclusiveGroup: 'reactiveConstellation.renderMode', target: RC_TARGET },
  { id: 'reactiveConstellation.paletteFlip', padId: 'pad-8',  keyBinding: 'r', label: 'Palette Flip', description: 'Swap the live primary and secondary palette roles without editing the preset.', color: '#9d76ff', behavior: 'toggle', target: RC_TARGET },
  { id: 'reactiveConstellation.whiteFlash',  padId: 'pad-9',  keyBinding: 'a', label: 'White Flash',  description: 'Fire a bounded white flash over the final performance composition.', color: '#ffffff', behavior: 'momentary', envelope: { attackMs: 15, holdMs: 45, releaseMs: 260 }, target: RC_TARGET },
  { id: 'reactiveConstellation.blackout',    padId: 'pad-10', keyBinding: 's', label: 'Blackout',     description: 'Toggle a temporary full blackout without changing the saved preset.', color: '#130b1d', behavior: 'toggle', target: RC_TARGET },
]

export const REACT_VISUAL_PERFORMANCE_ACTIONS = [...NL_ACTIONS, ...RC_ACTIONS] as const

export interface ReactPerformanceActionRegistryValidationIssue {
  actionId: string
  message: string
}

export function validateReactPerformanceActionRegistry(
  actions: readonly ReactPerformanceActionDefinition[] = REACT_VISUAL_PERFORMANCE_ACTIONS,
): ReactPerformanceActionRegistryValidationIssue[] {
  const issues: ReactPerformanceActionRegistryValidationIssue[] = []
  const ids = new Set<string>()
  const targetSlots = new Set<string>()

  for (const action of actions) {
    if (!action.id.trim()) issues.push({ actionId: action.id, message: 'Action ID is required.' })
    if (ids.has(action.id)) issues.push({ actionId: action.id, message: 'Action ID must be unique.' })
    ids.add(action.id)

    const expectedKey = PAD_KEY_BINDINGS[action.padId]
    if (!expectedKey) issues.push({ actionId: action.id, message: `Unknown pad slot ${action.padId}.` })
    if (expectedKey && expectedKey !== action.keyBinding.toLowerCase()) {
      issues.push({ actionId: action.id, message: `Keyboard binding ${action.keyBinding} does not match ${action.padId}.` })
    }

    const targetKey = `${action.target.engineId}:${action.target.worldId ?? '*'}:${action.padId}`
    if (targetSlots.has(targetKey)) issues.push({ actionId: action.id, message: 'Only one action may occupy a contextual pad slot for the same target.' })
    targetSlots.add(targetKey)

    if (action.target.worldId && action.target.engineId !== 'cinematicPortal') {
      issues.push({ actionId: action.id, message: 'World-specific actions must target the cinematicPortal engine.' })
    }
    if (action.behavior === 'momentary') {
      const envelope = action.envelope
      if (!envelope || envelope.attackMs < 0 || envelope.holdMs < 0 || envelope.releaseMs <= 0) {
        issues.push({ actionId: action.id, message: 'Momentary actions require a bounded attack, hold, and positive release envelope.' })
      }
    }
  }
  return issues
}

const REGISTRY_ISSUES = validateReactPerformanceActionRegistry()
if (REGISTRY_ISSUES.length > 0) {
  throw new Error(`Invalid React performance action registry: ${REGISTRY_ISSUES.map(issue => `${issue.actionId}: ${issue.message}`).join('; ')}`)
}

const ACTIONS_BY_ID = new Map(REACT_VISUAL_PERFORMANCE_ACTIONS.map(action => [action.id, action]))

export function getReactPerformanceAction(actionId: string): ReactPerformanceActionDefinition | null {
  return ACTIONS_BY_ID.get(actionId) ?? null
}

export function isReactPerformanceActionCompatible(
  action: ReactPerformanceActionDefinition,
  target: ReactPerformanceActionTarget,
): boolean {
  return action.target.engineId === target.engineId
    && (action.target.worldId == null || action.target.worldId === target.worldId)
}

export function getReactPerformanceActionsForTarget(
  target: ReactPerformanceActionTarget,
): ReactPerformanceActionDefinition[] {
  return REACT_VISUAL_PERFORMANCE_ACTIONS
    .filter(action => isReactPerformanceActionCompatible(action, target))
    .sort((a, b) => Number(a.padId.slice(4)) - Number(b.padId.slice(4)))
}

export const NEON_LATTICE_ACTION_ID_BY_TRIGGER: Readonly<Record<NeonLatticeTriggerType, string>> = Object.freeze(
  Object.fromEntries(NL_ACTIONS.map(action => [action.legacyNeonLatticeTrigger!, action.id])) as Record<NeonLatticeTriggerType, string>,
)

export function neonLatticeTriggerFromPerformanceEvent(
  event: ReactPerformanceActionEvent | null | undefined,
): { type: NeonLatticeTriggerType; seq: number } | null {
  if (!event) return null
  const action = getReactPerformanceAction(event.actionId)
  if (!action?.legacyNeonLatticeTrigger || !isReactPerformanceActionCompatible(action, event.target)) return null
  return { type: action.legacyNeonLatticeTrigger, seq: event.sequence }
}

export function isFormFieldKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable === true
}
