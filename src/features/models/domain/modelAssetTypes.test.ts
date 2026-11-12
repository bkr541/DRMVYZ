import { describe, expect, it } from 'vitest'
import {
  assertOwnedModelPath, MODEL_MAX_TRIANGLES, modelStoragePaths, parseModelAsset,
  parseModelGeometryStats, parseModelOperation, parseModelRecipe, parseModelVersion,
} from './modelAssetTypes'
import { assetRow, MODEL_ID, NOW, OP_ID, recipe, stats, USER_A, USER_B, VERSION_ID } from '../__tests__/modelAssetFixtures'

describe('model domain persistence contract', () => {
  it('round-trips the complete versioned recipe and geometry without sharing mutable input', () => {
    const result = parseModelRecipe(JSON.parse(JSON.stringify(recipe)))
    expect(result).toEqual(recipe)
    result.materials[0].color = '#000000'
    expect(recipe.materials[0].color).toBe('#ffffff')
    expect(parseModelGeometryStats(JSON.parse(JSON.stringify(stats)))).toEqual(stats)
    expect(parseModelAsset(assetRow())).toMatchObject({ id: MODEL_ID, currentVersion: 0, userId: USER_A })
  })

  it.each([
    null, [], {}, { ...recipe, schemaVersion: 2 },
    { ...recipe, foreground: { ...recipe.foreground, threshold: NaN } },
    { ...recipe, geometry: { ...recipe.geometry, depth: 0 } },
    { ...recipe, geometry: { ...recipe.geometry, curveSegments: 500 } },
    { ...recipe, transform: { ...recipe.transform, scale: [0, 1, 1] } },
    { ...recipe, materials: [recipe.materials[0], recipe.materials[0]] },
    { ...recipe, materials: [{ ...recipe.materials[0], color: 'url(https://example.com)' }] },
  ])('rejects unsupported or malformed recipe %#', value => {
    expect(() => parseModelRecipe(value)).toThrow()
  })

  it('enforces geometry budgets, finite values and correctly ordered bounds', () => {
    expect(() => parseModelGeometryStats({ ...stats, triangles: MODEL_MAX_TRIANGLES + 1 })).toThrow()
    expect(() => parseModelGeometryStats({ ...stats, vertices: Infinity })).toThrow()
    expect(() => parseModelGeometryStats({ ...stats, bounds: { min: [2, 0, 0], max: [1, 1, 1] } })).toThrow()
    expect(() => parseModelAsset(assetRow({ favorite: 'yes' }))).toThrow()
    expect(() => parseModelAsset(assetRow({ created_at: 'bad' }))).toThrow()
  })

  it('derives version and operation scoped paths and rejects foreign or traversal paths', () => {
    const paths = modelStoragePaths(USER_A, MODEL_ID, 1, OP_ID, 'svg', true)
    expect(paths.sourceSnapshotPath).toBe(`${USER_A}/${MODEL_ID}/1/${OP_ID}/source.svg`)
    expect(paths.thumbnailPath).toContain('/thumbnail.png')
    expect(() => assertOwnedModelPath(paths.glbPath, USER_A, MODEL_ID)).not.toThrow()
    expect(() => assertOwnedModelPath(paths.glbPath, USER_B, MODEL_ID)).toThrow()
    expect(() => assertOwnedModelPath(`${USER_A}/${MODEL_ID}/../model.glb`, USER_A, MODEL_ID)).toThrow()
    expect(() => modelStoragePaths(USER_A, MODEL_ID, 0, OP_ID, 'png', false)).toThrow()
  })

  it('validates version identity against every artifact path and retains the independent source snapshot', () => {
    const paths = modelStoragePaths(USER_A, MODEL_ID, 1, OP_ID, 'png', false)
    const row = { id: VERSION_ID, model_asset_id: MODEL_ID, version: 1, operation_id: OP_ID, glb_path: paths.glbPath,
      source_snapshot_path: paths.sourceSnapshotPath, trace_svg_path: paths.traceSvgPath, thumbnail_path: null,
      generator_recipe: recipe, geometry_stats: stats, created_at: NOW }
    expect(parseModelVersion(row, USER_A)).toMatchObject({ sourceSnapshotPath: paths.sourceSnapshotPath, generatorRecipe: recipe })
    expect(() => parseModelVersion(row, USER_B)).toThrow()
    expect(() => parseModelVersion({ ...row, version: 2 }, USER_A)).toThrow()
    expect(() => parseModelVersion({ ...row, thumbnail_path: paths.glbPath }, USER_A)).toThrow()
    expect(parseModelAsset(assetRow({ source_media_id: null })).sourceMediaId).toBeNull()
    expect(parseModelVersion(row, USER_A).sourceSnapshotPath).toBe(paths.sourceSnapshotPath)
    expect(parseModelOperation({ id: OP_ID, model_asset_id: MODEL_ID, expected_version: 0, state: 'cleanup_pending', source_extension: 'png', has_thumbnail: false, generator_recipe: recipe, geometry_stats: stats, created_at: NOW }).state).toBe('cleanup_pending')
  })
  it('round-trips optional physical materials, preview controls and saved source statistics without altering older recipes', () => {
    const extended = { ...recipe, materials: [{ ...recipe.materials[0], emissiveIntensity: 2.5, clearcoat: 0.8, clearcoatRoughness: 0.15 }], preview: { ...recipe.preview, grid: false, shadows: true, turntable: true } }
    expect(parseModelRecipe(extended)).toEqual(extended)
    const savedStats = { ...stats, glbBytes: 4096, materialCount: 2, source: { width: 100, height: 100, mimeType: 'image/svg+xml', byteSize: 512 } }
    expect(parseModelGeometryStats(savedStats)).toEqual(savedStats)
    expect(() => parseModelRecipe({ ...extended, materials: [{ ...extended.materials[0], clearcoat: 1.1 }] })).toThrow()
    expect(() => parseModelGeometryStats({ ...savedStats, glbBytes: 0 })).toThrow()
  })

})
