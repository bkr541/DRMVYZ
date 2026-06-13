/**
 * Beam Matrix frame compiler.
 * Produces CompiledLaserDmxBeamMatrixResult from BeamMatrixSettings + MI data.
 *
 * Never writes to Zustand.
 * The saved beam objects are never mutated — coordinate offsets from modulation
 * routes are accumulated into temporary fields and discarded after compilation.
 * All output values are guaranteed finite (NaN/Infinity replaced before output).
 *
 * Compilation order per beam:
 *   1. Beam base settings
 *   2. Matrix global output settings
 *   3. Global modulation routes (modify global output and fog state)
 *   4. Reaction group: enabled / muted / solo gate
 *   5. Reaction group color override
 *   6. Reaction group modulation routes (compiled once per group per frame)
 *   7. Beam-level modulation routes
 *   8. Safety clamp
 *   9. Strobe + flicker visibility
 *  10. Final finite-value validation
 *
 * Group solo behaviour:
 *   - When one or more groups are soloed, only beams in soloed groups render.
 *   - Ungrouped beams are HIDDEN during solo (documented choice: avoids confusion
 *     about which group is being isolated).
 *   - When no group is soloed, all non-muted enabled groups and ungrouped beams render.
 */

import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxMatrixBeam,
  LaserDmxReactionGroup,
  LaserDmxMatrixBeamGeometry,
  LaserDmxFogSettings,
} from '../ReactTypes'
import {
  safeNumber,
  clamp,
  clamp01,
  clamp255,
  lerp,
  resolveStrobeVisible,
  applyModulationRoute,
  modeApply,
  pruneEnvelopes,
  resetAllEnvelopes,
} from './LaserDmxModulationEngine'
import {
  gridAnchorToCanvas,
  targetToCanvas,
  zDepthFactors,
} from './LaserDmxBeamGeometry'

// ── Public result types ───────────────────────────────────────────────────────

export interface CompiledLaserDmxMatrixBeam {
  beamId:  string
  groupId: string | null

  /** Canvas pixels (may include temporary modulation offsets). */
  origin: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number; offscreen: boolean }

  rgba: { r: number; g: number; b: number; a: number }
  /** Pre-built CSS rgba string for reuse in fills. */
  colorCss: string

  /** Final 0–1 intensity (dimmer × masterDimmer × safety, after modulation). */
  intensity: number
  /** Effective pixel width (includes globalBeamWidth). */
  beamWidth: number
  /** 0–1 cone expansion factor. */
  divergence: number
  /** 0–1 focus sharpness (1=sharp, 0=diffuse). */
  focus: number
  /** 0–1 glow multiplier (combined beam + global). */
  glow: number
  /** False when strobe is in its "off" phase. */
  strobeVisible: boolean
  /** ≈1.0 ± deterministic noise from flickerAmount. */
  flickerMultiplier: number
  geometry: LaserDmxMatrixBeamGeometry
}

export interface CompiledLaserDmxBeamMatrixOutput {
  masterDimmer:     number
  blackout:         boolean
  backgroundFade:   number
  beamPersistence:  number
  globalBeamWidth:  number
  globalGlow:       number
  globalStrobeRate: number
  safetyClamp:      number
}

export interface CompiledLaserDmxFog extends LaserDmxFogSettings {}

export interface CompiledLaserDmxBeamMatrixResult {
  output: CompiledLaserDmxBeamMatrixOutput
  fog:    CompiledLaserDmxFog
  beams:  CompiledLaserDmxMatrixBeam[]
}

// ── Compiler input ────────────────────────────────────────────────────────────

export interface CompileLaserDmxBeamMatrixInput {
  settings:     LaserDmxBeamMatrixSettings
  mi:           MusicIntelligenceFrame
  time:         number   // animation tick for flicker
  timeSec:      number   // wall-clock seconds for strobe / envelopes
  canvasWidth:  number
  canvasHeight: number
}

// ── Module-level ephemeral state ──────────────────────────────────────────────

let prevTimeSec = -1

