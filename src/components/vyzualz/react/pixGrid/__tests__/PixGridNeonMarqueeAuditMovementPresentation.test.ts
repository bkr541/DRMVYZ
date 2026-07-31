import { describe, expect, it } from 'vitest'
import type { ReactPreset, ReactSectionType } from '../../ReactTypes'
import { resolvePixGridAuthoredAssignmentState } from '../PixGridAssignmentApplication'
import { resolvePixGridLayerAnimation } from '../PixGridAnimation'
import { createSilentPixGridAudioFrame, PixGridReactionRuntime } from '../PixGridAudioRouting'
import { PIX_GRID_BUILT_IN_ASSET_BY_ID } from '../PixGridArtwork'
import { composePixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import {
  PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS,
  resolvePixGridNeonMarqueePerformance,
} from '../PixGridNeonMarqueePerformance'
import {
  getPixGridNeonMarqueeFrames,
  PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT,
  PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT,
  PIX_GRID_NEON_MARQUEE_FRAME_ORDER,
  PIX_GRID_NEON_MARQUEE_FRAME_WIDTH,
} from '../PixGridNeonMarqueeFrames'
import {
  isPixGridMusicReactivePreset,
  PIX_GRID_MUSIC_REACTIVE_PRESETS,
  PIX_GRID_PRESET_BY_ID,
} from '../PixGridPresets'
import { auditPixGridPresetRenderedReactivity } from '../PixGridReactivityAudit'
import { applyPixGridRuntimeControls, PixGridMotionClock } from '../PixGridRuntimeControls'
import { applyPixGridPresetSettings } from '../PixGridState'
import type { PixGridAudioFrame, PixGridPresetSettings, PixGridState } from '../PixGridTypes'
import { validatePixGridPreset } from '../PixGridValidationAudit'
import { PIX_GRID_PRESENTATION_FRAGMENT_SHADER } from '../../renderers/pixGrid/PixGridGpuShaderSources'

const PRESET_ID = 'pix-grid-neon-marquee-cycle'
const PRESET = PIX_GRID_PRESET_BY_ID.get(PRESET_ID)!
const SETTINGS = PRESET.pixGridSettings!
const LAYER = SETTINGS.layers![0]
const ASSET = PIX_GRID_BUILT_IN_ASSET_BY_ID.get(LAYER.assetId)!

function audioFrame(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  return createSilentPixGridAudioFrame({
    audioTime: 0,
    isPlaying: true,
    transportState: 'playing',
    trackIdentity: 'marquee-audit-track',
    sectionType: 'verse',
    sectionProgress: 0,
    beatIndex: 0,
    beatPhase: 0,
    barIndex: 0,
    beatsSinceSectionStart: 0,
    barsSinceSectionStart: 0,
    autoPerformanceEnabled: false,
    ...overrides,
  })
}

function sectionFrame(
  sectionType: ReactSectionType,
  beatsSinceSectionStart: number,
  barsSinceSectionStart: number,
  sectionProgress: number,
  overrides: Partial<PixGridAudioFrame> = {},
): PixGridAudioFrame {
  return audioFrame({
    sectionType,
    beatsSinceSectionStart,
    barsSinceSectionStart,
    sectionProgress,
    beatIndex: Math.floor(beatsSinceSectionStart),
    beatPhase: beatsSinceSectionStart % 1,
    barIndex: Math.floor(barsSinceSectionStart),
    ...overrides,
  })
}

function presetState(autoPerformanceEnabled: boolean): PixGridState {
  const state = createDefaultPixGridState()
  state.performance.enabled = autoPerformanceEnabled
  return applyPixGridPresetSettings(state, PRESET.id, SETTINGS)
}

function cloneWithSettings(id: string, patch: Partial<PixGridPresetSettings>): ReactPreset {
  return {
    ...PRESET,
    id,
    name: id,
    pixGridSettings: {
      ...SETTINGS,
      audioAssignments: [],
      groups: [],
      performanceProgramId: null,
      ...patch,
    },
  }
}

function transform(frame: PixGridAudioFrame) {
  return resolvePixGridLayerAnimation(LAYER, ASSET, frame, 1)
}

function changedBytes(a: Uint8Array, b: Uint8Array): number {
  let changed = 0
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) changed += 1
  }
  return changed
}

