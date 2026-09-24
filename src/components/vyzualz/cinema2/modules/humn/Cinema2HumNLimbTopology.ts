/**
 * Authored hand/arm topology extension for HUM:N structural gestures.
 *
 * Everything here is inactive geometry: the shader only draws it when a
 * gesture weight is above zero, so the approved default frame is untouched.
 * The hand is authored once in unit space (palm centre at the origin, +y up,
 * fingers up, thumb toward -x) as the same fractured low-poly line language as
 * the head: broken strokes, angular finger planes, knuckle facets. Reach and
 * Head Grab reuse it with different transforms.
 */

export type Cinema2HumNLimbSegment = readonly [number, number, number, number]

type Point = readonly [number, number]

interface FingerSpec {
  readonly id: string
  readonly centerline: readonly Point[]
  readonly width: number
}

const FINGERS: readonly FingerSpec[] = Object.freeze([
  Object.freeze({ id: 'index', centerline: Object.freeze([[-0.30, 0.06], [-0.34, 0.40], [-0.33, 0.66]] as const), width: 0.088 }),
  Object.freeze({ id: 'middle', centerline: Object.freeze([[-0.10, 0.08], [-0.10, 0.50], [-0.09, 0.80]] as const), width: 0.094 }),
  Object.freeze({ id: 'ring', centerline: Object.freeze([[0.10, 0.07], [0.13, 0.46], [0.14, 0.72]] as const), width: 0.088 }),
  Object.freeze({ id: 'pinky', centerline: Object.freeze([[0.30, 0.03], [0.38, 0.30], [0.42, 0.50]] as const), width: 0.078 }),
  Object.freeze({ id: 'thumb', centerline: Object.freeze([[-0.40, -0.24], [-0.62, -0.12], [-0.84, 0.10]] as const), width: 0.098 }),
])

/** Palm outline (broken quad) and wrist in unit space. */
const PALM_CORNERS: readonly Point[] = Object.freeze([[-0.38, -0.40], [0.36, -0.36], [0.40, 0.06], [-0.40, 0.08]] as const)
const WRIST: Point = Object.freeze([0, -0.62] as const)

export const CINEMA2_HUMN_HAND_UNIT_BOUNDS = Object.freeze({ minX: -0.94, maxX: 0.50, minY: -0.62, maxY: 0.86 })
export const CINEMA2_HUMN_HAND_UNIT_WIDTH = CINEMA2_HUMN_HAND_UNIT_BOUNDS.maxX - CINEMA2_HUMN_HAND_UNIT_BOUNDS.minX
export const CINEMA2_HUMN_HAND_UNIT_WRIST: Point = WRIST

function perpendicular(a: Point, b: Point): Point {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const length = Math.hypot(dx, dy) || 1
  return [-dy / length, dx / length]
}

function offset(point: Point, normal: Point, amount: number): Point {
  return [point[0] + normal[0] * amount, point[1] + normal[1] * amount]
}

function segment(a: Point, b: Point): Cinema2HumNLimbSegment {
  return Object.freeze([a[0], a[1], b[0], b[1]] as const)
}

function buildHandSegments(): readonly Cinema2HumNLimbSegment[] {
  const all: Cinema2HumNLimbSegment[] = []
  const gapPattern = (index: number) => (index * 7 + 3) % 11 === 0

  // Palm: broken outline (one deliberate gap) + one facet diagonal + wrist strokes.
  PALM_CORNERS.forEach((corner, index) => {
    const next = PALM_CORNERS[(index + 1) % PALM_CORNERS.length]!
    if (index === 2) return // deliberate negative space in the palm outline
    all.push(segment(corner, next))
  })
  all.push(segment(PALM_CORNERS[0]!, PALM_CORNERS[2]!))
  all.push(segment(PALM_CORNERS[0]!, [-0.16, WRIST[1]]))
  all.push(segment(PALM_CORNERS[1]!, [0.16, WRIST[1]]))

  let strokeIndex = 0
  for (const finger of FINGERS) {
    const half = finger.width / 2
    for (let index = 0; index < finger.centerline.length - 1; index++) {
      const a = finger.centerline[index]!
      const b = finger.centerline[index + 1]!
      const normal = perpendicular(a, b)
      const leftA = offset(a, normal, half)
      const leftB = offset(b, normal, half)
      const rightA = offset(a, normal, -half)
      const rightB = offset(b, normal, -half)
      if (!gapPattern(strokeIndex++)) all.push(segment(leftA, leftB))
      if (!gapPattern(strokeIndex++)) all.push(segment(rightA, rightB))
      // Knuckle facet across the finger at each joint.
      if (index > 0) all.push(segment(leftA, rightA))
      if (index === finger.centerline.length - 2) all.push(segment(leftB, rightB)) // fingertip
    }
  }
  return Object.freeze(all)
}

