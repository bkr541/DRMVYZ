// Virtual LaserDMX frame compiler.
// Produces LaserDmxFixtureFrame[] from settings + MI data each animation tick.
// Never writes to Zustand. Never produces NaN/Infinity in output channels.

import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import {
  getModulationSourceValue,
  getTriggerSourceValue,
} from '../../../../features/musicIntelligence/selectors'
import type {
  LaserDmxSettings,
  LaserDmxFixture,
  LaserDmxModulationRoute,
  LaserDmxFixtureFrame,
} from '../ReactTypes'
import { generateLaserPath, sliceByProgress } from './LaserDmxPathUtils'
import type { LaserPoint } from './LaserDmxPathUtils'

// ── Safety helpers ────────────────────────────────────────────────────────────

export function safeNumber(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
export function clamp01(v: number): number { return clamp(safeNumber(v), 0, 1) }
export function clamp255(v: number): number { return Math.round(clamp(safeNumber(v), 0, 255)) }
export function normalizePosition(v: number): number { return clamp(safeNumber(v), -1, 2) }
export function normalizeColorChannel(v: number): number { return clamp01(safeNumber(v) / 255) }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * clamp01(t) }

export function applyCurve(v: number, curve: string): number {
  const x = clamp01(v)
  switch (curve) {
    case 'easeIn':    return x * x
    case 'easeOut':   return 1 - (1 - x) * (1 - x)
    case 'easeInOut': { const t = x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x); return t }
    case 'pulse':     return Math.pow(Math.sin(x * Math.PI), 2)
    case 'exponential': return Math.pow(x, 3)
    default:          return x  // linear
  }
}

export function resolveStrobeVisible(rate: number, time: number): boolean {
  if (rate <= 0) return true
  const freq = lerp(1, 30, clamp01(rate))
  return (time * freq % 1) < 0.5
}

// ── Ephemeral per-fixture render state (never persisted) ─────────────────────

interface FixtureRenderState {
  dimmer:       number   // 0–1
  shutterOpen:  boolean
  width:        number   // beam width multiplier
  zoom:         number   // 0–1
  focus:        number   // 0–1
  strobeRate:   number   // 0–1
  flickerAmount:number
  red:          number   // 0–255
  green:        number
  blue:         number
  white:        number
  alpha:        number   // 0–1
  pan:          number   // degrees
  tilt:         number
  rotation:     number
  scanSpeed:    number
  pathProgress: number
  pathScale:    number
  pathRotation: number
  pathSpread:   number
  pathRadius:   number
  pathComplexity:number
}

interface GlobalRenderState {
  masterDimmer: number
  hazeAmount:   number
  glowAmount:   number
}

function fixtureStateFromFixture(f: LaserDmxFixture): FixtureRenderState {
  return {
    dimmer:        clamp01(safeNumber(f.beam.dimmer, 1)),
    shutterOpen:   f.beam.shutterOpen !== false,
    width:         clamp(safeNumber(f.beam.width, 1), 0.2, 8),
    zoom:          clamp01(safeNumber(f.beam.zoom, 1)),
    focus:         clamp01(safeNumber(f.beam.focus, 1)),
    strobeRate:    clamp01(safeNumber(f.beam.strobeRate, 0)),
    flickerAmount: clamp01(safeNumber(f.beam.flickerAmount, 0)),
    red:           clamp255(safeNumber(f.color.red, 0)),
    green:         clamp255(safeNumber(f.color.green, 255)),
    blue:          clamp255(safeNumber(f.color.blue, 220)),
    white:         clamp255(safeNumber(f.color.white, 0)),
    alpha:         clamp01(safeNumber(f.color.alpha, 1)),
    pan:           safeNumber(f.position.pan, 0),
    tilt:          safeNumber(f.position.tilt, 0),
    rotation:      safeNumber(f.position.rotation, 0),
    scanSpeed:     clamp(safeNumber(f.path.scanSpeed, 0.45), 0, 4),
    pathProgress:  clamp01(safeNumber(f.path.pathProgress, 0)),
    pathScale:     clamp(safeNumber(f.path.scale, 1), 0.01, 4),
    pathRotation:  safeNumber(f.path.rotation, 0),
    pathSpread:    clamp01(safeNumber(f.path.spread, 0.6)),
    pathRadius:    clamp01(safeNumber(f.path.radius, 0.4)),
    pathComplexity:clamp01(safeNumber(f.path.complexity, 0.4)),
  }
}

// ── Modulation application ────────────────────────────────────────────────────

