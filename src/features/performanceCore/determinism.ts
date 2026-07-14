/** Stable hashing used by every performance-engine adapter. */
export function hashPerformanceIdentity(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createPerformanceDeterministicSeed(
  ...parts: Array<string | number | boolean | null | undefined>
): number {
  return hashPerformanceIdentity(parts.map(part => part ?? '').join('|'))
}

/** Kept bit-for-bit compatible with the original Show Director resolver. */
export function performanceDeterministicUnit(
  ...parts: Array<string | number | boolean | null | undefined>
): number {
  return createPerformanceDeterministicSeed(...parts) / 0xffffffff
}

export function selectPerformanceDeterministicIndex(
  length: number,
  ...parts: Array<string | number | boolean | null | undefined>
): number {
  const safeLength = Math.max(0, Math.floor(length))
  if (safeLength <= 1) return 0
  return Math.min(safeLength - 1, Math.floor(performanceDeterministicUnit(...parts) * safeLength))
}
