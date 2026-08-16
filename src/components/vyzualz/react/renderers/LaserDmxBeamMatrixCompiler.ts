/**
 * Beam Matrix frame compiler.
 * Produces CompiledLaserDmxBeamMatrixResult from BeamMatrixSettings + MI data.
 *
 * Never writes to Zustand.
 * The saved beam objects are never mutated — coordinate offsets from modulation
 * routes are accumulated into temporary fields and discarded after compilation.
 * All output values are guaranteed finite (NaN/Infinity replaced before output).
 *
 * Compilation order per beam:
 *   1. Beam base settings
 *   2. Matrix global output settings
 *   3. Global modulation routes (modify global output and fog state)
 *   4. Reaction group: enabled / muted / solo gate
 *   5. Reaction group color override
 *   6. Reaction group modulation routes (applied PER BEAM relative to beam base)
 *   7. Beam-level modulation routes
 *   8. Safety clamp
 *   9. Strobe + flicker visibility
 *  10. Final finite-value validation
 *
 * Group route semantics:
 *   Group routes are stored as (target, value, mode) operations and applied to
 *   each beam individually via applyBeamRoute.  This preserves add/multiply
 *   semantics relative to each beam's own saved base value.
 *   Example: Beam A dimmer=1.0, Beam B dimmer=0.5, group multiply 0.8
 *   → Beam A: 0.8, Beam B: 0.4  (not both 0.8).
 *
 * White channel:
 *   Stored separately in BeamState.white (0–255).  After all routes, white is
 *   added to RGB.  Supports set/add/multiply/trigger modes.
 *
 * Coordinate offsets (originOffsetX/Y, targetOffsetX/Y):
 *   Route values are NORMALIZED (viewport-relative).  1.0 = one full canvas
 *   width (X) or height (Y).  Use ranges like min:-0.1 max:0.1 for a ±10%
 *   sweep.  The compiler multiplies by canvasWidth/Height before applying to
 *   canvas pixel coordinates, so movement stays proportional on any canvas size.
 *
 * Travel direction:
 *   Every animated beam progresses from its saved fixture origin toward its
 *   saved target. Legacy reverse/alternate data is ignored during compilation.
 *
 * Travel duration (beatsPerTravel) in sequenced mode:
 *   The sequence gate controls activation; beatsPerTravel controls how fast
 *   the beam traverses its path:
 *     stepDurationBeats = 1 / stepsPerBeat
 *     elapsedBeats      = stepPhase * stepDurationBeats
 *     travelProgress    = clamp01(elapsedBeats / beatsPerTravel)
 *
 * Audio launch triggers:
 *   Group-level LaserDmxLaunchSettings fire a launch envelope keyed by beamId.
 *   Cooldown, threshold, minimum energy, and retrigger mode are all respected.
 *   Queue retrigger buffers up to MAX_QUEUE launches; extras are dropped.
 *
 * Group solo behaviour:
 *   - When one or more groups are soloed, only beams in soloed groups render.
 *   - Ungrouped beams are HIDDEN during solo (documented choice: avoids confusion
 *     about which group is being isolated).
 *   - When no group is soloed, all non-muted enabled groups and ungrouped beams render.
 */

import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxMatrixBeam,
  LaserDmxReactionGroup,
  LaserDmxMatrixBeamGeometry,
  LaserDmxFogSettings,
  LaserDmxBeamTravelMode,
  LaserDmxLaunchSettings,
  LaserDmxBeamMatrixCue,
  LaserDmxMatrixBeamVisualRole,
} from '../ReactTypes'
import { DEFAULT_BEAM_MOTION, DEFAULT_BEAM_SEQUENCE, DEFAULT_LAUNCH_SETTINGS, BEATS_PER_BAR } from '../ReactTypes'
import {
  safeNumber,
  clamp,
  clamp01,
  clamp255,
  resolveStrobeVisible,
  applyModulationRoute,
  modeApply,
  pruneEnvelopes,
  resetAllEnvelopes,
} from './LaserDmxModulationEngine'
import {
  gridAnchorToCanvas,
  targetToCanvas,
  zDepthFactors,
} from './LaserDmxBeamGeometry'
import { computeSequenceOrder, computeBeamSequenceState, type BeamSequenceState } from './LaserDmxBeamSequencer'
import { computeKinematics, lerpPt } from './LaserDmxBeamKinematics'
import type { LaserDmxPersonalizationContext } from '../../../../features/personalization/laserDmxPersonalization'
import { inferBeamSemantic, personalizeRgbw } from '../../../../features/personalization/laserDmxPersonalization'

// ── Public result types ───────────────────────────────────────────────────────

export interface CompiledLaserDmxMatrixBeam {
  beamId:  string
  groupId: string | null

  /** Canvas pixels (may include temporary modulation offsets). */
  origin: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number; offscreen: boolean }

  /** Visible segment endpoints after forward-only travel is applied.
   *  Equal to origin/target in static mode.  Renderer uses these, NOT origin/target. */
  visibleOrigin: { x: number; y: number; z: number }
  visibleTarget: { x: number; y: number; z: number }

  rgba: { r: number; g: number; b: number; a: number }
  /** Pre-built CSS rgba string for reuse in fills. */
  colorCss: string

  /** Final 0–1 intensity (dimmer × masterDimmer × safety × sequenceGate, after modulation). */
  intensity: number
  /** Effective pixel width (includes globalBeamWidth). */
  beamWidth: number
  /** 0–1 cone expansion factor. */
  divergence: number
  /** 0–1 focus sharpness (1=sharp, 0=diffuse). */
  focus: number
  /** 0–1 glow multiplier (combined beam + global). */
  glow: number
  /** Effective normalized strobe rate after beam + global modulation (0–1 = 0–30 Hz). */
  strobeRate: number
  /** False when strobe is in its "off" phase. */
  strobeVisible: boolean
  /** ≈1.0 ± deterministic noise from flickerAmount. */
  flickerMultiplier: number
  geometry: LaserDmxMatrixBeamGeometry
  /** Transient Show Director visual hierarchy. Legacy beams default to primary. */
  visualRole: LaserDmxMatrixBeamVisualRole

  // ── Motion / sequencer state ───────────────────────────────────────────────
  /** Active travel mode (defaults to 'static' for legacy beams). */
  motionMode:     LaserDmxBeamTravelMode
  /** 0–1 travel progress along the current activation. */
  travelProgress: number
  /** 0 = silenced by sequence; 1 = active.  Already baked into intensity. */
  sequenceGate:   number
  /** 0–1 extra head-flare brightness for non-static modes. */
  headIntensity:  number
  /** Present only for pulseTrain: additional segment geometry. */
  pulseSegments?: { startFrac: number; endFrac: number }[]
}

