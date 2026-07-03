import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import type {
  ReactPreset,
  NeonLatticeTriggerType,
  NeonLatticeTriggerEvent,
  NeonLatticeSettings,
  NeonLatticeDecayStyle,
  NeonLatticeTrigger,
  ReactSectionType,
  NeonLatticeDiscreteTriggerSource,
  NeonLatticeLineOrientation,
  NeonLatticePaletteRole,
  NeonLatticePhraseScale,
} from '../ReactTypes'
import { DEFAULT_NEON_LATTICE_SETTINGS } from '../ReactTypes'
import { normalizeNeonLatticeSettings } from '../NeonLatticeConfig'

export interface NeonLatticeRenderParams extends ReactRenderParams {
  neonLatticeSettings?: Partial<NeonLatticeSettings>
  neonLatticeTrigger?: NeonLatticeTriggerEvent | null
}
import {
  type NeonRail,
  type NeonSegment,
  type NeonPulse,
  type NeonFlare,
  type NeonBlock,
  type NeonShockwave,
  type NeonPaletteRgb,
  type PulseRoute,
  makeVerticalRail,
  makeHorizontalRail,
  makeDiagonalRail,
  selectWeightedOrientation,
  buildSegmentIntersections,
  beginSegmentMorph,
  makePulseOnRail,
  pulsePointAt,
  segmentPointAt,
  segmentLength,
  makeFlare,
  makeBlock,
  makeShockwave,
  spawnBlockPattern,
  routePulseAtIntersection,
  selectPulseIntersectionCandidate,
  railLifetimeAlpha,
  flareLifetimeAlpha,
  blockLifetimeAlpha,
  isRailExpired,
  isPulseExpired,
  isFlareExpired,
  isBlockExpired,
  isShockwaveExpired,
  hexToRgbStr,
  MAX_VERT,
  MAX_HORIZ,
  MAX_PULSES,
  MAX_FLARES,
  MAX_BLOCKS,
  MAX_SHOCKWAVES,
  GRID_COLS,
  GRID_ROWS,
  prngNext,
  resolveRailTargets,
  resolveSnapSlot,
  resolveDepthModifiers,
  resolveCameraParallaxShift,
  resolveEffectiveSection,
  resolveSectionSpawnMul,
  resolveSectionBehavior,
  type NLSectionBehavior,
  resolveRailBurstCounts,
  resolveCyanStrikeDuration,
  resolveOverlayAlpha,
  resolveTriggerFires,
  isSnapActive,
  WHITEOUT_DURATION,
  BLACKOUT_DURATION,
  FREEZE_DURATION,
  RESEED_LIFE_SCALE,
  computeVertRailMorphTarget,
  computeHorizRailMorphTarget,
  advanceRailMorph,
  MORPH_DURATION_MIN,
  MORPH_DURATION_MAX,
} from './neonLatticeUtils'
import {
  createNeonLatticeSequencerState,
  laneGeometryFor,
  reseedNeonLatticePattern,
  resetNeonLatticeSequencerState,
  resolveSequenceTrigger,
  retriggerSequencedLane,
  sequencedEnvelopeAlpha,
  type NeonLatticeSequencerState,
} from './neonLatticeSequencer'
import {
  activeNeonLatticeOverrideNames,
  applyNeonLatticePaletteRuntime,
  applyNeonLatticePhraseRuntime,
  computeNeonLatticePhraseProgressModulation,
  consumeNeonLatticeAudioFrame,
  createNeonLatticeAudioDirectorState,
  executeNeonLatticePhraseActions,
  programsForPhraseScale,
  resetNeonLatticeAudioDirector,
  resetNeonLatticePhraseOverrides,
  type NeonLatticeAudioDirectorState,
  type NeonLatticeAudioEvent,
  type NeonLatticePhraseCommand,
  type NeonLatticePhraseRuntimeState,
  type NeonLatticeRuntimeResetReason,
} from './neonLatticeAudioDirector'

// ── Ctx2D union ───────────────────────────────────────────────────────────────

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

// ── Per-context renderer state ────────────────────────────────────────────────

interface NeonLatticeState {
  // rails / canvas
  rails:        NeonSegment[]
  sequencer:    NeonLatticeSequencerState | null
  activeCompositionMode: NeonLatticeSettings['compositionMode']
  invalidSegmentsDiscarded: number
  intersectionCount: number
  duplicateIntersectionsSuppressed: number
  routedPulseCount: number
  preventedRoutingLoops: number
  limitedEvents: number
  qualityTier: NeonLatticeSettings['qualityTier']
  lastResetReason: string | null
  activePresetId: string | null
  lastTrackKey: string | null
  trailCanvas:  OffscreenCanvas
  bloomCanvas:  OffscreenCanvas
  lastW:        number
  lastH:        number
  lastFrameSec: number
  seedCounter:  number
  // rail spawn debounce
  lastKickSec:  number
  lastSnareSec: number
  lastBeatSec:  number
  // fallback transient detection
  prevBass:     number
  prevHigh:     number
  prevMid:      number
  // playback guard
  wasPlaying:   boolean
  // accent objects
  pulses:       NeonPulse[]
  flares:       NeonFlare[]
  blocks:       NeonBlock[]
  shockwaves:   NeonShockwave[]
  // accent spawn debounce
  lastHatSec:      number
  lastFluxSec:     number
  lastComplexSec:  number
  lastDownbeatSec: number
  lastDropSec:     number
  // fallback downbeat counter
  beatHitCount:    number
  // snap-slot deduplication (one pulse/block event per musical subdivision)
  lastPulseSnapSlot:  number
  lastBlockSnapSlot:  number
  // trigger / overlay state (non-persisted visual effects)
  lastConsumedSeq:    number      // legacy renderer trigger sequence
  lastConsumedPerformanceActionSeq: number
  overlayAlpha:       number      // 0 = inactive, >0 = drawing overlay
  overlayColor:       string      // '#ffffff' | '#000000'
  overlayStartSec:    number
  overlayDuration:    number
  frozenUntilSec:     number      // trail freeze; 0 = not frozen
  burstAfterFreeze:   boolean     // emit railBurst when freeze ends
  cyanStrikeUntilSec: number      // legacy action ID; forces the configured semantic palette role while active
  // Camera motion state
  cameraDriftX:        number      // normalized x offset; 0 = center
  cameraDriftVX:       number      // velocity per second (normalized)
  cameraZoom:          number      // 1.0 = neutral
  cameraRotation:      number      // radians; 0 = neutral
  cameraZoomBurst:     number      // downbeat zoom-punch magnitude (decays to 0)
  cameraZoomBurstSec:  number      // audioTime when the burst was triggered
  // Bar-based reseed
  lastReseedBarIndex: number      // barIndex at last auto-reseed; -1 = never
  // Auto-blackout
  autoBlackoutEnd:     number      // audioTime when current auto-blackout ends; 0 = idle
  autoBlackoutFadeIn:  boolean     // true = overlay is ramping TO black (fadeOut mode)
  autoBlackoutFadeRate: number     // alpha / second while ramping in
  strobeNextFlipSec:   number
  strobeState:         boolean
  // Section tracking
  prevSectionType:    ReactSectionType | null
  // MI event edge-detection (index-based deduplication; -1 = not yet seen)
  lastMiFrameId:    number
  lastBeatIndex:    number
  lastBarIndex:     number
  lastPhrase4Index: number
  audioDirector: NeonLatticeAudioDirectorState
  phraseRuntime: NeonLatticePhraseRuntimeState
  // Smoothed audio / MI signals used by the engine-specific MOD controls.
  smoothedBass:   number
  smoothedMid:    number
  smoothedHigh:   number
  smoothedEnergy: number
  smoothedBuild:  number
  smoothedDrop:   number
}

const stateMap = new WeakMap<CanvasRenderingContext2D, NeonLatticeState>()

// ── Flare sprite (module-level cache; rebuilt once) ───────────────────────────

let _flareSprite: OffscreenCanvas | null = null

function getFlareSprite(): OffscreenCanvas {
  if (_flareSprite) return _flareSprite
  const SIZE = 128
  const half = SIZE / 2
  _flareSprite = new OffscreenCanvas(SIZE, SIZE)
  const c = _flareSprite.getContext('2d')!
  // Vertical streak
  c.strokeStyle = 'rgba(255,255,255,0.85)'
  c.lineWidth   = 1.5
  c.beginPath(); c.moveTo(half, 0);    c.lineTo(half, SIZE);  c.stroke()
  // Horizontal streak
  c.beginPath(); c.moveTo(0, half);    c.lineTo(SIZE, half);  c.stroke()
  // Diagonal hints
  c.lineWidth   = 0.8
  c.strokeStyle = 'rgba(255,255,255,0.35)'
  c.beginPath(); c.moveTo(half - 28, half - 28); c.lineTo(half + 28, half + 28); c.stroke()
  c.beginPath(); c.moveTo(half + 28, half - 28); c.lineTo(half - 28, half + 28); c.stroke()
  // Hot white core
  c.fillStyle = 'white'
  c.beginPath(); c.arc(half, half, 4.5, 0, Math.PI * 2); c.fill()
  return _flareSprite
}

// ── State lifecycle ───────────────────────────────────────────────────────────

function makeState(W: number, H: number): NeonLatticeState {
  return {
    rails:        [],
    sequencer:    null,
    activeCompositionMode: 'legacyLattice',
    invalidSegmentsDiscarded: 0,
    intersectionCount: 0,
    duplicateIntersectionsSuppressed: 0,
    routedPulseCount: 0,
    preventedRoutingLoops: 0,
    limitedEvents: 0,
    qualityTier: DEFAULT_NEON_LATTICE_SETTINGS.qualityTier,
    lastResetReason: null,
    activePresetId: null,
    lastTrackKey: null,
    trailCanvas:  new OffscreenCanvas(W, H),
    bloomCanvas:  new OffscreenCanvas(Math.max(1, W >> 1), Math.max(1, H >> 1)),
    lastW:        W,
    lastH:        H,
    lastFrameSec: -1,
    seedCounter:  1,
    lastKickSec:  -10,
    lastSnareSec: -10,
    lastBeatSec:  -10,
    prevBass:     0,
    prevHigh:     0,
    prevMid:      0,
    wasPlaying:   false,
    pulses:       [],
    flares:       [],
    blocks:       [],
    shockwaves:   [],
    lastHatSec:      -10,
    lastFluxSec:     -10,
    lastComplexSec:  -10,
    lastDownbeatSec: -10,
    lastDropSec:     -10,
    beatHitCount:    0,
    lastPulseSnapSlot:  -1,
    lastBlockSnapSlot:  -1,
    lastConsumedSeq:    0,
    lastConsumedPerformanceActionSeq: 0,
    overlayAlpha:       0,
    overlayColor:       '#ffffff',
    overlayStartSec:    -10,
    overlayDuration:    1,
    frozenUntilSec:     0,
    burstAfterFreeze:   false,
    cyanStrikeUntilSec: 0,
    cameraDriftX:        0,
    cameraDriftVX:       0,
    cameraZoom:          1.0,
    cameraRotation:      0,
    cameraZoomBurst:     0,
    cameraZoomBurstSec:  -10,
    lastReseedBarIndex: -1,
    autoBlackoutEnd:      0,
    autoBlackoutFadeIn:   false,
    autoBlackoutFadeRate: 0,
    strobeNextFlipSec:    0,
    strobeState:          false,
    prevSectionType:    null,
    lastMiFrameId:    -1,
    lastBeatIndex:    -1,
    lastBarIndex:     -1,
    lastPhrase4Index: -1,
    audioDirector: createNeonLatticeAudioDirectorState(),
    phraseRuntime: {},
    smoothedBass:   0,
    smoothedMid:    0,
    smoothedHigh:   0,
    smoothedEnergy: 0,
    smoothedBuild:  0,
    smoothedDrop:   0,
  }
}

function resetAccentObjects(st: NeonLatticeState): void {
  st.pulses     = []
  st.flares     = []
  st.blocks     = []
  st.shockwaves = []
}

/**
 * Unified layout-reseed path used by both auto and manual triggers.
 *
 * Generates a new deterministic seed epoch, assigns smooth morph targets to
 * every existing rail (animate in place — no teleport, no clear), retires a
 * small bounded number of surplus rails, and spawns up to 2 new rails when
 * there is a deficit.
 *
 * Callers are responsible for updating `st.lastReseedBarIndex` after this
 * call so the auto-reseed guard cannot fire again immediately.
 */
