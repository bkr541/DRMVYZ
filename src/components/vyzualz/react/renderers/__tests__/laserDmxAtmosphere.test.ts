import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultLaserDmxSettings, type LaserDmxFixture, type LaserDmxSettings } from '../../ReactTypes'
import {
  diagnoseProductionRig,
  LASER_DMX_VIRTUAL_RENDERER_CAPABILITIES,
  normalizeLaserDmxSettings,
  normalizeProductionAtmosphericFixtureSettings,
  sanitizeLaserDmxSettingsForPersistence,
} from '../../LaserDmxProductionRig'
import {
  particleBudgetForQuality,
  pauseProductionAtmosphere,
  resetProductionAtmosphereRuntime,
  resumeProductionAtmosphere,
  stepProductionAtmosphere,
} from '../LaserDmxAtmosphereEngine'

function atmosphericFixture(kind: 'hazer' | 'fogger' | 'cryoJet', requestId = 0): LaserDmxFixture {
  const base = structuredClone(createDefaultLaserDmxSettings().fixtures[0])
  const profileId = kind === 'hazer' ? 'genericHazer' : kind === 'fogger' ? 'genericFogger' : 'genericCryoJet'
  const medium = kind === 'hazer' ? 'haze' : kind === 'fogger' ? 'fog' : 'cryo'
  return {
    ...base,
    id: `${kind}:test`,
    name: `${kind} test`,
    fixtureKind: kind,
    dmx: { ...base.dmx, profileId },
    atmospheric: normalizeProductionAtmosphericFixtureSettings(
      {
        triggerRequestId: requestId,
        seed: 42,
        outputDurationSec: kind === 'cryoJet' ? 0.8 : 2,
        cooldownSec: 3,
        density: 1,
      },
      medium,
    ),
  }
}

function settingsWith(...fixtures: LaserDmxFixture[]): LaserDmxSettings {
  return normalizeLaserDmxSettings({
    ...createDefaultLaserDmxSettings(),
    fixtures,
    selectedFixtureId: fixtures[0]?.id ?? null,
    atmosphere: {
      persistentHaze: {
        enabled: true,
        baseDensity: 0.5,
        heightDistribution: 0.6,
        turbulence: 0.2,
        diffusion: 0.7,
        driftSpeed: 0.1,
        driftDirectionDeg: 0,
        ventilation: 0.2,
        beamScatter: 0.8,
      },
      qualityTier: 'medium',
      maxParticleBudget: 180,
      retainBaseHazeOnClear: true,
    },
  })
}

