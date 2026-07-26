import type { ReactSectionType } from './ReactTypes'
import type {
  LaserDmxShowDirectorBuiltInPerformanceProgramId,
  LaserDmxShowDirectorPerformanceAddress,
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
  type LaserCueLifecycle,
  type LaserCueOwnedParameter,
  type LaserEffectAutomation,
  type LaserEffectGroupAssignment,
  type LaserEffectMacro,
  type LaserFixtureGroupRelationship,
  type LaserFiniteMacroCommand,
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
  'violet-hourglass-orbit': { palette: ['#a864ff', '#4b8cff', '#ffffff', '#f050d2'], drop1: 'mirrored-fans', drop2: 'circle-scan', intro: 'circle-scan', breakdown: 'arc-scan', movingHeadBias: 'cross' },
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
  if (key === 'intro') return [profile.intro ?? 'held-tension-beam', 'narrow-stepped-fan', 'parallel-sheet', 'arc-scan']
  if (key === 'verse') return ['narrow-stepped-fan', 'parallel-sheet', 'mirrored-fans', 'arc-scan']
  if (key === 'build') return ['smooth-opening-fan', 'center-out-fan', 'upper-canopy', 'crossing-fans']
  if (key === 'preDrop') return ['held-tension-beam', 'smooth-closing-fan', 'outside-in-fan', 'held-tension-beam']
  if (key === 'drop1') return [profile.drop1, 'alternating-bank-fan', 'crossing-fans', 'line-diffraction-accent']
  if (key === 'breakdown') return [profile.breakdown ?? 'arc-scan', 'parallel-sheet', 'progressive-wave', 'held-tension-beam']
  if (key === 'drop2') return [profile.drop2, 'opposed-fans', 'corridor', 'grid-diffraction-accent']
  return ['arc-scan', 'held-tension-beam', 'narrow-stepped-fan', 'held-tension-beam']
}

function movingHeadAutomation(profile: FirstPartyShowProfile, key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, stage: number): LaserEffectAutomation[] {
  const basePan = profile.movingHeadBias === 'cross' ? 34 : profile.movingHeadBias === 'wide' ? 58 : profile.movingHeadBias === 'converge' ? 0 : -28
  const intensity = key === 'drop1' || key === 'drop2' ? 0.68 : key === 'breakdown' ? 0.3 : key === 'build' ? 0.5 : 0.38
  const moving = key === 'build' || key === 'drop1' || key === 'drop2' || key === 'breakdown'
  return [
    { id: `mh-pan-${stage}`, parameter: 'movingHeadPan', from: basePan - stage * 7, to: moving ? basePan + stage * 7 : basePan - stage * 7, startProgress: 0, endProgress: 1, curve: moving ? 'easeInOut' : 'hold' },
    { id: `mh-tilt-${stage}`, parameter: 'movingHeadTilt', from: key === 'breakdown' ? 18 : -8, to: key === 'build' ? 34 : key.startsWith('drop') ? 22 : key === 'outro' ? 4 : 16, startProgress: 0, endProgress: 1, curve: moving ? 'easeInOut' : 'hold' },
    { id: `mh-zoom-${stage}`, parameter: 'movingHeadZoom', from: intensity, to: Math.min(0.82, intensity + stage * 0.035), startProgress: 0, endProgress: 1, curve: key === 'build' ? 'easeOut' : 'hold' },
    ...(key === 'breakdown' && stage === 2 ? [{ id: `mh-gobo-${stage}`, parameter: 'goboRotation' as const, from: 0, to: 60, startProgress: 0, endProgress: 1, curve: 'easeInOut' as const }] : []),
  ]
}

function supportAutomation(profile: FirstPartyShowProfile, key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, stage: number): LaserEffectAutomation[] {
  const wash = key === 'intro' ? 0.2 : key === 'verse' ? 0.3 : key === 'build' ? 0.4 + stage * 0.08 : key === 'breakdown' ? 0.25 : key === 'outro' ? 0.18 : 0.58
  const haze = key === 'intro' ? 0.14 : key === 'verse' ? 0.2 : key === 'build' ? 0.38 + stage * 0.06 : key === 'breakdown' ? 0.12 : key === 'outro' ? 0.05 : 0.52
  const ledDirection = profile.ledMode === 'outsideIn' ? [1, 0] : [0, 1]
  return [
    ...movingHeadAutomation(profile, key, stage),
    { id: `wash-${stage}`, parameter: 'washIntensity', from: wash, to: key === 'outro' ? 0 : Math.min(0.76, wash + (key === 'build' ? 0.12 : 0.03)), startProgress: 0, endProgress: 1, curve: key === 'build' ? 'easeIn' : key === 'outro' ? 'easeOut' : 'hold' },
    { id: `led-${stage}`, parameter: 'ledChasePosition', from: ledDirection[0], to: ledDirection[1], startProgress: 0, endProgress: 1, curve: profile.ledMode === 'sweep' ? 'easeInOut' : 'stepped', steps: profile.ledMode === 'alternating' ? 4 : 8 },
    { id: `haze-${stage}`, parameter: 'hazeAmount', from: haze, to: key === 'build' ? Math.min(0.66, haze + 0.08) : key === 'outro' ? 0 : haze, startProgress: 0, endProgress: 1, curve: key === 'build' ? 'easeIn' : key === 'outro' ? 'easeOut' : 'hold' },
  ]
}