export interface CompiledLaserDmxBeamMatrixOutput {
  masterDimmer:     number
  blackout:         boolean
  backgroundFade:   number
  beamPersistence:  number
  globalBeamWidth:  number
  globalGlow:       number
  globalStrobeRate: number
  safetyClamp:      number
}

export interface CompiledLaserDmxFog extends LaserDmxFogSettings {}

export interface CompiledLaserDmxBeamMatrixResult {
  output: CompiledLaserDmxBeamMatrixOutput
  fog:    CompiledLaserDmxFog
  beams:  CompiledLaserDmxMatrixBeam[]
}

// ── Compiler input ────────────────────────────────────────────────────────────

export interface CompileLaserDmxBeamMatrixInput {
  settings:     LaserDmxBeamMatrixSettings
  mi:           MusicIntelligenceFrame
  /** @deprecated Ignored. Retained only for persisted integration compatibility. */
  time?:        number
  /** Canonical audio transport playhead in seconds. */
  timeSec:      number
  canvasWidth:  number
  canvasHeight: number
  personalization?: LaserDmxPersonalizationContext | null
}

// ── Module-level ephemeral state ──────────────────────────────────────────────

let prevTimeSec  = -1
let prevSourceId = ''

/** Keyed by beamId. Tracks free-running and audio-triggered launches. */
interface BeamLaunchEnvelope {
  startBeat:      number   // absoluteBeat when this launch began
  active:         boolean
  launchBeat:     number   // absoluteBeat of the most recent launch (for cooldown)
  queuedLaunches: number   // pending queue count for 'queue' retrigger
}
const launchEnvelopes = new Map<string, BeamLaunchEnvelope>()

/** Last absoluteBeat at which each group successfully launched a beam. */
const groupLastLaunchBeat = new Map<string, number>()
const groupLastLaunchBar = new Map<string, number>()

const MAX_QUEUE_DEPTH = 4

// ── Cue evaluation state ──────────────────────────────────────────────────────

/** Beat position (barIndex × BEATS_PER_BAR + beatInBar + beatPhase) from the
 *  previous compiled frame.  Used for trigger boundary-crossing detection. */
let prevBeatPos = -1
/** Absolute time (ms) from the previous compiled frame. */
let prevMs      = -1

/** Decay duration (seconds) for trigger-cue intensity envelopes after firing. */
const CUE_TRIGGER_DECAY_SEC = 0.5

/** Seek detection threshold (seconds). Frame deltas > this are treated as seeks. */
const CUE_SEEK_THRESHOLD_SEC = 0.1

interface CueTriggerState {
  /** True once the trigger has fired; prevents re-fire until playhead rewinds. */
  fired:       boolean
  /** timeSec when the trigger envelope started. -1 if envelope not active. */
  envStartSec: number
}
const cueTriggerState = new Map<string, CueTriggerState>()

/** Pre-computed per-frame summary of cue gate/trigger state, built once before
 *  the per-beam loop to avoid O(beams × cues) iteration. */
export interface CueSummary {
  /** Beam/group IDs that have at least one enabled gate cue. */
  beamHasGates:  Set<string>
  groupHasGates: Set<string>
  /** Beam/group IDs with a currently-active gate cue range. */
  beamGateActive:  Set<string>
  groupGateActive: Set<string>
  /** Optional faded gate value for active cue ranges. Omitted means hard 1.0. */
  beamGateValue?:  Map<string, number>
  groupGateValue?: Map<string, number>
  /** Trigger-envelope contribution (0–1) per beam/group.  Present only while
   *  the 0.5 s decay envelope is running. */
  beamTriggerGate:  Map<string, number>
  groupTriggerGate: Map<string, number>
}

/** Converts 1-based (bar, beat) UI values to a 0-based beat-from-start index.
 *  Exported for use in validation and tests. */
export function musicalCueToBeatPos(bar: number, beat: number): number {
  return (bar - 1) * BEATS_PER_BAR + (beat - 1)
}

function cueGateFadeValue(cue: LaserDmxBeamMatrixCue, currentMs: number, startMs: number, endMs: number): number {
  const fadeInMs = Math.max(0, safeNumber(cue.fadeInMs, 0))
  const fadeOutMs = Math.max(0, safeNumber(cue.fadeOutMs, 0))
  let value = 1
  if (fadeInMs > 0) value = Math.min(value, clamp01((currentMs - startMs) / fadeInMs))
  if (fadeOutMs > 0 && Number.isFinite(endMs)) value = Math.min(value, clamp01((endMs - currentMs) / fadeOutMs))
  return clamp01(value)
}

/** Build the per-frame CueSummary.  Called once per compileLaserDmxBeamMatrix call.
 *  Exported for unit testing. */
