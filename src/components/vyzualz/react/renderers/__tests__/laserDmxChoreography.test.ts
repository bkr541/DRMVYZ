import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxSettings,
} from '../../ReactTypes'
import {
  normalizeLaserDmxSettings,
  normalizeProductionCompoundCue,
  type ProductionCompoundCue,
} from '../../LaserDmxProductionRig'
import {
  createProductionChoreographyRuntime,
  evaluateProductionChoreography,
} from '../LaserDmxChoreographyEngine'
import {
  createShowDirectorRuntime,
  evaluateShowDirector,
} from '../LaserDmxShowDirector'

function miFrame(overrides: {
  frameId?: number
  beatIndex?: number
  barIndex?: number
  beatHit?: boolean
  downbeatHit?: boolean
  phrase16Hit?: boolean
  kickHit?: boolean
  kickStrength?: number
  snareHit?: boolean
  snareStrength?: number
  bpm?: number
  bpmConfidence?: number
  transient?: number
  transientConfidence?: number
  sectionType?: MusicIntelligenceFrame['section']['type']
  sectionStart?: number
  sectionEnd?: number
  sectionConfidence?: number
  dropConfidence?: number
  dropImpact?: number
  capabilities?: Partial<NonNullable<MusicIntelligenceFrame['capabilities']>>
} = {}): MusicIntelligenceFrame {
  return {
    ...DEFAULT_MI_FRAME,
    frameId: overrides.frameId ?? 1,
    timeSec: 10,
    sourceId: 'track-a',
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: overrides.bpm ?? 120,
      bpmConfidence: overrides.bpmConfidence ?? 1,
      beatIndex: overrides.beatIndex ?? 16,
      barIndex: overrides.barIndex ?? 4,
      beatHit: overrides.beatHit ?? false,
      downbeatHit: overrides.downbeatHit ?? false,
      phrase16Hit: overrides.phrase16Hit ?? false,
      kickHit: overrides.kickHit ?? false,
      kickStrength: overrides.kickStrength ?? 0,
      snareHit: overrides.snareHit ?? false,
      snareStrength: overrides.snareStrength ?? 0,
      transient: overrides.transient ?? 0.7,
      transientConfidence: overrides.transientConfidence ?? 1,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: overrides.sectionType ?? null,
      label: overrides.sectionType ?? '',
      startSec: overrides.sectionStart ?? 8,
      endSec: overrides.sectionEnd ?? 16,
      intensity: 0.8,
      confidence: overrides.sectionConfidence ?? 1,
      source: 'analysis',
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      percentile: 0.7,
      dropImpact: overrides.dropImpact ?? 0,
    },
    semantics: {
      ...DEFAULT_MI_FRAME.semantics,
      dropConfidence: overrides.dropConfidence ?? 0,
    },
    capabilities: {
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: false,
      lyrics: false,
      ...(overrides.capabilities ?? {}),
    },
  }
}

function choreographySettings(overrides: Record<string, unknown> = {}) {
  return normalizeLaserDmxSettings({
    ...createDefaultLaserDmxSettings(),
    productionGroups: [{
      id: 'front-truss',
      name: 'Front Truss',
      fixtureIds: createDefaultLaserDmxSettings().fixtures.map(fixture => fixture.id),
    }],
    choreography: {
      ...createDefaultLaserDmxSettings().choreography,
      profileId: 'custom',
      blackoutFrequency: 0,
      allowStrobe: false,
      allowAtmospherics: false,
      customProfile: {
        phraseMovementChance: 1,
        downbeatAccentChance: 0,
        impactThreshold: 0.6,
        impactCooldownSec: 1,
        recoverySec: 1,
        maxTransientFamilies: 1,
        beatPulseEvery: 1,
        phraseLength: 16,
        beatFamilies: ['laserProjector'],
        kickFamilies: ['laserProjector'],
        snareFamilies: ['laserProjector'],
        impactFamilies: ['laserProjector'],
        movementGenerators: ['centerOutSpread', 'mirroredFan'],
      },
      ...overrides,
    },
  })
}

function showCue(overrides: Partial<ProductionCompoundCue>): ProductionCompoundCue {
  return normalizeProductionCompoundCue({
    id: 'cue',
    label: 'Cue',
    enabled: true,
    timing: { mode: 'absolute', timeSec: 0 },
    quantize: 'none',
    durationMs: 5000,
    priority: 10,
    retriggerPolicy: 'oncePerPass',
    cancellationBehavior: 'restoreOnExit',
    fixtureGroupIds: [],
    manualOnly: false,
    actions: [{ id: 'action', type: 'reveal', execution: 'simultaneous' }],
    ...overrides,
  })
}

