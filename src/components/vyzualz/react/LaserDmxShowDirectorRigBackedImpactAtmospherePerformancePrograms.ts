import type {
  LaserDmxShowDirectorAuthoredFixtureBankMetadata,
  LaserDmxShowDirectorBlinderFixtureAction,
  LaserDmxShowDirectorCo2FixtureAction,
  LaserDmxShowDirectorHazeFixtureAction,
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceBeatMutation,
  LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
  LaserDmxShowDirectorPerformanceSectionMatch,
  LaserDmxShowDirectorSectionEnergyEnvelope,
  LaserDmxShowDirectorStrobeFixtureAction,
} from './LaserDmxShowDirectorPerformanceProgram'
import type { LaserDmxShowDirectorFixtureKind } from './ReactTypes'

const WHITE = '#f7fbff'
const ICE = '#bdeaff'
const CYAN = '#32e6ff'
const EMERALD = '#2ff0a8'
const WARM_WHITE = '#ffd27a'
const SOFT_WARM = '#fff0bd'

const SHORT_FLASH_ENVELOPE = Object.freeze({
  holdUntil: 0.06,
  releaseUntil: 0.2,
  curve: 'easeOut' as const,
})

const IMPACT_FLASH_ENVELOPE = Object.freeze({
  holdUntil: 0.08,
  releaseUntil: 0.24,
  curve: 'easeOut' as const,
})

const CO2_BURST_ENVELOPE = Object.freeze({
  holdUntil: 0.12,
  releaseUntil: 0.32,
  curve: 'easeOut' as const,
})

const BLACKOUT_POLICY = Object.freeze({
  maxPreDropBeats: 0.5,
  maxImpactCutBeats: 0.25,
  maxFakeoutBeats: 0.5,
  maximumProgrammedBlackoutRatio: 0.04,
  retriggerGuardBeats: 1,
  breakdownRequiresVisibleOutput: false,
  minimumVisibleFixtureBrightness: 0,
})

export const STROBE_BLINDER_PERFORMANCE_LIMITS = Object.freeze({
  maximumStrobeDurationMs: 96,
  maximumBlinderDurationMs: 240,
  maximumFullFrameWhiteDurationMs: 96,
  maximumScheduledActivationRatio: IMPACT_FLASH_ENVELOPE.releaseUntil,
  minimumRepeatedImpactIntervalBeats: 1,
})

