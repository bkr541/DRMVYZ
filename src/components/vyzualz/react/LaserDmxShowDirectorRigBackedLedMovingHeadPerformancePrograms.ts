import { LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE } from './LaserDmxShowDirectorBeatActions'
import type {
  LaserDmxShowDirectorAuthoredFixtureBankMetadata,
  LaserDmxShowDirectorLedFixtureAction,
  LaserDmxShowDirectorMovingHeadFixtureAction,
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
  LaserDmxShowDirectorPerformanceSectionMatch,
  LaserDmxShowDirectorSectionEnergyEnvelope,
  LaserDmxShowDirectorWashFixtureAction,
} from './LaserDmxShowDirectorPerformanceProgram'
import type {
  LaserDmxShowDirectorBeamTarget,
  LaserDmxShowDirectorFixtureKind,
  LaserDmxShowDirectorLedDirection,
  LaserDmxShowDirectorMovingHeadPanTiltStyle,
} from './ReactTypes'

const CYAN = '#32e6ff'
const EMERALD = '#2ff0a8'
const BLUE = '#4f75ff'
const MAGENTA = '#ff3bd5'
const VIOLET = '#9b5cff'
const WHITE = '#f7fbff'
const DEEP_BLUE = '#2448c9'

const IMPACT_RECOVERY_ENVELOPE = Object.freeze({
  holdUntil: 0.08,
  releaseUntil: 0.28,
  curve: 'easeOut' as const,
})

const BLACKOUT_POLICY = Object.freeze({
  maxPreDropBeats: 0.5,
  maxImpactCutBeats: 0.25,
  maxFakeoutBeats: 0.5,
  maximumProgrammedBlackoutRatio: 0.04,
  retriggerGuardBeats: 1,
  breakdownRequiresVisibleOutput: true,
  minimumVisibleFixtureBrightness: 0.22,
})

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
    fixture: { enabled: false },
    global: { dimmer: 0.84, globalGlow: 0.68, beamPersistence: 0.08, backgroundFade: 0.88 },
    energyEnvelopeKey,
    transitionIn: { durationBars: 0.08, curve: 'easeInOut' },
    transitionOut: { durationBars: 0.08, curve: 'easeInOut' },
    ...patch,
  }
}

function ledAction(
  id: string,
  options: {
    enabled?: boolean
    brightness?: number
    color?: string
    direction?: LaserDmxShowDirectorLedDirection
  },
): LaserDmxShowDirectorLedFixtureAction {
  return { id, kind: 'led', ...options }
}

function ledMutation(
  id: string,
  role: string,
  options: Parameters<typeof ledAction>[1],
): LaserDmxShowDirectorPerformanceMutationBase {
  return { id, address: { bankRoles: [role] }, fixtureActions: [ledAction(`${id}-action`, options)] }
}

function headAction(
  id: string,
  options: {
    enabled?: boolean
    brightness?: number
    color?: string
    targetMode?: LaserDmxShowDirectorMovingHeadFixtureAction['targetMode']
    targetPoints?: LaserDmxShowDirectorBeamTarget[]
    fanSpread?: number
    focus?: number
    rotation?: number
    movementStyle?: LaserDmxShowDirectorMovingHeadPanTiltStyle
  },
): LaserDmxShowDirectorMovingHeadFixtureAction {
  return { id, kind: 'movingHead', ...options }
}

function headMutation(
  id: string,
  role: string,
  options: Parameters<typeof headAction>[1],
): LaserDmxShowDirectorPerformanceMutationBase {
  return { id, address: { bankRoles: [role] }, fixtureActions: [headAction(`${id}-action`, options)] }
}

function washAction(
  id: string,
  options: { enabled?: boolean; brightness?: number; color?: string; fanSpread?: number; focus?: number },
): LaserDmxShowDirectorWashFixtureAction {
  return { id, kind: 'wash', ...options }
}

function washMutation(
  id: string,
  role: string,
  options: Parameters<typeof washAction>[1],
): LaserDmxShowDirectorPerformanceMutationBase {
  return { id, address: { bankRoles: [role] }, fixtureActions: [washAction(`${id}-action`, options)] }
}

function target(id: string, x: number, y: number): LaserDmxShowDirectorBeamTarget[] {
  return [{ id, x, y }]
}

// LED Bar Grid Performance ---------------------------------------------------

const LED_ALL = [
  'top-bar-1', 'top-bar-2', 'top-bar-3',
  'mid-bar-1', 'mid-bar-2', 'mid-bar-3',
  'tube-l-1', 'tube-l-2', 'tube-r-1', 'tube-r-2',
] as const

export const LED_BAR_GRID_PERFORMANCE_BANKS = Object.freeze({
  lowerRowKick: bank('kick', ['mid-bar-1', 'mid-bar-2', 'mid-bar-3', 'tube-l-2', 'tube-r-2'], 'Lower row kick bank', 'Lower LED row and lower side tubes own kick-weighted upward recruitment.'),
  upperRowSnare: bank('snare', ['top-bar-1', 'top-bar-2', 'top-bar-3', 'tube-l-1', 'tube-r-1'], 'Upper row snare bank', 'Upper LED row and upper side tubes own snare responses.'),
  leftColumnResponse: bank('left', ['top-bar-1', 'mid-bar-1', 'tube-l-1', 'tube-l-2'], 'Left column response bank', 'Left architectural column for call-and-response patterns.'),
  rightColumnResponse: bank('right', ['top-bar-3', 'mid-bar-3', 'tube-r-1', 'tube-r-2'], 'Right column response bank', 'Right architectural column for call-and-response patterns.'),
  innerGridPrimary: bank('primary', ['top-bar-2', 'mid-bar-2'], 'Inner grid primary bank', 'The center bars anchor restrained scenes and pre-drop compression.'),
  outerGridHero: bank('hero', ['top-bar-1', 'top-bar-3', 'mid-bar-1', 'mid-bar-3', 'tube-l-1', 'tube-l-2', 'tube-r-1', 'tube-r-2'], 'Outer grid hero bank', 'Outer bars and tubes form the large drop architecture.'),
  diagonalA: bank('secondary', ['top-bar-1', 'mid-bar-2', 'tube-r-2'], 'Diagonal A bank', 'Top-left to lower-right structural diagonal.'),
  diagonalB: bank('secondary', ['top-bar-3', 'mid-bar-2', 'tube-l-2'], 'Diagonal B bank', 'Top-right to lower-left structural diagonal.'),
  checkerA: bank('primary', ['top-bar-1', 'top-bar-3', 'mid-bar-2', 'tube-l-2', 'tube-r-1'], 'Checker A bank', 'First checker ownership set for Drop 2 alternation.'),
  checkerB: bank('secondary', ['top-bar-2', 'mid-bar-1', 'mid-bar-3', 'tube-l-1', 'tube-r-2'], 'Checker B bank', 'Second checker ownership set for Drop 2 alternation.'),
  textureTransient: bank('texture', ['top-bar-1', 'top-bar-3', 'tube-l-1', 'tube-r-1'], 'Texture and transient bank', 'Narrow high-frequency texture fixtures.'),
  fullGridImpact: bank('impact', LED_ALL, 'Full-grid bounded impact bank', 'All LED fixtures, reserved for sub-beat white impacts.'),
  allLeds: bank('primary', LED_ALL, 'All LED fixtures', 'Every LED bar and tube in the canonical source rig.'),
} satisfies Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>)

