import type { ReactSectionType } from './ReactTypes'
import type {
  LaserDmxShowDirectorBuiltInPerformanceProgramId,
  LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
} from './LaserDmxShowDirectorPerformanceProgram'
import {
  LASER_DMX_CUE_STACK_SCHEMA_VERSION,
  LASER_DMX_EFFECT_MACRO_SCHEMA_VERSION,
  LASER_DMX_SHOW_PROGRAMMING_SCHEMA_VERSION,
  DEFAULT_LASER_SHOW_PROGRAMMING_CONSTRAINTS,
  type LaserCueAccent,
  type LaserEffectAutomation,
  type LaserEffectGroupAssignment,
  type LaserEffectMacro,
  type LaserFixtureGroupRelationship,
  type LaserPerformanceCue,
  type LaserShowProgrammingDocument,
} from './LaserDmxShowDirectorProgramming'
import {
  getLaserDmxProfessionalEffect,
  type LaserDmxProfessionalEffectId,
} from './LaserDmxShowDirectorProfessionalEffectLibrary'

interface FirstPartyShowProfile {
  palette: [string, string, string, string]
  drop1: LaserDmxProfessionalEffectId
  drop2: LaserDmxProfessionalEffectId
  intro?: LaserDmxProfessionalEffectId
  breakdown?: LaserDmxProfessionalEffectId
  ledMode?: 'centerOut' | 'outsideIn' | 'alternating' | 'sweep'
  movingHeadBias?: 'front' | 'cross' | 'converge' | 'wide'
}

