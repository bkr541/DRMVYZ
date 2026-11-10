// Sound Drawing XY: the per-canvas runtime. Owns the layout, the conversation, the live scope window and the
// beam renderer, and advances them one frame at a time from the audio inputs the surface hands in. It keeps
// drawing while the music is paused, so the word is always on screen and settles to its crisp rest state.

import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import { XyScopeBeamRenderer, parseXyScopeColor, type XyScopeRgb } from './XyScopeBeam'
import { XyScopeConversation } from './XyScopeConversation'
import { deriveXyScopeEvents } from './XyScopeEvents'
import {
  buildXyScopeLayout,
  EMPTY_XY_SCOPE_LAYOUT,
  getDefaultXyScopeFont,
  type XyScopeFontSource,
  type XyScopeLayout,
} from './XyScopeGeometry'
import {
  computeXyScopeGlyphPoints,
  createXyScopePointBuffers,
  XyScopeScopeWindow,
  type XyScopePointBuffers,
} from './XyScopeMotion'
import { resolveXyScopeParameters, type XyScopeResolvedParameters, type XyScopeSettings } from './XyScopeSettings'

const FALLBACK_BACKGROUND: XyScopeRgb = [2, 7, 10]
const FALLBACK_BEAM: XyScopeRgb = [150, 255, 240]
const FALLBACK_GLOW: XyScopeRgb = [20, 217, 197]

export interface XyScopeFrameInput {
  /** Wall-clock seconds, monotonic. */
  nowSec: number
  /** The shared performance context for the current audio frame, or null with nothing loaded. */
  context: SharedPerformanceContext | null
  /** True when the audio-feature frame advanced since the last call, so a one-frame hit is never counted twice. */
  fresh: boolean
  stereo: StereoScopeFrame | null
}

export interface XyScopeRuntimeStatus {
  /** `stereo` is the track's real left/right signal; `fallback` is a procedural stand-in. */
  scopeSource: 'stereo' | 'fallback'
  points: number
  letters: number
}

export class XyScopeRuntime {
  private readonly beam: XyScopeBeamRenderer
  private readonly conversation = new XyScopeConversation()
  private readonly scope = new XyScopeScopeWindow()
  private settings: XyScopeSettings | null = null
  private params: XyScopeResolvedParameters | null = null
  private font: XyScopeFontSource = getDefaultXyScopeFont()
  private layout: XyScopeLayout = EMPTY_XY_SCOPE_LAYOUT
  private layoutKey = ''
  private buffers: XyScopePointBuffers[] = []
  private flashes: number[] = []
  private previousContext: SharedPerformanceContext | null = null
  private lastNowSec: number | null = null
  private width = 0
  private height = 0
  private needsClear = true
  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    this.beam = new XyScopeBeamRenderer(canvas)
  }

  setSettings(settings: XyScopeSettings, font: XyScopeFontSource | null): void {
    this.settings = settings
    this.params = resolveXyScopeParameters(settings)
    const next = font ?? getDefaultXyScopeFont()
    if (next.id !== this.font.id) this.font = next
    this.rebuildLayoutIfNeeded()
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.width = cssWidth
    this.height = cssHeight
    if (this.beam.resize(cssWidth, cssHeight, dpr)) this.needsClear = true
    this.rebuildLayoutIfNeeded()
  }

  getStatus(): XyScopeRuntimeStatus {
    return { scopeSource: this.scope.frame.source, points: this.layout.totalPoints, letters: this.layout.glyphs.length }
  }

  /** A seek, track change or engine restart: every letter returns to rest and the trail is wiped. */
  reset(): void {
    this.conversation.reset(this.layout.glyphs.length)
    this.previousContext = null
    this.needsClear = true
  }

  renderFrame(input: XyScopeFrameInput): void {
    const params = this.params
    if (this.disposed || !params || this.width <= 0 || this.height <= 0) return
    const dt = this.lastNowSec === null ? 1 / 60 : Math.max(1 / 240, Math.min(0.06, input.nowSec - this.lastNowSec))
    this.lastNowSec = input.nowSec
    const background = parseXyScopeColor(params.backgroundColor, FALLBACK_BACKGROUND)
    if (this.needsClear) { this.beam.clear(background); this.needsClear = false }

    if (input.fresh) {
      const result = deriveXyScopeEvents(input.context, this.previousContext, {
        audioReactivity: params.audioReactivity,
        phraseDissolve: params.phraseDissolve,
        phraseLength: params.phraseLength,
        dropDissolve: params.dropDissolve,
      })
      if (result.discontinuity) this.conversation.reset(this.layout.glyphs.length)
      for (const event of result.events) {
        this.conversation.push(event, input.nowSec, { dissolveDepth: params.dissolveDepth, answerDelayMs: params.answerDelayMs })
      }
      if (input.context) this.previousContext = input.context
    }

    const scopeFrame = this.scope.update(input.stereo?.left ?? null, input.stereo?.right ?? null, dt, input.nowSec)
    this.conversation.update(dt, input.nowSec, { dissolveDepth: params.dissolveDepth, answerDelayMs: params.answerDelayMs })

    // Audio Reactivity zero holds the word perfectly still.
    const motion = { vibration: params.vibration * Math.min(1, params.audioReactivity), dissolveDepth: params.dissolveDepth }
    const glyphs = this.layout.glyphs
    for (let g = 0; g < glyphs.length; g += 1) {
      const state = this.conversation.states[g]
      computeXyScopeGlyphPoints(glyphs[g], g, state, this.conversation.dissolve(g), motion, scopeFrame, this.buffers[g])
      this.flashes[g] = state.flash
    }
    this.beam.draw(glyphs, this.buffers, this.flashes, dt, {
      beamColor: parseXyScopeColor(params.beamColor, FALLBACK_BEAM),
      glowColor: parseXyScopeColor(params.glowColor, FALLBACK_GLOW),
      backgroundColor: background,
      intensity: params.intensity,
      glow: params.glow,
      trailMs: params.trailMs,
    })
  }

  dispose(): void {
    this.disposed = true
    this.buffers = []
    this.previousContext = null
  }

  private rebuildLayoutIfNeeded(): void {
    const settings = this.settings
    const params = this.params
    if (!settings || !params || this.width <= 0 || this.height <= 0) return
    const key = [settings.text, this.font.id, Math.round(this.width), Math.round(this.height), params.size, params.letterSpacing, params.minPieceSize].join('|')
    if (key === this.layoutKey) return
    this.layoutKey = key
    this.layout = buildXyScopeLayout({
      text: settings.text,
      font: this.font,
      width: this.width,
      height: this.height,
      size: params.size,
      letterSpacing: params.letterSpacing,
      minPieceSize: params.minPieceSize,
    })
    this.buffers = this.layout.glyphs.map(glyph => createXyScopePointBuffers(glyph.count))
    this.flashes = this.layout.glyphs.map(() => 0)
    this.conversation.reset(this.layout.glyphs.length)
    this.needsClear = true
  }
}
