/**
 * Validation utilities for LaserDMX Beam Matrix settings.
 * Returns structured issues; callers decide whether to throw, warn, or normalize.
 *
 * Supported scope target sets mirror the compiler dispatch tables.
 */

import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxModulationRoute,
  LaserDmxBeamMotion,
  LaserDmxBeamSequence,
} from '../ReactTypes'
import {
  LASER_DMX_MATRIX_MAX_BEAMS,
  LASER_DMX_MATRIX_COLUMNS,
  LASER_DMX_MATRIX_ROWS,
  DEFAULT_BEAM_MOTION,
  DEFAULT_BEAM_SEQUENCE,
} from '../ReactTypes'

// ── Known valid sets ──────────────────────────────────────────────────────────

export const GROUP_ROUTE_TARGETS = new Set([
  'dimmer', 'beamWidth', 'beamDivergence', 'beamGlow', 'strobeRate',
])

export const GLOBAL_ROUTE_TARGETS = new Set([
  'masterDimmer', 'backgroundFade', 'beamPersistence',
  'globalBeamWidth', 'globalGlow', 'globalStrobeRate',
  'fogDensity', 'fogOpacity', 'fogBeamScatter', 'fogTurbulence',
])

export const BEAM_ROUTE_TARGETS = new Set([
  'dimmer', 'beamWidth', 'beamDivergence', 'focus', 'beamGlow',
  'strobeRate', 'flickerAmount', 'alpha', 'red', 'green', 'blue', 'white',
  'originOffsetX', 'originOffsetY', 'targetOffsetX', 'targetOffsetY',
])

const VALID_TRAVEL_MODES    = new Set(['static', 'grow', 'projectile', 'scanner', 'pulseTrain', 'pingPong'])
const VALID_SEQUENCE_MODES  = new Set(['all', 'forward', 'reverse', 'alternate', 'centerOut', 'outsideIn', 'randomSeeded', 'custom'])
const VALID_ROUTE_MODES     = new Set(['set', 'add', 'multiply', 'trigger'])
const VALID_ROUTE_CURVES    = new Set(['linear', 'easeIn', 'easeOut', 'easeInOut', 'pulse', 'exponential'])
const VALID_GEOMETRY        = new Set(['line', 'volumetricCone'])
const VALID_EASING          = new Set(['linear', 'easeIn', 'easeOut', 'easeInOut'])
const VALID_DIRECTIONS      = new Set(['forward'])
const LEGACY_DIRECTIONS     = new Set(['reverse', 'alternate'])
const VALID_RETRIGGER       = new Set(['restart', 'continue', 'queue'])

// ── Issue types ───────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: ValidationSeverity
  path:     string
  message:  string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fin(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v)
}

function clampedIssue(
  issues: ValidationIssue[], path: string, v: number,
  min: number, max: number, label: string,
) {
  if (!fin(v)) {
    issues.push({ severity: 'error', path, message: `${label} is not finite (${v})` })
  } else if (v < min || v > max) {
    issues.push({ severity: 'warning', path, message: `${label} ${v} is outside expected range [${min}, ${max}]` })
  }
}

function validateRoute(
  route: LaserDmxModulationRoute,
  validTargets: Set<string>,
  path: string,
  issues: ValidationIssue[],
) {
  if (!validTargets.has(route.target)) {
    issues.push({ severity: 'error', path: `${path}.target`, message: `Unsupported target "${route.target}" at this scope` })
  }
  if (!VALID_ROUTE_MODES.has(route.mode)) {
    issues.push({ severity: 'error', path: `${path}.mode`, message: `Invalid route mode "${route.mode}"` })
  }
  if (!VALID_ROUTE_CURVES.has(route.curve)) {
    issues.push({ severity: 'error', path: `${path}.curve`, message: `Invalid curve "${route.curve}"` })
  }
  if (!fin(route.amount))  issues.push({ severity: 'error', path: `${path}.amount`,  message: 'amount is not finite' })
  if (!fin(route.min))     issues.push({ severity: 'error', path: `${path}.min`,     message: 'min is not finite' })
  if (!fin(route.max))     issues.push({ severity: 'error', path: `${path}.max`,     message: 'max is not finite' })
  if (!fin(route.attack))  issues.push({ severity: 'error', path: `${path}.attack`,  message: 'attack is not finite' })
  if (!fin(route.release)) issues.push({ severity: 'error', path: `${path}.release`, message: 'release is not finite' })
}