export function evaluateCueSummary(
  cues: LaserDmxBeamMatrixCue[],
  currentBeatPos: number,
  currentMs: number,
  isSeek: boolean,
): CueSummary {
  const beamHasGates    = new Set<string>()
  const groupHasGates   = new Set<string>()
  const beamGateActive  = new Set<string>()
  const groupGateActive = new Set<string>()
  const beamGateValue  = new Map<string, number>()
  const groupGateValue = new Map<string, number>()
  const beamTriggerGate  = new Map<string, number>()
  const groupTriggerGate = new Map<string, number>()

  for (const cue of cues) {
    if (!cue.enabled) continue

    const isBeam   = cue.targetType === 'beam'
    const targetId = cue.targetId

    if (cue.action === 'gate') {
      if (isBeam) beamHasGates.add(targetId)
      else        groupHasGates.add(targetId)

      let active = false
      let gateValue = 1
      if (cue.timingMode === 'musical') {
        const start = musicalCueToBeatPos(cue.startBar ?? 1, cue.startBeat ?? 1)
        const end   = cue.endBar != null
          ? musicalCueToBeatPos(cue.endBar, cue.endBeat ?? 1)
          : Infinity
        active = currentBeatPos >= start && currentBeatPos < end
      } else {
        const start = cue.startMs ?? 0
        const end   = cue.endMs != null ? cue.endMs : Infinity
        active = currentMs >= start && currentMs < end
        if (active) gateValue = cueGateFadeValue(cue, currentMs, start, end)
      }

      if (active) {
        const activeSet = isBeam ? beamGateActive : groupGateActive
        const valueMap = isBeam ? beamGateValue : groupGateValue
        activeSet.add(targetId)
        valueMap.set(targetId, Math.max(valueMap.get(targetId) ?? 0, gateValue))
      }

    } else if (cue.action === 'trigger') {
      const startBeatPos = cue.timingMode === 'musical'
        ? musicalCueToBeatPos(cue.startBar ?? 1, cue.startBeat ?? 1)
        : -Infinity
      const startMs = cue.timingMode === 'absolute' ? (cue.startMs ?? 0) : -Infinity

      const isBefore = cue.timingMode === 'musical'
        ? currentBeatPos < startBeatPos
        : currentMs < startMs

      let state = cueTriggerState.get(cue.id)
      if (!state) {
        state = { fired: false, envStartSec: -1 }
        cueTriggerState.set(cue.id, state)
      }

      if (isBefore) {
        // Playhead moved before start → rearm
        state.fired = false
      } else if (!isSeek && !state.fired) {
        // Check for boundary crossing (prevBeatPos < start AND current >= start)
        const prevBefore = cue.timingMode === 'musical'
          ? (prevBeatPos >= 0 && prevBeatPos < startBeatPos)
          : (prevMs >= 0 && prevMs < startMs)

        if (prevBefore) {
          state.fired       = true
          state.envStartSec = currentMs / 1000
        }
      }

      // Contribute envelope value while decaying
      if (state.envStartSec >= 0) {
        const elapsed  = currentMs / 1000 - state.envStartSec
        const envValue = Math.max(0, 1 - elapsed / CUE_TRIGGER_DECAY_SEC)
        if (envValue > 0) {
          const trigMap = isBeam ? beamTriggerGate : groupTriggerGate
          const cur     = trigMap.get(targetId) ?? 0
          trigMap.set(targetId, Math.max(cur, envValue))
        } else {
          state.envStartSec = -1  // envelope finished
        }
      }
    }
  }

  prevBeatPos = currentBeatPos
  prevMs      = currentMs

  return { beamHasGates, groupHasGates, beamGateActive, groupGateActive, beamGateValue, groupGateValue, beamTriggerGate, groupTriggerGate }
}

/** Resolve the cue gate factor (0–1) for a single beam given the CueSummary.
 *  Exported for unit testing.
 *
 *  Rules:
 *  - No enabled gate cues AND no active trigger envelope → 1 (backward-compatible).
 *  - At least one enabled gate cue targeting this beam/group:
 *      cueGate = 1 if any gate cue is active, 0 otherwise.
 *  - Active trigger envelope contributes via max: can light up a beam that has
 *    no active gate cue, but cannot exceed 1.
 */
export function resolveCueGateFactor(
  beamId: string,
  groupId: string | null,
  summary: CueSummary,
): number {
  const hasBeamGates  = summary.beamHasGates.has(beamId)
  const hasGroupGates = groupId != null && summary.groupHasGates.has(groupId)

  const beamTrig  = summary.beamTriggerGate.get(beamId) ?? 0
  const groupTrig = groupId != null ? (summary.groupTriggerGate.get(groupId) ?? 0) : 0
  const trigGate  = Math.max(beamTrig, groupTrig)

  if (!hasBeamGates && !hasGroupGates && trigGate === 0) return 1  // no cues → passthrough

  const beamGateVal  = hasBeamGates
    ? (summary.beamGateValue?.get(beamId) ?? (summary.beamGateActive.has(beamId) ? 1 : 0))
    : 0
  const groupGateVal = (hasGroupGates && groupId != null)
    ? (summary.groupGateValue?.get(groupId) ?? (summary.groupGateActive.has(groupId) ? 1 : 0))
    : 0
  const gateVal = Math.max(beamGateVal, groupGateVal)

  return Math.max(gateVal, trigGate)
}

/** Reset compiler time reference, all trigger envelopes, and sequence state.
 *  Call when the Beam Matrix stops rendering (playback gate fires). */
export function resetBeamMatrixCompilerState(): void {
  prevTimeSec  = -1
  prevBeatPos  = -1
  prevMs       = -1
  prevSourceId = ''
  launchEnvelopes.clear()
  groupLastLaunchBeat.clear()
  groupLastLaunchBar.clear()
  cueTriggerState.clear()
  resetAllEnvelopes()
}

// ── Internal mutable state types ──────────────────────────────────────────────

interface GlobalBMState {
  masterDimmer:     number
  backgroundFade:   number
  beamPersistence:  number
  globalBeamWidth:  number
  globalGlow:       number
  globalStrobeRate: number
  safetyClamp:      number
  fogDensity:       number
  fogOpacity:       number
  fogBeamScatter:   number
  fogTurbulence:    number
}

/**
 * A single group-route operation to be applied per beam.
 *
 * Unlike the old collapsed-per-target approach, this preserves route mode so
 * add/multiply semantics work correctly relative to each beam's saved base.
 */
interface GroupRouteOp {
  target: string
  value:  number
  mode:   string
}

