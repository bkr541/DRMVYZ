import { describe, expect, it } from 'vitest'
import {
  ALL_PRODUCTION_FIXTURE_KINDS,
  LASER_DMX_BEAM_MATRIX_SCHEMA_VERSION,
  LASER_DMX_FIXTURE_PROFILES,
  LASER_DMX_FIXTURE_SCHEMA_VERSION,
  LASER_DMX_OUTPUT_ADAPTER_CAPABILITIES,
  LASER_DMX_VIRTUAL_RENDERER_CAPABILITIES,
  PRODUCTION_FIXTURE_KIND_CAPABILITIES,
  LASER_DMX_SETTINGS_SCHEMA_VERSION,
  buildProductionRig,
  compileProfileChannels,
  deserializeLaserDmxSettings,
  getLaserDmxFixtureProfile,
  normalizeLaserDmxSettings,
  normalizeLegacyLaserDmxFixture,
  sanitizeLaserDmxSettingsForPersistence,
  serializeLaserDmxSettings,
  validateFixtureCapabilities,
  validateFixtureProfile,
} from '../../LaserDmxProductionRig'
import {
  DEFAULT_REACT_PRESETS,
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxSettings,
} from '../../ReactTypes'
import { migrateReactStore, reactStorePartialize, useReactStore } from '../../../../../stores/reactStore'

