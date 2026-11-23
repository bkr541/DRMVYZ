import type * as THREE from 'three'
import { CHAMBER_BLADE_CELLS, CHAMBER_SCAN_CELLS, CHAMBER_WASH_CELLS } from './Cinema2ChamberPatterns'

/**
 * The lighting fixtures the chamber gains, all in its own language (the cool cyan and turquoise of the platform ring, the floor marks and the window's spill) and
 * all placed round the platform's centre, so the model in the middle stands among them: seven slim light blades in an arc behind it, four rings on the floor
 * round the platform, one soft shaft of light from the lamp under the device, and a wash light either side. Each is driven by the light programs.
 * Positions are metres from the middle of the platform ring (x to the right, y up, z toward the camera).
 */
export const CHAMBER_FIXTURES = Object.freeze({
  blades: Object.freeze({ radius: 6, spanDegrees: 62, height: 4.2, thickness: .12, base: .1, emission: 1.8 }),
  // Concentric rings flat on the floor round the platform, innermost first, so a ripple travels outward through them. `floor` is the floor's height relative to the middle of the platform ring.
  scan: Object.freeze({ radii: Object.freeze([2.8, 3.3, 3.8, 4.3]), width: .08, floor: -.2, emission: 1.5 }),
  shaft: Object.freeze({ top: 4.4, bottom: .1, topRadius: .3, bottomRadius: 2.4, emission: .5 }),
  wash: Object.freeze({ positions: Object.freeze([[-5, 2.4, 3] as const, [5, 2.4, 3] as const]), range: 9, emission: .3 }),
})

export interface ChamberFixtureSet {
  readonly group: THREE.Group
  readonly blades: THREE.Mesh[]
  readonly scan: THREE.Mesh[]
  readonly shaft: THREE.Mesh
  readonly wash: THREE.PointLight[]
  readonly geometry: THREE.BufferGeometry[]
  readonly materials: THREE.Material[]
}

/** The emissive material every blade and scan ring starts from: black surface, glow only, so the colour and brightness come entirely from the palette and the programs. */
function glowMaterial(THREE: typeof import('three'), color: readonly number[], emission: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: .5, metalness: 0 })
  material.emissive.setRGB(color[0]!, color[1]!, color[2]!, THREE.SRGBColorSpace); material.emissiveIntensity = emission
  return material
}

/**
 * Builds the fixtures under `parent`, centred on `center` (world space). The group cancels the parent's own rotation and scale, so the offsets above are true
 * world metres however the model file was exported.
 */
export function buildChamberFixtures(
  THREE: typeof import('three'), parent: THREE.Object3D, center: THREE.Vector3, colors: { blades: readonly number[]; scan: readonly number[]; shaft: readonly number[]; wash: readonly number[] },
): ChamberFixtureSet {
  const group = new THREE.Group(); group.name = 'chamber-fixtures'
  const worldPosition = new THREE.Vector3(), worldRotation = new THREE.Quaternion(), worldScale = new THREE.Vector3()
  parent.updateWorldMatrix(true, false); parent.matrixWorld.decompose(worldPosition, worldRotation, worldScale)
  group.position.copy(center).applyMatrix4(new THREE.Matrix4().copy(parent.matrixWorld).invert())
  group.quaternion.copy(worldRotation).invert(); group.scale.set(1 / worldScale.x, 1 / worldScale.y, 1 / worldScale.z)
  parent.add(group)
  const geometry: THREE.BufferGeometry[] = [], materials: THREE.Material[] = []
  const own = <T extends THREE.Mesh>(mesh: T) => { geometry.push(mesh.geometry); materials.push(mesh.material as THREE.Material); mesh.frustumCulled = false; group.add(mesh); return mesh }

  const blades = Array.from({ length: CHAMBER_BLADE_CELLS }, (_, index) => {
    const { radius, spanDegrees, height, thickness, base, emission } = CHAMBER_FIXTURES.blades
    const azimuth = (-spanDegrees + index * spanDegrees * 2 / (CHAMBER_BLADE_CELLS - 1)) * Math.PI / 180
    const mesh = own(new THREE.Mesh(new THREE.BoxGeometry(thickness, height, thickness), glowMaterial(THREE, colors.blades, emission)))
    mesh.name = `chamber-blade:${index}`; mesh.position.set(radius * Math.sin(azimuth), base + height / 2, -radius * Math.cos(azimuth)); mesh.rotation.y = -azimuth
    return mesh
  })

  const scan = CHAMBER_FIXTURES.scan.radii.slice(0, CHAMBER_SCAN_CELLS).map((radius, index) => {
    const { width, floor, emission } = CHAMBER_FIXTURES.scan
    const material = glowMaterial(THREE, colors.scan, emission); material.side = THREE.DoubleSide
    const mesh = own(new THREE.Mesh(new THREE.RingGeometry(radius - width / 2, radius + width / 2, 192, 1), material))
    mesh.name = `chamber-scan:${index}`; mesh.rotation.x = -Math.PI / 2; mesh.position.y = floor
    return mesh
  })

  // The shaft: an open cone, narrow at the lamp and wide at the platform, brightest at the top and fading toward the floor. Added on top of the picture, so it only ever adds light.
  const { top, bottom, topRadius, bottomRadius } = CHAMBER_FIXTURES.shaft, length = top - bottom
  const shaftGeometry = new THREE.CylinderGeometry(topRadius, bottomRadius, length, 64, 1, true)
  const positions = shaftGeometry.getAttribute('position'), fade = new Float32Array(positions.count)
  for (let i = 0; i < positions.count; i++) { const t = Math.min(1, Math.max(0, positions.getY(i) / length + .5)); fade[i] = .12 + .88 * t ** 1.6 }
  shaftGeometry.setAttribute('fade', new THREE.BufferAttribute(fade, 1))
  // Its own small shader (the same way the room's dust is drawn): colour times the fade, added to the picture, never covering it.
  const shaftMaterial = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: ['attribute float fade;', 'varying float vFade;', 'void main() {', '  vFade = fade;', '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );', '}'].join('\n'),
    fragmentShader: ['uniform vec3 uColor;', 'varying float vFade;', 'void main() {', '  gl_FragColor = vec4( uColor * vFade, 1.0 );', '  #include <colorspace_fragment>', '}'].join('\n'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  })
  const shaft = own(new THREE.Mesh(shaftGeometry, shaftMaterial))
  shaft.name = 'chamber-shaft'; shaft.position.y = bottom + length / 2; shaft.renderOrder = 5

  const { positions: washPositions, range } = CHAMBER_FIXTURES.wash
  const wash = washPositions.slice(0, CHAMBER_WASH_CELLS).map((position, index) => {
    const light = new THREE.PointLight(0xffffff, 0, range, 2)
    light.name = `chamber-wash:${index === 0 ? 'left' : 'right'}`; light.color.setRGB(colors.wash[0]!, colors.wash[1]!, colors.wash[2]!, THREE.SRGBColorSpace)
    light.position.set(position[0], position[1], position[2]); group.add(light)
    return light
  })
  return { group, blades, scan, shaft, wash, geometry, materials }
}
