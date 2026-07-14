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
const ICE = '#d9fbff'
const BLUE = '#4b73ff'
const GREEN = '#42ff80'
const MAGENTA = '#ff35d1'
const VIOLET = '#8f5cff'
const CRIMSON = '#ff174d'
const RED = '#d90838'
const DEEP_RED = '#78001f'
const WHITE = '#ffffff'
const WARM_WHITE = '#ffe0b2'

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
  maximumProgrammedBlackoutRatio: 0.075,
  retriggerGuardBeats: 0.5,
  breakdownRequiresVisibleOutput: true,
  minimumVisibleFixtureBrightness: 0.22,
})

type CreateId = () => string
type Shape =
  | 'beacon' | 'sail' | 'helix' | 'canopy' | 'ribbonSweep' | 'ribbonFrame' | 'ribbonShards' | 'halo' | 'fan' | 'horizon'
  | 'apex' | 'roof' | 'chevron' | 'invertedV' | 'pyramidFan' | 'doubleApex' | 'edgeCut' | 'sideWings' | 'shrine' | 'crossFan' | 'spine'
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
type ShowSpec = {
  id: string
  name: string
  referenceTempo: number
  fixtureSpecs: readonly FixtureSpec[]
  groups: readonly (readonly [string, string])[]
  banks: Readonly<Record<string, readonly string[]>>
  energyEnvelopes: Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserDmxShowDirectorSectionEnergyEnvelope>
}

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

const RIBBON_ENVELOPES: Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserDmxShowDirectorSectionEnergyEnvelope> = Object.freeze({
  intro: envelope([2, 5], [10, 66], [0.36, 0.74], [18, 84], [0.06, 0.42], [0.5, 0.9], [0.04, 0.28], [0.4, 0.82]),
  verse: envelope([2, 5], [8, 58], [0.34, 0.68], [16, 72], [0.04, 0.34], [0.46, 0.8], [0.03, 0.22], [0.52, 0.88]),
  build: envelope([4, 8], [26, 146], [0.56, 0.94], [34, 118], [0.28, 0.9], [0.72, 1], [0.1, 0.5], [0.12, 0.62]),
  preDrop: envelope([1, 4], [3, 34], [0.3, 0.76], [8, 54], [0.02, 0.34], [0.4, 0.78], [0.008, 0.14], [0.7, 0.96]),
  drop1: envelope([5, 9], [52, 208], [0.78, 1], [52, 132], [0.56, 1], [0.88, 1], [0.18, 0.66], [0.04, 0.4]),
  breakdown: envelope([2, 5], [6, 52], [0.3, 0.66], [10, 68], [0.03, 0.32], [0.44, 0.76], [0.02, 0.18], [0.66, 0.94]),
  drop2: envelope([6, 10], [76, 266], [0.86, 1], [66, 144], [0.68, 1], [0.94, 1], [0.28, 0.74], [0.02, 0.28]),
  outro: envelope([1, 4], [3, 34], [0.24, 0.56], [6, 46], [0.02, 0.26], [0.32, 0.64], [0.006, 0.12], [0.76, 0.97]),
})

const APEX_ENVELOPES: Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserDmxShowDirectorSectionEnergyEnvelope> = Object.freeze({
  intro: envelope([2, 4], [8, 52], [0.32, 0.68], [16, 70], [0.04, 0.36], [0.46, 0.82], [0.03, 0.22], [0.56, 0.9]),
  verse: envelope([2, 4], [6, 46], [0.3, 0.64], [12, 58], [0.03, 0.3], [0.42, 0.72], [0.02, 0.18], [0.64, 0.92]),
  build: envelope([3, 7], [22, 126], [0.52, 0.9], [26, 104], [0.24, 0.84], [0.66, 0.98], [0.08, 0.42], [0.18, 0.68]),
  preDrop: envelope([1, 3], [2, 24], [0.26, 0.7], [6, 38], [0.02, 0.28], [0.34, 0.68], [0.005, 0.1], [0.78, 0.97]),
  drop1: envelope([4, 8], [40, 184], [0.76, 1], [42, 118], [0.5, 1], [0.84, 1], [0.14, 0.58], [0.08, 0.46]),
  breakdown: envelope([2, 4], [5, 36], [0.26, 0.58], [8, 44], [0.02, 0.26], [0.36, 0.66], [0.01, 0.12], [0.74, 0.96]),
  drop2: envelope([6, 9], [68, 246], [0.86, 1], [58, 138], [0.64, 1], [0.92, 1], [0.24, 0.7], [0.02, 0.3]),
  outro: envelope([1, 3], [2, 24], [0.22, 0.52], [4, 34], [0.01, 0.22], [0.3, 0.58], [0.004, 0.08], [0.8, 0.98]),
})

const RIBBON_ID = 'spectral-ribbon-singularity'
const RIBBON_NAME = 'Spectral Ribbon Singularity'
const RIBBON_GROUPS = [
  ['ribbon-laser-left', 'Ribbon Lasers Left'],
  ['ribbon-laser-center', 'Ribbon Lasers Center'],
  ['ribbon-laser-right', 'Ribbon Lasers Right'],
  ['ribbon-heads', 'Ribbon Moving Heads'],
  ['ribbon-led-left', 'Ribbon Panels Left'],
  ['ribbon-led-right', 'Ribbon Panels Right'],
  ['ribbon-impact', 'Ribbon Impact'],
  ['ribbon-atmosphere', 'Ribbon Atmosphere'],
] as const
const RIBBON_FIXTURES: readonly FixtureSpec[] = [
  { key: 'ribbon-laser-top-l-outer', label: 'Ribbon Laser Top L Outer', kind: 'laser', group: 'ribbon-laser-left', x: 2, y: 1, targetX: 9, targetY: 12, color: CYAN },
  { key: 'ribbon-laser-top-l-inner', label: 'Ribbon Laser Top L Inner', kind: 'laser', group: 'ribbon-laser-left', x: 6, y: 1, targetX: 11, targetY: 12, color: VIOLET },
  { key: 'ribbon-laser-center-l', label: 'Ribbon Laser Center L', kind: 'laser', group: 'ribbon-laser-center', x: 10, y: 2, targetX: 12, targetY: 12, color: GREEN },
  { key: 'ribbon-laser-center', label: 'Ribbon Laser Center', kind: 'laser', group: 'ribbon-laser-center', x: 12, y: 1, targetX: 12, targetY: 13, color: WHITE },
  { key: 'ribbon-laser-center-r', label: 'Ribbon Laser Center R', kind: 'laser', group: 'ribbon-laser-center', x: 14, y: 2, targetX: 12, targetY: 12, color: MAGENTA },
  { key: 'ribbon-laser-top-r-inner', label: 'Ribbon Laser Top R Inner', kind: 'laser', group: 'ribbon-laser-right', x: 18, y: 1, targetX: 13, targetY: 12, color: VIOLET },
  { key: 'ribbon-laser-top-r-outer', label: 'Ribbon Laser Top R Outer', kind: 'laser', group: 'ribbon-laser-right', x: 22, y: 1, targetX: 15, targetY: 12, color: CYAN },
  { key: 'ribbon-laser-side-l', label: 'Ribbon Laser Side L', kind: 'laser', group: 'ribbon-laser-left', x: 1, y: 6, targetX: 12, targetY: 8, color: GREEN },
  { key: 'ribbon-laser-side-r', label: 'Ribbon Laser Side R', kind: 'laser', group: 'ribbon-laser-right', x: 23, y: 6, targetX: 12, targetY: 8, color: MAGENTA },
  { key: 'ribbon-head-l-outer', label: 'Ribbon Head L Outer', kind: 'movingHead', group: 'ribbon-heads', x: 4, y: 3, targetX: 8, targetY: 11, color: ICE, spread: 30 },
  { key: 'ribbon-head-l-inner', label: 'Ribbon Head L Inner', kind: 'movingHead', group: 'ribbon-heads', x: 8, y: 3, targetX: 10, targetY: 12, color: WHITE, spread: 26 },
  { key: 'ribbon-head-center', label: 'Ribbon Head Center', kind: 'movingHead', group: 'ribbon-heads', x: 12, y: 2, targetX: 12, targetY: 13, color: WHITE, spread: 20 },
  { key: 'ribbon-head-r-inner', label: 'Ribbon Head R Inner', kind: 'movingHead', group: 'ribbon-heads', x: 16, y: 3, targetX: 14, targetY: 12, color: WHITE, spread: 26 },
  { key: 'ribbon-head-r-outer', label: 'Ribbon Head R Outer', kind: 'movingHead', group: 'ribbon-heads', x: 20, y: 3, targetX: 16, targetY: 11, color: ICE, spread: 30 },
  { key: 'ribbon-led-l-top', label: 'Ribbon LED L Top', kind: 'ledBar', group: 'ribbon-led-left', x: 3, y: 5, color: CYAN },
  { key: 'ribbon-led-l-mid', label: 'Ribbon LED L Mid', kind: 'ledBar', group: 'ribbon-led-left', x: 5, y: 7, color: GREEN },
  { key: 'ribbon-led-l-low', label: 'Ribbon LED L Low', kind: 'ledBar', group: 'ribbon-led-left', x: 7, y: 10, color: VIOLET },
  { key: 'ribbon-led-r-top', label: 'Ribbon LED R Top', kind: 'ledBar', group: 'ribbon-led-right', x: 21, y: 5, color: MAGENTA },
  { key: 'ribbon-led-r-mid', label: 'Ribbon LED R Mid', kind: 'ledBar', group: 'ribbon-led-right', x: 19, y: 7, color: GREEN },
  { key: 'ribbon-led-r-low', label: 'Ribbon LED R Low', kind: 'ledBar', group: 'ribbon-led-right', x: 17, y: 10, color: VIOLET },
  { key: 'ribbon-strobe', label: 'Ribbon Center Strobe', kind: 'strobe', group: 'ribbon-impact', x: 12, y: 4, color: WHITE },
  { key: 'ribbon-haze', label: 'Ribbon Haze', kind: 'haze', group: 'ribbon-atmosphere', x: 12, y: 12, color: ICE },
]
const RIBBON_BANKS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  allLasers: RIBBON_FIXTURES.filter(fixture => fixture.kind === 'laser').map(fixture => fixture.key),
  allHeads: RIBBON_FIXTURES.filter(fixture => fixture.kind === 'movingHead').map(fixture => fixture.key),
  allBeams: RIBBON_FIXTURES.filter(fixture => fixture.kind === 'laser' || fixture.kind === 'movingHead').map(fixture => fixture.key),
  leftRibbon: ['ribbon-laser-top-l-outer', 'ribbon-laser-top-l-inner', 'ribbon-laser-side-l', 'ribbon-head-l-outer', 'ribbon-head-l-inner'],
  centerRibbon: ['ribbon-laser-center-l', 'ribbon-laser-center', 'ribbon-laser-center-r', 'ribbon-head-center'],
  rightRibbon: ['ribbon-laser-top-r-inner', 'ribbon-laser-top-r-outer', 'ribbon-laser-side-r', 'ribbon-head-r-inner', 'ribbon-head-r-outer'],
  beacon: ['ribbon-laser-center', 'ribbon-head-center'],
  sails: ['ribbon-laser-top-l-outer', 'ribbon-laser-top-l-inner', 'ribbon-laser-top-r-inner', 'ribbon-laser-top-r-outer', 'ribbon-head-l-outer', 'ribbon-head-r-outer'],
  canopy: ['ribbon-laser-top-l-outer', 'ribbon-laser-top-l-inner', 'ribbon-laser-center-l', 'ribbon-laser-center-r', 'ribbon-laser-top-r-inner', 'ribbon-laser-top-r-outer'],
  helix: ['ribbon-laser-top-l-inner', 'ribbon-laser-center-l', 'ribbon-laser-center-r', 'ribbon-laser-top-r-inner'],
  outline: ['ribbon-laser-side-l', 'ribbon-laser-top-l-outer', 'ribbon-laser-top-r-outer', 'ribbon-laser-side-r'],
  fanHeads: RIBBON_FIXTURES.filter(fixture => fixture.kind === 'movingHead').map(fixture => fixture.key),
  ribbonLed: RIBBON_FIXTURES.filter(fixture => fixture.kind === 'ledBar').map(fixture => fixture.key),
  ribbonLedLeft: ['ribbon-led-l-top', 'ribbon-led-l-mid', 'ribbon-led-l-low'],
  ribbonLedRight: ['ribbon-led-r-top', 'ribbon-led-r-mid', 'ribbon-led-r-low'],
  kick: ['ribbon-laser-center-l', 'ribbon-laser-center', 'ribbon-laser-center-r'],
  snare: ['ribbon-head-l-inner', 'ribbon-head-center', 'ribbon-head-r-inner'],
  hat: ['ribbon-laser-top-l-inner', 'ribbon-laser-top-r-inner'],
  strobe: ['ribbon-strobe'],
  atmosphere: ['ribbon-haze'],
  vocalIsolation: ['ribbon-head-l-inner', 'ribbon-head-center', 'ribbon-head-r-inner'],
})
const RIBBON_SPEC: ShowSpec = {
  id: RIBBON_ID,
  name: RIBBON_NAME,
  referenceTempo: 129,
  fixtureSpecs: RIBBON_FIXTURES,
  groups: RIBBON_GROUPS,
  banks: RIBBON_BANKS,
  energyEnvelopes: RIBBON_ENVELOPES,
}

