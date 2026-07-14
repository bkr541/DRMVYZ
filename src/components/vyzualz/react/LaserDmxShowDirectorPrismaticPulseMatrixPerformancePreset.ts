import {
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorBeamTarget,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorState,
} from './ReactTypes'
import type {
  LaserDmxShowDirectorAuthoredFixtureBankMetadata,
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceBeatMutation,
  LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
  LaserDmxShowDirectorPerformanceSectionMatch,
  LaserDmxShowDirectorSectionEnergyEnvelope,
} from './LaserDmxShowDirectorPerformanceProgram'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION } from './LaserDmxShowDirectorPerformanceConstants'
import type { LaserDmxShowDirectorPerformancePresetDefinition } from './LaserDmxShowDirectorPerformancePresets'
import { LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE } from './LaserDmxShowDirectorBeatActions'

const CYAN = '#35e7ff'
const BLUE = '#4f7dff'
const ICE = '#c9f8ff'
const GREEN = '#49ff75'
const MAGENTA = '#ff3ed1'
const VIOLET = '#9a66ff'
const RED = '#ff243f'
const WHITE = '#ffffff'
const WARM_WHITE = '#ffe0b2'

const PRESET_ID = 'prismatic-pulse-matrix'
const PRESET_NAME = 'Prismatic Pulse Matrix'
const GRID = { columns: 24, rows: 14 }
const ALL_SECTIONS = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro'] as const
const MUSIC_CAPABILITIES = [
  'Beat Grid', 'Rhythm Events', 'Live Bands', 'Sections', 'Energy',
  'Track Energy Curve', 'Stem Curves', 'Lyrics', 'Semantics', 'Spectral Features',
]

const BLACKOUT_POLICY = Object.freeze({
  maxPreDropBeats: 0.75,
  maxImpactCutBeats: 0.25,
  maxFakeoutBeats: 0.5,
  maximumProgrammedBlackoutRatio: 0.07,
  retriggerGuardBeats: 0.5,
  breakdownRequiresVisibleOutput: true,
  minimumVisibleFixtureBrightness: 0.22,
})

type CreateId = () => string
type Shape = 'prism' | 'daggers' | 'horizon' | 'chevrons' | 'lattice' | 'shards' | 'fan' | 'crossFan' | 'portal' | 'tracers' | 'diamond'
type FixtureSpec = {
  key: string
  label: string
  kind: LaserDmxShowDirectorFixtureKind
  group: string
  x: number
  y: number
  targetX?: number
  targetY?: number
  color: string
  spread?: number
}

const GROUPS = [
  ['laser-left', 'Laser Left'],
  ['laser-center', 'Laser Center'],
  ['laser-right', 'Laser Right'],
  ['heads-left', 'Moving Heads Left'],
  ['heads-center', 'Moving Heads Center'],
  ['heads-right', 'Moving Heads Right'],
  ['portal-left', 'Portal LEDs Left'],
  ['portal-right', 'Portal LEDs Right'],
  ['impact', 'Impact'],
  ['atmosphere', 'Atmosphere'],
] as const

const FIXTURES: readonly FixtureSpec[] = [
  { key: 'matrix-laser-top-l-outer', label: 'Matrix Laser Top L Outer', kind: 'laser', group: 'laser-left', x: 3, y: 1, targetX: 9, targetY: 12, color: CYAN },
  { key: 'matrix-laser-top-l-inner', label: 'Matrix Laser Top L Inner', kind: 'laser', group: 'laser-left', x: 7, y: 1, targetX: 11, targetY: 12, color: BLUE },
  { key: 'matrix-laser-center-l', label: 'Matrix Laser Center L', kind: 'laser', group: 'laser-center', x: 10, y: 2, targetX: 12, targetY: 12, color: GREEN },
  { key: 'matrix-laser-center-r', label: 'Matrix Laser Center R', kind: 'laser', group: 'laser-center', x: 14, y: 2, targetX: 12, targetY: 12, color: MAGENTA },
  { key: 'matrix-laser-top-r-inner', label: 'Matrix Laser Top R Inner', kind: 'laser', group: 'laser-right', x: 17, y: 1, targetX: 13, targetY: 12, color: VIOLET },
  { key: 'matrix-laser-top-r-outer', label: 'Matrix Laser Top R Outer', kind: 'laser', group: 'laser-right', x: 21, y: 1, targetX: 15, targetY: 12, color: MAGENTA },
  { key: 'matrix-laser-side-l', label: 'Matrix Laser Side L', kind: 'laser', group: 'laser-left', x: 1, y: 6, targetX: 12, targetY: 8, color: RED },
  { key: 'matrix-laser-side-r', label: 'Matrix Laser Side R', kind: 'laser', group: 'laser-right', x: 23, y: 6, targetX: 12, targetY: 8, color: RED },
  { key: 'matrix-head-l-outer', label: 'Matrix Head L Outer', kind: 'movingHead', group: 'heads-left', x: 4, y: 3, targetX: 8, targetY: 11, color: WHITE, spread: 28 },
  { key: 'matrix-head-l-inner', label: 'Matrix Head L Inner', kind: 'movingHead', group: 'heads-left', x: 8, y: 3, targetX: 10, targetY: 11, color: WHITE, spread: 24 },
  { key: 'matrix-head-center', label: 'Matrix Head Center', kind: 'movingHead', group: 'heads-center', x: 12, y: 2, targetX: 12, targetY: 11, color: ICE, spread: 22 },
  { key: 'matrix-head-r-inner', label: 'Matrix Head R Inner', kind: 'movingHead', group: 'heads-right', x: 16, y: 3, targetX: 14, targetY: 11, color: WHITE, spread: 24 },
  { key: 'matrix-head-r-outer', label: 'Matrix Head R Outer', kind: 'movingHead', group: 'heads-right', x: 20, y: 3, targetX: 16, targetY: 11, color: WHITE, spread: 28 },
  { key: 'matrix-portal-l-vertical', label: 'Matrix Portal L Vertical', kind: 'ledBar', group: 'portal-left', x: 3, y: 7, color: BLUE },
  { key: 'matrix-portal-l-base', label: 'Matrix Portal L Base', kind: 'ledBar', group: 'portal-left', x: 5, y: 10, color: CYAN },
  { key: 'matrix-portal-r-vertical', label: 'Matrix Portal R Vertical', kind: 'ledBar', group: 'portal-right', x: 21, y: 7, color: GREEN },
  { key: 'matrix-portal-r-base', label: 'Matrix Portal R Base', kind: 'ledBar', group: 'portal-right', x: 19, y: 10, color: CYAN },
  { key: 'matrix-strobe', label: 'Matrix Center Strobe', kind: 'strobe', group: 'impact', x: 12, y: 4, color: WHITE },
  { key: 'matrix-haze', label: 'Matrix Haze', kind: 'haze', group: 'atmosphere', x: 12, y: 12, color: ICE },
]

