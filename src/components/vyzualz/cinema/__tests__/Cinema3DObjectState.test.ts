import { describe, expect, it } from 'vitest'

import {
  CINEMA_3D_OBJECT_PARAMETER_CAPABILITIES,
  CINEMA_3D_OBJECT_PARAMETER_IDS,
  CINEMA_3D_OBJECT_PARAMETER_SCHEMAS,
  classifyCinema3DObjectInvalidation,
  createDefaultCinema3DObjectDefinition,
  hydrateCinema3DObjectDefinition,
  serializeCinema3DObjectDefinition,
} from '../Cinema3DObjectState'
import { isCinemaJsonValue } from '../CinemaDomain'
import { CINEMA_FOUNDATION_GRADIENT_TYPE_ID, createCinemaFoundationPersistedState } from '../CinemaFoundation'
import { cinemaStableId, type CinemaAssetId, type CinemaParameterId } from '../CinemaIdentifiers'
import {
  normalizeCinemaPersistedState,
  snapshotCinemaPersistedState,
  type CinemaPersistedState,
} from '../CinemaPersistence'
import { validateCinemaParameterSchemas } from '../CinemaParameterSchema'

describe('Cinema reusable 3D object authored state', () => {
  it('constructs safe defaults and validates the canonical parameter schema', () => {
    const definition = createDefaultCinema3DObjectDefinition()
    expect(definition).toEqual({
      source: { type: 'text', text: '', fontIdentity: '', font: null },
      geometry: { quality: 'balanced', extrusionDepth: 0.35, pivotPolicy: 'center' },
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      appearance: { frontColor: [1, 1, 1, 1], sideColor: [0.42, 0.46, 0.52, 1], emissiveIntensity: 0 },
    })
    expect(validateCinemaParameterSchemas(CINEMA_3D_OBJECT_PARAMETER_SCHEMAS, { owner: 'node' })).toEqual([])
    expect(CINEMA_3D_OBJECT_PARAMETER_CAPABILITIES).toHaveLength(CINEMA_3D_OBJECT_PARAMETER_SCHEMAS.length)
  })

  it('serializes and hydrates text state through existing Cinema parameter values', () => {
    const fontAssetId = cinemaStableId<CinemaAssetId>('font-asset', 'asset')
    const definition = {
      ...createDefaultCinema3DObjectDefinition(),
      source: { type: 'text' as const, text: 'DRMVYZ', fontIdentity: 'brand-font-v1', font: { assetId: fontAssetId, role: 'font' as const } },
      geometry: { quality: 'high' as const, extrusionDepth: 0.8, pivotPolicy: 'source-origin' as const },
      transform: { position: [1, 2, 3] as const, rotation: [0.1, 0.2, 0.3] as const, scale: [2, 1.5, 0.9] as const },
      appearance: { frontColor: [0.9, 0.7, 0.2, 1] as const, sideColor: [0.2, 0.8, 1, 1] as const, emissiveIntensity: 0.6 },
    }
    const unrelatedId = cinemaStableId<CinemaParameterId>('unrelated-value', 'parameter')
    const values = serializeCinema3DObjectDefinition(definition, { [unrelatedId]: 0.75 })
    expect(isCinemaJsonValue(values)).toBe(true)
    expect(values[unrelatedId]).toBe(0.75)
    expect(hydrateCinema3DObjectDefinition(values)).toEqual(definition)
  })

  it('serializes SVG state without persisting text/font runtime data', () => {
    const assetId = cinemaStableId<CinemaAssetId>('logo-svg', 'asset')
    const definition = {
      ...createDefaultCinema3DObjectDefinition(),
      source: { type: 'svg' as const, asset: { assetId, role: 'logo' as const } },
    }
    const values = serializeCinema3DObjectDefinition(definition)
    expect(values[CINEMA_3D_OBJECT_PARAMETER_IDS.svgAsset]).toEqual({ assetId, role: 'logo' })
    expect(values[CINEMA_3D_OBJECT_PARAMETER_IDS.font]).toBeNull()
    expect(values[CINEMA_3D_OBJECT_PARAMETER_IDS.text]).toBe('')
    expect(hydrateCinema3DObjectDefinition(values)).toEqual(definition)
  })

  it('hydrates missing and malformed fields to safe canonical defaults', () => {
    const hydrated = hydrateCinema3DObjectDefinition({
      [CINEMA_3D_OBJECT_PARAMETER_IDS.extrusionDepth]: Number.POSITIVE_INFINITY,
      [CINEMA_3D_OBJECT_PARAMETER_IDS.scale]: [1, 2] as never,
      [CINEMA_3D_OBJECT_PARAMETER_IDS.frontColor]: [2, 0, 0, 1] as never,
    })
    expect(hydrated).toEqual({
      ...createDefaultCinema3DObjectDefinition(),
      appearance: { ...createDefaultCinema3DObjectDefinition().appearance, frontColor: [1, 0, 0, 1] },
    })
    expect(hydrateCinema3DObjectDefinition({
      [CINEMA_3D_OBJECT_PARAMETER_IDS.sideColor]: [0.2, 0.3, 0.4, 0.1],
    }).appearance.sideColor).toEqual([0.2, 0.3, 0.4, 1])
  })

  it('classifies structural, transform, and material invalidation boundaries', () => {
    const base = createDefaultCinema3DObjectDefinition()
    const material = { ...base, appearance: { ...base.appearance, emissiveIntensity: 1 } }
    const transform = { ...base, geometry: { ...base.geometry, extrusionDepth: 1.2 } }
    const geometry = { ...base, geometry: { ...base.geometry, quality: 'high' as const } }
    const source = { ...base, source: { ...base.source, text: 'A' } }
    expect(classifyCinema3DObjectInvalidation(base, base)).toBe('none')
    expect(classifyCinema3DObjectInvalidation(base, material)).toBe('material')
    expect(classifyCinema3DObjectInvalidation(base, transform)).toBe('transform')
    expect(classifyCinema3DObjectInvalidation(base, geometry)).toBe('geometry')
    expect(classifyCinema3DObjectInvalidation(base, source)).toBe('source')
  })

  it('round-trips object parameters through canonical Cinema persistence without a schema migration', () => {
    const state = createCinemaFoundationPersistedState() as CinemaPersistedState
    const mutable = JSON.parse(JSON.stringify(state)) as CinemaPersistedState
    const definitionIndex = mutable.definitions.findIndex(entry => entry.id === CINEMA_FOUNDATION_GRADIENT_TYPE_ID)
    const compositionIndex = mutable.compositions.findIndex(composition => composition.nodes.some(node => node.typeId === CINEMA_FOUNDATION_GRADIENT_TYPE_ID))
    expect(definitionIndex).toBeGreaterThanOrEqual(0)
    expect(compositionIndex).toBeGreaterThanOrEqual(0)
    if (definitionIndex < 0 || compositionIndex < 0) return

    const persistedDefinition = mutable.definitions[definitionIndex]
    const objectDefinition = {
      ...createDefaultCinema3DObjectDefinition(),
      source: { type: 'text' as const, text: 'Persistent', fontIdentity: 'persistent-font', font: null },
    }
    const parameterValues = serializeCinema3DObjectDefinition(objectDefinition)
    mutable.definitions = mutable.definitions.map((entry, index) => index === definitionIndex ? {
      ...entry,
      definition: {
        ...persistedDefinition.definition,
        parameters: [...persistedDefinition.definition.parameters, ...CINEMA_3D_OBJECT_PARAMETER_SCHEMAS],
        parameterCapabilities: [
          ...(persistedDefinition.definition.parameterCapabilities ?? []),
          ...CINEMA_3D_OBJECT_PARAMETER_CAPABILITIES,
        ],
      },
    } : entry)
    mutable.compositions = mutable.compositions.map((composition, index) => index === compositionIndex ? {
      ...composition,
      nodes: composition.nodes.map(node => node.typeId === CINEMA_FOUNDATION_GRADIENT_TYPE_ID ? {
        ...node,
        parameterValues: { ...node.parameterValues, ...parameterValues },
      } : node),
    } : composition)

    const firstSnapshot = snapshotCinemaPersistedState(mutable)
    const normalized = normalizeCinemaPersistedState(JSON.parse(JSON.stringify(firstSnapshot)))
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return
    const secondSnapshot = snapshotCinemaPersistedState(normalized.value)
    expect(secondSnapshot).toEqual(firstSnapshot)
    expect(secondSnapshot.schemaVersion).toBe(state.schemaVersion)
    const persistedNode = secondSnapshot.compositions[compositionIndex].nodes.find(node => node.typeId === CINEMA_FOUNDATION_GRADIENT_TYPE_ID)
    expect(persistedNode).toBeDefined()
    expect(hydrateCinema3DObjectDefinition(persistedNode?.parameterValues ?? {})).toEqual(objectDefinition)
  })

  it('preserves legacy compositions with no 3D object parameters unchanged', () => {
    const legacy = createCinemaFoundationPersistedState()
    const result = normalizeCinemaPersistedState(JSON.parse(JSON.stringify(legacy)))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual(legacy)
  })
})