function beginLayoutReseed(
  st:         NeonLatticeState,
  settings:   NeonLatticeSettings,
  paletteRgb: NeonPaletteRgb,
  audioTime:  number,
): void {
  const rawSeed = (st.seedCounter + 1000 + ((audioTime * 1000 | 0) % 997)) >>> 0
  st.seedCounter = rawSeed === 0 ? 2 : rawSeed

  const diagonalEnabled = settings.orientationWeights.diagonalUp > 0 || settings.orientationWeights.diagonalDown > 0
  const legacyTargets = resolveRailTargets(settings.railDensity, settings.verticalBias)
  const weightedTotal = Math.max(0, Math.round(settings.railDensity * 22))
  const targets: Record<'vertical' | 'horizontal' | 'diagonalUp' | 'diagonalDown', number> = {
    vertical: diagonalEnabled ? Math.min(MAX_VERT, Math.round(weightedTotal * settings.orientationWeights.vertical)) : legacyTargets.targetVert,
    horizontal: diagonalEnabled ? Math.min(MAX_HORIZ, Math.round(weightedTotal * settings.orientationWeights.horizontal)) : legacyTargets.targetHoriz,
    diagonalUp: diagonalEnabled ? Math.min(10, Math.round(weightedTotal * settings.orientationWeights.diagonalUp)) : 0,
    diagonalDown: diagonalEnabled ? Math.min(10, Math.round(weightedTotal * settings.orientationWeights.diagonalDown)) : 0,
  }
  const counts = (orientation: keyof typeof targets) => st.rails.filter(rail => rail.orientation === orientation && rail.laneId == null).length
  const surplus: Record<keyof typeof targets, number> = {
    vertical: Math.max(0, counts('vertical') - targets.vertical),
    horizontal: Math.max(0, counts('horizontal') - targets.horizontal),
    diagonalUp: Math.max(0, counts('diagonalUp') - targets.diagonalUp),
    diagonalDown: Math.max(0, counts('diagonalDown') - targets.diagonalDown),
  }

  let retiralsLeft = 2
  let rng = st.seedCounter
  for (const rail of st.rails) {
    // Sequencer lines have authored lane ownership and are never moved by the
    // autonomous layout reseed. Hybrid mode therefore keeps both clocks clean.
    if (rail.laneId != null) continue
    rng = Math.max(1, (rng * 1009 + 7) >>> 0)
    const [durR] = prngNext(rng)
    const morphDuration = MORPH_DURATION_MIN + durR * (MORPH_DURATION_MAX - MORPH_DURATION_MIN)
    const targetSeed = (rng ^ (st.seedCounter >>> 3)) >>> 0 || 1

    if (rail.orientation === 'vertical') {
      const target = computeVertRailMorphTarget(rail.pos, targetSeed, settings.centerBias)
      beginSegmentMorph(rail, {
        startX: target.targetPos, startY: target.targetSpanStart,
        endX: target.targetPos, endY: target.targetSpanEnd,
      }, morphDuration)
    } else if (rail.orientation === 'horizontal') {
      const target = computeHorizRailMorphTarget(rail.pos, targetSeed, settings.centerBias)
      beginSegmentMorph(rail, {
        startX: target.targetSpanStart, startY: target.targetPos,
        endX: target.targetSpanEnd, endY: target.targetPos,
      }, morphDuration)
    } else if (rail.orientation === 'diagonalUp' || rail.orientation === 'diagonalDown') {
      const target = makeDiagonalRail(
        targetSeed, rail.orientation, settings, audioTime, st.rails, paletteRgb,
        rail.envelopeStrength, { spanMode: rail.spanMode },
      )
      if (beginSegmentMorph(rail, target, morphDuration) === 'replace') {
        rail.lifetime = Math.min(rail.lifetime, audioTime - rail.birthSec + 0.25)
      }
    }

    const orientation = rail.orientation
    if (orientation !== 'custom' && retiralsLeft > 0 && surplus[orientation] > 0) {
      rail.lifetime = Math.min(rail.lifetime, audioTime - rail.birthSec + morphDuration + 0.5)
      surplus[orientation]--
      retiralsLeft--
    }
  }

  const spawnDeficit = (orientation: keyof typeof targets) => {
    const deficit = Math.min(2, Math.max(0, targets[orientation] - counts(orientation)))
    for (let index = 0; index < deficit; index++) {
      st.seedCounter++
      const rail = orientation === 'vertical'
        ? makeVerticalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, 0.6)
        : orientation === 'horizontal'
          ? makeHorizontalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, 0.6)
          : makeDiagonalRail(st.seedCounter, orientation, settings, audioTime, st.rails, paletteRgb, 0.6)
      st.rails.push(rail)
    }
  }
  spawnDeficit('vertical')
  spawnDeficit('horizontal')
  spawnDeficit('diagonalUp')
  spawnDeficit('diagonalDown')
  pruneSegmentBudget(st, settings)
}

function resizeState(st: NeonLatticeState, W: number, H: number): void {
  st.trailCanvas.width  = W
  st.trailCanvas.height = H
  st.bloomCanvas.width  = Math.max(1, W >> 1)
  st.bloomCanvas.height = Math.max(1, H >> 1)
  st.lastFrameSec = -1
  st.rails = []
  st.sequencer = null
  st.intersectionCount = 0
  st.duplicateIntersectionsSuppressed = 0
  st.invalidSegmentsDiscarded = 0
  st.routedPulseCount = 0
  st.preventedRoutingLoops = 0
  st.limitedEvents = 0
  st.lastResetReason = null
  st.lastMiFrameId = -1
  st.lastBeatIndex = -1
  st.lastBarIndex = -1
  st.lastPhrase4Index = -1
  st.audioDirector = createNeonLatticeAudioDirectorState()
  st.phraseRuntime = {}
  st.lastReseedBarIndex = -1
  st.beatHitCount = 0
  st.lastPulseSnapSlot = -1
  st.lastBlockSnapSlot = -1
  st.prevSectionType = null
  st.lastW = W
  st.lastH = H
  st.smoothedBass   = 0
  st.smoothedMid    = 0
  st.smoothedHigh   = 0
  st.smoothedEnergy = 0
  st.smoothedBuild  = 0
  st.smoothedDrop   = 0
  resetAccentObjects(st)
}

// ── Public clear hook ─────────────────────────────────────────────────────────

export function clearNeonLatticeVisualState(
  ctx:    CanvasRenderingContext2D,
  width:  number,
  height: number,
): void {
  const st = stateMap.get(ctx)
  stateMap.delete(ctx)
  if (!st) return

  // Clear trail and bloom canvases
  st.trailCanvas.getContext('2d')?.clearRect(0, 0, width, height)
  st.bloomCanvas.getContext('2d')?.clearRect(0, 0, st.bloomCanvas.width, st.bloomCanvas.height)
  // rails, pulses, blocks, flares, shockwaves, overlays, freeze state, and consumed
  // trigger state (lastConsumedSeq) are all discarded with the state object
}

// ── Trigger effect dispatcher ─────────────────────────────────────────────────

function dispatchTrigger(
  st:         NeonLatticeState,
  type:       NeonLatticeTriggerType,
  audioTime:  number,
  paletteRgb: NeonPaletteRgb,
  settings:   NeonLatticeSettings,
  bpm:        number,
  W:          number,
  H:          number,
): void {
  switch (type) {
    case 'railBurst': {
      const strength = 0.82
      if (settings.compositionMode !== 'legacyLattice' && st.sequencer) {
        const trigger = resolveSequenceTrigger(
          settings.lanePattern,
          st.sequencer,
          st.sequencer.lastTriggerIndex + 1,
          settings.customSegments,
        )
        for (const lane of trigger?.lanes ?? []) {
          retriggerSequencedLane(st.rails, lane, settings, paletteRgb, audioTime, bpm, strength, trigger?.paletteRole)
        }
        pruneSegmentBudget(st, settings)
        if (settings.compositionMode === 'laneSequencer') break
      }
      // Legacy/hybrid autonomous burst remains bounded and axis-compatible.
      const { vertCount, horizCount } = resolveRailBurstCounts(settings.verticalBias)
      for (let i = 0; i < vertCount; i++) {
        if (st.rails.filter(r => r.orientation === 'vertical').length < MAX_VERT) {
          st.seedCounter++
          st.rails.push(makeVerticalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, strength))
        }
      }
      for (let i = 0; i < horizCount; i++) {
        if (st.rails.filter(r => r.orientation === 'horizontal').length < MAX_HORIZ) {
          st.seedCounter++
          st.rails.push(makeHorizontalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, strength))
        }
      }
      pruneSegmentBudget(st, settings)
      break
    }

    case 'blockCascade': {
      // One deterministic pattern per trigger (seeded, not all patterns at once)
      const patterns: Array<'verticalRain' | 'diagonalStair' | 'centerOutward' | 'checker' | 'horizontalScan'> =
        ['verticalRain', 'diagonalStair', 'centerOutward', 'checker', 'horizontalScan']
      st.seedCounter++
      const [pv] = prngNext(st.seedCounter)
      const pattern = patterns[Math.floor(pv * patterns.length)]
      const cells = spawnBlockPattern(pattern, st.seedCounter, 0.80)
      for (const { col, row } of cells) {
        if (st.blocks.length >= MAX_BLOCKS) break
        st.blocks.push(makeBlock(col, row, audioTime, settings.blockHold * 1.5, paletteRgb.accent, 0.80))
      }
      break
    }

    case 'crossFlare': {
      const scale = Math.max(0.30, settings.flareAmount)
      const bright = 0.60 + scale * 0.35
      let intersectionData = buildSegmentIntersections(st.rails)
      // Preserve the old manual trigger guarantee: create one temporary cross
      // only when the scene has no routable intersection at all.
      if (intersectionData.intersections.length === 0) {
        st.seedCounter++
        st.rails.push(makeVerticalRail(st.seedCounter, { ...settings, railLifetime: 0.8 }, audioTime, st.rails, paletteRgb, 0.55))
        st.seedCounter++
        st.rails.push(makeHorizontalRail(st.seedCounter, { ...settings, railLifetime: 0.8 }, audioTime, st.rails, paletteRgb, 0.55))
        intersectionData = buildSegmentIntersections(st.rails)
      }
      st.intersectionCount = intersectionData.intersections.length
      st.duplicateIntersectionsSuppressed += intersectionData.duplicatesSuppressed
      const maxFlares = Math.min(MAX_FLARES, Math.max(4, Math.round(scale * MAX_FLARES * 0.5)))
      for (const hit of intersectionData.intersections) {
        if (st.flares.length >= maxFlares) break
        const a = st.rails.find(rail => rail.id === hit.segmentAId)
        const b = st.rails.find(rail => rail.id === hit.segmentBId)
        const depth = ((a?.depth ?? 0.5) + (b?.depth ?? 0.5)) / 2
        st.flares.push(makeFlare(hit.x, hit.y, audioTime, bright, paletteRgb.primary, depth, scale))
      }
      break
    }

    case 'whiteout': {
      // Fast attack flash — very short, no lingering white overlay
      st.overlayColor    = '#ffffff'
      st.overlayAlpha    = 1
      st.overlayStartSec = audioTime
      st.overlayDuration = WHITEOUT_DURATION
      break
    }

    case 'blackout': {
      // Short controlled envelope — auto-recovers; independent of blackoutMode setting
      st.overlayColor    = '#000000'
      st.overlayAlpha    = 1
      st.overlayStartSec = audioTime
      st.overlayDuration = BLACKOUT_DURATION
      break
    }

    case 'reseed': {
      // Animate all existing rails to new positions; update guard index.
      if (settings.compositionMode !== 'laneSequencer') beginLayoutReseed(st, settings, paletteRgb, audioTime)
      if (settings.compositionMode !== 'legacyLattice' && st.sequencer) reseedNeonLatticePattern(st.sequencer, settings.lanePattern)
      if (st.lastBarIndex >= 0) st.lastReseedBarIndex = st.lastBarIndex
      break
    }

    case 'freezeTrails': {
      // Pause trail decay, pulse movement, spawning, and camera drift for FREEZE_DURATION seconds
      st.frozenUntilSec   = audioTime + FREEZE_DURATION
      st.burstAfterFreeze = true
      break
    }

    case 'cyanStrike': {
      // Preserve the legacy action ID while resolving the visible color from the active semantic palette.
      st.cyanStrikeUntilSec = audioTime + resolveCyanStrikeDuration(bpm)
      break
    }
  }
}

// ── Draw helpers (trail canvas) ───────────────────────────────────────────────

function applyTrailDecay(
  tCtx:       Ctx2D,
  W:          number,
  H:          number,
  trailDecay: number,
  style:      NeonLatticeDecayStyle,
  dt:         number,
  audioTime:  number,
): void {
  let alpha: number
  const rate = Math.max(0.005, Math.min(0.98, trailDecay))
  switch (style) {
    case 'exponential':
      // Frame-multiplicative: each frame paints `rate` opacity of background
      alpha = rate
      break
    case 'linear':
      // Time-consistent: dt-scaled so decay speed is independent of frame rate
      alpha = Math.min(0.98, rate * dt * 15)
      break
    case 'hold':
      // Very slow fade — trails persist much longer than exponential
      alpha = Math.min(0.40, rate * dt * 3)
      break
    case 'pulse':
      // Sinusoidal oscillation: trail rhythmically brightens and dims
      alpha = Math.max(0.004, rate * (0.25 + 0.75 * Math.abs(Math.sin(audioTime * Math.PI * 1.6))))
      break
    default:
      alpha = rate
  }
  tCtx.globalCompositeOperation = 'source-over'
  tCtx.fillStyle = `rgba(3,7,13,${alpha.toFixed(3)})`
  tCtx.fillRect(0, 0, W, H)
}

function drawBlock(
  ctx:          Ctx2D,
  block:        NeonBlock,
  W:            number,
  H:            number,
  age:          number,
  intensity:    number,
  depthSetting: number,
): void {
  const dm = resolveDepthModifiers(depthSetting, block.depth)
  const la = blockLifetimeAlpha(age, block.lifetime)
  const a  = la * block.alpha * intensity * dm.alphaMul
  if (a < 0.004) return
  const x0 = (block.col       / GRID_COLS) * W
  const y0 = (block.row       / GRID_ROWS) * H
  const x1 = ((block.col + 1) / GRID_COLS) * W
  const y1 = ((block.row + 1) / GRID_ROWS) * H
  ctx.fillStyle = `rgba(${block.colorRgb},${a.toFixed(3)})`
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
}