const APEX_ID = 'crimson-apex-protocol'
const APEX_NAME = 'Crimson Apex Protocol'
const APEX_GROUPS = [
  ['apex-laser-left', 'Apex Lasers Left'],
  ['apex-laser-center', 'Apex Lasers Center'],
  ['apex-laser-right', 'Apex Lasers Right'],
  ['apex-heads', 'Apex White Edges'],
  ['apex-led', 'Apex Roof LEDs'],
  ['apex-impact', 'Apex Impact'],
  ['apex-atmosphere', 'Apex Atmosphere'],
] as const
const APEX_FIXTURES: readonly FixtureSpec[] = [
  { key: 'apex-laser-top-l-outer', label: 'Apex Laser Top L Outer', kind: 'laser', group: 'apex-laser-left', x: 2, y: 1, targetX: 10, targetY: 12, color: CRIMSON },
  { key: 'apex-laser-top-l-inner', label: 'Apex Laser Top L Inner', kind: 'laser', group: 'apex-laser-left', x: 7, y: 1, targetX: 11, targetY: 12, color: RED },
  { key: 'apex-laser-center-l', label: 'Apex Laser Center L', kind: 'laser', group: 'apex-laser-center', x: 10, y: 2, targetX: 12, targetY: 12, color: CRIMSON },
  { key: 'apex-laser-center-r', label: 'Apex Laser Center R', kind: 'laser', group: 'apex-laser-center', x: 14, y: 2, targetX: 12, targetY: 12, color: CRIMSON },
  { key: 'apex-laser-top-r-inner', label: 'Apex Laser Top R Inner', kind: 'laser', group: 'apex-laser-right', x: 17, y: 1, targetX: 13, targetY: 12, color: RED },
  { key: 'apex-laser-top-r-outer', label: 'Apex Laser Top R Outer', kind: 'laser', group: 'apex-laser-right', x: 22, y: 1, targetX: 14, targetY: 12, color: CRIMSON },
  { key: 'apex-laser-side-l', label: 'Apex Laser Side L', kind: 'laser', group: 'apex-laser-left', x: 1, y: 7, targetX: 12, targetY: 8, color: DEEP_RED },
  { key: 'apex-laser-side-r', label: 'Apex Laser Side R', kind: 'laser', group: 'apex-laser-right', x: 23, y: 7, targetX: 12, targetY: 8, color: DEEP_RED },
  { key: 'apex-head-l-outer', label: 'Apex Head L Outer', kind: 'movingHead', group: 'apex-heads', x: 4, y: 3, targetX: 9, targetY: 11, color: WHITE, spread: 24 },
  { key: 'apex-head-l-inner', label: 'Apex Head L Inner', kind: 'movingHead', group: 'apex-heads', x: 8, y: 3, targetX: 11, targetY: 12, color: WHITE, spread: 20 },
  { key: 'apex-head-center', label: 'Apex Head Center', kind: 'movingHead', group: 'apex-heads', x: 12, y: 2, targetX: 12, targetY: 13, color: WHITE, spread: 18 },
  { key: 'apex-head-r-inner', label: 'Apex Head R Inner', kind: 'movingHead', group: 'apex-heads', x: 16, y: 3, targetX: 13, targetY: 12, color: WHITE, spread: 20 },
  { key: 'apex-head-r-outer', label: 'Apex Head R Outer', kind: 'movingHead', group: 'apex-heads', x: 20, y: 3, targetX: 15, targetY: 11, color: WHITE, spread: 24 },
  { key: 'apex-led-l-upper', label: 'Apex LED L Upper', kind: 'ledBar', group: 'apex-led', x: 5, y: 6, color: CRIMSON },
  { key: 'apex-led-l-lower', label: 'Apex LED L Lower', kind: 'ledBar', group: 'apex-led', x: 8, y: 9, color: RED },
  { key: 'apex-led-r-lower', label: 'Apex LED R Lower', kind: 'ledBar', group: 'apex-led', x: 16, y: 9, color: RED },
  { key: 'apex-led-r-upper', label: 'Apex LED R Upper', kind: 'ledBar', group: 'apex-led', x: 19, y: 6, color: CRIMSON },
  { key: 'apex-strobe', label: 'Apex Strobe', kind: 'strobe', group: 'apex-impact', x: 12, y: 4, color: WHITE },
  { key: 'apex-haze', label: 'Apex Haze', kind: 'haze', group: 'apex-atmosphere', x: 12, y: 12, color: CRIMSON },
]
const APEX_BANKS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  allLasers: APEX_FIXTURES.filter(fixture => fixture.kind === 'laser').map(fixture => fixture.key),
  allHeads: APEX_FIXTURES.filter(fixture => fixture.kind === 'movingHead').map(fixture => fixture.key),
  allBeams: APEX_FIXTURES.filter(fixture => fixture.kind === 'laser' || fixture.kind === 'movingHead').map(fixture => fixture.key),
  leftApex: ['apex-laser-top-l-outer', 'apex-laser-top-l-inner', 'apex-laser-side-l'],
  centerApex: ['apex-laser-center-l', 'apex-laser-center-r', 'apex-head-center'],
  rightApex: ['apex-laser-top-r-inner', 'apex-laser-top-r-outer', 'apex-laser-side-r'],
  redApex: APEX_FIXTURES.filter(fixture => fixture.kind === 'laser').map(fixture => fixture.key),
  roof: ['apex-laser-top-l-outer', 'apex-laser-top-l-inner', 'apex-laser-top-r-inner', 'apex-laser-top-r-outer'],
  pyramidFan: ['apex-laser-top-l-outer', 'apex-laser-top-l-inner', 'apex-laser-center-l', 'apex-laser-center-r', 'apex-laser-top-r-inner', 'apex-laser-top-r-outer'],
  sideWings: ['apex-laser-side-l', 'apex-laser-top-l-outer', 'apex-laser-top-r-outer', 'apex-laser-side-r'],
  whiteEdges: APEX_FIXTURES.filter(fixture => fixture.kind === 'movingHead').map(fixture => fixture.key),
  roofLed: APEX_FIXTURES.filter(fixture => fixture.kind === 'ledBar').map(fixture => fixture.key),
  kick: ['apex-laser-center-l', 'apex-laser-center-r'],
  snare: ['apex-head-l-inner', 'apex-head-center', 'apex-head-r-inner'],
  hat: ['apex-laser-top-l-inner', 'apex-laser-top-r-inner'],
  strobe: ['apex-strobe'],
  atmosphere: ['apex-haze'],
  vocalIsolation: ['apex-head-l-inner', 'apex-head-center', 'apex-head-r-inner'],
})
const APEX_SPEC: ShowSpec = {
  id: APEX_ID,
  name: APEX_NAME,
  referenceTempo: 144,
  fixtureSpecs: APEX_FIXTURES,
  groups: APEX_GROUPS,
  banks: APEX_BANKS,
  energyEnvelopes: APEX_ENVELOPES,
}

