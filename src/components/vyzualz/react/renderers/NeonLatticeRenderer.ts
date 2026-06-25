import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import type { ReactPreset, NeonLatticeTriggerType, NeonLatticeSettings } from '../ReactTypes'
import { DEFAULT_NEON_LATTICE_SETTINGS } from '../ReactTypes'
import {
  type NeonRail,
  type NeonPulse,
  type NeonFlare,
  type NeonBlock,
  type NeonShockwave,
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
  // trigger / overlay state (non-persisted visual effects)
  lastConsumedSeq:    number      // renderer only consumes each seq once
  overlayAlpha:       number      // 0 = inactive, >0 = drawing overlay
  overlayColor:       string      // '#ffffff' | '#000000'
  overlayStartSec:    number
  overlayDuration:    number
  frozenUntilSec:     number      // trail freeze; 0 = not frozen
  burstAfterFreeze:   boolean     // emit railBurst when freeze ends
  cyanStrikeUntilSec: number      // force cyan color on rails; 0 = off
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
    lastConsumedSeq:    0,
    overlayAlpha:       0,
    overlayColor:       '#ffffff',
    overlayStartSec:    -10,
    overlayDuration:    1,
    frozenUntilSec:     0,
    burstAfterFreeze:   false,
    cyanStrikeUntilSec: 0,
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

export function clearNeonLatticeVisualState(): void {
  // Playback-stop guard in renderNeonLattice handles cleanup on next frame.
}

// ── Trigger effect dispatcher ─────────────────────────────────────────────────

function dispatchTrigger(
  st:         NeonLatticeState,
  type:       NeonLatticeTriggerType,
  audioTime:  number,
  paletteRgb: { primary: string; accent: string },
  settings:   NeonLatticeSettings,
  bpm:        number,
  W:          number,
  H:          number,
): void {
  switch (type) {
    case 'railBurst': {
      // Spawn 3 vertical + 2 horizontal rails immediately, ignoring debounce
      const strength = 0.85
      for (let i = 0; i < 3; i++) {
        if (st.rails.filter(r => r.vertical).length < MAX_VERT) {
          st.seedCounter++
          st.rails.push(makeVerticalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, strength))
        }
      }
      for (let i = 0; i < 2; i++) {
        if (st.rails.filter(r => !r.vertical).length < MAX_HORIZ) {
          st.seedCounter++
          st.rails.push(makeHorizontalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, strength))
        }
      }
      break
    }

    case 'blockCascade': {
      const patterns: Array<'verticalRain' | 'diagonalStair' | 'centerOutward' | 'checker' | 'horizontalScan'> =
        ['verticalRain', 'diagonalStair', 'centerOutward', 'checker', 'horizontalScan']
      for (const pattern of patterns) {
        if (st.blocks.length >= MAX_BLOCKS) break
        st.seedCounter++
        const cells = spawnBlockPattern(pattern, st.seedCounter, 0.75)
        for (const { col, row } of cells) {
          if (st.blocks.length >= MAX_BLOCKS) break
          st.blocks.push(makeBlock(col, row, audioTime, settings.blockHold, paletteRgb.accent, 0.75))
        }
      }
      break
    }

    case 'crossFlare': {
      const vrails = st.rails.filter(r =>  r.vertical)
      const hrails = st.rails.filter(r => !r.vertical)
      for (const vr of vrails) {
        for (const hr of hrails) {
          if (st.flares.length >= MAX_FLARES) break
          st.flares.push(makeFlare(vr.pos, hr.pos, audioTime, 0.8, paletteRgb.primary, (vr.depth + hr.depth) / 2))
        }
        if (st.flares.length >= MAX_FLARES) break
      }
      break
    }

    case 'whiteout': {
      st.overlayColor    = '#ffffff'
      st.overlayAlpha    = 1
      st.overlayStartSec = audioTime
      st.overlayDuration = 1.5
      break
    }

    case 'blackout': {
      st.overlayColor    = '#000000'
      st.overlayAlpha    = 1
      st.overlayStartSec = audioTime
      st.overlayDuration = 2.0
      break
    }

    case 'reseed': {
      // Expire everything immediately and reset seed
      st.rails      = []
      st.pulses     = []
      st.flares     = []
      st.blocks     = []
      st.shockwaves = []
      st.seedCounter = 1
      // Clear trail canvas
      const tCtx = st.trailCanvas.getContext('2d')
      if (tCtx) { tCtx.clearRect(0, 0, W, H) }
      break
    }

    case 'freezeTrails': {
      // Freeze for 1.2s then burst
      st.frozenUntilSec   = audioTime + 1.2
      st.burstAfterFreeze = true
      break
    }

    case 'cyanStrike': {
      const beatSec = bpm > 0 ? 60 / bpm : 0.5
      st.cyanStrikeUntilSec = audioTime + Math.max(0.5, beatSec * 2)
      break
    }
  }
}

