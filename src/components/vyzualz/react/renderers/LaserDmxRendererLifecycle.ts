export type LaserDmxRendererResetReason =
  | 'trackReplacement'
  | 'presetReplacement'
  | 'contextLost'
  | 'contextRestored'
  | 'dispose'

export interface LaserDmxRendererLifecycleSnapshot {
  paused: boolean
  contextLost: boolean
  disposed: boolean
  generation: number
  trackKey: string | null
  presetKey: string | null
}

export interface LaserDmxRendererLifecycleSync {
  isPlaying: boolean
  trackKey: string | null
  presetKey: string | null
}

/**
 * Small lifecycle state machine for the Canvas2D production renderer. It owns no
 * animation loop, so the React canvas remains the sole requestAnimationFrame
 * owner. This makes cleanup deterministic for live canvases and thumbnails.
 */
export class LaserDmxRendererLifecycle {
  private snapshotValue: LaserDmxRendererLifecycleSnapshot = {
    paused: true,
    contextLost: false,
    disposed: false,
    generation: 0,
    trackKey: null,
    presetKey: null,
  }

  constructor(private readonly onReset: (reason: LaserDmxRendererResetReason) => void) {}

  get snapshot(): Readonly<LaserDmxRendererLifecycleSnapshot> {
    return this.snapshotValue
  }

  sync(input: LaserDmxRendererLifecycleSync): boolean {
    if (this.snapshotValue.disposed || this.snapshotValue.contextLost) return false
    if (this.snapshotValue.trackKey !== null && input.trackKey !== this.snapshotValue.trackKey) {
      this.reset('trackReplacement')
    }
    if (this.snapshotValue.presetKey !== null && input.presetKey !== this.snapshotValue.presetKey) {
      this.reset('presetReplacement')
    }
    this.snapshotValue = {
      ...this.snapshotValue,
      paused: !input.isPlaying,
      trackKey: input.trackKey,
      presetKey: input.presetKey,
    }
    return !this.snapshotValue.paused && !this.snapshotValue.contextLost && !this.snapshotValue.disposed
  }

  pause(): void {
    if (!this.snapshotValue.disposed) this.snapshotValue = { ...this.snapshotValue, paused: true }
  }

  resume(): void {
    if (!this.snapshotValue.disposed && !this.snapshotValue.contextLost) {
      this.snapshotValue = { ...this.snapshotValue, paused: false }
    }
  }

  handleContextLost(): void {
    if (this.snapshotValue.disposed || this.snapshotValue.contextLost) return
    this.snapshotValue = {
      ...this.snapshotValue,
      contextLost: true,
      paused: true,
      generation: this.snapshotValue.generation + 1,
    }
    this.onReset('contextLost')
  }

  handleContextRestored(): void {
    if (this.snapshotValue.disposed || !this.snapshotValue.contextLost) return
    this.snapshotValue = { ...this.snapshotValue, contextLost: false, generation: this.snapshotValue.generation + 1 }
    this.onReset('contextRestored')
  }

  dispose(): void {
    if (this.snapshotValue.disposed) return
    this.onReset('dispose')
    this.snapshotValue = { ...this.snapshotValue, disposed: true, paused: true, generation: this.snapshotValue.generation + 1 }
  }

  private reset(reason: LaserDmxRendererResetReason): void {
    this.snapshotValue = { ...this.snapshotValue, generation: this.snapshotValue.generation + 1 }
    this.onReset(reason)
  }
}

interface LifecycleHost {
  lifecycle: LaserDmxRendererLifecycle
  canvas: HTMLCanvasElement | null
  onContextLost: EventListener
  onContextRestored: EventListener
}

const hosts = new WeakMap<CanvasRenderingContext2D, LifecycleHost>()
const CONTEXT_LOST_EVENTS = ['webglcontextlost', 'contextlost'] as const
const CONTEXT_RESTORED_EVENTS = ['webglcontextrestored', 'contextrestored'] as const

export function getLaserDmxRendererLifecycle(
  ctx: CanvasRenderingContext2D,
  onReset: (reason: LaserDmxRendererResetReason) => void,
): LaserDmxRendererLifecycle {
  const existing = hosts.get(ctx)
  if (existing) return existing.lifecycle

  const lifecycle = new LaserDmxRendererLifecycle(onReset)
  const canvas = ctx.canvas ?? null
  const onContextLost: EventListener = event => {
    if ('preventDefault' in event && typeof event.preventDefault === 'function') event.preventDefault()
    lifecycle.handleContextLost()
  }
  const onContextRestored: EventListener = () => lifecycle.handleContextRestored()
  for (const eventName of CONTEXT_LOST_EVENTS) canvas?.addEventListener?.(eventName, onContextLost)
  for (const eventName of CONTEXT_RESTORED_EVENTS) canvas?.addEventListener?.(eventName, onContextRestored)
  hosts.set(ctx, { lifecycle, canvas, onContextLost, onContextRestored })
  return lifecycle
}

export function disposeLaserDmxRendererLifecycle(ctx: CanvasRenderingContext2D): void {
  const host = hosts.get(ctx)
  if (!host) return
  for (const eventName of CONTEXT_LOST_EVENTS) host.canvas?.removeEventListener?.(eventName, host.onContextLost)
  for (const eventName of CONTEXT_RESTORED_EVENTS) host.canvas?.removeEventListener?.(eventName, host.onContextRestored)
  host.lifecycle.dispose()
  hosts.delete(ctx)
}