const BANKS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  allLasers: FIXTURES.filter(fixture => fixture.kind === 'laser').map(fixture => fixture.key),
  allHeads: FIXTURES.filter(fixture => fixture.kind === 'movingHead').map(fixture => fixture.key),
  allBeams: FIXTURES.filter(fixture => fixture.kind === 'laser' || fixture.kind === 'movingHead').map(fixture => fixture.key),
  leftLasers: ['matrix-laser-top-l-outer', 'matrix-laser-top-l-inner', 'matrix-laser-side-l'],
  centerLasers: ['matrix-laser-center-l', 'matrix-laser-center-r'],
  rightLasers: ['matrix-laser-top-r-inner', 'matrix-laser-top-r-outer', 'matrix-laser-side-r'],
  corePrism: ['matrix-laser-top-l-inner', 'matrix-laser-center-l', 'matrix-laser-center-r', 'matrix-laser-top-r-inner'],
  outerPrism: ['matrix-laser-top-l-outer', 'matrix-laser-top-r-outer', 'matrix-laser-side-l', 'matrix-laser-side-r'],
  daggers: ['matrix-laser-top-l-outer', 'matrix-laser-top-l-inner', 'matrix-laser-center-l', 'matrix-laser-center-r', 'matrix-laser-top-r-inner', 'matrix-laser-top-r-outer'],
  horizon: ['matrix-laser-side-l', 'matrix-laser-top-l-outer', 'matrix-laser-top-l-inner', 'matrix-laser-top-r-inner', 'matrix-laser-top-r-outer', 'matrix-laser-side-r'],
  chevrons: ['matrix-laser-top-l-outer', 'matrix-laser-top-l-inner', 'matrix-laser-center-l', 'matrix-laser-center-r', 'matrix-laser-top-r-inner', 'matrix-laser-top-r-outer'],
  lattice: FIXTURES.filter(fixture => fixture.kind === 'laser').map(fixture => fixture.key),
  shards: ['matrix-laser-top-l-outer', 'matrix-laser-top-l-inner', 'matrix-laser-top-r-inner', 'matrix-laser-top-r-outer', 'matrix-head-l-outer', 'matrix-head-l-inner', 'matrix-head-r-inner', 'matrix-head-r-outer'],
  fanHeads: FIXTURES.filter(fixture => fixture.kind === 'movingHead').map(fixture => fixture.key),
  tracers: ['matrix-laser-side-l', 'matrix-laser-center-l', 'matrix-laser-center-r', 'matrix-laser-side-r'],
  portalBeams: ['matrix-laser-side-l', 'matrix-head-l-outer', 'matrix-head-r-outer', 'matrix-laser-side-r'],
  portalLed: ['matrix-portal-l-vertical', 'matrix-portal-l-base', 'matrix-portal-r-vertical', 'matrix-portal-r-base'],
  kick: ['matrix-laser-center-l', 'matrix-laser-center-r'],
  snare: ['matrix-head-l-inner', 'matrix-head-center', 'matrix-head-r-inner'],
  hat: ['matrix-laser-top-l-inner', 'matrix-laser-top-r-inner'],
  strobe: ['matrix-strobe'],
  atmosphere: ['matrix-haze'],
  vocalIsolation: ['matrix-head-l-inner', 'matrix-head-center', 'matrix-head-r-inner'],
})

const lyricActive = [{ source: 'lyricActivity', operator: 'gt' as const, value: 0.2, requiredCapability: 'Lyrics', minConfidence: 0.35 }]
const lyricGap = [{ source: 'lyricActivity', operator: 'lte' as const, value: 0.2, requiredCapability: 'Lyrics', minConfidence: 0.35 }]
const vocalStemActive = [{ source: 'vocalEnergy', operator: 'gt' as const, value: 0.5, requiredCapability: 'Stem Curves', minConfidence: 0.35 }]

function range(min: number, max: number) { return { min, max } }
function envelope(
  activeFixtureGroups: [number, number], estimatedBeamCount: [number, number], brightness: [number, number],
  fanSpread: [number, number], movementStrength: [number, number], glow: [number, number],
  density: [number, number], negativeSpace: [number, number],
): LaserDmxShowDirectorSectionEnergyEnvelope {
  return {
    activeFixtureGroups: range(...activeFixtureGroups), estimatedBeamCount: range(...estimatedBeamCount), brightness: range(...brightness),
    fanSpread: range(...fanSpread), movementStrength: range(...movementStrength), glow: range(...glow),
    density: range(...density), negativeSpace: range(...negativeSpace),
  }
}

const ENERGY_ENVELOPES: Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserDmxShowDirectorSectionEnergyEnvelope> = Object.freeze({
  intro: envelope([2, 5], [12, 70], [0.4, 0.76], [22, 78], [0.08, 0.46], [0.5, 0.86], [0.04, 0.26], [0.42, 0.8]),
  verse: envelope([2, 5], [8, 54], [0.38, 0.7], [16, 64], [0.06, 0.42], [0.46, 0.76], [0.03, 0.2], [0.5, 0.84]),
  build: envelope([4, 8], [28, 132], [0.58, 0.94], [36, 108], [0.3, 0.92], [0.7, 1], [0.12, 0.48], [0.12, 0.58]),
  preDrop: envelope([1, 4], [2, 30], [0.3, 0.76], [6, 42], [0.02, 0.36], [0.36, 0.72], [0.005, 0.12], [0.7, 0.96]),
  drop1: envelope([5, 9], [46, 188], [0.78, 1], [48, 124], [0.58, 1], [0.86, 1], [0.16, 0.58], [0.04, 0.42]),
  breakdown: envelope([2, 4], [6, 38], [0.32, 0.66], [10, 52], [0.04, 0.34], [0.42, 0.7], [0.02, 0.14], [0.66, 0.92]),
  drop2: envelope([7, 10], [74, 244], [0.86, 1], [62, 138], [0.68, 1], [0.92, 1], [0.28, 0.68], [0.02, 0.28]),
  outro: envelope([1, 3], [2, 28], [0.26, 0.58], [4, 36], [0.02, 0.28], [0.34, 0.62], [0.005, 0.1], [0.76, 0.96]),
})

