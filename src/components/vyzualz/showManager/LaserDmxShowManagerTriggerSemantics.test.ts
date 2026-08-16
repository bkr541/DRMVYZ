import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
} from '../react/ReactTypes'
import { compileLaserDmxShowDirectorToBeamMatrix } from '../react/renderers/LaserDmxShowDirectorBeamMatrixCompiler'
import {
  LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS,
  addLaserDmxShowManagerFixtureToSection,
  createLaserDmxShowManagerRuntimeShowDirector,
  createLaserDmxShowManagerShow,
  describeLaserDmxShowManagerStoredTrigger,
  normalizeLaserDmxShowManagerFixture,
  resolveLaserDmxShowManagerTriggerOption,
  triggerPatchForLaserDmxShowManagerOption,
} from './LaserDmxShowManagerDomain'

function compileTrigger(trigger: ReturnType<typeof createDefaultLaserDmxShowDirectorFixture>['trigger']) {
  const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'trigger-fixture', 0)
  const showDirector = normalizeLaserDmxShowDirectorState({
    ...createDefaultLaserDmxShowDirectorState(),
    fixtures: [{
      ...fixture,
      trigger,
    }],
  })
  return compileLaserDmxShowDirectorToBeamMatrix({
    showDirector,
    beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
  })
}

