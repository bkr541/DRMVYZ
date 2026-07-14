import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import type { LaserDmxFixture, LaserDmxSettings } from '../ReactTypes'
import {
  DEFAULT_PRODUCTION_FLASH_PATTERN,
  DEFAULT_PRODUCTION_GROUP_MOVEMENT,
  normalizeLaserDmxSettings,
  normalizeProductionChoreographySettings,
  normalizeProductionFlashPattern,
  normalizeProductionGroupMovement,
  type ProductionChoreographyProfile,
  type ProductionChoreographyProfileId,
  type ProductionChoreographySettings,
  type ProductionCueSectionType,
  type ProductionFixtureKind,
  type ProductionGroupMovementConfig,
} from '../LaserDmxProductionRig'
import { applyProductionLook } from './LaserDmxProductionLookEngine'

export type ProductionChoreographyEventType =
  | 'sectionChange'
  | 'phraseChange'
  | 'barAccent'
  | 'beatPulse'
  | 'kickAccent'
  | 'snareAccent'
  | 'dropImpact'
  | 'blackout'
  | 'paletteChange'
  | 'movementChange'
  | 'atmosphericImpact'

export interface ProductionChoreographyEvent {
  type: ProductionChoreographyEventType
  timeSec: number
  strength: number
  fixtureIds: string[]
  groupIds: string[]
  detail?: string
}

type ChoreographyEnvelopeKind = 'pulse' | 'whiteImpact' | 'blackout'

interface ChoreographyEnvelope {
  id: string
  kind: ChoreographyEnvelopeKind
  startedAtSec: number
  endTimeSec: number
  strength: number
  fixtureIds: string[]
}

export interface ProductionChoreographyRuntime {
  previousTrackKey: string | null
  previousFrameId: number
  previousSectionKey: string | null
  previousBeatIndex: number
  previousBarIndex: number
  previousDropConfidence: number
  activeLookId: string | null
  sectionDimmerScale: number
  sectionHazeScale: number
  paletteOffset: number
  groupMovements: Record<string, ProductionGroupMovementConfig>
  envelopes: ChoreographyEnvelope[]
  recoveryStartSec: number
  recoveryEndSec: number
  manualSuppressedUntilSec: number
  lastImpactAtSec: number
  atmosphericRequestId: number
  eventSequence: number
}

export interface ProductionChoreographyInput {
  settings: LaserDmxSettings
  musicIntelligence: MusicIntelligenceFrame | null
  audioTimeSec: number
  isPlaying: boolean
  trackKey?: string | null
  transportPass: number
  manualOverrideActive: boolean
  authoredCueActive: boolean
}

export interface ProductionChoreographyResult {
  settings: LaserDmxSettings
  events: ProductionChoreographyEvent[]
  activeProfileId: ProductionChoreographyProfileId
  analysisAvailable: boolean
  beatGridAvailable: boolean
  sectionAvailable: boolean
  suppressedReason: 'disabled' | 'missingAnalysis' | 'lowConfidence' | 'manualOverride' | 'authoredCue' | null
  blackoutActive: boolean
}

const PROFILE = (
  profile: ProductionChoreographyProfile,
): ProductionChoreographyProfile => profile

