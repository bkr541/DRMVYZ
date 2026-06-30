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
import {
  buildProductionRig,
  compileProfileChannels,
  getLaserDmxFixtureProfile,
  createProductionOutputFrame,
  isMovingHeadFixtureKind,
  normalizeProductionMovingHeadSettings,
  normalizeProductionFixtureColorPolicy,
  normalizeProductionFlashPattern,
  normalizeProductionLedBarSettings,
  normalizeProductionVisualComfort,
  normalizeProductionWashSettings,
  normalizeLaserDmxSettings,
  resolveLaserDmxFixtureCapabilities,
} from '../LaserDmxProductionRig'
import type { ProductionOutputFrame, ProductionRig } from '../LaserDmxProductionRig'
import { inferSpatialFixtureSemantic, personalizeRgbw } from '../../../../features/personalization/laserDmxPersonalization'
import { evaluateMovingHeadFixture } from './LaserDmxMovingHeadEngine'
import {
  evaluateLedSegmentFrame,
  evaluateProductionChase,
  evaluateProductionFlashPattern,
} from './LaserDmxFlashPatternEngine'

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

const VIRTUAL_COLOR_WHEEL_RGB: Readonly<Record<string, [number, number, number]>> = {
  open: [255, 255, 255],
  white: [255, 255, 255],
  red: [255, 36, 28],
  green: [32, 255, 96],
  blue: [40, 92, 255],
  cyan: [0, 235, 255],
  magenta: [255, 32, 220],
  amber: [255, 170, 32],
}

function sampleVirtualColorWheel(slots: readonly string[], slotIndex: number): [number, number, number] {
  const slot = slots[Math.max(0, Math.min(slots.length - 1, Math.round(slotIndex)))] ?? 'open'
  return VIRTUAL_COLOR_WHEEL_RGB[slot.toLowerCase()] ?? [255, 255, 255]
}