export const HAZE_CO2_PERFORMANCE_LIMITS = Object.freeze({
  maximumHazeAmount: 0.62,
  maximumCo2BurstDurationMs: 650,
  maximumScheduledBurstActivationRatio: CO2_BURST_ENVELOPE.releaseUntil,
  minimumRepeatedBurstIntervalBeats: 4,
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
  glow: [number, number],
  density: [number, number],
  negativeSpace: [number, number],
): LaserDmxShowDirectorSectionEnergyEnvelope {
  const range = ([min, max]: [number, number]) => ({ min, max })
  return {
    activeFixtureGroups: range(activeFixtureGroups),
    estimatedBeamCount: range(estimatedBeamCount),
    brightness: range(brightness),
    fanSpread: range([0, 12]),
    movementStrength: range([0, 0.18]),
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
    fixture: { enabled: false, brightness: 0 },
    global: { dimmer: 1, globalGlow: 0.55, beamPersistence: 0.02, backgroundFade: 0.96, haze: 0 },
    energyEnvelopeKey,
    allowZeroBeamOutput: true,
    transitionIn: { durationBars: 0.04, curve: 'easeInOut' },
    transitionOut: { durationBars: 0.04, curve: 'easeInOut' },
    ...patch,
  }
}

function strobeAction(
  id: string,
  options: Omit<LaserDmxShowDirectorStrobeFixtureAction, 'id' | 'kind'>,
): LaserDmxShowDirectorStrobeFixtureAction {
  return { id, kind: 'strobe', ...options }
}

function blinderAction(
  id: string,
  options: Omit<LaserDmxShowDirectorBlinderFixtureAction, 'id' | 'kind'>,
): LaserDmxShowDirectorBlinderFixtureAction {
  return { id, kind: 'blinder', ...options }
}

function hazeAction(
  id: string,
  options: Omit<LaserDmxShowDirectorHazeFixtureAction, 'id' | 'kind'>,
): LaserDmxShowDirectorHazeFixtureAction {
  return { id, kind: 'haze', ...options }
}

function co2Action(
  id: string,
  options: Omit<LaserDmxShowDirectorCo2FixtureAction, 'id' | 'kind'>,
): LaserDmxShowDirectorCo2FixtureAction {
  return { id, kind: 'co2', ...options }
}

function boundedStrobeMutation(
  id: string,
  role: string,
  options: { brightness: number; color?: string; rateHz: number; durationMs: number; durationBeats?: number },
): LaserDmxShowDirectorPerformanceMutationBase {
  return {
    id,
    durationBeats: options.durationBeats ?? 0.25,
    address: { bankRoles: [role] },
    fixture: { trigger: { mode: 'alwaysOn', fadeInMs: 0, fadeOutMs: options.durationMs } },
    fixtureActions: [strobeAction(`${id}-action`, {
      active: true,
      brightness: options.brightness,
      color: options.color ?? WHITE,
      rateHz: options.rateHz,
      durationMs: options.durationMs,
    })],
  }
}

function boundedBlinderMutation(
  id: string,
  role: string,
  options: { brightness: number; color?: string; durationMs: number; durationBeats?: number },
): LaserDmxShowDirectorPerformanceMutationBase {
  return {
    id,
    durationBeats: options.durationBeats ?? 0.25,
    address: { bankRoles: [role] },
    fixture: { trigger: { mode: 'alwaysOn', fadeInMs: 0, fadeOutMs: options.durationMs } },
    fixtureActions: [blinderAction(`${id}-action`, {
      active: true,
      brightness: options.brightness,
      color: options.color ?? WARM_WHITE,
      durationMs: options.durationMs,
    })],
  }
}

function scheduledStrobePulse(
  id: string,
  role: string,
  beatOffsets: number[],
  beatCycleLength: number,
  options: { brightness: number; color?: string; rateHz: number; durationMs: number; impact?: boolean },
): LaserDmxShowDirectorPerformanceBeatMutation {
  return {
    ...boundedStrobeMutation(id, role, options),
    beatDivision: 1,
    beatOffsets,
    beatCycleLength,
    responseEnvelope: options.impact ? IMPACT_FLASH_ENVELOPE : SHORT_FLASH_ENVELOPE,
  }
}

function scheduledBlinderPulse(
  id: string,
  role: string,
  beatOffsets: number[],
  beatCycleLength: number,
  options: { brightness: number; color?: string; durationMs: number },
): LaserDmxShowDirectorPerformanceBeatMutation {
  return {
    ...boundedBlinderMutation(id, role, options),
    beatDivision: 1,
    beatOffsets,
    beatCycleLength,
    responseEnvelope: IMPACT_FLASH_ENVELOPE,
  }
}

function boundedCo2Mutation(
  id: string,
  role: string,
  options: { brightness: number; burstStrength: number; durationMs: number; durationBeats?: number; color?: string },
): LaserDmxShowDirectorPerformanceMutationBase {
  return {
    id,
    durationBeats: options.durationBeats ?? 0.5,
    address: { bankRoles: [role] },
    fixture: { trigger: { mode: 'alwaysOn', fadeInMs: 0, fadeOutMs: options.durationMs } },
    fixtureActions: [co2Action(`${id}-action`, {
      active: true,
      brightness: options.brightness,
      burstStrength: options.burstStrength,
      durationMs: options.durationMs,
      color: options.color ?? ICE,
    })],
  }
}

function scheduledCo2Burst(
  id: string,
  role: string,
  beatOffsets: number[],
  beatCycleLength: number,
  options: { brightness: number; burstStrength: number; durationMs: number; color?: string },
): LaserDmxShowDirectorPerformanceBeatMutation {
  return {
    ...boundedCo2Mutation(id, role, options),
    beatDivision: 1,
    beatOffsets,
    beatCycleLength,
    responseEnvelope: CO2_BURST_ENVELOPE,
  }
}

// Strobe + Blinder Performance ---------------------------------------------

const ALL_STROBES = ['transient-strobe-l', 'transient-strobe-r', 'bass-flash-center'] as const
const ALL_BLINDERS = ['blinder-l', 'blinder-c', 'blinder-r'] as const

export const STROBE_BLINDER_PERFORMANCE_BANKS = Object.freeze({
  kickStrobeBank: bank('kick', ['bass-flash-center'], 'Kick strobe bank', 'The center strobe owns kick accents and never shares its ordinary event with the snare bank.'),
  snareStrobeBank: bank('snare', ['transient-strobe-l', 'transient-strobe-r'], 'Snare strobe bank', 'The paired side strobes own snare accents.'),
  downbeatStrobeBank: bank('downbeat', ALL_STROBES, 'Downbeat strobe bank', 'All three strobes may join only for bounded downbeat or section-entry impacts.'),
  leftBlinderBank: bank('left', ['blinder-l'], 'Left blinder bank', 'Warm left-side call bank.'),
  rightBlinderBank: bank('right', ['blinder-r'], 'Right blinder bank', 'Warm right-side response bank.'),
  fullImpactBlinderBank: bank('impact', ALL_BLINDERS, 'Full-impact blinder bank', 'All blinders, reserved for short structural impacts.'),
  buildPulseBank: bank('transient', ['transient-strobe-l', 'transient-strobe-r'], 'Build pulse bank', 'Side strobes recruited with increasing rhythmic frequency through the build.'),
  breakdownIsolationBank: bank('center', ['bass-flash-center', 'blinder-c'], 'Breakdown isolation bank', 'The center strobe and center blinder provide sparse isolated breakdown punctuation.'),
  allStrobes: bank('strobe', ALL_STROBES, 'All strobes', 'Every strobe in the canonical impact rig.'),
  allBlinders: bank('blinder', ALL_BLINDERS, 'All blinders', 'Every blinder in the canonical impact rig.'),
} satisfies Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>)

function strobeBlinderScene(
  kind: 'intro' | 'verse' | 'build' | 'preDrop' | 'drop1' | 'breakdown' | 'drop2' | 'outro',
): LaserDmxShowDirectorPerformanceScene {
  const id = `strobe-blinder-${kind === 'drop1' ? 'drop-1' : kind === 'drop2' ? 'drop-2' : kind === 'preDrop' ? 'pre-drop' : kind}`
  const sectionMatch = kind === 'drop1'
    ? section(['drop'], [1])
    : kind === 'drop2'
      ? section(['drop'], { minOccurrence: 2 })
      : kind === 'breakdown'
        ? section(['breakdown', 'bridge'])
        : kind === 'preDrop'
          ? section(['preDrop'])
          : section([kind])
  const energyKey = kind === 'drop1' ? 'drop1' : kind === 'drop2' ? 'drop2' : kind

  if (kind === 'intro') return sceneBase(id, 'Strobe + Blinder Performance · Intro', sectionMatch, ['strobe', 'blinder'], energyKey, {
    global: { dimmer: 0.52, globalGlow: 0.34, backgroundFade: 0.98, beamPersistence: 0.01, haze: 0 },
    beatMutations: [scheduledStrobePulse(`${id}-isolated`, 'kickStrobeBank', [0], 8, { brightness: 0.48, color: ICE, rateHz: 9, durationMs: 64 })],
  })

  if (kind === 'verse') return sceneBase(id, 'Strobe + Blinder Performance · Verse', sectionMatch, ['strobe', 'blinder'], energyKey, {
    global: { dimmer: 0.68, globalGlow: 0.46, backgroundFade: 0.97, beamPersistence: 0.01, haze: 0 },
    kickMutations: [{ ...boundedStrobeMutation(`${id}-kick`, 'kickStrobeBank', { brightness: 0.62, color: ICE, rateHz: 11, durationMs: 68 }), threshold: 0.58 }],
    snareMutations: [{ ...boundedStrobeMutation(`${id}-snare`, 'snareStrobeBank', { brightness: 0.68, rateHz: 15, durationMs: 72 }), threshold: 0.56 }],
    beatMutations: [scheduledBlinderPulse(`${id}-phrase-left`, 'leftBlinderBank', [0], 16, { brightness: 0.48, durationMs: 150 })],
  })

  if (kind === 'build') return sceneBase(id, 'Strobe + Blinder Performance · Build', sectionMatch, ['strobe', 'blinder'], energyKey, {
    global: { dimmer: 0.82, globalGlow: 0.68, backgroundFade: 0.96, beamPersistence: 0.01, haze: 0 },
    beatMutations: [
      scheduledStrobePulse(`${id}-half-rate`, 'buildPulseBank', [0], 2, { brightness: 0.7, color: CYAN, rateHz: 15, durationMs: 70 }),
      {
        ...scheduledStrobePulse(`${id}-full-rate`, 'kickStrobeBank', [1], 2, { brightness: 0.78, color: EMERALD, rateHz: 17, durationMs: 76 }),
        conditions: [{ source: 'buildProgress', operator: 'gte', value: 0.45, requiredCapability: 'Track Energy Curve' }],
      },
      {
        ...scheduledBlinderPulse(`${id}-late-left`, 'leftBlinderBank', [0], 4, { brightness: 0.72, durationMs: 170 }),
        conditions: [{ source: 'buildProgress', operator: 'gte', value: 0.72, requiredCapability: 'Track Energy Curve' }],
      },
      {
        ...scheduledBlinderPulse(`${id}-late-right`, 'rightBlinderBank', [2], 4, { brightness: 0.72, durationMs: 170 }),
        conditions: [{ source: 'buildProgress', operator: 'gte', value: 0.72, requiredCapability: 'Track Energy Curve' }],
      },
    ],
  })

  if (kind === 'preDrop') return sceneBase(id, 'Strobe + Blinder Performance · Pre-drop', sectionMatch, ['strobe', 'blinder'], energyKey, {
    global: { dimmer: 0.58, globalGlow: 0.4, backgroundFade: 0.99, beamPersistence: 0, haze: 0 },
    beatMutations: [scheduledStrobePulse(`${id}-tension-tick`, 'kickStrobeBank', [0], 4, { brightness: 0.54, color: ICE, rateHz: 8, durationMs: 60 })],
    sectionExitMutations: [boundedBlinderMutation(`${id}-isolated-hold`, 'breakdownIsolationBank', { brightness: 0.74, color: SOFT_WARM, durationMs: 220, durationBeats: 0.75 })],
    blackoutWindows: [{ id: `${id}-final-cut`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: 0.5, justification: 'A bounded half-beat tension cut follows the isolated center hold.' }],
  })

  if (kind === 'drop1' || kind === 'drop2') {
    const dropTwo = kind === 'drop2'
    return sceneBase(id, `Strobe + Blinder Performance · ${dropTwo ? 'Drop 2' : 'Drop 1'}`, sectionMatch, ['strobe', 'blinder'], energyKey, {
      global: { dimmer: 1, globalGlow: dropTwo ? 1 : 0.92, backgroundFade: 0.94, beamPersistence: 0, haze: 0 },
      transitionIn: { durationBars: 0.01, curve: 'step' },
      sectionEntryMutations: [
        boundedStrobeMutation(`${id}-entry-white`, 'downbeatStrobeBank', { brightness: 1, rateHz: dropTwo ? 24 : 22, durationMs: 96, durationBeats: 0.2 }),
        boundedBlinderMutation(`${id}-entry-warm`, 'fullImpactBlinderBank', { brightness: 1, durationMs: dropTwo ? 240 : 220, durationBeats: 0.4 }),
      ],
      kickMutations: [{ ...boundedStrobeMutation(`${id}-kick`, 'kickStrobeBank', { brightness: dropTwo ? 1 : 0.92, color: ICE, rateHz: dropTwo ? 19 : 17, durationMs: 78 }), threshold: 0.42 }],
      snareMutations: [{ ...boundedStrobeMutation(`${id}-snare`, 'snareStrobeBank', { brightness: 1, rateHz: dropTwo ? 24 : 21, durationMs: 84 }), threshold: 0.42 }],
      beatMutations: [
        scheduledStrobePulse(`${id}-downbeat`, 'downbeatStrobeBank', [0], 4, { brightness: 1, rateHz: dropTwo ? 24 : 22, durationMs: 90, impact: true }),
        scheduledBlinderPulse(`${id}-left-call`, 'leftBlinderBank', [0], dropTwo ? 4 : 8, { brightness: dropTwo ? 0.92 : 0.82, durationMs: dropTwo ? 210 : 190 }),
        scheduledBlinderPulse(`${id}-right-response`, 'rightBlinderBank', [dropTwo ? 2 : 4], dropTwo ? 4 : 8, { brightness: dropTwo ? 0.92 : 0.82, durationMs: dropTwo ? 210 : 190 }),
      ],
      transientMutations: [{
        ...boundedBlinderMutation(`${id}-strong-transient`, 'fullImpactBlinderBank', { brightness: dropTwo ? 1 : 0.9, color: SOFT_WARM, durationMs: dropTwo ? 230 : 205 }),
        threshold: dropTwo ? 0.72 : 0.8,
        probability: dropTwo ? 0.7 : 0.5,
      }],
    })
  }

  if (kind === 'breakdown') return sceneBase(id, 'Strobe + Blinder Performance · Breakdown', sectionMatch, ['strobe', 'blinder'], energyKey, {
    global: { dimmer: 0.44, globalGlow: 0.3, backgroundFade: 0.99, beamPersistence: 0, haze: 0 },
    beatMutations: [scheduledStrobePulse(`${id}-isolated-center`, 'kickStrobeBank', [0], 8, { brightness: 0.46, color: ICE, rateHz: 8, durationMs: 58 })],
    sectionEntryMutations: [boundedBlinderMutation(`${id}-entry-center`, 'breakdownIsolationBank', { brightness: 0.52, color: SOFT_WARM, durationMs: 160, durationBeats: 0.25 })],
  })

  return sceneBase(id, 'Strobe + Blinder Performance · Outro', sectionMatch, ['strobe', 'blinder'], energyKey, {
    global: { dimmer: 0.38, globalGlow: 0.24, backgroundFade: 1, beamPersistence: 0, haze: 0 },
    beatMutations: [scheduledStrobePulse(`${id}-release`, 'kickStrobeBank', [0], 8, { brightness: 0.34, color: ICE, rateHz: 7, durationMs: 54 })],
    sectionExitMutations: [{ id: `${id}-clean-release`, durationBeats: 1, address: { bankRoles: ['allStrobes', 'allBlinders'] }, fixture: { enabled: false, brightness: 0 }, global: { dimmer: 0, globalGlow: 0 } }],
  })
}

const STROBE_BLINDER_ENVELOPES = Object.freeze({
  intro: envelope([0, 1], [0, 1], [0, 0.5], [0.1, 0.42], [0, 0.08], [0.82, 1]),
  verse: envelope([0, 2], [0, 2], [0, 0.7], [0.2, 0.56], [0, 0.16], [0.68, 1]),
  build: envelope([0, 3], [0, 3], [0, 0.84], [0.3, 0.76], [0, 0.24], [0.5, 1]),
  preDrop: envelope([0, 2], [0, 2], [0, 0.74], [0.16, 0.48], [0, 0.12], [0.72, 1]),
  drop1: envelope([0, 6], [0, 6], [0, 1], [0.5, 1], [0, 0.5], [0, 1]),
  breakdown: envelope([0, 2], [0, 2], [0, 0.54], [0.1, 0.42], [0, 0.1], [0.75, 1]),
  drop2: envelope([0, 6], [0, 6], [0, 1], [0.58, 1], [0, 0.62], [0, 1]),
  outro: envelope([0, 1], [0, 1], [0, 0.38], [0, 0.28], [0, 0.06], [0.86, 1]),
})

export function createStrobeBlinderPerformanceProgram(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 3,
    id: 'strobe-blinder-hits-performance',
    name: 'Strobe + Blinder Performance',
    description: 'A transient-owned impact show with separate kick, snare, downbeat, left, right, build, breakdown, and full-impact banks. Every white or warm event is bounded and the default body state remains dark.',
    deterministicSeed: 74041,
    bankRoles: addressesFromBanks(STROBE_BLINDER_PERFORMANCE_BANKS),
    fixtureBanks: structuredClone(STROBE_BLINDER_PERFORMANCE_BANKS),
    scenes: [
      strobeBlinderScene('intro'),
      strobeBlinderScene('verse'),
      strobeBlinderScene('build'),
      strobeBlinderScene('preDrop'),
      strobeBlinderScene('drop1'),
      strobeBlinderScene('breakdown'),
      strobeBlinderScene('drop2'),
      strobeBlinderScene('outro'),
    ],
    energyEnvelopes: STROBE_BLINDER_ENVELOPES,
    blackoutPolicy: { ...BLACKOUT_POLICY },
    fallbackOrder: ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro', 'unknown'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    diagnostics: {
      authoringVersion: 'rig-performance-04-impact-atmosphere',
      expectedFixtureSemanticKeys: [...ALL_STROBES, ...ALL_BLINDERS],
      notes: [
        `Maximum authored strobe action: ${STROBE_BLINDER_PERFORMANCE_LIMITS.maximumStrobeDurationMs} ms.`,
        `Maximum authored blinder action: ${STROBE_BLINDER_PERFORMANCE_LIMITS.maximumBlinderDurationMs} ms.`,
        'No scene leaves a strobe or blinder enabled as a body state.',
        'Safety and user blackout authority remain final and external to the program.',
      ],
    },
  }
}