/** Reset compiler time reference and all trigger envelopes.
 *  Call when the Beam Matrix stops rendering (playback gate fires). */
export function resetBeamMatrixCompilerState(): void {
  prevTimeSec = -1
  resetAllEnvelopes()
}

// ── Internal mutable state types ──────────────────────────────────────────────

interface GlobalBMState {
  masterDimmer:     number
  backgroundFade:   number
  beamPersistence:  number
  globalBeamWidth:  number
  globalGlow:       number
  globalStrobeRate: number
  safetyClamp:      number
  // Fog properties that global routes can modulate
  fogDensity:       number
  fogOpacity:       number
  fogBeamScatter:   number
  fogTurbulence:    number
}

/**
 * Compiled result for one reaction group.
 * Group routes are applied once per group, then re-used for every beam in the group.
 *
 * For 'set' / 'trigger' route modes: the value REPLACES the beam's saved value.
 * For 'add' mode: the value is a delta to add on top of the beam's value.
 * For 'multiply' mode: the value is a scale applied to the beam's value.
 *
 * Unset fields (null) mean no group route targets that parameter →
 * the beam's own saved value is used.
 */
interface GroupFrame {
  /** false = skip all beams in this group (disabled / muted / not-soloed). */
  active: boolean

  // Null = no group route targets this parameter (beam uses its saved value).
  dimmer:         number | null  // 0–1 override
  beamWidth:      number | null  // 0–6 absolute px width
  beamDivergence: number | null  // 0–1 override
  beamGlow:       number | null  // 0–1 override
  strobeRate:     number | null  // 0–1 override

  // Color: only applied when group.colorOverrideEnabled
  colorR: number; colorG: number; colorB: number; colorA: number
  hasColorOverride: boolean
}

// ── Group-route compilation ───────────────────────────────────────────────────

function compileGroupRoutes(
  group:    LaserDmxReactionGroup,
  mi:       MusicIntelligenceFrame,
  dt:       number,
  activeKeys: Set<string>,
): Pick<GroupFrame, 'dimmer' | 'beamWidth' | 'beamDivergence' | 'beamGlow' | 'strobeRate'> {
  let dimmer: number | null = null
  let beamWidth: number | null = null
  let beamDivergence: number | null = null
  let beamGlow: number | null = null
  let strobeRate: number | null = null

  for (const route of group.modulationRoutes) {
    if (!route.enabled) continue
    const envKey = `bmg:${group.id}:${route.id}`
    activeKeys.add(envKey)
    const result = applyModulationRoute(route, mi, envKey, dt)
    if (!result) continue
    const v = clamp01(result.value)

    switch (route.target) {
      case 'dimmer':
        dimmer = dimmer === null
          ? v
          : clamp01(modeApply(dimmer, v, route.mode))
        break
      case 'beamWidth':
        // Map [0,1] to [0.2, 6] via min/max stored in route
        beamWidth = lerp(
          clamp(safeNumber(route.min, 0.2), 0.2, 6),
          clamp(safeNumber(route.max, 3),   0.2, 6),
          v,
        )
        break
      case 'beamDivergence':
        beamDivergence = beamDivergence === null
          ? v
          : clamp01(modeApply(beamDivergence, v, route.mode))
        break
      case 'beamGlow':
        beamGlow = beamGlow === null
          ? v
          : clamp01(modeApply(beamGlow, v, route.mode))
        break
      case 'strobeRate':
        strobeRate = strobeRate === null
          ? v
          : clamp01(modeApply(strobeRate ?? 0, v, route.mode))
        break
      default: break
    }
  }

  return { dimmer, beamWidth, beamDivergence, beamGlow, strobeRate }
}

// ── Global-route application ──────────────────────────────────────────────────

