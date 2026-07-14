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
  | 'beacon' | 'sail' | 'helix' | 'canopy' | 'hourglassSweep' | 'hourglassFrame' | 'hourglassShards' | 'halo' | 'fan' | 'horizon'
  | 'origami' | 'roof' | 'chevron' | 'invertedV' | 'pyramidFan' | 'doubleOrigami' | 'edgeCut' | 'sideWings' | 'shrine' | 'crossFan' | 'spine'
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

const HOURGLASS_ENVELOPES: Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserDmxShowDirectorSectionEnergyEnvelope> = Object.freeze({
  intro: envelope([2, 5], [10, 66], [0.36, 0.74], [18, 84], [0.06, 0.42], [0.5, 0.9], [0.04, 0.28], [0.4, 0.82]),
  verse: envelope([2, 5], [8, 58], [0.34, 0.68], [16, 72], [0.04, 0.34], [0.46, 0.8], [0.03, 0.22], [0.52, 0.88]),
  build: envelope([4, 8], [26, 146], [0.56, 0.94], [34, 118], [0.28, 0.9], [0.72, 1], [0.1, 0.5], [0.12, 0.62]),
  preDrop: envelope([1, 4], [3, 34], [0.3, 0.76], [8, 54], [0.02, 0.34], [0.4, 0.78], [0.008, 0.14], [0.7, 0.96]),
  drop1: envelope([5, 9], [52, 208], [0.78, 1], [52, 132], [0.56, 1], [0.88, 1], [0.18, 0.66], [0.04, 0.4]),
  breakdown: envelope([2, 5], [6, 52], [0.3, 0.66], [10, 68], [0.03, 0.32], [0.44, 0.76], [0.02, 0.18], [0.66, 0.94]),
  drop2: envelope([6, 10], [76, 266], [0.86, 1], [66, 144], [0.68, 1], [0.94, 1], [0.28, 0.74], [0.02, 0.28]),
  outro: envelope([1, 4], [3, 34], [0.24, 0.56], [6, 46], [0.02, 0.26], [0.32, 0.64], [0.006, 0.12], [0.76, 0.97]),
})

const ORIGAMI_ENVELOPES: Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserDmxShowDirectorSectionEnergyEnvelope> = Object.freeze({
  intro: envelope([2, 4], [8, 52], [0.32, 0.68], [16, 70], [0.04, 0.36], [0.46, 0.82], [0.03, 0.22], [0.56, 0.9]),
  verse: envelope([2, 4], [6, 46], [0.3, 0.64], [12, 58], [0.03, 0.3], [0.42, 0.72], [0.02, 0.18], [0.64, 0.92]),
  build: envelope([3, 7], [22, 126], [0.52, 0.9], [26, 104], [0.24, 0.84], [0.66, 0.98], [0.08, 0.42], [0.18, 0.68]),
  preDrop: envelope([1, 3], [2, 24], [0.26, 0.7], [6, 38], [0.02, 0.28], [0.34, 0.68], [0.005, 0.1], [0.78, 0.97]),
  drop1: envelope([4, 8], [40, 184], [0.76, 1], [42, 118], [0.5, 1], [0.84, 1], [0.14, 0.58], [0.08, 0.46]),
  breakdown: envelope([2, 4], [5, 36], [0.26, 0.58], [8, 44], [0.02, 0.26], [0.36, 0.66], [0.01, 0.12], [0.74, 0.96]),
  drop2: envelope([6, 9], [68, 246], [0.86, 1], [58, 138], [0.64, 1], [0.92, 1], [0.24, 0.7], [0.02, 0.3]),
  outro: envelope([1, 3], [2, 24], [0.22, 0.52], [4, 34], [0.01, 0.22], [0.3, 0.58], [0.004, 0.08], [0.8, 0.98]),
})

