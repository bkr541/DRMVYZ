/**
 * The BWC plush creature, taken from the artifact `docs/BWC/Ultra_White_Plush_Creature_Cinema2.glb`.
 *
 * The artifact is a plush that is also an energy-drink can: a pill-shaped fleece body wearing the can's printed label,
 * a flat fabric lid with a stitched crown seam, a stitched base seam, two flat flipper arms, two cushion feet, bead
 * eyes with catchlights, a stitched smile and a stitched seam across each foot. It stands 3.016 m tall in its own
 * space (metres, +Y up, facing +Z, feet on the floor) and the preset shows it scaled down onto the right conveyor.
 *
 * Every part is an exact or fitted analytic shape (the body is a revolved profile read from the mesh's vertex rings;
 * eyes, glints and feet are exact ellipsoids; the arms are lofted from cross-sections of the mesh), so the shader can
 * ray-march it with the rest of the scene. `Cinema2BwcCreatureModel.test.ts` checks every vertex of the GLB against
 * these shapes. `bwcCreatureGlsl` is the same maths in GLSL; `bwcCreatureSdf` is the CPU reference.
 */
import { sdPolygon } from './Cinema2BwcCanModel'

/** Shader material ids for the creature (ids below 10 belong to the factory and the can). */
export const BWC_CREATURE_MATERIAL = Object.freeze({
  body: 10, // BODY_offwhite_fleece_with_embedded_front_graphics: the label texture
  lid: 11, // IVORY_FABRIC_plush_fleece
  stitch: 12, // CREAM_STITCH_thread
  cotton: 13, // WHITE_COTTON: feet and arms
  eye: 14, // BLACK_GLASS_bead_eyes
  glint: 15, // EYE_SPECULAR_catchlight
  thread: 16, // CHARCOAL_EMBROIDERY_thread
} as const)
export type BwcCreaturePart = keyof typeof BWC_CREATURE_MATERIAL

/** Height of the creature's body and its label texture mapping, from the mesh's own UVs: u = 0.5 + atan2(x, z) / 2π, v = V0 - V1 * y. */
export const BWC_CREATURE_HEIGHT_M = 3.016
export const BWC_CREATURE_LABEL_V0 = 1.08453
export const BWC_CREATURE_LABEL_V1 = 0.35971

/**
 * How the preset places it: scaled to half size (1.51 m tall, its feet and arms fit across the conveyor), one every
 * `pitch` metres along the right conveyor, standing on the deck plates.
 */
export const BWC_CREATURE_PLACEMENT = Object.freeze({
  scale: 0.5,
  pitch: 1.1,
  centerX: 3.18,
  baseY: 0.505,
  zFirst: -9.9,
  zLast: 4.3,
  yawBias: 0.12,
  yawJitter: 0.15,
})

/** Revolved body outline as [radius, height] (m), bottom to top; the vertex rings of the mesh simplified to within 0.4 mm. */
export const BWC_CREATURE_BODY_RINGS: readonly (readonly [number, number])[] = Object.freeze([
  [0.18, 0.235],
  [0.2877, 0.2517],
  [0.3576, 0.2683],
  [0.4095, 0.2849],
  [0.4401, 0.3016],
  [0.4625, 0.3182],
  [0.481, 0.3349],
  [0.4961, 0.3515],
  [0.5081, 0.3682],
  [0.5176, 0.3848],
  [0.532, 0.4181],
  [0.5442, 0.4514],
  [0.5545, 0.4847],
  [0.5632, 0.518],
  [0.5775, 0.5846],
  [0.6118, 0.7677],
  [0.6278, 0.8676],
  [0.6383, 0.9508],
  [0.6442, 1.0174],
  [0.652, 1.1506],
  [0.6569, 1.2504],
  [0.6602, 1.3337],
  [0.6626, 1.4169],
  [0.6638, 1.5001],
  [0.6632, 1.8164],
  [0.6602, 2.166],
  [0.6578, 2.2825],
  [0.6549, 2.3824],
  [0.651, 2.4823],
  [0.6461, 2.5822],
  [0.6433, 2.6321],
  [0.6392, 2.6821],
  [0.6331, 2.732],
  [0.6278, 2.7653],
  [0.6213, 2.7986],
  [0.6169, 2.8152],
  [0.6108, 2.8319],
  [0.603, 2.8485],
  [0.5937, 2.8652],
  [0.5831, 2.8818],
  [0.5712, 2.8985],
  [0.5571, 2.9151],
  [0.5393, 2.9318],
  [0.5169, 2.9484],
  [0.4895, 2.9651],
  [0.4562, 2.9817],
  [0.4017, 2.9983],
  [0.33, 3.015]
])
/** The closed cross-section: the rings plus the axis caps. */
export const BWC_CREATURE_BODY_POLYGON: readonly (readonly [number, number])[] = Object.freeze([
  [0, BWC_CREATURE_BODY_RINGS[0]![1]],
  ...BWC_CREATURE_BODY_RINGS,
  [0, BWC_CREATURE_BODY_RINGS[BWC_CREATURE_BODY_RINGS.length - 1]![1]],
] as const)

