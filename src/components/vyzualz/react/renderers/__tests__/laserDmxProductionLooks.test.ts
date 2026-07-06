import { beforeEach, describe, expect, it } from 'vitest'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import {
  DEFAULT_PRODUCTION_LOOK_TRANSITION,
  normalizeLaserDmxSettings,
  normalizeLegacyLaserDmxFixture,
  sanitizeLaserDmxSettingsForPersistence,
  type ProductionLook,
} from '../../LaserDmxProductionRig'
import {
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_REACT_PRESETS,
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxSettings,
  type LaserDmxFixture,
} from '../../ReactTypes'
import {
  applyProductionLook,
  beginProductionLookTransition,
  captureProductionLook,
  ensureProductionLookCompatibility,
  interpolateProductionLookSettings,
} from '../LaserDmxProductionLookEngine'
import { compileLaserDmxFrame, resetLaserDmxCompilerState } from '../LaserDmxCompiler'
import { buildPresetPatch, mergeReactStoreState, migrateReactStore, useReactStore } from '../../../../../stores/reactStore'

const MI = { rhythm: { bpm: 120 } } as MusicIntelligenceFrame

function partialLook(overrides: Partial<ProductionLook> = {}): ProductionLook {
  return {
    id: 'look:partial',
    name: 'Partial Look',
    omissionMode: 'preserve',
    scope: {
      fixtureIds: [],
      fixtureKinds: [],
      groupIds: [],
      includeGlobal: false,
      includeAtmosphere: false,
      includeStage: false,
    },
    fixtureStates: [],
    groupStates: [],
    transition: { ...DEFAULT_PRODUCTION_LOOK_TRANSITION, fixtureFamilyDurationsMs: {} },
    ...overrides,
  }
}

function movingFixture(id = 'moving'): LaserDmxFixture {
  const base = structuredClone(createDefaultLaserDmxSettings().fixtures[0])
  return normalizeLegacyLaserDmxFixture({
    ...base,
    id,
    name: 'Moving Beam',
    dmx: { ...base.dmx, profileId: 'genericMovingHeadBeam' },
    position: { ...base.position, pan: 0, tilt: -20 },
    movingHead: {
      panDeg: 0,
      tiltDeg: -20,
      panSpeedDegPerSec: 180,
      tiltSpeedDegPerSec: 180,
      easing: 'linear',
      snap: false,
      prePositionWhileShuttered: true,
      colorWheelSlot: 0,
      goboIndex: 0,
      goboRotation: 0,
      prismFacets: 0,
      prismRotation: 0,
      iris: 1,
      frost: 0,
    },
    modulationRoutes: [],
  })
}

beforeEach(() => resetLaserDmxCompilerState())