function isBeamFixture(kind: LaserDmxShowDirectorFixtureKind): boolean {
  return kind === 'laser' || kind === 'movingHead' || kind === 'parWash'
}

function createFixture(createId: CreateId, spec: FixtureSpec, groupIds: Readonly<Record<string, string>>, index: number): LaserDmxShowDirectorFixture {
  const fixture = createDefaultLaserDmxShowDirectorFixture(spec.kind, createId(), index)
  const beamEnabled = isBeamFixture(spec.kind)
  return {
    ...fixture,
    semanticKey: spec.key,
    label: spec.label,
    groupId: groupIds[spec.group] ?? null,
    linkedPairId: `${PRESET_ID}-pair-${spec.group}`,
    mirrorAxis: 'horizontal',
    x: spec.x,
    y: spec.y,
    color: spec.color,
    brightness: beamEnabled ? 0.68 : 0.54,
    beam: {
      ...fixture.beam,
      beamEnabled,
      targetMode: beamEnabled ? 'fixed' : fixture.beam.targetMode,
      beamSpread: spec.spread ?? (spec.kind === 'movingHead' ? 26 : 48),
      focus: spec.kind === 'movingHead' ? 0.84 : 0.92,
      targetX: spec.targetX ?? GRID.columns / 2,
      targetY: spec.targetY ?? GRID.rows - 1,
      targets: beamEnabled ? [{ id: `${spec.key}-base`, x: spec.targetX ?? GRID.columns / 2, y: spec.targetY ?? GRID.rows - 1 }] : fixture.beam.targets,
    },
    trigger: { ...fixture.trigger, mode: 'alwaysOn', quantize: 'none', retrigger: 'allow', fadeInMs: 0, fadeOutMs: spec.kind === 'haze' ? 800 : 0 },
    component: {
      ...fixture.component,
      movingHeadPanTiltStyle: spec.kind === 'movingHead' ? 'snap' : fixture.component.movingHeadPanTiltStyle,
      strobeRate: spec.kind === 'strobe' ? 18 : fixture.component.strobeRate,
      hazeIntensity: spec.kind === 'haze' ? 0.28 : fixture.component.hazeIntensity,
    },
  }
}

export function createPrismaticPulseMatrixRig(createId: CreateId): LaserDmxShowDirectorState {
  const groupIds = Object.fromEntries(GROUPS.map(([key]) => [key, `${PRESET_ID}-group-${key}`]))
  const defaults = createDefaultLaserDmxShowDirectorState()
  return normalizeLaserDmxShowDirectorState({
    ...defaults,
    sourceTemplateId: null,
    groups: GROUPS.map(([key, label]) => ({ id: groupIds[key], semanticKey: key, label })),
    fixtures: FIXTURES.map((fixture, index) => createFixture(createId, fixture, groupIds, index)),
    settings: { ...defaults.settings, gridSize: { ...GRID }, snapEnabled: true, showLabels: true, showBeams: true, showGrid: true, highlightFixtures: true, zoom: 1 },
  })
}

function fixtureByKey(key: string): FixtureSpec | undefined { return FIXTURES.find(fixture => fixture.key === key) }
function bank(role: string): readonly string[] { return BANKS[role] ?? [] }
function points(prefix: string, values: readonly (readonly [number, number])[]): LaserDmxShowDirectorBeamTarget[] {
  return values.map(([x, y], index) => ({ id: `${prefix}-${index + 1}`, x, y }))
}

function shapePoints(fixture: FixtureSpec, shape: Shape): LaserDmxShowDirectorBeamTarget[] {
  const centerX = GRID.columns / 2
  const centerY = GRID.rows / 2
  const bottom = GRID.rows - 0.6
  const side = fixture.x < centerX ? -1 : 1
  const nearCenter = Math.abs(fixture.x - centerX) < 2.4
  const prefix = `${PRESET_ID}-${shape}-${fixture.key}`
  const values: readonly (readonly [number, number])[] = (() => {
    switch (shape) {
      case 'prism':
        return nearCenter
          ? [[centerX, centerY - 3], [centerX + side * 2.3, centerY - 0.8], [centerX, centerY + 2], [centerX - side * 2.3, centerY - 0.8], [centerX + side * 0.8, bottom - 0.4]]
          : [[centerX, centerY - 2.6], [centerX + side * 3.8, centerY - 0.5], [centerX + side * 5.5, centerY + 1.7], [centerX - side * 1.8, centerY + 0.6], [centerX + side * 1.6, bottom]]
      case 'daggers':
        return [[centerX + side * 4.8, centerY + 0.2], [centerX + side * 3.1, bottom], [centerX + side * 1.4, centerY + 1.1], [centerX + side * 0.7, bottom - 0.3]]
      case 'horizon':
        return side < 0
          ? [[1, centerY - 1.5], [4.5, centerY - 0.6], [8.5, centerY + 0.2], [centerX + 3.5, centerY + 1.2]]
          : [[GRID.columns - 1, centerY - 1.5], [GRID.columns - 4.5, centerY - 0.6], [GRID.columns - 8.5, centerY + 0.2], [centerX - 3.5, centerY + 1.2]]
      case 'chevrons':
        return [[centerX + side * 7.4, centerY - 2.4], [centerX + side * 5.2, centerY], [centerX + side * 3.3, centerY + 2.2], [centerX + side * 1.4, bottom - 0.2]]
      case 'lattice':
        return side < 0
          ? [[centerX + 1.2, centerY - 3], [centerX + 5.4, centerY - 0.5], [GRID.columns - 2, centerY + 2.6], [centerX + 2.5, bottom]]
          : [[centerX - 1.2, centerY - 3], [centerX - 5.4, centerY - 0.5], [2, centerY + 2.6], [centerX - 2.5, bottom]]
      case 'shards':
        return side < 0
          ? [[2.5, bottom], [5.4, centerY + 1.8], [8.8, bottom - 1], [centerX - 0.7, centerY + 0.3]]
          : [[GRID.columns - 2.5, bottom], [GRID.columns - 5.4, centerY + 1.8], [GRID.columns - 8.8, bottom - 1], [centerX + 0.7, centerY + 0.3]]
      case 'fan':
        return side < 0
          ? [[2, bottom], [5.2, bottom - 1], [8.8, bottom - 0.3], [centerX - 0.7, bottom - 1.8]]
          : [[GRID.columns - 2, bottom], [GRID.columns - 5.2, bottom - 1], [GRID.columns - 8.8, bottom - 0.3], [centerX + 0.7, bottom - 1.8]]
      case 'crossFan':
        return side < 0
          ? [[centerX + 1.5, centerY + 0.4], [centerX + 4.2, bottom - 0.8], [GRID.columns - 2.2, bottom], [centerX + 5.5, centerY - 1.4]]
          : [[centerX - 1.5, centerY + 0.4], [centerX - 4.2, bottom - 0.8], [2.2, bottom], [centerX - 5.5, centerY - 1.4]]
      case 'portal':
        return side < 0
          ? [[2.2, centerY - 2.8], [2.2, centerY + 2.7], [5.2, bottom], [7.2, centerY + 1.2]]
          : [[GRID.columns - 2.2, centerY - 2.8], [GRID.columns - 2.2, centerY + 2.7], [GRID.columns - 5.2, bottom], [GRID.columns - 7.2, centerY + 1.2]]
      case 'tracers':
        return side < 0
          ? [[centerX + 2.2, centerY - 1.5], [centerX + 5.2, centerY + 1.6]]
          : [[centerX - 2.2, centerY - 1.5], [centerX - 5.2, centerY + 1.6]]
      case 'diamond':
        return [[centerX, centerY - 3.1], [centerX + side * 4, centerY], [centerX, centerY + 3.1], [centerX + side * 1.6, bottom - 0.4]]
    }
  })()
  return points(prefix, values)
}

