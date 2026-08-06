import { describe, expect, it } from 'vitest'
import * as Cinema from '../index'
import {
  REACT_ENGINE_CATALOG,
  REACT_ENGINE_IDS,
  isSelectableReactEngineId,
} from '../../react/reactEngineCatalog'

describe('Cinema Stage 1 production boundary', () => {
  it('enters through the production-intended Cinema public module without registering a renderer or engine', () => {
    expect(Cinema.CINEMA_COMPOSITION_SCHEMA_VERSION).toBe(1)
    expect(Cinema.CINEMA_SAFE_OUTPUT_DESCRIPTOR.alphaMode).toBe('premultiplied')
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
