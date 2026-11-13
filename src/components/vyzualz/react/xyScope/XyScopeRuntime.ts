// Sound Drawing XY: the per-canvas runtime. Owns the layout, the conversation, the pattern choreography, the live
// scope window and the beam renderer, and advances them one frame at a time from the audio inputs the surface hands
// in. It keeps drawing while the music is paused, so the word is always on screen.
//
// Each pattern performs the word continuously. Pattern Change only steps between
// routines through the same event controller Cinema 2.0 uses.

import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import { Cinema2MainframePatternController } from '../../cinema2/modules/mainframe/Cinema2MainframePatternController'
import { XyScopeBeamRenderer, parseXyScopeColor, type XyScopeRgb } from './XyScopeBeam'
import { applyXyScopeBeamChoreography, xyScopeChoreographyPhrase, type XyScopeChoreographyPhase } from './XyScopeChoreography'
import { XyScopeConversation } from './XyScopeConversation'
import { deriveXyScopeEvents, resolveXyScopeTriggerEventId } from './XyScopeEvents'
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
import { createXyScopeFormDrive, XY_SCOPE_PATTERN_CYCLE, type XyScopePattern } from './XyScopePatterns'
import { resolveXyScopeParameters, type XyScopeResolvedParameters, type XyScopeSettings } from './XyScopeSettings'

const FALLBACK_BACKGROUND: XyScopeRgb = [2, 7, 10]
const FALLBACK_BEAM: XyScopeRgb = [150, 255, 240]
const FALLBACK_GLOW: XyScopeRgb = [20, 217, 197]
/** One full turn of an oscillator figure per this many beats at full Motion Amount. */
const BEATS_PER_TURN = 8
/** Tempo assumed when nothing is loaded or BPM Sync is off. */
const FREE_RUN_BEATS_PER_SECOND = 2

export interface XyScopeFrameInput {
  /** Wall-clock seconds, monotonic. */
  nowSec: number
  /** The shared performance context for the current audio frame, or null with nothing loaded. */
  context: SharedPerformanceContext | null
  /** True when the audio-feature frame advanced since the last call, so a one-frame hit is never counted twice. */
  fresh: boolean
  stereo: StereoScopeFrame | null
  /** Explicit transport state from the surface; paused audio settles to the word. */
  playing?: boolean
}

export interface XyScopeRuntimeStatus {
  /** `stereo` is the track's real left/right signal; `fallback` is a procedural stand-in. */
  scopeSource: 'stereo' | 'fallback'
  points: number
  letters: number
  /** The selected text choreography routine. */
  pattern: XyScopePattern
  performingPattern: XyScopePattern
  phase: XyScopeChoreographyPhase
}

