import type { ReactPreset, ReactSectionType } from '../../../ReactTypes'
import { PIX_GRID_NEON_MARQUEE_SIGN_CADENCE } from '../../PixGridSignClock'
import type {
  PixGridGroup,
  PixGridLayer,
  PixGridLayerAnimation,
  PixGridPresetSettings,
  PixGridSceneSettings,
} from '../../PixGridTypes'

/**
 * Test-only reconstruction of a retired four-frame sign document.
 *
 * It deliberately uses neutral surviving artwork and no performance program so
 * Stage 3 runtime/transition coverage can remain without re-registering any of
 * the removed Marquee catalog, program, frame, mask, or ownership modules.
 */
export const PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET_ID = 'pix-grid-neon-marquee-cycle'

const SECTION_TYPES: ReactSectionType[] = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro']
const TRANSITION_SEED = 0x4d415251

const SIGN_FRAME_ANIMATION: PixGridLayerAnimation = {
  mode: 'frameCycle',
  clock: 'sign',
  speed: 1,
  amount: 1,
  phase: 0,
  boundary: 'wrap',
  stepped: true,
  sectionSpeeds: PIX_GRID_NEON_MARQUEE_SIGN_CADENCE,
  frameTransition: {
    type: 'crossfade',
    durationFraction: 1 / 8,
    easing: 'easeOut',
    seedMode: 'frame',
    seed: TRANSITION_SEED,
  },
  sectionFrameTransitions: {
    intro: {
      type: 'powerOn',
      durationFraction: 0.75,
      easing: 'easeOut',
      seedMode: 'section',
      seed: TRANSITION_SEED,
      onSectionEntry: true,
    },
    verse: {
      type: 'crossfade',
      durationFraction: 1 / 8,
      easing: 'easeOut',
      seedMode: 'frame',
      seed: TRANSITION_SEED,
    },
    build: {
      type: 'rowWipe',
      durationFraction: 1 / 8,
      easing: 'easeInOut',
      seedMode: 'section',
      seed: TRANSITION_SEED,
      direction: 'forward',
    },
    preDrop: { type: 'cut', durationFraction: 0, seedMode: 'fixed', seed: TRANSITION_SEED },
    drop: {
      type: 'radialReveal',
      durationFraction: 1 / 8,
      easing: 'easeOut',
      seedMode: 'frame',
      seed: TRANSITION_SEED,
      origin: { x: 0.5, y: 0.5 },
    },
    breakdown: {
      type: 'crossfade',
      durationFraction: 1 / 8,
      easing: 'easeInOut',
      seedMode: 'frame',
      seed: TRANSITION_SEED,
    },
    bridge: {
      type: 'columnWipe',
      durationFraction: 1 / 8,
      easing: 'easeInOut',
      seedMode: 'section',
      seed: TRANSITION_SEED,
    },
    outro: {
      type: 'powerOff',
      durationFraction: 0.75,
      easing: 'easeIn',
      seedMode: 'section',
      seed: TRANSITION_SEED,
      onSectionEntry: true,
      holdAfterCompletion: true,
    },
    unknown: {
      type: 'crossfade',
      durationFraction: 1 / 8,
      easing: 'linear',
      seedMode: 'frame',
      seed: TRANSITION_SEED,
    },
  },
}