describe('LaserDMX Show Manager Stage 3 trigger semantics', () => {
  it('creates new Show Manager lasers as truly ungated fixtures inside their owning section', () => {
    let show = createLaserDmxShowManagerShow('Trigger Defaults')
    const sectionId = show.sections[0]!.id
    const result = addLaserDmxShowManagerFixtureToSection(show, sectionId, 'laser')
    show = result.show

    const fixture = show.sections[0]!.fixtures.find(candidate => candidate.id === result.fixtureId)!
    expect(fixture.trigger).toMatchObject({
      mode: 'alwaysOn',
      quantize: 'none',
      retrigger: 'allow',
      fadeInMs: 0,
      fadeOutMs: 0,
    })
    expect(resolveLaserDmxShowManagerTriggerOption(fixture.trigger)).toBe('none')

    const runtime = createLaserDmxShowManagerRuntimeShowDirector(show, show.sections[0]!)
    const compiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: runtime,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      sections: show.sections,
    })
    expect(compiled.groups[0]?.launch.trigger).toBe('none')
    expect(compiled.groups[0]?.modulationRoutes.some(route => route.id.includes('-trigger-'))).toBe(false)
  })

  it('round-trips every exposed trigger and does not expose the redundant one-bar Bar alias', () => {
    expect(LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS.map(option => option.value)).toEqual([
      'none', 'beat', 'downbeat', '4bars', '8bars', '16bars', '24bars', 'kickHit', 'snareHit',
    ])

    const base = createDefaultLaserDmxShowDirectorFixture('movingHead', 'round-trip')
    for (const option of LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS) {
      const trigger = {
        ...base.trigger,
        ...triggerPatchForLaserDmxShowManagerOption(option.value),
      }
      expect(resolveLaserDmxShowManagerTriggerOption(trigger)).toBe(option.value)
    }
  })

  it('preserves unsupported stored trigger intent instead of masquerading it as None', () => {
    const legacy = createDefaultLaserDmxShowDirectorFixture('laser', 'stored-build')
    const storedBuild = normalizeLaserDmxShowManagerFixture({
      ...legacy,
      trigger: {
        ...legacy.trigger,
        sectionTypes: ['build'],
      },
    })
    expect(storedBuild.trigger.mode).toBe('section')
    expect(storedBuild.trigger.sectionTypes).toEqual(['build'])
    expect(resolveLaserDmxShowManagerTriggerOption(storedBuild.trigger)).toBeNull()
    expect(describeLaserDmxShowManagerStoredTrigger(storedBuild.trigger)).toBe('Stored: Section (build)')

    const halfBeat = normalizeLaserDmxShowManagerFixture({
      ...createDefaultLaserDmxShowDirectorFixture('ledBar', 'stored-half-beat'),
      trigger: {
        ...triggerPatchForLaserDmxShowManagerOption('beat'),
        beatDivision: 0.5,
      },
    })
    expect(resolveLaserDmxShowManagerTriggerOption(halfBeat.trigger)).toBeNull()
    expect(describeLaserDmxShowManagerStoredTrigger(halfBeat.trigger)).toBe('Stored: Every 0.5 Beats')
  })

  it('loads the prior hidden Drop default safely by migrating only that exact Show Manager laser recipe to None', () => {
    const legacyDefault = createDefaultLaserDmxShowDirectorFixture('laser', 'legacy-default')
    expect(legacyDefault.trigger).toMatchObject({ mode: 'section', quantize: 'section', sectionTypes: ['drop'] })

    const normalized = normalizeLaserDmxShowManagerFixture(legacyDefault)
    expect(normalized.trigger).toMatchObject({ mode: 'alwaysOn', quantize: 'none', retrigger: 'allow' })
    expect(resolveLaserDmxShowManagerTriggerOption(normalized.trigger)).toBe('none')
  })

  it('canonicalizes the one-bar trigger as Downbeat, reads the prior encoding, and keeps multi-bar schedules distinct', () => {
    const base = createDefaultLaserDmxShowDirectorFixture('movingHead', 'downbeat')
    const downbeat = {
      ...base.trigger,
      ...triggerPatchForLaserDmxShowManagerOption('downbeat'),
    }
    const legacyDownbeat = {
      ...downbeat,
      quantize: 'beat' as const,
    }
    expect(resolveLaserDmxShowManagerTriggerOption(downbeat)).toBe('downbeat')
    expect(resolveLaserDmxShowManagerTriggerOption(legacyDownbeat)).toBe('downbeat')

    const downbeatCompiled = compileTrigger(downbeat)
    const fourBarsCompiled = compileTrigger({
      ...base.trigger,
      ...triggerPatchForLaserDmxShowManagerOption('4bars'),
    })

    expect(downbeatCompiled.groups[0]?.launch).toMatchObject({ trigger: 'downbeat', cooldownBars: 1 })
    expect(downbeatCompiled.groups[0]?.modulationRoutes.find(route => route.id.includes('-trigger-'))?.timingFilter)
      .toMatchObject({ mode: 'barInterval', intervalBars: 1 })
    expect(fourBarsCompiled.groups[0]?.launch).toMatchObject({ trigger: 'downbeat', cooldownBars: 4 })
    expect(fourBarsCompiled.groups[0]?.modulationRoutes.find(route => route.id.includes('-trigger-'))?.timingFilter)
      .toMatchObject({ mode: 'barInterval', intervalBars: 4 })
  })

  it('keeps Kick and Snare recipes deterministic, including their fixed threshold and fade behavior', () => {
    const base = createDefaultLaserDmxShowDirectorFixture('laser', 'hit-fixture')
    const kick = {
      ...base.trigger,
      ...triggerPatchForLaserDmxShowManagerOption('kickHit'),
    }
    const snare = {
      ...base.trigger,
      ...triggerPatchForLaserDmxShowManagerOption('snareHit'),
    }

    expect(kick).toMatchObject({
      mode: 'bassHit',
      quantize: 'none',
      retrigger: 'allow',
      audioBand: 'bass',
      audioThreshold: 0.65,
      fadeInMs: 0,
      fadeOutMs: 160,
    })
    expect(snare).toMatchObject({
      mode: 'snareTransient',
      quantize: 'none',
      retrigger: 'allow',
      audioBand: 'highMid',
      audioThreshold: 0.58,
      fadeInMs: 0,
      fadeOutMs: 120,
    })

    const kickCompiled = compileTrigger(kick)
    const snareCompiled = compileTrigger(snare)
    expect(kickCompiled.groups[0]?.launch).toMatchObject({ trigger: 'kick', threshold: 0.65 })
    expect(snareCompiled.groups[0]?.launch).toMatchObject({ trigger: 'snare', threshold: 0.58 })
  })
})