/**
 * Compiled result for one reaction group.
 * routeOps are applied PER BEAM, in order, to each beam's own base state.
 */
interface GroupFrame {
  active:          boolean
  routeOps:        GroupRouteOp[]
  colorR: number; colorG: number; colorB: number; colorA: number
  hasColorOverride: boolean
}

// ── Group-route compilation ───────────────────────────────────────────────────

/**
 * Evaluate all enabled group routes for the current frame.
 * Returns an ordered list of (target, value, mode) operations.
 * These are applied to each beam's working state individually so that
 * add/multiply routes operate relative to each beam's own saved value.
 */
function compileGroupRoutes(
  group:      LaserDmxReactionGroup,
  mi:         MusicIntelligenceFrame,
  dt:         number,
  activeKeys: Set<string>,
): GroupRouteOp[] {
  const ops: GroupRouteOp[] = []
  for (const route of group.modulationRoutes) {
    if (!route.enabled) continue
    const envKey = `bmg:${group.id}:${route.id}`
    activeKeys.add(envKey)
    const result = applyModulationRoute(route, mi, envKey, dt)
    if (!result) continue
    ops.push({ target: route.target, value: result.value, mode: route.mode })
  }
  return ops
}

// ── Global-route application ──────────────────────────────────────────────────

function applyGlobalRoute(
  target: string,
  v:      number,
  mode:   string,
  gs:     GlobalBMState,
): void {
  switch (target) {
    case 'masterDimmer':     gs.masterDimmer     = clamp01(modeApply(gs.masterDimmer,     v, mode)); break
    case 'backgroundFade':   gs.backgroundFade   = clamp01(modeApply(gs.backgroundFade,   v, mode)); break
    case 'beamPersistence':  gs.beamPersistence  = clamp01(modeApply(gs.beamPersistence,  v, mode)); break
    case 'globalBeamWidth':  gs.globalBeamWidth  = clamp(modeApply(gs.globalBeamWidth,  v, mode), 0.1, 6); break
    case 'globalGlow':       gs.globalGlow       = clamp01(modeApply(gs.globalGlow,       v, mode)); break
    case 'globalStrobeRate': gs.globalStrobeRate = clamp01(modeApply(gs.globalStrobeRate, v, mode)); break
    case 'fogDensity':       gs.fogDensity       = clamp01(modeApply(gs.fogDensity,       v, mode)); break
    case 'fogOpacity':       gs.fogOpacity       = clamp01(modeApply(gs.fogOpacity,       v, mode)); break
    case 'fogBeamScatter':   gs.fogBeamScatter   = clamp01(modeApply(gs.fogBeamScatter,   v, mode)); break
    case 'fogTurbulence':    gs.fogTurbulence    = clamp01(modeApply(gs.fogTurbulence,    v, mode)); break
    default: break
  }
}

// ── Beam-route application ────────────────────────────────────────────────────

/** Mutable per-beam working state. */
interface BeamState {
  dimmer:         number
  beamWidth:      number
  beamDivergence: number
  focus:          number
  glow:           number
  strobeRate:     number
  flickerAmount:  number
  r: number; g: number; b: number; a: number
  white: number  // 0–255 white channel, additive; blended into RGB at output
  // Compiled-only coordinate deltas (NORMALIZED, -2..2) — never written to the saved beam.
  // Multiplied by canvasWidth/Height to produce pixel offsets at application time.
  originDX: number; originDY: number
  targetDX: number; targetDY: number
}

function applyBeamRoute(
  target: string,
  v:      number,
  mode:   string,
  bs:     BeamState,
): void {
  switch (target) {
    case 'dimmer':         bs.dimmer         = clamp01(modeApply(bs.dimmer,         v, mode)); break
    case 'beamWidth':      bs.beamWidth      = clamp(modeApply(bs.beamWidth,      v, mode), 0.1, 8); break
    case 'beamDivergence': bs.beamDivergence = clamp01(modeApply(bs.beamDivergence, v, mode)); break
    case 'focus':          bs.focus          = clamp01(modeApply(bs.focus,          v, mode)); break
    case 'beamGlow':       bs.glow           = clamp01(modeApply(bs.glow,           v, mode)); break
    case 'strobeRate':     bs.strobeRate     = clamp01(modeApply(bs.strobeRate,     v, mode)); break
    case 'flickerAmount':  bs.flickerAmount  = clamp01(modeApply(bs.flickerAmount,  v, mode)); break
    case 'alpha':          bs.a              = clamp01(modeApply(bs.a,              v, mode)); break
    case 'red':            bs.r              = clamp255(modeApply(bs.r / 255, v, mode) * 255); break
    case 'green':          bs.g              = clamp255(modeApply(bs.g / 255, v, mode) * 255); break
    case 'blue':           bs.b              = clamp255(modeApply(bs.b / 255, v, mode) * 255); break
    case 'white': {
      // White channel supports all route modes; blended into RGB at output.
      const wPrev = bs.white / 255
      bs.white = clamp255(clamp01(modeApply(wPrev, clamp01(v), mode)) * 255)
      break
    }
    // Coordinate offsets: route min/max are NORMALIZED (viewport-relative).
    // Accumulated here; multiplied by canvasWidth/Height at coordinate application.
    case 'originOffsetX':  bs.originDX = clamp(modeApply(bs.originDX, v, mode), -2, 2); break
    case 'originOffsetY':  bs.originDY = clamp(modeApply(bs.originDY, v, mode), -2, 2); break
    case 'targetOffsetX':  bs.targetDX = clamp(modeApply(bs.targetDX, v, mode), -2, 2); break
    case 'targetOffsetY':  bs.targetDY = clamp(modeApply(bs.targetDY, v, mode), -2, 2); break
    default: break
  }
}

// ── Audio-launch trigger detection ────────────────────────────────────────────

