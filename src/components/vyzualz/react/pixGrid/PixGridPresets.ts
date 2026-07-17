import type { ReactPreset, ReactSectionMapping, ReactSectionType } from '../ReactTypes'
import {
  BASS_BEACON_AUDIO_ASSIGNMENTS,
  BASS_BEACON_GROUPS,
  GEOMETRIC_REACTOR_AUDIO_ASSIGNMENTS,
  GEOMETRIC_REACTOR_GROUPS,
  PIXEL_PARADE_AUDIO_ASSIGNMENTS,
  PIXEL_PARADE_GROUPS,
} from './PixGridAuthoredPresetAssignments'
import type { PixGridLayer, PixGridPresetSettings, PixGridSceneSettings } from './PixGridTypes'

export const PIX_GRID_PRESET_IDS = [
  'pix-grid-bass-beacon',
  'pix-grid-geometric-reactor',
  'pix-grid-pixel-parade',
] as const

export type PixGridPresetId = typeof PIX_GRID_PRESET_IDS[number]

export const PIX_GRID_AUTHORED_PRESET_CONFIGURATION_VERSION = 4 as const

const SECTION_TYPES: ReactSectionType[] = ['intro', 'verse', 'build', 'drop', 'breakdown', 'outro']

function createScenes(prefix: string, intensity: number[], motion: number[], glow: number[]) {
  return SECTION_TYPES.map((sectionType, index) => ({
    id: `${prefix}-${sectionType}`,
    sectionType,
    engineId: 'pixGrid' as const,
    params: {
      intensity: intensity[index],
      motion: motion[index],
      glow: glow[index],
    },
  }))
}

function createMappings(prefix: string): ReactSectionMapping[] {
  return SECTION_TYPES.map(sectionType => ({ sectionType, sceneId: `${prefix}-${sectionType}` }))
}

function animation(
  mode: PixGridLayer['animations'][number]['mode'],
  speed: number,
  amount: number,
  extras: Partial<PixGridLayer['animations'][number]> = {},
): PixGridLayer['animations'][number] {
  return { mode, speed, amount, phase: 0, boundary: 'wrap', ...extras }
}

function layer(
  id: string,
  name: string,
  assetId: PixGridLayer['assetId'],
  overrides: Partial<PixGridLayer> = {},
): PixGridLayer {
  return {
    id,
    name,
    assetId,
    visible: true,
    opacity: 1,
    position: { x: 0.5, y: 0.5 },
    scale: { x: 0.5, y: 0.5 },
    rotation: 0,
    flipX: false,
    flipY: false,
    blendMode: 'normal',
    paletteMap: {},
    zIndex: 0,
    clipMode: 'clip',
    maskAssetId: null,
    animations: [],
    densityRank: 0,
    seed: 1,
    ...overrides,
  }
}

function sceneSettings(
  prefix: string,
  custom: Partial<Record<ReactSectionType, Partial<PixGridSceneSettings>>> = {},
): Record<string, PixGridSceneSettings> {
  const base: Partial<Record<ReactSectionType, PixGridSceneSettings>> = {
    intro: { density: 0.34, motionMultiplier: 0.42, paletteOffset: 0 },
    verse: { density: 0.58, motionMultiplier: 0.72, paletteOffset: 0 },
    build: { density: 0.82, motionMultiplier: 1.12, paletteOffset: 1 },
    drop: { density: 1, motionMultiplier: 1.5, paletteOffset: 0 },
    breakdown: { density: 0.44, motionMultiplier: 0.34, paletteOffset: 2 },
    outro: { density: 0.26, motionMultiplier: 0.22, paletteOffset: 0 },
  }
  return Object.fromEntries(SECTION_TYPES.map(type => [
    `${prefix}-${type}`,
    { ...base[type]!, ...custom[type] },
  ]))
}

