import { describe, expect, it } from 'vitest'
import { ShaderDefinitionValidator } from '../ShaderDefinitionValidator'
import {
  BASS_CATHEDRAL,
  LASER_LATTICE_OVERDRIVE,
  REACTOR,
  WOBBLE_GLYPH_FORGE,
  MELODIC_RIFT_BLOOM,
  RIDDIM_RAILGUN_SEQUENCER,
} from '../../scenes'

const PACK = [
  BASS_CATHEDRAL,
  LASER_LATTICE_OVERDRIVE,
  REACTOR,
  WOBBLE_GLYPH_FORGE,
  MELODIC_RIFT_BLOOM,
  RIDDIM_RAILGUN_SEQUENCER,
]

function allFragmentSource(scene: (typeof PACK)[number]): string {
  return [scene.fragSrc ?? '', ...(scene.passes ?? []).map(pass => pass.fragSrc)].join('\n')
}

describe('bass-reactor shader pack', () => {
  it('ships six stable, distinct, valid production scenes', () => {
    expect(PACK.map(scene => scene.id)).toEqual([
      'shader-bass-cathedral',
      'shader-laser-lattice-overdrive',
      'shader-reactor',
      'shader-wobble-glyph-forge',
      'shader-melodic-rift-bloom',
      'shader-riddim-railgun-sequencer',
    ])
    expect(new Set(PACK.map(scene => scene.id)).size).toBe(PACK.length)
    for (const scene of PACK) {
      expect(ShaderDefinitionValidator.validate(scene)).toEqual({ valid: true, errors: [] })
      expect(scene.tags?.some(tag => tag === 'brand-kit' || tag === 'brand-logo')).toBe(true)
      expect(scene.params.some(param => param.type === 'color' && param.brandRole === 'primary')).toBe(true)
      expect(scene.params.some(param => param.type === 'color' && param.brandRole === 'background')).toBe(true)
      expect(scene.transitions?.supportsGpuTransitions).toBe(true)
    }
  })

  it('routes the complete Music Intelligence contract through every scene', () => {
    const representativeUniforms = [
      'uSub', 'uRawBass', 'uRms',
      'uKickHit', 'uSnareHit', 'uHatHit', 'uTransientConfidence',
      'uBpmConfidence', 'uBeatIndex', 'uBarIndex',
      'uPhrase4Progress', 'uPhrase8Progress', 'uPhrase16Progress', 'uPhrase32Progress',
      'uSectionType', 'uSectionChangePulse',
      'uEnergyShortTerm', 'uEnergyLongTerm', 'uEnergyPercentile', 'uTrackEnergy',
      'uSpectralCentroid', 'uSpectralFlatness',
      'uChordCode', 'uPitchNormalized', 'uMelodyContourCode',
      'uVocalEnergy', 'uDrumEnergy', 'uBassStemEnergy',
      'uLyricActivity', 'uLyricWordHit',
      'uBuildConfidence', 'uDropConfidence', 'uFakeoutConfidence', 'uVocalHookConfidence',
      'uHasStems', 'uHasLyrics', 'uHasHarmonics', 'uHasSemantics',
      'uOverallConfidence',
      'uSpectrumTexture', 'uWaveformTexture',
    ]
    for (const scene of PACK) {
      const source = allFragmentSource(scene)
      for (const uniform of representativeUniforms) expect(source).toContain(uniform)
      expect(source).toContain('readMusicSignals')
    }
  })

  it('uses persistent feedback only where the concept benefits from trails or growth history', () => {
    const feedbackScenes = PACK.filter(scene => scene.quality?.requiresPersistentBuffers)
    expect(feedbackScenes.map(scene => scene.id)).toEqual([
      'shader-reactor',
    ])
    for (const scene of feedbackScenes) {
      expect(scene.feedback?.pingPongBuffers).toBe(1)
      expect(scene.feedbackReset?.onSceneChange).toBe(true)
      expect(scene.passes?.some(pass => pass.pingPong)).toBe(true)
    }
  })

  it('makes Reactor logo-native, media-capable, and composition-native', () => {
    const source = allFragmentSource(REACTOR)
    expect(source).toContain('renderSemanticModule')
    expect(source).toContain('renderShrapnelModule')
    expect(source).toContain('renderBrandModule')
    expect(source).toContain('brandLogoMask')
    expect(source).toContain('uBrandLogoTexture')
    expect(REACTOR.textureInputs?.map(input => input.source)).toEqual([
      'uploaded-image', 'album-artwork', 'media-output',
    ])
  })
})