describe('PixGrid music-reactive capability discovery', () => {
  it('discovers programs, direct assignments, and combined presets exactly once', () => {
    const enabledAssignment = SETTINGS.audioAssignments![0]
    const programOnly = cloneWithSettings('audit-program-only', {
      performanceProgramId: 'pix-grid-bass-beacon-performance',
    })
    const directOnly = cloneWithSettings('audit-direct-only', {
      audioAssignments: [enabledAssignment],
    })
    const both = cloneWithSettings('audit-program-and-direct', {
      performanceProgramId: 'pix-grid-bass-beacon-performance',
      audioAssignments: [enabledAssignment],
    })
    const neither = cloneWithSettings('audit-neither', {})
    const disabledOnly = cloneWithSettings('audit-disabled-only', {
      audioAssignments: [{ ...enabledAssignment, enabled: false }],
    })

    expect(isPixGridMusicReactivePreset(programOnly)).toBe(true)
    expect(isPixGridMusicReactivePreset(directOnly)).toBe(true)
    expect(isPixGridMusicReactivePreset(both)).toBe(true)
    expect(isPixGridMusicReactivePreset(neither)).toBe(false)
    expect(isPixGridMusicReactivePreset(disabledOnly)).toBe(false)
    expect(PIX_GRID_MUSIC_REACTIVE_PRESETS.filter(preset => preset.id === PRESET_ID)).toHaveLength(1)
    expect(PIX_GRID_MUSIC_REACTIVE_PRESETS.some(preset => preset.id === 'pix-grid-bass-beacon')).toBe(true)
  })

  it('validates direct-assignment ownership without requiring Smart Groups or a Performance Program', () => {
    const state = presetState(true)
    const report = validatePixGridPreset(PRESET, state)
    const sources = new Set(state.audioAssignments.filter(assignment => assignment.enabled).map(assignment => assignment.source))

    expect(report.errors).toEqual([])
    expect(report.issues.some(issue => issue.code === 'built-in-no-groups')).toBe(false)
    expect(report.issues.some(issue => issue.code === 'missing-performance-program')).toBe(false)
    for (const source of ['kick', 'snare', 'bass', 'downbeat', 'buildProgress', 'dropImpact'] as const) {
      expect(sources.has(source)).toBe(true)
    }
  })

  it('exercises every marquee reaction family against an equivalent authored-motion phase', () => {
    const report = auditPixGridPresetRenderedReactivity(PRESET, presetState(true))
    for (const scenario of ['kick', 'snare', 'bassSustain', 'downbeat', 'build', 'drop'] as const) {
      const row = report.acceptanceMatrix.find(candidate => candidate.id === `music-${scenario}`)
      expect(row?.detail).not.toContain('not authored')
      expect(row?.passed).toBe(true)
    }
    expect(report.checks.find(check => check.id === 'unified-runtime-active-differs-from-silence')?.passed).toBe(true)
  })
})

