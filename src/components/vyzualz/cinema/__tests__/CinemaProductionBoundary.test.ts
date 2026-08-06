import { describe, expect, it } from 'vitest'
import * as Cinema from '../index'
import {
  REACT_ENGINE_CATALOG,
  REACT_ENGINE_IDS,
  isSelectableReactEngineId,
} from '../../react/reactEngineCatalog'

describe('Cinema production boundary through Stage 4', () => {
  it('enters through the production-intended Cinema public module without registering a renderer or engine', () => {
    expect(Cinema.CINEMA_COMPOSITION_SCHEMA_VERSION).toBe(1)
    expect(Cinema.CINEMA_SAFE_OUTPUT_DESCRIPTOR.alphaMode).toBe('premultiplied')
    expect(Cinema.CINEMA_COMPILED_GRAPH_VERSION).toBe(1)
    expect(typeof Cinema.compileCinemaCompositionGraph).toBe('function')
    expect(typeof Cinema.createCinemaNodeDefinitionRegistry).toBe('function')
    expect(typeof Cinema.normalizeCinemaParameterValue).toBe('function')
    expect(typeof Cinema.resolveCinemaParameterSnapshot).toBe('function')
    expect(typeof Cinema.createCinemaControlDescriptors).toBe('function')
    expect(typeof Cinema.createCinemaStore).toBe('function')
    expect(typeof Cinema.preflightCinemaPackage).toBe('function')
    expect(typeof Cinema.encodeCinemaPackage).toBe('function')
    expect(Cinema.CINEMA_PERSISTED_STORE_SCHEMA_VERSION).toBe(1)
    expect(Cinema.CINEMA_PARAMETER_RESOLUTION_ORDER).toEqual([
      'definition-default',
      'saved-preset',
      'instance-override',
      'master-influence',
      'modulation-snapshot',
      'performance-override',
      'safety-clamp',
      'final-runtime-value',
    ])
    expect(REACT_ENGINE_IDS).toEqual([
      'shaderPads',
      'cinematicPortal',
      'oscilloscope',
      'canvas',
      'laserDmx',
      'pixGrid',
    ])
    expect(isSelectableReactEngineId('cinema')).toBe(false)
    expect('cinema' in REACT_ENGINE_CATALOG).toBe(false)
  })

  it('preserves the complete legacy production catalog and selection guards', () => {
    expect(Object.values(REACT_ENGINE_CATALOG).map(entry => entry.id)).toEqual(REACT_ENGINE_IDS)
    expect(REACT_ENGINE_IDS.every(isSelectableReactEngineId)).toBe(true)
    expect(REACT_ENGINE_CATALOG.shaderPads.label).toBe('Shader Pads')
    expect(REACT_ENGINE_CATALOG.cinematicPortal.label).toBe('Cinematic Worlds')
  })
})