type LaserAssignmentGroup = 'all' | 'left' | 'right' | 'center' | 'outer' | 'inner' | 'odd' | 'even'

interface FirstPartyAssignmentCatalog {
  assignments: LaserEffectGroupAssignment[]
  laser: Partial<Record<LaserAssignmentGroup, string>>
  movingHeads: string
  washes: string
  leds: string
  strobes: string
  blinders: string
  haze: string
  co2: string
}

function roleEntries(program: LaserDmxShowDirectorPerformanceProgram): Array<{ roleText: string; text: string; address: LaserDmxShowDirectorPerformanceAddress }> {
  const fromMetadata = Object.entries(program.fixtureBanks ?? {}).map(([key, bank]) => {
    const roleText = `${key} ${bank.role} ${bank.label ?? ''} ${bank.description ?? ''}`.toLowerCase()
    return {
      roleText,
      text: `${roleText} ${(bank.address.fixtureSemanticKeys ?? []).join(' ')} ${(bank.address.groupSemanticKeys ?? []).join(' ')}`.toLowerCase(),
      address: bank.address,
    }
  })
  const fromRoles = Object.entries(program.bankRoles ?? {}).map(([key, address]) => {
    const roleText = key.toLowerCase()
    return {
      roleText,
      text: `${roleText} ${(address.fixtureSemanticKeys ?? []).join(' ')} ${(address.groupSemanticKeys ?? []).join(' ')}`.toLowerCase(),
      address,
    }
  })
  return [...fromMetadata, ...fromRoles]
}

function addressText(address: LaserDmxShowDirectorPerformanceAddress): string {
  return [
    ...(address.fixtureSemanticKeys ?? []),
    ...(address.groupSemanticKeys ?? []),
    ...(address.fixtureIds ?? []),
    ...(address.mirroredGroupKeys ?? []),
  ].join(' ').toLowerCase()
}

function programUsesLaserFixtures(program: LaserDmxShowDirectorPerformanceProgram): boolean {
  const addresses = [
    ...program.scenes.map(scene => scene.address),
    ...Object.values(program.fixtureBanks ?? {}).map(bank => bank.address),
    ...Object.values(program.bankRoles ?? {}),
  ].filter((address): address is LaserDmxShowDirectorPerformanceAddress => Boolean(address))
  if (addresses.some(address => address.fixtureKinds?.includes('laser'))) return true
  const authoredText = [
    program.id,
    program.name,
    ...(program.diagnostics?.expectedFixtureSemanticKeys ?? []),
    ...addresses.map(addressText),
  ].join(' ').toLowerCase()
  return /(?:laser|scanner|(?:^|[\s_-])beam(?:$|[\s_-])|aperture)/.test(authoredText)
}

function addressLooksLaser(
  text: string,
  address: LaserDmxShowDirectorPerformanceAddress,
  laserRig: boolean,
): boolean {
  if (address.fixtureKinds?.length) return address.fixtureKinds.includes('laser')
  const evidence = `${text} ${addressText(address)}`
  const laserEvidence = /(?:laser|scanner|(?:^|[\s_-])beam(?:$|[\s_-])|aperture|fan)/.test(evidence)
  const nonLaserEvidence = /(?:moving.?head|strobe|blinder|co2|haze|wash|par|led|tube|video)/.test(evidence)
  if (nonLaserEvidence) return false
  return laserEvidence || laserRig
}

function knownLaserSemanticKeys(program: LaserDmxShowDirectorPerformanceProgram): Set<string> {
  const keys = new Set<string>()
  const entries = roleEntries(program)
  const fixtureKinds = [
    ...entries.flatMap(entry => entry.address.fixtureKinds ?? []),
    ...program.scenes.flatMap(scene => scene.address?.fixtureKinds ?? []),
  ]
  const laserOnlyBeamRig = fixtureKinds.includes('laser') && !fixtureKinds.some(kind => kind === 'movingHead')
  const expectedKeys = program.diagnostics?.expectedFixtureSemanticKeys ?? []
  const nonLaserKey = /moving.?head|(?:^|[\s_-])head(?:$|[\s_-])|strobe|blinder|co2|haze|wash|par|led|tube|video/i
  for (const key of expectedKeys) {
    if (laserOnlyBeamRig || /laser|scanner|(?:^|[\s_-])beam(?:$|[\s_-])|aperture/i.test(key)) keys.add(key)
  }
  for (const entry of entries) {
    const explicitLaserBank = /(?:^|[\s_-])(?:laser|scanner)s?(?:$|[\s_-])/i.test(entry.roleText)
      || entry.address.fixtureKinds?.includes('laser') === true
    for (const key of entry.address.fixtureSemanticKeys ?? []) {
      if (explicitLaserBank || /laser|scanner|(?:^|[\s_-])beam(?:$|[\s_-])|aperture/i.test(key)) keys.add(key)
    }
  }
  if (programUsesLaserFixtures(program)) {
    for (const key of expectedKeys) {
      if (!nonLaserKey.test(key)) keys.add(key)
    }
  }
  return keys
}

