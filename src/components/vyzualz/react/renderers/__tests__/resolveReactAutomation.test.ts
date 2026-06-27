import { describe, it, expect } from 'vitest'
import { resolveReactAutomation } from '../ReactEngineRenderer'
import { DEFAULT_REACT_RENDER_PARAMS } from '../reactRenderUtils'
import type { ReactPreset } from '../../ReactTypes'

const basePreset: ReactPreset = {
  id: 'test-preset',
  name: 'Test Preset',
  description: '',
  engine: 'shaderPads',
  palette: {
    primary: '#4ac7db', secondary: '#61d6aa', accent: '#d8b95a',
    background: '#060d10', highlight: '#80dfc0', text: '#e8f4f8',
  },
  params: { intensity: 0.7, motion: 0.5, glow: 0.65, bassReactivity: 0.8 },
  scenes: [
    { id: 'drop-scene',  sectionType: 'drop',  engineId: 'shaderPads', params: { intensity: 1.0, motion: 0.9 } },
    { id: 'intro-scene', sectionType: 'intro', engineId: 'shaderPads', params: { intensity: 0.3, motion: 0.3 } },
  ],
  sectionMappings: [
    { sectionType: 'drop',  sceneId: 'drop-scene'  },
    { sectionType: 'intro', sceneId: 'intro-scene' },
  ],
}

const base = { ...DEFAULT_REACT_RENDER_PARAMS }

describe('resolveReactAutomation', () => {
  it('returns base params unchanged when sectionType is null', () => {
    const result = resolveReactAutomation(basePreset, null, 0.5, base)
    expect(result).toEqual(base)
  })

  it('returns base params unchanged when no mapping found for the section', () => {
    const result = resolveReactAutomation(basePreset, 'verse', 0.5, base)
    expect(result).toEqual(base)
  })

  it('fully blends toward scene params at mid-section (progress=0.5)', () => {
    const result = resolveReactAutomation(basePreset, 'drop', 0.5, base)
    expect(result.intensity).toBeCloseTo(1.0, 5)
    expect(result.motion).toBeCloseTo(0.9, 5)
  })

  it('partially blends at start of section (progress=0.05, blend=0.5)', () => {
    const result = resolveReactAutomation(basePreset, 'drop', 0.05, base)
    // blend = 0.05 * 10 = 0.5 → lerp(base.intensity=0.7, 1.0, 0.5) = 0.85
    expect(result.intensity).toBeCloseTo(0.7 + (1.0 - 0.7) * 0.5, 5)
  })

  it('partially blends at end of section (progress=0.95, blend=0.5)', () => {
    const result = resolveReactAutomation(basePreset, 'drop', 0.95, base)
    // blend = (1 - 0.95) * 10 = 0.5
    expect(result.intensity).toBeCloseTo(0.7 + (1.0 - 0.7) * 0.5, 5)
  })

  it('uses base values for params not specified in scene', () => {
    const result = resolveReactAutomation(basePreset, 'drop', 0.5, base)
    // glow is not in the drop scene params
    expect(result.glow).toBe(base.glow)
    expect(result.trailDecay).toBe(base.trailDecay)
    expect(result.fogDensity).toBe(base.fogDensity)
    expect(result.particleDensity).toBe(base.particleDensity)
  })

  it('handles intro scene params correctly', () => {
    const result = resolveReactAutomation(basePreset, 'intro', 0.5, base)
    expect(result.intensity).toBeCloseTo(0.3, 5)
    expect(result.motion).toBeCloseTo(0.3, 5)
  })
})