const HOURGLASS_ID = 'violet-hourglass-orbit'
const HOURGLASS_NAME = 'Violet Hourglass Orbit'
const HOURGLASS_GROUPS = [
  ['hourglass-laser-left', 'Hourglass Lasers Left'],
  ['hourglass-laser-center', 'Hourglass Lasers Center'],
  ['hourglass-laser-right', 'Hourglass Lasers Right'],
  ['hourglass-heads', 'Hourglass Moving Heads'],
  ['hourglass-led-left', 'Hourglass Panels Left'],
  ['hourglass-led-right', 'Hourglass Panels Right'],
  ['hourglass-impact', 'Hourglass Impact'],
  ['hourglass-atmosphere', 'Hourglass Atmosphere'],
] as const
const HOURGLASS_FIXTURES: readonly FixtureSpec[] = [
  { key: 'hourglass-laser-top-l-outer', label: 'Hourglass Laser Top L Outer', kind: 'laser', group: 'hourglass-laser-left', x: 2, y: 1, targetX: 9, targetY: 12, color: CYAN },
  { key: 'hourglass-laser-top-l-inner', label: 'Hourglass Laser Top L Inner', kind: 'laser', group: 'hourglass-laser-left', x: 6, y: 1, targetX: 11, targetY: 12, color: VIOLET },
  { key: 'hourglass-laser-center-l', label: 'Hourglass Laser Center L', kind: 'laser', group: 'hourglass-laser-center', x: 10, y: 2, targetX: 12, targetY: 12, color: GREEN },
  { key: 'hourglass-laser-center', label: 'Hourglass Laser Center', kind: 'laser', group: 'hourglass-laser-center', x: 12, y: 1, targetX: 12, targetY: 13, color: WHITE },
  { key: 'hourglass-laser-center-r', label: 'Hourglass Laser Center R', kind: 'laser', group: 'hourglass-laser-center', x: 14, y: 2, targetX: 12, targetY: 12, color: MAGENTA },
  { key: 'hourglass-laser-top-r-inner', label: 'Hourglass Laser Top R Inner', kind: 'laser', group: 'hourglass-laser-right', x: 18, y: 1, targetX: 13, targetY: 12, color: VIOLET },
  { key: 'hourglass-laser-top-r-outer', label: 'Hourglass Laser Top R Outer', kind: 'laser', group: 'hourglass-laser-right', x: 22, y: 1, targetX: 15, targetY: 12, color: CYAN },
  { key: 'hourglass-laser-side-l', label: 'Hourglass Laser Side L', kind: 'laser', group: 'hourglass-laser-left', x: 1, y: 6, targetX: 12, targetY: 8, color: GREEN },
  { key: 'hourglass-laser-side-r', label: 'Hourglass Laser Side R', kind: 'laser', group: 'hourglass-laser-right', x: 23, y: 6, targetX: 12, targetY: 8, color: MAGENTA },
  { key: 'hourglass-head-l-outer', label: 'Hourglass Head L Outer', kind: 'movingHead', group: 'hourglass-heads', x: 4, y: 3, targetX: 8, targetY: 11, color: ICE, spread: 30 },
  { key: 'hourglass-head-l-inner', label: 'Hourglass Head L Inner', kind: 'movingHead', group: 'hourglass-heads', x: 8, y: 3, targetX: 10, targetY: 12, color: WHITE, spread: 26 },
  { key: 'hourglass-head-center', label: 'Hourglass Head Center', kind: 'movingHead', group: 'hourglass-heads', x: 12, y: 2, targetX: 12, targetY: 13, color: WHITE, spread: 20 },
  { key: 'hourglass-head-r-inner', label: 'Hourglass Head R Inner', kind: 'movingHead', group: 'hourglass-heads', x: 16, y: 3, targetX: 14, targetY: 12, color: WHITE, spread: 26 },
  { key: 'hourglass-head-r-outer', label: 'Hourglass Head R Outer', kind: 'movingHead', group: 'hourglass-heads', x: 20, y: 3, targetX: 16, targetY: 11, color: ICE, spread: 30 },
  { key: 'hourglass-led-l-top', label: 'Hourglass LED L Top', kind: 'ledBar', group: 'hourglass-led-left', x: 3, y: 5, color: CYAN },
  { key: 'hourglass-led-l-mid', label: 'Hourglass LED L Mid', kind: 'ledBar', group: 'hourglass-led-left', x: 5, y: 7, color: GREEN },
  { key: 'hourglass-led-l-low', label: 'Hourglass LED L Low', kind: 'ledBar', group: 'hourglass-led-left', x: 7, y: 10, color: VIOLET },
  { key: 'hourglass-led-r-top', label: 'Hourglass LED R Top', kind: 'ledBar', group: 'hourglass-led-right', x: 21, y: 5, color: MAGENTA },
  { key: 'hourglass-led-r-mid', label: 'Hourglass LED R Mid', kind: 'ledBar', group: 'hourglass-led-right', x: 19, y: 7, color: GREEN },
  { key: 'hourglass-led-r-low', label: 'Hourglass LED R Low', kind: 'ledBar', group: 'hourglass-led-right', x: 17, y: 10, color: VIOLET },
  { key: 'hourglass-strobe', label: 'Hourglass Center Strobe', kind: 'strobe', group: 'hourglass-impact', x: 12, y: 4, color: WHITE },
  { key: 'hourglass-haze', label: 'Hourglass Haze', kind: 'haze', group: 'hourglass-atmosphere', x: 12, y: 12, color: ICE },
]
const HOURGLASS_BANKS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  allLasers: HOURGLASS_FIXTURES.filter(fixture => fixture.kind === 'laser').map(fixture => fixture.key),
  allHeads: HOURGLASS_FIXTURES.filter(fixture => fixture.kind === 'movingHead').map(fixture => fixture.key),
  allBeams: HOURGLASS_FIXTURES.filter(fixture => fixture.kind === 'laser' || fixture.kind === 'movingHead').map(fixture => fixture.key),
  leftHourglass: ['hourglass-laser-top-l-outer', 'hourglass-laser-top-l-inner', 'hourglass-laser-side-l', 'hourglass-head-l-outer', 'hourglass-head-l-inner'],
  centerHourglass: ['hourglass-laser-center-l', 'hourglass-laser-center', 'hourglass-laser-center-r', 'hourglass-head-center'],
  rightHourglass: ['hourglass-laser-top-r-inner', 'hourglass-laser-top-r-outer', 'hourglass-laser-side-r', 'hourglass-head-r-inner', 'hourglass-head-r-outer'],
  beacon: ['hourglass-laser-center', 'hourglass-head-center'],
  sails: ['hourglass-laser-top-l-outer', 'hourglass-laser-top-l-inner', 'hourglass-laser-top-r-inner', 'hourglass-laser-top-r-outer', 'hourglass-head-l-outer', 'hourglass-head-r-outer'],
  canopy: ['hourglass-laser-top-l-outer', 'hourglass-laser-top-l-inner', 'hourglass-laser-center-l', 'hourglass-laser-center-r', 'hourglass-laser-top-r-inner', 'hourglass-laser-top-r-outer'],
  helix: ['hourglass-laser-top-l-inner', 'hourglass-laser-center-l', 'hourglass-laser-center-r', 'hourglass-laser-top-r-inner'],
  outline: ['hourglass-laser-side-l', 'hourglass-laser-top-l-outer', 'hourglass-laser-top-r-outer', 'hourglass-laser-side-r'],
  fanHeads: HOURGLASS_FIXTURES.filter(fixture => fixture.kind === 'movingHead').map(fixture => fixture.key),
  hourglassLed: HOURGLASS_FIXTURES.filter(fixture => fixture.kind === 'ledBar').map(fixture => fixture.key),
  hourglassLedLeft: ['hourglass-led-l-top', 'hourglass-led-l-mid', 'hourglass-led-l-low'],
  hourglassLedRight: ['hourglass-led-r-top', 'hourglass-led-r-mid', 'hourglass-led-r-low'],
  kick: ['hourglass-laser-center-l', 'hourglass-laser-center', 'hourglass-laser-center-r'],
  snare: ['hourglass-head-l-inner', 'hourglass-head-center', 'hourglass-head-r-inner'],
  hat: ['hourglass-laser-top-l-inner', 'hourglass-laser-top-r-inner'],
  strobe: ['hourglass-strobe'],
  atmosphere: ['hourglass-haze'],
  vocalIsolation: ['hourglass-head-l-inner', 'hourglass-head-center', 'hourglass-head-r-inner'],
})
const HOURGLASS_SPEC: ShowSpec = {
  id: HOURGLASS_ID,
  name: HOURGLASS_NAME,
  referenceTempo: 129,
  fixtureSpecs: HOURGLASS_FIXTURES,
  groups: HOURGLASS_GROUPS,
  banks: HOURGLASS_BANKS,
  energyEnvelopes: HOURGLASS_ENVELOPES,
}

