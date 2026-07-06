import { describe, expect, it } from 'vitest'
import { getReactFxMasterControls } from '../reactFxMasterControls'

describe('getReactFxMasterControls', () => {
  it.each([
    'shaderPads',
    'cinematicPortal',
    'oscilloscope',
  ] as const)('shows all React-wide controls for %s', engineId => {
    expect(getReactFxMasterControls(engineId, 'spatialFixtures')).toEqual([
      'intensity',
      'motion',
      'glow',
      'bassReactivity',
    ])
  })

  it('shows only controls consumed by Beam Matrix', () => {
    expect(getReactFxMasterControls('laserDmx', 'beamMatrix')).toEqual([
      'intensity',
      'glow',
    ])
  })

  it('coerces legacy Spatial Fixtures requests to Beam Matrix controls', () => {
    expect(getReactFxMasterControls('laserDmx', 'spatialFixtures')).toEqual([
      'intensity',
      'glow',
    ])
  })
})
