// Shared modulation engine for legacy LaserDMX rig data and Beam Matrix.
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
import type { LaserDmxModulationRoute, LaserDmxTriggerTimingFilter } from '../ReactTypes'

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
  const normalizedRate = clamp01(rate)
  if (normalizedRate <= 0) return true
  // Beam Matrix strobe values are a linear 0–30 Hz domain encoded as 0–1.
  // This keeps authored Show Director rates exact: 1 Hz = 1/30, 15 Hz = 0.5,
  // and 30 Hz = 1. The previous 1..30 lerp made every intermediate authored
  // value run too fast (for example 15 Hz rendered at 15.5 Hz).
  const freq = normalizedRate * 30
  return (timeSec * freq % 1) < 0.5
}

// ── Shared envelope state ─────────────────────────────────────────────────────
// Key pattern: `${scope}:${entityId}:${routeId}`
//   'sf'   → legacy rig beam route
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
const syntheticTriggerSlots = new Map<string, number>()
const syntheticBandOverThreshold = new Map<string, boolean>()

export function resetAllEnvelopes(): void {
  envelopes.clear()
  syntheticTriggerSlots.clear()
  syntheticBandOverThreshold.clear()
}

export function pruneEnvelopes(activeKeys: Set<string>): void {
  for (const k of envelopes.keys()) {
    if (!activeKeys.has(k)) envelopes.delete(k)
  }
  for (const k of syntheticTriggerSlots.keys()) {
    if (!activeKeys.has(k)) syntheticTriggerSlots.delete(k)
  }
  for (const k of syntheticBandOverThreshold.keys()) {
    if (!activeKeys.has(k)) syntheticBandOverThreshold.delete(k)
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

// ── Bar / beat numbering utilities ────────────────────────────────────────────
// Internal representation: 0-based (barIndex=0 is the first bar).
// UI representation:       1-based (Bar 1 is the first bar).

/** Convert a 1-based UI bar number to the 0-based internal barIndex. */
export function uiBarToInternalIndex(uiBar: number): number {
  return uiBar - 1
}

/** Convert a 0-based internal barIndex to the 1-based UI bar number. */
export function internalIndexToUiBar(barIndex: number): number {
  return barIndex + 1
}

/** Convert a 1-based UI beat number to the 0-based internal beatInBar. */
export function uiBeatToInternalIndex(uiBeat: number): number {
  return uiBeat - 1
}

// ── Trigger timing filter ─────────────────────────────────────────────────────

/** Sources that produce single-frame boolean hit events and support bar/beat filtering. */
export const TRIGGER_TIMING_EVENT_SOURCES = new Set([
  'beat', 'beatHit',
  'downbeat', 'downbeatHit',
  'kickHit', 'snareHit', 'hatHit',
  'phrase4Hit', 'phrase8Hit', 'phrase16Hit', 'phrase32Hit',
  'chordChange', 'wordHit', 'drumTrans', 'bassTrans',
])

/** Sources that always fire on beat 1 of a bar (beatInBar === 0). */
const DOWNBEAT_ONLY_SOURCES = new Set(['downbeat', 'downbeatHit'])

/**
 * Check whether the current musical position satisfies a trigger timing filter.
 * Returns true if the event is permitted to fire; false if it should be suppressed.
 *
 * Falls back to true (allow) when:
 *  - filter is absent or mode is 'everyOccurrence'
 *  - BPM is 0 or unavailable (no reliable bar analysis)
 */
export function checkTriggerTimingFilter(
  filter:  LaserDmxTriggerTimingFilter | undefined,
  mi:      MusicIntelligenceFrame,
  source?: string,
): boolean {
  if (!filter || filter.mode === 'everyOccurrence') return true

  // Without reliable BPM/bar analysis, fall through to allow.
  if (safeNumber(mi.rhythm.bpm, 0) <= 0) return true

  const barIndex  = safeNumber(mi.rhythm.barIndex,  0)  // 0-based
  const beatInBar = safeNumber(mi.rhythm.beatInBar, 0)  // 0-based
  const uiBar  = internalIndexToUiBar(barIndex)          // 1-based
  const uiBeat = beatInBar + 1                           // 1-based

  switch (filter.mode) {
    case 'specificPosition': {
      if ((filter.bar ?? 1) !== uiBar) return false
      // For downbeat-only sources, beat is always 1 — skip the beat check.
      const skipBeatCheck = source != null && DOWNBEAT_ONLY_SOURCES.has(source)
      if (!skipBeatCheck) {
        const targetBeat = filter.beat
        if (targetBeat !== 'any' && targetBeat != null && targetBeat !== uiBeat) return false
      }
      return true
    }
    case 'specificBars': {
      const bars = filter.bars ?? []
      return bars.includes(uiBar)
    }
    case 'barRange': {
      const start = filter.startBar ?? 1
      const end   = filter.endBar   ?? Infinity
      return uiBar >= start && uiBar <= end
    }
    case 'barInterval': {
      const interval = filter.intervalBars      ?? 1
      const anchor   = filter.intervalAnchorBar ?? 1
      if (interval <= 0 || uiBar < anchor) return false
      return (uiBar - anchor) % interval === 0
    }
    default:
      return true
  }
}

function parseBeatDivisionSource(source: string): number | null {
  if (!source.startsWith('beatDivision:')) return null
  const value = Number(source.slice('beatDivision:'.length))
  if (value === 0.25 || value === 0.5 || value === 1 || value === 2 || value === 4 || value === 8) return value
  return null
}

function getSyntheticBeatDivisionHit(route: LaserDmxModulationRoute, mi: MusicIntelligenceFrame, envKey: string): boolean | null {
  const division = parseBeatDivisionSource(route.source)
  if (division == null) return null
  if (safeNumber(mi.rhythm.bpm, 0) <= 0) return false

  const absoluteBeat = Math.max(0, safeNumber(mi.rhythm.beatIndex, 0) + safeNumber(mi.rhythm.beatPhase, 0))
  const slot = Math.floor(absoluteBeat / division)
  const previousSlot = syntheticTriggerSlots.get(envKey)
  syntheticTriggerSlots.set(envKey, slot)

  // Do not fire immediately on first render; wait for an actual musical boundary.
  if (previousSlot == null) return false
  return slot > previousSlot
}

function getSyntheticAudioBandHit(route: LaserDmxModulationRoute, mi: MusicIntelligenceFrame, envKey: string): boolean | null {
  if (!route.source.startsWith('audioBand:')) return null
  const bandSource = route.source.slice('audioBand:'.length)
  const value = clamp01(getModulationSourceValue(mi, bandSource))
  const threshold = clamp01(route.threshold ?? 0.65)
  const over = value >= threshold
  const wasOver = syntheticBandOverThreshold.get(envKey) ?? false
  syntheticBandOverThreshold.set(envKey, over)
  return over && !wasOver
}

function getSyntheticTriggerSourceValue(route: LaserDmxModulationRoute, mi: MusicIntelligenceFrame, envKey: string): boolean | null {
  const beatDivisionHit = getSyntheticBeatDivisionHit(route, mi, envKey)
  if (beatDivisionHit != null) return beatDivisionHit
  const audioBandHit = getSyntheticAudioBandHit(route, mi, envKey)
  if (audioBandHit != null) return audioBandHit
  return null
}

function triggerThresholdPassed(route: LaserDmxModulationRoute, mi: MusicIntelligenceFrame): boolean {
  const threshold = route.threshold
  if (threshold == null || threshold <= 0) return true
  switch (route.source) {
    case 'kick':
    case 'kickHit':
      return getModulationSourceValue(mi, 'kick') >= threshold
    case 'snare':
    case 'snareHit':
      return getModulationSourceValue(mi, 'snare') >= threshold
    case 'hat':
    case 'hatHit':
      return getModulationSourceValue(mi, 'hat') >= threshold
    case 'transient':
    case 'drumTrans':
    case 'bassTrans':
      return getModulationSourceValue(mi, 'transient') >= threshold
    case 'dropImpact':
      return getModulationSourceValue(mi, 'dropImpact') >= threshold
    default:
      return true
  }
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
    const timingOk = checkTriggerTimingFilter(route.timingFilter, mi, route.source)
    const syntheticHit = getSyntheticTriggerSourceValue(route, mi, envKey)
    const rawHit = (syntheticHit ?? (getTriggerSourceValue(mi, route.source) && triggerThresholdPassed(route, mi))) && timingOk
    const triggered  = route.invert ? !rawHit : rawHit
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
