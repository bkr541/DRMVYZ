import { cinema2NativePresetRegistry } from '../cinema2'
import {
  CANVAS_VISIBLE_PRESETS,
  DEFAULT_CANVAS_PRESET_ID,
  DEFAULT_REACT_PRESETS,
} from '../react/ReactTypes'
import { HEADLINER_PRESETS } from '../react/headliner/HeadlinerEffectCatalog'
import { LASER_DMX_BEAM_MATRIX_PRESETS } from '../react/laserDmxBeamMatrixPresets'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from '../react/LaserDmxShowDirectorPerformancePresets'
import { LASER_DMX_SHOW_DIRECTOR_TEMPLATES } from '../react/laserDmxShowDirectorTemplates'
import { resolvePresetDiscoveryMetadata } from '../react/presetDiscovery'

export type PresetManagerArtwork = 'cinema2' | 'soundDrawing' | 'canvas' | 'laserDmx' | 'pixGrid' | 'headliner'

export interface PresetManagerRecord {
  id: string
  sourceId: string
  name: string
  description: string
  engineName: string
  category: string
  tags: readonly string[]
  artwork: PresetManagerArtwork
  custom?: boolean
}

function record(
  source: 'cinema2' | 'soundDrawing' | 'canvas' | 'laserDmx' | 'pixGrid' | 'headliner',
  sourceId: string,
  name: string,
  description: string,
  engineName: string,
  category: string,
  tags: readonly string[],
): PresetManagerRecord {
  return {
    id: `${source}:${sourceId}`,
    sourceId,
    name,
    description,
    engineName,
    category,
    tags,
    artwork: source,
  }
}

const cinema2Presets = cinema2NativePresetRegistry.list().flatMap(manifest => {
  if (manifest.metadata.tags?.includes('internal')) return []
  const discovery = resolvePresetDiscoveryMetadata(manifest.metadata, 'cinematic')
  return [record(
    'cinema2',
    manifest.id,
    manifest.metadata.name,
    manifest.metadata.description ?? manifest.metadata.name,
    'Cinema 2.0',
    discovery.category,
    discovery.tags,
  )]
})

const soundDrawingPresets = DEFAULT_REACT_PRESETS
  .filter(preset => preset.engine === 'oscilloscope')
  .map(preset => {
    const discovery = resolvePresetDiscoveryMetadata(
      preset,
      preset.oscillatorSettings?.sourceType ?? 'sound-drawing',
    )
    return record('soundDrawing', preset.id, preset.name, preset.description, 'Sound Drawing', discovery.category, discovery.tags)
  })

const canvasPresets = CANVAS_VISIBLE_PRESETS
  .filter(preset => preset.id !== DEFAULT_CANVAS_PRESET_ID)
  .map(preset => {
    const discovery = resolvePresetDiscoveryMetadata(preset, preset.rendererKind)
    return record('canvas', preset.id, preset.name, preset.description, 'CANVAS', discovery.category, discovery.tags)
  })

const laserDmxPresets = [
  ...LASER_DMX_BEAM_MATRIX_PRESETS.map(preset => record(
    'laserDmx', preset.id, preset.name, preset.description, 'LaserDMX', preset.category, preset.tags,
  )),
  ...LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.map(preset => {
    const discovery = resolvePresetDiscoveryMetadata(
      preset,
      'performance-show',
      [...preset.genreTags, ...preset.behaviorTags, ...preset.musicIntelligenceCapabilities],
    )
    return record('laserDmx', preset.id, preset.name, preset.description, 'LaserDMX', discovery.category, discovery.tags)
  }),
  ...LASER_DMX_SHOW_DIRECTOR_TEMPLATES.map(preset => record(
    'laserDmx', preset.id, preset.name, preset.description, 'LaserDMX', preset.category, preset.tags,
  )),
]

const pixGridPresets = DEFAULT_REACT_PRESETS
  .filter(preset => preset.engine === 'pixGrid')
  .map(preset => {
    const discovery = resolvePresetDiscoveryMetadata(preset, preset.pixGridDeck ? 'media-deck' : 'pixel-art')
    return record('pixGrid', preset.id, preset.name, preset.description, 'PixGrid', discovery.category, discovery.tags)
  })

const headlinerPresets = HEADLINER_PRESETS.map(preset => {
  const discovery = resolvePresetDiscoveryMetadata(preset, 'camera-effects')
  return record('headliner', preset.id, preset.name, preset.description, 'HEADLINER', discovery.category, discovery.tags)
})

/** Every preset exposed by a current React engine. Legacy Cinema is intentionally excluded. */
export const PRESET_MANAGER_PRESETS: readonly PresetManagerRecord[] = Object.freeze([
  ...cinema2Presets,
  ...soundDrawingPresets,
  ...canvasPresets,
  ...laserDmxPresets,
  ...pixGridPresets,
  ...headlinerPresets,
])
