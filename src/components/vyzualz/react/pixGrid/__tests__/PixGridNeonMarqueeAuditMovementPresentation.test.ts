import { describe, expect, it } from 'vitest'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { PixGridFrameGroupCompiler } from '../PixGridGroupCompiler'
import { pixGridMaskHasCell } from '../PixGridGroups'
import { PixGridPerformanceProgramCompiler, validatePixGridPerformanceProgramCollection } from '../PixGridPerformanceProgramCompiler'
import {
  BASS_BEACON_PERFORMANCE_PROGRAM,
  GEOMETRIC_REACTOR_PERFORMANCE_PROGRAM,
  NEON_MARQUEE_PERFORMANCE_PROGRAM,
  PIXEL_PARADE_PERFORMANCE_PROGRAM,
  PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID,
  PIX_GRID_PERFORMANCE_PROGRAMS,
  PIX_GRID_PERFORMANCE_PROGRAM_BY_ID,
  PIX_GRID_PRESET_ID_BY_PROGRAM,
} from '../PixGridPerformancePrograms'
import { applyPixGridPerformanceStateAction } from '../PixGridPerformanceRuntime'
import { PIX_GRID_PRESET_BY_ID } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const PROGRAM_ID = 'pix-grid-neon-marquee-performance'
const REQUIRED_BANKS = [
  'marquee-hero-bank',
  'marquee-structure-bank',
  'marquee-perimeter-bank',
  'marquee-bulb-bank',
  'marquee-letter-bank',
  'marquee-equalizer-bank',
  'marquee-trim-bank',
  'marquee-focal-bank',
  'marquee-sparkle-bank',
  'marquee-recruitment-bank',
  'marquee-transition-bank',
  'marquee-impact-bank',
] as const

function marqueeState() {
  const preset = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
  return applyPixGridPresetSettings(createDefaultPixGridState(), PRESET_ID, preset.pixGridSettings)
}

