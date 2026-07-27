import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import type { ReactPreset, ReactTrackSection } from '../../ReactTypes'
import { normalizePixGridActionCue, resolvePixGridActionCueFrame } from '../PixGridActionCues'
import { preparePixGridPixelData, type PixGridPreparedAsset } from '../PixGridAssetPreparation'
import { composePixGridLogicalFrame, type PixGridLogicalFrame } from '../PixGridCompositor'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { resolvePixGridPerformanceFrame } from '../PixGridPerformanceRuntime'
import { applyPixGridRuntimeControls } from '../PixGridRuntimeControls'
import { PIX_GRID_PRESETS } from '../PixGridPresets'
import { applyPixGridPresetSettings } from '../PixGridState'
import type { PixGridAudioFrame, PixGridState } from '../PixGridTypes'
import { normalizePixGridState } from '../PixGridValidation'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.3, source: 'auto', confidence: 0.96 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 8, endSec: 24, intensity: 0.55, source: 'auto', confidence: 0.96 },
  { id: 'build', label: 'Build', type: 'build', startSec: 24, endSec: 30, intensity: 0.82, source: 'auto', confidence: 0.96 },
  { id: 'pre-drop', label: 'Pre-drop', type: 'preDrop', startSec: 30, endSec: 32, intensity: 0.28, source: 'auto', confidence: 0.96 },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 32, endSec: 64, intensity: 1, source: 'auto', confidence: 0.96, interpretation: { familyId: 'drop', occurrenceIndex: 1 } },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 64, endSec: 80, intensity: 0.4, source: 'auto', confidence: 0.96 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 80, endSec: 112, intensity: 1, source: 'auto', confidence: 0.96, interpretation: { familyId: 'drop', occurrenceIndex: 2 } },
]

function audioFrame(audioTime: number, patch: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  const beatIndex = Math.floor(audioTime * 2)
  return {
    audioTime,
    bass: 0.78,
    mid: 0.58,
    high: 0.42,
    volume: 0.72,
    beatHit: false,
    kickHit: false,
    snareHit: false,
    hatHit: false,
    beatPhase: audioTime * 2 - beatIndex,
    beatIndex,
    barIndex: Math.floor(beatIndex / 4),
    isPlaying: true,
    ...patch,
  }
}

function stateFor(preset: ReactPreset, sectionType: ReactTrackSection['type']): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
  const selectedSceneId = preset.sectionMappings.find(mapping => mapping.sectionType === sectionType)?.sceneId ?? applied.selectedSceneId
  return normalizePixGridState({ ...applied, quality: 'low', selectedSceneId })
}

function summary(frame: PixGridLogicalFrame) {
  let active = 0
  let dark = 0
  let luminance = 0
  let chroma = 0
  let hash = 2_166_136_261
  const colors = new Set<number>()
  for (let offset = 0; offset < frame.pixels.length; offset += 4) {
    const r = frame.pixels[offset]
    const g = frame.pixels[offset + 1]
    const b = frame.pixels[offset + 2]
    const a = frame.pixels[offset + 3]
    hash ^= r; hash = Math.imul(hash, 16_777_619)
    hash ^= g; hash = Math.imul(hash, 16_777_619)
    hash ^= b; hash = Math.imul(hash, 16_777_619)
    hash ^= a; hash = Math.imul(hash, 16_777_619)
    if (a === 0) {
      dark += 1
      continue
    }
    active += 1
    luminance += r + g + b
    chroma += Math.max(r, g, b) - Math.min(r, g, b)
    colors.add((r << 16) | (g << 8) | b)
  }
  return { active, dark, luminance, chroma, uniqueColors: colors.size, hash: hash >>> 0 }
}