const BASS_BEACON_LAYERS: PixGridLayer[] = [
  layer('bass-rings', 'Sub Pressure Rings', 'pix-concentric-rings', {
    opacity: 0.3,
    scale: { x: 0.42, y: 0.74 },
    blendMode: 'add',
    zIndex: 1,
    densityRank: 0.22,
    paletteMap: { primary: 'secondary', secondary: 'primary' },
    animations: [animation('pulse', 0.28, 0.08), animation('rotate', 0.05, 0.25)],
    seed: 101,
  }),
  layer('bass-outline', 'Typography Outline', 'pix-bass-word', {
    opacity: 0.24,
    scale: { x: 0.68, y: 0.37 },
    blendMode: 'add',
    zIndex: 3,
    densityRank: 0.28,
    paletteMap: { primary: 'highlight', highlight: 'accent' },
    animations: [animation('pulse', 0.36, 0.018, { phase: 0.25 })],
    seed: 307,
  }),
  layer('bass-word', 'BASS Hero Body', 'pix-bass-word', {
    scale: { x: 0.61, y: 0.31 },
    zIndex: 4,
    densityRank: 0,
    paletteMap: { primary: 'primary', highlight: 'highlight' },
    animations: [animation('pulse', 0.18, 0.012)],
    seed: 401,
  }),
  layer('bass-letter-b', 'Letter B Highlight', 'pix-bass-letter-b', {
    position: { x: 0.262, y: 0.5 },
    scale: { x: 0.133, y: 0.31 },
    opacity: 0.2,
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.5,
    paletteMap: { primary: 'secondary', highlight: 'highlight' },
    animations: [animation('pulse', 0.22, 0.018, { phase: 0 })],
    seed: 503,
  }),
  layer('bass-letter-a', 'Letter A Highlight', 'pix-bass-letter-a', {
    position: { x: 0.421, y: 0.5 },
    scale: { x: 0.133, y: 0.31 },
    opacity: 0.2,
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.56,
    paletteMap: { primary: 'accent', highlight: 'highlight' },
    animations: [animation('pulse', 0.22, 0.018, { phase: 0.25 })],
    seed: 509,
  }),
  layer('bass-letter-s-left', 'First S Highlight', 'pix-bass-letter-s', {
    position: { x: 0.579, y: 0.5 },
    scale: { x: 0.133, y: 0.31 },
    opacity: 0.2,
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.62,
    paletteMap: { primary: 'secondary', highlight: 'highlight' },
    animations: [animation('pulse', 0.22, 0.018, { phase: 0.5 })],
    seed: 521,
  }),
  layer('bass-letter-s-right', 'Final S Highlight', 'pix-bass-letter-s', {
    position: { x: 0.738, y: 0.5 },
    scale: { x: 0.133, y: 0.31 },
    opacity: 0.2,
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.68,
    paletteMap: { primary: 'accent', highlight: 'highlight' },
    animations: [animation('pulse', 0.22, 0.018, { phase: 0.75 })],
    seed: 523,
  }),
  layer('bass-side-chevrons-left', 'Left Snare Accents', 'pix-diagonal-chevrons', {
    position: { x: 0.115, y: 0.5 },
    scale: { x: 0.16, y: 0.54 },
    rotation: 90,
    opacity: 0.34,
    blendMode: 'add',
    zIndex: 6,
    densityRank: 0.58,
    animations: [animation('pingPong', 0.48, 0.03, { axis: 'x', boundary: 'clamp' })],
    seed: 601,
  }),
  layer('bass-side-chevrons-right', 'Right Snare Accents', 'pix-diagonal-chevrons', {
    position: { x: 0.885, y: 0.5 },
    scale: { x: 0.16, y: 0.54 },
    rotation: -90,
    flipX: true,
    opacity: 0.34,
    blendMode: 'add',
    zIndex: 6,
    densityRank: 0.58,
    animations: [animation('pingPong', 0.48, 0.03, { axis: 'x', boundary: 'clamp', phase: 0.5 })],
    seed: 607,
  }),
  layer('bass-sparkles', 'Air and Hat Details', 'pix-multi-star-field', {
    opacity: 0.26,
    scale: { x: 1, y: 1 },
    blendMode: 'add',
    zIndex: 7,
    densityRank: 0.74,
    seed: 731,
    animations: [animation('frameCycle', 4.5, 1), animation('checkerAlternate', 2, 1)],
  }),
]