function authoredLaserAddress(program: LaserDmxShowDirectorPerformanceProgram, group: Exclude<LaserAssignmentGroup, 'all'>): LaserDmxShowDirectorPerformanceAddress | null {
  const patterns: Record<Exclude<LaserAssignmentGroup, 'all'>, RegExp> = {
    left: /(left|bank.?a|west|(?:^|[-_])l(?:$|[-_]))/,
    right: /(right|bank.?b|east|(?:^|[-_])r(?:$|[-_]))/,
    center: /(center|centre|middle|core|inner.?primary)/,
    outer: /(outer|edge|wing|rear|perimeter|side)/,
    inner: /(inner|center|centre|primary|core)/,
    odd: /(odd|bank.?a|alternate.?a)/,
    even: /(even|bank.?b|alternate.?b)/,
  }
  const pattern = patterns[group]
  const laserRig = programUsesLaserFixtures(program)
  const laserKeys = knownLaserSemanticKeys(program)
  const candidates = roleEntries(program)
    .filter(entry => pattern.test(entry.roleText) || [...(entry.address.fixtureSemanticKeys ?? []), ...(entry.address.groupSemanticKeys ?? [])].some(key => pattern.test(key)))
    .map(entry => {
      const address = entry.address
      const roleMatches = pattern.test(entry.roleText)
      const fixtureSemanticKeys = address.fixtureSemanticKeys?.filter(key => laserKeys.has(key) && (roleMatches || pattern.test(key))) ?? []
      const groupSemanticKeys = address.groupSemanticKeys?.filter(key => roleMatches || pattern.test(key)) ?? []
      const mirroredGroupKeys = address.mirroredGroupKeys?.filter(key => roleMatches || pattern.test(key)) ?? []
      const bankRoles = address.bankRoles?.filter(key => roleMatches || pattern.test(key)) ?? []
      const hasSemanticSelector = fixtureSemanticKeys.length > 0 || groupSemanticKeys.length > 0 || mirroredGroupKeys.length > 0 || bankRoles.length > 0
      const narrowed: LaserDmxShowDirectorPerformanceAddress = {
        ...(fixtureSemanticKeys.length ? { fixtureSemanticKeys } : {}),
        ...(groupSemanticKeys.length ? { groupSemanticKeys } : {}),
        ...(mirroredGroupKeys.length ? { mirroredGroupKeys } : {}),
        ...(bankRoles.length ? { bankRoles } : {}),
        ...(!hasSemanticSelector && address.fixtureIds?.length ? { fixtureIds: [...address.fixtureIds] } : {}),
        ...(!hasSemanticSelector && address.fixtureKinds?.includes('laser') && addressLooksLaser(entry.text, address, laserRig) ? { fixtureKinds: ['laser'] } : {}),
        match: 'any',
      }
      const selectorCount = fixtureSemanticKeys.length
        + groupSemanticKeys.length
        + mirroredGroupKeys.length
        + bankRoles.length
        + (narrowed.fixtureIds?.length ?? 0)
      return { address: narrowed, score: selectorCount || (narrowed.fixtureKinds?.length ? 100 : Number.POSITIVE_INFINITY) }
    })
    .filter(candidate => Number.isFinite(candidate.score))
    .sort((left, right) => left.score - right.score || addressText(left.address).localeCompare(addressText(right.address)))
  return candidates[0]?.address ?? null
}

function assignments(program: LaserDmxShowDirectorPerformanceProgram, prefix: string, relationshipId: string): FirstPartyAssignmentCatalog {
  const result: LaserEffectGroupAssignment[] = []
  const laser: Partial<Record<LaserAssignmentGroup, string>> = {}
  const addLaser = (group: LaserAssignmentGroup, address: LaserDmxShowDirectorPerformanceAddress, intensityScale: number) => {
    const id = `${prefix}:laser-${group}`
    result.push({ id, address, relationshipId, role: group === 'all' ? 'hero' : 'primary', intensityScale })
    laser[group] = id
  }
  addLaser('all', { fixtureKinds: ['laser'] }, 1)
  for (const group of ['left', 'right', 'center', 'outer', 'inner', 'odd', 'even'] as const) {
    const address = authoredLaserAddress(program, group)
    if (address) addLaser(group, address, group === 'center' || group === 'inner' ? 0.9 : 0.95)
  }
  const support = (suffix: string, fixtureKinds: LaserDmxShowDirectorPerformanceAddress['fixtureKinds'], role: LaserEffectGroupAssignment['role'], intensityScale: number): string => {
    const id = `${prefix}:${suffix}`
    result.push({ id, address: { fixtureKinds }, role, intensityScale })
    return id
  }
  return {
    assignments: result,
    laser,
    movingHeads: support('moving-heads', ['movingHead'], 'support', 0.68),
    washes: support('washes', ['parWash'], 'support', 0.58),
    leds: support('leds', ['ledBar', 'ledTube'], 'support', 0.72),
    strobes: support('strobes', ['strobe'], 'impact', 1),
    blinders: support('blinders', ['blinder'], 'impact', 1),
    haze: support('haze', ['haze'], 'texture', 0.7),
    co2: support('co2', ['co2Jet'], 'impact', 1),
  }
}

