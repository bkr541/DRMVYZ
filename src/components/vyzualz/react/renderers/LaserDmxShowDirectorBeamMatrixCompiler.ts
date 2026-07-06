import {
  DEFAULT_BEAM_MOTION,
  DEFAULT_BEAM_SEQUENCE,
  DEFAULT_LAUNCH_SETTINGS,
  LASER_DMX_MATRIX_COLUMNS,
  LASER_DMX_MATRIX_MAX_BEAMS,
  LASER_DMX_MATRIX_ROWS,
} from '../ReactTypes'
import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxLaunchSettings,
  LaserDmxMatrixBeam,
  LaserDmxMatrixBeamAppearance,
  LaserDmxMatrixBeamColor,
  LaserDmxMatrixGridAnchor,
  LaserDmxMatrixTarget,
  LaserDmxModulationRoute,
  LaserDmxReactionGroup,
  LaserDmxShowDirectorAudioBand,
  LaserDmxShowDirectorBeatDivision,
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorFixtureKind,
  LaserDmxShowDirectorLedDirection,
  LaserDmxShowDirectorState,
  LaserDmxShowDirectorTriggerConfig,
} from '../ReactTypes'

export interface CompileLaserDmxShowDirectorToBeamMatrixInput {
  showDirector: LaserDmxShowDirectorState
  /** Manual Beam Matrix program supplies output/fog/editor/global modulation defaults only. */
  beamMatrix: LaserDmxBeamMatrixSettings
}

interface StagePoint01 {
  x: number
  y: number
  z: number
}

interface FixtureCompileContext {
  gridColumns: number
  gridRows: number
  matrixBeams: LaserDmxMatrixBeam[]
  groups: LaserDmxReactionGroup[]
  globalRoutes: LaserDmxModulationRoute[]
  outputBeamCount: number
  hazeIntensity: number
  hasRenderableFixture: boolean
}

const KIND_DEFAULT_COLORS: Record<LaserDmxShowDirectorFixtureKind, string> = {
  laser:      '#4ac7db',
  movingHead: '#67f7ff',
  ledBar:     '#61d6aa',
  ledTube:    '#8be9ff',
  strobe:     '#ffffff',
  blinder:    '#ffd68a',
  parWash:    '#8a7dff',
  videoWall:  '#4ac7db',
  haze:       '#9cc9d8',
  co2Jet:     '#dff8ff',
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function finite(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : Number.NaN
  return Number.isFinite(candidate) ? candidate : fallback
}

function positiveInt(value: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(finite(value, fallback))))
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 96) || 'fixture'
}

function groupIdForFixture(fixture: LaserDmxShowDirectorFixture): string {
  return `sd-group-${safeIdPart(fixture.id)}`
}

function beamIdForFixture(fixture: LaserDmxShowDirectorFixture, suffix: string): string {
  return `sd-${safeIdPart(fixture.id)}-${suffix}`
}

function parseHexColor(value: string, fallback: string): LaserDmxMatrixBeamColor {
  const hex = /^#?([0-9a-fA-F]{6})$/.exec(value.trim())?.[1]
    ?? /^#?([0-9a-fA-F]{3})$/.exec(value.trim())?.[1]?.replace(/(.)/g, '$1$1')
    ?? /^#?([0-9a-fA-F]{6})$/.exec(fallback)?.[1]
    ?? '4ac7db'
  return {
    red:   parseInt(hex.slice(0, 2), 16),
    green: parseInt(hex.slice(2, 4), 16),
    blue:  parseInt(hex.slice(4, 6), 16),
    white: 0,
    alpha: 1,
  }
}

function isSupportedFixtureKind(kind: unknown): kind is LaserDmxShowDirectorFixtureKind {
  return typeof kind === 'string' && kind in KIND_DEFAULT_COLORS
}

function hasFixtureShape(fixture: LaserDmxShowDirectorFixture): boolean {
  const candidate = fixture as Partial<LaserDmxShowDirectorFixture>
  return typeof candidate.id === 'string'
    && typeof candidate.kind === 'string'
    && typeof candidate.color === 'string'
    && typeof candidate.beam === 'object'
    && candidate.beam !== null
    && typeof candidate.trigger === 'object'
    && candidate.trigger !== null
    && typeof candidate.component === 'object'
    && candidate.component !== null
}