function applyGlobalRoute(
  target: string,
  v:      number,
  mode:   string,
  gs:     GlobalBMState,
): void {
  switch (target) {
    case 'masterDimmer':     gs.masterDimmer     = clamp01(modeApply(gs.masterDimmer,     v, mode)); break
    case 'backgroundFade':   gs.backgroundFade   = clamp01(modeApply(gs.backgroundFade,   v, mode)); break
    case 'beamPersistence':  gs.beamPersistence  = clamp01(modeApply(gs.beamPersistence,  v, mode)); break
    case 'globalBeamWidth':  gs.globalBeamWidth  = clamp(modeApply(gs.globalBeamWidth,  v, mode), 0.1, 6); break
    case 'globalGlow':       gs.globalGlow       = clamp01(modeApply(gs.globalGlow,       v, mode)); break
    case 'globalStrobeRate': gs.globalStrobeRate = clamp01(modeApply(gs.globalStrobeRate, v, mode)); break
    case 'fogDensity':       gs.fogDensity       = clamp01(modeApply(gs.fogDensity,       v, mode)); break
    case 'fogOpacity':       gs.fogOpacity       = clamp01(modeApply(gs.fogOpacity,       v, mode)); break
    case 'fogBeamScatter':   gs.fogBeamScatter   = clamp01(modeApply(gs.fogBeamScatter,   v, mode)); break
    case 'fogTurbulence':    gs.fogTurbulence    = clamp01(modeApply(gs.fogTurbulence,    v, mode)); break
    default: break
  }
}

// ── Beam-route application ────────────────────────────────────────────────────

/** Mutable per-beam working state. */
interface BeamState {
  dimmer:         number
  beamWidth:      number
  beamDivergence: number
  focus:          number
  glow:           number
  strobeRate:     number
  flickerAmount:  number
  r: number; g: number; b: number; a: number
  // Compiled-only coordinate deltas — never written to the saved beam.
  originDX: number; originDY: number
  targetDX: number; targetDY: number
}

function applyBeamRoute(
  target: string,
  v:      number,
  mode:   string,
  bs:     BeamState,
): void {
  switch (target) {
    case 'dimmer':         bs.dimmer         = clamp01(modeApply(bs.dimmer,         v, mode)); break
    case 'beamWidth':      bs.beamWidth      = clamp(modeApply(bs.beamWidth,      v, mode), 0.1, 8); break
    case 'beamDivergence': bs.beamDivergence = clamp01(modeApply(bs.beamDivergence, v, mode)); break
    case 'focus':          bs.focus          = clamp01(modeApply(bs.focus,          v, mode)); break
    case 'glow':           bs.glow           = clamp01(modeApply(bs.glow,           v, mode)); break
    case 'strobeRate':     bs.strobeRate     = clamp01(modeApply(bs.strobeRate,     v, mode)); break
    case 'flickerAmount':  bs.flickerAmount  = clamp01(modeApply(bs.flickerAmount,  v, mode)); break
    case 'alpha':          bs.a              = clamp01(modeApply(bs.a,              v, mode)); break
    case 'red':            bs.r              = clamp255(modeApply(bs.r / 255, v, mode) * 255); break
    case 'green':          bs.g              = clamp255(modeApply(bs.g / 255, v, mode) * 255); break
    case 'blue':           bs.b              = clamp255(modeApply(bs.b / 255, v, mode) * 255); break
    case 'white': {
      // White channel: add to all RGB channels
      const w = clamp01(v) * 255
      bs.r = clamp255(bs.r + w)
      bs.g = clamp255(bs.g + w)
      bs.b = clamp255(bs.b + w)
      break
    }
    // Coordinate offsets (normalized canvas fractions → pixel deltas applied at output time)
    case 'originOffsetX':  bs.originDX       = v * 200; break  // ±200px max drift
    case 'originOffsetY':  bs.originDY       = v * 200; break
    case 'targetOffsetX':  bs.targetDX       = v * 200; break
    case 'targetOffsetY':  bs.targetDY       = v * 200; break
    default: break
  }
}

// ── Main compiler entry point ─────────────────────────────────────────────────