describe('Deprecated Marquee compatibility choreography', () => {
  it('keeps intro restrained and adds bounded verse drift', () => {
    const intro = resolvePixGridNeonMarqueePerformance(sectionFrame('intro', 2, 0.5, 0.25))
    const verse = resolvePixGridNeonMarqueePerformance(sectionFrame('verse', 2, 0.5, 0.25))

    expect(intro.positionOffsetX).toBe(0)
    expect(Math.abs(intro.positionOffsetY) * 90).toBeLessThanOrEqual(PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.introVerticalCells)
    expect(intro.scaleMultiplier).toBeLessThanOrEqual(1 + PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.introScaleDelta)
    expect(Math.abs(verse.positionOffsetX) * 160).toBeCloseTo(PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.verseHorizontalCells, 5)
    expect(Math.abs(verse.positionOffsetY) * 90).toBeLessThanOrEqual(PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.verseVerticalCells)
    expect(verse.scaleMultiplier).toBeLessThanOrEqual(1 + PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.verseScaleDelta)
  })

  it('ramps build movement, recenters pre-drop, peaks once per drop beat, and settles the outro', () => {
    const buildEarly = resolvePixGridNeonMarqueePerformance(sectionFrame('build', 0.5, 0.25, 0.1))
    const buildLate = resolvePixGridNeonMarqueePerformance(sectionFrame('build', 0.5, 0.25, 0.9))
    const preDrop = resolvePixGridNeonMarqueePerformance(sectionFrame('preDrop', 0.5, 0.125, 0.5))
    const dropPeak = resolvePixGridNeonMarqueePerformance(sectionFrame('drop', 0.5, 0.125, 0.25))
    const dropCenter = resolvePixGridNeonMarqueePerformance(sectionFrame('drop', 1, 0.25, 0.25))
    const breakdown = resolvePixGridNeonMarqueePerformance(sectionFrame('breakdown', 2, 0.5, 0.5))
    const outroEnd = resolvePixGridNeonMarqueePerformance(sectionFrame('outro', 6, 1.5, 1))

    expect(Math.abs(buildLate.positionOffsetX)).toBeGreaterThan(Math.abs(buildEarly.positionOffsetX))
    expect(Math.abs(buildLate.positionOffsetX) * 160).toBeLessThanOrEqual(PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.buildHorizontalCells)
    expect(Math.abs(buildLate.positionOffsetY) * 90).toBeLessThanOrEqual(PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.buildVerticalCells)
    expect(preDrop).toMatchObject({ positionOffsetX: 0, positionOffsetY: 0, scaleMultiplier: 1 })
    expect(Math.abs(dropPeak.positionOffsetX) * 160).toBeCloseTo(PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.dropHorizontalCells, 5)
    expect(Math.abs(dropPeak.positionOffsetY) * 90).toBeCloseTo(PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.dropVerticalCells, 5)
    expect(dropPeak.scaleMultiplier).toBeCloseTo(PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.maximumAuthoredScale, 5)
    expect(dropCenter).toMatchObject({ positionOffsetX: 0, positionOffsetY: 0, scaleMultiplier: 1 })
    expect(Math.abs(breakdown.positionOffsetY) * 90).toBeLessThanOrEqual(PIX_GRID_NEON_MARQUEE_MOVEMENT_LIMITS.breakdownVerticalCells)
    expect(outroEnd).toMatchObject({ positionOffsetX: 0, positionOffsetY: 0, scaleMultiplier: 1 })
  })

  it('freezes frame and transform at Motion 0 and scales both proportionally', () => {
    const clock = new PixGridMotionClock()
    const start = clock.apply(applyPixGridRuntimeControls(sectionFrame('verse', 1, 0.25, 0.2, { audioTime: 1 }), { bassReactivity: 1, motion: 1 }))
    const frozenA = clock.apply(applyPixGridRuntimeControls(sectionFrame('verse', 2, 0.5, 0.3, { audioTime: 2 }), { bassReactivity: 1, motion: 0 }))
    const frozenB = clock.apply(applyPixGridRuntimeControls(sectionFrame('verse', 4, 1, 0.5, { audioTime: 4 }), { bassReactivity: 1, motion: 0 }))

    expect(resolvePixGridNeonMarqueePerformance(frozenA)).toEqual(resolvePixGridNeonMarqueePerformance(start))
    expect(resolvePixGridNeonMarqueePerformance(frozenB)).toEqual(resolvePixGridNeonMarqueePerformance(start))

    const halfClock = new PixGridMotionClock()
    const normalClock = new PixGridMotionClock()
    halfClock.apply(applyPixGridRuntimeControls(sectionFrame('verse', 0, 0, 0, { audioTime: 0 }), { bassReactivity: 1, motion: 0.5 }))
    normalClock.apply(applyPixGridRuntimeControls(sectionFrame('verse', 0, 0, 0, { audioTime: 0 }), { bassReactivity: 1, motion: 1 }))
    const half = halfClock.apply(applyPixGridRuntimeControls(sectionFrame('verse', 2, 0.5, 0.25, { audioTime: 2 }), { bassReactivity: 1, motion: 0.5 }))
    const normal = normalClock.apply(applyPixGridRuntimeControls(sectionFrame('verse', 2, 0.5, 0.25, { audioTime: 2 }), { bassReactivity: 1, motion: 1 }))
    expect(half.motionClockSectionBar).toBeCloseTo((normal.motionClockSectionBar ?? 0) * 0.5, 5)
    expect(resolvePixGridNeonMarqueePerformance(half)).not.toEqual(resolvePixGridNeonMarqueePerformance(normal))
  })

  it('keeps the canonical component transform generic while Auto Performance owns only routed reactions', () => {
    const moving = sectionFrame('verse', 2, 0.5, 0.25, { autoPerformanceEnabled: false })
    const authored = transform(moving)
    expect(authored).toMatchObject({ positionX: 0.5, positionY: 0.5, scaleX: 1, scaleY: 1, rotation: 0 })

    const event = sectionFrame('drop', 0.5, 0.125, 0.25, {
      autoPerformanceEnabled: true,
      kickHit: true,
      sourceValues: { kick: 1 },
      eventIdentities: { kick: 'kick:1' },
    })
    const state = presetState(true)
    const offRuntime = new PixGridReactionRuntime()
    offRuntime.beginFrame({ ...event, autoPerformanceEnabled: false })
    const offState = resolvePixGridAuthoredAssignmentState(state, { ...event, autoPerformanceEnabled: false }, offRuntime)
    const onRuntime = new PixGridReactionRuntime()
    onRuntime.beginFrame(event)
    const onState = resolvePixGridAuthoredAssignmentState(state, event, onRuntime)

    expect(offState.layers[0].scale.x).toBe(1)
    expect(onState.layers[0].scale.x).toBeGreaterThan(1)
    expect(resolvePixGridNeonMarqueePerformance({ ...event, autoPerformanceEnabled: false }))
      .toEqual(resolvePixGridNeonMarqueePerformance(event))
  })

  it('reconstructs complete transforms on seek, loop, pause, restart, and track replacement', () => {
    const clock = new PixGridMotionClock()
    const target = sectionFrame('build', 5.5, 1.375, 0.75, {
      audioTime: 28,
      timingDiscontinuity: true,
    })
    const seekA = clock.apply(applyPixGridRuntimeControls(target, { bassReactivity: 1, motion: 1 }))
    clock.apply(applyPixGridRuntimeControls(sectionFrame('drop', 8, 2, 0.5, { audioTime: 40 }), { bassReactivity: 1, motion: 1 }))
    const seekB = clock.apply(applyPixGridRuntimeControls(target, { bassReactivity: 1, motion: 1 }))
    expect(resolvePixGridNeonMarqueePerformance(seekB)).toEqual(resolvePixGridNeonMarqueePerformance(seekA))

    const paused = clock.apply(applyPixGridRuntimeControls(sectionFrame('build', 8, 2, 0.95, {
      audioTime: 32,
      transportState: 'paused',
      isPlaying: false,
    }), { bassReactivity: 1, motion: 1 }))
    expect(resolvePixGridNeonMarqueePerformance(paused)).toEqual(resolvePixGridNeonMarqueePerformance(seekB))

    clock.reset('replacement-track')
    const restarted = clock.apply(applyPixGridRuntimeControls(sectionFrame('intro', 0, 0, 0, {
      audioTime: 0,
      trackIdentity: 'replacement-track',
      timingDiscontinuity: true,
    }), { bassReactivity: 1, motion: 1 }))
    expect(resolvePixGridNeonMarqueePerformance(restarted)).toMatchObject({
      frameIndex: 0,
      positionOffsetX: 0,
      positionOffsetY: 0,
      scaleMultiplier: 1,
    })
  })

  it('does not apply a hidden Marquee-only scale clamp in the generic compositor', () => {
    const event = sectionFrame('drop', 0, 0, 0, { autoPerformanceEnabled: false })
    const state = { ...presetState(false), selectedSceneId: `${PRESET_ID}-drop` }
    const authored = transform(event)
    expect(authored).toMatchObject({ rotation: 0, scaleX: 1, scaleY: 1 })

    const modestState = {
      ...state,
      layers: state.layers.map(layer => layer.id === LAYER.id ? { ...layer, scale: { x: 1.1, y: 1.1 } } : layer),
    }
    const overdrivenState = {
      ...state,
      layers: state.layers.map(layer => layer.id === LAYER.id ? { ...layer, scale: { x: 2, y: 2 } } : layer),
    }
    const modest = composePixGridLogicalFrame(PRESET, modestState, event)
    const overdriven = composePixGridLogicalFrame(PRESET, overdrivenState, event)
    expect(overdriven.pixels).not.toEqual(modest.pixels)
  })
})