describe('LaserDMX production atmosphere runtime', () => {
  beforeEach(() => resetProductionAtmosphereRuntime())

  it('keeps haze persistent while fog bursts have a finite lifecycle', () => {
    const fogger = atmosphericFixture('fogger', 1)
    const hazer = atmosphericFixture('hazer')
    const settings = settingsWith(hazer, fogger)
    const active = stepProductionAtmosphere({ settings, timeSec: 1, dt: 1 / 60 })
    expect(active.localHazeDensity).toBeGreaterThan(0)
    expect(active.bursts).toHaveLength(1)
    expect(active.particles.length).toBeGreaterThan(0)

    const expired = stepProductionAtmosphere({ settings, timeSec: 3.1, dt: 0.1 })
    expect(expired.bursts).toHaveLength(0)
    expect(expired.localHazeDensity).toBeGreaterThan(0)
  })

  it('enforces cooldown and ignore-while-active retrigger rules', () => {
    const fogger = atmosphericFixture('fogger', 1)
    let settings = settingsWith(fogger)
    const first = stepProductionAtmosphere({ settings, timeSec: 0, dt: 0 })
    expect(first.bursts).toHaveLength(1)

    settings = settingsWith({ ...fogger, atmospheric: { ...fogger.atmospheric!, triggerRequestId: 2 } })
    const ignoredActive = stepProductionAtmosphere({ settings, timeSec: 0.5, dt: 0.5 })
    expect(ignoredActive.bursts).toHaveLength(1)
    expect(ignoredActive.bursts[0].startedAtSec).toBe(0)

    settings = settingsWith({ ...fogger, atmospheric: { ...fogger.atmospheric!, triggerRequestId: 3 } })
    const ignoredCooldown = stepProductionAtmosphere({ settings, timeSec: 3, dt: 0.1 })
    expect(ignoredCooldown.bursts).toHaveLength(0)

    settings = settingsWith({ ...fogger, atmospheric: { ...fogger.atmospheric!, triggerRequestId: 4 } })
    const retriggered = stepProductionAtmosphere({ settings, timeSec: 5.1, dt: 0.1 })
    expect(retriggered.bursts).toHaveLength(1)
  })

  it('applies restart and extend retrigger policies to active bursts', () => {
    const fogger = atmosphericFixture('fogger', 1)
    let settings = settingsWith({
      ...fogger,
      atmospheric: { ...fogger.atmospheric!, retriggerPolicy: 'restart' },
    })
    stepProductionAtmosphere({ settings, timeSec: 0, dt: 0 })
    settings = settingsWith({
      ...fogger,
      atmospheric: { ...fogger.atmospheric!, retriggerPolicy: 'restart', triggerRequestId: 2 },
    })
    const restarted = stepProductionAtmosphere({ settings, timeSec: 0.5, dt: 0.5 })
    expect(restarted.bursts[0].startedAtSec).toBe(0.5)
    expect(restarted.bursts[0].endsAtSec).toBe(2.5)

    resetProductionAtmosphereRuntime()
    settings = settingsWith({
      ...fogger,
      atmospheric: { ...fogger.atmospheric!, retriggerPolicy: 'extend' },
    })
    stepProductionAtmosphere({ settings, timeSec: 0, dt: 0 })
    settings = settingsWith({
      ...fogger,
      atmospheric: { ...fogger.atmospheric!, retriggerPolicy: 'extend', triggerRequestId: 2 },
    })
    const extended = stepProductionAtmosphere({ settings, timeSec: 1.5, dt: 0.5 })
    expect(extended.bursts[0].startedAtSec).toBe(0)
    expect(extended.bursts[0].endsAtSec).toBe(3.5)
  })

  it('produces deterministic particles for equal seed, trigger, and time', () => {
    const settings = settingsWith(atmosphericFixture('cryoJet', 1))
    const first = stepProductionAtmosphere({ settings, timeSec: 0.4, dt: 0.4 })
    resetProductionAtmosphereRuntime()
    const second = stepProductionAtmosphere({ settings, timeSec: 0.4, dt: 0.4 })
    expect(second.particles).toEqual(first.particles)
  })

  it('clears active bursts immediately while retaining authored base haze', () => {
    const base = settingsWith(atmosphericFixture('fogger', 1))
    expect(stepProductionAtmosphere({ settings: base, timeSec: 0.2, dt: 0.2 }).bursts).toHaveLength(1)
    const cleared = stepProductionAtmosphere({
      settings: { ...base, runtime: { atmosphereClearRequestId: 1 } },
      timeSec: 0.21,
      dt: 0.01,
    })
    expect(cleared.bursts).toHaveLength(0)
    expect(cleared.settings.persistentHaze.enabled).toBe(true)
    expect(cleared.settings.persistentHaze.baseDensity).toBe(0.5)
  })

  it('removes stale bursts on seek and respects quality-tier budgets', () => {
    const fixtures = Array.from({ length: 8 }, (_, index) => ({
      ...atmosphericFixture('cryoJet', 1),
      id: `cryo:${index}`,
      atmospheric: { ...atmosphericFixture('cryoJet', 1).atmospheric!, seed: index + 1 },
    }))
    const low = normalizeLaserDmxSettings({
      ...settingsWith(...fixtures),
      atmosphere: { ...settingsWith(...fixtures).atmosphere!, qualityTier: 'low', maxParticleBudget: 1000 },
    })
    const frame = stepProductionAtmosphere({ settings: low, timeSec: 0.2, dt: 0.2 })
    expect(frame.particles.length).toBeLessThanOrEqual(particleBudgetForQuality('low'))
    expect(frame.droppedParticles).toBeGreaterThan(0)

    const seeked = stepProductionAtmosphere({ settings: low, timeSec: 20, dt: 0, seeked: true })
    expect(seeked.bursts).toHaveLength(0)
  })

  it('freezes deterministic plume age across pause and resume', () => {
    const settings = settingsWith(atmosphericFixture('fogger', 1))
    const beforePause = stepProductionAtmosphere({ settings, timeSec: 0.4, dt: 0.4 })
    pauseProductionAtmosphere(0.4)
    resumeProductionAtmosphere(2.4)
    const afterResume = stepProductionAtmosphere({ settings, timeSec: 2.4, dt: 0 })
    expect(afterResume.particles).toEqual(beforePause.particles)
  })

  it('consumes stale trigger requests after lifecycle resets and persistence', () => {
    const first = atmosphericFixture('cryoJet', 3)
    const settings = settingsWith(first)
    resetProductionAtmosphereRuntime({ consumeExistingRequests: true })
    expect(stepProductionAtmosphere({ settings, timeSec: 0, dt: 0 }).bursts).toHaveLength(0)

    const retriggered = settingsWith({
      ...first,
      atmospheric: { ...first.atmospheric!, triggerRequestId: 4 },
    })
    expect(stepProductionAtmosphere({ settings: retriggered, timeSec: 0.1, dt: 0.1 }).bursts).toHaveLength(1)
    expect(sanitizeLaserDmxSettingsForPersistence(retriggered).fixtures[0].atmospheric?.triggerRequestId).toBe(0)
  })

  it('can clear both active bursts and persistent haze', () => {
    const base = normalizeLaserDmxSettings({
      ...settingsWith(atmosphericFixture('hazer'), atmosphericFixture('fogger', 1)),
      atmosphere: { ...settingsWith().atmosphere!, retainBaseHazeOnClear: false },
    })
    expect(stepProductionAtmosphere({ settings: base, timeSec: 0.2, dt: 0.2 }).bursts).toHaveLength(1)
    const cleared = stepProductionAtmosphere({
      settings: { ...base, runtime: { atmosphereClearRequestId: 1 } },
      timeSec: 0.21,
      dt: 0.01,
    })
    expect(cleared.bursts).toHaveLength(0)
    expect(cleared.settings.persistentHaze.enabled).toBe(false)
    expect(cleared.localHazeDensity).toBe(0)
  })

  it('uses the lower atmosphere or stage quality tier and honors output level', () => {
    const jet = atmosphericFixture('cryoJet', 1)
    const settings = normalizeLaserDmxSettings({
      ...settingsWith({ ...jet, atmospheric: { ...jet.atmospheric!, outputLevel: 0 } }),
      atmosphere: { ...settingsWith().atmosphere!, qualityTier: 'high', maxParticleBudget: 1000 },
      productionStage: {
        ...settingsWith().productionStage,
        editor: { ...settingsWith().productionStage?.editor, qualityTier: 'low' },
      },
    })
    const frame = stepProductionAtmosphere({ settings, timeSec: 0.2, dt: 0.2 })
    expect(frame.settings.qualityTier).toBe('low')
    expect(frame.budget).toBe(particleBudgetForQuality('low'))
    expect(frame.particles).toHaveLength(0)
  })

  it('diagnoses excessive budgets and cooldown conflicts', () => {
    const fogger = atmosphericFixture('fogger', 0)
    const settings = {
      ...settingsWith({ ...fogger, atmospheric: { ...fogger.atmospheric!, cooldownSec: 0.1 } }),
      atmosphere: { ...settingsWith(fogger).atmosphere!, maxParticleBudget: 900 },
    }
    const codes = diagnoseProductionRig(settings).map((item) => item.code)
    expect(codes).toContain('excessiveParticleBudget')
    expect(codes).toContain('cooldownConflict')

    const unsupportedCodes = diagnoseProductionRig(settings, {
      ...LASER_DMX_VIRTUAL_RENDERER_CAPABILITIES,
      supportsAtmospherics: false,
    }).map((item) => item.code)
    expect(unsupportedCodes).toContain('unsupportedRendererCapability')
  })
})
