export type LiveFpsCallback = ((fps: number) => void) | undefined

/** Normalizes diagnostics so unavailable/invalid samples are always reported as 0. */
export function normalizeLiveFps(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

/**
 * Deduplicates FPS callback traffic while still allowing render paths to clear a
 * stale reading immediately when diagnostics become unavailable.
 */
export function createLiveFpsReporter(getCallback: () => LiveFpsCallback) {
  let lastReported: number | null = null

  function report(value: number): boolean {
    const normalized = normalizeLiveFps(value)
    if (normalized === lastReported) return false
    lastReported = normalized
    getCallback()?.(normalized)
    return true
  }

  return {
    report,
    unavailable: () => report(0),
    getLastReported: () => lastReported,
  }
}