describe('LaserDMX layered choreography', () => {
  it('uses canonical section changes to influence the broad look without deriving a section system', () => {
    const runtime = createProductionChoreographyRuntime()
    const settings = choreographySettings()
    const verse = evaluateProductionChoreography(runtime, {
      settings,
      musicIntelligence: miFrame({ sectionType: 'verse', sectionStart: 0, sectionEnd: 8 }),
      audioTimeSec: 2,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    const drop = evaluateProductionChoreography(runtime, {
      settings,
      musicIntelligence: miFrame({ frameId: 2, sectionType: 'drop', sectionStart: 8, sectionEnd: 16 }),
      audioTimeSec: 9,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    expect(verse.events.some(event => event.type === 'sectionChange' && event.detail === 'verse')).toBe(true)
    expect(drop.events.some(event => event.type === 'sectionChange' && event.detail === 'drop')).toBe(true)
    expect(drop.settings.masterDimmer).toBeGreaterThan(verse.settings.masterDimmer)
  })

  it('changes a reusable group movement only at the canonical phrase boundary', () => {
    const result = evaluateProductionChoreography(createProductionChoreographyRuntime(), {
      settings: choreographySettings(),
      musicIntelligence: miFrame({ beatHit: true, phrase16Hit: true, beatIndex: 32 }),
      audioTimeSec: 16,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    expect(result.events.some(event => event.type === 'phraseChange')).toBe(true)
    expect(result.settings.productionGroups?.[0].movement?.enabled).toBe(true)
    expect(result.settings.productionGroups?.[0].movement?.quantize).toBe('phrase')
  })

  it('keeps locked seeded variation deterministic for repeated playback', () => {
    const input = {
      settings: choreographySettings({ seed: 913, variationMode: 'locked' }),
      musicIntelligence: miFrame({ beatHit: true, phrase16Hit: true, beatIndex: 32 }),
      audioTimeSec: 16,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    } as const
    const first = evaluateProductionChoreography(createProductionChoreographyRuntime(), input)
    const second = evaluateProductionChoreography(createProductionChoreographyRuntime(), input)
    expect(second.events).toEqual(first.events)
    expect(second.settings.productionGroups?.[0].movement).toEqual(first.settings.productionGroups?.[0].movement)
  })

  it('does not invent a fallback tempo when analysis is missing or rhythm confidence is low', () => {
    const settings = choreographySettings()
    const missing = evaluateProductionChoreography(createProductionChoreographyRuntime(), {
      settings,
      musicIntelligence: null,
      audioTimeSec: 3,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    expect(missing.suppressedReason).toBe('missingAnalysis')
    expect(missing.settings).toEqual(settings)

    const low = evaluateProductionChoreography(createProductionChoreographyRuntime(), {
      settings,
      musicIntelligence: miFrame({
        bpm: 0,
        bpmConfidence: 0,
        sectionType: null,
        transientConfidence: 0,
        capabilities: { sections: false, rhythmEvents: false },
      }),
      audioTimeSec: 3,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    expect(low.suppressedReason).toBe('lowConfidence')
    expect(low.events).toEqual([])
  })

  it('suspends automatic phrase and transient reactions during a manual override hold', () => {
    const result = evaluateProductionChoreography(createProductionChoreographyRuntime(), {
      settings: choreographySettings(),
      musicIntelligence: miFrame({ beatHit: true, phrase16Hit: true, kickHit: true, kickStrength: 1 }),
      audioTimeSec: 10,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: true,
      authoredCueActive: false,
    })
    expect(result.suppressedReason).toBe('manualOverride')
    expect(result.events.some(event => event.type === 'phraseChange' || event.type === 'kickAccent')).toBe(false)
  })

  it('applies authored cue writes after automatic choreography', () => {
    const base = choreographySettings({ intensity: 1 })
    const fixtureId = base.fixtures[0].id
    const settings = normalizeLaserDmxSettings({
      ...base,
      productionCues: [showCue({
        actions: [{
          id: 'fixture-dimmer',
          type: 'setFixtureProperty',
          execution: 'simultaneous',
          fixtureId,
          properties: { dimmer: 0.1 },
        }],
      })],
    })
    const result = evaluateShowDirector(createShowDirectorRuntime(), {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 1,
      isPlaying: true,
      bpm: 120,
      trackKey: 'track-a',
      presetKey: 'preset-a',
      musicIntelligence: miFrame({ beatHit: true, kickHit: true, kickStrength: 1 }),
    })
    expect(result.settings.fixtures.find(fixture => fixture.id === fixtureId)?.beam.dimmer).toBe(0.1)
    expect(result.choreographyStatus.analysisAvailable).toBe(true)
  })

  it('honors the documented manual-vs-authored precedence option', () => {
    const authored = showCue({ id: 'authored', actions: [{ id: 'reveal', type: 'reveal', execution: 'simultaneous' }] })
    const manual = showCue({
      id: 'manual',
      timing: { mode: 'manual' },
      manualOnly: true,
      actions: [{ id: 'blackout', type: 'blackout', execution: 'simultaneous' }],
    })
    const run = (manualOverridePrecedence: 'authoredFirst' | 'manualFirst') => evaluateShowDirector(createShowDirectorRuntime(), {
      settings: normalizeLaserDmxSettings({
        ...choreographySettings({ enabled: false, manualOverridePrecedence }),
        productionCues: [authored, manual],
      }),
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 1,
      isPlaying: true,
      bpm: 120,
      trackKey: 'track-a',
      presetKey: 'preset-a',
      manualRequest: { cueId: 'manual', sequence: 1 },
    })
    expect(run('authoredFirst').settings.blackout).toBe(false)
    expect(run('manualFirst').settings.blackout).toBe(true)
  })

  it('creates a coordinated drop impact and then recovers instead of holding white indefinitely', () => {
    const runtime = createProductionChoreographyRuntime()
    const settings = choreographySettings({ intensity: 1, whiteImpactIntensity: 1 })
    const impact = evaluateProductionChoreography(runtime, {
      settings,
      musicIntelligence: miFrame({ sectionType: 'drop', downbeatHit: true, beatHit: true, dropConfidence: 1, transient: 1 }),
      audioTimeSec: 10,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    const recovery = evaluateProductionChoreography(runtime, {
      settings,
      musicIntelligence: miFrame({ frameId: 2, sectionType: 'drop', beatIndex: 17, dropConfidence: 0 }),
      audioTimeSec: 10.5,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    const recovered = evaluateProductionChoreography(runtime, {
      settings,
      musicIntelligence: miFrame({ frameId: 3, sectionType: 'drop', beatIndex: 20, dropConfidence: 0 }),
      audioTimeSec: 12,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    expect(impact.events.some(event => event.type === 'dropImpact')).toBe(true)
    expect(impact.settings.fixtures[0].color.white).toBe(255)
    expect(recovery.settings.masterDimmer).toBeLessThan(recovered.settings.masterDimmer)
    expect(recovered.settings.fixtures[0].color.white).toBe(settings.fixtures[0].color.white)
  })

  it('excludes fixture families that the user removed from choreography participation', () => {
    const settings = choreographySettings({
      fixtureFamilyParticipation: {
        ...createDefaultLaserDmxSettings().choreography!.fixtureFamilyParticipation,
        laserProjector: false,
      },
    })
    const result = evaluateProductionChoreography(createProductionChoreographyRuntime(), {
      settings,
      musicIntelligence: miFrame({ beatHit: true, kickHit: true, kickStrength: 1 }),
      audioTimeSec: 10,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    expect(result.events.some(event => event.type === 'kickAccent' || event.type === 'beatPulse')).toBe(false)
    expect(result.settings.fixtures[0].beam.dimmer).toBe(settings.fixtures[0].beam.dimmer)
  })

  it('keeps automatic strobe output behind the explicit permission gate', () => {
    const base = createDefaultLaserDmxSettings()
    const strobe = {
      ...base.fixtures[0],
      id: 'strobe-1',
      fixtureKind: 'strobe' as const,
      dmx: { ...base.fixtures[0].dmx, profileId: 'genericWhiteStrobe' as const },
      color: { ...base.fixtures[0].color, red: 20, green: 40, blue: 60, white: 0 },
    }
    const createSettings = (allowStrobe: boolean) => normalizeLaserDmxSettings({
      ...base,
      fixtures: [strobe],
      choreography: {
        ...base.choreography,
        profileId: 'custom',
        intensity: 1,
        allowStrobe,
        customProfile: {
          impactThreshold: 0.5,
          impactCooldownSec: 1,
          recoverySec: 1,
          maxTransientFamilies: 1,
          phraseLength: 16,
          beatPulseEvery: 1,
          downbeatAccentChance: 0,
          phraseMovementChance: 0,
          beatFamilies: ['strobe'],
          kickFamilies: ['strobe'],
          snareFamilies: ['strobe'],
          impactFamilies: ['strobe'],
          movementGenerators: [],
        },
      },
    })
    const run = (allowStrobe: boolean) => evaluateProductionChoreography(createProductionChoreographyRuntime(), {
      settings: createSettings(allowStrobe),
      musicIntelligence: miFrame({ sectionType: 'drop', downbeatHit: true, beatHit: true, dropConfidence: 1, transient: 1 }),
      audioTimeSec: 10,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    const blocked = run(false)
    const permitted = run(true)
    expect(blocked.events.find(event => event.type === 'dropImpact')?.fixtureIds).toEqual([])
    expect(blocked.settings.fixtures[0].color).toEqual(createSettings(false).fixtures[0].color)
    expect(permitted.events.find(event => event.type === 'dropImpact')?.fixtureIds).toEqual(['strobe-1'])
    expect(permitted.settings.fixtures[0].flashPattern?.enabled).toBe(true)
  })

  it('lets zero white-impact intensity preserve authored fixture color', () => {
    const settings = choreographySettings({ intensity: 1, whiteImpactIntensity: 0 })
    const result = evaluateProductionChoreography(createProductionChoreographyRuntime(), {
      settings,
      musicIntelligence: miFrame({ sectionType: 'drop', downbeatHit: true, beatHit: true, dropConfidence: 1, transient: 1 }),
      audioTimeSec: 10,
      isPlaying: true,
      trackKey: 'track-a',
      transportPass: 0,
      manualOverrideActive: false,
      authoredCueActive: false,
    })
    expect(result.settings.fixtures[0].color).toEqual(settings.fixtures[0].color)
  })

})