/** Flat fabric lid sitting on the top of the body (a thin disc). */
export const BWC_CREATURE_LID = Object.freeze({ radius: 0.33, centerY: 3.012, halfThickness: 0.0065 })
/** Stitched seams around the top (crown) and bottom (base) of the body: tori standing on the body surface. */
export const BWC_CREATURE_SEAMS = Object.freeze({
  crown: Object.freeze({ y: 2.974, major: 0.453, minor: 0.0095 }),
  base: Object.freeze({ y: 0.335, major: 0.475, minor: 0.0085 }),
})
/** Cushion feet (exact ellipsoids, mirrored in x) and the seam across the front of each. */
export const BWC_CREATURE_FOOT = Object.freeze({ center: Object.freeze([0.45, 0.203, 0.425] as const), radii: Object.freeze([0.3, 0.202, 0.3] as const) })
export const BWC_CREATURE_PAW_SEAM = Object.freeze({
  radius: 0.009,
  points: Object.freeze([
    [0.3551, 0.3775, 0.6042], [0.383, 0.3805, 0.61], [0.4058, 0.381, 0.6113], [0.4331, 0.3825, 0.614], [0.4593, 0.383, 0.6149],
    [0.4807, 0.383, 0.6149], [0.5069, 0.3825, 0.614], [0.5342, 0.381, 0.6113], [0.557, 0.3805, 0.61], [0.5849, 0.3775, 0.6042],
  ] as const),
})
/** Bead eyes (exact ellipsoids, mirrored in x) and their catchlights (exact ellipsoids; not mirrored: the artifact's glints differ left to right). */
export const BWC_CREATURE_EYE = Object.freeze({ center: Object.freeze([0.361, 1.07, 0.5854] as const), radii: Object.freeze([0.112, 0.123, 0.081] as const) })
export const BWC_CREATURE_GLINTS = Object.freeze([
  Object.freeze({ center: Object.freeze([-0.399, 1.113, 0.6664] as const), radii: Object.freeze([0.03, 0.03, 0.012] as const) }),
  Object.freeze({ center: Object.freeze([0.323, 1.113, 0.6664] as const), radii: Object.freeze([0.03, 0.03, 0.012] as const) }),
  Object.freeze({ center: Object.freeze([-0.324, 1.054, 0.6644] as const), radii: Object.freeze([0.013, 0.013, 0.007] as const) }),
  Object.freeze({ center: Object.freeze([0.398, 1.054, 0.6644] as const), radii: Object.freeze([0.013, 0.013, 0.007] as const) }),
])
/** Stitched smile: a tube along this centreline (symmetric in x; the mesh's thread is slightly wobbly, this is its mirrored average). */
export const BWC_CREATURE_SMILE = Object.freeze({
  radius: 0.0155,
  points: Object.freeze([
    [-0.151, 0.9648, 0.6407], [-0.1246, 0.9381, 0.6383], [-0.0958, 0.9115, 0.6402], [-0.0671, 0.8906, 0.6443], [-0.0372, 0.877, 0.6468], [-0.015, 0.8738, 0.6435], [0, 0.8715, 0.6443],
    [0.015, 0.8738, 0.6435], [0.0372, 0.877, 0.6468], [0.0671, 0.8906, 0.6443], [0.0958, 0.9115, 0.6402], [0.1246, 0.9381, 0.6383], [0.151, 0.9648, 0.6407],
  ] as const),
})
/**
 * The flat flipper arms (mirrored in x): a loft along a tilted axis. `center` and `axes` are the frame (axis 0 runs
 * along the arm, 1 across, 2 through it); each station is [position along the arm, offset across, offset through,
 * half-width, half-thickness], and the cross-section at a point is the ellipse interpolated between stations.
 */
