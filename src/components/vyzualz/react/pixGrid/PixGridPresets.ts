import type { ReactPreset, ReactSectionMapping, ReactSectionType } from '../ReactTypes'
import type { PixGridPresetSettings } from './PixGridTypes'

export const PIX_GRID_PRESET_IDS = [
  'pix-grid-bass-beacon',
  'pix-grid-geometric-reactor',
  'pix-grid-pixel-parade',
] as const

export type PixGridPresetId = typeof PIX_GRID_PRESET_IDS[number]

const SECTION_TYPES: ReactSectionType[] = ['intro', 'verse', 'build', 'drop', 'breakdown', 'outro']

function createScenes(prefix: string) {
  return SECTION_TYPES.map((sectionType, index) => ({
    id: `${prefix}-${sectionType}`,
    sectionType,
    engineId: 'pixGrid' as const,
    params: {
      intensity: [0.42, 0.62, 0.78, 1, 0.5, 0.34][index],
      motion: [0.24, 0.48, 0.7, 0.92, 0.32, 0.18][index],
    },
  }))
}

function createMappings(prefix: string): ReactSectionMapping[] {
  return SECTION_TYPES.map(sectionType => ({ sectionType, sceneId: `${prefix}-${sectionType}` }))
}

function preset(
  id: PixGridPresetId,
  name: string,
  description: string,
  prefix: string,
  palette: ReactPreset['palette'],
  params: ReactPreset['params'],
  pixGridSettings: PixGridPresetSettings,
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
    scenes: createScenes(prefix),
    sectionMappings: createMappings(prefix),
  }
}

export const PIX_GRID_PRESETS: ReactPreset[] = [
  preset(
    'pix-grid-bass-beacon',
    'Bass Beacon',
    'A cyan and emerald center beacon that expands through the matrix with bass pressure and beat flashes.',
    'pix-grid-bass-beacon',
    {
      primary: '#36d9ff', secondary: '#39e69b', accent: '#d8b95a',
      background: '#020608', highlight: '#f2feff', text: '#e8f4f8',
    },
    { intensity: 0.86, motion: 0.62, glow: 0.72, bassReactivity: 0.95 },
    {
      pattern: 'bassBeacon', quality: 'high', backgroundMode: 'preset', backgroundColor: '#020608',
      backgroundBrightness: 0.16, cellGap: 0.18, cellRoundness: 0.2, cellBrightness: 0.86,
      globalIntensity: 0.9, glowAmount: 0.42, diffusion: 0.14, rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-bass-beacon-intro',
    },
  ),
  preset(
    'pix-grid-geometric-reactor',
    'Geometric Reactor',
    'Interlocking violet, cyan, and gold pixel geometry rotates and contracts around a hard central reactor.',
    'pix-grid-geometric-reactor',
    {
      primary: '#a969ff', secondary: '#30d7ff', accent: '#f2c45c',
      background: '#05030b', highlight: '#fff3c7', text: '#f7efff',
    },
    { intensity: 0.9, motion: 0.82, glow: 0.68, bassReactivity: 0.8 },
    {
      pattern: 'geometricReactor', quality: 'high', backgroundMode: 'preset', backgroundColor: '#05030b',
      backgroundBrightness: 0.14, cellGap: 0.12, cellRoundness: 0.08, cellBrightness: 0.9,
      globalIntensity: 0.92, glowAmount: 0.3, diffusion: 0.08, rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-geometric-reactor-intro',
    },
  ),
  preset(
    'pix-grid-pixel-parade',
    'Pixel Parade',
    'Playful coral, gold, cyan, and emerald characters march across stepped lanes with snappy beat accents.',
    'pix-grid-pixel-parade',
    {
      primary: '#ff6d7f', secondary: '#ffd35c', accent: '#43d9ff',
      background: '#070508', highlight: '#67e3aa', text: '#fff4ef',
    },
    { intensity: 0.82, motion: 0.9, glow: 0.54, bassReactivity: 0.72 },
    {
      pattern: 'pixelParade', quality: 'high', backgroundMode: 'preset', backgroundColor: '#070508',
      backgroundBrightness: 0.18, cellGap: 0.22, cellRoundness: 0.28, cellBrightness: 0.84,
      globalIntensity: 0.86, glowAmount: 0.24, diffusion: 0.18, rgbSubpixelMode: false,
      selectedSceneId: 'pix-grid-pixel-parade-intro',
    },
  ),
]

export const PIX_GRID_PRESET_BY_ID = new Map(PIX_GRID_PRESETS.map(item => [item.id, item]))