function ledEveryBeat(
  prefix: string,
  options: { primary: string; secondary: string; brightness?: number; directionA?: LaserDmxShowDirectorLedDirection; directionB?: LaserDmxShowDirectorLedDirection },
): NonNullable<LaserDmxShowDirectorPerformanceScene['beatMutations']> {
  return [
    {
      id: `${prefix}-even-primary`, beatDivision: 1, beatOffsets: [0, 2], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['leftColumnResponse'] },
      fixtureActions: [ledAction(`${prefix}-even-primary-action`, { enabled: true, brightness: options.brightness ?? 0.96, color: options.primary, direction: options.directionA ?? 'centerOut' })],
    },
    {
      id: `${prefix}-even-secondary-rest`, beatDivision: 1, beatOffsets: [0, 2], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['rightColumnResponse'] },
      fixtureActions: [ledAction(`${prefix}-even-secondary-rest-action`, { enabled: true, brightness: 0.36, color: options.secondary, direction: options.directionB ?? 'edgesIn' })],
    },
    {
      id: `${prefix}-odd-secondary`, beatDivision: 1, beatOffsets: [1, 3], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['rightColumnResponse'] },
      fixtureActions: [ledAction(`${prefix}-odd-secondary-action`, { enabled: true, brightness: options.brightness ?? 0.96, color: options.secondary, direction: options.directionB ?? 'edgesIn' })],
    },
    {
      id: `${prefix}-odd-primary-rest`, beatDivision: 1, beatOffsets: [1, 3], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['leftColumnResponse'] },
      fixtureActions: [ledAction(`${prefix}-odd-primary-rest-action`, { enabled: true, brightness: 0.36, color: options.primary, direction: options.directionA ?? 'centerOut' })],
    },
  ]
}

function ledRhythmResponses(
  prefix: string,
  options: { kickColor: string; snareColor: string; textureColor: string },
): Pick<LaserDmxShowDirectorPerformanceScene, 'kickMutations' | 'snareMutations' | 'hatMutations' | 'transientMutations'> {
  return {
    kickMutations: [
      { ...ledMutation(`${prefix}-kick`, 'lowerRowKick', { enabled: true, brightness: 1, color: options.kickColor, direction: 'centerOut' }), threshold: 0.38 },
      { ...ledMutation(`${prefix}-kick-upper-duck`, 'upperRowSnare', { enabled: true, brightness: 0.32 }), threshold: 0.38 },
    ],
    snareMutations: [
      { ...ledMutation(`${prefix}-snare`, 'upperRowSnare', { enabled: true, brightness: 1, color: options.snareColor, direction: 'edgesIn' }), threshold: 0.38 },
      { ...ledMutation(`${prefix}-snare-lower-duck`, 'lowerRowKick', { enabled: true, brightness: 0.34 }), threshold: 0.38 },
    ],
    hatMutations: [{
      ...ledMutation(`${prefix}-hat`, 'textureTransient', { enabled: true, brightness: 0.78, color: options.textureColor, direction: 'chase' }),
      threshold: 0.28,
    }],
    transientMutations: [{
      ...ledMutation(`${prefix}-transient`, 'textureTransient', { enabled: true, brightness: 0.92, color: options.textureColor, direction: 'leftToRight' }),
      threshold: 0.62,
      durationBeats: 0.25,
    }],
  }
}

function ledDownbeatImpact(prefix: string): NonNullable<LaserDmxShowDirectorPerformanceScene['beatMutations']> {
  return [{
    id: `${prefix}-bounded-full-grid-impact`,
    beatDivision: 1,
    beatOffsets: [0],
    beatCycleLength: 4,
    durationBeats: 0.25,
    responseEnvelope: IMPACT_RECOVERY_ENVELOPE,
    address: { bankRoles: ['fullGridImpact'] },
    fixtureActions: [ledAction(`${prefix}-bounded-full-grid-impact-action`, { enabled: true, brightness: 1, color: WHITE, direction: 'centerOut' })],
  }]
}

function ledFourBarPatterns(prefix: string): NonNullable<LaserDmxShowDirectorPerformanceScene['fourBarVariations']> {
  return [
    {
      id: `${prefix}-rows-own`, motifFamily: 'rows', address: { bankRoles: ['lowerRowKick'] },
      fixtureActions: [ledAction(`${prefix}-rows-own-action`, { enabled: true, brightness: 0.82, color: CYAN, direction: 'centerOut' })],
    },
    {
      id: `${prefix}-columns-own`, motifFamily: 'columns', address: { bankRoles: ['leftColumnResponse', 'rightColumnResponse'] },
      fixtureActions: [ledAction(`${prefix}-columns-own-action`, { enabled: true, brightness: 0.84, color: EMERALD, direction: 'edgesIn' })],
    },
    {
      id: `${prefix}-mirrored-own`, motifFamily: 'mirrored', address: { bankRoles: ['outerGridHero'] },
      fixtureActions: [ledAction(`${prefix}-mirrored-own-action`, { enabled: true, brightness: 0.86, color: CYAN, direction: 'centerOut' })],
    },
  ]
}

function ledIntro(): LaserDmxShowDirectorPerformanceScene {
  const id = 'led-grid-intro'
  return sceneBase(id, 'LED Bar Grid Performance · Intro', section(['intro']), ['ledBar', 'ledTube'], 'intro', {
    global: { dimmer: 0.48, globalGlow: 0.42, backgroundFade: 0.94, beamPersistence: 0.02 },
    barProgression: [
      { ...ledMutation(`${id}-center-anchor`, 'innerGridPrimary', { enabled: true, brightness: 0.46, color: CYAN, direction: 'centerOut' }), stageBar: 1 },
      { ...ledMutation(`${id}-upper-texture`, 'textureTransient', { enabled: true, brightness: 0.34, color: EMERALD, direction: 'chase' }), stageBar: 5 },
    ],
    beatMutations: [
      {
        id: `${id}-center-breathe`, beatDivision: 1, beatOffsets: [0, 1], beatCycleLength: 2,
        responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
        address: { bankRoles: ['innerGridPrimary'] },
        fixtureActions: [ledAction(`${id}-center-breathe-action`, { enabled: true, brightness: 0.64, color: CYAN, direction: 'centerOut' })],
      },
    ],
    eightBarRecruitment: [{ ...ledMutation(`${id}-outer-whisper`, 'outerGridHero', { enabled: true, brightness: 0.28, color: EMERALD, direction: 'edgesIn' }), stage: 2, cumulative: true }],
  })
}