function drawPulse(
  ctx:            Ctx2D,
  pulse:          NeonPulse,
  W:              number,
  H:              number,
  age:            number,
  intensity:      number,
  colorOverride?: string,
): void {
  const la = railLifetimeAlpha(age, pulse.lifetime)
  const a  = la * pulse.brightness * intensity
  if (a < 0.01) return

  const point = pulsePointAt(pulse)
  const px = point.x * W
  const py = point.y * H
  const r  = pulse.radius * Math.min(W, H)
  const rgb = colorOverride ?? pulse.colorRgb

  ctx.fillStyle = `rgba(${rgb},${(a * 0.12).toFixed(3)})`
  ctx.beginPath(); ctx.arc(px, py, r * 4, 0, Math.PI * 2); ctx.fill()

  ctx.fillStyle = `rgba(${rgb},${(a * 0.80).toFixed(3)})`
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()

  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a * 0.65).toFixed(3)})`
  ctx.beginPath(); ctx.arc(px, py, r * 0.35, 0, Math.PI * 2); ctx.fill()

  const dx = pulse.endX - pulse.startX
  const dy = pulse.endY - pulse.startY
  const len = Math.max(1e-6, Math.hypot(dx * W, dy * H))
  const ux = (dx * W) / len
  const uy = (dy * H) / len
  const tLen = r * 3.5 * pulse.direction
  ctx.strokeStyle = `rgba(${rgb},${(a * 0.28).toFixed(3)})`
  ctx.lineWidth   = r * 0.45
  ctx.lineCap     = 'round'
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - ux * tLen, py - uy * tLen); ctx.stroke()
}

export interface NeonLatticeLinePass {
  width: number
  alpha: number
  color: 'palette' | 'white'
  composite: GlobalCompositeOperation
}

export function resolveNeonLatticeLinePasses(
  settings: NeonLatticeSettings,
  railWidth: number,
  widthMul: number,
  baseAlpha: number,
  railGlow: number,
  authoredChord: boolean,
): NeonLatticeLinePass[] {
  const alpha = clampUnit(baseAlpha)
  const width = Math.max(0.05, Number.isFinite(railWidth * widthMul) ? railWidth * widthMul : 0.5)
  const chordBoost = authoredChord ? 1 + settings.chordBloomBoost * 0.35 : 1
  const limits = neonLatticeQualityLimits(settings.qualityTier)
  const passes: NeonLatticeLinePass[] = []
  for (let index = limits.haloPasses - 1; index >= 0; index--) {
    const normalized = limits.haloPasses <= 1 ? 1 : (index + 1) / limits.haloPasses
    passes.push({
      width: Math.max(width, width * settings.haloWidth * (0.55 + normalized * 0.45)),
      alpha: Math.min(0.55, alpha * settings.haloIntensity * railGlow * chordBoost * Math.pow(settings.haloFalloff, index)),
      color: 'palette',
      composite: 'screen',
    })
  }
  passes.push({
    width: Math.max(0.1, width * settings.bodyWidth),
    alpha: Math.min(0.88, alpha * settings.bodyIntensity),
    color: 'palette',
    composite: 'screen',
  })
  passes.push({
    width: Math.max(0.25, width * settings.coreWidth),
    alpha: Math.min(1, alpha * settings.coreIntensity),
    color: settings.highlightCenterHot ? 'white' : 'palette',
    composite: 'source-over',
  })
  return passes.filter(pass => Number.isFinite(pass.width) && Number.isFinite(pass.alpha) && pass.alpha > 0.001)
}

function drawRail(
  ctx:           Ctx2D,
  rail:          NeonSegment,
  W:             number,
  H:             number,
  la:            number,
  intensity:     number,
  widthMul:      number,
  settings:      NeonLatticeSettings,
  flickerMultiplier: number,
  colorOverride?: string,
): void {
  const a = clampUnit(la * rail.alpha * intensity * flickerMultiplier)
  if (a < 0.01) return
  const rgb = colorOverride ?? rail.colorRgb
  const x0 = rail.startX * W
  const y0 = rail.startY * H
  const x1 = rail.endX * W
  const y1 = rail.endY * H

  const passes = resolveNeonLatticeLinePasses(settings, rail.width, widthMul, a, rail.glow, rail.envelope != null)
  ctx.save()
  for (const pass of passes) {
    ctx.globalCompositeOperation = pass.composite
    ctx.lineWidth = pass.width
    ctx.strokeStyle = pass.color === 'white'
      ? `rgba(255,255,255,${pass.alpha.toFixed(3)})`
      : `rgba(${rgb},${pass.alpha.toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  }
  ctx.restore()
}

// ── Draw helpers (main canvas) ────────────────────────────────────────────────

function drawFlare(
  ctx:       CanvasRenderingContext2D,
  flare:     NeonFlare,
  W:         number,
  H:         number,
  sprite:    OffscreenCanvas,
  age:       number,
  intensity: number,
  bloom:     number,
): void {
  const la = flareLifetimeAlpha(age, flare.lifetime)
  const a  = la * flare.brightness * intensity
  if (a < 0.01) return

  const x    = flare.x * W
  const y    = flare.y * H
  const size = (0.035 + bloom * 0.035) * Math.min(W, H) * Math.max(0.3, flare.scale)

  ctx.save()

  // Palette halo ring
  ctx.globalAlpha  = a * 0.45
  ctx.strokeStyle  = `rgba(${flare.paletteRgb},1)`
  ctx.lineWidth    = 1.8
  ctx.beginPath(); ctx.arc(x, y, size * 0.65, 0, Math.PI * 2); ctx.stroke()

  // White sprite (cross + core) — screen blend brightens underlying content
  ctx.globalCompositeOperation = 'screen' as GlobalCompositeOperation
  ctx.globalAlpha = a * 0.9
  ctx.drawImage(sprite, x - size, y - size, size * 2, size * 2)

  ctx.restore()
}

function drawShockwave(
  ctx:       CanvasRenderingContext2D,
  sw:        NeonShockwave,
  W:         number,
  H:         number,
  age:       number,
  intensity: number,
): void {
  const progress = age / Math.max(0.001, sw.lifetime)
  if (progress >= 1) return
  const a = (1 - progress) * sw.strength * intensity * 0.55
  if (a < 0.01) return

  const halfW = progress * W  * 0.55
  const halfH = progress * H  * 0.55
  const x     = sw.cx * W - halfW
  const y     = sw.cy * H - halfH

  ctx.save()
  ctx.strokeStyle = `rgba(${sw.colorRgb},${Math.min(1, a).toFixed(3)})`
  ctx.lineWidth   = 1.8
  ctx.strokeRect(x, y, halfW * 2, halfH * 2)
  // Inner echo rect
  ctx.globalAlpha = 0.4
  ctx.strokeRect(x + 5, y + 5, halfW * 2 - 10, halfH * 2 - 10)
  ctx.restore()
}

function applyBloom(
  ctx:         CanvasRenderingContext2D,
  trailCanvas: OffscreenCanvas,
  bloomCanvas: OffscreenCanvas,
  bloomAmount: number,
  bloomGain: number,
  W:           number,
  H:           number,
): void {
  const bCtx = bloomCanvas.getContext('2d')
  if (!bCtx) return
  bCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height)
  if (bloomAmount < 0.01 || bloomGain <= 0) return
  bCtx.drawImage(trailCanvas, 0, 0, bloomCanvas.width, bloomCanvas.height)
  ctx.save()
  ctx.globalAlpha              = Math.min(0.78, Math.max(0, bloomAmount * bloomGain))
  ctx.globalCompositeOperation = 'screen' as GlobalCompositeOperation
  ctx.drawImage(bloomCanvas, 0, 0, W, H)
  ctx.restore()
}

// ── Pulse update + routing ─────────────────────────────────────────────────────

/**
 * Advance all pulses by `dt` seconds. At each intersection, deterministically
 * route: continue, turn, split (once), or expire. Returns new flares and child
 * pulses to append after the loop.
 */
function updatePulses(
  st:            NeonLatticeState,
  dt:            number,
  audioTime:     number,
  paletteRgb:    string,
  settings:      { pulseSpeed: number; cyanAccentChance: number },
  flareAmount:   number,
  flareTarget:   number,
  depthSetting:  number,
): { newFlares: NeonFlare[]; newPulses: NeonPulse[] } {
  const newFlares: NeonFlare[] = []
  const newPulses: NeonPulse[] = []
  const validRails = st.rails.filter(rail =>
    [rail.startX, rail.startY, rail.endX, rail.endY].every(Number.isFinite) && segmentLength(rail) > 1e-5,
  )
  st.invalidSegmentsDiscarded += st.rails.length - validRails.length
  st.rails = validRails
  const intersectionData = buildSegmentIntersections(st.rails, 1e-6)
  st.intersectionCount = intersectionData.intersections.length
  st.duplicateIntersectionsSuppressed += intersectionData.duplicatesSuppressed
  const railById = new Map(st.rails.map(rail => [rail.id, rail]))

  for (const pulse of st.pulses) {
    const current = railById.get(pulse.segmentId)
    if (!current) { pulse.lifetime = 0; continue }
    // Follow morphing geometry without converting normalized progress to pixels.
    pulse.startX = current.startX; pulse.startY = current.startY
    pulse.endX = current.endX; pulse.endY = current.endY
    const prevProgress = pulse.progress
    const pdm = resolveDepthModifiers(depthSetting, pulse.depth)
    const nextProgress = prevProgress + pulse.direction * pulse.speed * pdm.speedMul * dt / Math.max(0.05, segmentLength(current))
    const hit = selectPulseIntersectionCandidate(
      current.id,
      prevProgress,
      nextProgress,
      pulse.direction,
      intersectionData.intersections,
      pulse.routeHistory,
      pulse.lastIntersectionId,
    )
    pulse.progress = nextProgress
    if (!hit) continue

    const other = railById.get(hit.otherSegmentId)
    if (!other) continue
    pulse.progress = hit.currentProgress
    const routeSeed = Math.abs(hit.intersection.id.split('').reduce((acc, char) => acc * 33 + char.charCodeAt(0), st.seedCounter)) >>> 0
    const route: PulseRoute = routePulseAtIntersection(pulse.splitCount, routeSeed)
    pulse.lastIntersectionId = hit.intersection.id

    if (route !== 'continue' && flareTarget > 0 && st.flares.length + newFlares.length < flareTarget) {
      const [fv] = prngNext(routeSeed + 19)
      if (fv < flareAmount) {
        newFlares.push(makeFlare(hit.intersection.x, hit.intersection.y, audioTime, pulse.brightness * flareAmount, paletteRgb, pulse.depth, flareAmount))
      }
    }
    if (route === 'expire') { pulse.lifetime = 0; continue }
    if (route === 'continue') continue

    if (pulse.routeHistory.slice(-2).includes(other.id)) {
      st.preventedRoutingLoops++
      continue
    }
    const [dirVal] = prngNext(routeSeed + 7)
    const newDirection: 1 | -1 = dirVal < 0.5 ? 1 : -1
    const child: NeonPulse = {
      id: `nl-pr-${routeSeed}-${Math.round(audioTime * 1000)}`,
      segmentId: other.id,
      startX: other.startX,
      startY: other.startY,
      endX: other.endX,
      endY: other.endY,
      progress: Math.max(0, Math.min(1, hit.otherProgress)),
      direction: newDirection,
      speed: pulse.speed * (0.85 + (routeSeed % 30) / 100),
      brightness: pulse.brightness * 0.80,
      radius: pulse.radius * 0.85,
      colorRgb: pulse.colorRgb,
      birthSec: audioTime,
      lifetime: Math.max(0.08, pulse.lifetime * 0.70),
      depth: (pulse.depth + other.depth) / 2,
      splitCount: pulse.splitCount + 1,
      routeHistory: [...pulse.routeHistory.slice(-4), current.id, other.id],
      lastIntersectionId: hit.intersection.id,
      vertical: other.orientation === 'vertical',
      railPos: other.orientation === 'vertical' ? other.startX : other.startY,
    }
    st.routedPulseCount++
    if (route === 'split' && pulse.splitCount === 0 && st.pulses.length + newPulses.length < MAX_PULSES) {
      newPulses.push(child)
      pulse.splitCount = 1
    } else {
      Object.assign(pulse, child, { id: pulse.id })
    }
  }
  return { newFlares, newPulses }
}

// ── Main renderer ─────────────────────────────────────────────────────────────

const GAP_RESET_SEC      = 2.5
const KICK_DEBOUNCE      = 0.15
const SNARE_DEBOUNCE     = 0.18
const BEAT_DEBOUNCE      = 0.22
const HAT_DEBOUNCE       = 0.12
const FLUX_DEBOUNCE      = 0.30
const COMPLEX_DEBOUNCE   = 0.50
const DOWNBEAT_DEBOUNCE  = 0.80
const MAX_ACTIVE_SEGMENTS = 36

export function neonLatticeQualityLimits(qualityTier: NeonLatticeSettings['qualityTier']): {
  maxSegments: number
  maxFlares: number
  maxPulses: number
  maxChordSize: number
  haloPasses: number
  bloomScale: number
} {
  if (qualityTier === 'low') return { maxSegments: 20, maxFlares: 8, maxPulses: 14, maxChordSize: 4, haloPasses: 1, bloomScale: 0.25 }
  if (qualityTier === 'medium') return { maxSegments: 28, maxFlares: 16, maxPulses: 22, maxChordSize: 8, haloPasses: 2, bloomScale: 0.38 }
  return { maxSegments: MAX_ACTIVE_SEGMENTS, maxFlares: MAX_FLARES, maxPulses: MAX_PULSES, maxChordSize: 16, haloPasses: 3, bloomScale: 0.5 }
}

function pruneSegmentBudget(st: NeonLatticeState, settings: NeonLatticeSettings): void {
  const maxSegments = neonLatticeQualityLimits(settings.qualityTier).maxSegments
  if (st.rails.length <= maxSegments) return
  st.limitedEvents += st.rails.length - maxSegments
  const retained = st.rails
    .slice()
    .sort((a, b) => b.birthSec - a.birthSec || a.id.localeCompare(b.id))
    .slice(0, maxSegments)
  const retainedIds = new Set(retained.map(rail => rail.id))
  st.rails = retained
  st.pulses = st.pulses.filter(pulse => retainedIds.has(pulse.segmentId))
}

