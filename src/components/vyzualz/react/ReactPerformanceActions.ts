import type { CinematicWorldMode } from './CinematicWorldConfig'
import type { CanvasPresetId, ReactEngineId } from './ReactTypes'

export type ReactPerformanceActionBehavior = 'momentary' | 'toggle' | 'oneShot'

export type LaserDmxPerformanceActionId =
  | 'blackout' | 'reveal' | 'whiteHit' | 'blinderHit' | 'laserStarburst'
  | 'fanOpen' | 'fanClose' | 'movementVariation' | 'strobeBurst'
  | 'fogBurst' | 'cryoBurst' | 'nextLook' | 'previousLook'

export type CanvasPerformanceActionId = 'selectPreset' | 'restartClip'

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
  /** Generic production-rig command consumed by the LaserDMX action adapter. */
  productionAction?: LaserDmxPerformanceActionId
  /** CANVAS command consumed directly by the React store for live pad triggering. */
  canvasAction?: CanvasPerformanceActionId
  /** CANVAS preset recipe to load when canvasAction is 'selectPreset'. */
  canvasPresetId?: CanvasPresetId
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

const LASER_DMX_TARGET: ReactPerformanceActionTarget = { engineId: 'laserDmx' }
const CANVAS_TARGET: ReactPerformanceActionTarget = { engineId: 'canvas' }

const LASER_DMX_ACTIONS: readonly ReactPerformanceActionDefinition[] = [
  { id: 'laserDmx.blackout', padId: 'pad-1', keyBinding: '1', label: 'Blackout', description: 'Cut all visible production output while virtual movement and atmosphere keep advancing.', color: '#140b19', behavior: 'oneShot', target: LASER_DMX_TARGET, productionAction: 'blackout' },
  { id: 'laserDmx.reveal', padId: 'pad-2', keyBinding: '2', label: 'Reveal', description: 'Reveal the current production look after a blackout.', color: '#58dfff', behavior: 'oneShot', target: LASER_DMX_TARGET, productionAction: 'reveal' },
  { id: 'laserDmx.whiteHit', padId: 'pad-3', keyBinding: '3', label: 'White Hit', description: 'Fire a bounded reserved-white impact across compatible fixtures.', color: '#ffffff', behavior: 'momentary', envelope: { attackMs: 10, holdMs: 70, releaseMs: 260 }, target: LASER_DMX_TARGET, productionAction: 'whiteHit' },
  { id: 'laserDmx.blinderHit', padId: 'pad-4', keyBinding: '4', label: 'Blinder', description: 'Fire the audience blinder group when available.', color: '#fff3c5', behavior: 'momentary', envelope: { attackMs: 10, holdMs: 120, releaseMs: 320 }, target: LASER_DMX_TARGET, productionAction: 'blinderHit' },
  { id: 'laserDmx.laserStarburst', padId: 'pad-5', keyBinding: 'q', label: 'Starburst', description: 'Open the laser bank into a short center-out starburst.', color: '#ff47bf', behavior: 'momentary', envelope: { attackMs: 20, holdMs: 180, releaseMs: 520 }, target: LASER_DMX_TARGET, productionAction: 'laserStarburst' },
  { id: 'laserDmx.fanOpen', padId: 'pad-6', keyBinding: 'w', label: 'Fan Open', description: 'Open the primary laser fan using the rig movement generator.', color: '#21e6ff', behavior: 'oneShot', target: LASER_DMX_TARGET, productionAction: 'fanOpen' },
  { id: 'laserDmx.fanClose', padId: 'pad-7', keyBinding: 'e', label: 'Fan Close', description: 'Fold the primary laser fan inward.', color: '#8957ff', behavior: 'oneShot', target: LASER_DMX_TARGET, productionAction: 'fanClose' },
  { id: 'laserDmx.movementVariation', padId: 'pad-8', keyBinding: 'r', label: 'Variation', description: 'Select a deterministic alternate movement for the main aerial group.', color: '#61d6aa', behavior: 'oneShot', target: LASER_DMX_TARGET, productionAction: 'movementVariation' },
  { id: 'laserDmx.strobeBurst', padId: 'pad-9', keyBinding: 'a', label: 'Strobe', description: 'Fire a bounded triple-hit strobe pattern.', color: '#d9f7ff', behavior: 'momentary', envelope: { attackMs: 5, holdMs: 90, releaseMs: 260 }, target: LASER_DMX_TARGET, productionAction: 'strobeBurst' },
  { id: 'laserDmx.fogBurst', padId: 'pad-10', keyBinding: 's', label: 'Fog', description: 'Trigger localized fog emitters without changing persistent haze.', color: '#c3d5dc', behavior: 'momentary', envelope: { attackMs: 30, holdMs: 500, releaseMs: 900 }, target: LASER_DMX_TARGET, productionAction: 'fogBurst' },
  { id: 'laserDmx.cryoBurst', padId: 'pad-11', keyBinding: 'd', label: 'Cryo', description: 'Trigger a short virtual cryogenic-style plume event.', color: '#eafcff', behavior: 'momentary', envelope: { attackMs: 10, holdMs: 300, releaseMs: 520 }, target: LASER_DMX_TARGET, productionAction: 'cryoBurst' },
  { id: 'laserDmx.previousLook', padId: 'pad-12', keyBinding: 'f', label: 'Prev Look', description: 'Move to the previous authored production look.', color: '#b484ff', behavior: 'oneShot', target: LASER_DMX_TARGET, productionAction: 'previousLook' },
  { id: 'laserDmx.nextLook', padId: 'pad-13', keyBinding: 'z', label: 'Next Look', description: 'Move to the next authored production look.', color: '#ff72ca', behavior: 'oneShot', target: LASER_DMX_TARGET, productionAction: 'nextLook' },
]


