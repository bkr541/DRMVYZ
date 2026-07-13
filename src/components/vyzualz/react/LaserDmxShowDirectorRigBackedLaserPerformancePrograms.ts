import {
  LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY,
  LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
} from './LaserDmxShowDirectorBeatActions'
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
import type { LaserDmxShowDirectorBeamTarget, LaserDmxShowDirectorFixtureKind } from './ReactTypes'

const CYAN = '#32e6ff'
const EMERALD = '#2ff0a8'
const BLUE = '#4f75ff'
const MAGENTA = '#ff3bd5'
const VIOLET = '#9b5cff'
const LAVENDER = '#c7a6ff'
const RED = '#ff334f'
const ORANGE = '#ff8a2a'
const WHITE = '#f7fbff'
const WARM_WHITE = '#ffd39a'

const BLACKOUT_POLICY = Object.freeze({
  maxPreDropBeats: 0.5,
  maxImpactCutBeats: 0.25,
  maxFakeoutBeats: 0.5,
  maximumProgrammedBlackoutRatio: 0.08,
  retriggerGuardBeats: 1,
  breakdownRequiresVisibleOutput: true,
  minimumVisibleFixtureBrightness: 0.24,
})

function targetSet(prefix: string, points: readonly (readonly [number, number])[]): LaserDmxShowDirectorBeamTarget[] {
  return points.map(([x, y], index) => ({ id: `${prefix}-${index + 1}`, x, y }))
}

function mirroredTargets(
  prefix: string,
  leftPoints: readonly (readonly [number, number])[],
  centerX: number,
): { left: LaserDmxShowDirectorBeamTarget[]; right: LaserDmxShowDirectorBeamTarget[] } {
  return {
    left: targetSet(`${prefix}-left`, leftPoints),
    right: targetSet(`${prefix}-right`, leftPoints.map(([x, y]) => [centerX + (centerX - x), y] as const)),
  }
}

function bank(
  role: string,
  fixtureSemanticKeys: readonly string[],
  label: string,
  description: string,
): LaserDmxShowDirectorAuthoredFixtureBankMetadata {
  return { role, label, description, address: { fixtureSemanticKeys: [...fixtureSemanticKeys] } }
}

function addressesFromBanks(
  banks: Readonly<Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>>,
): Record<string, LaserDmxShowDirectorPerformanceAddress> {
  return Object.fromEntries(Object.entries(banks).map(([key, value]) => [key, structuredClone(value.address)]))
}

function section(
  types: LaserDmxShowDirectorPerformanceSectionMatch['types'],
  dropOccurrence?: number[] | { minOccurrence?: number; maxOccurrence?: number; occurrences?: number[] },
): LaserDmxShowDirectorPerformanceSectionMatch {
  if (!dropOccurrence) return { types }
  return {
    types,
    dropOccurrence: Array.isArray(dropOccurrence) ? { occurrences: dropOccurrence } : dropOccurrence,
  }
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

function sceneBase(
  id: string,
  label: string,
  sectionMatch: LaserDmxShowDirectorPerformanceSectionMatch,
  fixtureKinds: LaserDmxShowDirectorFixtureKind[],
  energyEnvelopeKey: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  patch: Partial<LaserDmxShowDirectorPerformanceScene>,
): LaserDmxShowDirectorPerformanceScene {
  return {
    id,
    label,
    enabled: true,
    priority: 10,
    section: sectionMatch,
    address: { fixtureKinds },
    fixture: {
      enabled: false,
      brightness: 0.58,
      focus: 0.9,
      beamPriorityRole: 'primaryArchitecture',
      beamVisualRole: 'primary',
    },
    global: { dimmer: 0.84, globalGlow: 0.72, beamPersistence: 0.12, backgroundFade: 0.82 },
    energyEnvelopeKey,
    transitionIn: { durationBars: 0.04, curve: 'easeInOut' },
    transitionOut: { durationBars: 0.04, curve: 'easeInOut' },
    ...patch,
  }
}

function enableBank(
  id: string,
  stage: number,
  role: string,
  fixture: NonNullable<LaserDmxShowDirectorPerformanceMutationBase['fixture']>,
  cumulative = true,
): NonNullable<LaserDmxShowDirectorPerformanceScene['eightBarRecruitment']>[number] {
  return { id, stage, cumulative, address: { bankRoles: [role] }, fixture: { enabled: true, ...fixture } }
}

function alternatingBeat(
  prefix: string,
  leftRole: string,
  rightRole: string,
  options: { spreadA: number; spreadB: number; leftColor: string; rightColor: string; rotation: number },
): NonNullable<LaserDmxShowDirectorPerformanceScene['beatMutations']> {
  return [
    {
      id: `${prefix}-even-left`, beatDivision: 1, beatOffsets: [0, 2], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: [leftRole] },
      fixture: {
        brightness: 1, color: options.leftColor, fanSpread: options.spreadA, rotation: -options.rotation,
        beamAppearance: { width: 1.8, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 1, retrigger: 'restart' },
        beamPriorityRole: 'heroImpact', beamVisualRole: 'hero',
      },
    },
    {
      id: `${prefix}-even-right-rest`, beatDivision: 1, beatOffsets: [0, 2], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: [rightRole] },
      fixture: {
        brightness: LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.restingBrightness,
        fanSpread: options.spreadB, beamAppearance: { width: 0.9, glow: 0.54 },
        beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture',
      },
    },
    {
      id: `${prefix}-odd-right`, beatDivision: 1, beatOffsets: [1, 3], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: [rightRole] },
      fixture: {
        brightness: 1, color: options.rightColor, fanSpread: options.spreadA, rotation: options.rotation,
        beamAppearance: { width: 1.8, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 1, retrigger: 'restart' },
        beamPriorityRole: 'heroImpact', beamVisualRole: 'hero',
      },
    },
    {
      id: `${prefix}-odd-left-rest`, beatDivision: 1, beatOffsets: [1, 3], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: [leftRole] },
      fixture: {
        brightness: LASER_DMX_SHOW_DIRECTOR_BEAT_PERCEPTIBILITY.restingBrightness,
        fanSpread: options.spreadB, beamAppearance: { width: 0.9, glow: 0.54 },
        beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture',
      },
    },
  ]
}

function barOpposition(
  prefix: string,
  role: string,
  targetA: Record<string, LaserDmxShowDirectorBeamTarget[]>,
  targetB: Record<string, LaserDmxShowDirectorBeamTarget[]>,
  rotation = 7,
): NonNullable<LaserDmxShowDirectorPerformanceScene['barMutations']> {
  return [
    {
      id: `${prefix}-bar-a`, intervalBars: 2, anchorBar: 0, address: { bankRoles: [role] },
      fixture: { rotation: -rotation, targetMode: 'fixed', targetPointsByFixtureSemanticKey: targetA, beamTravel: { direction: 'forward' } },
    },
    {
      id: `${prefix}-bar-b`, intervalBars: 2, anchorBar: 1, address: { bankRoles: [role] },
      fixture: { rotation, targetMode: 'fixed', targetPointsByFixtureSemanticKey: targetB, beamTravel: { direction: 'reverse' } },
    },
  ]
}

function fourMotifs(
  prefix: string,
  role: string,
  motifs: readonly { id: string; targets: Record<string, LaserDmxShowDirectorBeamTarget[]>; spread: number; color?: string }[],
): NonNullable<LaserDmxShowDirectorPerformanceScene['fourBarVariations']> {
  return motifs.map(motif => ({
    id: `${prefix}-${motif.id}`,
    motifFamily: motif.id,
    address: { bankRoles: [role] },
    fixture: {
      targetMode: 'fixed',
      targetPointsByFixtureSemanticKey: motif.targets,
      fanSpread: motif.spread,
      ...(motif.color ? { color: motif.color } : {}),
    },
  }))
}

