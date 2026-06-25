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
  resolveRailBurstCounts,
  resolveCyanStrikeDuration,
  resolveOverlayAlpha,
  WHITEOUT_DURATION,
  BLACKOUT_DURATION,
  FREEZE_DURATION,
  RESEED_LIFE_SCALE,
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
  cameraDriftX:       number      // normalized x offset; 0 = center
  cameraDriftVX:      number      // velocity per second (normalized)
  cameraZoom:         number      // 1.0 = neutral
  cameraRotation:     number      // radians; 0 = neutral
  // Bar-based reseed
  lastReseedBarIndex: number      // barIndex at last auto-reseed; -1 = never
  // Auto-blackout
  autoBlackoutEnd:    number      // audioTime when current auto-blackout ends; 0 = idle
  strobeNextFlipSec:  number
  strobeState:        boolean
  // Section tracking
  prevSectionType:    ReactSectionType | null
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
    cameraDriftX:       0,
    cameraDriftVX:      0,
    cameraZoom:         1.0,
    cameraRotation:     0,
    lastReseedBarIndex: -1,
    autoBlackoutEnd:    0,
    strobeNextFlipSec:  0,
    strobeState:        false,
    prevSectionType:    null,
  }
}

function resetAccentObjects(st: NeonLatticeState): void {
  st.pulses     = []
  st.flares     = []
  st.blocks     = []
  st.shockwaves = []
}

function resizeState(st: NeonLatticeState, W: number, H: number): void {
  st.trailCanvas.width  = W
  st.trailCanvas.height = H
  st.bloomCanvas.width  = Math.max(1, W >> 1)
  st.bloomCanvas.height = Math.max(1, H >> 1)
  st.rails = []
  st.lastW = W
  st.lastH = H
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
      // Morph: bump seed epoch and accelerate turnover of existing rails.
      // No canvas clear — trails persist, but existing rails fade out quickly.
      st.seedCounter += 1000 + ((audioTime * 1000 | 0) % 997)
      st.lastReseedBarIndex = -1
      // Shorten remaining lifetimes so new-seed rails visibly replace old ones
      for (const rail of st.rails) {
        const elapsed   = audioTime - rail.birthSec
        const remaining = Math.max(0, rail.lifetime - elapsed)
        rail.lifetime   = elapsed + remaining * RESEED_LIFE_SCALE
      }
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
  ctx:       Ctx2D,
  block:     NeonBlock,
  W:         number,
  H:         number,
  age:       number,
  intensity: number,
): void {
  const la = blockLifetimeAlpha(age, block.lifetime)
  const a  = la * block.alpha * intensity
  if (a < 0.004) return
  const x0 = (block.col       / GRID_COLS) * W
  const y0 = (block.row       / GRID_ROWS) * H
  const x1 = ((block.col + 1) / GRID_COLS) * W
  const y1 = ((block.row + 1) / GRID_ROWS) * H
  ctx.fillStyle = `rgba(${block.colorRgb},${a.toFixed(3)})`
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
}

