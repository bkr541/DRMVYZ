import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import type { ReactPreset, NeonLatticeTriggerType, NeonLatticeSettings, NeonLatticeDecayStyle, NeonLatticeTrigger, ReactSectionType } from '../ReactTypes'
import { DEFAULT_NEON_LATTICE_SETTINGS } from '../ReactTypes'
import {
  type NeonRail,
  type NeonPulse,
  type NeonFlare,
  type NeonBlock,
  type NeonShockwave,
  type NeonPaletteRgb,
  type PulseRoute,
  makeVerticalRail,
  makeHorizontalRail,
  makePulseOnRail,
  makeFlare,
  makeBlock,
  makeShockwave,
  spawnBlockPattern,
  routePulseAtIntersection,
  findNextIntersection,
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

// ── Ctx2D union ───────────────────────────────────────────────────────────────

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

// ── Per-context renderer state ────────────────────────────────────────────────

interface NeonLatticeState {
  // rails / canvas
  rails:        NeonRail[]
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
  lastConsumedSeq:    number      // renderer only consumes each seq once
  overlayAlpha:       number      // 0 = inactive, >0 = drawing overlay
  overlayColor:       string      // '#ffffff' | '#000000'
  overlayStartSec:    number
  overlayDuration:    number
  frozenUntilSec:     number      // trail freeze; 0 = not frozen
  burstAfterFreeze:   boolean     // emit railBurst when freeze ends
  cyanStrikeUntilSec: number      // force cyan color on rails; 0 = off
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
  // New deterministic seed epoch — never resets to 0 or 1
  const rawSeed  = (st.seedCounter + 1000 + ((audioTime * 1000 | 0) % 997)) >>> 0
  st.seedCounter = rawSeed === 0 ? 2 : rawSeed

  const { targetVert, targetHoriz } = resolveRailTargets(settings.railDensity, settings.verticalBias)
  let surplusVert  = Math.max(0, st.rails.filter(r =>  r.vertical).length - targetVert)
  let surplusHoriz = Math.max(0, st.rails.filter(r => !r.vertical).length - targetHoriz)

  // Retire at most 2 surplus rails; they expire just after their morph completes
  let retiralsLeft = 2
  let rng          = st.seedCounter

  for (const rail of st.rails) {
    rng = Math.max(1, (rng * 1009 + 7) >>> 0)

    // Snapshot current position as morph start
    rail.morphStartPos       = rail.pos
    rail.morphStartSpanStart = rail.spanStart
    rail.morphStartSpanEnd   = rail.spanEnd
    rail.morphProgress       = 0

    // Stagger morph durations so rails arrive at different times (wave feel)
    const [durR] = prngNext(rng)
    rail.morphDuration = MORPH_DURATION_MIN + durR * (MORPH_DURATION_MAX - MORPH_DURATION_MIN)

    // Compute a new target using a per-rail seed derived from the epoch
    const targetSeed = (rng ^ (st.seedCounter >>> 3)) >>> 0 || 1
    if (rail.vertical) {
      const t = computeVertRailMorphTarget(rail.pos, targetSeed, settings.centerBias)
      rail.morphTargetPos       = t.targetPos
      rail.morphTargetSpanStart = t.targetSpanStart
      rail.morphTargetSpanEnd   = t.targetSpanEnd
    } else {
      const t = computeHorizRailMorphTarget(rail.pos, targetSeed, settings.centerBias)
      rail.morphTargetPos       = t.targetPos
      rail.morphTargetSpanStart = t.targetSpanStart
      rail.morphTargetSpanEnd   = t.targetSpanEnd
    }

    // Retire surplus: shorten lifetime to expire shortly after morph finishes
    if (retiralsLeft > 0) {
      if (rail.vertical && surplusVert > 0) {
        rail.lifetime = (audioTime - rail.birthSec) + rail.morphDuration + 0.5
        surplusVert--
        retiralsLeft--
      } else if (!rail.vertical && surplusHoriz > 0) {
        rail.lifetime = (audioTime - rail.birthSec) + rail.morphDuration + 0.5
        surplusHoriz--
        retiralsLeft--
      }
    }
  }

  // Spawn up to 2 new rails per orientation for any deficit
  const addVert  = Math.min(2, Math.max(0, targetVert  - st.rails.filter(r =>  r.vertical).length))
  const addHoriz = Math.min(2, Math.max(0, targetHoriz - st.rails.filter(r => !r.vertical).length))
  for (let i = 0; i < addVert; i++) {
    if (st.rails.filter(r => r.vertical).length < MAX_VERT) {
      st.seedCounter++
      st.rails.push(makeVerticalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, 0.6))
    }
  }
  for (let i = 0; i < addHoriz; i++) {
    if (st.rails.filter(r => !r.vertical).length < MAX_HORIZ) {
      st.seedCounter++
      st.rails.push(makeHorizontalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, 0.6))
    }
  }
}

