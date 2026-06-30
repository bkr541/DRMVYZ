// Virtual LaserDMX frame compiler (Spatial Fixtures mode).
// Produces CompiledLaserDmxResult from settings + MI data each animation tick.
// Never writes to Zustand. Never produces NaN/Infinity in output channels.

import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import type {
  LaserDmxSettings,
  LaserDmxFixture,
  LaserDmxModulationRoute,
  LaserDmxFixtureFrame,
} from '../ReactTypes'
import {
  safeNumber,
  clamp,
  clamp01,
  clamp255,
  lerp,
  applyCurve,
  resolveStrobeVisible,
  applyModulationRoute,
  modeApply,
  pruneEnvelopes,
  resetAllEnvelopes,
} from './LaserDmxModulationEngine'
import { generateLaserPath, sliceByProgress } from './LaserDmxPathUtils'
import type { LaserPoint } from './LaserDmxPathUtils'
import type { LaserDmxPersonalizationContext } from '../../../../features/personalization/laserDmxPersonalization'
import { inferSpatialFixtureSemantic, personalizeRgbw } from '../../../../features/personalization/laserDmxPersonalization'

// ── Re-export safety helpers for existing callers (LaserDmxRenderer.ts etc.) ──
export { safeNumber, clamp, clamp01, clamp255, lerp, applyCurve, resolveStrobeVisible }

// ── Color helpers ─────────────────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hi = Math.floor(((h % 1) + 1) % 1 * 6)
  const f  = ((h % 1) + 1) % 1 * 6 - hi
  const p = v * (1 - s), q = v * (1 - f * s), tv = v * (1 - (1 - f) * s)
  const lut: [number, number, number][] = [[v,tv,p],[q,v,p],[p,v,tv],[p,q,v],[tv,p,v],[v,p,q]]
  const [r, g, b] = lut[hi % 6]
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

const BUILTIN_PALETTES: Record<string, Array<[number, number, number]>> = {
  cyanEmerald:  [[0, 255, 220], [0, 255, 100], [80, 255, 255]],
  blueWhite:    [[40, 80, 255], [180, 220, 255], [255, 255, 255]],
  emeraldWhite: [[0, 255, 120], [140, 255, 180], [200, 255, 230]],
  rainbowLaser: [[255, 0, 0], [255, 200, 0], [0, 255, 50], [0, 180, 255], [140, 0, 255], [255, 0, 200]],
}

function samplePalette(paletteId: string, pos: number): [number, number, number] {
  const palette = BUILTIN_PALETTES[paletteId] ?? BUILTIN_PALETTES.cyanEmerald
  const n = palette.length
  const scaled = ((pos % 1) + 1) % 1 * n
  const i0 = Math.floor(scaled) % n
  const i1 = (i0 + 1) % n
  const t  = scaled - Math.floor(scaled)
  const c0 = palette[i0], c1 = palette[i1]
  return [
    Math.round(lerp(c0[0], c1[0], t)),
    Math.round(lerp(c0[1], c1[1], t)),
    Math.round(lerp(c0[2], c1[2], t)),
  ]
}

// ── Module-level ephemeral state ──────────────────────────────────────────────

let prevCompileTimeSec = -1

/** Resets the compiler's time reference so the next compiled frame gets dt=1/60
 *  rather than a huge delta accumulated during a pause. Call when LaserDMX stops rendering. */
export function resetLaserDmxCompilerState(): void {
  prevCompileTimeSec = -1
  resetAllEnvelopes()
}

// ── Ephemeral per-fixture render state (never persisted) ─────────────────────

interface FixtureRenderState {
  dimmer:        number   // 0–1
  shutterOpen:   boolean
  width:         number   // beam width multiplier
  zoom:          number   // 0–1
  focus:         number   // 0–1
  strobeRate:    number   // 0–1
  flickerAmount: number
  red:           number   // 0–255
  green:         number
  blue:          number
  white:         number
  alpha:         number   // 0–1
  pan:           number   // degrees  −180..180
  tilt:          number   // degrees  −90..90
  rotation:      number   // degrees
  scanSpeed:     number
  pathProgress:  number
  pathScale:     number
  pathRotation:  number
  pathSpread:    number
  pathRadius:    number
  pathComplexity:number
  colorCycleSpeed: number
}