const CANVAS_ACTIONS: readonly ReactPerformanceActionDefinition[] = [
  { id: 'canvas.cleanPlayback', padId: 'pad-1', keyBinding: '1', label: 'Clean', description: 'Switch CANVAS to the Clean Playback recipe without touching the loaded track audio.', color: '#e8f4f8', behavior: 'oneShot', target: CANVAS_TARGET, canvasAction: 'selectPreset', canvasPresetId: 'canvas-clean-playback' },
  { id: 'canvas.bassBloom', padId: 'pad-2', keyBinding: '2', label: 'Bloom', description: 'Switch CANVAS to the Bass Bloom recipe for a source-forward bass swell.', color: '#61d6aa', behavior: 'oneShot', target: CANVAS_TARGET, canvasAction: 'selectPreset', canvasPresetId: 'canvas-bass-bloom' },
  { id: 'canvas.ghostEcho', padId: 'pad-3', keyBinding: '3', label: 'Ghost', description: 'Switch CANVAS to the Ghost Echo recipe for trails and transparent motion.', color: '#9ddcff', behavior: 'oneShot', target: CANVAS_TARGET, canvasAction: 'selectPreset', canvasPresetId: 'canvas-ghost-echo' },
  { id: 'canvas.glitchPulse', padId: 'pad-4', keyBinding: '4', label: 'Glitch', description: 'Switch CANVAS to the Glitch Pulse recipe for RGB splits and hard rhythmic energy.', color: '#ff6b9d', behavior: 'oneShot', target: CANVAS_TARGET, canvasAction: 'selectPreset', canvasPresetId: 'canvas-glitch-pulse' },
  { id: 'canvas.lumaMelt', padId: 'pad-17', keyBinding: '5', label: 'Luma', description: 'Switch CANVAS to the Luma Melt recipe for bright threshold smears.', color: '#d8b95a', behavior: 'oneShot', target: CANVAS_TARGET, canvasAction: 'selectPreset', canvasPresetId: 'canvas-luma-melt' },
  { id: 'canvas.frameStutter', padId: 'pad-5', keyBinding: 'q', label: 'Stutter', description: 'Switch CANVAS to the Frame Stutter recipe for clipped rhythmic video motion.', color: '#b84fc9', behavior: 'oneShot', target: CANVAS_TARGET, canvasAction: 'selectPreset', canvasPresetId: 'canvas-frame-stutter' },
  { id: 'canvas.particleAura', padId: 'pad-6', keyBinding: 'w', label: 'Aura', description: 'Switch CANVAS to the Particle Aura recipe and keep the active source selected.', color: '#4ac7db', behavior: 'oneShot', target: CANVAS_TARGET, canvasAction: 'selectPreset', canvasPresetId: 'canvas-particle-aura' },
  { id: 'canvas.restartClip', padId: 'pad-7', keyBinding: 'e', label: 'Restart', description: 'Restart the active CANVAS video clip range without disrupting audio playback.', color: '#ffffff', behavior: 'oneShot', target: CANVAS_TARGET, canvasAction: 'restartClip' },
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

export const REACT_VISUAL_PERFORMANCE_ACTIONS = [...LASER_DMX_ACTIONS, ...CANVAS_ACTIONS, ...RC_ACTIONS] as const

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
    if (action.canvasAction && action.target.engineId !== 'canvas') {
      issues.push({ actionId: action.id, message: 'CANVAS actions must target the CANVAS engine.' })
    }
    if (action.canvasAction === 'selectPreset' && !action.canvasPresetId) {
      issues.push({ actionId: action.id, message: 'CANVAS preset actions require a canvasPresetId.' })
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

export function isFormFieldKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable === true
}