function accents(catalog: FirstPartyAssignmentCatalog, prefix: string, key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey): LaserCueAccent[] {
  const result: LaserCueAccent[] = [
    { id: `${prefix}:snare-flash`, trigger: 'snare', fixtureGroupAssignmentIds: [catalog.strobes], durationBeats: 0.16, intensity: 0.92, priority: 20 },
  ]
  if (key === 'build') result.push({ id: `${prefix}:build-transition`, trigger: 'bar', fixtureGroupAssignmentIds: [catalog.strobes], durationBeats: 0.14, intensity: 0.48, priority: 12 })
  if (key === 'drop1' || key === 'drop2') {
    result.push({ id: `${prefix}:drop-blinder`, trigger: 'section', fixtureGroupAssignmentIds: [catalog.blinders], durationBeats: 0.22, intensity: 1, priority: 40 })
    result.push({ id: `${prefix}:drop-co2`, trigger: 'section', fixtureGroupAssignmentIds: [catalog.co2], durationBeats: 0.42, intensity: key === 'drop2' ? 1 : 0.84, priority: 45 })
    result.push({ id: `${prefix}:phrase-blinder`, trigger: 'phrase', fixtureGroupAssignmentIds: [catalog.blinders], durationBeats: 0.18, intensity: 0.68, priority: 25 })
  }
  return result
}

function cueIntensity(key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, stage: number): number {
  const base: Record<LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, number> = {
    intro: 0.34,
    verse: 0.46,
    build: 0.5,
    preDrop: 0.42,
    drop1: 0.74,
    breakdown: 0.34,
    drop2: 0.8,
    outro: 0.28,
  }
  const stageLift = key === 'build' ? stage * 0.07 : key === 'drop2' ? stage * 0.035 : key === 'drop1' ? stage * 0.025 : 0
  return Math.min(key === 'drop2' ? 0.94 : 0.88, base[key] + stageLift)
}

function cueTiming(key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, stage: number, bar: number, animated: boolean): LaserCueLifecycle {
  const attackBeats = key.startsWith('drop') ? 0.06 : 0.12
  const movementBase = animated ? (key === 'build' ? 1.3 : key.startsWith('drop') ? 1.1 : key === 'breakdown' ? 1.1 : 0.7) : 0.15
  const movementBeats = Math.max(0.1, movementBase + (key === 'build' ? stage * 0.16 : 0))
  let activeBeats = key === 'intro' ? 1.65 : key === 'verse' ? 2.2 : key === 'build' ? 2.35 + stage * 0.28 : key === 'preDrop' ? Math.max(0.7, 2.2 - stage * 0.45) : key === 'drop1' ? 2.45 : key === 'breakdown' ? 1.65 : key === 'drop2' ? 2.6 : Math.max(0.65, 1.8 - stage * 0.3)
  if ((key === 'intro' || key === 'breakdown') && bar % 2 === 1) activeBeats -= 0.35
  if (key.startsWith('drop') && stage === 3 && bar === 0) activeBeats = 0.9
  const releaseBeats = key.startsWith('drop') ? 0.08 : 0.16
  const holdBeats = Math.max(0, activeBeats - attackBeats - movementBeats - releaseBeats)
  const blackoutBeats = Math.max(0.25, 4 - attackBeats - movementBeats - holdBeats - releaseBeats)
  return {
    delayBeats: 0,
    attackBeats,
    movementBeats,
    holdBeats,
    releaseBeats,
    blackoutBeats,
    blackoutAfterCompletion: true,
    maximumRunBeats: Math.min(3.5, attackBeats + movementBeats + holdBeats + releaseBeats),
    completionBehavior: 'blackout',
    returnBehavior: key === 'outro' ? 'start' : 'none',
  }
}

function commandKind(definition: ReturnType<typeof getLaserDmxProfessionalEffect>, key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, stage: number): LaserFiniteMacroCommand['kind'] {
  if (definition.id === 'smooth-opening-fan' || definition.id === 'center-out-fan') return 'fanOpen'
  if (definition.id === 'smooth-closing-fan' || definition.id === 'outside-in-fan') return 'fanClose'
  if (definition.family === 'sequentialCircle') return key.startsWith('drop') && stage === 0 ? 'circleRotation' : 'circleReveal'
  if (definition.family === 'tunnel' || definition.family === 'corridor') return 'tunnelReveal'
  if (definition.family === 'movingHeadSweep') return definition.automation.some(lane => lane.parameter === 'movingHeadTilt') ? 'tiltSweep' : 'panSweep'
  if (definition.family === 'progressiveWave' || definition.family === 'ledChase') return 'authoredAutomation'
  if (definition.family === 'polygonOutline' && key.startsWith('drop')) return 'patternScaleExpand'
  return 'staticHold'
}

