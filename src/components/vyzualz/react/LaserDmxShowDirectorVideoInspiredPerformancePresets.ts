import {
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorBeamTarget,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorFixtureSpecificConfig,
  type LaserDmxShowDirectorState,
} from './ReactTypes'
import type {
  LaserDmxShowDirectorAuthoredFixtureBankMetadata,
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
  LaserDmxShowDirectorPerformanceSectionMatch,
  LaserDmxShowDirectorSectionEnergyEnvelope,
} from './LaserDmxShowDirectorPerformanceProgram'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION } from './LaserDmxShowDirectorPerformanceConstants'
import type { LaserDmxShowDirectorPerformancePresetDefinition } from './LaserDmxShowDirectorPerformancePresets'
import {
  LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
  LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY,
} from './LaserDmxShowDirectorBeatActions'

const CYAN = '#35e7ff'
const ICE = '#bdf7ff'
const EMERALD = '#31ef9b'
const GREEN = '#45ff62'
const MAGENTA = '#ff47df'
const VIOLET = '#9d68ff'
const LAVENDER = '#d8c8ff'
const WHITE = '#ffffff'
const WARM_WHITE = '#ffd9a8'
const AMBER = '#ffb247'
const RED = '#ff395f'
const BLUE = '#4e78ff'

const ALL_SECTIONS = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro'] as const
const MUSIC_CAPABILITIES = [
  'Beat Grid', 'Rhythm Events', 'Live Bands', 'Sections', 'Energy',
  'Track Energy Curve', 'Stem Curves', 'Lyrics', 'Semantics', 'Spectral Features',
]

const VIDEO_INSPIRED_BLACKOUT_POLICY = Object.freeze({
  maxPreDropBeats: 0.75,
  maxImpactCutBeats: 0.25,
  maxFakeoutBeats: 0.75,
  maximumProgrammedBlackoutRatio: 0.08,
  retriggerGuardBeats: 0.5,
  breakdownRequiresVisibleOutput: true,
  minimumVisibleFixtureBrightness: 0.24,
})

type CreateId = () => string
type VideoInspiredShowId =
  | 'vocal-eclipse-exchange'
  | 'emerald-tunnel-relay'
  | 'white-vector-interlock'
  | 'aurora-canopy-drift'
  | 'chromatic-chapter-stage'
type Motif = 'spear' | 'fan' | 'cross' | 'tunnel' | 'canopy' | 'diamond' | 'crown' | 'walls' | 'burst'
type ShowStyle = 'callResponse' | 'tunnel' | 'vector' | 'canopy' | 'chapters'

type GroupSpec = { key: string; label: string }
type FixtureSpec = {
  key: string
  label: string
  kind: LaserDmxShowDirectorFixtureKind
  groupKey: string
  x: number
  y: number
  targetX?: number
  targetY?: number
  rotation?: number
  spread?: number
  brightness?: number
  color?: string
  component?: Partial<LaserDmxShowDirectorFixtureSpecificConfig>
}

type SectionPalette = Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, { primary: string; secondary: string; accent: string }>

type VideoInspiredProfile = {
  id: VideoInspiredShowId
  name: string
  description: string
  style: ShowStyle
  deterministicSeed: number
  grid: { columns: number; rows: number }
  groups: readonly GroupSpec[]
  fixtures: readonly FixtureSpec[]
  banks: Readonly<Record<string, readonly string[]>>
  motifSequence: readonly Motif[]
  sectionMotifs: Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, Motif>
  palette: SectionPalette
  genreTags: string[]
  behaviorTags: string[]
  peakBeamDemand: number
  beatStrength: number
  movementStyle: LaserDmxShowDirectorFixtureSpecificConfig['movingHeadPanTiltStyle']
}

function targetSet(prefix: string, points: readonly (readonly [number, number])[]): LaserDmxShowDirectorBeamTarget[] {
  return points.map(([x, y], index) => ({ id: `${prefix}-${index + 1}`, x, y }))
}

function section(
  types: LaserDmxShowDirectorPerformanceSectionMatch['types'],
  dropOccurrence?: number[] | { minOccurrence?: number; maxOccurrence?: number; occurrences?: number[] },
): LaserDmxShowDirectorPerformanceSectionMatch {
  if (!dropOccurrence) return { types }
  return { types, dropOccurrence: Array.isArray(dropOccurrence) ? { occurrences: dropOccurrence } : dropOccurrence }
}

function envelope(
  activeFixtureGroups: [number, number],
  estimatedBeamCount: [number, number],
  brightness: [number, number],
  fanSpread: [number, number],
  movementStrength: [number, number],
  glow: [number, number],
  density: [number, number],
  negativeSpace: [number, number],
): LaserDmxShowDirectorSectionEnergyEnvelope {
  const range = ([min, max]: [number, number]) => ({ min, max })
  return {
    activeFixtureGroups: range(activeFixtureGroups),
    estimatedBeamCount: range(estimatedBeamCount),
    brightness: range(brightness),
    fanSpread: range(fanSpread),
    movementStrength: range(movementStrength),
    glow: range(glow),
    density: range(density),
    negativeSpace: range(negativeSpace),
  }
}

const VIDEO_INSPIRED_ENERGY_ENVELOPES: Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserDmxShowDirectorSectionEnergyEnvelope> = Object.freeze({
  intro: envelope([1, 3], [2, 28], [0.34, 0.68], [8, 42], [0.04, 0.36], [0.42, 0.72], [0.01, 0.12], [0.64, 0.92]),
  verse: envelope([2, 5], [8, 62], [0.46, 0.78], [14, 66], [0.08, 0.52], [0.54, 0.82], [0.03, 0.24], [0.42, 0.82]),
  build: envelope([3, 8], [20, 112], [0.58, 0.94], [24, 100], [0.28, 0.9], [0.68, 0.98], [0.08, 0.42], [0.12, 0.64]),
  preDrop: envelope([1, 3], [2, 24], [0.36, 0.76], [4, 26], [0, 0.24], [0.38, 0.72], [0.005, 0.08], [0.72, 0.96]),
  drop1: envelope([4, 9], [44, 156], [0.76, 1], [48, 118], [0.52, 1], [0.82, 1], [0.16, 0.52], [0.06, 0.48]),
  breakdown: envelope([1, 4], [2, 30], [0.32, 0.68], [4, 38], [0.02, 0.3], [0.42, 0.72], [0.005, 0.12], [0.7, 0.94]),
  drop2: envelope([6, 11], [72, 220], [0.84, 1], [62, 138], [0.62, 1], [0.9, 1], [0.26, 0.64], [0.02, 0.3]),
  outro: envelope([1, 3], [2, 26], [0.28, 0.58], [4, 34], [0.02, 0.26], [0.36, 0.62], [0.005, 0.09], [0.76, 0.96]),
})

function isBeamFixture(kind: LaserDmxShowDirectorFixtureKind): boolean {
  return kind === 'laser' || kind === 'movingHead' || kind === 'parWash'
}

function createFixture(
  createId: CreateId,
  profile: VideoInspiredProfile,
  groupIds: Readonly<Record<string, string>>,
  spec: FixtureSpec,
  index: number,
): LaserDmxShowDirectorFixture {
  const fixture = createDefaultLaserDmxShowDirectorFixture(spec.kind, createId(), index)
  const beamEnabled = isBeamFixture(spec.kind)
  return {
    ...fixture,
    semanticKey: spec.key,
    label: spec.label,
    groupId: groupIds[spec.groupKey] ?? null,
    linkedPairId: `${profile.id}-pair-${spec.groupKey}`,
    mirrorAxis: 'horizontal',
    x: spec.x,
    y: spec.y,
    rotation: spec.rotation ?? 0,
    color: spec.color ?? profile.palette.intro.primary,
    brightness: spec.brightness ?? (beamEnabled ? 0.68 : 0.56),
    beam: {
      ...fixture.beam,
      beamEnabled,
      targetMode: beamEnabled ? 'fixed' : fixture.beam.targetMode,
      beamSpread: spec.spread ?? (spec.kind === 'movingHead' ? 28 : spec.kind === 'parWash' ? 62 : 48),
      focus: spec.kind === 'parWash' ? 0.36 : spec.kind === 'movingHead' ? 0.82 : 0.92,
      targetX: spec.targetX ?? profile.grid.columns / 2,
      targetY: spec.targetY ?? profile.grid.rows - 1,
      targets: beamEnabled
        ? [{ id: `${spec.key}-base-target`, x: spec.targetX ?? profile.grid.columns / 2, y: spec.targetY ?? profile.grid.rows - 1 }]
        : fixture.beam.targets,
    },
    trigger: {
      ...fixture.trigger,
      mode: 'alwaysOn',
      quantize: 'none',
      retrigger: 'allow',
      fadeInMs: 0,
      fadeOutMs: spec.kind === 'haze' ? 900 : 0,
    },
    component: {
      ...fixture.component,
      movingHeadPanTiltStyle: profile.movementStyle,
      hazeIntensity: spec.kind === 'haze' ? 0.24 : fixture.component.hazeIntensity,
      strobeRate: spec.kind === 'strobe' ? 14 : fixture.component.strobeRate,
      ...spec.component,
    },
  }
}

function createRig(profile: VideoInspiredProfile, createId: CreateId): LaserDmxShowDirectorState {
  const groupIds = Object.fromEntries(profile.groups.map(group => [group.key, `${profile.id}-group-${group.key}`]))
  return normalizeLaserDmxShowDirectorState({
    ...createDefaultLaserDmxShowDirectorState(),
    sourceTemplateId: null,
    groups: profile.groups.map(group => ({ id: groupIds[group.key], semanticKey: group.key, label: group.label })),
    fixtures: profile.fixtures.map((fixture, index) => createFixture(createId, profile, groupIds, fixture, index)),
    settings: {
      ...createDefaultLaserDmxShowDirectorState().settings,
      gridSize: { ...profile.grid },
      snapEnabled: true,
      showLabels: true,
      showBeams: true,
      showGrid: true,
      highlightFixtures: true,
      zoom: 1,
    },
  })
}

