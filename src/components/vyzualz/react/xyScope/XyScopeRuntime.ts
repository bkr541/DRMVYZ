// Sound Drawing XY: the per-canvas runtime. Owns the layout, the conversation, the pattern choreography, the live
// scope window and the beam renderer, and advances them one frame at a time from the audio inputs the surface hands
// in. It keeps drawing while the music is paused, so the word is always on screen.
//
// Each pattern performs the word continuously. Pattern Change only steps between
// routines through the same event controller Cinema 2.0 uses.

import { XyScopeTextV2Performance, selectTextV2Word, type TextV2PerformanceFrame } from './XyScopeTextV2Performance'
import { XyScopeTextV2BeamPath } from './XyScopeTextV2Geometry'
import { XyScopeTextV2Trajectory, type TextV2TrajectoryFrame } from './XyScopeTextV2Trajectory'
import { buildXyScopeSvgLayout, type XyScopeSvgSource } from './XyScopeSvg'
import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import { Cinema2MainframePatternController } from '../../cinema2/modules/mainframe/Cinema2MainframePatternController'
import { XyScopeBeamRenderer, parseXyScopeColor, type XyScopeRgb } from './XyScopeBeam'
import { applyXyScopeBeamChoreography, xyScopeChoreographyPhrase, type XyScopeChoreographyPhase } from './XyScopeChoreography'
import { XyScopeConversation } from './XyScopeConversation'
import { deriveXyScopeEvents, hasXyScopeDiscontinuity, resolveXyScopeTriggerEventId } from './XyScopeEvents'
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
import { Osc1Engine, emptyOsc1Features, osc1ModeSettings, type Osc1Features } from './XyScopeOsc1Engine'
import { Osc1Analyzer } from './XyScopeOsc1Analysis'
import { Osc1Conductor, osc1StructureFromContext, scaleOsc1Times, type Osc1ConductorOutput } from './XyScopeOsc1Performance'
import { Osc1Renderer } from './XyScopeOsc1Renderer'
import { createOsc1GlyphSource } from './XyScopeOsc1Glyphs'
import { DEFAULT_OSC1_LETTER } from './XyScopeOsc1Settings'
import type { Osc1LiveSnapshot } from './XyScopeOsc1Live'
import { Osc2Engine } from './XyScopeOsc2Engine'
import { Osc2AutoPerformance } from './XyScopeOsc2Performance'
import { BeatClock, type BeatClockFrame } from './XyScopeBeatClock'
import { PhasePortalScope } from './XyScopePhasePortal'
import { PHASE_PORTAL_PRESET_ID } from './XyScopePhasePortalSettings'
import { StandardAutoPerformance } from './XyScopeStandardPerformance'
import type { Osc2LiveSnapshot } from './XyScopeOsc2Live'
import { OctaEngine } from './XyScopeOctaEngine'
import type { OctaLiveSnapshot } from './XyScopeOctaLive'
import { WireEngine } from './XyScopeWireEngine'
import { buildWireReading, deriveWireCue, deriveWireMood, emptyWireCue, type WireCue } from './XyScopeWireCues'
import { NO_BOUNDARIES } from './XyScopeWireDirector'
import type { WireLiveSnapshot } from './XyScopeWireLive'
import { InitEngine, type InitPcm, type InitSource } from './XyScopeInitEngine'
import { InitRenderer } from './XyScopeInitRenderer'
import { InitAutoPerformance } from './XyScopeInitPerformance'
import type { InitLiveSnapshot } from './XyScopeInitLive'
import type { InitValues } from './XyScopeInitSettings'
import { createXyScopeFormDrive, XY_SCOPE_PATTERN_CYCLE, type XyScopePattern } from './XyScopePatterns'
import { resolveXyScopeParameters, type XyScopeResolvedParameters, type XyScopeSettings } from './XyScopeSettings'

const FALLBACK_BACKGROUND: XyScopeRgb = [2, 7, 10]
const FALLBACK_BEAM: XyScopeRgb = [150, 255, 240]
const FALLBACK_GLOW: XyScopeRgb = [20, 217, 197]
/** One full turn of an oscillator figure per this many beats at full Motion Amount. */
const BEATS_PER_TURN = 8
/** Tempo assumed when nothing is loaded or BPM Sync is off. */
const FREE_RUN_BEATS_PER_SECOND = 2
const TEXT_HOLD_SECONDS = 4

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
  /** Actual synchronized stereo, labelled mono samples, or unavailable sample capture. */
  scopeSource: 'stereo' | 'mono' | 'fallback'
  points: number
  letters: number
  /** The selected text choreography routine. */
  pattern: XyScopePattern
  performingPattern: XyScopePattern
  phase: XyScopeChoreographyPhase
  text: string
  /** OSC 1: where its audio descriptors come from this frame. */
  osc1Source?: Osc1LiveSnapshot['source']
  textV2?: { state: TextV2PerformanceFrame['state']; style: TextV2PerformanceFrame['style']; autoPerformance: boolean; grouping: string; phase: TextV2TrajectoryFrame['phase']; morph: number }
}