function applyRoute(
  route:  LaserDmxModulationRoute,
  state:  FixtureRenderState,
  global: GlobalRenderState,
  mi:     MusicIntelligenceFrame,
  time:   number,
): void {
  if (!route.enabled) return

  // Source value (0–1)
  let rawValue = getModulationSourceValue(mi, route.source)
  // Trigger sources map to 0/1
  if (rawValue === 0 && route.mode === 'trigger') {
    rawValue = getTriggerSourceValue(mi, route.source) ? 1 : 0
  }

  let v = clamp01(rawValue)
  if (route.invert) v = 1 - v
  v = applyCurve(v, route.curve)

  // Map through min/max
  const lo = clamp01(safeNumber(route.min, 0))
  const hi = clamp01(safeNumber(route.max, 1))
  v = lerp(lo, hi, v)

  const amount = clamp(safeNumber(route.amount, 1), -1, 2)
  v = clamp01(v * amount)

  // Apply to target
  const target = route.target
  const applyToState = (key: keyof FixtureRenderState, cur: number): number => {
    switch (route.mode) {
      case 'set':      return v
      case 'add':      return clamp01(cur + v - 0.5 * amount)
      case 'multiply': return clamp01(cur * v)
      case 'trigger':  return getTriggerSourceValue(mi, route.source) ? v : cur
      default:         return v
    }
  }
  const applyGlobal = (cur: number): number => {
    switch (route.mode) {
      case 'set':      return v
      case 'add':      return clamp01(cur + v - 0.5 * amount)
      case 'multiply': return clamp01(cur * v)
      case 'trigger':  return getTriggerSourceValue(mi, route.source) ? v : cur
      default:         return v
    }
  }

  switch (target) {
    case 'masterDimmer':    global.masterDimmer  = applyGlobal(global.masterDimmer);  break
    case 'hazeAmount':      global.hazeAmount    = applyGlobal(global.hazeAmount);    break
    case 'glowAmount':      global.glowAmount    = applyGlobal(global.glowAmount);    break
    case 'fixtureDimmer':   state.dimmer         = applyToState('dimmer',        state.dimmer);        break
    case 'red':             state.red            = clamp255(applyToState('red',  state.red / 255) * 255); break
    case 'green':           state.green          = clamp255(applyToState('green',state.green / 255) * 255); break
    case 'blue':            state.blue           = clamp255(applyToState('blue', state.blue / 255) * 255); break
    case 'white':           state.white          = clamp255(applyToState('white',state.white / 255) * 255); break
    case 'alpha':           state.alpha          = applyToState('alpha',         state.alpha);         break
    case 'pan':             state.pan            = lerp(-180, 180, v);                                 break
    case 'tilt':            state.tilt           = lerp(-90,  90,  v);                                 break
    case 'rotation':        state.rotation       = lerp(-180, 180, v);                                 break
    case 'zoom':            state.zoom           = applyToState('zoom',          state.zoom);           break
    case 'beamWidth':       state.width          = lerp(0.2, 6, v);                                    break
    case 'strobeRate':      state.strobeRate     = applyToState('strobeRate',    state.strobeRate);    break
    case 'shutter':         state.shutterOpen    = v > 0.5;                                            break
    case 'scanSpeed':       state.scanSpeed      = lerp(0, 4, v);                                      break
    case 'pathProgress':    state.pathProgress   = applyToState('pathProgress',  state.pathProgress);  break
    case 'pathScale':       state.pathScale      = lerp(0.01, 4, v);                                   break
    case 'pathRotation':    state.pathRotation   = lerp(-180, 180, v);                                 break
    case 'pathSpread':      state.pathSpread     = applyToState('pathSpread',    state.pathSpread);    break
    case 'pathRadius':      state.pathRadius     = applyToState('pathRadius',    state.pathRadius);    break
    case 'pathComplexity':  state.pathComplexity = applyToState('pathComplexity',state.pathComplexity);break
    default: break
  }

  void time  // reserved for future smoothing/attack/release
}

// ── Channel compilation per profile ──────────────────────────────────────────

function compileChannels(
  state:   FixtureRenderState,
  global:  GlobalRenderState,
  profile: string,
): Record<string, number> {
  const dimmer = clamp255(state.dimmer * global.masterDimmer * 255)
  const shutter = state.shutterOpen ? 255 : 0
  const strobe  = clamp255(state.strobeRate * 255)
  const r = clamp255(state.red)
  const g = clamp255(state.green)
  const b = clamp255(state.blue)
  const w = clamp255(state.white)
  const pan  = clamp255((state.pan  + 180) / 360 * 255)
  const tilt = clamp255((state.tilt + 90)  / 180 * 255)
  const zoom = clamp255(state.zoom * 255)
  const rot  = clamp255((state.rotation + 180) / 360 * 255)
  const spd  = clamp255(state.scanSpeed / 4 * 255)

  switch (profile) {
    case 'genericRgbwLaser':
      return { ch1: dimmer, ch2: shutter, ch3: strobe, ch4: r, ch5: g, ch6: b, ch7: pan, ch8: tilt, ch9: zoom, ch10: 0, ch11: spd, ch12: w }
    case 'scannerLaser':
      return { ch1: dimmer, ch2: shutter, ch3: strobe, ch4: r, ch5: g, ch6: b, ch7: pan, ch8: tilt, ch9: rot, ch10: 0, ch11: spd, ch12: zoom }
    case 'multiPatternLaser':
      return { ch1: dimmer, ch2: shutter, ch3: strobe, ch4: r, ch5: g, ch6: b, ch7: w, ch8: pan, ch9: tilt, ch10: rot, ch11: 0, ch12: spd, ch13: zoom, ch14: clamp255(state.pathComplexity * 255) }
    default: // genericRgbLaser
      return { ch1: dimmer, ch2: shutter, ch3: strobe, ch4: r, ch5: g, ch6: b, ch7: pan, ch8: tilt, ch9: zoom, ch10: 0, ch11: spd }
  }
}

