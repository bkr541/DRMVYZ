import {
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorBeamTarget,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorState,
} from './ReactTypes'
import type {
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceBeatMutation,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceOccurrenceMatch,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
  LaserDmxShowDirectorPerformanceSectionMatch,
} from './LaserDmxShowDirectorPerformanceProgram'
import type { LaserDmxShowDirectorPerformancePresetDefinition } from './LaserDmxShowDirectorPerformancePresets'
import {
  authorCardinalFanReactorLocalGeometry,
  authorCyanMirrorCageLocalGeometry,
  authorPrismCathedralLocalGeometry,
} from './LaserDmxShowDirectorPerformanceShowcaseGeometry'
import {
  LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY,
  LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
  createBankDuckMutation,
  createBankHitMutation,
  createDownbeatImpactMutations,
} from './LaserDmxShowDirectorBeatActions'

const CYAN = '#39e7ff'
const ICE = '#8ff5ff'
const BLUE = '#4b7dff'
const MAGENTA = '#e057ff'
const VIOLET = '#9b73ff'
const LAVENDER = '#d7c6ff'
const WHITE = '#ffffff'
const RED = '#ff426f'
const ORANGE = '#ff8a38'

const ALL_SECTIONS = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro'] as const
const MUSIC_CAPABILITIES = [
  'Beat Grid', 'Rhythm Events', 'Live Bands', 'Sections', 'Energy',
  'Track Energy Curve', 'Stem Curves', 'Lyrics', 'Harmonic', 'Semantics', 'Spectral Features',
]

const PRISM_MOTIF_SEQUENCE = ['prism-open-x', 'prism-nested-diamond', 'prism-mirrored-crown', 'prism-cathedral-cage'] as const
const CARDINAL_MOTIF_SEQUENCE = ['cardinal-horizontal-opposing-fans', 'cardinal-vertical-opposing-fans', 'cardinal-aperture', 'cardinal-diagonal-expansion'] as const
const CAGE_MOTIF_SEQUENCE = ['cage-outer-mirrored-walls', 'cage-inner-chevrons', 'cage-double-x', 'cage-wide-cage-wings'] as const

type CreateId = () => string

type FixtureSpec = {
  key: string
  label: string
  groupKey: string
  x: number
  y: number
  targetX: number
  targetY: number
  color: string
  rotation?: number
  spread?: number
  brightness?: number
}

type GroupSpec = { key: string; label: string }

function targetSet(id: string, coordinates: ReadonlyArray<readonly [number, number]>): LaserDmxShowDirectorBeamTarget[] {
  return coordinates.map(([x, y], index) => ({ id: `${id}-${index + 1}`, x, y }))
}

function createLaserFixture(
  createId: CreateId,
  presetId: string,
  groupIds: Readonly<Record<string, string>>,
  spec: FixtureSpec,
  index: number,
): LaserDmxShowDirectorFixture {
  const fixture = createDefaultLaserDmxShowDirectorFixture('laser', createId(), index)
  return {
    ...fixture,
    semanticKey: spec.key,
    label: spec.label,
    groupId: groupIds[spec.groupKey] ?? null,
    linkedPairId: `${presetId}-pair-${spec.groupKey}`,
    mirrorAxis: 'horizontal',
    x: spec.x,
    y: spec.y,
    rotation: spec.rotation ?? 0,
    color: spec.color,
    brightness: spec.brightness ?? 0.72,
    beam: {
      ...fixture.beam,
      beamEnabled: true,
      targetMode: 'fan',
      beamSpread: spec.spread ?? 54,
      focus: 0.86,
      targetX: spec.targetX,
      targetY: spec.targetY,
      targets: [{ id: `${spec.key}-base-target`, x: spec.targetX, y: spec.targetY }],
    },
    trigger: {
      ...fixture.trigger,
      mode: 'alwaysOn',
      quantize: 'none',
      retrigger: 'allow',
      fadeInMs: 0,
      fadeOutMs: 0,
    },
  }
}

function createRig(
  presetId: string,
  createId: CreateId,
  columns: number,
  rows: number,
  groups: readonly GroupSpec[],
  fixtures: readonly FixtureSpec[],
): LaserDmxShowDirectorState {
  const groupIds = Object.fromEntries(groups.map(group => [group.key, `${presetId}-group-${group.key}`]))
  return normalizeLaserDmxShowDirectorState({
    ...createDefaultLaserDmxShowDirectorState(),
    sourceTemplateId: null,
    groups: groups.map(group => ({ id: groupIds[group.key], semanticKey: group.key, label: group.label })),
    fixtures: fixtures.map((fixture, index) => createLaserFixture(createId, presetId, groupIds, fixture, index)),
    settings: {
      ...createDefaultLaserDmxShowDirectorState().settings,
      gridSize: { columns, rows },
      snapEnabled: true,
      showLabels: true,
      showBeams: true,
      showGrid: true,
      highlightFixtures: true,
      zoom: 1,
    },
  })
}

function section(
  types: LaserDmxShowDirectorPerformanceSectionMatch['types'],
  dropOccurrence?: number[] | LaserDmxShowDirectorPerformanceOccurrenceMatch,
): LaserDmxShowDirectorPerformanceSectionMatch {
  if (!dropOccurrence) return { types }
  return { types, dropOccurrence: Array.isArray(dropOccurrence) ? { occurrences: dropOccurrence } : dropOccurrence }
}

function applyMotifFamilySequence(
  program: LaserDmxShowDirectorPerformanceProgram,
  sequence: readonly string[],
): LaserDmxShowDirectorPerformanceProgram {
  return {
    ...program,
    scenes: program.scenes.map(scene => ({
      ...scene,
      fourBarVariations: scene.fourBarVariations?.map((variation, index) => ({
        ...variation,
        motifFamily: sequence[index % sequence.length],
      })),
    })),
  }
}

function baseScene(
  id: string,
  label: string,
  sectionMatch: LaserDmxShowDirectorPerformanceSectionMatch,
  patch: Partial<LaserDmxShowDirectorPerformanceScene>,
): LaserDmxShowDirectorPerformanceScene {
  return {
    id,
    label,
    enabled: true,
    priority: 10,
    section: sectionMatch,
    address: { fixtureKinds: ['laser'] },
    fixture: {
      enabled: false,
      brightness: 0.65,
      focus: 0.86,
      beamPriorityRole: 'primaryArchitecture',
    },
    global: { dimmer: 0.9, globalGlow: 0.82, beamPersistence: 0.22 },
    ...patch,
  }
}

function enableGroup(
  id: string,
  stage: number,
  groupSemanticKey: string,
  fixture: NonNullable<LaserDmxShowDirectorPerformanceMutationBase['fixture']>,
  cumulative = true,
) {
  return {
    id,
    stage,
    cumulative,
    address: { groupSemanticKeys: [groupSemanticKey] },
    fixture: { enabled: true, ...fixture },
  }
}

function enableFixtures(
  id: string,
  stage: number,
  fixtureSemanticKeys: string[],
  fixture: NonNullable<LaserDmxShowDirectorPerformanceMutationBase['fixture']>,
  cumulative = true,
) {
  return {
    id,
    stage,
    cumulative,
    address: { fixtureSemanticKeys },
    fixture: { enabled: true, ...fixture },
  }
}

function alternatingBeatMutations(
  prefix: string,
  leftKeys: string[],
  rightKeys: string[],
  options: { leftColor?: string; rightColor?: string; spreadA?: number; spreadB?: number; rotation?: number } = {},
): LaserDmxShowDirectorPerformanceBeatMutation[] {
  return [
    {
      id: `${prefix}-beat-even-left`, beatDivision: 1, beatOffsets: [0, 2], responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { fixtureSemanticKeys: leftKeys },
      fixture: { brightness: 1, fanSpread: options.spreadA ?? 70, rotation: -(options.rotation ?? 8), color: options.leftColor, beamAppearance: { width: 1.65, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 1, phaseOffset: 0, retrigger: 'restart' }, beamPriorityRole: 'heroImpact' as const },
    },
    {
      id: `${prefix}-beat-even-right-dim`, beatDivision: 1, beatOffsets: [0, 2], responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { fixtureSemanticKeys: rightKeys },
      fixture: { brightness: LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.restingBrightness, fanSpread: options.spreadB ?? 48, beamAppearance: { width: 0.9, glow: 0.54 }, beamPriorityRole: 'decorativeAccent' as const },
    },
    {
      id: `${prefix}-beat-odd-right`, beatDivision: 1, beatOffsets: [1, 3], responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { fixtureSemanticKeys: rightKeys },
      fixture: { brightness: 1, fanSpread: options.spreadA ?? 70, rotation: options.rotation ?? 8, color: options.rightColor, beamAppearance: { width: 1.65, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 1, phaseOffset: 0, retrigger: 'restart' }, beamPriorityRole: 'heroImpact' as const },
    },
    {
      id: `${prefix}-beat-odd-left-dim`, beatDivision: 1, beatOffsets: [1, 3], responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { fixtureSemanticKeys: leftKeys },
      fixture: { brightness: LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.restingBrightness, fanSpread: options.spreadB ?? 48, beamAppearance: { width: 0.9, glow: 0.54 }, beamPriorityRole: 'decorativeAccent' as const },
    },
  ]
}

function impactMutations(prefix: string, innerKeys: string[], outerKeys: string[], accentKeys: string[]) {
  return {
    kickMutations: [
      {
        id: `${prefix}-kick-inner`, threshold: 0.42,
        address: { fixtureSemanticKeys: innerKeys },
        fixture: { brightness: 1, fanSpread: 86, beamAppearance: { width: 2.2, glow: 1 }, beamPriorityRole: 'heroImpact' as const },
      },
    ],
    snareMutations: [
      {
        id: `${prefix}-snare-outer`, threshold: 0.42,
        address: { fixtureSemanticKeys: outerKeys },
        fixture: { brightness: 1, color: WHITE, beamAppearance: { width: 1.7, glow: 1 }, beamPriorityRole: 'heroImpact' as const },
      },
    ],
    transientMutations: [
      {
        id: `${prefix}-transient-accent`, threshold: 0.5,
        address: { fixtureSemanticKeys: accentKeys },
        fixture: { enabled: true, brightness: 1, focus: 1, beamAppearance: { width: 2.8, glow: 1 }, beamPriorityRole: 'heroImpact' as const },
      },
    ],
  }
}


type PresetBankChoreography = {
  kickRole: string
  kickRestRole: string
  snareRole: string
  snareRestRole: string
  hatRole: string
  hatRestRole: string
  transientRole: string
  transientRestRole: string
  bassRole: string
  impactColor: string
  complementaryColor: string
  kickSpread: number
  snareSpread: number
  transientSpread: number
  deterministicFakeout?: boolean
}

function roleAddress(role: string): LaserDmxShowDirectorPerformanceAddress {
  return { bankRoles: [role] }
}

function applyPresetBankChoreography(
  program: LaserDmxShowDirectorPerformanceProgram,
  choreography: PresetBankChoreography,
): LaserDmxShowDirectorPerformanceProgram {
  return {
    ...program,
    scenes: program.scenes.map(scene => {
      const prefix = `${scene.id}-bank-response`
      const kick = [
        createBankHitMutation(`${prefix}-kick-hero`, roleAddress(choreography.kickRole), {
          fanSpread: choreography.kickSpread,
          color: choreography.impactColor,
          travelMode: 'grow',
        }),
        createBankDuckMutation(`${prefix}-kick-duck`, roleAddress(choreography.kickRestRole)),
      ]
      const snare = [
        createBankHitMutation(`${prefix}-snare-hero`, roleAddress(choreography.snareRole), {
          fanSpread: choreography.snareSpread,
          color: WHITE,
          width: 2.45,
          travelMode: 'scanner',
        }),
        createBankDuckMutation(`${prefix}-snare-duck`, roleAddress(choreography.snareRestRole)),
      ]
      const hat = [
        createBankHitMutation(`${prefix}-hat-detail`, roleAddress(choreography.hatRole), {
          threshold: 0.25,
          brightness: LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.hatBrightness,
          fanSpread: Math.max(18, choreography.snareSpread - 22),
          color: choreography.complementaryColor,
          width: 1.25,
          glow: 0.82,
          travelMode: 'pulseTrain',
        }),
        createBankDuckMutation(`${prefix}-hat-duck`, roleAddress(choreography.hatRestRole), {
          threshold: 0.25,
          brightness: 0.58,
          glow: 0.62,
        }),
      ]
      const transient = [
        createBankHitMutation(`${prefix}-transient-impact`, roleAddress(choreography.transientRole), {
          threshold: 0.68,
          brightness: 1,
          fanSpread: choreography.transientSpread,
          color: WHITE,
          width: 2.85,
          geometry: 'volumetricCone',
          travelMode: 'projectile',
        }),
        createBankDuckMutation(`${prefix}-transient-duck`, roleAddress(choreography.transientRestRole), {
          threshold: 0.68,
          brightness: 0.32,
          glow: 0.48,
        }),
      ]
      const downbeat = createDownbeatImpactMutations(
        prefix,
        roleAddress(choreography.transientRole),
        roleAddress(choreography.transientRestRole),
        { color: WHITE, geometry: 'volumetricCone' },
      )
      const fakeout = choreography.deterministicFakeout ? [{
        ...createBankDuckMutation(`${prefix}-withheld-impact`, roleAddress(choreography.transientRole), {
          threshold: 0,
          brightness: 0.24,
          glow: 0.42,
        }),
        beatDivision: 1,
        beatOffsets: [12],
        beatCycleLength: 16,
        responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      }] : []
      return {
        ...scene,
        beatMutations: [...(scene.beatMutations ?? []), ...downbeat, ...fakeout],
        kickMutations: [...(scene.kickMutations ?? []), ...kick],
        snareMutations: [...(scene.snareMutations ?? []), ...snare],
        hatMutations: [...(scene.hatMutations ?? []), ...hat],
        transientMutations: [...(scene.transientMutations ?? []), ...transient],
        sectionBodyMutations: [
          ...(scene.sectionBodyMutations ?? []),
          {
            id: `${prefix}-bass-pressure`,
            address: roleAddress(choreography.bassRole),
            modulations: [
              { source: 'nBass', target: 'fixture.fanSpread', amount: 14, min: 0, max: 14, mode: 'add' as const, requiredCapability: 'Live Bands' },
              { source: 'nBass', target: 'fixture.brightness', amount: 0.12, min: 0, max: 0.12, mode: 'add' as const, requiredCapability: 'Live Bands' },
            ],
          },
        ],
      }
    }),
  }
}

function shortPredropBlackout(prefix: string): LaserDmxShowDirectorPerformanceMutationBase[] {
  return [{
    id: `${prefix}-final-half-beat-blackout`,
    conditions: [
      { source: 'sectionProgress', operator: 'gte', value: 0.96, requiredCapability: 'Sections' },
      { source: 'beatPhase', operator: 'gte', value: 0.5, requiredCapability: 'Beat Grid' },
    ],
    global: { blackout: true, dimmer: 0 },
  }]
}

// ── Prism Cathedral ──────────────────────────────────────────────────────────

const PRISM_GROUPS: readonly GroupSpec[] = [
  { key: 'prism-upper-outer', label: 'Upper Outer Pair' },
  { key: 'prism-upper-inner', label: 'Upper Inner Pair' },
  { key: 'prism-middle-side', label: 'Middle Side Pair' },
  { key: 'prism-lower-inner', label: 'Lower Inner Pair' },
  { key: 'prism-lower-outer', label: 'Lower Outer Pair' },
  { key: 'prism-center-accent', label: 'Center Accent Pair' },
]