// Haze + CO2 Performance ----------------------------------------------------

const ALL_HAZE = ['haze-base-l', 'haze-base-r'] as const
const ALL_CO2 = ['co2-jet-l', 'co2-jet-r', 'phrase-co2-center'] as const

export const HAZE_CO2_PERFORMANCE_BANKS = Object.freeze({
  baseHazeBank: bank('atmosphere', ALL_HAZE, 'Base haze bank', 'The restrained full-song atmosphere bed.'),
  buildHazeBank: bank('atmosphere', ALL_HAZE, 'Build haze bank', 'Progressively rising build atmosphere, capped below permanent gray-cloud output.'),
  dropHazeBank: bank('atmosphere', ALL_HAZE, 'Drop haze bank', 'Drop atmosphere that reveals virtual beams without obscuring fixture origins or negative space.'),
  leftCo2ImpactBank: bank('left', ['co2-jet-l'], 'Left CO2-impact bank', 'Left virtual plume for alternating downbeat impacts.'),
  rightCo2ImpactBank: bank('right', ['co2-jet-r'], 'Right CO2-impact bank', 'Right virtual plume for alternating downbeat impacts.'),
  downbeatCo2ImpactBank: bank('downbeat', ['phrase-co2-center'], 'Downbeat CO2-impact bank', 'Center virtual plume reserved for major downbeats and section transitions.'),
  drop2ExpandedImpactBank: bank('impact', ALL_CO2, 'Drop 2 expanded impact bank', 'All virtual plume fixtures, reserved for bounded Drop 2 structural impacts.'),
  outroReleaseBank: bank('atmosphere', ALL_HAZE, 'Outro release bank', 'Both haze fixtures release to zero cleanly at the end of the outro.'),
  allHaze: bank('atmosphere', ALL_HAZE, 'All haze fixtures', 'Every haze fixture in the canonical atmosphere rig.'),
  allCo2: bank('co2Impact', ALL_CO2, 'All CO2-style fixtures', 'Every simulated CO2-style fixture in the canonical atmosphere rig.'),
} satisfies Record<string, LaserDmxShowDirectorAuthoredFixtureBankMetadata>)