function colorForFixture(fixture: LaserDmxShowDirectorFixture): LaserDmxMatrixBeamColor {
  const fallback = isSupportedFixtureKind(fixture.kind) ? KIND_DEFAULT_COLORS[fixture.kind] : KIND_DEFAULT_COLORS.laser
  const color = fixture.colorMode === 'fixtureDefault' ? fallback : fixture.color
  return parseHexColor(color, fallback)
}

function warmWhiteColor(): LaserDmxMatrixBeamColor {
  return { red: 255, green: 215, blue: 142, white: 64, alpha: 1 }
}

function stagePointForFixture(
  fixture: LaserDmxShowDirectorFixture,
  gridColumns: number,
  gridRows: number,
): StagePoint01 {
  const maxX = Math.max(1, gridColumns - 1)
  const maxY = Math.max(1, gridRows - 1)
  return {
    x: clamp(finite(fixture.x, 0), 0, maxX) / maxX,
    y: clamp(finite(fixture.y, 0), 0, maxY) / maxY,
    z: clamp(finite(fixture.z, 0), -1, 1),
  }
}

function gridAnchorFromStagePoint(point: StagePoint01): LaserDmxMatrixGridAnchor {
  return {
    column: clamp(Math.round(point.x * (LASER_DMX_MATRIX_COLUMNS - 1)) + 1, 1, LASER_DMX_MATRIX_COLUMNS),
    row:    clamp(Math.round(point.y * (LASER_DMX_MATRIX_ROWS - 1)) + 1, 1, LASER_DMX_MATRIX_ROWS),
    z:      clamp(point.z, -1, 1),
  }
}

function offsetGridAnchor(anchor: LaserDmxMatrixGridAnchor, columnOffset: number, rowOffset: number): LaserDmxMatrixGridAnchor {
  return {
    column: clamp(anchor.column + columnOffset, 1, LASER_DMX_MATRIX_COLUMNS),
    row:    clamp(anchor.row + rowOffset, 1, LASER_DMX_MATRIX_ROWS),
    z:      anchor.z,
  }
}

function stageTargetFromAngle(point: StagePoint01, angleDeg: number, length = 0.55): LaserDmxMatrixTarget {
  const radians = angleDeg * Math.PI / 180
  return {
    kind: 'stage',
    x: point.x + Math.cos(radians) * length,
    y: point.y + Math.sin(radians) * length,
    z: point.z,
  }
}

function gridTargetFromFixtureTarget(
  fixture: LaserDmxShowDirectorFixture,
  gridColumns: number,
  gridRows: number,
): LaserDmxMatrixTarget {
  const maxX = Math.max(1, gridColumns - 1)
  const maxY = Math.max(1, gridRows - 1)
  const targetX = clamp(finite(fixture.beam.targetX, maxX / 2), 0, maxX) / maxX
  const targetY = clamp(finite(fixture.beam.targetY, maxY / 2), 0, maxY) / maxY
  return {
    kind: 'grid',
    column: clamp(Math.round(targetX * (LASER_DMX_MATRIX_COLUMNS - 1)) + 1, 1, LASER_DMX_MATRIX_COLUMNS),
    row:    clamp(Math.round(targetY * (LASER_DMX_MATRIX_ROWS - 1)) + 1, 1, LASER_DMX_MATRIX_ROWS),
    z:      clamp(finite(fixture.beam.targetZ, 0), -1, 1),
  }
}

function defaultAppearance(fixture: LaserDmxShowDirectorFixture, patch: Partial<LaserDmxMatrixBeamAppearance> = {}): LaserDmxMatrixBeamAppearance {
  const brightness = clamp01(finite(fixture.brightness, 0.85))
  const spread = clamp(finite(fixture.beam.beamSpread, 0), 0, 180)
  return {
    dimmer:        brightness,
    shutterOpen:   fixture.enabled,
    width:         1,
    focus:         clamp01(finite(fixture.beam.focus, 0.8)),
    strobeRate:    0,
    flickerAmount: 0,
    divergence:    clamp01(spread / 180),
    glow:          0.72,
    geometry:      'line',
    ...patch,
  }
}

