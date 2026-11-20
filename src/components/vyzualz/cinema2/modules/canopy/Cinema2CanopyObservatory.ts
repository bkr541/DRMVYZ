import { CANOPY_CAP_HEIGHT, CANOPY_CAP_WIDTH, CANOPY_ROD_RADIUS, CANOPY_STEM_WIDTH, canopyHash } from './Cinema2CanopyDomain'
import { CANOPY_INSTANCE_FLOATS, CANOPY_KIND } from './Cinema2CanopyLayout'

export const CANOPY_OBSERVATORY_LIGHT_GROUPS = ['inner-rods', 'outer-rods', 'ring-strips', 'joint-lights', 'perimeter-lights', 'upper-led-wall', 'lower-led-wall'] as const
const LIGHT_ROLE = { inner: 1, outer: 2, strips: 3, joints: 4, perimeter: 5, upperScreen: 6, lowerScreen: 7 } as const
const ARCHITECTURE = 4
const MOUNT_LIGHT = 5
export const CANOPY_OBSERVATORY_SCREEN_KIND = 6
export const CANOPY_OBSERVATORY_SCREEN_BANDS = [
  { minY: 4.49, maxY: 6.78, role: LIGHT_ROLE.upperScreen, bank: 0 },
  { minY: .18, maxY: 4.15, role: LIGHT_ROLE.lowerScreen, bank: 1 },
] as const

interface ObservatoryRing {
  radius: number
  height: number
  rods: number
  phase: number
  bank: number
  role: number
}

const RINGS: readonly ObservatoryRing[] = [
  { radius: 5.8, height: 4.66, rods: 48, phase: 0, bank: 0, role: LIGHT_ROLE.inner },
  { radius: 8.55, height: 3.62, rods: 64, phase: Math.PI / 8, bank: 1, role: LIGHT_ROLE.outer },
]

/** Static instance records share the live array's box and diffuser meshes. */
export function buildCanopyObservatory() {
  const boxes: number[] = []
  const rods: number[] = []
  const write = (output: number[], kind: number, x: number, y: number, z: number, width: number, height: number, depth: number, yaw = 0, emission = 0, bank = 0, accent = 0, role = 0) => {
    output.push(x, y, z, kind, width, height, depth, emission, accent, bank, yaw, role)
  }
  const arc = (radius: number, y: number, width: number, height: number, kind: number, emission: number, bank: number, role = 0, breaks = kind === MOUNT_LIGHT) => {
    const count = 96
    const step = Math.PI * 2 / count
    for (let segment = 0; segment < count; segment += 1) {
      const angle = (segment + .5) * step
      // Small breaks between the light banks keep the hardware joints visible.
      if (breaks && segment % 12 === 0) continue
      const length = 2 * radius * Math.tan(step / 2) * (kind === MOUNT_LIGHT ? 1.015 : 1.045)
      write(boxes, kind, radius * Math.cos(angle), y, radius * Math.sin(angle), length, height, width, -angle - Math.PI / 2, emission, bank, 0, role)
    }
  }

  for (const ring of RINGS) {
    const { radius, height, bank, role } = ring
    arc(radius, height + .20, .52, .39, ARCHITECTURE, 0, bank)
    arc(radius - .25, height + .385, .10, .08, ARCHITECTURE, 0, bank)
    arc(radius - .27, height + .088, .045, .065, MOUNT_LIGHT, .85, bank, LIGHT_ROLE.strips)
    for (let ordinal = 0; ordinal < ring.rods; ordinal += 1) {
      const sectorStep = ordinal % (ring.rods / 8)
      const angle = (ordinal + .5) * 2 * Math.PI / ring.rods + ring.phase
      const x = radius * Math.cos(angle)
      const z = radius * Math.sin(angle)
      const stagger = 1 - Math.abs(sectorStep / (ring.rods / 8 - 1) * 2 - 1)
      const start = height + .03
      const hang = .28 + .49 * stagger + .17 * canopyHash(ordinal, bank + 75)
      const length = (bank ? .91 : .96) + (bank ? .66 : .78) * stagger + canopyHash(ordinal, bank + 31) * .38
      const fixtureBank = sectorStep === 0 ? 1 - bank : bank
      const glow = (bank ? .46 : .66) + canopyHash(ordinal, 53 + bank) * .20
      const stemLength = hang - CANOPY_CAP_HEIGHT
      write(boxes, ARCHITECTURE, x, start - stemLength / 2, z, CANOPY_STEM_WIDTH * 1.7, stemLength, CANOPY_STEM_WIDTH * 1.7)
      write(boxes, ARCHITECTURE, x, start - hang + CANOPY_CAP_HEIGHT / 2, z, CANOPY_CAP_WIDTH * .82, CANOPY_CAP_HEIGHT, CANOPY_CAP_WIDTH * .82, -angle)
      write(rods, CANOPY_KIND.diffuser, x, start - hang - length / 2, z, CANOPY_ROD_RADIUS * (bank ? 1.65 : 2), length, CANOPY_ROD_RADIUS * (bank ? 1.65 : 2), 0, glow, fixtureBank, 0, role)
    }
  }

  // Radial supports tie both rails to the original overhead mounting grid.
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4
    const x = Math.cos(angle), z = Math.sin(angle)
    write(boxes, ARCHITECTURE, x * 4.65, 4.82, z * 4.65, 2.47, .18, .24, -angle)
    write(boxes, ARCHITECTURE, x * 7.2, 4.82, z * 7.2, 2.93, .20, .27, -angle)
    write(boxes, ARCHITECTURE, x * 8.55, 4.28, z * 8.55, .24, .94, .24, -angle)
    for (const { radius, height } of RINGS) {
      const innerFace = radius - .30
      const yaw = -angle - Math.PI / 2
      write(boxes, ARCHITECTURE, x * radius, height + .18, z * radius, .48, .47, .62, yaw)
      write(boxes, MOUNT_LIGHT, x * innerFace, height + .04, z * innerFace, .27, .068, .13, yaw, .94, 0, 1, LIGHT_ROLE.joints)
    }
  }

  const wallRadius = 11.45
  const screenRadius = 11.08
  arc(wallRadius, 7.05, .55, .22, ARCHITECTURE, 0, 0)
  for (const { minY, maxY, role, bank } of CANOPY_OBSERVATORY_SCREEN_BANDS) {
    arc(screenRadius, (maxY + minY) / 2, .05, maxY - minY, CANOPY_OBSERVATORY_SCREEN_KIND, 1, bank, role)
    for (const y of [minY, maxY]) arc(screenRadius - .025, y, .09, .056, ARCHITECTURE, 0, bank)
  }
  arc(screenRadius - .06, 4.32, .13, .17, ARCHITECTURE, 0, 1)
  arc(screenRadius - .14, 4.32, .036, .032, MOUNT_LIGHT, .48, 1, LIGHT_ROLE.perimeter, false)
  for (let index = 0; index < 24; index += 1) {
    const angle = (index + .5) * Math.PI / 12
    const x = Math.cos(angle), z = Math.sin(angle)
    const yaw = -angle - Math.PI / 2
    write(boxes, ARCHITECTURE, x * wallRadius, 3.48, z * wallRadius, 2.96, 7.12, .21, yaw, 0, index % 2)
    write(boxes, ARCHITECTURE, x * (wallRadius - .16), 3.5, z * (wallRadius - .16), .14, 7.14, .26, yaw)
  }

  return {
    instances: new Float32Array([...boxes, ...rods]),
    boxCount: boxes.length / CANOPY_INSTANCE_FLOATS,
    rodCount: rods.length / CANOPY_INSTANCE_FLOATS,
  }
}