function ledVerse(): LaserDmxShowDirectorPerformanceScene {
  const id = 'led-grid-verse'
  return sceneBase(id, 'LED Bar Grid Performance · Verse', section(['verse']), ['ledBar', 'ledTube'], 'verse', {
    global: { dimmer: 0.66, globalGlow: 0.52, backgroundFade: 0.92, beamPersistence: 0.03 },
    barProgression: [
      { ...ledMutation(`${id}-inner`, 'innerGridPrimary', { enabled: true, brightness: 0.62, color: CYAN, direction: 'centerOut' }), stageBar: 1 },
      { ...ledMutation(`${id}-columns`, 'leftColumnResponse', { enabled: true, brightness: 0.5, color: EMERALD, direction: 'leftToRight' }), stageBar: 1 },
      { ...ledMutation(`${id}-columns-right`, 'rightColumnResponse', { enabled: true, brightness: 0.5, color: EMERALD, direction: 'rightToLeft' }), stageBar: 1 },
    ],
    beatMutations: ledEveryBeat(id, { primary: CYAN, secondary: EMERALD, brightness: 0.82 }),
    fourBarVariations: ledFourBarPatterns(id),
    eightBarRecruitment: [{ ...ledMutation(`${id}-upper-row-recruit`, 'upperRowSnare', { enabled: true, brightness: 0.56, color: EMERALD, direction: 'edgesIn' }), stage: 2, cumulative: true }],
    ...ledRhythmResponses(id, { kickColor: CYAN, snareColor: EMERALD, textureColor: BLUE }),
  })
}

function ledBuild(): LaserDmxShowDirectorPerformanceScene {
  const id = 'led-grid-build'
  return sceneBase(id, 'LED Bar Grid Performance · Build', section(['build']), ['ledBar', 'ledTube'], 'build', {
    global: { dimmer: 0.78, globalGlow: 0.64, backgroundFade: 0.88, beamPersistence: 0.04 },
    barProgression: [
      { ...ledMutation(`${id}-inner`, 'innerGridPrimary', { enabled: true, brightness: 0.68, color: CYAN, direction: 'centerOut' }), stageBar: 1 },
      { ...ledMutation(`${id}-upper`, 'upperRowSnare', { enabled: true, brightness: 0.64, color: EMERALD, direction: 'edgesIn' }), stageBar: 3 },
      { ...ledMutation(`${id}-lower`, 'lowerRowKick', { enabled: true, brightness: 0.7, color: CYAN, direction: 'centerOut' }), stageBar: 5 },
      { ...ledMutation(`${id}-outer`, 'outerGridHero', { enabled: true, brightness: 0.74, color: EMERALD, direction: 'chase' }), stageBar: 7 },
    ],
    beatMutations: ledEveryBeat(id, { primary: CYAN, secondary: EMERALD, brightness: 0.9, directionA: 'centerOut', directionB: 'edgesIn' }),
    fourBarVariations: ledFourBarPatterns(id),
    eightBarRecruitment: [
      { ...ledMutation(`${id}-stage-one`, 'leftColumnResponse', { enabled: true, brightness: 0.72, color: CYAN, direction: 'leftToRight' }), stage: 1, cumulative: true },
      { ...ledMutation(`${id}-stage-two`, 'rightColumnResponse', { enabled: true, brightness: 0.82, color: EMERALD, direction: 'rightToLeft' }), stage: 2, cumulative: true },
    ],
    ...ledRhythmResponses(id, { kickColor: CYAN, snareColor: EMERALD, textureColor: BLUE }),
    modulations: [{ source: 'buildProgress', target: 'fixture.brightness', amount: 0.14, min: 0, max: 0.14, mode: 'add', requiredCapability: 'Track Energy Curve' }],
  })
}

function ledPreDrop(): LaserDmxShowDirectorPerformanceScene {
  const id = 'led-grid-pre-drop'
  return sceneBase(id, 'LED Bar Grid Performance · Pre-drop', section(['preDrop']), ['ledBar', 'ledTube'], 'preDrop', {
    global: { dimmer: 0.62, globalGlow: 0.46, backgroundFade: 0.95, beamPersistence: 0.01 },
    barProgression: [
      { ...ledMutation(`${id}-center-strip`, 'innerGridPrimary', { enabled: true, brightness: 0.74, color: CYAN, direction: 'edgesIn' }), stageBar: 1 },
      { ...ledMutation(`${id}-narrow-top`, 'textureTransient', { enabled: true, brightness: 0.38, color: EMERALD, direction: 'centerOut' }), stageBar: 1 },
    ],
    beatMutations: [{
      id: `${id}-center-tension`, beatDivision: 1, beatOffsets: [0, 1], beatCycleLength: 2,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['innerGridPrimary'] },
      fixtureActions: [ledAction(`${id}-center-tension-action`, { enabled: true, brightness: 0.92, color: CYAN, direction: 'edgesIn' })],
    }],
    blackoutWindows: [{ id: `${id}-half-beat-cut`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: 0.5, justification: 'A bounded half-beat cut resolves directly into the full-grid drop impact.' }],
  })
}