describe('Marquee Sign Cycle LED-cell presentation', () => {
  it('preserves all four native 160 x 90 source frames and canonical order', () => {
    expect([PIX_GRID_NEON_MARQUEE_FRAME_WIDTH, PIX_GRID_NEON_MARQUEE_FRAME_HEIGHT, PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT])
      .toEqual([160, 90, 14_400])
    expect(PIX_GRID_NEON_MARQUEE_FRAME_ORDER.map(frame => frame.label))
      .toEqual(['MARYS', 'GOONZ', 'DVYDRM', 'Frenchie DJ'])
    const frames = getPixGridNeonMarqueeFrames()
    expect(frames).toHaveLength(4)
    for (const frame of frames) expect(frame).toHaveLength(PIX_GRID_NEON_MARQUEE_FRAME_CELL_COUNT * 3)
  })

  it('uses restrained physical-emitter values while preserving exact black handling', () => {
    expect(SETTINGS).toMatchObject({
      quality: 'high',
      backgroundMode: 'black',
      backgroundColor: '#000000',
      backgroundBrightness: 0,
      cellGap: 0.1,
      cellRoundness: 0.1,
      cellBrightness: 1,
      globalIntensity: 1,
      glowAmount: 0.08,
      diffusion: 0.04,
      rgbSubpixelMode: false,
    })
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).toContain('uniform float uGap')
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).toContain('uniform float uRoundness')
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).toContain('uniform float uGlow')
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).toContain('uniform float uDiffusion')
    expect(PIX_GRID_PRESENTATION_FRAGMENT_SHADER).toContain('vec3 inactiveCell = uBackground')
  })

  it('does not change the logical source framebuffer when presentation values change', () => {
    const state = presetState(false)
    const sourceFrame = sectionFrame('preDrop', 0, 0, 0, { autoPerformanceEnabled: false })
    const styled = composePixGridLogicalFrame(PRESET, state, sourceFrame)
    const contiguous = composePixGridLogicalFrame(PRESET, {
      ...state,
      cellGap: 0,
      cellRoundness: 0,
      glowAmount: 0,
      diffusion: 0,
    }, sourceFrame)

    expect(styled.width).toBe(160)
    expect(styled.height).toBe(90)
    expect(changedBytes(styled.pixels, contiguous.pixels)).toBe(0)
  })

  it('restores preset-owned presentation values after preset switching', () => {
    const marquee = applyPixGridPresetSettings(createDefaultPixGridState(), PRESET.id, SETTINGS)
    const bassPreset = PIX_GRID_PRESET_BY_ID.get('pix-grid-bass-beacon')!
    const bass = applyPixGridPresetSettings(marquee, bassPreset.id, bassPreset.pixGridSettings)
    const restored = applyPixGridPresetSettings(bass, PRESET.id, SETTINGS)

    expect([bass.cellGap, bass.cellRoundness, bass.glowAmount, bass.diffusion]).toEqual([0.18, 0.2, 0.36, 0.12])
    expect([restored.cellGap, restored.cellRoundness, restored.glowAmount, restored.diffusion]).toEqual([0.1, 0.1, 0.08, 0.04])
  })

  it('keeps every existing preset presentation value unchanged', () => {
    const expected = new Map([
      ['pix-grid-bass-beacon', [0.18, 0.2, 0.36, 0.12]],
      ['pix-grid-geometric-reactor', [0.12, 0.08, 0.28, 0.08]],
      ['pix-grid-pixel-parade', [0.22, 0.28, 0.22, 0.16]],
    ] as const)
    for (const [presetId, values] of expected) {
      const settings = PIX_GRID_PRESET_BY_ID.get(presetId)!.pixGridSettings!
      expect([settings.cellGap, settings.cellRoundness, settings.glowAmount, settings.diffusion]).toEqual(values)
    }
  })
})