const PRISM_FIXTURES: readonly FixtureSpec[] = [
  { key: 'prism-upper-outer-left', label: 'Upper Outer Left', groupKey: 'prism-upper-outer', x: 2, y: 1, targetX: 15, targetY: 10, color: CYAN, rotation: 42, spread: 62 },
  { key: 'prism-upper-outer-right', label: 'Upper Outer Right', groupKey: 'prism-upper-outer', x: 16, y: 1, targetX: 3, targetY: 10, color: MAGENTA, rotation: 138, spread: 62 },
  { key: 'prism-upper-inner-left', label: 'Upper Inner Left', groupKey: 'prism-upper-inner', x: 6, y: 2, targetX: 12, targetY: 9, color: ICE, rotation: 55, spread: 54 },
  { key: 'prism-upper-inner-right', label: 'Upper Inner Right', groupKey: 'prism-upper-inner', x: 12, y: 2, targetX: 6, targetY: 9, color: MAGENTA, rotation: 125, spread: 54 },
  { key: 'prism-middle-side-left', label: 'Middle Side Left', groupKey: 'prism-middle-side', x: 1, y: 5, targetX: 14, targetY: 5, color: CYAN, rotation: 0, spread: 48 },
  { key: 'prism-middle-side-right', label: 'Middle Side Right', groupKey: 'prism-middle-side', x: 17, y: 5, targetX: 4, targetY: 5, color: MAGENTA, rotation: 180, spread: 48 },
  { key: 'prism-lower-inner-left', label: 'Lower Inner Left', groupKey: 'prism-lower-inner', x: 6, y: 9, targetX: 12, targetY: 2, color: CYAN, rotation: -52, spread: 58 },
  { key: 'prism-lower-inner-right', label: 'Lower Inner Right', groupKey: 'prism-lower-inner', x: 12, y: 9, targetX: 6, targetY: 2, color: MAGENTA, rotation: 232, spread: 58 },
  { key: 'prism-lower-outer-left', label: 'Lower Outer Left', groupKey: 'prism-lower-outer', x: 2, y: 10, targetX: 14, targetY: 3, color: CYAN, rotation: -32, spread: 70 },
  { key: 'prism-lower-outer-right', label: 'Lower Outer Right', groupKey: 'prism-lower-outer', x: 16, y: 10, targetX: 4, targetY: 3, color: MAGENTA, rotation: 212, spread: 70 },
  { key: 'prism-center-accent-left', label: 'Center Accent Left', groupKey: 'prism-center-accent', x: 8, y: 6, targetX: 9, targetY: 3, color: WHITE, rotation: -70, spread: 28 },
  { key: 'prism-center-accent-right', label: 'Center Accent Right', groupKey: 'prism-center-accent', x: 10, y: 6, targetX: 9, targetY: 3, color: LAVENDER, rotation: 250, spread: 28 },
]

const PRISM_LEFT = PRISM_FIXTURES.filter(fixture => fixture.key.endsWith('-left')).map(fixture => fixture.key)
const PRISM_RIGHT = PRISM_FIXTURES.filter(fixture => fixture.key.endsWith('-right')).map(fixture => fixture.key)
const PRISM_INNER = ['prism-upper-inner-left', 'prism-upper-inner-right', 'prism-lower-inner-left', 'prism-lower-inner-right']
const PRISM_OUTER = ['prism-upper-outer-left', 'prism-upper-outer-right', 'prism-lower-outer-left', 'prism-lower-outer-right']
const PRISM_ACCENTS = ['prism-center-accent-left', 'prism-center-accent-right']

const PRISM_X = targetSet('prism-x', [[16, 10], [14, 8], [12, 7], [10, 6], [8, 6], [6, 7], [4, 8], [2, 10]])
const PRISM_DIAMOND = targetSet('prism-diamond', [[9, 1], [13, 3], [16, 6], [13, 9], [9, 10], [5, 9], [2, 6], [5, 3]])
const PRISM_CROWN = targetSet('prism-crown', [[2, 8], [5, 4], [7, 6], [9, 2], [11, 6], [13, 4], [16, 8], [9, 6]])
const PRISM_CAGE = targetSet('prism-cage', [[1, 2], [5, 1], [9, 3], [13, 1], [17, 2], [16, 9], [9, 10], [2, 9]])
const PRISM_SPEARS = targetSet('prism-spears', [[4, 1], [7, 2], [11, 2], [14, 1]])

function prismIntroScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('prism-intro', 'Prism Cathedral · Intro', section(['intro']), {
    global: { dimmer: 0.58, globalGlow: 0.62, beamPersistence: 0.38 },
    eightBarRecruitment: [
      enableGroup('prism-intro-outer', 1, 'prism-upper-outer', { brightness: 0.56, color: ICE, fanSpread: 22, targetMode: 'cross', targetPoints: PRISM_X.slice(0, 2) }),
      enableGroup('prism-intro-inner', 2, 'prism-upper-inner', { brightness: 0.64, color: CYAN, fanSpread: 30, targetMode: 'fixed', targetPoints: PRISM_DIAMOND.slice(0, 4) }),
      enableGroup('prism-intro-middle', 3, 'prism-middle-side', { brightness: 0.5, color: ICE, fanSpread: 26, targetMode: 'cross', targetPoints: PRISM_X.slice(2, 4) }),
    ],
    beatMutations: alternatingBeatMutations('prism-intro', PRISM_LEFT.slice(0, 2), PRISM_RIGHT.slice(0, 2), { spreadA: 34, spreadB: 18, rotation: 4 }),
    barMutations: [
      { id: 'prism-intro-bar-out', intervalBars: 2, anchorBar: 0, address: { groupSemanticKeys: ['prism-upper-outer'] }, fixture: { rotation: -8, targetPoints: PRISM_X.slice(0, 2) } },
      { id: 'prism-intro-bar-in', intervalBars: 2, anchorBar: 1, address: { groupSemanticKeys: ['prism-upper-outer'] }, fixture: { rotation: 8, targetPoints: PRISM_DIAMOND.slice(0, 2) } },
    ],
    fourBarVariations: [
      { id: 'prism-intro-outer-cross', address: { groupSemanticKeys: ['prism-upper-outer'] }, fixture: { targetMode: 'fixed', targetPoints: PRISM_X.slice(0, 4), fanSpread: 20 } },
      { id: 'prism-intro-inner-cross', address: { groupSemanticKeys: ['prism-upper-inner'] }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: PRISM_X.slice(2, 6), fanSpread: 26 } },
      { id: 'prism-intro-open-x', address: { groupSemanticKeys: ['prism-upper-outer'] }, fixture: { targetMode: 'fixed', targetPoints: PRISM_X, fanSpread: 36 } },
      { id: 'prism-intro-diamond', address: { groupSemanticKeys: ['prism-upper-inner'] }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: PRISM_DIAMOND, fanSpread: 30 } },
    ],
    modulations: [
      { source: 'nHigh', target: 'fixture.beamWidth', amount: 0.7, min: 0, max: 0.7, mode: 'add', requiredCapability: 'Live Bands' },
    ],
  })
}

function prismVerseScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('prism-verse', 'Prism Cathedral · Verse', section(['verse']), {
    global: { dimmer: 0.7, globalGlow: 0.7, beamPersistence: 0.3 },
    eightBarRecruitment: [
      enableGroup('prism-verse-upper-outer', 1, 'prism-upper-outer', { brightness: 0.66, color: CYAN, fanSpread: 30, targetMode: 'fixed', targetPoints: PRISM_X.slice(0, 4) }),
      enableGroup('prism-verse-lower-inner', 1, 'prism-lower-inner', { brightness: 0.58, color: ICE, fanSpread: 26, targetMode: 'fixed', targetPoints: PRISM_DIAMOND.slice(2, 6) }),
      enableGroup('prism-verse-upper-inner', 2, 'prism-upper-inner', { brightness: 0.7, color: MAGENTA, fanSpread: 38, targetMode: 'fixed', targetPoints: PRISM_DIAMOND }),
      enableGroup('prism-verse-middle', 3, 'prism-middle-side', { brightness: 0.62, color: CYAN, fanSpread: 40, targetMode: 'cross', targetPoints: PRISM_X.slice(2, 6) }),
    ],
    beatMutations: alternatingBeatMutations('prism-verse', PRISM_LEFT, PRISM_RIGHT, { spreadA: 52, spreadB: 30, rotation: 7 }),
    barMutations: [
      { id: 'prism-verse-sweep-left', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: PRISM_LEFT }, fixture: { rotation: -12, targetPosition: { x: 12, y: 6 } } },
      { id: 'prism-verse-sweep-right', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: PRISM_RIGHT }, fixture: { rotation: 12, targetPosition: { x: 6, y: 6 } } },
    ],
    fourBarVariations: [
      { id: 'prism-verse-outer-crossing', address: { groupSemanticKeys: ['prism-upper-outer'] }, fixture: { targetPoints: PRISM_X, targetMode: 'fixed' } },
      { id: 'prism-verse-inner-crossing', address: { groupSemanticKeys: ['prism-lower-inner'] }, fixture: { targetPoints: PRISM_X.slice().reverse(), targetMode: 'fixed' } },
      { id: 'prism-verse-open-x', address: { fixtureSemanticKeys: PRISM_OUTER }, fixture: { enabled: true, targetPoints: PRISM_X, targetMode: 'fixed', fanSpread: 58 } },
      { id: 'prism-verse-restrained-diamond', address: { fixtureSemanticKeys: PRISM_INNER }, fixture: { enabled: true, targetPoints: PRISM_DIAMOND, targetMode: 'fixed', fanSpread: 34 } },
    ],
    sectionBodyMutations: [
      {
        id: 'prism-verse-chord-change-accent', probability: 0.8,
        conditions: [{ source: 'isChordChange', operator: 'truthy', minConfidence: 0.45 }],
        address: { fixtureSemanticKeys: PRISM_INNER },
        fixture: { enabled: true, color: LAVENDER, targetMode: 'fixed', targetPoints: PRISM_DIAMOND },
      },
      {
        id: 'prism-verse-vocal-hook-accent', probability: 0.7,
        conditions: [{ source: 'isVocalHook', operator: 'truthy', minConfidence: 0.5 }],
        address: { fixtureSemanticKeys: PRISM_ACCENTS },
        fixture: { enabled: true, color: WHITE, brightness: 0.9 },
      },
    ],
    modulations: [
      { source: 'nBass', target: 'fixture.brightness', amount: 0.28, min: 0, max: 0.28, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'delta', target: 'fixture.rotation', amount: 5, min: 0, max: 5, mode: 'add' },
      { source: 'melodyHeight', target: 'fixture.rotation', amount: 8, min: 0, max: 8, mode: 'add', minConfidence: 0.35 },
      { source: 'trackEnergy', target: 'fixture.fanSpread', amount: 12, min: 0, max: 12, mode: 'add', requiredCapability: 'Track Energy Curve' },
      { source: 'chordConfidence', target: 'global.globalGlow', amount: 0.12, min: 0, max: 0.12, mode: 'add' },
    ],
  })
}

function prismBuildScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('prism-build', 'Prism Cathedral · Build', section(['build']), {
    global: { dimmer: 0.78, globalGlow: 0.82, beamPersistence: 0.24 },
    eightBarRecruitment: [
      enableGroup('prism-build-outer', 1, 'prism-upper-outer', { brightness: 0.72, color: CYAN, fanSpread: 38, targetMode: 'fixed', targetPoints: PRISM_X }),
      enableGroup('prism-build-lower', 1, 'prism-lower-inner', { brightness: 0.68, color: ICE, fanSpread: 34, targetMode: 'fixed', targetPoints: PRISM_DIAMOND }),
      enableGroup('prism-build-inner', 2, 'prism-upper-inner', { brightness: 0.84, color: MAGENTA, fanSpread: 62, targetMode: 'fixed', targetPoints: PRISM_CROWN }),
      enableGroup('prism-build-middle', 2, 'prism-middle-side', { brightness: 0.76, color: MAGENTA, fanSpread: 58, targetMode: 'fixed', targetPoints: PRISM_CAGE }),
      enableGroup('prism-build-accent', 3, 'prism-center-accent', { brightness: 0.9, color: WHITE, fanSpread: 30, targetMode: 'fixed', targetPoints: PRISM_DIAMOND.slice(0, 4), beamPriorityRole: 'heroImpact' }),
    ],
    beatMutations: alternatingBeatMutations('prism-build', PRISM_LEFT, PRISM_RIGHT, { spreadA: 72, spreadB: 44, rotation: 10 }),
    barMutations: [
      { id: 'prism-build-bar-close', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: PRISM_INNER }, fixture: { targetPosition: { x: 9, y: 5 }, fanSpread: 52, rotation: -8 } },
      { id: 'prism-build-bar-open', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: PRISM_INNER }, fixture: { targetPoints: PRISM_CROWN, fanSpread: 64, rotation: 8 } },
    ],
    fourBarVariations: [
      { id: 'prism-build-frame', address: { fixtureSemanticKeys: PRISM_OUTER }, fixture: { targetPoints: PRISM_X, targetMode: 'fixed', fanSpread: 44 } },
      { id: 'prism-build-diamond', address: { fixtureSemanticKeys: PRISM_INNER }, fixture: { targetPoints: PRISM_DIAMOND, targetMode: 'fixed', fanSpread: 52 } },
      { id: 'prism-build-crown', address: { groupSemanticKeys: ['prism-upper-inner'] }, fixture: { enabled: true, targetPoints: PRISM_CROWN, targetMode: 'fixed', fanSpread: 66 } },
      { id: 'prism-build-tight-cage', address: { fixtureSemanticKeys: [...PRISM_INNER, ...PRISM_ACCENTS] }, fixture: { enabled: true, targetPoints: PRISM_CAGE, targetMode: 'fixed', fanSpread: 76 } },
    ],
    modulations: [
      { source: 'sectionProgress', target: 'fixture.fanSpread', amount: 34, min: 0, max: 34, mode: 'add', requiredCapability: 'Sections' },
      { source: 'sectionProgress', target: 'fixture.brightness', amount: 0.22, min: 0, max: 0.22, mode: 'add', requiredCapability: 'Sections' },
      { source: 'buildProgress', target: 'global.globalGlow', amount: 0.3, min: 0, max: 0.3, mode: 'add' },
    ],
  })
}

function prismPreDropScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('prism-pre-drop', 'Prism Cathedral · Pre-drop', section(['preDrop']), {
    global: { dimmer: 0.54, globalGlow: 0.92, beamPersistence: 0.12 },
    eightBarRecruitment: [
      enableGroup('prism-pre-drop-inner', 1, 'prism-upper-inner', { brightness: 0.82, color: MAGENTA, fanSpread: 14, targetMode: 'fixed', targetPoints: PRISM_DIAMOND.slice(0, 2), beamPriorityRole: 'heroImpact' }),
      enableGroup('prism-pre-drop-accent', 1, 'prism-center-accent', { brightness: 0.9, color: WHITE, fanSpread: 10, targetMode: 'fixed', targetPoints: PRISM_SPEARS.slice(0, 2), beamPriorityRole: 'heroImpact' }),
    ],
    beatMutations: alternatingBeatMutations('prism-pre-drop', ['prism-upper-inner-left', 'prism-center-accent-left'], ['prism-upper-inner-right', 'prism-center-accent-right'], { spreadA: 20, spreadB: 8, rotation: 3 }),
    barMutations: [
      { id: 'prism-pre-drop-narrower-left', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: [...PRISM_INNER, ...PRISM_ACCENTS] }, fixture: { targetPosition: { x: 9, y: 4 }, fanSpread: 12, rotation: -4 } },
      { id: 'prism-pre-drop-narrower-right', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: [...PRISM_INNER, ...PRISM_ACCENTS] }, fixture: { targetPoints: PRISM_SPEARS.slice().reverse(), fanSpread: 8, rotation: 4 } },
    ],
    fourBarVariations: [
      { id: 'prism-pre-drop-spire', address: { fixtureSemanticKeys: [...PRISM_INNER, ...PRISM_ACCENTS] }, fixture: { targetPoints: PRISM_SPEARS, targetMode: 'fixed', fanSpread: 12 } },
    ],
    sectionExitMutations: shortPredropBlackout('prism-pre-drop'),
  })
}

function prismDropScene(dropTwo: boolean): LaserDmxShowDirectorPerformanceScene {
  const suffix = dropTwo ? 'drop-2' : 'drop-1'
  const impact = impactMutations(`prism-${suffix}`, PRISM_INNER, PRISM_OUTER, PRISM_ACCENTS)
  return baseScene(`prism-${suffix}`, `Prism Cathedral · ${dropTwo ? 'Drop 2' : 'Drop 1'}`, section(['drop'], dropTwo ? { minOccurrence: 2 } : [1]), {
    global: { dimmer: 1, globalGlow: 1, beamPersistence: dropTwo ? 0.34 : 0.24, globalBeamWidth: dropTwo ? 1.2 : 1 },
    eightBarRecruitment: dropTwo ? [
      enableGroup('prism-drop2-upper-outer', 1, 'prism-upper-outer', { brightness: 1, color: CYAN, fanSpread: 82, targetMode: 'fixed', targetPoints: PRISM_X, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('prism-drop2-upper-inner', 1, 'prism-upper-inner', { brightness: 0.96, color: MAGENTA, fanSpread: 78, targetMode: 'fixed', targetPoints: PRISM_DIAMOND, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('prism-drop2-middle', 1, 'prism-middle-side', { brightness: 0.92, color: ICE, fanSpread: 84, targetMode: 'fixed', targetPoints: PRISM_CAGE, beamPriorityRole: 'detailLattice' }),
      enableGroup('prism-drop2-lower-inner', 1, 'prism-lower-inner', { brightness: 0.92, color: MAGENTA, fanSpread: 76, targetMode: 'fixed', targetPoints: PRISM_CROWN, beamPriorityRole: 'secondaryFan' }),
      enableGroup('prism-drop2-lower-outer', 1, 'prism-lower-outer', { brightness: 0.96, color: CYAN, fanSpread: 94, targetMode: 'fixed', targetPoints: PRISM_X.slice().reverse(), beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('prism-drop2-accent', 1, 'prism-center-accent', { brightness: 1, color: WHITE, fanSpread: 42, targetMode: 'fixed', targetPoints: PRISM_DIAMOND, beamPriorityRole: 'heroImpact' }),
      enableFixtures('prism-drop2-retarget-inner', 2, PRISM_INNER, { targetMode: 'fixed', targetPoints: PRISM_CAGE, fanSpread: 96, color: ICE }),
      enableFixtures('prism-drop2-retarget-outer', 3, PRISM_OUTER, { targetMode: 'fixed', targetPoints: PRISM_CROWN, fanSpread: 104, color: WHITE }, false),
    ] : [
      enableGroup('prism-drop1-upper-outer', 1, 'prism-upper-outer', { brightness: 0.96, color: CYAN, fanSpread: 74, targetMode: 'fixed', targetPoints: PRISM_X, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('prism-drop1-upper-inner', 1, 'prism-upper-inner', { brightness: 0.92, color: MAGENTA, fanSpread: 68, targetMode: 'fixed', targetPoints: PRISM_DIAMOND, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('prism-drop1-lower-inner', 1, 'prism-lower-inner', { brightness: 0.84, color: CYAN, fanSpread: 62, targetMode: 'fixed', targetPoints: PRISM_CROWN, beamPriorityRole: 'secondaryFan' }),
      enableGroup('prism-drop1-middle', 2, 'prism-middle-side', { brightness: 0.88, color: MAGENTA, fanSpread: 72, targetMode: 'fixed', targetPoints: PRISM_CAGE, beamPriorityRole: 'detailLattice' }),
      enableGroup('prism-drop1-lower-outer', 2, 'prism-lower-outer', { brightness: 0.9, color: CYAN, fanSpread: 82, targetMode: 'fixed', targetPoints: PRISM_X.slice().reverse(), beamPriorityRole: 'secondaryFan' }),
      enableGroup('prism-drop1-accent', 3, 'prism-center-accent', { brightness: 1, color: WHITE, fanSpread: 36, targetMode: 'fixed', targetPoints: PRISM_DIAMOND.slice(0, 4), beamPriorityRole: 'heroImpact' }),
    ],
    beatMutations: alternatingBeatMutations(`prism-${suffix}`, PRISM_LEFT, PRISM_RIGHT, { leftColor: CYAN, rightColor: MAGENTA, spreadA: dropTwo ? 102 : 84, spreadB: dropTwo ? 66 : 52, rotation: dropTwo ? 14 : 10 }),
    ...impact,
    barMutations: [
      { id: `prism-${suffix}-bar-forward`, intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: PRISM_LEFT }, fixture: { rotation: -18, beamTravel: { mode: 'grow', beatsPerTravel: 1, direction: 'forward' } } },
      { id: `prism-${suffix}-bar-reverse`, intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: PRISM_RIGHT }, fixture: { rotation: 18, beamTravel: { mode: 'grow', beatsPerTravel: 1, direction: 'reverse' } } },
    ],
    fourBarVariations: [
      { id: `prism-${suffix}-large-x-lattice`, address: { fixtureSemanticKeys: PRISM_OUTER }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: PRISM_X, fanSpread: dropTwo ? 100 : 82 } },
      { id: `prism-${suffix}-nested-diamond`, address: { fixtureSemanticKeys: PRISM_INNER }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: PRISM_DIAMOND, fanSpread: dropTwo ? 94 : 76 } },
      { id: `prism-${suffix}-mirrored-crown`, address: { fixtureSemanticKeys: [...PRISM_INNER, ...PRISM_ACCENTS] }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: PRISM_CROWN, fanSpread: dropTwo ? 104 : 86 } },
      { id: `prism-${suffix}-wide-cathedral-cage`, address: { fixtureSemanticKeys: [...PRISM_OUTER, 'prism-middle-side-left', 'prism-middle-side-right'] }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: PRISM_CAGE, fanSpread: dropTwo ? 112 : 92 } },
    ],
    sectionBodyMutations: [{
      id: `prism-${suffix}-optional-vocal-lavender`,
      conditions: [{ source: 'lyricActivity', operator: 'gt', value: 0.6, requiredCapability: 'Lyrics', minConfidence: 0.55 }],
      address: { fixtureSemanticKeys: PRISM_ACCENTS },
      fixture: { enabled: true, color: LAVENDER, brightness: 1 },
    }],
    modulations: [
      { source: 'nBass', target: 'fixture.brightness', amount: 0.22, min: 0, max: 0.22, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'nHigh', target: 'fixture.beamWidth', amount: 0.9, min: 0, max: 0.9, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'dropImpact', target: 'global.globalGlow', amount: 0.32, min: 0, max: 0.32, mode: 'add' },
      { source: 'spectralCentroid', target: 'fixture.beamWidth', amount: 0.55, min: 0, max: 0.55, mode: 'add' },
      { source: 'trackEnergy', target: 'fixture.fanSpread', amount: 10, min: 0, max: 10, mode: 'add', requiredCapability: 'Track Energy Curve' },
    ],
  })
}

function prismBreakdownScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('prism-breakdown', 'Prism Cathedral · Breakdown', section(['breakdown', 'bridge']), {
    global: { dimmer: 0.5, globalGlow: 0.58, beamPersistence: 0.58, backgroundFade: 0.72 },
    eightBarRecruitment: [
      enableFixtures('prism-breakdown-spears', 1, ['prism-upper-outer-left', 'prism-lower-outer-right'], { brightness: 0.62, color: WHITE, fanSpread: 8, targetMode: 'fixed', targetPoints: PRISM_SPEARS.slice(0, 2), beamTravel: { mode: 'scanner', beatsPerTravel: 8, direction: 'alternate' } }),
      enableFixtures('prism-breakdown-lavender', 2, ['prism-upper-inner-right', 'prism-lower-inner-left'], { brightness: 0.54, color: LAVENDER, fanSpread: 10, targetMode: 'fixed', targetPoints: PRISM_SPEARS.slice(2, 4), beamTravel: { mode: 'scanner', beatsPerTravel: 12, direction: 'alternate' } }),
    ],
    beatMutations: alternatingBeatMutations('prism-breakdown', ['prism-upper-outer-left', 'prism-lower-inner-left'], ['prism-upper-inner-right', 'prism-lower-outer-right'], { spreadA: 14, spreadB: 6, rotation: 2 }),
    barMutations: [
      { id: 'prism-breakdown-slow-drift-a', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: ['prism-upper-outer-left', 'prism-lower-outer-right'] }, fixture: { rotation: -4, targetPosition: { x: 7, y: 3 } } },
      { id: 'prism-breakdown-slow-drift-b', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: ['prism-upper-inner-right', 'prism-lower-inner-left'] }, fixture: { rotation: 4, targetPosition: { x: 11, y: 3 } } },
    ],
    fourBarVariations: [
      { id: 'prism-breakdown-white-spears', address: { fixtureSemanticKeys: ['prism-upper-outer-left', 'prism-lower-outer-right'] }, fixture: { targetPoints: PRISM_SPEARS.slice(0, 2), color: WHITE } },
      { id: 'prism-breakdown-lavender-spears', address: { fixtureSemanticKeys: ['prism-upper-inner-right', 'prism-lower-inner-left'] }, fixture: { enabled: true, targetPoints: PRISM_SPEARS.slice(2, 4), color: LAVENDER } },
      { id: 'prism-breakdown-single-diagonal', address: { fixtureSemanticKeys: ['prism-upper-outer-left'] }, fixture: { targetPoints: PRISM_SPEARS.slice(0, 1), brightness: 0.7 } },
      { id: 'prism-breakdown-opposing-diagonal', address: { fixtureSemanticKeys: ['prism-lower-outer-right'] }, fixture: { targetPoints: PRISM_SPEARS.slice(3, 4), brightness: 0.7 } },
    ],
  })
}

function prismOutroScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('prism-outro', 'Prism Cathedral · Outro', section(['outro']), {
    global: { dimmer: 0.5, globalGlow: 0.55, beamPersistence: 0.46 },
    eightBarRecruitment: [
      enableGroup('prism-outro-diamond', 1, 'prism-upper-inner', { brightness: 0.56, color: ICE, fanSpread: 20, targetMode: 'fixed', targetPoints: PRISM_DIAMOND.slice(0, 4) }),
      enableFixtures('prism-outro-final-pair', 2, ['prism-upper-inner-left', 'prism-upper-inner-right'], { brightness: 0.46, color: CYAN, fanSpread: 12, targetMode: 'fixed', targetPoints: PRISM_DIAMOND.slice(0, 2) }, false),
    ],
    beatMutations: alternatingBeatMutations('prism-outro', ['prism-upper-inner-left'], ['prism-upper-inner-right'], { spreadA: 24, spreadB: 10, rotation: 3 }),
    barMutations: [
      { id: 'prism-outro-bar-inward', intervalBars: 2, anchorBar: 0, address: { groupSemanticKeys: ['prism-upper-inner'] }, fixture: { rotation: -5, targetPoints: PRISM_DIAMOND.slice(0, 4) } },
      { id: 'prism-outro-bar-outward', intervalBars: 2, anchorBar: 1, address: { groupSemanticKeys: ['prism-upper-inner'] }, fixture: { rotation: 5, targetPoints: PRISM_SPEARS.slice(0, 4) } },
    ],
    fourBarVariations: [
      { id: 'prism-outro-small-diamond', address: { groupSemanticKeys: ['prism-upper-inner'] }, fixture: { targetPoints: PRISM_DIAMOND.slice(0, 4), targetMode: 'fixed' } },
      { id: 'prism-outro-frame', address: { groupSemanticKeys: ['prism-upper-inner'] }, fixture: { targetPoints: PRISM_CAGE.slice(0, 4), targetMode: 'fixed' } },
      { id: 'prism-outro-two-spears', address: { groupSemanticKeys: ['prism-upper-inner'] }, fixture: { targetPoints: PRISM_SPEARS.slice(0, 2), targetMode: 'fixed' } },
      { id: 'prism-outro-final-diamond', address: { groupSemanticKeys: ['prism-upper-inner'] }, fixture: { targetPoints: PRISM_DIAMOND.slice(0, 2), targetMode: 'fixed', brightness: 0.42 } },
    ],
  })
}

export function createPrismCathedralRig(createId: CreateId): LaserDmxShowDirectorState {
  return createRig('prism-cathedral', createId, 19, 12, PRISM_GROUPS, PRISM_FIXTURES)
}

