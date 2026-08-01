import type { ReactPreset, ReactSectionType } from '../../../ReactTypes'
import { createDefaultPixGridState } from '../../PixGridDefaults'
import { applyPixGridPresetSettings } from '../../PixGridState'
import type {
  PixGridAudioFrame,
  PixGridBuiltInAssetId,
  PixGridLayer,
  PixGridState,
} from '../../PixGridTypes'

export const PIX_GRID_MARQUEE_STABLE_UNDERLAY_FRAME_IDS = ['base', 'rise', 'peak', 'release'] as const
export type PixGridMarqueeStableUnderlayFrameId = typeof PIX_GRID_MARQUEE_STABLE_UNDERLAY_FRAME_IDS[number]

export const PIX_GRID_MARQUEE_LETTER_LAYER_IDS = [
  'marquee-letter-lights-a',
  'marquee-letter-lights-b',
  'marquee-letter-lights-c',
] as const

const ALL_LAYER_IDS = [
  'marquee-structure',
  'marquee-bulbs-a',
  'marquee-bulbs-b',
  'marquee-bulbs-c',
  'marquee-bulbs-d',
  ...PIX_GRID_MARQUEE_LETTER_LAYER_IDS,
  'marquee-equalizer-lights',
  'marquee-trim-lights',
  'marquee-focal-lights',
  'marquee-sparkle-lights',
] as const

export type PixGridMarqueeStableUnderlayFixtureId =
  | 'all-lighting-active'
  | 'only-structure-active'
  | 'one-letter-bank-active'
  | 'all-letter-banks-off'
  | 'pre-drop-scene'
  | 'drop-scene'

export interface PixGridMarqueeStableUnderlayFixtureSpec {
  id: PixGridMarqueeStableUnderlayFixtureId
  sectionType: ReactSectionType
  visibleLayerIds?: readonly string[]
  hideLetterBanks?: boolean
  freezeAnimatedMasks?: boolean
  expectedBeforeHashes: readonly [number, number, number, number]
  expectedAfterHashes: readonly [number, number, number, number]
}

/**
 * Paired logical-frame snapshots. "Before" swaps only the structure asset back
 * to the preserved exclusive compatibility asset; every other state, scene,
 * animation clock, source frame, and layer remains identical.
 */
export const PIX_GRID_MARQUEE_STABLE_UNDERLAY_FIXTURES: readonly PixGridMarqueeStableUnderlayFixtureSpec[] = [
  {
    id: 'all-lighting-active',
    sectionType: 'drop',
    visibleLayerIds: ALL_LAYER_IDS,
    freezeAnimatedMasks: true,
    expectedBeforeHashes: [3_837_141_904, 3_803_287_282, 1_186_564_110, 783_804_583],
    expectedAfterHashes: [3_837_141_904, 3_803_287_282, 1_186_564_110, 783_804_583],
  },
  {
    id: 'only-structure-active',
    sectionType: 'drop',
    visibleLayerIds: ['marquee-structure'],
    freezeAnimatedMasks: true,
    expectedBeforeHashes: [207_775_016, 3_938_269_786, 1_916_625_077, 1_591_766_667],
    expectedAfterHashes: [3_173_658_545, 2_567_637_377, 1_841_788_870, 776_444_625],
  },
  {
    id: 'one-letter-bank-active',
    sectionType: 'drop',
    visibleLayerIds: ['marquee-structure', 'marquee-letter-lights-a'],
    freezeAnimatedMasks: true,
    expectedBeforeHashes: [1_268_641_305, 2_193_036_626, 2_642_290_211, 1_591_766_667],
    expectedAfterHashes: [4_109_688_237, 3_680_667_225, 2_941_173_955, 776_444_625],
  },
  {
    id: 'all-letter-banks-off',
    sectionType: 'drop',
    hideLetterBanks: true,
    expectedBeforeHashes: [2_156_617_189, 1_318_030_588, 3_014_989_498, 3_865_887_052],
    expectedAfterHashes: [2_087_761_754, 378_700_275, 4_130_643_464, 2_757_925_803],
  },
  {
    id: 'pre-drop-scene',
    sectionType: 'preDrop',
    expectedBeforeHashes: [908_667_131, 3_477_055_917, 1_557_000_025, 2_276_081_657],
    expectedAfterHashes: [861_514_074, 954_221_750, 1_728_039_270, 3_960_922_515],
  },
  {
    id: 'drop-scene',
    sectionType: 'drop',
    expectedBeforeHashes: [2_318_065_217, 3_887_303_792, 2_754_008_102, 3_865_887_052],
    expectedAfterHashes: [3_814_809_702, 2_169_518_685, 3_127_465_757, 2_757_925_803],
  },
] as const

