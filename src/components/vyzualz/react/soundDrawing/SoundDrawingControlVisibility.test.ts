import { describe, expect, it } from 'vitest'
import { DEFAULT_OSCILLATOR_SETTINGS, type OscillatorSettings } from '../ReactTypes'
import {
  resolveSoundDrawingControlCapabilities,
  shouldShowLivingRibbonControls,
} from './SoundDrawingControlVisibility'
import { SOUND_DRAWING_PERFORMANCE_SHOWS } from './SoundDrawingPerformanceShows'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from './SoundDrawingPerformanceTypes'

function settings(
  patch: Partial<typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS> = {},
): typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS {
  return {
    ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
    ...patch,
    livingRibbon: {
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.livingRibbon,
      ...(patch.livingRibbon ?? {}),
    },
    locks: {
      ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS.locks,
      ...(patch.locks ?? {}),
    },
  }
}

function oscillator(patch: Partial<OscillatorSettings> = {}): OscillatorSettings {
  return {
    ...DEFAULT_OSCILLATOR_SETTINGS,
    ...patch,
  }
}

function capabilities(
  oscPatch: Partial<OscillatorSettings> = {},
  performancePatch: Partial<typeof DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS> = {},
  isSvgOriginalArtwork = false,
) {
  return resolveSoundDrawingControlCapabilities({
    oscillator: oscillator(oscPatch),
    performanceSettings: settings(performancePatch),
    isSvgOriginalArtwork,
  })
}

