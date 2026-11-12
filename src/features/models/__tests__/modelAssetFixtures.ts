import type { ModelGeneratorRecipe, ModelGeometryStats } from '../domain/modelAssetTypes'
export const USER_A = 'a0000000-0000-4000-8000-000000000001'
export const USER_B = 'b0000000-0000-4000-8000-000000000001'
export const MODEL_ID = 'c0000000-0000-4000-8000-000000000001'
export const OP_ID = 'd0000000-0000-4000-8000-000000000001'
export const OP_2 = 'd0000000-0000-4000-8000-000000000002'
export const VERSION_ID = 'e0000000-0000-4000-8000-000000000001'
export const NOW = '2026-11-11T12:00:00.123456+00:00'
export const recipe: ModelGeneratorRecipe = {
  schemaVersion: 1, engine: { name: 'fixture', version: '1', threeVersion: '0.186.1' },
  foreground: { mode: 'alpha', threshold: 0.5, invert: false },
  trace: { colorMode: 'silhouette', threshold: 0.5, smoothing: 0.5, maxColors: 8 },
  geometry: { depth: 1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 12 },
  materials: [{ region: 'front', color: '#ffffff', metalness: 0.4, roughness: 0.6, opacity: 1, emissive: '#000000' }],
  transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], pivot: 'center' },
  preview: { background: '#111111', lightIntensity: 1, environment: 'neutral' },
}
export const stats: ModelGeometryStats = { triangles: 12, vertices: 24, meshes: 1, bounds: { min: [-1, -1, -1], max: [1, 1, 1] } }
export const assetRow = (overrides: Record<string, unknown> = {}) => ({
  id: MODEL_ID, user_id: USER_A, source_media_id: null, name: 'Logo', description: null, favorite: false,
  current_version: 0, status: 'draft', created_at: NOW, updated_at: NOW, ...overrides,
})
