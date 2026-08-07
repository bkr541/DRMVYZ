import { describe, expect, it } from 'vitest'
import {
  CINEMA_FOUNDATION_COMPOSITION,
  CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
  cinemaStableId,
  createCinemaFoundationPersistedState,
  createCinemaStore,
  normalizeCinemaAssetBinding,
  resolveCinemaAuthoredAssetBindings,
  snapshotCinemaPersistedState,
  type CinemaAssetBindingDefinition,
  type CinemaAssetBindingId,
  type CinemaAssetId,
  type CinemaCompositionDefinition,
  type CinemaNodeId,
  type CinemaStableId,
} from '../index'
import { createCinemaMediaLibrarySnapshot } from '../../react/CinemaMediaLibraryBridge'
import type { UploadedMedia } from '../../../../stores/mediaStore'

function stable<T extends CinemaStableId>(value: string, kind: string): T {
  return cinemaStableId<T>(value, kind)
}

const bindingId = stable<CinemaAssetBindingId>('stage-14-logo-binding', 'asset binding')
const assetId = stable<CinemaAssetId>('media-stage-14-logo', 'asset')

function binding(overrides: Partial<CinemaAssetBindingDefinition> = {}): CinemaAssetBindingDefinition {
  return {
    id: bindingId,
    assetId,
    role: 'logo',
    fit: 'contain',
    preserveOriginalColors: true,
    opacity: 1,
    blendMode: 'normal',
    ...overrides,
  }
}

function compositionWithBinding(assetBinding: CinemaAssetBindingDefinition = binding()): CinemaCompositionDefinition {
  const sourceNode = CINEMA_FOUNDATION_COMPOSITION.nodes.find(node => node.family !== 'output')!
  return {
    ...structuredClone(CINEMA_FOUNDATION_COMPOSITION),
    id: stable('stage-14-asset-composition', 'composition'),
    revision: 14,
    metadata: { name: 'Stage 14 Asset Fixture' },
    nodes: CINEMA_FOUNDATION_COMPOSITION.nodes.map(node => node.id === sourceNode.id
      ? { ...structuredClone(node), assetBindingIds: [assetBinding.id] }
      : structuredClone(node)),
    assetBindings: [assetBinding],
  }
}

