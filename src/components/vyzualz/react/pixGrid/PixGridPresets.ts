import type { ReactPreset, ReactSectionMapping, ReactSectionType } from '../ReactTypes'
import type { PixGridLayer, PixGridPresetSettings, PixGridSceneSettings } from './PixGridTypes'

export const PIX_GRID_PRESET_IDS = [
  'pix-grid-bass-beacon',
  'pix-grid-geometric-reactor',
  'pix-grid-pixel-parade',
] as const

export type PixGridPresetId = typeof PIX_GRID_PRESET_IDS[number]

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

function sceneSettings(prefix: string, custom: Partial<Record<ReactSectionType, Partial<PixGridSceneSettings>>> = {}): Record<string, PixGridSceneSettings> {
  const base: Partial<Record<ReactSectionType, PixGridSceneSettings>> = {
    intro: { density: 0.38, motionMultiplier: 0.45, paletteOffset: 0 },
    verse: { density: 0.58, motionMultiplier: 0.75, paletteOffset: 0 },
    build: { density: 0.82, motionMultiplier: 1.15, paletteOffset: 1 },
    drop: { density: 1, motionMultiplier: 1.55, paletteOffset: 0 },
    breakdown: { density: 0.46, motionMultiplier: 0.35, paletteOffset: 2 },
    outro: { density: 0.28, motionMultiplier: 0.24, paletteOffset: 0 },
  }
  return Object.fromEntries(SECTION_TYPES.map(type => [
    `${prefix}-${type}`,
    { ...base[type]!, ...custom[type] },
  ]))
}

const BASS_BEACON_LAYERS: PixGridLayer[] = [
  layer('bass-rings', 'Bass Pressure Rings', 'pix-concentric-rings', {
    opacity: 0.55, scale: { x: 0.42, y: 0.74 }, blendMode: 'add', zIndex: 1, densityRank: 0.2,
    paletteMap: { primary: 'secondary', secondary: 'primary' },
    animations: [animation('pulse', 0.32, 0.12), animation('audioAmplitudeScale', 1, 0.28, { audioSource: 'bass' })],
    audioReactivity: { brightnessSource: 'bass', brightnessAmount: 0.7, beatImpact: 0.28 },
  }),
  layer('bass-burst', 'Kick Burst', 'pix-pixel-burst', {
    opacity: 0.32, scale: { x: 0.52, y: 0.92 }, blendMode: 'add', zIndex: 2, densityRank: 0.72,
    paletteMap: { accent: 'secondary', highlight: 'highlight' },
    animations: [animation('rotate', 0.1, 0.25), animation('audioAmplitudeScale', 1, 0.24, { audioSource: 'kick' })],
    audioReactivity: { brightnessSource: 'kick', brightnessAmount: 0.9, beatImpact: 0.9 },
  }),
  layer('bass-outline', 'Snare Outline', 'pix-bass-word', {
    opacity: 0.42, scale: { x: 0.67, y: 0.36 }, blendMode: 'add', zIndex: 3, densityRank: 0.38,
    paletteMap: { primary: 'highlight', highlight: 'accent' },
    animations: [animation('pulse', 0.5, 0.025, { phase: 0.25 })],
    audioReactivity: { brightnessSource: 'snare', brightnessAmount: 0.94 },
  }),
  layer('bass-word', 'BASS Body', 'pix-bass-word', {
    scale: { x: 0.61, y: 0.31 }, zIndex: 4, densityRank: 0,
    paletteMap: { primary: 'primary', highlight: 'highlight' },
    animations: [animation('audioAmplitudeScale', 1, 0.11, { audioSource: 'bass' })],
    audioReactivity: { brightnessSource: 'bass', brightnessAmount: 0.36, scaleSource: 'bass', scaleAmount: 0.08, beatImpact: 0.2 },
  }),
  layer('bass-side-chevrons-left', 'Left Impact Chevrons', 'pix-diagonal-chevrons', {
    position: { x: 0.12, y: 0.5 }, scale: { x: 0.18, y: 0.58 }, rotation: 90,
    opacity: 0.55, blendMode: 'add', zIndex: 5, densityRank: 0.5,
    animations: [animation('pingPong', 0.7, 0.045, { axis: 'x', boundary: 'clamp' })],
    audioReactivity: { brightnessSource: 'snare', brightnessAmount: 0.8 },
  }),
  layer('bass-side-chevrons-right', 'Right Impact Chevrons', 'pix-diagonal-chevrons', {
    position: { x: 0.88, y: 0.5 }, scale: { x: 0.18, y: 0.58 }, rotation: -90, flipX: true,
    opacity: 0.55, blendMode: 'add', zIndex: 5, densityRank: 0.5,
    animations: [animation('pingPong', 0.7, 0.045, { axis: 'x', boundary: 'clamp', phase: 0.5 })],
    audioReactivity: { brightnessSource: 'snare', brightnessAmount: 0.8 },
  }),
  layer('bass-sparkles', 'Hat Sparkles', 'pix-multi-star-field', {
    opacity: 0.46, scale: { x: 1, y: 1 }, blendMode: 'add', zIndex: 6, densityRank: 0.68, seed: 731,
    animations: [animation('frameCycle', 7, 1), animation('checkerAlternate', 4, 1)],
    audioReactivity: { brightnessSource: 'hat', brightnessAmount: 0.96 },
  }),
]