describe('LaserDMX production Looks', () => {
  it('captures no fixture state when a partial Look explicitly selects no fixture systems', () => {
    const settings = normalizeLaserDmxSettings(createDefaultLaserDmxSettings())
    const look = captureProductionLook(settings, {
      scope: {
        fixtureIds: [],
        fixtureKinds: [],
        groupIds: [],
        includeGlobal: true,
        includeAtmosphere: false,
        includeStage: false,
      },
    })
    expect(look.fixtureStates).toEqual([])
    expect(look.global?.masterDimmer).toBe(settings.masterDimmer)
  })

  it('merges partial Looks while preserving omitted fixtures and global state', () => {
    const settings = normalizeLaserDmxSettings(createDefaultLaserDmxSettings())
    const first = settings.fixtures[0]
    const second = settings.fixtures[1]
    const look = partialLook({
      scope: {
        fixtureIds: [first.id],
        fixtureKinds: [],
        groupIds: [],
        includeGlobal: false,
        includeAtmosphere: false,
        includeStage: false,
      },
      fixtureStates: [{ fixtureId: first.id, properties: { dimmer: 0.2 } }],
    })

    const result = applyProductionLook(settings, look).settings
    expect(result.fixtures.find(fixture => fixture.id === first.id)?.beam.dimmer).toBe(0.2)
    expect(result.fixtures.find(fixture => fixture.id === second.id)).toEqual(second)
    expect(result.masterDimmer).toBe(settings.masterDimmer)
  })

  it('uses explicit resetIncluded semantics without resetting fixtures outside the scope', () => {
    const settings = normalizeLaserDmxSettings(createDefaultLaserDmxSettings())
    settings.fixtures[0].beam.strobeRate = 0.8
    settings.fixtures[1].beam.strobeRate = 0.6
    const look = partialLook({
      omissionMode: 'resetIncluded',
      scope: {
        fixtureIds: [settings.fixtures[0].id],
        fixtureKinds: [],
        groupIds: [],
        includeGlobal: false,
        includeAtmosphere: false,
        includeStage: false,
      },
      fixtureStates: [{ fixtureId: settings.fixtures[0].id, properties: { dimmer: 0.4 } }],
    })

    const result = applyProductionLook(settings, look).settings
    expect(result.fixtures[0].beam).toMatchObject({ dimmer: 0.4, strobeRate: 0 })
    expect(result.fixtures[1].beam.strobeRate).toBe(0.6)
  })

  it('resets volatile fixture-family state to neutral without replaying effect commands', () => {
    const moving = movingFixture('moving-reset')
    moving.enabled = false
    moving.color = { ...moving.color, mode: 'music', paletteId: 'brand:active', colorCycleSpeed: 2 }
    moving.movingHead = {
      ...moving.movingHead!,
      panDeg: 135,
      tiltDeg: 28,
      goboIndex: 4,
      prismFacets: 3,
      targetTracking: false,
    }
    const base = createDefaultLaserDmxSettings().fixtures[0]
    const fogger = normalizeLegacyLaserDmxFixture({
      ...base,
      id: 'fog-reset',
      dmx: { ...base.dmx, profileId: 'genericFogger' },
      atmospheric: {
        armed: true,
        outputLevel: 0.9,
        outputDurationSec: 2,
        plumeVelocity: 4,
        spread: 0.5,
        density: 0.8,
        turbulence: 0.4,
        driftSpeed: 0.2,
        driftDirectionDeg: 20,
        dissipation: 0.3,
        retriggerPolicy: 'restart',
        warmupSec: 0,
        cooldownSec: 1,
        height: 3,
        seed: 2,
        triggerRequestId: 23,
        orientationMode: 'fixtureOrientation',
      },
      modulationRoutes: [],
    })
    const settings = normalizeLaserDmxSettings({
      ...createDefaultLaserDmxSettings(),
      fixtures: [moving, fogger],
    })
    const look = partialLook({
      omissionMode: 'resetIncluded',
      scope: {
        fixtureIds: [moving.id, fogger.id],
        fixtureKinds: [],
        groupIds: [],
        includeGlobal: false,
        includeAtmosphere: false,
        includeStage: false,
      },
    })

    const result = applyProductionLook(settings, look).settings
    expect(result.fixtures[0]).toMatchObject({
      enabled: true,
      color: { mode: 'fixed', paletteId: '', colorCycleSpeed: 0 },
      movingHead: { panDeg: 0, tiltDeg: -35, goboIndex: 0, prismFacets: 0, targetTracking: true },
    })
    expect(result.fixtures[1].atmospheric).toMatchObject({
      armed: false,
      outputLevel: 0,
      triggerRequestId: 23,
    })
  })

  it('interpolates numeric values and switches unsupported discrete values at switchPoint', () => {
    const from = normalizeLaserDmxSettings(createDefaultLaserDmxSettings())
    const target = structuredClone(from)
    from.fixtures[0].beam.dimmer = 0
    from.fixtures[0].path.kind = 'fan'
    target.fixtures[0].beam.dimmer = 1
    target.fixtures[0].path.kind = 'circle'
    const transition = {
      ...DEFAULT_PRODUCTION_LOOK_TRANSITION,
      mode: 'linearFade' as const,
      durationMs: 1000,
      switchPoint: 0.6,
    }

    const early = interpolateProductionLookSettings(from, target, transition, 250)
    const late = interpolateProductionLookSettings(from, target, transition, 750)
    expect(early.fixtures[0].beam.dimmer).toBeCloseTo(0.25)
    expect(early.fixtures[0].path.kind).toBe('fan')
    expect(late.fixtures[0].path.kind).toBe('circle')
  })

  it('limits color-only transitions to color and palette state', () => {
    const from = normalizeLaserDmxSettings(createDefaultLaserDmxSettings())
    const target = structuredClone(from)
    target.fixtures[0].color = { ...target.fixtures[0].color, red: 255, mode: 'music', paletteId: 'brand:active' }
    target.fixtures[0].beam.dimmer = 0.1
    target.fixtures[0].path.kind = 'circle'
    target.masterDimmer = 0.2
    target.glowAmount = 0.1
    const halfway = interpolateProductionLookSettings(from, target, {
      ...DEFAULT_PRODUCTION_LOOK_TRANSITION,
      mode: 'colorOnly',
      durationMs: 1000,
    }, 500)
    expect(halfway.fixtures[0].color.red).toBeGreaterThan(from.fixtures[0].color.red)
    expect(halfway.fixtures[0].beam).toEqual(from.fixtures[0].beam)
    expect(halfway.fixtures[0].path).toEqual(from.fixtures[0].path)
    expect(halfway.masterDimmer).toBe(from.masterDimmer)
    expect(halfway.glowAmount).toBe(from.glowAmount)
  })

  it('limits movement-only transitions to movement, path, groups, and camera state', () => {
    const fixture = movingFixture()
    const from = normalizeLaserDmxSettings({ ...createDefaultLaserDmxSettings(), fixtures: [fixture] })
    const target = structuredClone(from)
    target.fixtures[0].movingHead = { ...target.fixtures[0].movingHead!, panDeg: 120 }
    target.fixtures[0].position = { ...target.fixtures[0].position, pan: 120 }
    target.fixtures[0].path.kind = 'circle'
    target.fixtures[0].color.red = 255
    target.fixtures[0].beam.dimmer = 0.2
    target.masterDimmer = 0.3
    const halfway = interpolateProductionLookSettings(from, target, {
      ...DEFAULT_PRODUCTION_LOOK_TRANSITION,
      mode: 'movementOnly',
      durationMs: 1000,
      switchPoint: 0.4,
    }, 500)
    expect(halfway.fixtures[0].movingHead?.panDeg).toBeCloseTo(60)
    expect(halfway.fixtures[0].path.kind).toBe('circle')
    expect(halfway.fixtures[0].color).toEqual(from.fixtures[0].color)
    expect(halfway.fixtures[0].beam).toEqual(from.fixtures[0].beam)
    expect(halfway.masterDimmer).toBe(from.masterDimmer)
  })

  it('honors fixture-family-specific transition durations', () => {
    const fixture = movingFixture()
    const from = normalizeLaserDmxSettings({ ...createDefaultLaserDmxSettings(), fixtures: [fixture] })
    const target = structuredClone(from)
    target.fixtures[0].beam.dimmer = 0
    const half = interpolateProductionLookSettings(from, target, {
      ...DEFAULT_PRODUCTION_LOOK_TRANSITION,
      mode: 'linearFade',
      durationMs: 1000,
      fixtureFamilyDurationsMs: { movingHeadBeam: 2000 },
    }, 1000)
    expect(half.fixtures[0].beam.dimmer).toBeCloseTo(0.5)
  })

  it('pre-positions moving heads behind a shutter before the reveal point', () => {
    const fixture = movingFixture()
    const settings = normalizeLaserDmxSettings({ ...createDefaultLaserDmxSettings(), fixtures: [fixture] })
    const look = partialLook({
      scope: {
        fixtureIds: [fixture.id],
        fixtureKinds: [],
        groupIds: [],
        includeGlobal: false,
        includeAtmosphere: false,
        includeStage: false,
      },
      fixtureStates: [{ fixtureId: fixture.id, properties: { panDeg: 120, shutterOpen: true } }],
      transition: {
        ...DEFAULT_PRODUCTION_LOOK_TRANSITION,
        mode: 'shutteredPrePosition',
        durationMs: 1000,
        switchPoint: 0.8,
      },
    })
    const begun = beginProductionLookTransition(settings, look, undefined, 100)
    const runtime = begun.settings.runtime?.lookTransition as {
      from: typeof settings
      target: typeof settings
    }
    const during = interpolateProductionLookSettings(
      runtime.from,
      runtime.target,
      look.transition,
      500,
    )
    expect(during.fixtures[0].movingHead?.panDeg).toBeGreaterThan(0)
    expect(during.fixtures[0].beam.shutterOpen).toBe(false)
  })

  it('reports unsupported fixture properties rather than inventing controls', () => {
    const settings = normalizeLaserDmxSettings(createDefaultLaserDmxSettings())
    const fixture = settings.fixtures[0]
    const result = applyProductionLook(settings, partialLook({
      scope: {
        fixtureIds: [fixture.id],
        fixtureKinds: [],
        groupIds: [],
        includeGlobal: false,
        includeAtmosphere: false,
        includeStage: false,
      },
      fixtureStates: [{ fixtureId: fixture.id, properties: { goboIndex: 3 } }],
    }))
    expect(result.diagnostics.some(diagnostic => diagnostic.property === 'goboIndex')).toBe(true)
    expect(result.settings.fixtures[0].movingHead).toBeUndefined()
  })

  it('stores effect arming without replaying a fog or cryo trigger counter', () => {
    const base = createDefaultLaserDmxSettings().fixtures[0]
    const fogger = normalizeLegacyLaserDmxFixture({
      ...base,
      id: 'fogger',
      dmx: { ...base.dmx, profileId: 'genericFogger' },
      atmospheric: {
        armed: false,
        outputLevel: 0.8,
        outputDurationSec: 2,
        plumeVelocity: 4,
        spread: 0.5,
        density: 0.8,
        turbulence: 0.4,
        driftSpeed: 0.2,
        driftDirectionDeg: 20,
        dissipation: 0.3,
        retriggerPolicy: 'restart',
        warmupSec: 0,
        cooldownSec: 1,
        height: 3,
        seed: 2,
        triggerRequestId: 17,
        orientationMode: 'fixtureOrientation',
      },
      modulationRoutes: [],
    })
    const settings = normalizeLaserDmxSettings({ ...createDefaultLaserDmxSettings(), fixtures: [fogger] })
    const captured = captureProductionLook(settings)
    expect(captured.fixtureStates[0].atmospheric?.triggerRequestId).toBe(0)
    const armedLook = structuredClone(captured)
    armedLook.fixtureStates[0].armed = true
    armedLook.fixtureStates[0].atmospheric!.armed = true
    const applied = applyProductionLook(settings, armedLook).settings.fixtures[0].atmospheric
    expect(applied).toMatchObject({ armed: true, triggerRequestId: 17 })
  })

  it('applies global blackout to both LaserDMX workspaces and cancels an active Look transition', () => {
    const settings = ensureProductionLookCompatibility(createDefaultLaserDmxSettings())
    const look = settings.productionLooks![0]
    const transitioning = beginProductionLookTransition(settings, look, { durationMs: 5000 }, 100).settings
    useReactStore.setState({
      laserDmxSettings: transitioning,
      laserDmxBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    })

    useReactStore.getState().setLaserDmxBlackout(true)
    const blackedOut = useReactStore.getState()
    expect(blackedOut.laserDmxSettings.blackout).toBe(true)
    expect(blackedOut.laserDmxBeamMatrix.output.blackout).toBe(true)
    expect(blackedOut.laserDmxSettings.runtime?.lookTransition).toBeUndefined()

    useReactStore.getState().setLaserDmxBlackout(false)
    const revealed = useReactStore.getState()
    expect(revealed.laserDmxSettings.blackout).toBe(false)
    expect(revealed.laserDmxBeamMatrix.output.blackout).toBe(false)
  })

  it('masks visible output during blackout while preserving motion channels and authored state', () => {
    const fixture = movingFixture()
    fixture.beam.dimmer = 0.73
    fixture.movingHead = { ...fixture.movingHead!, panDeg: 90 }
    const blackedOut = normalizeLaserDmxSettings({
      ...createDefaultLaserDmxSettings(),
      fixtures: [fixture],
      blackout: true,
    })
    const masked = compileLaserDmxFrame({
      settings: blackedOut,
      mi: MI,
      time: 1,
      timeSec: 0.1,
      canvasWidth: 1280,
      canvasHeight: 720,
    })
    expect(masked.global.blackout).toBe(true)
    expect(masked.fixtures[0].visual.intensity).toBe(0)
    expect(masked.fixtures[0].channels.ch3).toBe(0)
    expect(masked.fixtures[0].channels.ch1).toBeGreaterThan(0)
    expect(blackedOut.fixtures[0].beam.dimmer).toBe(0.73)

    resetLaserDmxCompilerState()
    const revealed = compileLaserDmxFrame({
      settings: { ...blackedOut, blackout: false },
      mi: MI,
      time: 2,
      timeSec: 0.2,
      canvasWidth: 1280,
      canvasHeight: 720,
    })
    expect(revealed.global.blackout).toBe(false)
    expect(revealed.fixtures[0].visual.intensity).toBeGreaterThan(0)
  })

  it('persists Looks while stripping transient transition runtime', () => {
    const settings = ensureProductionLookCompatibility(createDefaultLaserDmxSettings())
    const look = settings.productionLooks![0]
    const withRuntime = beginProductionLookTransition(settings, look, undefined, 10).settings
    const persisted = sanitizeLaserDmxSettingsForPersistence(withRuntime)
    expect(persisted.productionLooks).toHaveLength(1)
    expect(persisted.productionLooks?.[0].fixtureStates.length).toBeGreaterThan(0)
    expect(persisted.runtime).toBeUndefined()
  })

  it('preserves an intentionally empty current-version Look library during persistence merge', () => {
    const persisted = normalizeLaserDmxSettings({
      ...createDefaultLaserDmxSettings(),
      productionLooks: [],
      activeProductionLookId: null,
    })
    const merged = mergeReactStoreState({ laserDmxSettings: persisted }, useReactStore.getState())
    expect(merged.laserDmxSettings.productionLooks).toEqual([])
    expect(merged.laserDmxSettings.activeProductionLookId).toBeNull()
  })

  it('migrates existing Spatial Fixtures into a default compatibility Look', () => {
    const migrated = migrateReactStore({ laserDmxSettings: createDefaultLaserDmxSettings() }, 32)
    const settings = migrated.laserDmxSettings as ReturnType<typeof createDefaultLaserDmxSettings>
    expect(settings.productionLooks).toHaveLength(1)
    expect(settings.productionLooks?.[0]).toMatchObject({ source: 'migration', name: 'Migrated Spatial Look' })
    expect(settings.activeProductionLookId).toBe(settings.productionLooks?.[0].id)
  })

  it('ignores legacy Spatial Fixtures presets during Beam Matrix-only selection', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.engine === 'laserDmx' && candidate.laserDmxWorkspace === 'spatialFixtures')
    expect(preset).toBeDefined()
    const patch = buildPresetPatch(preset!, DEFAULT_OSCILLATOR_SETTINGS)
    expect(patch.laserDmxWorkspaceMode).toBe('beamMatrix')
    expect(patch.laserDmxSettings).toBeUndefined()
  })
})
