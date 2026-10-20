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
export type PresetManagerActivation =
  | 'cinema2'
  | 'react'
  | 'canvas'
  | 'laserDmxBeamMatrix'
  | 'laserDmxPerformance'
  | 'laserDmxTemplate'
  | 'headliner'

export interface PresetManagerRecord {
  id: string
  sourceId: string
  name: string
  description: string
  engineName: string
  category: string
  tags: readonly string[]
  artwork: PresetManagerArtwork
  activation: PresetManagerActivation
  /** The complete source definition, exposed read-only by the Info inspector. */
  sourceData: Readonly<Record<string, unknown>>
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
  activation: PresetManagerActivation = 'react',
  sourceData: Readonly<Record<string, unknown>> = {},
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
    activation,
    sourceData,
  }
}

// Cinema 2.0 presets come exclusively from the native registry above. Keep the
// retired Cinema/Cinematic Worlds compatibility records out of this manager,
// even while they remain in DEFAULT_REACT_PRESETS for persisted-data migration.
const currentReactPresets = DEFAULT_REACT_PRESETS.filter(preset => (
  preset.engine !== 'cinema' && preset.engine !== 'cinematicPortal'
))

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
    'cinema2',
    manifest as unknown as Readonly<Record<string, unknown>>,
  )]
})

const soundDrawingPresets = currentReactPresets
  .filter(preset => preset.engine === 'oscilloscope')
  .map(preset => {
    const discovery = resolvePresetDiscoveryMetadata(
      preset,
      preset.oscillatorSettings?.sourceType ?? 'sound-drawing',
    )
    return record('soundDrawing', preset.id, preset.name, preset.description, 'Sound Drawing', discovery.category, discovery.tags, 'react', preset as unknown as Readonly<Record<string, unknown>>)
  })

const canvasPresets = CANVAS_VISIBLE_PRESETS
  .filter(preset => preset.id !== DEFAULT_CANVAS_PRESET_ID)
  .map(preset => {
    const discovery = resolvePresetDiscoveryMetadata(preset, preset.rendererKind)
    return record('canvas', preset.id, preset.name, preset.description, 'CANVAS', discovery.category, discovery.tags, 'canvas', preset as unknown as Readonly<Record<string, unknown>>)
  })

const laserDmxPresets = [
  ...LASER_DMX_BEAM_MATRIX_PRESETS.map(preset => record(
    'laserDmx', preset.id, preset.name, preset.description, 'LaserDMX', preset.category, preset.tags, 'laserDmxBeamMatrix', preset as unknown as Readonly<Record<string, unknown>>,
  )),
  ...LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.map(preset => {
    const discovery = resolvePresetDiscoveryMetadata(
      preset,
      'performance-show',
      [...preset.genreTags, ...preset.behaviorTags, ...preset.musicIntelligenceCapabilities],
    )
    return record('laserDmx', preset.id, preset.name, preset.description, 'LaserDMX', discovery.category, discovery.tags, 'laserDmxPerformance', preset as unknown as Readonly<Record<string, unknown>>)
  }),
  ...LASER_DMX_SHOW_DIRECTOR_TEMPLATES.map(preset => record(
    'laserDmx', preset.id, preset.name, preset.description, 'LaserDMX', preset.category, preset.tags, 'laserDmxTemplate', preset as unknown as Readonly<Record<string, unknown>>,
  )),
]

const pixGridPresets = currentReactPresets
  .filter(preset => preset.engine === 'pixGrid')
  .map(preset => {
    const discovery = resolvePresetDiscoveryMetadata(preset, preset.pixGridDeck ? 'media-deck' : 'pixel-art')
    return record('pixGrid', preset.id, preset.name, preset.description, 'PixGrid', discovery.category, discovery.tags, 'react', preset as unknown as Readonly<Record<string, unknown>>)
  })

const headlinerPresets = HEADLINER_PRESETS.map(preset => {
  const discovery = resolvePresetDiscoveryMetadata(preset, 'camera-effects')
  return record('headliner', preset.id, preset.name, preset.description, 'HEADLINER', discovery.category, discovery.tags, 'headliner', preset as unknown as Readonly<Record<string, unknown>>)
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