function hazeCo2Scene(
  kind: 'intro' | 'verse' | 'build' | 'preDrop' | 'drop1' | 'breakdown' | 'drop2' | 'outro',
): LaserDmxShowDirectorPerformanceScene {
  const id = `haze-co2-${kind === 'drop1' ? 'drop-1' : kind === 'drop2' ? 'drop-2' : kind === 'preDrop' ? 'pre-drop' : kind}`
  const sectionMatch = kind === 'drop1'
    ? section(['drop'], [1])
    : kind === 'drop2'
      ? section(['drop'], { minOccurrence: 2 })
      : kind === 'breakdown'
        ? section(['breakdown', 'bridge'])
        : kind === 'preDrop'
          ? section(['preDrop'])
          : section([kind])
  const energyKey = kind === 'drop1' ? 'drop1' : kind === 'drop2' ? 'drop2' : kind

  if (kind === 'intro') return sceneBase(id, 'Haze + CO2 Performance · Intro', sectionMatch, ['haze', 'co2Jet'], energyKey, {
    global: { dimmer: 0.5, globalGlow: 0.3, backgroundFade: 0.98, beamPersistence: 0.02, haze: 0.1 },
    fixtureActions: [hazeAction(`${id}-base-action`, { enabled: true, brightness: 0.5, amount: 0.2, color: ICE })],
  })

  if (kind === 'verse') return sceneBase(id, 'Haze + CO2 Performance · Verse', sectionMatch, ['haze', 'co2Jet'], energyKey, {
    global: { dimmer: 0.62, globalGlow: 0.42, backgroundFade: 0.97, beamPersistence: 0.02, haze: 0.22 },
    fixtureActions: [hazeAction(`${id}-support-action`, { enabled: true, brightness: 0.62, amount: 0.32, color: '#a7ffe9' })],
    beatMutations: [scheduledCo2Burst(`${id}-phrase-center`, 'downbeatCo2ImpactBank', [0], 16, { brightness: 0.62, burstStrength: 0.58, durationMs: 360 })],
  })

  if (kind === 'build') return sceneBase(id, 'Haze + CO2 Performance · Build', sectionMatch, ['haze', 'co2Jet'], energyKey, {
    global: { dimmer: 0.76, globalGlow: 0.58, backgroundFade: 0.96, beamPersistence: 0.02, haze: 0.4 },
    fixtureActions: [hazeAction(`${id}-rise-action`, { enabled: true, brightness: 0.72, amount: 0.46, color: CYAN })],
    modulations: [{ source: 'buildProgress', target: 'global.haze', amount: 0.18, min: 0, max: 0.18, mode: 'add', requiredCapability: 'Track Energy Curve' }],
    beatMutations: [
      scheduledCo2Burst(`${id}-left`, 'leftCo2ImpactBank', [0], 8, { brightness: 0.72, burstStrength: 0.68, durationMs: 420 }),
      scheduledCo2Burst(`${id}-right`, 'rightCo2ImpactBank', [4], 8, { brightness: 0.72, burstStrength: 0.68, durationMs: 420 }),
    ],
  })

  if (kind === 'preDrop') return sceneBase(id, 'Haze + CO2 Performance · Pre-drop', sectionMatch, ['haze', 'co2Jet'], energyKey, {
    global: { dimmer: 0.48, globalGlow: 0.28, backgroundFade: 0.99, beamPersistence: 0, haze: 0.08 },
    fixtureActions: [hazeAction(`${id}-sharpen-action`, { enabled: true, brightness: 0.3, amount: 0.2, color: ICE })],
    sectionExitMutations: [boundedCo2Mutation(`${id}-transition-center`, 'downbeatCo2ImpactBank', { brightness: 0.72, burstStrength: 0.7, durationMs: 380, durationBeats: 0.75 })],
    blackoutWindows: [{ id: `${id}-final-cut`, kind: 'preDrop', anchor: 'sectionEnd', durationBeats: 0.5, justification: 'The final half-beat clears atmosphere and preserves the incoming drop silhouette.' }],
  })

  if (kind === 'drop1' || kind === 'drop2') {
    const dropTwo = kind === 'drop2'
    return sceneBase(id, `Haze + CO2 Performance · ${dropTwo ? 'Drop 2' : 'Drop 1'}`, sectionMatch, ['haze', 'co2Jet'], energyKey, {
      global: { dimmer: 1, globalGlow: dropTwo ? 0.9 : 0.82, backgroundFade: 0.95, beamPersistence: 0.01, haze: dropTwo ? 0.58 : 0.48 },
      transitionIn: { durationBars: 0.02, curve: 'easeOut' },
      fixtureActions: [hazeAction(`${id}-drop-haze-action`, { enabled: true, brightness: dropTwo ? 0.9 : 0.82, amount: dropTwo ? 0.62 : 0.54, color: dropTwo ? EMERALD : CYAN })],
      sectionEntryMutations: [boundedCo2Mutation(`${id}-entry-impact`, dropTwo ? 'drop2ExpandedImpactBank' : 'downbeatCo2ImpactBank', {
        brightness: 1,
        burstStrength: dropTwo ? 1 : 0.86,
        durationMs: dropTwo ? 650 : 560,
        durationBeats: dropTwo ? 0.75 : 0.6,
        color: WHITE,
      })],
      beatMutations: [
        scheduledCo2Burst(`${id}-left`, 'leftCo2ImpactBank', [0], 8, { brightness: dropTwo ? 0.94 : 0.84, burstStrength: dropTwo ? 0.92 : 0.78, durationMs: dropTwo ? 560 : 500 }),
        scheduledCo2Burst(`${id}-right`, 'rightCo2ImpactBank', [4], 8, { brightness: dropTwo ? 0.94 : 0.84, burstStrength: dropTwo ? 0.92 : 0.78, durationMs: dropTwo ? 560 : 500 }),
        ...(dropTwo ? [scheduledCo2Burst(`${id}-expanded-downbeat`, 'drop2ExpandedImpactBank', [0], 16, { brightness: 1, burstStrength: 1, durationMs: 620, color: WHITE })] : []),
      ],
      transientMutations: [{
        ...boundedCo2Mutation(`${id}-selected-transient`, 'downbeatCo2ImpactBank', { brightness: 0.88, burstStrength: dropTwo ? 0.9 : 0.76, durationMs: dropTwo ? 480 : 420 }),
        threshold: dropTwo ? 0.76 : 0.84,
        probability: dropTwo ? 0.6 : 0.4,
      }],
    })
  }

  if (kind === 'breakdown') return sceneBase(id, 'Haze + CO2 Performance · Breakdown', sectionMatch, ['haze', 'co2Jet'], energyKey, {
    global: { dimmer: 0.42, globalGlow: 0.26, backgroundFade: 0.99, beamPersistence: 0.02, haze: 0.14 },
    fixtureActions: [hazeAction(`${id}-recede-action`, { enabled: true, brightness: 0.44, amount: 0.28, color: ICE })],
    beatMutations: [scheduledCo2Burst(`${id}-rare-center`, 'downbeatCo2ImpactBank', [0], 16, { brightness: 0.54, burstStrength: 0.5, durationMs: 320 })],
  })

  return sceneBase(id, 'Haze + CO2 Performance · Outro', sectionMatch, ['haze', 'co2Jet'], energyKey, {
    global: { dimmer: 0.34, globalGlow: 0.2, backgroundFade: 1, beamPersistence: 0, haze: 0.1 },
    fixtureActions: [hazeAction(`${id}-release-bed-action`, { enabled: true, brightness: 0.34, amount: 0.22, color: ICE })],
    sectionExitMutations: [{ id: `${id}-clean-release`, durationBeats: 2, address: { bankRoles: ['outroReleaseBank', 'allCo2'] }, fixture: { enabled: false, brightness: 0, component: { hazeIntensity: 0, co2BurstDurationMs: 1 } }, global: { haze: 0, dimmer: 0, globalGlow: 0 } }],
  })
}