function bankMetadata(profile: VideoInspiredProfile): Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata> {
  return Object.fromEntries(Object.entries(profile.banks).map(([role, fixtureSemanticKeys]) => [role, {
    role,
    label: role.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase()),
    description: `${profile.name} authored ${role} fixture bank.`,
    address: { fixtureSemanticKeys: [...fixtureSemanticKeys] },
  }]))
}

function bankAddresses(profile: VideoInspiredProfile): Record<string, LaserDmxShowDirectorPerformanceAddress> {
  return Object.fromEntries(Object.entries(profile.banks).map(([role, fixtureSemanticKeys]) => [role, { fixtureSemanticKeys: [...fixtureSemanticKeys] }]))
}

function fixtureByKey(profile: VideoInspiredProfile, key: string): FixtureSpec | undefined {
  return profile.fixtures.find(fixture => fixture.key === key)
}

function motifPoints(profile: VideoInspiredProfile, fixture: FixtureSpec, motif: Motif): LaserDmxShowDirectorBeamTarget[] {
  const centerX = profile.grid.columns / 2
  const centerY = profile.grid.rows / 2
  const bottom = profile.grid.rows - 0.7
  const side = fixture.x < centerX ? -1 : 1
  const isCenter = Math.abs(fixture.x - centerX) < 1.7
  const prefix = `${profile.id}-${motif}-${fixture.key}`
  const points: readonly (readonly [number, number])[] = (() => {
    switch (motif) {
      case 'spear':
        return [[centerX + side * 0.9, centerY + 1.2], [centerX + side * 0.5, bottom - 1.2]]
      case 'fan':
        return side < 0
          ? [[1.2, bottom], [3.5, bottom - 1.6], [6.2, bottom - 0.8], [centerX - 0.9, bottom - 2.1]]
          : [[profile.grid.columns - 1.2, bottom], [profile.grid.columns - 3.5, bottom - 1.6], [profile.grid.columns - 6.2, bottom - 0.8], [centerX + 0.9, bottom - 2.1]]
      case 'cross':
        return side < 0
          ? [[centerX + 1.8, centerY - 1.5], [centerX + 3.8, centerY + 1], [profile.grid.columns - 2, bottom - 0.8]]
          : [[centerX - 1.8, centerY - 1.5], [centerX - 3.8, centerY + 1], [2, bottom - 0.8]]
      case 'tunnel':
        return [[centerX + side * 3.2, centerY - 2.1], [centerX + side * 2.5, centerY], [centerX + side * 1.8, centerY + 2], [centerX + side * 1.2, bottom - 0.5]]
      case 'canopy':
        return side < 0
          ? [[1, centerY - 1.4], [3.4, centerY - 2.2], [6.3, centerY - 1.1], [centerX - 0.6, centerY + 0.5], [centerX - 2.7, bottom - 1]]
          : [[profile.grid.columns - 1, centerY - 1.4], [profile.grid.columns - 3.4, centerY - 2.2], [profile.grid.columns - 6.3, centerY - 1.1], [centerX + 0.6, centerY + 0.5], [centerX + 2.7, bottom - 1]]
      case 'diamond':
        return [[centerX, centerY - 2.8], [centerX + side * 3.1, centerY], [centerX, centerY + 2.8], [centerX + side * 1.4, bottom - 0.2]]
      case 'crown':
        return side < 0
          ? [[centerX - 4.8, centerY - 1], [centerX - 3.2, centerY - 2.5], [centerX - 1.4, centerY - 1.2], [centerX - 0.4, centerY + 0.4]]
          : [[centerX + 4.8, centerY - 1], [centerX + 3.2, centerY - 2.5], [centerX + 1.4, centerY - 1.2], [centerX + 0.4, centerY + 0.4]]
      case 'walls':
        return side < 0
          ? [[2.1, centerY - 2.2], [2.6, centerY], [3.1, centerY + 2.1], [4, bottom - 0.5]]
          : [[profile.grid.columns - 2.1, centerY - 2.2], [profile.grid.columns - 2.6, centerY], [profile.grid.columns - 3.1, centerY + 2.1], [profile.grid.columns - 4, bottom - 0.5]]
      case 'burst':
        return isCenter
          ? [[centerX, centerY - 3.2], [centerX + 3.5, centerY - 1], [centerX + 4.7, centerY + 2], [centerX, bottom], [centerX - 4.7, centerY + 2], [centerX - 3.5, centerY - 1]]
          : side < 0
            ? [[centerX - 0.5, centerY], [centerX + 2.8, centerY - 2.2], [centerX + 4.8, centerY + 2.2], [centerX - 1.8, bottom]]
            : [[centerX + 0.5, centerY], [centerX - 2.8, centerY - 2.2], [centerX - 4.8, centerY + 2.2], [centerX + 1.8, bottom]]
    }
  })()
  return targetSet(prefix, points)
}

function motifMap(profile: VideoInspiredProfile, motif: Motif, fixtureKeys: readonly string[]): Record<string, LaserDmxShowDirectorBeamTarget[]> {
  return Object.fromEntries(fixtureKeys.flatMap(key => {
    const fixture = fixtureByKey(profile, key)
    return fixture && isBeamFixture(fixture.kind) ? [[key, motifPoints(profile, fixture, motif)]] : []
  }))
}

function roleKeys(profile: VideoInspiredProfile, role: string): readonly string[] {
  return profile.banks[role] ?? []
}

function roleExists(profile: VideoInspiredProfile, role: string): boolean {
  return roleKeys(profile, role).length > 0
}

function enableRole(
  id: string,
  role: string,
  fixture: NonNullable<LaserDmxShowDirectorPerformanceMutationBase['fixture']>,
  conditions?: NonNullable<LaserDmxShowDirectorPerformanceMutationBase['conditions']>,
): LaserDmxShowDirectorPerformanceMutationBase {
  return { id, address: { bankRoles: [role] }, fixture: { enabled: true, ...fixture }, ...(conditions ? { conditions } : {}) }
}

function enableRoleStage(
  id: string,
  role: string,
  stage: number,
  fixture: NonNullable<LaserDmxShowDirectorPerformanceMutationBase['fixture']>,
  cumulative = true,
): NonNullable<LaserDmxShowDirectorPerformanceScene['eightBarRecruitment']>[number] {
  return { id, stage, cumulative, address: { bankRoles: [role] }, fixture: { enabled: true, ...fixture } }
}

function hazeMutation(id: string, amount: number): LaserDmxShowDirectorPerformanceMutationBase {
  return {
    id,
    address: { bankRoles: ['atmosphere'] },
    fixtureActions: [{ id: `${id}-action`, kind: 'haze', enabled: true, brightness: Math.max(0.2, amount), amount }],
  }
}

function strobeMutation(id: string, role: string, brightness = 0.9, durationMs = 84): LaserDmxShowDirectorPerformanceMutationBase {
  return {
    id,
    durationBeats: 0.25,
    address: { bankRoles: [role] },
    fixtureActions: [{ id: `${id}-action`, kind: 'strobe', active: true, brightness, color: WHITE, rateHz: 16, durationMs }],
  }
}

function blinderMutation(id: string, role: string, brightness = 0.72, durationMs = 180): LaserDmxShowDirectorPerformanceMutationBase {
  return {
    id,
    durationBeats: 0.25,
    address: { bankRoles: [role] },
    fixtureActions: [{ id: `${id}-action`, kind: 'blinder', active: true, brightness, color: WARM_WHITE, durationMs }],
  }
}

function sceneBase(
  profile: VideoInspiredProfile,
  id: string,
  label: string,
  sectionMatch: LaserDmxShowDirectorPerformanceSectionMatch,
  energyEnvelopeKey: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  patch: Partial<LaserDmxShowDirectorPerformanceScene>,
): LaserDmxShowDirectorPerformanceScene {
  const fixtureKinds = Array.from(new Set(profile.fixtures.map(fixture => fixture.kind)))
  return {
    id,
    label,
    enabled: true,
    priority: 10,
    section: sectionMatch,
    address: { fixtureKinds },
    fixture: { enabled: false, brightness: 0 },
    global: { dimmer: 0.82, globalGlow: 0.72, beamPersistence: 0.12, backgroundFade: 0.86, haze: 0.08 },
    energyEnvelopeKey,
    transitionIn: { durationBars: 0.12, curve: 'easeInOut' },
    transitionOut: { durationBars: 0.12, curve: 'easeInOut' },
    ...patch,
  }
}