function resizeState(st: NeonLatticeState, W: number, H: number): void {
  st.trailCanvas.width  = W
  st.trailCanvas.height = H
  st.bloomCanvas.width  = Math.max(1, W >> 1)
  st.bloomCanvas.height = Math.max(1, H >> 1)
  st.rails = []
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
      // Bounded mix driven by verticalBias — does NOT permanently alter automatic density
      const strength   = 0.82
      const { vertCount, horizCount } = resolveRailBurstCounts(settings.verticalBias)
      for (let i = 0; i < vertCount; i++) {
        if (st.rails.filter(r => r.vertical).length < MAX_VERT) {
          st.seedCounter++
          st.rails.push(makeVerticalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, strength))
        }
      }
      for (let i = 0; i < horizCount; i++) {
        if (st.rails.filter(r => !r.vertical).length < MAX_HORIZ) {
          st.seedCounter++
          st.rails.push(makeHorizontalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, strength))
        }
      }
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
      // Scale from flareAmount so it remains usable manually even at low settings
      const scale  = Math.max(0.30, settings.flareAmount)
      const bright = 0.60 + scale * 0.35
      let vrails = st.rails.filter(r =>  r.vertical)
      let hrails = st.rails.filter(r => !r.vertical)
      // Create a minimal temporary cross when no intersections exist
      if (vrails.length === 0) {
        st.seedCounter++
        const r = makeVerticalRail(st.seedCounter, { ...settings, railLifetime: 0.8 }, audioTime, st.rails, paletteRgb, 0.55)
        st.rails.push(r)
        vrails = [r]
      }
      if (hrails.length === 0) {
        st.seedCounter++
        const r = makeHorizontalRail(st.seedCounter, { ...settings, railLifetime: 0.8 }, audioTime, st.rails, paletteRgb, 0.55)
        st.rails.push(r)
        hrails = [r]
      }
      const maxFlares = Math.min(MAX_FLARES, Math.max(4, Math.round(scale * MAX_FLARES * 0.5)))
      outer: for (const vr of vrails) {
        for (const hr of hrails) {
          if (st.flares.length >= maxFlares) break outer
          st.flares.push(makeFlare(vr.pos, hr.pos, audioTime, bright, paletteRgb.primary, (vr.depth + hr.depth) / 2, scale))
        }
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
      beginLayoutReseed(st, settings, paletteRgb, audioTime)
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
      // Temporarily override rail draw colors to cyan; palette restores automatically on expiry
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

  const px = pulse.vertical ? pulse.railPos * W : pulse.progress * W
  const py = pulse.vertical ? pulse.progress * H : pulse.railPos * H
  const r  = pulse.radius * Math.min(W, H)
  const rgb = colorOverride ?? pulse.colorRgb

  // Glow halo
  ctx.fillStyle = `rgba(${rgb},${(a * 0.12).toFixed(3)})`
  ctx.beginPath(); ctx.arc(px, py, r * 4, 0, Math.PI * 2); ctx.fill()

  // Body
  ctx.fillStyle = `rgba(${rgb},${(a * 0.80).toFixed(3)})`
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()

  // Bright core
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a * 0.65).toFixed(3)})`
  ctx.beginPath(); ctx.arc(px, py, r * 0.35, 0, Math.PI * 2); ctx.fill()

  // Directional micro-trail (a short line behind the pulse)
  const tLen = r * 3.5
  const tx = pulse.vertical ? px          : px - pulse.direction * tLen
  const ty = pulse.vertical ? py - pulse.direction * tLen : py
  ctx.strokeStyle = `rgba(${rgb},${(a * 0.28).toFixed(3)})`
  ctx.lineWidth   = r * 0.45
  ctx.lineCap     = 'round'
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke()
}

function drawRail(
  ctx:           Ctx2D,
  rail:          NeonRail,
  W:             number,
  H:             number,
  la:            number,
  intensity:     number,
  widthMul:      number,
  colorOverride?: string,
): void {
  const a = la * rail.alpha * intensity
  if (a < 0.01) return
  const rgb = colorOverride ?? rail.colorRgb

  if (rail.vertical) {
    const x  = rail.pos * W
    const y0 = rail.spanStart * H
    const y1 = rail.spanEnd   * H
    ctx.lineWidth   = rail.width * widthMul * (3 + rail.glow * 5)
    ctx.strokeStyle = `rgba(${rgb},${(a * rail.glow * 0.18).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke()
    ctx.lineWidth   = rail.width * widthMul * 1.4
    ctx.strokeStyle = `rgba(${rgb},${(a * 0.70).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke()
    ctx.lineWidth   = Math.max(0.5, rail.width * widthMul * 0.35)
    ctx.strokeStyle = `rgba(${rgb},${Math.min(1, a * 1.2).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke()
  } else {
    const y  = rail.pos * H
    const x0 = rail.spanStart * W
    const x1 = rail.spanEnd   * W
    ctx.lineWidth   = rail.width * widthMul * (3 + rail.glow * 4)
    ctx.strokeStyle = `rgba(${rgb},${(a * rail.glow * 0.15).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke()
    ctx.lineWidth   = rail.width * widthMul * 1.2
    ctx.strokeStyle = `rgba(${rgb},${(a * 0.60).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke()
    ctx.lineWidth   = Math.max(0.5, rail.width * widthMul * 0.30)
    ctx.strokeStyle = `rgba(${rgb},${Math.min(1, a * 1.0).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke()
  }
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
  W:           number,
  H:           number,
): void {
  if (bloomAmount < 0.05) return
  const bCtx = bloomCanvas.getContext('2d')
  if (!bCtx) return
  bCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height)
  bCtx.drawImage(trailCanvas, 0, 0, bloomCanvas.width, bloomCanvas.height)
  ctx.save()
  ctx.globalAlpha              = bloomAmount * 0.32
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

  for (const pulse of st.pulses) {
    const prevProg = pulse.progress
    const pdm      = resolveDepthModifiers(depthSetting, pulse.depth)
    pulse.progress += pulse.direction * pulse.speed * pdm.speedMul * dt

    // Collect perpendicular rail positions for intersection check
    const perpPositions = st.rails
      .filter(r => r.vertical !== pulse.vertical)
      .map(r => r.pos)

    // Find the first intersection crossed this frame
    const allCrossed: number[] = perpPositions.filter(pos =>
      pulse.direction === 1
        ? pos > prevProg && pos <= pulse.progress
        : pos < prevProg && pos >= pulse.progress
    )
    if (allCrossed.length === 0) continue

    const intersectAt = pulse.direction === 1
      ? Math.min(...allCrossed)
      : Math.max(...allCrossed)

    // Deterministic routing seed
    const routeSeed = (((pulse.railPos * 997) | 0) ^ ((intersectAt * 1009) | 0) ^ (st.seedCounter * 13)) >>> 0

    const route: PulseRoute = routePulseAtIntersection(pulse.splitCount, routeSeed)

    // Intersection point in normalized canvas space
    const ix = pulse.vertical ? pulse.railPos : intersectAt
    const iy = pulse.vertical ? intersectAt   : pulse.railPos

    // Automatic flare: gated by flareAmount probability and concurrent target
    if (route !== 'continue' && flareTarget > 0 && st.flares.length + newFlares.length < flareTarget) {
      const [fv] = prngNext(routeSeed + 19)
      if (fv < flareAmount) {
        newFlares.push(makeFlare(ix, iy, audioTime, pulse.brightness * flareAmount, paletteRgb, pulse.depth, flareAmount))
      }
    }

    if (route === 'expire') {
      pulse.lifetime = 0  // force expiry flag
      continue
    }

    if (route === 'turn' || route === 'split') {
      // Find the perpendicular rail closest to intersectAt
      const perpRail = st.rails
        .filter(r => r.vertical !== pulse.vertical)
        .reduce<NeonRail | null>((best, r) =>
          best === null || Math.abs(r.pos - intersectAt) < Math.abs(best.pos - intersectAt)
            ? r : best,
          null)

      if (perpRail) {
        const [dirVal] = prngNext(routeSeed + 7)
        const newDir: 1 | -1 = dirVal < 0.5 ? 1 : -1

        const childPulse: NeonPulse = {
          vertical:   !pulse.vertical,
          railPos:    perpRail.pos,
          progress:   pulse.vertical ? pulse.railPos : pulse.railPos,
          direction:  newDir,
          speed:      pulse.speed * (0.85 + (routeSeed % 30) / 100),
          brightness: pulse.brightness * 0.80,
          radius:     pulse.radius * 0.85,
          colorRgb:   pulse.colorRgb,
          birthSec:   audioTime,
          lifetime:   pulse.lifetime * 0.70,
          depth:      pulse.depth,
          splitCount: pulse.splitCount + 1,
        }

        if (route === 'split' && st.pulses.length + newPulses.length < MAX_PULSES) {
          newPulses.push(childPulse)
          pulse.splitCount = 1
        } else if (route === 'turn') {
          // Mutate pulse to travel on the perpendicular rail
          pulse.vertical  = childPulse.vertical
          pulse.railPos   = childPulse.railPos
          pulse.progress  = childPulse.progress
          pulse.direction = childPulse.direction
          pulse.splitCount = Math.max(pulse.splitCount, 1)
        }
      }
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
  if (dt <= 0) return target
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
  params:      ReactRenderParams,
  preset:      ReactPreset,
  manualSectionType: ReactSectionType | null = null,
): void {
  const { W, H } = frame
  const settings  = { ...DEFAULT_NEON_LATTICE_SETTINGS, ...params.neonLatticeSettings }
  const audioTime = frame.audioTime

  // ── State bootstrap / reset guards ────────────────────────────────────────
  let st = stateMap.get(ctx)
  if (!st) {
    st = makeState(W, H)
    stateMap.set(ctx, st)
  }

  const dimChanged   = st.lastW !== W || st.lastH !== H
  const longGap      = st.lastFrameSec >= 0 && (audioTime - st.lastFrameSec) > GAP_RESET_SEC
  const stoppedPlay  = st.wasPlaying && !frame.isPlaying

  if (dimChanged || longGap || stoppedPlay) {
    resizeState(st, W, H)
  }

  const dt          = Math.min(0.1, Math.max(0, audioTime - (st.lastFrameSec < 0 ? audioTime : st.lastFrameSec)))
  st.lastFrameSec   = audioTime
  st.wasPlaying     = frame.isPlaying
  // Freeze guard — declared early so blackout/camera sections can test it
  const isFrozen    = audioTime < st.frozenUntilSec

  // ── Palette ────────────────────────────────────────────────────────────────
  const paletteRgb: NeonPaletteRgb = {
    primary:   hexToRgbStr(preset.palette.primary),
    secondary: hexToRgbStr(preset.palette.secondary),
    accent:    hexToRgbStr(preset.palette.accent),
    highlight: hexToRgbStr(preset.palette.highlight),
  }
  const bgColor  = preset.palette.background ?? '#03070d'
  const accentRgb = paletteRgb.accent
  const cyanRgb   = '74,199,219'  // explicit cyan for cyanStrike override only

  const mi = frame.musicIntelligence
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
      * (1 + st.smoothedBass * settings.bassBrightnessResponse * 0.30),
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
    settings.cameraMotion
    + st.smoothedBuild * settings.buildMotionResponse * 0.35,
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
      beginLayoutReseed(st, secSettings, paletteRgb, audioTime)
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

  // ── Trigger consumption (one-shot per seq) ─────────────────────────────────
  const trig = params.neonLatticeTrigger
  if (trig && trig.seq !== st.lastConsumedSeq) {
    st.lastConsumedSeq = trig.seq
    dispatchTrigger(st, trig.type, audioTime, paletteRgb, secSettings, frame.bpm, W, H)
  }

  // ── Post-freeze burst (restrained — fires once on release) ────────────────
  if (st.burstAfterFreeze && audioTime > st.frozenUntilSec) {
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

  if (reactiveEnabled && mi !== null) {
    // Index-based deduplication: each event is processed exactly once per MI frame.
    // Beat/bar events are further gated by their own index to prevent double-firing
    // when the renderer runs faster than the MI update rate.
    const newMiFrame = mi.frameId          !== st.lastMiFrameId
    const newBeat    = mi.rhythm.beatIndex !== st.lastBeatIndex
    const newBar     = mi.rhythm.barIndex  !== st.lastBarIndex
    const p4Index    = Math.floor(mi.rhythm.beatIndex / 4)
    const newPhrase4 = p4Index !== st.lastPhrase4Index

    if (newMiFrame) {
      // Transient hits — MI flags are true only on the frame the event occurs
      if (newBeat && mi.rhythm.kickHit  && mi.rhythm.kickStrength  > 0.25) { spawnKick  = true; kickStrength  = mi.rhythm.kickStrength  }
      if (newBeat && mi.rhythm.snareHit && mi.rhythm.snareStrength > 0.20) { spawnSnare = true; snareStrength = mi.rhythm.snareStrength }
      if (!spawnKick && !spawnSnare && newBeat && mi.rhythm.beatHit) { spawnBeat = true; beatStrength = 0.35 + mi.energy.instant * 0.35 }
      if (mi.rhythm.hatHit && mi.rhythm.hatStrength > 0.15) { spawnHat  = true; hatStrength  = mi.rhythm.hatStrength   }
      if (mi.energy.spectralFlux > 0.38) { spawnFlux    = true; fluxStrength = mi.energy.spectralFlux }
      if (mi.energy.complexity   > 0.50) { spawnComplex = true }

      // Bar-boundary events: downbeat and drop are processed once per bar
      if (newBar && mi.rhythm.downbeatHit) {
        if (mi.energy.instant    > 0.40) { spawnDownbeat = true; downbeatStrength = 0.5 + mi.energy.instant * 0.5 }
        if (mi.energy.dropImpact > 0.75) { spawnDrop     = true; dropStrength     = mi.energy.dropImpact }
      }

      // Advance tracking indices
      st.lastMiFrameId = mi.frameId
      if (newBeat)    st.lastBeatIndex    = mi.rhythm.beatIndex
      if (newBar)     st.lastBarIndex     = mi.rhythm.barIndex
      if (newPhrase4) st.lastPhrase4Index = p4Index
    }
  } else if (reactiveEnabled) {
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
  } else if (frame.beatHit && (audioTime - st.lastBeatSec) > BEAT_DEBOUNCE) {
    // Reactive Engine off still keeps the BPM-authored lattice alive. It uses
    // neutral, deterministic beat sequencing instead of analyser amplitudes.
    spawnBeat = true
    beatStrength = 0.55
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

  if (!isFrozen) {
  // ── Rail spawning (railDensity + verticalBias → continuous orientation targets) ──
  const vertRails  = st.rails.filter(r => r.vertical)
  const horizRails = st.rails.filter(r => !r.vertical)
  const { targetVert: rawTargetVert, targetHoriz: rawTargetHoriz } = resolveRailTargets(secSettings.railDensity, secSettings.verticalBias)
  // Section behavior scales the effective targets; hard-cap clamp ensures counts stay within object budgets
  const targetVert  = Math.min(MAX_VERT,  Math.round(rawTargetVert  * Math.max(0.1, sectionRailSpawnMul)))
  const targetHoriz = Math.min(MAX_HORIZ, Math.round(rawTargetHoriz * Math.max(0.1, sectionRailSpawnMul)))

  if (spawnKick && targetVert > 0) {
    const toSpawn = Math.min(targetVert - vertRails.length, 2)
    for (let i = 0; i < toSpawn; i++) {
      st.seedCounter++
      st.rails.push(makeVerticalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, kickStrength * bassBoost))
    }
    st.lastKickSec = audioTime
  }

  if (spawnSnare && targetHoriz > 0) {
    const toSpawn = Math.min(targetHoriz - horizRails.length, 2)
    for (let i = 0; i < toSpawn; i++) {
      st.seedCounter++
      st.rails.push(makeHorizontalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, snareStrength * bassBoost))
    }
    st.lastSnareSec = audioTime
  }

  if (spawnBeat && (targetVert > 0 || targetHoriz > 0)) {
    // Seeded orientation choice (not modulo — deterministic per event)
    st.seedCounter++
    const [bv] = prngNext(st.seedCounter)
    const preferVert = bv < settings.verticalBias
    if (preferVert && vertRails.length < targetVert) {
      st.rails.push(makeVerticalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, beatStrength * 0.7))
    } else if (!preferVert && horizRails.length < targetHoriz) {
      st.rails.push(makeHorizontalRail(st.seedCounter, secSettings, audioTime, st.rails, paletteRgb, beatStrength * 0.7))
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
      const vrails = st.rails.filter(r => r.vertical)
      if (vrails.length > 0 && st.pulses.length < MAX_PULSES) {
        st.seedCounter++
        const rail = vrails[st.seedCounter % vrails.length]
        const dir: 1 | -1 = kickStrength > 0.5 ? 1 : -1
        st.pulses.push(makePulseOnRail(rail, dir, secSettings, audioTime, paletteRgb, Math.min(1, kickStrength * bassBoost), st.seedCounter, params.motion))
        pulseFired = true
      }
    } else if (resolveTriggerFires(trg, 'snare') && spawnSnare && snapOk) {
      const hrails = st.rails.filter(r => !r.vertical)
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
        const prefVert    = bv < settings.verticalBias
        const pool        = allRails.filter(r => r.vertical === prefVert)
        const candidates  = pool.length > 0 ? pool : allRails
        const rail        = candidates[st.seedCounter % candidates.length]
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
  const blockConcurrentTarget = Math.round(secSettings.blockDensity * MAX_BLOCKS)

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
  const shockAmt  = secSettings.shockwaveAmount
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
      for (let i = 0; i < 2; i++) {
        if (st.rails.filter(r => r.vertical).length < MAX_VERT) {
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

  // ── Advance pulses + handle intersections (skipped during freeze) ─────────
  if (!isFrozen) {
    const flareAmount  = clampUnit(
      settings.flareAmount
      + st.smoothedHigh * settings.highFlareResponse * 0.35,
    )
    const flareTarget  = Math.max(0, Math.round(flareAmount * MAX_FLARES))
    const { newFlares, newPulses } = updatePulses(st, dt, audioTime, paletteRgb.primary, secSettings, flareAmount, flareTarget, settings.depth)
    for (const f of newFlares) {
      if (st.flares.length < flareTarget) st.flares.push(f)
    }
    for (const p of newPulses) {
      if (st.pulses.length < MAX_PULSES) st.pulses.push(p)
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
      drawPulse(tCtx, pulse, W, H, audioTime - pulse.birthSec, drawIntensity * pdm.alphaMul, isCyanStrike ? cyanRgb : undefined)
    }
  }

  // Rails — background (depth≈0) drawn first, foreground (depth≈1) drawn last;
  // per-rail depth dimming, width scaling, and parallax shift applied.
  const sortedRails = st.rails.slice().sort((a, b) => a.depth - b.depth)
  for (const rail of sortedRails) {
    const age  = audioTime - rail.birthSec
    const la   = railLifetimeAlpha(age, rail.lifetime)
    const dm   = resolveDepthModifiers(settings.depth, rail.depth)
    const pxOff = resolveCameraParallaxShift(rail.depth, st.cameraDriftX, settings.parallax)
    const needsShift = Math.abs(pxOff) > 0.0005
    if (needsShift) tCtx.save()
    if (needsShift) tCtx.translate(pxOff * W, 0)
    drawRail(tCtx, rail, W, H, la * dm.alphaMul, drawIntensity * dm.intensityMul, dm.widthMul, isCyanStrike ? cyanRgb : undefined)
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
  applyBloom(ctx, st.trailCanvas, st.bloomCanvas, secSettings.bloom * params.glow * Math.min(1.5, bassBoost), W, H)

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
    rails:               Object.freeze(st.rails.map(r => Object.freeze({ ...r }))),
  })
}