const GEOMETRIC_REACTOR_LAYERS: PixGridLayer[] = [
  layer('reactor-checker', 'Checker Background Field', 'pix-checkerboard', {
    opacity: 0.13,
    scale: { x: 1, y: 1 },
    blendMode: 'multiply',
    zIndex: 0,
    densityRank: 0.62,
    animations: [animation('checkerAlternate', 0.9, 1), animation('paletteCycle', 0.1, 1)],
    seed: 811,
  }),
  layer('reactor-tunnel', 'Outer Tunnel Structure', 'pix-geometric-tunnel', {
    opacity: 0.58,
    scale: { x: 0.94, y: 0.94 },
    blendMode: 'add',
    zIndex: 1,
    densityRank: 0.08,
    animations: [animation('frameCycle', 1.7, 1), animation('pulse', 0.16, 0.025)],
    seed: 821,
  }),
  layer('reactor-rings', 'Inner Reactor Rings', 'pix-concentric-rings', {
    opacity: 0.62,
    scale: { x: 0.42, y: 0.76 },
    blendMode: 'add',
    zIndex: 2,
    densityRank: 0.22,
    animations: [animation('rotate', 0.14, 0.5), animation('paletteCycle', 0.2, 1)],
    seed: 823,
  }),
  layer('reactor-chevrons', 'Mid-Band Chevrons', 'pix-diagonal-chevrons', {
    opacity: 0.58,
    scale: { x: 0.78, y: 0.52 },
    blendMode: 'add',
    zIndex: 3,
    densityRank: 0.46,
    animations: [animation('horizontalScroll', 0.09, 0.1), animation('paletteCycle', 0.15, 1)],
    seed: 827,
  }),
  layer('reactor-diamond', 'Center Core', 'pix-diamond', {
    scale: { x: 0.3, y: 0.54 },
    blendMode: 'add',
    zIndex: 4,
    densityRank: 0,
    animations: [animation('rotate', 0.2, -0.5, { stepped: true }), animation('pulse', 0.2, 0.025)],
    seed: 829,
  }),
  layer('reactor-cross', 'Cross Impact Accents', 'pix-cross', {
    opacity: 0.5,
    scale: { x: 0.18, y: 0.32 },
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.72,
    animations: [animation('blink', 2.4, 0.22), animation('rotate', 0.34, 0.25, { stepped: true })],
    seed: 839,
  }),
  layer('reactor-orbits', 'High-Frequency Nodes', 'pix-orbiting-dots', {
    opacity: 0.68,
    scale: { x: 0.54, y: 0.96 },
    blendMode: 'add',
    zIndex: 6,
    densityRank: 0.82,
    animations: [animation('frameCycle', 2.8, 1), animation('rotate', 0.09, 0.5)],
    seed: 853,
  }),
]