function cadence(
  profile: VideoInspiredProfile,
  sceneId: string,
  motif: Motif,
  palette: { primary: string; secondary: string; accent: string },
  intensity: number,
  options: { restrained?: boolean; expanded?: boolean } = {},
): Pick<LaserDmxShowDirectorPerformanceScene,
  'beatMutations' | 'kickMutations' | 'snareMutations' | 'hatMutations' | 'transientMutations' |
  'barMutations' | 'fourBarVariations' | 'eightBarRecruitment' | 'sixteenBarEvolution' | 'modulations'> {
  const allBeamKeys = roleKeys(profile, 'allBeams')
  const leftKeys = roleKeys(profile, 'leftResponse')
  const rightKeys = roleKeys(profile, 'rightResponse')
  const primaryKeys = roleKeys(profile, 'primary')
  const secondaryKeys = roleKeys(profile, 'secondary')
  const beatTravel = options.restrained ? 'static' as const : profile.style === 'vector' ? 'scanner' as const : profile.style === 'canopy' ? 'pulseTrain' as const : 'grow' as const
  const beatSpread = (options.restrained ? 34 : options.expanded ? 102 : 72) * profile.beatStrength * intensity
  const resting = options.restrained ? 0.4 : LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.restingBrightness

  const beatMutations: NonNullable<LaserDmxShowDirectorPerformanceScene['beatMutations']> = []
  if (leftKeys.length && rightKeys.length) {
    beatMutations.push(
      {
        id: `${sceneId}-beat-left`, beatDivision: 1, beatOffsets: [0, 2], beatCycleLength: 4,
        responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
        address: { bankRoles: ['leftResponse'] },
        fixture: {
          enabled: true, brightness: options.restrained ? 0.66 : 1, color: palette.primary,
          fanSpread: beatSpread, targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, motif, leftKeys),
          beamAppearance: { width: options.restrained ? 1.1 : 1.9, glow: options.restrained ? 0.72 : 1 },
          beamTravel: { mode: beatTravel, beatsPerTravel: options.restrained ? 2 : 1, retrigger: 'restart', direction: 'forward' },
          beamPriorityRole: options.restrained ? 'secondaryFan' : 'heroImpact', beamVisualRole: options.restrained ? 'secondary' : 'hero',
        },
      },
      {
        id: `${sceneId}-beat-right-rest`, beatDivision: 1, beatOffsets: [0, 2], beatCycleLength: 4,
        responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
        address: { bankRoles: ['rightResponse'] },
        fixture: { enabled: true, brightness: resting, fanSpread: Math.max(18, beatSpread - 28), beamAppearance: { width: 0.85, glow: 0.5 }, beamVisualRole: 'texture', beamPriorityRole: 'decorativeAccent' },
      },
      {
        id: `${sceneId}-beat-right`, beatDivision: 1, beatOffsets: [1, 3], beatCycleLength: 4,
        responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
        address: { bankRoles: ['rightResponse'] },
        fixture: {
          enabled: true, brightness: options.restrained ? 0.66 : 1, color: palette.secondary,
          fanSpread: beatSpread, targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, motif, rightKeys),
          beamAppearance: { width: options.restrained ? 1.1 : 1.9, glow: options.restrained ? 0.72 : 1 },
          beamTravel: { mode: beatTravel, beatsPerTravel: options.restrained ? 2 : 1, retrigger: 'restart', direction: 'forward' },
          beamPriorityRole: options.restrained ? 'secondaryFan' : 'heroImpact', beamVisualRole: options.restrained ? 'secondary' : 'hero',
        },
      },
      {
        id: `${sceneId}-beat-left-rest`, beatDivision: 1, beatOffsets: [1, 3], beatCycleLength: 4,
        responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
        address: { bankRoles: ['leftResponse'] },
        fixture: { enabled: true, brightness: resting, fanSpread: Math.max(18, beatSpread - 28), beamAppearance: { width: 0.85, glow: 0.5 }, beamVisualRole: 'texture', beamPriorityRole: 'decorativeAccent' },
      },
    )
  }

  if (roleExists(profile, 'impact')) {
    beatMutations.push({
      ...(roleExists(profile, 'strobe') ? strobeMutation(`${sceneId}-downbeat-strobe`, 'strobe', options.expanded ? 1 : 0.82, 88) : enableRole(`${sceneId}-downbeat-beam`, 'impact', { brightness: 1, color: WHITE })),
      id: `${sceneId}-downbeat-impact`, beatDivision: 1, beatOffsets: [0], beatCycleLength: 4,
      responseEnvelope: { holdUntil: 0.06, releaseUntil: 0.2, curve: 'easeOut' },
    })
  }

  const fourMotifs = profile.motifSequence.map((variationMotif, index) => ({
    id: `${sceneId}-four-${variationMotif}-${index + 1}`,
    motifFamily: `${profile.id}-${variationMotif}`,
    address: { bankRoles: ['allBeams'] },
    fixture: {
      targetMode: 'fixed' as const,
      targetPointsByFixtureSemanticKey: motifMap(profile, variationMotif, allBeamKeys),
      fanSpread: Math.max(24, beatSpread - 8 + index * 4),
      color: index % 2 === 0 ? palette.primary : palette.secondary,
    },
  }))

  return {
    beatMutations,
    kickMutations: roleExists(profile, 'kick') ? [{
      id: `${sceneId}-kick`, threshold: 0.38, address: { bankRoles: ['kick'] },
      fixture: {
        enabled: true, brightness: options.restrained ? 0.68 : 1, color: palette.primary,
        fanSpread: Math.max(28, beatSpread + 10), beamAppearance: { width: options.restrained ? 1.25 : 2.3, glow: 1 },
        beamTravel: { mode: options.restrained ? 'static' : 'grow', beatsPerTravel: 1, retrigger: 'restart', direction: 'forward' },
        beamVisualRole: options.restrained ? 'secondary' : 'hero', beamPriorityRole: options.restrained ? 'secondaryFan' : 'heroImpact',
      },
    }] : [],
    snareMutations: roleExists(profile, 'snare') ? [{
      id: `${sceneId}-snare`, threshold: 0.38, address: { bankRoles: ['snare'] },
      fixture: {
        enabled: true, brightness: options.restrained ? 0.72 : 1, color: WHITE,
        fanSpread: Math.max(26, beatSpread - 4), beamAppearance: { width: options.restrained ? 1.3 : 2.5, glow: 1 },
        beamTravel: { mode: 'scanner', beatsPerTravel: options.restrained ? 1.5 : 0.5, retrigger: 'restart', direction: 'forward' },
        beamVisualRole: 'impact', beamPriorityRole: 'heroImpact',
      },
    }] : [],
    hatMutations: roleExists(profile, 'hat') ? [{
      id: `${sceneId}-hat`, threshold: 0.26, address: { bankRoles: ['hat'] },
      fixture: {
        enabled: true, brightness: options.restrained ? 0.46 : 0.76, color: palette.accent,
        fanSpread: Math.max(16, beatSpread - 30), beamAppearance: { width: 1, glow: 0.74 },
        beamTravel: { mode: 'pulseTrain', beatsPerTravel: 0.5, retrigger: 'restart', direction: 'forward' },
        beamVisualRole: 'texture', beamPriorityRole: 'detailLattice',
      },
    }] : [],
    transientMutations: roleExists(profile, 'impact') ? [{
      ...(roleExists(profile, 'strobe') ? strobeMutation(`${sceneId}-transient-strobe`, 'strobe', 1, 92) : enableRole(`${sceneId}-transient-beam`, 'impact', { enabled: true, brightness: 1, color: WHITE })),
      id: `${sceneId}-transient`, threshold: 0.66,
    }] : [],
    barMutations: allBeamKeys.length ? [
      {
        id: `${sceneId}-bar-a`, intervalBars: 2, anchorBar: 0, address: { bankRoles: ['allBeams'] },
        fixture: { rotation: -6, targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, motif, allBeamKeys), beamTravel: { direction: 'forward' } },
      },
      {
        id: `${sceneId}-bar-b`, intervalBars: 2, anchorBar: 1, address: { bankRoles: ['allBeams'] },
        fixture: { rotation: 6, targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, profile.motifSequence[1] ?? motif, allBeamKeys), beamTravel: { direction: 'forward' } },
      },
    ] : [],
    fourBarVariations: fourMotifs,
    eightBarRecruitment: [
      ...(primaryKeys.length ? [enableRoleStage(`${sceneId}-primary-stage`, 'primary', 1, {
        brightness: options.restrained ? 0.52 : 0.78, color: palette.primary, fanSpread: Math.max(22, beatSpread - 12),
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, motif, primaryKeys),
        beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary',
      })] : []),
      ...(secondaryKeys.length ? [enableRoleStage(`${sceneId}-secondary-stage`, 'secondary', 2, {
        brightness: options.restrained ? 0.42 : 0.7, color: palette.secondary, fanSpread: Math.max(18, beatSpread - 20),
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, profile.motifSequence[2] ?? motif, secondaryKeys),
        beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary',
      })] : []),
      ...(roleExists(profile, 'movement') ? [enableRoleStage(`${sceneId}-movement-stage`, 'movement', 2, {
        brightness: options.restrained ? 0.38 : 0.64, color: palette.accent,
        component: { movingHeadPanTiltStyle: profile.movementStyle }, fanSpread: options.restrained ? 18 : 42,
      })] : []),
    ],
    sixteenBarEvolution: allBeamKeys.length ? [{
      id: `${sceneId}-sixteen-evolution`, phase: 1, phraseLengthBars: 16, address: { bankRoles: ['allBeams'] },
      fixture: {
        enabled: true, brightness: options.restrained ? 0.62 : 0.9, color: palette.accent,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, options.expanded ? 'burst' : profile.motifSequence[3] ?? motif, allBeamKeys),
        fanSpread: options.expanded ? 118 : 82,
      },
    }] : [],
    modulations: [
      { source: 'nBass', target: 'fixture.fanSpread', amount: options.restrained ? 5 : 14, min: 0, max: options.restrained ? 5 : 14, mode: 'add', requiredCapability: 'Live Bands' },
      { source: 'trackEnergy', target: 'fixture.brightness', amount: options.restrained ? 0.06 : 0.12, min: 0, max: options.restrained ? 0.06 : 0.12, mode: 'add', requiredCapability: 'Track Energy Curve' },
      { source: 'spectralFlux', target: 'fixture.beamWidth', amount: options.restrained ? 0.18 : 0.42, min: 0, max: options.restrained ? 0.18 : 0.42, mode: 'add' },
    ],
  }
}

const lyricActive = [{ source: 'lyricActivity', operator: 'gt' as const, value: 0.2, requiredCapability: 'Lyrics', minConfidence: 0.35 }]
const vocalStemActive = [{ source: 'vocalEnergy', operator: 'gt' as const, value: 0.48, requiredCapability: 'Stem Curves', minConfidence: 0.35 }]
const lyricGap = [{ source: 'lyricActivity', operator: 'lte' as const, value: 0.2, requiredCapability: 'Lyrics', minConfidence: 0.35 }]

function conditionMutations<T extends LaserDmxShowDirectorPerformanceMutationBase>(
  mutations: readonly T[] | undefined,
  conditions: NonNullable<LaserDmxShowDirectorPerformanceMutationBase['conditions']>,
): T[] {
  return (mutations ?? []).map(mutation => ({
    ...mutation,
    conditions: [...(mutation.conditions ?? []), ...conditions],
  })) as T[]
}