function validateMotion(
  motion: LaserDmxBeamMotion,
  path: string,
  issues: ValidationIssue[],
) {
  if (!VALID_TRAVEL_MODES.has(motion.mode)) {
    issues.push({ severity: 'error', path: `${path}.mode`, message: `Invalid travel mode "${motion.mode}"` })
  }
  if (!VALID_EASING.has(motion.easing)) {
    issues.push({ severity: 'error', path: `${path}.easing`, message: `Invalid easing "${motion.easing}"` })
  }
  const rawDirection = (motion as { direction?: unknown }).direction
  if (typeof rawDirection === 'string' && LEGACY_DIRECTIONS.has(rawDirection)) {
    issues.push({ severity: 'warning', path: `${path}.direction`, message: `Legacy direction "${rawDirection}" is coerced to forward` })
  } else if (typeof rawDirection !== 'string' || !VALID_DIRECTIONS.has(rawDirection)) {
    issues.push({ severity: 'error', path: `${path}.direction`, message: `Invalid direction "${String(rawDirection)}"` })
  }
  const rawMode = (motion as { mode?: unknown }).mode
  if (rawMode === 'pingPong') {
    issues.push({ severity: 'warning', path: `${path}.mode`, message: 'Legacy pingPong motion is coerced to forward grow' })
  }
  if (!VALID_RETRIGGER.has(motion.retrigger)) {
    issues.push({ severity: 'error', path: `${path}.retrigger`, message: `Invalid retrigger "${motion.retrigger}"` })
  }
  clampedIssue(issues, `${path}.beatsPerTravel`, motion.beatsPerTravel, 0.0625, 64, 'beatsPerTravel')
  clampedIssue(issues, `${path}.phaseOffset`,    motion.phaseOffset,    0,      1,  'phaseOffset')
  clampedIssue(issues, `${path}.tailLength`,     motion.tailLength,     0,      1,  'tailLength')
  clampedIssue(issues, `${path}.headGlow`,       motion.headGlow,       0,      1,  'headGlow')
}