function makeRoute(
  id: string,
  source: string,
  target: LaserDmxModulationRoute['target'],
  options: Partial<LaserDmxModulationRoute> = {},
): LaserDmxModulationRoute {
  return {
    id,
    enabled: true,
    source,
    target,
    amount: 1,
    min: 0,
    max: 1,
    curve: 'linear',
    mode: 'set',
    smoothing: 0.1,
    attack: 0,
    release: 0.16,
    invert: false,
    ...options,
  }
}

function sourceForAudioBand(audioBand: LaserDmxShowDirectorAudioBand): string {
  switch (audioBand) {
    case 'sub': return 'nSub'
    case 'lowMid': return 'nLowMid'
    case 'mid': return 'nMid'
    case 'highMid':
    case 'high': return 'nHigh'
    default: return 'nBass'
  }
}

function phraseSource(trigger: LaserDmxShowDirectorTriggerConfig): string {
  const bars = positiveInt(trigger.phraseLengthBars, 8, 1, 128)
  if (bars <= 4) return 'phrase4'
  if (bars <= 8) return 'phrase8'
  if (bars <= 16) return 'phrase16'
  return 'phrase32'
}

function triggerSource(trigger: LaserDmxShowDirectorTriggerConfig): string | null {
  switch (trigger.mode) {
    case 'beat': return 'beat'
    case 'bar': return 'downbeat'
    case 'phrase': return phraseSource(trigger)
    case 'bassHit': return 'kick'
    case 'snareTransient': return 'snare'
    case 'energy': return 'dropImpact'
    default: return null
  }
}

function launchForTrigger(trigger: LaserDmxShowDirectorTriggerConfig): LaserDmxLaunchSettings {
  switch (trigger.mode) {
    case 'beat':
      return { trigger: 'beat', threshold: 0.2, cooldownBeats: 0, minimumEnergy: 0 }
    case 'bar':
    case 'phrase':
      return { trigger: 'downbeat', threshold: 0.2, cooldownBeats: Math.max(0, positiveInt(trigger.barInterval, 1, 1, 64) - 0.1), minimumEnergy: 0 }
    case 'bassHit':
      return { trigger: 'kick', threshold: clamp01(finite(trigger.audioThreshold, 0.65)), cooldownBeats: 0.25, minimumEnergy: 0 }
    case 'snareTransient':
      return { trigger: 'snare', threshold: clamp01(finite(trigger.audioThreshold, 0.65)), cooldownBeats: 0.25, minimumEnergy: 0 }
    case 'energy':
      return { trigger: 'dropImpact', threshold: clamp01(finite(trigger.energyThreshold, 0.7)), cooldownBeats: 2, minimumEnergy: clamp01(finite(trigger.energyThreshold, 0.7)) * 0.5 }
    default:
      return DEFAULT_LAUNCH_SETTINGS
  }
}

function triggerDimmerRoutes(
  fixture: LaserDmxShowDirectorFixture,
  suffix = 'trigger',
): LaserDmxModulationRoute[] {
  const trigger = fixture.trigger
  const brightness = clamp01(finite(fixture.brightness, 0.85))
  const attack = Math.max(0, finite(trigger.fadeInMs, 0) / 1000)
  const release = Math.max(0.03, finite(trigger.fadeOutMs, 120) / 1000)

  if (trigger.mode === 'alwaysOn' || trigger.mode === 'cuePoint') return []

  if (trigger.mode === 'section') {
    return [makeRoute(
      `sd-${safeIdPart(fixture.id)}-${suffix}-section`,
      'sectionIntensity',
      'dimmer',
      {
        min: 0,
        max: brightness,
        mode: 'set',
        curve: 'easeOut',
        smoothing: 0.22,
        attack,
        release,
        threshold: 0.04,
      },
    )]
  }

  const source = trigger.mode === 'energy' ? 'energy' : triggerSource(trigger)
  if (!source) return []

  if (trigger.mode === 'energy') {
    return [makeRoute(
      `sd-${safeIdPart(fixture.id)}-${suffix}-energy`,
      source,
      'dimmer',
      {
        min: 0,
        max: brightness,
        mode: 'set',
        curve: 'easeOut',
        smoothing: 0.18,
        attack,
        release,
        threshold: clamp01(finite(trigger.energyThreshold, 0.7)),
      },
    )]
  }

  return [makeRoute(
    `sd-${safeIdPart(fixture.id)}-${suffix}-hit`,
    source,
    'dimmer',
    {
      min: 0,
      max: brightness,
      mode: 'trigger',
      curve: 'pulse',
      attack,
      hold: trigger.mode === 'bar' ? 0.05 : 0.025,
      release,
      timingFilter: trigger.mode === 'bar' && positiveInt(trigger.barInterval, 1, 1, 64) > 1
        ? { mode: 'barInterval', intervalBars: positiveInt(trigger.barInterval, 1, 1, 64), intervalAnchorBar: 1 }
        : undefined,
    },
  )]
}