const PIXEL_PARADE_LAYERS: PixGridLayer[] = [
  layer('parade-stars', 'Parade Sky and Particles', 'pix-multi-star-field', {
    opacity: 0.28,
    scale: { x: 1, y: 1 },
    blendMode: 'add',
    zIndex: 0,
    densityRank: 0.34,
    seed: 212,
    animations: [animation('frameCycle', 3.8, 1), animation('horizontalScroll', 0.025, 0.08)],
  }),
  layer('parade-wave-top', 'Upper Parade Lane', 'pix-wave-line', {
    position: { x: 0.5, y: 0.24 },
    scale: { x: 0.94, y: 0.18 },
    opacity: 0.44,
    blendMode: 'add',
    zIndex: 1,
    densityRank: 0.2,
    animations: [animation('horizontalScroll', 0.08, 0.12), animation('frameCycle', 1.6, 1)],
    seed: 907,
  }),
  layer('parade-wave-bottom', 'Ground and Baseline', 'pix-wave-line', {
    position: { x: 0.5, y: 0.78 },
    scale: { x: 1, y: 0.2 },
    opacity: 0.5,
    blendMode: 'add',
    zIndex: 2,
    densityRank: 0.12,
    flipY: true,
    animations: [animation('horizontalScroll', -0.07, 0.12), animation('frameCycle', 1.4, 1, { phase: 0.5 })],
    seed: 911,
  }),
  layer('parade-star-left', 'Primary Star Participant', 'pix-five-point-star', {
    position: { x: 0.22, y: 0.55 },
    scale: { x: 0.18, y: 0.32 },
    blendMode: 'add',
    zIndex: 3,
    densityRank: 0.08,
    animations: [animation('bounce', 1.05, 0.05), animation('rotate', 0.08, 0.25)],
    seed: 919,
  }),
  layer('parade-pal', 'Hero Pixel Pal', 'pix-mascot-face', {
    position: { x: 0.47, y: 0.54 },
    scale: { x: 0.24, y: 0.36 },
    zIndex: 4,
    densityRank: 0,
    animations: [animation('frameCycle', 2.2, 1), animation('bounce', 1.1, 0.045)],
    seed: 929,
  }),
  layer('parade-orbit', 'Secondary Orbit Participant', 'pix-orbiting-dots', {
    position: { x: 0.73, y: 0.53 },
    scale: { x: 0.22, y: 0.4 },
    opacity: 0.72,
    blendMode: 'add',
    zIndex: 5,
    densityRank: 0.58,
    animations: [animation('frameCycle', 2.6, 1), animation('pingPong', 0.34, 0.035, { axis: 'y', boundary: 'bounce' })],
    seed: 937,
  }),
  layer('parade-eq', 'Equalizer Float and Props', 'pix-equalizer-bars', {
    position: { x: 0.5, y: 0.82 },
    scale: { x: 0.62, y: 0.2 },
    opacity: 0.58,
    blendMode: 'add',
    zIndex: 6,
    densityRank: 0.7,
    animations: [animation('frameCycle', 2.8, 1), animation('horizontalScroll', 0.035, 0.05)],
    seed: 941,
  }),
  layer('parade-burst', 'Bounded Parade Impact', 'pix-pixel-burst', {
    opacity: 0.24,
    scale: { x: 0.78, y: 1.2 },
    blendMode: 'add',
    zIndex: 7,
    densityRank: 0.9,
    animations: [animation('rotate', 0.08, 0.5), animation('frameCycle', 2.2, 1)],
    seed: 947,
  }),
]

function preset(
  id: PixGridPresetId,
  name: string,
  description: string,
  prefix: string,
  palette: ReactPreset['palette'],
  params: ReactPreset['params'],
  pixGridSettings: PixGridPresetSettings,
  sceneValues: { intensity: number[]; motion: number[]; glow: number[] },
): ReactPreset {
  return {
    id,
    name,
    description,
    engine: 'pixGrid',
    palette,
    params,
    renderSettings: { trailDecay: 0, fogDensity: 0, particleDensity: 0 },
    pixGridSettings: {
      authoredConfigurationVersion: PIX_GRID_AUTHORED_PRESET_CONFIGURATION_VERSION,
      ...pixGridSettings,
    },
    scenes: createScenes(prefix, sceneValues.intensity, sceneValues.motion, sceneValues.glow),
    sectionMappings: createMappings(prefix),
  }
}

