// Shared modulation engine for LaserDMX Spatial Fixtures and Beam Matrix.
// Pure functions plus module-level ephemeral envelope state (never persisted).
// Both compilers share this instance; envelope keys must be globally unique
// (scoped by workspace, entity ID, and route ID).
//
// Trigger vs continuous distinction:
//   mode='trigger' → event-driven envelope (attack/hold/release phases, seconds).
//     Curve is NOT applied to the envelope output — preserves visible peak even
//     with pulse curve (pulse(1.0)=0 would otherwise destroy the initial hit).
//   mode='set'|'add'|'multiply' → continuous smoothed source, curve applied normally.

import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import {
  getModulationSourceValue,
  getTriggerSourceValue,
} from '../../../../features/musicIntelligence/selectors'
import type { LaserDmxModulationRoute } from '../ReactTypes'

// ── Safety helpers (re-exported so compilers need not re-import) ──────────────

export function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function clamp01(v: number): number { return clamp(safeNumber(v), 0, 1) }

export function clamp255(v: number): number { return Math.round(clamp(safeNumber(v), 0, 255)) }

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t)
}

export function applyCurve(v: number, curve: string): number {
  const x = clamp01(v)
  switch (curve) {
    case 'easeIn':      return x * x
    case 'easeOut':     return 1 - (1 - x) * (1 - x)
    case 'easeInOut':   { const t2 = x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x); return t2 }
    case 'pulse':       return Math.pow(Math.sin(x * Math.PI), 2)
    case 'exponential': return Math.pow(x, 3)
    default:            return x  // linear
  }
}

export function resolveStrobeVisible(rate: number, timeSec: number): boolean {
  if (rate <= 0) return true
  const freq = lerp(1, 30, clamp01(rate))
  return (timeSec * freq % 1) < 0.5
}

// ── Shared envelope state ─────────────────────────────────────────────────────
// Key pattern: `${scope}:${entityId}:${routeId}`
//   'sf'   → Spatial Fixtures beam route
//   'bm'   → Beam Matrix beam route
//   'bmg'  → Beam Matrix group route
//   'bmgl' → Beam Matrix global route

interface EnvelopeState {
  /** Current 0–1 envelope value. */
  value: number
  /** Phase for trigger envelopes; 'idle' for continuous envelopes. */
  phase: 'idle' | 'attack' | 'hold' | 'release'
  /** Accumulated hold time (seconds). */
  holdTimer: number
}

const envelopes = new Map<string, EnvelopeState>()

export function resetAllEnvelopes(): void {
  envelopes.clear()
}

export function pruneEnvelopes(activeKeys: Set<string>): void {
  for (const k of envelopes.keys()) {
    if (!activeKeys.has(k)) envelopes.delete(k)
  }
}

// ── Time-based exponential approach ──────────────────────────────────────────

/**
 * Exponential approach from prev toward target over durationSec seconds.
 * One time-constant (durationSec) reaches ≈63% of the way.
 * durationSec ≤ 0 snaps immediately to target.
 */
function approachBySeconds(
  prev:        number,
  target:      number,
  dtSec:       number,
  durationSec: number,
): number {
  if (durationSec <= 0) return target
  const coeff = 1 - Math.exp(-Math.max(0, dtSec) / Math.max(0.0001, durationSec))
  return prev + (target - prev) * coeff
}

// ── Trigger envelope (attack → hold → release phases) ────────────────────────

/**
 * Drive an event-triggered envelope.  Returns the current envelope value [0,1].
 *
 * Curve is intentionally NOT applied here so that trigger routes always produce
 * a visible peak.  Applying pulse(1.0) = sin(π)² ≈ 0 would destroy the hit.
 *
 * attack, hold, release are all in seconds:
 *   attack=0     → instant rise to 1.0
 *   hold=0.035   → stay at 1.0 for 35 ms
 *   release=0.22 → visible exponential decay over ≈220 ms
 */
function applyTriggerEnvelope(
  envKey:     string,
  triggered:  boolean,
  dtSec:      number,
  attackSec:  number,
  holdSec:    number,
  releaseSec: number,
): number {
  const state: EnvelopeState = envelopes.get(envKey) ??
    { value: 0, phase: 'idle', holdTimer: 0 }

  if (triggered) {
    // Restart from current value so retriggering mid-release blends smoothly.
    state.phase     = 'attack'
    state.holdTimer = 0
  }

  let { value, phase, holdTimer } = state

  switch (phase) {
    case 'idle':
      value = 0
      break

    case 'attack':
      value = approachBySeconds(value, 1.0, dtSec, attackSec)
      if (value >= 0.999 || attackSec <= 0) {
        value     = 1.0
        phase     = holdSec > 0 ? 'hold' : 'release'
        holdTimer = 0
      }
      break

    case 'hold':
      value      = 1.0
      holdTimer += dtSec
      if (holdTimer >= holdSec) phase = 'release'
      break

    case 'release':
      value = approachBySeconds(value, 0, dtSec, releaseSec)
      if (value < 0.001 || releaseSec <= 0) {
        value = 0
        phase = 'idle'
      }
      break
  }

  envelopes.set(envKey, { value, phase, holdTimer })
  return clamp01(value)
}