export class XyScopeRuntime {
  private readonly beam: XyScopeBeamRenderer
  private readonly conversation = new XyScopeConversation()
  private readonly controller = new Cinema2MainframePatternController<XyScopePattern>(XY_SCOPE_PATTERN_CYCLE, 'word')
  private readonly scope = new XyScopeScopeWindow()
  private readonly drive = createXyScopeFormDrive()
  private settings: XyScopeSettings | null = null
  private params: XyScopeResolvedParameters | null = null
  private font: XyScopeFontSource = getDefaultXyScopeFont()
  private layout: XyScopeLayout = EMPTY_XY_SCOPE_LAYOUT
  private layoutKey = ''
  private buffers: XyScopePointBuffers[] = []
  private flashes: number[] = []
  private previousContext: SharedPerformanceContext | null = null
  private lastNowSec: number | null = null
  private lastAbsoluteBeat: number | null = null
  private choreographyBeat = 0
  private performanceAmount = 0
  private performingPattern: XyScopePattern = 'word'
  private phraseVisit = 0
  private blanked = false
  private phase = 0
  private sequence = 0
  private activePattern: XyScopePattern = 'word'
  private width = 0
  private height = 0
  private needsClear = true
  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    this.beam = new XyScopeBeamRenderer(canvas)
  }

  setSettings(settings: XyScopeSettings, font: XyScopeFontSource | null): void {
    const patternChanged = this.params != null && this.params.pattern !== settings.parameters.pattern
    this.settings = settings
    this.params = resolveXyScopeParameters(settings)
    const next = font ?? getDefaultXyScopeFont()
    if (next.id !== this.font.id) this.font = next
    this.rebuildLayoutIfNeeded()
    if (patternChanged) this.restartChoreography()
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.width = cssWidth
    this.height = cssHeight
    if (this.beam.resize(cssWidth, cssHeight, dpr)) this.needsClear = true
    this.rebuildLayoutIfNeeded()
  }

  getStatus(): XyScopeRuntimeStatus {
    return { scopeSource: this.scope.frame.source, points: this.layout.totalPoints, letters: this.layout.glyphs.length, pattern: this.activePattern, performingPattern: this.performingPattern, phase: xyScopeChoreographyPhrase(this.choreographyBeat, this.params?.transitionBeats ?? 1).phase }
  }

  /** A track change or engine restart: every letter returns to the authored pattern and the trail is wiped. */
  reset(): void {
    this.restartChoreography()
    this.previousContext = null
    this.lastAbsoluteBeat = null
    this.needsClear = true
  }

  renderFrame(input: XyScopeFrameInput): void {
    const params = this.params
    if (this.disposed || !params || this.width <= 0 || this.height <= 0) return
    const dt = this.lastNowSec === null ? 1 / 60 : Math.max(1 / 240, Math.min(0.06, input.nowSec - this.lastNowSec))
    this.lastNowSec = input.nowSec
    const background = parseXyScopeColor(params.backgroundColor, FALLBACK_BACKGROUND)
    if (this.needsClear) { this.beam.clear(background); this.needsClear = false }

    const context = input.context
    const conversationParams = { dissolveDepth: params.dissolveDepth, answerDelayMs: params.answerDelayMs }
    let triggerEventId: string | null = null
    let discontinuity = false
    if (input.fresh) {
      this.sequence += 1
      const hits = deriveXyScopeEvents(context, { audioReactivity: params.audioReactivity })
      discontinuity = hits.discontinuity
      if (discontinuity) this.conversation.reset(this.layout.glyphs.length)
      for (const event of hits.events) this.conversation.push(event, input.nowSec, conversationParams)
      triggerEventId = resolveXyScopeTriggerEventId(context, this.previousContext, params.trigger, this.sequence)
      if (context) this.previousContext = context
    }

    // The controller changes routines; every routine performs the word on its own clock.
    const secondsPerBeat = context && context.bpm > 0 ? 60 / context.bpm : 1 / FREE_RUN_BEATS_PER_SECOND
    const selection = this.controller.update({
      authoredPattern: params.pattern,
      patternChange: params.patternChange,
      trigger: params.trigger,
      triggerEventId,
      absoluteBeat: context ? context.absoluteBeat : 0,
      reset: discontinuity,
    })
    this.activePattern = selection.activePattern

    if (discontinuity) { this.choreographyBeat = 0; this.lastAbsoluteBeat = null; this.performingPattern = params.pattern; this.phraseVisit = 0 }
    const playing = input.playing ?? context != null
    // Figure rotation is beat-locked with BPM Sync (and so stops when the music stops) and free-runs otherwise.
    let deltaBeats: number
    if (params.bpmSync && context && context.bpm > 0) {
      const beat = context.absoluteBeat
      const step = this.lastAbsoluteBeat === null ? 0 : beat - this.lastAbsoluteBeat
      deltaBeats = playing && step > 0 && step < 4 ? step : 0
      this.lastAbsoluteBeat = beat
    } else {
      deltaBeats = playing ? dt * FREE_RUN_BEATS_PER_SECOND : 0
      this.lastAbsoluteBeat = null
    }
    this.phase += deltaBeats / BEATS_PER_TURN * params.motionAmount
    this.choreographyBeat += deltaBeats * (params.motionAmount > 0 ? 0.3 + params.motionAmount : 0)
    const phrase = xyScopeChoreographyPhrase(this.choreographyBeat, params.transitionBeats)
    // Automatic style changes are latched at the return to lettering. Even a
    // beat trigger cannot repeatedly interrupt a departure before it completes.
    if (phrase.visit !== this.phraseVisit) {
      this.phraseVisit = phrase.visit
      this.performingPattern = this.activePattern
    }
    const targetAmount = playing && params.motionAmount > 0 && params.audioReactivity > 0 ? 1 : 0
    this.performanceAmount += (targetAmount - this.performanceAmount) * (1 - Math.exp(-dt / 0.18))

    const scopeFrame = this.scope.update(input.stereo?.left ?? null, input.stereo?.right ?? null, dt, input.nowSec)
    this.conversation.update(dt, input.nowSec, conversationParams)

    const reactivity = Math.min(1, params.audioReactivity)
    const react = reactivity * params.formResponse
    let kick = 0
    let snare = 0
    for (const state of this.conversation.states) { kick = Math.max(kick, state.kick); snare = Math.max(snare, state.ripple) }
    const sizeScale = Math.min(1.15, params.size / 0.84)
    const drive = this.drive
    drive.phase = this.phase
    drive.radius = Math.min(this.width, this.height) * 0.38 * sizeScale
    drive.halfWidth = this.width * 0.46 * sizeScale
    drive.halfHeight = this.height * 0.3
    drive.bass = Math.min(1, (context?.bass ?? 0) * react)
    drive.mid = Math.min(1, (context?.mid ?? 0) * react)
    drive.high = Math.min(1, (context?.high ?? 0) * react)
    drive.kick = Math.min(1, kick * react)
    drive.snare = Math.min(1, snare * react)
    drive.variation = this.phraseVisit
    drive.cloudX = scopeFrame.cloudX
    drive.cloudY = scopeFrame.cloudY
    drive.cloudGain = scopeFrame.cloudGain
    drive.trace = scopeFrame.trace
    drive.traceGain = scopeFrame.traceGain

    // Audio Reactivity zero holds the letters perfectly still.
    const motion = { vibration: params.vibration * reactivity * this.performanceAmount, dissolveDepth: params.dissolveDepth }
    const choreography = {
      pattern: this.performingPattern, beat: this.choreographyBeat, amount: this.performanceAmount,
      width: this.width, height: this.height, transitionBeats: params.transitionBeats,
      answerDelayBeats: params.answerDelayMs / 1000 / secondsPerBeat, drive,
    }
    if (phrase.phase === 'blank' && this.performanceAmount > 0.999) {
      if (!this.blanked) this.beam.clear(background)
      this.blanked = true
    } else this.blanked = false
    let offset = 0
    const glyphs = this.layout.glyphs
    for (let g = 0; g < glyphs.length; g += 1) {
      const state = this.conversation.states[g]
      computeXyScopeGlyphPoints(glyphs[g], g, state, this.conversation.dissolve(g), motion, scopeFrame, this.buffers[g])
      applyXyScopeBeamChoreography(glyphs[g], g, glyphs.length, offset, this.layout.totalPoints, this.buffers[g], choreography)
      offset += glyphs[g].count
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

  private restartChoreography(): void {
    const pattern = this.params?.pattern ?? 'word'
    this.conversation.reset(this.layout.glyphs.length)
    this.performingPattern = pattern
    this.phraseVisit = 0
    this.blanked = false
    this.choreographyBeat = 0
    this.performanceAmount = 0
    this.phase = 0
    this.controller.reset()
    this.activePattern = pattern
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
    this.restartChoreography()
    this.needsClear = true
  }
}