describe('Cinema asset binding normalization and validation', () => {
  it('normalizes every persisted binding field without retaining runtime objects or URLs', () => {
    const normalized = normalizeCinemaAssetBinding({
      id: bindingId,
      assetId,
      role: 'logo',
      fit: 'invalid-fit',
      crop: [-1, 0.25, 4, 0.75],
      position: [2, -2],
      scale: [0, 5000],
      rotationRadians: 'invalid',
      preserveOriginalColors: false,
      colorizeWithBrandRole: 'accent',
      brandColorPolicy: 'exact',
      opacity: 4,
      blendMode: 'invalid-blend',
    })

    expect(normalized.ok).toBe(true)
    expect(normalized.value).toMatchObject({
      fit: 'contain',
      crop: [0, 0.25, 1, 0.75],
      scale: [0.0001, 1000],
      rotationRadians: 0,
      opacity: 1,
      blendMode: 'normal',
      brandColorPolicy: 'exact',
    })
    expect(normalized.diagnostics.counts.warning).toBeGreaterThan(0)

    const valid = normalizeCinemaAssetBinding({
      id: bindingId,
      assetId,
      role: 'logo',
      fit: 'cover',
      crop: [0, 0.25, 1, 0.75],
      position: [0.25, 0.75],
      scale: [1.5, 0.5],
      rotationRadians: 0.5,
      preserveOriginalColors: false,
      colorizeWithBrandRole: 'accent',
      brandColorPolicy: 'exact',
      opacity: 0.7,
      blendMode: 'screen',
    })
    expect(valid.ok).toBe(true)
    expect(valid.value).toMatchObject({
      id: bindingId,
      assetId,
      role: 'logo',
      fit: 'cover',
      preserveOriginalColors: false,
      colorizeWithBrandRole: 'accent',
      brandColorPolicy: 'exact',
      opacity: 0.7,
      blendMode: 'screen',
    })
    expect(JSON.stringify(valid.value)).not.toMatch(/blob:|WebGL|HTML(Image|Video)/)
  })

  it('diagnoses missing, deleted, incompatible, and recursive sources with deterministic fallbacks', () => {
    const composition = compositionWithBinding()
    const missing = resolveCinemaAuthoredAssetBindings({ composition, sources: [] })
    expect(missing.bindings.get(bindingId)?.fallback).toMatchObject({ kind: 'checkerboard', reason: 'missing' })
    expect(missing.diagnostics.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_ASSET_MISSING')).toBe(true)

    const deleted = resolveCinemaAuthoredAssetBindings({
      composition,
      sources: [{ assetId, revision: 2, name: 'Deleted Logo', mimeType: 'image/png', mediaKind: 'image', runtimeUrl: null, deleted: true }],
    })
    expect(deleted.bindings.get(bindingId)?.fallback?.reason).toBe('deleted')

    const incompatible = resolveCinemaAuthoredAssetBindings({
      composition,
      sources: [{ assetId, revision: 3, name: 'Wrong Kind', mimeType: 'video/mp4', mediaKind: 'video', runtimeUrl: 'signed://video' }],
    })
    expect(incompatible.bindings.get(bindingId)?.fallback?.reason).toBe('incompatible')
    expect(incompatible.diagnostics.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_ASSET_CAPABILITY_MISMATCH')).toBe(true)

    const nodeA = stable<CinemaNodeId>('recursive-node-a', 'node')
    const nodeB = stable<CinemaNodeId>('recursive-node-b', 'node')
    const bindingA = stable<CinemaAssetBindingId>('recursive-binding-a', 'asset binding')
    const bindingB = stable<CinemaAssetBindingId>('recursive-binding-b', 'asset binding')
    const assetA = stable<CinemaAssetId>('recursive-output-a', 'asset')
    const assetB = stable<CinemaAssetId>('recursive-output-b', 'asset')
    const recursiveComposition: CinemaCompositionDefinition = {
      ...composition,
      nodes: composition.nodes.map((node, index) => index === 0
        ? { ...node, id: nodeA, assetBindingIds: [bindingA] }
        : { ...node, id: nodeB, assetBindingIds: [bindingB] }),
      outputNodeId: nodeB,
      connections: [],
      assetBindings: [
        binding({ id: bindingA, assetId: assetA, role: 'node-output' }),
        binding({ id: bindingB, assetId: assetB, role: 'node-output' }),
      ],
    }
    const recursive = resolveCinemaAuthoredAssetBindings({
      composition: recursiveComposition,
      sources: [
        { assetId: assetA, revision: 1, name: 'A', mimeType: null, mediaKind: 'node-output', runtimeUrl: null, nodeOutputNodeId: nodeB },
        { assetId: assetB, revision: 1, name: 'B', mimeType: null, mediaKind: 'node-output', runtimeUrl: null, nodeOutputNodeId: nodeA },
      ],
    })
    expect(recursive.diagnostics.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_ASSET_RECURSIVE_BINDING')).toBe(true)
    expect(recursive.bindings.get(bindingA)?.fallback?.reason).toBe('recursive')
  })
})

describe('Cinema media-library bridge and complete-graph history', () => {
  it('adapts canonical media IDs while keeping signed URLs runtime-only', () => {
    const media = {
      id: 'runtime-row-7',
      dbId: 'UPLOAD_ABC_123',
      name: 'Hero Logo',
      type: 'image',
      url: 'blob:https://runtime-only/example',
      proxyUrl: 'https://signed.example/logo.png',
      thumbnailUrl: null,
      meta: 'PNG · 800×400',
      favorite: false,
      mediaRole: 'logo',
      tags: [],
      collectionIds: [],
      metadata: { width: 800, height: 400 },
      mimeType: 'image/png',
      revision: 7,
    } satisfies UploadedMedia

    const snapshots = createCinemaMediaLibrarySnapshot([media])
    expect(snapshots[0]).toMatchObject({
      assetId: 'media-upload-abc-123',
      revision: 7,
      mediaKind: 'image',
      runtimeUrl: 'https://signed.example/logo.png',
      width: 800,
      height: 400,
    })
    expect(JSON.stringify(binding({ assetId: snapshots[0].assetId }))).not.toContain(snapshots[0].runtimeUrl)
  })

  it('deletes binding dependents atomically and undo restores the complete graph', () => {
    const initial = createCinemaFoundationPersistedState()
    const composition = compositionWithBinding()
    const store = createCinemaStore({
      initialState: {
        ...initial,
        schemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
        compositions: [...initial.compositions, composition],
        activeCompositionId: composition.id,
      },
    })
    const before = snapshotCinemaPersistedState(store.getState())

    expect(store.getState().deleteCinemaAssetBinding(composition.id, bindingId).ok).toBe(true)
    const deleted = store.getState().compositions.find(candidate => candidate.id === composition.id)!
    expect(deleted.assetBindings).toEqual([])
    expect(deleted.nodes.every(node => !(node.assetBindingIds ?? []).includes(bindingId))).toBe(true)

    expect(store.getState().undoCinemaEdit().ok).toBe(true)
    expect(snapshotCinemaPersistedState(store.getState())).toEqual(before)
  })
})