export function compileLaserDmxBeamMatrix(
  inp: CompileLaserDmxBeamMatrixInput,
): CompiledLaserDmxBeamMatrixResult {
  const { settings, mi, time, timeSec, canvasWidth: W, canvasHeight: H } = inp

  const empty = (): CompiledLaserDmxBeamMatrixResult => ({
    output: buildOutputFromSettings(settings),
    fog:    { ...settings.fog },
    beams:  [],
  })

  if (!W || !H) return empty()

  // ── dt ───────────────────────────────────────────────────────────────────
  const dt = prevTimeSec >= 0
    ? clamp(timeSec - prevTimeSec, 0.001, 0.1)
    : 1 / 60
  prevTimeSec = timeSec

  // ── 1. Global output base state ──────────────────────────────────────────
  const o = settings.output
  const gs: GlobalBMState = {
    masterDimmer:     clamp01(safeNumber(o.masterDimmer,     0.85)),
    backgroundFade:   clamp01(safeNumber(o.backgroundFade,   0.18)),
    beamPersistence:  clamp01(safeNumber(o.beamPersistence,  0.60)),
    globalBeamWidth:  clamp(safeNumber(o.globalBeamWidth,    1),    0.1, 6),
    globalGlow:       clamp01(safeNumber(o.globalGlow,        0.65)),
    globalStrobeRate: clamp01(safeNumber(o.globalStrobeRate,  0)),
    safetyClamp:      clamp01(safeNumber(o.safetyClamp,       0.90)),
    fogDensity:       clamp01(safeNumber(settings.fog.density,  0.4)),
    fogOpacity:       clamp01(safeNumber(settings.fog.opacity,  0.5)),
    fogBeamScatter:   clamp01(safeNumber(settings.fog.beamScatter, 0.2)),
    fogTurbulence:    clamp01(safeNumber(settings.fog.turbulence,  0.2)),
  }

  // Blackout short-circuit
  if (o.blackout) {
    resetAllEnvelopes()
    return {
      output: { ...buildOutputFromSettings(settings), blackout: true },
      fog:    { ...settings.fog },
      beams:  [],
    }
  }

  const activeKeys = new Set<string>()

  // ── 2. Global modulation routes ──────────────────────────────────────────
  for (const route of settings.globalModulationRoutes) {
    if (!route.enabled) continue
    const envKey = `bmgl:${route.id}`
    activeKeys.add(envKey)
    const result = applyModulationRoute(route, mi, envKey, dt)
    if (!result) continue
    applyGlobalRoute(route.target, clamp01(result.value), route.mode, gs)
  }

  // ── 3. Solo detection ────────────────────────────────────────────────────
  const hasSolo = settings.groups.some(g => g.soloed && g.enabled && !g.muted)

  // ── 4. Compile group frames (once per group) ─────────────────────────────
  const groupFrames = new Map<string, GroupFrame>()
  for (const group of settings.groups) {
    const routeMods = compileGroupRoutes(group, mi, dt, activeKeys)

    // Determine active / silent
    let active = group.enabled && !group.muted
    if (hasSolo && !group.soloed) active = false

    // Color override: use group.color when enabled
    const col = group.color
    const hasColorOverride = group.colorOverrideEnabled

    groupFrames.set(group.id, {
      active,
      ...routeMods,
      colorR: clamp255(safeNumber(col.red,   255)),
      colorG: clamp255(safeNumber(col.green, 255)),
      colorB: clamp255(safeNumber(col.blue,  255)),
      colorA: clamp01(safeNumber(col.alpha,  1)),
      hasColorOverride,
    })
  }

  // ── 5. Build group lookup map for beam → group resolution ────────────────
  const groupMap = new Map<string, LaserDmxReactionGroup>(
    settings.groups.map(g => [g.id, g])
  )

  // ── 6. Compile beams ──────────────────────────────────────────────────────
  const compiled: CompiledLaserDmxMatrixBeam[] = []

  for (let bi = 0; bi < settings.beams.length; bi++) {
    const beam = settings.beams[bi]
    if (!beam.enabled) continue

    // ── Group gate ─────────────────────────────────────────────────────────
    let gf: GroupFrame | null = null
    if (beam.groupId) {
      gf = groupFrames.get(beam.groupId) ?? null
      if (!gf || !gf.active) continue
    } else if (hasSolo) {
      // Ungrouped beams hidden during solo
      continue
    }

    // ── Beam working state (init from saved values) ────────────────────────
    const app = beam.appearance
    const col = beam.color

    const bs: BeamState = {
      dimmer:         clamp01(safeNumber(app.dimmer,        1)),
      beamWidth:      clamp(safeNumber(app.width,           1), 0.1, 8),
      beamDivergence: clamp01(safeNumber(app.divergence,    0.15)),
      focus:          clamp01(safeNumber(app.focus,         1)),
      glow:           clamp01(safeNumber(app.glow,          0.65)),
      strobeRate:     clamp01(safeNumber(app.strobeRate,    0)),
      flickerAmount:  clamp01(safeNumber(app.flickerAmount, 0)),
      r: clamp255(safeNumber(col.red,   0)),
      g: clamp255(safeNumber(col.green, 255)),
      b: clamp255(safeNumber(col.blue,  220)),
      a: clamp01(safeNumber(col.alpha,  1)),
      originDX: 0, originDY: 0,
      targetDX: 0, targetDY: 0,
    }

    // ── Apply group color override ─────────────────────────────────────────
    if (gf && beam.useGroupColor && gf.hasColorOverride) {
      bs.r = gf.colorR
      bs.g = gf.colorG
      bs.b = gf.colorB
      bs.a = gf.colorA
    }

    // ── Apply group route results ──────────────────────────────────────────
    if (gf) {
      if (gf.dimmer         !== null) bs.dimmer         = gf.dimmer
      if (gf.beamWidth      !== null) bs.beamWidth      = gf.beamWidth
      if (gf.beamDivergence !== null) bs.beamDivergence = gf.beamDivergence
      if (gf.beamGlow       !== null) bs.glow           = gf.beamGlow
      if (gf.strobeRate     !== null) bs.strobeRate     = gf.strobeRate
    }

    // ── Apply beam-level modulation routes ────────────────────────────────
    if (!app.shutterOpen) bs.dimmer = 0
    for (const route of beam.modulationRoutes) {
      if (!route.enabled) continue
      const envKey = `bm:${beam.id}:${route.id}`
      activeKeys.add(envKey)
      const result = applyModulationRoute(route, mi, envKey, dt)
      if (!result) continue
      applyBeamRoute(route.target, clamp01(result.value), route.mode, bs)
    }

    // ── Safety clamp ──────────────────────────────────────────────────────
    bs.dimmer = clamp01(bs.dimmer * gs.safetyClamp)

    // ── Intensity (dimmer × master) ───────────────────────────────────────
    const baseIntensity = clamp01(bs.dimmer * gs.masterDimmer)
    if (baseIntensity < 0.001) continue

    // ── Strobe ────────────────────────────────────────────────────────────
    const effectiveStrobe = clamp01(bs.strobeRate + gs.globalStrobeRate)
    const strobeVisible   = resolveStrobeVisible(effectiveStrobe, timeSec)

    // ── Flicker (deterministic, no Math.random) ───────────────────────────
    let flickerMultiplier = 1
    if (bs.flickerAmount > 0.001) {
      const fp = timeSec * 11.3 + bi * 2.7
      const noise = Math.sin(fp * 11.0) * Math.sin(fp * 7.3) * Math.cos(fp * 3.1)
      flickerMultiplier = Math.max(0.3, 1.0 + noise * bs.flickerAmount * 0.3)
    }

    const intensity = clamp01(baseIntensity * flickerMultiplier)

    // ── Coordinate compilation ────────────────────────────────────────────
    const originBase = gridAnchorToCanvas(
      beam.origin.column, beam.origin.row, beam.origin.z, W, H,
    )
    const targetBase = targetToCanvas(beam.target, W, H)

    // Apply modulation coordinate offsets (temporary — never saved)
    const originX = originBase.x + bs.originDX
    const originY = originBase.y + bs.originDY
    const targetX = targetBase.x + bs.targetDX
    const targetY = targetBase.y + bs.targetDY

    // ── Z-depth factors ───────────────────────────────────────────────────
    const { widthScale: oWS, intensityScale: oIS } = zDepthFactors(originBase.z)
    const { widthScale: tWS }                       = zDepthFactors(targetBase.z)
    const avgWidthScale = (oWS + tWS) / 2
    const finalIntensity = clamp01(intensity * oIS)

    // ── Effective beam width ──────────────────────────────────────────────
    const effectiveWidth = clamp(
      bs.beamWidth * gs.globalBeamWidth * avgWidthScale,
      0.2, 8,
    )

    // ── Effective glow ────────────────────────────────────────────────────
    const effectiveGlow = clamp01(bs.glow * gs.globalGlow)

    // ── RGBA + CSS ────────────────────────────────────────────────────────
    const rgba = {
      r: clamp255(bs.r),
      g: clamp255(bs.g),
      b: clamp255(bs.b),
      a: clamp01(bs.a * finalIntensity),
    }
    const colorCss = `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a.toFixed(3)})`

    // ── Offscreen detection for (possibly-offset) target ──────────────────
    const targetOffscreen = targetX < 0 || targetX > W || targetY < 0 || targetY > H

    // ── Final finite validation ────────────────────────────────────────────
    const safeF = (v: number, fb: number) => Number.isFinite(v) ? v : fb

    compiled.push({
      beamId:  beam.id,
      groupId: beam.groupId,

      origin: {
        x: safeF(originX, 0), y: safeF(originY, 0), z: safeF(originBase.z, 0),
      },
      target: {
        x: safeF(targetX, W / 2), y: safeF(targetY, H / 2),
        z: safeF(targetBase.z, 0), offscreen: targetOffscreen,
      },

      rgba,
      colorCss,

      intensity:         safeF(finalIntensity, 0),
      beamWidth:         safeF(effectiveWidth, 1),
      divergence:        safeF(bs.beamDivergence, 0.15),
      focus:             safeF(bs.focus, 1),
      glow:              safeF(effectiveGlow, 0.65),
      strobeVisible,
      flickerMultiplier: safeF(flickerMultiplier, 1),
      geometry:          app.geometry ?? 'line',
    })
  }

  // ── Prune stale envelopes ─────────────────────────────────────────────────
  pruneEnvelopes(activeKeys)

  // ── Assemble compiled fog (with global-route overrides) ───────────────────
  const fog: CompiledLaserDmxFog = {
    ...settings.fog,
    density:     gs.fogDensity,
    opacity:     gs.fogOpacity,
    beamScatter: gs.fogBeamScatter,
    turbulence:  gs.fogTurbulence,
  }

  return {
    output: {
      masterDimmer:     gs.masterDimmer,
      blackout:         false,
      backgroundFade:   gs.backgroundFade,
      beamPersistence:  gs.beamPersistence,
      globalBeamWidth:  gs.globalBeamWidth,
      globalGlow:       gs.globalGlow,
      globalStrobeRate: gs.globalStrobeRate,
      safetyClamp:      gs.safetyClamp,
    },
    fog,
    beams: compiled,
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function buildOutputFromSettings(
  settings: LaserDmxBeamMatrixSettings,
): CompiledLaserDmxBeamMatrixOutput {
  const o = settings.output
  return {
    masterDimmer:     clamp01(safeNumber(o.masterDimmer,     0.85)),
    blackout:         o.blackout ?? false,
    backgroundFade:   clamp01(safeNumber(o.backgroundFade,   0.18)),
    beamPersistence:  clamp01(safeNumber(o.beamPersistence,  0.60)),
    globalBeamWidth:  clamp(safeNumber(o.globalBeamWidth,    1), 0.1, 6),
    globalGlow:       clamp01(safeNumber(o.globalGlow,        0.65)),
    globalStrobeRate: clamp01(safeNumber(o.globalStrobeRate,  0)),
    safetyClamp:      clamp01(safeNumber(o.safetyClamp,       0.90)),
  }
}