function finiteCommand(definition: ReturnType<typeof getLaserDmxProfessionalEffect>, key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, stage: number, lifecycle: LaserCueLifecycle): LaserFiniteMacroCommand {
  const kind = commandKind(definition, key, stage)
  const durationBeats = Math.max(0.1, lifecycle.movementBeats)
  const rotation = kind === 'circleRotation' ? {
    target: 'patternRotation' as const,
    startAngleDeg: definition.transform.rotationDeg,
    turnCount: 1,
    durationBeats,
    direction: stage % 2 ? 'counterClockwise' as const : 'clockwise' as const,
    easing: 'easeInOut' as const,
    holdAfterCompletion: true,
  } : undefined
  return {
    kind,
    durationBeats,
    easing: kind === 'staticHold' ? 'hold' : 'easeInOut',
    ...(kind === 'fixtureRecruitment' ? { startState: { output: false }, destinationState: { output: true } } : {}),
    ...(rotation ? { rotation } : {}),
    loopMode: 'none',
    shutdown: 'blackout',
  }
}

function cueOwnership(definition: ReturnType<typeof getLaserDmxProfessionalEffect>, command: LaserFiniteMacroCommand): { parameters: LaserCueOwnedParameter[]; interruptible: boolean; releaseOnCompletion: boolean; blackoutOverride: boolean } {
  const parameters = new Set<LaserCueOwnedParameter>(['output', 'intensity', 'pattern'])
  if (command.kind === 'fanOpen' || command.kind === 'fanClose' || command.kind === 'patternScaleExpand' || command.kind === 'patternScaleContract' || command.kind === 'circleReveal' || command.kind === 'tunnelReveal') parameters.add('patternScale')
  if (command.rotation) parameters.add(command.rotation.target === 'fixturePan' ? 'pan' : command.rotation.target === 'fixtureTilt' ? 'tilt' : 'patternPhase')
  if (definition.automation.some(lane => lane.parameter === 'movingHeadPan')) parameters.add('pan')
  if (definition.automation.some(lane => lane.parameter === 'movingHeadTilt')) parameters.add('tilt')
  if (definition.automation.some(lane => lane.parameter === 'phase')) parameters.add('patternPhase')
  if (definition.automation.some(lane => lane.parameter === 'scanSpeed')) parameters.add('scanSpeed')
  return { parameters: [...parameters], interruptible: true, releaseOnCompletion: true, blackoutOverride: false }
}

function pickLaserIds(catalog: FirstPartyAssignmentCatalog, groups: LaserAssignmentGroup[]): string[] {
  const fallbackOrder = ['left', 'right', 'center', 'outer', 'inner', 'odd', 'even'] as const
  const available = fallbackOrder.flatMap(group => catalog.laser[group] ? [catalog.laser[group]!] : [])
  const fallbackIndex: Record<Exclude<LaserAssignmentGroup, 'all'>, number> = {
    left: 0, right: 1, center: 2, outer: 3, inner: 4, odd: 5, even: 6,
  }
  const selected = groups.flatMap(group => {
    if (group === 'all') return [catalog.laser.all!]
    if (catalog.laser[group]) return [catalog.laser[group]!]
    return available.length ? [available[fallbackIndex[group] % available.length]] : [catalog.laser.all!]
  })
  return Array.from(new Set(selected))
}

function laserGroupsForCue(key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, stage: number, bar: number): LaserAssignmentGroup[] {
  const alternating: LaserAssignmentGroup[][] = [['left'], ['right'], ['inner'], ['outer']]
  if (key === 'intro') return bar % 2 === 0 ? (stage < 2 ? ['center'] : ['left']) : (stage < 2 ? ['inner'] : ['right'])
  if (key === 'verse') return alternating[(stage + bar) % alternating.length]
  if (key === 'build') return stage === 0 ? ['center'] : stage === 1 ? ['inner'] : stage >= 2 ? (bar % 2 ? ['right'] : ['left']) : stage === 1 ? ['inner'] : ['center']
  if (key === 'preDrop') return stage === 0 ? ['outer'] : stage === 1 ? ['inner'] : ['center']
  if (key === 'drop1') {
    if (stage === 0 && bar === 0) return ['all']
    return bar % 2 ? ['right'] : stage % 2 ? ['inner'] : ['left']
  }
  if (key === 'breakdown') return bar % 2 ? ['right'] : stage % 2 ? ['inner'] : ['left']
  if (key === 'drop2') {
    if (stage === 3 && bar === 0) return ['all']
    return bar % 2 ? ['left'] : stage % 2 ? ['outer'] : ['right']
  }
  if (stage === 3 || bar === 3) return ['center']
  return stage % 2 ? ['inner'] : ['outer']
}

