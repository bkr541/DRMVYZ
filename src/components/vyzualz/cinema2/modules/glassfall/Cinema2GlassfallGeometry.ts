import type * as Three from 'three'

export const GLASSFALL_SHAPE_WIDTH = .78
export const GLASSFALL_SHAPE_HEIGHT = .68
export const GLASSFALL_SYMBOL_Z = .23
export const GLASSFALL_PANEL_FRONT_Z = -.035
export const GLASSFALL_REAR_Z = -.42
export const GLASSFALL_COLUMN_PITCH = 1.04
export const GLASSFALL_BAND_PITCH = 1.10
export const GLASSFALL_INVERTED_RISE = .26
export interface GlassfallCell { x: number; y: number; inverted: boolean; color: number }

/** Reference: ~340px column pitch, ~355px band pitch and ~84px inverted rise.
 * Upright and inverted elements belong to one paired band, not uniform rows. */
export function glassfallCells(aspect: number, animated = false): GlassfallCell[] {
  const columns = Math.ceil(3.1 * aspect / 2 / GLASSFALL_COLUMN_PITCH) + 1
  const cells: GlassfallCell[] = []
  for (let band = animated ? -3 : -2; band <= 2; band++) for (let column = -columns; column <= columns; column++) {
    for (const inverted of [false, true]) {
      const ordinal = ((column + band * 3) % 7 + 7) % 7
      cells.push({ x: column * GLASSFALL_COLUMN_PITCH + (inverted ? GLASSFALL_COLUMN_PITCH / 2 : 0),
        y: band * GLASSFALL_BAND_PITCH + (inverted ? GLASSFALL_INVERTED_RISE : 0),
        inverted,
        color: Math.floor(((ordinal + (inverted ? 1 : 0)) % 7) / 2) })
    }
  }
  return cells
}

/** Fit the supplied triangle mesh to its authored occupied bounds. */
export function fitGlassfallGeometry(THREE: typeof Three, geometry: Three.BufferGeometry, depth: number) {
  geometry.computeBoundingBox()
  const box = geometry.boundingBox!, center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3())
  geometry.translate(-center.x, -center.y, -center.z)
  geometry.scale(GLASSFALL_SHAPE_WIDTH / size.x, GLASSFALL_SHAPE_HEIGHT / size.y, depth / size.z)
  geometry.computeVertexNormals(); geometry.computeBoundingBox()
  return geometry
}

export function buildGlassfallSymbolGeometries(THREE: typeof Three, source: Three.Object3D) {
    // The supplied GLB includes export-camera transforms. Use its actual mesh in
    // local coordinates; rotate its right-facing triangle to an upright triangle.
    let triangleMesh: Three.Mesh | undefined
    source.traverse(object => { if ((object as Three.Mesh).isMesh) triangleMesh = object as Three.Mesh })
    if (!triangleMesh) throw new Error('GLASSFALL supplied triangle GLB has no mesh.')
    const triangle = fitGlassfallGeometry(THREE, triangleMesh.geometry.clone().rotateZ(Math.PI / 2), .12)
    const normals = triangle.getAttribute('normal'), index = triangle.index
    triangle.clearGroups()
    const fronts: number[] = [], sides: number[] = []
    const count = index?.count ?? normals.count
    for (let i = 0; i < count; i += 3) {
      const front = [0, 1, 2].reduce((sum, offset) => sum + normals.getZ(index ? index.getX(i + offset) : i + offset), 0) / 3 > .45
      for (let offset = 0; offset < 3; offset++) (front ? fronts : sides).push(index ? index.getX(i + offset) : i + offset)
    }
    triangle.setIndex([...fronts, ...sides])
    triangle.addGroup(0, fronts.length, 0)
    triangle.addGroup(fronts.length, sides.length, 1)
    return { triangle }
}