function isBeamFixture(kind: LaserDmxShowDirectorFixtureKind): boolean {
  return kind === 'laser' || kind === 'movingHead' || kind === 'parWash'
}

function createFixture(spec: ShowSpec, createId: CreateId, fixtureSpec: FixtureSpec, groupIds: Readonly<Record<string, string>>, index: number): LaserDmxShowDirectorFixture {
  const fixture = createDefaultLaserDmxShowDirectorFixture(fixtureSpec.kind, createId(), index)
  const beamEnabled = isBeamFixture(fixtureSpec.kind)
  return {
    ...fixture,
    semanticKey: fixtureSpec.key,
    label: fixtureSpec.label,
    groupId: groupIds[fixtureSpec.group] ?? null,
    linkedPairId: `${spec.id}-pair-${fixtureSpec.group}`,
    mirrorAxis: 'horizontal',
    x: fixtureSpec.x,
    y: fixtureSpec.y,
    color: fixtureSpec.color,
    brightness: beamEnabled ? 0.66 : 0.5,
    beam: {
      ...fixture.beam,
      beamEnabled,
      targetMode: beamEnabled ? 'fixed' : fixture.beam.targetMode,
      beamSpread: fixtureSpec.spread ?? (fixtureSpec.kind === 'movingHead' ? 24 : 46),
      focus: fixtureSpec.kind === 'movingHead' ? 0.84 : 0.92,
      targetX: fixtureSpec.targetX ?? GRID.columns / 2,
      targetY: fixtureSpec.targetY ?? GRID.rows - 1,
      targets: beamEnabled ? [{ id: `${fixtureSpec.key}-base`, x: fixtureSpec.targetX ?? GRID.columns / 2, y: fixtureSpec.targetY ?? GRID.rows - 1 }] : fixture.beam.targets,
    },
    trigger: { ...fixture.trigger, mode: 'alwaysOn', quantize: 'none', retrigger: 'allow', fadeInMs: 0, fadeOutMs: fixtureSpec.kind === 'haze' ? 800 : 0 },
    component: {
      ...fixture.component,
      movingHeadPanTiltStyle: fixtureSpec.kind === 'movingHead' ? 'snap' : fixture.component.movingHeadPanTiltStyle,
      strobeRate: fixtureSpec.kind === 'strobe' ? 18 : fixture.component.strobeRate,
      hazeIntensity: fixtureSpec.kind === 'haze' ? 0.24 : fixture.component.hazeIntensity,
    },
  }
}

function createRig(spec: ShowSpec, createId: CreateId): LaserDmxShowDirectorState {
  const groupIds = Object.fromEntries(spec.groups.map(([key]) => [key, `${spec.id}-group-${key}`]))
  const defaults = createDefaultLaserDmxShowDirectorState()
  return normalizeLaserDmxShowDirectorState({
    ...defaults,
    sourceTemplateId: null,
    groups: spec.groups.map(([key, label]) => ({ id: groupIds[key], semanticKey: key, label })),
    fixtures: spec.fixtureSpecs.map((fixture, index) => createFixture(spec, createId, fixture, groupIds, index)),
    settings: { ...defaults.settings, gridSize: { ...GRID }, snapEnabled: true, showLabels: true, showBeams: true, showGrid: true, highlightFixtures: true, zoom: 1 },
  })
}

function fixtureByKey(spec: ShowSpec, key: string): FixtureSpec | undefined { return spec.fixtureSpecs.find(fixture => fixture.key === key) }
function bank(spec: ShowSpec, role: string): readonly string[] { return spec.banks[role] ?? [] }
function points(prefix: string, values: readonly (readonly [number, number])[]): LaserDmxShowDirectorBeamTarget[] {
  return values.map(([x, y], index) => ({ id: `${prefix}-${index + 1}`, x, y }))
}

function shapePoints(spec: ShowSpec, fixture: FixtureSpec, shape: Shape): LaserDmxShowDirectorBeamTarget[] {
  const centerX = GRID.columns / 2
  const centerY = GRID.rows / 2
  const bottom = GRID.rows - 0.6
  const side = fixture.x < centerX ? -1 : 1
  const nearCenter = Math.abs(fixture.x - centerX) < 2.5
  const prefix = `${spec.id}-${shape}-${fixture.key}`
  const values: readonly (readonly [number, number])[] = (() => {
    switch (shape) {
      case 'beacon':
        return nearCenter
          ? [[centerX, bottom], [centerX - 0.7, centerY + 1.2], [centerX + 0.7, centerY + 1.2]]
          : [[centerX, bottom], [centerX + side * 1.2, centerY + 2], [centerX + side * 2.4, bottom - 0.8]]
      case 'sail':
        return side < 0
          ? [[1.2, centerY - 2.6], [5.2, centerY - 3.4], [9.4, centerY - 0.7], [5.8, centerY + 2.4], [centerX - 0.8, bottom]]
          : [[GRID.columns - 1.2, centerY - 2.6], [GRID.columns - 5.2, centerY - 3.4], [GRID.columns - 9.4, centerY - 0.7], [GRID.columns - 5.8, centerY + 2.4], [centerX + 0.8, bottom]]
      case 'helix':
        return [[centerX + side * 4.8, centerY - 3], [centerX - side * 2.2, centerY - 0.8], [centerX + side * 3.3, centerY + 1.5], [centerX - side * 1.2, bottom - 0.4]]
      case 'canopy':
        return side < 0
          ? [[1.4, centerY - 2.4], [5.5, centerY - 0.4], [9.5, centerY + 1.1], [centerX + 2.8, bottom - 0.5]]
          : [[GRID.columns - 1.4, centerY - 2.4], [GRID.columns - 5.5, centerY - 0.4], [GRID.columns - 9.5, centerY + 1.1], [centerX - 2.8, bottom - 0.5]]
      case 'ribbonSweep':
        return side < 0
          ? [[2, bottom], [6.2, centerY + 2], [10.4, centerY - 1], [centerX + 4.5, centerY - 3]]
          : [[GRID.columns - 2, bottom], [GRID.columns - 6.2, centerY + 2], [GRID.columns - 10.4, centerY - 1], [centerX - 4.5, centerY - 3]]
      case 'ribbonFrame':
        return side < 0
          ? [[2.2, centerY - 3], [2.2, centerY + 2.8], [6.6, bottom], [centerX - 0.8, centerY + 1]]
          : [[GRID.columns - 2.2, centerY - 3], [GRID.columns - 2.2, centerY + 2.8], [GRID.columns - 6.6, bottom], [centerX + 0.8, centerY + 1]]
      case 'ribbonShards':
        return [[centerX + side * 7.2, bottom], [centerX + side * 4.5, centerY + 1.1], [centerX + side * 2.5, bottom - 1.4], [centerX + side * 0.8, centerY - 0.8]]
      case 'halo':
        return [[centerX, centerY - 3.2], [centerX + side * 4.2, centerY - 0.2], [centerX, centerY + 2.6], [centerX - side * 2, centerY - 0.2], [centerX + side * 0.8, bottom]]
      case 'fan':
        return side < 0
          ? [[2, bottom], [5.4, bottom - 1], [9, bottom - 0.2], [centerX - 0.6, bottom - 1.8]]
          : [[GRID.columns - 2, bottom], [GRID.columns - 5.4, bottom - 1], [GRID.columns - 9, bottom - 0.2], [centerX + 0.6, bottom - 1.8]]
      case 'horizon':
        return side < 0
          ? [[1, centerY - 1], [5, centerY - 0.3], [9.2, centerY + 0.4], [centerX + 3.2, centerY + 1.1]]
          : [[GRID.columns - 1, centerY - 1], [GRID.columns - 5, centerY - 0.3], [GRID.columns - 9.2, centerY + 0.4], [centerX - 3.2, centerY + 1.1]]
      case 'apex':
        return [[centerX, centerY - 3.3], [centerX + side * 5.5, centerY + 1.5], [centerX + side * 2.4, bottom], [centerX, centerY + 0.7]]
      case 'roof':
        return side < 0
          ? [[1.3, centerY + 0.7], [6, centerY - 2.3], [centerX, centerY - 0.4], [centerX - 2.2, bottom]]
          : [[GRID.columns - 1.3, centerY + 0.7], [GRID.columns - 6, centerY - 2.3], [centerX, centerY - 0.4], [centerX + 2.2, bottom]]
      case 'chevron':
        return [[centerX + side * 7, centerY - 1.8], [centerX + side * 4.6, centerY + 0.5], [centerX + side * 2.2, centerY - 0.6], [centerX, bottom]]
      case 'invertedV':
        return [[centerX + side * 5.8, centerY - 2.4], [centerX, centerY + 2.7], [centerX - side * 3.4, centerY - 1.5], [centerX + side * 1.2, bottom]]
      case 'pyramidFan':
        return side < 0
          ? [[1.6, bottom], [5.4, bottom - 0.4], [9.4, centerY + 1.3], [centerX, centerY - 2.7]]
          : [[GRID.columns - 1.6, bottom], [GRID.columns - 5.4, bottom - 0.4], [GRID.columns - 9.4, centerY + 1.3], [centerX, centerY - 2.7]]
      case 'doubleApex':
        return [[centerX + side * 6.4, centerY + 1.4], [centerX + side * 3.2, centerY - 2.5], [centerX, centerY + 0.2], [centerX - side * 2.5, centerY - 1.8], [centerX + side * 0.8, bottom]]
      case 'edgeCut':
        return side < 0
          ? [[centerX + 1.2, centerY - 2.8], [centerX + 5.6, centerY + 0.2], [GRID.columns - 1.8, bottom]]
          : [[centerX - 1.2, centerY - 2.8], [centerX - 5.6, centerY + 0.2], [1.8, bottom]]
      case 'sideWings':
        return [[centerX + side * 8, centerY - 2], [centerX + side * 5, centerY + 1.2], [centerX + side * 7.2, bottom], [centerX + side * 1.6, centerY + 0.5]]
      case 'shrine':
        return [[centerX, centerY - 2.8], [centerX + side * 4.8, centerY - 0.1], [centerX + side * 3.2, bottom], [centerX, centerY + 1.8]]
      case 'crossFan':
        return side < 0
          ? [[centerX + 1.4, centerY + 0.2], [centerX + 4.4, bottom - 0.6], [GRID.columns - 2, bottom], [centerX + 5.8, centerY - 1.4]]
          : [[centerX - 1.4, centerY + 0.2], [centerX - 4.4, bottom - 0.6], [2, bottom], [centerX - 5.8, centerY - 1.4]]
      case 'spine':
        return nearCenter
          ? [[centerX, centerY - 3.5], [centerX, centerY], [centerX, bottom]]
          : [[centerX + side * 1.2, centerY - 2.4], [centerX, centerY + 0.8], [centerX + side * 0.8, bottom]]
    }
  })()
  return points(prefix, values)
}