// ── Draw helpers (trail canvas) ───────────────────────────────────────────────

function applyTrailDecay(tCtx: Ctx2D, W: number, H: number, trailDecay: number): void {
  const keepFraction = 1 - Math.max(0.02, Math.min(0.98, trailDecay))
  tCtx.globalCompositeOperation = 'source-over'
  tCtx.fillStyle = `rgba(3,7,13,${(1 - keepFraction).toFixed(3)})`
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
  const size = (0.035 + bloom * 0.035) * Math.min(W, H)

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
  st:          NeonLatticeState,
  dt:          number,
  audioTime:   number,
  paletteRgb:  string,
  settings:    { pulseSpeed: number; cyanAccentChance: number },
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

    // Spawn a flare on meaningful interactions (not just continue)
    if (route !== 'continue' && newFlares.length < MAX_FLARES - st.flares.length) {
      newFlares.push(makeFlare(ix, iy, audioTime, pulse.brightness, paletteRgb, pulse.depth))
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
  ctx:    CanvasRenderingContext2D,
  frame:  ReactFrameContext,
  params: ReactRenderParams,
  preset: ReactPreset,
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

  // ── Palette ────────────────────────────────────────────────────────────────
  const paletteRgb = {
    primary: hexToRgbStr(preset.palette.primary),
    accent:  hexToRgbStr(preset.palette.accent),
  }
  const bgColor  = preset.palette.background ?? '#03070d'
  const accentRgb = hexToRgbStr(preset.palette.accent)
  const cyanRgb   = '74,199,219'

  // ── Trigger consumption (one-shot per seq) ─────────────────────────────────
  const trig = params.neonLatticeTrigger
  if (trig && trig.seq !== st.lastConsumedSeq) {
    st.lastConsumedSeq = trig.seq
    dispatchTrigger(st, trig.type, audioTime, paletteRgb, settings, frame.bpm, W, H)
  }

  // ── Post-freeze burst ──────────────────────────────────────────────────────
  if (st.burstAfterFreeze && audioTime > st.frozenUntilSec) {
    st.burstAfterFreeze = false
    dispatchTrigger(st, 'railBurst', audioTime, paletteRgb, settings, frame.bpm, W, H)
  }

  // ── Freeze guard (skip motion during freeze) ───────────────────────────────
  const isFrozen = audioTime < st.frozenUntilSec

  // ── CyanStrike color override ──────────────────────────────────────────────
  const isCyanStrike = audioTime < st.cyanStrikeUntilSec

  // ── Event detection ────────────────────────────────────────────────────────
  const mi = frame.musicIntelligence

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
  // ── Rail spawning ──────────────────────────────────────────────────────────
  const vertRails  = st.rails.filter(r => r.vertical)
  const horizRails = st.rails.filter(r => !r.vertical)
  const density    = settings.railDensity * params.intensity

  if (spawnKick && density > 0.05) {
    const vCount  = vertRails.length
    const toSpawn = vCount < MAX_VERT ? (vCount < MAX_VERT * 0.5 ? 2 : 1) : 0
    for (let i = 0; i < toSpawn; i++) {
      st.seedCounter++
      st.rails.push(makeVerticalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, kickStrength))
    }
    st.lastKickSec = audioTime
  }

  if (spawnSnare && density > 0.05) {
    const hCount  = horizRails.length
    const toSpawn = hCount < MAX_HORIZ ? (hCount < MAX_HORIZ * 0.5 ? 2 : 1) : 0
    for (let i = 0; i < toSpawn; i++) {
      st.seedCounter++
      st.rails.push(makeHorizontalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, snareStrength))
    }
    st.lastSnareSec = audioTime
  }

  if (spawnBeat && density > 0.05) {
    st.seedCounter++
    const isVert = (st.seedCounter % 100) / 100 < settings.verticalBias
    if (isVert && vertRails.length < MAX_VERT) {
      st.rails.push(makeVerticalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, beatStrength * 0.7))
    } else if (!isVert && horizRails.length < MAX_HORIZ) {
      st.rails.push(makeHorizontalRail(st.seedCounter, settings, audioTime, st.rails, paletteRgb, beatStrength * 0.7))
    }
    st.lastBeatSec = audioTime
  }

  // ── Pulse spawning (kicks → vertical, snares → horizontal) ────────────────
  if (spawnKick && st.pulses.length < MAX_PULSES) {
    // Pick a recently-spawned vertical rail to host the pulse
    const vrails = st.rails.filter(r => r.vertical)
    if (vrails.length > 0) {
      st.seedCounter++
      const rail = vrails[st.seedCounter % vrails.length]
      const dir: 1 | -1 = kickStrength > 0.5 ? 1 : -1
      st.pulses.push(makePulseOnRail(rail, dir, settings, audioTime, paletteRgb, kickStrength, st.seedCounter, params.motion))
    }
  }

  if (spawnSnare && st.pulses.length < MAX_PULSES) {
    const hrails = st.rails.filter(r => !r.vertical)
    if (hrails.length > 0) {
      // Center-outward: launch one pulse in each direction
      st.seedCounter++
      const rail = hrails[st.seedCounter % hrails.length]
      if (st.pulses.length < MAX_PULSES - 1) {
        st.pulses.push(makePulseOnRail(rail, 1,  settings, audioTime, paletteRgb, snareStrength, st.seedCounter,     params.motion))
        st.pulses.push(makePulseOnRail(rail, -1, settings, audioTime, paletteRgb, snareStrength, st.seedCounter + 1, params.motion))
      }
    }
  }

  // ── Block spawning ─────────────────────────────────────────────────────────
  function spawnBlocks(pattern: 'verticalRain' | 'diagonalStair' | 'centerOutward' | 'checker' | 'horizontalScan', strength: number): void {
    if (st!.blocks.length >= MAX_BLOCKS) return
    st!.seedCounter++
    const cells = spawnBlockPattern(pattern, st!.seedCounter, strength)
    for (const { col, row } of cells) {
      if (st!.blocks.length >= MAX_BLOCKS) break
      st!.blocks.push(makeBlock(col, row, audioTime, settings.blockHold, accentRgb, strength))
    }
  }

  if (spawnHat && settings.blockDensity > 0.05) {
    spawnBlocks((st.seedCounter % 2 === 0) ? 'verticalRain' : 'horizontalScan', hatStrength)
    st.lastHatSec = audioTime
  }

  if (spawnFlux && settings.blockDensity > 0.05) {
    spawnBlocks((st.seedCounter % 2 === 0) ? 'diagonalStair' : 'checker', fluxStrength)
    st.lastFluxSec = audioTime
  }

  if (spawnComplex && settings.blockDensity > 0.05) {
    spawnBlocks((st.seedCounter % 2 === 0) ? 'centerOutward' : 'checker', 0.6)
    st.lastComplexSec = audioTime
  }

  // ── Shockwave spawning (downbeats) ─────────────────────────────────────────
  if (spawnDownbeat && settings.shockwaves && st.shockwaves.length < MAX_SHOCKWAVES) {
    st.shockwaves.push(makeShockwave(0.5, 0.5, audioTime, downbeatStrength, settings.pulseSpeed, paletteRgb.primary))
    st.lastDownbeatSec = audioTime
  }
  } // end !isFrozen spawn block

  // ── Advance pulses + handle intersections (skipped during freeze) ─────────
  if (!isFrozen) {
    const { newFlares, newPulses } = updatePulses(st, dt, audioTime, paletteRgb.primary, settings)
    for (const f of newFlares) {
      if (st.flares.length < MAX_FLARES) st.flares.push(f)
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

  if (!isFrozen) {
    applyTrailDecay(tCtx, W, H, params.trailDecay ?? 0.08)
  }

  tCtx.lineCap  = 'round'
  tCtx.lineJoin = 'round'

  // Blocks (behind rails)
  for (const block of st.blocks) {
    drawBlock(tCtx, block, W, H, audioTime - block.birthSec, params.intensity)
  }

  // Pulses (accumulate on trail canvas for persistence)
  if (!isFrozen) {
    for (const pulse of st.pulses) {
      drawPulse(tCtx, pulse, W, H, audioTime - pulse.birthSec, params.intensity)
    }
  }

  // Rails (depth-sorted, near rails on top; cyan override during cyanStrike)
  const sortedRails = st.rails.slice().sort((a, b) => a.depth - b.depth)
  for (const rail of sortedRails) {
    const age = audioTime - rail.birthSec
    const la  = railLifetimeAlpha(age, rail.lifetime)
    drawRail(tCtx, rail, W, H, la, params.intensity, isCyanStrike ? cyanRgb : undefined)
  }

  // ── Main output: background → trail → flares → shockwaves → bloom → overlay ─
  ctx.globalAlpha              = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, W, H)

  ctx.drawImage(st.trailCanvas, 0, 0)

  // Flares (on main canvas, screen blend so they brighten rails beneath)
  const sprite = getFlareSprite()
  for (const flare of st.flares) {
    drawFlare(ctx, flare, W, H, sprite, audioTime - flare.birthSec, params.intensity, settings.bloom * params.glow)
  }

  // Shockwaves
  for (const sw of st.shockwaves) {
    drawShockwave(ctx, sw, W, H, audioTime - sw.birthSec, params.intensity)
  }

  // Bloom (screen-blend downscaled trail)
  applyBloom(ctx, st.trailCanvas, st.bloomCanvas, settings.bloom * params.glow, W, H)

  // ── Whiteout / blackout overlay (fades out automatically) ─────────────────
  if (st.overlayAlpha > 0) {
    const age      = audioTime - st.overlayStartSec
    const progress = Math.min(1, age / Math.max(0.001, st.overlayDuration))
    const alpha    = st.overlayAlpha * (1 - progress)
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
