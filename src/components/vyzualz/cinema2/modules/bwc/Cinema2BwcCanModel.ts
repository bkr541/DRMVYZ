/**
 * The BWC energy-drink can, taken from the artifact `docs/BWC/BWC_Can_Plain_Ready.glb`.
 *
 * The artifact is a 168 mm tall, 18-sided can (flat shaded: it carries no normals) with a pivot at the centre of its
 * base. Its body is the same 18-gon at every height, only the radius changes, so the whole can is a revolved profile
 * (ring radius against height, read straight from the mesh's vertex rings) folded into one 18-gon sector, plus the
 * pull tab, an extruded 8-point polygon. Everything below is that data and nothing is eyeballed;
 * `Cinema2BwcCanModel.test.ts` checks every vertex of the GLB against this model.
 *
 * The BWC shader draws the can from these constants (`bwcCanGlsl`), and `bwcCanSdf` is the same maths on the CPU.
 */

/** Sides of the body prism. Every ring of the mesh has this many distinct vertices. */
export const BWC_CAN_SIDES = 18
/** Angle (degrees, `atan2(z, x)`) of the middle of one flat face; the vertices sit half a sector either side. */
export const BWC_CAN_FACE_PHASE_DEG = 0.4661
/** Height of the prepared asset, in metres. */
export const BWC_CAN_HEIGHT_M = 0.168
/** The factory art direction enlarges the can to 1 m (docs/BWC/BWC_3D_Scene_Manifest.json: scaleFactorInFactory). */
export const BWC_CAN_HERO_HEIGHT_M = 1
export const BWC_CAN_HERO_SCALE = BWC_CAN_HERO_HEIGHT_M / BWC_CAN_HEIGHT_M

/**
 * Cross-section as [ring radius at a vertex (mm), height (mm)], walking the outline from the centre of the recessed
 * base cap, out along the base, up the body and neck, over the rim lip, down its inner wall into the moat around the lid
 * (28.490 mm / 165.205 mm) and back in to the centre of the lid.
 */
export const BWC_CAN_PROFILE_MM: readonly (readonly [number, number])[] = Object.freeze([
  [0, 2.279],
  [26.16, 2.279],
  [27.468, 0],
  [29.232, 1.225],
  [30.081, 3.407],
  [30.937, 4.45],
  [30.937, 156.568],
  [28.459, 163.965],
  [29.852, 165.456],
  [29.852, 167.505],
  [29.563, 168],
  [28.49, 165.205],
  [27.673, 166.814],
  [0, 166.814],
])

/** Pull tab outline in the can's own x / z (mm), in order around the polygon. */
export const BWC_CAN_TAB_POLYGON_MM: readonly (readonly [number, number])[] = Object.freeze([
  [-2.943, -11.169],
  [2.324, -9.736],
  [8.436, -4.904],
  [11.046, -0.11],
  [-6.203, 21.708],
  [-7.563, 22.374],
  [-20.526, 12.126],
  [-20.192, 10.649],
])
/** The tab is a slab from its underside to its top face (mm). */
export const BWC_CAN_TAB_Y_MM = Object.freeze([166.77, 167.67] as const)

const MM = 0.001
const APOTHEM = Math.cos(Math.PI / BWC_CAN_SIDES)
const SECTOR = (Math.PI * 2) / BWC_CAN_SIDES
const FACE_PHASE = (BWC_CAN_FACE_PHASE_DEG * Math.PI) / 180

/** The profile as [distance from the axis to a flat face (m), height (m)]: the 2D shape the folded body is measured against. */
export const BWC_CAN_PROFILE_APOTHEM_M: readonly (readonly [number, number])[] = Object.freeze(
  BWC_CAN_PROFILE_MM.map(([radius, y]) => Object.freeze([radius * APOTHEM * MM, y * MM] as const)),
)
export const BWC_CAN_TAB_POLYGON_M: readonly (readonly [number, number])[] = Object.freeze(
  BWC_CAN_TAB_POLYGON_MM.map(([x, z]) => Object.freeze([x * MM, z * MM] as const)),
)

/** Signed distance to a closed 2D polygon (Inigo Quilez's `sdPolygon`), negative inside. */
function sdPolygon(px: number, py: number, vertices: readonly (readonly [number, number])[]): number {
  const n = vertices.length
  let d = (px - vertices[0]![0]) ** 2 + (py - vertices[0]![1]) ** 2
  let sign = 1
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const [ix, iy] = vertices[i]!
    const [jx, jy] = vertices[j]!
    const ex = jx - ix, ey = jy - iy
    const wx = px - ix, wy = py - iy
    const t = Math.min(1, Math.max(0, (wx * ex + wy * ey) / (ex * ex + ey * ey)))
    const bx = wx - ex * t, by = wy - ey * t
    d = Math.min(d, bx * bx + by * by)
    const c0 = py >= iy, c1 = py < jy, c2 = ex * wy > ey * wx
    if ((c0 && c1 && c2) || (!c0 && !c1 && !c2)) sign = -sign
  }
  return sign * Math.sqrt(d)
}