function sectionScene(
  profile: VideoInspiredProfile,
  kind: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
): LaserDmxShowDirectorPerformanceScene {
  const sectionMatch = kind === 'drop1'
    ? section(['drop'], [1])
    : kind === 'drop2'
      ? section(['drop'], { minOccurrence: 2 })
      : kind === 'breakdown'
        ? section(['breakdown', 'bridge'])
        : kind === 'preDrop'
          ? section(['preDrop'])
          : section([kind])
  const sceneId = `${profile.id}-${kind === 'drop1' ? 'drop-1' : kind === 'drop2' ? 'drop-2' : kind === 'preDrop' ? 'pre-drop' : kind}`
  const palette = profile.palette[kind]
  const motif = profile.sectionMotifs[kind]
  const isDrop = kind === 'drop1' || kind === 'drop2'
  const isRestrained = kind === 'intro' || kind === 'verse' || kind === 'breakdown' || kind === 'outro'
  const rawCadence = cadence(profile, sceneId, motif, palette, isDrop ? 1 : kind === 'build' ? 0.84 : 0.64, {
    restrained: isRestrained,
    expanded: kind === 'drop2',
  })
  const commonCadence = kind === 'verse' && profile.style === 'callResponse'
    ? {
      ...rawCadence,
      beatMutations: conditionMutations(rawCadence.beatMutations, lyricGap),
      kickMutations: conditionMutations(rawCadence.kickMutations, lyricGap),
      snareMutations: conditionMutations(rawCadence.snareMutations, lyricGap),
      hatMutations: conditionMutations(rawCadence.hatMutations, lyricGap),
      transientMutations: conditionMutations(rawCadence.transientMutations, lyricGap),
      barMutations: conditionMutations(rawCadence.barMutations, lyricGap),
      fourBarVariations: conditionMutations(rawCadence.fourBarVariations, lyricGap),
      eightBarRecruitment: conditionMutations(rawCadence.eightBarRecruitment, lyricGap),
      sixteenBarEvolution: conditionMutations(rawCadence.sixteenBarEvolution, lyricGap),
    }
    : rawCadence
  const primaryKeys = roleKeys(profile, 'primary')
  const vocalKeys = roleKeys(profile, 'vocalIsolation')
  const allBeamKeys = roleKeys(profile, 'allBeams')

  if (kind === 'intro') return sceneBase(profile, sceneId, `${profile.name} · Intro`, sectionMatch, kind, {
    global: { dimmer: 0.5, globalGlow: 0.52, beamPersistence: profile.style === 'canopy' ? 0.24 : 0.16, backgroundFade: 0.92, haze: roleExists(profile, 'atmosphere') ? 0.16 : 0 },
    ...commonCadence,
    sectionBodyMutations: [
      ...(primaryKeys.length ? [enableRole(`${sceneId}-intro-primary`, 'primary', {
        brightness: 0.48, color: palette.primary, fanSpread: profile.style === 'canopy' ? 48 : 24,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, motif, primaryKeys),
        beamTravel: { mode: profile.style === 'canopy' ? 'pulseTrain' : 'static', beatsPerTravel: 4, direction: 'forward' },
      })] : []),
      ...(roleExists(profile, 'atmosphere') ? [hazeMutation(`${sceneId}-intro-haze`, 0.16)] : []),
    ],
  })

  if (kind === 'verse') return sceneBase(profile, sceneId, `${profile.name} · Verse / Vocal`, sectionMatch, kind, {
    global: { dimmer: 0.64, globalGlow: 0.62, beamPersistence: profile.style === 'canopy' ? 0.22 : 0.12, backgroundFade: 0.9, haze: roleExists(profile, 'atmosphere') ? 0.2 : 0 },
    ...commonCadence,
    sectionBodyMutations: [
      ...(profile.style === 'callResponse' && vocalKeys.length ? [enableRole(`${sceneId}-fallback-vocal-isolation`, 'vocalIsolation', {
        brightness: 0.42, color: WARM_WHITE, fanSpread: 14,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, 'crown', vocalKeys),
        component: { movingHeadPanTiltStyle: 'locked' },
      })] : []),
      ...(primaryKeys.length ? [enableRole(`${sceneId}-base-architecture`, 'primary', {
        brightness: 0.52, color: palette.primary, fanSpread: profile.style === 'canopy' ? 56 : 34,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, motif, primaryKeys),
      }, profile.style === 'callResponse' ? lyricGap : undefined)] : []),
      ...(vocalKeys.length ? [
        enableRole(`${sceneId}-lyric-isolation`, 'vocalIsolation', {
          brightness: profile.style === 'chapters' ? 0.78 : 0.62, color: profile.style === 'chapters' ? WARM_WHITE : palette.accent,
          fanSpread: profile.style === 'canopy' ? 42 : 18, targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, 'crown', vocalKeys),
          component: { movingHeadPanTiltStyle: 'locked' },
        }, lyricActive),
        enableRole(`${sceneId}-stem-vocal-isolation`, 'vocalIsolation', {
          brightness: 0.58, color: profile.style === 'chapters' ? WARM_WHITE : palette.accent,
          fanSpread: 20, targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, 'crown', vocalKeys),
          component: { movingHeadPanTiltStyle: 'locked' },
        }, vocalStemActive),
      ] : []),
      ...(roleExists(profile, 'wash') ? [
        enableRole(`${sceneId}-vocal-wash`, 'wash', { brightness: 0.44, color: profile.style === 'chapters' ? AMBER : palette.secondary }, lyricActive),
      ] : []),
      ...(roleExists(profile, 'leftResponse') ? [enableRole(`${sceneId}-lyric-gap-response-left`, 'leftResponse', {
        brightness: 0.76, color: palette.primary, fanSpread: 68,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, profile.style === 'callResponse' ? 'tunnel' : 'fan', roleKeys(profile, 'leftResponse')),
      }, lyricGap)] : []),
      ...(roleExists(profile, 'rightResponse') ? [enableRole(`${sceneId}-lyric-gap-response-right`, 'rightResponse', {
        brightness: 0.76, color: palette.secondary, fanSpread: 68,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, profile.style === 'callResponse' ? 'tunnel' : 'fan', roleKeys(profile, 'rightResponse')),
      }, lyricGap)] : []),
      ...(roleExists(profile, 'atmosphere') ? [hazeMutation(`${sceneId}-verse-haze`, 0.2)] : []),
    ],
  })

  if (kind === 'build') return sceneBase(profile, sceneId, `${profile.name} · Build`, sectionMatch, kind, {
    global: { dimmer: 0.76, globalGlow: 0.8, beamPersistence: 0.1, backgroundFade: 0.84, haze: roleExists(profile, 'atmosphere') ? 0.28 : 0 },
    ...commonCadence,
    sectionBodyMutations: [
      ...(primaryKeys.length ? [enableRole(`${sceneId}-build-primary`, 'primary', {
        brightness: 0.7, color: palette.primary, fanSpread: 58,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, motif, primaryKeys),
      })] : []),
      ...(roleExists(profile, 'secondary') ? [enableRole(`${sceneId}-late-build-secondary`, 'secondary', {
        brightness: 0.74, color: palette.secondary, fanSpread: 78,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, profile.motifSequence[1] ?? motif, roleKeys(profile, 'secondary')),
      }, [{ source: 'buildProgress', operator: 'gt', value: 0.56 }])] : []),
      ...(roleExists(profile, 'strobe') ? [{
        ...strobeMutation(`${sceneId}-late-build-strobe`, 'strobe', 0.72, 70),
        conditions: [{ source: 'buildProgress', operator: 'gt' as const, value: 0.72 }],
      }] : []),
      ...(roleExists(profile, 'atmosphere') ? [hazeMutation(`${sceneId}-build-haze`, 0.28)] : []),
    ],
  })

  if (kind === 'preDrop') return sceneBase(profile, sceneId, `${profile.name} · Pre-Drop Hold`, sectionMatch, kind, {
    global: { dimmer: 0.52, globalGlow: 0.56, beamPersistence: 0.03, backgroundFade: 0.95, haze: roleExists(profile, 'atmosphere') ? 0.12 : 0 },
    ...commonCadence,
    blackoutWindows: [{
      id: `${sceneId}-end-cut`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: profile.style === 'vector' ? 0.75 : 0.5,
      justification: 'Video-inspired visual breath before the impact while retaining a visible pre-drop spear.',
    }],
    sectionBodyMutations: [
      ...(vocalKeys.length ? [enableRole(`${sceneId}-single-spear`, 'vocalIsolation', {
        brightness: 0.62, color: palette.accent, fanSpread: 10,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, 'spear', vocalKeys),
        component: { movingHeadPanTiltStyle: 'locked' },
      })] : primaryKeys.length ? [enableRole(`${sceneId}-single-spear`, 'primary', {
        brightness: 0.58, color: palette.accent, fanSpread: 10,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, 'spear', primaryKeys),
      })] : []),
      ...(roleExists(profile, 'wash') ? [enableRole(`${sceneId}-dim-wash`, 'wash', { brightness: 0.22, color: palette.secondary })] : []),
    ],
  })

  if (kind === 'drop1') return sceneBase(profile, sceneId, `${profile.name} · Drop 1`, sectionMatch, kind, {
    global: { dimmer: 0.94, globalGlow: 0.94, beamPersistence: profile.style === 'vector' ? 0.04 : 0.1, backgroundFade: 0.74, haze: roleExists(profile, 'atmosphere') ? 0.34 : 0 },
    ...commonCadence,
    sectionEntryMutations: [
      ...(roleExists(profile, 'strobe') ? [strobeMutation(`${sceneId}-entry-strobe`, 'strobe', 1, 92)] : []),
      ...(roleExists(profile, 'blinder') ? [blinderMutation(`${sceneId}-entry-blinder`, 'blinder', 0.7, 170)] : []),
    ],
    sectionBodyMutations: [
      ...(roleExists(profile, 'hero') ? [enableRole(`${sceneId}-hero`, 'hero', {
        brightness: 0.94, color: palette.primary, fanSpread: profile.style === 'tunnel' ? 82 : 92,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, motif, roleKeys(profile, 'hero')),
        beamAppearance: { width: 1.8, glow: 1 }, beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary',
      })] : []),
      ...(roleExists(profile, 'atmosphere') ? [hazeMutation(`${sceneId}-drop-haze`, 0.34)] : []),
    ],
  })

  if (kind === 'breakdown') return sceneBase(profile, sceneId, `${profile.name} · Breakdown / Vocal Focus`, sectionMatch, kind, {
    global: { dimmer: 0.46, globalGlow: 0.48, beamPersistence: 0.18, backgroundFade: 0.94, haze: roleExists(profile, 'atmosphere') ? 0.16 : 0 },
    ...commonCadence,
    sectionBodyMutations: [
      ...(vocalKeys.length ? [enableRole(`${sceneId}-vocal-focus`, 'vocalIsolation', {
        brightness: 0.54, color: profile.style === 'chapters' ? RED : palette.primary, fanSpread: 16,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, 'crown', vocalKeys),
        component: { movingHeadPanTiltStyle: 'locked' },
      })] : []),
      ...(roleExists(profile, 'wash') ? [enableRole(`${sceneId}-breakdown-wash`, 'wash', {
        brightness: profile.style === 'chapters' ? 0.5 : 0.3, color: profile.style === 'chapters' ? RED : palette.secondary,
      })] : []),
      ...(primaryKeys.length ? [enableRole(`${sceneId}-edge-lines`, 'primary', {
        brightness: 0.34, color: palette.secondary, fanSpread: 18,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, profile.style === 'canopy' ? 'canopy' : 'walls', primaryKeys),
        beamAppearance: { width: 0.86, glow: 0.52 }, beamVisualRole: 'texture', beamPriorityRole: 'decorativeAccent',
      })] : []),
      ...(roleExists(profile, 'atmosphere') ? [hazeMutation(`${sceneId}-breakdown-haze`, 0.16)] : []),
    ],
  })

  if (kind === 'drop2') return sceneBase(profile, sceneId, `${profile.name} · Drop 2 Evolution`, sectionMatch, kind, {
    global: { dimmer: 1, globalGlow: 1, beamPersistence: profile.style === 'vector' ? 0.05 : 0.12, backgroundFade: 0.68, haze: roleExists(profile, 'atmosphere') ? 0.42 : 0 },
    ...commonCadence,
    blackoutWindows: profile.style === 'callResponse' || profile.style === 'vector' ? [{
      id: `${sceneId}-fakeout-cut`, kind: 'fakeout', anchor: 'sectionStart', durationBeats: 0.25, offsetBeats: 4,
      justification: 'Short deterministic call-and-response cut borrowed from the reference DJ shows.',
    }] : undefined,
    sectionEntryMutations: [
      ...(roleExists(profile, 'strobe') ? [strobeMutation(`${sceneId}-entry-strobe`, 'strobe', 1, 96)] : []),
      ...(roleExists(profile, 'blinder') ? [blinderMutation(`${sceneId}-entry-blinder`, 'blinder', 0.82, 190)] : []),
    ],
    sectionBodyMutations: [
      ...(allBeamKeys.length ? [enableRole(`${sceneId}-all-beams`, 'allBeams', {
        brightness: 0.96, color: palette.primary, fanSpread: 112,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, motif, allBeamKeys),
        beamAppearance: { width: 2, glow: 1 }, beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary',
      })] : []),
      ...(roleExists(profile, 'movement') ? [enableRole(`${sceneId}-moving-depth`, 'movement', {
        brightness: 0.84, color: palette.secondary, fanSpread: 58,
        targetMode: 'fixed', targetPointsByFixtureSemanticKey: motifMap(profile, profile.style === 'chapters' ? 'crown' : 'cross', roleKeys(profile, 'movement')),
        component: { movingHeadPanTiltStyle: profile.style === 'chapters' ? 'figureEight' : profile.movementStyle },
      })] : []),
      ...(roleExists(profile, 'atmosphere') ? [hazeMutation(`${sceneId}-drop2-haze`, 0.42)] : []),
    ],
  })

  return sceneBase(profile, sceneId, `${profile.name} · Outro`, sectionMatch, kind, {
    global: { dimmer: 0.4, globalGlow: 0.42, beamPersistence: 0.2, backgroundFade: 0.96, haze: roleExists(profile, 'atmosphere') ? 0.08 : 0 },
    ...commonCadence,
    barProgression: [
      ...(primaryKeys.length ? [{
        id: `${sceneId}-outro-stage-1`, stageBar: 1, cumulative: false, address: { bankRoles: ['primary'] },
        fixture: { enabled: true, brightness: 0.42, color: palette.primary, fanSpread: 24, targetMode: 'fixed' as const, targetPointsByFixtureSemanticKey: motifMap(profile, motif, primaryKeys) },
      }] : []),
      ...(vocalKeys.length ? [{
        id: `${sceneId}-outro-stage-3`, stageBar: 3, cumulative: false, address: { bankRoles: ['vocalIsolation'] },
        fixture: { enabled: true, brightness: 0.3, color: palette.accent, fanSpread: 10, targetMode: 'fixed' as const, targetPointsByFixtureSemanticKey: motifMap(profile, 'spear', vocalKeys) },
      }] : []),
    ],
    sectionBodyMutations: roleExists(profile, 'atmosphere') ? [hazeMutation(`${sceneId}-outro-haze`, 0.08)] : [],
  })
}