function cadenceResponses(
  prefix: string,
  roles: { kick: string; kickRest: string; snare: string; snareRest: string; hat: string; transient: string; downbeat: string },
  colors: { kick: string; snare: string; hat: string; transient: string },
  options: { kickSpread: number; snareSpread: number; transientSpread: number },
): Pick<LaserDmxShowDirectorPerformanceScene, 'kickMutations' | 'snareMutations' | 'hatMutations' | 'transientMutations'> {
  return {
    kickMutations: [
      {
        id: `${prefix}-kick`, threshold: 0.38, address: { bankRoles: [roles.kick] },
        fixture: {
          brightness: 1, color: colors.kick, fanSpread: options.kickSpread,
          beamAppearance: { width: 2.3, glow: 1 }, beamTravel: { mode: 'grow', beatsPerTravel: 1, retrigger: 'restart' },
          beamPriorityRole: 'heroImpact', beamVisualRole: 'hero',
        },
      },
      {
        id: `${prefix}-kick-duck`, threshold: 0.38, address: { bankRoles: [roles.kickRest] },
        fixture: { brightness: 0.38, beamAppearance: { width: 0.85, glow: 0.48 }, beamPriorityRole: 'decorativeAccent', beamVisualRole: 'texture' },
      },
    ],
    snareMutations: [
      {
        id: `${prefix}-snare`, threshold: 0.38, address: { bankRoles: [roles.snare] },
        fixture: {
          enabled: true, brightness: 1, color: colors.snare, fanSpread: options.snareSpread,
          beamAppearance: { width: 2.5, glow: 1 }, beamTravel: { mode: 'scanner', beatsPerTravel: 0.5, retrigger: 'restart' },
          beamPriorityRole: 'heroImpact', beamVisualRole: 'impact',
        },
      },
      {
        id: `${prefix}-snare-duck`, threshold: 0.38, address: { bankRoles: [roles.snareRest] },
        fixture: { brightness: 0.42, beamAppearance: { width: 0.9, glow: 0.52 }, beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' },
      },
    ],
    hatMutations: [{
      id: `${prefix}-hat`, threshold: 0.28, address: { bankRoles: [roles.hat] },
      fixture: {
        enabled: true, brightness: 0.8, color: colors.hat, fanSpread: Math.max(18, options.snareSpread - 22),
        beamAppearance: { width: 1.1, glow: 0.78 }, beamTravel: { mode: 'pulseTrain', beatsPerTravel: 0.5, retrigger: 'restart' },
        beamPriorityRole: 'detailLattice', beamVisualRole: 'texture',
      },
    }],
    transientMutations: [{
      id: `${prefix}-transient`, threshold: 0.62, address: { bankRoles: [roles.transient] }, durationBeats: 0.25,
      fixture: {
        enabled: true, brightness: 1, color: colors.transient, fanSpread: options.transientSpread,
        beamAppearance: { width: 2.8, glow: 1, geometry: 'volumetricCone' }, beamTravel: { mode: 'projectile', beatsPerTravel: 0.5, retrigger: 'restart' },
        beamPriorityRole: 'heroImpact', beamVisualRole: 'impact',
      },
    }],
  }
}

function commonModulations(_role: string): NonNullable<LaserDmxShowDirectorPerformanceScene['modulations']> {
  return [
    { source: 'nBass', target: 'fixture.fanSpread', amount: 16, min: 0, max: 16, mode: 'add', requiredCapability: 'Live Bands' },
    { source: 'trackEnergy', target: 'fixture.brightness', amount: 0.12, min: 0, max: 0.12, mode: 'add', requiredCapability: 'Track Energy Curve' },
    { source: 'spectralFlux', target: 'fixture.beamWidth', amount: 0.45, min: 0, max: 0.45, mode: 'add' },
  ]
}

// Small Club Performance -----------------------------------------------------

const CLUB_LASERS = ['club-laser-l', 'club-laser-r'] as const
const CLUB_MOVERS = ['moving-head-l', 'moving-head-r'] as const
const CLUB_LEDS = ['front-led-bar-l', 'front-led-bar-r'] as const

export const SMALL_CLUB_PERFORMANCE_BANKS = Object.freeze({
  lowerKick: bank('kick', CLUB_LASERS, 'Lower kick bank', 'Paired lower club lasers that open on kick events.'),
  upperSnare: bank('snare', [...CLUB_MOVERS, 'center-strobe'], 'Upper snare bank', 'Moving-head crown with a bounded center strobe accent.'),
  leftCall: bank('left', ['club-laser-l', 'moving-head-l', 'front-led-bar-l'], 'Left call bank', 'Left-side call architecture.'),
  rightResponse: bank('right', ['club-laser-r', 'moving-head-r', 'front-led-bar-r'], 'Right response bank', 'Right-side response architecture.'),
  outerHero: bank('hero', CLUB_LASERS, 'Outer hero bank', 'Primary compact fan edges and tunnel walls.'),
  innerPrimary: bank('primary', CLUB_MOVERS, 'Inner primary bank', 'Upper inner crown and secondary tunnel depth.'),
  texture: bank('texture', [...CLUB_LEDS, 'back-wash', 'soft-haze'], 'Texture bank', 'LED, wash, and haze support shed first under pressure.'),
  boundedImpact: bank('impact', ['center-strobe'], 'Bounded impact bank', 'Short-lived center strobe accent.'),
  allBeams: bank('primary', [...CLUB_LASERS, ...CLUB_MOVERS], 'All beam fixtures', 'All authored laser and moving-head beam sources.'),
  beatLeft: bank('left', ['club-laser-l', 'moving-head-l'], 'Beat left bank', 'Left beat responder.'),
  beatRight: bank('right', ['club-laser-r', 'moving-head-r'], 'Beat right bank', 'Right beat responder.'),
  kickRest: bank('secondary', CLUB_MOVERS, 'Kick rest bank', 'Upper fixtures ducked beneath kick geometry.'),
  snareRest: bank('secondary', CLUB_LASERS, 'Snare rest bank', 'Lower fixtures ducked beneath snare crowns.'),
  hatTexture: bank('hat', CLUB_LEDS, 'Hat texture bank', 'LED cells used for high-frequency detail.'),
} satisfies Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>)

const clubNarrow = mirroredTargets('club-narrow-tunnel', [[3.2, 2], [4.2, 2.6], [5.1, 3.4], [5.8, 4.4]], 7)
const clubWide = mirroredTargets('club-wide-fan', [[1.2, 1.2], [2.8, 1.8], [4.2, 2.8], [5.8, 4.1], [5.6, 6.8], [3.7, 8.2]], 7)
const clubDiamond = mirroredTargets('club-diamond', [[5.8, 2.7], [5.1, 4.3], [5.8, 6.1], [4.8, 7.5]], 7)
const clubWings = mirroredTargets('club-wings', [[0.8, 3.2], [2.2, 2], [3.8, 1.5], [5.4, 3.2], [5.1, 6.8]], 7)
const clubSpears = mirroredTargets('club-spears', [[5.7, 2.2], [5.4, 4.4]], 7)
const clubCrown = mirroredTargets('club-crown', [[4.3, 1.3], [5.4, 1.8], [5.9, 2.8], [5.2, 3.7]], 7)

function clubMap(pair: { left: LaserDmxShowDirectorBeamTarget[]; right: LaserDmxShowDirectorBeamTarget[] }, includeMovers = true) {
  return {
    'club-laser-l': pair.left,
    'club-laser-r': pair.right,
    ...(includeMovers ? { 'moving-head-l': pair.left.slice().reverse(), 'moving-head-r': pair.right.slice().reverse() } : {}),
  }
}

function clubSceneCadence(
  sceneId: string,
  leftColor: string,
  rightColor: string,
  spread: number,
  motifs: readonly { id: string; targets: Record<string, LaserDmxShowDirectorBeamTarget[]>; spread: number; color?: string }[],
): Partial<LaserDmxShowDirectorPerformanceScene> {
  return {
    beatMutations: alternatingBeat(sceneId, 'beatLeft', 'beatRight', { spreadA: spread, spreadB: Math.max(12, spread - 24), leftColor, rightColor, rotation: 7 }),
    barMutations: barOpposition(sceneId, 'allBeams', clubMap(clubNarrow), clubMap(clubDiamond), 6),
    fourBarVariations: fourMotifs(sceneId, 'allBeams', motifs),
    sixteenBarEvolution: [{
      id: `${sceneId}-phrase-evolution`, phase: 1, phraseLengthBars: 16, address: { bankRoles: ['innerPrimary'] },
      fixture: { brightness: 0.86, color: VIOLET, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubCrown) },
    }],
    ...cadenceResponses(sceneId, {
      kick: 'lowerKick', kickRest: 'kickRest', snare: 'upperSnare', snareRest: 'snareRest',
      hat: 'hatTexture', transient: 'boundedImpact', downbeat: 'outerHero',
    }, { kick: CYAN, snare: WHITE, hat: MAGENTA, transient: WHITE }, {
      kickSpread: Math.max(34, spread + 12), snareSpread: Math.max(28, spread), transientSpread: 24,
    }),
  }
}