function checkLaunchTrigger(
  launch:     LaserDmxLaunchSettings,
  mi:         MusicIntelligenceFrame,
): boolean {
  if (launch.trigger === 'none') return false
  if (mi.energy.instant < launch.minimumEnergy) return false

  switch (launch.trigger) {
    case 'beat':
      return mi.rhythm.beatHit
    case 'downbeat':
      return mi.rhythm.downbeatHit
    case 'kick':
      return mi.rhythm.kickHit && mi.rhythm.kickStrength >= launch.threshold
    case 'snare':
      return mi.rhythm.snareHit && mi.rhythm.snareStrength >= launch.threshold
    case 'dropImpact':
      return mi.energy.dropImpact >= launch.threshold
    default:
      return false
  }
}

// ── Main compiler entry point ─────────────────────────────────────────────────

export function compileLaserDmxBeamMatrix(
  inp: CompileLaserDmxBeamMatrixInput,
): CompiledLaserDmxBeamMatrixResult {
  const { settings, mi, timeSec, canvasWidth: W, canvasHeight: H, personalization } = inp

  const empty = (): CompiledLaserDmxBeamMatrixResult => ({
    output: buildOutputFromSettings(settings),
    fog:    { ...settings.fog },
    beams:  [],
  })

  if (!W || !H) return empty()

  // ── dt ───────────────────────────────────────────────────────────────────
  const dt = prevTimeSec >= 0
    ? clamp(timeSec - prevTimeSec, 0.001, 0.1)
    : 1 / 60

  // Backward seek detection: clear ephemeral launch state so travel resets
  if (prevTimeSec >= 0 && timeSec < prevTimeSec - 0.5) {
    launchEnvelopes.clear()
    groupLastLaunchBeat.clear()
    groupLastLaunchBar.clear()
  }

  // ── Cue evaluation (must run BEFORE prevTimeSec/prevBeatPos/prevMs update) ─
  const currentBeatPos = safeNumber(mi.rhythm.barIndex, 0) * BEATS_PER_BAR
    + safeNumber(mi.rhythm.beatInBar, 0)
    + safeNumber(mi.rhythm.beatPhase, 0)
  const currentMs = timeSec * 1000
  const isSeek    = prevTimeSec < 0
    ? false
    : Math.abs(timeSec - prevTimeSec) > CUE_SEEK_THRESHOLD_SEC || timeSec < prevTimeSec
  const cueSummary = evaluateCueSummary(
    settings.cues ?? [],
    currentBeatPos,
    currentMs,
    isSeek,
  )

  prevTimeSec = timeSec

  // Track source changes (new track / seek restart)
  const sourceId = (mi as unknown as Record<string, unknown>).sourceId as string | undefined ?? ''
  if (sourceId !== prevSourceId) {
    launchEnvelopes.clear()
    groupLastLaunchBeat.clear()
    groupLastLaunchBar.clear()
    cueTriggerState.clear()
    prevSourceId = sourceId
  }

  // ── 1. Global output base state ──────────────────────────────────────────
  const o = settings.output
  const gs: GlobalBMState = {
    masterDimmer:     clamp01(safeNumber(o.masterDimmer,     0.85)),
    backgroundFade:   clamp01(safeNumber(o.backgroundFade,   0.18)),
    beamPersistence:  clamp01(safeNumber(o.beamPersistence,  0.60)),
    globalBeamWidth:  clamp(safeNumber(o.globalBeamWidth,    1),    0.1, 6),
    globalGlow:       clamp01(safeNumber(o.globalGlow,        0.65)),
    globalStrobeRate: clamp01(safeNumber(o.globalStrobeRate,  0)),
    safetyClamp:      clamp01(safeNumber(o.safetyClamp,       0.90)),
    fogDensity:       clamp01(safeNumber(settings.fog.density,  0.4)),
    fogOpacity:       clamp01(safeNumber(settings.fog.opacity,  0.5)),
    fogBeamScatter:   clamp01(safeNumber(settings.fog.beamScatter, 0.2)),
    fogTurbulence:    clamp01(safeNumber(settings.fog.turbulence,  0.2)),
  }

  // Blackout short-circuit
  if (o.blackout) {
    resetAllEnvelopes()
    return {
      output: { ...buildOutputFromSettings(settings), blackout: true },
      fog:    { ...settings.fog },
      beams:  [],
    }
  }

  const activeKeys = new Set<string>()

  // ── 2. Global modulation routes ──────────────────────────────────────────
  for (const route of settings.globalModulationRoutes) {
    if (!route.enabled) continue
    const envKey = `bmgl:${route.id}`
    activeKeys.add(envKey)
    const result = applyModulationRoute(route, mi, envKey, dt)
    if (!result) continue
    applyGlobalRoute(route.target, result.value, route.mode, gs)
  }

  // ── 3. Solo detection ────────────────────────────────────────────────────
  const hasSolo = settings.groups.some(g => g.soloed && g.enabled && !g.muted)

  // ── 4. Compile group frames (once per group) ─────────────────────────────
  const groupFrames = new Map<string, GroupFrame>()
  for (const group of settings.groups) {
    const routeOps = compileGroupRoutes(group, mi, dt, activeKeys)

    let active = group.enabled && !group.muted
    if (hasSolo && !group.soloed) active = false

    const col = group.color
    const hasColorOverride = group.colorOverrideEnabled

    groupFrames.set(group.id, {
      active,
      routeOps,
      colorR: clamp255(safeNumber(col.red,   255)),
      colorG: clamp255(safeNumber(col.green, 255)),
      colorB: clamp255(safeNumber(col.blue,  255)),
      colorA: clamp01(safeNumber(col.alpha,  1)),
      hasColorOverride,
    })
  }

  // ── 5. Build group lookup map ────────────────────────────────────────────
  const groupMap = new Map<string, LaserDmxReactionGroup>(
    settings.groups.map(g => [g.id, g])
  )

  // ── 5b. BPM sequence states (one pass per group with sequencing enabled) ──
  // Guard missing fields from test stubs (beatIndex/barIndex/beatInBar may be absent).
  const absoluteBeat = safeNumber(mi.rhythm.beatIndex, 0) + safeNumber(mi.rhythm.beatPhase, 0)
  const timingReady  = safeNumber(mi.rhythm.bpm, 0) > 0
  const seqStateMap  = new Map<string, BeamSequenceState>()

  for (const group of settings.groups) {
    const seq = group.sequence ?? DEFAULT_BEAM_SEQUENCE
    if (!seq.enabled) continue
    if (!timingReady) continue

    const groupBeams = settings.beams.filter(b => b.groupId === group.id && b.enabled)
    if (groupBeams.length === 0) continue

    const sorted = [...groupBeams].sort(
      (a, b) => (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0)
    )
    const sortedIds = sorted.map(b => b.id)
    const n = sortedIds.length

    const beatForSeq = seq.resetOnDownbeat
      ? safeNumber(mi.rhythm.beatInBar, 0) + safeNumber(mi.rhythm.beatPhase, 0)
      : absoluteBeat

    const rotationOffset = seq.rotateEveryBars > 0
      ? Math.floor(safeNumber(mi.rhythm.barIndex, 0) / seq.rotateEveryBars) % n
      : 0

    const orderedIds = computeSequenceOrder(sortedIds, seq.mode, seq.seed)

    for (let i = 0; i < orderedIds.length; i++) {
      const stepIdx    = (i - rotationOffset + n) % n
      const state      = computeBeamSequenceState(i, stepIdx, n, beatForSeq, seq)
      seqStateMap.set(orderedIds[i], state)
    }
  }

  // ── 5c. Audio-launch trigger check (per group) ───────────────────────────
  // Detect this frame's trigger events once per group, respecting cooldown.
  const groupTriggerFired = new Map<string, boolean>()
  for (const group of settings.groups) {
    if (!group.enabled || group.muted) continue
    const launch = group.launch ?? DEFAULT_LAUNCH_SETTINGS
    if (launch.trigger === 'none') continue

    const triggered = checkLaunchTrigger(launch, mi)
    if (!triggered) {
      groupTriggerFired.set(group.id, false)
      continue
    }

    // Musical-bar cooldown takes precedence over the legacy beat cooldown.
    const cooldownBars = Math.max(0, safeNumber(launch.cooldownBars, 0))
    if (cooldownBars > 0) {
      const currentBar = safeNumber(mi.rhythm.barIndex, 0)
      const lastLaunchBar = groupLastLaunchBar.get(group.id) ?? -Infinity
      if (currentBar - lastLaunchBar < cooldownBars) {
        groupTriggerFired.set(group.id, false)
        continue
      }
      groupLastLaunchBar.set(group.id, currentBar)
    } else {
      const lastLaunch = groupLastLaunchBeat.get(group.id) ?? -Infinity
      const elapsed = absoluteBeat - lastLaunch
      if (elapsed < launch.cooldownBeats) {
        groupTriggerFired.set(group.id, false)
        continue
      }
      groupLastLaunchBeat.set(group.id, absoluteBeat)
    }

    groupTriggerFired.set(group.id, true)
  }

  // ── 6. Compile beams ──────────────────────────────────────────────────────

  // Per-group active-beam counter for maxActiveBeams enforcement.
  const groupActiveCount = new Map<string, number>()
  const compiled: CompiledLaserDmxMatrixBeam[] = []

  for (let bi = 0; bi < settings.beams.length; bi++) {
    const beam = settings.beams[bi]
    if (!beam.enabled) continue

    // ── Group gate ─────────────────────────────────────────────────────────
    let gf: GroupFrame | null = null
    let group: LaserDmxReactionGroup | null = null
    if (beam.groupId) {
      gf    = groupFrames.get(beam.groupId) ?? null
      group = groupMap.get(beam.groupId) ?? null
      if (!gf || !gf.active) continue
    } else if (hasSolo) {
      continue
    }

    // ── Beam working state (init from saved values) ────────────────────────
    const app = beam.appearance
    const col = beam.color

    const bs: BeamState = {
      dimmer:         clamp01(safeNumber(app.dimmer,        1)),
      beamWidth:      clamp(safeNumber(app.width,           1), 0.1, 8),
      beamDivergence: clamp01(safeNumber(app.divergence,    0.15)),
      focus:          clamp01(safeNumber(app.focus,         1)),
      glow:           clamp01(safeNumber(app.glow,          0.65)),
      strobeRate:     clamp01(safeNumber(app.strobeRate,    0)),
      flickerAmount:  clamp01(safeNumber(app.flickerAmount, 0)),
      r: clamp255(safeNumber(col.red,   0)),
      g: clamp255(safeNumber(col.green, 255)),
      b: clamp255(safeNumber(col.blue,  220)),
      a: clamp01(safeNumber(col.alpha,  1)),
      white: clamp255(safeNumber(col.white, 0)),
      originDX: 0, originDY: 0,
      targetDX: 0, targetDY: 0,
    }

    // ── Apply group color override ─────────────────────────────────────────
    if (gf && beam.useGroupColor && gf.hasColorOverride) {
      bs.r = gf.colorR
      bs.g = gf.colorG
      bs.b = gf.colorB
      bs.a = gf.colorA
    }

    // ── Apply group route operations (relative to each beam's own base) ────
    if (gf) {
      for (const op of gf.routeOps) {
        applyBeamRoute(op.target, op.value, op.mode, bs)
      }
    }

    // ── Apply beam-level modulation routes ────────────────────────────────
    if (!app.shutterOpen) bs.dimmer = 0
    for (const route of beam.modulationRoutes) {
      if (!route.enabled) continue
      const envKey = `bm:${beam.id}:${route.id}`
      activeKeys.add(envKey)
      const result = applyModulationRoute(route, mi, envKey, dt)
      if (!result) continue
      applyBeamRoute(route.target, result.value, route.mode, bs)
    }

    // ── Transient Brand Kit color adaptation ─────────────────────────────
    // Apply after group and beam modulation so music-driven RGB changes remain
    // live, but before the white channel is blended into the final presentation.
    if (personalization) {
      const personalized = personalizeRgbw({
        red: bs.r,
        green: bs.g,
        blue: bs.b,
        white: bs.white,
        alpha: bs.a,
      }, inferBeamSemantic(beam, group), personalization)
      bs.r = personalized.red
      bs.g = personalized.green
      bs.b = personalized.blue
      bs.white = personalized.white
      bs.a = personalized.alpha
    }

    // ── Blend white into RGB ──────────────────────────────────────────────
    if (bs.white > 0) {
      bs.r = clamp255(bs.r + bs.white)
      bs.g = clamp255(bs.g + bs.white)
      bs.b = clamp255(bs.b + bs.white)
    }

    // ── Safety clamp ──────────────────────────────────────────────────────
    bs.dimmer = clamp01(bs.dimmer * gs.safetyClamp)

    // ── Intensity (dimmer × master) ───────────────────────────────────────
    const baseIntensity = clamp01(bs.dimmer * gs.masterDimmer)
    if (baseIntensity < 0.001) continue

    // ── Strobe ────────────────────────────────────────────────────────────
    const effectiveStrobe = clamp01(bs.strobeRate + gs.globalStrobeRate)
    const strobeVisible   = resolveStrobeVisible(effectiveStrobe, timeSec)

    // ── Flicker (deterministic, no Math.random) ───────────────────────────
    let flickerMultiplier = 1
    if (bs.flickerAmount > 0.001) {
      const fp    = timeSec * 11.3 + bi * 2.7
      const noise = Math.sin(fp * 11.0) * Math.sin(fp * 7.3) * Math.cos(fp * 3.1)
      flickerMultiplier = Math.max(0.3, 1.0 + noise * bs.flickerAmount * 0.3)
    }

    const intensity = clamp01(baseIntensity * flickerMultiplier)

    // ── Coordinate compilation ────────────────────────────────────────────
    const originBase = gridAnchorToCanvas(
      beam.origin.column, beam.origin.row, beam.origin.z, W, H,
    )
    const targetBase = targetToCanvas(beam.target, W, H)

    // Normalized offsets → pixels: 1.0 = full canvas width (X) or height (Y).
    const originX = originBase.x + bs.originDX * W
    const originY = originBase.y + bs.originDY * H
    const targetX = targetBase.x + bs.targetDX * W
    const targetY = targetBase.y + bs.targetDY * H

    // ── Z-depth factors ───────────────────────────────────────────────────
    const { widthScale: oWS, intensityScale: oIS } = zDepthFactors(originBase.z)
    const { widthScale: tWS }                       = zDepthFactors(targetBase.z)
    const avgWidthScale     = (oWS + tWS) / 2
    const baseDepthIntensity = clamp01(intensity * oIS)

    // ── Effective beam width ──────────────────────────────────────────────
    const effectiveWidth = clamp(
      bs.beamWidth * gs.globalBeamWidth * avgWidthScale,
      0.2, 8,
    )

    // ── Effective glow ────────────────────────────────────────────────────
    const effectiveGlow = clamp01(bs.glow * gs.globalGlow)

    // ── RGBA + CSS ────────────────────────────────────────────────────────
    const rgba = {
      r: clamp255(bs.r),
      g: clamp255(bs.g),
      b: clamp255(bs.b),
      a: clamp01(bs.a),
    }
    const colorCss = `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a.toFixed(3)})`

    const targetOffscreen = targetX < 0 || targetX > W || targetY < 0 || targetY > H

    // ── Motion / sequencer ────────────────────────────────────────────────
    const motion = beam.motion ?? DEFAULT_BEAM_MOTION
    // Legacy projects may still contain pingPong/reverse/alternate values. The
    // renderer contract is now physically forward-only: origin → target.
    const motionMode: LaserDmxBeamTravelMode = (motion.mode as string) === 'pingPong'
      ? 'grow'
      : (motion.mode ?? 'static')

    let travelProgress  = 0
    let sequenceGate    = 1

    // Sequence gate applies to ALL motion modes including static.
    // Static beams keep travelProgress=0 (full geometry) but their visibility
    // is controlled by sequenceGate exactly like non-static beams.
    const seqState = seqStateMap.get(beam.id)
    if (seqState) {
      sequenceGate   = seqState.gate
    }

    if (motionMode !== 'static') {
      if (seqState) {
        // ── Sequenced non-static beam ───────────────────────────────────
        // travelProgress drives travel geometry; gate was already set above.
        const seq               = group?.sequence ?? DEFAULT_BEAM_SEQUENCE
        const stepDurationBeats = 1 / Math.max(0.001, seq.stepsPerBeat)
        const elapsedBeats      = seqState.stepPhase * stepDurationBeats
        travelProgress = clamp01(elapsedBeats / Math.max(0.001, motion.beatsPerTravel))

        // Apply audio-launch trigger for 'projectile' style launches.
        if (group && groupTriggerFired.get(group.id) === true) {
          const env = launchEnvelopes.get(beam.id)
          applyRetrigger(beam.id, absoluteBeat, motion.retrigger, env)
        }
      } else {
        // ── Free-running non-static (no sequence) ───────────────────────
        // Audio-triggered launch: check if group has a trigger
        if (group) {
          const triggered = groupTriggerFired.get(group.id) === true
          const env       = launchEnvelopes.get(beam.id)
          if (triggered) {
            applyRetrigger(beam.id, absoluteBeat, motion.retrigger, env)
          }
        }

        const env = launchEnvelopes.get(beam.id)
        if (env?.active) {
          const elapsed = Math.max(0, absoluteBeat - env.startBeat)
          travelProgress = clamp01(elapsed / Math.max(0.001, motion.beatsPerTravel))
          if (travelProgress >= 1) {
            // Launch complete: check for queued launches
            if (env.queuedLaunches > 0) {
              env.queuedLaunches--
              env.startBeat  = absoluteBeat
              env.launchBeat = absoluteBeat
              travelProgress = 0
            } else {
              env.active     = false
              travelProgress = 1
            }
          }
          sequenceGate = 1
        } else {
          // Continuous free-running (repeats every beatsPerTravel beats)
          travelProgress = ((absoluteBeat + motion.phaseOffset) / Math.max(0.001, motion.beatsPerTravel)) % 1
          sequenceGate   = 1
        }
      }
    }
    // Static + no seqState: sequenceGate stays 1 (beam always visible)

    // ── Kinematics → visible segment fracs ───────────────────────────────
    // Direction is intentionally not consulted here. Every animated segment
    // progresses from the fixture origin toward its authored target.
    const kin = computeKinematics(motionMode, travelProgress, motion.tailLength, motion.headGlow, motion.easing)

    const visOriginFrac = kin.visibleOriginFrac
    const visTargetFrac = kin.visibleTargetFrac

    // Maximal active beams gate (applied after kinematics / gate resolution)
    if (group && (group.maxActiveBeams ?? 0) > 0) {
      const cnt = groupActiveCount.get(group.id) ?? 0
      if (sequenceGate > 0 && cnt >= group.maxActiveBeams) {
        sequenceGate = 0
      }
      if (sequenceGate > 0) {
        groupActiveCount.set(group.id, cnt + 1)
      }
    }

    // Convert fracs to canvas coordinates
    const visOriginPt = lerpPt(originX, originY, originBase.z, targetX, targetY, targetBase.z, visOriginFrac)
    const visTargetPt = lerpPt(originX, originY, originBase.z, targetX, targetY, targetBase.z, visTargetFrac)

    const pulseSegments = kin.pulseSegments

    const cueGate = resolveCueGateFactor(beam.id, beam.groupId, cueSummary)
    const finalIntensity = clamp01(baseDepthIntensity * sequenceGate * cueGate)

    // ── Final finite validation ────────────────────────────────────────────
    const safeF = (v: number, fb: number) => Number.isFinite(v) ? v : fb

    compiled.push({
      beamId:  beam.id,
      groupId: beam.groupId,

      origin: {
        x: safeF(originX, 0), y: safeF(originY, 0), z: safeF(originBase.z, 0),
      },
      target: {
        x: safeF(targetX, W / 2), y: safeF(targetY, H / 2),
        z: safeF(targetBase.z, 0), offscreen: targetOffscreen,
      },

      visibleOrigin: {
        x: safeF(visOriginPt.x, originX), y: safeF(visOriginPt.y, originY), z: safeF(visOriginPt.z, originBase.z),
      },
      visibleTarget: {
        x: safeF(visTargetPt.x, targetX), y: safeF(visTargetPt.y, targetY), z: safeF(visTargetPt.z, targetBase.z),
      },

      rgba,
      colorCss,

      intensity:         safeF(finalIntensity, 0),
      beamWidth:         safeF(effectiveWidth, 1),
      divergence:        safeF(bs.beamDivergence, 0.15),
      focus:             safeF(bs.focus, 1),
      glow:              safeF(effectiveGlow, 0.65),
      strobeRate:        safeF(effectiveStrobe, 0),
      strobeVisible,
      flickerMultiplier: safeF(flickerMultiplier, 1),
      geometry:          app.geometry ?? 'line',
      visualRole:        beam.visualRole ?? 'primary',

      motionMode,
      travelProgress:    safeF(travelProgress, 0),
      sequenceGate:      safeF(sequenceGate, 1),
      headIntensity:     safeF(kin.headIntensity, 0),
      pulseSegments,
    })
  }

  // ── Prune stale envelopes ─────────────────────────────────────────────────
  pruneEnvelopes(activeKeys)

  // ── Assemble compiled fog (with global-route overrides) ───────────────────
  const fog: CompiledLaserDmxFog = {
    ...settings.fog,
    density:     gs.fogDensity,
    opacity:     gs.fogOpacity,
    beamScatter: gs.fogBeamScatter,
    turbulence:  gs.fogTurbulence,
  }

  return {
    output: {
      masterDimmer:     gs.masterDimmer,
      blackout:         false,
      backgroundFade:   gs.backgroundFade,
      beamPersistence:  gs.beamPersistence,
      globalBeamWidth:  gs.globalBeamWidth,
      globalGlow:       gs.globalGlow,
      globalStrobeRate: gs.globalStrobeRate,
      safetyClamp:      gs.safetyClamp,
    },
    fog,
    beams: compiled,
  }
}