function createProgram(profile: VideoInspiredProfile): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
    id: profile.id,
    name: profile.name,
    description: profile.description,
    deterministicSeed: profile.deterministicSeed,
    bankRoles: bankAddresses(profile),
    fixtureBanks: bankMetadata(profile),
    energyEnvelopes: VIDEO_INSPIRED_ENERGY_ENVELOPES,
    blackoutPolicy: VIDEO_INSPIRED_BLACKOUT_POLICY,
    fallbackOrder: ['verse', 'intro', 'build', 'drop', 'breakdown', 'outro'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    diagnostics: {
      authoringVersion: 'video-reference-performance-presets-v1',
      expectedFixtureSemanticKeys: profile.fixtures.map(fixture => fixture.key),
      expectedGroupSemanticKeys: profile.groups.map(group => group.key),
      notes: [
        'Section chooses the scene; phrase evolves geometry; bar redirects movement; beats animate the selected motif.',
        'Vocals preserve negative space through moving-head and wash isolation, with laser responses placed in lyric gaps when intelligence is available.',
        'Programmed darkness is bounded, deterministic, and subordinate to Show Director blackout safety authority.',
      ],
    },
    scenes: [
      sectionScene(profile, 'intro'),
      sectionScene(profile, 'verse'),
      sectionScene(profile, 'build'),
      sectionScene(profile, 'preDrop'),
      sectionScene(profile, 'drop1'),
      sectionScene(profile, 'breakdown'),
      sectionScene(profile, 'drop2'),
      sectionScene(profile, 'outro'),
    ],
  }
}

const COMMON_GROUPS: readonly GroupSpec[] = [
  { key: 'laser-left', label: 'Laser Left' },
  { key: 'laser-right', label: 'Laser Right' },
  { key: 'laser-center', label: 'Laser Center' },
  { key: 'movement-left', label: 'Movement Left' },
  { key: 'movement-right', label: 'Movement Right' },
  { key: 'wash', label: 'Stage Wash' },
  { key: 'impact', label: 'Impact Fixtures' },
  { key: 'atmosphere', label: 'Atmosphere' },
]

const VOCAL_ECLIPSE_PROFILE: VideoInspiredProfile = {
  id: 'vocal-eclipse-exchange',
  name: 'Vocal Eclipse Exchange',
  description: 'A vocal-aware call-and-response show that contracts to warm performer isolation during lyrics, then answers vocal gaps with emerald tunnel walls and white downbeat strikes.',
  style: 'callResponse', deterministicSeed: 31057, grid: { columns: 20, rows: 12 }, groups: COMMON_GROUPS,
  fixtures: [
    { key: 'eclipse-laser-top-l', label: 'Eclipse Top Laser L', kind: 'laser', groupKey: 'laser-left', x: 5, y: 1, targetX: 8, targetY: 10, color: EMERALD },
    { key: 'eclipse-laser-side-l', label: 'Eclipse Side Laser L', kind: 'laser', groupKey: 'laser-left', x: 1, y: 5, targetX: 8, targetY: 9, color: GREEN },
    { key: 'eclipse-laser-top-r', label: 'Eclipse Top Laser R', kind: 'laser', groupKey: 'laser-right', x: 15, y: 1, targetX: 12, targetY: 10, color: CYAN },
    { key: 'eclipse-laser-side-r', label: 'Eclipse Side Laser R', kind: 'laser', groupKey: 'laser-right', x: 19, y: 5, targetX: 12, targetY: 9, color: EMERALD },
    { key: 'eclipse-head-l', label: 'Eclipse Vocal Head L', kind: 'movingHead', groupKey: 'movement-left', x: 8, y: 2, targetX: 9, targetY: 8, color: WARM_WHITE },
    { key: 'eclipse-head-r', label: 'Eclipse Vocal Head R', kind: 'movingHead', groupKey: 'movement-right', x: 12, y: 2, targetX: 11, targetY: 8, color: WARM_WHITE },
    { key: 'eclipse-wash-l', label: 'Eclipse Wash L', kind: 'parWash', groupKey: 'wash', x: 7, y: 3, targetX: 8, targetY: 7, color: AMBER },
    { key: 'eclipse-wash-r', label: 'Eclipse Wash R', kind: 'parWash', groupKey: 'wash', x: 13, y: 3, targetX: 12, targetY: 7, color: RED },
    { key: 'eclipse-strobe', label: 'Eclipse Center Strobe', kind: 'strobe', groupKey: 'impact', x: 10, y: 2, color: WHITE },
    { key: 'eclipse-haze', label: 'Eclipse Haze', kind: 'haze', groupKey: 'atmosphere', x: 10, y: 10, color: ICE },
  ],
  banks: {
    hero: ['eclipse-laser-side-l', 'eclipse-laser-side-r'], primary: ['eclipse-laser-top-l', 'eclipse-laser-top-r'], secondary: ['eclipse-laser-side-l', 'eclipse-laser-side-r'],
    leftResponse: ['eclipse-laser-top-l', 'eclipse-laser-side-l'], rightResponse: ['eclipse-laser-top-r', 'eclipse-laser-side-r'],
    kick: ['eclipse-laser-side-l', 'eclipse-laser-side-r'], snare: ['eclipse-head-l', 'eclipse-head-r'], hat: ['eclipse-laser-top-l', 'eclipse-laser-top-r'],
    movement: ['eclipse-head-l', 'eclipse-head-r'], vocalIsolation: ['eclipse-head-l', 'eclipse-head-r'], wash: ['eclipse-wash-l', 'eclipse-wash-r'],
    impact: ['eclipse-strobe'], strobe: ['eclipse-strobe'], atmosphere: ['eclipse-haze'], allBeams: ['eclipse-laser-top-l', 'eclipse-laser-side-l', 'eclipse-laser-top-r', 'eclipse-laser-side-r', 'eclipse-head-l', 'eclipse-head-r'],
  },
  motifSequence: ['tunnel', 'walls', 'cross', 'fan'],
  sectionMotifs: { intro: 'spear', verse: 'tunnel', build: 'walls', preDrop: 'spear', drop1: 'tunnel', breakdown: 'crown', drop2: 'cross', outro: 'spear' },
  palette: {
    intro: { primary: EMERALD, secondary: CYAN, accent: WARM_WHITE }, verse: { primary: EMERALD, secondary: GREEN, accent: WARM_WHITE }, build: { primary: GREEN, secondary: CYAN, accent: WHITE },
    preDrop: { primary: WARM_WHITE, secondary: AMBER, accent: WHITE }, drop1: { primary: GREEN, secondary: EMERALD, accent: WHITE }, breakdown: { primary: WARM_WHITE, secondary: RED, accent: AMBER },
    drop2: { primary: EMERALD, secondary: CYAN, accent: WHITE }, outro: { primary: EMERALD, secondary: WARM_WHITE, accent: AMBER },
  },
  genreTags: ['melodic bass', 'vocal bass', 'hybrid trap'], behaviorTags: ['vocal-aware', 'call and response', 'performer isolation'], peakBeamDemand: 128, beatStrength: 0.92, movementStyle: 'smoothSweep',
}