export function createPrismCathedralProgram(): LaserDmxShowDirectorPerformanceProgram {
  const program: LaserDmxShowDirectorPerformanceProgram = {
    schemaVersion: 2,
    id: 'prism-cathedral',
    name: 'Prism Cathedral',
    description: 'A cyan-and-magenta mirrored cathedral that evolves through X lattices, nested diamonds, crowns, cages, sparse spears, and a larger second-drop return.',
    deterministicSeed: 0x50a17,
    fallbackOrder: ['verse', 'intro', 'breakdown'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    bankRoles: {
      'prism-kick-outer-wings': { fixtureSemanticKeys: PRISM_OUTER },
      'prism-kick-rest': { fixtureSemanticKeys: [...PRISM_INNER, 'prism-middle-side-left', 'prism-middle-side-right', ...PRISM_ACCENTS] },
      'prism-snare-inner-x': { fixtureSemanticKeys: PRISM_INNER },
      'prism-snare-rest': { fixtureSemanticKeys: [...PRISM_OUTER, 'prism-middle-side-left', 'prism-middle-side-right', ...PRISM_ACCENTS] },
      'prism-hat-upper-detail': { fixtureSemanticKeys: ['prism-upper-outer-left', 'prism-upper-outer-right', 'prism-upper-inner-left', 'prism-upper-inner-right'] },
      'prism-hat-rest': { fixtureSemanticKeys: ['prism-middle-side-left', 'prism-middle-side-right', 'prism-lower-inner-left', 'prism-lower-inner-right', 'prism-lower-outer-left', 'prism-lower-outer-right', ...PRISM_ACCENTS] },
      'prism-center-impact': { groupSemanticKeys: ['prism-center-accent'] },
      'prism-center-impact-rest': { fixtureSemanticKeys: [...PRISM_OUTER, ...PRISM_INNER, 'prism-middle-side-left', 'prism-middle-side-right'] },
      'prism-bass-width': { fixtureSemanticKeys: PRISM_OUTER },
    },
    diagnostics: {
      authoringVersion: 'showcase-04-beat-banks',
      expectedFixtureSemanticKeys: PRISM_FIXTURES.map(fixture => fixture.key),
      expectedGroupSemanticKeys: PRISM_GROUPS.map(group => group.key),
      notes: ['Twelve mirrored laser fixtures', 'Native Show Director and Beam Matrix only', 'Drop 2 keeps cathedral motifs while adding every fixture group'],
    },
    scenes: [
      prismIntroScene(),
      prismVerseScene(),
      prismBuildScene(),
      prismPreDropScene(),
      prismDropScene(false),
      prismBreakdownScene(),
      prismDropScene(true),
      prismOutroScene(),
    ],
  }
  const choreographed = applyPresetBankChoreography(program, {
    kickRole: 'prism-kick-outer-wings',
    kickRestRole: 'prism-kick-rest',
    snareRole: 'prism-snare-inner-x',
    snareRestRole: 'prism-snare-rest',
    hatRole: 'prism-hat-upper-detail',
    hatRestRole: 'prism-hat-rest',
    transientRole: 'prism-center-impact',
    transientRestRole: 'prism-center-impact-rest',
    bassRole: 'prism-bass-width',
    impactColor: CYAN,
    complementaryColor: LAVENDER,
    kickSpread: 92,
    snareSpread: 74,
    transientSpread: 34,
  })
  return authorPrismCathedralLocalGeometry(applyMotifFamilySequence(choreographed, PRISM_MOTIF_SEQUENCE), PRISM_FIXTURES)
}

// ── Cardinal Fan Reactor ─────────────────────────────────────────────────────

const CARDINAL_GROUPS: readonly GroupSpec[] = [
  { key: 'cardinal-top', label: 'Top Fan Pair' },
  { key: 'cardinal-bottom', label: 'Bottom Fan Pair' },
  { key: 'cardinal-left', label: 'Left Fan Pair' },
  { key: 'cardinal-right', label: 'Right Fan Pair' },
  { key: 'cardinal-upper-left', label: 'Upper-left Diagonal Pair' },
  { key: 'cardinal-upper-right', label: 'Upper-right Diagonal Pair' },
  { key: 'cardinal-lower-left', label: 'Lower-left Diagonal Pair' },
  { key: 'cardinal-lower-right', label: 'Lower-right Diagonal Pair' },
]

const CARDINAL_FIXTURES: readonly FixtureSpec[] = [
  { key: 'cardinal-top-primary', label: 'Top Primary', groupKey: 'cardinal-top', x: 9, y: 0, targetX: 9, targetY: 8, color: CYAN, rotation: 90, spread: 62 },
  { key: 'cardinal-top-paired', label: 'Top Paired', groupKey: 'cardinal-top', x: 10, y: 0, targetX: 8, targetY: 8, color: BLUE, rotation: 90, spread: 58 },
  { key: 'cardinal-bottom-primary', label: 'Bottom Primary', groupKey: 'cardinal-bottom', x: 9, y: 11, targetX: 9, targetY: 3, color: ORANGE, rotation: -90, spread: 62 },
  { key: 'cardinal-bottom-paired', label: 'Bottom Paired', groupKey: 'cardinal-bottom', x: 8, y: 11, targetX: 10, targetY: 3, color: RED, rotation: -90, spread: 58 },
  { key: 'cardinal-left-primary', label: 'Left Primary', groupKey: 'cardinal-left', x: 0, y: 5, targetX: 14, targetY: 5, color: BLUE, rotation: 0, spread: 66 },
  { key: 'cardinal-left-paired', label: 'Left Paired', groupKey: 'cardinal-left', x: 0, y: 6, targetX: 14, targetY: 6, color: VIOLET, rotation: 0, spread: 58 },
  { key: 'cardinal-right-primary', label: 'Right Primary', groupKey: 'cardinal-right', x: 18, y: 5, targetX: 4, targetY: 5, color: MAGENTA, rotation: 180, spread: 66 },
  { key: 'cardinal-right-paired', label: 'Right Paired', groupKey: 'cardinal-right', x: 18, y: 6, targetX: 4, targetY: 6, color: MAGENTA, rotation: 180, spread: 58 },
  { key: 'cardinal-upper-left-primary', label: 'Upper-left Diagonal', groupKey: 'cardinal-upper-left', x: 2, y: 1, targetX: 13, targetY: 9, color: CYAN, rotation: 40, spread: 56 },
  { key: 'cardinal-upper-right-primary', label: 'Upper-right Diagonal', groupKey: 'cardinal-upper-right', x: 16, y: 1, targetX: 5, targetY: 9, color: VIOLET, rotation: 140, spread: 56 },
  { key: 'cardinal-lower-left-primary', label: 'Lower-left Diagonal', groupKey: 'cardinal-lower-left', x: 2, y: 10, targetX: 13, targetY: 2, color: ORANGE, rotation: -40, spread: 56 },
  { key: 'cardinal-lower-right-primary', label: 'Lower-right Diagonal', groupKey: 'cardinal-lower-right', x: 16, y: 10, targetX: 5, targetY: 2, color: MAGENTA, rotation: 220, spread: 56 },
  { key: 'cardinal-upper-left-paired', label: 'Upper-left Interleave', groupKey: 'cardinal-upper-left', x: 3, y: 1, targetX: 12, targetY: 9, color: ICE, rotation: 42, spread: 52 },
  { key: 'cardinal-upper-right-paired', label: 'Upper-right Interleave', groupKey: 'cardinal-upper-right', x: 15, y: 1, targetX: 6, targetY: 9, color: BLUE, rotation: 138, spread: 52 },
  { key: 'cardinal-lower-left-paired', label: 'Lower-left Interleave', groupKey: 'cardinal-lower-left', x: 3, y: 10, targetX: 12, targetY: 2, color: RED, rotation: -42, spread: 52 },
  { key: 'cardinal-lower-right-paired', label: 'Lower-right Interleave', groupKey: 'cardinal-lower-right', x: 15, y: 10, targetX: 6, targetY: 2, color: ORANGE, rotation: 222, spread: 52 },
]

const CARDINAL_HORIZONTAL = ['cardinal-left-primary', 'cardinal-left-paired', 'cardinal-right-primary', 'cardinal-right-paired']
const CARDINAL_VERTICAL = ['cardinal-top-primary', 'cardinal-top-paired', 'cardinal-bottom-primary', 'cardinal-bottom-paired']
const CARDINAL_LEFT_KEYS = CARDINAL_FIXTURES.filter(fixture => fixture.key.includes('left')).map(fixture => fixture.key)
const CARDINAL_RIGHT_KEYS = CARDINAL_FIXTURES.filter(fixture => fixture.key.includes('right')).map(fixture => fixture.key)
const CARDINAL_DIAGONALS = CARDINAL_FIXTURES.filter(fixture => fixture.key.includes('upper-') || fixture.key.includes('lower-')).map(fixture => fixture.key)
const CARDINAL_APERTURE = targetSet('cardinal-aperture', [[9, 2], [14, 4], [16, 6], [13, 9], [9, 10], [5, 9], [2, 6], [4, 3]])
const CARDINAL_INWARD = targetSet('cardinal-inward', [[7, 4], [9, 4], [11, 4], [12, 6], [11, 7], [9, 7], [7, 7], [6, 6]])
const CARDINAL_OUTWARD = targetSet('cardinal-outward', [[1, 1], [9, 0], [17, 1], [18, 6], [17, 10], [9, 11], [1, 10], [0, 5]])
const CARDINAL_CROSSED = targetSet('cardinal-crossed', [[16, 10], [14, 8], [12, 6], [10, 4], [8, 4], [6, 6], [4, 8], [2, 10]])
const CARDINAL_SPEARS = targetSet('cardinal-spears', [[8, 4], [10, 4], [8, 7], [10, 7]])

function cardinalAxisVariations(prefix: string, intensity = 1) {
  return [
    { id: `${prefix}-left-right-axis`, address: { fixtureSemanticKeys: CARDINAL_HORIZONTAL }, fixture: { enabled: true, targetMode: 'fixed' as const, targetPoints: CARDINAL_OUTWARD, fanSpread: 70 * intensity } },
    { id: `${prefix}-top-bottom-axis`, address: { fixtureSemanticKeys: CARDINAL_VERTICAL }, fixture: { enabled: true, targetMode: 'fixed' as const, targetPoints: CARDINAL_INWARD, fanSpread: 74 * intensity } },
    { id: `${prefix}-diagonal-axis-one`, address: { groupSemanticKeys: ['cardinal-upper-left', 'cardinal-lower-right'] }, fixture: { enabled: true, targetMode: 'fixed' as const, targetPoints: CARDINAL_CROSSED, fanSpread: 76 * intensity } },
    { id: `${prefix}-diagonal-axis-two`, address: { groupSemanticKeys: ['cardinal-upper-right', 'cardinal-lower-left'] }, fixture: { enabled: true, targetMode: 'fixed' as const, targetPoints: CARDINAL_CROSSED.slice().reverse(), fanSpread: 76 * intensity } },
  ]
}

function cardinalIntroScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cardinal-intro', 'Cardinal Fan Reactor · Intro', section(['intro']), {
    global: { dimmer: 0.58, globalGlow: 0.64, beamPersistence: 0.36 },
    eightBarRecruitment: [
      enableGroup('cardinal-intro-horizontal', 1, 'cardinal-left', { brightness: 0.58, color: BLUE, fanSpread: 20, targetMode: 'fixed', targetPoints: CARDINAL_SPEARS.slice(0, 2) }),
      enableGroup('cardinal-intro-right', 1, 'cardinal-right', { brightness: 0.58, color: MAGENTA, fanSpread: 20, targetMode: 'fixed', targetPoints: CARDINAL_SPEARS.slice(2, 4) }),
      enableGroup('cardinal-intro-vertical', 2, 'cardinal-top', { brightness: 0.54, color: CYAN, fanSpread: 24, targetMode: 'fixed', targetPoints: CARDINAL_INWARD.slice(0, 4) }),
      enableGroup('cardinal-intro-bottom', 3, 'cardinal-bottom', { brightness: 0.5, color: ORANGE, fanSpread: 24, targetMode: 'fixed', targetPoints: CARDINAL_INWARD.slice(4, 8) }),
    ],
    beatMutations: alternatingBeatMutations('cardinal-intro', ['cardinal-left-primary', 'cardinal-left-paired'], ['cardinal-right-primary', 'cardinal-right-paired'], { spreadA: 34, spreadB: 14, rotation: 3 }),
    barMutations: [
      { id: 'cardinal-intro-target-step-a', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: CARDINAL_HORIZONTAL }, fixture: { targetPosition: { x: 9, y: 4 }, rotation: -5 } },
      { id: 'cardinal-intro-target-step-b', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: CARDINAL_HORIZONTAL }, fixture: { targetPosition: { x: 9, y: 7 }, rotation: 5 } },
    ],
    fourBarVariations: cardinalAxisVariations('cardinal-intro', 0.45),
  })
}

function cardinalVerseScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cardinal-verse', 'Cardinal Fan Reactor · Verse', section(['verse']), {
    global: { dimmer: 0.7, globalGlow: 0.72, beamPersistence: 0.3 },
    eightBarRecruitment: [
      enableGroup('cardinal-verse-left', 1, 'cardinal-left', { brightness: 0.68, color: BLUE, fanSpread: 38, targetMode: 'fixed', targetPoints: CARDINAL_INWARD }),
      enableGroup('cardinal-verse-right', 1, 'cardinal-right', { brightness: 0.68, color: MAGENTA, fanSpread: 38, targetMode: 'fixed', targetPoints: CARDINAL_INWARD.slice().reverse() }),
      enableGroup('cardinal-verse-top', 2, 'cardinal-top', { brightness: 0.66, color: CYAN, fanSpread: 46, targetMode: 'fixed', targetPoints: CARDINAL_APERTURE }),
      enableGroup('cardinal-verse-bottom', 3, 'cardinal-bottom', { brightness: 0.62, color: ORANGE, fanSpread: 46, targetMode: 'fixed', targetPoints: CARDINAL_APERTURE.slice().reverse() }),
    ],
    beatMutations: alternatingBeatMutations('cardinal-verse', CARDINAL_LEFT_KEYS, CARDINAL_RIGHT_KEYS, { spreadA: 58, spreadB: 34, rotation: 7 }),
    barMutations: [
      { id: 'cardinal-verse-open', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: [...CARDINAL_HORIZONTAL, ...CARDINAL_VERTICAL] }, fixture: { targetPoints: CARDINAL_OUTWARD, rotation: -10 } },
      { id: 'cardinal-verse-contract', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: [...CARDINAL_HORIZONTAL, ...CARDINAL_VERTICAL] }, fixture: { targetPoints: CARDINAL_INWARD, rotation: 10 } },
    ],
    fourBarVariations: cardinalAxisVariations('cardinal-verse', 0.7),
    modulations: [
      { source: 'nBass', target: 'fixture.fanSpread', amount: 18, min: 0, max: 18, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'delta', target: 'fixture.rotation', amount: 6, min: 0, max: 6, mode: 'add' },
    ],
  })
}

function cardinalBuildScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cardinal-build', 'Cardinal Fan Reactor · Build', section(['build']), {
    global: { dimmer: 0.8, globalGlow: 0.86, beamPersistence: 0.22 },
    eightBarRecruitment: [
      enableGroup('cardinal-build-left', 1, 'cardinal-left', { brightness: 0.76, color: BLUE, fanSpread: 46, targetMode: 'fixed', targetPoints: CARDINAL_OUTWARD }),
      enableGroup('cardinal-build-right', 1, 'cardinal-right', { brightness: 0.76, color: MAGENTA, fanSpread: 46, targetMode: 'fixed', targetPoints: CARDINAL_OUTWARD.slice().reverse() }),
      enableGroup('cardinal-build-top', 1, 'cardinal-top', { brightness: 0.72, color: CYAN, fanSpread: 42, targetMode: 'fixed', targetPoints: CARDINAL_APERTURE }),
      enableGroup('cardinal-build-bottom', 2, 'cardinal-bottom', { brightness: 0.8, color: ORANGE, fanSpread: 60, targetMode: 'fixed', targetPoints: CARDINAL_APERTURE.slice().reverse() }),
      enableGroup('cardinal-build-diagonal-a', 2, 'cardinal-upper-left', { brightness: 0.68, color: CYAN, fanSpread: 56, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED }),
      enableGroup('cardinal-build-diagonal-b', 3, 'cardinal-upper-right', { brightness: 0.68, color: VIOLET, fanSpread: 56, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED.slice().reverse() }),
    ],
    beatMutations: alternatingBeatMutations('cardinal-build', CARDINAL_LEFT_KEYS, CARDINAL_RIGHT_KEYS, { spreadA: 78, spreadB: 48, rotation: 9 }),
    barMutations: [
      { id: 'cardinal-build-bar-open', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: [...CARDINAL_HORIZONTAL, ...CARDINAL_VERTICAL] }, fixture: { targetPoints: CARDINAL_OUTWARD, rotation: -13 } },
      { id: 'cardinal-build-bar-close', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: [...CARDINAL_HORIZONTAL, ...CARDINAL_VERTICAL] }, fixture: { targetPoints: CARDINAL_INWARD, rotation: 13 } },
    ],
    fourBarVariations: cardinalAxisVariations('cardinal-build', 0.9),
    modulations: [
      { source: 'sectionProgress', target: 'fixture.fanSpread', amount: 42, min: 0, max: 42, mode: 'add', requiredCapability: 'Sections' },
      { source: 'sectionProgress', target: 'fixture.brightness', amount: 0.2, min: 0, max: 0.2, mode: 'add', requiredCapability: 'Sections' },
      { source: 'buildProgress', target: 'global.globalGlow', amount: 0.3, min: 0, max: 0.3, mode: 'add' },
    ],
  })
}

function cardinalPreDropScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cardinal-pre-drop', 'Cardinal Fan Reactor · Pre-drop', section(['preDrop']), {
    global: { dimmer: 0.5, globalGlow: 0.94, beamPersistence: 0.1 },
    eightBarRecruitment: [
      enableGroup('cardinal-pre-drop-top', 1, 'cardinal-top', { brightness: 0.86, color: CYAN, fanSpread: 12, targetMode: 'fixed', targetPoints: CARDINAL_SPEARS.slice(0, 2), beamPriorityRole: 'heroImpact' }),
      enableGroup('cardinal-pre-drop-bottom', 1, 'cardinal-bottom', { brightness: 0.86, color: RED, fanSpread: 12, targetMode: 'fixed', targetPoints: CARDINAL_SPEARS.slice(2, 4), beamPriorityRole: 'heroImpact' }),
    ],
    beatMutations: alternatingBeatMutations('cardinal-pre-drop', ['cardinal-top-primary', 'cardinal-top-paired'], ['cardinal-bottom-primary', 'cardinal-bottom-paired'], { spreadA: 20, spreadB: 8, rotation: 2 }),
    barMutations: [
      { id: 'cardinal-pre-drop-contract-top', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: CARDINAL_VERTICAL }, fixture: { targetPoints: CARDINAL_SPEARS, fanSpread: 10, rotation: -5 } },
      { id: 'cardinal-pre-drop-contract-bottom', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: CARDINAL_VERTICAL }, fixture: { targetPoints: CARDINAL_SPEARS.slice().reverse(), fanSpread: 7, rotation: 5 } },
    ],
    fourBarVariations: [{ id: 'cardinal-pre-drop-slit', address: { fixtureSemanticKeys: CARDINAL_VERTICAL }, fixture: { targetPoints: CARDINAL_SPEARS, targetMode: 'fixed', fanSpread: 8 } }],
    sectionExitMutations: shortPredropBlackout('cardinal-pre-drop'),
  })
}

function cardinalDropScene(dropTwo: boolean): LaserDmxShowDirectorPerformanceScene {
  const suffix = dropTwo ? 'drop-2' : 'drop-1'
  const allCardinal = [...CARDINAL_HORIZONTAL, ...CARDINAL_VERTICAL]
  return baseScene(`cardinal-${suffix}`, `Cardinal Fan Reactor · ${dropTwo ? 'Drop 2' : 'Drop 1'}`, section(['drop'], dropTwo ? { minOccurrence: 2 } : [1]), {
    global: { dimmer: 1, globalGlow: 1, beamPersistence: dropTwo ? 0.32 : 0.22, globalBeamWidth: dropTwo ? 1.18 : 1 },
    eightBarRecruitment: dropTwo ? [
      enableGroup('cardinal-drop2-top', 1, 'cardinal-top', { brightness: 1, color: CYAN, fanSpread: 86, targetMode: 'fixed', targetPoints: CARDINAL_OUTWARD, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cardinal-drop2-bottom', 1, 'cardinal-bottom', { brightness: 1, color: ORANGE, fanSpread: 86, targetMode: 'fixed', targetPoints: CARDINAL_OUTWARD.slice().reverse(), beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cardinal-drop2-left', 1, 'cardinal-left', { brightness: 0.98, color: VIOLET, fanSpread: 90, targetMode: 'fixed', targetPoints: CARDINAL_APERTURE, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cardinal-drop2-right', 1, 'cardinal-right', { brightness: 0.98, color: MAGENTA, fanSpread: 90, targetMode: 'fixed', targetPoints: CARDINAL_APERTURE.slice().reverse(), beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cardinal-drop2-ul', 1, 'cardinal-upper-left', { brightness: 0.9, color: CYAN, fanSpread: 78, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED, beamPriorityRole: 'secondaryFan' }),
      enableGroup('cardinal-drop2-ur', 1, 'cardinal-upper-right', { brightness: 0.9, color: VIOLET, fanSpread: 78, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED.slice().reverse(), beamPriorityRole: 'secondaryFan' }),
      enableGroup('cardinal-drop2-ll', 1, 'cardinal-lower-left', { brightness: 0.9, color: RED, fanSpread: 78, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED.slice().reverse(), beamPriorityRole: 'secondaryFan' }),
      enableGroup('cardinal-drop2-lr', 1, 'cardinal-lower-right', { brightness: 0.9, color: ORANGE, fanSpread: 78, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED, beamPriorityRole: 'secondaryFan' }),
      enableFixtures('cardinal-drop2-role-swap', 2, allCardinal, { targetPoints: CARDINAL_INWARD, fanSpread: 104, color: WHITE, beamPriorityRole: 'heroImpact' }),
      enableFixtures('cardinal-drop2-diagonal-rotate', 3, CARDINAL_DIAGONALS, { targetPoints: CARDINAL_OUTWARD, fanSpread: 112, rotation: 24 }, false),
    ] : [
      enableGroup('cardinal-drop1-top', 1, 'cardinal-top', { brightness: 0.96, color: CYAN, fanSpread: 74, targetMode: 'fixed', targetPoints: CARDINAL_OUTWARD, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cardinal-drop1-bottom', 1, 'cardinal-bottom', { brightness: 0.96, color: ORANGE, fanSpread: 74, targetMode: 'fixed', targetPoints: CARDINAL_OUTWARD.slice().reverse(), beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cardinal-drop1-left', 1, 'cardinal-left', { brightness: 0.94, color: VIOLET, fanSpread: 78, targetMode: 'fixed', targetPoints: CARDINAL_APERTURE, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cardinal-drop1-right', 1, 'cardinal-right', { brightness: 0.94, color: MAGENTA, fanSpread: 78, targetMode: 'fixed', targetPoints: CARDINAL_APERTURE.slice().reverse(), beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cardinal-drop1-ul', 2, 'cardinal-upper-left', { brightness: 0.82, color: CYAN, fanSpread: 68, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED, beamPriorityRole: 'secondaryFan' }),
      enableGroup('cardinal-drop1-lr', 2, 'cardinal-lower-right', { brightness: 0.82, color: MAGENTA, fanSpread: 68, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED.slice().reverse(), beamPriorityRole: 'secondaryFan' }),
      enableGroup('cardinal-drop1-remaining-diagonals', 3, 'cardinal-upper-right', { brightness: 0.8, color: VIOLET, fanSpread: 66, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED.slice().reverse(), beamPriorityRole: 'secondaryFan' }),
      enableGroup('cardinal-drop1-remaining-diagonals-2', 3, 'cardinal-lower-left', { brightness: 0.8, color: RED, fanSpread: 66, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED, beamPriorityRole: 'secondaryFan' }),
    ],
    beatMutations: [
      ...alternatingBeatMutations(`cardinal-${suffix}`, CARDINAL_LEFT_KEYS, CARDINAL_RIGHT_KEYS, { spreadA: dropTwo ? 110 : 90, spreadB: dropTwo ? 72 : 56, rotation: dropTwo ? 16 : 12 }),
      { id: `cardinal-${suffix}-beat-top-open`, beatDivision: 1, beatOffsets: [0, 2], address: { groupSemanticKeys: ['cardinal-top'] }, fixture: { brightness: 1, fanSpread: dropTwo ? 116 : 96 } },
      { id: `cardinal-${suffix}-beat-bottom-open`, beatDivision: 1, beatOffsets: [1, 3], address: { groupSemanticKeys: ['cardinal-bottom'] }, fixture: { brightness: 1, fanSpread: dropTwo ? 116 : 96 } },
    ],
    kickMutations: [{ id: `cardinal-${suffix}-kick-horizontal`, threshold: 0.42, address: { fixtureSemanticKeys: CARDINAL_HORIZONTAL }, fixture: { brightness: 1, color: WHITE, beamAppearance: { width: 2.2, glow: 1 }, beamPriorityRole: 'heroImpact' } }],
    snareMutations: [{ id: `cardinal-${suffix}-snare-vertical`, threshold: 0.42, address: { fixtureSemanticKeys: CARDINAL_VERTICAL }, fixture: { brightness: 1, color: WHITE, beamAppearance: { width: 2.2, glow: 1 }, beamPriorityRole: 'heroImpact' } }],
    transientMutations: [
      { id: `cardinal-${suffix}-all-four-impact`, threshold: 0.72, address: { fixtureSemanticKeys: allCardinal }, fixture: { brightness: 1, fanSpread: 120, beamAppearance: { width: 2.8, glow: 1 }, beamPriorityRole: 'heroImpact' } },
      {
        id: `cardinal-${suffix}-hat-diagonal-spark`, threshold: 0, probability: 0.7,
        conditions: [{ source: 'hat', operator: 'gte', value: 0.25, requiredCapability: 'Rhythm Events' }],
        address: { fixtureSemanticKeys: CARDINAL_DIAGONALS },
        fixture: { enabled: true, brightness: 0.9, color: WHITE, fanSpread: 34, beamPriorityRole: 'decorativeAccent' },
      },
    ],
    barMutations: [
      { id: `cardinal-${suffix}-rotate-clockwise`, intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: [...allCardinal, ...CARDINAL_DIAGONALS] }, fixture: { rotation: 18, beamTravel: { mode: 'pingPong', beatsPerTravel: 2, direction: 'forward' } } },
      { id: `cardinal-${suffix}-rotate-counter`, intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: [...allCardinal, ...CARDINAL_DIAGONALS] }, fixture: { rotation: -18, beamTravel: { mode: 'pingPong', beatsPerTravel: 2, direction: 'reverse' } } },
    ],
    fourBarVariations: [
      { id: `cardinal-${suffix}-outward-fans`, address: { fixtureSemanticKeys: allCardinal }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: CARDINAL_OUTWARD, fanSpread: dropTwo ? 108 : 88 } },
      { id: `cardinal-${suffix}-inward-fans`, address: { fixtureSemanticKeys: allCardinal }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: CARDINAL_INWARD, fanSpread: dropTwo ? 100 : 82 } },
      { id: `cardinal-${suffix}-crossed-banks`, address: { fixtureSemanticKeys: [...allCardinal, ...CARDINAL_DIAGONALS] }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: CARDINAL_CROSSED, fanSpread: dropTwo ? 112 : 92 } },
      { id: `cardinal-${suffix}-four-way-aperture`, address: { fixtureSemanticKeys: allCardinal }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: CARDINAL_APERTURE, fanSpread: dropTwo ? 118 : 96 } },
    ],
    sectionBodyMutations: [
      {
        id: `cardinal-${suffix}-optional-drum-stem-diagonals`, probability: 0.8,
        conditions: [{ source: 'drumEnergy', operator: 'gt', value: 0.65, requiredCapability: 'Stem Curves', minConfidence: 0.55 }],
        address: { fixtureSemanticKeys: CARDINAL_DIAGONALS },
        fixture: { enabled: true, brightness: 1, color: WHITE },
      },
      {
        id: `cardinal-${suffix}-fakeout-collapse`, probability: 0.85,
        conditions: [{ source: 'isFakeout', operator: 'truthy', minConfidence: 0.5 }],
        address: { fixtureKinds: ['laser'] },
        fixture: { brightness: 0.42, fanSpread: 18, focus: 1 },
      },
      {
        id: `cardinal-${suffix}-aggressive-warm-quadrants`, probability: 0.75,
        conditions: [{ source: 'isAggressive', operator: 'truthy', minConfidence: 0.35 }],
        address: { groupSemanticKeys: ['cardinal-right', 'cardinal-bottom'] },
        fixture: { color: RED, beamAppearance: { glow: 1 } },
      },
    ],
    modulations: [
      { source: 'nBass', target: 'fixture.fanSpread', amount: 28, min: 0, max: 28, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'nHigh', target: 'fixture.beamWidth', amount: 0.8, min: 0, max: 0.8, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'dropImpact', target: 'global.globalGlow', amount: 0.34, min: 0, max: 0.34, mode: 'add' },
      { source: 'spectralFlux', target: 'fixture.fanSpread', amount: 12, min: 0, max: 12, mode: 'add' },
      { source: 'spectralCentroid', target: 'fixture.beamWidth', amount: 0.65, min: 0, max: 0.65, mode: 'add' },
      { source: 'trackEnergy', target: 'fixture.brightness', amount: 0.14, min: 0, max: 0.14, mode: 'add', requiredCapability: 'Track Energy Curve' },
    ],
  })
}

function cardinalBreakdownScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cardinal-breakdown', 'Cardinal Fan Reactor · Breakdown', section(['breakdown', 'bridge']), {
    global: { dimmer: 0.48, globalGlow: 0.56, beamPersistence: 0.62, backgroundFade: 0.74 },
    eightBarRecruitment: [
      enableGroup('cardinal-breakdown-top', 1, 'cardinal-top', { brightness: 0.58, color: ICE, fanSpread: 12, targetMode: 'fixed', targetPoints: CARDINAL_SPEARS.slice(0, 2), beamTravel: { mode: 'scanner', beatsPerTravel: 10, direction: 'alternate' } }),
      enableGroup('cardinal-breakdown-bottom', 1, 'cardinal-bottom', { brightness: 0.58, color: LAVENDER, fanSpread: 12, targetMode: 'fixed', targetPoints: CARDINAL_SPEARS.slice(2, 4), beamTravel: { mode: 'scanner', beatsPerTravel: 10, direction: 'alternate' } }),
      enableFixtures('cardinal-breakdown-side-spears', 2, ['cardinal-left-primary', 'cardinal-right-primary'], { brightness: 0.48, color: WHITE, fanSpread: 6, targetMode: 'fixed', targetPoints: CARDINAL_INWARD.slice(0, 2) }),
    ],
    beatMutations: alternatingBeatMutations('cardinal-breakdown', ['cardinal-top-primary', 'cardinal-left-primary'], ['cardinal-bottom-primary', 'cardinal-right-primary'], { spreadA: 16, spreadB: 6, rotation: 2 }),
    barMutations: [
      { id: 'cardinal-breakdown-opposition-a', intervalBars: 2, anchorBar: 0, address: { groupSemanticKeys: ['cardinal-top'] }, fixture: { targetPosition: { x: 8, y: 5 }, rotation: -3 } },
      { id: 'cardinal-breakdown-opposition-b', intervalBars: 2, anchorBar: 1, address: { groupSemanticKeys: ['cardinal-bottom'] }, fixture: { targetPosition: { x: 10, y: 6 }, rotation: 3 } },
    ],
    fourBarVariations: [
      { id: 'cardinal-breakdown-top-bottom', address: { fixtureSemanticKeys: CARDINAL_VERTICAL }, fixture: { targetPoints: CARDINAL_SPEARS, targetMode: 'fixed' } },
      { id: 'cardinal-breakdown-side-spears', address: { fixtureSemanticKeys: ['cardinal-left-primary', 'cardinal-right-primary'] }, fixture: { enabled: true, targetPoints: CARDINAL_INWARD.slice(0, 2), color: WHITE } },
      { id: 'cardinal-breakdown-single-top', address: { fixtureSemanticKeys: ['cardinal-top-primary'] }, fixture: { targetPoints: CARDINAL_SPEARS.slice(0, 1), brightness: 0.68 } },
      { id: 'cardinal-breakdown-single-bottom', address: { fixtureSemanticKeys: ['cardinal-bottom-primary'] }, fixture: { targetPoints: CARDINAL_SPEARS.slice(3, 4), brightness: 0.68 } },
    ],
  })
}

function cardinalOutroScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cardinal-outro', 'Cardinal Fan Reactor · Outro', section(['outro']), {
    global: { dimmer: 0.48, globalGlow: 0.52, beamPersistence: 0.5 },
    eightBarRecruitment: [
      enableFixtures('cardinal-outro-four', 1, ['cardinal-top-primary', 'cardinal-bottom-primary', 'cardinal-left-primary', 'cardinal-right-primary'], { brightness: 0.52, color: ICE, fanSpread: 24, targetMode: 'fixed', targetPoints: CARDINAL_INWARD }),
      enableFixtures('cardinal-outro-two', 2, ['cardinal-left-primary', 'cardinal-right-primary'], { brightness: 0.42, color: VIOLET, fanSpread: 14, targetMode: 'fixed', targetPoints: CARDINAL_SPEARS.slice(0, 2) }, false),
    ],
    beatMutations: alternatingBeatMutations('cardinal-outro', ['cardinal-left-primary', 'cardinal-top-primary'], ['cardinal-right-primary', 'cardinal-bottom-primary'], { spreadA: 30, spreadB: 12, rotation: 3 }),
    barMutations: [
      { id: 'cardinal-outro-bar-contract', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: [...CARDINAL_HORIZONTAL, ...CARDINAL_VERTICAL] }, fixture: { rotation: -6, targetPoints: CARDINAL_INWARD } },
      { id: 'cardinal-outro-bar-release', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: [...CARDINAL_HORIZONTAL, ...CARDINAL_VERTICAL] }, fixture: { rotation: 6, targetPoints: CARDINAL_APERTURE } },
    ],
    fourBarVariations: [
      { id: 'cardinal-outro-eight-to-four', address: { fixtureSemanticKeys: [...CARDINAL_HORIZONTAL, ...CARDINAL_VERTICAL] }, fixture: { targetPoints: CARDINAL_APERTURE, targetMode: 'fixed' } },
      { id: 'cardinal-outro-four', address: { fixtureSemanticKeys: ['cardinal-top-primary', 'cardinal-bottom-primary', 'cardinal-left-primary', 'cardinal-right-primary'] }, fixture: { targetPoints: CARDINAL_INWARD, targetMode: 'fixed' } },
      { id: 'cardinal-outro-opposing-two', address: { fixtureSemanticKeys: ['cardinal-left-primary', 'cardinal-right-primary'] }, fixture: { targetPoints: CARDINAL_SPEARS.slice(0, 2), targetMode: 'fixed' } },
      { id: 'cardinal-outro-final-slit', address: { fixtureSemanticKeys: ['cardinal-top-primary', 'cardinal-bottom-primary'] }, fixture: { targetPoints: CARDINAL_SPEARS.slice(1, 3), targetMode: 'fixed', brightness: 0.38 } },
    ],
  })
}

export function createCardinalFanReactorRig(createId: CreateId): LaserDmxShowDirectorState {
  return createRig('cardinal-fan-reactor', createId, 19, 12, CARDINAL_GROUPS, CARDINAL_FIXTURES)
}

export function createCardinalFanReactorProgram(): LaserDmxShowDirectorPerformanceProgram {
  const program: LaserDmxShowDirectorPerformanceProgram = {
    schemaVersion: 2,
    id: 'cardinal-fan-reactor',
    name: 'Cardinal Fan Reactor',
    description: 'Opposing cardinal and diagonal fan banks rotate, inhale, exhale, cross, and explode into a multicolor radial second drop.',
    deterministicSeed: 0xca4d1,
    fallbackOrder: ['verse', 'intro', 'breakdown'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    bankRoles: {
      'cardinal-horizontal': { groupSemanticKeys: ['cardinal-left', 'cardinal-right'] },
      'cardinal-horizontal-rest': { groupSemanticKeys: ['cardinal-top', 'cardinal-bottom', 'cardinal-upper-left', 'cardinal-upper-right', 'cardinal-lower-left', 'cardinal-lower-right'] },
      'cardinal-vertical': { groupSemanticKeys: ['cardinal-top', 'cardinal-bottom'] },
      'cardinal-vertical-rest': { groupSemanticKeys: ['cardinal-left', 'cardinal-right', 'cardinal-upper-left', 'cardinal-upper-right', 'cardinal-lower-left', 'cardinal-lower-right'] },
      'cardinal-diagonals': { groupSemanticKeys: ['cardinal-upper-left', 'cardinal-upper-right', 'cardinal-lower-left', 'cardinal-lower-right'] },
      'cardinal-diagonal-rest': { groupSemanticKeys: ['cardinal-top', 'cardinal-bottom', 'cardinal-left', 'cardinal-right'] },
      'cardinal-all-four': { groupSemanticKeys: ['cardinal-top', 'cardinal-bottom', 'cardinal-left', 'cardinal-right'] },
      'cardinal-all-four-rest': { groupSemanticKeys: ['cardinal-upper-left', 'cardinal-upper-right', 'cardinal-lower-left', 'cardinal-lower-right'] },
      'cardinal-bass-aperture': { groupSemanticKeys: ['cardinal-top', 'cardinal-bottom', 'cardinal-left', 'cardinal-right'] },
    },
    diagnostics: {
      authoringVersion: 'showcase-04-beat-banks',
      expectedFixtureSemanticKeys: CARDINAL_FIXTURES.map(fixture => fixture.key),
      expectedGroupSemanticKeys: CARDINAL_GROUPS.map(group => group.key),
      notes: ['Sixteen near-co-located cardinal and diagonal fan fixtures', 'Kick favors horizontal banks; snare favors vertical banks', 'Drop 2 activates all eight origins'],
    },
    scenes: [
      cardinalIntroScene(),
      cardinalVerseScene(),
      cardinalBuildScene(),
      cardinalPreDropScene(),
      cardinalDropScene(false),
      cardinalBreakdownScene(),
      cardinalDropScene(true),
      cardinalOutroScene(),
    ],
  }
  const choreographed = applyPresetBankChoreography(program, {
    kickRole: 'cardinal-horizontal',
    kickRestRole: 'cardinal-horizontal-rest',
    snareRole: 'cardinal-vertical',
    snareRestRole: 'cardinal-vertical-rest',
    hatRole: 'cardinal-diagonals',
    hatRestRole: 'cardinal-diagonal-rest',
    transientRole: 'cardinal-all-four',
    transientRestRole: 'cardinal-all-four-rest',
    bassRole: 'cardinal-bass-aperture',
    impactColor: ORANGE,
    complementaryColor: WHITE,
    kickSpread: 104,
    snareSpread: 104,
    transientSpread: 120,
    deterministicFakeout: true,
  })
  return authorCardinalFanReactorLocalGeometry(applyMotifFamilySequence(choreographed, CARDINAL_MOTIF_SEQUENCE), CARDINAL_FIXTURES)
}

// ── Cyan Mirror Cage ─────────────────────────────────────────────────────────

const CAGE_GROUPS: readonly GroupSpec[] = [
  { key: 'cage-upper-outer', label: 'Upper Outer Pair' },
  { key: 'cage-upper-inner', label: 'Upper Inner Pair' },
  { key: 'cage-middle-outer', label: 'Middle Outer Pair' },
  { key: 'cage-middle-inner', label: 'Middle Inner Pair' },
  { key: 'cage-lower-outer', label: 'Lower Outer Pair' },
  { key: 'cage-lower-inner', label: 'Lower Inner Pair' },
  { key: 'cage-corner-upper', label: 'Upper Corner Accents' },
  { key: 'cage-corner-lower', label: 'Lower Corner Accents' },
]

const CAGE_FIXTURES: readonly FixtureSpec[] = [
  { key: 'cage-upper-left-outer', label: 'Upper Left Outer', groupKey: 'cage-upper-outer', x: 1, y: 1, targetX: 14, targetY: 9, color: ICE, rotation: 38, spread: 56 },
  { key: 'cage-upper-left-inner', label: 'Upper Left Inner', groupKey: 'cage-upper-inner', x: 5, y: 2, targetX: 11, targetY: 8, color: CYAN, rotation: 48, spread: 50 },
  { key: 'cage-upper-right-inner', label: 'Upper Right Inner', groupKey: 'cage-upper-inner', x: 13, y: 2, targetX: 7, targetY: 8, color: CYAN, rotation: 132, spread: 50 },
  { key: 'cage-upper-right-outer', label: 'Upper Right Outer', groupKey: 'cage-upper-outer', x: 17, y: 1, targetX: 4, targetY: 9, color: ICE, rotation: 142, spread: 56 },
  { key: 'cage-middle-left-outer', label: 'Middle Left Outer', groupKey: 'cage-middle-outer', x: 0, y: 5, targetX: 13, targetY: 5, color: CYAN, rotation: 0, spread: 52 },
  { key: 'cage-middle-left-inner', label: 'Middle Left Inner', groupKey: 'cage-middle-inner', x: 4, y: 5, targetX: 8, targetY: 4, color: ICE, rotation: -12, spread: 42 },
  { key: 'cage-middle-right-inner', label: 'Middle Right Inner', groupKey: 'cage-middle-inner', x: 14, y: 5, targetX: 10, targetY: 4, color: ICE, rotation: 192, spread: 42 },
  { key: 'cage-middle-right-outer', label: 'Middle Right Outer', groupKey: 'cage-middle-outer', x: 18, y: 5, targetX: 5, targetY: 5, color: CYAN, rotation: 180, spread: 52 },
  { key: 'cage-lower-left-outer', label: 'Lower Left Outer', groupKey: 'cage-lower-outer', x: 1, y: 10, targetX: 14, targetY: 2, color: ICE, rotation: -38, spread: 60 },
  { key: 'cage-lower-left-inner', label: 'Lower Left Inner', groupKey: 'cage-lower-inner', x: 5, y: 9, targetX: 11, targetY: 3, color: CYAN, rotation: -48, spread: 50 },
  { key: 'cage-lower-right-inner', label: 'Lower Right Inner', groupKey: 'cage-lower-inner', x: 13, y: 9, targetX: 7, targetY: 3, color: CYAN, rotation: 228, spread: 50 },
  { key: 'cage-lower-right-outer', label: 'Lower Right Outer', groupKey: 'cage-lower-outer', x: 17, y: 10, targetX: 4, targetY: 2, color: ICE, rotation: 218, spread: 60 },
  { key: 'cage-corner-upper-left', label: 'Upper Left Accent', groupKey: 'cage-corner-upper', x: 3, y: 0, targetX: 12, targetY: 10, color: WHITE, rotation: 46, spread: 30 },
  { key: 'cage-corner-upper-right', label: 'Upper Right Accent', groupKey: 'cage-corner-upper', x: 15, y: 0, targetX: 6, targetY: 10, color: LAVENDER, rotation: 134, spread: 30 },
  { key: 'cage-corner-lower-left', label: 'Lower Left Accent', groupKey: 'cage-corner-lower', x: 3, y: 11, targetX: 12, targetY: 1, color: WHITE, rotation: -46, spread: 30 },
  { key: 'cage-corner-lower-right', label: 'Lower Right Accent', groupKey: 'cage-corner-lower', x: 15, y: 11, targetX: 6, targetY: 1, color: LAVENDER, rotation: 226, spread: 30 },
]

const CAGE_LEFT = CAGE_FIXTURES.filter(fixture => fixture.key.includes('-left-')).map(fixture => fixture.key)
const CAGE_RIGHT = CAGE_FIXTURES.filter(fixture => fixture.key.includes('-right-')).map(fixture => fixture.key)
const CAGE_OUTER = CAGE_FIXTURES.filter(fixture => fixture.key.includes('-outer')).map(fixture => fixture.key)
const CAGE_INNER = CAGE_FIXTURES.filter(fixture => fixture.key.includes('-inner')).map(fixture => fixture.key)
const CAGE_UPPER = CAGE_FIXTURES.filter(fixture => fixture.key.includes('upper')).map(fixture => fixture.key)
const CAGE_MIDDLE = CAGE_FIXTURES.filter(fixture => fixture.key.includes('middle')).map(fixture => fixture.key)
const CAGE_LOWER = CAGE_FIXTURES.filter(fixture => fixture.key.includes('lower')).map(fixture => fixture.key)
const CAGE_ACCENTS = CAGE_FIXTURES.filter(fixture => fixture.key.includes('corner')).map(fixture => fixture.key)

// Keep x=9 intentionally absent from most endpoint sets so the preset retains its dark central corridor.
const CAGE_WIDE = targetSet('cage-wide', [[2, 1], [6, 3], [8, 5], [7, 8], [11, 8], [10, 5], [12, 3], [16, 1]])
const CAGE_DIAMOND = targetSet('cage-diamond', [[8, 2], [11, 3], [13, 5], [11, 8], [10, 9], [7, 8], [5, 5], [7, 3]])
const CAGE_DOUBLE_X = targetSet('cage-double-x', [[16, 10], [13, 8], [10, 6], [6, 2], [2, 10], [5, 8], [8, 6], [12, 2]])
const CAGE_WINGS = targetSet('cage-wings', [[0, 2], [4, 4], [6, 6], [3, 9], [15, 9], [12, 6], [14, 4], [18, 2]])
const CAGE_SPEARS = targetSet('cage-spears', [[5, 1], [7, 2], [11, 2], [13, 1]])
const CAGE_CHEVRONS = targetSet('cage-chevrons', [[5, 4], [7, 5], [5, 6], [7, 7], [13, 4], [11, 5], [13, 6], [11, 7]])

function cageIntroScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cage-intro', 'Cyan Mirror Cage · Intro', section(['intro']), {
    global: { dimmer: 0.54, globalGlow: 0.58, beamPersistence: 0.52, backgroundFade: 0.7 },
    eightBarRecruitment: [
      enableFixtures('cage-intro-outer-spears', 1, ['cage-upper-left-outer', 'cage-lower-right-outer'], { brightness: 0.56, color: WHITE, fanSpread: 8, targetMode: 'fixed', targetPoints: CAGE_SPEARS.slice(0, 2), beamTravel: { mode: 'grow', beatsPerTravel: 4, direction: 'alternate' } }),
      enableGroup('cage-intro-upper-inner', 2, 'cage-upper-inner', { brightness: 0.58, color: ICE, fanSpread: 18, targetMode: 'fixed', targetPoints: CAGE_CHEVRONS.slice(0, 4) }),
      enableGroup('cage-intro-lower-inner', 3, 'cage-lower-inner', { brightness: 0.54, color: CYAN, fanSpread: 18, targetMode: 'fixed', targetPoints: CAGE_CHEVRONS.slice(4, 8) }),
    ],
    beatMutations: alternatingBeatMutations('cage-intro', CAGE_LEFT.slice(0, 2), CAGE_RIGHT.slice(0, 2), { spreadA: 22, spreadB: 6, rotation: 3 }),
    barMutations: [
      { id: 'cage-intro-distance-long', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: CAGE_OUTER }, fixture: { targetPoints: CAGE_SPEARS, rotation: -4 } },
      { id: 'cage-intro-distance-short', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: CAGE_INNER }, fixture: { targetPoints: CAGE_CHEVRONS, rotation: 4 } },
    ],
    fourBarVariations: [
      { id: 'cage-intro-outer-diagonals', address: { fixtureSemanticKeys: CAGE_OUTER }, fixture: { enabled: true, targetPoints: CAGE_SPEARS, targetMode: 'fixed' } },
      { id: 'cage-intro-inner-diagonals', address: { fixtureSemanticKeys: CAGE_INNER }, fixture: { enabled: true, targetPoints: CAGE_SPEARS.slice().reverse(), targetMode: 'fixed' } },
      { id: 'cage-intro-short-chevrons', address: { fixtureSemanticKeys: CAGE_INNER }, fixture: { enabled: true, targetPoints: CAGE_CHEVRONS, targetMode: 'fixed', fanSpread: 18 } },
      { id: 'cage-intro-long-spears', address: { fixtureSemanticKeys: CAGE_OUTER }, fixture: { enabled: true, targetPoints: CAGE_DOUBLE_X, targetMode: 'fixed', fanSpread: 22 } },
    ],
  })
}

function cageVerseScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cage-verse', 'Cyan Mirror Cage · Verse', section(['verse']), {
    global: { dimmer: 0.68, globalGlow: 0.7, beamPersistence: 0.36 },
    eightBarRecruitment: [
      enableGroup('cage-verse-upper-outer', 1, 'cage-upper-outer', { brightness: 0.64, color: ICE, fanSpread: 28, targetMode: 'fixed', targetPoints: CAGE_WIDE }),
      enableGroup('cage-verse-lower-outer', 1, 'cage-lower-outer', { brightness: 0.62, color: CYAN, fanSpread: 28, targetMode: 'fixed', targetPoints: CAGE_WIDE.slice().reverse() }),
      enableGroup('cage-verse-middle-inner', 2, 'cage-middle-inner', { brightness: 0.66, color: CYAN, fanSpread: 34, targetMode: 'fixed', targetPoints: CAGE_CHEVRONS }),
      enableGroup('cage-verse-upper-inner', 3, 'cage-upper-inner', { brightness: 0.62, color: ICE, fanSpread: 32, targetMode: 'fixed', targetPoints: CAGE_DIAMOND }),
    ],
    beatMutations: alternatingBeatMutations('cage-verse', CAGE_LEFT, CAGE_RIGHT, { spreadA: 52, spreadB: 28, rotation: 7 }),
    barMutations: [
      { id: 'cage-verse-inward', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: [...CAGE_INNER, ...CAGE_OUTER] }, fixture: { targetPoints: CAGE_CHEVRONS, rotation: -10 } },
      { id: 'cage-verse-outward', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: [...CAGE_INNER, ...CAGE_OUTER] }, fixture: { targetPoints: CAGE_WINGS, rotation: 10 } },
    ],
    fourBarVariations: [
      { id: 'cage-verse-outer-diagonals', address: { fixtureSemanticKeys: CAGE_OUTER }, fixture: { targetPoints: CAGE_WIDE, targetMode: 'fixed' } },
      { id: 'cage-verse-inner-diagonals', address: { fixtureSemanticKeys: CAGE_INNER }, fixture: { targetPoints: CAGE_DIAMOND, targetMode: 'fixed' } },
      { id: 'cage-verse-short-chevrons', address: { fixtureSemanticKeys: CAGE_MIDDLE }, fixture: { enabled: true, targetPoints: CAGE_CHEVRONS, targetMode: 'fixed' } },
      { id: 'cage-verse-long-opposing-spears', address: { fixtureSemanticKeys: CAGE_OUTER }, fixture: { targetPoints: CAGE_DOUBLE_X, targetMode: 'fixed', fanSpread: 62 } },
    ],
    modulations: [
      { source: 'nBass', target: 'fixture.brightness', amount: 0.2, min: 0, max: 0.2, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'transient', target: 'fixture.beamWidth', amount: 0.7, min: 0, max: 0.7, mode: 'add', requiredCapability: 'Rhythm Events' },
    ],
  })
}

function cageBuildScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cage-build', 'Cyan Mirror Cage · Build', section(['build']), {
    global: { dimmer: 0.78, globalGlow: 0.86, beamPersistence: 0.24 },
    eightBarRecruitment: [
      enableGroup('cage-build-upper', 1, 'cage-upper-outer', { brightness: 0.72, color: ICE, fanSpread: 38, targetMode: 'fixed', targetPoints: CAGE_WIDE }),
      enableGroup('cage-build-lower', 1, 'cage-lower-outer', { brightness: 0.7, color: CYAN, fanSpread: 38, targetMode: 'fixed', targetPoints: CAGE_WIDE.slice().reverse() }),
      enableGroup('cage-build-middle', 1, 'cage-middle-inner', { brightness: 0.72, color: CYAN, fanSpread: 42, targetMode: 'fixed', targetPoints: CAGE_DIAMOND }),
      enableGroup('cage-build-middle-outer', 2, 'cage-middle-outer', { brightness: 0.78, color: ICE, fanSpread: 62, targetMode: 'fixed', targetPoints: CAGE_DOUBLE_X }),
      enableGroup('cage-build-inner', 2, 'cage-upper-inner', { brightness: 0.8, color: CYAN, fanSpread: 58, targetMode: 'fixed', targetPoints: CAGE_DIAMOND }),
      enableGroup('cage-build-lower-inner', 3, 'cage-lower-inner', { brightness: 0.84, color: WHITE, fanSpread: 66, targetMode: 'fixed', targetPoints: CAGE_CHEVRONS, beamPriorityRole: 'heroImpact' }),
    ],
    beatMutations: alternatingBeatMutations('cage-build', CAGE_LEFT, CAGE_RIGHT, { spreadA: 78, spreadB: 44, rotation: 9 }),
    barMutations: [
      { id: 'cage-build-close-corridor', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: CAGE_INNER }, fixture: { targetPoints: CAGE_DIAMOND, fanSpread: 56, rotation: -8 } },
      { id: 'cage-build-open-corridor', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: CAGE_INNER }, fixture: { targetPoints: CAGE_CHEVRONS, fanSpread: 66, rotation: 8 } },
    ],
    fourBarVariations: [
      { id: 'cage-build-wide-frame', address: { fixtureSemanticKeys: CAGE_OUTER }, fixture: { targetPoints: CAGE_WIDE, targetMode: 'fixed' } },
      { id: 'cage-build-central-diamond', address: { fixtureSemanticKeys: CAGE_INNER }, fixture: { targetPoints: CAGE_DIAMOND, targetMode: 'fixed' } },
      { id: 'cage-build-double-x', address: { fixtureSemanticKeys: [...CAGE_OUTER, ...CAGE_MIDDLE] }, fixture: { enabled: true, targetPoints: CAGE_DOUBLE_X, targetMode: 'fixed' } },
      { id: 'cage-build-narrow-wings', address: { fixtureSemanticKeys: [...CAGE_INNER, ...CAGE_MIDDLE] }, fixture: { enabled: true, targetPoints: CAGE_CHEVRONS, targetMode: 'fixed', fanSpread: 72 } },
    ],
    modulations: [
      { source: 'sectionProgress', target: 'fixture.fanSpread', amount: 38, min: 0, max: 38, mode: 'add', requiredCapability: 'Sections' },
      { source: 'sectionProgress', target: 'fixture.brightness', amount: 0.22, min: 0, max: 0.22, mode: 'add', requiredCapability: 'Sections' },
      { source: 'buildProgress', target: 'global.globalGlow', amount: 0.3, min: 0, max: 0.3, mode: 'add' },
    ],
  })
}

function cagePreDropScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cage-pre-drop', 'Cyan Mirror Cage · Pre-drop', section(['preDrop']), {
    global: { dimmer: 0.5, globalGlow: 0.92, beamPersistence: 0.12 },
    eightBarRecruitment: [
      enableGroup('cage-pre-drop-middle-inner', 1, 'cage-middle-inner', { brightness: 0.82, color: CYAN, fanSpread: 14, targetMode: 'fixed', targetPoints: CAGE_CHEVRONS, beamPriorityRole: 'heroImpact' }),
      enableGroup('cage-pre-drop-upper-inner', 1, 'cage-upper-inner', { brightness: 0.74, color: ICE, fanSpread: 12, targetMode: 'fixed', targetPoints: CAGE_DIAMOND.slice(0, 4) }),
    ],
    beatMutations: alternatingBeatMutations('cage-pre-drop', ['cage-middle-left-inner', 'cage-upper-left-inner'], ['cage-middle-right-inner', 'cage-upper-right-inner'], { spreadA: 20, spreadB: 8, rotation: 2 }),
    barMutations: [
      { id: 'cage-pre-drop-restrain-inward', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: [...CAGE_INNER, ...CAGE_MIDDLE] }, fixture: { targetPoints: CAGE_CHEVRONS, fanSpread: 10, rotation: -4 } },
      { id: 'cage-pre-drop-restrain-outward', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: [...CAGE_INNER, ...CAGE_MIDDLE] }, fixture: { targetPoints: CAGE_DIAMOND.slice().reverse(), fanSpread: 8, rotation: 4 } },
    ],
    fourBarVariations: [{ id: 'cage-pre-drop-arrowheads', address: { fixtureSemanticKeys: [...CAGE_INNER, ...CAGE_MIDDLE] }, fixture: { targetPoints: CAGE_CHEVRONS, targetMode: 'fixed', fanSpread: 10 } }],
    sectionExitMutations: shortPredropBlackout('cage-pre-drop'),
  })
}

function cageDropScene(dropTwo: boolean): LaserDmxShowDirectorPerformanceScene {
  const suffix = dropTwo ? 'drop-2' : 'drop-1'
  const impact = impactMutations(`cage-${suffix}`, [...CAGE_INNER, ...CAGE_MIDDLE], CAGE_OUTER, CAGE_ACCENTS)
  return baseScene(`cage-${suffix}`, `Cyan Mirror Cage · ${dropTwo ? 'Drop 2' : 'Drop 1'}`, section(['drop'], dropTwo ? { minOccurrence: 2 } : [1]), {
    global: { dimmer: 1, globalGlow: dropTwo ? 1 : 0.98, beamPersistence: dropTwo ? 0.34 : 0.24, globalBeamWidth: dropTwo ? 1.2 : 1 },
    eightBarRecruitment: dropTwo ? [
      enableGroup('cage-drop2-upper-outer', 1, 'cage-upper-outer', { brightness: 0.96, color: ICE, fanSpread: 84, targetMode: 'fixed', targetPoints: CAGE_WIDE, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cage-drop2-upper-inner', 1, 'cage-upper-inner', { brightness: 0.92, color: CYAN, fanSpread: 76, targetMode: 'fixed', targetPoints: CAGE_DIAMOND, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cage-drop2-middle-outer', 1, 'cage-middle-outer', { brightness: 0.94, color: ICE, fanSpread: 88, targetMode: 'fixed', targetPoints: CAGE_DOUBLE_X, beamPriorityRole: 'detailLattice' }),
      enableGroup('cage-drop2-middle-inner', 1, 'cage-middle-inner', { brightness: 0.96, color: CYAN, fanSpread: 72, targetMode: 'fixed', targetPoints: CAGE_CHEVRONS, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cage-drop2-lower-outer', 1, 'cage-lower-outer', { brightness: 0.94, color: ICE, fanSpread: 88, targetMode: 'fixed', targetPoints: CAGE_WIDE.slice().reverse(), beamPriorityRole: 'secondaryFan' }),
      enableGroup('cage-drop2-lower-inner', 1, 'cage-lower-inner', { brightness: 0.92, color: CYAN, fanSpread: 76, targetMode: 'fixed', targetPoints: CAGE_CHEVRONS.slice().reverse(), beamPriorityRole: 'secondaryFan' }),
      enableGroup('cage-drop2-corner-upper', 1, 'cage-corner-upper', { brightness: 1, color: WHITE, fanSpread: 46, targetMode: 'fixed', targetPoints: CAGE_DOUBLE_X, beamPriorityRole: 'heroImpact' }),
      enableGroup('cage-drop2-corner-lower', 1, 'cage-corner-lower', { brightness: 1, color: LAVENDER, fanSpread: 46, targetMode: 'fixed', targetPoints: CAGE_DOUBLE_X.slice().reverse(), beamPriorityRole: 'heroImpact' }),
      enableFixtures('cage-drop2-endpoint-alternate', 2, [...CAGE_INNER, ...CAGE_OUTER], { targetPoints: CAGE_WINGS, fanSpread: 104, color: WHITE }),
      enableFixtures('cage-drop2-full-rig-recovery', 3, [...CAGE_UPPER, ...CAGE_LOWER], { targetPoints: CAGE_DOUBLE_X, fanSpread: 112, color: CYAN }, false),
    ] : [
      enableGroup('cage-drop1-upper-outer', 1, 'cage-upper-outer', { brightness: 0.9, color: ICE, fanSpread: 70, targetMode: 'fixed', targetPoints: CAGE_WIDE, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cage-drop1-middle-inner', 1, 'cage-middle-inner', { brightness: 0.92, color: CYAN, fanSpread: 62, targetMode: 'fixed', targetPoints: CAGE_CHEVRONS, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cage-drop1-lower-outer', 1, 'cage-lower-outer', { brightness: 0.86, color: ICE, fanSpread: 70, targetMode: 'fixed', targetPoints: CAGE_WIDE.slice().reverse(), beamPriorityRole: 'secondaryFan' }),
      enableGroup('cage-drop1-upper-inner', 2, 'cage-upper-inner', { brightness: 0.88, color: CYAN, fanSpread: 68, targetMode: 'fixed', targetPoints: CAGE_DIAMOND, beamPriorityRole: 'primaryArchitecture' }),
      enableGroup('cage-drop1-middle-outer', 2, 'cage-middle-outer', { brightness: 0.84, color: ICE, fanSpread: 72, targetMode: 'fixed', targetPoints: CAGE_DOUBLE_X, beamPriorityRole: 'detailLattice' }),
      enableGroup('cage-drop1-lower-inner', 2, 'cage-lower-inner', { brightness: 0.84, color: CYAN, fanSpread: 64, targetMode: 'fixed', targetPoints: CAGE_CHEVRONS.slice().reverse(), beamPriorityRole: 'secondaryFan' }),
      enableGroup('cage-drop1-accents', 3, 'cage-corner-upper', { brightness: 1, color: WHITE, fanSpread: 38, targetMode: 'fixed', targetPoints: CAGE_DOUBLE_X, beamPriorityRole: 'heroImpact' }),
    ],
    beatMutations: alternatingBeatMutations(`cage-${suffix}`, CAGE_LEFT, CAGE_RIGHT, { leftColor: CYAN, rightColor: ICE, spreadA: dropTwo ? 106 : 86, spreadB: dropTwo ? 68 : 50, rotation: dropTwo ? 14 : 10 }),
    ...impact,
    barMutations: [
      { id: `cage-${suffix}-travel-inward`, intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: [...CAGE_INNER, ...CAGE_OUTER] }, fixture: { targetPoints: CAGE_DIAMOND, beamTravel: { mode: 'grow', beatsPerTravel: 1, direction: 'forward' }, rotation: -14 } },
      { id: `cage-${suffix}-travel-outward`, intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: [...CAGE_INNER, ...CAGE_OUTER] }, fixture: { targetPoints: CAGE_WINGS, beamTravel: { mode: 'grow', beatsPerTravel: 1, direction: 'reverse' }, rotation: 14 } },
    ],
    fourBarVariations: [
      { id: `cage-${suffix}-wide-mirrored-cage`, address: { fixtureSemanticKeys: CAGE_OUTER }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: CAGE_WIDE, fanSpread: dropTwo ? 102 : 82 } },
      { id: `cage-${suffix}-narrow-central-diamond`, address: { fixtureSemanticKeys: CAGE_INNER }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: CAGE_DIAMOND, fanSpread: dropTwo ? 92 : 74 } },
      { id: `cage-${suffix}-double-x-lattice`, address: { fixtureSemanticKeys: [...CAGE_OUTER, ...CAGE_MIDDLE] }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: CAGE_DOUBLE_X, fanSpread: dropTwo ? 108 : 88 } },
      { id: `cage-${suffix}-outward-mirrored-wings`, address: { fixtureSemanticKeys: [...CAGE_UPPER, ...CAGE_LOWER] }, fixture: { enabled: true, targetMode: 'fixed', targetPoints: CAGE_WINGS, fanSpread: dropTwo ? 114 : 94 } },
    ],
    sectionBodyMutations: [
      {
        id: `cage-${suffix}-optional-vocal-corridor-accents`, probability: 0.8,
        conditions: [{ source: 'vocalEnergy', operator: 'gt', value: 0.62, requiredCapability: 'Stem Curves', minConfidence: 0.55 }],
        address: { fixtureSemanticKeys: CAGE_ACCENTS },
        fixture: { enabled: true, color: WHITE, brightness: 1, targetPoints: CAGE_SPEARS },
      },
      {
        id: `cage-${suffix}-dark-corridor`, probability: 0.85,
        conditions: [{ source: 'isDark', operator: 'truthy', minConfidence: 0.35 }],
        address: { fixtureSemanticKeys: CAGE_INNER },
        fixture: { color: BLUE, focus: 1, fanSpread: 38 },
      },
      {
        id: `cage-${suffix}-atmospheric-outer-wings`, probability: 0.75,
        conditions: [{ source: 'isAtmospheric', operator: 'truthy', minConfidence: 0.35 }],
        address: { fixtureSemanticKeys: CAGE_OUTER },
        fixture: { beamAppearance: { geometry: 'volumetricCone', glow: 1 }, brightness: 0.78 },
      },
    ],
    modulations: [
      { source: 'nBass', target: 'fixture.brightness', amount: 0.24, min: 0, max: 0.24, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'nHigh', target: 'fixture.beamWidth', amount: 0.9, min: 0, max: 0.9, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'dropImpact', target: 'global.globalGlow', amount: 0.34, min: 0, max: 0.34, mode: 'add' },
      { source: 'spectralFlatness', target: 'fixture.rotation', amount: 9, min: 0, max: 9, mode: 'add' },
      { source: 'spectralRolloff', target: 'fixture.beamWidth', amount: 0.6, min: 0, max: 0.6, mode: 'add' },
      { source: 'tension', target: 'global.globalGlow', amount: 0.16, min: 0, max: 0.16, mode: 'add' },
      { source: 'trackEnergy', target: 'fixture.fanSpread', amount: 10, min: 0, max: 10, mode: 'add', requiredCapability: 'Track Energy Curve' },
    ],
  })
}

function cageBreakdownScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cage-breakdown', 'Cyan Mirror Cage · Breakdown', section(['breakdown', 'bridge']), {
    global: { dimmer: 0.46, globalGlow: 0.54, beamPersistence: 0.64, backgroundFade: 0.78 },
    eightBarRecruitment: [
      enableFixtures('cage-breakdown-diagonals', 1, ['cage-upper-left-outer', 'cage-lower-right-outer'], { brightness: 0.58, color: WHITE, fanSpread: 8, targetMode: 'fixed', targetPoints: CAGE_SPEARS.slice(0, 2), beamTravel: { mode: 'scanner', beatsPerTravel: 10, direction: 'alternate' } }),
      enableFixtures('cage-breakdown-lavender', 2, ['cage-upper-right-inner', 'cage-lower-left-inner'], { brightness: 0.52, color: LAVENDER, fanSpread: 10, targetMode: 'fixed', targetPoints: CAGE_SPEARS.slice(2, 4), beamTravel: { mode: 'scanner', beatsPerTravel: 12, direction: 'alternate' } }),
    ],
    beatMutations: alternatingBeatMutations('cage-breakdown', ['cage-upper-left-outer', 'cage-lower-left-inner'], ['cage-upper-right-inner', 'cage-lower-right-outer'], { spreadA: 14, spreadB: 5, rotation: 2 }),
    barMutations: [
      { id: 'cage-breakdown-drift-a', intervalBars: 2, anchorBar: 0, address: { fixtureSemanticKeys: ['cage-upper-left-outer', 'cage-lower-right-outer'] }, fixture: { targetPosition: { x: 7, y: 3 }, rotation: -4 } },
      { id: 'cage-breakdown-drift-b', intervalBars: 2, anchorBar: 1, address: { fixtureSemanticKeys: ['cage-upper-right-inner', 'cage-lower-left-inner'] }, fixture: { targetPosition: { x: 11, y: 3 }, rotation: 4 } },
    ],
    fourBarVariations: [
      { id: 'cage-breakdown-outer-spears', address: { fixtureSemanticKeys: ['cage-upper-left-outer', 'cage-lower-right-outer'] }, fixture: { targetPoints: CAGE_SPEARS.slice(0, 2), color: WHITE } },
      { id: 'cage-breakdown-inner-spears', address: { fixtureSemanticKeys: ['cage-upper-right-inner', 'cage-lower-left-inner'] }, fixture: { enabled: true, targetPoints: CAGE_SPEARS.slice(2, 4), color: LAVENDER } },
      { id: 'cage-breakdown-one-diagonal', address: { fixtureSemanticKeys: ['cage-upper-left-outer'] }, fixture: { targetPoints: CAGE_SPEARS.slice(0, 1), brightness: 0.66 } },
      { id: 'cage-breakdown-opposing-diagonal', address: { fixtureSemanticKeys: ['cage-lower-right-outer'] }, fixture: { targetPoints: CAGE_SPEARS.slice(3, 4), brightness: 0.66 } },
    ],
  })
}

function cageOutroScene(): LaserDmxShowDirectorPerformanceScene {
  return baseScene('cage-outro', 'Cyan Mirror Cage · Outro', section(['outro']), {
    global: { dimmer: 0.46, globalGlow: 0.5, beamPersistence: 0.54 },
    eightBarRecruitment: [
      enableGroup('cage-outro-outer', 1, 'cage-upper-outer', { brightness: 0.5, color: ICE, fanSpread: 18, targetMode: 'fixed', targetPoints: CAGE_SPEARS }),
      enableFixtures('cage-outro-final', 2, ['cage-upper-left-outer', 'cage-upper-right-outer'], { brightness: 0.4, color: WHITE, fanSpread: 8, targetMode: 'fixed', targetPoints: CAGE_SPEARS.slice(0, 2) }, false),
    ],
    beatMutations: alternatingBeatMutations('cage-outro', ['cage-upper-left-outer'], ['cage-upper-right-outer'], { spreadA: 22, spreadB: 7, rotation: 3 }),
    barMutations: [
      { id: 'cage-outro-bar-long', intervalBars: 2, anchorBar: 0, address: { groupSemanticKeys: ['cage-upper-outer'] }, fixture: { rotation: -5, targetPoints: CAGE_SPEARS } },
      { id: 'cage-outro-bar-short', intervalBars: 2, anchorBar: 1, address: { groupSemanticKeys: ['cage-upper-outer'] }, fixture: { rotation: 5, targetPoints: CAGE_CHEVRONS.slice(0, 4) } },
    ],
    fourBarVariations: [
      { id: 'cage-outro-wide-diagonals', address: { groupSemanticKeys: ['cage-upper-outer'] }, fixture: { targetPoints: CAGE_WIDE.slice(0, 4), targetMode: 'fixed' } },
      { id: 'cage-outro-chevrons', address: { groupSemanticKeys: ['cage-upper-outer'] }, fixture: { targetPoints: CAGE_CHEVRONS.slice(0, 4), targetMode: 'fixed' } },
      { id: 'cage-outro-spears', address: { groupSemanticKeys: ['cage-upper-outer'] }, fixture: { targetPoints: CAGE_SPEARS, targetMode: 'fixed' } },
      { id: 'cage-outro-final-two', address: { fixtureSemanticKeys: ['cage-upper-left-outer', 'cage-upper-right-outer'] }, fixture: { targetPoints: CAGE_SPEARS.slice(0, 2), targetMode: 'fixed', brightness: 0.36 } },
    ],
  })
}

export function createCyanMirrorCageRig(createId: CreateId): LaserDmxShowDirectorState {
  return createRig('cyan-mirror-cage', createId, 19, 12, CAGE_GROUPS, CAGE_FIXTURES)
}

export function createCyanMirrorCageProgram(): LaserDmxShowDirectorPerformanceProgram {
  const program: LaserDmxShowDirectorPerformanceProgram = {
    schemaVersion: 2,
    id: 'cyan-mirror-cage',
    name: 'Cyan Mirror Cage',
    description: 'Sixteen mirrored row and corner lasers protect a dark center corridor with cyan arrowheads, X structures, diamonds, angular cages, and sparse white breakdown spears.',
    deterministicSeed: 0xc7a6e,
    fallbackOrder: ['verse', 'intro', 'breakdown'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    bankRoles: {
      'cage-outer-walls': { fixtureSemanticKeys: CAGE_OUTER },
      'cage-outer-walls-rest': { fixtureSemanticKeys: [...CAGE_INNER, ...CAGE_MIDDLE, ...CAGE_ACCENTS] },
      'cage-inner-arrowheads': { fixtureSemanticKeys: [...CAGE_INNER, 'cage-middle-left-inner', 'cage-middle-right-inner'] },
      'cage-inner-arrowheads-rest': { fixtureSemanticKeys: [...CAGE_OUTER, 'cage-middle-left-outer', 'cage-middle-right-outer', ...CAGE_ACCENTS] },
      'cage-hat-diagonals': { fixtureSemanticKeys: ['cage-upper-left-outer', 'cage-upper-right-outer', 'cage-lower-left-outer', 'cage-lower-right-outer'] },
      'cage-hat-rest': { fixtureSemanticKeys: [...CAGE_INNER, ...CAGE_MIDDLE, ...CAGE_ACCENTS] },
      'cage-mirrored-impact-crossing': { fixtureSemanticKeys: [...CAGE_ACCENTS, 'cage-middle-left-outer', 'cage-middle-right-outer'] },
      'cage-mirrored-impact-rest': { fixtureSemanticKeys: CAGE_FIXTURES.filter(fixture => !fixture.key.includes('corner') && !['cage-middle-left-outer', 'cage-middle-right-outer'].includes(fixture.key)).map(fixture => fixture.key) },
      'cage-bass-wall-pressure': { fixtureSemanticKeys: CAGE_OUTER },
    },
    diagnostics: {
      authoringVersion: 'showcase-04-beat-banks',
      expectedFixtureSemanticKeys: CAGE_FIXTURES.map(fixture => fixture.key),
      expectedGroupSemanticKeys: CAGE_GROUPS.map(group => group.key),
      notes: ['Sixteen upper, middle, lower, and corner laser fixtures', 'Endpoint sets preserve a dark central corridor', 'Drop 2 activates every mirrored row and impact accent'],
    },
    scenes: [
      cageIntroScene(),
      cageVerseScene(),
      cageBuildScene(),
      cagePreDropScene(),
      cageDropScene(false),
      cageBreakdownScene(),
      cageDropScene(true),
      cageOutroScene(),
    ],
  }
  const choreographed = applyPresetBankChoreography(program, {
    kickRole: 'cage-outer-walls',
    kickRestRole: 'cage-outer-walls-rest',
    snareRole: 'cage-inner-arrowheads',
    snareRestRole: 'cage-inner-arrowheads-rest',
    hatRole: 'cage-hat-diagonals',
    hatRestRole: 'cage-hat-rest',
    transientRole: 'cage-mirrored-impact-crossing',
    transientRestRole: 'cage-mirrored-impact-rest',
    bassRole: 'cage-bass-wall-pressure',
    impactColor: CYAN,
    complementaryColor: LAVENDER,
    kickSpread: 94,
    snareSpread: 72,
    transientSpread: 56,
  })
  return authorCyanMirrorCageLocalGeometry(applyMotifFamilySequence(choreographed, CAGE_MOTIF_SEQUENCE), CAGE_FIXTURES)
}

export const PRISM_CATHEDRAL_PERFORMANCE_PRESET: LaserDmxShowDirectorPerformancePresetDefinition = Object.freeze({
  id: 'prism-cathedral',
  name: 'Prism Cathedral',
  description: 'Cyan and magenta mirrored architecture evolves through X lattices, diamonds, crowns, cages, sparse breakdown spears, and a full-rig cathedral return.',
  genreTags: ['melodic bass', 'dubstep'],
  behaviorTags: ['mirrored geometry', 'full-song'],
  supportedSectionRoles: [...ALL_SECTIONS],
  musicIntelligenceCapabilities: [...MUSIC_CAPABILITIES],
  fixtureCount: PRISM_FIXTURES.length,
  approximatePeakBeamDemand: PRISM_FIXTURES.length * 8,
  createRig: createPrismCathedralRig,
  createProgram: createPrismCathedralProgram,
})

export const CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET: LaserDmxShowDirectorPerformancePresetDefinition = Object.freeze({
  id: 'cardinal-fan-reactor',
  name: 'Cardinal Fan Reactor',
  description: 'Top, bottom, left, right, and diagonal fan banks rotate between open, contracted, crossed, and four-way aperture compositions.',
  genreTags: ['dubstep', 'hybrid trap'],
  behaviorTags: ['radial fans', 'axis rotation'],
  supportedSectionRoles: [...ALL_SECTIONS],
  musicIntelligenceCapabilities: [...MUSIC_CAPABILITIES],
  fixtureCount: CARDINAL_FIXTURES.length,
  approximatePeakBeamDemand: CARDINAL_FIXTURES.length * 8,
  createRig: createCardinalFanReactorRig,
  createProgram: createCardinalFanReactorProgram,
})

export const CYAN_MIRROR_CAGE_PERFORMANCE_PRESET: LaserDmxShowDirectorPerformancePresetDefinition = Object.freeze({
  id: 'cyan-mirror-cage',
  name: 'Cyan Mirror Cage',
  description: 'Mirrored upper, middle, lower, and corner rows build arrowheads, double-X structures, angular side cages, and a protected dark center corridor.',
  genreTags: ['heavy bass', 'cinematic'],
  behaviorTags: ['mirror cage', 'negative space'],
  supportedSectionRoles: [...ALL_SECTIONS],
  musicIntelligenceCapabilities: [...MUSIC_CAPABILITIES],
  fixtureCount: CAGE_FIXTURES.length,
  approximatePeakBeamDemand: CAGE_FIXTURES.length * 8,
  createRig: createCyanMirrorCageRig,
  createProgram: createCyanMirrorCageProgram,
})

export const LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS: readonly LaserDmxShowDirectorPerformancePresetDefinition[] = Object.freeze([
  PRISM_CATHEDRAL_PERFORMANCE_PRESET,
  CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET,
  CYAN_MIRROR_CAGE_PERFORMANCE_PRESET,
])
