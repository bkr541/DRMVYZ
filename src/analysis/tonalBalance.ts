import type { TonalBalance } from '../types/meters'

const BANDS: Array<{ label: string; lo: number; hi: number }> = [
  { label: 'Sub',      lo: 20,   hi: 60   },
  { label: 'Bass',     lo: 60,   hi: 250  },
  { label: 'Low-Mid',  lo: 250,  hi: 500  },
  { label: 'Mid',      lo: 500,  hi: 2000 },
  { label: 'High-Mid', lo: 2000, hi: 6000 },
  { label: 'Presence', lo: 6000, hi: 12000},
  { label: 'Air',      lo: 12000,hi: 20000},
]

export const TONAL_BAND_LABELS = BANDS.map(b => b.label)

export function calcTonalBalance(
  freqData: Uint8Array<ArrayBuffer>,
  sampleRate: number
): TonalBalance {
  const bins = freqData.length
  const nyq = sampleRate / 2

  function bandEnergy(lo: number, hi: number): number {
    let sum = 0, count = 0
    for (let i = 0; i < bins; i++) {
      const freq = (i / bins) * nyq
      if (freq >= lo && freq <= hi) {
        const v = freqData[i] / 255
        sum += v * v
        count++
      }
    }
    return count > 0 ? Math.sqrt(sum / count) : 0
  }

  return {
    sub:      bandEnergy(BANDS[0].lo, BANDS[0].hi),
    bass:     bandEnergy(BANDS[1].lo, BANDS[1].hi),
    lowMid:   bandEnergy(BANDS[2].lo, BANDS[2].hi),
    mid:      bandEnergy(BANDS[3].lo, BANDS[3].hi),
    highMid:  bandEnergy(BANDS[4].lo, BANDS[4].hi),
    presence: bandEnergy(BANDS[5].lo, BANDS[5].hi),
    air:      bandEnergy(BANDS[6].lo, BANDS[6].hi),
  }
}

// Reference targets as normalized [min, max] ranges (genre-averaged approximations)
export const TONAL_TARGETS: Record<keyof TonalBalance, [number, number]> = {
  sub:      [0.05, 0.25],
  bass:     [0.20, 0.45],
  lowMid:   [0.15, 0.35],
  mid:      [0.20, 0.45],
  highMid:  [0.15, 0.40],
  presence: [0.10, 0.35],
  air:      [0.05, 0.25],
}

export type TonalIssue = {
  band: keyof TonalBalance
  direction: 'high' | 'low'
  amount: number
}

export function detectTonalIssues(tb: TonalBalance): TonalIssue[] {
  const issues: TonalIssue[] = []
  const keys = Object.keys(tb) as (keyof TonalBalance)[]
  for (const k of keys) {
    const [lo, hi] = TONAL_TARGETS[k]
    const v = tb[k]
    if (v > hi + 0.1) issues.push({ band: k, direction: 'high', amount: v - hi })
    else if (v < lo - 0.05 && v > 0.01) issues.push({ band: k, direction: 'low', amount: lo - v })
  }
  return issues
}