const PROFILES: Readonly<Record<LaserDmxShowDirectorBuiltInPerformanceProgramId, FirstPartyShowProfile>> = {
  'prism-cathedral': { palette: ['#73e9ff', '#9e7cff', '#ffffff', '#2f73ff'], drop1: 'upper-canopy', drop2: 'corridor', intro: 'arc-scan', breakdown: 'circle-scan', movingHeadBias: 'converge' },
  'cardinal-fan-reactor': { palette: ['#ff334f', '#ff8b38', '#ffffff', '#8c1230'], drop1: 'wide-stepped-fan', drop2: 'opposed-fans', intro: 'held-tension-beam', breakdown: 'arc-scan', movingHeadBias: 'wide' },
  'cyan-mirror-cage': { palette: ['#23e7ff', '#1777ff', '#ffffff', '#5ef7d7'], drop1: 'mirrored-fans', drop2: 'crossing-fans', intro: 'parallel-sheet', breakdown: 'circle-scan', movingHeadBias: 'cross' },
  'small-club-rig-performance': { palette: ['#48e8ff', '#b24cff', '#ffffff', '#176dff'], drop1: 'narrow-stepped-fan', drop2: 'alternating-bank-fan', intro: 'held-tension-beam', breakdown: 'arc-scan', ledMode: 'alternating' },
  'festival-front-beams-performance': { palette: ['#ffffff', '#4edcff', '#6c63ff', '#3cffb5'], drop1: 'wide-stepped-fan', drop2: 'center-out-fan', intro: 'parallel-sheet', breakdown: 'upper-canopy', movingHeadBias: 'wide' },
  'dubstep-drop-lasers-performance': { palette: ['#ff315b', '#7c4dff', '#ffffff', '#19dbff'], drop1: 'crossing-fans', drop2: 'opposed-fans', intro: 'held-tension-beam', breakdown: 'progressive-wave', movingHeadBias: 'cross' },
  'led-bar-grid-performance': { palette: ['#25e8ff', '#7d55ff', '#ffffff', '#31ffb1'], drop1: 'grid-scan', drop2: 'corridor', intro: 'parallel-sheet', breakdown: 'circle-scan', ledMode: 'centerOut' },
  'moving-head-sweep-performance': { palette: ['#56d8ff', '#ff5bd6', '#ffffff', '#5967ff'], drop1: 'aerial-rake', drop2: 'upper-canopy', intro: 'held-tension-beam', breakdown: 'arc-scan', movingHeadBias: 'wide' },
  'strobe-blinder-hits-performance': { palette: ['#ffffff', '#ff355e', '#57dfff', '#7c56ff'], drop1: 'wide-stepped-fan', drop2: 'call-and-response-fan', intro: 'held-tension-beam', breakdown: 'parallel-sheet', movingHeadBias: 'front' },
  'haze-co2-drops-performance': { palette: ['#3edfff', '#4d76ff', '#ffffff', '#28ffba'], drop1: 'aerial-rake', drop2: 'tunnel', intro: 'held-tension-beam', breakdown: 'upper-canopy', movingHeadBias: 'converge' },
  'vocal-eclipse-exchange': { palette: ['#ff63d8', '#5b7cff', '#ffffff', '#51e8ff'], drop1: 'call-and-response-fan', drop2: 'mirrored-fans', intro: 'arc-scan', breakdown: 'circle-scan', ledMode: 'outsideIn' },
  'emerald-tunnel-relay': { palette: ['#2bffad', '#1ddbe7', '#ffffff', '#17825f'], drop1: 'tunnel', drop2: 'corridor', intro: 'held-tension-beam', breakdown: 'progressive-wave', movingHeadBias: 'converge' },
  'white-vector-interlock': { palette: ['#ffffff', '#9fe8ff', '#adb4ff', '#4ce5ff'], drop1: 'crossing-fans', drop2: 'diamond-outline', intro: 'parallel-sheet', breakdown: 'polygon-outline', movingHeadBias: 'cross' },
  'aurora-canopy-drift': { palette: ['#39ffd2', '#4da0ff', '#d7a4ff', '#ffffff'], drop1: 'upper-canopy', drop2: 'progressive-wave', intro: 'arc-scan', breakdown: 'circle-scan', movingHeadBias: 'wide' },
  'chromatic-chapter-stage': { palette: ['#ff4b91', '#3ee6ff', '#8b65ff', '#ffffff'], drop1: 'alternating-bank-fan', drop2: 'call-and-response-fan', intro: 'held-tension-beam', breakdown: 'polygon-outline', ledMode: 'sweep' },
  'prismatic-pulse-matrix': { palette: ['#5eeaff', '#ff55c8', '#ffffff', '#7d65ff'], drop1: 'grid-scan', drop2: 'tunnel', intro: 'parallel-sheet', breakdown: 'circle-scan', ledMode: 'centerOut' },
  'spectral-ribbon-singularity': { palette: ['#36e8ff', '#9a5cff', '#ff55bb', '#ffffff'], drop1: 'progressive-wave', drop2: 'crossing-fans', intro: 'arc-scan', breakdown: 'upper-canopy', movingHeadBias: 'cross' },
  'crimson-apex-protocol': { palette: ['#ff294f', '#ff6a35', '#ffffff', '#861328'], drop1: 'center-out-fan', drop2: 'opposed-fans', intro: 'held-tension-beam', breakdown: 'triangle-outline', movingHeadBias: 'converge' },
  'violet-hourglass-orbit': { palette: ['#a864ff', '#4b8cff', '#ffffff', '#f050d2'], drop1: 'mirrored-fans', drop2: 'tunnel', intro: 'circle-scan', breakdown: 'arc-scan', movingHeadBias: 'cross' },
  'scarlet-origami-lattice': { palette: ['#ff395c', '#ff8b5a', '#ffffff', '#b31f52'], drop1: 'polygon-outline', drop2: 'crossing-fans', intro: 'triangle-outline', breakdown: 'diamond-outline', ledMode: 'alternating' },
}

function sectionKey(scene: LaserDmxShowDirectorPerformanceScene): LaserDmxShowDirectorPerformanceEnergyEnvelopeKey {
  if (scene.energyEnvelopeKey) return scene.energyEnvelopeKey
  const type = scene.section.types[0]
  if (type === 'intro' || type === 'verse' || type === 'build' || type === 'preDrop' || type === 'breakdown' || type === 'outro') return type
  if (type === 'drop') {
    const occurrence = scene.section.dropOccurrence ?? scene.section.occurrence
    return occurrence?.occurrences?.includes(2) || (occurrence?.minOccurrence ?? 0) >= 2 ? 'drop2' : 'drop1'
  }
  if (type === 'bridge') return 'breakdown'
  return 'verse'
}

function stageEffects(profile: FirstPartyShowProfile, key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey): LaserDmxProfessionalEffectId[] {
  if (key === 'intro') return [profile.intro ?? 'held-tension-beam', 'narrow-stepped-fan', 'arc-scan', 'upper-canopy']
  if (key === 'verse') return ['narrow-stepped-fan', 'parallel-sheet', 'progressive-wave', 'mirrored-fans']
  if (key === 'build') return ['smooth-opening-fan', 'center-out-fan', 'crossing-fans', 'tunnel']
  if (key === 'preDrop') return ['held-tension-beam', 'smooth-closing-fan', 'outside-in-fan', 'held-tension-beam']
  if (key === 'drop1') return [profile.drop1, 'alternating-bank-fan', 'crossing-fans', 'line-diffraction-accent']
  if (key === 'breakdown') return [profile.breakdown ?? 'circle-scan', 'upper-canopy', 'progressive-wave', 'arc-scan']
  if (key === 'drop2') return [profile.drop2, 'opposed-fans', 'corridor', 'grid-diffraction-accent']
  return ['narrow-stepped-fan', 'held-tension-beam', 'arc-scan', 'held-tension-beam']
}

