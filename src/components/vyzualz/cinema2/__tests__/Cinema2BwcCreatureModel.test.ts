import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BWC_CREATURE_BODY_RINGS,
  BWC_CREATURE_HEIGHT_M,
  BWC_CREATURE_LABEL_V0,
  BWC_CREATURE_LABEL_V1,
  BWC_CREATURE_MATERIAL,
  BWC_CREATURE_PLACEMENT,
  bwcCreatureGlsl,
  bwcCreaturePartSdf,
  bwcCreatureSdf,
  type BwcCreaturePart,
} from '../modules/bwc/Cinema2BwcCreatureModel'

interface GltfJson {
  nodes: { name?: string; mesh?: number }[]
  meshes: { name: string; primitives: { attributes: Record<string, number>; indices: number; material: number }[] }[]
  materials: { name: string; pbrMetallicRoughness: { baseColorFactor?: number[]; roughnessFactor?: number } }[]
  accessors: { count: number; bufferView: number; byteOffset?: number; type: string }[]
  bufferViews: { byteOffset: number }[]
}

function readArtifact() {
  const file = readFileSync(join(process.cwd(), 'docs/BWC/Ultra_White_Plush_Creature_Cinema2.glb'))
  expect(file.readUInt32LE(0)).toBe(0x46546c67)
  let offset = 12
  let json: GltfJson | null = null
  let bin: Buffer | null = null
  while (offset < file.length) {
    const length = file.readUInt32LE(offset)
    const type = file.readUInt32LE(offset + 4)
    const chunk = file.subarray(offset + 8, offset + 8 + length)
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8')) as GltfJson
    else if (type === 0x004e4942) bin = chunk
    offset += 8 + length
  }
  if (!json || !bin) throw new Error('GLB chunks missing')
  const floats = (accessorIndex: number): number[] => {
    const accessor = json!.accessors[accessorIndex]!
    const components = accessor.type === 'VEC3' ? 3 : accessor.type === 'VEC2' ? 2 : 1
    const start = json!.bufferViews[accessor.bufferView]!.byteOffset + (accessor.byteOffset ?? 0)
    return Array.from({ length: accessor.count * components }, (_, i) => bin!.readFloatLE(start + i * 4))
  }
  const mesh = (name: string) => {
    const index = json!.meshes.findIndex(candidate => candidate.name === name)
    if (index < 0) throw new Error(`mesh ${name} missing`)
    const primitive = json!.meshes[index]!.primitives[0]!
    const positions = floats(primitive.attributes.POSITION!)
    const uv = primitive.attributes.TEXCOORD_0 === undefined ? null : floats(primitive.attributes.TEXCOORD_0)
    return { positions, uv, material: json!.materials[primitive.material]!.name, count: positions.length / 3 }
  }
  return { json, mesh }
}

const artifact = readArtifact()
const vertices = (name: string) => {
  const mesh = artifact.mesh(name)
  return { ...mesh, at: (i: number) => [mesh.positions[i * 3]!, mesh.positions[i * 3 + 1]!, mesh.positions[i * 3 + 2]!] as const }
}

/** Largest |distance| from any vertex of the mesh to the model part, in millimetres. */
function worstMm(meshName: string, part: Parameters<typeof bwcCreaturePartSdf>[0]): number {
  const mesh = vertices(meshName)
  let worst = 0
  for (let i = 0; i < mesh.count; i++) {
    const [x, y, z] = mesh.at(i)
    worst = Math.max(worst, Math.abs(bwcCreaturePartSdf(part, x, y, z)))
  }
  return worst * 1000
}