function layer(id: string, zIndex: number, opacity = 1): PixGridLayer {
  return {
    id,
    name: id,
    assetId: id === 'marquee-structure' ? 'pix-mascot-face' : 'pix-checkerboard',
    visible: true,
    opacity: zIndex === 0 ? opacity : opacity * 0.08,
    position: { x: 0.5, y: 0.5 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    flipX: false,
    flipY: false,
    blendMode: zIndex === 0 ? 'normal' : 'add',
    paletteMap: {},
    zIndex,
    clipMode: 'clip',
    maskAssetId: null,
    animations: [
      { ...SIGN_FRAME_ANIMATION, sectionSpeeds: { ...SIGN_FRAME_ANIMATION.sectionSpeeds } },
      ...(zIndex === 0 ? [] : [{
        mode: 'blink' as const,
        clock: 'sectionBeat' as const,
        speed: 0.5,
        amount: 0.45,
        inactiveOpacity: 0.05,
        phase: (zIndex % 4) / 4,
        boundary: 'wrap' as const,
        stepped: true,
      }]),
    ],
    densityRank: Math.min(0.95, zIndex / 12),
    seed: 1207 + zIndex * 13,
  }
}

const LAYERS: PixGridLayer[] = [
  layer('marquee-structure', 0),
  layer('marquee-bulbs-a', 1, 0.78),
  layer('marquee-bulbs-b', 2, 0.78),
  layer('marquee-bulbs-c', 3, 0.78),
  layer('marquee-bulbs-d', 4, 0.78),
  layer('marquee-letter-lights-a', 5, 0.72),
  layer('marquee-letter-lights-b', 6, 0.72),
  layer('marquee-letter-lights-c', 7, 0.72),
  layer('marquee-equalizer-lights', 8, 0.66),
  layer('marquee-trim-lights', 9, 0.62),
  layer('marquee-focal-lights', 10, 0.58),
  layer('marquee-sparkle-lights', 11, 0.42),
]

function group(id: string, layerScope: string[], priority: number): PixGridGroup {
  return {
    id,
    name: id,
    source: 'layerAlpha',
    mask: { kind: 'layerAlpha', threshold: 0.01, foreground: true },
    cellRuns: [],
    layerId: layerScope[0] ?? null,
    layerScope,
    smartRuleId: 'layerAlpha',
    enabled: true,
    visible: true,
    contentVisible: true,
    priority,
    overlapBehavior: 'stack',
    reactions: [],
    displayColor: '#ffffff',
  }
}

const GROUPS: PixGridGroup[] = [
  group('marquee-structure-group', ['marquee-structure'], 0),
  group('marquee-perimeter-group', ['marquee-bulbs-a', 'marquee-bulbs-b', 'marquee-bulbs-c', 'marquee-bulbs-d'], 20),
  group('marquee-bulb-a-group', ['marquee-bulbs-a'], 24),
  group('marquee-bulb-b-group', ['marquee-bulbs-b'], 25),
  group('marquee-bulb-c-group', ['marquee-bulbs-c'], 26),
  group('marquee-bulb-d-group', ['marquee-bulbs-d'], 27),
  group('marquee-letter-group', ['marquee-letter-lights-a', 'marquee-letter-lights-b', 'marquee-letter-lights-c'], 35),
  group('marquee-letter-travel-group', ['marquee-letter-lights-a', 'marquee-letter-lights-b', 'marquee-letter-lights-c'], 36),
  group('marquee-equalizer-group', ['marquee-equalizer-lights'], 42),
  group('marquee-trim-group', ['marquee-trim-lights'], 44),
  group('marquee-focal-group', ['marquee-focal-lights'], 48),
  group('marquee-sparkle-group', ['marquee-sparkle-lights'], 50),
  group('marquee-transition-group', ['marquee-trim-lights', 'marquee-bulbs-a', 'marquee-bulbs-c'], 55),
  group('marquee-impact-group', ['marquee-focal-lights', 'marquee-equalizer-lights', 'marquee-trim-lights'], 60),
]

function settingsFor(section: ReactSectionType): PixGridSceneSettings {
  const hiddenLayerIds = section === 'intro'
    ? ['marquee-letter-lights-b', 'marquee-letter-lights-c', 'marquee-equalizer-lights', 'marquee-sparkle-lights']
    : section === 'preDrop'
      ? ['marquee-letter-lights-a', 'marquee-letter-lights-c', 'marquee-equalizer-lights', 'marquee-trim-lights', 'marquee-sparkle-lights']
      : section === 'breakdown'
        ? ['marquee-letter-lights-a', 'marquee-letter-lights-c', 'marquee-trim-lights', 'marquee-sparkle-lights']
        : section === 'outro'
          ? ['marquee-letter-lights-b', 'marquee-letter-lights-c', 'marquee-equalizer-lights', 'marquee-trim-lights', 'marquee-focal-lights', 'marquee-sparkle-lights']
          : []
  return {
    density: section === 'drop' ? 1 : section === 'build' ? 0.9 : 0.72,
    motionMultiplier: 1,
    paletteOffset: 0,
    hiddenLayerIds,
  }
}

const SETTINGS: PixGridPresetSettings = {
  pattern: 'pixelParade',
  quality: 'high',
  qualityMode: 'fixed',
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
  selectedSceneId: `${PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET_ID}-intro`,
  layers: LAYERS,
  groups: GROUPS,
  audioAssignments: [],
  performanceProgramId: null,
  performanceEnabled: false,
  sceneSettings: Object.fromEntries(SECTION_TYPES.map(section => [
    `${PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET_ID}-${section}`,
    settingsFor(section),
  ])),
}

export const PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET: ReactPreset = {
  id: PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET_ID,
  name: 'Retired Sign Runtime Fixture',
  description: 'Neutral test-only fixture for shared sign-clock and frame-transition runtime coverage.',
  engine: 'pixGrid',
  palette: {
    primary: '#ffffff',
    secondary: '#9bdcff',
    accent: '#ffd36b',
    background: '#000000',
    highlight: '#ffffff',
    text: '#ffffff',
  },
  params: { intensity: 1, motion: 0.35, glow: 0.08, bassReactivity: 0.72 },
  renderSettings: { trailDecay: 0, fogDensity: 0, particleDensity: 0 },
  pixGridSettings: SETTINGS,
  scenes: SECTION_TYPES.map((sectionType, index) => ({
    id: `${PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET_ID}-${sectionType}`,
    sectionType,
    engineId: 'pixGrid',
    params: { intensity: 0.72 + index * 0.03, motion: 0.2, glow: 0.04 },
  })),
  sectionMappings: SECTION_TYPES.map(sectionType => ({
    sectionType,
    sceneId: `${PIX_GRID_LEGACY_SIGN_RUNTIME_PRESET_ID}-${sectionType}`,
  })),
}