export const BWC_CREATURE_ARM = Object.freeze({
  center: Object.freeze([0.815, 1.0123, 0.11] as const),
  axes: Object.freeze([[0.8626, -0.4458, 0.2389], [-0.2121, 0.1101, 0.971], [-0.4592, -0.8883, 0.0005]] as const),
  stations: Object.freeze([
    [-0.2927, 0.0013, -0.001, 0.0529, 0.02],
    [-0.2903, -0.0018, 0.007, 0.0448, 0.012],
    [-0.2833, 0.003, -0.0233, 0.0546, 0.0283],
    [-0.2716, 0.0025, -0.018, 0.0635, 0.0476],
    [-0.2557, 0.0021, -0.0145, 0.0719, 0.0543],
    [-0.2356, 0.0016, -0.0064, 0.0797, 0.0652],
    [-0.2118, -0.0022, -0.0044, 0.0908, 0.072],
    [-0.1846, 0.0003, 0.0025, 0.1, 0.0808],
    [-0.1546, -0.0004, 0.0044, 0.1109, 0.086],
    [-0.1222, -0.001, 0.009, 0.1196, 0.0933],
    [-0.088, -0.0015, 0.0125, 0.126, 0.0988],
    [-0.0526, -0.0018, 0.0145, 0.1301, 0.1027],
    [-0.0165, -0.0019, 0.0154, 0.1319, 0.1042],
    [0.0195, -0.0019, 0.0153, 0.1319, 0.1043],
    [0.0549, -0.0024, 0.015, 0.1308, 0.1035],
    [0.0891, -0.0014, 0.0132, 0.126, 0.1008],
    [0.1215, -0.001, 0.0106, 0.1195, 0.0955],
    [0.1516, -0.0003, 0.0063, 0.1108, 0.0887],
    [0.1787, 0.0004, 0.001, 0.1, 0.0802],
    [0.2026, 0.0004, -0.001, 0.0878, 0.0743],
    [0.2226, 0.0017, -0.0085, 0.0797, 0.0645],
    [0.2386, -0.0012, -0.0119, 0.0684, 0.0585],
    [0.2502, -0.0004, 0.0052, 0.0604, 0.0316],
    [0.2573, -0.0103, -0.0001, 0.0342, 0.0266],
    [0.2596, -0.0102, -0.0001, 0.0144, 0.0266]
  ] as const),
})
const ARM_BOUND_RADIUS = 0.62

const ellipsoid = (px: number, py: number, pz: number, c: readonly number[], r: readonly number[]): number => {
  const ax = (px - c[0]!) / r[0]!, ay = (py - c[1]!) / r[1]!, az = (pz - c[2]!) / r[2]!
  const bx = ax / r[0]!, by = ay / r[1]!, bz = az / r[2]!
  const k0 = Math.hypot(ax, ay, az), k1 = Math.hypot(bx, by, bz)
  return k1 < 1e-9 ? -Math.min(...r) : k0 * (k0 - 1) / k1
}
const capsule = (px: number, py: number, pz: number, a: readonly number[], b: readonly number[], radius: number): number => {
  const pax = px - a[0]!, pay = py - a[1]!, paz = pz - a[2]!
  const bax = b[0]! - a[0]!, bay = b[1]! - a[1]!, baz = b[2]! - a[2]!
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)))
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - radius
}
const chain = (px: number, py: number, pz: number, points: readonly (readonly number[])[], radius: number): number => {
  let d = Infinity
  for (let i = 0; i < points.length - 1; i++) d = Math.min(d, capsule(px, py, pz, points[i]!, points[i + 1]!, radius))
  return d
}
const torusY = (px: number, py: number, pz: number, y: number, major: number, minor: number): number => Math.hypot(Math.hypot(px, pz) - major, py - y) - minor

function arm(px: number, py: number, pz: number): number {
  const { center, axes, stations } = BWC_CREATURE_ARM
  const dx = px - center[0], dy = py - center[1], dz = pz - center[2]
  const reach = Math.hypot(dx, dy, dz)
  if (reach > ARM_BOUND_RADIUS) return reach - ARM_BOUND_RADIUS + 0.2
  const a = dx * axes[0][0] + dy * axes[0][1] + dz * axes[0][2]
  const b = dx * axes[1][0] + dy * axes[1][1] + dz * axes[1][2]
  const c = dx * axes[2][0] + dy * axes[2][1] + dz * axes[2][2]
  const last = stations.length - 1
  let i = 0
  for (let k = 1; k < last; k++) if (a >= stations[k]![0]) i = k
  const s0 = stations[i]!, s1 = stations[i + 1]!
  const f = Math.min(1, Math.max(0, (a - s0[0]) / (s1[0] - s0[0])))
  const lerp = (k: number) => s0[k]! + (s1[k]! - s0[k]!) * f
  const ex = (b - lerp(1)) / lerp(3), ey = (c - lerp(2)) / lerp(4)
  const across = (Math.hypot(ex, ey) - 1) * Math.min(lerp(3), lerp(4))
  const beyond = Math.max(stations[0]![0] - a, a - stations[last]![0])
  return Math.max(across, beyond)
}