export class XyScopeRuntime {
  private readonly beam: XyScopeBeamRenderer
  private readonly textV2 = new XyScopeTextV2Performance()
  private textV2Frame: TextV2PerformanceFrame | null = null
  private readonly osc1Renderer: Osc1Renderer
  private osc1Engine = new Osc1Engine(createOsc1GlyphSource(getDefaultXyScopeFont()))
  private readonly osc1Analyzer = new Osc1Analyzer()
  private readonly osc1Conductor = new Osc1Conductor()
  private osc1Output: Osc1ConductorOutput | null = null
  private osc1Source: Osc1LiveSnapshot['source'] = 'none'
  private osc1FontId = 'default'
  private osc1Text: string | null = null
  private osc1ResetSeen = -1
  private osc1Auto = false
  private osc1DropActive = false
  private osc2Engine = new Osc2Engine(createOsc1GlyphSource(getDefaultXyScopeFont()))
  private readonly osc2Auto = new Osc2AutoPerformance()
  /** The BPM Sync clock shared by the engines that run their motion on the track's beats (only one engine draws at a time). */
  private readonly beatClock = new BeatClock()
  /** Auto Performance for the standard presets (Converse, Clean Scope, Storm). */
  private readonly standardAuto = new StandardAutoPerformance()
  private osc2Output: Osc2LiveSnapshot['settings'] | null = null
  private osc2State = { state: 'MANUAL', confidence: 0, mapped: false }
  private osc2Text: string | null = null
  private osc2ResetSeen = -1
  private osc2AutoOn = false
  private readonly phasePortalScope = new PhasePortalScope()
  private phasePortalActive = false
  private phasePortalResetSeen = -1
  private readonly initEngine = new InitEngine()
  private readonly initRenderer: InitRenderer
  private readonly initAuto = new InitAutoPerformance()
  private initOutput: InitValues | null = null
  private initState = { state: 'MANUAL', confidence: 0, mapped: false }
  private initSource: InitSource = 'none'
  private initResetSeen = -1
  private initAutoOn = false
  private initFreeBeat = 0
  private readonly octaEngine = new OctaEngine()
  private octaSource: OctaLiveSnapshot['source'] = 'none'
  private octaConductor = { state: 'MANUAL', confidence: 0, mapped: false }
  private octaResetSeen = -1
  private octaAutoOn = false
  private readonly wireEngine = new WireEngine()
  private wireSource: WireLiveSnapshot['source'] = 'none'
  private wireResetSeen = -1
  private wireCue: WireCue = emptyWireCue()
  private wirePrevious: SharedPerformanceContext | null = null
  private lastSource: XyScopeSettings['sourceMode'] | null = null
  private readonly conversation = new XyScopeConversation()
  private readonly controller = new Cinema2MainframePatternController<XyScopePattern>(XY_SCOPE_PATTERN_CYCLE, 'word')
  private readonly scope = new XyScopeScopeWindow()
  private readonly drive = createXyScopeFormDrive()
  private settings: XyScopeSettings | null = null
  private params: XyScopeResolvedParameters | null = null
  private font: XyScopeFontSource = getDefaultXyScopeFont()
  private layout: XyScopeLayout = EMPTY_XY_SCOPE_LAYOUT
  private svgSource: XyScopeSvgSource | null = null
  private layoutKey = ''
  private words: string[] = []
  private activeText = ''
  private textElapsed = 0
  private buffers: XyScopePointBuffers[] = []
  private flashes: number[] = []
  private readonly textV2Path = new XyScopeTextV2BeamPath()
  private readonly textV2Glyphs = [this.textV2Path.glyph]
  private readonly textV2Buffers = [this.textV2Path.buffer]
  private readonly textV2Trajectory = new XyScopeTextV2Trajectory()
  private textV2TrajectoryFrame: TextV2TrajectoryFrame | null = null
  private previousContext: SharedPerformanceContext | null = null
  private lastNowSec: number | null = null
  private lastAbsoluteBeat: number | null = null
  private choreographyBeat = 0
  private performanceAmount = 0
  private performingPattern: XyScopePattern = 'word'
  private phraseVisit = 0
  private phase = 0
  private sequence = 0
  private activePattern: XyScopePattern = 'word'
  private width = 0
  private height = 0
  private needsClear = true
  private disposed = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.beam = new XyScopeBeamRenderer(canvas)
    this.osc1Renderer = new Osc1Renderer(canvas)
    this.initRenderer = new InitRenderer(canvas)
    this.osc1Engine.waveL = this.osc1Analyzer.timeL
    this.osc1Engine.waveR = this.osc1Analyzer.timeR
    this.osc2Engine.waveL = this.osc1Analyzer.timeL
    this.osc2Engine.waveR = this.osc1Analyzer.timeR
  }

  setSettings(settings: XyScopeSettings, font: XyScopeFontSource | null, svg: XyScopeSvgSource | null = null): void {
    if (this.settings?.sourceMode !== settings.sourceMode) { this.textV2.reset(); this.textV2Trajectory.reset(); this.textV2TrajectoryFrame = null; this.textV2Frame = null }
    this.svgSource = svg
    const patternChanged = this.params != null && this.params.pattern !== settings.parameters.pattern
    this.settings = settings
    this.params = resolveXyScopeParameters(settings)
    const words = [...new Set([settings.text, ...settings.additionalTexts].map(text => text.trim().toUpperCase()).filter(Boolean))]
    if (JSON.stringify(words) !== JSON.stringify(this.words)) {
      this.words = words
      this.activeText = words[0] ?? ''
      this.textElapsed = 0
    }
    const next = font ?? getDefaultXyScopeFont()
    if (next.id !== this.font.id) this.font = next
    if (this.font.id !== this.osc1FontId) {
      this.osc1FontId = this.font.id
      this.osc1Engine.setFont(createOsc1GlyphSource(this.font))
      this.osc2Engine.setFont(createOsc1GlyphSource(this.font))
      this.needsClear = true
    }
    if (settings.presetId === PHASE_PORTAL_PRESET_ID && settings.sourceMode === 'osc2') {
      this.phasePortalScope.setTexts([settings.text, ...settings.additionalTexts], this.font, settings.phasePortal.values.textSize)
    }
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
    if (this.settings?.presetId === PHASE_PORTAL_PRESET_ID && this.settings.sourceMode === 'osc2') {
      const { source, points, letters, text } = this.phasePortalScope
      return { scopeSource: source === 'unavailable' ? 'fallback' : source, osc1Source: this.osc1Source,
        points, letters, text, pattern: this.activePattern, performingPattern: this.performingPattern, phase: 'word' }
    }
    return { scopeSource: this.settings?.sourceMode === 'wire' ? (this.wireSource === 'stereo' || this.wireSource === 'mono' ? this.wireSource : 'fallback') : this.settings?.sourceMode === 'octa' ? (this.octaSource === 'stereo' || this.octaSource === 'mono' ? this.octaSource : 'fallback') : this.settings?.sourceMode === 'init' ? (this.initSource === 'stereo' || this.initSource === 'mono' ? this.initSource : 'fallback') : this.settings?.sourceMode === 'osc1' || this.settings?.sourceMode === 'osc2' ? (this.osc1Source === 'stereo' || this.osc1Source === 'mono' ? this.osc1Source : 'fallback') : this.scope.frame.source, osc1Source: this.osc1Source, points: this.layout.totalPoints, letters: this.layout.glyphs.length, pattern: this.activePattern, performingPattern: this.performingPattern, phase: xyScopeChoreographyPhrase(this.choreographyBeat, this.params?.transitionBeats ?? 1).phase, text: this.activeText, textV2: this.settings?.sourceMode === 'textV2' && this.textV2Frame ? { state: this.textV2Frame.state, style: this.textV2Frame.style, autoPerformance: this.settings.textV2.autoPerformance, grouping: this.settings.textV2.grouping, phase: this.textV2TrajectoryFrame?.phase ?? 'word', morph: this.textV2TrajectoryFrame?.morph ?? 0 } : undefined }
  }

  /** A track change or engine restart: every letter returns to the authored pattern and the trail is wiped. */
  reset(): void {
    this.resetOsc1Signals()
    this.phasePortalResetSeen = -1
    this.textV2.reset()
    this.textV2Trajectory.reset()
    this.textV2TrajectoryFrame = null
    this.textV2Frame = null
    this.activeText = this.words[0] ?? ''
    this.textElapsed = 0
    this.rebuildLayoutIfNeeded()
    this.restartChoreography()
    this.previousContext = null
    this.lastAbsoluteBeat = null
    this.needsClear = true
  }

  renderFrame(input: XyScopeFrameInput): void {
    const baseParams = this.params
    if (this.disposed || !baseParams || this.width <= 0 || this.height <= 0) return
    const elapsed = this.lastNowSec === null ? 0 : Math.max(0, input.nowSec - this.lastNowSec)
    const dt = this.lastNowSec === null ? 1 / 60 : Math.max(1 / 240, Math.min(0.06, elapsed))
    this.lastNowSec = input.nowSec
    const playing = input.playing ?? input.context != null
    if (this.settings?.sourceMode === 'osc2' && this.settings.presetId === PHASE_PORTAL_PRESET_ID) {
      this.renderPhasePortal(input, dt, playing)
      return
    }
    if (this.phasePortalActive) {
      this.phasePortalActive = false
      this.lastSource = null
      this.osc2ResetSeen = -1
      this.needsClear = true
      this.beatClock.reset()
    }
    // Leaving INIT hands the canvas back: its traces must not linger under the next source.
    if ((this.lastSource === 'init' || this.lastSource === 'octa' || this.lastSource === 'wire') && this.settings && this.settings.sourceMode !== this.lastSource) this.needsClear = true
    if (this.settings && this.settings.sourceMode !== 'osc1' && this.settings.sourceMode !== 'osc2' && this.settings.sourceMode !== 'init' && this.settings.sourceMode !== 'octa' && this.settings.sourceMode !== 'wire') this.lastSource = this.settings.sourceMode
    if (this.settings?.sourceMode === 'wire') {
      this.renderWire(input, dt, playing)
      return
    }
    if (this.settings?.sourceMode === 'octa') {
      this.renderOcta(input, dt, playing)
      return
    }
    if (this.settings?.sourceMode === 'init') {
      this.renderInit(input, dt, playing)
      return
    }
    if (this.settings?.sourceMode === 'osc1') {
      this.renderOsc1(input, dt, playing)
      return
    }
    if (this.settings?.sourceMode === 'osc2') {
      this.renderOsc2(input, dt, playing)
      return
    }
    if (this.settings?.sourceMode === 'textV2') {
      this.renderTextV2(input, dt, playing)
      return
    }
    if (playing && this.settings?.sourceMode === 'text' && this.words.length > 1) {
      this.textElapsed += elapsed
      if (this.textElapsed >= TEXT_HOLD_SECONDS) {
        this.textElapsed %= TEXT_HOLD_SECONDS
        const candidates = this.words.filter(word => word !== this.activeText)
        this.activeText = candidates[Math.floor(Math.random() * candidates.length)]
        this.rebuildLayoutIfNeeded(true)
      }
    }
    // Auto Performance: the music moves the values around the user's own (and chooses the pattern); off, the user's values are used exactly.
    const params = baseParams.autoPerformance
      ? this.standardAuto.update({ dt, playing, base: baseParams, context: input.context, level: this.scope.frame.level })
      : (this.standardAuto.reset(), baseParams)
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
      for (const event of hits.events) this.conversation.push({ ...event, strength: event.strength * (event.type === 'kick' ? params.kickResponse : params.snareResponse) }, input.nowSec, conversationParams)
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
    drive.bass = Math.min(1, (context?.bass ?? 0) * react * params.bassResponse)
    drive.mid = Math.min(1, (context?.mid ?? 0) * react * params.midResponse)
    drive.high = Math.min(1, (context?.high ?? 0) * react * params.highResponse)
    drive.kick = Math.min(1, kick * react)
    drive.snare = Math.min(1, snare * react)
    drive.variation = this.phraseVisit
    drive.cloudX = scopeFrame.cloudX
    drive.cloudY = scopeFrame.cloudY
    drive.cloudGain = scopeFrame.cloudGain
    drive.trace = scopeFrame.trace
    drive.traceGain = scopeFrame.traceGain
    drive.time = input.nowSec
    drive.vibration = params.vibration

    // Audio Reactivity zero holds the letters perfectly still.
    const motion = { vibration: params.vibration * reactivity * this.performanceAmount, dissolveDepth: params.dissolveDepth }
    const choreography = {
      pattern: this.performingPattern, beat: this.choreographyBeat, amount: this.performanceAmount,
      width: this.width, height: this.height, transitionBeats: params.transitionBeats,
      answerDelayBeats: params.answerDelayMs / 1000 / secondsPerBeat, drive,
    }
    let offset = 0
    const glyphs = this.layout.glyphs
    for (let g = 0; g < glyphs.length; g += 1) {
      const state = this.conversation.states[g]
      if (this.settings?.sourceMode === 'oscillator') {
        const out = this.buffers[g]
        for (let i = 0; i < glyphs[g].count; i++) {
          out.x[i] = scopeFrame.cloudX[i % scopeFrame.cloudX.length] * scopeFrame.cloudGain * drive.radius
          out.y[i] = -scopeFrame.cloudY[i % scopeFrame.cloudY.length] * scopeFrame.cloudGain * drive.radius
          out.form[i] = 1; out.dissolved[i] = 0; out.gap[i] = 0
        }
        this.flashes[g] = state.flash
        continue
      }
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

  /** Live values for the inspector: the effective sliders while Auto Performance runs, else the manual ones. */
  getOsc1Live(): Osc1LiveSnapshot | null {
    const o = this.settings?.osc1
    if (!o || this.settings?.sourceMode !== 'osc1') return null
    const manual = o.presets[o.mode]
    const out = o.autoPerformance ? this.osc1Output : null
    return {
      state: out?.state ?? (o.autoPerformance ? 'LISTENING' : 'MANUAL'),
      dominant: out?.dominant ?? 'MID', mapped: out?.mapped ?? false, confidence: out?.confidence ?? 0,
      settings: out?.settings ?? manual,
      letters: out?.letters ?? this.osc1Engine.letters.map(l => ({ gain: l.gain, offset: l.offset, focus: l.focus })),
      source: this.osc1Source,
    }
  }

  /** Live values for the inspector: the effective scene settings while Auto Performance runs. */
  getOsc2Live(): Osc2LiveSnapshot | null {
    if (this.settings?.sourceMode !== 'osc2') return null
    if (this.settings.presetId === PHASE_PORTAL_PRESET_ID) return { ...this.osc2State, settings: null, source: this.osc1Source }
    const o = this.settings.osc2
    return { ...this.osc2State, settings: o.autoPerformance && this.osc2Output ? this.osc2Output : o.values, source: this.osc1Source }
  }

  /** Live values for the inspector: the distortion state and energy the music is driving in OCTA. */
  getOctaLive(): OctaLiveSnapshot | null {
    const o = this.settings?.octa
    if (!o || this.settings?.sourceMode !== 'octa') return null
    return { state: this.octaEngine.state, energy: this.octaEngine.energy, conductor: this.octaConductor.state, confidence: this.octaConductor.confidence, mapped: this.octaConductor.mapped, values: o.values, source: this.octaSource }
  }

  private renderOcta(input: XyScopeFrameInput, dt: number, playing: boolean): void {
    const settings = this.settings!, o = settings.octa, engine = this.octaEngine, renderer = this.osc1Renderer
    if (this.lastSource !== 'octa') { this.lastSource = 'octa'; engine.reset(); renderer.clear(); this.needsClear = false }
    if (renderer.resize(this.width, this.height)) this.needsClear = true
    if (this.octaResetSeen !== o.resetSignals || input.context?.seekDetected) {
      this.octaResetSeen = o.resetSignals
      engine.reset(); this.osc1Analyzer.reset(); this.osc1Conductor.reset(); renderer.clear()
    }
    if (this.needsClear) { renderer.clear(); this.needsClear = false }

    let features: Osc1Features
    if (playing && input.stereo) {
      this.osc1Analyzer.load(input.stereo.left, input.stereo.right)
      features = this.osc1Analyzer.measure(dt, input.stereo.sampleRate)
      this.octaSource = input.stereo.channelCount === 1 ? 'mono' : 'stereo'
    } else if (playing && input.context) {
      const c = input.context
      features = { ...emptyOsc1Features(), level: Math.min(1, c.energy), bass: c.bass, mid: c.mid, air: c.high, flux: c.spectralFlux }
      this.octaSource = 'shared'
    } else {
      features = emptyOsc1Features()
      if (!playing) this.osc1Analyzer.reset()
      this.octaSource = 'none'
    }
    // The live waveform that ripples along the axis lines.
    const scopeFrame = this.scope.update(input.stereo?.left ?? null, input.stereo?.right ?? null, dt, input.nowSec)
    engine.wave = scopeFrame.trace
    engine.waveGain = scopeFrame.traceGain

    if (this.octaAutoOn !== o.autoPerformance) { this.octaAutoOn = o.autoPerformance; this.osc1Conductor.reset(); this.octaConductor = { state: 'MANUAL', confidence: 0, mapped: false } }
    let bias = 0
    if (o.autoPerformance && playing) {
      // Builds and drops from the shared conductor push the energy further, so the figure is distorted when the track calls for it.
      const conducted = this.osc1Conductor.update(dt, features, { structure: osc1StructureFromContext(input.context), mode: 0, base: osc1ModeSettings(0), letterCount: 0 })
      bias = .12 * Math.min(1, conducted.build) + .3 * Math.min(1, conducted.drop)
      this.octaConductor = { state: conducted.state, confidence: conducted.confidence, mapped: conducted.mapped }
    } else this.octaConductor = { state: o.autoPerformance ? 'LISTENING' : 'MANUAL', confidence: 0, mapped: false }

    engine.tick(dt, features, playing, o.values, bias, this.clockFor(input.context, o.bpmSync, playing, dt))
    renderer.render(engine, {
      dt, settings: { intensity: 100, persistence: o.values.trail, width: o.values.width, scan: o.values.scan, color: o.values.color },
      grid: false, hold: o.hold, halo: { amount: o.values.glow, color: o.values.glowColor }, background: o.values.backgroundColor,
    })
  }

  /** Live values for the inspector: what the director is doing, how readable the cubes are and where the sound comes from. */
  getWireLive(): WireLiveSnapshot | null {
    const o = this.settings?.wire, e = this.wireEngine
    if (!o || this.settings?.sourceMode !== 'wire') return null
    return {
      state: e.state, sceneId: e.sceneId, readability: e.readability.score, readableFraction: e.readableFraction, weight: e.weight, abstract: e.abstract, lastEvent: e.lastEvent,
      structure: this.wireCue.structure != null, source: this.wireSource, values: o.values, effective: e.effective, mood: e.mood, feel: e.feel, figure: e.figure, auto: o.autoPerformance,
      motion: e.motion, beatLocked: e.beatLocked, pulse: e.pulse, shock: e.shock, transition: e.transitionKind, lastReaction: e.fx.lastFired, reactionsFired: e.fx.fired,
    }
  }

  private renderWire(input: XyScopeFrameInput, dt: number, playing: boolean): void {
    const settings = this.settings!, o = settings.wire, engine = this.wireEngine, renderer = this.osc1Renderer
    if (this.lastSource !== 'wire') { this.lastSource = 'wire'; engine.reset(); renderer.clear(); this.needsClear = false; this.wirePrevious = null; this.wireCue = emptyWireCue() }
    if (renderer.resize(this.width, this.height)) this.needsClear = true
    // A seek, loop, track change or Reset Signals starts the figure again from rest (the guide's single reset contract).
    const reset = this.wireResetSeen !== o.resetSignals
    const discontinuity = reset || hasXyScopeDiscontinuity(input.context)
    if (reset) { this.wireResetSeen = o.resetSignals; this.osc1Analyzer.reset() }
    if (discontinuity) { renderer.clear(); this.wirePrevious = null; this.wireCue = emptyWireCue() }
    if (this.needsClear) { renderer.clear(); this.needsClear = false }

    let features: Osc1Features | null = null
    if (playing && input.stereo) {
      this.osc1Analyzer.load(input.stereo.left, input.stereo.right)
      features = this.osc1Analyzer.measure(dt, input.stereo.sampleRate)
      this.wireSource = input.stereo.channelCount === 1 ? 'mono' : 'stereo'
    } else if (playing && input.context) this.wireSource = 'shared'
    else { if (!playing) this.osc1Analyzer.reset(); this.wireSource = 'none' }

    // Hits and boundaries are one-frame events: they are read once per fresh audio frame, never replayed by the frames in between.
    const hits = { kick: 0, snare: 0, hat: 0 }
    if (input.fresh && input.context) {
      const c = input.context
      if (c.kick) hits.kick = Math.min(1, c.kickStrength || 1)
      if (c.snare) hits.snare = Math.min(1, c.snareStrength || 1)
      if (c.hat) hits.hat = Math.min(1, c.hatStrength || 1)
      this.wireCue = deriveWireCue(c, this.wirePrevious)
      this.wirePrevious = c
    } else this.wireCue = { ...this.wireCue, boundaries: NO_BOUNDARIES, drop: false, beat: false, downbeat: false, chordChanged: false }

    // The live triggered waveform that the edges carry (the real stereo samples when there are any).
    const scopeFrame = this.scope.update(input.stereo?.left ?? null, input.stereo?.right ?? null, dt, input.nowSec)
    engine.hasWave = playing && input.stereo != null
    if (engine.hasWave) { engine.wave = scopeFrame.trace; engine.waveGain = scopeFrame.traceGain }
    engine.tick({ dt, reading: buildWireReading(input.context, features, hits, playing), cue: this.wireCue, mood: deriveWireMood(input.context, features, playing), values: o.values, rules: o.rules, auto: o.autoPerformance, discontinuity })
    renderer.render(engine, {
      dt, settings: { intensity: 100, persistence: engine.effective.trail, width: engine.effective.width * (1 + engine.beamWidthBoost), scan: engine.effective.scan, color: engine.effective.color },
      grid: false, hold: o.hold, halo: { amount: engine.effective.glow, color: engine.effective.glowColor }, background: o.values.backgroundColor,
    })
  }

  /** Live values for the inspector: the effective INIT values while Auto Performance runs. */
  getInitLive(): InitLiveSnapshot | null {
    const o = this.settings?.init
    if (!o || this.settings?.sourceMode !== 'init') return null
    return { ...this.initState, values: o.autoPerformance && this.initOutput ? this.initOutput : o.values, source: this.initSource, repicks: this.initEngine.repicks }
  }

  private renderInit(input: XyScopeFrameInput, dt: number, playing: boolean): void {
    const settings = this.settings!, o = settings.init, engine = this.initEngine
    if (this.lastSource !== 'init') { this.lastSource = 'init'; engine.reset(); this.initRenderer.clear(); this.needsClear = false }
    if (this.initResetSeen !== o.resetSignals || input.context?.seekDetected) {
      this.initResetSeen = o.resetSignals
      engine.reset(); this.osc1Analyzer.reset(); this.osc1Conductor.reset(); this.initAuto.reset(); this.initOutput = null; this.initFreeBeat = 0; this.initRenderer.clear()
    }
    if (this.needsClear) { this.initRenderer.clear(); this.needsClear = false }

    let features: Osc1Features
    let pcm: InitPcm | null = null
    if (playing && input.stereo) {
      this.osc1Analyzer.load(input.stereo.left, input.stereo.right)
      features = this.osc1Analyzer.measure(dt, input.stereo.sampleRate)
      pcm = { left: this.osc1Analyzer.timeL, right: this.osc1Analyzer.timeR, sampleRate: input.stereo.sampleRate }
      this.initSource = input.stereo.channelCount === 1 ? 'mono' : 'stereo'
    } else if (playing && input.context) {
      const c = input.context
      features = { ...emptyOsc1Features(), level: Math.min(1, c.energy), bass: c.bass, mid: c.mid, air: c.high, flux: c.spectralFlux }
      this.initSource = 'shared'
    } else {
      features = emptyOsc1Features()
      if (!playing) this.osc1Analyzer.reset()
      this.initSource = 'none'
    }

    if (this.initAutoOn !== o.autoPerformance) {
      this.initAutoOn = o.autoPerformance
      this.osc1Conductor.reset(); this.initAuto.reset(); this.initOutput = null
    }
    let effective = o.values
    if (o.autoPerformance && playing) {
      // Section evidence comes from the shared conductor; the mapping onto INIT's controls is INIT's own.
      const conducted = this.osc1Conductor.update(dt, features, { structure: osc1StructureFromContext(input.context), mode: 0, base: osc1ModeSettings(0), letterCount: 0 })
      this.initOutput = this.initAuto.update(dt, features, conducted, o.values)
      this.initState = { state: conducted.state, confidence: conducted.confidence, mapped: conducted.mapped }
      effective = this.initOutput
    } else if (o.autoPerformance && this.initOutput) effective = this.initOutput
    else this.initState = { state: o.autoPerformance ? 'LISTENING' : 'MANUAL', confidence: 0, mapped: false }

    // Line moves follow the track's beat grid with BPM Sync, or a steady clock that runs only while the music plays.
    if (playing) this.initFreeBeat += dt * FREE_RUN_BEATS_PER_SECOND
    const beat = o.bpmSync && input.context ? input.context.absoluteBeat : this.initFreeBeat
    engine.update(dt, beat, o.oscillators, effective)
    engine.sample(dt, o.oscillators, { ...effective, audioReactivity: effective.audioReactivity }, features, pcm, this.initSource)
    this.initRenderer.render(engine, { dt, count: o.oscillators, values: effective, hold: o.hold })
  }

  private renderPhasePortal(input: XyScopeFrameInput, dt: number, playing: boolean): void {
    const settings = this.settings!.phasePortal
    const scope = this.phasePortalScope
    const context = input.context
    const discontinuity = input.fresh && hasXyScopeDiscontinuity(context)
    const reset = !this.phasePortalActive || settings.resetSignals !== this.phasePortalResetSeen || discontinuity
    if (reset) {
      this.phasePortalActive = true
      this.phasePortalResetSeen = settings.resetSignals
      scope.reset()
      this.beatClock.reset()
    }
    if (!settings.hold || reset) scope.update(playing && !discontinuity ? input.stereo : null)
    this.osc1Source = scope.source === 'unavailable' ? 'none' : scope.source
    const clock = this.clockFor(context, settings.bpmSync, playing, dt)
    if (!settings.autoPerformance || !playing) scope.textPulse = 0
    if (playing && !settings.hold && !discontinuity) {
      let accent = 0
      if (settings.autoPerformance && context && input.fresh) {
        if (context.kick) accent = Math.min(1, Math.max(.35, context.kickStrength || 1))
        if (context.capabilities.beatGrid && context.boundaries.barBoundary) accent = Math.max(accent, .65)
      }
      scope.advance(clock.motionDt, settings.values.sweepSpeed, accent)
    }
    this.osc2State = {
      state: settings.autoPerformance ? scope.textPulse > .15 ? 'ACCENT' : 'LISTENING' : 'MANUAL',
      confidence: context?.confidence.rhythm ?? 0,
      mapped: context?.capabilities.beatGrid ?? false,
    }
    const ctx = this.canvas.getContext('2d', { alpha: false })
    if (ctx) scope.draw(ctx, settings, this.canvas.width / this.width, playing && !discontinuity)
  }

  private renderOsc2(input: XyScopeFrameInput, dt: number, playing: boolean): void {
    const settings = this.settings!, o = settings.osc2, engine = this.osc2Engine
    if (this.lastSource !== 'osc2') { this.lastSource = 'osc2'; this.osc1Renderer.clear(); this.needsClear = false }
    if (this.osc1Renderer.resize(this.width, this.height)) this.needsClear = true
    if (this.osc2ResetSeen !== o.resetSignals || input.context?.seekDetected) {
      this.osc2ResetSeen = o.resetSignals
      engine.reset(); this.osc1Analyzer.reset(); this.osc1Conductor.reset(); this.osc2Auto.reset(); this.osc2Output = null; this.osc1Renderer.clear()
    }
    if (this.needsClear) { this.osc1Renderer.clear(); this.needsClear = false }
    const display = (this.words.length > 0 ? this.activeText : '').slice(0, 16)
    if (display !== this.osc2Text) { this.osc2Text = display; engine.setText(display); this.osc1Renderer.clear() }

    let features: Osc1Features
    if (playing && input.stereo) {
      this.osc1Analyzer.load(input.stereo.left, input.stereo.right)
      features = this.osc1Analyzer.measure(dt, input.stereo.sampleRate)
      this.osc1Source = input.stereo.channelCount === 1 ? 'mono' : 'stereo'
    } else if (playing && input.context) {
      const c = input.context
      features = { ...emptyOsc1Features(), level: Math.min(1, c.energy), bass: c.bass, mid: c.mid, air: c.high, flux: c.spectralFlux }
      this.osc1Source = 'shared'
    } else {
      features = emptyOsc1Features()
      if (!playing) this.osc1Analyzer.reset()
      this.osc1Source = 'none'
    }

    if (this.osc2AutoOn !== o.autoPerformance) {
      this.osc2AutoOn = o.autoPerformance
      this.osc1Conductor.reset(); this.osc2Auto.reset(); this.osc2Output = null
    }
    let effective = o.values
    if (o.autoPerformance && playing) {
      // Section evidence and beam character come from the shared conductor; the 3D mapping is OSC 2's own.
      const base = { ...o.values }
      const conducted = this.osc1Conductor.update(dt, features, { structure: osc1StructureFromContext(input.context), mode: 0, base: { ...base, motion: 88, depth: 90, readability: 80, rotation: 70, correlation: 75, axisX: 100, axisY: 100, shear: 48, attack: 12, release: 145, sensitivity: 72, harmonics: 65 }, letterCount: 0 })
      this.osc2Output = this.osc2Auto.update(dt, features, conducted, o.values)
      this.osc2State = { state: conducted.state, confidence: conducted.confidence, mapped: conducted.mapped }
      effective = this.osc2Output
    } else if (o.autoPerformance && this.osc2Output) effective = this.osc2Output
    else this.osc2State = { state: o.autoPerformance ? 'LISTENING' : 'MANUAL', confidence: 0, mapped: false }
    engine.setSettings(effective, o.floor)
    engine.tick(dt, features, playing, this.clockFor(input.context, o.bpmSync, playing, dt))
    this.osc1Renderer.render(engine, { dt, settings: effective, grid: false, hold: o.hold })
  }

  /**
   * The BPM Sync clock for an engine that moves on the track's beats. Locked (BPM Sync on and a beat grid) it advances by the beats that
   * played and reports the tempo's time scale; otherwise it is the real frame time at a steady tempo.
   */
  private clockFor(context: SharedPerformanceContext | null, sync: boolean, playing: boolean, dt: number): BeatClockFrame {
    const grid = context != null && context.capabilities.beatGrid && context.bpm > 0
    if (context?.seekDetected) this.beatClock.reset()
    return this.beatClock.step(dt, { playing, sync, bpm: grid ? context.bpm : null, absoluteBeat: grid ? context.absoluteBeat : null })
  }

  private resetOsc1Signals(): void {
    this.osc1Engine.reset()
    this.osc1Analyzer.reset()
    this.osc1Conductor.reset()
    this.osc1Output = null
    this.osc1DropActive = false
    this.osc1Renderer.clear()
  }

  private renderOsc1(input: XyScopeFrameInput, dt: number, playing: boolean): void {
    const settings = this.settings!, o = settings.osc1, engine = this.osc1Engine
    if (this.osc1Renderer.resize(this.width, this.height)) this.needsClear = true
    if (this.osc1ResetSeen !== o.resetSignals) { this.osc1ResetSeen = o.resetSignals; this.resetOsc1Signals() }
    if (input.context?.seekDetected) this.resetOsc1Signals()
    if (this.lastSource !== 'osc1') { this.lastSource = 'osc1'; this.osc1Renderer.clear(); this.needsClear = false }
    if (this.needsClear) { this.osc1Renderer.clear(); this.needsClear = false }
    // The drawn word: the first entry, rotated through the others on each new drop (a stable choice per drop).
    const text = this.words.length > 0 ? this.activeText : ''
    const display = text.slice(0, 16)
    if (display !== this.osc1Text) { this.osc1Text = display; engine.setText(display); this.osc1Renderer.clear() }

    // Descriptors: the shared stereo window when present (as the Text Lab's two analysers), else shared analysis.
    let features: Osc1Features
    if (playing && input.stereo) {
      this.osc1Analyzer.load(input.stereo.left, input.stereo.right)
      features = this.osc1Analyzer.measure(dt, input.stereo.sampleRate)
      this.osc1Source = input.stereo.channelCount === 1 ? 'mono' : 'stereo'
    } else if (playing && input.context) {
      const c = input.context
      features = { ...emptyOsc1Features(), level: Math.min(1, c.energy), bass: c.bass, mid: c.mid, air: c.high, flux: c.spectralFlux }
      this.osc1Source = 'shared'
    } else {
      features = emptyOsc1Features()
      if (!playing) this.osc1Analyzer.reset()
      this.osc1Source = 'none'
    }

    // BPM Sync: the envelope times are musical times, so they follow the track's tempo (a fast track reacts faster).
    const tempoScale = this.clockFor(input.context, o.bpmSync, playing, dt).tempoScale
    const manual = scaleOsc1Times(o.presets[o.mode], tempoScale)
    if (this.osc1Auto !== o.autoPerformance) {
      this.osc1Auto = o.autoPerformance
      this.osc1Conductor.reset()
      this.osc1Output = null
    }
    engine.letters.forEach((l, i) => {
      const letter = o.letters[i] ?? DEFAULT_OSC1_LETTER
      if (!o.autoPerformance) { l.gain = letter.gain; l.offset = letter.offset; l.focus = letter.focus }
    })
    if (o.autoPerformance && playing) {
      const output = this.osc1Conductor.update(dt, features, { structure: osc1StructureFromContext(input.context), mode: o.mode, base: manual, letterCount: engine.letters.length })
      this.osc1Output = output
      engine.setMode(o.mode, scaleOsc1Times(output.settings, tempoScale))
      output.letters.forEach((value, i) => { const l = engine.letters[i]; if (l) Object.assign(l, value) })
      // A confirmed drop moves to the next word when several are entered.
      const dropping = output.state === 'DROP'
      if (dropping && !this.osc1DropActive && this.words.length > 1) {
        this.activeText = selectTextV2Word(this.words, this.activeText, `drop:${input.context?.dropOccurrence ?? 0}:${input.context?.sectionIdentity ?? ''}`, input.context?.deterministicVariationSeed ?? 0)
      }
      this.osc1DropActive = dropping
    } else if (!o.autoPerformance || !this.osc1Output) {
      engine.setMode(o.mode, manual)
    }
    engine.tick(dt, features, playing)
    const settingsNow = o.autoPerformance && this.osc1Output ? scaleOsc1Times(this.osc1Output.settings, tempoScale) : manual
    this.osc1Renderer.render(engine, { dt, settings: settingsNow, grid: o.grid, hold: o.hold })
  }

  private renderTextV2(input: XyScopeFrameInput, dt: number, playing: boolean): void {
    const settings = this.settings!
    const p = this.params!
    const scope = this.scope.update(input.stereo?.left ?? null, input.stereo?.right ?? null, dt, input.nowSec, input.stereo?.channelCount ?? 2)
    const frame = this.textV2.update(settings.textV2, input.context, input.fresh, playing, dt, scope.source !== 'fallback' ? scope.level : 0)
    this.textV2Frame = frame
    const previousPhase = this.textV2TrajectoryFrame?.phase
    const trajectory = this.textV2Trajectory.update(frame, input.context, input.fresh, playing, dt, settings.textV2.bpmSync)
    this.textV2TrajectoryFrame = trajectory
    if (trajectory.commitWordEvent && this.words.length > 1) {
      this.activeText = selectTextV2Word(this.words, this.activeText, trajectory.commitWordEvent, input.context?.deterministicVariationSeed ?? 0)
      this.rebuildLayoutIfNeeded(true)
    }
    // Drop lettering phosphor once the beam fully occupies its oscillator path.
    if (trajectory.phase === 'formation' && previousPhase !== 'formation') this.needsClear = true
    const background = parseXyScopeColor(p.backgroundColor, FALLBACK_BACKGROUND)
    if (this.needsClear) { this.beam.clear(background); this.needsClear = false }
    this.textV2Path.render(scope, frame, trajectory, settings.textV2, this.width, this.height, dt)
    const core = parseXyScopeColor(p.beamColor, FALLBACK_BEAM)
    const glow = parseXyScopeColor(p.glowColor, FALLBACK_GLOW)
    const mix = frame.controls.colorMix
    const beamColor: XyScopeRgb = [0, 1, 2].map(i => Math.round(core[i] * (1 - mix) + glow[i] * mix)) as unknown as XyScopeRgb
    this.beam.draw(this.textV2Glyphs, this.textV2Buffers, [frame.impact], dt, {
      beamColor, glowColor: glow, backgroundColor: background,
      intensity: p.intensity * frame.controls.intensity,
      glow: p.glow * (.8 + frame.level * .35), trailMs: frame.controls.trailMs,
      widthPx: frame.controls.widthPx, scanPhase: frame.scanPhase,
      scanStrength: Math.min(1, frame.amount) * (1 - frame.controls.protectedPasses),
    })
  }

  private restartChoreography(): void {
    const pattern = this.params?.pattern ?? 'word'
    this.conversation.reset(this.layout.glyphs.length)
    this.performingPattern = pattern
    this.phraseVisit = 0
    this.choreographyBeat = 0
    this.performanceAmount = 0
    this.phase = 0
    this.controller.reset()
    this.activePattern = pattern
  }

  private rebuildLayoutIfNeeded(preserveChoreography = false): void {
    const settings = this.settings
    const params = this.params
    if (!settings || !params || this.width <= 0 || this.height <= 0) return
    const key = [settings.sourceMode, settings.svgMediaId, settings.svgProcessing, this.svgSource?.hash, this.activeText, this.font.id, Math.round(this.width), Math.round(this.height), params.size, params.letterSpacing, params.minPieceSize].join('|')
    if (key === this.layoutKey) return
    this.layoutKey = key
    if (settings.sourceMode === 'svg') {
      this.layout = buildXyScopeSvgLayout(this.svgSource?.id === settings.svgMediaId ? this.svgSource : null, this.width, this.height, params.size, params.minPieceSize, settings.svgProcessing)
    } else if (settings.sourceMode === 'oscillator') {
      const points = Array.from({ length: 512 }, (_, i) => ({ x: Math.cos(i / 512 * Math.PI * 2), y: Math.sin(i / 512 * Math.PI * 2), pathIndex: 0, progress: i / 511 }))
      this.layout = buildXyScopeSvgLayout({ id: 'live-scope', hash: 'scope', points }, this.width, this.height, params.size, 0, 'outline')
    } else this.layout = buildXyScopeLayout({
      text: this.activeText,
      font: this.font,
      width: this.width,
      height: this.height,
      size: params.size,
      letterSpacing: params.letterSpacing,
      minPieceSize: params.minPieceSize,
    })
    this.buffers = this.layout.glyphs.map(glyph => createXyScopePointBuffers(glyph.count))
    this.flashes = this.layout.glyphs.map(() => 0)
    if (settings.sourceMode === 'textV2') this.textV2Path.setLayout(this.layout)
    if (preserveChoreography) this.conversation.reset(this.layout.glyphs.length)
    else this.restartChoreography()
    if (!preserveChoreography || settings.sourceMode !== 'textV2') this.needsClear = true
  }
}