describe('LaserDMX production-rig foundation', () => {
  it('declares every production fixture kind while keeping hardware output disabled', () => {
    expect(ALL_PRODUCTION_FIXTURE_KINDS).toEqual([
      'laserProjector',
      'movingHeadBeam',
      'movingHeadSpot',
      'movingHeadWash',
      'staticWash',
      'strobe',
      'blinder',
      'ledBar',
      'hazer',
      'fogger',
      'cryoJet',
    ])
    expect(Object.keys(PRODUCTION_FIXTURE_KIND_CAPABILITIES)).toEqual(ALL_PRODUCTION_FIXTURE_KINDS)
    for (const capabilities of Object.values(PRODUCTION_FIXTURE_KIND_CAPABILITIES)) {
      expect(validateFixtureCapabilities(capabilities)).toEqual([])
    }
    expect(LASER_DMX_OUTPUT_ADAPTER_CAPABILITIES.canTransmit).toBe(false)
    expect(LASER_DMX_OUTPUT_ADAPTER_CAPABILITIES.transports).toEqual(['none'])
    expect(LASER_DMX_OUTPUT_ADAPTER_CAPABILITIES.fixtureKinds).toEqual(['laserProjector', 'movingHeadBeam', 'movingHeadSpot', 'movingHeadWash', 'staticWash', 'strobe', 'blinder', 'ledBar', 'hazer', 'fogger', 'cryoJet'])
    expect(LASER_DMX_VIRTUAL_RENDERER_CAPABILITIES.fixtureKinds).toEqual(['laserProjector', 'movingHeadBeam', 'movingHeadSpot', 'movingHeadWash', 'staticWash', 'strobe', 'blinder', 'ledBar', 'hazer', 'fogger', 'cryoJet'])
    expect(LASER_DMX_VIRTUAL_RENDERER_CAPABILITIES.supportsCompoundCues).toBe(false)
  })

  it('validates capability contracts and all built-in fixture profiles', () => {
    for (const profile of Object.values(LASER_DMX_FIXTURE_PROFILES)) {
      expect(validateFixtureProfile(profile)).toEqual([])
    }

    const issues = validateFixtureCapabilities({
      color: { mode: 'colorWheel', slots: [] },
      zoom: { min: 1, max: 0 },
      trigger: { momentary: true, cooldownMs: -1 },
    })
    expect(issues.map(issue => issue.path)).toEqual(expect.arrayContaining([
      'capabilities.color.slots',
      'capabilities.zoom',
      'capabilities.trigger.cooldownMs',
    ]))
  })

  it('declares only the optics supported by each virtual moving-head profile', () => {
    const beam = getLaserDmxFixtureProfile('genericMovingHeadBeam')!
    const spot = getLaserDmxFixtureProfile('genericMovingHeadSpot')!
    const wash = getLaserDmxFixtureProfile('genericMovingHeadWash')!

    expect(beam.capabilities).toMatchObject({ panTilt: expect.any(Object), gobo: expect.any(Object), prism: expect.any(Object), iris: expect.any(Object) })
    expect(spot.capabilities).toMatchObject({ panTilt: expect.any(Object), gobo: expect.any(Object), prism: expect.any(Object), focus: expect.any(Object) })
    expect(wash.capabilities).toMatchObject({ color: { mode: 'rgbw' }, panTilt: expect.any(Object), zoom: expect.any(Object), frost: expect.any(Object) })
    expect(wash.capabilities.gobo).toBeUndefined()
    expect(wash.capabilities.prism).toBeUndefined()
    expect(wash.capabilities.iris).toBeUndefined()
    expect(wash.capabilities.focus).toBeUndefined()
  })

  it('preserves the legacy RGB, RGBW, scanner, and multi-pattern channel layouts', () => {
    const values = {
      dimmer: 1,
      shutter: 2,
      strobe: 3,
      red: 4,
      green: 5,
      blue: 6,
      white: 7,
      pan: 8,
      tilt: 9,
      zoom: 10,
      rotation: 11,
      scanSpeed: 12,
      pathComplexity: 13,
      zero: 0,
    }

    expect(compileProfileChannels('genericRgbLaser', values)).toEqual({
      ch1: 1, ch2: 2, ch3: 3, ch4: 4, ch5: 5, ch6: 6,
      ch7: 8, ch8: 9, ch9: 10, ch10: 0, ch11: 12,
    })
    expect(compileProfileChannels('genericRgbwLaser', values)).toEqual({
      ch1: 1, ch2: 2, ch3: 3, ch4: 4, ch5: 5, ch6: 6,
      ch7: 8, ch8: 9, ch9: 10, ch10: 0, ch11: 12, ch12: 7,
    })
    expect(compileProfileChannels('scannerLaser', values)).toEqual({
      ch1: 1, ch2: 2, ch3: 3, ch4: 4, ch5: 5, ch6: 6,
      ch7: 8, ch8: 9, ch9: 11, ch10: 0, ch11: 12, ch12: 10,
    })
    expect(compileProfileChannels('multiPatternLaser', values)).toEqual({
      ch1: 1, ch2: 2, ch3: 3, ch4: 4, ch5: 5, ch6: 6, ch7: 7,
      ch8: 8, ch9: 9, ch10: 11, ch11: 0, ch12: 12, ch13: 10, ch14: 13,
    })
  })

  it('normalizes a legacy Spatial Fixture without discarding unknown fields', () => {
    const legacy = {
      id: 'legacy-laser',
      name: 'Legacy RGBW',
      enabled: true,
      dmx: { universe: 2, startAddress: 42, profileId: 'genericRgbwLaser', channelMode: 'extended' },
      position: { originX: 0.1, originY: 0.9, targetX: 0.5, targetY: 0.3 },
      color: { red: 1, green: 2, blue: 3, white: 4 },
      beam: { dimmer: 0.75 },
      path: { kind: 'fan' },
      modulationRoutes: [],
      vendorExtension: { calibration: 'keep-me' },
    }

    const fixture = normalizeLegacyLaserDmxFixture(legacy)
    expect(fixture.schemaVersion).toBe(LASER_DMX_FIXTURE_SCHEMA_VERSION)
    expect(fixture.fixtureKind).toBe('laserProjector')
    expect(fixture.dmx.profileId).toBe('genericRgbwLaser')
    expect(fixture.position.originZ).toBe(0)
    expect((fixture as unknown as Record<string, unknown>).vendorExtension).toEqual({ calibration: 'keep-me' })
    expect(fixture.compatibility?.validationErrors).toBeUndefined()
    const rigFixture = buildProductionRig({ ...createDefaultLaserDmxSettings(), fixtures: [fixture] }).fixtures[0]
    expect(rigFixture.properties.color).toEqual({ red: 1, green: 2, blue: 3, white: 4 })
  })

  it('marks invalid profiles and rejects them from an enabled production rig', () => {
    expect(getLaserDmxFixtureProfile('not-a-real-profile')).toBeNull()
    const settings = normalizeLaserDmxSettings({
      ...createDefaultLaserDmxSettings(),
      fixtures: [{
        ...createDefaultLaserDmxSettings().fixtures[0],
        dmx: {
          ...createDefaultLaserDmxSettings().fixtures[0].dmx,
          profileId: 'not-a-real-profile',
        },
      }],
    })

    expect(settings.fixtures[0].compatibility?.validationErrors?.[0]).toContain('Unknown fixture profile')
    const rig = buildProductionRig(settings)
    expect(rig.fixtures[0].enabled).toBe(false)
    expect(rig.fixtures[0].profileId).toBe('not-a-real-profile')
  })

  it('clears stale compatibility errors after a profile is repaired', () => {
    const defaults = createDefaultLaserDmxSettings()
    const invalid = normalizeLegacyLaserDmxFixture({
      ...defaults.fixtures[0],
      dmx: { ...defaults.fixtures[0].dmx, profileId: 'missing-profile' },
    })
    expect(invalid.compatibility?.validationErrors).toBeDefined()

    const repaired = normalizeLegacyLaserDmxFixture({
      ...invalid,
      dmx: { ...invalid.dmx, profileId: 'genericRgbLaser' },
    })
    expect(repaired.compatibility?.validationErrors).toBeUndefined()
    expect(buildProductionRig({ ...defaults, fixtures: [repaired] }).fixtures[0].enabled).toBe(true)
  })

  it('migrates persisted LaserDMX state to versioned schemas', () => {
    const defaults = createDefaultLaserDmxSettings()
    const legacyFixture = {
      ...defaults.fixtures[0],
      schemaVersion: undefined,
      fixtureKind: undefined,
      legacyManufacturerField: 'preserved',
    }
    const migrated = migrateReactStore({
      laserDmxSettings: {
        ...defaults,
        schemaVersion: undefined,
        fixtures: [legacyFixture],
        legacyRigField: 123,
      },
      laserDmxBeamMatrix: {
        ...createDefaultLaserDmxBeamMatrixSettings(),
        schemaVersion: undefined,
      },
    }, 28)

    const spatial = migrated.laserDmxSettings as ReturnType<typeof createDefaultLaserDmxSettings>
    const matrix = migrated.laserDmxBeamMatrix as ReturnType<typeof createDefaultLaserDmxBeamMatrixSettings>
    expect(spatial.schemaVersion).toBe(LASER_DMX_SETTINGS_SCHEMA_VERSION)
    expect(spatial.fixtures[0].schemaVersion).toBe(LASER_DMX_FIXTURE_SCHEMA_VERSION)
    expect((spatial as unknown as Record<string, unknown>).legacyRigField).toBe(123)
    expect((spatial.fixtures[0] as unknown as Record<string, unknown>).legacyManufacturerField).toBe('preserved')
    expect(matrix.schemaVersion).toBe(LASER_DMX_BEAM_MATRIX_SCHEMA_VERSION)
  })

  it('keeps every existing LaserDMX preset compatible with the production profile registry', () => {
    const laserPresets = DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'laserDmx')
    expect(laserPresets.length).toBeGreaterThan(0)

    for (const preset of laserPresets) {
      const normalized = normalizeLaserDmxSettings({
        ...createDefaultLaserDmxSettings(),
        ...preset.laserDmxSettings,
      })
      expect(normalized.fixtures.length, preset.id).toBeGreaterThan(0)
      expect(normalized.fixtures.some(fixture => fixture.id === normalized.selectedFixtureId), preset.id).toBe(true)
      for (const fixture of normalized.fixtures) {
        expect(getLaserDmxFixtureProfile(fixture.dmx.profileId), `${preset.id}:${fixture.id}`).not.toBeNull()
        expect(fixture.compatibility?.validationErrors, `${preset.id}:${fixture.id}`).toBeUndefined()
      }
    }
  })

  it('serializes deterministically, round-trips authored data, and strips transient output state', () => {
    const defaults = createDefaultLaserDmxSettings()
    const a = {
      ...defaults,
      customAuthoredField: { z: 2, a: 1 },
      runtime: { frame: 99 },
      outputFrame: { fixtureCount: 3 },
    }
    const b = {
      outputFrame: { fixtureCount: 3 },
      runtime: { frame: 99 },
      customAuthoredField: { a: 1, z: 2 },
      ...defaults,
    }

    const serializedA = serializeLaserDmxSettings(a)
    const serializedB = serializeLaserDmxSettings(b)
    expect(serializedA).toBe(serializedB)

    const restored = deserializeLaserDmxSettings(serializedA)
    expect(restored.schemaVersion).toBe(LASER_DMX_SETTINGS_SCHEMA_VERSION)
    expect((restored as unknown as Record<string, unknown>).customAuthoredField).toEqual({ a: 1, z: 2 })
    expect((restored as unknown as Record<string, unknown>).runtime).toBeUndefined()
    expect((restored as unknown as Record<string, unknown>).outputFrame).toBeUndefined()
  })

  it('round-trips non-laser fixture controls, visual comfort, and group chase state', () => {
    const defaults = createDefaultLaserDmxSettings()
    const base = defaults.fixtures[0]
    const strobe = normalizeLegacyLaserDmxFixture({
      ...base,
      id: 'persisted-strobe',
      dmx: { ...base.dmx, profileId: 'genericRgbwStrobe' },
      flashPattern: {
        enabled: true,
        pattern: 'tripleHit',
        triggerTimeSec: 2.5,
        durationBeats: 2,
        rateHz: 9,
        dutyCycle: 0.25,
        intensity: 0.9,
        envelope: { attack: 0.1, hold: 0.6, release: 0.3, curve: 'easeInOut' },
        repeat: { mode: 'count', count: 3, intervalBeats: 4 },
        quantize: 'bar',
        retriggerPolicy: 'queueNextQuantized',
        whiteAccent: true,
        seed: 91,
      },
      colorPolicy: { whiteAccentPolicy: 'impactOnly', whiteAccentIntensity: 0.85, preserveFixedColor: true },
    })
    const wash = normalizeLegacyLaserDmxFixture({
      ...base,
      id: 'persisted-wash',
      dmx: { ...base.dmx, profileId: 'genericStaticWash' },
      wash: { spread: 0.82, softness: 0.66, atmosphericIntensity: 0.74 },
    })
    const led = normalizeLegacyLaserDmxFixture({
      ...base,
      id: 'persisted-led',
      dmx: { ...base.dmx, profileId: 'genericLedBar' },
      ledBar: {
        mode: 'segments',
        segmentCount: 20,
        pattern: 'alternating',
        secondaryColor: { red: 10, green: 20, blue: 30, white: 0 },
        chase: { enabled: true, order: 'outsideIn', stepBeats: 0.25, width: 3, seed: 14 },
      },
    })
    const authored = normalizeLaserDmxSettings({
      ...defaults,
      visualComfort: { disableStrobe: true, maxFlashHz: 9, warningThresholdHz: 6, maxContinuousFlashSec: 3 },
      fixtures: [strobe, wash, led],
      productionGroups: [{
        id: 'group:non-laser',
        name: 'Non-laser fixtures',
        fixtureIds: [strobe.id, wash.id, led.id],
        chase: { enabled: true, order: 'centerOut', stepBeats: 0.5, width: 2, seed: 22 },
      }],
    })

    const restored = deserializeLaserDmxSettings(serializeLaserDmxSettings(authored))
    expect(restored.visualComfort).toEqual(authored.visualComfort)
    expect(restored.fixtures.find(fixture => fixture.id === strobe.id)?.flashPattern).toEqual(strobe.flashPattern)
    expect(restored.fixtures.find(fixture => fixture.id === wash.id)?.wash).toEqual(wash.wash)
    expect(restored.fixtures.find(fixture => fixture.id === led.id)?.ledBar).toEqual(led.ledBar)
    expect(restored.productionGroups?.[0]?.chase).toEqual(authored.productionGroups?.[0]?.chase)
  })

  it('keeps transient render/output state outside the Zustand persistence boundary', () => {
    const current = useReactStore.getState()
    const laserDmxSettings = {
      ...current.laserDmxSettings,
      runtime: { envelopeCount: 4 },
      diagnostics: { lastFrameMs: 16 },
    }
    const persisted = reactStorePartialize({
      ...current,
      laserDmxSettings,
    } as typeof current)
    const sanitized = sanitizeLaserDmxSettingsForPersistence(persisted.laserDmxSettings)
    expect((sanitized as unknown as Record<string, unknown>).runtime).toBeUndefined()
    expect((sanitized as unknown as Record<string, unknown>).diagnostics).toBeUndefined()
  })
})