function movingHeadAutomation(profile: FirstPartyShowProfile, key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, stage: number): LaserEffectAutomation[] {
  const basePan = profile.movingHeadBias === 'cross' ? 34 : profile.movingHeadBias === 'wide' ? 58 : profile.movingHeadBias === 'converge' ? 0 : -28
  const intensity = key === 'drop1' || key === 'drop2' ? 0.72 : key === 'breakdown' ? 0.34 : key === 'build' ? 0.55 : 0.42
  return [
    { id: `mh-pan-${stage}`, parameter: 'movingHeadPan', from: basePan - stage * 8, to: basePan + stage * 8, startProgress: 0, endProgress: 1, curve: stage % 2 ? 'easeInOut' : 'hold' },
    { id: `mh-tilt-${stage}`, parameter: 'movingHeadTilt', from: key === 'breakdown' ? 18 : -10, to: key === 'build' ? 38 : key.startsWith('drop') ? 24 : 18, startProgress: 0, endProgress: 1, curve: 'easeInOut' },
    { id: `mh-zoom-${stage}`, parameter: 'movingHeadZoom', from: intensity, to: Math.min(0.9, intensity + stage * 0.04), startProgress: 0, endProgress: 1, curve: 'easeOut' },
    ...(key === 'breakdown' ? [{ id: `mh-gobo-${stage}`, parameter: 'goboRotation' as const, from: 0, to: 90, startProgress: 0, endProgress: 1, curve: 'linear' as const }] : []),
  ]
}

function supportAutomation(profile: FirstPartyShowProfile, key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, stage: number): LaserEffectAutomation[] {
  const wash = key === 'intro' ? 0.24 : key === 'verse' ? 0.38 : key === 'build' ? 0.48 + stage * 0.1 : key === 'breakdown' ? 0.32 : key === 'outro' ? 0.22 : 0.72
  const haze = key === 'intro' ? 0.18 : key === 'verse' ? 0.25 : key === 'build' ? 0.55 + stage * 0.05 : key === 'breakdown' ? 0.14 : key === 'outro' ? 0.08 : 0.72
  const ledDirection = profile.ledMode === 'outsideIn' ? [1, 0] : [0, 1]
  return [
    ...movingHeadAutomation(profile, key, stage),
    { id: `wash-${stage}`, parameter: 'washIntensity', from: wash, to: key === 'outro' ? 0 : Math.min(0.92, wash + (key === 'build' ? 0.16 : 0.04)), startProgress: 0, endProgress: 1, curve: key === 'build' ? 'easeIn' : key === 'outro' ? 'easeOut' : 'hold' },
    { id: `led-${stage}`, parameter: 'ledChasePosition', from: ledDirection[0], to: ledDirection[1], startProgress: 0, endProgress: 1, curve: profile.ledMode === 'sweep' ? 'easeInOut' : 'stepped', steps: profile.ledMode === 'alternating' ? 4 : 8 },
    { id: `haze-${stage}`, parameter: 'hazeAmount', from: haze, to: key === 'build' ? Math.min(0.82, haze + 0.12) : key === 'outro' ? 0.05 : haze, startProgress: 0, endProgress: 1, curve: key === 'build' ? 'easeIn' : key === 'outro' ? 'easeOut' : 'hold' },
  ]
}

function assignments(prefix: string, relationshipId: string): LaserEffectGroupAssignment[] {
  return [
    { id: `${prefix}:lasers`, address: { fixtureKinds: ['laser'] }, relationshipId, role: 'hero', intensityScale: 1 },
    { id: `${prefix}:moving-heads`, address: { fixtureKinds: ['movingHead'] }, role: 'support', intensityScale: 0.78 },
    { id: `${prefix}:washes`, address: { fixtureKinds: ['parWash'] }, role: 'support', intensityScale: 0.68 },
    { id: `${prefix}:leds`, address: { fixtureKinds: ['ledBar', 'ledTube'] }, role: 'support', intensityScale: 0.82 },
    { id: `${prefix}:strobes`, address: { fixtureKinds: ['strobe'] }, role: 'impact', intensityScale: 1 },
    { id: `${prefix}:blinders`, address: { fixtureKinds: ['blinder'] }, role: 'impact', intensityScale: 1 },
    { id: `${prefix}:haze`, address: { fixtureKinds: ['haze'] }, role: 'texture', intensityScale: 1 },
    { id: `${prefix}:co2`, address: { fixtureKinds: ['co2Jet'] }, role: 'impact', intensityScale: 1 },
  ]
}

