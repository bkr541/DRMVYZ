/**
 * Owns the canvases and timing of stage transitions (docs/preset-transitions.md; the pure drawing and tempo rules are in lib/stageTransition.ts).
 *
 *  - A frame tap keeps the last picture the stage showed in a 2D canvas, only while transitions are on. A WebGL canvas cannot be read back after the fact, and by the time a
 *    change of preset has been noticed the old picture is already on its way out, so the tap is what the transition starts from.
 *  - `trigger` copies that picture, shows the blend canvas over the stage, and draws the blend until it ends. While it runs the blend canvas is what the cast sees
 *    (`onActiveCanvas`), so the audience and the operator get the same picture. A new picture is waited for before the blend starts, so an engine that takes a moment to
 *    produce its first frame (or a preset that is still building) holds the old picture instead of showing a black gap.
 *  - Frames are copied the same way the cast relay copies them (output/relayFramePump.ts): in the task a renderer announces them, or on the frame timer for the 2D engines.
 */
import { FrameCadence } from '../../../lib/frameCadence'
import { isCanvasFramePublisher, isCanvasFrameReady, notifyCanvasFrameRendered } from '../../../lib/canvasFrameReadiness'
import { drawTransitionFrame } from '../../../lib/stageTransition'
import type { PresetTransitionStyle } from '../../../lib/presetTransitions'
import { startRelayFramePump } from './output/relayFramePump'

export const STAGE_TAP_FPS = 20
/** The picture a transition starts from may be this old at most; older means nothing was drawing, so there is nothing worth fading from. */
export const STAGE_TAP_MAX_AGE_MS = 2_500
/** A second trigger this soon after the first is the same change arriving in two steps (an engine, then its preset), not a new one. */
export const STAGE_TRANSITION_COALESCE_MS = 150
/** A 2D engine that does not announce its frames is trusted this long after the transition begins. */
export const STAGE_SETTLE_MS = 120
/** The new picture is waited for this long, then the blend runs anyway. */
export const STAGE_READY_TIMEOUT_MS = 900
const MAX_EDGE = 1600

type Context2D = CanvasRenderingContext2D

export interface StageTransitionControllerOptions {
  /** Called with the blend canvas when a transition begins, and with null when it ends: the cast reads this canvas meanwhile. */
  onActiveCanvas: (canvas: HTMLCanvasElement | null) => void
  now?: () => number
}

interface ActiveTransition { style: PresetTransitionStyle; durationMs: number; triggeredAt: number; startedAt: number | null; stop: () => void }

export class StageTransitionController {
  private readonly sourceRef: { current: HTMLCanvasElement | null } = { current: null }
  private readonly tap = document.createElement('canvas')
  private readonly snapshot = document.createElement('canvas')
  private readonly blendCtx: Context2D | null
  private readonly tapCtx: Context2D | null
  private readonly snapshotCtx: Context2D | null
  private stopTap: (() => void) | null = null
  private lastTapAt = Number.NEGATIVE_INFINITY
  private active: ActiveTransition | null = null
  private enabled = false
  private disposed = false
  private readonly now: () => number

  constructor(private readonly blendCanvas: HTMLCanvasElement, private readonly options: StageTransitionControllerOptions) {
    this.now = options.now ?? (() => performance.now())
    this.blendCtx = blendCanvas.getContext('2d', { alpha: false })
    this.tapCtx = this.tap.getContext('2d', { alpha: false })
    this.snapshotCtx = this.snapshot.getContext('2d', { alpha: false })
    this.hide()
  }

  get running(): boolean { return this.active !== null }

  /** The canvas the stage currently publishes (null between engines). */
  setSource(canvas: HTMLCanvasElement | null): void { this.sourceRef.current = canvas }