/** Signed distance (m) from a point in the can's own space (origin at the base centre, +Y up) to the can. */
export function bwcCanSdf(x: number, y: number, z: number): number {
  const radius = Math.hypot(x, z)
  const angle = Math.atan2(z, x) - FACE_PHASE
  const folded = ((angle + SECTOR / 2) % SECTOR + SECTOR) % SECTOR - SECTOR / 2
  const body = sdPolygon(radius * Math.cos(folded), y, BWC_CAN_PROFILE_APOTHEM_M)
  const tabMid = ((BWC_CAN_TAB_Y_MM[0] + BWC_CAN_TAB_Y_MM[1]) / 2) * MM
  const tabHalf = ((BWC_CAN_TAB_Y_MM[1] - BWC_CAN_TAB_Y_MM[0]) / 2) * MM
  const tabPlan = sdPolygon(x, z, BWC_CAN_TAB_POLYGON_M)
  const tabHeight = Math.abs(y - tabMid) - tabHalf
  const tab = Math.min(Math.max(tabPlan, tabHeight), 0) + Math.hypot(Math.max(tabPlan, 0), Math.max(tabHeight, 0))
  return Math.min(body, tab)
}

const f = (value: number): string => value.toFixed(6)
const vec2List = (points: readonly (readonly [number, number])[]): string => points.map(([a, b]) => `vec2(${f(a)}, ${f(b)})`).join(',\n  ')

/** GLSL for the can: the same constants and maths as `bwcCanSdf`, in can space (metres, origin at the base centre). */
export function bwcCanGlsl(): string {
  const profile = BWC_CAN_PROFILE_APOTHEM_M
  const tab = BWC_CAN_TAB_POLYGON_M
  return `
const int CAN_PROFILE_COUNT = ${profile.length};
const vec2 CAN_PROFILE[CAN_PROFILE_COUNT] = vec2[CAN_PROFILE_COUNT](
  ${vec2List(profile)}
);
const int CAN_TAB_COUNT = ${tab.length};
const vec2 CAN_TAB[CAN_TAB_COUNT] = vec2[CAN_TAB_COUNT](
  ${vec2List(tab)}
);
const float CAN_SECTOR = ${f(SECTOR)};
const float CAN_FACE_PHASE = ${f(FACE_PHASE)};
const float CAN_TAB_MID = ${f(((BWC_CAN_TAB_Y_MM[0] + BWC_CAN_TAB_Y_MM[1]) / 2) * MM)};
const float CAN_TAB_HALF = ${f(((BWC_CAN_TAB_Y_MM[1] - BWC_CAN_TAB_Y_MM[0]) / 2) * MM)};
const float CAN_HERO_SCALE = ${f(BWC_CAN_HERO_SCALE)};

float sdCanProfile(vec2 p) {
  float d = dot(p - CAN_PROFILE[0], p - CAN_PROFILE[0]);
  float s = 1.0;
  for (int i = 0; i < CAN_PROFILE_COUNT; i++) {
    int j = (i + CAN_PROFILE_COUNT - 1) % CAN_PROFILE_COUNT;
    vec2 e = CAN_PROFILE[j] - CAN_PROFILE[i];
    vec2 w = p - CAN_PROFILE[i];
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= CAN_PROFILE[i].y, p.y < CAN_PROFILE[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}
float sdCanTab(vec2 p) {
  float d = dot(p - CAN_TAB[0], p - CAN_TAB[0]);
  float s = 1.0;
  for (int i = 0; i < CAN_TAB_COUNT; i++) {
    int j = (i + CAN_TAB_COUNT - 1) % CAN_TAB_COUNT;
    vec2 e = CAN_TAB[j] - CAN_TAB[i];
    vec2 w = p - CAN_TAB[i];
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= CAN_TAB[i].y, p.y < CAN_TAB[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}
/* The BWC_CAN_PLAIN artifact in its own space: metres, origin at the base centre, +Y up. */
float sdBwcCan(vec3 q) {
  // Stay cheap away from the can: a bounding cylinder just outside its widest ring.
  float bound = sdCylinderY(q - vec3(0.0, 0.084, 0.0), 0.034, 0.088);
  if (bound > 0.012) return bound;
  float rad = length(q.xz);
  float ang = mod(atan(q.z, q.x) - CAN_FACE_PHASE + CAN_SECTOR * 0.5, CAN_SECTOR) - CAN_SECTOR * 0.5;
  float body = sdCanProfile(vec2(rad * cos(ang), q.y));
  float tabPlan = sdCanTab(q.xz);
  float tabHeight = abs(q.y - CAN_TAB_MID) - CAN_TAB_HALF;
  float tab = min(max(tabPlan, tabHeight), 0.0) + length(max(vec2(tabPlan, tabHeight), 0.0));
  return min(body, tab);
}
`
}