export const PRODUCTION_CHOREOGRAPHY_PROFILES: Readonly<Record<Exclude<ProductionChoreographyProfileId, 'custom'>, ProductionChoreographyProfile>> = {
  melodicBass: PROFILE({
    id: 'melodicBass', label: 'Melodic Bass',
    description: 'Long phrase arcs, broad reveals, restrained transient accents, and emotional drop impacts.',
    phraseLength: 16, beatPulseEvery: 2, downbeatAccentChance: 0.45, phraseMovementChance: 0.85,
    impactThreshold: 0.68, impactCooldownSec: 1.8, recoverySec: 1.2, maxTransientFamilies: 1,
    sectionIntensity: { intro: 0.35, verse: 0.52, build: 0.68, preDrop: 0.38, drop: 1, breakdown: 0.32, bridge: 0.48, outro: 0.28, unknown: 0.5 },
    beatFamilies: ['ledBar', 'movingHeadWash'], kickFamilies: ['movingHeadBeam', 'laserProjector'],
    snareFamilies: ['staticWash', 'movingHeadWash'], impactFamilies: ['blinder', 'movingHeadBeam', 'laserProjector', 'strobe'],
    movementGenerators: ['ceilingCanopy', 'mirroredFan', 'centerOutSpread', 'figureEight', 'staticAerialHold'],
  }),
  heavyDubstep: PROFILE({
    id: 'heavyDubstep', label: 'Heavy Dubstep',
    description: 'Sparse pre-drop staging, hard kick/snare separation, aggressive geometry, and short high-contrast impacts.',
    phraseLength: 8, beatPulseEvery: 1, downbeatAccentChance: 0.65, phraseMovementChance: 0.9,
    impactThreshold: 0.58, impactCooldownSec: 1.1, recoverySec: 0.75, maxTransientFamilies: 2,
    sectionIntensity: { intro: 0.28, verse: 0.5, build: 0.72, preDrop: 0.25, drop: 1, breakdown: 0.3, bridge: 0.45, outro: 0.22, unknown: 0.52 },
    beatFamilies: ['ledBar', 'laserProjector'], kickFamilies: ['laserProjector', 'movingHeadBeam'],
    snareFamilies: ['strobe', 'movingHeadWash'], impactFamilies: ['blinder', 'strobe', 'laserProjector', 'movingHeadBeam'],
    movementGenerators: ['crossfire', 'alternatingBanks', 'centerOutSpread', 'outsideInCollapse', 'crowdScan'],
  }),
  hybridTrap: PROFILE({
    id: 'hybridTrap', label: 'Hybrid Trap',
    description: 'Half-time punctuation, asymmetric movement changes, and selective audience-facing impact hits.',
    phraseLength: 8, beatPulseEvery: 2, downbeatAccentChance: 0.58, phraseMovementChance: 0.82,
    impactThreshold: 0.62, impactCooldownSec: 1.35, recoverySec: 0.85, maxTransientFamilies: 2,
    sectionIntensity: { intro: 0.32, verse: 0.48, build: 0.7, preDrop: 0.3, drop: 1, breakdown: 0.34, bridge: 0.5, outro: 0.24, unknown: 0.5 },
    beatFamilies: ['ledBar', 'staticWash'], kickFamilies: ['movingHeadBeam', 'laserProjector'],
    snareFamilies: ['blinder', 'movingHeadWash'], impactFamilies: ['blinder', 'strobe', 'movingHeadBeam', 'laserProjector'],
    movementGenerators: ['alternatingBanks', 'panWave', 'crossfire', 'fanOpen', 'fanClose'],
  }),
  house: PROFILE({
    id: 'house', label: 'House',
    description: 'Four-on-the-floor chases, slow phrase evolution, warm wash separation, and measured white accents.',
    phraseLength: 16, beatPulseEvery: 1, downbeatAccentChance: 0.38, phraseMovementChance: 0.72,
    impactThreshold: 0.74, impactCooldownSec: 2.2, recoverySec: 1.1, maxTransientFamilies: 1,
    sectionIntensity: { intro: 0.38, verse: 0.55, build: 0.72, preDrop: 0.42, drop: 0.92, breakdown: 0.36, bridge: 0.52, outro: 0.3, unknown: 0.52 },
    beatFamilies: ['ledBar', 'movingHeadWash'], kickFamilies: ['staticWash', 'movingHeadWash'],
    snareFamilies: ['ledBar'], impactFamilies: ['blinder', 'movingHeadBeam', 'strobe'],
    movementGenerators: ['panWave', 'tiltWave', 'mirroredFan', 'ceilingCanopy', 'pendulum'],
  }),
  techno: PROFILE({
    id: 'techno', label: 'Techno',
    description: 'Repetitive geometric systems with slow mutation, disciplined darkness, and rare industrial impacts.',
    phraseLength: 32, beatPulseEvery: 1, downbeatAccentChance: 0.32, phraseMovementChance: 0.62,
    impactThreshold: 0.76, impactCooldownSec: 2.4, recoverySec: 1.35, maxTransientFamilies: 1,
    sectionIntensity: { intro: 0.3, verse: 0.58, build: 0.7, preDrop: 0.4, drop: 0.88, breakdown: 0.28, bridge: 0.5, outro: 0.24, unknown: 0.52 },
    beatFamilies: ['ledBar', 'strobe'], kickFamilies: ['movingHeadBeam', 'staticWash'],
    snareFamilies: ['ledBar'], impactFamilies: ['strobe', 'blinder', 'movingHeadBeam'],
    movementGenerators: ['tunnel', 'panWave', 'staticAerialHold', 'alternatingBanks', 'ceilingCanopy'],
  }),
  openFormat: PROFILE({
    id: 'openFormat', label: 'Open Format',
    description: 'Conservative all-purpose staging that favors clarity, negative space, and broad genre compatibility.',
    phraseLength: 16, beatPulseEvery: 2, downbeatAccentChance: 0.4, phraseMovementChance: 0.7,
    impactThreshold: 0.7, impactCooldownSec: 1.8, recoverySec: 1, maxTransientFamilies: 1,
    sectionIntensity: { intro: 0.34, verse: 0.52, build: 0.68, preDrop: 0.36, drop: 0.94, breakdown: 0.32, bridge: 0.48, outro: 0.28, unknown: 0.5 },
    beatFamilies: ['ledBar', 'movingHeadWash'], kickFamilies: ['movingHeadBeam', 'laserProjector'],
    snareFamilies: ['staticWash', 'movingHeadWash'], impactFamilies: ['blinder', 'movingHeadBeam', 'strobe', 'laserProjector'],
    movementGenerators: ['mirroredFan', 'centerOutSpread', 'panWave', 'ceilingCanopy', 'staticAerialHold'],
  }),
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function hash32(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function random01(settings: ProductionChoreographySettings, input: ProductionChoreographyInput, token: string): number {
  const controlledSalt = settings.variationMode === 'controlled'
    ? Math.round(input.transportPass * 1009 * settings.variationAmount)
    : 0
  return hash32(`${settings.seed}:${controlledSalt}:${input.trackKey ?? 'track'}:${token}`) / 0xffffffff
}

function pickDeterministic<T>(items: readonly T[], random: number): T | null {
  if (items.length === 0) return null
  return items[Math.min(items.length - 1, Math.floor(clamp01(random) * items.length))] ?? null
}

function profileFor(settings: ProductionChoreographySettings): ProductionChoreographyProfile {
  if (settings.profileId !== 'custom') return PRODUCTION_CHOREOGRAPHY_PROFILES[settings.profileId]
  return {
    ...PRODUCTION_CHOREOGRAPHY_PROFILES.openFormat,
    ...(settings.customProfile ?? {}),
    id: 'custom',
    label: settings.customProfile?.label ?? 'Custom',
    description: settings.customProfile?.description ?? 'User-tuned layered production choreography.',
  }
}

function cloneSettings(settings: LaserDmxSettings): LaserDmxSettings {
  if (typeof structuredClone === 'function') return structuredClone(settings)
  return JSON.parse(JSON.stringify(settings)) as LaserDmxSettings
}

function fixtureKind(fixture: LaserDmxFixture): ProductionFixtureKind {
  return fixture.fixtureKind ?? 'laserProjector'
}

function familyCanParticipate(
  choreography: ProductionChoreographySettings,
  kind: ProductionFixtureKind,
): boolean {
  if (!choreography.fixtureFamilyParticipation[kind]) return false
  if (kind === 'strobe') return choreography.allowStrobe
  if (kind === 'hazer' || kind === 'fogger' || kind === 'cryoJet') return choreography.allowAtmospherics
  return true
}

function participatingFixtures(
  settings: LaserDmxSettings,
  choreography: ProductionChoreographySettings,
  families?: readonly ProductionFixtureKind[],
): LaserDmxFixture[] {
  const familySet = families ? new Set(families) : null
  return settings.fixtures.filter(fixture => {
    const kind = fixtureKind(fixture)
    return fixture.enabled && familyCanParticipate(choreography, kind) && (!familySet || familySet.has(kind))
  })
}

function selectFamilyFixtureIds(
  settings: LaserDmxSettings,
  choreography: ProductionChoreographySettings,
  families: readonly ProductionFixtureKind[],
  maxFamilies: number,
  token: string,
  input: ProductionChoreographyInput,
): string[] {
  const available = families.filter(family =>
    familyCanParticipate(choreography, family)
    && settings.fixtures.some(fixture => fixture.enabled && fixtureKind(fixture) === family),
  )
  if (available.length === 0) return []
  const start = Math.floor(random01(choreography, input, token) * available.length)
  const selectedFamilies = Array.from({ length: Math.min(maxFamilies, available.length) }, (_, offset) =>
    available[(start + offset) % available.length],
  )
  return settings.fixtures
    .filter(fixture => fixture.enabled && selectedFamilies.includes(fixtureKind(fixture)))
    .map(fixture => fixture.id)
}

function movementGroups(
  settings: LaserDmxSettings,
  choreography: ProductionChoreographySettings,
): Array<{ id: string; fixtureIds: string[] }> {
  const eligible = new Set(participatingFixtures(
    settings,
    choreography,
    ['movingHeadBeam', 'movingHeadSpot', 'movingHeadWash', 'laserProjector'],
  ).map(fixture => fixture.id))
  return (settings.productionGroups ?? [])
    .map(group => ({ id: group.id, fixtureIds: group.fixtureIds.filter(id => eligible.has(id)) }))
    .filter(group => group.fixtureIds.length > 0)
}

function applyPersistentRuntimeState(
  settingsInput: LaserDmxSettings,
  runtime: ProductionChoreographyRuntime,
  choreography: ProductionChoreographySettings,
): LaserDmxSettings {
  let settings = cloneSettings(settingsInput)
  const authoredFixtures = new Map(settings.fixtures.map(fixture => [fixture.id, fixture]))
  if (runtime.activeLookId) {
    const look = settings.productionLooks?.find(candidate => candidate.id === runtime.activeLookId)
    if (look) {
      settings = applyProductionLook(settings, look).settings
      settings.fixtures = settings.fixtures.map(fixture => {
        const authored = authoredFixtures.get(fixture.id)
        return authored && !familyCanParticipate(choreography, fixtureKind(authored)) ? authored : fixture
      })
      if (!choreography.allowStrobe) settings.globalStrobeRate = settingsInput.globalStrobeRate
      if (!choreography.allowAtmospherics) settings.hazeAmount = settingsInput.hazeAmount
    } else runtime.activeLookId = null
  }
  settings.masterDimmer = clamp01(settings.masterDimmer * runtime.sectionDimmerScale)
  if (familyCanParticipate(choreography, 'hazer')) {
    settings.hazeAmount = clamp01(settings.hazeAmount * runtime.sectionHazeScale)
  }
  settings.productionGroups = (settings.productionGroups ?? []).map(group => ({
    ...group,
    ...(runtime.groupMovements[group.id] ? { movement: runtime.groupMovements[group.id] } : {}),
  }))
  if (runtime.paletteOffset > 0) {
    const fixtures = participatingFixtures(settings, choreography)
    const colors = fixtures.map(fixture => ({ ...fixture.color, white: 0 }))
    if (colors.length > 1) {
      const offset = runtime.paletteOffset % colors.length
      const byId = new Map(fixtures.map((fixture, index) => [fixture.id, colors[(index + offset) % colors.length]]))
      settings.fixtures = settings.fixtures.map(fixture => byId.has(fixture.id)
        ? { ...fixture, color: { ...fixture.color, ...byId.get(fixture.id)!, white: 0 } }
        : fixture)
    }
  }
  return settings
}

function addEnvelope(
  runtime: ProductionChoreographyRuntime,
  kind: ChoreographyEnvelopeKind,
  now: number,
  durationSec: number,
  strength: number,
  fixtureIds: string[],
): void {
  runtime.eventSequence += 1
  runtime.envelopes.push({
    id: `${kind}:${runtime.eventSequence}`,
    kind,
    startedAtSec: now,
    endTimeSec: now + Math.max(0.02, durationSec),
    strength: clamp01(strength),
    fixtureIds,
  })
}

function applyEnvelopeState(
  settingsInput: LaserDmxSettings,
  runtime: ProductionChoreographyRuntime,
  choreography: ProductionChoreographySettings,
  now: number,
): { settings: LaserDmxSettings; blackoutActive: boolean } {
  runtime.envelopes = runtime.envelopes.filter(envelope => envelope.endTimeSec > now)
  let settings = settingsInput
  let blackoutActive = false
  for (const envelope of runtime.envelopes) {
    const duration = Math.max(0.02, envelope.endTimeSec - envelope.startedAtSec)
    const progress = clamp01((now - envelope.startedAtSec) / duration)
    const release = Math.sin(Math.PI * progress)
    if (envelope.kind === 'blackout') {
      blackoutActive = true
      settings = { ...settings, blackout: true }
      continue
    }
    const ids = new Set(envelope.fixtureIds)
    settings = {
      ...settings,
      fixtures: settings.fixtures.map(fixture => {
        if (!ids.has(fixture.id)) return fixture
        const intensity = clamp01(envelope.strength * (envelope.kind === 'whiteImpact' ? (1 - progress * 0.35) : release))
        if (envelope.kind === 'pulse') {
          return {
            ...fixture,
            beam: { ...fixture.beam, shutterOpen: true, dimmer: Math.max(fixture.beam.dimmer, intensity) },
          }
        }
        const kind = fixtureKind(fixture)
        const flashEligible = choreography.allowStrobe && (kind === 'strobe' || kind === 'blinder')
        const whiteMix = clamp01(intensity * choreography.whiteImpactIntensity)
        const mixChannel = (channel: number) => Math.round(channel + (255 - channel) * whiteMix)
        return {
          ...fixture,
          beam: { ...fixture.beam, shutterOpen: true, dimmer: Math.max(fixture.beam.dimmer, intensity) },
          color: {
            ...fixture.color,
            red: mixChannel(fixture.color.red),
            green: mixChannel(fixture.color.green),
            blue: mixChannel(fixture.color.blue),
            white: Math.max(fixture.color.white, Math.round(255 * whiteMix)),
          },
          ...(kind === 'laserProjector'
            ? { path: { ...fixture.path, kind: 'fan' as const, spread: 1, complexity: Math.max(fixture.path.complexity, 0.85) } }
            : {}),
          ...(flashEligible
            ? {
                flashPattern: normalizeProductionFlashPattern({
                  ...(fixture.flashPattern ?? DEFAULT_PRODUCTION_FLASH_PATTERN),
                  enabled: true,
                  pattern: kind === 'blinder' ? 'singleHit' : 'fullStageWhiteout',
                  triggerTimeSec: envelope.startedAtSec,
                  intensity,
                  whiteAccent: true,
                  durationBeats: 0.5,
                }),
              }
            : {}),
        }
      }),
    }
  }
  if (runtime.recoveryEndSec > now && runtime.recoveryEndSec > runtime.recoveryStartSec) {
    const progress = clamp01((now - runtime.recoveryStartSec) / (runtime.recoveryEndSec - runtime.recoveryStartSec))
    const recoveryScale = 0.58 + 0.42 * progress
    settings = { ...settings, masterDimmer: Math.min(settings.masterDimmer, settings.masterDimmer * recoveryScale) }
  }
  return { settings, blackoutActive }
}

function sectionType(frame: MusicIntelligenceFrame): ProductionCueSectionType {
  const value = frame.currentResolvedSection?.type ?? frame.section.type
  return value === 'intro' || value === 'verse' || value === 'build' || value === 'preDrop'
    || value === 'drop' || value === 'breakdown' || value === 'bridge' || value === 'outro'
    ? value
    : 'unknown'
}

function phraseHit(frame: MusicIntelligenceFrame, length: 8 | 16 | 32): boolean {
  if (length === 8) return frame.rhythm.phrase8Hit
  if (length === 32) return frame.rhythm.phrase32Hit
  return frame.rhythm.phrase16Hit
}

function sectionLookId(
  settings: LaserDmxSettings,
  type: ProductionCueSectionType,
  choreography: ProductionChoreographySettings,
  input: ProductionChoreographyInput,
): string | null {
  const looks = settings.productionLooks ?? []
  if (looks.length === 0) return null
  const matching = looks.filter(look => `${look.name} ${look.description ?? ''}`.toLowerCase().includes(type.toLowerCase()))
  const candidates = matching.length > 0 ? matching : looks
  return pickDeterministic(candidates, random01(choreography, input, `look:${type}:${input.musicIntelligence?.currentResolvedSection?.startSec ?? input.musicIntelligence?.section.startSec ?? 0}`))?.id ?? null
}

function applyAtmosphericImpact(
  settings: LaserDmxSettings,
  runtime: ProductionChoreographyRuntime,
  choreography: ProductionChoreographySettings,
  input: ProductionChoreographyInput,
  strength: number,
): { settings: LaserDmxSettings; fixtureIds: string[] } {
  if (!choreography.allowAtmospherics) return { settings, fixtureIds: [] }
  const eligible = participatingFixtures(settings, choreography, ['fogger', 'cryoJet'])
  if (eligible.length === 0) return { settings, fixtureIds: [] }
  const selected = pickDeterministic(eligible, random01(choreography, input, `atmosphere:${input.musicIntelligence?.rhythm.barIndex ?? 0}`))
  if (!selected?.atmospheric) return { settings, fixtureIds: [] }
  runtime.atmosphericRequestId += 1
  return {
    fixtureIds: [selected.id],
    settings: {
      ...settings,
      fixtures: settings.fixtures.map(fixture => fixture.id === selected.id
        ? {
            ...fixture,
            atmospheric: {
              ...fixture.atmospheric!,
              armed: true,
              outputLevel: clamp01(strength),
              triggerRequestId: runtime.atmosphericRequestId,
            },
          }
        : fixture),
    },
  }
}

export function createProductionChoreographyRuntime(): ProductionChoreographyRuntime {
  return {
    previousTrackKey: null,
    previousFrameId: 0,
    previousSectionKey: null,
    previousBeatIndex: -1,
    previousBarIndex: -1,
    previousDropConfidence: 0,
    activeLookId: null,
    sectionDimmerScale: 1,
    sectionHazeScale: 1,
    paletteOffset: 0,
    groupMovements: {},
    envelopes: [],
    recoveryStartSec: -1,
    recoveryEndSec: -1,
    manualSuppressedUntilSec: -1,
    lastImpactAtSec: -Infinity,
    atmosphericRequestId: 0,
    eventSequence: 0,
  }
}

export function resetProductionChoreographyRuntime(runtime: ProductionChoreographyRuntime): void {
  Object.assign(runtime, createProductionChoreographyRuntime())
}

export function evaluateProductionChoreography(
  runtime: ProductionChoreographyRuntime,
  input: ProductionChoreographyInput,
): ProductionChoreographyResult {
  const base = normalizeLaserDmxSettings(input.settings)
  const choreography = normalizeProductionChoreographySettings(base.choreography)
  const profile = profileFor(choreography)
  const now = Math.max(0, Number.isFinite(input.audioTimeSec) ? input.audioTimeSec : 0)
  const frame = input.musicIntelligence
  const events: ProductionChoreographyEvent[] = []

  if (runtime.previousTrackKey !== (input.trackKey ?? null)) {
    const next = createProductionChoreographyRuntime()
    next.previousTrackKey = input.trackKey ?? null
    next.atmosphericRequestId = runtime.atmosphericRequestId
    Object.assign(runtime, next)
  }
  if (input.manualOverrideActive) {
    runtime.manualSuppressedUntilSec = Math.max(runtime.manualSuppressedUntilSec, now + choreography.manualOverrideHoldMs / 1000)
  }

  const capabilities = frame?.capabilities
  const analysisAvailable = Boolean(frame && frame.frameId > 0)
  const beatGridAvailable = Boolean(
    analysisAvailable && capabilities?.beatGrid && frame!.rhythm.bpm > 0 && frame!.rhythm.bpmConfidence >= 0.25,
  )
  const sectionAvailable = Boolean(
    analysisAvailable && capabilities?.sections && frame!.section.type
      && (frame!.section.source === 'manual' || frame!.section.confidence >= 0.35),
  )
  const rhythmEventsAvailable = Boolean(
    analysisAvailable && capabilities?.rhythmEvents && frame!.rhythm.transientConfidence >= 0.2,
  )

  if (!choreography.enabled || !input.isPlaying) {
    return {
      settings: base,
      events,
      activeProfileId: choreography.profileId,
      analysisAvailable,
      beatGridAvailable,
      sectionAvailable,
      suppressedReason: choreography.enabled ? null : 'disabled',
      blackoutActive: false,
    }
  }
  if (!analysisAvailable || !frame) {
    return {
      settings: base,
      events,
      activeProfileId: choreography.profileId,
      analysisAvailable: false,
      beatGridAvailable: false,
      sectionAvailable: false,
      suppressedReason: 'missingAnalysis',
      blackoutActive: false,
    }
  }

  const manualSuppressed = now < runtime.manualSuppressedUntilSec
  const eventSuppressed = manualSuppressed || input.authoredCueActive
  const suppressedReason: ProductionChoreographyResult['suppressedReason'] = manualSuppressed
    ? 'manualOverride'
    : input.authoredCueActive
      ? 'authoredCue'
      : (!beatGridAvailable && !sectionAvailable && !rhythmEventsAvailable ? 'lowConfidence' : null)

  if (sectionAvailable) {
    const type = sectionType(frame)
    const key = `${type}:${frame.section.startSec}:${frame.section.endSec}:${frame.section.source}`
    if (runtime.previousSectionKey !== key) {
      runtime.previousSectionKey = key
      const sectionScale = profile.sectionIntensity[type] ?? profile.sectionIntensity.unknown ?? 0.5
      runtime.sectionDimmerScale = 1 - choreography.intensity * (1 - sectionScale)
      runtime.sectionHazeScale = 0.82 + 0.3 * sectionScale
      if (!eventSuppressed && choreography.automaticLookChanges) {
        runtime.activeLookId = sectionLookId(base, type, choreography, input)
      }
      events.push({
        type: 'sectionChange', timeSec: now, strength: sectionScale,
        fixtureIds: [], groupIds: [], detail: type,
      })
      const negativeSpaceSection = type === 'intro' || type === 'breakdown' || type === 'outro' || type === 'preDrop'
      if (!eventSuppressed && negativeSpaceSection
        && random01(choreography, input, `section-blackout:${key}`) < choreography.blackoutFrequency * 0.45) {
        addEnvelope(runtime, 'blackout', now, 0.18 + choreography.blackoutFrequency * 0.42, 1, [])
        events.push({ type: 'blackout', timeSec: now, strength: 1, fixtureIds: [], groupIds: [], detail: 'section negative space' })
      }
    }
  } else if (runtime.previousSectionKey !== null) {
    runtime.previousSectionKey = null
    runtime.activeLookId = null
    runtime.sectionDimmerScale = 1
    runtime.sectionHazeScale = 1
  }

  let settings = base
  const groups = movementGroups(settings, choreography)

  if (!eventSuppressed && beatGridAvailable) {
    const currentBeat = frame.rhythm.beatIndex
    const currentBar = frame.rhythm.barIndex
    const newBeat = frame.rhythm.beatHit && currentBeat !== runtime.previousBeatIndex
    const newBar = frame.rhythm.downbeatHit && currentBar !== runtime.previousBarIndex
    const newPhrase = phraseHit(frame, profile.phraseLength) && newBeat

    if (newPhrase && choreography.automaticMovementChanges && groups.length > 0
      && random01(choreography, input, `phrase-movement:${currentBeat}`) <= profile.phraseMovementChance) {
      const group = pickDeterministic(groups, random01(choreography, input, `phrase-group:${currentBeat}`))
      const generator = pickDeterministic(profile.movementGenerators, random01(choreography, input, `phrase-generator:${currentBeat}`))
      if (group && generator) {
        const movement = normalizeProductionGroupMovement({
          ...DEFAULT_PRODUCTION_GROUP_MOVEMENT,
          enabled: true,
          generator,
          speed: 0.55 + choreography.intensity * 0.9,
          amplitude: 0.45 + choreography.intensity * 0.5,
          quantize: 'phrase',
          durationBeats: profile.phraseLength,
          seed: choreography.seed,
        })
        runtime.groupMovements[group.id] = movement
        events.push({ type: 'phraseChange', timeSec: now, strength: choreography.intensity, fixtureIds: group.fixtureIds, groupIds: [group.id], detail: `${profile.phraseLength}-beat phrase` })
        events.push({ type: 'movementChange', timeSec: now, strength: choreography.intensity, fixtureIds: group.fixtureIds, groupIds: [group.id], detail: generator })
      }
    }

    if (newBar) {
      if (random01(choreography, input, `palette:${currentBar}`) <= profile.downbeatAccentChance * choreography.intensity * 0.45) {
        runtime.paletteOffset = Math.max(1, Math.floor(random01(choreography, input, `palette-offset:${currentBar}`) * Math.max(2, settings.fixtures.length)))
        events.push({ type: 'paletteChange', timeSec: now, strength: choreography.intensity, fixtureIds: participatingFixtures(settings, choreography).map(fixture => fixture.id), groupIds: [], detail: 'downbeat palette rotation' })
      }
      if (random01(choreography, input, `bar-blackout:${currentBar}`) < choreography.blackoutFrequency * 0.18) {
        addEnvelope(runtime, 'blackout', now, 0.1 + 0.3 * choreography.blackoutFrequency, 1, [])
        events.push({ type: 'blackout', timeSec: now, strength: 1, fixtureIds: [], groupIds: [], detail: 'bar negative space' })
      }
      events.push({ type: 'barAccent', timeSec: now, strength: choreography.intensity, fixtureIds: [], groupIds: [], detail: `bar ${currentBar}` })
    }

    const impactThreshold = clamp01(profile.impactThreshold + (0.5 - choreography.impactSensitivity) * 0.35)
    const dropConfidence = Math.max(frame.semantics.dropConfidence, frame.energy.dropImpact)
    const inDrop = frame.section.type === 'drop' && sectionAvailable
    const impactEdge = runtime.previousDropConfidence < impactThreshold && dropConfidence >= impactThreshold
    const impactAligned = frame.rhythm.downbeatHit || impactEdge
    const impactReady = now - runtime.lastImpactAtSec >= profile.impactCooldownSec
    const impactTriggered = impactReady && impactAligned && (inDrop || dropConfidence >= impactThreshold)

    if (impactTriggered) {
      const strength = clamp01(Math.max(dropConfidence, frame.rhythm.transient) * choreography.intensity)
      const fixtureIds = selectFamilyFixtureIds(settings, choreography, profile.impactFamilies, Math.max(1, profile.maxTransientFamilies), `impact:${currentBeat}`, input)
      addEnvelope(runtime, 'whiteImpact', now, 0.16 + 0.14 * choreography.whiteImpactIntensity, strength, fixtureIds)
      runtime.lastImpactAtSec = now
      runtime.recoveryStartSec = now + 0.18
      runtime.recoveryEndSec = runtime.recoveryStartSec + profile.recoverySec
      if (choreography.automaticMovementChanges && groups.length > 0) {
        const group = pickDeterministic(groups, random01(choreography, input, `impact-group:${currentBeat}`))
        if (group) runtime.groupMovements[group.id] = normalizeProductionGroupMovement({
          ...DEFAULT_PRODUCTION_GROUP_MOVEMENT,
          enabled: true,
          generator: 'centerOutSpread',
          speed: 1.25,
          amplitude: 1,
          quantize: 'bar',
          durationBeats: 4,
        })
      }
      const atmospheric = applyAtmosphericImpact(settings, runtime, choreography, input, strength)
      settings = atmospheric.settings
      events.push({ type: 'dropImpact', timeSec: now, strength, fixtureIds, groupIds: [], detail: 'white impact with post-impact recovery' })
      if (atmospheric.fixtureIds.length > 0) events.push({ type: 'atmosphericImpact', timeSec: now, strength, fixtureIds: atmospheric.fixtureIds, groupIds: [], detail: 'armed virtual atmosphere burst' })
    } else if (newBeat) {
      const transientCandidates: Array<{ type: 'kickAccent' | 'snareAccent' | 'beatPulse'; strength: number; families: ProductionFixtureKind[] }> = []
      if (rhythmEventsAvailable && frame.rhythm.kickHit) transientCandidates.push({ type: 'kickAccent', strength: frame.rhythm.kickStrength, families: profile.kickFamilies })
      if (rhythmEventsAvailable && frame.rhythm.snareHit) transientCandidates.push({ type: 'snareAccent', strength: frame.rhythm.snareStrength, families: profile.snareFamilies })
      if (transientCandidates.length === 0 && currentBeat % Math.max(1, profile.beatPulseEvery) === 0) {
        transientCandidates.push({ type: 'beatPulse', strength: 0.45 + 0.4 * frame.energy.percentile, families: profile.beatFamilies })
      }
      transientCandidates
        .sort((a, b) => b.strength - a.strength)
        .slice(0, Math.max(1, profile.maxTransientFamilies))
        .forEach(candidate => {
          const fixtureIds = selectFamilyFixtureIds(settings, choreography, candidate.families, 1, `${candidate.type}:${currentBeat}`, input)
          if (fixtureIds.length === 0) return
          const strength = clamp01(candidate.strength * choreography.intensity)
          addEnvelope(runtime, 'pulse', now, 0.16, strength, fixtureIds)
          events.push({ type: candidate.type, timeSec: now, strength, fixtureIds, groupIds: [], detail: 'single-family transient accent' })
        })
    }

    runtime.previousBeatIndex = currentBeat
    runtime.previousBarIndex = currentBar
    runtime.previousDropConfidence = dropConfidence
  } else {
    runtime.previousDropConfidence = Math.max(frame.semantics.dropConfidence, frame.energy.dropImpact)
  }

  settings = applyPersistentRuntimeState(settings, runtime, choreography)
  const envelopeState = applyEnvelopeState(settings, runtime, choreography, now)
  settings = envelopeState.settings
  runtime.previousFrameId = frame.frameId

  return {
    settings: normalizeLaserDmxSettings(settings),
    events,
    activeProfileId: choreography.profileId,
    analysisAvailable,
    beatGridAvailable,
    sectionAvailable,
    suppressedReason,
    blackoutActive: envelopeState.blackoutActive,
  }
}
