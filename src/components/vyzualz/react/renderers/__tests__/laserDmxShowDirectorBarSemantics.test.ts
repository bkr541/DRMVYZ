import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
} from '../../ReactTypes'
import { compileLaserDmxShowDirectorToBeamMatrix } from '../LaserDmxShowDirectorBeamMatrixCompiler'

function compile(mode: 'bar' | 'phrase', bars: number) {
  const fixture = createDefaultLaserDmxShowDirectorFixture('laser', `${mode}-fixture`, 0)
  const showDirector = normalizeLaserDmxShowDirectorState({
    ...createDefaultLaserDmxShowDirectorState(),
    fixtures: [{
      ...fixture,
      trigger: {
        ...fixture.trigger,
        mode,
        barInterval: mode === 'bar' ? bars : 1,
        phraseLengthBars: mode === 'phrase' ? bars : 8,
      },
    }],
  })
  return compileLaserDmxShowDirectorToBeamMatrix({
    showDirector,
    beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
  })
}

describe('Show Director musical-bar trigger compilation', () => {
  it('compiles bar intervals as bars instead of raw beats', () => {
    const compiled = compile('bar', 4)
    expect(compiled.groups[0]?.launch).toMatchObject({ trigger: 'downbeat', cooldownBeats: 0, cooldownBars: 4 })
    expect(compiled.groups[0]?.modulationRoutes[0]?.timingFilter).toMatchObject({ mode: 'barInterval', intervalBars: 4 })
  })

  it('compiles phraseLengthBars as musical bars without using beat-based phrase8', () => {
    const compiled = compile('phrase', 8)
    expect(compiled.groups[0]?.launch).toMatchObject({ trigger: 'downbeat', cooldownBeats: 0, cooldownBars: 8 })
    expect(compiled.groups[0]?.modulationRoutes[0]?.source).toBe('downbeat')
    expect(compiled.groups[0]?.modulationRoutes[0]?.source).not.toBe('phrase8')
    expect(compiled.groups[0]?.modulationRoutes[0]?.timingFilter).toMatchObject({ mode: 'barInterval', intervalBars: 8 })
  })
})