function accents(prefix: string, key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey): LaserCueAccent[] {
  const result: LaserCueAccent[] = [
    { id: `${prefix}:snare-flash`, trigger: 'snare', fixtureGroupAssignmentIds: [`${prefix}:strobes`], durationBeats: 0.2, intensity: 1, priority: 20 },
  ]
  if (key === 'build') result.push({ id: `${prefix}:build-transition`, trigger: 'bar', fixtureGroupAssignmentIds: [`${prefix}:strobes`], durationBeats: 0.18, intensity: 0.55, priority: 12 })
  if (key === 'drop1' || key === 'drop2') {
    result.push({ id: `${prefix}:drop-blinder`, trigger: 'section', fixtureGroupAssignmentIds: [`${prefix}:blinders`], durationBeats: 0.28, intensity: 1, priority: 40 })
    result.push({ id: `${prefix}:drop-co2`, trigger: 'section', fixtureGroupAssignmentIds: [`${prefix}:co2`], durationBeats: 0.5, intensity: 1, priority: 45 })
    result.push({ id: `${prefix}:phrase-blinder`, trigger: 'phrase', fixtureGroupAssignmentIds: [`${prefix}:blinders`], durationBeats: 0.22, intensity: 0.72, priority: 25 })
  }
  return result
}

function createMacro(
  program: LaserDmxShowDirectorPerformanceProgram,
  profile: FirstPartyShowProfile,
  scene: LaserDmxShowDirectorPerformanceScene,
  key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  effectId: LaserDmxProfessionalEffectId,
  stage: number,
): { macro: LaserEffectMacro; relationship: LaserFixtureGroupRelationship; cue: LaserPerformanceCue } {
  const definition = getLaserDmxProfessionalEffect(effectId)
  const prefix = `${program.id}:${scene.id}:stage-${stage}`
  const relationshipId = `${prefix}:laser-relationship`
  const macroAssignments = assignments(prefix, relationshipId)
  const relationship: LaserFixtureGroupRelationship = {
    schemaVersion: 1,
    id: relationshipId,
    name: `${definition.name} synchronized laser banks`,
    mode: definition.relationshipMode ?? (stage % 2 ? 'mirrored' : 'parallel'),
    memberAssignmentIds: [`${prefix}:lasers`],
    phaseOffset: definition.relationshipMode === 'callResponse' ? 0.5 : definition.relationshipMode === 'phaseOffset' ? 0.125 : 0,
    sharedSpeed: true,
    sharedSpread: true,
    sharedIntensity: true,
    sharedColor: definition.relationshipMode !== 'colorAlternation',
  }
  const macro: LaserEffectMacro = {
    schemaVersion: LASER_DMX_EFFECT_MACRO_SCHEMA_VERSION,
    id: `${prefix}:macro`,
    name: `${scene.label} · ${definition.name}`,
    family: definition.family,
    duration: { kind: 'fourBars' },
    pattern: { ...definition.pattern, topologyId: `${program.id}:${effectId}:topology` },
    transform: { ...definition.transform },
    scan: { ...definition.scan },
    color: { mode: 'scene', colors: [...profile.palette], blend: stage / 3, alternateByGroup: stage >= 2 },
    optics: { ...definition.optics },
    envelope: { attack: 0.04, hold: 0.9, release: 0.06, intensityFloor: definition.intensityFloor, intensityCeiling: definition.intensityCeiling },
    automation: [...definition.automation, ...supportAutomation(profile, key, stage)],
    fixtureGroupAssignments: macroAssignments,
    transitionIn: stage === 0 ? { ...definition.transitionIn } : { type: stage === 2 ? 'bankHandoff' : 'crossfade', durationBeats: 0.5, blankDisconnectedTravel: true, shutterDuringSwap: stage === 2 },
    transitionOut: { ...definition.transitionOut },
    compatibility: { provisional: false, sourceSceneId: scene.id, warnings: [] },
  }
  const cue: LaserPerformanceCue = {
    schemaVersion: LASER_DMX_CUE_STACK_SCHEMA_VERSION,
    id: `${prefix}:cue`,
    name: `${scene.label} · four-bar stage ${stage + 1}`,
    macroId: macro.id,
    sceneIds: [scene.id],
    sectionTypes: [...scene.section.types] as ReactSectionType[],
    startQuantize: 'section',
    startOffsetBeats: stage * 16,
    repeatEveryBeats: 64,
    duration: { kind: 'fourBars' },
    fixtureGroupAssignmentIds: macroAssignments.map(item => item.id),
    automation: [],
    transitionIn: { ...macro.transitionIn },
    transitionOut: { ...macro.transitionOut },
    accents: accents(prefix, key),
    occurrenceVariationSeedOffset: stage * 101,
    priority: (scene.priority ?? 0) + 10 + stage,
  }
  return { macro, relationship, cue }
}