function ledDrop(dropTwo: boolean): LaserDmxShowDirectorPerformanceScene {
  const id = dropTwo ? 'led-grid-drop-2' : 'led-grid-drop-1'
  const baseRoles = dropTwo ? ['checkerA', 'checkerB'] : ['lowerRowKick', 'upperRowSnare', 'outerGridHero', 'innerGridPrimary']
  return sceneBase(id, `LED Bar Grid Performance · ${dropTwo ? 'Drop 2+' : 'Drop 1'}`, section(['drop'], dropTwo ? { minOccurrence: 2 } : [1]), ['ledBar', 'ledTube'], dropTwo ? 'drop2' : 'drop1', {
    global: { dimmer: dropTwo ? 0.98 : 0.92, globalGlow: dropTwo ? 0.86 : 0.76, backgroundFade: 0.82, beamPersistence: 0.05 },
    barProgression: baseRoles.map((role, index) => ({
      ...ledMutation(`${id}-base-${role}`, role, {
        enabled: true,
        brightness: dropTwo ? 0.84 : 0.78,
        color: index % 2 === 0 ? CYAN : EMERALD,
        direction: dropTwo ? (index % 2 === 0 ? 'chase' : 'edgesIn') : (index % 2 === 0 ? 'centerOut' : 'edgesIn'),
      }),
      stageBar: 1,
    })),
    beatMutations: [
      ...ledEveryBeat(id, { primary: CYAN, secondary: EMERALD, brightness: 1, directionA: dropTwo ? 'chase' : 'centerOut', directionB: dropTwo ? 'rightToLeft' : 'edgesIn' }),
      ...ledDownbeatImpact(id),
    ],
    kickMutations: [
      { ...ledMutation(`${id}-kick`, 'lowerRowKick', { enabled: true, brightness: 1, color: CYAN, direction: 'centerOut' }), threshold: 0.34 },
      { ...ledMutation(`${id}-kick-duck`, 'upperRowSnare', { enabled: true, brightness: 0.38 }), threshold: 0.34 },
    ],
    snareMutations: [
      { ...ledMutation(`${id}-snare`, 'upperRowSnare', { enabled: true, brightness: 1, color: EMERALD, direction: 'edgesIn' }), threshold: 0.34 },
      { ...ledMutation(`${id}-snare-duck`, 'lowerRowKick', { enabled: true, brightness: 0.4 }), threshold: 0.34 },
    ],
    hatMutations: [{ ...ledMutation(`${id}-hat`, 'textureTransient', { enabled: true, brightness: 0.82, color: BLUE, direction: 'chase' }), threshold: 0.26 }],
    transientMutations: [{
      ...ledMutation(`${id}-transient`, dropTwo ? 'diagonalA' : 'textureTransient', { enabled: true, brightness: 0.94, color: dropTwo ? MAGENTA : BLUE, direction: 'chase' }),
      threshold: 0.6,
      durationBeats: 0.25,
    }],
    fourBarVariations: dropTwo
      ? [
          { id: `${id}-diagonal-a`, motifFamily: 'diagonal-a', address: { bankRoles: ['diagonalA'] }, fixtureActions: [ledAction(`${id}-diagonal-a-action`, { enabled: true, brightness: 0.96, color: CYAN, direction: 'leftToRight' })] },
          { id: `${id}-diagonal-b`, motifFamily: 'diagonal-b', address: { bankRoles: ['diagonalB'] }, fixtureActions: [ledAction(`${id}-diagonal-b-action`, { enabled: true, brightness: 0.96, color: EMERALD, direction: 'rightToLeft' })] },
          { id: `${id}-checker`, motifFamily: 'checker', address: { bankRoles: ['checkerA', 'checkerB'] }, fixtureActions: [ledAction(`${id}-checker-action`, { enabled: true, brightness: 0.9, color: VIOLET, direction: 'chase' })] },
        ]
      : ledFourBarPatterns(id),
    eightBarRecruitment: [
      { ...ledMutation(`${id}-stage-one`, 'innerGridPrimary', { enabled: true, brightness: 0.82, color: CYAN, direction: 'centerOut' }), stage: 1, cumulative: true },
      { ...ledMutation(`${id}-stage-two`, dropTwo ? 'diagonalA' : 'outerGridHero', { enabled: true, brightness: 0.92, color: dropTwo ? MAGENTA : EMERALD, direction: 'chase' }), stage: 2, cumulative: true },
    ],
    sixteenBarEvolution: dropTwo ? [{ ...ledMutation(`${id}-mirror-cascade`, 'allLeds', { enabled: true, brightness: 0.9, color: CYAN, direction: 'centerOut' }), phase: 1, phraseLengthBars: 16 }] : [],
  })
}

function ledBreakdown(): LaserDmxShowDirectorPerformanceScene {
  const id = 'led-grid-breakdown'
  return sceneBase(id, 'LED Bar Grid Performance · Breakdown', section(['breakdown', 'bridge']), ['ledBar', 'ledTube'], 'breakdown', {
    global: { dimmer: 0.5, globalGlow: 0.4, backgroundFade: 0.95, beamPersistence: 0.02 },
    barProgression: [
      { ...ledMutation(`${id}-inner`, 'innerGridPrimary', { enabled: true, brightness: 0.44, color: CYAN, direction: 'centerOut' }), stageBar: 1 },
      { ...ledMutation(`${id}-left-isolation`, 'leftColumnResponse', { enabled: true, brightness: 0.3, color: EMERALD, direction: 'leftToRight' }), stageBar: 5 },
    ],
    beatMutations: [{
      id: `${id}-soft-pulse`, beatDivision: 2, beatOffsets: [0], beatCycleLength: 2,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['innerGridPrimary'] },
      fixtureActions: [ledAction(`${id}-soft-pulse-action`, { enabled: true, brightness: 0.58, color: CYAN, direction: 'centerOut' })],
    }],
  })
}

function ledOutro(): LaserDmxShowDirectorPerformanceScene {
  const id = 'led-grid-outro'
  return sceneBase(id, 'LED Bar Grid Performance · Outro', section(['outro']), ['ledBar', 'ledTube'], 'outro', {
    global: { dimmer: 0.42, globalGlow: 0.34, backgroundFade: 0.96, beamPersistence: 0.01 },
    barProgression: [
      { ...ledMutation(`${id}-all-release-start`, 'allLeds', { enabled: true, brightness: 0.46, color: CYAN, direction: 'edgesIn' }), stageBar: 1, cumulative: false },
      { ...ledMutation(`${id}-upper-release`, 'upperRowSnare', { enabled: true, brightness: 0.38, color: EMERALD, direction: 'rightToLeft' }), stageBar: 3, cumulative: false },
      { ...ledMutation(`${id}-center-release`, 'innerGridPrimary', { enabled: true, brightness: 0.3, color: CYAN, direction: 'centerOut' }), stageBar: 5, cumulative: false },
      { ...ledMutation(`${id}-single-final`, 'innerGridPrimary', { enabled: true, brightness: 0.22, color: CYAN, direction: 'edgesIn' }), stageBar: 7, cumulative: false },
    ],
  })
}

export function createLedBarGridPerformanceProgram(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 3,
    id: 'led-bar-grid-performance',
    name: 'LED Bar Grid Performance',
    description: 'Rhythmic architectural LED grid choreography with explicit row, column, diagonal, checker, and bounded full-grid impact ownership.',
    deterministicSeed: 0x1ed6a2,
    scenes: [ledIntro(), ledVerse(), ledBuild(), ledPreDrop(), ledDrop(false), ledBreakdown(), ledDrop(true), ledOutro()],
    fixtureBanks: structuredClone(LED_BAR_GRID_PERFORMANCE_BANKS),
    bankRoles: addressesFromBanks(LED_BAR_GRID_PERFORMANCE_BANKS),
    energyEnvelopes: {
      intro: envelope([1, 2], [1, 4], [0.22, 0.58], [0, 24], [0, 0.18], [0.22, 0.5], [0.08, 0.28], [0.6, 0.9]),
      verse: envelope([2, 4], [3, 7], [0.38, 0.82], [0, 32], [0, 0.28], [0.34, 0.62], [0.24, 0.56], [0.32, 0.72]),
      build: envelope([2, 7], [2, 10], [0.44, 0.94], [0, 44], [0, 0.36], [0.42, 0.76], [0.28, 0.78], [0.12, 0.68]),
      preDrop: envelope([1, 2], [1, 4], [0.34, 0.78], [0, 18], [0, 0.15], [0.28, 0.54], [0.08, 0.32], [0.58, 0.9]),
      drop1: envelope([4, 8], [6, 10], [0.58, 1], [0, 54], [0, 0.42], [0.58, 0.9], [0.52, 0.92], [0, 0.42]),
      breakdown: envelope([1, 3], [1, 4], [0.22, 0.58], [0, 22], [0, 0.18], [0.22, 0.48], [0.08, 0.34], [0.58, 0.9]),
      drop2: envelope([5, 9], [7, 10], [0.64, 1], [0, 62], [0, 0.5], [0.64, 0.96], [0.62, 1], [0, 0.32]),
      outro: envelope([1, 4], [1, 10], [0.16, 0.5], [0, 20], [0, 0.12], [0.16, 0.42], [0.06, 0.4], [0.5, 0.94]),
    },
    blackoutPolicy: { ...BLACKOUT_POLICY },
    fallbackOrder: ['verse', 'intro', 'build', 'drop', 'breakdown', 'outro'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    diagnostics: {
      authoringVersion: 'rig-performance-patch-3',
      notes: [
        'Canonical source rig: led-bar-grid.',
        'LED bars and tubes use only enabled, brightness, color, and component.ledDirection actions.',
        'No laser target, fan, beam-travel, or fake ray properties are authored for LED fixtures.',
        'Full-grid white is bounded to a quarter-beat downbeat impact.',
      ],
      expectedFixtureSemanticKeys: [...LED_ALL],
    },
  }
}