function targetMap(shape: Shape, keys: readonly string[]): Record<string, LaserDmxShowDirectorBeamTarget[]> {
  return Object.fromEntries(keys.flatMap(key => {
    const fixture = fixtureByKey(key)
    return fixture && isBeamFixture(fixture.kind) ? [[key, shapePoints(fixture, shape)]] : []
  }))
}

function address(role: string): LaserDmxShowDirectorPerformanceAddress { return { bankRoles: [role] } }
function section(types: LaserDmxShowDirectorPerformanceSectionMatch['types'], occurrence?: number[] | { minOccurrence?: number }): LaserDmxShowDirectorPerformanceSectionMatch {
  return occurrence ? { types, dropOccurrence: Array.isArray(occurrence) ? { occurrences: occurrence } : occurrence } : { types }
}

function beamMutation(
  id: string, role: string, shape: Shape, color: string, brightness: number, fanSpread: number,
  extra: Partial<NonNullable<LaserDmxShowDirectorPerformanceMutationBase['fixture']>> = {},
  conditions?: NonNullable<LaserDmxShowDirectorPerformanceMutationBase['conditions']>,
): LaserDmxShowDirectorPerformanceMutationBase {
  return {
    id,
    address: address(role),
    fixture: {
      enabled: true,
      brightness,
      color,
      fanSpread,
      targetMode: 'fixed',
      targetPointsByFixtureSemanticKey: targetMap(shape, bank(role)),
      beamAppearance: { width: 1.55, glow: 0.92 },
      beamTravel: { mode: 'static', beatsPerTravel: 1, retrigger: 'restart', direction: 'forward' },
      beamPriorityRole: 'primaryArchitecture',
      beamVisualRole: 'primary',
      ...extra,
    },
    ...(conditions ? { conditions } : {}),
  }
}

function ledMutation(id: string, color: string, brightness: number, conditions?: NonNullable<LaserDmxShowDirectorPerformanceMutationBase['conditions']>): LaserDmxShowDirectorPerformanceMutationBase {
  return { id, address: address('portalLed'), fixture: { enabled: true, color, brightness }, ...(conditions ? { conditions } : {}) }
}

function hazeMutation(id: string, amount: number): LaserDmxShowDirectorPerformanceMutationBase {
  return { id, address: address('atmosphere'), fixtureActions: [{ id: `${id}-action`, kind: 'haze', enabled: true, brightness: Math.max(0.2, amount), amount }] }
}

function strobeMutation(id: string, brightness = 1, durationMs = 82): LaserDmxShowDirectorPerformanceMutationBase {
  return {
    id,
    durationBeats: 0.25,
    address: address('strobe'),
    fixtureActions: [{ id: `${id}-action`, kind: 'strobe', active: true, brightness, color: WHITE, rateHz: 18, durationMs }],
  }
}

function beatScene(
  id: string, offset: number, role: string, shape: Shape, color: string, brightness: number, fanSpread: number,
  extra: Partial<NonNullable<LaserDmxShowDirectorPerformanceMutationBase['fixture']>> = {},
): LaserDmxShowDirectorPerformanceBeatMutation {
  return {
    ...beamMutation(id, role, shape, color, brightness, fanSpread, extra),
    beatDivision: 1,
    beatOffsets: [offset],
    beatCycleLength: 16,
    responseEnvelope: { holdUntil: 0.72, releaseUntil: 0.98, curve: 'easeOut' },
  }
}

function ledBeat(id: string, offset: number, color: string, brightness: number): LaserDmxShowDirectorPerformanceBeatMutation {
  return {
    ...ledMutation(id, color, brightness),
    beatDivision: 1,
    beatOffsets: [offset],
    beatCycleLength: 16,
    responseEnvelope: { holdUntil: 0.7, releaseUntil: 0.96, curve: 'easeOut' },
  }
}