function musicColorRoutes(fixture: LaserDmxShowDirectorFixture): LaserDmxModulationRoute[] {
  if (fixture.colorMode !== 'music') return []
  const id = safeIdPart(fixture.id)
  return [
    makeRoute(`sd-${id}-music-red`, 'nBass', 'red', { min: 0.2, max: 1, mode: 'set', curve: 'easeOut', smoothing: 0.18 }),
    makeRoute(`sd-${id}-music-green`, 'nMid', 'green', { min: 0.15, max: 1, mode: 'set', curve: 'easeOut', smoothing: 0.22 }),
    makeRoute(`sd-${id}-music-blue`, 'nHigh', 'blue', { min: 0.25, max: 1, mode: 'set', curve: 'easeOut', smoothing: 0.2 }),
  ]
}

function targetMotionRoutes(fixture: LaserDmxShowDirectorFixture): LaserDmxModulationRoute[] {
  const id = safeIdPart(fixture.id)
  const routes: LaserDmxModulationRoute[] = []

  if (fixture.beam.targetMode === 'sweep' || fixture.component.movingHeadPanTiltStyle === 'smoothSweep') {
    routes.push(makeRoute(`sd-${id}-sweep-x`, 'beatPhase', 'targetOffsetX', {
      min: -0.16,
      max: 0.16,
      mode: 'set',
      curve: 'pulse',
      smoothing: 0.05,
    }))
  }

  if (fixture.beam.targetMode === 'audioReactive' || fixture.component.movingHeadPanTiltStyle === 'audioReactive') {
    routes.push(
      makeRoute(`sd-${id}-audio-x`, sourceForAudioBand(fixture.trigger.audioBand), 'targetOffsetX', {
        min: -0.1,
        max: 0.1,
        mode: 'set',
        curve: 'easeOut',
        smoothing: 0.12,
      }),
      makeRoute(`sd-${id}-audio-y`, 'nHigh', 'targetOffsetY', {
        min: -0.08,
        max: 0.08,
        mode: 'set',
        curve: 'easeOut',
        smoothing: 0.16,
      }),
      makeRoute(`sd-${id}-audio-width`, 'energy', 'beamWidth', {
        min: 0.85,
        max: 2.35,
        mode: 'set',
        curve: 'easeOut',
        smoothing: 0.16,
      }),
    )
  }

  if (fixture.component.movingHeadPanTiltStyle === 'figureEight') {
    routes.push(
      makeRoute(`sd-${id}-figure-x`, 'phrase4', 'targetOffsetX', { min: -0.14, max: 0.14, mode: 'set', curve: 'pulse', smoothing: 0.05 }),
      makeRoute(`sd-${id}-figure-y`, 'beatPhase', 'targetOffsetY', { min: -0.12, max: 0.12, mode: 'set', curve: 'pulse', smoothing: 0.05 }),
    )
  }

  return routes
}

function sequenceModeForLed(direction: LaserDmxShowDirectorLedDirection): LaserDmxReactionGroup['sequence']['mode'] {
  switch (direction) {
    case 'rightToLeft': return 'reverse'
    case 'centerOut': return 'centerOut'
    case 'edgesIn': return 'outsideIn'
    case 'chase': return 'forward'
    default: return 'forward'
  }
}

function stepsPerBeat(division: LaserDmxShowDirectorBeatDivision): number {
  return clamp(1 / Math.max(0.25, finite(division, 1)), 0.25, 4)
}