function stableRouteOffset(id: string, modulo: number): number {
  if (modulo <= 1) return 0
  let hash = 2166136261
  for (let index = 0; index < id.length; index++) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % modulo
}

function resolveLineFlickerMultiplier(id: string, audioTime: number, amount: number): number {
  const depth = clampUnit(amount)
  if (depth <= 0) return 1
  const phase = stableRouteOffset(id, 4093) / 4093 * Math.PI * 2
  const wave = 0.5 + 0.5 * Math.sin(audioTime * 47 + phase)
  return Math.max(0.65, 1 - depth * 0.22 + wave * depth * 0.22)
}

function spawnAuthoredLaneCluster(
  st: NeonLatticeState,
  settings: NeonLatticeSettings,
  paletteRgb: NeonPaletteRgb,
  audioTime: number,
  bpm: number,
  event: Pick<NeonLatticeAudioEvent, 'beatIndex' | 'strength'>,
  options: {
    routeId: string
    orientation?: NeonLatticeLineOrientation
    chordSize?: number
    strength?: number
    paletteRole?: NeonLatticePaletteRole
    explicitLanes?: readonly number[]
    laneSpacingScale?: number
  },
): void {
  if (settings.compositionMode === 'legacyLattice') return
  const laneCount = Math.max(1, settings.lanePattern.laneCount)
  const requestedOrientation = options.orientation ?? settings.lanePattern.orientations[0] ?? 'vertical'
  const orientation: Exclude<NeonLatticeLineOrientation, 'custom'> = requestedOrientation === 'custom'
    ? 'vertical'
    : requestedOrientation
  const qualityChordLimit = neonLatticeQualityLimits(settings.qualityTier).maxChordSize
  const rawRequestedChord = Math.max(1, Math.round(options.chordSize ?? settings.chordSize))
  const requestedChord = Math.max(1, Math.min(laneCount, qualityChordLimit, rawRequestedChord))
  st.limitedEvents += Math.max(0, rawRequestedChord - requestedChord)
  const routeOffset = stableRouteOffset(options.routeId, laneCount)
  const baseLane = ((event.beatIndex + routeOffset) % laneCount + laneCount) % laneCount
  const spacing = Math.max(1, Math.round(options.laneSpacingScale ?? 1))
  const orderedLanes = Array.from({ length: laneCount }, (_, index) => index)
  const center = (laneCount - 1) / 2
  if (settings.laneAssignmentMode === 'centerOut') orderedLanes.sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b)
  if (settings.laneAssignmentMode === 'outsideIn') orderedLanes.sort((a, b) => Math.abs(b - center) - Math.abs(a - center) || a - b)
  if (settings.laneAssignmentMode === 'random') {
    orderedLanes.sort((a, b) => stableRouteOffset(`${options.routeId}:${event.beatIndex}:${a}`, 1009) - stableRouteOffset(`${options.routeId}:${event.beatIndex}:${b}`, 1009))
  }
  const presetStep = settings.lanePattern.steps[event.beatIndex % Math.max(1, settings.lanePattern.steps.length)]
  const laneIndexes = options.explicitLanes && options.explicitLanes.length > 0
    ? options.explicitLanes.map(lane => Math.max(0, Math.min(laneCount - 1, Math.round(lane))))
    : settings.laneAssignmentMode === 'presetDefined' && presetStep?.lanes.length
      ? presetStep.lanes
      : settings.laneAssignmentMode === 'sequence'
        ? Array.from({ length: requestedChord }, (_, index) => (baseLane + index * spacing) % laneCount)
        : orderedLanes.slice(0, requestedChord)
  const uniqueLanes = [...new Set(laneIndexes)].slice(0, requestedChord)
  const maxSegments = neonLatticeQualityLimits(settings.qualityTier).maxSegments
  for (const laneIndex of uniqueLanes) {
    const lane = laneGeometryFor(orientation, laneIndex, laneCount, settings.lanePattern.mirrored)
    if (st.rails.length >= maxSegments && !st.rails.some(rail => rail.laneId === lane.id)) break
    retriggerSequencedLane(
      st.rails,
      lane,
      settings,
      paletteRgb,
      audioTime,
      bpm,
      clampUnit((options.strength ?? 1) * event.strength),
      options.paletteRole,
    )
  }
  pruneSegmentBudget(st, settings)
}

function executePhraseCommand(
  st: NeonLatticeState,
  command: NeonLatticePhraseCommand,
  settings: NeonLatticeSettings,
  paletteRgb: NeonPaletteRgb,
  audioTime: number,
  bpm: number,
  phraseEvent: NeonLatticeAudioEvent,
): void {
  switch (command.type) {
    case 'spawnLine':
      spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, bpm, phraseEvent, {
        routeId: `phrase-line-${phraseEvent.phraseScale ?? 0}`,
        orientation: command.orientation,
        explicitLanes: command.lane == null ? undefined : [command.lane],
        strength: command.strength,
        paletteRole: command.paletteRole,
      })
      break
    case 'spawnLineCluster':
      spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, bpm, phraseEvent, {
        routeId: `phrase-cluster-${phraseEvent.phraseScale ?? 0}`,
        orientation: command.orientation,
        chordSize: command.chordSize,
        explicitLanes: command.lanes,
        strength: command.strength,
        paletteRole: command.paletteRole,
      })
      break
    case 'lineSweep': {
      const laneCount = Math.max(1, settings.lanePattern.laneCount)
      const lanes = Array.from({ length: Math.min(laneCount, 8) }, (_, index) => command.direction === -1 ? laneCount - 1 - index : index)
      spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, bpm, phraseEvent, {
        routeId: `phrase-sweep-${phraseEvent.phraseScale ?? 0}`,
        orientation: command.orientation,
        chordSize: lanes.length,
        explicitLanes: lanes,
        strength: command.strength,
        paletteRole: 'accent',
      })
      break
    }
    case 'patternReseed':
      if (st.sequencer) reseedNeonLatticePattern(st.sequencer, settings.lanePattern, command.seed)
      if (settings.compositionMode !== 'laneSequencer') beginLayoutReseed(st, settings, paletteRgb, audioTime)
      break
    case 'clearLines':
      st.rails = []
      st.pulses = []
      break
    case 'blackout': {
      const beatSeconds = 60 / Math.max(1, bpm || 120)
      st.overlayColor = '#000000'
      st.overlayAlpha = 1
      st.overlayStartSec = audioTime
      st.overlayDuration = Math.max(0.03, command.durationBeats * beatSeconds)
      break
    }
    case 'highlightStrike':
      spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, bpm, phraseEvent, {
        routeId: `phrase-highlight-${phraseEvent.phraseScale ?? 0}`,
        orientation: command.orientation,
        chordSize: Math.min(4, settings.lanePattern.laneCount),
        strength: command.strength,
        paletteRole: 'highlight',
      })
      break
    case 'blockCascade':
      dispatchTrigger(st, 'blockCascade', audioTime, paletteRgb, settings, bpm, 0, 0)
      break
  }
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

/** Remove analyser floor noise, then expand the remaining signal to 0–1. */
function applyAudioGate(value: number, gate: number): number {
  const v = clampUnit(value)
  const g = Math.min(0.98, clampUnit(gate))
  return v <= g ? 0 : (v - g) / (1 - g)
}

/** Higher smoothing values deliberately produce a slower, silkier response. */
function smoothReactiveSignal(current: number, target: number, dt: number, smoothing: number): number {
  if (dt <= 0) return Number.isFinite(current) ? current : 0
  const responseHz = 24 - clampUnit(smoothing) * 21.5
  const alpha = 1 - Math.exp(-responseHz * dt)
  return current + (target - current) * alpha
}

function mixFromNeutral(neutral: number, value: number, amount: number): number {
  return neutral + (value - neutral) * clampUnit(amount)
}