function targetMap(spec: ShowSpec, shape: Shape, keys: readonly string[]): Record<string, LaserDmxShowDirectorBeamTarget[]> {
  return Object.fromEntries(keys.flatMap(key => {
    const fixture = fixtureByKey(spec, key)
    return fixture && isBeamFixture(fixture.kind) ? [[key, shapePoints(spec, fixture, shape)]] : []
  }))
}

function address(role: string): LaserDmxShowDirectorPerformanceAddress { return { bankRoles: [role] } }
function section(types: LaserDmxShowDirectorPerformanceSectionMatch['types'], occurrence?: number[] | { minOccurrence?: number }): LaserDmxShowDirectorPerformanceSectionMatch {
  return occurrence ? { types, dropOccurrence: Array.isArray(occurrence) ? { occurrences: occurrence } : occurrence } : { types }
}

function beamMutation(
  spec: ShowSpec,
  id: string,
  role: string,
  shape: Shape,
  color: string,
  brightness: number,
  fanSpread: number,
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
      targetPointsByFixtureSemanticKey: targetMap(spec, shape, bank(spec, role)),
      beamAppearance: { width: 1.55, glow: 0.9 },
      beamTravel: { mode: 'static', beatsPerTravel: 1, retrigger: 'restart', direction: 'forward' },
      beamPriorityRole: 'primaryArchitecture',
      beamVisualRole: 'primary',
      ...extra,
    },
    ...(conditions ? { conditions } : {}),
  }
}

function ledMutation(
  id: string,
  role: string,
  color: string,
  brightness: number,
  conditions?: NonNullable<LaserDmxShowDirectorPerformanceMutationBase['conditions']>,
): LaserDmxShowDirectorPerformanceMutationBase {
  return { id, address: address(role), fixture: { enabled: true, color, brightness }, ...(conditions ? { conditions } : {}) }
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
  spec: ShowSpec,
  id: string,
  offset: number,
  cycleLength: number,
  role: string,
  shape: Shape,
  color: string,
  brightness: number,
  fanSpread: number,
  extra: Partial<NonNullable<LaserDmxShowDirectorPerformanceMutationBase['fixture']>> = {},
): LaserDmxShowDirectorPerformanceBeatMutation {
  return {
    ...beamMutation(spec, id, role, shape, color, brightness, fanSpread, extra),
    beatDivision: 1,
    beatOffsets: [offset],
    beatCycleLength: cycleLength,
    responseEnvelope: { holdUntil: 0.7, releaseUntil: 0.98, curve: 'easeOut' },
  }
}

function ledBeat(id: string, offset: number, cycleLength: number, role: string, color: string, brightness: number): LaserDmxShowDirectorPerformanceBeatMutation {
  return {
    ...ledMutation(id, role, color, brightness),
    beatDivision: 1,
    beatOffsets: [offset],
    beatCycleLength: cycleLength,
    responseEnvelope: { holdUntil: 0.68, releaseUntil: 0.96, curve: 'easeOut' },
  }
}

function fourBarVariations(spec: ShowSpec, sceneId: string): NonNullable<LaserDmxShowDirectorPerformanceScene['fourBarVariations']> {
  return [
    { id: `${sceneId}-four-a`, motifFamily: `${spec.id}-a`, address: address('allBeams'), fixture: { rotation: -5 } },
    { id: `${sceneId}-four-b`, motifFamily: `${spec.id}-b`, address: address('allBeams'), fixture: { rotation: 5 } },
    { id: `${sceneId}-four-c`, motifFamily: `${spec.id}-c`, address: address('allBeams'), fixture: { rotation: -9 } },
    { id: `${sceneId}-four-d`, motifFamily: `${spec.id}-d`, address: address('allBeams'), fixture: { rotation: 9 } },
  ]
}