function supportIdsForCue(program: LaserDmxShowDirectorPerformanceProgram, catalog: FirstPartyAssignmentCatalog, key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey, stage: number, bar: number): string[] {
  const ids: string[] = []
  const id = program.id.toLowerCase()
  const ledLed = id.includes('led-bar-grid') || id.includes('matrix') || id.includes('chapter')
  const headLed = id.includes('moving-head') || id.includes('festival') || id.includes('club') || id.includes('stage')
  const atmosphereLed = id.includes('haze-co2') || id.includes('canopy') || id.includes('cathedral')
  if (ledLed || (key === 'build' && stage >= 1) || (key.startsWith('drop') && bar % 2 === 0)) ids.push(catalog.leds)
  if (headLed || key === 'breakdown' || (key === 'build' && stage >= 2)) ids.push(catalog.movingHeads)
  if (atmosphereLed || key === 'intro' || key === 'verse' || key === 'breakdown' || key === 'outro') ids.push(catalog.washes)
  if (key !== 'preDrop' || stage < 2) ids.push(catalog.haze)
  return Array.from(new Set(ids))
}

interface FirstPartyStageAuthoring {
  macro: LaserEffectMacro
  relationship: LaserFixtureGroupRelationship
  catalog: FirstPartyAssignmentCatalog
  definition: ReturnType<typeof getLaserDmxProfessionalEffect>
}

function createMacro(
  program: LaserDmxShowDirectorPerformanceProgram,
  profile: FirstPartyShowProfile,
  scene: LaserDmxShowDirectorPerformanceScene,
  key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  effectId: LaserDmxProfessionalEffectId,
  stage: number,
): FirstPartyStageAuthoring {
  const definition = getLaserDmxProfessionalEffect(effectId)
  const prefix = `${program.id}:${scene.id}:stage-${stage}`
  const relationshipId = `${prefix}:laser-relationship`
  const catalog = assignments(program, prefix, relationshipId)
  const laserAssignmentIds = Object.values(catalog.laser).filter((id): id is string => Boolean(id))
  const relationship: LaserFixtureGroupRelationship = {
    schemaVersion: 1,
    id: relationshipId,
    name: `${definition.name} authored fixture groups`,
    mode: definition.relationshipMode ?? (stage % 2 ? 'mirrored' : 'parallel'),
    memberAssignmentIds: laserAssignmentIds,
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
    duration: { kind: 'bar' },
    pattern: { ...definition.pattern, topologyId: `${program.id}:${effectId}:topology` },
    transform: { ...definition.transform },
    scan: { ...definition.scan, scanRatePps: Math.min(30_000, definition.scan.scanRatePps) },
    color: { mode: 'scene', colors: [...profile.palette], blend: stage / 3, alternateByGroup: stage >= 2 },
    optics: { ...definition.optics },
    envelope: { attack: 0.05, hold: 0.88, release: 0.07, intensityFloor: Math.min(0.08, definition.intensityFloor), intensityCeiling: Math.min(cueIntensity(key, stage), definition.intensityCeiling) },
    automation: [...definition.automation, ...supportAutomation(profile, key, stage)],
    fixtureGroupAssignments: catalog.assignments,
    transitionIn: stage === 0 ? { ...definition.transitionIn } : { type: stage === 2 ? 'bankHandoff' : 'shutterOutIn', durationBeats: 0.18, blankDisconnectedTravel: true, shutterDuringSwap: true },
    transitionOut: { type: 'shutterOutIn', durationBeats: 0.14, blankDisconnectedTravel: true, shutterDuringSwap: true },
    compatibility: { provisional: false, sourceSceneId: scene.id, warnings: [] },
  }
  return { macro, relationship, catalog, definition }
}