export function renderNeonLattice(
  ctx:         CanvasRenderingContext2D,
  frame:       ReactFrameContext,
  params:      NeonLatticeRenderParams,
  preset:      ReactPreset,
  manualSectionType: ReactSectionType | null = null,
): void {
  const { W, H } = frame
  const baseSettings = normalizeNeonLatticeSettings({ ...DEFAULT_NEON_LATTICE_SETTINGS, ...params.neonLatticeSettings })
  let settings = baseSettings
  const audioTime = frame.audioTime

  // ── State bootstrap / reset guards ────────────────────────────────────────
  let st = stateMap.get(ctx)
  if (!st) {
    st = makeState(W, H)
    stateMap.set(ctx, st)
  }

  const dimChanged   = st.lastW !== W || st.lastH !== H
  const longGap      = st.lastFrameSec >= 0 && (audioTime - st.lastFrameSec) > GAP_RESET_SEC
  const stoppedPlay  = st.wasPlaying && !frame.isPlaying && !frame.isPaused
  const transportDiscontinuity = frame.timingDiscontinuity === true
  const rewound = st.lastFrameSec >= 0 && audioTime < st.lastFrameSec - 0.05
  const nextTrackKey = frame.trackKey ?? null
  const trackChanged = st.lastFrameSec >= 0 && st.lastTrackKey !== nextTrackKey
  const presetChanged = st.activePresetId !== null && st.activePresetId !== preset.id
  let lifecycleResetReason: NeonLatticeRuntimeResetReason | null = null
  if (trackChanged) lifecycleResetReason = 'trackReplacement'
  else if (presetChanged) lifecycleResetReason = 'presetChange'
  else if (dimChanged || longGap || stoppedPlay || transportDiscontinuity || rewound) lifecycleResetReason = 'rendererRemount'

  if (dimChanged || longGap || stoppedPlay || transportDiscontinuity || rewound || trackChanged || presetChanged) {
    resizeState(st, W, H)
    if (lifecycleResetReason) {
      st.audioDirector.diagnostics.phraseResetReason = lifecycleResetReason
      st.lastResetReason = lifecycleResetReason
    }
  }

  st.qualityTier = baseSettings.qualityTier
  const dt          = Math.min(0.1, Math.max(0, audioTime - (st.lastFrameSec < 0 ? audioTime : st.lastFrameSec)))
  st.lastFrameSec   = audioTime
  st.wasPlaying     = frame.isPlaying
  st.activePresetId = preset.id
  st.lastTrackKey   = nextTrackKey
  // Freeze guard — declared early so blackout/camera sections can test it
  const isFrozen    = audioTime < st.frozenUntilSec

  // ── Palette ────────────────────────────────────────────────────────────────
  const basePaletteRgb: Required<NeonPaletteRgb> = {
    primary:   hexToRgbStr(preset.palette.primary),
    secondary: hexToRgbStr(preset.palette.secondary),
    accent:    hexToRgbStr(preset.palette.accent),
    highlight: hexToRgbStr(preset.palette.highlight),
    background: hexToRgbStr(preset.palette.background ?? '#03070d'),
  }
  const bgColor = preset.palette.background ?? '#03070d'

  const mi = frame.musicIntelligence
  const consumedAudio = consumeNeonLatticeAudioFrame(st.audioDirector, {
    frame: mi,
    settings: baseSettings,
    isPlaying: frame.isPlaying,
    isPaused: frame.isPaused,
    timingDiscontinuity: frame.timingDiscontinuity,
    audioTime,
    trackKey: frame.trackKey,
  })
  if (consumedAudio.resetReason === 'trackReplacement' || consumedAudio.resetReason === 'analysisReplacement') {
    st.phraseRuntime = resetNeonLatticePhraseOverrides(st.phraseRuntime, 'trackReplacement')
  } else if (consumedAudio.resetReason) {
    st.phraseRuntime = resetNeonLatticePhraseOverrides(st.phraseRuntime, 'rendererRemount')
  }

  if (consumedAudio.resetReason) st.lastResetReason = consumedAudio.resetReason
  const audioEvents = consumedAudio.events
  if (audioEvents.some(event => event.source === 'beat')) {
    st.phraseRuntime = resetNeonLatticePhraseOverrides(st.phraseRuntime, 'nextStep')
    st.audioDirector.diagnostics.phraseResetReason = 'nextStep'
  }
  if (audioEvents.some(event => event.source === 'downbeat')) {
    st.phraseRuntime = resetNeonLatticePhraseOverrides(st.phraseRuntime, 'nextBar')
    st.audioDirector.diagnostics.phraseResetReason = 'nextBar'
  }
  if (audioEvents.some(event => event.phraseScale != null)) {
    st.phraseRuntime = resetNeonLatticePhraseOverrides(st.phraseRuntime, 'nextPhrase')
    st.audioDirector.diagnostics.phraseResetReason = 'nextPhrase'
  }
  if (audioEvents.some(event => event.source === 'sectionChange')) {
    st.phraseRuntime = resetNeonLatticePhraseOverrides(st.phraseRuntime, 'sectionChange')
    st.audioDirector.diagnostics.phraseResetReason = 'sectionChange'
  }

  const phraseCommands: Array<{ command: NeonLatticePhraseCommand; event: NeonLatticeAudioEvent }> = []
  for (const event of audioEvents) {
    if (!event.phraseScale) continue
    const phraseRouteEnabled = baseSettings.triggerRoutes.some(route =>
      route.enabled && route.source === event.source && route.action === 'runPhraseProgram' && route.amount > 0,
    )
    if (!phraseRouteEnabled) continue
    const phraseIndex = Math.floor(event.beatIndex / event.phraseScale)
    const programs = programsForPhraseScale(baseSettings.phrasePrograms, event.phraseScale, phraseIndex)
    for (const program of programs) {
      const execution = executeNeonLatticePhraseActions(st.phraseRuntime, program.actions, baseSettings)
      st.phraseRuntime = execution.runtime
      st.audioDirector.diagnostics.lastPhraseActionExecuted = execution.lastAction
      for (const command of execution.commands) phraseCommands.push({ command, event })
    }
  }
  st.audioDirector.diagnostics.activeTemporaryOverrides = activeNeonLatticeOverrideNames(st.phraseRuntime)
  settings = applyNeonLatticePhraseRuntime(baseSettings, st.phraseRuntime)
  const phraseProgress = computeNeonLatticePhraseProgressModulation(mi, settings)
  settings = normalizeNeonLatticeSettings({
    ...settings,
    railDensity: clampUnit(settings.railDensity + phraseProgress.densityDelta),
    bloom: Math.max(0, Math.min(2, settings.bloom * phraseProgress.bloomMultiplier)),
    orientationWeights: {
      ...settings.orientationWeights,
      diagonalUp: settings.orientationWeights.diagonalUp + phraseProgress.diagonalWeightDelta * 0.5,
      diagonalDown: settings.orientationWeights.diagonalDown + phraseProgress.diagonalWeightDelta * 0.5,
    },
  })
  const paletteRgb = applyNeonLatticePaletteRuntime(basePaletteRgb, st.phraseRuntime)
  const accentRgb = paletteRgb.accent
  const strikeRgb = paletteRgb[settings.cyanStrikePaletteRole] ?? paletteRgb.highlight
  const qualityLimits = neonLatticeQualityLimits(settings.qualityTier)
  const bloomResolutionScale = Math.max(
    0.15,
    Math.min(0.75, qualityLimits.bloomScale / Math.max(0.5, settings.bloomSpread)),
  )
  const bloomWidth = Math.max(1, Math.round(W * bloomResolutionScale))
  const bloomHeight = Math.max(1, Math.round(H * bloomResolutionScale))
  if (st.bloomCanvas.width !== bloomWidth || st.bloomCanvas.height !== bloomHeight) {
    st.bloomCanvas.width = bloomWidth
    st.bloomCanvas.height = bloomHeight
  }

  // Composition ownership is explicit. Switching modes retires the other
  // runtime's authored lines and clears route state so an engine change, seek,
  // or preset replacement cannot leave stale lane identities behind.
  if (st.activeCompositionMode !== settings.compositionMode) {
    if (settings.compositionMode === 'legacyLattice') {
      st.rails = st.rails.filter(rail => rail.laneId == null)
    } else if (settings.compositionMode === 'laneSequencer') {
      st.rails = st.rails.filter(rail => rail.laneId != null)
    }
    st.pulses = []
    st.sequencer = null
    st.activeCompositionMode = settings.compositionMode
  }
  const legacyRuntimeEnabled = settings.compositionMode !== 'laneSequencer'
  const sequencerRuntimeEnabled = settings.compositionMode !== 'legacyLattice'
  const patternSignature = `${settings.lanePattern.id}:${settings.lanePattern.seed}:${settings.lanePattern.laneCount}:${settings.lanePattern.sequenceLength}:${settings.lanePattern.orientations.join(',')}:${settings.lanePattern.mirrored}`
  if (sequencerRuntimeEnabled) {
    if (!st.sequencer) st.sequencer = createNeonLatticeSequencerState(settings.lanePattern)
    if (st.sequencer.laneSignature !== patternSignature) {
      resetNeonLatticeSequencerState(st.sequencer, settings.lanePattern)
      st.rails = st.rails.filter(rail => rail.laneId == null)
      st.pulses = []
    }
  }
  for (const { command, event } of phraseCommands) {
    executePhraseCommand(st, command, settings, paletteRgb, audioTime, frame.bpm, event)
  }
  if (audioEvents.some(event => event.phraseScale != null) && settings.phraseFlashStrength > 0) {
    st.overlayColor = preset.palette.highlight
    st.overlayAlpha = Math.max(st.overlayAlpha, Math.min(0.35, settings.phraseFlashStrength * 0.35))
    st.overlayStartSec = audioTime
    st.overlayDuration = Math.max(0.08, 60 / Math.max(1, frame.bpm || 120) * 0.35)
  }

  const reactiveEnabled = settings.audioReactive
  const gate = settings.audioGate
  const rawBass   = reactiveEnabled ? applyAudioGate(frame.audio.bass, gate) : 0
  const rawMid    = reactiveEnabled ? applyAudioGate(frame.audio.mid, gate) : 0
  const rawHigh   = reactiveEnabled ? applyAudioGate(frame.audio.high, gate) : 0
  const rawEnergy = reactiveEnabled ? applyAudioGate(mi?.energy.instant ?? frame.audio.volume, gate) : 0
  const rawBuild  = reactiveEnabled ? applyAudioGate(mi?.energy.buildProgress ?? 0, gate) : 0
  const rawDrop   = reactiveEnabled ? applyAudioGate(mi?.energy.dropImpact ?? 0, gate) : 0

  st.smoothedBass   = smoothReactiveSignal(st.smoothedBass, rawBass, dt, settings.audioSmoothing)
  st.smoothedMid    = smoothReactiveSignal(st.smoothedMid, rawMid, dt, settings.audioSmoothing)
  st.smoothedHigh   = smoothReactiveSignal(st.smoothedHigh, rawHigh, dt, settings.audioSmoothing)
  st.smoothedEnergy = smoothReactiveSignal(st.smoothedEnergy, rawEnergy, dt, settings.audioSmoothing)
  st.smoothedBuild  = smoothReactiveSignal(st.smoothedBuild, rawBuild, dt, settings.audioSmoothing)
  st.smoothedDrop   = smoothReactiveSignal(st.smoothedDrop, rawDrop, dt, settings.audioSmoothing)

  // ── Bass Reactivity ────────────────────────────────────────────────────────
  // Never makes the engine disappear: 1.0 is the authored look and audio can
  // only add brightness above that floor.
  const bassEnergy = st.smoothedBass
  const bassBoost  = 1.0
    + params.bassReactivity
    * bassEnergy
    * 0.65
    * settings.bassBrightnessResponse

  // ── Effective section (manual > MI section > null) ─────────────────────────
  const miSectionType = mi?.section.type ?? null
  const effectiveSectionType = resolveEffectiveSection(manualSectionType, miSectionType)

  // ── Section behavior (replaces bare sectionSpawnMul) ─────────────────────
  const sb = resolveSectionBehavior(
    effectiveSectionType,
    mi?.energy.buildProgress ?? 0,
    mi?.energy.dropImpact    ?? 0,
    mi?.energy.tension       ?? 0,
    mi?.section.progress     ?? 0,
    st.prevSectionType,
  )
  // Blend every section modifier from a neutral value. This makes the
  // Section Dynamics control a true depth control instead of an on/off label.
  const sectionMix          = reactiveEnabled ? settings.sectionDynamics : 0
  const sectionRailSpawnMul = mixFromNeutral(1, sb.railSpawnMul, sectionMix)
  const sectionPulseMul     = mixFromNeutral(1, sb.pulseSpeedMul, sectionMix)
  const sectionGlowMul      = mixFromNeutral(1, sb.glowMul, sectionMix)
  const sectionBlockMul     = mixFromNeutral(1, sb.blockMul, sectionMix)
  const sectionCenterAdd    = sb.centerBiasAdd * sectionMix
  const sectionLifetimeMul  = mixFromNeutral(1, sb.lifetimeMul, sectionMix)
  const sectionDecayAdjust  = sb.decayAdjust * sectionMix
  const sectionShockMul     = sb.shockwavesAllowed ? 1 : (1 - sectionMix)

  // Engine-level routing turns the authored values into a responsive system:
  // frequency bands control object families, while MI energy/build/drop shape
  // density, motion and impact without erasing the preset's base design.
  const secSettings: NeonLatticeSettings = {
    ...settings,
    railDensity: clampUnit(
      settings.railDensity
      + st.smoothedEnergy * settings.energyDensityResponse * 0.28,
    ),
    pulseSpeed: Math.max(
      0.01,
      settings.pulseSpeed
      * sectionPulseMul
      * (1 + st.smoothedBuild * settings.buildMotionResponse * 0.45),
    ),
    bloom: Math.min(
      2,
      settings.bloom
      * sectionGlowMul
      * (1 + st.smoothedBass * (settings.bassBrightnessResponse * 0.30 + settings.modulationRoutes.bassToBloom * 0.45)),
    ),
    blockDensity: clampUnit(
      (settings.blockDensity + st.smoothedMid * settings.midBlockResponse * 0.34)
      * sectionBlockMul,
    ),
    centerBias: clampUnit(settings.centerBias + sectionCenterAdd),
    railLifetime: Math.max(0.5, settings.railLifetime * sectionLifetimeMul),
    shockwaveAmount: clampUnit(
      settings.shockwaveAmount * sectionShockMul
      + st.smoothedDrop * settings.dropImpactResponse * 0.38,
    ),
  }
  const effectiveDecay = Math.max(0.005, Math.min(0.98, (params.trailDecay ?? 0.08) + sectionDecayAdjust))

  // ── Camera motion update (paused during freeze) ───────────────────────────
  const cm = clampUnit(
    (settings.cameraMotion + st.smoothedBuild * settings.buildMotionResponse * 0.35)
    * (settings.compositionMode === 'laneSequencer' ? 0.15 : 1),
  )
  const ZOOM_BURST_DECAY = 0.12  // seconds for downbeat zoom-punch to fully decay
  if (cm > 0 && dt > 0 && !isFrozen) {
    const driftSeed = ((st.seedCounter + 7777) * 1009 + (audioTime * 10 | 0)) >>> 0
    const [dv] = prngNext(driftSeed)
    st.cameraDriftVX += (dv - 0.5) * cm * 0.0015 * dt
    st.cameraDriftVX *= Math.pow(0.88, dt * 60)
    st.cameraDriftX  += st.cameraDriftVX * dt
    const driftLimit  = 0.055 * cm
    st.cameraDriftX   = Math.max(-driftLimit, Math.min(driftLimit, st.cameraDriftX))
    // Short downbeat zoom burst decays linearly over ZOOM_BURST_DECAY seconds
    const burstAge   = Math.max(0, audioTime - st.cameraZoomBurstSec)
    const burstAlpha = Math.max(0, 1 - burstAge / ZOOM_BURST_DECAY)
    const zoomBurst  = st.cameraZoomBurst * burstAlpha
    const zoomTarget = 1.0 + bassEnergy * cm * 0.030 + zoomBurst
    st.cameraZoom   += (zoomTarget - st.cameraZoom) * Math.min(1, dt * 7)
    st.cameraRotation *= Math.pow(0.80, dt * 60)
    st.cameraRotation  = Math.max(-0.010 * cm, Math.min(0.010 * cm, st.cameraRotation))
  } else {
    st.cameraDriftX      = 0
    st.cameraDriftVX     = 0
    st.cameraZoom        = 1.0
    st.cameraRotation    = 0
    st.cameraZoomBurst   = 0
  }

  // ── Bar-based auto-reseed ──────────────────────────────────────────────────
  if (mi && settings.reseedInterval > 0 && mi.rhythm.barIndex >= 0) {
    const barsSince = mi.rhythm.barIndex - st.lastReseedBarIndex
    if (
      (st.lastReseedBarIndex < 0 && mi.rhythm.barIndex >= settings.reseedInterval) ||
      (st.lastReseedBarIndex >= 0 && barsSince >= settings.reseedInterval && mi.rhythm.downbeatHit)
    ) {
      if (legacyRuntimeEnabled) beginLayoutReseed(st, secSettings, paletteRgb, audioTime)
      if (sequencerRuntimeEnabled && st.sequencer) reseedNeonLatticePattern(st.sequencer, settings.lanePattern)
      // Precise bar index so guard fires exactly on interval, not 1 bar early/late
      st.lastReseedBarIndex = mi.rhythm.barIndex
    }
  }

  // ── Automatic blackout ─────────────────────────────────────────────────────
  const blackoutMode = settings.blackoutMode
  {
    // Detect section entry edges for blackout gating.
    // Uses sb.isEntryFrame (sectionType !== prevSectionType) set earlier this frame.
    const isEntryEdge    = sb.isEntryFrame && st.prevSectionType !== null
    const isPreDropEntry = isEntryEdge && effectiveSectionType === 'preDrop'
    const isFakeoutEntry = isEntryEdge && (mi?.semantics.fakeoutConfidence ?? 0) > 0.72
    const isDropEntry    = isEntryEdge && effectiveSectionType === 'drop'
    const barsInSec      = frame.bpm > 0 ? 60 / frame.bpm * 4 : 2.0

    // Drop entry: release / recover from any active pre-drop blackout immediately
    if (isDropEntry && blackoutMode !== 'none') {
      st.autoBlackoutEnd      = 0
      st.autoBlackoutFadeIn   = false
      st.strobeNextFlipSec    = audioTime - 1  // stop strobe
      if (st.overlayAlpha > 0) {
        // Compress remaining overlay to a quick 0.25 s fade-out from current alpha
        st.overlayStartSec  = audioTime
        st.overlayDuration  = 0.25
      }
    }

    // Initiate auto-blackout only on a qualified preDrop/fakeout ENTRY edge,
    // not while staying inside preDrop and not on the actual drop impact.
    if (blackoutMode !== 'none' && !isFrozen && st.autoBlackoutEnd <= audioTime) {
      if (isPreDropEntry || isFakeoutEntry) {
        switch (blackoutMode) {
          case 'instant': {
            // Short full-black gate; bounded duration
            st.overlayColor      = '#000000'
            st.overlayAlpha      = 1
            st.overlayStartSec   = audioTime
            st.overlayDuration   = Math.min(barsInSec * 0.4, 0.8)
            st.autoBlackoutEnd   = audioTime + Math.min(barsInSec * 3, 6.0)
            st.autoBlackoutFadeIn = false
            break
          }
          case 'fadeOut': {
            // Ramp black overlay in gradually (from 0 toward 0.85) over ~1 bar;
            // drop-entry recovery above compresses the fade-out to 0.25 s.
            const rampSecs        = Math.min(barsInSec, 3.0)
            st.overlayColor       = '#000000'
            st.overlayAlpha       = 0
            st.overlayStartSec    = audioTime
            st.overlayDuration    = 0       // not used during fade-in phase
            st.autoBlackoutFadeIn = true
            st.autoBlackoutFadeRate = 0.85 / rampSecs
            st.autoBlackoutEnd    = audioTime + Math.min(barsInSec * 3, 7.0)
            break
          }
          case 'strobe': {
            // Beat-quantized black gates (NOT white flashes); bounded window
            st.strobeNextFlipSec = audioTime
            st.strobeState       = false
            st.autoBlackoutEnd   = audioTime + Math.min(barsInSec, 2.0)
            break
          }
        }
      }
    }
  }

  // Dedicated compatibility input retained only for direct renderer tests until
  // the implementation is deleted in Patch 3. The live render contract and
  // central dispatch no longer carry this field.
  const legacyTrigger = params.neonLatticeTrigger
  if (legacyTrigger && legacyTrigger.seq !== st.lastConsumedSeq) {
    st.lastConsumedSeq = legacyTrigger.seq
    dispatchTrigger(st, legacyTrigger.type, audioTime, paletteRgb, secSettings, frame.bpm, W, H)
  }

  // ── Post-freeze burst (restrained — fires once on release) ────────────────
  if (legacyRuntimeEnabled && st.burstAfterFreeze && audioTime > st.frozenUntilSec) {
    st.burstAfterFreeze = false
    const strength = 0.58
    for (let i = 0; i < 2; i++) {
      if (st.rails.filter(r => r.vertical).length < MAX_VERT) {
        st.seedCounter++
        st.rails.push(makeVerticalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, strength))
      }
    }
    if (st.rails.filter(r => !r.vertical).length < MAX_HORIZ) {
      st.seedCounter++
      st.rails.push(makeHorizontalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, strength))
    }
  }

  // ── CyanStrike color override ──────────────────────────────────────────────
  const isCyanStrike = audioTime < st.cyanStrikeUntilSec

  // ── Event detection ────────────────────────────────────────────────────────
  let spawnKick      = false; let kickStrength      = 0.5
  let spawnSnare     = false; let snareStrength     = 0.5
  let spawnBeat      = false; let beatStrength      = 0.5
  let spawnHat       = false; let hatStrength       = 0.4
  let spawnFlux      = false; let fluxStrength      = 0.4
  let spawnComplex   = false
  let spawnDownbeat  = false; let downbeatStrength  = 0.7
  let spawnDrop      = false; let dropStrength      = 0.7
  let sequenceTriggerIndex: number | null = null

  if (frame.isPlaying && reactiveEnabled && mi !== null) {
    const routeAmount = (source: NeonLatticeDiscreteTriggerSource): number => {
      const amounts = settings.triggerRoutes
        .filter(route => route.enabled && route.source === source)
        .map(route => route.amount)
      return amounts.length > 0 ? Math.max(...amounts) : 0
    }

    for (const event of audioEvents) {
      const amount = routeAmount(event.source)
      switch (event.source) {
        case 'beat':
          spawnBeat = amount > 0
          beatStrength = event.strength * amount
          break
        case 'downbeat':
          spawnDownbeat = amount > 0
          downbeatStrength = event.strength * amount
          break
        case 'kick':
          spawnKick = amount > 0
          kickStrength = event.strength * amount
          break
        case 'snare':
          spawnSnare = amount > 0
          snareStrength = event.strength * amount
          break
        case 'hat':
          spawnHat = amount > 0
          hatStrength = event.strength * amount
          break
        case 'dropImpact':
          spawnDrop = amount > 0
          dropStrength = event.strength * amount
          break
      }

      for (const route of settings.triggerRoutes) {
        if (!route.enabled || route.source !== event.source || route.amount <= 0) continue
        const routedStrength = clampUnit(event.strength * route.amount)
        const activeLaneLimit = Math.max(1, Math.min(
          settings.lanePattern.laneCount,
          settings.chordSize + phraseProgress.activeLaneBonus,
        ))
        const chordSize = Math.max(1, Math.min(
          activeLaneLimit,
          Math.round((route.chordSize ?? settings.chordSize) + phraseProgress.chordSizeBonus),
        ))
        switch (route.action) {
          case 'advanceSequence':
            if (sequenceTriggerIndex == null) {
              sequenceTriggerIndex = Math.floor(event.beatIndex * phraseProgress.patternRateMultiplier)
            }
            break
          case 'emphasizedStep':
            spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, frame.bpm, event, {
              routeId: route.id,
              orientation: route.orientation,
              chordSize: Math.max(2, chordSize),
              strength: routedStrength,
              paletteRole: route.paletteRole ?? 'highlight',
              laneSpacingScale: phraseProgress.laneSpacingScale,
            })
            break
          case 'pillar':
            spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, frame.bpm, event, {
              routeId: route.id,
              orientation: route.orientation ?? 'vertical',
              chordSize,
              strength: routedStrength,
              paletteRole: route.paletteRole ?? 'primary',
              laneSpacingScale: phraseProgress.laneSpacingScale,
            })
            break
          case 'horizontalStrike':
            spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, frame.bpm, event, {
              routeId: route.id,
              orientation: route.orientation ?? 'horizontal',
              chordSize,
              strength: routedStrength,
              paletteRole: route.paletteRole ?? 'secondary',
              laneSpacingScale: phraseProgress.laneSpacingScale,
            })
            break
          case 'thinAccent':
            spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, frame.bpm, event, {
              routeId: route.id,
              orientation: route.orientation ?? settings.lanePattern.orientations[event.beatIndex % Math.max(1, settings.lanePattern.orientations.length)],
              chordSize: 1,
              strength: routedStrength * 0.7,
              paletteRole: route.paletteRole ?? 'accent',
            })
            break
          case 'fullChord':
            spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, frame.bpm, event, {
              routeId: route.id,
              orientation: route.orientation,
              chordSize: Math.max(chordSize, Math.min(settings.lanePattern.laneCount, 4)),
              strength: routedStrength,
              paletteRole: route.paletteRole ?? 'highlight',
              laneSpacingScale: phraseProgress.laneSpacingScale,
            })
            break
          case 'highlightStrike':
            spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, frame.bpm, event, {
              routeId: route.id,
              orientation: route.orientation,
              chordSize: Math.max(1, chordSize),
              strength: routedStrength,
              paletteRole: route.paletteRole ?? 'highlight',
            })
            break
          case 'lineSweep': {
            const sweepCount = Math.min(settings.lanePattern.laneCount, Math.max(2, chordSize + 2))
            spawnAuthoredLaneCluster(st, settings, paletteRgb, audioTime, frame.bpm, event, {
              routeId: route.id,
              orientation: route.orientation,
              chordSize: sweepCount,
              strength: routedStrength,
              paletteRole: route.paletteRole ?? 'accent',
              laneSpacingScale: phraseProgress.laneSpacingScale,
            })
            break
          }
          case 'blockCascade':
            dispatchTrigger(st, 'blockCascade', audioTime, paletteRgb, settings, frame.bpm, W, H)
            break
          case 'reseedPattern':
            if (st.sequencer) reseedNeonLatticePattern(st.sequencer, settings.lanePattern)
            if (legacyRuntimeEnabled) beginLayoutReseed(st, settings, paletteRgb, audioTime)
            break
          case 'runPhraseProgram':
            break
        }
      }
    }

    if (mi.frameId !== st.lastMiFrameId) {
      if (mi.energy.spectralFlux > 0.38 && (audioTime - st.lastFluxSec) > FLUX_DEBOUNCE) {
        spawnFlux = true
        fluxStrength = mi.energy.spectralFlux
      }
      if (mi.energy.complexity > 0.50 && (audioTime - st.lastComplexSec) > COMPLEX_DEBOUNCE) spawnComplex = true
    }
    st.lastMiFrameId = mi.frameId
    st.lastBeatIndex = mi.rhythm.beatIndex
    st.lastBarIndex = mi.rhythm.barIndex
    st.lastPhrase4Index = Math.floor(mi.rhythm.beatIndex / 4)
  } else if (frame.isPlaying && reactiveEnabled && legacyRuntimeEnabled) {
    // Fallback: analyser-only input — use elapsed-time debounces as rate limits
    const bass = rawBass
    const high = rawHigh
    const mid  = rawMid
    if (bass > 0.52 && bass > st.prevBass + 0.07 && (audioTime - st.lastKickSec)  > KICK_DEBOUNCE)  { spawnKick  = true; kickStrength  = Math.min(1, (bass - 0.52) * 3 + 0.4) }
    if (frame.beatHit && mid > 0.25 && !spawnKick && (audioTime - st.lastSnareSec) > SNARE_DEBOUNCE) { spawnSnare = true; snareStrength = Math.min(1, 0.3 + mid * 0.5) }
    if (!spawnKick && !spawnSnare && frame.beatHit && (audioTime - st.lastBeatSec)  > BEAT_DEBOUNCE) { spawnBeat  = true; beatStrength  = 0.3 + rawEnergy * 0.4 }
    if (high > 0.45 && high > st.prevHigh + 0.05 && (audioTime - st.lastHatSec)    > HAT_DEBOUNCE)  { spawnHat   = true; hatStrength   = Math.min(1, (high - 0.45) * 4 + 0.3) }
    if (mid  > 0.42 && mid  > st.prevMid  + 0.08 && (audioTime - st.lastFluxSec)   > FLUX_DEBOUNCE) { spawnFlux  = true; fluxStrength  = Math.min(1, mid * 1.2) }
    if (frame.beatHit) {
      sequenceTriggerIndex = st.beatHitCount
      st.beatHitCount++
      if (st.beatHitCount % 4 === 0 && bass > 0.40 && (audioTime - st.lastDownbeatSec) > DOWNBEAT_DEBOUNCE) {
        spawnDownbeat = true; downbeatStrength = 0.5 + bass * 0.4
      }
    }
    // Fallback drop: approximate as a strong bass transient coinciding with estimated downbeat
    if (spawnDownbeat && bass > 0.65 && (audioTime - st.lastDropSec) > DOWNBEAT_DEBOUNCE) {
      spawnDrop = true; dropStrength = Math.min(1, 0.4 + bass * 0.6)
    }
    st.prevBass = bass
    st.prevHigh = high
    st.prevMid  = mid
  } else if (frame.isPlaying && legacyRuntimeEnabled && frame.beatHit && (audioTime - st.lastBeatSec) > BEAT_DEBOUNCE) {
    // Reactive Engine off still keeps the BPM-authored lattice alive. It uses
    // neutral, deterministic beat sequencing instead of analyser amplitudes.
    spawnBeat = true
    beatStrength = 0.55
    sequenceTriggerIndex = st.beatHitCount
    st.beatHitCount++
    if (st.beatHitCount % 4 === 0 && (audioTime - st.lastDownbeatSec) > DOWNBEAT_DEBOUNCE) {
      spawnDownbeat = true
      downbeatStrength = 0.65
    }
  }

  // Engine-specific routing depth. A zeroed route suppresses that family
  // completely; intermediate values scale event strength continuously.
  if (spawnKick) {
    kickStrength *= settings.kickRailResponse
    spawnKick = kickStrength > 0.01
  }
  if (spawnSnare) {
    snareStrength *= settings.snareRailResponse
    spawnSnare = snareStrength > 0.01
  }
  if (spawnBeat) {
    beatStrength *= reactiveEnabled ? settings.beatPulseResponse : 1
    spawnBeat = beatStrength > 0.01
  }
  if (spawnDownbeat) {
    downbeatStrength *= reactiveEnabled ? settings.beatPulseResponse : 1
    spawnDownbeat = downbeatStrength > 0.01
  }
  if (spawnDrop) {
    dropStrength *= settings.dropImpactResponse
    spawnDrop = dropStrength > 0.01
  }

  if (spawnDrop) st.lastDropSec = audioTime

  if (!isFrozen && sequencerRuntimeEnabled && st.sequencer && sequenceTriggerIndex != null) {
    const sequenceTrigger = resolveSequenceTrigger(
      settings.lanePattern,
      st.sequencer,
      sequenceTriggerIndex,
      settings.customSegments,
    )
    if (sequenceTrigger && sequenceTrigger.lanes.length > 0) {
      const maxSegments = neonLatticeQualityLimits(settings.qualityTier).maxSegments
      for (const lane of sequenceTrigger.lanes) {
        if (st.rails.length >= maxSegments && !st.rails.some(rail => rail.laneId === lane.id)) break
        retriggerSequencedLane(
          st.rails,
          lane,
          settings,
          paletteRgb,
          audioTime,
          frame.bpm,
          sequenceTrigger.strength,
          sequenceTrigger.paletteRole,
        )
      }
    }
  }
  st.audioDirector.diagnostics.currentSequenceStep = st.sequencer?.currentStep ?? -1

  if (!isFrozen) {
  // ── Orientation-independent autonomous spawning ───────────────────────────
  const vertRails  = st.rails.filter(r => r.orientation === 'vertical')
  const horizRails = st.rails.filter(r => r.orientation === 'horizontal')
  const diagUpRails = st.rails.filter(r => r.orientation === 'diagonalUp')
  const diagDownRails = st.rails.filter(r => r.orientation === 'diagonalDown')
  const diagonalEnabled = secSettings.orientationWeights.diagonalUp > 0 || secSettings.orientationWeights.diagonalDown > 0
  const { targetVert: legacyTargetVert, targetHoriz: legacyTargetHoriz } = resolveRailTargets(secSettings.railDensity, secSettings.verticalBias)
  const targetScale = Math.max(0.1, sectionRailSpawnMul)
  const weightedTotal = Math.max(0, Math.round(secSettings.railDensity * 22 * targetScale))
  const targetVert = Math.min(MAX_VERT, diagonalEnabled
    ? Math.round(weightedTotal * secSettings.orientationWeights.vertical)
    : Math.round(legacyTargetVert * targetScale))
  const targetHoriz = Math.min(MAX_HORIZ, diagonalEnabled
    ? Math.round(weightedTotal * secSettings.orientationWeights.horizontal)
    : Math.round(legacyTargetHoriz * targetScale))
  const targetDiagUp = Math.min(10, Math.round(weightedTotal * secSettings.orientationWeights.diagonalUp))
  const targetDiagDown = Math.min(10, Math.round(weightedTotal * secSettings.orientationWeights.diagonalDown))

  if (legacyRuntimeEnabled && spawnKick && targetVert > 0) {
    const toSpawn = Math.min(Math.max(0, targetVert - vertRails.length), 2)
    for (let i = 0; i < toSpawn; i++) {
      st.seedCounter++
      st.rails.push(makeVerticalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, kickStrength * bassBoost))
    }
    st.lastKickSec = audioTime
  }

  if (legacyRuntimeEnabled && spawnSnare && targetHoriz > 0) {
    const toSpawn = Math.min(Math.max(0, targetHoriz - horizRails.length), 2)
    for (let i = 0; i < toSpawn; i++) {
      st.seedCounter++
      st.rails.push(makeHorizontalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, snareStrength * bassBoost))
    }
    st.lastSnareSec = audioTime
  }

  if (legacyRuntimeEnabled && spawnBeat && (targetVert > 0 || targetHoriz > 0 || targetDiagUp > 0 || targetDiagDown > 0)) {
    st.seedCounter++
    const orientation = selectWeightedOrientation(secSettings.orientationWeights, st.seedCounter)
    if (orientation === 'vertical' && vertRails.length < targetVert) {
      st.rails.push(makeVerticalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, beatStrength * 0.7))
    } else if (orientation === 'horizontal' && horizRails.length < targetHoriz) {
      st.rails.push(makeHorizontalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, beatStrength * 0.7))
    } else if (orientation === 'diagonalUp' && diagUpRails.length < targetDiagUp) {
      st.rails.push(makeDiagonalRail(st.seedCounter, 'diagonalUp', secSettings, audioTime, st.rails, paletteRgb, beatStrength * 0.7))
    } else if (orientation === 'diagonalDown' && diagDownRails.length < targetDiagDown) {
      st.rails.push(makeDiagonalRail(st.seedCounter, 'diagonalDown', secSettings, audioTime, st.rails, paletteRgb, beatStrength * 0.7))
    }
    st.lastBeatSec = audioTime
  }

  const trg = settings.trigger

  // ── Snap-slot deduplication — skipped when BPM/snapDivision unknown ────────
  // When snapActive=false, per-event debounce timestamps gate rate instead;
  // this prevents BPM=0 permanently locking slot 0 and suppressing all events.
  const snapActive  = isSnapActive(frame.bpm, settings.snapDivision)
  const pulseSlot   = snapActive ? resolveSnapSlot(audioTime, frame.bpm, settings.snapDivision) : -1
  const blockSlot   = pulseSlot

  // ── Pulse spawning (trigger selector → exactly its matching audio event) ────
  // Each trigger type maps 1:1 to one event source; 'beat' uses generic beat,
  // 'drop' uses qualified dropImpact — neither is aliased to other events.
  if (trg !== 'none') {
    const snapOk   = !snapActive || pulseSlot !== st.lastPulseSnapSlot
    let pulseFired = false

    if (resolveTriggerFires(trg, 'kick') && spawnKick && snapOk) {
      const vrails = st.rails.filter(r => r.orientation === 'vertical')
      if (vrails.length > 0 && st.pulses.length < MAX_PULSES) {
        st.seedCounter++
        const rail = vrails[st.seedCounter % vrails.length]
        const dir: 1 | -1 = kickStrength > 0.5 ? 1 : -1
        st.pulses.push(makePulseOnRail(rail, dir, secSettings, audioTime, paletteRgb, Math.min(1, kickStrength * bassBoost), st.seedCounter, params.motion))
        pulseFired = true
      }
    } else if (resolveTriggerFires(trg, 'snare') && spawnSnare && snapOk) {
      const hrails = st.rails.filter(r => r.orientation === 'horizontal')
      if (hrails.length > 0 && st.pulses.length < MAX_PULSES - 1) {
        st.seedCounter++
        const rail = hrails[st.seedCounter % hrails.length]
        st.pulses.push(makePulseOnRail(rail, 1,  secSettings, audioTime, paletteRgb, Math.min(1, snareStrength * bassBoost), st.seedCounter,     params.motion))
        st.pulses.push(makePulseOnRail(rail, -1, secSettings, audioTime, paletteRgb, Math.min(1, snareStrength * bassBoost), st.seedCounter + 1, params.motion))
        pulseFired = true
      }
    } else if (resolveTriggerFires(trg, 'beat') && spawnBeat && snapOk) {
      const allRails = st.rails
      if (allRails.length > 0 && st.pulses.length < MAX_PULSES) {
        st.seedCounter++
        const [bv] = prngNext(st.seedCounter)
        const preferredOrientation = selectWeightedOrientation(settings.orientationWeights, st.seedCounter)
        const pool = allRails.filter(r => r.orientation === preferredOrientation)
        const candidates = pool.length > 0 ? pool : allRails
        const rail = candidates[st.seedCounter % candidates.length]
        const dir: 1 | -1 = bv < 0.5 ? 1 : -1
        st.pulses.push(makePulseOnRail(rail, dir, secSettings, audioTime, paletteRgb, Math.min(1, beatStrength * bassBoost * 0.85), st.seedCounter, params.motion))
        pulseFired = true
      }
    } else if (resolveTriggerFires(trg, 'downbeat') && spawnDownbeat && snapOk) {
      const allRails = st.rails
      if (allRails.length > 0 && st.pulses.length < MAX_PULSES) {
        st.seedCounter++
        const rail = allRails[st.seedCounter % allRails.length]
        st.pulses.push(makePulseOnRail(rail, 1, secSettings, audioTime, paletteRgb, Math.min(1, downbeatStrength * bassBoost), st.seedCounter, params.motion))
        pulseFired = true
      }
    } else if (resolveTriggerFires(trg, 'drop') && spawnDrop && snapOk) {
      const allRails = st.rails
      if (allRails.length > 0 && st.pulses.length < MAX_PULSES) {
        st.seedCounter++
        const rail = allRails[st.seedCounter % allRails.length]
        st.pulses.push(makePulseOnRail(rail, 1, secSettings, audioTime, paletteRgb, Math.min(1, dropStrength * bassBoost), st.seedCounter, params.motion))
        if (st.pulses.length < MAX_PULSES) {
          const rail2 = allRails[(st.seedCounter + 1) % allRails.length]
          st.pulses.push(makePulseOnRail(rail2, -1, secSettings, audioTime, paletteRgb, Math.min(1, dropStrength * bassBoost), st.seedCounter + 1, params.motion))
        }
        pulseFired = true
      }
    }

    if (pulseFired && snapActive) st.lastPulseSnapSlot = pulseSlot
  }

  // ── Block spawning (same primary trigger event; secondary signals as pattern hints) ──
  // Hat / spectral flux / complexity are no longer primary trigger sources —
  // they are only consulted for pattern selection within the primary event.
  const blockConcurrentTarget = settings.compositionMode === 'laneSequencer' ? 0 : Math.round(secSettings.blockDensity * MAX_BLOCKS)

  function spawnBlocks(pattern: 'verticalRain' | 'diagonalStair' | 'centerOutward' | 'checker' | 'horizontalScan', strength: number): void {
    if (!st || st.blocks.length >= blockConcurrentTarget) return
    st.seedCounter++
    // Probability gate: seeded check proportional to blockDensity
    const [pv] = prngNext(st.seedCounter + 31)
    if (pv > secSettings.blockDensity) return
    // Cell count scales with density
    const cellStrength = Math.min(1, strength * Math.max(0.15, secSettings.blockDensity))
    const cells = spawnBlockPattern(pattern, st.seedCounter, cellStrength)
    for (const { col, row } of cells) {
      if (st.blocks.length >= Math.min(MAX_BLOCKS, blockConcurrentTarget)) break
      st.blocks.push(makeBlock(col, row, audioTime, secSettings.blockHold, accentRgb, Math.min(1, strength * bassBoost)))
    }
  }

  if (trg !== 'none') {
    const snapBlockOk = !snapActive || blockSlot !== st.lastBlockSnapSlot
    let   blockFired  = false
    type Pat = 'verticalRain' | 'diagonalStair' | 'centerOutward' | 'checker' | 'horizontalScan'
    let   blockPat: Pat | null = null
    let   blockStr              = 0.5

    if (resolveTriggerFires(trg, 'kick') && spawnKick && snapBlockOk) {
      blockPat = spawnFlux ? 'diagonalStair' : 'verticalRain'
      blockStr = kickStrength
    } else if (resolveTriggerFires(trg, 'snare') && spawnSnare && snapBlockOk) {
      blockPat = spawnFlux ? 'checker' : 'diagonalStair'
      blockStr = snareStrength
    } else if (resolveTriggerFires(trg, 'beat') && spawnBeat && snapBlockOk) {
      blockPat = spawnHat ? 'verticalRain' : (spawnFlux ? 'checker' : 'horizontalScan')
      blockStr = beatStrength * 0.8
    } else if (resolveTriggerFires(trg, 'downbeat') && spawnDownbeat && snapBlockOk) {
      blockPat = spawnComplex ? 'centerOutward' : 'checker'
      blockStr = downbeatStrength
    } else if (resolveTriggerFires(trg, 'drop') && spawnDrop && snapBlockOk) {
      blockPat = spawnFlux ? 'diagonalStair' : (spawnComplex ? 'centerOutward' : 'checker')
      blockStr = dropStrength
    }

    if (blockPat !== null) {
      spawnBlocks(blockPat, blockStr)
      blockFired = true
    }
    if (blockFired && snapActive) st.lastBlockSnapSlot = blockSlot
  }

  // ── Shockwave spawning (downbeats + section-entry drop) ────────────────────
  const shockAmt  = settings.compositionMode === 'laneSequencer' ? 0 : secSettings.shockwaveAmount
  const shockMax  = Math.max(1, Math.round(shockAmt * MAX_SHOCKWAVES))
  if (spawnDownbeat && shockAmt > 0 && st.shockwaves.length < shockMax) {
    // Probability gate: higher amount = higher spawn chance
    const [shockR] = prngNext(st.seedCounter + 5501)
    if (shockR < shockAmt) {
      const strength = Math.min(1, downbeatStrength * bassBoost * shockAmt)
      st.shockwaves.push(makeShockwave(0.5, 0.5, audioTime, strength, secSettings.pulseSpeed * shockAmt, paletteRgb.primary))
      st.lastDownbeatSec = audioTime
    }
    // Downbeat zoom burst — short spike that decays over ZOOM_BURST_DECAY seconds
    if (cm > 0) {
      st.cameraZoomBurst    = downbeatStrength * cm * 0.035
      st.cameraZoomBurstSec = audioTime
    }
  }

  // ── Section entry transitions (fires once per qualified section edge) ──────
  // "Qualified" = transitioning from a real previous section (not from null startup).
  const qualifiedEntry = sectionMix > 0.01 && sb.isEntryFrame && st.prevSectionType !== null
  if (qualifiedEntry) {
    if (effectiveSectionType === 'drop') {
      // Immediate release: spawn 2 foreground vertical rails + shockwave burst
      for (let i = 0; legacyRuntimeEnabled && i < 2; i++) {
        if (st.rails.filter(r => r.orientation === 'vertical').length < MAX_VERT) {
          st.seedCounter++
          st.rails.push(makeVerticalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, 0.9))
        }
      }
      if (shockAmt > 0 && st.shockwaves.length < shockMax) {
        st.shockwaves.push(makeShockwave(0.5, 0.5, audioTime, Math.min(1, 0.9 * shockAmt), secSettings.pulseSpeed * shockAmt, paletteRgb.primary))
      }
    } else if (effectiveSectionType === 'breakdown') {
      // Sparse restart: remove foreground blocks and high-depth pulses
      st.blocks  = []
      st.pulses  = st.pulses.filter(p => p.depth < 0.5)
    } else if (effectiveSectionType === 'intro') {
      // Clean slate: clear all accent objects for a sparse opening
      resetAccentObjects(st)
    }
  }
  } // end !isFrozen spawn block

  // Remove expired geometry before bounded O(n²) intersection work, then
  // enforce one shared segment budget across legacy and sequencer ownership.
  st.rails = st.rails.filter(rail => !isRailExpired(rail, audioTime))
  pruneSegmentBudget(st, settings)

  // ── Advance pulses + handle intersections (skipped during freeze) ─────────
  if (!isFrozen) {
    const flareAmount  = clampUnit(
      settings.flareAmount
      + st.smoothedHigh * settings.highFlareResponse * 0.35,
    )
    const flareTarget  = Math.min(qualityLimits.maxFlares, Math.max(0, Math.round(flareAmount * MAX_FLARES)))
    const { newFlares, newPulses } = updatePulses(st, dt, audioTime, paletteRgb.primary, secSettings, flareAmount, flareTarget, settings.depth)
    for (const f of newFlares) {
      if (st.flares.length < flareTarget) st.flares.push(f)
    }
    for (const p of newPulses) {
      if (st.pulses.length < qualityLimits.maxPulses) st.pulses.push(p)
    }
    if (st.pulses.length > qualityLimits.maxPulses) {
      st.limitedEvents += st.pulses.length - qualityLimits.maxPulses
      st.pulses = st.pulses.slice(-qualityLimits.maxPulses)
    }
    if (st.flares.length > qualityLimits.maxFlares) {
      st.limitedEvents += st.flares.length - qualityLimits.maxFlares
      st.flares = st.flares.slice(-qualityLimits.maxFlares)
    }
  }

  // ── Expire dead objects ────────────────────────────────────────────────────
  st.rails      = st.rails.filter(r => !isRailExpired(r, audioTime))
  st.pulses     = st.pulses.filter(p => !isPulseExpired(p, audioTime))
  st.flares     = st.flares.filter(f => !isFlareExpired(f, audioTime))
  st.blocks     = st.blocks.filter(b => !isBlockExpired(b, audioTime))
  st.shockwaves = st.shockwaves.filter(s => !isShockwaveExpired(s, audioTime))

  // ── Advance rail morph animations ─────────────────────────────────────────
  if (!isFrozen) {
    for (const rail of st.rails) {
      advanceRailMorph(rail, dt)
    }
  }

  // ── Trail canvas: decay → blocks → pulses → rails ─────────────────────────
  const tCtx = st.trailCanvas.getContext('2d')
  if (!tCtx) return

  const drawIntensity = Math.min(1.5, params.intensity * bassBoost)

  if (!isFrozen) {
    applyTrailDecay(tCtx, W, H, effectiveDecay, settings.decayStyle, dt, audioTime)
  }

  tCtx.lineCap  = 'round'
  tCtx.lineJoin = 'round'

  // Blocks (behind rails) — dimmed by depth plane
  for (const block of st.blocks) {
    drawBlock(tCtx, block, W, H, audioTime - block.birthSec, drawIntensity, settings.depth)
  }

  // Pulses — depth-modulated alpha so background pulses are dimmer
  if (!isFrozen) {
    for (const pulse of st.pulses) {
      const pdm = resolveDepthModifiers(settings.depth, pulse.depth)
      drawPulse(tCtx, pulse, W, H, audioTime - pulse.birthSec, drawIntensity * pdm.alphaMul, isCyanStrike ? strikeRgb : undefined)
    }
  }

  // Rails — background (depth≈0) drawn first, foreground (depth≈1) drawn last;
  // per-rail depth dimming, width scaling, and parallax shift applied.
  const sortedRails = st.rails.slice().sort((a, b) => a.depth - b.depth)
  for (const rail of sortedRails) {
    const age  = audioTime - rail.birthSec
    const la   = rail.envelope
      ? sequencedEnvelopeAlpha(rail, audioTime, frame.bpm)
      : railLifetimeAlpha(age, rail.lifetime)
    const dm   = resolveDepthModifiers(settings.depth, rail.depth)
    const pxOff = resolveCameraParallaxShift(rail.depth, st.cameraDriftX, settings.parallax)
    const needsShift = Math.abs(pxOff) > 0.0005
    if (needsShift) tCtx.save()
    if (needsShift) tCtx.translate(pxOff * W, 0)
    drawRail(
      tCtx,
      rail,
      W,
      H,
      la * dm.alphaMul,
      drawIntensity * dm.intensityMul,
      dm.widthMul * (1 + st.smoothedBass * settings.modulationRoutes.bassToWidth * 0.45),
      settings,
      resolveLineFlickerMultiplier(rail.id, audioTime, settings.lineFlicker),
      isCyanStrike ? strikeRgb : undefined,
    )
    if (needsShift) tCtx.restore()
  }

  // ── Main output: background → trail (camera-transformed) → flares → shockwaves → bloom → overlay ─
  ctx.globalAlpha              = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, W, H)

  // Single camera transform wraps trail, flares, shockwaves, and bloom so all
  // scene elements move together — preventing rail/flare intersection misalignment.
  const hasCamera = Math.abs(st.cameraDriftX) > 0.0005 || Math.abs(st.cameraZoom - 1) > 0.0005 || Math.abs(st.cameraRotation) > 0.0001
  if (hasCamera) {
    ctx.save()
    ctx.translate(W * 0.5, H * 0.5)
    ctx.rotate(st.cameraRotation)
    ctx.scale(st.cameraZoom, st.cameraZoom)
    ctx.translate(-W * 0.5 + st.cameraDriftX * W, -H * 0.5)
  }

  ctx.drawImage(st.trailCanvas, 0, 0)

  // Flares drawn under the same camera transform; per-depth parallax applied so
  // a flare at a rail intersection receives the same offset as that rail.
  const sprite = getFlareSprite()
  for (const flare of st.flares) {
    const pxOff      = resolveCameraParallaxShift(flare.depth, st.cameraDriftX, settings.parallax)
    const needsShift = Math.abs(pxOff) > 0.0005
    if (needsShift) { ctx.save(); ctx.translate(pxOff * W, 0) }
    drawFlare(ctx, flare, W, H, sprite, audioTime - flare.birthSec, drawIntensity, secSettings.bloom * params.glow)
    if (needsShift) ctx.restore()
  }

  // Shockwaves under the same camera transform
  for (const sw of st.shockwaves) {
    drawShockwave(ctx, sw, W, H, audioTime - sw.birthSec, drawIntensity)
  }

  // Bloom under camera transform (screen-blend downscaled trail)
  applyBloom(
    ctx,
    st.trailCanvas,
    st.bloomCanvas,
    secSettings.bloom * params.glow * Math.min(1.5, bassBoost),
    secSettings.bloomGain,
    W,
    H,
  )

  if (hasCamera) ctx.restore()

  // ── Strobe (auto-blackout mode 'strobe') — black gating, NOT white ────────
  if (blackoutMode === 'strobe' && st.autoBlackoutEnd > audioTime) {
    if (audioTime >= st.strobeNextFlipSec) {
      st.strobeState       = !st.strobeState
      st.strobeNextFlipSec = audioTime + 0.065  // ~15 Hz
    }
    if (st.strobeState) {
      ctx.save()
      ctx.globalAlpha              = 0.92
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }
  }

  // ── Whiteout / blackout overlay (fade-out or fade-in depending on mode) ───
  if (st.autoBlackoutFadeIn) {
    // fadeOut mode: ramp overlay alpha up toward 0.85 each frame
    st.overlayAlpha = Math.min(0.85, st.overlayAlpha + st.autoBlackoutFadeRate * dt)
    if (st.overlayAlpha > 0.002) {
      ctx.save()
      ctx.globalAlpha              = st.overlayAlpha
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = st.overlayColor
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }
    // Stop ramping if the auto-blackout window expired (drop entry clears it)
    if (st.autoBlackoutEnd <= audioTime) st.autoBlackoutFadeIn = false
  } else if (st.overlayAlpha > 0) {
    // Normal fade-out (whiteout, instant blackout, or post-drop recovery)
    const age   = audioTime - st.overlayStartSec
    const alpha = st.overlayAlpha * resolveOverlayAlpha(age, st.overlayDuration)
    if (alpha > 0.002) {
      ctx.save()
      ctx.globalAlpha              = alpha
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = st.overlayColor
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    } else {
      st.overlayAlpha = 0
    }
  }

  // Track section type so the next frame can detect entry edges
  st.prevSectionType = effectiveSectionType
}