function difference(a: PixGridLogicalFrame, b: PixGridLogicalFrame) {
  let changed = 0
  let center = 0
  let border = 0
  let upper = 0
  let lower = 0
  let luminanceDelta = 0
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const offset = (y * a.width + x) * 4
      let cellChanged = false
      for (let channel = 0; channel < 4; channel += 1) {
        if (a.pixels[offset + channel] !== b.pixels[offset + channel]) cellChanged = true
      }
      if (!cellChanged) continue
      changed += 1
      const nx = (x + 0.5) / a.width
      const ny = (y + 0.5) / a.height
      if (nx >= 0.3 && nx <= 0.7 && ny >= 0.25 && ny <= 0.75) center += 1
      if (nx < 0.12 || nx > 0.88 || ny < 0.12 || ny > 0.88) border += 1
      if (ny < 0.4) upper += 1
      if (ny > 0.6) lower += 1
      luminanceDelta += (b.pixels[offset] + b.pixels[offset + 1] + b.pixels[offset + 2])
        - (a.pixels[offset] + a.pixels[offset + 1] + a.pixels[offset + 2])
    }
  }
  return { changed, center, border, upper, lower, luminanceDelta }
}

function expectReadableFrame(frame: PixGridLogicalFrame): void {
  const metrics = summary(frame)
  expect(frame).toMatchObject({ width: 96, height: 54 })
  expect(frame.pixels).toHaveLength(96 * 54 * 4)
  expect(metrics.active).toBeGreaterThan(24)
  expect(metrics.uniqueColors).toBeGreaterThan(0)
  expect(metrics.chroma).toBeGreaterThan(0)
}

function preparedPattern(mediaId: string, kind: 'raster' | 'svg', palette?: ReactPreset['palette']): PixGridPreparedAsset {
  const width = 96
  const height = 54
  const raw = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside = kind === 'raster'
        ? x > 8 && x < width - 9 && y > 7 && y < height - 8 && ((x >> 3) + (y >> 3)) % 2 === 0
        : (Math.abs(x - width / 2) < 4 || Math.abs(y - height / 2) < 3 || Math.abs(x - y * 1.7) < 2)
      if (!inside) continue
      const offset = (y * width + x) * 4
      raw[offset] = kind === 'raster' ? 236 : 32
      raw[offset + 1] = kind === 'raster' ? 72 : 220
      raw[offset + 2] = kind === 'raster' ? 38 : 248
      raw[offset + 3] = 255
    }
  }
  const settings = {
    ...createDefaultPixGridState().conversion,
    colorMode: palette ? 'brand' as const : 'original' as const,
    brandStrength: 1,
    preserveBlack: true,
    preserveWhite: true,
  }
  const pixels = palette
    ? preparePixGridPixelData({ pixels: raw, width, height, settings, palette })
    : new Uint8Array(raw)
  return {
    key: `${mediaId}-1`,
    mediaId,
    mediaRevision: 1,
    width,
    height,
    pixels,
    approximateBytes: pixels.byteLength,
    ...(kind === 'svg' ? { svgGroupCandidates: [{ id: 'svg-cross', name: 'Cross', kind: 'path' as const, elementId: 'cross', fillColor: '#20dcf8' }] } : {}),
  }
}

function mediaState(preset: ReactPreset, mediaId: string): PixGridState {
  const state = stateFor(preset, 'verse')
  return normalizePixGridState({
    ...state,
    layers: state.layers.map(layer => ({ ...layer, visible: false })),
    conversion: { ...state.conversion, selectedMediaId: mediaId },
  })
}

