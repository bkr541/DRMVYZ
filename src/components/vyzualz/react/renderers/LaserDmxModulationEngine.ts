// Shared modulation engine for LaserDMX Spatial Fixtures and Beam Matrix.
// Pure functions plus a single mutable envelope Map that is module-level ephemeral
// state (never persisted). Both compilers share this instance so envelope keys
// must be globally unique (scoped by workspace, entity ID, and route ID).

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
    case 'easeIn':    return x * x
    case 'easeOut':   return 1 - (1 - x) * (1 - x)
    case 'easeInOut': { const t2 = x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x); return t2 }
    case 'pulse':     return Math.pow(Math.sin(x * Math.PI), 2)
    case 'exponential': return Math.pow(x, 3)
    default:          return x  // linear
  }
}

export function resolveStrobeVisible(rate: number, timeSec: number): boolean {
  if (rate <= 0) return true
  const freq = lerp(1, 30, clamp01(rate))
  return (timeSec * freq % 1) < 0.5
}

// ── Shared envelope state ─────────────────────────────────────────────────────
// Key pattern: `${scope}:${entityId}:${routeId}`
// scope = 'sf' for Spatial Fixtures, 'bm' for Beam Matrix, 'bmg' for group, 'bmgl' for global

const envelopes = new Map<string, number>()

export function resetAllEnvelopes(): void {
  envelopes.clear()
}

export function pruneEnvelopes(activeKeys: Set<string>): void {
  for (const k of envelopes.keys()) {
    if (!activeKeys.has(k)) envelopes.delete(k)
  }
}

// ── Route envelope (attack / release / smoothing) ────────────────────────────

function applyEnvelope(
  rawV:      number,
  envKey:    string,
  dt:        number,
  attack:    number,
  release:   number,
  smoothing: number,
): number {
  const prev = envelopes.get(envKey) ?? rawV

  const isRising = rawV >= prev
  const rate = isRising
    ? lerp(200, 0.5, clamp01(attack))
    : lerp(200, 0.5, clamp01(release))

  const enveloped = prev + (rawV - prev) * clamp01(dt * rate)
  const finalV = lerp(rawV, enveloped, clamp01(smoothing))
  envelopes.set(envKey, finalV)
  return clamp01(finalV)
}

// ── Source value resolution ───────────────────────────────────────────────────

export function resolveSourceValue(
  mi:     MusicIntelligenceFrame,
  source: string,
  mode:   string,
): number {
  if (mode === 'trigger') {
    // For trigger routes: 1.0 on the hit frame, 0.0 otherwise.
    // Event aliases are checked first, then fall through to continuous sources.
    return getTriggerSourceValue(mi, source) ? 1.0 : 0.0
  }
  // Continuous sources
  let v = getModulationSourceValue(mi, source)
  // harmonicConfidence backward-compat alias
  if (source === 'harmonicConfidence') {
    v = Math.max(
      safeNumber(mi.harmonic?.keyConfidence,   0),
      safeNumber(mi.harmonic?.chordConfidence, 0),
    )
  }
  return v
}

// ── Public route application ──────────────────────────────────────────────────

export interface RouteApplicationResult {
  /** 0–1 final modulation output after envelope. */
  value: number
  /** The envelope key used, for the caller to track active keys. */
  envKey: string
}

/**
 * Apply a single modulation route and return the fully-processed output value
 * plus the envelope key.
 *
 * Trigger-envelope fix: for mode='trigger', the raw input is 1.0 on the event
 * frame and 0.0 afterward.  Smoothing is forced to 1.0 so the configured
 * release always runs.  The caller must use the returned `value` directly —
 * it must NOT re-check getTriggerSourceValue at apply-time.
 */
export function applyModulationRoute(
  route:  LaserDmxModulationRoute,
  mi:     MusicIntelligenceFrame,
  envKey: string,
  dt:     number,
): RouteApplicationResult | null {
  if (!route.enabled) return null

  const rawValue = resolveSourceValue(mi, route.source, route.mode)

  let v = clamp01(rawValue)
  if (route.invert) v = 1 - v
  v = applyCurve(v, route.curve)

  const lo = safeNumber(route.min, 0)
  const hi = safeNumber(route.max, 1)
  v = lerp(lo, hi, v)

  const amount = clamp(safeNumber(route.amount, 1), -1, 2)
  v = clamp(v * amount, -2, 2)

  // Trigger routes force smoothing=1.0 so release is always honored.
  const effectiveSmoothing = route.mode === 'trigger' ? 1.0 : clamp01(route.smoothing ?? 0)
  v = applyEnvelope(clamp01(v), envKey, dt, route.attack ?? 0, route.release ?? 0, effectiveSmoothing)

  return { value: v, envKey }
}

// ── Apply helper: mode-specific target update ─────────────────────────────────
// Caller reads `result.value` and applies it using the correct mode without
// re-checking the trigger source.

export function modeApply(
  cur:   number,
  value: number,
  mode:  string,
): number {
  switch (mode) {
    case 'set':      return value
    case 'add':      return clamp01(cur + value)
    case 'multiply': return clamp01(cur * value)
    // For trigger mode: apply the enveloped value directly (no re-check).
    case 'trigger':  return value
    default:         return value
  }
}
