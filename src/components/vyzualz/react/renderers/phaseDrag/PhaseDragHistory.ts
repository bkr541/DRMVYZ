import type { CanvasPhaseDragSettings } from './PhaseDragSettings'

const QUALITY = {
  low: { samples: 4, historyEdge: 384, outputEdge: 960 },
  balanced: { samples: 8, historyEdge: 640, outputEdge: 1920 },
  high: { samples: 12, historyEdge: 960, outputEdge: 2560 },
} as const

export function phaseDragSize(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(1, width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function resolvePhaseDragPlan(settings: CanvasPhaseDragSettings, width: number, height: number, dpr = 1) {
  const area = width * height
  const tier = settings.quality === 'auto' ? area <= 960 * 540 ? 'high' : area <= 1920 * 1080 ? 'balanced' : 'low' : settings.quality
  const plan = QUALITY[tier]
  const density = Math.max(1, Math.min(2, dpr))
  return { tier, samples: Math.min(settings.historySamples, plan.samples), historyEdge: plan.historyEdge,
    output: phaseDragSize(width * density, height * density, plan.outputEdge) }
}

/** Only written slots are visible to the shader. A cold history starts at the current frame. */
export class PhaseDragHistory {
  private timestamps = new Float64Array(12)
  private head = -1
  private count = 0
  readonly uniforms = new Float32Array(24)

  reset() { this.head = -1; this.count = 0 }

  nextSlot(time: number, window: number, capacity: number): number | null {
    if (this.count && time - this.timestamps[this.head] + 1e-5 < window / (capacity - 1)) return null
    this.head = (this.head + 1) % capacity
    this.timestamps[this.head] = time
    this.count = Math.min(capacity, this.count + 1)
    return this.head
  }

  describe(time: number, capacity: number): number {
    for (let i = 0; i < this.count; i++) {
      const slot = (this.head - i + capacity) % capacity
      this.uniforms[i * 2] = slot
      this.uniforms[i * 2 + 1] = Math.max(0, time - this.timestamps[slot])
    }
    return this.count
  }
}