const EMERALD_TUNNEL_PROFILE: VideoInspiredProfile = {
  id: 'emerald-tunnel-relay',
  name: 'Emerald Tunnel Relay',
  description: 'Dense green corridor choreography with mirrored room walls, alternating call banks, white snare cuts, progressive eight-bar recruitment, and a deeper second-drop tunnel.',
  style: 'tunnel', deterministicSeed: 44281, grid: { columns: 20, rows: 12 }, groups: COMMON_GROUPS,
  fixtures: [
    { key: 'tunnel-upper-l', label: 'Tunnel Upper L', kind: 'laser', groupKey: 'laser-left', x: 3, y: 1, targetX: 8, targetY: 10, color: GREEN },
    { key: 'tunnel-mid-l', label: 'Tunnel Mid L', kind: 'laser', groupKey: 'laser-left', x: 1, y: 4, targetX: 8, targetY: 9, color: EMERALD },
    { key: 'tunnel-lower-l', label: 'Tunnel Lower L', kind: 'laser', groupKey: 'laser-left', x: 1, y: 8, targetX: 8, targetY: 10, color: GREEN },
    { key: 'tunnel-inner-l', label: 'Tunnel Inner L', kind: 'laser', groupKey: 'laser-center', x: 7, y: 2, targetX: 9, targetY: 10, color: CYAN },
    { key: 'tunnel-upper-r', label: 'Tunnel Upper R', kind: 'laser', groupKey: 'laser-right', x: 17, y: 1, targetX: 12, targetY: 10, color: GREEN },
    { key: 'tunnel-mid-r', label: 'Tunnel Mid R', kind: 'laser', groupKey: 'laser-right', x: 19, y: 4, targetX: 12, targetY: 9, color: EMERALD },
    { key: 'tunnel-lower-r', label: 'Tunnel Lower R', kind: 'laser', groupKey: 'laser-right', x: 19, y: 8, targetX: 12, targetY: 10, color: GREEN },
    { key: 'tunnel-inner-r', label: 'Tunnel Inner R', kind: 'laser', groupKey: 'laser-center', x: 13, y: 2, targetX: 11, targetY: 10, color: CYAN },
    { key: 'tunnel-head-l', label: 'Tunnel Head L', kind: 'movingHead', groupKey: 'movement-left', x: 8, y: 1, targetX: 9, targetY: 8, color: WHITE },
    { key: 'tunnel-head-r', label: 'Tunnel Head R', kind: 'movingHead', groupKey: 'movement-right', x: 12, y: 1, targetX: 11, targetY: 8, color: WHITE },
    { key: 'tunnel-strobe-l', label: 'Tunnel Strobe L', kind: 'strobe', groupKey: 'impact', x: 7, y: 3, color: WHITE },
    { key: 'tunnel-strobe-r', label: 'Tunnel Strobe R', kind: 'strobe', groupKey: 'impact', x: 13, y: 3, color: WHITE },
    { key: 'tunnel-haze', label: 'Tunnel Haze', kind: 'haze', groupKey: 'atmosphere', x: 10, y: 10, color: ICE },
  ],
  banks: {
    hero: ['tunnel-mid-l', 'tunnel-mid-r', 'tunnel-lower-l', 'tunnel-lower-r'], primary: ['tunnel-upper-l', 'tunnel-inner-l', 'tunnel-upper-r', 'tunnel-inner-r'], secondary: ['tunnel-mid-l', 'tunnel-lower-l', 'tunnel-mid-r', 'tunnel-lower-r'],
    leftResponse: ['tunnel-upper-l', 'tunnel-mid-l', 'tunnel-lower-l', 'tunnel-inner-l'], rightResponse: ['tunnel-upper-r', 'tunnel-mid-r', 'tunnel-lower-r', 'tunnel-inner-r'],
    kick: ['tunnel-lower-l', 'tunnel-lower-r'], snare: ['tunnel-upper-l', 'tunnel-upper-r', 'tunnel-head-l', 'tunnel-head-r'], hat: ['tunnel-inner-l', 'tunnel-inner-r'],
    movement: ['tunnel-head-l', 'tunnel-head-r'], vocalIsolation: ['tunnel-head-l', 'tunnel-head-r'], impact: ['tunnel-strobe-l', 'tunnel-strobe-r'], strobe: ['tunnel-strobe-l', 'tunnel-strobe-r'], atmosphere: ['tunnel-haze'],
    allBeams: ['tunnel-upper-l', 'tunnel-mid-l', 'tunnel-lower-l', 'tunnel-inner-l', 'tunnel-upper-r', 'tunnel-mid-r', 'tunnel-lower-r', 'tunnel-inner-r', 'tunnel-head-l', 'tunnel-head-r'],
  },
  motifSequence: ['tunnel', 'walls', 'cross', 'burst'],
  sectionMotifs: { intro: 'walls', verse: 'tunnel', build: 'cross', preDrop: 'spear', drop1: 'tunnel', breakdown: 'walls', drop2: 'burst', outro: 'walls' },
  palette: {
    intro: { primary: EMERALD, secondary: GREEN, accent: ICE }, verse: { primary: GREEN, secondary: EMERALD, accent: WHITE }, build: { primary: EMERALD, secondary: CYAN, accent: WHITE },
    preDrop: { primary: GREEN, secondary: ICE, accent: WHITE }, drop1: { primary: GREEN, secondary: EMERALD, accent: WHITE }, breakdown: { primary: EMERALD, secondary: CYAN, accent: ICE },
    drop2: { primary: GREEN, secondary: CYAN, accent: WHITE }, outro: { primary: EMERALD, secondary: GREEN, accent: ICE },
  },
  genreTags: ['dubstep', 'riddim', 'bass music'], behaviorTags: ['green tunnel', 'mirrored corridor', 'eight-bar recruitment'], peakBeamDemand: 220, beatStrength: 1.05, movementStyle: 'snap',
}