function clubIntro(): LaserDmxShowDirectorPerformanceScene {
  const id = 'small-club-intro'
  return sceneBase(id, 'Small Club Performance · Intro', section(['intro']), ['laser', 'movingHead', 'ledBar', 'strobe', 'parWash', 'haze'], 'intro', {
    global: { dimmer: 0.52, globalGlow: 0.56, beamPersistence: 0.18, backgroundFade: 0.9, haze: 0.18 },
    eightBarRecruitment: [
      enableBank(`${id}-outer-pair`, 1, 'outerHero', { brightness: 0.5, color: CYAN, fanSpread: 20, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubSpears, false), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-inner-crown`, 2, 'innerPrimary', { brightness: 0.46, color: VIOLET, fanSpread: 18, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubCrown), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    ],
    ...clubSceneCadence(id, CYAN, VIOLET, 30, [
      { id: 'paired-spears', targets: clubMap(clubSpears), spread: 16 },
      { id: 'narrow-tunnel', targets: clubMap(clubNarrow), spread: 24 },
      { id: 'upper-crown', targets: clubMap(clubCrown), spread: 22, color: LAVENDER },
      { id: 'quiet-diamond', targets: clubMap(clubDiamond), spread: 26 },
    ]),
  })
}

function clubVerse(): LaserDmxShowDirectorPerformanceScene {
  const id = 'small-club-verse'
  return sceneBase(id, 'Small Club Performance · Verse', section(['verse']), ['laser', 'movingHead', 'ledBar', 'strobe', 'parWash', 'haze'], 'verse', {
    global: { dimmer: 0.7, globalGlow: 0.68, beamPersistence: 0.14, backgroundFade: 0.84, haze: 0.24 },
    eightBarRecruitment: [
      enableBank(`${id}-tunnel`, 1, 'outerHero', { brightness: 0.72, color: CYAN, fanSpread: 38, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubNarrow, false), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-inner-depth`, 2, 'innerPrimary', { brightness: 0.66, color: VIOLET, fanSpread: 30, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubCrown), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
      { id: `${id}-led-texture`, stage: 3, address: { bankRoles: ['hatTexture'] }, fixtureActions: [{ id: `${id}-led`, kind: 'led', enabled: true, brightness: 0.52, color: MAGENTA, direction: 'centerOut' }] },
    ],
    ...clubSceneCadence(id, CYAN, MAGENTA, 48, [
      { id: 'mirrored-tunnel', targets: clubMap(clubNarrow), spread: 34 },
      { id: 'compact-diamond', targets: clubMap(clubDiamond), spread: 42 },
      { id: 'lower-wings', targets: clubMap(clubWings), spread: 48 },
      { id: 'crown-tunnel', targets: clubMap(clubCrown), spread: 40, color: VIOLET },
    ]),
    modulations: commonModulations('allBeams'),
  })
}

function clubBuild(): LaserDmxShowDirectorPerformanceScene {
  const id = 'small-club-build'
  return sceneBase(id, 'Small Club Performance · Build', section(['build']), ['laser', 'movingHead', 'ledBar', 'strobe', 'parWash', 'haze'], 'build', {
    global: { dimmer: 0.82, globalGlow: 0.8, beamPersistence: 0.1, backgroundFade: 0.82, haze: 0.32 },
    eightBarRecruitment: [
      enableBank(`${id}-lower`, 1, 'lowerKick', { brightness: 0.76, color: CYAN, fanSpread: 46, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubNarrow, false), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-upper`, 2, 'innerPrimary', { brightness: 0.8, color: VIOLET, fanSpread: 54, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubCrown), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
      { id: `${id}-texture`, stage: 3, address: { bankRoles: ['texture'] }, fixtureActions: [
        { id: `${id}-led`, kind: 'led', enabled: true, brightness: 0.72, color: MAGENTA, direction: 'edgesIn' },
        { id: `${id}-wash`, kind: 'wash', enabled: true, brightness: 0.5, color: BLUE, fanSpread: 64, focus: 0.42 },
        { id: `${id}-haze`, kind: 'haze', enabled: true, brightness: 0.34, amount: 0.42 },
      ] },
    ],
    barProgression: [
      { id: `${id}-bar-two-side-recruit`, stageBar: 2, address: { bankRoles: ['leftCall', 'rightResponse'] }, fixture: { enabled: true, brightness: 0.78, fanSpread: 52 } },
      { id: `${id}-bar-four-crown`, stageBar: 4, address: { bankRoles: ['upperSnare'] }, fixture: { enabled: true, brightness: 0.86, color: LAVENDER, fanSpread: 62 } },
    ],
    sectionExitMutations: [{ id: `${id}-compress`, durationBeats: 1, address: { bankRoles: ['allBeams'] }, fixture: { fanSpread: 10, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubSpears), brightness: 0.72 }, global: { dimmer: 0.72 } }],
    ...clubSceneCadence(id, CYAN, MAGENTA, 66, [
      { id: 'tunnel-expand', targets: clubMap(clubNarrow), spread: 52 },
      { id: 'diamond-rise', targets: clubMap(clubDiamond), spread: 62 },
      { id: 'wing-recruit', targets: clubMap(clubWings), spread: 72 },
      { id: 'crown-lock', targets: clubMap(clubCrown), spread: 58, color: LAVENDER },
    ]),
    modulations: commonModulations('allBeams'),
  })
}

function clubPreDrop(): LaserDmxShowDirectorPerformanceScene {
  const id = 'small-club-pre-drop'
  return sceneBase(id, 'Small Club Performance · Pre-drop', section(['preDrop']), ['laser', 'movingHead', 'ledBar', 'strobe', 'parWash', 'haze'], 'preDrop', {
    global: { dimmer: 0.64, globalGlow: 0.58, beamPersistence: 0.06, backgroundFade: 0.92, haze: 0.18 },
    blackoutWindows: [{ id: `${id}-final-half-beat`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: 0.5, justification: 'Purposeful compact tension cut before the authored drop impact.' }],
    eightBarRecruitment: [
      enableBank(`${id}-aperture`, 1, 'outerHero', { brightness: 0.68, color: VIOLET, fanSpread: 12, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubSpears, false), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-upper-slit`, 2, 'innerPrimary', { brightness: 0.54, color: WHITE, fanSpread: 8, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubSpears), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    ],
    ...clubSceneCadence(id, VIOLET, CYAN, 24, [
      { id: 'aperture', targets: clubMap(clubSpears), spread: 10 },
      { id: 'compressed-diamond', targets: clubMap(clubDiamond), spread: 16 },
      { id: 'split-slit', targets: clubMap(clubNarrow), spread: 14 },
      { id: 'held-spears', targets: clubMap(clubSpears), spread: 8, color: WHITE },
    ]),
  })
}

function clubDrop(dropTwo: boolean): LaserDmxShowDirectorPerformanceScene {
  const suffix = dropTwo ? 'drop-2' : 'drop-1'
  const id = `small-club-${suffix}`
  const motifs = dropTwo
    ? [
      { id: 'double-tunnel', targets: clubMap(clubWide), spread: 82 },
      { id: 'expanded-diamond', targets: clubMap(clubDiamond), spread: 92 },
      { id: 'diagonal-wings', targets: clubMap(clubWings), spread: 104 },
      { id: 'crown-and-floor', targets: clubMap(clubCrown), spread: 88, color: MAGENTA },
    ]
    : [
      { id: 'compact-fan', targets: clubMap(clubWide, false), spread: 72 },
      { id: 'club-diamond', targets: clubMap(clubDiamond, false), spread: 78 },
      { id: 'lower-wings', targets: clubMap(clubWings, false), spread: 84 },
      { id: 'narrow-tunnel-return', targets: clubMap(clubNarrow, false), spread: 68, color: VIOLET },
    ]
  return sceneBase(id, `Small Club Performance · ${dropTwo ? 'Drop 2+' : 'Drop 1'}`, section(['drop'], dropTwo ? { minOccurrence: 2 } : [1]), ['laser', 'movingHead', 'ledBar', 'strobe', 'parWash', 'haze'], dropTwo ? 'drop2' : 'drop1', {
    global: { dimmer: 1, globalGlow: 0.94, beamPersistence: 0.08, backgroundFade: 0.78, haze: dropTwo ? 0.4 : 0.34 },
    transitionIn: { durationBars: 0.02, curve: 'step' },
    eightBarRecruitment: dropTwo ? [
      enableBank(`${id}-lower`, 1, 'outerHero', { brightness: 1, color: CYAN, fanSpread: 94, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubWide, false), beamPriorityRole: 'heroImpact', beamVisualRole: 'hero', beamAppearance: { width: 2.1, glow: 1 } }),
      enableBank(`${id}-upper`, 1, 'innerPrimary', { brightness: 0.9, color: MAGENTA, fanSpread: 82, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubCrown), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
      { id: `${id}-led-depth`, stage: 1, address: { bankRoles: ['hatTexture'] }, fixtureActions: [{ id: `${id}-led`, kind: 'led', enabled: true, brightness: 0.78, color: VIOLET, direction: 'chase' }] },
      { id: `${id}-wash-haze`, stage: 1, address: { bankRoles: ['texture'] }, fixtureActions: [
        { id: `${id}-wash`, kind: 'wash', enabled: true, brightness: 0.58, color: BLUE, fanSpread: 72, focus: 0.44 },
        { id: `${id}-haze`, kind: 'haze', enabled: true, brightness: 0.38, amount: 0.48 },
      ] },
      enableBank(`${id}-second-layer`, 2, 'allBeams', { brightness: 1, fanSpread: 110, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubWings), beamPriorityRole: 'heroImpact' }),
    ] : [
      enableBank(`${id}-lower`, 1, 'outerHero', { brightness: 1, color: CYAN, fanSpread: 82, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubWide, false), beamPriorityRole: 'heroImpact', beamVisualRole: 'hero', beamAppearance: { width: 2.05, glow: 1 } }),
      enableBank(`${id}-upper`, 2, 'innerPrimary', { brightness: 0.86, color: MAGENTA, fanSpread: 68, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubCrown), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
      { id: `${id}-led-depth`, stage: 3, address: { bankRoles: ['hatTexture'] }, fixtureActions: [{ id: `${id}-led`, kind: 'led', enabled: true, brightness: 0.7, color: VIOLET, direction: 'centerOut' }] },
    ],
    sectionEntryMutations: [
      { id: `${id}-impact-open`, durationBeats: 0.5, address: { bankRoles: ['outerHero'] }, fixture: { enabled: true, brightness: 1, color: WHITE, fanSpread: dropTwo ? 118 : 96, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(dropTwo ? clubWings : clubWide, false), beamPriorityRole: 'heroImpact', beamVisualRole: 'impact', beamAppearance: { width: 2.8, glow: 1 } } },
      { id: `${id}-bounded-strobe`, durationBeats: 0.25, address: { bankRoles: ['boundedImpact'] }, fixtureActions: [{ id: `${id}-strobe`, kind: 'strobe', active: true, brightness: 1, color: WHITE, rateHz: 18, durationMs: 110 }] },
    ],
    ...clubSceneCadence(id, CYAN, MAGENTA, dropTwo ? 104 : 86, motifs),
    snareMutations: [
      ...cadenceResponses(id, { kick: 'lowerKick', kickRest: 'kickRest', snare: 'upperSnare', snareRest: 'snareRest', hat: 'hatTexture', transient: 'boundedImpact', downbeat: 'outerHero' }, { kick: CYAN, snare: WHITE, hat: MAGENTA, transient: WHITE }, { kickSpread: dropTwo ? 120 : 100, snareSpread: dropTwo ? 96 : 82, transientSpread: 26 }).snareMutations!,
      { id: `${id}-snare-strobe`, threshold: 0.38, durationBeats: 0.25, address: { bankRoles: ['boundedImpact'] }, fixtureActions: [{ id: `${id}-snare-strobe-action`, kind: 'strobe', active: true, brightness: 1, color: WHITE, rateHz: 20, durationMs: 90 }] },
    ],
    modulations: commonModulations('allBeams'),
  })
}

function clubBreakdown(): LaserDmxShowDirectorPerformanceScene {
  const id = 'small-club-breakdown'
  return sceneBase(id, 'Small Club Performance · Breakdown', section(['breakdown', 'bridge']), ['laser', 'movingHead', 'ledBar', 'strobe', 'parWash', 'haze'], 'breakdown', {
    global: { dimmer: 0.5, globalGlow: 0.54, beamPersistence: 0.24, backgroundFade: 0.9, haze: 0.18 },
    eightBarRecruitment: [
      enableBank(`${id}-spears`, 1, 'outerHero', { brightness: 0.48, color: LAVENDER, fanSpread: 10, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubSpears, false), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-single-crown`, 2, 'innerPrimary', { brightness: 0.42, color: WHITE, fanSpread: 8, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubCrown), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    ],
    ...clubSceneCadence(id, LAVENDER, WHITE, 22, [
      { id: 'lavender-spears', targets: clubMap(clubSpears), spread: 8 },
      { id: 'white-crown', targets: clubMap(clubCrown), spread: 12, color: WHITE },
      { id: 'quiet-tunnel', targets: clubMap(clubNarrow), spread: 16 },
      { id: 'single-diamond', targets: clubMap(clubDiamond), spread: 14, color: LAVENDER },
    ]),
  })
}

function clubOutro(): LaserDmxShowDirectorPerformanceScene {
  const id = 'small-club-outro'
  return sceneBase(id, 'Small Club Performance · Outro', section(['outro']), ['laser', 'movingHead', 'ledBar', 'strobe', 'parWash', 'haze'], 'outro', {
    global: { dimmer: 0.48, globalGlow: 0.5, beamPersistence: 0.18, backgroundFade: 0.92, haze: 0.12 },
    eightBarRecruitment: [
      enableBank(`${id}-paired-release`, 1, 'outerHero', { brightness: 0.46, color: CYAN, fanSpread: 24, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubNarrow, false), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-upper-release`, 2, 'innerPrimary', { brightness: 0.38, color: VIOLET, fanSpread: 16, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubSpears), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    ],
    barProgression: [
      { id: `${id}-four`, stageBar: 1, cumulative: false, address: { bankRoles: ['allBeams'] }, fixture: { enabled: true, brightness: 0.46, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubNarrow), fanSpread: 24 } },
      { id: `${id}-two`, stageBar: 3, cumulative: false, address: { bankRoles: ['outerHero'] }, fixture: { enabled: true, brightness: 0.4, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubSpears, false), fanSpread: 12 } },
      { id: `${id}-one-side`, stageBar: 5, cumulative: false, address: { bankRoles: ['beatLeft'] }, fixture: { enabled: true, brightness: 0.34, color: LAVENDER, targetMode: 'fixed', targetPointsByFixtureSemanticKey: clubMap(clubSpears), fanSpread: 8 } },
    ],
    sectionExitMutations: [{ id: `${id}-fade`, durationBeats: 0.5, global: { dimmer: 0.12, globalGlow: 0.24 } }],
    ...clubSceneCadence(id, CYAN, VIOLET, 28, [
      { id: 'tunnel-release', targets: clubMap(clubNarrow), spread: 22 },
      { id: 'diamond-release', targets: clubMap(clubDiamond), spread: 18 },
      { id: 'paired-spears', targets: clubMap(clubSpears), spread: 12 },
      { id: 'final-slit', targets: clubMap(clubSpears), spread: 7, color: WHITE },
    ]),
  })
}

