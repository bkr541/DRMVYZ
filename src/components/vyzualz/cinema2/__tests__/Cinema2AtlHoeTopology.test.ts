import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CINEMA2_ATL_HOE_ATTRIBUTE_NAMES,
  CINEMA2_ATL_HOE_ROLES,
  CINEMA2_ATL_HOE_SEMANTIC_PART_ROLES,
  cinema2AtlHoeRoleCode,
} from '../modules/atlHoe/Cinema2AtlHoeTopology'

interface GltfJson {
  meshes: Array<{ name: string; primitives: Array<{ attributes: Record<string, number> }> }>
  accessors: Array<{ bufferView: number; byteOffset?: number; componentType: number; count: number }>
  bufferViews: Array<{ byteOffset?: number }>
}

function readGlb(): { data: Buffer; json: GltfJson; binaryOffset: number } {
  const data = readFileSync(resolve(process.cwd(), 'public/cinema2/models/atl-hoe.glb'))
  expect(data.toString('ascii', 0, 4)).toBe('glTF')
  const jsonLength = data.readUInt32LE(12)
  return {
    data,
    json: JSON.parse(data.toString('utf8', 20, 20 + jsonLength).trim()) as GltfJson,
    binaryOffset: 20 + jsonLength + 8,
  }
}

function validateScalarRange(asset: ReturnType<typeof readGlb>, accessorIndex: number, minimum: number, maximum: number, integer: boolean): string | null {
  const accessor = asset.json.accessors[accessorIndex]!
  expect(accessor.componentType).toBe(5126)
  const view = asset.json.bufferViews[accessor.bufferView]!
  const start = asset.binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  for (let index = 0; index < accessor.count; index += 1) {
    const value = asset.data.readFloatLE(start + index * 4)
    if (!Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
      return `vertex ${index} has ${value}, expected ${minimum}..${maximum}${integer ? ' integer' : ''}`
    }
  }
  return null
}

describe('ATL HOE semantic lighting topology', () => {
  it('assigns stable role codes and covers every performance family', () => {
    expect(CINEMA2_ATL_HOE_ROLES.map(cinema2AtlHoeRoleCode)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(new Set(Object.values(CINEMA2_ATL_HOE_SEMANTIC_PART_ROLES))).toEqual(new Set(CINEMA2_ATL_HOE_ROLES))
  })

  it('ships every semantic mesh with six scalar attributes matching its vertex count', () => {
    const asset = readGlb()
    const gltf = asset.json
    const meshByName = new Map(gltf.meshes.map(mesh => [mesh.name, mesh]))
    const attributes = Object.values(CINEMA2_ATL_HOE_ATTRIBUTE_NAMES).map(name => name.toUpperCase())
    for (const part of Object.keys(CINEMA2_ATL_HOE_SEMANTIC_PART_ROLES)) {
      const primitive = meshByName.get(part)?.primitives[0]
      expect(primitive, `${part} must be present in atl-hoe.glb`).toBeDefined()
      const positionCount = gltf.accessors[primitive!.attributes.POSITION]!.count
      for (const name of attributes) {
        expect(primitive!.attributes[name], `${part} must contain ${name}`).toBeTypeOf('number')
        expect(gltf.accessors[primitive!.attributes[name]!]!.count).toBe(positionCount)
      }
      const expectedRole = cinema2AtlHoeRoleCode(CINEMA2_ATL_HOE_SEMANTIC_PART_ROLES[part]!)
      const ranges: Record<string, readonly [number, number, boolean]> = {
        _ATL_ROLE: [expectedRole, expectedRole, true], _ATL_ZONE: [0, 6, true], _ATL_ROUTE: [0, 7, true],
        _ATL_PHASE: [0, 1, false], _ATL_LEVEL: [0, 1, false], _ATL_RANDOM: [0, 1, false],
      }
      for (const [name, [minimum, maximum, integer]] of Object.entries(ranges)) {
        expect(validateScalarRange(asset, primitive!.attributes[name]!, minimum, maximum, integer), `${part} ${name}`).toBeNull()
      }
    }
  })
})