// Moving Head Sweep Performance --------------------------------------------

const MOVING_HEADS = ['sweep-head-fl', 'sweep-head-fr', 'sweep-head-bl', 'sweep-head-br'] as const

export const MOVING_HEAD_SWEEP_PERFORMANCE_BANKS = Object.freeze({
  leftMovement: bank('left', ['sweep-head-fl', 'sweep-head-bl'], 'Left movement bank', 'Front-left and back-left moving heads retain a readable left-side path.'),
  rightMovement: bank('right', ['sweep-head-fr', 'sweep-head-br'], 'Right movement bank', 'Front-right and back-right moving heads retain a readable right-side path.'),
  innerPrimary: bank('primary', ['sweep-head-bl', 'sweep-head-br'], 'Inner primary bank', 'Rear pair owns inner mirrored phrase motion and snare accents.'),
  outerHero: bank('hero', ['sweep-head-fl', 'sweep-head-fr'], 'Outer hero bank', 'Front pair owns broad expansion and kick accents.'),
  upperRear: bank('top', ['sweep-head-bl', 'sweep-head-br'], 'Upper or rear bank', 'Rear fixtures add phrase depth and second-drop crossing paths.'),
  kickAccent: bank('kick', ['sweep-head-fl', 'sweep-head-fr'], 'Kick accent bank', 'Outer front pair receives kick brightness accents.'),
  snareAccent: bank('snare', ['sweep-head-bl', 'sweep-head-br'], 'Snare accent bank', 'Inner rear pair receives snare brightness accents.'),
  downbeatImpact: bank('downbeat', MOVING_HEADS, 'Downbeat impact bank', 'All heads receive a bounded white intensity impact without path teleportation.'),
  breakdownIsolation: bank('movement', ['sweep-head-bl'], 'Breakdown isolation bank', 'Single restrained rear-left fixture for breakdown negative space.'),
  allHeads: bank('movement', MOVING_HEADS, 'All moving heads', 'All four moving heads in the canonical source rig.'),
  frontLeft: bank('left', ['sweep-head-fl'], 'Front-left head', 'Stable identifier for fixture-local path authoring.'),
  frontRight: bank('right', ['sweep-head-fr'], 'Front-right head', 'Stable identifier for fixture-local path authoring.'),
  backLeft: bank('left', ['sweep-head-bl'], 'Back-left head', 'Stable identifier for fixture-local path authoring.'),
  backRight: bank('right', ['sweep-head-br'], 'Back-right head', 'Stable identifier for fixture-local path authoring.'),
  washTexture: bank('atmosphere', ['sweep-wash'], 'Wash texture bank', 'Soft stage wash supporting moving-head visibility.'),
} satisfies Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>)

interface HeadPathPoint {
  role: 'frontLeft' | 'frontRight' | 'backLeft' | 'backRight'
  x: number
  y: number
  rotation: number
}

function headPathMutations(
  prefix: string,
  points: readonly HeadPathPoint[],
  options: { brightness: number; color: string; spread: number; focus: number; style: LaserDmxShowDirectorMovingHeadPanTiltStyle; targetMode?: LaserDmxShowDirectorMovingHeadFixtureAction['targetMode']; stageBar?: number },
): NonNullable<LaserDmxShowDirectorPerformanceScene['barProgression']> {
  return points.map(point => ({
    ...headMutation(`${prefix}-${point.role}`, point.role, {
      enabled: true,
      brightness: options.brightness,
      color: options.color,
      targetMode: options.targetMode ?? 'sweep',
      targetPoints: target(`${prefix}-${point.role}-target`, point.x, point.y),
      fanSpread: options.spread,
      focus: options.focus,
      rotation: point.rotation,
      movementStyle: options.style,
    }),
    stageBar: options.stageBar ?? 1,
    cumulative: true,
  }))
}

const PATH_MIRRORED: readonly HeadPathPoint[] = [
  { role: 'frontLeft', x: 5.6, y: 2.2, rotation: -18 },
  { role: 'frontRight', x: 8.4, y: 2.2, rotation: 198 },
  { role: 'backLeft', x: 5.2, y: 6.8, rotation: 22 },
  { role: 'backRight', x: 8.8, y: 6.8, rotation: 158 },
]

const PATH_INWARD: readonly HeadPathPoint[] = [
  { role: 'frontLeft', x: 6.2, y: 3.1, rotation: -8 },
  { role: 'frontRight', x: 7.8, y: 3.1, rotation: 188 },
  { role: 'backLeft', x: 6.1, y: 5.4, rotation: 12 },
  { role: 'backRight', x: 7.9, y: 5.4, rotation: 168 },
]

const PATH_OUTWARD: readonly HeadPathPoint[] = [
  { role: 'frontLeft', x: 1.4, y: 1.4, rotation: -34 },
  { role: 'frontRight', x: 12.6, y: 1.4, rotation: 214 },
  { role: 'backLeft', x: 2.1, y: 8.2, rotation: 40 },
  { role: 'backRight', x: 11.9, y: 8.2, rotation: 140 },
]

const PATH_CROSSING: readonly HeadPathPoint[] = [
  { role: 'frontLeft', x: 10.8, y: 2, rotation: 18 },
  { role: 'frontRight', x: 3.2, y: 2, rotation: 162 },
  { role: 'backLeft', x: 11.2, y: 7.8, rotation: -18 },
  { role: 'backRight', x: 2.8, y: 7.8, rotation: 198 },
]