const HAZE_CO2_ENVELOPES = Object.freeze({
  intro: envelope([1, 2], [1, 2], [0.08, 0.3], [0.16, 0.4], [0.06, 0.16], [0.72, 0.94]),
  verse: envelope([1, 3], [1, 3], [0.12, 0.5], [0.24, 0.56], [0.12, 0.3], [0.58, 0.88]),
  build: envelope([1, 4], [1, 4], [0.2, 0.78], [0.34, 0.72], [0.2, 0.5], [0.42, 0.78]),
  preDrop: envelope([1, 3], [1, 3], [0.04, 0.58], [0.12, 0.42], [0.04, 0.2], [0.7, 0.96]),
  drop1: envelope([1, 5], [1, 5], [0.28, 1], [0.48, 0.92], [0.3, 0.64], [0.22, 0.7]),
  breakdown: envelope([1, 3], [1, 3], [0.08, 0.48], [0.16, 0.42], [0.08, 0.24], [0.64, 0.92]),
  drop2: envelope([1, 5], [1, 5], [0.34, 1], [0.54, 1], [0.36, 0.72], [0.16, 0.64]),
  outro: envelope([0, 2], [0, 2], [0, 0.34], [0, 0.3], [0, 0.16], [0.78, 1]),
})

export function createHazeCo2PerformanceProgram(): LaserDmxShowDirectorPerformanceProgram {
  return {
    schemaVersion: 3,
    id: 'haze-co2-drops-performance',
    name: 'Haze + CO2 Performance',
    description: 'A capped atmosphere-and-impact show with a full-song haze envelope, alternating virtual CO2-style banks, bounded section impacts, a stronger structural second drop, and a clean outro release.',
    deterministicSeed: 74042,
    bankRoles: addressesFromBanks(HAZE_CO2_PERFORMANCE_BANKS),
    fixtureBanks: structuredClone(HAZE_CO2_PERFORMANCE_BANKS),
    scenes: [
      hazeCo2Scene('intro'),
      hazeCo2Scene('verse'),
      hazeCo2Scene('build'),
      hazeCo2Scene('preDrop'),
      hazeCo2Scene('drop1'),
      hazeCo2Scene('breakdown'),
      hazeCo2Scene('drop2'),
      hazeCo2Scene('outro'),
    ],
    energyEnvelopes: HAZE_CO2_ENVELOPES,
    blackoutPolicy: { ...BLACKOUT_POLICY },
    fallbackOrder: ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro', 'unknown'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    diagnostics: {
      authoringVersion: 'rig-performance-04-impact-atmosphere',
      expectedFixtureSemanticKeys: [...ALL_HAZE, ...ALL_CO2],
      notes: [
        `Maximum authored haze amount: ${HAZE_CO2_PERFORMANCE_LIMITS.maximumHazeAmount}.`,
        `Maximum authored virtual CO2-style burst: ${HAZE_CO2_PERFORMANCE_LIMITS.maximumCo2BurstDurationMs} ms.`,
        'Atmosphere recedes in the pre-drop and breakdown instead of becoming permanent gray output.',
        'All plume behavior is virtual DRMVYZ visualization and remains subordinate to final blackout authority.',
      ],
    },
  }
}
