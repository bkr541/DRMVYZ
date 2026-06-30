import { describe, expect, it } from 'vitest'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import {
  CONSTELLATION_QUALITY_BUDGETS,
  clampConstellationEdgeCount,
  clampConstellationNodeCount,
  clampConstellationTrailSamples,
  reactiveConstellationResolutionScale,
} from '../renderers/cinematic/worlds/reactiveConstellation/ConstellationQuality'

const REQUIRED_PRESETS = [
  'Crimson Collapse',
  'Cyan Reverie',
  'Monolith Breaker',
  'Trapwire',
  'Prism House',
  'Industrial Lattice',
  'Aurora Bloom',
  'Minimal Skeleton',
] as const

describe('Reactive Constellation final curated library', () => {
  const presets = REQUIRED_PRESETS.map(name => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.name === name)
    if (!preset) throw new Error(`Missing required preset: ${name}`)
    return preset
  })

  it('ships every required authored preset with normalized Reactive Constellation metadata', () => {
    expect(presets).toHaveLength(REQUIRED_PRESETS.length)
    for (const preset of presets) {
      expect(preset.engine).toBe('cinematicPortal')
      expect(preset.description.trim().length, preset.name).toBeGreaterThan(48)
      expect(preset.cinematicConfig?.worldMode, preset.name).toBe('reactiveConstellation')
      expect(preset.cinematicConfig?.worldSettings.mode, preset.name).toBe('reactiveConstellation')
      expect(preset.cinematicConfig?.audioMapping.routes.length, preset.name).toBeGreaterThanOrEqual(4)
      expect(preset.scenes, preset.name).toHaveLength(6)
      expect(preset.sectionMappings, preset.name).toHaveLength(6)
    }
  })

  it('uses unique seeds, palettes, settings, cameras, routes, and section choreography', () => {
    const unique = (selector: (preset: typeof presets[number]) => unknown) =>
      new Set(presets.map(preset => JSON.stringify(selector(preset)))).size

    expect(unique(preset => preset.cinematicConfig?.seed)).toBe(presets.length)
    expect(unique(preset => preset.palette)).toBe(presets.length)
    expect(unique(preset => preset.cinematicConfig?.worldSettings)).toBe(presets.length)
    expect(unique(preset => ({ rig: preset.cinematicConfig?.cameraRig, camera: preset.cinematicConfig?.camera }))).toBe(presets.length)
    expect(unique(preset => preset.cinematicConfig?.audioMapping.routes)).toBe(presets.length)
    expect(unique(preset => preset.scenes)).toBe(presets.length)
  })

  it('keeps Minimal Skeleton inside the low-tier budget without deleting the defining beam trail', () => {
    const preset = presets.find(candidate => candidate.name === 'Minimal Skeleton')!
    expect(preset.cinematicConfig!.qualityTier).toBe('low')
    const worldSettings = preset.cinematicConfig!.worldSettings
    if (worldSettings.mode !== 'reactiveConstellation') throw new Error('Unexpected mode')
    const settings = worldSettings.settings
    expect(settings.nodeCount).toBeLessThanOrEqual(CONSTELLATION_QUALITY_BUDGETS.low.nodeCountCap)
    expect(settings.trailSamples).toBeGreaterThan(0)
    expect(settings.trailSamples).toBeLessThanOrEqual(CONSTELLATION_QUALITY_BUDGETS.low.trailSampleCap)
  })
})

describe('Reactive Constellation final quality budgets', () => {
  it('orders every GPU budget and render scale while retaining beams and trails on low', () => {
    const tiers = ['low', 'medium', 'high', 'ultra'] as const
    const keys = [
      'nodeCountCap',
      'edgeCountCap',
      'trailSampleCap',
      'historicalDrawCount',
      'glowPassComplexity',
      'curtainCountCap',
      'postProcessingScale',
    ] as const

    for (const key of keys) {
      const values = tiers.map(tier => CONSTELLATION_QUALITY_BUDGETS[tier][key])
      expect(values, key).toEqual([...values].sort((a, b) => a - b))
    }
    expect(CONSTELLATION_QUALITY_BUDGETS.low.edgeCountCap).toBeGreaterThan(0)
    expect(CONSTELLATION_QUALITY_BUDGETS.low.trailSampleCap).toBeGreaterThan(0)
    expect(CONSTELLATION_QUALITY_BUDGETS.low.historicalDrawCount).toBeGreaterThan(0)
    expect(reactiveConstellationResolutionScale('auto')).toBeLessThan(1)
    expect(reactiveConstellationResolutionScale('ultra')).toBe(1)
  })

  it('clamps non-finite and excessive requests deterministically', () => {
    expect(clampConstellationNodeCount(Number.NaN, CONSTELLATION_QUALITY_BUDGETS.low)).toBe(12)
    expect(clampConstellationNodeCount(999, CONSTELLATION_QUALITY_BUDGETS.low)).toBe(28)
    expect(clampConstellationEdgeCount(Number.POSITIVE_INFINITY, CONSTELLATION_QUALITY_BUDGETS.medium)).toBe(0)
    expect(clampConstellationEdgeCount(9999, CONSTELLATION_QUALITY_BUDGETS.medium)).toBe(112)
    expect(clampConstellationTrailSamples(Number.NaN, CONSTELLATION_QUALITY_BUDGETS.high)).toBe(0)
    expect(clampConstellationTrailSamples(999, CONSTELLATION_QUALITY_BUDGETS.high)).toBe(16)
  })
})