function createPreDropBlackout(
  program: LaserDmxShowDirectorPerformanceProgram,
  scene: LaserDmxShowDirectorPerformanceScene,
  baseMacro: LaserEffectMacro,
): LaserPerformanceCue {
  return {
    schemaVersion: LASER_DMX_CUE_STACK_SCHEMA_VERSION,
    id: `${program.id}:${scene.id}:intentional-blackout`,
    name: `${scene.label} · intentional pre-drop shutter`,
    macroId: baseMacro.id,
    sceneIds: [scene.id],
    sectionTypes: [...scene.section.types] as ReactSectionType[],
    startQuantize: 'section',
    startOffsetBeats: 15,
    repeatEveryBeats: 16,
    duration: { kind: 'beat' },
    fixtureGroupAssignmentIds: baseMacro.fixtureGroupAssignments.map(item => item.id),
    automation: [],
    transitionIn: { type: 'briefBlackout', durationBeats: 0.2, blankDisconnectedTravel: true, shutterDuringSwap: true },
    transitionOut: { type: 'shutterOutIn', durationBeats: 0.2, blankDisconnectedTravel: true, shutterDuringSwap: true },
    accents: [],
    priority: (scene.priority ?? 0) + 1_000,
    blackout: true,
    shutterClosed: true,
  }
}


function stripFirstPartyTopologyPayload<T extends object>(value: T): T {
  const next = { ...value } as Record<string, unknown>
  const fixture = next.fixture && typeof next.fixture === 'object' && !Array.isArray(next.fixture)
    ? { ...(next.fixture as Record<string, unknown>) }
    : null
  if (fixture) {
    for (const key of ['scanner', 'targetPoints', 'targetPointsByFixtureSemanticKey', 'targetPosition', 'targetMode', 'beamAngle', 'fanSpread', 'rotation']) delete fixture[key]
    next.fixture = fixture
  }
  if (Array.isArray(next.fixtureActions)) {
    next.fixtureActions = next.fixtureActions.filter(action => {
      if (!action || typeof action !== 'object') return false
      const kind = (action as { kind?: unknown }).kind
      return kind !== 'scanner' && kind !== 'beam'
    })
  }
  if (Array.isArray(next.modulations)) {
    next.modulations = next.modulations.filter(reference => {
      const target = reference && typeof reference === 'object' ? String((reference as { target?: unknown }).target ?? '') : ''
      return !/(target|rayCount|copyCount|pattern|path|geometry|rotation|fanSpread)/i.test(target)
    })
  }
  return next as T
}

function cleanFirstPartyScene(scene: LaserDmxShowDirectorPerformanceScene): LaserDmxShowDirectorPerformanceScene {
  const cleanList = <T extends object>(items: T[] | undefined): T[] | undefined => items?.map(stripFirstPartyTopologyPayload)
  return stripFirstPartyTopologyPayload({
    ...scene,
    variations: cleanList(scene.variations as Array<Record<string, unknown>> | undefined),
    beatMutations: cleanList(scene.beatMutations as Array<Record<string, unknown>> | undefined),
    kickMutations: cleanList(scene.kickMutations as Array<Record<string, unknown>> | undefined),
    snareMutations: cleanList(scene.snareMutations as Array<Record<string, unknown>> | undefined),
    hatMutations: cleanList(scene.hatMutations as Array<Record<string, unknown>> | undefined),
    transientMutations: cleanList(scene.transientMutations as Array<Record<string, unknown>> | undefined),
    barMutations: cleanList(scene.barMutations as Array<Record<string, unknown>> | undefined),
    barProgression: cleanList(scene.barProgression as Array<Record<string, unknown>> | undefined),
    fourBarVariations: cleanList(scene.fourBarVariations as Array<Record<string, unknown>> | undefined),
    eightBarRecruitment: cleanList(scene.eightBarRecruitment as Array<Record<string, unknown>> | undefined),
    sixteenBarEvolution: cleanList(scene.sixteenBarEvolution as Array<Record<string, unknown>> | undefined),
    sectionEntryMutations: cleanList(scene.sectionEntryMutations as Array<Record<string, unknown>> | undefined),
    sectionBodyMutations: cleanList(scene.sectionBodyMutations as Array<Record<string, unknown>> | undefined),
    sectionExitMutations: cleanList(scene.sectionExitMutations as Array<Record<string, unknown>> | undefined),
  } as unknown as LaserDmxShowDirectorPerformanceScene)
}