function commonCadence(
  spec: ShowSpec,
  sceneId: string,
  leftRole: string,
  rightRole: string,
  shape: Shape,
  leftColor: string,
  rightColor: string,
  restrained = false,
): Required<Pick<LaserDmxShowDirectorPerformanceScene,
  'beatMutations' | 'kickMutations' | 'snareMutations' | 'hatMutations' | 'transientMutations' |
  'barMutations' | 'fourBarVariations' | 'eightBarRecruitment' | 'sixteenBarEvolution' | 'modulations'>> {
  const pulse = restrained ? 0.62 : 0.86
  return {
    beatMutations: [
      { ...beamMutation(spec, `${sceneId}-beat-left`, leftRole, shape, leftColor, pulse, restrained ? 38 : 72), beatDivision: 1, beatOffsets: [0, 2], beatCycleLength: 4, responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE },
      { ...beamMutation(spec, `${sceneId}-beat-right`, rightRole, shape, rightColor, pulse, restrained ? 38 : 72), beatDivision: 1, beatOffsets: [1, 3], beatCycleLength: 4, responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE },
    ],
    kickMutations: [{ id: `${sceneId}-kick`, threshold: 0.38, address: address('kick'), fixture: { enabled: true, brightness: restrained ? 0.76 : 1, fanSpread: restrained ? 44 : 94, beamAppearance: { width: restrained ? 1.35 : 2.2, glow: restrained ? 0.76 : 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' } }],
    snareMutations: [
      { id: `${sceneId}-snare`, threshold: 0.38, address: address('snare'), fixture: { enabled: true, brightness: restrained ? 0.72 : 1, color: WHITE, fanSpread: restrained ? 36 : 82, component: { movingHeadPanTiltStyle: restrained ? 'locked' : 'snap' }, beamAppearance: { width: restrained ? 1.5 : 2.2, glow: restrained ? 0.82 : 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' } },
    ],
    hatMutations: [{ id: `${sceneId}-hat`, threshold: 0.26, address: address('hat'), fixture: { enabled: true, brightness: restrained ? 0.44 : 0.66, fanSpread: restrained ? 18 : 28, beamAppearance: { width: 0.82, glow: 0.62 }, beamTravel: { mode: 'pulseTrain', beatsPerTravel: 0.5, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' } }],
    transientMutations: [{ ...strobeMutation(`${sceneId}-transient`, restrained ? 0.64 : 1, 82), threshold: restrained ? 0.82 : 0.68 }],
    barMutations: [
      { id: `${sceneId}-bar-even`, intervalBars: 2, anchorBar: 0, address: address('allBeams'), fixture: { rotation: restrained ? -3 : -7 } },
      { id: `${sceneId}-bar-odd`, intervalBars: 2, anchorBar: 1, address: address('allBeams'), fixture: { rotation: restrained ? 3 : 7 } },
    ],
    fourBarVariations: fourBarVariations(spec, sceneId),
    eightBarRecruitment: [
      { id: `${sceneId}-eight-core`, stage: 1, cumulative: true, address: address('kick'), fixture: { enabled: true, brightness: restrained ? 0.18 : 0.26 } },
      { id: `${sceneId}-eight-full`, stage: 2, cumulative: true, address: address('allBeams'), fixture: { enabled: true, brightness: restrained ? 0.14 : 0.22 } },
    ],
    sixteenBarEvolution: [{ id: `${sceneId}-sixteen`, phase: 1, phraseLengthBars: 16, address: address('allBeams'), fixture: { rotation: restrained ? 6 : 12, focus: restrained ? 0.9 : 0.98 } }],
    modulations: [
      { source: 'nBass', target: 'fixture.fanSpread', amount: restrained ? 8 : 16, min: 0, max: restrained ? 8 : 16, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'spectralFlux', target: 'fixture.beamWidth', amount: restrained ? 0.18 : 0.4, min: 0, max: restrained ? 0.18 : 0.4, mode: 'add' },
      { source: 'trackEnergy', target: 'fixture.brightness', amount: restrained ? 0.06 : 0.12, min: 0, max: restrained ? 0.06 : 0.12, mode: 'add', requiredCapability: 'Track Energy Curve' },
    ],
  }
}

function sceneBase(
  spec: ShowSpec,
  id: string,
  label: string,
  sectionMatch: LaserDmxShowDirectorPerformanceSectionMatch,
  energyEnvelopeKey: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  patch: Partial<LaserDmxShowDirectorPerformanceScene>,
): LaserDmxShowDirectorPerformanceScene {
  return {
    id,
    label,
    enabled: true,
    section: sectionMatch,
    address: address('allBeams'),
    fixture: { enabled: false, brightness: 0 },
    global: { dimmer: 0.82, globalGlow: 0.78, beamPersistence: 0.08, backgroundFade: 0.86, haze: 0.1 },
    energyEnvelopeKey,
    transitionIn: { durationBars: 0.08, curve: 'step' },
    transitionOut: { durationBars: 0.08, curve: 'step' },
    ...patch,
  }
}

function bankAddresses(spec: ShowSpec): Record<string, LaserDmxShowDirectorPerformanceAddress> {
  return Object.fromEntries(Object.entries(spec.banks).map(([role, fixtureSemanticKeys]) => [role, { fixtureSemanticKeys: [...fixtureSemanticKeys] }]))
}
function bankMetadata(spec: ShowSpec): Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata> {
  return Object.fromEntries(Object.entries(spec.banks).map(([role, fixtureSemanticKeys]) => [role, {
    role,
    label: role.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase()),
    description: `${spec.name} authored ${role} fixture bank.`,
    address: { fixtureSemanticKeys: [...fixtureSemanticKeys] },
  }]))
}

function ribbonDropMatrix(sceneId: string, expanded: boolean): LaserDmxShowDirectorPerformanceBeatMutation[] {
  const spec = RIBBON_SPEC
  const heroWidth = expanded ? 2.8 : 2.35
  const core = [
    beatScene(spec, `${sceneId}-00-beacon`, 0, 16, 'centerRibbon', 'beacon', WHITE, 1, expanded ? 118 : 96, { beamAppearance: { width: heroWidth, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-01-left-sail`, 1, 16, 'leftRibbon', 'sail', CYAN, 0.92, expanded ? 126 : 104, { beamAppearance: { width: 2.35, glow: 0.96 }, beamTravel: { mode: 'scanner', beatsPerTravel: 1, retrigger: 'restart', direction: 'forward' } }),
    beatScene(spec, `${sceneId}-02-right-sail`, 2, 16, 'rightRibbon', 'sail', MAGENTA, 0.92, expanded ? 126 : 104, { beamAppearance: { width: 2.35, glow: 0.96 }, beamTravel: { mode: 'scanner', beatsPerTravel: 1, retrigger: 'restart', direction: 'forward' } }),
    beatScene(spec, `${sceneId}-03-helix`, 3, 16, 'helix', 'helix', GREEN, 0.9, expanded ? 120 : 98, { beamAppearance: { width: 1.7, glow: 0.9 }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-04-canopy`, 4, 16, 'canopy', 'canopy', expanded ? ICE : CYAN, 0.98, expanded ? 138 : 116, { beamAppearance: { width: expanded ? 2.55 : 2.15, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-05-sparse-beacon`, 5, 16, 'beacon', 'beacon', WHITE, expanded ? 0.7 : 0.48, 22, { beamAppearance: { width: 1.45, glow: 0.72 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-06-cyan-sweep`, 6, 16, 'leftRibbon', 'ribbonSweep', CYAN, 0.92, 104, { beamTravel: { mode: 'scanner', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' } }),
    beatScene(spec, `${sceneId}-07-magenta-sweep`, 7, 16, 'rightRibbon', 'ribbonSweep', MAGENTA, 0.92, 104, { beamTravel: { mode: 'scanner', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' } }),
    beatScene(spec, `${sceneId}-08-frame`, 8, 16, 'outline', 'ribbonFrame', VIOLET, 0.92, expanded ? 114 : 92, { beamAppearance: { width: 1.4, glow: 0.88 }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-09-white-ribbon`, 9, 16, 'fanHeads', 'ribbonSweep', WHITE, 1, expanded ? 108 : 88, { component: { movingHeadPanTiltStyle: 'smoothSweep' }, beamAppearance: { width: expanded ? 3 : 2.55, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(spec, `${sceneId}-10-green-sail`, 10, 16, 'leftRibbon', 'sail', GREEN, 0.94, expanded ? 128 : 106, { beamAppearance: { width: 2.45, glow: 0.98 } }),
    beatScene(spec, `${sceneId}-11-violet-sail`, 11, 16, 'rightRibbon', 'sail', VIOLET, 0.94, expanded ? 128 : 106, { beamAppearance: { width: 2.45, glow: 0.98 } }),
    beatScene(spec, `${sceneId}-12-halo`, 12, 16, 'centerRibbon', 'halo', expanded ? ICE : WHITE, 1, expanded ? 130 : 108, { beamAppearance: { width: 2.2, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-13-shards`, 13, 16, 'sails', 'ribbonShards', MAGENTA, 0.94, expanded ? 122 : 98, { beamTravel: { mode: 'projectile', beatsPerTravel: 1, retrigger: 'restart', direction: 'forward' } }),
    beatScene(spec, `${sceneId}-14-horizon`, 14, 16, 'outline', 'horizon', CYAN, 0.84, 78, { beamAppearance: { width: 1.05, glow: 0.72 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-15-full-ribbon`, 15, 16, 'allBeams', expanded ? 'halo' : 'canopy', WHITE, 1, expanded ? 144 : 126, { beamAppearance: { width: expanded ? 3.1 : 2.55, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
  ]
  return expanded ? [
    ...core,
    ledBeat(`${sceneId}-led-cyan-1`, 1, 16, 'ribbonLedLeft', CYAN, 0.7),
    ledBeat(`${sceneId}-led-magenta-2`, 2, 16, 'ribbonLedRight', MAGENTA, 0.7),
    ledBeat(`${sceneId}-led-green-4`, 4, 16, 'ribbonLed', GREEN, 0.78),
    ledBeat(`${sceneId}-led-violet-8`, 8, 16, 'ribbonLed', VIOLET, 0.76),
    ledBeat(`${sceneId}-led-white-12`, 12, 16, 'ribbonLed', WHITE, 0.86),
    ledBeat(`${sceneId}-led-full-15`, 15, 16, 'ribbonLed', CYAN, 0.82),
  ] : core
}

function ribbonIntroScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = RIBBON_SPEC
  const id = `${spec.id}-intro`
  return sceneBase(spec, id, `${spec.name} · Beacon Awakening`, section(['intro']), 'intro', {
    global: { dimmer: 0.62, globalGlow: 0.76, beamPersistence: 0.2, backgroundFade: 0.92, haze: 0.18 },
    ...commonCadence(spec, id, 'leftRibbon', 'rightRibbon', 'sail', CYAN, VIOLET, true),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-beacon`, 'beacon', 'beacon', WHITE, 0.62, 26, { component: { movingHeadPanTiltStyle: 'locked' }, beamAppearance: { width: 1.9, glow: 0.96 } }),
      beamMutation(spec, `${id}-left`, 'leftRibbon', 'sail', CYAN, 0.4, 52, { beamTravel: { mode: 'scanner', beatsPerTravel: 8, retrigger: 'continue', direction: 'forward' } }),
      beamMutation(spec, `${id}-right`, 'rightRibbon', 'sail', VIOLET, 0.4, 52, { beamTravel: { mode: 'scanner', beatsPerTravel: 8, retrigger: 'continue', direction: 'forward' } }),
      ledMutation(`${id}-led-left`, 'ribbonLedLeft', GREEN, 0.3),
      ledMutation(`${id}-led-right`, 'ribbonLedRight', MAGENTA, 0.3),
      hazeMutation(`${id}-haze`, 0.18),
    ],
  })
}

function ribbonVerseScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = RIBBON_SPEC
  const id = `${spec.id}-verse`
  const cadence = commonCadence(spec, id, 'leftRibbon', 'rightRibbon', 'ribbonFrame', CYAN, MAGENTA, true)
  return sceneBase(spec, id, `${spec.name} · Vocal Beacon / Ribbon Gaps`, section(['verse']), 'verse', {
    global: { dimmer: 0.56, globalGlow: 0.62, beamPersistence: 0.16, backgroundFade: 0.94, haze: 0.14 },
    ...cadence,
    beatMutations: cadence.beatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    kickMutations: cadence.kickMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-gap-left`, 'leftRibbon', 'sail', CYAN, 0.46, 54, {}, lyricGap),
      beamMutation(spec, `${id}-gap-right`, 'rightRibbon', 'sail', MAGENTA, 0.46, 54, {}, lyricGap),
      beamMutation(spec, `${id}-vocal`, 'vocalIsolation', 'beacon', WARM_WHITE, 0.58, 22, { component: { movingHeadPanTiltStyle: 'locked' }, beamAppearance: { width: 1.8, glow: 0.9 } }, lyricActive),
      beamMutation(spec, `${id}-stem`, 'vocalIsolation', 'beacon', WARM_WHITE, 0.52, 22, { component: { movingHeadPanTiltStyle: 'locked' } }, vocalStemActive),
      ledMutation(`${id}-led`, 'ribbonLed', BLUE, 0.3),
      hazeMutation(`${id}-haze`, 0.14),
    ],
  })
}

function ribbonBuildScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = RIBBON_SPEC
  const id = `${spec.id}-build`
  return sceneBase(spec, id, `${spec.name} · Helix Convergence`, section(['build']), 'build', {
    global: { dimmer: 0.8, globalGlow: 0.88, beamPersistence: 0.1, backgroundFade: 0.82, haze: 0.28 },
    ...commonCadence(spec, id, 'leftRibbon', 'rightRibbon', 'helix', CYAN, MAGENTA),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-core`, 'helix', 'helix', GREEN, 0.72, 68),
      beamMutation(spec, `${id}-sails`, 'sails', 'sail', VIOLET, 0.74, 86, {}, [{ source: 'buildProgress', operator: 'gt', value: 0.46 }]),
      ledMutation(`${id}-led`, 'ribbonLed', MAGENTA, 0.62, [{ source: 'buildProgress', operator: 'gt', value: 0.62 }]),
      { ...strobeMutation(`${id}-strobe`, 0.76, 74), conditions: [{ source: 'buildProgress', operator: 'gt', value: 0.8 }] },
      hazeMutation(`${id}-haze`, 0.28),
    ],
  })
}

function ribbonPreDropScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = RIBBON_SPEC
  const id = `${spec.id}-pre-drop`
  return sceneBase(spec, id, `${spec.name} · Solitary Beacon`, section(['preDrop']), 'preDrop', {
    global: { dimmer: 0.46, globalGlow: 0.5, beamPersistence: 0.05, backgroundFade: 0.97, haze: 0.12 },
    ...commonCadence(spec, id, 'leftRibbon', 'rightRibbon', 'horizon', GREEN, VIOLET, true),
    blackoutWindows: [{ id: `${id}-cut`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: 0.5, justification: 'Reference-inspired disappearance before the ribbon sculpture reopens.' }],
    sectionBodyMutations: [
      beamMutation(spec, `${id}-beacon`, 'beacon', 'beacon', WHITE, 0.56, 20, { component: { movingHeadPanTiltStyle: 'locked' }, beamAppearance: { width: 1.65, glow: 0.86 } }),
      beamMutation(spec, `${id}-edges`, 'outline', 'horizon', VIOLET, 0.28, 24, { beamAppearance: { width: 0.8, glow: 0.52 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      ledMutation(`${id}-led`, 'ribbonLed', GREEN, 0.18),
      hazeMutation(`${id}-haze`, 0.12),
    ],
    sectionExitMutations: [beamMutation(spec, `${id}-exit`, 'fanHeads', 'ribbonSweep', WHITE, 0.94, 92, { component: { movingHeadPanTiltStyle: 'smoothSweep' }, beamAppearance: { width: 2.8, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' })],
  })
}

function ribbonDropScene(second: boolean): LaserDmxShowDirectorPerformanceScene {
  const spec = RIBBON_SPEC
  const kind: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey = second ? 'drop2' : 'drop1'
  const id = `${spec.id}-${second ? 'drop-2' : 'drop-1'}`
  return sceneBase(spec, id, `${spec.name} · ${second ? 'Expanded Ribbon Orbit' : 'Ribbon Relay'}`, section(['drop'], second ? { minOccurrence: 2 } : [1]), kind, {
    global: { dimmer: second ? 1 : 0.96, globalGlow: 1, beamPersistence: 0.05, backgroundFade: second ? 0.62 : 0.7, haze: second ? 0.4 : 0.34 },
    beatMutations: ribbonDropMatrix(id, second),
    kickMutations: [{ id: `${id}-kick`, threshold: 0.36, address: address('kick'), fixture: { enabled: true, brightness: 1, color: WHITE, fanSpread: second ? 126 : 108, beamAppearance: { width: second ? 3 : 2.55, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' } }],
    snareMutations: [
      { id: `${id}-snare`, threshold: 0.36, address: address('snare'), fixture: { enabled: true, brightness: 1, color: ICE, fanSpread: second ? 104 : 88, component: { movingHeadPanTiltStyle: 'smoothSweep' }, beamAppearance: { width: 2.7, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' } },
      { ...strobeMutation(`${id}-snare-strobe`, second ? 1 : 0.86, 78), threshold: 0.54 },
    ],
    hatMutations: [{ id: `${id}-hat`, threshold: 0.24, address: address('hat'), fixture: { enabled: true, brightness: 0.66, color: VIOLET, fanSpread: 24, beamAppearance: { width: 0.9, glow: 0.66 }, beamTravel: { mode: 'pulseTrain', beatsPerTravel: 0.5, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' } }],
    transientMutations: [{ ...strobeMutation(`${id}-transient`, 1, 88), threshold: 0.7 }],
    barMutations: [
      { id: `${id}-bar-even`, intervalBars: 2, anchorBar: 0, address: address('allBeams'), fixture: { rotation: second ? -13 : -8 } },
      { id: `${id}-bar-odd`, intervalBars: 2, anchorBar: 1, address: address('allBeams'), fixture: { rotation: second ? 13 : 8 } },
    ],
    fourBarVariations: fourBarVariations(spec, id),
    eightBarRecruitment: [
      { id: `${id}-eight-sails`, stage: 1, cumulative: true, address: address('sails'), fixture: { enabled: true, brightness: second ? 0.3 : 0.2 } },
      { id: `${id}-eight-led`, stage: 2, cumulative: true, address: address('ribbonLed'), fixture: { enabled: true, brightness: second ? 0.58 : 0.34, color: second ? ICE : VIOLET } },
    ],
    sixteenBarEvolution: [{ id: `${id}-sixteen`, phase: 1, phraseLengthBars: 16, address: address('allBeams'), fixture: { rotation: second ? 16 : 10, focus: second ? 1 : 0.95 } }],
    sectionEntryMutations: [strobeMutation(`${id}-entry`, 1, 96)],
    sectionBodyMutations: [hazeMutation(`${id}-haze`, second ? 0.4 : 0.34)],
    blackoutWindows: second ? [{ id: `${id}-reset`, kind: 'fakeout', anchor: 'sectionStart', offsetBeats: 5, durationBeats: 0.25, justification: 'Quarter-beat sparse-beacon reset between full ribbon sculptures.' }] : undefined,
    modulations: [
      { source: 'nBass', target: 'fixture.fanSpread', amount: second ? 20 : 16, min: 0, max: second ? 20 : 16, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'spectralFlux', target: 'fixture.beamWidth', amount: second ? 0.54 : 0.42, min: 0, max: second ? 0.54 : 0.42, mode: 'add' },
      { source: 'trackEnergy', target: 'fixture.brightness', amount: 0.1, min: 0, max: 0.1, mode: 'add', requiredCapability: 'Track Energy Curve' },
    ],
  })
}

function ribbonBreakdownScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = RIBBON_SPEC
  const id = `${spec.id}-breakdown`
  const cadence = commonCadence(spec, id, 'leftRibbon', 'rightRibbon', 'ribbonFrame', CYAN, VIOLET, true)
  return sceneBase(spec, id, `${spec.name} · Floating Ribbon Interlude`, section(['breakdown', 'bridge']), 'breakdown', {
    global: { dimmer: 0.48, globalGlow: 0.56, beamPersistence: 0.2, backgroundFade: 0.95, haze: 0.14 },
    ...cadence,
    beatMutations: cadence.beatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-beacon`, 'beacon', 'beacon', WHITE, 0.5, 18, { component: { movingHeadPanTiltStyle: 'locked' } }),
      beamMutation(spec, `${id}-ribbon`, 'sails', 'sail', CYAN, 0.38, 44, { beamTravel: { mode: 'scanner', beatsPerTravel: 8, retrigger: 'continue', direction: 'forward' } }, lyricGap),
      beamMutation(spec, `${id}-vocal`, 'vocalIsolation', 'beacon', WARM_WHITE, 0.52, 20, { component: { movingHeadPanTiltStyle: 'locked' } }, lyricActive),
      ledMutation(`${id}-led`, 'ribbonLed', VIOLET, 0.3),
      hazeMutation(`${id}-haze`, 0.14),
    ],
  })
}

function ribbonOutroScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = RIBBON_SPEC
  const id = `${spec.id}-outro`
  return sceneBase(spec, id, `${spec.name} · Ribbon Fragments`, section(['outro']), 'outro', {
    global: { dimmer: 0.34, globalGlow: 0.4, beamPersistence: 0.22, backgroundFade: 0.98, haze: 0.06 },
    ...commonCadence(spec, id, 'leftRibbon', 'rightRibbon', 'ribbonShards', CYAN, VIOLET, true),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-fragments`, 'sails', 'ribbonShards', ICE, 0.32, 26, { beamAppearance: { width: 0.9, glow: 0.5 }, beamTravel: { mode: 'scanner', beatsPerTravel: 8, retrigger: 'continue', direction: 'forward' }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      beamMutation(spec, `${id}-beacon`, 'beacon', 'beacon', WHITE, 0.3, 14, { component: { movingHeadPanTiltStyle: 'locked' } }),
      ledMutation(`${id}-led`, 'ribbonLed', BLUE, 0.14),
      hazeMutation(`${id}-haze`, 0.06),
    ],
  })
}

function apexDropMatrix(sceneId: string, expanded: boolean): LaserDmxShowDirectorPerformanceBeatMutation[] {
  const spec = APEX_SPEC
  const cycleLength = 8
  const core = [
    beatScene(spec, `${sceneId}-00-pyramid`, 0, cycleLength, 'pyramidFan', 'pyramidFan', CRIMSON, 1, expanded ? 132 : 108, { beamAppearance: { width: expanded ? 2.4 : 2.05, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-01-roof`, 1, cycleLength, 'roof', 'roof', RED, 0.92, expanded ? 118 : 96, { beamAppearance: { width: 1.7, glow: 0.92 } }),
    beatScene(spec, `${sceneId}-02-white-edge`, 2, cycleLength, 'whiteEdges', 'edgeCut', WHITE, 1, expanded ? 112 : 92, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.4, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(spec, `${sceneId}-03-inverted-v`, 3, cycleLength, 'redApex', 'invertedV', CRIMSON, 0.94, expanded ? 124 : 102, { beamAppearance: { width: 1.8, glow: 0.96 } }),
    beatScene(spec, `${sceneId}-04-double-apex`, 4, cycleLength, 'pyramidFan', expanded ? 'doubleApex' : 'apex', CRIMSON, 1, expanded ? 140 : 116, { beamAppearance: { width: expanded ? 2.45 : 2.1, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-05-white-cross`, 5, cycleLength, 'whiteEdges', 'crossFan', WHITE, 1, expanded ? 120 : 98, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.5, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(spec, `${sceneId}-06-red-spine`, 6, cycleLength, 'centerApex', 'spine', DEEP_RED, expanded ? 0.6 : 0.4, 24, { beamAppearance: { width: 0.9, glow: 0.56 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-07-full-road`, 7, cycleLength, 'allBeams', expanded ? 'doubleApex' : 'chevron', expanded ? WHITE : CRIMSON, 1, expanded ? 142 : 122, { beamAppearance: { width: expanded ? 2.65 : 2.15, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
  ]
  return expanded ? [
    ...core,
    ledBeat(`${sceneId}-led-0`, 0, cycleLength, 'roofLed', CRIMSON, 0.76),
    ledBeat(`${sceneId}-led-2`, 2, cycleLength, 'roofLed', WHITE, 0.86),
    ledBeat(`${sceneId}-led-4`, 4, cycleLength, 'roofLed', CRIMSON, 0.82),
    ledBeat(`${sceneId}-led-7`, 7, cycleLength, 'roofLed', WHITE, 0.9),
  ] : core
}

function apexIntroScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = APEX_SPEC
  const id = `${spec.id}-intro`
  return sceneBase(spec, id, `${spec.name} · Crimson Roof`, section(['intro']), 'intro', {
    global: { dimmer: 0.58, globalGlow: 0.7, beamPersistence: 0.14, backgroundFade: 0.95, haze: 0.14 },
    ...commonCadence(spec, id, 'leftApex', 'rightApex', 'roof', CRIMSON, RED, true),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-roof`, 'roof', 'roof', CRIMSON, 0.52, 54, { beamTravel: { mode: 'static', beatsPerTravel: 4, retrigger: 'continue', direction: 'forward' } }),
      beamMutation(spec, `${id}-spine`, 'centerApex', 'spine', DEEP_RED, 0.38, 18, { beamAppearance: { width: 0.85, glow: 0.52 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      ledMutation(`${id}-led`, 'roofLed', RED, 0.32),
      hazeMutation(`${id}-haze`, 0.14),
    ],
  })
}

function apexVerseScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = APEX_SPEC
  const id = `${spec.id}-verse`
  const cadence = commonCadence(spec, id, 'leftApex', 'rightApex', 'shrine', RED, CRIMSON, true)
  return sceneBase(spec, id, `${spec.name} · Red Shrine`, section(['verse']), 'verse', {
    global: { dimmer: 0.52, globalGlow: 0.58, beamPersistence: 0.16, backgroundFade: 0.96, haze: 0.12 },
    ...cadence,
    beatMutations: cadence.beatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-shrine`, 'redApex', 'shrine', RED, 0.42, 44, {}, lyricGap),
      beamMutation(spec, `${id}-vocal`, 'vocalIsolation', 'spine', WARM_WHITE, 0.5, 18, { component: { movingHeadPanTiltStyle: 'locked' }, beamAppearance: { width: 1.55, glow: 0.82 } }, lyricActive),
      beamMutation(spec, `${id}-stem`, 'vocalIsolation', 'spine', WARM_WHITE, 0.46, 18, { component: { movingHeadPanTiltStyle: 'locked' } }, vocalStemActive),
      ledMutation(`${id}-led`, 'roofLed', DEEP_RED, 0.28),
      hazeMutation(`${id}-haze`, 0.12),
    ],
  })
}

function apexBuildScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = APEX_SPEC
  const id = `${spec.id}-build`
  return sceneBase(spec, id, `${spec.name} · Chevron Compression`, section(['build']), 'build', {
    global: { dimmer: 0.78, globalGlow: 0.84, beamPersistence: 0.08, backgroundFade: 0.86, haze: 0.24 },
    ...commonCadence(spec, id, 'leftApex', 'rightApex', 'chevron', CRIMSON, RED),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-roof`, 'roof', 'roof', RED, 0.68, 62),
      beamMutation(spec, `${id}-fan`, 'pyramidFan', 'pyramidFan', CRIMSON, 0.8, 92, {}, [{ source: 'buildProgress', operator: 'gt', value: 0.48 }]),
      ledMutation(`${id}-led`, 'roofLed', CRIMSON, 0.64, [{ source: 'buildProgress', operator: 'gt', value: 0.64 }]),
      { ...strobeMutation(`${id}-strobe`, 0.74, 72), conditions: [{ source: 'buildProgress', operator: 'gt', value: 0.82 }] },
      hazeMutation(`${id}-haze`, 0.24),
    ],
  })
}

function apexPreDropScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = APEX_SPEC
  const id = `${spec.id}-pre-drop`
  return sceneBase(spec, id, `${spec.name} · Single Apex Hold`, section(['preDrop']), 'preDrop', {
    global: { dimmer: 0.42, globalGlow: 0.46, beamPersistence: 0.03, backgroundFade: 0.98, haze: 0.1 },
    ...commonCadence(spec, id, 'leftApex', 'rightApex', 'spine', DEEP_RED, RED, true),
    blackoutWindows: [{ id: `${id}-cut`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: 0.75, justification: 'Reference-inspired full-bar darkness translated into a safe final-beat cut.' }],
    sectionBodyMutations: [
      beamMutation(spec, `${id}-apex`, 'centerApex', 'apex', CRIMSON, 0.52, 26, { beamAppearance: { width: 1.35, glow: 0.72 } }),
      beamMutation(spec, `${id}-side`, 'sideWings', 'sideWings', DEEP_RED, 0.24, 20, { beamAppearance: { width: 0.75, glow: 0.42 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      ledMutation(`${id}-led`, 'roofLed', DEEP_RED, 0.18),
      hazeMutation(`${id}-haze`, 0.1),
    ],
    sectionExitMutations: [beamMutation(spec, `${id}-white-edge`, 'whiteEdges', 'edgeCut', WHITE, 0.96, 86, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.45, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' })],
  })
}

function apexDropScene(second: boolean): LaserDmxShowDirectorPerformanceScene {
  const spec = APEX_SPEC
  const kind: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey = second ? 'drop2' : 'drop1'
  const id = `${spec.id}-${second ? 'drop-2' : 'drop-1'}`
  return sceneBase(spec, id, `${spec.name} · ${second ? 'White-Edged Double Apex' : 'Apex Relay'}`, section(['drop'], second ? { minOccurrence: 2 } : [1]), kind, {
    global: { dimmer: second ? 1 : 0.95, globalGlow: 1, beamPersistence: 0.035, backgroundFade: second ? 0.68 : 0.76, haze: second ? 0.34 : 0.28 },
    beatMutations: apexDropMatrix(id, second),
    kickMutations: [{ id: `${id}-kick`, threshold: 0.36, address: address('kick'), fixture: { enabled: true, brightness: 1, color: CRIMSON, fanSpread: second ? 122 : 104, beamAppearance: { width: second ? 2.6 : 2.2, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' } }],
    snareMutations: [
      { id: `${id}-snare`, threshold: 0.36, address: address('snare'), fixture: { enabled: true, brightness: 1, color: WHITE, fanSpread: second ? 104 : 88, component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.5, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' } },
      { ...strobeMutation(`${id}-snare-strobe`, second ? 1 : 0.86, 76), threshold: 0.5 },
    ],
    hatMutations: [{ id: `${id}-hat`, threshold: 0.25, address: address('hat'), fixture: { enabled: true, brightness: 0.58, color: RED, fanSpread: 18, beamAppearance: { width: 0.76, glow: 0.54 }, beamTravel: { mode: 'pulseTrain', beatsPerTravel: 0.5, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' } }],
    transientMutations: [{ ...strobeMutation(`${id}-transient`, 1, 86), threshold: 0.7 }],
    barMutations: [
      { id: `${id}-bar-even`, intervalBars: 2, anchorBar: 0, address: address('allBeams'), fixture: { rotation: second ? -11 : -6 } },
      { id: `${id}-bar-odd`, intervalBars: 2, anchorBar: 1, address: address('allBeams'), fixture: { rotation: second ? 11 : 6 } },
    ],
    fourBarVariations: fourBarVariations(spec, id),
    eightBarRecruitment: [
      { id: `${id}-eight-roof`, stage: 1, cumulative: true, address: address('roof'), fixture: { enabled: true, brightness: second ? 0.28 : 0.2 } },
      { id: `${id}-eight-white`, stage: 2, cumulative: true, address: address('whiteEdges'), fixture: { enabled: true, brightness: second ? 0.5 : 0.3, color: WHITE } },
      { id: `${id}-eight-led`, stage: 2, cumulative: true, address: address('roofLed'), fixture: { enabled: true, brightness: second ? 0.64 : 0.34, color: second ? WHITE : CRIMSON } },
    ],
    sixteenBarEvolution: [{ id: `${id}-sixteen`, phase: 1, phraseLengthBars: 16, address: address('allBeams'), fixture: { rotation: second ? 15 : 9, focus: second ? 1 : 0.96 } }],
    sectionEntryMutations: [strobeMutation(`${id}-entry`, 1, 94)],
    sectionBodyMutations: [hazeMutation(`${id}-haze`, second ? 0.34 : 0.28)],
    blackoutWindows: second ? [{ id: `${id}-reset`, kind: 'impactCut', anchor: 'sectionStart', offsetBeats: 6, durationBeats: 0.25, justification: 'Quarter-beat dark reset before the white-edged final apex.' }] : undefined,
    modulations: [
      { source: 'nBass', target: 'fixture.fanSpread', amount: second ? 18 : 14, min: 0, max: second ? 18 : 14, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'spectralFlux', target: 'fixture.beamWidth', amount: second ? 0.46 : 0.34, min: 0, max: second ? 0.46 : 0.34, mode: 'add' },
      { source: 'trackEnergy', target: 'fixture.brightness', amount: 0.1, min: 0, max: 0.1, mode: 'add', requiredCapability: 'Track Energy Curve' },
    ],
  })
}

function apexBreakdownScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = APEX_SPEC
  const id = `${spec.id}-breakdown`
  const cadence = commonCadence(spec, id, 'leftApex', 'rightApex', 'shrine', DEEP_RED, RED, true)
  return sceneBase(spec, id, `${spec.name} · Deep Red Shrine`, section(['breakdown', 'bridge']), 'breakdown', {
    global: { dimmer: 0.42, globalGlow: 0.46, beamPersistence: 0.18, backgroundFade: 0.97, haze: 0.1 },
    ...cadence,
    beatMutations: cadence.beatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-shrine`, 'centerApex', 'shrine', DEEP_RED, 0.42, 28),
      beamMutation(spec, `${id}-vocal`, 'vocalIsolation', 'spine', WARM_WHITE, 0.46, 16, { component: { movingHeadPanTiltStyle: 'locked' } }, lyricActive),
      ledMutation(`${id}-led`, 'roofLed', DEEP_RED, 0.22),
      hazeMutation(`${id}-haze`, 0.1),
    ],
  })
}

function apexOutroScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = APEX_SPEC
  const id = `${spec.id}-outro`
  return sceneBase(spec, id, `${spec.name} · Red Roof Fragments`, section(['outro']), 'outro', {
    global: { dimmer: 0.32, globalGlow: 0.34, beamPersistence: 0.2, backgroundFade: 0.985, haze: 0.05 },
    ...commonCadence(spec, id, 'leftApex', 'rightApex', 'roof', DEEP_RED, RED, true),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-roof`, 'roof', 'roof', RED, 0.28, 22, { beamAppearance: { width: 0.8, glow: 0.46 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      beamMutation(spec, `${id}-spine`, 'centerApex', 'spine', DEEP_RED, 0.26, 12, { beamAppearance: { width: 0.72, glow: 0.4 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      ledMutation(`${id}-led`, 'roofLed', DEEP_RED, 0.12),
      hazeMutation(`${id}-haze`, 0.05),
    ],
  })
}

export function createSpectralRibbonSingularityRig(createId: CreateId): LaserDmxShowDirectorState {
  return createRig(RIBBON_SPEC, createId)
}

export function createSpectralRibbonSingularityProgram(): LaserDmxShowDirectorPerformanceProgram {
  const spec = RIBBON_SPEC
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
    id: spec.id,
    name: spec.name,
    description: 'A reference-inspired 129-BPM ribbon sculpture built around a persistent white beacon, enormous cyan/green/magenta sail forms, helix crossings, sparse single-spine breaths, and a sixteen-beat drop relay that alternates chromatic panels with wide white moving-head ribbons.',
    deterministicSeed: 1292216,
    bankRoles: bankAddresses(spec),
    fixtureBanks: bankMetadata(spec),
    energyEnvelopes: spec.energyEnvelopes,
    blackoutPolicy: BLACKOUT_POLICY,
    fallbackOrder: ['verse', 'intro', 'build', 'drop', 'breakdown', 'outro'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    diagnostics: {
      authoringVersion: 'reference-spectral-ribbon-singularity-v1',
      expectedFixtureSemanticKeys: spec.fixtureSpecs.map(fixture => fixture.key),
      expectedGroupSemanticKeys: spec.groups.map(([key]) => key),
      notes: [
        'Reference recording measured near 129 BPM and alternates dense chromatic ribbon sculptures with sparse central-beacon frames.',
        'The central white spine persists as a visual anchor while cyan, green, violet, and magenta sail banks trade beats and four-bar phrases.',
        'Large apparent surfaces are translated into wide beam architecture plus LED ribbon banks so the existing Show Director renderer remains authoritative.',
        'Vocal passages contract to a warm-white beacon; lyric gaps restore the lateral ribbon response.',
      ],
    },
    scenes: [ribbonIntroScene(), ribbonVerseScene(), ribbonBuildScene(), ribbonPreDropScene(), ribbonDropScene(false), ribbonBreakdownScene(), ribbonDropScene(true), ribbonOutroScene()],
  }
}

export function createCrimsonApexProtocolRig(createId: CreateId): LaserDmxShowDirectorState {
  return createRig(APEX_SPEC, createId)
}

export function createCrimsonApexProtocolProgram(): LaserDmxShowDirectorPerformanceProgram {
  const spec = APEX_SPEC
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
    id: spec.id,
    name: spec.name,
    description: 'A reference-inspired 144-BPM crimson architectural show built from mirrored roof lines, triangular apex fans, inverted chevrons, deep-red shrine holds, white edge cuts, and deliberate dark punctuation. Drop 2 evolves into a white-outlined double-apex road rather than repeating Drop 1.',
    deterministicSeed: 1441908,
    bankRoles: bankAddresses(spec),
    fixtureBanks: bankMetadata(spec),
    energyEnvelopes: spec.energyEnvelopes,
    blackoutPolicy: BLACKOUT_POLICY,
    fallbackOrder: ['verse', 'intro', 'build', 'drop', 'breakdown', 'outro'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    diagnostics: {
      authoringVersion: 'reference-crimson-apex-protocol-v1',
      expectedFixtureSemanticKeys: spec.fixtureSpecs.map(fixture => fixture.key),
      expectedGroupSemanticKeys: spec.groups.map(([key]) => key),
      notes: [
        'Reference recording measured near 144 BPM and maintains a disciplined crimson/magenta palette with ice-white structural impacts.',
        'The primary eight-beat relay cycles pyramid fan, roof, white edge cut, inverted V, double apex, white cross, sparse red spine, and full-road return.',
        'Long dark reference frames are represented by bounded pre-drop and quarter-beat impact cuts while maintaining visible breakdown output.',
        'Kick owns the center apex, snare owns the white moving-head edges, and hats animate the inner red roof lines.',
      ],
    },
    scenes: [apexIntroScene(), apexVerseScene(), apexBuildScene(), apexPreDropScene(), apexDropScene(false), apexBreakdownScene(), apexDropScene(true), apexOutroScene()],
  }
}

export const LASER_DMX_SHOW_DIRECTOR_DUAL_REFERENCE_PERFORMANCE_PRESETS: readonly LaserDmxShowDirectorPerformancePresetDefinition[] = Object.freeze([
  Object.freeze({
    id: RIBBON_ID,
    name: RIBBON_NAME,
    description: 'A floating white-beacon and chromatic-ribbon sculpture with cyan, green, violet, and magenta sail relays, helix crossings, wide moving-head ribbons, LED panels, vocal contraction, and sparse visual breaths.',
    genreTags: ['melodic bass', 'progressive electronic', 'trance', 'cinematic EDM'],
    behaviorTags: ['central beacon', 'chromatic ribbon sails', 'sixteen-beat sculpture relay', 'sparse-to-dense contrast'],
    supportedSectionRoles: [...ALL_SECTIONS],
    musicIntelligenceCapabilities: [...MUSIC_CAPABILITIES],
    fixtureCount: RIBBON_FIXTURES.length,
    approximatePeakBeamDemand: 266,
    createRig: createSpectralRibbonSingularityRig,
    createProgram: createSpectralRibbonSingularityProgram,
  }),
  Object.freeze({
    id: APEX_ID,
    name: APEX_NAME,
    description: 'A crimson architectural apex system of mirrored roofs, pyramid fans, inverted chevrons, white edge strikes, deep-red shrine holds, and tightly bounded dark punctuation.',
    genreTags: ['techno', 'hard dance', 'festival bass', 'industrial EDM'],
    behaviorTags: ['crimson apex geometry', 'eight-beat chevron relay', 'white edge impacts', 'bounded dark resets'],
    supportedSectionRoles: [...ALL_SECTIONS],
    musicIntelligenceCapabilities: [...MUSIC_CAPABILITIES],
    fixtureCount: APEX_FIXTURES.length,
    approximatePeakBeamDemand: 246,
    createRig: createCrimsonApexProtocolRig,
    createProgram: createCrimsonApexProtocolProgram,
  }),
])