function createBarCue(
  program: LaserDmxShowDirectorPerformanceProgram,
  scene: LaserDmxShowDirectorPerformanceScene,
  key: LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  authored: FirstPartyStageAuthoring,
  stage: number,
  bar: number,
): LaserPerformanceCue {
  const prefix = `${program.id}:${scene.id}:stage-${stage}:bar-${bar}`
  const isFinalOutroBlackout = key === 'outro' && stage === 3 && bar >= 2
  const lifecycle = cueTiming(key, stage, bar, authored.definition.automation.length > 0 || ['smoothFanSweep', 'progressiveWave', 'tunnel', 'corridor', 'sequentialCircle'].includes(authored.definition.family))
  const command = finiteCommand(authored.definition, key, stage, lifecycle)
  const targetIds = isFinalOutroBlackout
    ? authored.catalog.assignments.map(assignment => assignment.id)
    : [
        ...pickLaserIds(authored.catalog, laserGroupsForCue(key, stage, bar)),
        ...supportIdsForCue(program, authored.catalog, key, stage, bar),
      ]
  return {
    schemaVersion: LASER_DMX_CUE_STACK_SCHEMA_VERSION,
    id: `${prefix}:cue`,
    name: `${scene.label} · stage ${stage + 1}, bar ${bar + 1}`,
    macroId: authored.macro.id,
    triggerSource: 'timeline',
    sceneIds: [scene.id],
    sectionTypes: [...scene.section.types] as ReactSectionType[],
    startQuantize: 'bar',
    startOffsetBeats: stage * 16 + bar * 4,
    repeatEveryBeats: 64,
    duration: { kind: 'bar' },
    fixtureGroupAssignmentIds: targetIds,
    automation: [],
    transitionIn: { ...authored.macro.transitionIn },
    transitionOut: { ...authored.macro.transitionOut },
    accents: isFinalOutroBlackout ? [] : accents(authored.catalog, prefix, key),
    occurrenceVariationSeedOffset: stage * 101 + bar * 17,
    priority: (scene.priority ?? 0) + 100 + stage * 10 + bar,
    lifecycle: isFinalOutroBlackout ? {
      delayBeats: 0, attackBeats: 0, movementBeats: 0, holdBeats: 0, releaseBeats: 0,
      blackoutBeats: 4, blackoutAfterCompletion: true, maximumRunBeats: 0.25,
      completionBehavior: 'blackout', returnBehavior: 'none',
    } : lifecycle,
    command: isFinalOutroBlackout ? { kind: 'blackout', durationBeats: 0.25, easing: 'hold', loopMode: 'none', shutdown: 'blackout' } : command,
    ownership: isFinalOutroBlackout
      ? { parameters: ['output'], interruptible: false, releaseOnCompletion: true, blackoutOverride: true }
      : cueOwnership(authored.definition, command),
    blackout: isFinalOutroBlackout,
    shutterClosed: isFinalOutroBlackout,
  }
}