describe('Sound Drawing preset-aware control visibility', () => {
  it('shows Living Ribbon controls only when the selected authored show actually uses that generator', () => {
    expect(shouldShowLivingRibbonControls(settings({ selectedShowId: 'livingRibbonSystem' }))).toBe(true)
    expect(shouldShowLivingRibbonControls(settings({
      selectedShowId: 'radialPressureSystem',
      generatorPreference: 'livingRibbon',
    }))).toBe(false)
  })

  it('hides path-only controls for dedicated Classic Scope renderers', () => {
    const waveform = capabilities({ sourceType: 'classic', classicMode: 'waveform' })
    expect(waveform.visualSize).toBe(false)
    expect(waveform.masterMotion).toBe(false)
    expect(waveform.masterGlow).toBe(false)
    expect(waveform.trailDecay).toBe(true)
    expect(waveform.renderMode).toBe(false)
    expect(waveform.duplicateTraces).toBe(false)
    expect(waveform.audioDisplacement).toBe(false)
    expect(waveform.bassScale).toBe(false)

    const spiral = capabilities({ sourceType: 'classic', classicMode: 'spiralScope' })
    expect(spiral.masterMotion).toBe(true)
    expect(spiral.visualSize).toBe(false)

    const professional = capabilities({ sourceType: 'classic', classicMode: 'professionalScope' })
    expect(professional.visualSize).toBe(true)
    expect(professional.masterGlow).toBe(true)
    expect(professional.masterMotion).toBe(false)
  })

  it('keeps the complete point-path capability surface for built-in shapes', () => {
    const result = capabilities({ sourceType: 'builtinShape' })
    expect(result).toMatchObject({
      visualSize: true,
      masterMotion: true,
      masterGlow: true,
      trailDecay: true,
      renderMode: true,
      duplicateTraces: true,
      rotationSpeed: true,
      mirror: true,
      audioDisplacement: true,
      audioDisplaceMode: true,
      bassScale: true,
      midTwist: true,
      altTwist: true,
      highJitter: true,
      beatBloom: true,
      pathResolution: true,
    })
  })

  it('switches text displacement controls to the text-waveform consumer without advertising both paths at once', () => {
    const plainText = capabilities({ sourceType: 'text', textWaveformMode: 'off' })
    expect(plainText.audioDisplacement).toBe(true)
    expect(plainText.audioDisplaceMode).toBe(true)
    expect(plainText.textWaveformMode).toBe(true)
    expect(plainText.textWaveformDetails).toBe(false)

    const waveformText = capabilities({ sourceType: 'text', textWaveformMode: 'normal' })
    expect(waveformText.audioDisplacement).toBe(false)
    expect(waveformText.audioDisplaceMode).toBe(false)
    expect(waveformText.textWaveformMode).toBe(true)
    expect(waveformText.textWaveformDetails).toBe(true)
  })

  it('keeps point-path controls for an SVG slot with no selected media because runtime falls back to a generated path', () => {
    const result = capabilities({ sourceType: 'svg', selectedSvgId: null, svgRenderMode: 'auto' }, {}, false)
    expect(result).toMatchObject({
      visualSize: true,
      masterMotion: true,
      masterGlow: true,
      renderMode: true,
      duplicateTraces: true,
      audioDisplacement: true,
      audioDisplaceMode: true,
      pathResolution: true,
      svgReactPalette: false,
    })
  })

  it('uses the native-artwork consumer contract instead of point-path controls for SVG Original Artwork', () => {
    const result = capabilities({ sourceType: 'svg', svgRenderMode: 'originalArtwork' }, {}, true)
    expect(result).toMatchObject({
      visualSize: true,
      masterMotion: true,
      masterGlow: false,
      trailDecay: true,
      renderMode: false,
      duplicateTraces: true,
      rotationSpeed: true,
      mirror: false,
      audioDisplacement: true,
      audioDisplaceMode: false,
      bassScale: true,
      midTwist: true,
      altTwist: true,
      highJitter: true,
      beatBloom: true,
      svgReactPalette: true,
      pathResolution: false,
    })
  })

  it('audits every authored Performance Show from its reachable generator families', () => {
    expect(SOUND_DRAWING_PERFORMANCE_SHOWS.map((show) => show.id)).toEqual([
      'radialPressureSystem',
      'harmonicRibbonReactor',
      'phaseKnotCathedral',
      'livingRibbonSystem',
      'stereoPulseStudy',
      'phaseOrbit',
      'scopeAndShape',
    ])

    const radial = capabilities({}, { selectedShowId: 'radialPressureSystem' })
    expect(radial.visualSize).toBe(true)
    expect(radial.masterMotion).toBe(true)
    expect(radial.masterGlow).toBe(true)
    expect(radial.audioDisplaceMode).toBe(true)
    expect(radial.audioDisplacement).toBe(false)
    expect(radial.highJitter).toBe(false)

    const harmonic = capabilities({}, { selectedShowId: 'harmonicRibbonReactor' })
    expect(harmonic.visualSize).toBe(true)
    expect(harmonic.masterMotion).toBe(false)
    expect(harmonic.masterGlow).toBe(false)
    expect(harmonic.masterBassReactivity).toBe(true)
    expect(harmonic.bassScale).toBe(false)

    const phaseKnot = capabilities({}, { selectedShowId: 'phaseKnotCathedral' })
    expect(phaseKnot.visualSize).toBe(true)
    expect(phaseKnot.masterMotion).toBe(true)
    expect(phaseKnot.masterGlow).toBe(true)
    expect(phaseKnot.bassScale).toBe(true)

    const ribbon = capabilities({}, { selectedShowId: 'livingRibbonSystem' })
    expect(ribbon.visualSize).toBe(false)
    expect(ribbon.masterMotion).toBe(false)
    expect(ribbon.masterGlow).toBe(true)
    expect(ribbon.masterBassReactivity).toBe(false)
    expect(ribbon.audioDisplaceMode).toBe(false)

    const stereo = capabilities({}, { selectedShowId: 'stereoPulseStudy' })
    expect(stereo.visualSize).toBe(true)
    expect(stereo.masterMotion).toBe(true)
    expect(stereo.masterGlow).toBe(true)
    expect(stereo.bassScale).toBe(true)

    const phaseOrbit = capabilities({}, { selectedShowId: 'phaseOrbit' })
    expect(phaseOrbit.visualSize).toBe(true)
    expect(phaseOrbit.masterMotion).toBe(false)
    expect(phaseOrbit.masterGlow).toBe(true)
    expect(phaseOrbit.bassScale).toBe(false)

    const scopeAndShape = capabilities({}, { selectedShowId: 'scopeAndShape' })
    expect(scopeAndShape.visualSize).toBe(true)
    expect(scopeAndShape.masterMotion).toBe(true)
    expect(scopeAndShape.masterGlow).toBe(true)
    expect(scopeAndShape.bassScale).toBe(true)
  })

  it('never exposes manual render/transform values that authored show layer construction overwrites', () => {
    for (const show of SOUND_DRAWING_PERFORMANCE_SHOWS) {
      const result = capabilities({}, { selectedShowId: show.id })
      expect(result.renderMode, show.id).toBe(false)
      expect(result.duplicateTraces, show.id).toBe(false)
      expect(result.rotationSpeed, show.id).toBe(false)
      expect(result.mirror, show.id).toBe(false)
      expect(result.audioDisplacement, show.id).toBe(false)
      expect(result.highJitter, show.id).toBe(false)
      expect(result.textLetterMotion, show.id).toBe(false)
      expect(result.textWaveformMode, show.id).toBe(false)
      expect(result.svgReactPalette, show.id).toBe(false)
      expect(result.pathResolution, show.id).toBe(false)
      expect(result.trailDecay, show.id).toBe(true)
    }
  })
})