function validateSequence(
  seq: LaserDmxBeamSequence,
  path: string,
  issues: ValidationIssue[],
) {
  if (!VALID_SEQUENCE_MODES.has(seq.mode)) {
    issues.push({ severity: 'error', path: `${path}.mode`, message: `Invalid sequence mode "${seq.mode}"` })
  }
  clampedIssue(issues, `${path}.stepsPerBeat`,    seq.stepsPerBeat,    0.0625, 16, 'stepsPerBeat')
  clampedIssue(issues, `${path}.stepGate`,        seq.stepGate,        0,       1, 'stepGate')
  clampedIssue(issues, `${path}.phaseSpread`,     seq.phaseSpread,     0,       1, 'phaseSpread')
  clampedIssue(issues, `${path}.rotateEveryBars`, seq.rotateEveryBars, 0,      64, 'rotateEveryBars')
  if (!fin(seq.seed) || seq.seed < 0) {
    issues.push({ severity: 'warning', path: `${path}.seed`, message: `seed (${seq.seed}) should be a non-negative integer` })
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate all fields in a LaserDmxBeamMatrixSettings object.
 * Returns an array of issues; empty array means the settings are clean.
 */
export function validateBeamMatrixSettings(
  settings: LaserDmxBeamMatrixSettings,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { beams, groups, globalModulationRoutes, output, fog } = settings

  // ── Beam count ──────────────────────────────────────────────────────────────
  if (beams.length > LASER_DMX_MATRIX_MAX_BEAMS) {
    issues.push({ severity: 'error', path: 'beams', message: `Beam count ${beams.length} exceeds limit ${LASER_DMX_MATRIX_MAX_BEAMS}` })
  }

  // ── Group ID map ────────────────────────────────────────────────────────────
  const groupIds = new Set(groups.map(g => g.id))

  // ── Sequence indices ────────────────────────────────────────────────────────
  const seqIndices = beams.map(b => b.sequenceIndex)
  const seqIndexSet = new Set(seqIndices)
  if (seqIndexSet.size < beams.length) {
    issues.push({ severity: 'warning', path: 'beams[*].sequenceIndex', message: 'Duplicate sequence indices detected — ordering may be unpredictable' })
  }

  // ── Per-beam validation ─────────────────────────────────────────────────────
  for (let i = 0; i < beams.length; i++) {
    const beam = beams[i]
    const p = `beams[${i}]`

    if (beam.groupId !== null && !groupIds.has(beam.groupId)) {
      issues.push({ severity: 'error', path: `${p}.groupId`, message: `groupId "${beam.groupId}" does not reference a known group` })
    }

    if (!VALID_GEOMETRY.has(beam.appearance.geometry)) {
      issues.push({ severity: 'error', path: `${p}.appearance.geometry`, message: `Invalid geometry "${beam.appearance.geometry}"` })
    }

    // Origin bounds
    if (beam.origin.column < 1 || beam.origin.column > LASER_DMX_MATRIX_COLUMNS) {
      issues.push({ severity: 'error', path: `${p}.origin.column`, message: `column ${beam.origin.column} out of range [1, ${LASER_DMX_MATRIX_COLUMNS}]` })
    }
    if (beam.origin.row < 1 || beam.origin.row > LASER_DMX_MATRIX_ROWS) {
      issues.push({ severity: 'error', path: `${p}.origin.row`, message: `row ${beam.origin.row} out of range [1, ${LASER_DMX_MATRIX_ROWS}]` })
    }

    // Grid target bounds
    if (beam.target.kind === 'grid') {
      if (beam.target.column < 1 || beam.target.column > LASER_DMX_MATRIX_COLUMNS) {
        issues.push({ severity: 'error', path: `${p}.target.column`, message: `target column ${beam.target.column} out of range` })
      }
      if (beam.target.row < 1 || beam.target.row > LASER_DMX_MATRIX_ROWS) {
        issues.push({ severity: 'error', path: `${p}.target.row`, message: `target row ${beam.target.row} out of range` })
      }
    }

    // Appearance values
    clampedIssue(issues, `${p}.appearance.dimmer`,       beam.appearance.dimmer,       0, 1, 'dimmer')
    clampedIssue(issues, `${p}.appearance.width`,        beam.appearance.width,         0.01, 32, 'width')
    clampedIssue(issues, `${p}.appearance.glow`,         beam.appearance.glow,          0, 1, 'glow')
    clampedIssue(issues, `${p}.appearance.divergence`,   beam.appearance.divergence,    0, 1, 'divergence')
    clampedIssue(issues, `${p}.appearance.strobeRate`,   beam.appearance.strobeRate,    0, 1, 'strobeRate')

    // Motion
    if (beam.motion) {
      validateMotion(beam.motion, `${p}.motion`, issues)
    }

    // Beam-level routes
    for (let ri = 0; ri < beam.modulationRoutes.length; ri++) {
      validateRoute(beam.modulationRoutes[ri], BEAM_ROUTE_TARGETS, `${p}.modulationRoutes[${ri}]`, issues)
    }
  }

  // ── Per-group validation ────────────────────────────────────────────────────
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    const p = `groups[${gi}]`

    if (group.sequence) {
      validateSequence(group.sequence, `${p}.sequence`, issues)
    }

    for (let ri = 0; ri < group.modulationRoutes.length; ri++) {
      validateRoute(group.modulationRoutes[ri], GROUP_ROUTE_TARGETS, `${p}.modulationRoutes[${ri}]`, issues)
    }
  }

  // ── Global routes ───────────────────────────────────────────────────────────
  for (let ri = 0; ri < globalModulationRoutes.length; ri++) {
    validateRoute(globalModulationRoutes[ri], GLOBAL_ROUTE_TARGETS, `globalModulationRoutes[${ri}]`, issues)
  }

  // ── Output values ───────────────────────────────────────────────────────────
  clampedIssue(issues, 'output.masterDimmer',    output.masterDimmer,    0,   1, 'masterDimmer')
  clampedIssue(issues, 'output.safetyClamp',     output.safetyClamp,     0,   1, 'safetyClamp')
  clampedIssue(issues, 'output.backgroundFade',  output.backgroundFade,  0,   1, 'backgroundFade')
  clampedIssue(issues, 'output.beamPersistence', output.beamPersistence, 0,   1, 'beamPersistence')
  clampedIssue(issues, 'output.globalBeamWidth', output.globalBeamWidth, 0.1, 32, 'globalBeamWidth')
  clampedIssue(issues, 'output.globalGlow',      output.globalGlow,      0,   1, 'globalGlow')

  // ── Fog values ──────────────────────────────────────────────────────────────
  clampedIssue(issues, 'fog.density',       fog.density,       0, 1, 'density')
  clampedIssue(issues, 'fog.opacity',       fog.opacity,       0, 1, 'opacity')
  clampedIssue(issues, 'fog.beamScatter',   fog.beamScatter,   0, 1, 'beamScatter')
  clampedIssue(issues, 'fog.turbulence',    fog.turbulence,    0, 1, 'turbulence')
  clampedIssue(issues, 'fog.diffusion',     fog.diffusion,     0, 1, 'diffusion')
  clampedIssue(issues, 'fog.dissipation',   fog.dissipation,   0, 1, 'dissipation')
  clampedIssue(issues, 'fog.noiseScale',    fog.noiseScale,    0.1, 10, 'noiseScale')

  return issues
}

/**
 * True if there are no errors (warnings are allowed).
 */
export function isValid(settings: LaserDmxBeamMatrixSettings): boolean {
  return validateBeamMatrixSettings(settings).every(i => i.severity !== 'error')
}

/**
 * Normalize a beam matrix settings object in-place by applying safe defaults
 * to any missing or invalid fields.  Returns the mutated object.
 */
export function normalizeBeamMatrixSettings(
  settings: LaserDmxBeamMatrixSettings,
): LaserDmxBeamMatrixSettings {
  for (let i = 0; i < settings.beams.length; i++) {
    const b = settings.beams[i]
    if (!b.motion) {
      settings.beams[i] = { ...b, motion: DEFAULT_BEAM_MOTION }
    } else if (
      (b.motion as { direction?: unknown }).direction !== 'forward'
      || (b.motion as { mode?: unknown }).mode === 'pingPong'
    ) {
      settings.beams[i] = {
        ...b,
        motion: {
          ...b.motion,
          direction: 'forward',
          mode: (b.motion as { mode?: unknown }).mode === 'pingPong' ? 'grow' : b.motion.mode,
        },
      }
    }
    if (!Number.isFinite(b.sequenceIndex)) settings.beams[i] = { ...settings.beams[i], sequenceIndex: i }
  }
  for (let i = 0; i < settings.groups.length; i++) {
    const g = settings.groups[i]
    if (!g.sequence) settings.groups[i] = { ...g, sequence: DEFAULT_BEAM_SEQUENCE }
  }
  return settings
}