const GEOMETRIC_REACTOR_LAYERS: PixGridLayer[] = [
  layer('reactor-checker', 'Reactor Floor', 'pix-checkerboard', {
    opacity: 0.2, scale: { x: 1, y: 1 }, blendMode: 'multiply', zIndex: 0, densityRank: 0.55,
    animations: [animation('checkerAlternate', 1.5, 1), animation('paletteCycle', 0.18, 1)],
    audioReactivity: { brightnessSource: 'high', brightnessAmount: 0.55 },
  }),
  layer('reactor-tunnel', 'Geometric Tunnel', 'pix-geometric-tunnel', {
    opacity: 0.72, scale: { x: 0.96, y: 0.96 }, blendMode: 'add', zIndex: 1, densityRank: 0.1,
    animations: [animation('frameCycle', 2.2, 1), animation('audioAmplitudeScale', 1, 0.12, { audioSource: 'bass' })],
    audioReactivity: { brightnessSource: 'mid', brightnessAmount: 0.55 },
  }),
  layer('reactor-rings', 'Reactor Rings', 'pix-concentric-rings', {
    opacity: 0.68, scale: { x: 0.42, y: 0.76 }, blendMode: 'add', zIndex: 2, densityRank: 0.25,
    animations: [animation('rotate', 0.18, 0.5), animation('paletteCycle', 0.3, 1)],
    audioReactivity: { brightnessSource: 'bass', brightnessAmount: 0.65, scaleSource: 'bass', scaleAmount: 0.14 },
  }),
  layer('reactor-chevrons', 'Midband Chevrons', 'pix-diagonal-chevrons', {
    opacity: 0.74, scale: { x: 0.78, y: 0.52 }, blendMode: 'add', zIndex: 3, densityRank: 0.48,
    animations: [animation('horizontalScroll', 0.12, 0.12), animation('paletteCycle', 0.22, 1)],
    audioReactivity: { brightnessSource: 'mid', brightnessAmount: 0.82 },
  }),
  layer('reactor-diamond', 'Central Diamond', 'pix-diamond', {
    scale: { x: 0.3, y: 0.54 }, blendMode: 'add', zIndex: 4, densityRank: 0,
    animations: [animation('rotate', 0.28, -0.5, { stepped: true }), animation('audioAmplitudeScale', 1, 0.22, { audioSource: 'bass' })],
    audioReactivity: { brightnessSource: 'bass', brightnessAmount: 0.5, beatImpact: 0.35 },
  }),
  layer('reactor-cross', 'High-Frequency Cross', 'pix-cross', {
    opacity: 0.7, scale: { x: 0.18, y: 0.32 }, blendMode: 'add', zIndex: 5, densityRank: 0.72,
    animations: [animation('blink', 4, 0.32), animation('rotate', 0.5, 0.25, { stepped: true })],
    audioReactivity: { brightnessSource: 'high', brightnessAmount: 0.92 },
  }),
  layer('reactor-orbits', 'Orbiting Nodes', 'pix-orbiting-dots', {
    opacity: 0.82, scale: { x: 0.54, y: 0.96 }, blendMode: 'add', zIndex: 6, densityRank: 0.82,
    animations: [animation('frameCycle', 3.6, 1), animation('rotate', 0.12, 0.5)],
    audioReactivity: { brightnessSource: 'high', brightnessAmount: 0.55 },
  }),
]