// ── Retrigger helper ──────────────────────────────────────────────────────────

function applyRetrigger(
  beamId:    string,
  beat:      number,
  retrigger: 'restart' | 'continue' | 'queue',
  env:       BeamLaunchEnvelope | undefined,
): void {
  if (!env || !env.active) {
    // Fresh launch
    launchEnvelopes.set(beamId, {
      startBeat:      beat,
      active:         true,
      launchBeat:     beat,
      queuedLaunches: 0,
    })
    return
  }

  switch (retrigger) {
    case 'restart':
      env.startBeat  = beat
      env.launchBeat = beat
      env.queuedLaunches = 0
      break
    case 'continue':
      // Ignore; let the current launch complete
      break
    case 'queue':
      if (env.queuedLaunches < MAX_QUEUE_DEPTH) {
        env.queuedLaunches++
      }
      break
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function buildOutputFromSettings(
  settings: LaserDmxBeamMatrixSettings,
): CompiledLaserDmxBeamMatrixOutput {
  const o = settings.output
  return {
    masterDimmer:     clamp01(safeNumber(o.masterDimmer,     0.85)),
    blackout:         o.blackout ?? false,
    backgroundFade:   clamp01(safeNumber(o.backgroundFade,   0.18)),
    beamPersistence:  clamp01(safeNumber(o.beamPersistence,  0.60)),
    globalBeamWidth:  clamp(safeNumber(o.globalBeamWidth,    1), 0.1, 6),
    globalGlow:       clamp01(safeNumber(o.globalGlow,        0.65)),
    globalStrobeRate: clamp01(safeNumber(o.globalStrobeRate,  0)),
    safetyClamp:      clamp01(safeNumber(o.safetyClamp,       0.90)),
  }
}
