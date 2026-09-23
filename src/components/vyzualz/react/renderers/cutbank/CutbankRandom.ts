import { createPerformanceDeterministicSeed } from '../../../../../features/performanceCore'

/** Small deterministic PRNG. CUTBANK never uses unseeded randomness. */
export function createCutbankRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function cutbankSeed(...parts: Array<string | number | boolean | null | undefined>): number {
  return createPerformanceDeterministicSeed('cutbank', ...parts)
}

export function cutbankUnit(...parts: Array<string | number | boolean | null | undefined>): number {
  return cutbankSeed(...parts) / 0xffffffff
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Fisher–Yates driven by a seeded rng. Returns a new array. */
export function shuffleDeterministic<T>(items: readonly T[], seed: number): T[] {
  const rng = createCutbankRng(seed)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}
