// ── cinema2HumanMeshGeometry ─────────────────────────────────────────────────
//
// Layout Lab / Cinema 2.0 "HUM:AN" concept mockup — a low-poly wireframe
// human bust, hand-plotted (named points + index triangles, not traced pixel
// coordinates) from reference stills of a wireframe head/shoulders figure
// that densifies, sparks, and transforms into a fully iridescent mesh with
// arms reaching toward the viewer. Pure mock geometry — no shader/module code.

export type MeshPointName = string
export type MeshTriangle = readonly [MeshPointName, MeshPointName, MeshPointName]

export const MESH_POINTS: Record<MeshPointName, readonly [number, number]> = {
  // head outline
  top: [100, 13], topR: [123, 17], upR: [141, 31], templeR: [149, 51],
  midR: [146, 70], jawR: [131, 89], chinR: [112, 101], chin: [100, 105],
  chinL: [88, 101], jawL: [69, 89], midL: [54, 70], templeL: [51, 51],
  upL: [59, 31], topL: [77, 17],
  // ear flares
  earRtip: [163, 47], earRlow: [148, 67],
  earLtip: [37, 47], earLlow: [52, 67],
  // interior centerline
  forehead: [100, 39], noseBridge: [100, 58], noseTip: [100, 78], mouth: [100, 92],
  // eyes (small satellite polyhedra)
  eyeR: [122, 58], eyeR2: [130, 54], eyeR3: [128, 64], eyeR4: [116, 60],
  eyeL: [78, 58], eyeL2: [70, 54], eyeL3: [72, 64], eyeL4: [84, 60],
  // cheeks
  cheekR: [136, 62], cheekL: [64, 62],
  // spark point (flash triangle) — the mouth/jaw facet that flashes bright
  neckLt: [88, 99], neckRt: [112, 99], neckLb: [90, 112], neckRb: [110, 112],
  // shoulders — banded rows (collar -> mid -> shoulder -> edge -> base) for a
  // faceted slope instead of a couple of giant flat planes.
  collarL: [65, 120], collarC: [100, 118], collarR: [135, 120],
  bandL: [35, 140], bandC: [100, 136], bandR: [165, 140],
  shL: [5, 168], shC: [100, 160], shR: [195, 168],
  edgeL: [-25, 200], edgeC: [100, 192], edgeR: [225, 200],
  baseL: [-25, 218], baseC: [100, 220], baseR: [225, 218],
  // arms (later frames only) — an upper-arm wedge plus a hand mass reaching
  // up alongside the head, within the visible frame.
  armL_elbow: [15, 145], armL_hand1: [35, 55], armL_hand2: [60, 92],
  armR_elbow: [185, 145], armR_hand1: [165, 55], armR_hand2: [140, 92],
}

/** Base head+shoulders mesh, in draw order (frame 1 shows only the first slice of it). */
export const HEAD_MESH_TRIANGLES: MeshTriangle[] = [
  ['top', 'topR', 'forehead'], ['topR', 'upR', 'forehead'], ['upR', 'templeR', 'forehead'],
  ['templeR', 'cheekR', 'forehead'], ['forehead', 'cheekR', 'noseBridge'],
  ['top', 'forehead', 'topL'], ['topL', 'forehead', 'upL'], ['upL', 'forehead', 'templeL'],
  ['templeL', 'forehead', 'cheekL'], ['forehead', 'noseBridge', 'cheekL'],
  ['templeR', 'earRtip', 'midR'], ['earRtip', 'earRlow', 'midR'],
  ['templeL', 'earLtip', 'midL'], ['earLtip', 'earLlow', 'midL'],
  ['templeR', 'midR', 'cheekR'], ['midR', 'jawR', 'cheekR'], ['cheekR', 'jawR', 'noseTip'],
  ['templeL', 'midL', 'cheekL'], ['midL', 'jawL', 'cheekL'], ['cheekL', 'jawL', 'noseTip'],
  ['cheekR', 'noseTip', 'noseBridge'], ['cheekL', 'noseBridge', 'noseTip'],
  ['jawR', 'chinR', 'noseTip'], ['noseTip', 'chinR', 'mouth'], ['noseTip', 'mouth', 'chinL'],
  ['jawL', 'noseTip', 'chinL'], ['chinR', 'chin', 'mouth'], ['chinL', 'mouth', 'chin'],
  ['eyeR', 'eyeR2', 'eyeR3'], ['eyeR', 'eyeR3', 'eyeR4'], ['eyeR', 'eyeR4', 'eyeR2'],
  ['eyeL', 'eyeL2', 'eyeL3'], ['eyeL', 'eyeL3', 'eyeL4'], ['eyeL', 'eyeL4', 'eyeL2'],
  ['chinR', 'neckRt', 'mouth'], ['chinL', 'mouth', 'neckLt'],
  ['neckLt', 'neckRt', 'neckRb'], ['neckLt', 'neckRb', 'neckLb'],
  ['neckLb', 'neckRb', 'collarC'], ['neckLb', 'collarC', 'collarL'], ['neckRb', 'collarR', 'collarC'],
  ['collarL', 'collarC', 'bandC'], ['collarL', 'bandC', 'bandL'],
  ['collarC', 'collarR', 'bandR'], ['collarC', 'bandR', 'bandC'],
  ['bandL', 'bandC', 'shC'], ['bandL', 'shC', 'shL'],
  ['bandC', 'bandR', 'shR'], ['bandC', 'shR', 'shC'],
  ['shL', 'shC', 'edgeC'], ['shL', 'edgeC', 'edgeL'],
  ['shC', 'shR', 'edgeR'], ['shC', 'edgeR', 'edgeC'],
  ['edgeL', 'edgeC', 'baseC'], ['edgeL', 'baseC', 'baseL'],
  ['edgeC', 'edgeR', 'baseR'], ['edgeC', 'baseR', 'baseC'],
]

/** The facet that flashes bright white for the "spark" beat in the arc. */
export const FLASH_TRIANGLE_INDEX = HEAD_MESH_TRIANGLES.findIndex(
  triangle => triangle.includes('mouth') && triangle.includes('chinR'),
)

/** Only drawn once a still's `showArms` is true — two wedges per arm. */
export const ARM_MESH_TRIANGLES: MeshTriangle[] = [
  ['bandL', 'shL', 'armL_elbow'], ['shL', 'armL_elbow', 'edgeL'],
  ['armL_elbow', 'armL_hand1', 'armL_hand2'],
  ['bandR', 'shR', 'armR_elbow'], ['shR', 'armR_elbow', 'edgeR'],
  ['armR_elbow', 'armR_hand1', 'armR_hand2'],
]

export function meshTrianglePoints(triangle: MeshTriangle): string {
  return triangle.map(name => MESH_POINTS[name]!.join(',')).join(' ')
}