const WHITE_VECTOR_PROFILE: VideoInspiredProfile = {
  id: 'white-vector-interlock',
  name: 'White Vector Interlock',
  description: 'High-contrast white geometry that rotates through diamonds, X forms, crowns, and radial bursts, punctuated by short black gaps and restrained cyan-magenta edges.',
  style: 'vector', deterministicSeed: 57113, grid: { columns: 20, rows: 12 }, groups: COMMON_GROUPS,
  fixtures: [
    { key: 'vector-top-outer-l', label: 'Vector Top Outer L', kind: 'laser', groupKey: 'laser-left', x: 3, y: 1, targetX: 9, targetY: 9, color: WHITE },
    { key: 'vector-top-inner-l', label: 'Vector Top Inner L', kind: 'laser', groupKey: 'laser-left', x: 7, y: 1, targetX: 10, targetY: 9, color: CYAN },
    { key: 'vector-side-l', label: 'Vector Side L', kind: 'laser', groupKey: 'laser-left', x: 1, y: 6, targetX: 11, targetY: 6, color: WHITE },
    { key: 'vector-bottom-l', label: 'Vector Bottom L', kind: 'laser', groupKey: 'laser-left', x: 4, y: 10, targetX: 10, targetY: 4, color: MAGENTA },
    { key: 'vector-center-l', label: 'Vector Center L', kind: 'laser', groupKey: 'laser-center', x: 9, y: 2, targetX: 10, targetY: 8, color: WHITE },
    { key: 'vector-top-outer-r', label: 'Vector Top Outer R', kind: 'laser', groupKey: 'laser-right', x: 17, y: 1, targetX: 11, targetY: 9, color: WHITE },
    { key: 'vector-top-inner-r', label: 'Vector Top Inner R', kind: 'laser', groupKey: 'laser-right', x: 13, y: 1, targetX: 10, targetY: 9, color: MAGENTA },
    { key: 'vector-side-r', label: 'Vector Side R', kind: 'laser', groupKey: 'laser-right', x: 19, y: 6, targetX: 9, targetY: 6, color: WHITE },
    { key: 'vector-bottom-r', label: 'Vector Bottom R', kind: 'laser', groupKey: 'laser-right', x: 16, y: 10, targetX: 10, targetY: 4, color: CYAN },
    { key: 'vector-center-r', label: 'Vector Center R', kind: 'laser', groupKey: 'laser-center', x: 11, y: 2, targetX: 10, targetY: 8, color: WHITE },
    { key: 'vector-strobe-l', label: 'Vector Strobe L', kind: 'strobe', groupKey: 'impact', x: 8, y: 3, color: WHITE },
    { key: 'vector-strobe-r', label: 'Vector Strobe R', kind: 'strobe', groupKey: 'impact', x: 12, y: 3, color: WHITE },
    { key: 'vector-haze', label: 'Vector Haze', kind: 'haze', groupKey: 'atmosphere', x: 10, y: 10, color: ICE },
  ],
  banks: {
    hero: ['vector-side-l', 'vector-side-r', 'vector-bottom-l', 'vector-bottom-r'], primary: ['vector-top-outer-l', 'vector-top-inner-l', 'vector-center-l', 'vector-top-outer-r', 'vector-top-inner-r', 'vector-center-r'], secondary: ['vector-side-l', 'vector-bottom-l', 'vector-side-r', 'vector-bottom-r'],
    leftResponse: ['vector-top-outer-l', 'vector-top-inner-l', 'vector-side-l', 'vector-bottom-l', 'vector-center-l'], rightResponse: ['vector-top-outer-r', 'vector-top-inner-r', 'vector-side-r', 'vector-bottom-r', 'vector-center-r'],
    kick: ['vector-bottom-l', 'vector-bottom-r', 'vector-center-l', 'vector-center-r'], snare: ['vector-side-l', 'vector-side-r', 'vector-top-outer-l', 'vector-top-outer-r'], hat: ['vector-top-inner-l', 'vector-top-inner-r'],
    vocalIsolation: ['vector-center-l', 'vector-center-r'], impact: ['vector-strobe-l', 'vector-strobe-r'], strobe: ['vector-strobe-l', 'vector-strobe-r'], atmosphere: ['vector-haze'],
    allBeams: ['vector-top-outer-l', 'vector-top-inner-l', 'vector-side-l', 'vector-bottom-l', 'vector-center-l', 'vector-top-outer-r', 'vector-top-inner-r', 'vector-side-r', 'vector-bottom-r', 'vector-center-r'],
  },
  motifSequence: ['diamond', 'cross', 'crown', 'burst'],
  sectionMotifs: { intro: 'diamond', verse: 'crown', build: 'cross', preDrop: 'spear', drop1: 'diamond', breakdown: 'crown', drop2: 'burst', outro: 'diamond' },
  palette: {
    intro: { primary: WHITE, secondary: CYAN, accent: MAGENTA }, verse: { primary: CYAN, secondary: WHITE, accent: MAGENTA }, build: { primary: WHITE, secondary: MAGENTA, accent: CYAN },
    preDrop: { primary: WHITE, secondary: CYAN, accent: WHITE }, drop1: { primary: WHITE, secondary: CYAN, accent: MAGENTA }, breakdown: { primary: LAVENDER, secondary: CYAN, accent: WHITE },
    drop2: { primary: WHITE, secondary: MAGENTA, accent: CYAN }, outro: { primary: WHITE, secondary: CYAN, accent: LAVENDER },
  },
  genreTags: ['techno', 'bass music', 'festival'], behaviorTags: ['geometric animation', 'bounded black gaps', 'high contrast'], peakBeamDemand: 236, beatStrength: 1, movementStyle: 'snap',
}

const AURORA_CANOPY_PROFILE: VideoInspiredProfile = {
  id: 'aurora-canopy-drift',
  name: 'Aurora Canopy Drift',
  description: 'A slow-breathing cyan and magenta aerial canopy that preserves a stable architectural scene across beats, then evolves color, width, and depth on four-, eight-, and sixteen-bar phrases.',
  style: 'canopy', deterministicSeed: 68329, grid: { columns: 20, rows: 12 }, groups: COMMON_GROUPS,
  fixtures: [
    { key: 'canopy-laser-1', label: 'Canopy Laser 1', kind: 'laser', groupKey: 'laser-left', x: 2, y: 1, targetX: 5, targetY: 9, color: CYAN },
    { key: 'canopy-laser-2', label: 'Canopy Laser 2', kind: 'laser', groupKey: 'laser-left', x: 5, y: 1, targetX: 7, targetY: 9, color: ICE },
    { key: 'canopy-laser-3', label: 'Canopy Laser 3', kind: 'laser', groupKey: 'laser-center', x: 8, y: 1, targetX: 9, targetY: 9, color: VIOLET },
    { key: 'canopy-laser-4', label: 'Canopy Laser 4', kind: 'laser', groupKey: 'laser-center', x: 9, y: 1, targetX: 10, targetY: 9, color: CYAN },
    { key: 'canopy-laser-5', label: 'Canopy Laser 5', kind: 'laser', groupKey: 'laser-center', x: 11, y: 1, targetX: 10, targetY: 9, color: MAGENTA },
    { key: 'canopy-laser-6', label: 'Canopy Laser 6', kind: 'laser', groupKey: 'laser-center', x: 12, y: 1, targetX: 11, targetY: 9, color: VIOLET },
    { key: 'canopy-laser-7', label: 'Canopy Laser 7', kind: 'laser', groupKey: 'laser-right', x: 15, y: 1, targetX: 13, targetY: 9, color: MAGENTA },
    { key: 'canopy-laser-8', label: 'Canopy Laser 8', kind: 'laser', groupKey: 'laser-right', x: 18, y: 1, targetX: 15, targetY: 9, color: CYAN },
    { key: 'canopy-head-l1', label: 'Canopy Head L1', kind: 'movingHead', groupKey: 'movement-left', x: 4, y: 3, targetX: 8, targetY: 8, color: BLUE },
    { key: 'canopy-head-l2', label: 'Canopy Head L2', kind: 'movingHead', groupKey: 'movement-left', x: 7, y: 3, targetX: 9, targetY: 8, color: VIOLET },
    { key: 'canopy-head-r1', label: 'Canopy Head R1', kind: 'movingHead', groupKey: 'movement-right', x: 13, y: 3, targetX: 11, targetY: 8, color: MAGENTA },
    { key: 'canopy-head-r2', label: 'Canopy Head R2', kind: 'movingHead', groupKey: 'movement-right', x: 16, y: 3, targetX: 12, targetY: 8, color: CYAN },
    { key: 'canopy-wash-l', label: 'Canopy Wash L', kind: 'parWash', groupKey: 'wash', x: 7, y: 4, targetX: 8, targetY: 7, color: BLUE },
    { key: 'canopy-wash-r', label: 'Canopy Wash R', kind: 'parWash', groupKey: 'wash', x: 13, y: 4, targetX: 12, targetY: 7, color: MAGENTA },
    { key: 'canopy-haze', label: 'Canopy Haze', kind: 'haze', groupKey: 'atmosphere', x: 10, y: 10, color: ICE },
  ],
  banks: {
    hero: ['canopy-laser-1', 'canopy-laser-2', 'canopy-laser-7', 'canopy-laser-8'], primary: ['canopy-laser-3', 'canopy-laser-4', 'canopy-laser-5', 'canopy-laser-6'], secondary: ['canopy-laser-1', 'canopy-laser-2', 'canopy-laser-7', 'canopy-laser-8'],
    leftResponse: ['canopy-laser-1', 'canopy-laser-2', 'canopy-laser-3', 'canopy-laser-4'], rightResponse: ['canopy-laser-5', 'canopy-laser-6', 'canopy-laser-7', 'canopy-laser-8'],
    kick: ['canopy-laser-1', 'canopy-laser-8'], snare: ['canopy-head-l1', 'canopy-head-r2'], hat: ['canopy-laser-3', 'canopy-laser-6'],
    movement: ['canopy-head-l1', 'canopy-head-l2', 'canopy-head-r1', 'canopy-head-r2'], vocalIsolation: ['canopy-head-l2', 'canopy-head-r1'], wash: ['canopy-wash-l', 'canopy-wash-r'],
    atmosphere: ['canopy-haze'], impact: ['canopy-laser-4', 'canopy-laser-5'], allBeams: ['canopy-laser-1', 'canopy-laser-2', 'canopy-laser-3', 'canopy-laser-4', 'canopy-laser-5', 'canopy-laser-6', 'canopy-laser-7', 'canopy-laser-8', 'canopy-head-l1', 'canopy-head-l2', 'canopy-head-r1', 'canopy-head-r2'],
  },
  motifSequence: ['canopy', 'fan', 'crown', 'cross'],
  sectionMotifs: { intro: 'canopy', verse: 'canopy', build: 'fan', preDrop: 'spear', drop1: 'fan', breakdown: 'canopy', drop2: 'cross', outro: 'canopy' },
  palette: {
    intro: { primary: CYAN, secondary: VIOLET, accent: ICE }, verse: { primary: CYAN, secondary: MAGENTA, accent: LAVENDER }, build: { primary: VIOLET, secondary: MAGENTA, accent: WHITE },
    preDrop: { primary: ICE, secondary: VIOLET, accent: WHITE }, drop1: { primary: CYAN, secondary: MAGENTA, accent: WHITE }, breakdown: { primary: BLUE, secondary: VIOLET, accent: LAVENDER },
    drop2: { primary: CYAN, secondary: MAGENTA, accent: WHITE }, outro: { primary: CYAN, secondary: VIOLET, accent: ICE },
  },
  genreTags: ['melodic bass', 'trance', 'cinematic'], behaviorTags: ['aerial canopy', 'slow phrase drift', 'stable beat architecture'], peakBeamDemand: 212, beatStrength: 0.72, movementStyle: 'smoothSweep',
}