function matrixCycle(sceneId: string, expanded: boolean): LaserDmxShowDirectorPerformanceBeatMutation[] {
  const heroWidth = expanded ? 2.15 : 1.8
  const heroGlow = expanded ? 1 : 0.94
  const core = [
    beatScene(`${sceneId}-00-cyan-daggers`, 0, 'daggers', expanded ? 'diamond' : 'daggers', CYAN, 1, expanded ? 118 : 98, { beamAppearance: { width: heroWidth, glow: heroGlow }, beamTravel: { mode: 'grow', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(`${sceneId}-01-cyan-horizon`, 1, 'horizon', 'horizon', CYAN, 0.92, 90, { beamTravel: { mode: 'scanner', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' } }),
    beatScene(`${sceneId}-02-red-chevrons`, 2, 'chevrons', 'chevrons', RED, 0.96, 106, { beamAppearance: { width: 1.7, glow: 0.94 } }),
    beatScene(`${sceneId}-03-blue-lattice`, 3, 'lattice', expanded ? 'diamond' : 'lattice', expanded ? ICE : BLUE, 0.9, expanded ? 126 : 112, { beamAppearance: { width: expanded ? 1.55 : 1.3, glow: 0.92 }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' }),
    beatScene(`${sceneId}-04-magenta-shards`, 4, 'shards', 'shards', MAGENTA, 0.94, 88, { beamTravel: { mode: 'projectile', beatsPerTravel: 1, retrigger: 'restart', direction: 'forward' } }),
    beatScene(`${sceneId}-05-magenta-cage`, 5, 'lattice', 'lattice', MAGENTA, 0.9, 118, { beamAppearance: { width: 1.4, glow: 0.9 }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' }),
    beatScene(`${sceneId}-06-red-trace`, 6, 'tracers', 'tracers', RED, expanded ? 0.48 : 0.3, 26, { beamAppearance: { width: 0.82, glow: 0.56 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
    beatScene(`${sceneId}-07-blue-horizon`, 7, 'horizon', 'horizon', BLUE, 0.9, 92, { beamTravel: { mode: 'scanner', beatsPerTravel: 0.5, retrigger: 'restart', direction: 'forward' } }),
    beatScene(`${sceneId}-08-cyan-v`, 8, 'daggers', 'daggers', CYAN, 1, 104, { beamAppearance: { width: heroWidth, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(`${sceneId}-09-cyan-plane`, 9, 'horizon', expanded ? 'crossFan' : 'horizon', expanded ? ICE : CYAN, 0.94, 102, { beamTravel: { mode: 'scanner', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' } }),
    beatScene(`${sceneId}-10-magenta-fan`, 10, 'fanHeads', 'fan', MAGENTA, 0.96, 74, { component: { movingHeadPanTiltStyle: 'snap' }, beamTravel: { mode: 'grow', beatsPerTravel: 1, retrigger: 'restart', direction: 'forward' } }),
    beatScene(`${sceneId}-11-magenta-narrow`, 11, 'fanHeads', 'shards', MAGENTA, 0.82, 42, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 1.45, glow: 0.88 } }),
    beatScene(`${sceneId}-12-white-fan`, 12, 'fanHeads', 'fan', WHITE, 1, 82, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.2, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(`${sceneId}-13-white-cross`, 13, 'fanHeads', 'crossFan', WHITE, 1, 94, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.1, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(`${sceneId}-14-red-tracers`, 14, 'tracers', expanded ? 'portal' : 'tracers', RED, expanded ? 0.7 : 0.42, expanded ? 64 : 30, { beamAppearance: { width: 0.95, glow: 0.66 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
    beatScene(`${sceneId}-15-red-chevron`, 15, 'chevrons', expanded ? 'diamond' : 'chevrons', RED, 0.98, expanded ? 124 : 110, { beamAppearance: { width: 1.8, glow: 0.98 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
  ]
  return expanded ? [
    ...core,
    ledBeat(`${sceneId}-portal-cyan-0`, 0, CYAN, 0.62),
    ledBeat(`${sceneId}-portal-red-2`, 2, RED, 0.68),
    ledBeat(`${sceneId}-portal-magenta-4`, 4, MAGENTA, 0.72),
    ledBeat(`${sceneId}-portal-blue-7`, 7, BLUE, 0.62),
    ledBeat(`${sceneId}-portal-white-12`, 12, WHITE, 0.82),
    ledBeat(`${sceneId}-portal-red-15`, 15, RED, 0.76),
  ] : core
}

function fourBarVariations(sceneId: string): NonNullable<LaserDmxShowDirectorPerformanceScene['fourBarVariations']> {
  return [
    { id: `${sceneId}-four-prism`, motifFamily: `${PRESET_ID}-prism`, address: address('allBeams'), fixture: { rotation: -5 } },
    { id: `${sceneId}-four-diamond`, motifFamily: `${PRESET_ID}-diamond`, address: address('allBeams'), fixture: { rotation: 5 } },
    { id: `${sceneId}-four-lattice`, motifFamily: `${PRESET_ID}-lattice`, address: address('allBeams'), fixture: { rotation: -9 } },
    { id: `${sceneId}-four-cross`, motifFamily: `${PRESET_ID}-cross`, address: address('allBeams'), fixture: { rotation: 9 } },
  ]
}

function commonCadence(
  sceneId: string,
  baseShape: Shape,
  restrained = false,
): Required<Pick<LaserDmxShowDirectorPerformanceScene,
  'beatMutations' | 'kickMutations' | 'snareMutations' | 'hatMutations' | 'transientMutations' |
  'barMutations' | 'fourBarVariations' | 'eightBarRecruitment' | 'sixteenBarEvolution' | 'modulations'>> {
  const pulse = restrained ? 0.66 : 0.86
  return {
    beatMutations: [
      { ...beamMutation(`${sceneId}-beat-left`, 'leftLasers', baseShape, CYAN, pulse, restrained ? 38 : 72), beatDivision: 1, beatOffsets: [0, 2], beatCycleLength: 4, responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE },
      { ...beamMutation(`${sceneId}-beat-right`, 'rightLasers', baseShape, MAGENTA, pulse, restrained ? 38 : 72), beatDivision: 1, beatOffsets: [1, 3], beatCycleLength: 4, responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE },
    ] satisfies LaserDmxShowDirectorPerformanceBeatMutation[],
    kickMutations: [{ id: `${sceneId}-kick`, threshold: 0.38, address: address('kick'), fixture: { enabled: true, brightness: 1, color: CYAN, fanSpread: restrained ? 34 : 84, beamAppearance: { width: restrained ? 1.2 : 2, glow: 1 }, beamTravel: { mode: restrained ? 'static' : 'grow', beatsPerTravel: 1, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' } }],
    snareMutations: [{ id: `${sceneId}-snare`, threshold: 0.38, address: address('snare'), fixture: { enabled: true, brightness: restrained ? 0.72 : 1, color: WHITE, fanSpread: restrained ? 34 : 82, beamAppearance: { width: restrained ? 1.35 : 2.2, glow: 1 }, component: { movingHeadPanTiltStyle: restrained ? 'locked' : 'snap' }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' } }],
    hatMutations: [{ id: `${sceneId}-hat`, threshold: 0.26, address: address('hat'), fixture: { enabled: true, brightness: restrained ? 0.42 : 0.68, color: VIOLET, fanSpread: 24, beamAppearance: { width: 0.9, glow: 0.7 }, beamTravel: { mode: 'pulseTrain', beatsPerTravel: 0.5, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' } }],
    transientMutations: [{ ...strobeMutation(`${sceneId}-transient`, restrained ? 0.72 : 1, 82), threshold: 0.68 }],
    barMutations: [
      { id: `${sceneId}-bar-a`, intervalBars: 2, anchorBar: 0, address: address('allBeams'), fixture: { rotation: -7 } },
      { id: `${sceneId}-bar-b`, intervalBars: 2, anchorBar: 1, address: address('allBeams'), fixture: { rotation: 7 } },
    ],
    fourBarVariations: fourBarVariations(sceneId),
    eightBarRecruitment: [
      { id: `${sceneId}-eight-core`, stage: 1, cumulative: true, address: address('corePrism'), fixture: { enabled: true, brightness: restrained ? 0.34 : 0.58, color: CYAN, fanSpread: restrained ? 28 : 52, targetMode: 'fixed', targetPointsByFixtureSemanticKey: targetMap(baseShape, bank('corePrism')) } },
      { id: `${sceneId}-eight-outer`, stage: 2, cumulative: true, address: address('outerPrism'), fixture: { enabled: true, brightness: restrained ? 0.26 : 0.52, color: MAGENTA, fanSpread: restrained ? 24 : 58, targetMode: 'fixed', targetPointsByFixtureSemanticKey: targetMap(baseShape, bank('outerPrism')) } },
      { id: `${sceneId}-eight-portal`, stage: 2, cumulative: true, address: address('portalLed'), fixture: { enabled: true, brightness: restrained ? 0.28 : 0.54, color: BLUE } },
    ],
    sixteenBarEvolution: [{ id: `${sceneId}-sixteen`, phase: 1, phraseLengthBars: 16, address: address('allBeams'), fixture: { enabled: true, brightness: restrained ? 0.56 : 0.84, color: ICE, targetMode: 'fixed', targetPointsByFixtureSemanticKey: targetMap('diamond', bank('allBeams')), fanSpread: restrained ? 48 : 104 } }],
    modulations: [
      { source: 'nBass', target: 'fixture.fanSpread', amount: restrained ? 5 : 14, min: 0, max: restrained ? 5 : 14, mode: 'add' as const, requiredCapability: 'Live Bands' },
      { source: 'trackEnergy', target: 'fixture.brightness', amount: restrained ? 0.06 : 0.12, min: 0, max: restrained ? 0.06 : 0.12, mode: 'add' as const, requiredCapability: 'Track Energy Curve' },
      { source: 'spectralFlux', target: 'fixture.beamWidth', amount: restrained ? 0.14 : 0.38, min: 0, max: restrained ? 0.14 : 0.38, mode: 'add' as const },
    ],
  }
}

function sceneBase(
  id: string, label: string, match: LaserDmxShowDirectorPerformanceSectionMatch,
  energyEnvelopeKey: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  patch: Partial<LaserDmxShowDirectorPerformanceScene>,
): LaserDmxShowDirectorPerformanceScene {
  return {
    id,
    label,
    enabled: true,
    priority: 12,
    section: match,
    address: { fixtureKinds: Array.from(new Set(FIXTURES.map(fixture => fixture.kind))) },
    fixture: { enabled: false, brightness: 0 },
    global: { dimmer: 0.82, globalGlow: 0.78, beamPersistence: 0.08, backgroundFade: 0.86, haze: 0.1 },
    energyEnvelopeKey,
    transitionIn: { durationBars: 0.08, curve: 'step' },
    transitionOut: { durationBars: 0.08, curve: 'step' },
    ...patch,
  }
}

function introScene(): LaserDmxShowDirectorPerformanceScene {
  const id = `${PRESET_ID}-intro`
  return sceneBase(id, `${PRESET_NAME} · Prismatic Opening`, section(['intro']), 'intro', {
    global: { dimmer: 0.64, globalGlow: 0.72, beamPersistence: 0.18, backgroundFade: 0.9, haze: 0.18 },
    ...commonCadence(id, 'prism', true),
    sectionBodyMutations: [
      beamMutation(`${id}-left`, 'leftLasers', 'prism', CYAN, 0.56, 52, { beamTravel: { mode: 'static', beatsPerTravel: 4, retrigger: 'continue', direction: 'forward' } }),
      beamMutation(`${id}-center`, 'centerLasers', 'prism', GREEN, 0.62, 44, { beamTravel: { mode: 'static', beatsPerTravel: 4, retrigger: 'continue', direction: 'forward' } }),
      beamMutation(`${id}-right`, 'rightLasers', 'prism', MAGENTA, 0.56, 52, { beamTravel: { mode: 'static', beatsPerTravel: 4, retrigger: 'continue', direction: 'forward' } }),
      beamMutation(`${id}-heads`, 'fanHeads', 'prism', WARM_WHITE, 0.42, 34, { component: { movingHeadPanTiltStyle: 'smoothSweep' } }),
      hazeMutation(`${id}-haze`, 0.18),
    ],
  })
}

function verseScene(): LaserDmxShowDirectorPerformanceScene {
  const id = `${PRESET_ID}-verse`
  const cadence = commonCadence(id, 'horizon', true)
  return sceneBase(id, `${PRESET_NAME} · Horizon / Vocal`, section(['verse']), 'verse', {
    global: { dimmer: 0.58, globalGlow: 0.58, beamPersistence: 0.14, backgroundFade: 0.92, haze: 0.16 },
    ...cadence,
    beatMutations: cadence.beatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    kickMutations: cadence.kickMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    hatMutations: cadence.hatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    sectionBodyMutations: [
      beamMutation(`${id}-horizon-gap`, 'horizon', 'horizon', CYAN, 0.48, 54, { beamAppearance: { width: 1.05, glow: 0.7 } }, lyricGap),
      beamMutation(`${id}-vocal-heads`, 'vocalIsolation', 'fan', WARM_WHITE, 0.58, 24, { component: { movingHeadPanTiltStyle: 'locked' }, beamAppearance: { width: 1.45, glow: 0.84 } }, lyricActive),
      beamMutation(`${id}-stem-heads`, 'vocalIsolation', 'fan', WARM_WHITE, 0.52, 24, { component: { movingHeadPanTiltStyle: 'locked' } }, vocalStemActive),
      ledMutation(`${id}-portal-blue`, BLUE, 0.38),
      hazeMutation(`${id}-haze`, 0.16),
    ],
  })
}

function buildScene(): LaserDmxShowDirectorPerformanceScene {
  const id = `${PRESET_ID}-build`
  return sceneBase(id, `${PRESET_NAME} · Prism Convergence`, section(['build']), 'build', {
    global: { dimmer: 0.78, globalGlow: 0.84, beamPersistence: 0.09, backgroundFade: 0.82, haze: 0.28 },
    ...commonCadence(id, 'prism'),
    sectionBodyMutations: [
      beamMutation(`${id}-core`, 'corePrism', 'prism', CYAN, 0.7, 64),
      beamMutation(`${id}-outer-late`, 'outerPrism', 'lattice', MAGENTA, 0.76, 86, {}, [{ source: 'buildProgress', operator: 'gt', value: 0.5 }]),
      ledMutation(`${id}-portal-late`, VIOLET, 0.64, [{ source: 'buildProgress', operator: 'gt', value: 0.62 }]),
      { ...strobeMutation(`${id}-strobe-late`, 0.74, 72), conditions: [{ source: 'buildProgress', operator: 'gt', value: 0.78 }] },
      hazeMutation(`${id}-haze`, 0.28),
    ],
  })
}

function preDropScene(): LaserDmxShowDirectorPerformanceScene {
  const id = `${PRESET_ID}-pre-drop`
  return sceneBase(id, `${PRESET_NAME} · Red Trace / White Fan`, section(['preDrop']), 'preDrop', {
    global: { dimmer: 0.5, globalGlow: 0.48, beamPersistence: 0.03, backgroundFade: 0.96, haze: 0.12 },
    ...commonCadence(id, 'tracers', true),
    blackoutWindows: [{ id: `${id}-end-cut`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: 0.75, justification: 'Reference-inspired final-beat visual breath, clamped by Show Director blackout safety.' }],
    sectionBodyMutations: [
      beamMutation(`${id}-trace`, 'tracers', 'tracers', RED, 0.48, 24, { beamAppearance: { width: 0.9, glow: 0.6 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      ledMutation(`${id}-red-portal`, RED, 0.26),
      hazeMutation(`${id}-haze`, 0.12),
    ],
    sectionExitMutations: [
      beamMutation(`${id}-white-fan`, 'fanHeads', 'crossFan', WHITE, 0.92, 84, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.1, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    ],
  })
}

function dropScene(second: boolean): LaserDmxShowDirectorPerformanceScene {
  const kind: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey = second ? 'drop2' : 'drop1'
  const id = `${PRESET_ID}-${second ? 'drop-2' : 'drop-1'}`
  const matrix = matrixCycle(id, second)
  return sceneBase(id, `${PRESET_NAME} · ${second ? 'Drop 2 Expanded Matrix' : 'Drop 1 Beat Matrix'}`, section(['drop'], second ? { minOccurrence: 2 } : [1]), kind, {
    global: { dimmer: second ? 1 : 0.96, globalGlow: 1, beamPersistence: 0.035, backgroundFade: second ? 0.64 : 0.7, haze: second ? 0.42 : 0.34 },
    beatMutations: matrix,
    kickMutations: [{ id: `${id}-kick`, threshold: 0.36, address: address('kick'), fixture: { enabled: true, brightness: 1, color: CYAN, fanSpread: second ? 120 : 104, beamAppearance: { width: second ? 2.5 : 2.2, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' } }],
    snareMutations: [
      { id: `${id}-snare-heads`, threshold: 0.36, address: address('snare'), fixture: { enabled: true, brightness: 1, color: WHITE, fanSpread: second ? 96 : 82, component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.3, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' } },
      { ...strobeMutation(`${id}-snare-strobe`, second ? 1 : 0.88, 78), threshold: 0.5 },
    ],
    hatMutations: [{ id: `${id}-hat`, threshold: 0.25, address: address('hat'), fixture: { enabled: true, brightness: 0.66, color: VIOLET, fanSpread: 22, beamAppearance: { width: 0.85, glow: 0.68 }, beamTravel: { mode: 'pulseTrain', beatsPerTravel: 0.5, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' } }],
    transientMutations: [{ ...strobeMutation(`${id}-transient`, 1, 88), threshold: 0.7 }],
    barMutations: [
      { id: `${id}-bar-even`, intervalBars: 2, anchorBar: 0, address: address('allBeams'), fixture: { rotation: second ? -10 : -6 } },
      { id: `${id}-bar-odd`, intervalBars: 2, anchorBar: 1, address: address('allBeams'), fixture: { rotation: second ? 10 : 6 } },
    ],
    fourBarVariations: fourBarVariations(id),
    eightBarRecruitment: [
      { id: `${id}-stage-core`, stage: 1, cumulative: true, address: address('corePrism'), fixture: { enabled: true, brightness: 0.2, color: BLUE, fanSpread: 34, targetMode: 'fixed', targetPointsByFixtureSemanticKey: targetMap('prism', bank('corePrism')), beamVisualRole: 'texture', beamPriorityRole: 'decorativeAccent' } },
      { id: `${id}-stage-outer`, stage: 2, cumulative: true, address: address('outerPrism'), fixture: { enabled: true, brightness: second ? 0.38 : 0.26, color: MAGENTA, fanSpread: 48, targetMode: 'fixed', targetPointsByFixtureSemanticKey: targetMap(second ? 'diamond' : 'lattice', bank('outerPrism')), beamVisualRole: 'secondary', beamPriorityRole: 'secondaryFan' } },
      { id: `${id}-stage-portal`, stage: 2, cumulative: true, address: address('portalLed'), fixture: { enabled: true, brightness: second ? 0.5 : 0.32, color: second ? CYAN : BLUE } },
    ],
    sixteenBarEvolution: [{ id: `${id}-sixteen-evolution`, phase: 1, phraseLengthBars: 16, address: address('allBeams'), fixture: { rotation: second ? 14 : 9, focus: second ? 0.98 : 0.94 } }],
    sectionEntryMutations: [strobeMutation(`${id}-entry`, 1, 96)],
    sectionBodyMutations: [hazeMutation(`${id}-haze`, second ? 0.42 : 0.34)],
    blackoutWindows: second ? [{ id: `${id}-fakeout`, kind: 'fakeout', anchor: 'sectionStart', offsetBeats: 6, durationBeats: 0.25, justification: 'A quarter-beat matrix reset between the magenta cage and cyan answer.' }] : undefined,
    modulations: [
      { source: 'nBass', target: 'fixture.fanSpread', amount: second ? 18 : 14, min: 0, max: second ? 18 : 14, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'spectralFlux', target: 'fixture.beamWidth', amount: second ? 0.46 : 0.36, min: 0, max: second ? 0.46 : 0.36, mode: 'add' },
      { source: 'trackEnergy', target: 'fixture.brightness', amount: 0.1, min: 0, max: 0.1, mode: 'add', requiredCapability: 'Track Energy Curve' },
    ],
  })
}

function breakdownScene(): LaserDmxShowDirectorPerformanceScene {
  const id = `${PRESET_ID}-breakdown`
  const cadence = commonCadence(id, 'portal', true)
  return sceneBase(id, `${PRESET_NAME} · Portal Interlude`, section(['breakdown', 'bridge']), 'breakdown', {
    global: { dimmer: 0.48, globalGlow: 0.5, beamPersistence: 0.18, backgroundFade: 0.94, haze: 0.16 },
    ...cadence,
    beatMutations: cadence.beatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    sectionBodyMutations: [
      beamMutation(`${id}-portal-gap`, 'portalBeams', 'portal', GREEN, 0.5, 42, { beamAppearance: { width: 1.15, glow: 0.72 } }, lyricGap),
      beamMutation(`${id}-vocal`, 'vocalIsolation', 'fan', WARM_WHITE, 0.54, 22, { component: { movingHeadPanTiltStyle: 'locked' } }, lyricActive),
      beamMutation(`${id}-stem`, 'vocalIsolation', 'fan', WARM_WHITE, 0.48, 22, { component: { movingHeadPanTiltStyle: 'locked' } }, vocalStemActive),
      ledMutation(`${id}-portal-led`, BLUE, 0.44),
      hazeMutation(`${id}-haze`, 0.16),
    ],
  })
}

function outroScene(): LaserDmxShowDirectorPerformanceScene {
  const id = `${PRESET_ID}-outro`
  return sceneBase(id, `${PRESET_NAME} · Red Trace Release`, section(['outro']), 'outro', {
    global: { dimmer: 0.38, globalGlow: 0.4, beamPersistence: 0.2, backgroundFade: 0.97, haze: 0.08 },
    ...commonCadence(id, 'tracers', true),
    sectionBodyMutations: [
      beamMutation(`${id}-tracers`, 'tracers', 'tracers', RED, 0.36, 18, { beamAppearance: { width: 0.76, glow: 0.48 }, beamTravel: { mode: 'scanner', beatsPerTravel: 4, retrigger: 'continue', direction: 'forward' }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      ledMutation(`${id}-portal`, RED, 0.18),
      hazeMutation(`${id}-haze`, 0.08),
    ],
  })
}

function bankAddresses(): Record<string, LaserDmxShowDirectorPerformanceAddress> {
  return Object.fromEntries(Object.entries(BANKS).map(([role, fixtureSemanticKeys]) => [role, { fixtureSemanticKeys: [...fixtureSemanticKeys] }]))
}

function bankMetadata(): Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata> {
  return Object.fromEntries(Object.entries(BANKS).map(([role, fixtureSemanticKeys]) => [role, {
    role,
    label: role.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase()),
    description: `${PRESET_NAME} authored ${role} fixture bank.`,
    address: { fixtureSemanticKeys: [...fixtureSemanticKeys] },
  }]))
}

export function createPrismaticPulseMatrixProgram(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
    id: PRESET_ID,
    name: PRESET_NAME,
    description: 'A 152-BPM reference-inspired cue matrix that holds a prismatic opening, breathes through red trace and white-fan tension, then replaces the drop geometry on nearly every beat through cyan daggers, horizon planes, red chevrons, magenta cages, white fans, portal frames, and sparse reset beats.',
    deterministicSeed: 1521616,
    bankRoles: bankAddresses(),
    fixtureBanks: bankMetadata(),
    energyEnvelopes: ENERGY_ENVELOPES,
    blackoutPolicy: BLACKOUT_POLICY,
    fallbackOrder: ['verse', 'intro', 'build', 'drop', 'breakdown', 'outro'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    diagnostics: {
      authoringVersion: 'reference-prismatic-pulse-matrix-v1',
      expectedFixtureSemanticKeys: FIXTURES.map(fixture => fixture.key),
      expectedGroupSemanticKeys: GROUPS.map(([key]) => key),
      notes: [
        'Reference video measured at approximately 152 BPM with 55 major beat-to-beat image changes across 74 analyzed beats.',
        'Drop choreography uses a deterministic sixteen-beat matrix: cyan verticals, horizon planes, red chevrons, blue lattice, magenta shards, sparse reset, white fans, and red return.',
        'Full-black reference gaps are translated into bounded blackout windows or dim red tracers so Show Director safety and breakdown visibility remain authoritative.',
        'Section role still chooses the visual world; beat slots replace geometry only inside the high-energy matrix scenes.',
      ],
    },
    scenes: [introScene(), verseScene(), buildScene(), preDropScene(), dropScene(false), breakdownScene(), dropScene(true), outroScene()],
  }
}

export const LASER_DMX_SHOW_DIRECTOR_PRISMATIC_PULSE_MATRIX_PRESET: LaserDmxShowDirectorPerformancePresetDefinition = Object.freeze({
  id: PRESET_ID,
  name: PRESET_NAME,
  description: 'Rapid one-beat geometry replacement inside a sixteen-beat phrase, framed by a stable multicolor prism opening, red trace tension, white moving-head fan, cyan planes, magenta cages, portal LEDs, and bounded negative-space resets.',
  genreTags: ['festival bass', 'techno', 'trance', 'high-energy EDM'],
  behaviorTags: ['sixteen-beat cue matrix', 'one-beat geometry swaps', 'prismatic color chapters', 'bounded blackout resets'],
  supportedSectionRoles: [...ALL_SECTIONS],
  musicIntelligenceCapabilities: [...MUSIC_CAPABILITIES],
  fixtureCount: FIXTURES.length,
  approximatePeakBeamDemand: 244,
  createRig: createPrismaticPulseMatrixRig,
  createProgram: createPrismaticPulseMatrixProgram,
})