// Global compiled output — may be modified by per-route modulation
interface GlobalRenderState {
  masterDimmer:    number
  hazeAmount:      number
  glowAmount:      number
  backgroundFade:  number
  beamPersistence: number
  globalBeamWidth: number
  globalStrobeRate:number
  safetyClamp:     number
}

// Compiler result — renderer uses compiled.global instead of raw settings
export interface CompiledGlobal {
  masterDimmer:    number
  hazeAmount:      number
  glowAmount:      number
  backgroundFade:  number
  beamPersistence: number
  globalBeamWidth: number
  globalStrobeRate:number
  safetyClamp:     number
  blackout:        boolean
}

export interface CompiledLaserDmxResult {
  global:   CompiledGlobal
  fixtures: LaserDmxFixtureFrame[]
}

function fixtureStateFromFixture(f: LaserDmxFixture): FixtureRenderState {
  return {
    dimmer:          clamp01(safeNumber(f.beam.dimmer, 1)),
    shutterOpen:     f.beam.shutterOpen !== false,
    width:           clamp(safeNumber(f.beam.width, 1), 0.2, 8),
    zoom:            clamp01(safeNumber(f.beam.zoom, 1)),
    focus:           clamp01(safeNumber(f.beam.focus, 1)),
    strobeRate:      clamp01(safeNumber(f.beam.strobeRate, 0)),
    flickerAmount:   clamp01(safeNumber(f.beam.flickerAmount, 0)),
    red:             clamp255(safeNumber(f.color.red, 0)),
    green:           clamp255(safeNumber(f.color.green, 255)),
    blue:            clamp255(safeNumber(f.color.blue, 220)),
    white:           clamp255(safeNumber(f.color.white, 0)),
    alpha:           clamp01(safeNumber(f.color.alpha, 1)),
    pan:             clamp(safeNumber(f.position.pan, 0), -180, 180),
    tilt:            clamp(safeNumber(f.position.tilt, 0), -90, 90),
    rotation:        safeNumber(f.position.rotation, 0),
    scanSpeed:       clamp(safeNumber(f.path.scanSpeed, 0.45), 0, 4),
    pathProgress:    clamp01(safeNumber(f.path.pathProgress, 0)),
    pathScale:       clamp(safeNumber(f.path.scale, 1), 0.01, 4),
    pathRotation:    safeNumber(f.path.rotation, 0),
    pathSpread:      clamp01(safeNumber(f.path.spread, 0.6)),
    pathRadius:      clamp01(safeNumber(f.path.radius, 0.4)),
    pathComplexity:  clamp01(safeNumber(f.path.complexity, 0.4)),
    colorCycleSpeed: clamp(safeNumber(f.color.colorCycleSpeed, 0), 0, 4),
  }
}

// ── Modulation application ────────────────────────────────────────────────────