export const PIX_GRID_PRESETS: ReactPreset[] = [
  preset(
    'pix-grid-bass-beacon',
    'Bass Beacon',
    'Crisp BASS typography with masked letter banks, phrase-travel highlights, bounded percussion impacts, and full-song row recruitment.',
    'pix-grid-bass-beacon',
    { primary: '#36d9ff', secondary: '#39e69b', accent: '#d8b95a', background: '#020608', highlight: '#f2feff', text: '#e8f4f8' },
    { intensity: 0.86, motion: 0.62, glow: 0.72, bassReactivity: 0.95 },
    {
      pattern: 'bassBeacon',
      quality: 'high',
      backgroundMode: 'preset',
      backgroundColor: '#020608',
      backgroundBrightness: 0.08,
      cellGap: 0.18,
      cellRoundness: 0.2,
      cellBrightness: 0.9,
      globalIntensity: 0.9,
      glowAmount: 0.36,
      diffusion: 0.12,
      rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-bass-beacon-intro',
      layers: BASS_BEACON_LAYERS,
      groups: BASS_BEACON_GROUPS,
      audioAssignments: BASS_BEACON_AUDIO_ASSIGNMENTS,
      performanceProgramId: 'pix-grid-bass-beacon-performance',
      sceneSettings: sceneSettings('pix-grid-bass-beacon', {
        intro: {
          density: 0.34,
          hiddenLayerIds: ['bass-sparkles', 'bass-letter-s-left', 'bass-letter-s-right'],
          layerOpacity: { 'bass-word': 0.44, 'bass-outline': 0.36, 'bass-letter-b': 0.16, 'bass-letter-a': 0.1 },
        },
        verse: {
          density: 0.62,
          layerOpacity: { 'bass-word': 0.78, 'bass-outline': 0.28 },
        },
        build: {
          density: 0.86,
          layerOpacity: { 'bass-word': 0.88, 'bass-outline': 0.34 },
        },
        drop: {
          density: 1,
          layerOpacity: { 'bass-word': 1, 'bass-outline': 0.3, 'bass-rings': 0.38 },
        },
        breakdown: {
          density: 0.48,
          hiddenLayerIds: ['bass-rings', 'bass-sparkles', 'bass-side-chevrons-left', 'bass-side-chevrons-right'],
          layerOpacity: { 'bass-word': 0.62, 'bass-outline': 0.42, 'bass-letter-a': 0.24 },
        },
        outro: {
          density: 0.34,
          hiddenLayerIds: ['bass-rings', 'bass-sparkles', 'bass-side-chevrons-left', 'bass-side-chevrons-right'],
          layerOpacity: { 'bass-word': 0.55, 'bass-outline': 0.2 },
        },
      }),
    },
    {
      intensity: [0.48, 0.68, 0.84, 1, 0.54, 0.34],
      motion: [0.24, 0.46, 0.74, 0.92, 0.26, 0.14],
      glow: [0.36, 0.54, 0.68, 0.82, 0.44, 0.28],
    },
  ),
  preset(
    'pix-grid-geometric-reactor',
    'Geometric Reactor',
    'A coherent frequency-owned reactor with core, rings, tunnel, chevrons, nodes, cross impacts, and staged geometry recruitment.',
    'pix-grid-geometric-reactor',
    { primary: '#a969ff', secondary: '#30d7ff', accent: '#f2c45c', background: '#05030b', highlight: '#fff3c7', text: '#f7efff' },
    { intensity: 0.9, motion: 0.82, glow: 0.68, bassReactivity: 0.8 },
    {
      pattern: 'geometricReactor',
      quality: 'high',
      backgroundMode: 'preset',
      backgroundColor: '#05030b',
      backgroundBrightness: 0.08,
      cellGap: 0.12,
      cellRoundness: 0.08,
      cellBrightness: 0.92,
      globalIntensity: 0.92,
      glowAmount: 0.28,
      diffusion: 0.08,
      rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-geometric-reactor-intro',
      layers: GEOMETRIC_REACTOR_LAYERS,
      groups: GEOMETRIC_REACTOR_GROUPS,
      audioAssignments: GEOMETRIC_REACTOR_AUDIO_ASSIGNMENTS,
      performanceProgramId: 'pix-grid-geometric-reactor-performance',
      sceneSettings: sceneSettings('pix-grid-geometric-reactor', {
        intro: {
          density: 0.32,
          hiddenLayerIds: ['reactor-cross', 'reactor-orbits', 'reactor-checker', 'reactor-chevrons'],
          layerOpacity: { 'reactor-tunnel': 0.38, 'reactor-rings': 0.46, 'reactor-diamond': 0.7 },
        },
        verse: {
          density: 0.62,
          hiddenLayerIds: ['reactor-cross'],
          layerOpacity: { 'reactor-checker': 0.08, 'reactor-orbits': 0.42 },
        },
        build: {
          density: 0.86,
          layerOpacity: { 'reactor-checker': 0.1, 'reactor-cross': 0.38 },
        },
        drop: {
          density: 1,
          layerOpacity: { 'reactor-checker': 0.14, 'reactor-cross': 0.52, 'reactor-orbits': 0.7 },
        },
        breakdown: {
          density: 0.46,
          hiddenLayerIds: ['reactor-checker', 'reactor-chevrons', 'reactor-cross', 'reactor-orbits'],
          layerOpacity: { 'reactor-tunnel': 0.3, 'reactor-rings': 0.4, 'reactor-diamond': 0.72 },
        },
        outro: {
          density: 0.3,
          hiddenLayerIds: ['reactor-checker', 'reactor-chevrons', 'reactor-cross', 'reactor-orbits'],
          layerOpacity: { 'reactor-tunnel': 0.24, 'reactor-rings': 0.3 },
        },
      }),
    },
    {
      intensity: [0.46, 0.68, 0.86, 1, 0.5, 0.3],
      motion: [0.28, 0.6, 0.88, 1, 0.22, 0.12],
      glow: [0.34, 0.52, 0.68, 0.8, 0.38, 0.24],
    },
  ),
  preset(
    'pix-grid-pixel-parade',
    'Pixel Parade',
    'A directed procession with a vocal-focused hero, participant banks, musical lanes, props, percussion accents, and evolving cast recruitment.',
    'pix-grid-pixel-parade',
    { primary: '#ff6d7f', secondary: '#ffd35c', accent: '#43d9ff', background: '#070508', highlight: '#67e3aa', text: '#fff4ef' },
    { intensity: 0.82, motion: 0.9, glow: 0.54, bassReactivity: 0.72 },
    {
      pattern: 'pixelParade',
      quality: 'high',
      backgroundMode: 'preset',
      backgroundColor: '#070508',
      backgroundBrightness: 0.1,
      cellGap: 0.22,
      cellRoundness: 0.28,
      cellBrightness: 0.88,
      globalIntensity: 0.88,
      glowAmount: 0.22,
      diffusion: 0.16,
      rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-pixel-parade-intro',
      layers: PIXEL_PARADE_LAYERS,
      groups: PIXEL_PARADE_GROUPS,
      audioAssignments: PIXEL_PARADE_AUDIO_ASSIGNMENTS,
      performanceProgramId: 'pix-grid-pixel-parade-performance',
      sceneSettings: sceneSettings('pix-grid-pixel-parade', {
        intro: {
          density: 0.34,
          hiddenLayerIds: ['parade-eq', 'parade-burst', 'parade-orbit', 'parade-star-left', 'parade-wave-bottom'],
          layerOpacity: { 'parade-pal': 0.72, 'parade-wave-top': 0.32, 'parade-stars': 0.16 },
        },
        verse: {
          density: 0.62,
          hiddenLayerIds: ['parade-burst', 'parade-eq'],
          layerOpacity: { 'parade-orbit': 0.44, 'parade-stars': 0.22 },
        },
        build: {
          density: 0.86,
          hiddenLayerIds: ['parade-burst'],
          layerOpacity: { 'parade-eq': 0.5, 'parade-orbit': 0.62 },
        },
        drop: {
          density: 1,
          layerOpacity: { 'parade-burst': 0.26, 'parade-eq': 0.62, 'parade-orbit': 0.74 },
        },
        breakdown: {
          density: 0.46,
          hiddenLayerIds: ['parade-eq', 'parade-burst', 'parade-orbit', 'parade-wave-bottom', 'parade-star-left'],
          layerOpacity: { 'parade-pal': 0.76, 'parade-wave-top': 0.24, 'parade-stars': 0.16 },
        },
        outro: {
          density: 0.3,
          hiddenLayerIds: ['parade-eq', 'parade-burst', 'parade-orbit', 'parade-wave-bottom', 'parade-stars'],
          layerOpacity: { 'parade-pal': 0.58, 'parade-star-left': 0.34, 'parade-wave-top': 0.2 },
        },
      }),
    },
    {
      intensity: [0.42, 0.64, 0.82, 0.98, 0.48, 0.28],
      motion: [0.3, 0.66, 0.9, 1, 0.28, 0.14],
      glow: [0.28, 0.44, 0.6, 0.72, 0.34, 0.2],
    },
  ),
]

export const PIX_GRID_PRESET_BY_ID = new Map(PIX_GRID_PRESETS.map(item => [item.id, item]))