/** Signed distance (m) to one named part of the creature, in the creature's own space. */
export function bwcCreaturePartSdf(part: BwcCreaturePart | 'seams' | 'arms' | 'feet' | 'eyes' | 'pawSeams', x: number, y: number, z: number): number {
  const mx = Math.abs(x)
  switch (part) {
    case 'body': return sdPolygon(Math.hypot(x, z), y, BWC_CREATURE_BODY_POLYGON)
    case 'lid': {
      const dr = Math.hypot(x, z) - BWC_CREATURE_LID.radius, dy = Math.abs(y - BWC_CREATURE_LID.centerY) - BWC_CREATURE_LID.halfThickness
      return Math.min(Math.max(dr, dy), 0) + Math.hypot(Math.max(dr, 0), Math.max(dy, 0))
    }
    case 'stitch': return Math.min(torusY(x, y, z, BWC_CREATURE_SEAMS.crown.y, BWC_CREATURE_SEAMS.crown.major, BWC_CREATURE_SEAMS.crown.minor), torusY(x, y, z, BWC_CREATURE_SEAMS.base.y, BWC_CREATURE_SEAMS.base.major, BWC_CREATURE_SEAMS.base.minor), chain(mx, y, z, BWC_CREATURE_PAW_SEAM.points, BWC_CREATURE_PAW_SEAM.radius))
    case 'seams': return Math.min(torusY(x, y, z, BWC_CREATURE_SEAMS.crown.y, BWC_CREATURE_SEAMS.crown.major, BWC_CREATURE_SEAMS.crown.minor), torusY(x, y, z, BWC_CREATURE_SEAMS.base.y, BWC_CREATURE_SEAMS.base.major, BWC_CREATURE_SEAMS.base.minor))
    case 'pawSeams': return chain(mx, y, z, BWC_CREATURE_PAW_SEAM.points, BWC_CREATURE_PAW_SEAM.radius)
    case 'arms': return arm(mx, y, z)
    case 'feet': return ellipsoid(mx, y, z, BWC_CREATURE_FOOT.center, BWC_CREATURE_FOOT.radii)
    case 'cotton': return Math.min(arm(mx, y, z), ellipsoid(mx, y, z, BWC_CREATURE_FOOT.center, BWC_CREATURE_FOOT.radii))
    case 'eyes':
    case 'eye': return ellipsoid(mx, y, z, BWC_CREATURE_EYE.center, BWC_CREATURE_EYE.radii)
    case 'glint': return Math.min(...BWC_CREATURE_GLINTS.map(g => ellipsoid(x, y, z, g.center, g.radii)))
    case 'thread': return chain(x, y, z, BWC_CREATURE_SMILE.points, BWC_CREATURE_SMILE.radius)
  }
}

/** Signed distance (m) to the whole creature in its own space, and which material is nearest. */
export function bwcCreatureSdf(x: number, y: number, z: number): { distance: number; material: number } {
  const parts: BwcCreaturePart[] = ['body', 'lid', 'stitch', 'cotton', 'eye', 'glint', 'thread']
  let best = { distance: Infinity, material: BWC_CREATURE_MATERIAL.body as number }
  for (const part of parts) {
    const distance = bwcCreaturePartSdf(part, x, y, z)
    if (distance < best.distance) best = { distance, material: BWC_CREATURE_MATERIAL[part] }
  }
  return best
}

const f = (value: number): string => value.toFixed(6)
const v2 = (points: readonly (readonly number[])[]): string => points.map(([a, b]) => `vec2(${f(a!)}, ${f(b!)})`).join(',\n  ')
const v3 = (points: readonly (readonly number[])[]): string => points.map(([a, b, c]) => `vec3(${f(a!)}, ${f(b!)}, ${f(c!)})`).join(',\n  ')
const v4 = (points: readonly (readonly number[])[]): string => points.map(([a, b, c, d]) => `vec4(${f(a!)}, ${f(b!)}, ${f(c!)}, ${f(d!)})`).join(',\n  ')