function drawPulse(
  ctx:       Ctx2D,
  pulse:     NeonPulse,
  W:         number,
  H:         number,
  age:       number,
  intensity: number,
): void {
  const la = railLifetimeAlpha(age, pulse.lifetime)
  const a  = la * pulse.brightness * intensity
  if (a < 0.01) return

  const px = pulse.vertical ? pulse.railPos * W : pulse.progress * W
  const py = pulse.vertical ? pulse.progress * H : pulse.railPos * H
  const r  = pulse.radius * Math.min(W, H)
  const rgb = pulse.colorRgb

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
  ctx:          Ctx2D,
  rail:         NeonRail,
  W:            number,
  H:            number,
  la:           number,
  intensity:    number,
  colorOverride?: string,
): void {
  const a = la * rail.alpha * intensity
  if (a < 0.01) return
  const rgb = colorOverride ?? rail.colorRgb

  if (rail.vertical) {
    const x  = rail.pos * W
    const y0 = rail.spanStart * H
    const y1 = rail.spanEnd   * H
    ctx.lineWidth   = rail.width * (3 + rail.glow * 5)
    ctx.strokeStyle = `rgba(${rgb},${(a * rail.glow * 0.18).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke()
    ctx.lineWidth   = rail.width * 1.4
    ctx.strokeStyle = `rgba(${rgb},${(a * 0.70).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke()
    ctx.lineWidth   = Math.max(0.5, rail.width * 0.35)
    ctx.strokeStyle = `rgba(${rgb},${Math.min(1, a * 1.2).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke()
  } else {
    const y  = rail.pos * H
    const x0 = rail.spanStart * W
    const x1 = rail.spanEnd   * W
    ctx.lineWidth   = rail.width * (3 + rail.glow * 4)
    ctx.strokeStyle = `rgba(${rgb},${(a * rail.glow * 0.15).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke()
    ctx.lineWidth   = rail.width * 1.2
    ctx.strokeStyle = `rgba(${rgb},${(a * 0.60).toFixed(3)})`
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke()
    ctx.lineWidth   = Math.max(0.5, rail.width * 0.30)
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
  st:           NeonLatticeState,
  dt:           number,
  audioTime:    number,
  paletteRgb:   string,
  settings:     { pulseSpeed: number; cyanAccentChance: number },
  flareAmount:  number,
  flareTarget:  number,
): { newFlares: NeonFlare[]; newPulses: NeonPulse[] } {
  const newFlares: NeonFlare[] = []
  const newPulses: NeonPulse[] = []

  for (const pulse of st.pulses) {
    const prevProg = pulse.progress
    pulse.progress += pulse.direction * pulse.speed * dt

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

  // ── Bass Reactivity ────────────────────────────────────────────────────────
  // Never makes engine invisible: floor at 1.0 (no reaction), rises above 1.0
  // only when both bassReactivity and current bass are non-zero.
  const bassEnergy = Math.max(0, Math.min(1, frame.audio.bass))
  const bassBoost  = 1.0 + params.bassReactivity * bassEnergy * 0.65

  // ── Effective section (manual > MI section > null) ─────────────────────────
  const mi = frame.musicIntelligence
  const miSectionType = mi?.section.type ?? null
  const effectiveSectionType = resolveEffectiveSection(manualSectionType, miSectionType)

  // ── Section spawn multiplier ───────────────────────────────────────────────
  const sectionSpawnMul = resolveSectionSpawnMul(
    effectiveSectionType,
    mi?.energy.buildProgress ?? 0,
    mi?.energy.dropImpact    ?? 0,
    mi?.energy.tension       ?? 0,
    mi?.section.progress     ?? 0,
  )

  // ── Camera motion update (paused during freeze) ───────────────────────────
  const cm = settings.cameraMotion
  if (cm > 0 && dt > 0 && !isFrozen) {
    const driftSeed = ((st.seedCounter + 7777) * 1009 + (audioTime * 10 | 0)) >>> 0
    const [dv] = prngNext(driftSeed)
    st.cameraDriftVX += (dv - 0.5) * cm * 0.0015 * dt
    st.cameraDriftVX *= Math.pow(0.88, dt * 60)
    st.cameraDriftX  += st.cameraDriftVX * dt
    const driftLimit  = 0.055 * cm
    st.cameraDriftX   = Math.max(-driftLimit, Math.min(driftLimit, st.cameraDriftX))
    const zoomTarget  = 1.0 + bassEnergy * cm * 0.030
    st.cameraZoom    += (zoomTarget - st.cameraZoom) * Math.min(1, dt * 7)
    st.cameraRotation *= Math.pow(0.80, dt * 60)
    st.cameraRotation  = Math.max(-0.010 * cm, Math.min(0.010 * cm, st.cameraRotation))
  } else {
    st.cameraDriftX   = 0
    st.cameraDriftVX  = 0
    st.cameraZoom     = 1.0
    st.cameraRotation = 0
  }

  // ── Bar-based auto-reseed ──────────────────────────────────────────────────
  if (mi && settings.reseedInterval > 0 && mi.rhythm.barIndex >= 0) {
    const barsSince = mi.rhythm.barIndex - st.lastReseedBarIndex
    if (
      (st.lastReseedBarIndex < 0 && mi.rhythm.barIndex >= settings.reseedInterval) ||
      (st.lastReseedBarIndex >= 0 && barsSince >= settings.reseedInterval && mi.rhythm.downbeatHit)
    ) {
      st.seedCounter += 1000 + (mi.rhythm.barIndex * 37)
      st.lastReseedBarIndex = mi.rhythm.barIndex
    }
  }

  // ── Automatic blackout ─────────────────────────────────────────────────────
  const blackoutMode = settings.blackoutMode
  if (blackoutMode !== 'none' && !isFrozen && st.autoBlackoutEnd <= audioTime) {
    const isPreDrop   = effectiveSectionType === 'preDrop'
    const isFakeout   = mi ? mi.semantics.fakeoutConfidence > 0.72 : false
    const isMajorDrop = mi ? (mi.energy.dropImpact > 0.82 && mi.rhythm.downbeatHit) : false
    if (isPreDrop || isFakeout || isMajorDrop) {
      const barsInSec = frame.bpm > 0 ? 60 / frame.bpm * 4 : 2.0
      switch (blackoutMode) {
        case 'instant':
          st.overlayColor    = '#000000'
          st.overlayAlpha    = 1
          st.overlayStartSec = audioTime
          st.overlayDuration = Math.min(barsInSec * 0.5, 1.2)
          st.autoBlackoutEnd = audioTime + barsInSec
          break
        case 'fadeOut':
          st.overlayColor    = '#000000'
          st.overlayAlpha    = 1
          st.overlayStartSec = audioTime
          st.overlayDuration = Math.min(barsInSec * 2, 3.5)
          st.autoBlackoutEnd = audioTime + st.overlayDuration
          break
        case 'strobe':
          st.strobeNextFlipSec = audioTime
          st.strobeState       = false
          st.autoBlackoutEnd   = audioTime + Math.min(barsInSec, 2.0)
          break
      }
    }
  }

  // ── Trigger consumption (one-shot per seq) ─────────────────────────────────
  const trig = params.neonLatticeTrigger
  if (trig && trig.seq !== st.lastConsumedSeq) {
    st.lastConsumedSeq = trig.seq
    dispatchTrigger(st, trig.type, audioTime, paletteRgb, settings, frame.bpm, W, H)
  }

  // ── Post-freeze burst (restrained — fires once on release) ────────────────
  if (st.burstAfterFreeze && audioTime > st.frozenUntilSec) {
    st.burstAfterFreeze = false
    const strength = 0.58
    for (let i = 0; i < 2; i++) {
      if (st.rails.filter(r => r.vertical).length < MAX_VERT) {
        st.seedCounter++
        st.rails.push(makeVerticalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, strength))
      }
    }
    if (st.rails.filter(r => !r.vertical).length < MAX_HORIZ) {
      st.seedCounter++
      st.rails.push(makeHorizontalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, strength))
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

  if (mi !== null) {
    if (mi.rhythm.kickHit  && mi.rhythm.kickStrength  > 0.25 && (audioTime - st.lastKickSec)  > KICK_DEBOUNCE)  { spawnKick  = true; kickStrength  = mi.rhythm.kickStrength  }
    if (mi.rhythm.snareHit && mi.rhythm.snareStrength > 0.20 && (audioTime - st.lastSnareSec) > SNARE_DEBOUNCE) { spawnSnare = true; snareStrength = mi.rhythm.snareStrength }
    if (!spawnKick && !spawnSnare && mi.rhythm.beatHit && (audioTime - st.lastBeatSec) > BEAT_DEBOUNCE)          { spawnBeat  = true; beatStrength  = 0.35 + mi.energy.instant * 0.35 }
    if (mi.rhythm.hatHit   && mi.rhythm.hatStrength   > 0.15 && (audioTime - st.lastHatSec)   > HAT_DEBOUNCE)   { spawnHat   = true; hatStrength   = mi.rhythm.hatStrength   }
    if (mi.energy.spectralFlux > 0.38                          && (audioTime - st.lastFluxSec)  > FLUX_DEBOUNCE)  { spawnFlux  = true; fluxStrength  = mi.energy.spectralFlux   }
    if (mi.energy.complexity   > 0.50                          && (audioTime - st.lastComplexSec) > COMPLEX_DEBOUNCE) { spawnComplex = true }
    if (mi.rhythm.downbeatHit && mi.energy.instant > 0.40 && (audioTime - st.lastDownbeatSec) > DOWNBEAT_DEBOUNCE) {
      spawnDownbeat = true; downbeatStrength = 0.5 + mi.energy.instant * 0.5
    }
  } else {
    const bass = frame.audio.bass
    const high = frame.audio.high
    const mid  = frame.audio.mid
    if (bass > 0.52 && bass > st.prevBass + 0.07 && (audioTime - st.lastKickSec)  > KICK_DEBOUNCE)  { spawnKick  = true; kickStrength  = Math.min(1, (bass - 0.52) * 3 + 0.4) }
    if (frame.beatHit && mid > 0.25 && !spawnKick && (audioTime - st.lastSnareSec) > SNARE_DEBOUNCE) { spawnSnare = true; snareStrength = Math.min(1, 0.3 + mid * 0.5) }
    if (!spawnKick && !spawnSnare && frame.beatHit && (audioTime - st.lastBeatSec)  > BEAT_DEBOUNCE) { spawnBeat  = true; beatStrength  = 0.3 + frame.audio.volume * 0.4 }
    if (high > 0.45 && high > st.prevHigh + 0.05 && (audioTime - st.lastHatSec)    > HAT_DEBOUNCE)  { spawnHat   = true; hatStrength   = Math.min(1, (high - 0.45) * 4 + 0.3) }
    if (mid  > 0.42 && mid  > st.prevMid  + 0.08 && (audioTime - st.lastFluxSec)   > FLUX_DEBOUNCE) { spawnFlux  = true; fluxStrength  = Math.min(1, mid * 1.2) }
    if (frame.beatHit) {
      st.beatHitCount++
      if (st.beatHitCount % 4 === 0 && frame.audio.bass > 0.40 && (audioTime - st.lastDownbeatSec) > DOWNBEAT_DEBOUNCE) {
        spawnDownbeat = true; downbeatStrength = 0.5 + frame.audio.bass * 0.4
      }
    }
    st.prevBass = bass
    st.prevHigh = high
    st.prevMid  = mid
  }

  if (!isFrozen) {
  // ── Rail spawning (railDensity + verticalBias → continuous orientation targets) ──
  const vertRails  = st.rails.filter(r => r.vertical)
  const horizRails = st.rails.filter(r => !r.vertical)
  const { targetVert: rawTargetVert, targetHoriz: rawTargetHoriz } = resolveRailTargets(settings.railDensity, settings.verticalBias)
  // Section spawn multiplier scales the effective targets — drop boosts density, intro reduces it
  const targetVert  = Math.round(rawTargetVert  * Math.max(0.1, sectionSpawnMul))
  const targetHoriz = Math.round(rawTargetHoriz * Math.max(0.1, sectionSpawnMul))

  if (spawnKick && targetVert > 0) {
    const toSpawn = Math.min(targetVert - vertRails.length, 2)
    for (let i = 0; i < toSpawn; i++) {
      st.seedCounter++
      st.rails.push(makeVerticalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, kickStrength * bassBoost))
    }
    st.lastKickSec = audioTime
  }

  if (spawnSnare && targetHoriz > 0) {
    const toSpawn = Math.min(targetHoriz - horizRails.length, 2)
    for (let i = 0; i < toSpawn; i++) {
      st.seedCounter++
      st.rails.push(makeHorizontalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, snareStrength * bassBoost))
    }
    st.lastSnareSec = audioTime
  }

  if (spawnBeat && (targetVert > 0 || targetHoriz > 0)) {
    // Seeded orientation choice (not modulo — deterministic per event)
    st.seedCounter++
    const [bv] = prngNext(st.seedCounter)
    const preferVert = bv < settings.verticalBias
    if (preferVert && vertRails.length < targetVert) {
      st.rails.push(makeVerticalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, beatStrength * 0.7))
    } else if (!preferVert && horizRails.length < targetHoriz) {
      st.rails.push(makeHorizontalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, beatStrength * 0.7))
    }
    st.lastBeatSec = audioTime
  }

  // ── Trigger gate helpers (pulse and block sources driven by settings.trigger) ──
  const trg = settings.trigger
  function allowPulse(event: 'kick' | 'snare' | 'downbeat'): boolean {
    if (trg === 'none')      return false
    if (trg === 'beat')      return event === 'kick' || event === 'snare'
    if (trg === 'kick')      return event === 'kick'
    if (trg === 'snare')     return event === 'snare'
    if (trg === 'downbeat')  return event === 'downbeat'
    if (trg === 'drop')      return event === 'downbeat'
    return false
  }
  function allowBlock(event: 'hat' | 'flux' | 'complex'): boolean {
    if (trg === 'none')     return false
    if (trg === 'beat')     return true
    if (trg === 'kick')     return event === 'hat'
    if (trg === 'snare')    return event === 'flux'
    if (trg === 'downbeat') return event === 'complex'
    if (trg === 'drop')     return event === 'flux' || event === 'complex'
    return false
  }

  // ── Snap-slot deduplication (one pulse / one block event per subdivision) ──
  const pulseSlot = resolveSnapSlot(audioTime, frame.bpm, settings.snapDivision)
  const blockSlot = pulseSlot  // same musical grid for both

  // ── Pulse spawning ─────────────────────────────────────────────────────────
  if (spawnKick && allowPulse('kick') && pulseSlot !== st.lastPulseSnapSlot) {
    const vrails = st.rails.filter(r => r.vertical)
    if (vrails.length > 0 && st.pulses.length < MAX_PULSES) {
      st.seedCounter++
      const rail = vrails[st.seedCounter % vrails.length]
      const dir: 1 | -1 = kickStrength > 0.5 ? 1 : -1
      st.pulses.push(makePulseOnRail(rail, dir, settings, audioTime, paletteRgb, Math.min(1, kickStrength * bassBoost), st.seedCounter, params.motion))
      st.lastPulseSnapSlot = pulseSlot
    }
  }

  if (spawnSnare && allowPulse('snare') && pulseSlot !== st.lastPulseSnapSlot) {
    const hrails = st.rails.filter(r => !r.vertical)
    if (hrails.length > 0 && st.pulses.length < MAX_PULSES - 1) {
      st.seedCounter++
      const rail = hrails[st.seedCounter % hrails.length]
      st.pulses.push(makePulseOnRail(rail, 1,  settings, audioTime, paletteRgb, Math.min(1, snareStrength * bassBoost), st.seedCounter,     params.motion))
      st.pulses.push(makePulseOnRail(rail, -1, settings, audioTime, paletteRgb, Math.min(1, snareStrength * bassBoost), st.seedCounter + 1, params.motion))
      st.lastPulseSnapSlot = pulseSlot
    }
  }

  if (spawnDownbeat && allowPulse('downbeat') && pulseSlot !== st.lastPulseSnapSlot) {
    const allRails = st.rails
    if (allRails.length > 0 && st.pulses.length < MAX_PULSES) {
      st.seedCounter++
      const rail = allRails[st.seedCounter % allRails.length]
      st.pulses.push(makePulseOnRail(rail, 1, settings, audioTime, paletteRgb, Math.min(1, downbeatStrength * bassBoost), st.seedCounter, params.motion))
      st.lastPulseSnapSlot = pulseSlot
    }
  }

  // ── Block spawning (blockDensity: probability, cells, and concurrent target) ──
  const blockConcurrentTarget = Math.round(settings.blockDensity * MAX_BLOCKS)

  function spawnBlocks(pattern: 'verticalRain' | 'diagonalStair' | 'centerOutward' | 'checker' | 'horizontalScan', strength: number): void {
    if (!st || st.blocks.length >= blockConcurrentTarget) return
    st.seedCounter++
    // Probability gate: seeded check proportional to blockDensity
    const [pv] = prngNext(st.seedCounter + 31)
    if (pv > settings.blockDensity) return
    // Cell count scales with density
    const cellStrength = Math.min(1, strength * Math.max(0.15, settings.blockDensity))
    const cells = spawnBlockPattern(pattern, st.seedCounter, cellStrength)
    for (const { col, row } of cells) {
      if (st.blocks.length >= Math.min(MAX_BLOCKS, blockConcurrentTarget)) break
      st.blocks.push(makeBlock(col, row, audioTime, settings.blockHold, accentRgb, Math.min(1, strength * bassBoost)))
    }
  }

  if (spawnHat && allowBlock('hat') && blockSlot !== st.lastBlockSnapSlot) {
    spawnBlocks((st.seedCounter % 2 === 0) ? 'verticalRain' : 'horizontalScan', hatStrength)
    st.lastHatSec = audioTime
    st.lastBlockSnapSlot = blockSlot
  }

  if (spawnFlux && allowBlock('flux') && blockSlot !== st.lastBlockSnapSlot) {
    spawnBlocks((st.seedCounter % 2 === 0) ? 'diagonalStair' : 'checker', fluxStrength)
    st.lastFluxSec = audioTime
    st.lastBlockSnapSlot = blockSlot
  }

  if (spawnComplex && allowBlock('complex') && blockSlot !== st.lastBlockSnapSlot) {
    spawnBlocks((st.seedCounter % 2 === 0) ? 'centerOutward' : 'checker', 0.6)
    st.lastComplexSec = audioTime
    st.lastBlockSnapSlot = blockSlot
  }

  // ── Shockwave spawning (downbeats) ─────────────────────────────────────────
  if (spawnDownbeat && settings.shockwaves && st.shockwaves.length < MAX_SHOCKWAVES) {
    st.shockwaves.push(makeShockwave(0.5, 0.5, audioTime, Math.min(1, downbeatStrength * bassBoost), settings.pulseSpeed, paletteRgb.primary))
    st.lastDownbeatSec = audioTime
    // Downbeat zoom punch on camera (small, bounded, clamped above in update)
    if (cm > 0) {
      st.cameraRotation += downbeatStrength * cm * 0.008
    }
  }
  } // end !isFrozen spawn block

  // ── Advance pulses + handle intersections (skipped during freeze) ─────────
  if (!isFrozen) {
    const flareAmount  = settings.flareAmount
    const flareTarget  = Math.max(0, Math.round(flareAmount * MAX_FLARES))
    const { newFlares, newPulses } = updatePulses(st, dt, audioTime, paletteRgb.primary, settings, flareAmount, flareTarget)
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

  // ── Trail canvas: decay → blocks → pulses → rails ─────────────────────────
  const tCtx = st.trailCanvas.getContext('2d')
  if (!tCtx) return

  const drawIntensity = Math.min(1.5, params.intensity * bassBoost)

  if (!isFrozen) {
    applyTrailDecay(tCtx, W, H, params.trailDecay ?? 0.08, settings.decayStyle, dt, audioTime)
  }

  tCtx.lineCap  = 'round'
  tCtx.lineJoin = 'round'

  // Blocks (behind rails)
  for (const block of st.blocks) {
    drawBlock(tCtx, block, W, H, audioTime - block.birthSec, drawIntensity)
  }

  // Pulses (accumulate on trail canvas for persistence)
  if (!isFrozen) {
    for (const pulse of st.pulses) {
      drawPulse(tCtx, pulse, W, H, audioTime - pulse.birthSec, drawIntensity)
    }
  }

  // Rails — depth-sorted (far first), with per-rail depth dimming and parallax
  const sortedRails = st.rails.slice().sort((a, b) => a.depth - b.depth)
  for (const rail of sortedRails) {
    const age  = audioTime - rail.birthSec
    const la   = railLifetimeAlpha(age, rail.lifetime)
    const dm   = resolveDepthModifiers(settings.depth, rail.depth)
    const pxOff = resolveCameraParallaxShift(rail.depth, st.cameraDriftX, settings.parallax)
    const needsShift = Math.abs(pxOff) > 0.0005
    if (needsShift) tCtx.save()
    if (needsShift) tCtx.translate(pxOff * W, 0)
    drawRail(tCtx, rail, W, H, la * dm.alphaMul, drawIntensity * dm.intensityMul, isCyanStrike ? cyanRgb : undefined)
    if (needsShift) tCtx.restore()
  }

  // ── Main output: background → trail (camera-transformed) → flares → shockwaves → bloom → overlay ─
  ctx.globalAlpha              = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, W, H)

  // Camera transform applied when blitting trail so trails accumulate flat
  const hasCamera = Math.abs(st.cameraDriftX) > 0.0005 || Math.abs(st.cameraZoom - 1) > 0.0005 || Math.abs(st.cameraRotation) > 0.0001
  if (hasCamera) {
    ctx.save()
    ctx.translate(W * 0.5, H * 0.5)
    ctx.rotate(st.cameraRotation)
    ctx.scale(st.cameraZoom, st.cameraZoom)
    ctx.translate(-W * 0.5 + st.cameraDriftX * W, -H * 0.5)
    ctx.drawImage(st.trailCanvas, 0, 0)
    ctx.restore()
  } else {
    ctx.drawImage(st.trailCanvas, 0, 0)
  }

  // Flares (on main canvas, screen blend so they brighten rails beneath)
  const sprite = getFlareSprite()
  for (const flare of st.flares) {
    drawFlare(ctx, flare, W, H, sprite, audioTime - flare.birthSec, drawIntensity, settings.bloom * params.glow)
  }

  // Shockwaves
  for (const sw of st.shockwaves) {
    drawShockwave(ctx, sw, W, H, audioTime - sw.birthSec, drawIntensity)
  }

  // Bloom (screen-blend downscaled trail); bass reactivity amplifies glow response
  applyBloom(ctx, st.trailCanvas, st.bloomCanvas, settings.bloom * params.glow * Math.min(1.5, bassBoost), W, H)

  // ── Strobe (auto-blackout mode 'strobe') ──────────────────────────────────
  if (blackoutMode === 'strobe' && st.autoBlackoutEnd > audioTime) {
    if (audioTime >= st.strobeNextFlipSec) {
      st.strobeState       = !st.strobeState
      st.strobeNextFlipSec = audioTime + 0.065  // ~15 Hz
    }
    if (st.strobeState) {
      ctx.save()
      ctx.globalAlpha              = 0.88
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
    }
  }

  // ── Whiteout / blackout overlay (fades out automatically) ─────────────────
  if (st.overlayAlpha > 0) {
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
}