const PIXEL_PARADE_LAYERS: PixGridLayer[] = [
  layer('parade-stars', 'Parade Sky', 'pix-multi-star-field', {
    opacity: 0.38, scale: { x: 1, y: 1 }, blendMode: 'add', zIndex: 0, densityRank: 0.32, seed: 212,
    animations: [animation('frameCycle', 5, 1), animation('horizontalScroll', 0.035, -0.08)],
    audioReactivity: { brightnessSource: 'high', brightnessAmount: 0.7 },
  }),
  layer('parade-wave-top', 'Top Parade Lane', 'pix-wave-line', {
    position: { x: 0.5, y: 0.2 }, scale: { x: 1, y: 0.22 }, opacity: 0.62, blendMode: 'add', zIndex: 1, densityRank: 0.45,
    animations: [animation('frameCycle', 4, 1), animation('horizontalScroll', 0.08, 0.08)],
    audioReactivity: { brightnessSource: 'high', brightnessAmount: 0.62 },
  }),
  layer('parade-wave-bottom', 'Bottom Parade Lane', 'pix-wave-line', {
    position: { x: 0.5, y: 0.82 }, scale: { x: 1, y: 0.22 }, opacity: 0.62, blendMode: 'add', zIndex: 1, densityRank: 0.45, flipX: true,
    animations: [animation('frameCycle', 4, 1, { phase: 0.5 }), animation('horizontalScroll', 0.08, -0.08)],
    audioReactivity: { brightnessSource: 'high', brightnessAmount: 0.62 },
  }),
  layer('parade-star-left', 'Lead Star', 'pix-five-point-star', {
    position: { x: 0.2, y: 0.52 }, scale: { x: 0.2, y: 0.36 }, blendMode: 'add', zIndex: 3, densityRank: 0,
    animations: [animation('beatStepMovement', 1.8, 0.08, { axis: 'x', boundary: 'bounce' }), animation('pulse', 0.7, 0.08)],
    audioReactivity: { brightnessSource: 'bass', brightnessAmount: 0.42, beatImpact: 0.28 },
  }),
  layer('parade-pal', 'Pixel Pal', 'pix-mascot-face', {
    position: { x: 0.5, y: 0.56 }, scale: { x: 0.26, y: 0.38 }, zIndex: 4, densityRank: 0.18,
    animations: [animation('frameCycle', 2.4, 1), animation('bounce', 0.8, 0.055, { axis: 'y', boundary: 'clamp' })],
    audioReactivity: { brightnessSource: 'mid', brightnessAmount: 0.38, scaleSource: 'bass', scaleAmount: 0.06 },
  }),
  layer('parade-orbit', 'Orbit Crew', 'pix-orbiting-dots', {
    position: { x: 0.78, y: 0.5 }, scale: { x: 0.25, y: 0.44 }, opacity: 0.85, blendMode: 'add', zIndex: 5, densityRank: 0.56,
    animations: [animation('frameCycle', 4, 1), animation('beatStepMovement', 1.5, -0.05, { axis: 'x', boundary: 'bounce' })],
    audioReactivity: { brightnessSource: 'high', brightnessAmount: 0.65 },
  }),
  layer('parade-eq', 'Parade Equalizer', 'pix-equalizer-bars', {
    position: { x: 0.5, y: 0.88 }, scale: { x: 0.72, y: 0.18 }, opacity: 0.72, blendMode: 'add', zIndex: 6, densityRank: 0.72,
    animations: [animation('frameCycle', 6, 1), animation('paletteCycle', 0.5, 1)],
    audioReactivity: { brightnessSource: 'volume', brightnessAmount: 0.8, scaleSource: 'bass', scaleAmount: 0.08 },
  }),
  layer('parade-burst', 'Drop Confetti Burst', 'pix-pixel-burst', {
    opacity: 0.44, scale: { x: 0.82, y: 1.3 }, blendMode: 'add', zIndex: 7, densityRank: 0.9,
    animations: [animation('rotate', 0.12, 0.5), animation('frameCycle', 3, 1)],
    audioReactivity: { brightnessSource: 'bass', brightnessAmount: 0.7, beatImpact: 0.65 },
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
    pixGridSettings,
    scenes: createScenes(prefix, sceneValues.intensity, sceneValues.motion, sceneValues.glow),
    sectionMappings: createMappings(prefix),
  }
}

export const PIX_GRID_PRESETS: ReactPreset[] = [
  preset(
    'pix-grid-bass-beacon',
    'Bass Beacon',
    'Bold BASS typography, pressure rings, kick expansion, snare-side impacts, and deterministic hat sparkles.',
    'pix-grid-bass-beacon',
    { primary: '#36d9ff', secondary: '#39e69b', accent: '#d8b95a', background: '#020608', highlight: '#f2feff', text: '#e8f4f8' },
    { intensity: 0.86, motion: 0.62, glow: 0.72, bassReactivity: 0.95 },
    {
      pattern: 'bassBeacon', quality: 'high', backgroundMode: 'preset', backgroundColor: '#020608',
      backgroundBrightness: 0.12, cellGap: 0.18, cellRoundness: 0.2, cellBrightness: 0.9,
      globalIntensity: 0.92, glowAmount: 0.42, diffusion: 0.14, rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-bass-beacon-intro', layers: BASS_BEACON_LAYERS,
      sceneSettings: sceneSettings('pix-grid-bass-beacon', {
        breakdown: { hiddenLayerIds: ['bass-burst', 'bass-sparkles'], layerOpacity: { 'bass-word': 0.78 } },
        outro: { hiddenLayerIds: ['bass-burst', 'bass-sparkles', 'bass-side-chevrons-left', 'bass-side-chevrons-right'] },
      }),
    },
    { intensity: [0.5, 0.68, 0.84, 1, 0.56, 0.38], motion: [0.28, 0.5, 0.76, 0.94, 0.3, 0.18], glow: [0.42, 0.58, 0.7, 0.86, 0.48, 0.32] },
  ),
  preset(
    'pix-grid-geometric-reactor',
    'Geometric Reactor',
    'A designed hierarchy of tunnel rails, rings, chevrons, diamonds, crosses, and orbiting reactor nodes.',
    'pix-grid-geometric-reactor',
    { primary: '#a969ff', secondary: '#30d7ff', accent: '#f2c45c', background: '#05030b', highlight: '#fff3c7', text: '#f7efff' },
    { intensity: 0.9, motion: 0.82, glow: 0.68, bassReactivity: 0.8 },
    {
      pattern: 'geometricReactor', quality: 'high', backgroundMode: 'preset', backgroundColor: '#05030b',
      backgroundBrightness: 0.1, cellGap: 0.12, cellRoundness: 0.08, cellBrightness: 0.92,
      globalIntensity: 0.94, glowAmount: 0.3, diffusion: 0.08, rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-geometric-reactor-intro', layers: GEOMETRIC_REACTOR_LAYERS,
      sceneSettings: sceneSettings('pix-grid-geometric-reactor', {
        intro: { hiddenLayerIds: ['reactor-cross', 'reactor-orbits', 'reactor-checker'] },
        breakdown: { hiddenLayerIds: ['reactor-checker', 'reactor-chevrons', 'reactor-cross'], layerOpacity: { 'reactor-tunnel': 0.42 } },
        outro: { hiddenLayerIds: ['reactor-checker', 'reactor-chevrons', 'reactor-cross', 'reactor-orbits'] },
      }),
    },
    { intensity: [0.48, 0.7, 0.88, 1, 0.52, 0.34], motion: [0.32, 0.64, 0.9, 1, 0.26, 0.14], glow: [0.38, 0.56, 0.7, 0.82, 0.42, 0.28] },
  ),
  preset(
    'pix-grid-pixel-parade',
    'Pixel Parade',
    'An original star, Pixel Pal, orbit crew, wave lanes, equalizer float, and drop-confetti parade.',
    'pix-grid-pixel-parade',
    { primary: '#ff6d7f', secondary: '#ffd35c', accent: '#43d9ff', background: '#070508', highlight: '#67e3aa', text: '#fff4ef' },
    { intensity: 0.82, motion: 0.9, glow: 0.54, bassReactivity: 0.72 },
    {
      pattern: 'pixelParade', quality: 'high', backgroundMode: 'preset', backgroundColor: '#070508',
      backgroundBrightness: 0.14, cellGap: 0.22, cellRoundness: 0.28, cellBrightness: 0.88,
      globalIntensity: 0.9, glowAmount: 0.24, diffusion: 0.18, rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-pixel-parade-intro', layers: PIXEL_PARADE_LAYERS,
      sceneSettings: sceneSettings('pix-grid-pixel-parade', {
        intro: { hiddenLayerIds: ['parade-eq', 'parade-burst', 'parade-orbit'] },
        verse: { hiddenLayerIds: ['parade-burst'] },
        build: { hiddenLayerIds: ['parade-burst'], layerOpacity: { 'parade-eq': 0.92 } },
        breakdown: { hiddenLayerIds: ['parade-eq', 'parade-burst', 'parade-orbit', 'parade-wave-bottom'], layerOpacity: { 'parade-pal': 0.72 } },
        outro: { hiddenLayerIds: ['parade-eq', 'parade-burst', 'parade-orbit', 'parade-wave-bottom', 'parade-stars'] },
      }),
    },
    { intensity: [0.44, 0.66, 0.82, 0.98, 0.5, 0.3], motion: [0.35, 0.7, 0.92, 1, 0.32, 0.18], glow: [0.3, 0.46, 0.62, 0.74, 0.38, 0.24] },
  ),
]

export const PIX_GRID_PRESET_BY_ID = new Map(PIX_GRID_PRESETS.map(item => [item.id, item]))