/** GLSL for the creature (creature space: metres, feet on the floor, facing +Z). Needs `nearest`, `sdCapsule` declared before it. */
export function bwcCreatureGlsl(): string {
  const body = BWC_CREATURE_BODY_POLYGON
  const arm = BWC_CREATURE_ARM
  const placement = BWC_CREATURE_PLACEMENT
  return `
const int CREATURE_BODY_COUNT = ${body.length};
const vec2 CREATURE_BODY[CREATURE_BODY_COUNT] = vec2[CREATURE_BODY_COUNT](
  ${v2(body)}
);
const int CREATURE_ARM_COUNT = ${arm.stations.length};
const float CREATURE_ARM_A[CREATURE_ARM_COUNT] = float[CREATURE_ARM_COUNT](${arm.stations.map(s => f(s[0])).join(', ')});
const vec4 CREATURE_ARM_S[CREATURE_ARM_COUNT] = vec4[CREATURE_ARM_COUNT](
  ${v4(arm.stations.map(s => [s[1], s[2], s[3], s[4]]))}
);
const vec3 CREATURE_ARM_CENTER = vec3(${arm.center.map(f).join(', ')});
const vec3 CREATURE_ARM_AXIS0 = vec3(${arm.axes[0].map(f).join(', ')});
const vec3 CREATURE_ARM_AXIS1 = vec3(${arm.axes[1].map(f).join(', ')});
const vec3 CREATURE_ARM_AXIS2 = vec3(${arm.axes[2].map(f).join(', ')});
const vec3 CREATURE_PAW_SEAM[${BWC_CREATURE_PAW_SEAM.points.length}] = vec3[${BWC_CREATURE_PAW_SEAM.points.length}](
  ${v3(BWC_CREATURE_PAW_SEAM.points)}
);
const vec3 CREATURE_SMILE[${BWC_CREATURE_SMILE.points.length}] = vec3[${BWC_CREATURE_SMILE.points.length}](
  ${v3(BWC_CREATURE_SMILE.points)}
);
const float CREATURE_SCALE = ${f(placement.scale)};
const float CREATURE_PITCH = ${f(placement.pitch)};
const float CREATURE_CENTER_X = ${f(placement.centerX)};
const float CREATURE_BASE_Y = ${f(placement.baseY)};
const float CREATURE_Z_FIRST = ${f(placement.zFirst)};
const float CREATURE_Z_LAST = ${f(placement.zLast)};
const float CREATURE_YAW_BIAS = ${f(placement.yawBias)};
const float CREATURE_YAW_JITTER = ${f(placement.yawJitter)};
const float CREATURE_LABEL_V0 = ${f(BWC_CREATURE_LABEL_V0)};
const float CREATURE_LABEL_V1 = ${f(BWC_CREATURE_LABEL_V1)};

float sdCreatureBody(vec2 p) {
  float d = dot(p - CREATURE_BODY[0], p - CREATURE_BODY[0]);
  float s = 1.0;
  for (int i = 0; i < CREATURE_BODY_COUNT; i++) {
    int j = (i + CREATURE_BODY_COUNT - 1) % CREATURE_BODY_COUNT;
    vec2 e = CREATURE_BODY[j] - CREATURE_BODY[i];
    vec2 w = p - CREATURE_BODY[i];
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= CREATURE_BODY[i].y, p.y < CREATURE_BODY[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}
float sdCreatureEllipsoid(vec3 p, vec3 c, vec3 r) {
  vec3 q = (p - c) / r;
  float k0 = length(q);
  float k1 = length(q / r);
  return k1 < 1e-6 ? -min(r.x, min(r.y, r.z)) : k0 * (k0 - 1.0) / k1;
}
float sdCreatureTorus(vec3 p, float y, float major, float minor) {
  return length(vec2(length(p.xz) - major, p.y - y)) - minor;
}
float sdCreatureChain(vec3 p, vec3 a, vec3 b, float r) { return sdCapsule(p, a, b, r); }
float sdCreatureArm(vec3 p) {
  vec3 d = p - CREATURE_ARM_CENTER;
  float reach = length(d);
  if (reach > ${f(0.62)}) return reach - ${f(0.62)} + 0.2;
  float a = dot(d, CREATURE_ARM_AXIS0);
  float b = dot(d, CREATURE_ARM_AXIS1);
  float c = dot(d, CREATURE_ARM_AXIS2);
  int i = 0;
  for (int k = 1; k < CREATURE_ARM_COUNT - 1; k++) { if (a >= CREATURE_ARM_A[k]) i = k; }
  float f = clamp((a - CREATURE_ARM_A[i]) / (CREATURE_ARM_A[i + 1] - CREATURE_ARM_A[i]), 0.0, 1.0);
  vec4 s = mix(CREATURE_ARM_S[i], CREATURE_ARM_S[i + 1], f);
  vec2 e = (vec2(b, c) - s.xy) / s.zw;
  float across = (length(e) - 1.0) * min(s.z, s.w);
  float beyond = max(CREATURE_ARM_A[0] - a, a - CREATURE_ARM_A[CREATURE_ARM_COUNT - 1]);
  return max(across, beyond);
}
/* The plush in its own space: x = (distance, material id). */
vec2 sdBwcCreature(vec3 q) {
  float bound = length(max(abs(q - vec3(0.0, 1.52, 0.18)) - vec3(1.1, 1.56, 0.92), 0.0));
  if (bound > 0.06) return vec2(bound, ${BWC_CREATURE_MATERIAL.body.toFixed(1)});
  vec3 m = vec3(abs(q.x), q.y, q.z);
  vec2 res = vec2(sdCreatureBody(vec2(length(q.xz), q.y)), ${BWC_CREATURE_MATERIAL.body.toFixed(1)});
  float lidR = length(q.xz) - ${f(BWC_CREATURE_LID.radius)};
  float lidY = abs(q.y - ${f(BWC_CREATURE_LID.centerY)}) - ${f(BWC_CREATURE_LID.halfThickness)};
  res = nearest(res, vec2(min(max(lidR, lidY), 0.0) + length(max(vec2(lidR, lidY), 0.0)), ${BWC_CREATURE_MATERIAL.lid.toFixed(1)}));
  float stitch = min(sdCreatureTorus(q, ${f(BWC_CREATURE_SEAMS.crown.y)}, ${f(BWC_CREATURE_SEAMS.crown.major)}, ${f(BWC_CREATURE_SEAMS.crown.minor)}), sdCreatureTorus(q, ${f(BWC_CREATURE_SEAMS.base.y)}, ${f(BWC_CREATURE_SEAMS.base.major)}, ${f(BWC_CREATURE_SEAMS.base.minor)}));
  for (int i = 0; i < ${BWC_CREATURE_PAW_SEAM.points.length - 1}; i++) stitch = min(stitch, sdCreatureChain(m, CREATURE_PAW_SEAM[i], CREATURE_PAW_SEAM[i + 1], ${f(BWC_CREATURE_PAW_SEAM.radius)}));
  res = nearest(res, vec2(stitch, ${BWC_CREATURE_MATERIAL.stitch.toFixed(1)}));
  float cotton = min(sdCreatureArm(m), sdCreatureEllipsoid(m, vec3(${BWC_CREATURE_FOOT.center.map(f).join(', ')}), vec3(${BWC_CREATURE_FOOT.radii.map(f).join(', ')})));
  res = nearest(res, vec2(cotton, ${BWC_CREATURE_MATERIAL.cotton.toFixed(1)}));
  res = nearest(res, vec2(sdCreatureEllipsoid(m, vec3(${BWC_CREATURE_EYE.center.map(f).join(', ')}), vec3(${BWC_CREATURE_EYE.radii.map(f).join(', ')})), ${BWC_CREATURE_MATERIAL.eye.toFixed(1)}));
  float glint = 1.0;
${BWC_CREATURE_GLINTS.map(g => `  glint = min(glint, sdCreatureEllipsoid(q, vec3(${g.center.map(f).join(', ')}), vec3(${g.radii.map(f).join(', ')})));`).join('\n')}
  res = nearest(res, vec2(glint, ${BWC_CREATURE_MATERIAL.glint.toFixed(1)}));
  float thread = 1.0;
  for (int i = 0; i < ${BWC_CREATURE_SMILE.points.length - 1}; i++) thread = min(thread, sdCreatureChain(q, CREATURE_SMILE[i], CREATURE_SMILE[i + 1], ${f(BWC_CREATURE_SMILE.radius)}));
  res = nearest(res, vec2(thread, ${BWC_CREATURE_MATERIAL.thread.toFixed(1)}));
  return res;
}
`
}
