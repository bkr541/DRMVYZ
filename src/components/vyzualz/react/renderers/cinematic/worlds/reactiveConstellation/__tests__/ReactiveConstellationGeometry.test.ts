import { describe, expect, it } from 'vitest'
import {
  REACTIVE_CONSTELLATION_DEFAULTS,
  type ReactiveConstellationSettings,
} from '../../../../../CinematicWorldSettings'
import { buildConstellationGraph } from '../ConstellationGraphBuilder'
import { cameraViewProjectionMatrix } from '../ConstellationMath'
import { getConstellationMesh, listConstellationMeshStyles } from '../ConstellationMeshLibrary'

function settings(patch: Partial<ReactiveConstellationSettings> = {}): ReactiveConstellationSettings {
  return { ...REACTIVE_CONSTELLATION_DEFAULTS, ...patch }
}

describe('Reactive Constellation geometry foundation', () => {
  it('builds deterministic seeded topology and changes structure for different seeds and styles', () => {
    const input = { seed: 48001, nodeCount: 48, settings: settings() }
    const first = buildConstellationGraph(input)
    const second = buildConstellationGraph(input)
    const differentSeed = buildConstellationGraph({ ...input, seed: 48002 })
    const helix = buildConstellationGraph({ ...input, settings: settings({ topologyStyle: 'helix' }) })

    expect(first).toEqual(second)
    expect(first.nodes).toHaveLength(48)
    expect(first.edges.length).toBeGreaterThan(0)
    expect(first.nodes.map(node => node.position)).not.toEqual(differentSeed.nodes.map(node => node.position))
    expect(first.nodes.map(node => node.position)).not.toEqual(helix.nodes.map(node => node.position))
  })

  it('uses neighbor count to alter graph density, node orientation, and prominence', () => {
    const sparse = buildConstellationGraph({ seed: 9, nodeCount: 36, settings: settings({ neighborCount: 1 }) })
    const dense = buildConstellationGraph({ seed: 9, nodeCount: 36, settings: settings({ neighborCount: 7 }) })
    const averageProminence = (values: typeof sparse.nodes) =>
      values.reduce((sum, node) => sum + node.prominence, 0) / values.length

    expect(dense.edges.length).toBeGreaterThan(sparse.edges.length)
    expect(averageProminence(dense.nodes)).toBeGreaterThan(averageProminence(sparse.nodes))
    expect(dense.nodes.map(node => node.rotation)).not.toEqual(sparse.nodes.map(node => node.rotation))
  })

  it('provides real flat-shaded triangle geometry for every supported mesh style', () => {
    for (const style of listConstellationMeshStyles()) {
      const mesh = getConstellationMesh(style)
      expect(mesh.vertexCount, style).toBeGreaterThanOrEqual(12)
      expect(mesh.vertexCount % 3, style).toBe(0)
      expect(mesh.positions.length, style).toBe(mesh.vertexCount * 3)
      expect(mesh.normals.length, style).toBe(mesh.positions.length)
      expect(mesh.barycentrics.length, style).toBe(mesh.positions.length)
      for (let index = 0; index < mesh.vertexCount; index += 3) {
        const offset = index * 3
        expect(Array.from(mesh.normals.slice(offset, offset + 3))).toEqual(Array.from(mesh.normals.slice(offset + 3, offset + 6)))
        expect(Array.from(mesh.normals.slice(offset, offset + 3))).toEqual(Array.from(mesh.normals.slice(offset + 6, offset + 9)))
      }
    }
  })

  it('distributes mixed polyhedra and produces a finite shared-camera view projection', () => {
    const graph = buildConstellationGraph({
      seed: 48123,
      nodeCount: 64,
      settings: settings({ polyhedronStyle: 'mixed' }),
    })
    expect(new Set(graph.nodes.map(node => node.meshStyle)).size).toBeGreaterThan(1)

    const matrix = cameraViewProjectionMatrix({
      position: { x: 0.25, y: -0.1, z: 3.2 },
      rotation: { x: 0.08, y: -0.2, z: 0.03 },
      fieldOfView: 58,
      aspect: 16 / 9,
    })
    expect(matrix).toHaveLength(16)
    expect(Array.from(matrix).every(Number.isFinite)).toBe(true)
  })
})