describe('Marquee canonical Performance Program architecture', () => {
  it('registers the program exactly once in every forward and reverse registry', () => {
    expect(PIX_GRID_PERFORMANCE_PROGRAMS.filter(program => program.id === PROGRAM_ID)).toHaveLength(1)
    expect(PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.get(PROGRAM_ID)).toBe(NEON_MARQUEE_PERFORMANCE_PROGRAM)
    expect(PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID[PRESET_ID]).toBe(PROGRAM_ID)
    expect(PIX_GRID_PRESET_ID_BY_PROGRAM[PROGRAM_ID]).toBe(PRESET_ID)
    expect(validatePixGridPerformanceProgramCollection(PIX_GRID_PERFORMANCE_PROGRAMS)).toEqual([])
  })

  it('resolves every semantic binding and every requested bank to real canonical groups', () => {
    const state = marqueeState()
    const compiled = new PixGridPerformanceProgramCompiler().compile(NEON_MARQUEE_PERFORMANCE_PROGRAM, state)
    expect(compiled.missingBindings).toEqual([])
    expect(compiled.degradedBindings).toEqual([])
    expect(compiled.validationIssues.filter(issue => issue.severity === 'error')).toEqual([])
    expect(NEON_MARQUEE_PERFORMANCE_PROGRAM.bindings).toHaveLength(14)
    expect(NEON_MARQUEE_PERFORMANCE_PROGRAM.bindings.every(binding => (
      binding.target.kind === 'group' && state.groups.some(group => group.id === binding.target.id)
    ))).toBe(true)

    expect(NEON_MARQUEE_PERFORMANCE_PROGRAM.banks.map(bank => bank.id)).toEqual(REQUIRED_BANKS)
    expect(compiled.resolvedBanks.every(bank => bank.targets.length > 0)).toBe(true)
    expect(compiled.resolvedBanks.every(bank => bank.targets.every(target => target.kind === 'group'))).toBe(true)
  })

  it('defines complete Intro, Verse, Build, Pre-drop, Drop, Breakdown, Outro, and fallback plans', () => {
    const plans = new Map(NEON_MARQUEE_PERFORMANCE_PROGRAM.sectionPlans.map(plan => [plan.id, plan]))
    expect([...plans.keys()]).toEqual([
      'marquee-intro',
      'marquee-verse',
      'marquee-build',
      'marquee-pre-drop',
      'marquee-drop',
      'marquee-breakdown',
      'marquee-outro',
      'marquee-fallback',
    ])
    for (const plan of plans.values()) {
      expect(plan.scenePreference?.length).toBeGreaterThan(0)
      expect(plan.continuousRouteIds?.length).toBeGreaterThan(0)
      expect(plan.eventRouteIds?.length).toBeGreaterThan(0)
      expect(plan.variationPolicy).toMatchObject({ deterministic: true, preserveIdentity: true })
    }
    expect(plans.get('marquee-build')?.eightBarRecruitment?.length).toBe(4)
    expect(plans.get('marquee-drop')?.fourBarActions?.length).toBe(2)
    expect(plans.get('marquee-pre-drop')?.actions).toContainEqual({ type: 'setGroupActive', groupId: 'marquee-equalizer-group', active: false })
  })

  it('routes audio only to semantic light banks and never to stable structure or whole-output transforms', () => {
    const allRoutes = [
      ...NEON_MARQUEE_PERFORMANCE_PROGRAM.continuousRoutes,
      ...NEON_MARQUEE_PERFORMANCE_PROGRAM.eventRoutes,
    ]
    expect(allRoutes.length).toBeGreaterThanOrEqual(20)
    expect(allRoutes.every(route => 'bankId' in route.target)).toBe(true)
    expect(allRoutes.some(route => 'bankId' in route.target && route.target.bankId === 'marquee-structure-bank')).toBe(false)
    expect(allRoutes.some(route => ['scale', 'positionX', 'positionY', 'globalIntensity', 'contrast'].includes(route.operation))).toBe(false)

    const sources = new Set(allRoutes.map(route => 'event' in route ? route.event : route.source))
    for (const source of ['sub', 'bass', 'mid', 'vocalEnergy', 'high', 'air', 'kick', 'snare', 'hat', 'downbeat', 'buildProgress', 'dropImpact', 'phraseProgress']) {
      expect(sources.has(source as never)).toBe(true)
    }
  })

  it('executes group-targeted animation actions against member layers instead of synthesizing pixel shifts', () => {
    const state = marqueeState()
    const perimeterIds = ['marquee-bulbs-a', 'marquee-bulbs-b', 'marquee-bulbs-c', 'marquee-bulbs-d']
    const before = new Map(state.layers.map(layer => [layer.id, layer.animations.map(animation => ({ ...animation }))]))

    const slowed = applyPixGridPerformanceStateAction(state, {
      type: 'changeAnimationSpeed',
      target: { groupId: 'marquee-perimeter-group' },
      multiplier: 0.5,
    })
    for (const id of perimeterIds) {
      expect(slowed.layers.find(layer => layer.id === id)?.animations.map(animation => animation.speed))
        .toEqual(before.get(id)!.map(animation => animation.speed * 0.5))
    }
    expect(slowed.layers.find(layer => layer.id === 'marquee-structure')?.animations).toEqual(before.get('marquee-structure'))

    const reversed = applyPixGridPerformanceStateAction(state, {
      type: 'reverseDirection',
      target: { groupId: 'marquee-letter-group' },
    })
    expect(reversed.layers.find(layer => layer.id === 'marquee-letter-lights-a')?.animations.every(animation => animation.speed <= 0)).toBe(true)
    expect(reversed.layers.find(layer => layer.id === 'marquee-structure')?.animations).toEqual(before.get('marquee-structure'))

    const triggered = applyPixGridPerformanceStateAction(state, {
      type: 'triggerFrame',
      target: { groupId: 'marquee-equalizer-group' },
      step: 0.25,
    })
    expect(triggered.layers.find(layer => layer.id === 'marquee-equalizer-lights')?.animations.map(animation => animation.phase))
      .toEqual(before.get('marquee-equalizer-lights')!.map(animation => animation.phase + 0.25))
  })

  it('keeps source-derived Smart Group masks isolated across compiler instances', () => {
    const group = marqueeState().groups.find(candidate => candidate.id === 'marquee-letter-group')!
    const activeLayers = new Set(group.layerScope ?? [])

    const firstCompiler = new PixGridFrameGroupCompiler()
    firstCompiler.beginFrame([group], 4, 1, activeLayers)
    firstCompiler.recordPixel('marquee-letter-lights-a', 0, [255, 255, 255], 1)
    const first = firstCompiler.compile(group)

    const secondCompiler = new PixGridFrameGroupCompiler()
    secondCompiler.beginFrame([group], 4, 1, activeLayers)
    secondCompiler.recordPixel('marquee-letter-lights-c', 3, [255, 255, 255], 1)
    const second = secondCompiler.compile(group)

    expect(pixGridMaskHasCell(first.bits, 0)).toBe(true)
    expect(pixGridMaskHasCell(first.bits, 3)).toBe(false)
    expect(pixGridMaskHasCell(second.bits, 0)).toBe(false)
    expect(pixGridMaskHasCell(second.bits, 3)).toBe(true)
  })

  it('leaves the three existing program identities and authored definitions unchanged', () => {
    expect(BASS_BEACON_PERFORMANCE_PROGRAM.id).toBe('pix-grid-bass-beacon-performance')
    expect(GEOMETRIC_REACTOR_PERFORMANCE_PROGRAM.id).toBe('pix-grid-geometric-reactor-performance')
    expect(PIXEL_PARADE_PERFORMANCE_PROGRAM.id).toBe('pix-grid-pixel-parade-performance')
    expect(PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID).toMatchObject({
      'pix-grid-bass-beacon': 'pix-grid-bass-beacon-performance',
      'pix-grid-geometric-reactor': 'pix-grid-geometric-reactor-performance',
      'pix-grid-pixel-parade': 'pix-grid-pixel-parade-performance',
    })
  })
})