function makeGroup(fixture: LaserDmxShowDirectorFixture): LaserDmxReactionGroup {
  const color = fixture.kind === 'blinder' ? warmWhiteColor() : colorForFixture(fixture)
  const isLed = fixture.kind === 'ledBar' || fixture.kind === 'ledTube'
  const shouldSequence = isLed || fixture.beam.targetMode === 'sweep'
  return {
    id: groupIdForFixture(fixture),
    name: fixture.groupId?.trim() || fixture.label || `Show Director ${fixture.kind}`,
    enabled: fixture.enabled,
    muted: false,
    soloed: false,
    colorOverrideEnabled: true,
    color,
    sequence: shouldSequence
      ? {
          ...DEFAULT_BEAM_SEQUENCE,
          enabled: true,
          mode: isLed ? sequenceModeForLed(fixture.component.ledDirection) : 'forward',
          stepsPerBeat: stepsPerBeat(fixture.trigger.beatDivision),
          stepGate: fixture.kind === 'ledTube' ? 0.82 : 0.68,
          phaseSpread: fixture.kind === 'ledTube' ? 0.15 : 0.08,
          resetOnDownbeat: fixture.trigger.mode === 'bar' || fixture.trigger.mode === 'phrase',
        }
      : DEFAULT_BEAM_SEQUENCE,
    launch: launchForTrigger(fixture.trigger),
    maxActiveBeams: 0,
    modulationRoutes: [
      ...triggerDimmerRoutes(fixture),
      ...musicColorRoutes(fixture),
      ...targetMotionRoutes(fixture),
    ],
  }
}

function makeBeam(
  fixture: LaserDmxShowDirectorFixture,
  suffix: string,
  sequenceIndex: number,
  origin: LaserDmxMatrixGridAnchor,
  target: LaserDmxMatrixTarget,
  appearancePatch: Partial<LaserDmxMatrixBeamAppearance> = {},
  motionPatch: Partial<LaserDmxMatrixBeam['motion']> = {},
  routes: LaserDmxModulationRoute[] = [],
): LaserDmxMatrixBeam {
  const motion = {
    ...DEFAULT_BEAM_MOTION,
    ...motionPatch,
  }
  return {
    id: beamIdForFixture(fixture, suffix),
    name: `${fixture.label || fixture.kind} ${suffix}`,
    enabled: fixture.enabled,
    sequenceIndex,
    origin,
    target,
    groupId: groupIdForFixture(fixture),
    useGroupColor: true,
    color: fixture.kind === 'blinder' ? warmWhiteColor() : colorForFixture(fixture),
    appearance: defaultAppearance(fixture, appearancePatch),
    motion,
    modulationRoutes: routes,
  }
}

function compileBeamFixture(
  fixture: LaserDmxShowDirectorFixture,
  ctx: FixtureCompileContext,
  options: {
    cone?: boolean
    width?: number
    divergence?: number
    glow?: number
    length?: number
  } = {},
): void {
  if (!fixture.beam.beamEnabled && fixture.kind !== 'parWash') return
  const point = stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const origin = gridAnchorFromStagePoint(point)
  const angle = finite(fixture.rotation, 0) + finite(fixture.beam.beamAngle, 0)
  const spread = clamp(finite(fixture.beam.beamSpread, fixture.kind === 'laser' ? 18 : 0), 0, 180)
  const geometry = options.cone ? 'volumetricCone' : 'line'
  const count = fixture.beam.targetMode === 'fan'
    ? clamp(Math.round(spread / 9), 3, 9)
    : fixture.beam.targetMode === 'cross'
      ? 2
      : fixture.beam.targetMode === 'mirror'
        ? 2
        : 1

  for (let i = 0; i < count && ctx.outputBeamCount < LASER_DMX_MATRIX_MAX_BEAMS; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const fanOffset = count === 1 ? 0 : (t - 0.5) * spread
    const mirrorSign = fixture.beam.targetMode === 'mirror' && i === 1 ? -1 : 1
    const crossOffset = fixture.beam.targetMode === 'cross' ? (i === 0 ? -spread * 0.5 : spread * 0.5) : fanOffset
    const target = fixture.beam.targetMode === 'fixed'
      ? gridTargetFromFixtureTarget(fixture, ctx.gridColumns, ctx.gridRows)
      : stageTargetFromAngle(point, angle + crossOffset * mirrorSign, options.length ?? 0.62)
    const motionMode: LaserDmxMatrixBeam['motion']['mode'] = fixture.beam.targetMode === 'sweep'
      ? 'scanner'
      : fixture.component.movingHeadPanTiltStyle === 'snap'
        ? 'projectile'
        : fixture.component.movingHeadPanTiltStyle === 'locked'
          ? 'static'
          : 'pingPong'
    ctx.matrixBeams.push(makeBeam(
      fixture,
      `${fixture.kind}-${i + 1}`,
      ctx.outputBeamCount,
      origin,
      target,
      {
        width: options.width ?? (options.cone ? 2.4 : 1),
        divergence: options.divergence ?? clamp01((spread || 12) / 180),
        glow: options.glow ?? 0.82,
        geometry,
      },
      {
        mode: fixture.kind === 'laser' && fixture.beam.targetMode !== 'sweep' ? 'static' : motionMode,
        beatsPerTravel: Math.max(0.5, finite(fixture.trigger.beatDivision, 1) * 2),
        tailLength: fixture.kind === 'laser' ? 0.22 : 0.38,
        headGlow: fixture.kind === 'laser' ? 0.35 : 0.72,
        direction: fixture.beam.targetMode === 'mirror' ? 'alternate' : 'forward',
      },
    ))
    ctx.outputBeamCount++
  }
}

function compileLedFixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext, tube = false): void {
  const point = stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const anchor = gridAnchorFromStagePoint(point)
  const cells = Math.min(positiveInt(fixture.component.ledCellCount, 8, 1, 64), tube ? 12 : 16)
  const span = Math.min(cells - 1, tube ? 7 : 11)
  const horizontal = Math.abs(Math.cos(finite(fixture.rotation, 0) * Math.PI / 180)) >= Math.abs(Math.sin(finite(fixture.rotation, 0) * Math.PI / 180))
  const start = -Math.floor(span / 2)
  for (let i = 0; i < cells && ctx.outputBeamCount < LASER_DMX_MATRIX_MAX_BEAMS; i++) {
    const offset = start + Math.round((span * i) / Math.max(1, cells - 1))
    const origin = horizontal
      ? offsetGridAnchor(anchor, offset, 0)
      : offsetGridAnchor(anchor, 0, offset)
    const target = stageTargetFromAngle(
      { x: (origin.column - 1) / (LASER_DMX_MATRIX_COLUMNS - 1), y: (origin.row - 1) / (LASER_DMX_MATRIX_ROWS - 1), z: origin.z },
      horizontal ? 0 : 90,
      0.045,
    )
    ctx.matrixBeams.push(makeBeam(
      fixture,
      `${tube ? 'tube' : 'bar'}-${i + 1}`,
      ctx.outputBeamCount,
      origin,
      target,
      {
        width: tube ? 2.4 : 3.1,
        divergence: tube ? 0.12 : 0.06,
        focus: tube ? 0.56 : 0.72,
        glow: tube ? 0.94 : 0.86,
        geometry: 'line',
      },
      { mode: 'static', headGlow: tube ? 0.35 : 0.2 },
    ))
    ctx.outputBeamCount++
  }
}

function compileStrobeFixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  const point = stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const origin = gridAnchorFromStagePoint(point)
  const angles = [0, 90, 180, 270]
  for (let i = 0; i < angles.length && ctx.outputBeamCount < LASER_DMX_MATRIX_MAX_BEAMS; i++) {
    const target = stageTargetFromAngle(point, angles[i], 0.12)
    ctx.matrixBeams.push(makeBeam(
      fixture,
      `strobe-${i + 1}`,
      ctx.outputBeamCount,
      origin,
      target,
      {
        width: 5,
        divergence: 0.08,
        focus: 0.9,
        strobeRate: clamp01(finite(fixture.component.strobeRate, 8) / 30),
        glow: 1,
        geometry: 'line',
      },
      { mode: 'static', headGlow: 0.8 },
      triggerDimmerRoutes(fixture, `strobe-${i + 1}`),
    ))
    ctx.outputBeamCount++
  }
}

function compileBlinderFixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  const point = stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const anchor = gridAnchorFromStagePoint(point)
  const offsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const
  for (let i = 0; i < offsets.length && ctx.outputBeamCount < LASER_DMX_MATRIX_MAX_BEAMS; i++) {
    const [colOffset, rowOffset] = offsets[i]
    const origin = offsetGridAnchor(anchor, colOffset, rowOffset)
    const target = stageTargetFromAngle(
      { x: (origin.column - 1) / (LASER_DMX_MATRIX_COLUMNS - 1), y: (origin.row - 1) / (LASER_DMX_MATRIX_ROWS - 1), z: origin.z },
      90,
      0.16,
    )
    ctx.matrixBeams.push(makeBeam(
      fixture,
      `blinder-${i + 1}`,
      ctx.outputBeamCount,
      origin,
      target,
      {
        width: 6,
        divergence: 0.22,
        focus: 0.38,
        glow: 1,
        geometry: 'volumetricCone',
      },
      { mode: 'static', headGlow: 0.6 },
    ))
    ctx.outputBeamCount++
  }
}

function compileVideoWallFixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  const anchor = gridAnchorFromStagePoint(stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows))
  const colorRoutes = fixture.colorMode === 'music' ? musicColorRoutes(fixture) : []
  const edges = [
    { origin: offsetGridAnchor(anchor, -2, -1), target: offsetGridAnchor(anchor, 2, -1) },
    { origin: offsetGridAnchor(anchor, 2, -1), target: offsetGridAnchor(anchor, 2, 1) },
    { origin: offsetGridAnchor(anchor, 2, 1), target: offsetGridAnchor(anchor, -2, 1) },
    { origin: offsetGridAnchor(anchor, -2, 1), target: offsetGridAnchor(anchor, -2, -1) },
  ]
  for (let i = 0; i < edges.length && ctx.outputBeamCount < LASER_DMX_MATRIX_MAX_BEAMS; i++) {
    const edge = edges[i]
    ctx.matrixBeams.push(makeBeam(
      fixture,
      `video-wall-${i + 1}`,
      ctx.outputBeamCount,
      edge.origin,
      { kind: 'grid', ...edge.target },
      {
        dimmer: clamp01(finite(fixture.component.videoWallBrightness, 0.85) * finite(fixture.brightness, 0.85)),
        width: 2.4,
        divergence: 0,
        focus: 0.76,
        glow: 0.7,
        geometry: 'line',
      },
      { mode: 'static' },
      colorRoutes,
    ))
    ctx.outputBeamCount++
  }
}

function compileCo2Fixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  const point = stagePointForFixture(fixture, ctx.gridColumns, ctx.gridRows)
  const origin = gridAnchorFromStagePoint(point)
  const target = stageTargetFromAngle(point, -90, 0.36)
  ctx.globalRoutes.push(...co2FogRoutes(fixture))
  if (ctx.outputBeamCount >= LASER_DMX_MATRIX_MAX_BEAMS) return
  ctx.matrixBeams.push(makeBeam(
    fixture,
    'co2-plume',
    ctx.outputBeamCount,
    origin,
    target,
    {
      width: 6,
      divergence: 0.75,
      focus: 0.2,
      glow: 1,
      geometry: 'volumetricCone',
    },
    {
      mode: 'grow',
      beatsPerTravel: Math.max(0.25, finite(fixture.component.co2BurstDurationMs, 350) / 500),
      tailLength: 0.75,
      headGlow: 0.5,
    },
    triggerDimmerRoutes(fixture, 'co2'),
  ))
  ctx.outputBeamCount++
}

function co2FogRoutes(fixture: LaserDmxShowDirectorFixture): LaserDmxModulationRoute[] {
  const source = triggerSource(fixture.trigger) ?? 'dropImpact'
  const attack = Math.max(0, finite(fixture.trigger.fadeInMs, 0) / 1000)
  const release = Math.max(0.1, finite(fixture.component.co2BurstDurationMs, 350) / 1000)
  return [
    makeRoute(`sd-${safeIdPart(fixture.id)}-co2-fog-density`, source, 'fogDensity', {
      min: 0,
      max: 0.58,
      mode: 'trigger',
      curve: 'pulse',
      attack,
      hold: Math.min(0.4, release * 0.35),
      release,
    }),
    makeRoute(`sd-${safeIdPart(fixture.id)}-co2-fog-opacity`, source, 'fogOpacity', {
      min: 0,
      max: 0.7,
      mode: 'trigger',
      curve: 'pulse',
      attack,
      hold: Math.min(0.4, release * 0.35),
      release,
    }),
  ]
}

