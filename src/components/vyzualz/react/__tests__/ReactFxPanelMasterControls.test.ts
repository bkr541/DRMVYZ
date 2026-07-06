import { describe, expect, it } from 'vitest'
import { getReactFxMasterControls } from '../reactFxMasterControls'

describe('getReactFxMasterControls', () => {
  it.each([
    'shaderPads',
    'cinematicPortal',
    'oscilloscope',
  ] as const)('shows all React-wide controls for %s', engineId => {
    expect(getReactFxMasterControls(engineId)).toEqual([
      'intensity',
      'motion',
      'glow',
      'bassReactivity',
    ])
  })

  it('shows only controls consumed by Beam Matrix for LaserDMX', () => {
    expect(getReactFxMasterControls('laserDmx')).toEqual([
      'intensity',
      'glow',
    ])
  })
})