  setEnabled(enabled: boolean): void {
    if (this.disposed || enabled === this.enabled) return
    this.enabled = enabled
    if (enabled) {
      this.stopTap = startRelayFramePump({ sourceRef: this.sourceRef, cadence: new FrameCadence(STAGE_TAP_FPS), copy: source => this.copyTap(source), onError: () => undefined })
    } else {
      this.stopTap?.(); this.stopTap = null
      this.finish()
      this.lastTapAt = Number.NEGATIVE_INFINITY
    }
  }

  /** Starts a transition from the picture the stage was showing. Returns false when there was nothing worth fading from (the change is a plain cut). */
  trigger(style: PresetTransitionStyle, durationMs: number): boolean {
    if (this.disposed || !this.enabled || !this.blendCtx || !this.snapshotCtx) return false
    const now = this.now()
    if (this.active && now - this.active.triggeredAt < STAGE_TRANSITION_COALESCE_MS) return true

    // The picture to fade from: the blend as it is now if one is already running (so a quick second change continues from what is on screen), else the tap.
    let from: HTMLCanvasElement
    if (this.active) from = this.blendCanvas
    else if (this.tap.width > 0 && this.tap.height > 0 && now - this.lastTapAt <= STAGE_TAP_MAX_AGE_MS) from = this.tap
    else return false
    this.snapshot.width = from.width
    this.snapshot.height = from.height
    this.snapshotCtx.drawImage(from, 0, 0)
    this.active?.stop()

    this.blendCanvas.width = this.snapshot.width
    this.blendCanvas.height = this.snapshot.height
    drawTransitionFrame(this.blendCtx, style, 0, this.snapshot, null, this.blendCanvas.width, this.blendCanvas.height)
    this.blendCanvas.style.display = 'block'
    const transition: ActiveTransition = { style, durationMs, triggeredAt: now, startedAt: null, stop: () => undefined }
    this.active = transition
    this.options.onActiveCanvas(this.blendCanvas)
    transition.stop = startRelayFramePump({ sourceRef: this.sourceRef, cadence: new FrameCadence(60), copy: source => this.step(transition, source), onError: () => undefined })
    return true
  }

  dispose(): void {
    if (this.disposed) return
    this.setEnabled(false)
    this.disposed = true
  }

  private copyTap(source: HTMLCanvasElement | null): void {
    if (!this.tapCtx || !source || source.width <= 0 || source.height <= 0 || !isCanvasFrameReady(source)) return
    const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height))
    const width = Math.max(2, Math.round(source.width * scale))
    const height = Math.max(2, Math.round(source.height * scale))
    if (this.tap.width !== width || this.tap.height !== height) { this.tap.width = width; this.tap.height = height }
    try { this.tapCtx.drawImage(source, 0, 0, width, height) } catch { return /* A canvas mid-teardown cannot be drawn; the next frame can. */ }
    this.lastTapAt = this.now()
  }

  private step(transition: ActiveTransition, live: HTMLCanvasElement | null): void {
    if (this.active !== transition || !this.blendCtx) return
    const now = this.now()
    const ready = !!live && live.width > 0 && live.height > 0 && isCanvasFrameReady(live)
      && (isCanvasFramePublisher(live) || now - transition.triggeredAt >= STAGE_SETTLE_MS)
    if (transition.startedAt === null && (ready || now - transition.triggeredAt >= STAGE_READY_TIMEOUT_MS)) transition.startedAt = now
    const progress = transition.startedAt === null ? 0 : Math.min(1, (now - transition.startedAt) / transition.durationMs)
    try {
      drawTransitionFrame(this.blendCtx, transition.style, progress, this.snapshot, ready ? live : null, this.blendCanvas.width, this.blendCanvas.height)
    } catch { /* The live canvas was torn down under us; the next frame draws again. */ }
    notifyCanvasFrameRendered(this.blendCanvas, now)
    if (progress >= 1) this.finish()
  }

  private finish(): void {
    const transition = this.active
    if (!transition) return
    this.active = null
    transition.stop()
    this.hide()
    this.options.onActiveCanvas(null)
  }

  private hide(): void { this.blendCanvas.style.display = 'none' }
}