const SMALL_CLUB_ENVELOPES = Object.freeze({
  intro: envelope([1, 2], [4, 24], [0.32, 0.58], [8, 30], [0.08, 0.28], [0.34, 0.62], [0.08, 0.24], [0.72, 0.94]),
  verse: envelope([2, 4], [16, 52], [0.46, 0.76], [24, 52], [0.18, 0.48], [0.5, 0.76], [0.22, 0.48], [0.52, 0.8]),
  build: envelope([2, 6], [28, 86], [0.58, 0.9], [36, 76], [0.3, 0.74], [0.62, 0.88], [0.34, 0.72], [0.36, 0.7]),
  preDrop: envelope([1, 2], [4, 22], [0.34, 0.7], [6, 20], [0.05, 0.24], [0.3, 0.64], [0.04, 0.22], [0.78, 0.96]),
  drop1: envelope([3, 6], [48, 108], [0.72, 1], [58, 102], [0.58, 1], [0.76, 1], [0.58, 0.9], [0.26, 0.56]),
  breakdown: envelope([1, 2], [4, 20], [0.28, 0.56], [5, 22], [0.04, 0.22], [0.32, 0.58], [0.04, 0.2], [0.78, 0.96]),
  drop2: envelope([4, 8], [72, 148], [0.78, 1], [72, 124], [0.68, 1], [0.82, 1], [0.68, 1], [0.2, 0.5]),
  outro: envelope([1, 3], [4, 24], [0.24, 0.52], [5, 28], [0.04, 0.24], [0.26, 0.54], [0.04, 0.22], [0.76, 0.96]),
})

export function createSmallClubPerformanceProgram(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 3,
    id: 'small-club-rig-performance',
    name: 'Small Club Performance',
    description: 'A compact cyan-violet club show built from tight local fans, mirrored tunnel walls, controlled diamonds, upper snare crowns, and a protected central aperture.',
    deterministicSeed: 0x5c1b,
    fallbackOrder: ['verse', 'intro', 'breakdown'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    fixtureBanks: structuredClone(SMALL_CLUB_PERFORMANCE_BANKS),
    bankRoles: addressesFromBanks(SMALL_CLUB_PERFORMANCE_BANKS),
    energyEnvelopes: SMALL_CLUB_ENVELOPES,
    blackoutPolicy: BLACKOUT_POLICY,
    diagnostics: {
      authoringVersion: 'rig-performance-02',
      expectedFixtureSemanticKeys: ['front-led-bar-l', 'front-led-bar-r', 'club-laser-l', 'club-laser-r', 'moving-head-l', 'moving-head-r', 'center-strobe', 'back-wash', 'soft-haze'],
      notes: ['Canonical source rig: small-club-rig', 'Protected narrow center aperture', 'Bounded strobe-only impacts'],
    },
    scenes: [clubIntro(), clubVerse(), clubBuild(), clubPreDrop(), clubDrop(false), clubBreakdown(), clubDrop(true), clubOutro()],
  }
}

// Festival Front Beams Performance -----------------------------------------

const FESTIVAL_LASERS = ['front-beam-1', 'front-beam-2', 'front-beam-3', 'front-beam-4'] as const
const FESTIVAL_MOVERS = ['sweep-head-1', 'sweep-head-2'] as const

export const FESTIVAL_FRONT_BEAMS_PERFORMANCE_BANKS = Object.freeze({
  leftHeroEdge: bank('hero', ['front-beam-1'], 'Left hero edge', 'Outer-left fan edge and downbeat expansion source.'),
  rightHeroEdge: bank('hero', ['front-beam-4'], 'Right hero edge', 'Outer-right fan edge and downbeat expansion source.'),
  innerPrimary: bank('primary', ['front-beam-2', 'front-beam-3'], 'Inner primary fans', 'Dominant broad festival fan rays.'),
  lowerKick: bank('kick', ['front-beam-2', 'front-beam-3'], 'Lower kick expansion bank', 'Inner lower front beams that open on kicks.'),
  upperSnare: bank('snare', FESTIVAL_MOVERS, 'Upper snare crown bank', 'Moving-head crown that separates snare responses from kick fans.'),
  fourBarSubdivision: bank('secondary', ['sweep-head-1', 'sweep-head-2'], 'Four-bar subdivision bank', 'Secondary crown and diagonal motif mutations.'),
  eightBarRecruitment: bank('secondary', ['front-beam-1', 'front-beam-4', 'festival-wash-l', 'festival-wash-r'], 'Eight-bar recruitment bank', 'Outer hero edges and stage washes recruited at macro cadence.'),
  texture: bank('texture', ['festival-wash-l', 'festival-wash-r'], 'Texture bank', 'Stage wash support shed before architectural beams.'),
  boundedImpact: bank('impact', ['front-beam-1', 'front-beam-4'], 'Bounded impact bank', 'Short-lived white or warm outer-edge impacts.'),
  allBeams: bank('primary', [...FESTIVAL_LASERS, ...FESTIVAL_MOVERS], 'All beam fixtures', 'All front-line lasers and moving heads.'),
  leftBeat: bank('left', ['front-beam-1', 'front-beam-2', 'sweep-head-1'], 'Left beat bank', 'Left-side fan and crown response.'),
  rightBeat: bank('right', ['front-beam-3', 'front-beam-4', 'sweep-head-2'], 'Right beat bank', 'Right-side fan and crown response.'),
  kickRest: bank('secondary', ['front-beam-1', 'front-beam-4', ...FESTIVAL_MOVERS], 'Kick rest bank', 'Outer and upper beams ducked under kick expansion.'),
  snareRest: bank('secondary', FESTIVAL_LASERS, 'Snare rest bank', 'Front-line fan ducked under crown hits.'),
  hatTexture: bank('hat', ['festival-wash-l', 'festival-wash-r'], 'Hat texture bank', 'High-frequency wash shimmer.'),
} satisfies Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>)

const festivalNarrow = mirroredTargets('festival-narrow', [[2.2, 2], [4.3, 2.3], [6.2, 3], [7.3, 4.2]], 8.5)
const festivalBroad = mirroredTargets('festival-broad', [[0.7, 1], [2.5, 0.8], [4.2, 1.3], [5.8, 2.2], [7.1, 3.4], [7.4, 5], [6.8, 7.4], [5.2, 9.6]], 8.5)
const festivalRadial = mirroredTargets('festival-radial', [[1, 5.5], [2.4, 3.2], [4.1, 1.5], [6.1, 1], [7.2, 2.8], [7.4, 5.2], [6.7, 8.1], [4.8, 10.5]], 8.5)
const festivalDiagonal = mirroredTargets('festival-diagonal', [[1.2, 9.5], [2.8, 7.7], [4.5, 5.8], [6.2, 3.8], [7.3, 2]], 8.5)
const festivalSpears = mirroredTargets('festival-spears', [[7.1, 2], [7.4, 4.2]], 8.5)
const festivalCrown = mirroredTargets('festival-crown', [[4, 0.8], [5.5, 1.1], [6.8, 1.8], [7.4, 3]], 8.5)