export const CINEMA2_HUMN_HAND_SEGMENTS: readonly Cinema2HumNLimbSegment[] = buildHandSegments()

/** Finger capsules used only for foreground occlusion (segment + width). */
export const CINEMA2_HUMN_HAND_CAPSULES: readonly Readonly<{ segment: Cinema2HumNLimbSegment; width: number }>[] = Object.freeze(
  FINGERS.flatMap(finger => finger.centerline.slice(0, -1).map((a, index) => Object.freeze({
    segment: segment(a, finger.centerline[index + 1]!),
    width: finger.width,
  }))),
)

/** Palm as two triangles for occlusion. */
export const CINEMA2_HUMN_HAND_PALM_TRIANGLES: readonly (readonly [Point, Point, Point])[] = Object.freeze([
  Object.freeze([PALM_CORNERS[0]!, PALM_CORNERS[1]!, PALM_CORNERS[2]!] as const),
  Object.freeze([PALM_CORNERS[0]!, PALM_CORNERS[2]!, PALM_CORNERS[3]!] as const),
])

/** Figure-local anchors for the two authored arms. Viewer-left is negative x. */
export const CINEMA2_HUMN_ARM_ANCHORS = Object.freeze({
  leftShoulder: Object.freeze([-0.58, -0.52] as const),
  rightShoulder: Object.freeze([0.47, -0.51] as const),
})

/**
 * Head Grab pose in figure-local space: shoulder -> elbow -> wrist, plus where
 * the (mirrored) hand sits against the side/top of the head and how it turns
 * so the fingers curl over the crown.
 */
export const CINEMA2_HUMN_HEAD_GRAB_POSE = Object.freeze({
  left: Object.freeze({
    elbow: Object.freeze([-0.90, -0.14] as const),
    wrist: Object.freeze([-0.56, 0.30] as const),
    handOrigin: Object.freeze([-0.53, 0.44] as const),
    handAngle: -0.62,
  }),
  right: Object.freeze({
    elbow: Object.freeze([0.80, -0.12] as const),
    wrist: Object.freeze([0.48, 0.30] as const),
    handOrigin: Object.freeze([0.44, 0.44] as const),
    handAngle: 0.62,
  }),
  handScale: 0.40,
})

export const CINEMA2_HUMN_LIMB_SEMANTIC_GROUPS = Object.freeze({
  'gesture-hand': Object.freeze(CINEMA2_HUMN_HAND_SEGMENTS.map((_, index) => `h${String(index).padStart(3, '0')}`)),
  'gesture-arms': Object.freeze(['arm-left-upper', 'arm-left-forearm', 'arm-right-upper', 'arm-right-forearm']),
})

function glslNumber(value: number): string {
  return value.toFixed(6)
}

/** GLSL constants for the authored hand, used by the native shader. */
export function buildHumNLimbGlsl(): string {
  const segments = CINEMA2_HUMN_HAND_SEGMENTS
    .map(item => `  vec4(${item.map(glslNumber).join(', ')})`)
    .join(',\n')
  const capsules = CINEMA2_HUMN_HAND_CAPSULES
    .map(item => `  vec4(${item.segment.map(glslNumber).join(', ')})`)
    .join(',\n')
  const widths = CINEMA2_HUMN_HAND_CAPSULES
    .map(item => `  ${glslNumber(item.width)}`)
    .join(',\n')
  const palm = CINEMA2_HUMN_HAND_PALM_TRIANGLES
    .flatMap(triangle => triangle.map(point => `  vec2(${point.map(glslNumber).join(', ')})`))
    .join(',\n')
  return `const int HAND_SEGMENT_COUNT = ${CINEMA2_HUMN_HAND_SEGMENTS.length};
const vec4 HAND_SEGMENTS[HAND_SEGMENT_COUNT] = vec4[HAND_SEGMENT_COUNT](
${segments}
);
const int HAND_CAPSULE_COUNT = ${CINEMA2_HUMN_HAND_CAPSULES.length};
const vec4 HAND_CAPSULES[HAND_CAPSULE_COUNT] = vec4[HAND_CAPSULE_COUNT](
${capsules}
);
const float HAND_CAPSULE_WIDTH[HAND_CAPSULE_COUNT] = float[HAND_CAPSULE_COUNT](
${widths}
);
const vec2 HAND_PALM[6] = vec2[6](
${palm}
);`
}