const PATH_RADIAL: readonly HeadPathPoint[] = [
  { role: 'frontLeft', x: 9.8, y: 1.2, rotation: 8 },
  { role: 'frontRight', x: 4.2, y: 1.2, rotation: 172 },
  { role: 'backLeft', x: 1.6, y: 8.7, rotation: 48 },
  { role: 'backRight', x: 12.4, y: 8.7, rotation: 132 },
]

function headEveryBeat(
  prefix: string,
  options: { leftColor: string; rightColor: string; brightness?: number },
): NonNullable<LaserDmxShowDirectorPerformanceScene['beatMutations']> {
  return [
    {
      id: `${prefix}-left-accent`, beatDivision: 1, beatOffsets: [0, 2], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['leftMovement'] },
      fixtureActions: [headAction(`${prefix}-left-accent-action`, { enabled: true, brightness: options.brightness ?? 0.94, color: options.leftColor })],
    },
    {
      id: `${prefix}-right-rest`, beatDivision: 1, beatOffsets: [0, 2], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['rightMovement'] },
      fixtureActions: [headAction(`${prefix}-right-rest-action`, { enabled: true, brightness: 0.4, color: options.rightColor })],
    },
    {
      id: `${prefix}-right-accent`, beatDivision: 1, beatOffsets: [1, 3], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['rightMovement'] },
      fixtureActions: [headAction(`${prefix}-right-accent-action`, { enabled: true, brightness: options.brightness ?? 0.94, color: options.rightColor })],
    },
    {
      id: `${prefix}-left-rest`, beatDivision: 1, beatOffsets: [1, 3], beatCycleLength: 4,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['leftMovement'] },
      fixtureActions: [headAction(`${prefix}-left-rest-action`, { enabled: true, brightness: 0.4, color: options.leftColor })],
    },
  ]
}

function headRhythmResponses(prefix: string): Pick<LaserDmxShowDirectorPerformanceScene, 'kickMutations' | 'snareMutations'> {
  return {
    kickMutations: [
      { ...headMutation(`${prefix}-kick`, 'kickAccent', { enabled: true, brightness: 1, color: CYAN }), threshold: 0.36 },
      { ...headMutation(`${prefix}-kick-inner-duck`, 'snareAccent', { enabled: true, brightness: 0.36 }), threshold: 0.36 },
    ],
    snareMutations: [
      { ...headMutation(`${prefix}-snare`, 'snareAccent', { enabled: true, brightness: 1, color: EMERALD }), threshold: 0.36 },
      { ...headMutation(`${prefix}-snare-outer-duck`, 'kickAccent', { enabled: true, brightness: 0.38 }), threshold: 0.36 },
    ],
  }
}

function headDownbeatImpact(prefix: string): NonNullable<LaserDmxShowDirectorPerformanceScene['beatMutations']> {
  return [{
    id: `${prefix}-bounded-white-impact`,
    beatDivision: 1,
    beatOffsets: [0],
    beatCycleLength: 4,
    durationBeats: 0.25,
    responseEnvelope: IMPACT_RECOVERY_ENVELOPE,
    address: { bankRoles: ['downbeatImpact'] },
    fixtureActions: [headAction(`${prefix}-bounded-white-impact-action`, { enabled: true, brightness: 1, color: WHITE })],
  }]
}

function movingIntro(): LaserDmxShowDirectorPerformanceScene {
  const id = 'moving-head-intro'
  return sceneBase(id, 'Moving Head Sweep Performance · Intro', section(['intro']), ['movingHead', 'parWash'], 'intro', {
    global: { dimmer: 0.5, globalGlow: 0.5, backgroundFade: 0.93, beamPersistence: 0.12 },
    barProgression: [
      ...headPathMutations(`${id}-rear`, PATH_MIRRORED.filter(point => point.role === 'backLeft'), { brightness: 0.46, color: CYAN, spread: 9, focus: 0.9, style: 'smoothSweep' }),
      { ...washMutation(`${id}-wash`, 'washTexture', { enabled: true, brightness: 0.22, color: DEEP_BLUE, fanSpread: 68, focus: 0.28 }), stageBar: 1 },
      ...headPathMutations(`${id}-rear-pair`, PATH_MIRRORED.filter(point => point.role === 'backRight'), { brightness: 0.42, color: EMERALD, spread: 9, focus: 0.9, style: 'smoothSweep', stageBar: 5 }),
    ],
    beatMutations: [{
      id: `${id}-slow-accent`, beatDivision: 2, beatOffsets: [0], beatCycleLength: 2,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['upperRear'] },
      fixtureActions: [headAction(`${id}-slow-accent-action`, { enabled: true, brightness: 0.58, color: CYAN })],
    }],
  })
}

function movingVerse(): LaserDmxShowDirectorPerformanceScene {
  const id = 'moving-head-verse'
  return sceneBase(id, 'Moving Head Sweep Performance · Verse', section(['verse']), ['movingHead', 'parWash'], 'verse', {
    global: { dimmer: 0.68, globalGlow: 0.62, backgroundFade: 0.89, beamPersistence: 0.14 },
    barProgression: [
      ...headPathMutations(`${id}-mirrored`, PATH_MIRRORED, { brightness: 0.64, color: CYAN, spread: 14, focus: 0.88, style: 'smoothSweep' }),
      { ...washMutation(`${id}-wash`, 'washTexture', { enabled: true, brightness: 0.28, color: DEEP_BLUE, fanSpread: 72, focus: 0.3 }), stageBar: 1 },
    ],
    beatMutations: headEveryBeat(id, { leftColor: CYAN, rightColor: EMERALD, brightness: 0.82 }),
    fourBarVariations: [
      { ...headMutation(`${id}-mirrored-phrase`, 'allHeads', { enabled: true, brightness: 0.72, movementStyle: 'smoothSweep', fanSpread: 16 }), motifFamily: 'mirrored-sweep' },
      { ...headMutation(`${id}-alternating-phrase`, 'allHeads', { enabled: true, brightness: 0.74, movementStyle: 'figureEight', fanSpread: 18 }), motifFamily: 'figure-eight-sweep' },
    ],
    eightBarRecruitment: [{ ...headMutation(`${id}-outer-recruit`, 'outerHero', { enabled: true, brightness: 0.7, color: EMERALD, movementStyle: 'smoothSweep' }), stage: 2, cumulative: true }],
    ...headRhythmResponses(id),
  })
}