const ORIGAMI_ID = 'scarlet-origami-lattice'
const ORIGAMI_NAME = 'Scarlet Origami Lattice'
const ORIGAMI_GROUPS = [
  ['origami-laser-left', 'Origami Lasers Left'],
  ['origami-laser-center', 'Origami Lasers Center'],
  ['origami-laser-right', 'Origami Lasers Right'],
  ['origami-heads', 'Origami White Edges'],
  ['origami-led', 'Origami Roof LEDs'],
  ['origami-impact', 'Origami Impact'],
  ['origami-atmosphere', 'Origami Atmosphere'],
] as const
const ORIGAMI_FIXTURES: readonly FixtureSpec[] = [
  { key: 'origami-laser-top-l-outer', label: 'Origami Laser Top L Outer', kind: 'laser', group: 'origami-laser-left', x: 2, y: 1, targetX: 10, targetY: 12, color: CRIMSON },
  { key: 'origami-laser-top-l-inner', label: 'Origami Laser Top L Inner', kind: 'laser', group: 'origami-laser-left', x: 7, y: 1, targetX: 11, targetY: 12, color: RED },
  { key: 'origami-laser-center-l', label: 'Origami Laser Center L', kind: 'laser', group: 'origami-laser-center', x: 10, y: 2, targetX: 12, targetY: 12, color: CRIMSON },
  { key: 'origami-laser-center-r', label: 'Origami Laser Center R', kind: 'laser', group: 'origami-laser-center', x: 14, y: 2, targetX: 12, targetY: 12, color: CRIMSON },
  { key: 'origami-laser-top-r-inner', label: 'Origami Laser Top R Inner', kind: 'laser', group: 'origami-laser-right', x: 17, y: 1, targetX: 13, targetY: 12, color: RED },
  { key: 'origami-laser-top-r-outer', label: 'Origami Laser Top R Outer', kind: 'laser', group: 'origami-laser-right', x: 22, y: 1, targetX: 14, targetY: 12, color: CRIMSON },
  { key: 'origami-laser-side-l', label: 'Origami Laser Side L', kind: 'laser', group: 'origami-laser-left', x: 1, y: 7, targetX: 12, targetY: 8, color: DEEP_RED },
  { key: 'origami-laser-side-r', label: 'Origami Laser Side R', kind: 'laser', group: 'origami-laser-right', x: 23, y: 7, targetX: 12, targetY: 8, color: DEEP_RED },
  { key: 'origami-head-l-outer', label: 'Origami Head L Outer', kind: 'movingHead', group: 'origami-heads', x: 4, y: 3, targetX: 9, targetY: 11, color: WHITE, spread: 24 },
  { key: 'origami-head-l-inner', label: 'Origami Head L Inner', kind: 'movingHead', group: 'origami-heads', x: 8, y: 3, targetX: 11, targetY: 12, color: WHITE, spread: 20 },
  { key: 'origami-head-center', label: 'Origami Head Center', kind: 'movingHead', group: 'origami-heads', x: 12, y: 2, targetX: 12, targetY: 13, color: WHITE, spread: 18 },
  { key: 'origami-head-r-inner', label: 'Origami Head R Inner', kind: 'movingHead', group: 'origami-heads', x: 16, y: 3, targetX: 13, targetY: 12, color: WHITE, spread: 20 },
  { key: 'origami-head-r-outer', label: 'Origami Head R Outer', kind: 'movingHead', group: 'origami-heads', x: 20, y: 3, targetX: 15, targetY: 11, color: WHITE, spread: 24 },
  { key: 'origami-led-l-upper', label: 'Origami LED L Upper', kind: 'ledBar', group: 'origami-led', x: 5, y: 6, color: CRIMSON },
  { key: 'origami-led-l-lower', label: 'Origami LED L Lower', kind: 'ledBar', group: 'origami-led', x: 8, y: 9, color: RED },
  { key: 'origami-led-r-lower', label: 'Origami LED R Lower', kind: 'ledBar', group: 'origami-led', x: 16, y: 9, color: RED },
  { key: 'origami-led-r-upper', label: 'Origami LED R Upper', kind: 'ledBar', group: 'origami-led', x: 19, y: 6, color: CRIMSON },
  { key: 'origami-strobe', label: 'Origami Strobe', kind: 'strobe', group: 'origami-impact', x: 12, y: 4, color: WHITE },
  { key: 'origami-haze', label: 'Origami Haze', kind: 'haze', group: 'origami-atmosphere', x: 12, y: 12, color: CRIMSON },
]
const ORIGAMI_BANKS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  allLasers: ORIGAMI_FIXTURES.filter(fixture => fixture.kind === 'laser').map(fixture => fixture.key),
  allHeads: ORIGAMI_FIXTURES.filter(fixture => fixture.kind === 'movingHead').map(fixture => fixture.key),
  allBeams: ORIGAMI_FIXTURES.filter(fixture => fixture.kind === 'laser' || fixture.kind === 'movingHead').map(fixture => fixture.key),
  leftOrigami: ['origami-laser-top-l-outer', 'origami-laser-top-l-inner', 'origami-laser-side-l'],
  centerOrigami: ['origami-laser-center-l', 'origami-laser-center-r', 'origami-head-center'],
  rightOrigami: ['origami-laser-top-r-inner', 'origami-laser-top-r-outer', 'origami-laser-side-r'],
  redOrigami: ORIGAMI_FIXTURES.filter(fixture => fixture.kind === 'laser').map(fixture => fixture.key),
  roof: ['origami-laser-top-l-outer', 'origami-laser-top-l-inner', 'origami-laser-top-r-inner', 'origami-laser-top-r-outer'],
  pyramidFan: ['origami-laser-top-l-outer', 'origami-laser-top-l-inner', 'origami-laser-center-l', 'origami-laser-center-r', 'origami-laser-top-r-inner', 'origami-laser-top-r-outer'],
  sideWings: ['origami-laser-side-l', 'origami-laser-top-l-outer', 'origami-laser-top-r-outer', 'origami-laser-side-r'],
  whiteEdges: ORIGAMI_FIXTURES.filter(fixture => fixture.kind === 'movingHead').map(fixture => fixture.key),
  roofLed: ORIGAMI_FIXTURES.filter(fixture => fixture.kind === 'ledBar').map(fixture => fixture.key),
  kick: ['origami-laser-center-l', 'origami-laser-center-r'],
  snare: ['origami-head-l-inner', 'origami-head-center', 'origami-head-r-inner'],
  hat: ['origami-laser-top-l-inner', 'origami-laser-top-r-inner'],
  strobe: ['origami-strobe'],
  atmosphere: ['origami-haze'],
  vocalIsolation: ['origami-head-l-inner', 'origami-head-center', 'origami-head-r-inner'],
})
const ORIGAMI_SPEC: ShowSpec = {
  id: ORIGAMI_ID,
  name: ORIGAMI_NAME,
  referenceTempo: 152,
  fixtureSpecs: ORIGAMI_FIXTURES,
  groups: ORIGAMI_GROUPS,
  banks: ORIGAMI_BANKS,
  energyEnvelopes: ORIGAMI_ENVELOPES,
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
      case 'hourglassSweep':
        return side < 0
          ? [[2, bottom], [6.2, centerY + 2], [10.4, centerY - 1], [centerX + 4.5, centerY - 3]]
          : [[GRID.columns - 2, bottom], [GRID.columns - 6.2, centerY + 2], [GRID.columns - 10.4, centerY - 1], [centerX - 4.5, centerY - 3]]
      case 'hourglassFrame':
        return side < 0
          ? [[2.2, centerY - 3], [2.2, centerY + 2.8], [6.6, bottom], [centerX - 0.8, centerY + 1]]
          : [[GRID.columns - 2.2, centerY - 3], [GRID.columns - 2.2, centerY + 2.8], [GRID.columns - 6.6, bottom], [centerX + 0.8, centerY + 1]]
      case 'hourglassShards':
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
      case 'origami':
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
      case 'doubleOrigami':
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

function hourglassDropMatrix(sceneId: string, expanded: boolean): LaserDmxShowDirectorPerformanceBeatMutation[] {
  const spec = HOURGLASS_SPEC
  const heroWidth = expanded ? 2.9 : 2.45
  const core = [
    beatScene(spec, `${sceneId}-00-cyan-star`, 0, 16, 'allBeams', 'halo', CYAN, 1, expanded ? 138 : 116, { beamAppearance: { width: heroWidth, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-01-violet-spokes`, 1, 16, 'outline', 'horizon', VIOLET, 0.72, 52, { beamAppearance: { width: 0.95, glow: 0.68 }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-02-white-hourglass`, 2, 16, 'fanHeads', 'hourglassFrame', WHITE, 1, expanded ? 118 : 98, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.7, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(spec, `${sceneId}-03-magenta-star`, 3, 16, 'centerHourglass', 'halo', MAGENTA, 0.92, expanded ? 106 : 88, { beamAppearance: { width: 1.65, glow: 0.94 } }),
    beatScene(spec, `${sceneId}-04-violet-pinwheel`, 4, 16, 'helix', 'helix', VIOLET, 0.94, expanded ? 122 : 102, { beamTravel: { mode: 'scanner', beatsPerTravel: 1, retrigger: 'restart', direction: 'forward' }, beamAppearance: { width: 1.7, glow: 0.92 } }),
    beatScene(spec, `${sceneId}-05-cyan-split-cone`, 5, 16, 'canopy', 'canopy', CYAN, 0.98, expanded ? 136 : 114, { beamAppearance: { width: expanded ? 2.6 : 2.2, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-06-green-spears`, 6, 16, 'centerHourglass', 'hourglassShards', GREEN, 0.92, expanded ? 106 : 86, { beamTravel: { mode: 'projectile', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' } }),
    beatScene(spec, `${sceneId}-07-sparse-beacon`, 7, 16, 'beacon', 'beacon', WHITE, expanded ? 0.66 : 0.42, 18, { beamAppearance: { width: 1.35, glow: 0.68 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-08-white-wire-fan`, 8, 16, 'allHeads', 'fan', WHITE, 1, expanded ? 120 : 96, { component: { movingHeadPanTiltStyle: 'smoothSweep' }, beamAppearance: { width: 2.45, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(spec, `${sceneId}-09-blue-hourglass`, 9, 16, 'allLasers', 'hourglassFrame', BLUE, 0.92, expanded ? 112 : 92, { beamAppearance: { width: 1.35, glow: 0.88 }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-10-violet-fog-halo`, 10, 16, 'sails', 'halo', VIOLET, 0.9, expanded ? 126 : 102, { beamAppearance: { width: 2.35, glow: 0.98 } }),
    beatScene(spec, `${sceneId}-11-white-x`, 11, 16, 'fanHeads', 'hourglassSweep', ICE, 1, expanded ? 124 : 102, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.65, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(spec, `${sceneId}-12-cyan-tunnel`, 12, 16, 'canopy', 'canopy', ICE, 0.98, expanded ? 142 : 118, { beamAppearance: { width: expanded ? 2.8 : 2.35, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-13-magenta-fold`, 13, 16, 'rightHourglass', 'sail', MAGENTA, 0.94, expanded ? 124 : 100, { beamTravel: { mode: 'scanner', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' } }),
    beatScene(spec, `${sceneId}-14-green-dagger`, 14, 16, 'leftHourglass', 'hourglassShards', GREEN, 0.9, expanded ? 108 : 88, { beamAppearance: { width: 1.5, glow: 0.88 }, beamTravel: { mode: 'projectile', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' } }),
    beatScene(spec, `${sceneId}-15-red-white-split`, 15, 16, 'allBeams', expanded ? 'halo' : 'hourglassFrame', expanded ? WHITE : RED, 1, expanded ? 146 : 126, { beamAppearance: { width: expanded ? 3.15 : 2.55, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
  ]
  return expanded ? [
    ...core,
    ledBeat(`${sceneId}-led-cyan-0`, 0, 16, 'hourglassLed', CYAN, 0.74),
    ledBeat(`${sceneId}-led-violet-4`, 4, 16, 'hourglassLed', VIOLET, 0.76),
    ledBeat(`${sceneId}-led-green-6`, 6, 16, 'hourglassLedLeft', GREEN, 0.76),
    ledBeat(`${sceneId}-led-white-8`, 8, 16, 'hourglassLed', WHITE, 0.88),
    ledBeat(`${sceneId}-led-magenta-13`, 13, 16, 'hourglassLedRight', MAGENTA, 0.8),
    ledBeat(`${sceneId}-led-red-15`, 15, 16, 'hourglassLed', RED, 0.88),
  ] : core
}

function hourglassIntroScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = HOURGLASS_SPEC
  const id = `${spec.id}-intro`
  return sceneBase(spec, id, `${spec.name} · Beacon Awakening`, section(['intro']), 'intro', {
    global: { dimmer: 0.62, globalGlow: 0.76, beamPersistence: 0.2, backgroundFade: 0.92, haze: 0.18 },
    ...commonCadence(spec, id, 'leftHourglass', 'rightHourglass', 'sail', CYAN, VIOLET, true),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-beacon`, 'beacon', 'beacon', WHITE, 0.62, 26, { component: { movingHeadPanTiltStyle: 'locked' }, beamAppearance: { width: 1.9, glow: 0.96 } }),
      beamMutation(spec, `${id}-left`, 'leftHourglass', 'sail', CYAN, 0.4, 52, { beamTravel: { mode: 'scanner', beatsPerTravel: 8, retrigger: 'continue', direction: 'forward' } }),
      beamMutation(spec, `${id}-right`, 'rightHourglass', 'sail', VIOLET, 0.4, 52, { beamTravel: { mode: 'scanner', beatsPerTravel: 8, retrigger: 'continue', direction: 'forward' } }),
      ledMutation(`${id}-led-left`, 'hourglassLedLeft', GREEN, 0.3),
      ledMutation(`${id}-led-right`, 'hourglassLedRight', MAGENTA, 0.3),
      hazeMutation(`${id}-haze`, 0.18),
    ],
  })
}

function hourglassVerseScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = HOURGLASS_SPEC
  const id = `${spec.id}-verse`
  const cadence = commonCadence(spec, id, 'leftHourglass', 'rightHourglass', 'hourglassFrame', CYAN, MAGENTA, true)
  return sceneBase(spec, id, `${spec.name} · Vocal Beacon / Hourglass Gaps`, section(['verse']), 'verse', {
    global: { dimmer: 0.56, globalGlow: 0.62, beamPersistence: 0.16, backgroundFade: 0.94, haze: 0.14 },
    ...cadence,
    beatMutations: cadence.beatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    kickMutations: cadence.kickMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-gap-left`, 'leftHourglass', 'sail', CYAN, 0.46, 54, {}, lyricGap),
      beamMutation(spec, `${id}-gap-right`, 'rightHourglass', 'sail', MAGENTA, 0.46, 54, {}, lyricGap),
      beamMutation(spec, `${id}-vocal`, 'vocalIsolation', 'beacon', WARM_WHITE, 0.58, 22, { component: { movingHeadPanTiltStyle: 'locked' }, beamAppearance: { width: 1.8, glow: 0.9 } }, lyricActive),
      beamMutation(spec, `${id}-stem`, 'vocalIsolation', 'beacon', WARM_WHITE, 0.52, 22, { component: { movingHeadPanTiltStyle: 'locked' } }, vocalStemActive),
      ledMutation(`${id}-led`, 'hourglassLed', BLUE, 0.3),
      hazeMutation(`${id}-haze`, 0.14),
    ],
  })
}

function hourglassBuildScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = HOURGLASS_SPEC
  const id = `${spec.id}-build`
  return sceneBase(spec, id, `${spec.name} · Helix Convergence`, section(['build']), 'build', {
    global: { dimmer: 0.8, globalGlow: 0.88, beamPersistence: 0.1, backgroundFade: 0.82, haze: 0.28 },
    ...commonCadence(spec, id, 'leftHourglass', 'rightHourglass', 'helix', CYAN, MAGENTA),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-core`, 'helix', 'helix', GREEN, 0.72, 68),
      beamMutation(spec, `${id}-sails`, 'sails', 'sail', VIOLET, 0.74, 86, {}, [{ source: 'buildProgress', operator: 'gt', value: 0.46 }]),
      ledMutation(`${id}-led`, 'hourglassLed', MAGENTA, 0.62, [{ source: 'buildProgress', operator: 'gt', value: 0.62 }]),
      { ...strobeMutation(`${id}-strobe`, 0.76, 74), conditions: [{ source: 'buildProgress', operator: 'gt', value: 0.8 }] },
      hazeMutation(`${id}-haze`, 0.28),
    ],
  })
}

function hourglassPreDropScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = HOURGLASS_SPEC
  const id = `${spec.id}-pre-drop`
  return sceneBase(spec, id, `${spec.name} · Solitary Beacon`, section(['preDrop']), 'preDrop', {
    global: { dimmer: 0.46, globalGlow: 0.5, beamPersistence: 0.05, backgroundFade: 0.97, haze: 0.12 },
    ...commonCadence(spec, id, 'leftHourglass', 'rightHourglass', 'horizon', GREEN, VIOLET, true),
    blackoutWindows: [{ id: `${id}-cut`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: 0.5, justification: 'Reference-inspired disappearance before the hourglass sculpture reopens.' }],
    sectionBodyMutations: [
      beamMutation(spec, `${id}-beacon`, 'beacon', 'beacon', WHITE, 0.56, 20, { component: { movingHeadPanTiltStyle: 'locked' }, beamAppearance: { width: 1.65, glow: 0.86 } }),
      beamMutation(spec, `${id}-edges`, 'outline', 'horizon', VIOLET, 0.28, 24, { beamAppearance: { width: 0.8, glow: 0.52 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      ledMutation(`${id}-led`, 'hourglassLed', GREEN, 0.18),
      hazeMutation(`${id}-haze`, 0.12),
    ],
    sectionExitMutations: [beamMutation(spec, `${id}-exit`, 'fanHeads', 'hourglassSweep', WHITE, 0.94, 92, { component: { movingHeadPanTiltStyle: 'smoothSweep' }, beamAppearance: { width: 2.8, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' })],
  })
}

function hourglassDropScene(second: boolean): LaserDmxShowDirectorPerformanceScene {
  const spec = HOURGLASS_SPEC
  const kind: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey = second ? 'drop2' : 'drop1'
  const id = `${spec.id}-${second ? 'drop-2' : 'drop-1'}`
  return sceneBase(spec, id, `${spec.name} · ${second ? 'Expanded Red-White Orbit' : 'Hourglass Orbit Relay'}`, section(['drop'], second ? { minOccurrence: 2 } : [1]), kind, {
    global: { dimmer: second ? 1 : 0.96, globalGlow: 1, beamPersistence: 0.05, backgroundFade: second ? 0.62 : 0.7, haze: second ? 0.4 : 0.34 },
    beatMutations: hourglassDropMatrix(id, second),
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
      { id: `${id}-eight-led`, stage: 2, cumulative: true, address: address('hourglassLed'), fixture: { enabled: true, brightness: second ? 0.58 : 0.34, color: second ? ICE : VIOLET } },
    ],
    sixteenBarEvolution: [{ id: `${id}-sixteen`, phase: 1, phraseLengthBars: 16, address: address('allBeams'), fixture: { rotation: second ? 16 : 10, focus: second ? 1 : 0.95 } }],
    sectionEntryMutations: [strobeMutation(`${id}-entry`, 1, 96)],
    sectionBodyMutations: [hazeMutation(`${id}-haze`, second ? 0.4 : 0.34)],
    blackoutWindows: second ? [{ id: `${id}-reset`, kind: 'fakeout', anchor: 'sectionStart', offsetBeats: 5, durationBeats: 0.25, justification: 'Quarter-beat sparse-beacon reset between full hourglass sculptures.' }] : undefined,
    modulations: [
      { source: 'nBass', target: 'fixture.fanSpread', amount: second ? 20 : 16, min: 0, max: second ? 20 : 16, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'spectralFlux', target: 'fixture.beamWidth', amount: second ? 0.54 : 0.42, min: 0, max: second ? 0.54 : 0.42, mode: 'add' },
      { source: 'trackEnergy', target: 'fixture.brightness', amount: 0.1, min: 0, max: 0.1, mode: 'add', requiredCapability: 'Track Energy Curve' },
    ],
  })
}

function hourglassBreakdownScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = HOURGLASS_SPEC
  const id = `${spec.id}-breakdown`
  const cadence = commonCadence(spec, id, 'leftHourglass', 'rightHourglass', 'hourglassFrame', CYAN, VIOLET, true)
  return sceneBase(spec, id, `${spec.name} · Floating Hourglass Interlude`, section(['breakdown', 'bridge']), 'breakdown', {
    global: { dimmer: 0.48, globalGlow: 0.56, beamPersistence: 0.2, backgroundFade: 0.95, haze: 0.14 },
    ...cadence,
    beatMutations: cadence.beatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-beacon`, 'beacon', 'beacon', WHITE, 0.5, 18, { component: { movingHeadPanTiltStyle: 'locked' } }),
      beamMutation(spec, `${id}-hourglass`, 'sails', 'sail', CYAN, 0.38, 44, { beamTravel: { mode: 'scanner', beatsPerTravel: 8, retrigger: 'continue', direction: 'forward' } }, lyricGap),
      beamMutation(spec, `${id}-vocal`, 'vocalIsolation', 'beacon', WARM_WHITE, 0.52, 20, { component: { movingHeadPanTiltStyle: 'locked' } }, lyricActive),
      ledMutation(`${id}-led`, 'hourglassLed', VIOLET, 0.3),
      hazeMutation(`${id}-haze`, 0.14),
    ],
  })
}

function hourglassOutroScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = HOURGLASS_SPEC
  const id = `${spec.id}-outro`
  return sceneBase(spec, id, `${spec.name} · Hourglass Fragments`, section(['outro']), 'outro', {
    global: { dimmer: 0.34, globalGlow: 0.4, beamPersistence: 0.22, backgroundFade: 0.98, haze: 0.06 },
    ...commonCadence(spec, id, 'leftHourglass', 'rightHourglass', 'hourglassShards', CYAN, VIOLET, true),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-fragments`, 'sails', 'hourglassShards', ICE, 0.32, 26, { beamAppearance: { width: 0.9, glow: 0.5 }, beamTravel: { mode: 'scanner', beatsPerTravel: 8, retrigger: 'continue', direction: 'forward' }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      beamMutation(spec, `${id}-beacon`, 'beacon', 'beacon', WHITE, 0.3, 14, { component: { movingHeadPanTiltStyle: 'locked' } }),
      ledMutation(`${id}-led`, 'hourglassLed', BLUE, 0.14),
      hazeMutation(`${id}-haze`, 0.06),
    ],
  })
}

function origamiDropMatrix(sceneId: string, expanded: boolean): LaserDmxShowDirectorPerformanceBeatMutation[] {
  const spec = ORIGAMI_SPEC
  const cycleLength = 16
  const core = [
    beatScene(spec, `${sceneId}-00-single-blade`, 0, cycleLength, 'centerOrigami', 'spine', CRIMSON, 0.82, 26, { beamAppearance: { width: 1.2, glow: 0.8 }, beamTravel: { mode: 'projectile', beatsPerTravel: 0.75, retrigger: 'restart', direction: 'forward' } }),
    beatScene(spec, `${sceneId}-01-twin-sails`, 1, cycleLength, 'sideWings', 'sideWings', RED, 0.92, expanded ? 118 : 96, { beamAppearance: { width: 2.15, glow: 0.96 } }),
    beatScene(spec, `${sceneId}-02-trifold-crown`, 2, cycleLength, 'pyramidFan', 'pyramidFan', CRIMSON, 1, expanded ? 136 : 112, { beamAppearance: { width: expanded ? 2.55 : 2.15, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-03-dark-needle`, 3, cycleLength, 'centerOrigami', 'spine', DEEP_RED, expanded ? 0.56 : 0.34, 18, { beamAppearance: { width: 0.82, glow: 0.48 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-04-red-canopy`, 4, cycleLength, 'redOrigami', 'shrine', RED, 0.96, expanded ? 128 : 106, { beamAppearance: { width: 2.35, glow: 0.98 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-05-white-edge-cut`, 5, cycleLength, 'whiteEdges', 'edgeCut', WHITE, 1, expanded ? 118 : 96, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.5, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(spec, `${sceneId}-06-red-wing-fan`, 6, cycleLength, 'pyramidFan', 'chevron', CRIMSON, 0.98, expanded ? 132 : 108, { beamAppearance: { width: 2.05, glow: 0.98 } }),
    beatScene(spec, `${sceneId}-07-white-lattice`, 7, cycleLength, 'allHeads', 'crossFan', ICE, 1, expanded ? 130 : 106, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.6, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(spec, `${sceneId}-08-red-wire-web`, 8, cycleLength, 'allLasers', 'doubleOrigami', RED, 0.94, expanded ? 134 : 110, { beamAppearance: { width: 1.25, glow: 0.84 }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-09-white-cathedral`, 9, cycleLength, 'allBeams', 'doubleOrigami', WHITE, 1, expanded ? 146 : 122, { beamAppearance: { width: expanded ? 3 : 2.55, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-10-red-folded-diamond`, 10, cycleLength, 'redOrigami', 'origami', CRIMSON, 1, expanded ? 136 : 112, { beamAppearance: { width: 2.45, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
    beatScene(spec, `${sceneId}-11-red-white-cross`, 11, cycleLength, 'allBeams', 'crossFan', WHITE, 1, expanded ? 142 : 118, { beamAppearance: { width: 2.65, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' }),
    beatScene(spec, `${sceneId}-12-sparse-roof`, 12, cycleLength, 'roof', 'roof', DEEP_RED, expanded ? 0.62 : 0.42, 36, { beamAppearance: { width: 0.92, glow: 0.56 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-13-white-horizon`, 13, cycleLength, 'whiteEdges', 'edgeCut', WHITE, 0.98, expanded ? 116 : 94, { component: { movingHeadPanTiltStyle: 'smoothSweep' }, beamAppearance: { width: 2.35, glow: 1 } }),
    beatScene(spec, `${sceneId}-14-red-line-pyramid`, 14, cycleLength, 'pyramidFan', 'pyramidFan', RED, 0.94, expanded ? 134 : 110, { beamAppearance: { width: 1.15, glow: 0.82 }, beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' }),
    beatScene(spec, `${sceneId}-15-full-origami-cathedral`, 15, cycleLength, 'allBeams', 'doubleOrigami', expanded ? WHITE : CRIMSON, 1, expanded ? 148 : 126, { beamAppearance: { width: expanded ? 3.1 : 2.6, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
  ]
  return expanded ? [
    ...core,
    ledBeat(`${sceneId}-led-red-2`, 2, cycleLength, 'roofLed', CRIMSON, 0.78),
    ledBeat(`${sceneId}-led-white-5`, 5, cycleLength, 'roofLed', WHITE, 0.88),
    ledBeat(`${sceneId}-led-red-8`, 8, cycleLength, 'roofLed', RED, 0.82),
    ledBeat(`${sceneId}-led-white-9`, 9, cycleLength, 'roofLed', WHITE, 0.92),
    ledBeat(`${sceneId}-led-red-14`, 14, cycleLength, 'roofLed', CRIMSON, 0.84),
    ledBeat(`${sceneId}-led-full-15`, 15, cycleLength, 'roofLed', WHITE, 0.94),
  ] : core
}

function origamiIntroScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = ORIGAMI_SPEC
  const id = `${spec.id}-intro`
  return sceneBase(spec, id, `${spec.name} · Crimson Roof`, section(['intro']), 'intro', {
    global: { dimmer: 0.58, globalGlow: 0.7, beamPersistence: 0.14, backgroundFade: 0.95, haze: 0.14 },
    ...commonCadence(spec, id, 'leftOrigami', 'rightOrigami', 'roof', CRIMSON, RED, true),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-roof`, 'roof', 'roof', CRIMSON, 0.52, 54, { beamTravel: { mode: 'static', beatsPerTravel: 4, retrigger: 'continue', direction: 'forward' } }),
      beamMutation(spec, `${id}-spine`, 'centerOrigami', 'spine', DEEP_RED, 0.38, 18, { beamAppearance: { width: 0.85, glow: 0.52 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      ledMutation(`${id}-led`, 'roofLed', RED, 0.32),
      hazeMutation(`${id}-haze`, 0.14),
    ],
  })
}

function origamiVerseScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = ORIGAMI_SPEC
  const id = `${spec.id}-verse`
  const cadence = commonCadence(spec, id, 'leftOrigami', 'rightOrigami', 'shrine', RED, CRIMSON, true)
  return sceneBase(spec, id, `${spec.name} · Red Shrine`, section(['verse']), 'verse', {
    global: { dimmer: 0.52, globalGlow: 0.58, beamPersistence: 0.16, backgroundFade: 0.96, haze: 0.12 },
    ...cadence,
    beatMutations: cadence.beatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-shrine`, 'redOrigami', 'shrine', RED, 0.42, 44, {}, lyricGap),
      beamMutation(spec, `${id}-vocal`, 'vocalIsolation', 'spine', WARM_WHITE, 0.5, 18, { component: { movingHeadPanTiltStyle: 'locked' }, beamAppearance: { width: 1.55, glow: 0.82 } }, lyricActive),
      beamMutation(spec, `${id}-stem`, 'vocalIsolation', 'spine', WARM_WHITE, 0.46, 18, { component: { movingHeadPanTiltStyle: 'locked' } }, vocalStemActive),
      ledMutation(`${id}-led`, 'roofLed', DEEP_RED, 0.28),
      hazeMutation(`${id}-haze`, 0.12),
    ],
  })
}

function origamiBuildScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = ORIGAMI_SPEC
  const id = `${spec.id}-build`
  return sceneBase(spec, id, `${spec.name} · Chevron Compression`, section(['build']), 'build', {
    global: { dimmer: 0.78, globalGlow: 0.84, beamPersistence: 0.08, backgroundFade: 0.86, haze: 0.24 },
    ...commonCadence(spec, id, 'leftOrigami', 'rightOrigami', 'chevron', CRIMSON, RED),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-roof`, 'roof', 'roof', RED, 0.68, 62),
      beamMutation(spec, `${id}-fan`, 'pyramidFan', 'pyramidFan', CRIMSON, 0.8, 92, {}, [{ source: 'buildProgress', operator: 'gt', value: 0.48 }]),
      ledMutation(`${id}-led`, 'roofLed', CRIMSON, 0.64, [{ source: 'buildProgress', operator: 'gt', value: 0.64 }]),
      { ...strobeMutation(`${id}-strobe`, 0.74, 72), conditions: [{ source: 'buildProgress', operator: 'gt', value: 0.82 }] },
      hazeMutation(`${id}-haze`, 0.24),
    ],
  })
}

function origamiPreDropScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = ORIGAMI_SPEC
  const id = `${spec.id}-pre-drop`
  return sceneBase(spec, id, `${spec.name} · Single Origami Hold`, section(['preDrop']), 'preDrop', {
    global: { dimmer: 0.42, globalGlow: 0.46, beamPersistence: 0.03, backgroundFade: 0.98, haze: 0.1 },
    ...commonCadence(spec, id, 'leftOrigami', 'rightOrigami', 'spine', DEEP_RED, RED, true),
    blackoutWindows: [{ id: `${id}-cut`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: 0.75, justification: 'Reference-inspired full-bar darkness translated into a safe final-beat cut.' }],
    sectionBodyMutations: [
      beamMutation(spec, `${id}-origami`, 'centerOrigami', 'origami', CRIMSON, 0.52, 26, { beamAppearance: { width: 1.35, glow: 0.72 } }),
      beamMutation(spec, `${id}-side`, 'sideWings', 'sideWings', DEEP_RED, 0.24, 20, { beamAppearance: { width: 0.75, glow: 0.42 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      ledMutation(`${id}-led`, 'roofLed', DEEP_RED, 0.18),
      hazeMutation(`${id}-haze`, 0.1),
    ],
    sectionExitMutations: [beamMutation(spec, `${id}-white-edge`, 'whiteEdges', 'edgeCut', WHITE, 0.96, 86, { component: { movingHeadPanTiltStyle: 'snap' }, beamAppearance: { width: 2.45, glow: 1 }, beamPriorityRole: 'heroImpact', beamVisualRole: 'impact' })],
  })
}

function origamiDropScene(second: boolean): LaserDmxShowDirectorPerformanceScene {
  const spec = ORIGAMI_SPEC
  const kind: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey = second ? 'drop2' : 'drop1'
  const id = `${spec.id}-${second ? 'drop-2' : 'drop-1'}`
  return sceneBase(spec, id, `${spec.name} · ${second ? 'White Cathedral Interlock' : 'Scarlet Fill / Wire Relay'}`, section(['drop'], second ? { minOccurrence: 2 } : [1]), kind, {
    global: { dimmer: second ? 1 : 0.95, globalGlow: 1, beamPersistence: 0.035, backgroundFade: second ? 0.68 : 0.76, haze: second ? 0.34 : 0.28 },
    beatMutations: origamiDropMatrix(id, second),
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
    blackoutWindows: second ? [{ id: `${id}-reset`, kind: 'impactCut', anchor: 'sectionStart', offsetBeats: 6, durationBeats: 0.25, justification: 'Quarter-beat dark reset before the white-edged final origami.' }] : undefined,
    modulations: [
      { source: 'nBass', target: 'fixture.fanSpread', amount: second ? 18 : 14, min: 0, max: second ? 18 : 14, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'spectralFlux', target: 'fixture.beamWidth', amount: second ? 0.46 : 0.34, min: 0, max: second ? 0.46 : 0.34, mode: 'add' },
      { source: 'trackEnergy', target: 'fixture.brightness', amount: 0.1, min: 0, max: 0.1, mode: 'add', requiredCapability: 'Track Energy Curve' },
    ],
  })
}

function origamiBreakdownScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = ORIGAMI_SPEC
  const id = `${spec.id}-breakdown`
  const cadence = commonCadence(spec, id, 'leftOrigami', 'rightOrigami', 'shrine', DEEP_RED, RED, true)
  return sceneBase(spec, id, `${spec.name} · Deep Red Shrine`, section(['breakdown', 'bridge']), 'breakdown', {
    global: { dimmer: 0.42, globalGlow: 0.46, beamPersistence: 0.18, backgroundFade: 0.97, haze: 0.1 },
    ...cadence,
    beatMutations: cadence.beatMutations.map(mutation => ({ ...mutation, conditions: lyricGap })),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-shrine`, 'centerOrigami', 'shrine', DEEP_RED, 0.42, 28),
      beamMutation(spec, `${id}-vocal`, 'vocalIsolation', 'spine', WARM_WHITE, 0.46, 16, { component: { movingHeadPanTiltStyle: 'locked' } }, lyricActive),
      ledMutation(`${id}-led`, 'roofLed', DEEP_RED, 0.22),
      hazeMutation(`${id}-haze`, 0.1),
    ],
  })
}

function origamiOutroScene(): LaserDmxShowDirectorPerformanceScene {
  const spec = ORIGAMI_SPEC
  const id = `${spec.id}-outro`
  return sceneBase(spec, id, `${spec.name} · Red Roof Fragments`, section(['outro']), 'outro', {
    global: { dimmer: 0.32, globalGlow: 0.34, beamPersistence: 0.2, backgroundFade: 0.985, haze: 0.05 },
    ...commonCadence(spec, id, 'leftOrigami', 'rightOrigami', 'roof', DEEP_RED, RED, true),
    sectionBodyMutations: [
      beamMutation(spec, `${id}-roof`, 'roof', 'roof', RED, 0.28, 22, { beamAppearance: { width: 0.8, glow: 0.46 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      beamMutation(spec, `${id}-spine`, 'centerOrigami', 'spine', DEEP_RED, 0.26, 12, { beamAppearance: { width: 0.72, glow: 0.4 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' }),
      ledMutation(`${id}-led`, 'roofLed', DEEP_RED, 0.12),
      hazeMutation(`${id}-haze`, 0.05),
    ],
  })
}

export function createVioletHourglassOrbitRig(createId: CreateId): LaserDmxShowDirectorState {
  return createRig(HOURGLASS_SPEC, createId)
}

export function createVioletHourglassOrbitProgram(): LaserDmxShowDirectorPerformanceProgram {
  const spec = HOURGLASS_SPEC
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
    id: spec.id,
    name: spec.name,
    description: 'A reference-inspired 129-BPM geometric laser observatory built around cyan-violet starbursts, mirrored white hourglasses, pinwheel spokes, split cones, fog halos, green spear accents, sparse center-point breaths, and a sixteen-beat orbit relay that closes in a red-and-white split field.',
    deterministicSeed: 1292216,
    bankRoles: bankAddresses(spec),
    fixtureBanks: bankMetadata(spec),
    energyEnvelopes: spec.energyEnvelopes,
    blackoutPolicy: BLACKOUT_POLICY,
    fallbackOrder: ['verse', 'intro', 'build', 'drop', 'breakdown', 'outro'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    diagnostics: {
      authoringVersion: 'reference-violet-hourglass-orbit-v1',
      expectedFixtureSemanticKeys: spec.fixtureSpecs.map(fixture => fixture.key),
      expectedGroupSemanticKeys: spec.groups.map(([key]) => key),
      notes: [
        'Reference recording measured near 129 BPM and alternates centered starbursts, hourglass cones, white wire fans, fog-softened halos, and near-black single-point breaths.',
        'A shared center point anchors the choreography while cyan, violet, ice-white, green, and late red banks rotate through beat slots and four-bar geometry families.',
        'The video’s apparent cones and luminous planes are translated into wide moving-head beams, fixed laser target polygons, and low-intensity LED edge support.',
        'Vocal passages contract to a warm-white beacon; lyric gaps restore the lateral hourglass response.',
      ],
    },
    scenes: [hourglassIntroScene(), hourglassVerseScene(), hourglassBuildScene(), hourglassPreDropScene(), hourglassDropScene(false), hourglassBreakdownScene(), hourglassDropScene(true), hourglassOutroScene()],
  }
}

export function createScarletOrigamiLatticeRig(createId: CreateId): LaserDmxShowDirectorState {
  return createRig(ORIGAMI_SPEC, createId)
}

export function createScarletOrigamiLatticeProgram(): LaserDmxShowDirectorPerformanceProgram {
  const spec = ORIGAMI_SPEC
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
    id: spec.id,
    name: spec.name,
    description: 'A reference-inspired 152-BPM scarlet origami show built from moving red sail planes, single-blade scans, tri-fold crowns, deep-red canopy holds, red wire pyramids, ice-white lattice floods, and deliberate dark punctuation. Drop 2 interlocks the filled red folds with a full white cathedral lattice.',
    deterministicSeed: 1521916,
    bankRoles: bankAddresses(spec),
    fixtureBanks: bankMetadata(spec),
    energyEnvelopes: spec.energyEnvelopes,
    blackoutPolicy: BLACKOUT_POLICY,
    fallbackOrder: ['verse', 'intro', 'build', 'drop', 'breakdown', 'outro'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    diagnostics: {
      authoringVersion: 'reference-scarlet-origami-lattice-v1',
      expectedFixtureSemanticKeys: spec.fixtureSpecs.map(fixture => fixture.key),
      expectedGroupSemanticKeys: spec.groups.map(([key]) => key),
      notes: [
        'Reference recording measured near 152 BPM and spends long phrases in sculptural crimson folds before opening into alternating red wireframes and ice-white lattice floods.',
        'The primary sixteen-beat relay cycles single blade, twin sails, tri-fold crown, dark needle, red canopy, white cut, red fan, white lattice, red wire web, white cathedral, folded diamond, cross, sparse roof, horizon, line pyramid, and full interlock.',
        'Long dark reference frames are represented by bounded pre-drop and quarter-beat impact cuts while maintaining visible breakdown output.',
        'Kick owns the central red fold, snare owns the ice-white lattice bank, and hats animate the fine inner roof lines without erasing the larger origami silhouette.',
      ],
    },
    scenes: [origamiIntroScene(), origamiVerseScene(), origamiBuildScene(), origamiPreDropScene(), origamiDropScene(false), origamiBreakdownScene(), origamiDropScene(true), origamiOutroScene()],
  }
}

export const LASER_DMX_SHOW_DIRECTOR_FINAL_REFERENCE_PERFORMANCE_PRESETS: readonly LaserDmxShowDirectorPerformancePresetDefinition[] = Object.freeze([
  Object.freeze({
    id: HOURGLASS_ID,
    name: HOURGLASS_NAME,
    description: 'A cyan-violet geometric observatory of starbursts, mirrored hourglasses, pinwheels, split cones, fog halos, green spear accents, white wire fans, and a red-white final field.',
    genreTags: ['melodic bass', 'progressive electronic', 'trance', 'cinematic EDM'],
    behaviorTags: ['center-point starbursts', 'mirrored hourglass cones', 'sixteen-beat orbit relay', 'red-white closing field'],
    supportedSectionRoles: [...ALL_SECTIONS],
    musicIntelligenceCapabilities: [...MUSIC_CAPABILITIES],
    fixtureCount: HOURGLASS_FIXTURES.length,
    approximatePeakBeamDemand: 266,
    createRig: createVioletHourglassOrbitRig,
    createProgram: createVioletHourglassOrbitProgram,
  }),
  Object.freeze({
    id: ORIGAMI_ID,
    name: ORIGAMI_NAME,
    description: 'A scarlet origami lattice of moving red sail planes, tri-fold crowns, deep-red canopy holds, red wire pyramids, ice-white cathedral floods, and tightly bounded dark punctuation.',
    genreTags: ['techno', 'hard dance', 'festival bass', 'industrial EDM'],
    behaviorTags: ['scarlet sail planes', 'sixteen-beat fill-wire relay', 'ice-white lattice floods', 'bounded dark resets'],
    supportedSectionRoles: [...ALL_SECTIONS],
    musicIntelligenceCapabilities: [...MUSIC_CAPABILITIES],
    fixtureCount: ORIGAMI_FIXTURES.length,
    approximatePeakBeamDemand: 274,
    createRig: createScarletOrigamiLatticeRig,
    createProgram: createScarletOrigamiLatticeProgram,
  }),
])