function compileFixture(fixture: LaserDmxShowDirectorFixture, ctx: FixtureCompileContext): void {
  if (!fixture || fixture.enabled !== true || !hasFixtureShape(fixture) || !isSupportedFixtureKind(fixture.kind)) return
  ctx.groups.push(makeGroup(fixture))
  ctx.hasRenderableFixture = true

  switch (fixture.kind) {
    case 'laser':
      compileBeamFixture(fixture, ctx, { width: 0.9, divergence: clamp01(finite(fixture.beam.beamSpread, 18) / 240), glow: 0.92, length: 0.78 })
      break
    case 'movingHead':
      compileBeamFixture(fixture, ctx, { cone: true, width: 2.5, divergence: clamp01(Math.max(22, finite(fixture.beam.beamSpread, 32)) / 150), glow: 0.86, length: 0.58 })
      break
    case 'ledBar':
      compileLedFixture(fixture, ctx, false)
      break
    case 'ledTube':
      compileLedFixture(fixture, ctx, true)
      break
    case 'strobe':
      compileStrobeFixture(fixture, ctx)
      break
    case 'blinder':
      compileBlinderFixture(fixture, ctx)
      break
    case 'parWash':
      compileBeamFixture(fixture, ctx, { cone: true, width: 4.6, divergence: clamp01(Math.max(45, finite(fixture.beam.beamSpread, 55)) / 120), glow: 0.82, length: 0.42 })
      break
    case 'videoWall':
      compileVideoWallFixture(fixture, ctx)
      break
    case 'haze':
      ctx.hazeIntensity = Math.max(ctx.hazeIntensity, clamp01(finite(fixture.component.hazeIntensity, 0.5) * finite(fixture.brightness, 0.85)))
      break
    case 'co2Jet':
      compileCo2Fixture(fixture, ctx)
      break
    default:
      break
  }
}

function compileGlobalRoutes(base: LaserDmxBeamMatrixSettings): LaserDmxModulationRoute[] {
  return Array.isArray(base.globalModulationRoutes)
    ? base.globalModulationRoutes.map(route => ({ ...route }))
    : []
}

/**
 * Converts the user-facing Show Director drag/drop layout into a Beam Matrix
 * program. Beam Matrix remains the execution/runtime renderer; this compiler is
 * only an adapter between the fixture-layout authoring model and Beam Matrix data.
 */
export function compileLaserDmxShowDirectorToBeamMatrix(
  input: CompileLaserDmxShowDirectorToBeamMatrixInput,
): LaserDmxBeamMatrixSettings {
  const base = input.beamMatrix
  const showDirector = input.showDirector
  const gridColumns = positiveInt(showDirector?.settings?.gridSize?.columns, 15, 1, 64)
  const gridRows = positiveInt(showDirector?.settings?.gridSize?.rows, 10, 1, 64)
  const fixtures = Array.isArray(showDirector?.fixtures) ? showDirector.fixtures : []
  const ctx: FixtureCompileContext = {
    gridColumns,
    gridRows,
    matrixBeams: [],
    groups: [],
    globalRoutes: compileGlobalRoutes(base),
    outputBeamCount: 0,
    hazeIntensity: 0,
    hasRenderableFixture: false,
  }

  for (const fixture of fixtures) {
    if (ctx.outputBeamCount >= LASER_DMX_MATRIX_MAX_BEAMS) break
    compileFixture(fixture, ctx)
  }

  const hasFixtures = ctx.hasRenderableFixture
  const fog = hasFixtures
    ? {
        ...base.fog,
        enabled: base.fog.enabled || ctx.hazeIntensity > 0,
        density: Math.max(base.fog.enabled ? base.fog.density : 0, ctx.hazeIntensity * 0.62),
        opacity: Math.max(base.fog.enabled ? base.fog.opacity : 0, ctx.hazeIntensity * 0.52),
        beamScatter: Math.max(base.fog.beamScatter, ctx.hazeIntensity * 0.78),
        turbulence: Math.max(base.fog.turbulence, ctx.hazeIntensity * 0.45),
        diffusion: Math.max(base.fog.diffusion, ctx.hazeIntensity * 0.5),
      }
    : {
        ...base.fog,
        enabled: false,
        density: 0,
        opacity: 0,
        beamScatter: 0,
      }

  return {
    schemaVersion: base.schemaVersion,
    selectedBeamIds: [],
    selectedGroupId: null,
    beams: ctx.matrixBeams.slice(0, LASER_DMX_MATRIX_MAX_BEAMS),
    groups: ctx.groups,
    globalModulationRoutes: ctx.globalRoutes,
    output: { ...base.output },
    fog,
    editor: { ...base.editor },
    cues: [],
  }
}