function movingBuild(): LaserDmxShowDirectorPerformanceScene {
  const id = 'moving-head-build'
  return sceneBase(id, 'Moving Head Sweep Performance · Build', section(['build']), ['movingHead', 'parWash'], 'build', {
    global: { dimmer: 0.8, globalGlow: 0.72, backgroundFade: 0.86, beamPersistence: 0.12 },
    barProgression: [
      ...headPathMutations(`${id}-inner`, PATH_INWARD.filter(point => point.role === 'backLeft' || point.role === 'backRight'), { brightness: 0.68, color: CYAN, spread: 10, focus: 0.92, style: 'smoothSweep', stageBar: 1 }),
      ...headPathMutations(`${id}-front-left`, PATH_INWARD.filter(point => point.role === 'frontLeft'), { brightness: 0.72, color: EMERALD, spread: 12, focus: 0.9, style: 'smoothSweep', stageBar: 3 }),
      ...headPathMutations(`${id}-front-right`, PATH_INWARD.filter(point => point.role === 'frontRight'), { brightness: 0.72, color: EMERALD, spread: 12, focus: 0.9, style: 'smoothSweep', stageBar: 5 }),
      { ...washMutation(`${id}-wash`, 'washTexture', { enabled: true, brightness: 0.42, color: DEEP_BLUE, fanSpread: 78, focus: 0.3 }), stageBar: 1 },
    ],
    beatMutations: headEveryBeat(id, { leftColor: CYAN, rightColor: EMERALD, brightness: 0.9 }),
    fourBarVariations: [
      { ...headMutation(`${id}-compress`, 'allHeads', { enabled: true, brightness: 0.78, fanSpread: 9, focus: 0.94, movementStyle: 'smoothSweep' }), motifFamily: 'compression' },
      { ...headMutation(`${id}-widen`, 'allHeads', { enabled: true, brightness: 0.82, fanSpread: 18, focus: 0.88, movementStyle: 'smoothSweep' }), motifFamily: 'controlled-widening' },
    ],
    eightBarRecruitment: [
      { ...headMutation(`${id}-inner-stage`, 'innerPrimary', { enabled: true, brightness: 0.72, color: CYAN, movementStyle: 'smoothSweep' }), stage: 1, cumulative: true },
      { ...headMutation(`${id}-outer-stage`, 'outerHero', { enabled: true, brightness: 0.86, color: EMERALD, movementStyle: 'smoothSweep' }), stage: 2, cumulative: true },
    ],
    ...headRhythmResponses(id),
    modulations: [{ source: 'buildProgress', target: 'fixture.fanSpread', amount: 8, min: 0, max: 8, mode: 'add', requiredCapability: 'Track Energy Curve' }],
  })
}

function movingPreDrop(): LaserDmxShowDirectorPerformanceScene {
  const id = 'moving-head-pre-drop'
  return sceneBase(id, 'Moving Head Sweep Performance · Pre-drop', section(['preDrop']), ['movingHead', 'parWash'], 'preDrop', {
    global: { dimmer: 0.62, globalGlow: 0.5, backgroundFade: 0.94, beamPersistence: 0.08 },
    barProgression: [
      ...headPathMutations(`${id}-held`, PATH_INWARD, { brightness: 0.72, color: CYAN, spread: 5, focus: 0.97, style: 'locked', targetMode: 'fixed' }),
      { ...washMutation(`${id}-wash`, 'washTexture', { enabled: true, brightness: 0.18, color: DEEP_BLUE, fanSpread: 58, focus: 0.36 }), stageBar: 1 },
    ],
    beatMutations: [{
      id: `${id}-held-pulse`, beatDivision: 1, beatOffsets: [0, 1], beatCycleLength: 2,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['innerPrimary'] },
      fixtureActions: [headAction(`${id}-held-pulse-action`, { enabled: true, brightness: 0.88, color: CYAN })],
    }],
    blackoutWindows: [{ id: `${id}-half-beat-cut`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: 0.5, justification: 'A bounded held-position cut releases into the broad synchronized expansion.' }],
  })
}

function movingDrop(dropTwo: boolean): LaserDmxShowDirectorPerformanceScene {
  const id = dropTwo ? 'moving-head-drop-2' : 'moving-head-drop-1'
  const path = dropTwo ? PATH_CROSSING : PATH_OUTWARD
  return sceneBase(id, `Moving Head Sweep Performance · ${dropTwo ? 'Drop 2+' : 'Drop 1'}`, section(['drop'], dropTwo ? { minOccurrence: 2 } : [1]), ['movingHead', 'parWash'], dropTwo ? 'drop2' : 'drop1', {
    global: { dimmer: dropTwo ? 0.98 : 0.92, globalGlow: dropTwo ? 0.92 : 0.82, backgroundFade: 0.8, beamPersistence: 0.16 },
    barProgression: [
      ...headPathMutations(`${id}-path`, path, { brightness: dropTwo ? 0.9 : 0.84, color: CYAN, spread: dropTwo ? 28 : 24, focus: 0.88, style: dropTwo ? 'figureEight' : 'smoothSweep' }),
      { ...washMutation(`${id}-wash`, 'washTexture', { enabled: true, brightness: dropTwo ? 0.54 : 0.46, color: DEEP_BLUE, fanSpread: 86, focus: 0.28 }), stageBar: 1 },
    ],
    beatMutations: [
      ...headEveryBeat(id, { leftColor: CYAN, rightColor: EMERALD, brightness: 1 }),
      ...headDownbeatImpact(id),
    ],
    ...headRhythmResponses(id),
    fourBarVariations: dropTwo
      ? [
          { ...headMutation(`${id}-crossing`, 'allHeads', { enabled: true, brightness: 0.92, color: CYAN, fanSpread: 28, movementStyle: 'figureEight' }), motifFamily: 'crossing' },
          { ...headMutation(`${id}-radial`, 'allHeads', { enabled: true, brightness: 0.94, color: EMERALD, fanSpread: 34, movementStyle: 'smoothSweep' }), motifFamily: 'radial' },
        ]
      : [
          { ...headMutation(`${id}-wide-sweep`, 'allHeads', { enabled: true, brightness: 0.88, fanSpread: 24, movementStyle: 'smoothSweep' }), motifFamily: 'wide-sweep' },
          { ...headMutation(`${id}-alternating-sweep`, 'allHeads', { enabled: true, brightness: 0.9, fanSpread: 20, movementStyle: 'figureEight' }), motifFamily: 'alternating-sweep' },
        ],
    barMutations: [
      ...(dropTwo
        ? [
            ...headPathMutations(`${id}-cross-bar`, PATH_CROSSING, { brightness: 0.9, color: CYAN, spread: 28, focus: 0.88, style: 'figureEight' }).map(item => ({ ...item, intervalBars: 2, anchorBar: 0 })),
            ...headPathMutations(`${id}-radial-bar`, PATH_RADIAL, { brightness: 0.92, color: EMERALD, spread: 34, focus: 0.86, style: 'smoothSweep' }).map(item => ({ ...item, intervalBars: 2, anchorBar: 1 })),
          ]
        : []),
      ...headPathMutations(
        `${id}-stage-two-outer-path`,
        (dropTwo ? PATH_RADIAL : PATH_CROSSING).filter(point => point.role === 'frontLeft' || point.role === 'frontRight'),
        { brightness: dropTwo ? 0.98 : 0.94, color: EMERALD, spread: dropTwo ? 38 : 32, focus: 0.84, style: 'figureEight' },
      ).map(item => ({ ...item, intervalBars: 8, anchorBar: 8 })),
    ],
    eightBarRecruitment: [
      { ...headMutation(`${id}-inner-stage`, 'innerPrimary', { enabled: true, brightness: 0.84, color: CYAN, movementStyle: dropTwo ? 'figureEight' : 'smoothSweep' }), stage: 1, cumulative: true },
      { ...headMutation(`${id}-outer-stage`, 'outerHero', { enabled: true, brightness: 0.96, color: EMERALD, movementStyle: dropTwo ? 'figureEight' : 'smoothSweep' }), stage: 2, cumulative: true },
    ],
    sixteenBarEvolution: dropTwo ? [{ ...headMutation(`${id}-radial-evolution`, 'allHeads', { enabled: true, brightness: 0.96, color: VIOLET, fanSpread: 36, movementStyle: 'figureEight' }), phase: 1, phraseLengthBars: 16 }] : [],
  })
}

