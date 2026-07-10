/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { CANVAS_REACT_CONTROL_GROUPS } from './ReactCanvasEngineShell'

describe('CANVAS right-panel control contract', () => {
  it('exposes Particle Quality with the other particle controls', () => {
    const particleGroup = CANVAS_REACT_CONTROL_GROUPS.find(group => group.title === 'Motion + Particles')

    expect(particleGroup?.controls).toEqual(expect.arrayContaining([
      'particleDensity',
      'particleSize',
      'particleColorMode',
      'particleQuality',
    ]))
  })
})