function performanceFrame(preset: ReactPreset, timeSec: number) {
  const beatIndex = Math.floor(timeSec * 2)
  const frame = {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.round(timeSec * 60),
    sourceId: 'pixel-regression-track',
    trackId: 'pixel-regression-track',
    bands: { ...DEFAULT_MI_FRAME.bands, bass: 0.8, mid: 0.6, high: 0.45, normalizedBass: 0.8, normalizedMid: 0.6, normalizedHigh: 0.45, volume: 0.75 },
    rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, bpmConfidence: 1, beatIndex, beatPhase: 0, beatInBar: beatIndex % 4, barIndex: Math.floor(beatIndex / 4), beatHit: true, downbeatHit: beatIndex % 4 === 0 },
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: true, sections: true, trackEnergyCurve: true },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.96, rhythm: 1, section: 0.96 },
  }
  const context = buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame,
    resolvedSections: SECTIONS,
    durationSec: 112,
    trackIdentity: 'pixel-regression-track',
    seekIdentity: 'seek-0',
    loopIdentity: 'loop-0',
    trackChangeIdentity: 'pixel-regression-track',
    previous: null,
  })
  return resolvePixGridPerformanceFrame(stateFor(preset, 'drop'), context, preset.id)
}

describe('PixGrid rendered-pixel regression matrix', () => {
  const [bassBeacon, geometricReactor, pixelParade] = PIX_GRID_PRESETS

  it.each([
    ['Bass Beacon intro', bassBeacon, 'intro', 2],
    ['Bass Beacon drop', bassBeacon, 'drop', 40],
    ['Geometric Reactor build', geometricReactor, 'build', 28],
    ['Geometric Reactor drop', geometricReactor, 'drop', 42],
    ['Pixel Parade verse', pixelParade, 'verse', 16],
    ['Pixel Parade Drop 2', pixelParade, 'drop', 88],
  ] as const)('renders a readable, chromatic %s frame', (_name, preset, section, timeSec) => {
    expectReadableFrame(composePixGridLogicalFrame(preset, stateFor(preset, section), audioFrame(timeSec, {
      sectionOccurrence: timeSec >= 80 ? 2 : 1,
    })))
  })

  it('renders stable High and Ultra logical frames with visibly greater cell fidelity than Low', () => {
    const lowState = stateFor(bassBeacon, 'drop')
    const highState = normalizePixGridState({ ...lowState, quality: 'high' })
    const ultraState = normalizePixGridState({ ...lowState, quality: 'ultra' })
    const clock = audioFrame(40, { beatHit: true, kickHit: true })
    const low = composePixGridLogicalFrame(bassBeacon, lowState, clock)
    const high = composePixGridLogicalFrame(bassBeacon, highState, clock)
    const ultra = composePixGridLogicalFrame(bassBeacon, ultraState, clock)
    const ultraRepeat = composePixGridLogicalFrame(bassBeacon, ultraState, clock)

    expect(low).toMatchObject({ width: 96, height: 54 })
    expect(high).toMatchObject({ width: 160, height: 90 })
    expect(ultra).toMatchObject({ width: 256, height: 144 })
    expect(summary(high).active).toBeGreaterThan(summary(low).active)
    expect(summary(ultra).active).toBeGreaterThan(summary(high).active)
    expect(summary(ultraRepeat).hash).toBe(summary(ultra).hash)
  })

  it('renders imported raster and SVG pixels instead of a blank or smoothed frame', () => {
    const raster = preparedPattern('regression-raster', 'raster')
    const svg = preparedPattern('regression-svg', 'svg')
    const rasterFrame = composePixGridLogicalFrame(bassBeacon, mediaState(bassBeacon, raster.mediaId), audioFrame(12), undefined, raster)
    const svgFrame = composePixGridLogicalFrame(bassBeacon, mediaState(bassBeacon, svg.mediaId), audioFrame(12), undefined, svg)

    expectReadableFrame(rasterFrame)
    expectReadableFrame(svgFrame)
    expect(summary(rasterFrame).dark).toBeGreaterThan(24)
    expect(summary(svgFrame).dark).toBeGreaterThan(24)
    expect(summary(rasterFrame).hash).not.toBe(summary(svgFrame).hash)
    expect(svg.svgGroupCandidates).toHaveLength(1)
  })

  it('renders Brand Kit palette conversion without collapsing saturated colors to white', () => {
    const palette = { primary: '#00d7ff', secondary: '#00c978', accent: '#754dff', background: '#000000', highlight: '#84ffe0', text: '#ffffff' }
    const brandPreset = { ...bassBeacon, palette }
    const prepared = preparedPattern('regression-brand', 'raster', palette)
    const frame = composePixGridLogicalFrame(brandPreset, mediaState(brandPreset, prepared.mediaId), audioFrame(12), undefined, prepared)
    const metrics = summary(frame)
    let whitePixels = 0
    for (let offset = 0; offset < frame.pixels.length; offset += 4) {
      if (frame.pixels[offset + 3] > 0 && frame.pixels[offset] > 245 && frame.pixels[offset + 1] > 245 && frame.pixels[offset + 2] > 245) whitePixels += 1
    }
    expectReadableFrame(frame)
    expect(metrics.chroma).toBeGreaterThan(metrics.active * 30)
    expect(whitePixels).toBe(0)
  })

  it('changes actual pixels for smart-group kick and snare reactions', () => {
    const state = stateFor(bassBeacon, 'drop')
    const calm = composePixGridLogicalFrame(bassBeacon, state, audioFrame(40))
    const kick = composePixGridLogicalFrame(bassBeacon, state, audioFrame(40, { beatHit: true, kickHit: true }))
    const snare = composePixGridLogicalFrame(bassBeacon, state, audioFrame(40, { beatHit: true, snareHit: true }))

    expect(summary(kick).hash).not.toBe(summary(calm).hash)
    expect(summary(snare).hash).not.toBe(summary(calm).hash)
    expect(summary(kick).luminance).toBeGreaterThan(0)
    expect(summary(snare).luminance).toBeGreaterThan(0)
  })

  it.each(PIX_GRID_PRESETS)('$name separates silence, kick, snare, and bass in rendered pixels', preset => {
    const state = stateFor(preset, 'drop')
    const silence = composePixGridLogicalFrame(preset, state, audioFrame(40, {
      bass: 0,
      mid: 0,
      high: 0,
      volume: 0,
      sourceValues: { bass: 0, kick: 0, snare: 0, hat: 0 },
    }))
    const kick = composePixGridLogicalFrame(preset, state, audioFrame(40, {
      bass: 0.82,
      beatHit: true,
      kickHit: true,
      sourceValues: { bass: 0.82, kick: 1 },
    }))
    const snare = composePixGridLogicalFrame(preset, state, audioFrame(40, {
      bass: 0,
      beatHit: true,
      snareHit: true,
      sourceValues: { bass: 0, snare: 1 },
    }))
    const lowBass = composePixGridLogicalFrame(preset, state, audioFrame(40, {
      bass: 0.12,
      sourceValues: { bass: 0.12 },
    }))
    const highBass = composePixGridLogicalFrame(preset, state, audioFrame(40, {
      bass: 0.94,
      sourceValues: { bass: 0.94 },
    }))
    const kickDelta = difference(silence, kick)
    const snareDelta = difference(silence, snare)

    expect(kickDelta.changed).toBeGreaterThan(12)
    expect(snareDelta.changed).toBeGreaterThan(8)
    expect(summary(kick).hash).not.toBe(summary(snare).hash)
    expect(summary(highBass).luminance).toBeGreaterThan(summary(lowBass).luminance)

    if (preset.id === 'pix-grid-pixel-parade') {
      expect(kickDelta.lower).toBeGreaterThan(kickDelta.upper)
      expect(snareDelta.upper).toBeGreaterThan(snareDelta.lower)
    } else {
      expect(kickDelta.center).toBeGreaterThan(0)
      expect(snareDelta.border).toBeGreaterThan(0)
    }
  })

  it.each(PIX_GRID_PRESETS)('$name renders build, pre-drop, drop, and Drop 2 as distinct song states', preset => {
    const verse = composePixGridLogicalFrame(preset, stateFor(preset, 'verse'), audioFrame(16, { bass: 0.42, volume: 0.5 }))
    const build = composePixGridLogicalFrame(preset, stateFor(preset, 'build'), audioFrame(28, { bass: 0.62, volume: 0.68 }))
    const preDrop = composePixGridLogicalFrame(preset, stateFor(preset, 'preDrop'), audioFrame(31, {
      bass: 0.08,
      mid: 0.12,
      high: 0.08,
      volume: 0.14,
      sourceValues: { bass: 0.08 },
    }))
    const drop = composePixGridLogicalFrame(preset, stateFor(preset, 'drop'), audioFrame(32, {
      bass: 0.92,
      beatHit: true,
      kickHit: true,
      sourceValues: { bass: 0.92, kick: 1 },
    }))
    const dropOne = performanceFrame(preset, 40)
    const dropTwo = performanceFrame(preset, 88)
    const clock = audioFrame(40, { beatIndex: 80, barIndex: 20 })
    const renderedDropOne = composePixGridLogicalFrame(preset, dropOne.state, clock, undefined, undefined, undefined, undefined, dropOne.groupEffects)
    const renderedDropTwo = composePixGridLogicalFrame(preset, dropTwo.state, clock, undefined, undefined, undefined, undefined, dropTwo.groupEffects)

    expect(summary(build).hash).not.toBe(summary(verse).hash)
    expect(summary(preDrop).active).toBeLessThan(summary(drop).active)
    expect(summary(preDrop).luminance).toBeLessThan(summary(drop).luminance)
    expect(summary(renderedDropTwo).hash).not.toBe(summary(renderedDropOne).hash)
  })

  it.each(PIX_GRID_PRESETS)('$name scales bass output without scaling snare and keeps Motion 0 event-reactive', preset => {
    const state = stateFor(preset, 'drop')
    const bassFrame = audioFrame(40, { bass: 0.9, sourceValues: { bass: 0.9 } })
    const bassOff = composePixGridLogicalFrame(preset, state, applyPixGridRuntimeControls(bassFrame, { bassReactivity: 0, motion: 0 }))
    const bassMid = composePixGridLogicalFrame(preset, state, applyPixGridRuntimeControls(bassFrame, { bassReactivity: 0.5, motion: 0 }))
    const bassFull = composePixGridLogicalFrame(preset, state, applyPixGridRuntimeControls(bassFrame, { bassReactivity: 1, motion: 0 }))
    const snareOff = composePixGridLogicalFrame(preset, state, applyPixGridRuntimeControls(audioFrame(40, {
      bass: 0,
      snareHit: true,
      sourceValues: { bass: 0, snare: 1 },
    }), { bassReactivity: 0, motion: 0 }))
    const snareFull = composePixGridLogicalFrame(preset, state, applyPixGridRuntimeControls(audioFrame(40, {
      bass: 0,
      snareHit: true,
      sourceValues: { bass: 0, snare: 1 },
    }), { bassReactivity: 1, motion: 0 }))

    expect(summary(bassMid).luminance).toBeGreaterThanOrEqual(summary(bassOff).luminance)
    expect(summary(bassFull).luminance).toBeGreaterThan(summary(bassMid).luminance)
    expect(summary(snareOff).hash).toBe(summary(snareFull).hash)
    expect(summary(snareOff).hash).not.toBe(summary(bassOff).hash)
  })

  it.each(PIX_GRID_PRESETS)('$name freezes autonomous motion at Motion 0 while Motion 1 advances', preset => {
    const state = stateFor(preset, 'verse')
    const stillA = composePixGridLogicalFrame(preset, state, applyPixGridRuntimeControls(audioFrame(16), { bassReactivity: 0, motion: 0 }))
    const stillB = composePixGridLogicalFrame(preset, state, applyPixGridRuntimeControls(audioFrame(18), { bassReactivity: 0, motion: 0 }))
    const movingA = composePixGridLogicalFrame(preset, state, applyPixGridRuntimeControls(audioFrame(16), { bassReactivity: 0, motion: 1 }))
    const movingB = composePixGridLogicalFrame(preset, state, applyPixGridRuntimeControls(audioFrame(18), { bassReactivity: 0, motion: 1 }))

    expect(summary(stillB).hash).toBe(summary(stillA).hash)
    expect(summary(movingB).hash).not.toBe(summary(movingA).hash)
  })

  it.each(PIX_GRID_PRESETS)('$name normalizes reaction coverage across logical resolutions', preset => {
    const ratios: number[] = []
    for (const quality of ['draft', 'low', 'high', 'ultra'] as const) {
      const state = normalizePixGridState({ ...stateFor(preset, 'drop'), quality })
      const quiet = composePixGridLogicalFrame(preset, state, audioFrame(40, { bass: 0, sourceValues: { bass: 0, kick: 0 } }))
      const active = composePixGridLogicalFrame(preset, state, audioFrame(40, {
        bass: 0.88,
        kickHit: true,
        sourceValues: { bass: 0.88, kick: 1 },
      }))
      ratios.push(difference(quiet, active).changed / (active.width * active.height))
    }
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(0.12)
  })

  it('renders four-bar choreography evolution as a changed framebuffer', () => {
    const earlyPerformance = performanceFrame(geometricReactor, 34)
    const evolvedPerformance = performanceFrame(geometricReactor, 58)
    const stableClock = audioFrame(40, { beatIndex: 80, barIndex: 20 })
    const early = composePixGridLogicalFrame(geometricReactor, earlyPerformance.state, stableClock, undefined, undefined, undefined, undefined, earlyPerformance.groupEffects)
    const evolved = composePixGridLogicalFrame(geometricReactor, evolvedPerformance.state, stableClock, undefined, undefined, undefined, undefined, evolvedPerformance.groupEffects)

    expectReadableFrame(early)
    expectReadableFrame(evolved)
    expect(summary(evolved).hash).not.toBe(summary(early).hash)
  })

  it('renders a Track Map cue transition between source and target pixels', () => {
    const state = stateFor(pixelParade, 'verse')
    const cue = normalizePixGridActionCue({
      version: 1,
      id: 'pixel-regression-transition',
      timeSec: 10,
      label: 'Drop transition',
      enabled: true,
      engineId: 'pixGrid',
      action: { type: 'selectScene', sceneId: pixelParade.sectionMappings.find(mapping => mapping.sectionType === 'drop')!.sceneId },
      quantization: 'bar',
      transition: 'columnWipe',
      transitionDurationSec: 2,
      oneShotDurationSec: 0.5,
      loopBehavior: 'retrigger',
      order: 0,
    })!
    const resolved = resolvePixGridActionCueFrame(state, [cue], 11)
    const source = composePixGridLogicalFrame(pixelParade, state, audioFrame(11))
    const target = composePixGridLogicalFrame(pixelParade, resolved.state, audioFrame(11))
    const transitioned = composePixGridLogicalFrame(pixelParade, resolved.state, audioFrame(11), undefined, undefined, undefined, resolved.transition)

    expect(resolved.transition).toMatchObject({ type: 'columnWipe', progress: 0.5 })
    expect(summary(transitioned).hash).not.toBe(summary(source).hash)
    expect(summary(transitioned).hash).not.toBe(summary(target).hash)
  })

  it('keeps pause and seek reconstruction deterministic', () => {
    const state = stateFor(pixelParade, 'drop')
    const first = composePixGridLogicalFrame(pixelParade, state, audioFrame(88))
    composePixGridLogicalFrame(pixelParade, state, audioFrame(97))
    const seekReconstruction = composePixGridLogicalFrame(pixelParade, state, audioFrame(88, { timingDiscontinuity: true }))
    const paused = composePixGridLogicalFrame(pixelParade, state, audioFrame(88, { isPlaying: false }))

    expect(summary(seekReconstruction).hash).toBe(summary(first).hash)
    expect(summary(paused).hash).toBe(summary(first).hash)
  })
})
