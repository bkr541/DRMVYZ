import { describe, expect, it } from 'vitest'
import { getReactFxMasterControls } from '../reactFxMasterControls'

describe('getReactFxMasterControls', () => {
  it.each([
    'shaderPads',
    'cinematicPortal',
    'oscilloscope',
    'neonLattice',
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

  it('shows only controls consumed by Spatial Fixtures', () => {
    expect(getReactFxMasterControls('laserDmx', 'spatialFixtures')).toEqual([
      'glow',
    ])
  })
})