const CHROMATIC_CHAPTER_PROFILE: VideoInspiredProfile = {
  id: 'chromatic-chapter-stage',
  name: 'Chromatic Chapter Stage',
  description: 'A scene-first mixed-fixture show that changes visual language with musical function: blue atmosphere, warm vocal isolation, yellow-white crowns, green laser impacts, and red breakdown framing.',
  style: 'chapters', deterministicSeed: 79411, grid: { columns: 20, rows: 12 }, groups: COMMON_GROUPS,
  fixtures: [
    { key: 'chapter-laser-top-l', label: 'Chapter Laser Top L', kind: 'laser', groupKey: 'laser-left', x: 4, y: 1, targetX: 8, targetY: 10, color: CYAN },
    { key: 'chapter-laser-side-l', label: 'Chapter Laser Side L', kind: 'laser', groupKey: 'laser-left', x: 1, y: 6, targetX: 9, targetY: 8, color: GREEN },
    { key: 'chapter-laser-inner-l', label: 'Chapter Laser Inner L', kind: 'laser', groupKey: 'laser-center', x: 8, y: 2, targetX: 10, targetY: 9, color: WHITE },
    { key: 'chapter-laser-top-r', label: 'Chapter Laser Top R', kind: 'laser', groupKey: 'laser-right', x: 16, y: 1, targetX: 12, targetY: 10, color: MAGENTA },
    { key: 'chapter-laser-side-r', label: 'Chapter Laser Side R', kind: 'laser', groupKey: 'laser-right', x: 19, y: 6, targetX: 11, targetY: 8, color: GREEN },
    { key: 'chapter-laser-inner-r', label: 'Chapter Laser Inner R', kind: 'laser', groupKey: 'laser-center', x: 12, y: 2, targetX: 10, targetY: 9, color: WHITE },
    { key: 'chapter-head-l1', label: 'Chapter Head L1', kind: 'movingHead', groupKey: 'movement-left', x: 5, y: 3, targetX: 9, targetY: 8, color: BLUE },
    { key: 'chapter-head-l2', label: 'Chapter Head L2', kind: 'movingHead', groupKey: 'movement-left', x: 8, y: 3, targetX: 10, targetY: 8, color: WARM_WHITE },
    { key: 'chapter-head-r1', label: 'Chapter Head R1', kind: 'movingHead', groupKey: 'movement-right', x: 12, y: 3, targetX: 10, targetY: 8, color: WARM_WHITE },
    { key: 'chapter-head-r2', label: 'Chapter Head R2', kind: 'movingHead', groupKey: 'movement-right', x: 15, y: 3, targetX: 11, targetY: 8, color: MAGENTA },
    { key: 'chapter-wash-blue-l', label: 'Chapter Blue Wash L', kind: 'parWash', groupKey: 'wash', x: 4, y: 4, targetX: 8, targetY: 7, color: BLUE },
    { key: 'chapter-wash-blue-r', label: 'Chapter Blue Wash R', kind: 'parWash', groupKey: 'wash', x: 16, y: 4, targetX: 12, targetY: 7, color: BLUE },
    { key: 'chapter-wash-warm-l', label: 'Chapter Warm Wash L', kind: 'parWash', groupKey: 'wash', x: 7, y: 4, targetX: 9, targetY: 7, color: AMBER },
    { key: 'chapter-wash-warm-r', label: 'Chapter Warm Wash R', kind: 'parWash', groupKey: 'wash', x: 13, y: 4, targetX: 11, targetY: 7, color: RED },
    { key: 'chapter-blinder-l', label: 'Chapter Blinder L', kind: 'blinder', groupKey: 'impact', x: 8, y: 5, color: WARM_WHITE },
    { key: 'chapter-blinder-r', label: 'Chapter Blinder R', kind: 'blinder', groupKey: 'impact', x: 12, y: 5, color: WARM_WHITE },
    { key: 'chapter-strobe', label: 'Chapter Center Strobe', kind: 'strobe', groupKey: 'impact', x: 10, y: 3, color: WHITE },
    { key: 'chapter-haze', label: 'Chapter Haze', kind: 'haze', groupKey: 'atmosphere', x: 10, y: 10, color: ICE },
  ],
  banks: {
    hero: ['chapter-laser-side-l', 'chapter-laser-side-r', 'chapter-laser-top-l', 'chapter-laser-top-r'], primary: ['chapter-laser-inner-l', 'chapter-laser-inner-r', 'chapter-laser-top-l', 'chapter-laser-top-r'], secondary: ['chapter-laser-side-l', 'chapter-laser-side-r'],
    leftResponse: ['chapter-laser-top-l', 'chapter-laser-side-l', 'chapter-laser-inner-l'], rightResponse: ['chapter-laser-top-r', 'chapter-laser-side-r', 'chapter-laser-inner-r'],
    kick: ['chapter-laser-side-l', 'chapter-laser-side-r'], snare: ['chapter-head-l1', 'chapter-head-r2'], hat: ['chapter-laser-inner-l', 'chapter-laser-inner-r'],
    movement: ['chapter-head-l1', 'chapter-head-l2', 'chapter-head-r1', 'chapter-head-r2'], vocalIsolation: ['chapter-head-l2', 'chapter-head-r1'],
    wash: ['chapter-wash-blue-l', 'chapter-wash-blue-r', 'chapter-wash-warm-l', 'chapter-wash-warm-r'], impact: ['chapter-strobe', 'chapter-blinder-l', 'chapter-blinder-r'],
    strobe: ['chapter-strobe'], blinder: ['chapter-blinder-l', 'chapter-blinder-r'], atmosphere: ['chapter-haze'], allBeams: ['chapter-laser-top-l', 'chapter-laser-side-l', 'chapter-laser-inner-l', 'chapter-laser-top-r', 'chapter-laser-side-r', 'chapter-laser-inner-r', 'chapter-head-l1', 'chapter-head-l2', 'chapter-head-r1', 'chapter-head-r2'],
  },
  motifSequence: ['crown', 'fan', 'cross', 'burst'],
  sectionMotifs: { intro: 'canopy', verse: 'crown', build: 'fan', preDrop: 'spear', drop1: 'cross', breakdown: 'crown', drop2: 'burst', outro: 'spear' },
  palette: {
    intro: { primary: BLUE, secondary: CYAN, accent: ICE }, verse: { primary: WARM_WHITE, secondary: AMBER, accent: WHITE }, build: { primary: VIOLET, secondary: MAGENTA, accent: WHITE },
    preDrop: { primary: RED, secondary: WARM_WHITE, accent: WHITE }, drop1: { primary: GREEN, secondary: WHITE, accent: AMBER }, breakdown: { primary: RED, secondary: MAGENTA, accent: WARM_WHITE },
    drop2: { primary: CYAN, secondary: MAGENTA, accent: WHITE }, outro: { primary: BLUE, secondary: RED, accent: WARM_WHITE },
  },
  genreTags: ['open format', 'festival', 'cinematic bass'], behaviorTags: ['section chapters', 'mixed fixtures', 'vocal spotlight'], peakBeamDemand: 184, beatStrength: 0.94, movementStyle: 'figureEight',
}

const PROFILES: readonly VideoInspiredProfile[] = Object.freeze([
  VOCAL_ECLIPSE_PROFILE,
  EMERALD_TUNNEL_PROFILE,
  WHITE_VECTOR_PROFILE,
  AURORA_CANOPY_PROFILE,
  CHROMATIC_CHAPTER_PROFILE,
])

export function createVocalEclipseExchangeRig(createId: CreateId): LaserDmxShowDirectorState { return createRig(VOCAL_ECLIPSE_PROFILE, createId) }
export function createVocalEclipseExchangeProgram(): LaserDmxShowDirectorPerformanceProgram { return createProgram(VOCAL_ECLIPSE_PROFILE) }
export function createEmeraldTunnelRelayRig(createId: CreateId): LaserDmxShowDirectorState { return createRig(EMERALD_TUNNEL_PROFILE, createId) }
export function createEmeraldTunnelRelayProgram(): LaserDmxShowDirectorPerformanceProgram { return createProgram(EMERALD_TUNNEL_PROFILE) }
export function createWhiteVectorInterlockRig(createId: CreateId): LaserDmxShowDirectorState { return createRig(WHITE_VECTOR_PROFILE, createId) }
export function createWhiteVectorInterlockProgram(): LaserDmxShowDirectorPerformanceProgram { return createProgram(WHITE_VECTOR_PROFILE) }
export function createAuroraCanopyDriftRig(createId: CreateId): LaserDmxShowDirectorState { return createRig(AURORA_CANOPY_PROFILE, createId) }
export function createAuroraCanopyDriftProgram(): LaserDmxShowDirectorPerformanceProgram { return createProgram(AURORA_CANOPY_PROFILE) }
export function createChromaticChapterStageRig(createId: CreateId): LaserDmxShowDirectorState { return createRig(CHROMATIC_CHAPTER_PROFILE, createId) }
export function createChromaticChapterStageProgram(): LaserDmxShowDirectorPerformanceProgram { return createProgram(CHROMATIC_CHAPTER_PROFILE) }

const PROGRAM_FACTORIES: Record<VideoInspiredShowId, () => LaserDmxShowDirectorPerformanceProgram> = {
  'vocal-eclipse-exchange': createVocalEclipseExchangeProgram,
  'emerald-tunnel-relay': createEmeraldTunnelRelayProgram,
  'white-vector-interlock': createWhiteVectorInterlockProgram,
  'aurora-canopy-drift': createAuroraCanopyDriftProgram,
  'chromatic-chapter-stage': createChromaticChapterStageProgram,
}

const RIG_FACTORIES: Record<VideoInspiredShowId, (createId: CreateId) => LaserDmxShowDirectorState> = {
  'vocal-eclipse-exchange': createVocalEclipseExchangeRig,
  'emerald-tunnel-relay': createEmeraldTunnelRelayRig,
  'white-vector-interlock': createWhiteVectorInterlockRig,
  'aurora-canopy-drift': createAuroraCanopyDriftRig,
  'chromatic-chapter-stage': createChromaticChapterStageRig,
}

export const LASER_DMX_SHOW_DIRECTOR_VIDEO_INSPIRED_PERFORMANCE_PRESETS: readonly LaserDmxShowDirectorPerformancePresetDefinition[] = Object.freeze(
  PROFILES.map(profile => ({
    id: profile.id,
    name: profile.name,
    description: profile.description,
    genreTags: [...profile.genreTags],
    behaviorTags: [...profile.behaviorTags],
    supportedSectionRoles: [...ALL_SECTIONS],
    musicIntelligenceCapabilities: [...MUSIC_CAPABILITIES],
    fixtureCount: profile.fixtures.length,
    approximatePeakBeamDemand: profile.peakBeamDemand,
    createRig: RIG_FACTORIES[profile.id],
    createProgram: PROGRAM_FACTORIES[profile.id],
  })),
)
