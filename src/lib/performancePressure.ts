/**
 * One shared "the machine is overworked" signal. Anything that can see overload from outside a render loop (a cast stream whose frame rate has collapsed, a GPU
 * process that just died, a window that was just recovered from a freeze) reports it here; every renderer reads it and sheds load. The engines' own frame-time
 * governors only see slowness inside their own loop, so they are blind to exactly these cases.
 *
 *   0 = none        1 = elevated (step quality down one tier)        2 = severe (lowest quality, and the cast relay halves its frame rate)
 *
 * A source holds its level until it clears it or its hold time runs out, so a source that dies without clearing never leaves the app degraded for good.
 */
export type PerformancePressureLevel = 0 | 1 | 2
export type PerformancePressureSource = 'cast' | 'recovery' | 'gpu'

interface SourceState { level: PerformancePressureLevel; until: number | null }

const sources = new Map<PerformancePressureSource, SourceState>()
const listeners = new Set<(level: PerformancePressureLevel) => void>()
let lastNotified: PerformancePressureLevel = 0
let expiryTimer: ReturnType<typeof setTimeout> | null = null

function clampLevel(value: number): PerformancePressureLevel {
  return value >= 2 ? 2 : value >= 1 ? 1 : 0
}

/** The current level: the highest held by any source that has not expired. */
export function getPerformancePressure(now: number = Date.now()): PerformancePressureLevel {
  let level: PerformancePressureLevel = 0
  for (const state of sources.values()) {
    if (state.until !== null && state.until <= now) continue
    if (state.level > level) level = state.level
  }
  return level
}

function notifyIfChanged(): void {
  const level = getPerformancePressure()
  scheduleExpiryCheck()
  if (level === lastNotified) return
  lastNotified = level
  for (const listener of [...listeners]) {
    try { listener(level) } catch { /* A listener must never stop the others. */ }
  }
}

function scheduleExpiryCheck(): void {
  if (expiryTimer !== null) { clearTimeout(expiryTimer); expiryTimer = null }
  const now = Date.now()
  let soonest: number | null = null
  for (const state of sources.values()) {
    if (state.level === 0 || state.until === null || state.until <= now) continue
    if (soonest === null || state.until < soonest) soonest = state.until
  }
  if (soonest === null) return
  expiryTimer = setTimeout(() => { expiryTimer = null; notifyIfChanged() }, Math.max(1, soonest - now + 1))
}

/** Sets (or, with level 0, clears) one source's pressure. `holdMs` makes it expire by itself. */
export function setPerformancePressure(source: PerformancePressureSource, level: number, options: { holdMs?: number } = {}): void {
  const next = clampLevel(level)
  if (next === 0) sources.delete(source)
  else sources.set(source, { level: next, until: options.holdMs != null && options.holdMs > 0 ? Date.now() + options.holdMs : null })
  notifyIfChanged()
}

/** Calls `listener` whenever the combined level changes (including when a hold time runs out). Returns the unsubscribe. */
export function subscribePerformancePressure(listener: (level: PerformancePressureLevel) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function resetPerformancePressureForTests(): void {
  sources.clear()
  listeners.clear()
  lastNotified = 0
  if (expiryTimer !== null) { clearTimeout(expiryTimer); expiryTimer = null }
}