// ── Continuous envelope (smoothed slew-rate limiter) ─────────────────────────

function applyContinuousEnvelope(
  rawV:       number,
  envKey:     string,
  dtSec:      number,
  attackSec:  number,
  releaseSec: number,
  smoothing:  number,
): number {
  // Initialise to rawV on the first call so there is no jump on the first frame.
  const prev     = envelopes.get(envKey)?.value ?? rawV
  const isRising = rawV >= prev
  const durSec   = isRising ? attackSec : releaseSec
  const enveloped = approachBySeconds(prev, rawV, dtSec, durSec)
  const finalV   = smoothing > 0 ? lerp(rawV, enveloped, clamp01(smoothing)) : enveloped
  envelopes.set(envKey, { value: finalV, phase: 'idle', holdTimer: 0 })
  return finalV
}

// ── Legacy source resolver (kept for callers outside applyModulationRoute) ────

export function resolveSourceValue(
  mi:     MusicIntelligenceFrame,
  source: string,
  mode:   string,
): number {
  if (mode === 'trigger') {
    return getTriggerSourceValue(mi, source) ? 1.0 : 0.0
  }
  return getModulationSourceValue(mi, source)
}

// ── Public route application ──────────────────────────────────────────────────

export interface RouteApplicationResult {
  /** Final modulation output. May be outside [0,1] for bipolar offset targets. */
  value: number
  /** The envelope key used, for active-key pruning. */
  envKey: string
}

/**
 * Apply a single modulation route and return the processed output value.
 *
 * TRIGGER routes (mode='trigger'):
 *   1. Detect the event via getTriggerSourceValue (boolean per frame).
 *   2. Drive a time-based attack/hold/release envelope (values in seconds).
 *   3. Map the envelope output through min/max and amount.
 *   4. Do NOT apply the curve — preserves visible peak for any curve selection.
 *
 * CONTINUOUS routes (mode='set'|'add'|'multiply'):
 *   1. Read the 0–1 source value.
 *   2. Apply invert → curve → min/max → amount.
 *   3. Apply smoothed continuous envelope (attack/release as time constants).
 */
export function applyModulationRoute(
  route:  LaserDmxModulationRoute,
  mi:     MusicIntelligenceFrame,
  envKey: string,
  dt:     number,
): RouteApplicationResult | null {
  if (!route.enabled) return null

  const attackSec  = Math.max(0, safeNumber(route.attack,  0))
  // 'hold' is an optional extension field not yet in the base type.
  const holdSec    = Math.max(0, safeNumber(route.hold ?? 0, 0))
  const releaseSec = Math.max(0, safeNumber(route.release, 0))
  const lo     = safeNumber(route.min,    0)
  const hi     = safeNumber(route.max,    1)
  const amount = clamp(safeNumber(route.amount, 1), -1, 2)

  if (route.mode === 'trigger') {
    const triggerHit = getTriggerSourceValue(mi, route.source)
    const triggered  = route.invert ? !triggerHit : triggerHit
    const envValue   = applyTriggerEnvelope(envKey, triggered, dt, attackSec, holdSec, releaseSec)
    // Map through min/max and amount; curve NOT applied (see module header).
    const mapped = clamp(lerp(lo, hi, envValue) * amount, -2, 2)
    return { value: mapped, envKey }
  }

  // Continuous path
  const rawValue = getModulationSourceValue(mi, route.source)
  let v = clamp01(safeNumber(rawValue, 0))
  if (route.invert) v = 1 - v
  // Apply optional threshold gate before curve evaluation.
  const thresh = route.threshold ?? 0
  if (thresh > 0 && thresh < 1) {
    v = v <= thresh ? 0 : (v - thresh) / (1 - thresh)
  }
  v = applyCurve(v, route.curve)
  v = lerp(lo, hi, v)
  v = clamp(v * amount, -2, 2)
  const smoothing = clamp01(route.smoothing ?? 0)
  v = applyContinuousEnvelope(v, envKey, dt, attackSec, releaseSec, smoothing)
  return { value: v, envKey }
}

// ── Mode-specific target update ───────────────────────────────────────────────

/**
 * Combine a current value with a modulation value according to route mode.
 * Does NOT clamp — each target adapter must clamp to its own valid domain.
 * Clamping here would break add/multiply routes on non-normalized targets
 * (pixel offsets, beam widths, etc.).
 */
export function modeApply(
  cur:   number,
  value: number,
  mode:  string,
): number {
  switch (mode) {
    case 'set':      return value
    case 'add':      return cur + value
    case 'multiply': return cur * value
    case 'trigger':  return value
    default:         return value
  }
}