function parseHexColor(value: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : 'ffffff'
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function colorTemperatureToRgb(kelvin: number): [number, number, number] {
  const temperature = clamp(kelvin, 1000, 20000) / 100
  const red = temperature <= 66 ? 255 : 329.698727446 * Math.pow(temperature - 60, -0.1332047592)
  const green = temperature <= 66
    ? 99.4708025861 * Math.log(Math.max(1, temperature)) - 161.1195681661
    : 288.1221695283 * Math.pow(temperature - 60, -0.0755148492)
  const blue = temperature >= 66 ? 255 : temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307
  return [clamp255(red), clamp255(green), clamp255(blue)]
}

function colorString(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp01(alpha).toFixed(3)})`
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
  iris:          number   // 0–1
  frost:         number   // 0–1
  colorWheelSlot:number
  goboIndex:     number
  goboRotation:  number
  prismFacets:   number
  prismRotation: number
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
  atmosphericOutput:number
  trigger:number
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
  visualComfort:   ReturnType<typeof normalizeProductionVisualComfort>
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
  visualComfort:   ReturnType<typeof normalizeProductionVisualComfort>
  blackout:        boolean
}

export interface CompiledLaserDmxResult {
  global:        CompiledGlobal
  fixtures:      LaserDmxFixtureFrame[]
  productionRig: ProductionRig
  outputFrame:   ProductionOutputFrame
}

function fixtureStateFromFixture(f: LaserDmxFixture): FixtureRenderState {
  const movingHead = normalizeProductionMovingHeadSettings(f.movingHead)
  return {
    dimmer:          clamp01(safeNumber(f.beam.dimmer, 1)),
    shutterOpen:     f.beam.shutterOpen !== false,
    width:           clamp(safeNumber(f.beam.width, 1), 0.2, 8),
    zoom:            clamp01(safeNumber(f.beam.zoom, 1)),
    focus:           clamp01(safeNumber(f.beam.focus, 1)),
    iris:            clamp01(safeNumber(movingHead.iris, 1)),
    frost:           clamp01(safeNumber(movingHead.frost, 0)),
    colorWheelSlot:  Math.max(0, Math.round(safeNumber(movingHead.colorWheelSlot, 0))),
    goboIndex:       Math.max(0, Math.round(safeNumber(movingHead.goboIndex, 0))),
    goboRotation:    safeNumber(movingHead.goboRotation, 0),
    prismFacets:     Math.max(0, Math.round(safeNumber(movingHead.prismFacets, 0))),
    prismRotation:   safeNumber(movingHead.prismRotation, 0),
    strobeRate:      clamp01(safeNumber(f.beam.strobeRate, 0)),
    flickerAmount:   clamp01(safeNumber(f.beam.flickerAmount, 0)),
    red:             clamp255(safeNumber(f.color.red, 0)),
    green:           clamp255(safeNumber(f.color.green, 255)),
    blue:            clamp255(safeNumber(f.color.blue, 220)),
    white:           clamp255(safeNumber(f.color.white, 0)),
    alpha:           clamp01(safeNumber(f.color.alpha, 1)),
    pan:             safeNumber(f.movingHead?.panDeg, f.position.pan),
    tilt:            safeNumber(f.movingHead?.tiltDeg, f.position.tilt),
    rotation:        safeNumber(f.position.rotation, 0),
    scanSpeed:       clamp(safeNumber(f.path.scanSpeed, 0.45), 0, 4),
    pathProgress:    clamp01(safeNumber(f.path.pathProgress, 0)),
    pathScale:       clamp(safeNumber(f.path.scale, 1), 0.01, 4),
    pathRotation:    safeNumber(f.path.rotation, 0),
    pathSpread:      clamp01(safeNumber(f.path.spread, 0.6)),
    pathRadius:      clamp01(safeNumber(f.path.radius, 0.4)),
    pathComplexity:  clamp01(safeNumber(f.path.complexity, 0.4)),
    atmosphericOutput: clamp01(safeNumber(f.atmospheric?.outputLevel, 0)),
    trigger: clamp01((f.atmospheric?.triggerRequestId ?? 0) > 0 ? 1 : 0),
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
    case 'focus':           state.focus            = clamp01(applyF(state.focus));           break
    case 'iris':            state.iris             = clamp01(applyF(state.iris));            break
    case 'frost':           state.frost            = clamp01(applyF(state.frost));           break
    case 'goboRotation':    state.goboRotation     = lerp(-180, 180, v);                     break
    case 'prismRotation':   state.prismRotation    = lerp(-180, 180, v);                     break
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
): Record<string, number> | null {
  return compileProfileChannels(profile, {
    dimmer:        clamp255(state.dimmer * global.masterDimmer * 255),
    shutter:       state.shutterOpen ? 255 : 0,
    strobe:        clamp255(state.strobeRate * 255),
    red:           clamp255(state.red),
    green:         clamp255(state.green),
    blue:          clamp255(state.blue),
    white:         clamp255(state.white),
    pan:           clamp255((state.pan + 180) / 360 * 255),
    tilt:          clamp255((state.tilt + 90) / 180 * 255),
    zoom:          clamp255(state.zoom * 255),
    focus:         clamp255(state.focus * 255),
    iris:          clamp255(state.iris * 255),
    frost:         clamp255(state.frost * 255),
    colorWheel:    clamp255(state.colorWheelSlot / 15 * 255),
    gobo:          clamp255(state.goboIndex / 15 * 255),
    goboRotation:  clamp255((state.goboRotation + 180) / 360 * 255),
    prism:         clamp255(state.prismFacets / 16 * 255),
    prismRotation: clamp255((state.prismRotation + 180) / 360 * 255),
    rotation:      clamp255((state.rotation + 180) / 360 * 255),
    scanSpeed:     clamp255(state.scanSpeed / 4 * 255),
    pathComplexity: clamp255(state.pathComplexity * 255),
    atmosphericOutput: clamp255(state.atmosphericOutput * 255),
    trigger:       clamp255(state.trigger * 255),
    zero:          0,
  })
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
  const { settings: settingsInput, mi, time, timeSec, canvasWidth: W, canvasHeight: H, personalization } = inp
  const settings = normalizeLaserDmxSettings(settingsInput)
  const productionRig = buildProductionRig(settings)
  if (!W || !H) {
    const fixtures: LaserDmxFixtureFrame[] = []
    return {
      global: buildPassthroughGlobal(settings),
      fixtures,
      productionRig,
      outputFrame: createProductionOutputFrame(productionRig, timeSec, fixtures),
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
    visualComfort:   normalizeProductionVisualComfort(settings.visualComfort),
  }

  if (settings.blackout) {
    resetAllEnvelopes()
    const fixtures: LaserDmxFixtureFrame[] = []
    return {
      global: { ...globalState, blackout: true },
      fixtures,
      productionRig,
      outputFrame: createProductionOutputFrame(productionRig, timeSec, fixtures),
    }
  }

  // Collect active fixture IDs to prune stale envelope entries
  const activeEnvKeys = new Set<string>()

  const frames: LaserDmxFixtureFrame[] = []

  const rigFixtureById = new Map(productionRig.fixtures.map(fixture => [fixture.id, fixture]))
  const rigTargetById = new Map(productionRig.targets.map(target => [target.id, target]))
  const bpm = safeNumber(mi.rhythm?.bpm, 120)

  for (let fixtureIdx = 0; fixtureIdx < settings.fixtures.length; fixtureIdx++) {
    const fixture = settings.fixtures[fixtureIdx]
    if (!fixture.enabled) continue
    const profile = getLaserDmxFixtureProfile(fixture.dmx.profileId)
    const capabilities = resolveLaserDmxFixtureCapabilities(fixture)
    if (!profile || !capabilities) continue
    const fixtureKind = profile.fixtureKind

    const fState = fixtureStateFromFixture(fixture)
    const gState: GlobalRenderState = { ...globalState, visualComfort: { ...globalState.visualComfort } }

    for (const route of fixture.modulationRoutes) {
      const envKey = `sf:${fixture.id}:${route.id}`
      activeEnvKeys.add(envKey)
      applyRoute(route, fState, gState, mi, fixture.id, dt)
    }

    if (!capabilities.dimmer) fState.dimmer = 1
    if (!capabilities.shutter) fState.shutterOpen = true
    if (!capabilities.strobe) fState.strobeRate = 0
    if (!capabilities.panTilt) { fState.pan = 0; fState.tilt = 0 }
    if (!capabilities.zoom) fState.zoom = 1
    if (!capabilities.focus) fState.focus = 1
    if (!capabilities.iris) fState.iris = 1
    if (!capabilities.frost) fState.frost = 0
    if (!capabilities.gobo) { fState.goboIndex = 0; fState.goboRotation = 0 }
    if (!capabilities.prism) { fState.prismFacets = 0; fState.prismRotation = 0 }
    if (capabilities.color?.mode !== 'colorWheel') fState.colorWheelSlot = 0
    if (!capabilities.beamPattern) {
      fState.scanSpeed = 0
      fState.pathProgress = 1
      fState.pathScale = 1
      fState.pathRotation = 0
      fState.pathSpread = 0
      fState.pathRadius = 0
      fState.pathComplexity = 0
    }
    if (capabilities.color?.mode !== 'rgbw') fState.white = 0

    const movingHeadKind = isMovingHeadFixtureKind(fixtureKind)
    const authoredMovingHead = movingHeadKind ? normalizeProductionMovingHeadSettings(fixture.movingHead) : null
    const movingHeadFrame = movingHeadKind
      ? evaluateMovingHeadFixture({
          fixture: { ...fixture, fixtureKind },
          rig: productionRig,
          timeSec,
          bpm,
          shutterOpen: fState.shutterOpen,
          panModulationDeg: fState.pan - authoredMovingHead!.panDeg,
          tiltModulationDeg: fState.tilt - authoredMovingHead!.tiltDeg,
        })
      : null
    if (movingHeadFrame) {
      fState.pan = movingHeadFrame.panDeg
      fState.tilt = movingHeadFrame.tiltDeg
    }

    fState.dimmer = clamp01(fState.dimmer * gState.safetyClamp)
    const effectiveMaster = clamp01(gState.masterDimmer)

    const chaseGroup = productionRig.groups.find(group => group.chase?.enabled && group.fixtureIds.includes(fixture.id))
    const chaseIndex = chaseGroup ? chaseGroup.fixtureIds.indexOf(fixture.id) : fixtureIdx
    const chaseCount = chaseGroup ? chaseGroup.fixtureIds.length : settings.fixtures.length
    const chaseLevel = chaseGroup
      ? evaluateProductionChase(chaseGroup.chase, chaseIndex, chaseCount, timeSec, bpm)
      : 1
    const effectiveIntensity = clamp01(fState.dimmer * effectiveMaster * chaseLevel)
    if ((!fState.shutterOpen || effectiveIntensity < 0.001) && !movingHeadFrame) continue

    const effectiveStrobeRate = clamp01(fState.strobeRate + gState.globalStrobeRate)
    const authoredFlash = normalizeProductionFlashPattern(fixture.flashPattern)
    const legacyFlash = capabilities.strobe && !authoredFlash.enabled && effectiveStrobeRate > 0.001
      ? normalizeProductionFlashPattern({
          ...authoredFlash,
          enabled: true,
          pattern: 'sustainedStrobe',
          durationBeats: 128,
          rateHz: lerp(1, 18, effectiveStrobeRate),
          repeat: { mode: 'loop', count: 1, intervalBeats: 128 },
          quantize: 'none',
          whiteAccent: false,
        })
      : authoredFlash
    const evaluatedFlash = capabilities.strobe && legacyFlash.enabled
      ? evaluateProductionFlashPattern({
          settings: legacyFlash,
          timeSec,
          bpm,
          fixtureIndex: chaseIndex,
          fixtureCount: chaseCount,
          comfort: gState.visualComfort,
        })
      : null
    const flashSuppressed = Boolean(legacyFlash.enabled && gState.visualComfort.disableStrobe)
    // A global no-strobe preference suppresses modulation, not the underlying steady
    // wash, blinder, LED, moving-head, or laser output. Dedicated strobe fixtures go dark.
    const flash = flashSuppressed && fixtureKind !== 'strobe' ? null : evaluatedFlash
    const strobeVisible = flash
      ? fState.shutterOpen && effectiveIntensity >= 0.001 && flash.visible
      : fState.shutterOpen && effectiveIntensity >= 0.001 && resolveStrobeVisible(
          gState.visualComfort.disableStrobe ? 0 : effectiveStrobeRate,
          timeSec,
        )

    const ox = safeNumber(fixture.position.originX, 0.5) * W
    const oy = safeNumber(fixture.position.originY, 0.88) * H
    const baseTx = safeNumber(fixture.position.targetX, 0.5) * W
    const baseTy = safeNumber(fixture.position.targetY, 0.5) * H
    const panOffsetPx = (fState.pan / 180) * W * 0.35
    const tiltOffsetPx = (fState.tilt / 90) * H * 0.25
    const tx = baseTx + panOffsetPx
    const ty = baseTy + tiltOffsetPx

    const zoomScale = lerp(0.5, 1.0, clamp01(fState.zoom))
    const effectivePathScale = fState.pathScale * zoomScale

    let intensityWithFlicker = fState.shutterOpen ? effectiveIntensity : 0
    if (fState.flickerAmount > 0.001) {
      const fp = timeSec * 11.3 + fixtureIdx * 2.7
      const noise = Math.sin(fp * 11.0) * Math.sin(fp * 7.3) * Math.cos(fp * 3.1)
      intensityWithFlicker = clamp01(effectiveIntensity * Math.max(0.3, 1.0 + noise * fState.flickerAmount * 0.3))
    }
    if (flash) intensityWithFlicker = clamp01(intensityWithFlicker * flash.intensity)

    let points: LaserPoint[]
    if (movingHeadFrame || fixtureKind !== 'laserProjector') {
      points = [{ x: tx, y: ty }]
    } else {
      const rawPoints = generateLaserPath({
        originX: ox,
        originY: oy,
        targetX: tx,
        targetY: ty,
        W, H, time,
        scale: effectivePathScale,
        rotation: fState.pathRotation,
        offsetX: safeNumber(fixture.path.offsetX, 0),
        offsetY: safeNumber(fixture.path.offsetY, 0),
        scanSpeed: fState.scanSpeed,
        phaseOffset: safeNumber(fixture.path.phaseOffset, 0),
        pointCount: safeNumber(fixture.path.pointCount, 18),
        spread: fState.pathSpread,
        radius: fState.pathRadius,
        complexity: fState.pathComplexity,
        pathProgress: fState.pathProgress,
        pathKind: fixture.path.kind,
      })
      points = fState.pathProgress < 0.999 ? sliceByProgress(rawPoints, fState.pathProgress) : rawPoints
    }

    if (!movingHeadFrame && fixtureKind === 'laserProjector' && fixture.position.mirrorX) {
      points = points.map(point => ({ x: tx * 2 - point.x, y: point.y }))
    }
    if (!movingHeadFrame && fixtureKind === 'laserProjector' && fixture.position.mirrorY) {
      points = points.map(point => ({ x: point.x, y: ty * 2 - point.y }))
    }

    let r = fState.red
    let g = fState.green
    let b = fState.blue
    const colorSystem = capabilities.color
    const hasAuthoredColorPolicy = fixture.colorPolicy !== undefined
    const colorPolicy = normalizeProductionFixtureColorPolicy(fixture.colorPolicy)
    if (colorSystem?.mode === 'colorWheel') {
      ;[r, g, b] = sampleVirtualColorWheel(colorSystem.slots, fState.colorWheelSlot)
    } else if (colorSystem?.mode === 'fixedWhite') {
      ;[r, g, b] = colorTemperatureToRgb(colorSystem.colorTemperatureKelvin ?? 6500)
    } else if (colorSystem?.mode === 'fixedColor') {
      ;[r, g, b] = parseHexColor(colorSystem.color)
    } else if (fixture.color.mode === 'palette' && fState.colorCycleSpeed > 0.001) {
      const pos = ((timeSec * fState.colorCycleSpeed * 0.3) % 1 + 1) % 1
      ;[r, g, b] = samplePalette(fixture.color.paletteId || 'cyanEmerald', pos)
    } else if (fixture.color.mode === 'music') {
      const energy = clamp01(safeNumber(mi.energy?.instant, 0))
      const bass = clamp01(safeNumber(mi.bands?.bass, 0))
      r = clamp255(lerp(r, 80, bass))
      g = clamp255(lerp(g, 255, energy))
      b = clamp255(lerp(b, 220, 1 - energy * 0.5))
    } else if (fixture.color.mode === 'fixed' && fState.colorCycleSpeed > 0.001 && (colorSystem?.mode === 'rgb' || colorSystem?.mode === 'rgbw')) {
      const hueShift = ((timeSec * fState.colorCycleSpeed * 0.07) % 1 + 1) % 1
      const [cr, cg, cb] = hsvToRgb(hueShift, 0.9, 1.0)
      const blend = clamp01(fState.colorCycleSpeed * 0.4)
      r = Math.round(lerp(r, cr, blend))
      g = Math.round(lerp(g, cg, blend))
      b = Math.round(lerp(b, cb, blend))
    }

    const canPersonalize = colorSystem?.mode === 'rgb'
      || colorSystem?.mode === 'rgbw'
      || (colorSystem?.mode === 'fixedColor' && !colorPolicy.preserveFixedColor)
    const personalized = personalization && canPersonalize
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

    const impactWhite = Boolean(flash?.whiteAccent) && colorPolicy.whiteAccentPolicy !== 'off'
    const continuousWhite = colorPolicy.whiteAccentPolicy === 'continuous' ? fState.white / 255 : 0
    if (continuousWhite > 0) {
      r = lerp(r, 255, continuousWhite * colorPolicy.whiteAccentIntensity)
      g = lerp(g, 255, continuousWhite * colorPolicy.whiteAccentIntensity)
      b = lerp(b, 255, continuousWhite * colorPolicy.whiteAccentIntensity)
    }
    if (impactWhite) {
      const amount = colorPolicy.whiteAccentIntensity
      r = lerp(r, 255, amount)
      g = lerp(g, 255, amount)
      b = lerp(b, 255, amount)
    }

    const focusFactor = clamp01(safeNumber(fState.focus, 1))
    const effectiveBeamWidth = clamp(fState.width * gState.globalBeamWidth, 0.2, 8)
    const rgba = {
      r: clamp255(r),
      g: clamp255(g),
      b: clamp255(b),
      a: clamp01(fState.alpha * intensityWithFlicker),
    }
    const color = colorString([rgba.r, rgba.g, rgba.b], rgba.a)

    const channelWhite = impactWhite
      ? clamp255(255 * colorPolicy.whiteAccentIntensity)
      : (!hasAuthoredColorPolicy || colorPolicy.whiteAccentPolicy === 'continuous') ? fState.white : 0
    const channelState = {
      ...fState,
      red: rgba.r,
      green: rgba.g,
      blue: rgba.b,
      white: channelWhite,
      strobeRate: flash ? clamp01(flash.effectiveHz / Math.max(1, gState.visualComfort.maxFlashHz)) : fState.strobeRate,
    }
    const channels = compileChannels(channelState, gState, fixture.dmx.profileId)
    if (!channels) continue

    const rigFixture = rigFixtureById.get(fixture.id)
    const rigTarget = rigFixture?.targetId ? rigTargetById.get(rigFixture.targetId) : undefined
    const fallbackWorldTarget = {
      x: (tx / Math.max(1, W) - 0.5) * productionRig.stage.dimensions.width,
      y: (1 - ty / Math.max(1, H)) * productionRig.stage.dimensions.height,
      z: productionRig.stage.dimensions.depth * 0.5,
    }
    const worldTarget = movingHeadFrame?.worldTarget
      ?? (rigTarget?.kind === 'point' ? rigTarget.position : rigTarget?.center)
      ?? fallbackWorldTarget

    const washSettings = capabilities.wash ? normalizeProductionWashSettings(fixture.wash) : null
    const maxSegments = productionRig.stage.editor.qualityTier === 'low'
      ? 8
      : productionRig.stage.editor.qualityTier === 'medium' ? 16 : 32
    const ledSettings = capabilities.pixels
      ? normalizeProductionLedBarSettings(fixture.ledBar, Math.min(capabilities.pixels.maxSegments, maxSegments))
      : null
    let ledVisual: LaserDmxFixtureFrame['visual']['ledBar'] | undefined
    if (ledSettings) {
      const secondaryPersonalized = personalization && canPersonalize
        ? personalizeRgbw({
            ...ledSettings.secondaryColor,
            alpha: 1,
          }, 'other', personalization)
        : null
      const primary: [number, number, number] = [rgba.r, rgba.g, rgba.b]
      const secondary: [number, number, number] = secondaryPersonalized
        ? [secondaryPersonalized.red, secondaryPersonalized.green, secondaryPersonalized.blue]
        : [ledSettings.secondaryColor.red, ledSettings.secondaryColor.green, ledSettings.secondaryColor.blue]
      const segmentCount = ledSettings.mode === 'wholeBar' ? 1 : ledSettings.segmentCount
      const segmentFrame = evaluateLedSegmentFrame({
        count: segmentCount,
        pattern: ledSettings.pattern,
        primary,
        secondary,
        chase: ledSettings.chase,
        timeSec,
        bpm,
        seed: ledSettings.chase.seed,
      })
      ledVisual = {
        mode: ledSettings.mode,
        pattern: ledSettings.pattern,
        segmentColors: segmentFrame.colors.map(segment => colorString(segment, rgba.a)),
        segmentIntensities: segmentFrame.intensities.map(value => clamp01(value * intensityWithFlicker)),
      }
    }

    frames.push({
      fixtureId: fixture.id,
      universe: fixture.dmx.universe,
      startAddress: fixture.dmx.startAddress,
      channels,
      visual: {
        origin: { x: ox, y: oy, z: safeNumber(fixture.position.originZ, 0) },
        target: { x: tx, y: ty, z: safeNumber(fixture.position.targetZ, 0) },
        points,
        color,
        rgba,
        intensity: intensityWithFlicker,
        beamWidth: effectiveBeamWidth,
        strobeVisible,
        focusFactor,
        ...(flash ? {
          flash: {
            pattern: legacyFlash.pattern,
            intensity: flash.intensity,
            whiteAccent: impactWhite,
            blackout: flash.blackout,
            comfortLimited: flash.comfortLimited,
            effectiveHz: flash.effectiveHz,
            warning: flash.warning,
          },
        } : {}),
        ...(washSettings ? {
          wash: {
            worldTarget,
            spread: washSettings.spread,
            softness: washSettings.softness,
            atmosphericIntensity: washSettings.atmosphericIntensity,
          },
        } : {}),
        ...(ledVisual ? { ledBar: ledVisual } : {}),
        ...(movingHeadFrame ? {
          movingHead: {
            panDeg: movingHeadFrame.panDeg,
            tiltDeg: movingHeadFrame.tiltDeg,
            movementComplete: movingHeadFrame.movementComplete,
            targetAvailable: movingHeadFrame.targetAvailable,
            worldTarget: movingHeadFrame.worldTarget,
            zoom: fState.zoom,
            focus: fState.focus,
            iris: fState.iris,
            frost: fState.frost,
            goboIndex: fState.goboIndex,
            goboRotation: fState.goboRotation,
            prismFacets: fState.prismFacets,
            prismRotation: fState.prismRotation,
            colorWheelSlot: fState.colorWheelSlot,
          },
        } : {}),
      },
    })
  }

  // Prune stale envelope entries (routes that no longer exist)
  pruneEnvelopes(activeEnvKeys)

  return {
    global: { ...globalState, blackout: false },
    fixtures: frames,
    productionRig,
    outputFrame: createProductionOutputFrame(productionRig, timeSec, frames),
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
    visualComfort:   normalizeProductionVisualComfort(settings.visualComfort),
    blackout:        settings.blackout ?? false,
  }
}