// ── Main compiler entry point ─────────────────────────────────────────────────

export interface CompileInput {
  settings:     LaserDmxSettings
  mi:           MusicIntelligenceFrame
  time:         number
  canvasWidth:  number
  canvasHeight: number
}

export function compileLaserDmxFrame(inp: CompileInput): LaserDmxFixtureFrame[] {
  const { settings, mi, time, canvasWidth: W, canvasHeight: H } = inp
  if (!W || !H) return []

  if (settings.blackout) return []

  const globalState: GlobalRenderState = {
    masterDimmer: clamp01(safeNumber(settings.masterDimmer, 0.85)),
    hazeAmount:   clamp01(safeNumber(settings.hazeAmount, 0.55)),
    glowAmount:   clamp01(safeNumber(settings.glowAmount, 0.7)),
  }

  const safetyClamp = clamp01(safeNumber(settings.safetyClamp, 0.85))
  const globalBeamWidth = clamp(safeNumber(settings.globalBeamWidth, 1), 0.2, 6)

  const frames: LaserDmxFixtureFrame[] = []

  for (const fixture of settings.fixtures) {
    if (!fixture.enabled) continue

    const fState = fixtureStateFromFixture(fixture)
    const gState: GlobalRenderState = { ...globalState }

    // Apply modulation routes (ephemeral — does NOT touch fixture object)
    for (const route of fixture.modulationRoutes) {
      applyRoute(route, fState, gState, mi, time)
    }

    // Safety clamp caps effective intensity
    fState.dimmer = clamp01(fState.dimmer * safetyClamp)

    const effectiveIntensity = clamp01(fState.dimmer * gState.masterDimmer)
    if (!fState.shutterOpen || effectiveIntensity < 0.001) continue

    const strobeVisible = resolveStrobeVisible(fState.strobeRate, time)
    const effectiveBeamWidth = clamp(fState.width * globalBeamWidth, 0.2, 8)

    // Generate path points in canvas pixel space
    const ox = safeNumber(fixture.position.originX, 0.5) * W
    const oy = safeNumber(fixture.position.originY, 0.88) * H
    const tx = safeNumber(fixture.position.targetX, 0.5) * W
    const ty = safeNumber(fixture.position.targetY, 0.5) * H

    const rawPoints = generateLaserPath({
      originX:     ox,
      originY:     oy,
      targetX:     tx,
      targetY:     ty,
      W, H, time,
      scale:       fState.pathScale,
      rotation:    fState.pathRotation,
      offsetX:     safeNumber(fixture.path.offsetX, 0),
      offsetY:     safeNumber(fixture.path.offsetY, 0),
      scanSpeed:   fState.scanSpeed,
      phaseOffset: safeNumber(fixture.path.phaseOffset, 0),
      pointCount:  safeNumber(fixture.path.pointCount, 18),
      spread:      fState.pathSpread,
      radius:      fState.pathRadius,
      complexity:  fState.pathComplexity,
      pathProgress:fState.pathProgress,
      pathKind:    fixture.path.kind,
    })

    const points: LaserPoint[] = fState.pathProgress < 0.999
      ? sliceByProgress(rawPoints, fState.pathProgress)
      : rawPoints

    // RGBA color (music-driven color mode mixes with MI energy)
    let r = fState.red, g = fState.green, b = fState.blue
    if (fixture.color.mode === 'music') {
      const energy = clamp01(safeNumber(mi.energy.instant, 0))
      const bass   = clamp01(safeNumber(mi.bands.bass, 0))
      r = clamp255(lerp(r, 80, bass))
      g = clamp255(lerp(g, 255, energy))
      b = clamp255(lerp(b, 220, 1 - energy * 0.5))
    }

    const rgba = { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: clamp01(fState.alpha * effectiveIntensity) }
    const color = `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a.toFixed(3)})`

    const channels = compileChannels(fState, gState, fixture.dmx.profileId)

    frames.push({
      fixtureId:    fixture.id,
      universe:     fixture.dmx.universe,
      startAddress: fixture.dmx.startAddress,
      channels,
      visual: {
        origin: { x: ox, y: oy, z: safeNumber(fixture.position.originZ, 0) },
        target: { x: tx, y: ty, z: safeNumber(fixture.position.targetZ, 0) },
        points,
        color,
        rgba,
        intensity:    effectiveIntensity,
        beamWidth:    effectiveBeamWidth,
        strobeVisible,
      },
    })
  }

  return frames
}