function applyRoute(
  route:     LaserDmxModulationRoute,
  state:     FixtureRenderState,
  global:    GlobalRenderState,
  mi:        MusicIntelligenceFrame,
  fixtureId: string,
  dt:        number,
): void {
  // Spatial-Fixtures scope prefix: 'sf'
  const envKey = `sf:${fixtureId}:${route.id}`
  const result = applyModulationRoute(route, mi, envKey, dt)
  if (!result) return

  const v = result.value

  const applyF = (cur: number): number => modeApply(cur, v, route.mode)
  const applyG = applyF

  const target = route.target
  switch (target) {
    case 'masterDimmer':    global.masterDimmer    = clamp01(applyG(global.masterDimmer));   break
    case 'hazeAmount':      global.hazeAmount      = clamp01(applyG(global.hazeAmount));     break
    case 'glowAmount':      global.glowAmount      = clamp01(applyG(global.glowAmount));     break
    case 'fixtureDimmer':   state.dimmer           = clamp01(applyF(state.dimmer));          break
    case 'red':             state.red              = clamp255(applyF(state.red / 255) * 255); break
    case 'green':           state.green            = clamp255(applyF(state.green / 255) * 255); break
    case 'blue':            state.blue             = clamp255(applyF(state.blue / 255) * 255); break
    case 'white':           state.white            = clamp255(applyF(state.white / 255) * 255); break
    case 'alpha':           state.alpha            = clamp01(applyF(state.alpha));           break
    case 'pan':             state.pan              = lerp(-180, 180, v);                     break
    case 'tilt':            state.tilt             = lerp(-90,  90,  v);                     break
    case 'rotation':        state.rotation         = lerp(-180, 180, v);                     break
    case 'zoom':            state.zoom             = clamp01(applyF(state.zoom));            break
    case 'beamWidth':       state.width            = lerp(0.2, 6, v);                        break
    case 'strobeRate':      state.strobeRate       = clamp01(applyF(state.strobeRate));      break
    case 'shutter':         state.shutterOpen      = v > 0.5;                                break
    case 'scanSpeed':       state.scanSpeed        = lerp(0, 4, v);                          break
    case 'pathProgress':    state.pathProgress     = clamp01(applyF(state.pathProgress));    break
    case 'pathScale':       state.pathScale        = lerp(0.01, 4, v);                       break
    case 'pathRotation':    state.pathRotation     = lerp(-180, 180, v);                     break
    case 'pathSpread':      state.pathSpread       = clamp01(applyF(state.pathSpread));      break
    case 'pathRadius':      state.pathRadius       = clamp01(applyF(state.pathRadius));      break
    case 'pathComplexity':  state.pathComplexity   = clamp01(applyF(state.pathComplexity));  break
    default: break
  }
}

// ── Channel compilation per profile ──────────────────────────────────────────

