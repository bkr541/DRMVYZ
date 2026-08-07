import { describe, expect, it } from 'vitest'
import * as Cinema from '../index'
import {
  REACT_ENGINE_CATALOG,
  REACT_ENGINE_IDS,
  isSelectableReactEngineId,
} from '../../react/reactEngineCatalog'

describe('Cinema production boundary through Stage 22', () => {
  it('keeps prior contracts public while exposing Shader and Cinematic World adapters through production ownership', () => {
    expect(Cinema.CINEMA_COMPOSITION_SCHEMA_VERSION).toBe(3)
    expect(Cinema.CINEMA_SAFE_OUTPUT_DESCRIPTOR.alphaMode).toBe('premultiplied')
    expect(Cinema.CINEMA_COMPILED_GRAPH_VERSION).toBe(1)
    expect(typeof Cinema.compileCinemaCompositionGraph).toBe('function')
    expect(typeof Cinema.createCinemaNodeDefinitionRegistry).toBe('function')
    expect(typeof Cinema.createCinemaRuntimeNodeRegistry).toBe('function')
    expect(Cinema.CINEMA_FOUNDATION_RUNTIME_REGISTRY.size).toBe(2)
    expect(Cinema.CINEMA_PRODUCTION_RUNTIME_REGISTRY.size).toBe(
      2
        + Cinema.CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.length
        + Cinema.CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.length
        + Cinema.CINEMA_MEDIA_TEXT_RUNTIME_REGISTRATIONS.length
        + Cinema.CINEMA_COMPOSITOR_RUNTIME_REGISTRATIONS.length,
    )
    expect(Cinema.CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries).toHaveLength(9)
    expect(Cinema.CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries).toHaveLength(11)
    expect(typeof Cinema.createCinemaShaderSceneComposition).toBe('function')
    expect(typeof Cinema.createCinemaCinematicWorldComposition).toBe('function')
    expect(typeof Cinema.createCinemaCinematicPresetComposition).toBe('function')
    expect(Cinema.CINEMA_LEGACY_PRESET_CATALOG.version).toBe(Cinema.CINEMA_LEGACY_PRESET_CATALOG_VERSION)
    expect(Cinema.CINEMA_LEGACY_PRESET_CATALOG.manifest.length).toBe(Cinema.CINEMA_LEGACY_PRESET_CATALOG.compositions.length)
    expect(typeof Cinema.CinematicWorldNodeAdapter).toBe('function')
    expect(typeof Cinema.CinemaCanvas2DNodeAdapter).toBe('function')
    expect(typeof Cinema.CinemaGraphExecutor).toBe('function')
    expect(typeof Cinema.createCinemaFoundationPersistedState).toBe('function')
    expect(typeof Cinema.normalizeCinemaParameterValue).toBe('function')
    expect(typeof Cinema.resolveCinemaParameterSnapshot).toBe('function')
    expect(typeof Cinema.createCinemaControlDescriptors).toBe('function')
    expect(typeof Cinema.createCinemaStore).toBe('function')
    expect(typeof Cinema.normalizeCinemaAssetBinding).toBe('function')
    expect(typeof Cinema.bridgeCinemaBrandKit).toBe('function')
    expect(typeof Cinema.CinemaAssetManager).toBe('function')
    expect(Cinema.CINEMA_MEDIA_TEXT_PERSISTED_DEFINITIONS).toHaveLength(7)
    expect(Cinema.CINEMA_IMAGE_NODE_DEFINITION.output.alphaMode).toBe('premultiplied')
    expect(Cinema.CINEMA_TEXT_NODE_DEFINITION.output.hasMask).toBe(true)
    expect(Cinema.CINEMA_LYRIC_NODE_DEFINITION.output.hasMask).toBe(true)
    expect(typeof Cinema.resolveCinemaLyricDisplay).toBe('function')
    expect(Cinema.CINEMA_COMPOSITOR_PERSISTED_DEFINITIONS).toHaveLength(23)
    expect(Object.keys(Cinema.CINEMA_BLEND_NODE_DEFINITIONS)).toHaveLength(8)
    expect(Object.keys(Cinema.CINEMA_EFFECT_NODE_DEFINITIONS)).toHaveLength(13)
    expect(Cinema.CINEMA_TRANSITION_NODE_DEFINITION.output).toMatchObject({ colorSpace: 'linear-srgb', alphaMode: 'premultiplied' })
    expect(typeof Cinema.blendCinemaPremultiplied).toBe('function')
    expect(Cinema.CINEMA_FRAME_CONTEXT_VERSION).toBe(1)
    expect(typeof Cinema.buildCinemaFrameContext).toBe('function')
    expect(typeof Cinema.createCinemaDeterministicEventId).toBe('function')
    expect(typeof Cinema.preflightCinemaPackage).toBe('function')
    expect(typeof Cinema.encodeCinemaPackage).toBe('function')
    expect(Cinema.CINEMA_GRAPH_EDITOR_METADATA_VERSION).toBe(1)
    expect(typeof Cinema.connectCinemaGraphNodes).toBe('function')
    expect(Cinema.CINEMA_PERSISTED_STORE_SCHEMA_VERSION).toBe(4)
    expect(Cinema.CINEMA_PACKAGE_SCHEMA_VERSION).toBe(4)
    expect(Cinema.CINEMA_PERSIST_MIDDLEWARE_VERSION).toBe(4)
    expect(Cinema.CINEMA_PARAMETER_RESOLUTION_ORDER).toEqual([
      'definition-default',
      'saved-preset',
      'instance-override',
      'brand-kit-policy',
      'master-influence',
      'modulation-snapshot',
      'performance-override',
      'safety-clamp',
      'exact-brand-protection',
      'final-runtime-value',
    ])
    expect(REACT_ENGINE_IDS).toEqual([
      'shaderPads',
      'cinematicPortal',
      'cinema',
      'oscilloscope',
      'canvas',
      'laserDmx',
      'pixGrid',
    ])
    expect(isSelectableReactEngineId('cinema')).toBe(true)
    expect(REACT_ENGINE_CATALOG.cinema.label).toBe('Cinema')
  })

  it('preserves the complete legacy production catalog and selection guards', () => {
    expect(Object.values(REACT_ENGINE_CATALOG).map(entry => entry.id)).toEqual(REACT_ENGINE_IDS)
    expect(REACT_ENGINE_IDS.every(isSelectableReactEngineId)).toBe(true)
    expect(REACT_ENGINE_CATALOG.shaderPads.label).toBe('Shader Pads')
    expect(REACT_ENGINE_CATALOG.cinematicPortal.label).toBe('Cinematic Worlds')
  })
})