function createPreDropBlackout(
  program: LaserDmxShowDirectorPerformanceProgram,
  scene: LaserDmxShowDirectorPerformanceScene,
  authored: FirstPartyStageAuthoring,
): LaserPerformanceCue {
  return {
    schemaVersion: LASER_DMX_CUE_STACK_SCHEMA_VERSION,
    id: `${program.id}:${scene.id}:intentional-blackout`,
    name: `${scene.label} · intentional pre-drop shutter`,
    macroId: authored.macro.id,
    triggerSource: 'preDrop',
    sceneIds: [scene.id],
    sectionTypes: [...scene.section.types] as ReactSectionType[],
    startQuantize: 'beat',
    startOffsetBeats: 15,
    repeatEveryBeats: 16,
    duration: { kind: 'beat' },
    fixtureGroupAssignmentIds: authored.catalog.assignments.map(item => item.id),
    automation: [],
    transitionIn: { type: 'briefBlackout', durationBeats: 0.1, blankDisconnectedTravel: true, shutterDuringSwap: true },
    transitionOut: { type: 'shutterOutIn', durationBeats: 0.1, blankDisconnectedTravel: true, shutterDuringSwap: true },
    accents: [],
    priority: (scene.priority ?? 0) + 10_000,
    lifecycle: {
      delayBeats: 0, attackBeats: 0, movementBeats: 0, holdBeats: 0, releaseBeats: 0,
      blackoutBeats: 1, blackoutAfterCompletion: true, maximumRunBeats: 0.25,
      completionBehavior: 'blackout', returnBehavior: 'none',
    },
    command: { kind: 'blackout', durationBeats: 0.25, easing: 'hold', loopMode: 'none', shutdown: 'blackout' },
    ownership: { parameters: ['output'], interruptible: false, releaseOnCompletion: true, blackoutOverride: true },
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

const FIRST_PARTY_GLOBAL_CEILINGS: Readonly<Record<
  LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  Required<Pick<NonNullable<LaserDmxShowDirectorPerformanceScene['global']>, 'dimmer' | 'haze' | 'beamPersistence' | 'globalGlow'>>
>> = Object.freeze({
  intro: { dimmer: 0.48, haze: 0.22, beamPersistence: 0.18, globalGlow: 0.38 },
  verse: { dimmer: 0.58, haze: 0.28, beamPersistence: 0.2, globalGlow: 0.44 },
  build: { dimmer: 0.76, haze: 0.5, beamPersistence: 0.24, globalGlow: 0.58 },
  preDrop: { dimmer: 0.44, haze: 0.26, beamPersistence: 0.14, globalGlow: 0.34 },
  drop1: { dimmer: 0.88, haze: 0.56, beamPersistence: 0.26, globalGlow: 0.7 },
  breakdown: { dimmer: 0.46, haze: 0.22, beamPersistence: 0.16, globalGlow: 0.34 },
  drop2: { dimmer: 0.92, haze: 0.6, beamPersistence: 0.28, globalGlow: 0.74 },
  outro: { dimmer: 0.38, haze: 0.14, beamPersistence: 0.12, globalGlow: 0.26 },
})

function recalibratedSceneGlobal(scene: LaserDmxShowDirectorPerformanceScene): LaserDmxShowDirectorPerformanceScene['global'] {
  const authored = scene.global ?? {}
  const ceilings = FIRST_PARTY_GLOBAL_CEILINGS[sectionKey(scene)]
  const cap = (value: number | undefined, ceiling: number) => Math.min(value ?? ceiling, ceiling)
  return {
    ...authored,
    dimmer: cap(authored.dimmer, ceilings.dimmer),
    haze: cap(authored.haze, ceilings.haze),
    beamPersistence: cap(authored.beamPersistence, ceilings.beamPersistence),
    globalGlow: cap(authored.globalGlow, ceilings.globalGlow),
    backgroundFade: Math.max(authored.backgroundFade ?? 0.9, 0.84),
  }
}

function cleanFirstPartyScene(scene: LaserDmxShowDirectorPerformanceScene): LaserDmxShowDirectorPerformanceScene {
  const cleanList = <T extends object>(items: T[] | undefined): T[] | undefined => items?.map(stripFirstPartyTopologyPayload)
  return stripFirstPartyTopologyPayload({
    ...scene,
    global: recalibratedSceneGlobal(scene),
    variations: cleanList(scene.variations as unknown as Array<Record<string, unknown>> | undefined),
    beatMutations: cleanList(scene.beatMutations as unknown as Array<Record<string, unknown>> | undefined),
    kickMutations: cleanList(scene.kickMutations as unknown as Array<Record<string, unknown>> | undefined),
    snareMutations: cleanList(scene.snareMutations as unknown as Array<Record<string, unknown>> | undefined),
    hatMutations: cleanList(scene.hatMutations as unknown as Array<Record<string, unknown>> | undefined),
    transientMutations: cleanList(scene.transientMutations as unknown as Array<Record<string, unknown>> | undefined),
    barMutations: cleanList(scene.barMutations as unknown as Array<Record<string, unknown>> | undefined),
    barProgression: cleanList(scene.barProgression as unknown as Array<Record<string, unknown>> | undefined),
    fourBarVariations: cleanList(scene.fourBarVariations as unknown as Array<Record<string, unknown>> | undefined),
    eightBarRecruitment: cleanList(scene.eightBarRecruitment as unknown as Array<Record<string, unknown>> | undefined),
    sixteenBarEvolution: cleanList(scene.sixteenBarEvolution as unknown as Array<Record<string, unknown>> | undefined),
    sectionEntryMutations: cleanList(scene.sectionEntryMutations as unknown as Array<Record<string, unknown>> | undefined),
    sectionBodyMutations: cleanList(scene.sectionBodyMutations as unknown as Array<Record<string, unknown>> | undefined),
    sectionExitMutations: cleanList(scene.sectionExitMutations as unknown as Array<Record<string, unknown>> | undefined),
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
    const authored = stageEffects(profile, key).map((effectId, stage) => createMacro(source, profile, representative, key, effectId, stage))
    macros.push(...authored.map(item => item.macro))
    relationships.push(...authored.map(item => item.relationship))
    for (const scene of sectionScenes) {
      for (const [stage, item] of authored.entries()) {
        for (let bar = 0; bar < 4; bar += 1) cues.push(createBarCue(source, scene, key, item, stage, bar))
      }
      if (key === 'preDrop') cues.push(createPreDropBlackout(source, scene, authored[3] ?? authored[0]))
    }
  }
  const document: LaserShowProgrammingDocument = {
    schemaVersion: LASER_DMX_SHOW_PROGRAMMING_SCHEMA_VERSION,
    id: `${source.id}:professional-programming`,
    macros,
    cueStacks: [{
      schemaVersion: LASER_DMX_CUE_STACK_SCHEMA_VERSION,
      id: `${source.id}:professional-cue-stack`,
      name: `${source.name} Finite Realism Cue Stack`,
      cues,
    }],
    activeCueStackId: `${source.id}:professional-cue-stack`,
    groupRelationships: relationships,
    constraints: {
      ...DEFAULT_LASER_SHOW_PROGRAMMING_CONSTRAINTS,
      maximumSimultaneouslyActiveLaserFixtures: 6,
      maximumContinuousOnBeats: 3.5,
      requiredBlackoutBeats: 0.25,
      maximumSimultaneouslyAnimatedPatterns: 2,
      maximumFiniteRotationBeats: 2,
    },
    compatibility: {
      source: 'native',
      adapterVersion: 3,
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
      authoringVersion: 'finite-realism-authoring-v3',
      notes: [
        ...(source.diagnostics?.notes ?? []),
        'First-party show uses one-bar finite cues, explicit lifecycle phases, authored shutter states, and deterministic completion.',
        'Fixture groups alternate and recruit progressively; full-rig output is reserved for bounded drop accents.',
        'Audio Intelligence triggers hierarchy changes and short accents while scanner topology remains stable inside each cue.',
        'Circle and tunnel movement is opt-in, single-pass, renderer-independent, and followed by a hold, release, or blackout.',
      ],
    },
  }
}

export function getLaserDmxFirstPartyShowProfile(id: LaserDmxShowDirectorBuiltInPerformanceProgramId): FirstPartyShowProfile {
  return structuredClone(PROFILES[id])
}