function compileChannels(
  state:   FixtureRenderState,
  global:  GlobalRenderState,
  profile: string,
): Record<string, number> {
  const dimmer  = clamp255(state.dimmer * global.masterDimmer * 255)
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

// ── Validation helpers (exported for store/preset application) ────────────────

export function clampLaserModulationRoute(route: LaserDmxModulationRoute): LaserDmxModulationRoute {
  return {
    ...route,
    amount:    Number.isFinite(route.amount)    ? clamp(route.amount, -1, 2)    : 1,
    min:       Number.isFinite(route.min)       ? clamp01(route.min)            : 0,
    max:       Number.isFinite(route.max)       ? clamp01(route.max)            : 1,
    smoothing: Number.isFinite(route.smoothing) ? clamp01(route.smoothing)      : 0,
    attack:    Number.isFinite(route.attack)    ? clamp01(route.attack)         : 0,
    release:   Number.isFinite(route.release)   ? clamp01(route.release)        : 0,
  }
}

// ── Main compiler entry point ─────────────────────────────────────────────────

export interface CompileInput {
  settings:     LaserDmxSettings
  mi:           MusicIntelligenceFrame
  time:         number   // animation tick (frame counter) — used by path generators for animation
  timeSec:      number   // wall-clock seconds — used for strobe, envelopes, color cycle
  canvasWidth:  number
  canvasHeight: number
  personalization?: LaserDmxPersonalizationContext | null
}

export function compileLaserDmxFrame(inp: CompileInput): CompiledLaserDmxResult {
  const { settings, mi, time, timeSec, canvasWidth: W, canvasHeight: H, personalization } = inp
  if (!W || !H) {
    return {
      global: buildPassthroughGlobal(settings),
      fixtures: [],
    }
  }

  // Compute dt in seconds — clamped to [1ms, 100ms] so tab-background spikes don't explode envelopes
  const dt = prevCompileTimeSec >= 0
    ? clamp(timeSec - prevCompileTimeSec, 0.001, 0.1)
    : 1 / 60
  prevCompileTimeSec = timeSec

  const globalState: GlobalRenderState = {
    masterDimmer:    clamp01(safeNumber(settings.masterDimmer, 0.85)),
    hazeAmount:      clamp01(safeNumber(settings.hazeAmount, 0.55)),
    glowAmount:      clamp01(safeNumber(settings.glowAmount, 0.7)),
    backgroundFade:  clamp01(safeNumber(settings.backgroundFade, 0.18)),
    beamPersistence: clamp01(safeNumber(settings.beamPersistence, 0.72)),
    globalBeamWidth: clamp(safeNumber(settings.globalBeamWidth, 1), 0.2, 6),
    globalStrobeRate:clamp01(safeNumber(settings.globalStrobeRate, 0)),
    safetyClamp:     clamp01(safeNumber(settings.safetyClamp, 0.85)),
  }

  if (settings.blackout) {
    resetAllEnvelopes()
    return {
      global: { ...globalState, blackout: true },
      fixtures: [],
    }
  }

  // Collect active fixture IDs to prune stale envelope entries
  const activeEnvKeys = new Set<string>()

  const frames: LaserDmxFixtureFrame[] = []

  for (let fixtureIdx = 0; fixtureIdx < settings.fixtures.length; fixtureIdx++) {
    const fixture = settings.fixtures[fixtureIdx]
    if (!fixture.enabled) continue

    const fState = fixtureStateFromFixture(fixture)
    // Each fixture gets its own copy of global state so per-fixture routes don't bleed across fixtures
    const gState: GlobalRenderState = { ...globalState }

    // Apply modulation routes
    for (const route of fixture.modulationRoutes) {
      const envKey = `sf:${fixture.id}:${route.id}`
      activeEnvKeys.add(envKey)
      applyRoute(route, fState, gState, mi, fixture.id, dt)
    }

    // Safety clamp caps effective intensity
    fState.dimmer = clamp01(fState.dimmer * gState.safetyClamp)

    const effectiveMaster   = clamp01(gState.masterDimmer)
    const effectiveIntensity = clamp01(fState.dimmer * effectiveMaster)
    if (!fState.shutterOpen || effectiveIntensity < 0.001) continue

    // Effective strobe: fixture rate + global additive contribution
    const effectiveStrobeRate = clamp01(fState.strobeRate + gState.globalStrobeRate)
    const strobeVisible = resolveStrobeVisible(effectiveStrobeRate, timeSec)

    // Pan / Tilt: offset the target point in canvas pixels
    const ox = safeNumber(fixture.position.originX, 0.5) * W
    const oy = safeNumber(fixture.position.originY, 0.88) * H
    const baseTx = safeNumber(fixture.position.targetX, 0.5) * W
    const baseTy = safeNumber(fixture.position.targetY, 0.5) * H
    // pan shifts target horizontally, tilt shifts vertically
    const panOffsetPx  = (fState.pan  / 180) * W * 0.35
    const tiltOffsetPx = (fState.tilt / 90)  * H * 0.25
    const tx = baseTx + panOffsetPx
    const ty = baseTy + tiltOffsetPx

    // Zoom: multiplies effective path scale (zoom=0 → 0.5×, zoom=1 → 1×)
    const zoomScale = lerp(0.5, 1.0, clamp01(fState.zoom))
    const effectivePathScale = fState.pathScale * zoomScale

    // Flicker: deterministic per-fixture intensity noise (no Math.random — no jitter between frames)
    let intensityWithFlicker = effectiveIntensity
    if (fState.flickerAmount > 0.001) {
      const fp = timeSec * 11.3 + fixtureIdx * 2.7
      const noise = Math.sin(fp * 11.0) * Math.sin(fp * 7.3) * Math.cos(fp * 3.1)
      intensityWithFlicker = clamp01(effectiveIntensity * Math.max(0.3, 1.0 + noise * fState.flickerAmount * 0.3))
    }

    // Generate path points in canvas pixel space
    const rawPoints = generateLaserPath({
      originX:     ox,
      originY:     oy,
      targetX:     tx,
      targetY:     ty,
      W, H, time,
      scale:       effectivePathScale,
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

    let points: LaserPoint[] = fState.pathProgress < 0.999
      ? sliceByProgress(rawPoints, fState.pathProgress)
      : rawPoints

    // Mirror X / Mirror Y — reflect points around the (adjusted) target
    if (fixture.position.mirrorX) {
      points = points.map(pt => ({ x: tx * 2 - pt.x, y: pt.y }))
    }
    if (fixture.position.mirrorY) {
      points = points.map(pt => ({ x: pt.x, y: ty * 2 - pt.y }))
    }

    // Color computation
    let r = fState.red, g = fState.green, b = fState.blue

    if (fixture.color.mode === 'palette' && fState.colorCycleSpeed > 0.001) {
      // Cycle through a built-in palette
      const pos = ((timeSec * fState.colorCycleSpeed * 0.3) % 1 + 1) % 1
      ;[r, g, b] = samplePalette(fixture.color.paletteId || 'cyanEmerald', pos)
    } else if (fixture.color.mode === 'music') {
      // MI-driven color blending
      const energy = clamp01(safeNumber(mi.energy?.instant, 0))
      const bass   = clamp01(safeNumber(mi.bands?.bass, 0))
      r = clamp255(lerp(r, 80,  bass))
      g = clamp255(lerp(g, 255, energy))
      b = clamp255(lerp(b, 220, 1 - energy * 0.5))
    } else if (fixture.color.mode === 'fixed' && fState.colorCycleSpeed > 0.001) {
      // Fixed mode: gentle hue rotation on top of the configured color
      const hueShift = ((timeSec * fState.colorCycleSpeed * 0.07) % 1 + 1) % 1
      const [cr, cg, cb] = hsvToRgb(hueShift, 0.9, 1.0)
      const blend = clamp01(fState.colorCycleSpeed * 0.4)
      r = Math.round(lerp(r, cr, blend))
      g = Math.round(lerp(g, cg, blend))
      b = Math.round(lerp(b, cb, blend))
    }

    // Personalization is transient. Saved fixture RGBW, routes, and palette IDs
    // remain untouched; Original mode is represented by a null context.
    const personalized = personalization
      ? personalizeRgbw({
          red: r,
          green: g,
          blue: b,
          white: fState.white,
          alpha: fState.alpha,
        }, inferSpatialFixtureSemantic(fixture), personalization)
      : null
    if (personalized) {
      r = personalized.red
      g = personalized.green
      b = personalized.blue
    }

    // Focus: affects glow sharpness (1=sharp, 0=soft). Stored for renderer use.
    const focusFactor = clamp01(safeNumber(fState.focus, 1))

    // Effective beam width — apply globalBeamWidth once (renderer must NOT multiply again)
    const effectiveBeamWidth = clamp(fState.width * gState.globalBeamWidth, 0.2, 8)

    const rgba = {
      r: clamp255(r),
      g: clamp255(g),
      b: clamp255(b),
      a: clamp01(fState.alpha * intensityWithFlicker),
    }
    const color = `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a.toFixed(3)})`

    // Original mode preserves the exact legacy channel compilation path. Branded
    // modes compile a temporary RGB state while retaining white and alpha intent.
    const channelState = personalization
      ? { ...fState, red: personalized!.red, green: personalized!.green, blue: personalized!.blue }
      : fState
    const channels = compileChannels(channelState, gState, fixture.dmx.profileId)

    frames.push({
      fixtureId:    fixture.id,
      universe:     fixture.dmx.universe,
      startAddress: fixture.dmx.startAddress,
      channels,
      visual: {
        origin:       { x: ox, y: oy, z: safeNumber(fixture.position.originZ, 0) },
        target:       { x: tx, y: ty, z: safeNumber(fixture.position.targetZ, 0) },
        points,
        color,
        rgba,
        intensity:    intensityWithFlicker,
        beamWidth:    effectiveBeamWidth,
        strobeVisible,
        focusFactor,
      },
    })
  }

  // Prune stale envelope entries (routes that no longer exist)
  pruneEnvelopes(activeEnvKeys)

  return {
    global: { ...globalState, blackout: false },
    fixtures: frames,
  }
}

function buildPassthroughGlobal(settings: LaserDmxSettings): CompiledGlobal {
  return {
    masterDimmer:    clamp01(safeNumber(settings.masterDimmer, 0.85)),
    hazeAmount:      clamp01(safeNumber(settings.hazeAmount, 0.55)),
    glowAmount:      clamp01(safeNumber(settings.glowAmount, 0.7)),
    backgroundFade:  clamp01(safeNumber(settings.backgroundFade, 0.18)),
    beamPersistence: clamp01(safeNumber(settings.beamPersistence, 0.72)),
    globalBeamWidth: clamp(safeNumber(settings.globalBeamWidth, 1), 0.2, 6),
    globalStrobeRate:clamp01(safeNumber(settings.globalStrobeRate, 0)),
    safetyClamp:     clamp01(safeNumber(settings.safetyClamp, 0.85)),
    blackout:        settings.blackout ?? false,
  }
}