function festivalMap(pair: { left: LaserDmxShowDirectorBeamTarget[]; right: LaserDmxShowDirectorBeamTarget[] }) {
  return {
    'front-beam-1': pair.left,
    'front-beam-2': pair.left.slice(1),
    'front-beam-3': pair.right.slice(1),
    'front-beam-4': pair.right,
    'sweep-head-1': pair.left.slice().reverse(),
    'sweep-head-2': pair.right.slice().reverse(),
  }
}

function festivalSceneCadence(
  sceneId: string,
  spread: number,
  motifs: readonly { id: string; targets: Record<string, LaserDmxShowDirectorBeamTarget[]>; spread: number; color?: string }[],
): Partial<LaserDmxShowDirectorPerformanceScene> {
  return {
    beatMutations: alternatingBeat(sceneId, 'leftBeat', 'rightBeat', { spreadA: spread, spreadB: Math.max(18, spread - 30), leftColor: CYAN, rightColor: MAGENTA, rotation: 10 }),
    barMutations: barOpposition(sceneId, 'allBeams', festivalMap(festivalBroad), festivalMap(festivalDiagonal), 9),
    fourBarVariations: fourMotifs(sceneId, 'allBeams', motifs),
    sixteenBarEvolution: [{ id: `${sceneId}-phrase-radial`, phase: 1, phraseLengthBars: 16, address: { bankRoles: ['fourBarSubdivision'] }, fixture: { brightness: 0.9, color: VIOLET, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalRadial), fanSpread: spread + 18 } }],
    ...cadenceResponses(sceneId, { kick: 'lowerKick', kickRest: 'kickRest', snare: 'upperSnare', snareRest: 'snareRest', hat: 'hatTexture', transient: 'boundedImpact', downbeat: 'leftHeroEdge' }, { kick: CYAN, snare: WHITE, hat: VIOLET, transient: WHITE }, { kickSpread: spread + 18, snareSpread: spread, transientSpread: spread + 28 }),
  }
}