// ── Test-only state snapshot ───────────────────────────────────────────────────
// Returns a shallow frozen snapshot of the per-canvas renderer state.
// NEVER used in production code paths. Exposed so renderer-path tests can
// verify internal state without holding a mutable reference.

export interface NeonLatticeSnapshot {
  readonly railCount:           number
  readonly pulseCount:          number
  readonly flareCount:          number
  readonly blockCount:          number
  readonly shockwaveCount:      number
  readonly seedCounter:         number
  readonly lastReseedBarIndex:  number
  readonly overlayAlpha:        number
  readonly overlayColor:        string
  readonly autoBlackoutEnd:     number
  readonly autoBlackoutFadeIn:  boolean
  readonly cyanStrikeUntilSec:  number
  readonly cameraZoomBurst:     number
  readonly frozenUntilSec:      number
  readonly prevSectionType:     ReactSectionType | null
  readonly lastMiFrameId:       number
  readonly lastBeatIndex:       number
  readonly lastBarIndex:        number
  readonly cameraZoom:          number
  readonly lastW:               number
  readonly lastH:               number
  readonly wasPlaying:          boolean
  readonly strobeState:         boolean
  readonly autoBlackoutFadeRate: number
  readonly activeCompositionMode: NeonLatticeSettings['compositionMode']
  readonly orientationCounts: Readonly<Record<'vertical' | 'horizontal' | 'diagonalUp' | 'diagonalDown' | 'custom', number>>
  readonly invalidSegmentsDiscarded: number
  readonly intersectionCount: number
  readonly duplicateIntersectionsSuppressed: number
  readonly routedPulseCount: number
  readonly preventedRoutingLoops: number
  readonly droppedOrLimitedEvents: number
  readonly qualityTier: NeonLatticeSettings['qualityTier']
  readonly resetReason: string | null
  readonly currentPatternId: string | null
  readonly activeLaneCount: number
  readonly currentSequenceStep: number
  readonly activeEnvelopeCount: number
  readonly lastConsumedAudioEvent: string | null
  readonly skippedDuplicateEvent: string | null
  readonly lastPhraseBoundaryConsumed: NeonLatticePhraseScale | null
  readonly boundaryPriorityDecision: string | null
  readonly lastPhraseActionExecuted: string | null
  readonly phraseResetReason: string | null
  readonly activeTemporaryOverrides: readonly string[]
  readonly smoothedBass: number
  readonly smoothedEnergy: number
  /** Frozen shallow copies of every rail (safe to inspect morph fields). */
  readonly rails:               ReadonlyArray<Readonly<NeonRail>>
}