export function authorLaserDmxBuiltInPerformanceProgram(
  id: LaserDmxShowDirectorBuiltInPerformanceProgramId,
  source: LaserDmxShowDirectorPerformanceProgram,
): LaserDmxShowDirectorPerformanceProgram {
  const profile = PROFILES[id]
  const macros: LaserEffectMacro[] = []
  const cues: LaserPerformanceCue[] = []
  const relationships: LaserFixtureGroupRelationship[] = []
  const scenes = source.scenes.map(cleanFirstPartyScene)
  const scenesByKey = new Map<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, LaserDmxShowDirectorPerformanceScene[]>()
  for (const scene of scenes) {
    const key = sectionKey(scene)
    const list = scenesByKey.get(key) ?? []
    list.push(scene)
    scenesByKey.set(key, list)
  }
  for (const [key, sectionScenes] of scenesByKey) {
    const representative = sectionScenes[0]
    const effects = stageEffects(profile, key)
    const authored = effects.map((effectId, stage) => createMacro(source, profile, representative, key, effectId, stage))
    macros.push(...authored.map(item => item.macro))
    relationships.push(...authored.map(item => item.relationship))
    for (const scene of sectionScenes) {
      for (const [stage, item] of authored.entries()) {
        const scenePrefix = `${source.id}:${scene.id}:stage-${stage}`
        cues.push({
          ...item.cue,
          id: `${scenePrefix}:cue`,
          name: `${scene.label} · four-bar stage ${stage + 1}`,
          sceneIds: [scene.id],
          sectionTypes: [...scene.section.types] as ReactSectionType[],
          accents: accents(scenePrefix, key).map(accent => ({
            ...accent,
            fixtureGroupAssignmentIds: accent.fixtureGroupAssignmentIds?.map(assignmentId => assignmentId.replace(scenePrefix, `${source.id}:${representative.id}:stage-${stage}`)),
          })),
          priority: (scene.priority ?? 0) + 10 + stage,
        })
      }
      if (key === 'preDrop') cues.push(createPreDropBlackout(source, scene, authored[0].macro))
    }
  }
  const document: LaserShowProgrammingDocument = {
    schemaVersion: LASER_DMX_SHOW_PROGRAMMING_SCHEMA_VERSION,
    id: `${source.id}:professional-programming`,
    macros,
    cueStacks: [{
      schemaVersion: LASER_DMX_CUE_STACK_SCHEMA_VERSION,
      id: `${source.id}:professional-cue-stack`,
      name: `${source.name} Professional Cue Stack`,
      cues,
    }],
    activeCueStackId: `${source.id}:professional-cue-stack`,
    groupRelationships: relationships,
    constraints: { ...DEFAULT_LASER_SHOW_PROGRAMMING_CONSTRAINTS },
    compatibility: {
      source: 'native',
      adapterVersion: 2,
      ambiguousRelationshipIds: [],
      warnings: [],
    },
  }
  return {
    ...source,
    scenes,
    laserProgramming: document,
    diagnostics: {
      ...source.diagnostics,
      authoringVersion: 'professional-cue-authoring-v1',
      notes: [
        ...(source.diagnostics?.notes ?? []),
        'First-party show uses native stable effect macros and quantized four-bar cue stages.',
        'Audio Intelligence modulates bounded scalar parameters only; topology remains stable for each cue.',
        'Strobes, blinders, and CO₂ are assignment-targeted authored accents rather than continuous fixtures.',
      ],
    },
  }
}

export function getLaserDmxFirstPartyShowProfile(id: LaserDmxShowDirectorBuiltInPerformanceProgramId): FirstPartyShowProfile {
  return structuredClone(PROFILES[id])
}