function festivalScene(
  kind: 'intro' | 'verse' | 'build' | 'preDrop' | 'drop1' | 'breakdown' | 'drop2' | 'outro',
): LaserDmxShowDirectorPerformanceScene {
  const id = `festival-${kind === 'drop1' ? 'drop-1' : kind === 'drop2' ? 'drop-2' : kind === 'preDrop' ? 'pre-drop' : kind}`
  const sectionMatch = kind === 'drop1' ? section(['drop'], [1]) : kind === 'drop2' ? section(['drop'], { minOccurrence: 2 }) : kind === 'breakdown' ? section(['breakdown', 'bridge']) : kind === 'preDrop' ? section(['preDrop']) : section([kind])
  const energyKey = kind === 'drop1' ? 'drop1' : kind === 'drop2' ? 'drop2' : kind
  const dropTwo = kind === 'drop2'
  const sceneSettings = {
    intro: { dimmer: 0.54, glow: 0.58, spread: 34, haze: 0.14 },
    verse: { dimmer: 0.72, glow: 0.7, spread: 58, haze: 0.2 },
    build: { dimmer: 0.86, glow: 0.84, spread: 82, haze: 0.28 },
    preDrop: { dimmer: 0.62, glow: 0.58, spread: 30, haze: 0.12 },
    drop1: { dimmer: 1, glow: 0.96, spread: 108, haze: 0.36 },
    breakdown: { dimmer: 0.5, glow: 0.54, spread: 24, haze: 0.16 },
    drop2: { dimmer: 1, glow: 1, spread: 132, haze: 0.42 },
    outro: { dimmer: 0.48, glow: 0.5, spread: 30, haze: 0.1 },
  }[kind]
  const motifSets = kind === 'intro' || kind === 'breakdown' || kind === 'outro'
    ? [
      { id: 'outer-spears', targets: festivalMap(festivalSpears), spread: 16 },
      { id: 'narrow-frame', targets: festivalMap(festivalNarrow), spread: 24 },
      { id: 'quiet-crown', targets: festivalMap(festivalCrown), spread: 22, color: LAVENDER },
      { id: 'paired-diagonal', targets: festivalMap(festivalDiagonal), spread: 28 },
    ]
    : dropTwo
      ? [
        { id: 'wide-radial', targets: festivalMap(festivalRadial), spread: 130 },
        { id: 'evolved-diagonal', targets: festivalMap(festivalDiagonal), spread: 142 },
        { id: 'layered-broad-fan', targets: festivalMap(festivalBroad), spread: 136 },
        { id: 'crown-radial-return', targets: festivalMap(festivalCrown), spread: 124, color: VIOLET },
      ]
      : [
        { id: 'broad-festival-fan', targets: festivalMap(festivalBroad), spread: sceneSettings.spread },
        { id: 'clean-radial', targets: festivalMap(festivalRadial), spread: sceneSettings.spread + 8 },
        { id: 'diagonal-subdivision', targets: festivalMap(festivalDiagonal), spread: sceneSettings.spread + 12 },
        { id: 'crown-frame', targets: festivalMap(festivalCrown), spread: sceneSettings.spread, color: VIOLET },
      ]

  const recruitment: NonNullable<LaserDmxShowDirectorPerformanceScene['eightBarRecruitment']> = []
  if (kind === 'intro') {
    recruitment.push(
      enableBank(`${id}-outer-left`, 1, 'leftHeroEdge', { brightness: 0.5, color: CYAN, fanSpread: 18, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalSpears), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-outer-right`, 1, 'rightHeroEdge', { brightness: 0.5, color: MAGENTA, fanSpread: 18, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalSpears), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-inner`, 2, 'innerPrimary', { brightness: 0.54, color: CYAN, fanSpread: 28, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalNarrow), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  } else if (kind === 'verse') {
    recruitment.push(
      enableBank(`${id}-inner`, 1, 'innerPrimary', { brightness: 0.72, color: CYAN, fanSpread: 52, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalBroad), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-outer`, 2, 'eightBarRecruitment', { brightness: 0.66, color: MAGENTA, fanSpread: 62, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalBroad), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
      enableBank(`${id}-crown`, 3, 'upperSnare', { brightness: 0.62, color: VIOLET, fanSpread: 42, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalCrown), beamPriorityRole: 'detailLattice', beamVisualRole: 'texture' }),
    )
  } else if (kind === 'build') {
    recruitment.push(
      enableBank(`${id}-inner`, 1, 'innerPrimary', { brightness: 0.78, color: CYAN, fanSpread: 66, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalBroad), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-outer`, 2, 'eightBarRecruitment', { brightness: 0.86, color: MAGENTA, fanSpread: 86, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalRadial), beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
      enableBank(`${id}-crown`, 3, 'upperSnare', { brightness: 0.88, color: WHITE, fanSpread: 72, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalCrown), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  } else if (kind === 'preDrop') {
    recruitment.push(
      enableBank(`${id}-inner-aperture`, 1, 'innerPrimary', { brightness: 0.68, color: VIOLET, fanSpread: 12, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalSpears), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-outer-aperture`, 2, 'leftHeroEdge', { brightness: 0.54, color: WHITE, fanSpread: 8, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalSpears), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  } else if (kind === 'breakdown') {
    recruitment.push(
      enableBank(`${id}-outer-spears`, 1, 'boundedImpact', { brightness: 0.48, color: LAVENDER, fanSpread: 10, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalSpears), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-crown-spears`, 2, 'upperSnare', { brightness: 0.42, color: WHITE, fanSpread: 8, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalCrown), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  } else if (kind === 'outro') {
    recruitment.push(
      enableBank(`${id}-outer-release`, 1, 'boundedImpact', { brightness: 0.44, color: CYAN, fanSpread: 24, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalNarrow), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-inner-release`, 2, 'innerPrimary', { brightness: 0.38, color: VIOLET, fanSpread: 14, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalSpears), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  } else if (dropTwo) {
    recruitment.push(
      enableBank(`${id}-inner`, 1, 'innerPrimary', { brightness: 1, color: CYAN, fanSpread: 124, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalRadial), beamPriorityRole: 'heroImpact', beamVisualRole: 'hero', beamAppearance: { width: 2.2, glow: 1 } }),
      enableBank(`${id}-outer`, 1, 'eightBarRecruitment', { brightness: 1, color: MAGENTA, fanSpread: 138, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalBroad), beamPriorityRole: 'heroImpact', beamVisualRole: 'hero', beamAppearance: { width: 2.2, glow: 1 } }),
      enableBank(`${id}-crown`, 1, 'upperSnare', { brightness: 0.9, color: VIOLET, fanSpread: 104, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalCrown), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
      { id: `${id}-wash`, stage: 1, address: { bankRoles: ['texture'] }, fixtureActions: [{ id: `${id}-wash-action`, kind: 'wash', enabled: true, brightness: 0.56, color: BLUE, fanSpread: 82, focus: 0.4 }] },
      enableBank(`${id}-diagonal-second-layer`, 2, 'allBeams', { brightness: 1, fanSpread: 152, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalDiagonal), beamPriorityRole: 'heroImpact' }),
    )
  } else {
    recruitment.push(
      enableBank(`${id}-inner`, 1, 'innerPrimary', { brightness: 1, color: CYAN, fanSpread: 104, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalBroad), beamPriorityRole: 'heroImpact', beamVisualRole: 'hero', beamAppearance: { width: 2.1, glow: 1 } }),
      enableBank(`${id}-outer`, 2, 'leftHeroEdge', { brightness: 0.94, color: MAGENTA, fanSpread: 116, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalBroad), beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
      enableBank(`${id}-outer-right`, 2, 'rightHeroEdge', { brightness: 0.94, color: MAGENTA, fanSpread: 116, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalBroad), beamPriorityRole: 'heroImpact', beamVisualRole: 'hero' }),
      enableBank(`${id}-crown`, 3, 'upperSnare', { brightness: 0.86, color: VIOLET, fanSpread: 88, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalCrown), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  }

  return sceneBase(id, `Festival Front Beams Performance · ${kind === 'drop1' ? 'Drop 1' : kind === 'drop2' ? 'Drop 2+' : kind === 'preDrop' ? 'Pre-drop' : kind[0].toUpperCase() + kind.slice(1)}`, sectionMatch, ['laser', 'movingHead', 'parWash'], energyKey, {
    global: { dimmer: sceneSettings.dimmer, globalGlow: sceneSettings.glow, beamPersistence: kind.startsWith('drop') ? 0.08 : 0.14, backgroundFade: kind.startsWith('drop') ? 0.76 : 0.86, haze: sceneSettings.haze },
    ...(kind.startsWith('drop') ? { transitionIn: { durationBars: 0.02, curve: 'step' as const } } : {}),
    ...(kind === 'preDrop' ? { blackoutWindows: [{ id: `${id}-final-half-beat`, kind: 'preDrop' as const, anchor: 'sectionEnd' as const, durationBeats: 0.5, justification: 'Clean festival aperture cut before fan expansion.' }] } : {}),
    eightBarRecruitment: recruitment,
    ...(kind === 'build' ? { barProgression: [
      { id: `${id}-bar-two-outer`, stageBar: 2, address: { bankRoles: ['leftHeroEdge', 'rightHeroEdge'] }, fixture: { enabled: true, brightness: 0.8, fanSpread: 76 } },
      { id: `${id}-bar-four-crown`, stageBar: 4, address: { bankRoles: ['upperSnare'] }, fixture: { enabled: true, brightness: 0.88, color: WHITE, fanSpread: 88 } },
    ], sectionExitMutations: [{ id: `${id}-compress`, durationBeats: 1, address: { bankRoles: ['allBeams'] }, fixture: { fanSpread: 10, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalSpears), brightness: 0.7 }, global: { dimmer: 0.72 } }] } : {}),
    ...(kind.startsWith('drop') ? { sectionEntryMutations: [
      { id: `${id}-impact`, durationBeats: 0.5, address: { bankRoles: ['boundedImpact'] }, fixture: { enabled: true, brightness: 1, color: WHITE, fanSpread: dropTwo ? 160 : 132, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(dropTwo ? festivalDiagonal : festivalBroad), beamPriorityRole: 'heroImpact', beamVisualRole: 'impact', beamAppearance: { width: 2.9, glow: 1 } } },
    ] } : {}),
    ...(kind === 'outro' ? { barProgression: [
      { id: `${id}-six`, stageBar: 1, cumulative: false, address: { bankRoles: ['allBeams'] }, fixture: { enabled: true, brightness: 0.46, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalNarrow), fanSpread: 30 } },
      { id: `${id}-two`, stageBar: 3, cumulative: false, address: { bankRoles: ['boundedImpact'] }, fixture: { enabled: true, brightness: 0.38, targetMode: 'fixed', targetPointsByFixtureSemanticKey: festivalMap(festivalSpears), fanSpread: 12 } },
    ], sectionExitMutations: [{ id: `${id}-fade`, durationBeats: 0.5, global: { dimmer: 0.1, globalGlow: 0.22 } }] } : {}),
    ...festivalSceneCadence(id, sceneSettings.spread, motifSets),
    modulations: commonModulations('allBeams'),
  })
}

const FESTIVAL_ENVELOPES = Object.freeze({
  intro: envelope([1, 2], [8, 28], [0.34, 0.6], [12, 38], [0.08, 0.28], [0.38, 0.64], [0.08, 0.26], [0.7, 0.94]),
  verse: envelope([2, 4], [28, 72], [0.48, 0.78], [38, 72], [0.22, 0.52], [0.52, 0.78], [0.26, 0.54], [0.46, 0.76]),
  build: envelope([2, 6], [48, 112], [0.6, 0.92], [54, 98], [0.36, 0.78], [0.66, 0.92], [0.4, 0.78], [0.3, 0.64]),
  preDrop: envelope([1, 2], [8, 28], [0.34, 0.7], [6, 24], [0.05, 0.24], [0.3, 0.64], [0.04, 0.22], [0.78, 0.96]),
  drop1: envelope([3, 6], [72, 150], [0.76, 1], [82, 132], [0.62, 1], [0.8, 1], [0.62, 0.92], [0.22, 0.5]),
  breakdown: envelope([1, 2], [6, 26], [0.28, 0.56], [6, 24], [0.04, 0.22], [0.32, 0.58], [0.04, 0.2], [0.78, 0.96]),
  drop2: envelope([4, 8], [96, 196], [0.8, 1], [104, 160], [0.72, 1], [0.84, 1], [0.72, 1], [0.16, 0.44]),
  outro: envelope([1, 3], [8, 32], [0.24, 0.52], [8, 34], [0.04, 0.24], [0.26, 0.54], [0.04, 0.22], [0.76, 0.96]),
})

export function createFestivalFrontBeamsPerformanceProgram(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 3,
    id: 'festival-front-beams-performance',
    name: 'Festival Front Beams Performance',
    description: 'A wide cyan-magenta festival fan with strong outer hero edges, interleaved inner rays, clean center framing, large downbeat expansion, and an evolved radial-diagonal second drop.',
    deterministicSeed: 0xf357,
    fallbackOrder: ['verse', 'intro', 'breakdown'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    fixtureBanks: structuredClone(FESTIVAL_FRONT_BEAMS_PERFORMANCE_BANKS),
    bankRoles: addressesFromBanks(FESTIVAL_FRONT_BEAMS_PERFORMANCE_BANKS),
    energyEnvelopes: FESTIVAL_ENVELOPES,
    blackoutPolicy: BLACKOUT_POLICY,
    diagnostics: {
      authoringVersion: 'rig-performance-02',
      expectedFixtureSemanticKeys: ['front-beam-1', 'front-beam-2', 'front-beam-3', 'front-beam-4', 'sweep-head-1', 'sweep-head-2', 'festival-wash-l', 'festival-wash-r'],
      notes: ['Canonical source rig: festival-front-beams', 'Central audience-facing aperture remains clear', 'Texture washes shed before hero architecture'],
    },
    scenes: [festivalScene('intro'), festivalScene('verse'), festivalScene('build'), festivalScene('preDrop'), festivalScene('drop1'), festivalScene('breakdown'), festivalScene('drop2'), festivalScene('outro')],
  }
}

// Dubstep Drop Lasers Performance -------------------------------------------

const DUBSTEP_GATES = ['drop-gate-l', 'drop-gate-r'] as const
const DUBSTEP_CROSSES = ['drop-cross-l', 'drop-cross-r'] as const
const DUBSTEP_STROBES = ['snare-strobe-l', 'snare-strobe-r'] as const

export const DUBSTEP_DROP_LASERS_PERFORMANCE_BANKS = Object.freeze({
  kick: bank('kick', DUBSTEP_GATES, 'Kick bank', 'Hard local gate fans dedicated to kick geometry.'),
  snare: bank('snare', [...DUBSTEP_CROSSES, ...DUBSTEP_STROBES], 'Snare bank', 'Cross-laser geometry plus bounded snare strobes.'),
  hatTexture: bank('hat', DUBSTEP_CROSSES, 'Hat texture bank', 'Alternating high-frequency cross detail.'),
  downbeatImpact: bank('downbeat', ['downbeat-blinder'], 'Downbeat impact bank', 'Bounded warm blinder on musical downbeats.'),
  outerHero: bank('hero', DUBSTEP_GATES, 'Outer hero bank', 'Primary gate walls and outer fan edges.'),
  innerPrimary: bank('primary', DUBSTEP_CROSSES, 'Inner primary bank', 'Controlled cross and diamond architecture.'),
  fourBarMutation: bank('secondary', DUBSTEP_CROSSES, 'Four-bar mutation bank', 'Cross geometry that mutates without replacing the gate identity.'),
  eightBarRecruitment: bank('secondary', [...DUBSTEP_CROSSES, ...DUBSTEP_STROBES, 'downbeat-blinder'], 'Eight-bar recruitment bank', 'Secondary laser and bounded impact layers recruited at macro cadence.'),
  transientTexture: bank('texture', DUBSTEP_CROSSES, 'Transient texture bank', 'Short pulse-train detail on hats and transients.'),
  boundedImpact: bank('impact', [...DUBSTEP_STROBES, 'downbeat-blinder', 'co2-drop-l', 'co2-drop-r'], 'Bounded impact bank', 'All strobe, blinder, and simulated CO₂ accents with short authored durations.'),
  co2Impact: bank('co2Impact', ['co2-drop-l', 'co2-drop-r'], 'CO₂ impact bank', 'Section-entry and high-confidence transient bursts.'),
  allLasers: bank('primary', [...DUBSTEP_GATES, ...DUBSTEP_CROSSES], 'All laser fixtures', 'All authored gate and cross laser sources.'),
  leftBeat: bank('left', ['drop-gate-l', 'drop-cross-l'], 'Left beat bank', 'Left gate and cross response.'),
  rightBeat: bank('right', ['drop-gate-r', 'drop-cross-r'], 'Right beat bank', 'Right gate and cross response.'),
  kickRest: bank('secondary', DUBSTEP_CROSSES, 'Kick rest bank', 'Cross bank ducks beneath gate hits.'),
  snareRest: bank('secondary', DUBSTEP_GATES, 'Snare rest bank', 'Gate bank ducks beneath snare crosses.'),
} satisfies Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>)

const dubstepGateNarrow = mirroredTargets('dubstep-gate-narrow', [[2.2, 2], [3.8, 2.4], [5.1, 3.2], [5.9, 4.4]], 7)
const dubstepGateWide = mirroredTargets('dubstep-gate-wide', [[0.7, 1.2], [2.2, 1], [3.7, 1.6], [5.1, 2.7], [5.8, 4.2], [5.4, 6.5], [3.8, 8.2]], 7)
const dubstepDiamond = mirroredTargets('dubstep-diamond', [[5.8, 2], [5, 4], [5.8, 6], [4.8, 7.8]], 7)
const dubstepCross = {
  left: targetSet('dubstep-cross-left', [[8.2, 2.2], [9.5, 3.6], [10.8, 5.2], [9.2, 7.2]]),
  right: targetSet('dubstep-cross-right', [[5.8, 2.2], [4.5, 3.6], [3.2, 5.2], [4.8, 7.2]]),
}
const dubstepRadial = mirroredTargets('dubstep-radial', [[0.8, 4.8], [1.8, 2.5], [3.4, 1], [5.2, 1.4], [5.9, 3.4], [5.6, 6.8], [4, 8.5]], 7)
const dubstepSpears = mirroredTargets('dubstep-spears', [[5.8, 2], [5.6, 4.2]], 7)

function dubstepMap(
  gatePair: { left: LaserDmxShowDirectorBeamTarget[]; right: LaserDmxShowDirectorBeamTarget[] },
  crossPair: { left: LaserDmxShowDirectorBeamTarget[]; right: LaserDmxShowDirectorBeamTarget[] } = dubstepCross,
) {
  return {
    'drop-gate-l': gatePair.left,
    'drop-gate-r': gatePair.right,
    'drop-cross-l': crossPair.left,
    'drop-cross-r': crossPair.right,
  }
}

function dubstepSceneCadence(
  sceneId: string,
  spread: number,
  motifs: readonly { id: string; targets: Record<string, LaserDmxShowDirectorBeamTarget[]>; spread: number; color?: string }[],
): Partial<LaserDmxShowDirectorPerformanceScene> {
  return {
    beatMutations: [
      ...alternatingBeat(sceneId, 'leftBeat', 'rightBeat', { spreadA: spread, spreadB: Math.max(14, spread - 30), leftColor: RED, rightColor: CYAN, rotation: 12 }),
      {
        id: `${sceneId}-downbeat-blinder`, beatDivision: 1, beatOffsets: [0], beatCycleLength: 4,
        address: { bankRoles: ['downbeatImpact'] }, durationBeats: 0.25,
        fixtureActions: [{ id: `${sceneId}-downbeat-blinder-action`, kind: 'blinder', active: true, brightness: 1, color: WARM_WHITE, durationMs: 180 }],
      },
    ],
    barMutations: barOpposition(sceneId, 'allLasers', dubstepMap(dubstepGateWide), dubstepMap(dubstepDiamond), 13),
    fourBarVariations: fourMotifs(sceneId, 'allLasers', motifs),
    sixteenBarEvolution: [{ id: `${sceneId}-phrase-radial`, phase: 1, phraseLengthBars: 16, address: { bankRoles: ['fourBarMutation'] }, fixture: { brightness: 0.92, color: ORANGE, fanSpread: spread + 20, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepRadial), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' } }],
    ...cadenceResponses(sceneId, { kick: 'kick', kickRest: 'kickRest', snare: 'snare', snareRest: 'snareRest', hat: 'hatTexture', transient: 'boundedImpact', downbeat: 'downbeatImpact' }, { kick: RED, snare: WHITE, hat: MAGENTA, transient: WHITE }, { kickSpread: spread + 22, snareSpread: spread + 8, transientSpread: spread + 28 }),
  }
}

function dubstepScene(
  kind: 'intro' | 'verse' | 'build' | 'preDrop' | 'drop1' | 'breakdown' | 'drop2' | 'outro',
): LaserDmxShowDirectorPerformanceScene {
  const id = `dubstep-${kind === 'drop1' ? 'drop-1' : kind === 'drop2' ? 'drop-2' : kind === 'preDrop' ? 'pre-drop' : kind}`
  const sectionMatch = kind === 'drop1' ? section(['drop'], [1]) : kind === 'drop2' ? section(['drop'], { minOccurrence: 2 }) : kind === 'breakdown' ? section(['breakdown', 'bridge']) : kind === 'preDrop' ? section(['preDrop']) : section([kind])
  const energyKey = kind === 'drop1' ? 'drop1' : kind === 'drop2' ? 'drop2' : kind
  const dropTwo = kind === 'drop2'
  const spread = { intro: 28, verse: 52, build: 78, preDrop: 24, drop1: 96, breakdown: 20, drop2: 124, outro: 28 }[kind]
  const motifs = kind === 'intro' || kind === 'breakdown' || kind === 'outro'
    ? [
      { id: 'ominous-spears', targets: dubstepMap(dubstepSpears), spread: 12 },
      { id: 'narrow-gates', targets: dubstepMap(dubstepGateNarrow), spread: 22 },
      { id: 'quiet-diamond', targets: dubstepMap(dubstepDiamond), spread: 24, color: VIOLET },
      { id: 'restrained-cross', targets: dubstepMap(dubstepGateNarrow, dubstepCross), spread: 28 },
    ]
    : dropTwo
      ? [
        { id: 'radial-gate-evolution', targets: dubstepMap(dubstepRadial), spread: 132 },
        { id: 'double-diamond', targets: dubstepMap(dubstepDiamond), spread: 126 },
        { id: 'diagonal-cross-surge', targets: dubstepMap(dubstepGateWide, dubstepCross), spread: 144 },
        { id: 'wide-gate-return', targets: dubstepMap(dubstepGateWide), spread: 138, color: ORANGE },
      ]
      : [
        { id: 'hard-gate-open', targets: dubstepMap(dubstepGateWide), spread },
        { id: 'controlled-cross', targets: dubstepMap(dubstepGateNarrow, dubstepCross), spread: spread + 8 },
        { id: 'diamond-punch', targets: dubstepMap(dubstepDiamond), spread: spread + 12 },
        { id: 'alternating-high-low', targets: dubstepMap(dubstepGateWide, dubstepCross), spread: spread + 4, color: MAGENTA },
      ]

  const recruitment: NonNullable<LaserDmxShowDirectorPerformanceScene['eightBarRecruitment']> = []
  if (kind === 'intro') {
    recruitment.push(
      enableBank(`${id}-gates`, 1, 'outerHero', { brightness: 0.48, color: RED, fanSpread: 18, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepSpears), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-crosses`, 2, 'innerPrimary', { brightness: 0.44, color: VIOLET, fanSpread: 20, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepGateNarrow, dubstepCross), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  } else if (kind === 'verse') {
    recruitment.push(
      enableBank(`${id}-gates`, 1, 'outerHero', { brightness: 0.7, color: RED, fanSpread: 48, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepGateNarrow), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-crosses`, 2, 'innerPrimary', { brightness: 0.66, color: CYAN, fanSpread: 54, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepGateNarrow, dubstepCross), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  } else if (kind === 'build') {
    recruitment.push(
      enableBank(`${id}-gates`, 1, 'outerHero', { brightness: 0.78, color: RED, fanSpread: 62, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepGateNarrow), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-crosses`, 2, 'innerPrimary', { brightness: 0.84, color: CYAN, fanSpread: 76, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepDiamond), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
      { id: `${id}-strobe-ready`, stage: 3, address: { bankRoles: ['snare'] }, fixtureActions: [{ id: `${id}-strobe-ready-action`, kind: 'strobe', active: false, brightness: 0.8, color: WHITE, rateHz: 18, durationMs: 80 }] },
    )
  } else if (kind === 'preDrop') {
    recruitment.push(
      enableBank(`${id}-compressed-gates`, 1, 'outerHero', { brightness: 0.66, color: VIOLET, fanSpread: 10, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepSpears), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-compressed-crosses`, 2, 'innerPrimary', { brightness: 0.52, color: WHITE, fanSpread: 8, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepSpears, dubstepCross), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  } else if (kind === 'breakdown') {
    recruitment.push(
      enableBank(`${id}-spears`, 1, 'outerHero', { brightness: 0.46, color: LAVENDER, fanSpread: 8, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepSpears), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-single-cross`, 2, 'innerPrimary', { brightness: 0.4, color: WHITE, fanSpread: 10, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepSpears, dubstepCross), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  } else if (kind === 'outro') {
    recruitment.push(
      enableBank(`${id}-gate-release`, 1, 'outerHero', { brightness: 0.44, color: RED, fanSpread: 24, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepGateNarrow), beamPriorityRole: 'primaryArchitecture', beamVisualRole: 'primary' }),
      enableBank(`${id}-cross-release`, 2, 'innerPrimary', { brightness: 0.36, color: VIOLET, fanSpread: 14, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepSpears, dubstepCross), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
    )
  } else if (dropTwo) {
    recruitment.push(
      enableBank(`${id}-gates`, 1, 'outerHero', { brightness: 1, color: RED, fanSpread: 124, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepRadial), beamPriorityRole: 'heroImpact', beamVisualRole: 'hero', beamAppearance: { width: 2.25, glow: 1 } }),
      enableBank(`${id}-crosses`, 1, 'innerPrimary', { brightness: 1, color: CYAN, fanSpread: 112, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepGateWide, dubstepCross), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
      { id: `${id}-impact-layer`, stage: 1, address: { bankRoles: ['eightBarRecruitment'] }, fixtureActions: [
        { id: `${id}-strobe-layer`, kind: 'strobe', active: false, brightness: 1, color: WHITE, rateHz: 20, durationMs: 90 },
        { id: `${id}-blinder-layer`, kind: 'blinder', active: false, brightness: 1, color: WARM_WHITE, durationMs: 180 },
      ] },
      enableBank(`${id}-radial-second-layer`, 2, 'allLasers', { brightness: 1, fanSpread: 148, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepRadial, dubstepCross), beamPriorityRole: 'heroImpact' }),
    )
  } else {
    recruitment.push(
      enableBank(`${id}-gates`, 1, 'outerHero', { brightness: 1, color: RED, fanSpread: 96, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepGateWide), beamPriorityRole: 'heroImpact', beamVisualRole: 'hero', beamAppearance: { width: 2.15, glow: 1 } }),
      enableBank(`${id}-crosses`, 2, 'innerPrimary', { brightness: 0.92, color: CYAN, fanSpread: 86, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepGateNarrow, dubstepCross), beamPriorityRole: 'secondaryFan', beamVisualRole: 'secondary' }),
      { id: `${id}-impact-ready`, stage: 3, address: { bankRoles: ['eightBarRecruitment'] }, fixtureActions: [
        { id: `${id}-strobe-ready`, kind: 'strobe', active: false, brightness: 1, color: WHITE, rateHz: 20, durationMs: 90 },
        { id: `${id}-blinder-ready`, kind: 'blinder', active: false, brightness: 1, color: WARM_WHITE, durationMs: 180 },
      ] },
    )
  }

  const cadence = dubstepSceneCadence(id, spread, motifs)
  return sceneBase(id, `Dubstep Drop Lasers Performance · ${kind === 'drop1' ? 'Drop 1' : kind === 'drop2' ? 'Drop 2+' : kind === 'preDrop' ? 'Pre-drop' : kind[0].toUpperCase() + kind.slice(1)}`, sectionMatch, ['laser', 'strobe', 'blinder', 'co2Jet'], energyKey, {
    global: {
      dimmer: kind.startsWith('drop') ? 1 : kind === 'build' ? 0.86 : kind === 'verse' ? 0.7 : kind === 'preDrop' ? 0.62 : kind === 'breakdown' ? 0.48 : 0.52,
      globalGlow: kind.startsWith('drop') ? (dropTwo ? 1 : 0.96) : kind === 'build' ? 0.84 : kind === 'verse' ? 0.7 : 0.54,
      beamPersistence: kind.startsWith('drop') ? 0.05 : 0.11,
      backgroundFade: kind.startsWith('drop') ? 0.82 : 0.9,
      haze: kind.startsWith('drop') ? 0.32 : 0.12,
    },
    ...(kind.startsWith('drop') ? { transitionIn: { durationBars: 0.02, curve: 'step' as const } } : {}),
    ...(kind === 'preDrop' ? { blackoutWindows: [{ id: `${id}-final-half-beat`, kind: 'preDrop' as const, anchor: 'sectionEnd' as const, durationBeats: 0.5, justification: 'Purposeful half-beat tension cut before the gate impact.' }] } : {}),
    eightBarRecruitment: recruitment,
    ...(kind === 'build' ? { barProgression: [
      { id: `${id}-bar-two-crosses`, stageBar: 2, address: { bankRoles: ['innerPrimary'] }, fixture: { enabled: true, brightness: 0.8, fanSpread: 70 } },
      { id: `${id}-bar-four-gates`, stageBar: 4, address: { bankRoles: ['outerHero'] }, fixture: { enabled: true, brightness: 0.9, fanSpread: 88 } },
    ], sectionExitMutations: [{ id: `${id}-compress`, durationBeats: 1, address: { bankRoles: ['allLasers'] }, fixture: { fanSpread: 8, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepSpears), brightness: 0.68 }, global: { dimmer: 0.7 } }] } : {}),
    ...(kind.startsWith('drop') ? { sectionEntryMutations: [
      { id: `${id}-laser-impact`, durationBeats: 0.5, address: { bankRoles: [dropTwo ? 'allLasers' : 'outerHero'] }, fixture: { enabled: true, brightness: 1, color: WHITE, fanSpread: dropTwo ? 154 : 122, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dropTwo ? dubstepRadial : dubstepGateWide), beamPriorityRole: 'heroImpact', beamVisualRole: 'impact', beamAppearance: { width: 2.9, glow: 1 } } },
      { id: `${id}-co2-impact`, durationBeats: 0.5, address: { bankRoles: ['co2Impact'] }, fixtureActions: [{ id: `${id}-co2`, kind: 'co2', active: true, brightness: 1, color: WHITE, burstStrength: dropTwo ? 1 : 0.84, durationMs: dropTwo ? 720 : 620 }] },
      { id: `${id}-blinder-impact`, durationBeats: 0.25, address: { bankRoles: ['downbeatImpact'] }, fixtureActions: [{ id: `${id}-blinder`, kind: 'blinder', active: true, brightness: 1, color: WARM_WHITE, durationMs: 180 }] },
    ] } : {}),
    ...(kind === 'outro' ? { barProgression: [
      { id: `${id}-four`, stageBar: 1, cumulative: false, address: { bankRoles: ['allLasers'] }, fixture: { enabled: true, brightness: 0.44, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepGateNarrow), fanSpread: 24 } },
      { id: `${id}-two`, stageBar: 3, cumulative: false, address: { bankRoles: ['outerHero'] }, fixture: { enabled: true, brightness: 0.36, targetMode: 'fixed', targetPointsByFixtureSemanticKey: dubstepMap(dubstepSpears), fanSpread: 10 } },
    ], sectionExitMutations: [{ id: `${id}-fade`, durationBeats: 0.5, global: { dimmer: 0.08, globalGlow: 0.2 } }] } : {}),
    ...cadence,
    snareMutations: [
      ...(cadence.snareMutations ?? []),
      { id: `${id}-snare-strobes`, threshold: 0.38, durationBeats: 0.25, address: { bankRoles: ['snare'] }, fixtureActions: [{ id: `${id}-snare-strobe-action`, kind: 'strobe', active: true, brightness: 1, color: WHITE, rateHz: 20, durationMs: 82 }] },
    ],
    transientMutations: [
      ...(cadence.transientMutations ?? []),
      { id: `${id}-transient-co2`, threshold: 0.78, probability: 0.45, durationBeats: 0.25, address: { bankRoles: ['co2Impact'] }, fixtureActions: [{ id: `${id}-transient-co2-action`, kind: 'co2', active: true, brightness: 1, color: WHITE, burstStrength: 0.72, durationMs: 420 }] },
    ],
    modulations: commonModulations('allLasers'),
  })
}

const DUBSTEP_ENVELOPES = Object.freeze({
  intro: envelope([1, 2], [4, 22], [0.3, 0.56], [8, 30], [0.08, 0.3], [0.34, 0.62], [0.06, 0.24], [0.72, 0.94]),
  verse: envelope([2, 4], [18, 58], [0.46, 0.76], [30, 64], [0.22, 0.56], [0.5, 0.78], [0.22, 0.54], [0.48, 0.78]),
  build: envelope([2, 6], [42, 104], [0.58, 0.92], [52, 92], [0.38, 0.82], [0.66, 0.94], [0.4, 0.82], [0.3, 0.66]),
  preDrop: envelope([1, 2], [4, 22], [0.32, 0.68], [5, 22], [0.05, 0.24], [0.28, 0.62], [0.04, 0.22], [0.8, 0.98]),
  drop1: envelope([3, 6], [70, 148], [0.78, 1], [78, 126], [0.68, 1], [0.82, 1], [0.66, 0.94], [0.2, 0.5]),
  breakdown: envelope([1, 2], [4, 18], [0.26, 0.54], [4, 20], [0.04, 0.22], [0.3, 0.56], [0.04, 0.18], [0.8, 0.98]),
  drop2: envelope([4, 8], [96, 196], [0.82, 1], [102, 156], [0.76, 1], [0.86, 1], [0.76, 1], [0.14, 0.42]),
  outro: envelope([1, 3], [4, 24], [0.22, 0.5], [5, 28], [0.04, 0.24], [0.24, 0.52], [0.04, 0.22], [0.78, 0.98]),
})

export function createDubstepDropLasersPerformanceProgram(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 3,
    id: 'dubstep-drop-lasers-performance',
    name: 'Dubstep Drop Lasers Performance',
    description: 'An aggressive red-cyan dubstep show with kick-owned gate fans, snare-owned crosses and strobes, alternating high-low responses, bounded impacts, four-bar motif mutations, and a radial second-drop evolution.',
    deterministicSeed: 0xd05e,
    fallbackOrder: ['verse', 'intro', 'breakdown'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    fixtureBanks: structuredClone(DUBSTEP_DROP_LASERS_PERFORMANCE_BANKS),
    bankRoles: addressesFromBanks(DUBSTEP_DROP_LASERS_PERFORMANCE_BANKS),
    energyEnvelopes: DUBSTEP_ENVELOPES,
    blackoutPolicy: BLACKOUT_POLICY,
    diagnostics: {
      authoringVersion: 'rig-performance-02',
      expectedFixtureSemanticKeys: ['drop-gate-l', 'drop-gate-r', 'drop-cross-l', 'drop-cross-r', 'snare-strobe-l', 'snare-strobe-r', 'downbeat-blinder', 'co2-drop-l', 'co2-drop-r'],
      notes: ['Canonical source rig: dubstep-drop-lasers', 'Kick and snare geometry remain visually separate', 'Strobe, blinder, and CO₂ actions are bounded'],
    },
    scenes: [dubstepScene('intro'), dubstepScene('verse'), dubstepScene('build'), dubstepScene('preDrop'), dubstepScene('drop1'), dubstepScene('breakdown'), dubstepScene('drop2'), dubstepScene('outro')],
  }
}