function movingBreakdown(): LaserDmxShowDirectorPerformanceScene {
  const id = 'moving-head-breakdown'
  return sceneBase(id, 'Moving Head Sweep Performance · Breakdown', section(['breakdown', 'bridge']), ['movingHead', 'parWash'], 'breakdown', {
    global: { dimmer: 0.48, globalGlow: 0.44, backgroundFade: 0.95, beamPersistence: 0.14 },
    barProgression: [
      ...headPathMutations(`${id}-isolation`, PATH_MIRRORED.filter(point => point.role === 'backLeft'), { brightness: 0.46, color: CYAN, spread: 8, focus: 0.94, style: 'smoothSweep' }),
      { ...washMutation(`${id}-wash`, 'washTexture', { enabled: true, brightness: 0.2, color: DEEP_BLUE, fanSpread: 64, focus: 0.34 }), stageBar: 1 },
      ...headPathMutations(`${id}-answer`, PATH_MIRRORED.filter(point => point.role === 'backRight'), { brightness: 0.36, color: EMERALD, spread: 8, focus: 0.94, style: 'smoothSweep', stageBar: 5 }),
    ],
    beatMutations: [{
      id: `${id}-slow-isolation-pulse`, beatDivision: 2, beatOffsets: [0], beatCycleLength: 2,
      responseEnvelope: LASER_DMX_SHOW_DIRECTOR_BEAT_RECOVERY_ENVELOPE,
      address: { bankRoles: ['breakdownIsolation'] },
      fixtureActions: [headAction(`${id}-slow-isolation-pulse-action`, { enabled: true, brightness: 0.58, color: CYAN })],
    }],
  })
}

function movingOutro(): LaserDmxShowDirectorPerformanceScene {
  const id = 'moving-head-outro'
  return sceneBase(id, 'Moving Head Sweep Performance · Outro', section(['outro']), ['movingHead', 'parWash'], 'outro', {
    global: { dimmer: 0.4, globalGlow: 0.36, backgroundFade: 0.96, beamPersistence: 0.1 },
    barProgression: [
      ...headPathMutations(`${id}-return`, PATH_MIRRORED, { brightness: 0.42, color: CYAN, spread: 10, focus: 0.92, style: 'smoothSweep' }),
      { ...washMutation(`${id}-wash`, 'washTexture', { enabled: true, brightness: 0.16, color: DEEP_BLUE, fanSpread: 58, focus: 0.36 }), stageBar: 1 },
      { ...headMutation(`${id}-rear-release`, 'upperRear', { enabled: true, brightness: 0.3, color: EMERALD, movementStyle: 'smoothSweep' }), stageBar: 5, cumulative: false },
      { ...headMutation(`${id}-single-release`, 'breakdownIsolation', { enabled: true, brightness: 0.22, color: CYAN, movementStyle: 'locked', targetMode: 'fixed' }), stageBar: 7, cumulative: false },
    ],
  })
}

export function createMovingHeadSweepPerformanceProgram(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 3,
    id: 'moving-head-sweep-performance',
    name: 'Moving Head Sweep Performance',
    description: 'Phrase-driven mirrored moving-head choreography with smooth sweep continuity, distinguishable side banks, bounded beat accents, controlled compression, and evolved crossing motion.',
    deterministicSeed: 0x4d0a31,
    scenes: [movingIntro(), movingVerse(), movingBuild(), movingPreDrop(), movingDrop(false), movingBreakdown(), movingDrop(true), movingOutro()],
    fixtureBanks: structuredClone(MOVING_HEAD_SWEEP_PERFORMANCE_BANKS),
    bankRoles: addressesFromBanks(MOVING_HEAD_SWEEP_PERFORMANCE_BANKS),
    energyEnvelopes: {
      intro: envelope([1, 2], [1, 3], [0.2, 0.56], [6, 14], [0.14, 0.42], [0.3, 0.56], [0.08, 0.24], [0.56, 0.86]),
      verse: envelope([2, 4], [2, 5], [0.36, 0.78], [10, 22], [0.28, 0.58], [0.42, 0.7], [0.2, 0.46], [0.28, 0.68]),
      build: envelope([2, 5], [2, 5], [0.42, 0.9], [5, 24], [0.32, 0.7], [0.48, 0.8], [0.24, 0.56], [0.2, 0.7]),
      preDrop: envelope([2, 3], [2, 5], [0.36, 0.74], [4, 10], [0, 0.22], [0.34, 0.56], [0.14, 0.38], [0.38, 0.72]),
      drop1: envelope([4, 5], [4, 6], [0.58, 1], [18, 34], [0.48, 0.82], [0.62, 0.92], [0.46, 0.72], [0.08, 0.4]),
      breakdown: envelope([1, 2], [1, 3], [0.2, 0.54], [5, 12], [0.12, 0.4], [0.28, 0.52], [0.08, 0.28], [0.62, 0.88]),
      drop2: envelope([4, 5], [4, 6], [0.64, 1], [24, 42], [0.56, 0.94], [0.68, 1], [0.54, 0.82], [0.04, 0.34]),
      outro: envelope([1, 4], [1, 5], [0.16, 0.46], [5, 14], [0, 0.38], [0.2, 0.46], [0.06, 0.3], [0.5, 0.9]),
    },
    blackoutPolicy: { ...BLACKOUT_POLICY },
    fallbackOrder: ['verse', 'intro', 'build', 'drop', 'breakdown', 'outro'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    diagnostics: {
      authoringVersion: 'rig-performance-patch-3',
      notes: [
        'Canonical source rig: moving-head-sweep.',
        'Moving heads use only supported brightness, color, target mode, local target point, spread, focus, rotation, and pan/tilt style actions.',
        'Beat accents change brightness and color while phrase-level mutations own path changes.',
        'The source par wash remains a subordinate supported wash layer and is never treated as a laser fixture.',
      ],
      expectedFixtureSemanticKeys: [...MOVING_HEADS, 'sweep-wash'],
    },
  }
}