describe('BWC creature matches docs/BWC/Ultra_White_Plush_Creature_Cinema2.glb', () => {
  it('reads the artifact: seventeen named parts under one root', () => {
    expect(artifact.json.nodes[0]!.name).toBe('world')
    expect(artifact.json.meshes).toHaveLength(17)
    expect(artifact.json.meshes.map(mesh => mesh.name)).toEqual([
      '01_Can_Body_embedded_graphics', '02_Top_flat_fabric_disk', '03_Fabric_seam_crown', '03_Fabric_seam_base', '04_Right_plush_arm', '04_Left_plush_arm',
      '05_Right_cushion_foot', '05_Right_paw_seam', '05_Left_cushion_foot', '05_Left_paw_seam', '06_Left_black_bead_eye', '07_Left_large_eye_glint',
      '07_Left_small_eye_glint', '06_Right_black_bead_eye', '07_Right_large_eye_glint', '07_Right_small_eye_glint', '08_Smile_black_thread',
    ])
  })

  it('has the body of the mesh: a revolved fleece profile, within the ripple of the fleece itself', () => {
    // The mesh's rings carry about +/-3.5 mm of fleece ripple around their mean; the profile follows the mean.
    expect(worstMm('01_Can_Body_embedded_graphics', 'body')).toBeLessThan(5)
    expect(BWC_CREATURE_BODY_RINGS.length).toBeLessThan(60)
    const ys = vertices('01_Can_Body_embedded_graphics')
    expect(Math.max(...Array.from({ length: ys.count }, (_, i) => ys.at(i)[1]))).toBeCloseTo(3.016, 3)
  })

  it('has the lid, both stitched seams and both paw seams (thread is wobbly; the stitches are followed to a few millimetres)', () => {
    expect(worstMm('02_Top_flat_fabric_disk', 'lid')).toBeLessThan(0.1)
    expect(worstMm('03_Fabric_seam_crown', 'seams')).toBeLessThan(3)
    expect(worstMm('03_Fabric_seam_base', 'seams')).toBeLessThan(3)
    expect(worstMm('05_Right_paw_seam', 'pawSeams')).toBeLessThan(5)
    expect(worstMm('05_Left_paw_seam', 'pawSeams')).toBeLessThan(5)
  })

  it('has both cushion feet and both bead eyes as exact ellipsoids', () => {
    for (const name of ['05_Right_cushion_foot', '05_Left_cushion_foot']) expect(worstMm(name, 'feet')).toBeLessThan(0.1)
    for (const name of ['06_Left_black_bead_eye', '06_Right_black_bead_eye']) expect(worstMm(name, 'eyes')).toBeLessThan(0.1)
  })

  it('has all four catchlights where the artifact puts them (the left and right pairs differ)', () => {
    for (const name of ['07_Left_large_eye_glint', '07_Left_small_eye_glint', '07_Right_large_eye_glint', '07_Right_small_eye_glint']) {
      expect(worstMm(name, 'glint'), name).toBeLessThan(0.1)
    }
  })

  it('has the stitched smile', () => {
    expect(worstMm('08_Smile_black_thread', 'thread')).toBeLessThan(7)
  })

  it('has both flat flipper arms, lofted from the mesh within a centimetre', () => {
    for (const name of ['04_Right_plush_arm', '04_Left_plush_arm']) expect(worstMm(name, 'arms')).toBeLessThan(10)
  })

  it('never has a vertex outside the whole creature, and every mesh is the part it is named for', () => {
    const union = (name: string, limitMm: number) => {
      const mesh = vertices(name)
      let worst = -Infinity
      for (let i = 0; i < mesh.count; i++) worst = Math.max(worst, bwcCreatureSdf(...mesh.at(i)).distance)
      expect(worst * 1000, name).toBeLessThan(limitMm)
    }
    for (const [name, limit] of [
      ['01_Can_Body_embedded_graphics', 5], ['02_Top_flat_fabric_disk', 0.1], ['03_Fabric_seam_crown', 3], ['03_Fabric_seam_base', 3],
      ['04_Right_plush_arm', 10], ['04_Left_plush_arm', 10], ['05_Right_cushion_foot', 0.1], ['05_Left_cushion_foot', 0.1],
      ['06_Left_black_bead_eye', 0.1], ['06_Right_black_bead_eye', 0.1], ['08_Smile_black_thread', 7],
    ] as const) union(name, limit)
    const materialOf: Record<BwcCreaturePart, string> = {
      body: 'BODY_offwhite_fleece_with_embedded_front_graphics', lid: 'IVORY_FABRIC_plush_fleece', stitch: 'CREAM_STITCH_thread', cotton: 'WHITE_COTTON_feet',
      eye: 'BLACK_GLASS_bead_eyes', glint: 'EYE_SPECULAR_catchlight', thread: 'CHARCOAL_EMBROIDERY_thread',
    }
    expect(artifact.mesh('01_Can_Body_embedded_graphics').material).toBe(materialOf.body)
    expect(artifact.mesh('02_Top_flat_fabric_disk').material).toBe(materialOf.lid)
    expect(artifact.mesh('03_Fabric_seam_crown').material).toBe(materialOf.stitch)
    expect(artifact.mesh('05_Right_paw_seam').material).toBe(materialOf.stitch)
    expect(artifact.mesh('04_Right_plush_arm').material).toBe(materialOf.cotton)
    expect(artifact.mesh('05_Left_cushion_foot').material).toBe(materialOf.cotton)
    expect(artifact.mesh('06_Left_black_bead_eye').material).toBe(materialOf.eye)
    expect(artifact.mesh('07_Right_small_eye_glint').material).toBe(materialOf.glint)
    expect(artifact.mesh('08_Smile_black_thread').material).toBe(materialOf.thread)
    expect(new Set(Object.values(BWC_CREATURE_MATERIAL)).size).toBe(7)
  })

  it('maps the label with the mesh\'s own UVs: u = 0.5 + atan2(x, z) / 2π and v = V0 - V1 y', () => {
    const body = vertices('01_Can_Body_embedded_graphics')
    let worstU = 0, worstV = 0
    for (let i = 0; i < body.count; i++) {
      const [x, y, z] = body.at(i)
      const u = body.uv![i * 2]!, v = body.uv![i * 2 + 1]!
      const predictedU = 0.5 + Math.atan2(x, z) / (2 * Math.PI)
      // The seam at the back wraps from 1 to 0.
      worstU = Math.max(worstU, Math.min(Math.abs(u - predictedU), 1 - Math.abs(u - predictedU)))
      worstV = Math.max(worstV, Math.abs(v - (BWC_CREATURE_LABEL_V0 - BWC_CREATURE_LABEL_V1 * y)))
    }
    expect(worstU).toBeLessThan(1e-5)
    expect(worstV).toBeLessThan(0.001)
    expect(BWC_CREATURE_HEIGHT_M).toBeCloseTo(3.016, 3)
  })

  it('stands between the rails of the right conveyor and hands the shader the same model', () => {
    // The arms reach 1.06 m out and the deck between the rails is 2.4 m wide, so the scaled creature fits across it.
    expect(1.06 * BWC_CREATURE_PLACEMENT.scale * 2).toBeLessThan(2.4)
    // Neighbours do not touch: the feet reach 0.73 m forward.
    expect(0.73 * BWC_CREATURE_PLACEMENT.scale * 2).toBeLessThan(BWC_CREATURE_PLACEMENT.pitch)
    const glsl = bwcCreatureGlsl()
    expect(glsl).toContain('vec2 sdBwcCreature(vec3 q)')
    expect(glsl).toContain(`const int CREATURE_BODY_COUNT = ${BWC_CREATURE_BODY_RINGS.length + 2};`)
    expect(glsl).toContain('const int CREATURE_ARM_COUNT = 25;')
  })
})