export function __getNeonLatticeState(ctx: CanvasRenderingContext2D): NeonLatticeSnapshot | null {
  const st = stateMap.get(ctx)
  if (!st) return null
  return Object.freeze({
    railCount:           st.rails.length,
    pulseCount:          st.pulses.length,
    flareCount:          st.flares.length,
    blockCount:          st.blocks.length,
    shockwaveCount:      st.shockwaves.length,
    seedCounter:         st.seedCounter,
    lastReseedBarIndex:  st.lastReseedBarIndex,
    overlayAlpha:        st.overlayAlpha,
    overlayColor:        st.overlayColor,
    autoBlackoutEnd:     st.autoBlackoutEnd,
    autoBlackoutFadeIn:  st.autoBlackoutFadeIn,
    cyanStrikeUntilSec:  st.cyanStrikeUntilSec,
    cameraZoomBurst:     st.cameraZoomBurst,
    frozenUntilSec:      st.frozenUntilSec,
    prevSectionType:     st.prevSectionType,
    lastMiFrameId:       st.lastMiFrameId,
    lastBeatIndex:       st.lastBeatIndex,
    lastBarIndex:        st.lastBarIndex,
    cameraZoom:          st.cameraZoom,
    lastW:               st.lastW,
    lastH:               st.lastH,
    wasPlaying:          st.wasPlaying,
    strobeState:         st.strobeState,
    autoBlackoutFadeRate: st.autoBlackoutFadeRate,
    activeCompositionMode: st.activeCompositionMode,
    orientationCounts: Object.freeze({
      vertical: st.rails.filter(rail => rail.orientation === 'vertical').length,
      horizontal: st.rails.filter(rail => rail.orientation === 'horizontal').length,
      diagonalUp: st.rails.filter(rail => rail.orientation === 'diagonalUp').length,
      diagonalDown: st.rails.filter(rail => rail.orientation === 'diagonalDown').length,
      custom: st.rails.filter(rail => rail.orientation === 'custom').length,
    }),
    invalidSegmentsDiscarded: st.invalidSegmentsDiscarded,
    intersectionCount: st.intersectionCount,
    duplicateIntersectionsSuppressed: st.duplicateIntersectionsSuppressed,
    routedPulseCount: st.routedPulseCount,
    preventedRoutingLoops: st.preventedRoutingLoops,
    droppedOrLimitedEvents: st.limitedEvents,
    qualityTier: st.qualityTier,
    resetReason: st.lastResetReason,
    currentPatternId: st.sequencer?.patternId ?? null,
    activeLaneCount: st.sequencer?.lanes.length ?? 0,
    currentSequenceStep: st.sequencer?.currentStep ?? -1,
    activeEnvelopeCount: st.rails.filter(rail => rail.envelope != null).length,
    lastConsumedAudioEvent: st.audioDirector.diagnostics.lastConsumedAudioEvent,
    skippedDuplicateEvent: st.audioDirector.diagnostics.skippedDuplicateEvent,
    lastPhraseBoundaryConsumed: st.audioDirector.diagnostics.lastPhraseBoundaryConsumed,
    boundaryPriorityDecision: st.audioDirector.diagnostics.boundaryPriorityDecision,
    lastPhraseActionExecuted: st.audioDirector.diagnostics.lastPhraseActionExecuted,
    phraseResetReason: st.audioDirector.diagnostics.phraseResetReason,
    activeTemporaryOverrides: Object.freeze([...st.audioDirector.diagnostics.activeTemporaryOverrides]),
    smoothedBass: st.smoothedBass,
    smoothedEnergy: st.smoothedEnergy,
    rails:               Object.freeze(st.rails.map(r => Object.freeze({ ...r }))),
  })
}
