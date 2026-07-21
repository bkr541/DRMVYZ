export function finiteSimulationNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function clampSimulationNumber(value: unknown, minimum: number, maximum: number): number {
  const low = Math.min(finiteSimulationNumber(minimum), finiteSimulationNumber(maximum))
  const high = Math.max(finiteSimulationNumber(minimum), finiteSimulationNumber(maximum))
  return Math.max(low, Math.min(high, finiteSimulationNumber(value, low)))
}

export function lerpSimulationNumber(start: number, end: number, amount: number): number {
  return finiteSimulationNumber(start) + (finiteSimulationNumber(end) - finiteSimulationNumber(start))
    * clampSimulationNumber(amount, 0, 1)
}

export function smoothSimulationProgress(value: number): number {
  const t = clampSimulationNumber(value, 0, 1)
  return t * t * (3 - 2 * t)
}