function fixtureLayers(
  layers: readonly PixGridLayer[],
  fixture: PixGridMarqueeStableUnderlayFixtureSpec,
  structureAssetId: PixGridBuiltInAssetId,
): PixGridLayer[] {
  const visibleLayerIds = fixture.visibleLayerIds ? new Set(fixture.visibleLayerIds) : null
  const hiddenLetters = fixture.hideLetterBanks ? new Set<string>(PIX_GRID_MARQUEE_LETTER_LAYER_IDS) : null
  return layers.map(layer => ({
    ...layer,
    assetId: layer.id === 'marquee-structure' ? structureAssetId : layer.assetId,
    visible: visibleLayerIds ? visibleLayerIds.has(layer.id) : layer.visible && !hiddenLetters?.has(layer.id),
    animations: fixture.freezeAnimatedMasks
      ? layer.animations.filter(animation => animation.mode === 'frameCycle')
      : layer.animations.map(animation => ({ ...animation })),
  }))
}

export function createPixGridMarqueeStableUnderlayFixtureState(
  preset: ReactPreset,
  fixture: PixGridMarqueeStableUnderlayFixtureSpec,
  structureAssetId: 'pix-neon-marquee-structure' | 'pix-neon-marquee-stable-underlay',
): PixGridState {
  const applied = applyPixGridPresetSettings(createDefaultPixGridState(), preset.id, preset.pixGridSettings)
  return {
    ...applied,
    selectedSceneId: `${preset.id}-${fixture.sectionType}`,
    layers: fixtureLayers(applied.layers, fixture, structureAssetId),
    globalIntensity: 1,
    cellBrightness: 1,
    glowAmount: 0,
    diffusion: 0,
    performance: { ...applied.performance, enabled: false },
  }
}

export function createPixGridMarqueeStableUnderlayFixtureFrame(
  fixture: PixGridMarqueeStableUnderlayFixtureSpec,
  frameIndex: number,
): PixGridAudioFrame {
  const sectionBeat = fixture.sectionType === 'preDrop' ? 2.75 : 1.5
  const sectionBar = sectionBeat / 4
  return {
    audioTime: 20 + frameIndex,
    bass: 0,
    mid: 0,
    high: 0,
    volume: 0,
    beatHit: false,
    beatPhase: 0.37,
    isPlaying: true,
    beatIndex: 80 + frameIndex,
    barIndex: 20,
    beatsSinceSectionStart: sectionBeat,
    barsSinceSectionStart: sectionBar,
    sectionType: fixture.sectionType,
    sectionProgress: 0.5,
    motionClockSectionType: fixture.sectionType,
    motionClockSectionBeat: sectionBeat,
    motionClockSectionBar: sectionBar,
    signClock: frameIndex,
    motionClockSign: frameIndex,
    signTransitionClock: null,
    motionClockSignTransition: null,
    autoPerformanceEnabled: false,
    sourceValues: {},
    motionMultiplier: 1,
    bassReactivityGain: 0,
  }
}

export function fnv1aPixGridLogicalFrame(bytes: Uint8Array): number {
  let hash = 2_166_136_261
  for (const value of bytes) {
    hash ^= value
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}
