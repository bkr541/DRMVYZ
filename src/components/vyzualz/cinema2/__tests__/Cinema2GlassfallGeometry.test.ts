// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildGlassfallSymbolGeometries, glassfallCells, GLASSFALL_SYMBOL_Z, GLASSFALL_PANEL_FRONT_Z, GLASSFALL_REAR_Z } from '../modules/glassfall/Cinema2GlassfallGeometry'
const directory = resolve(process.cwd(), 'src/components/vyzualz/cinema2/modules/glassfall')

describe('GLASSFALL reference geometry', () => {
  it('uses reference paired bands rather than evenly spaced alternating rows', () => {
    const cells = glassfallCells(712 / 1006)
    const upright = cells.find(cell => cell.x === 0 && cell.y === 0)!
    const inverted = cells.find(cell => cell.inverted && cell.x === .52 && cell.y === .26)!
    const nextBand = cells.find(cell => cell.x === 0 && cell.y === 1.10)!
    expect(upright.inverted).toBe(false)
    expect(inverted.y - upright.y).toBeCloseTo(.26)
    expect(nextBand.y - inverted.y).toBeCloseTo(.84)
  })

  it('preserves the supplied triangle bounds, center, relief and both background gaps', async () => {
    const bytes = readFileSync(resolve(directory, 'triangle.glb'))
    const source = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '')
    const geometries = buildGlassfallSymbolGeometries(THREE, source.scene)
    for (const geometry of Object.values(geometries)) {
      const size = geometry.boundingBox!.getSize(new THREE.Vector3())
      expect(size.x).toBeCloseTo(.78, 5); expect(size.y).toBeCloseTo(.68, 5); expect(size.z).toBeCloseTo(.12, 5)
      expect(geometry.boundingBox!.getCenter(new THREE.Vector3()).length()).toBeLessThan(.00001)
      expect(GLASSFALL_SYMBOL_Z + geometry.boundingBox!.min.z - GLASSFALL_PANEL_FRONT_Z).toBeGreaterThan(.15)
      geometry.dispose()
    }
    expect(GLASSFALL_PANEL_FRONT_Z - .10 - GLASSFALL_REAR_Z).toBeGreaterThan(.25)
    source.scene.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose()
    })
  })
})
