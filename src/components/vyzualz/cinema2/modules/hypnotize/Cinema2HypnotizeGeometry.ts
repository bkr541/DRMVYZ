import type * as ThreeNamespace from 'three'

export interface Cinema2HypnotizeMaterials {
  readonly structure: ThreeNamespace.MeshStandardMaterial
  readonly support: ThreeNamespace.MeshStandardMaterial
  readonly membrane: ThreeNamespace.MeshPhysicalMaterial
  readonly cool: ThreeNamespace.MeshStandardMaterial
  readonly warm: ThreeNamespace.MeshStandardMaterial
  readonly core: ThreeNamespace.MeshPhysicalMaterial
  readonly optical: ThreeNamespace.MeshPhysicalMaterial
  readonly spectrum: ThreeNamespace.MeshStandardMaterial
  readonly blackout: ThreeNamespace.MeshStandardMaterial
}

export interface Cinema2HypnotizeRig {
  readonly root: ThreeNamespace.Group
  readonly architecture: ThreeNamespace.Group
  readonly exterior: ThreeNamespace.Group
  readonly turbine: ThreeNamespace.Group
  readonly conductors: ThreeNamespace.Group
  readonly membrane: ThreeNamespace.Group
  readonly core: ThreeNamespace.Group
  readonly halo: ThreeNamespace.Group
  readonly collars: readonly ThreeNamespace.Group[]
  readonly vanes: readonly ThreeNamespace.Group[]
  readonly ledSegments: readonly Cinema2HypnotizeLedSegment[]
  readonly exteriorResonators: readonly Cinema2HypnotizeExteriorResonator[]
  readonly geometries: readonly ThreeNamespace.BufferGeometry[]
}

export interface Cinema2HypnotizeLedSegment {
  readonly mesh: ThreeNamespace.Mesh
  readonly material: ThreeNamespace.MeshStandardMaterial
  readonly family: 'collar' | 'exterior'
  readonly layer: number
  readonly sector: number
  readonly segment: number
  readonly colorRole: 'cool' | 'warm' | 'spectrum'
  readonly baseScale: readonly [number, number, number]
  readonly baseZ: number
}

export interface Cinema2HypnotizeExteriorResonator {
  readonly group: ThreeNamespace.Group
  readonly emitter: ThreeNamespace.MeshStandardMaterial
  readonly style: 0 | 1
  readonly angle: number
  readonly baseX: number
  readonly baseY: number
  readonly baseRotation: number
}

export const CINEMA2_HYPNOTIZE_STATIC_COUNTS = Object.freeze({
  sectors: 12,
  pairedSectorAssemblies: 6,
  depthCollars: 8,
  turbineVanes: 18,
  conductorStrands: 2,
  membraneFilaments: 24,
  spectralGlints: 54,
  exteriorResonators: 16,
  addressableLedSegments: 480,
})

const TAU = Math.PI * 2

/** Builds the approved Phase B optical engine once. No animation is authored here. */
export function createCinema2HypnotizeGeometry(
  THREE: typeof ThreeNamespace,
  materials: Readonly<Cinema2HypnotizeMaterials>,
): Cinema2HypnotizeRig {
  const geometries: ThreeNamespace.BufferGeometry[] = []
  const root = namedGroup(THREE, 'hypnotize-optical-engine')
  const architecture = namedGroup(THREE, 'hypnotize-depth-architecture')
  const exterior = namedGroup(THREE, 'hypnotize-exterior-resonator-bank')
  const turbine = namedGroup(THREE, 'hypnotize-iris-turbine')
  const conductors = namedGroup(THREE, 'hypnotize-braided-conductors')
  const membrane = namedGroup(THREE, 'hypnotize-filament-membrane')
  const core = namedGroup(THREE, 'hypnotize-core-lens')
  const halo = namedGroup(THREE, 'hypnotize-spectral-halo')
  const ledSegments: Cinema2HypnotizeLedSegment[] = []
  root.add(architecture, exterior, membrane, conductors, turbine, core, halo)

  const collars = createDepthArchitecture(THREE, architecture, geometries, materials, ledSegments)
  const exteriorResonators = createExteriorResonators(THREE, exterior, geometries, materials, ledSegments)
  const vanes = createIrisTurbine(THREE, turbine, geometries, materials)
  createBraidedConductors(THREE, conductors, geometries, materials)
  createFilamentMembrane(THREE, membrane, geometries, materials)
  createCoreLens(THREE, core, geometries, materials)
  createSpectralHalo(THREE, halo, geometries, materials)

  return Object.freeze({
    root,
    architecture,
    exterior,
    turbine,
    conductors,
    membrane,
    core,
    halo,
    collars: Object.freeze(collars),
    vanes: Object.freeze(vanes),
    ledSegments: Object.freeze(ledSegments),
    exteriorResonators: Object.freeze(exteriorResonators),
    geometries: Object.freeze(geometries),
  })
}

function createExteriorResonators(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2HypnotizeMaterials>,
  ledSegments: Cinema2HypnotizeLedSegment[],
): Cinema2HypnotizeExteriorResonator[] {
  const outerRingGeometry = new THREE.TorusGeometry(0.82, 0.115, 10, 48)
  const faceBezelGeometry = new THREE.TorusGeometry(0.72, 0.028, 7, 48)
  const innerRingGeometry = new THREE.TorusGeometry(0.51, 0.045, 7, 40)
  const backplateGeometry = new THREE.CircleGeometry(0.72, 48)
  const hubGeometry = new THREE.IcosahedronGeometry(0.145, 1)
  const spokeGeometry = new THREE.BoxGeometry(0.47, 0.045, 0.06)
  const connectorGeometry = new THREE.BoxGeometry(1, 0.11, 0.13)
  const capsuleGeometry = new THREE.CapsuleGeometry(0.047, 0.16, 3, 7)
  const capsuleHousingGeometry = new THREE.CapsuleGeometry(0.076, 0.2, 3, 7)
  const diamondGeometry = new THREE.OctahedronGeometry(0.09, 0)
  const chevronGeometry = bevelledPolygon(THREE, [[-0.12, 0.06], [0, -0.09], [0.12, 0.06], [0.065, 0.12], [0, 0.035], [-0.065, 0.12]], 0.05, 0.008)
  geometries.push(outerRingGeometry, faceBezelGeometry, innerRingGeometry, backplateGeometry, hubGeometry, spokeGeometry, connectorGeometry, capsuleGeometry, capsuleHousingGeometry, diamondGeometry, chevronGeometry)

  const result: Cinema2HypnotizeExteriorResonator[] = []
  const orbitRadius = 7.65
  const resonatorScale = 1.5
  for (let index = 0; index < CINEMA2_HYPNOTIZE_STATIC_COUNTS.exteriorResonators; index += 1) {
    const style = index % 2 as 0 | 1
    const angle = Math.PI / 2 - index * TAU / CINEMA2_HYPNOTIZE_STATIC_COUNTS.exteriorResonators
    const x = Math.cos(angle) * orbitRadius
    const y = Math.sin(angle) * orbitRadius
    const baseRotation = index * 0.12
    const group = namedGroup(THREE, `exterior-resonator-${index + 1}`)
    group.position.set(x, y, -0.24 - index * 0.015)
    group.rotation.z = baseRotation
    group.scale.setScalar(resonatorScale)

    const emitter = cloneLedMaterial(style === 0 ? materials.cool : materials.warm, `exterior-resonator-${index + 1}-emitter`)
    const backplate = mesh(THREE, backplateGeometry, materials.blackout, `exterior-resonator-${index + 1}-backplate`, false, true)
    backplate.position.z = -0.1
    group.add(backplate)
    group.add(mesh(THREE, outerRingGeometry, materials.structure, `exterior-resonator-${index + 1}-outer-ring`, true, true))
    const faceBezel = mesh(THREE, faceBezelGeometry, materials.support, `exterior-resonator-${index + 1}-face-bezel`, true, true)
    faceBezel.position.z = 0.095
    group.add(faceBezel)
    const innerRing = mesh(THREE, innerRingGeometry, style === 0 ? materials.support : materials.membrane, `exterior-resonator-${index + 1}-inner-ring`, true, true)
    innerRing.position.z = 0.07
    group.add(innerRing)

    for (let spoke = 0; spoke < 6; spoke += 1) {
      const angle = spoke * TAU / 6
      const spokeMesh = mesh(THREE, spokeGeometry, materials.structure, `exterior-resonator-${index + 1}-spoke-${spoke + 1}`, true, true)
      spokeMesh.position.set(Math.cos(angle) * 0.31, Math.sin(angle) * 0.31, 0.035)
      spokeMesh.rotation.z = angle
      group.add(spokeMesh)
    }

    for (let led = 0; led < 12; led += 1) {
      const angle = led * TAU / 12
      const ledGeometry = style === 0 ? capsuleGeometry : led % 2 === 0 ? diamondGeometry : chevronGeometry
      const colorRole = style === 0 ? 'cool' : led % 3 === 0 ? 'spectrum' : 'warm'
      const housingGeometry = style === 0 ? capsuleHousingGeometry : ledGeometry
      const housing = mesh(THREE, housingGeometry, materials.support, `exterior-resonator-${index + 1}-surface-led-${led + 1}-housing`, true, true)
      housing.position.set(Math.cos(angle) * 0.66, Math.sin(angle) * 0.66, 0.105)
      housing.rotation.z = style === 0 ? angle : angle - Math.PI / 2
      if (style === 1 && led % 2 === 0) housing.scale.set(0.92, 1.7, 0.78)
      else if (style === 1) housing.scale.set(1.25, 1.25, 0.82)
      group.add(housing)
      const ledMaterial = cloneLedMaterial(materials[colorRole], `exterior-resonator-${index + 1}-surface-led-${led + 1}-material`)
      const ledMesh = mesh(THREE, ledGeometry, ledMaterial, `exterior-resonator-${index + 1}-surface-led-${led + 1}`, false, false)
      ledMesh.position.set(Math.cos(angle) * 0.66, Math.sin(angle) * 0.66, 0.15)
      ledMesh.rotation.z = style === 0 ? angle : angle - Math.PI / 2
      if (style === 1 && led % 2 === 0) ledMesh.scale.set(0.72, 1.38, 0.68)
      group.add(ledMesh)
      registerLedSegment(ledSegments, ledMesh, ledMaterial, 'exterior', 8, index, led, colorRole)
    }

    const hub = mesh(THREE, hubGeometry, emitter, `exterior-resonator-${index + 1}-energy-hub`, false, false)
    hub.position.z = 0.13
    group.add(hub)
    parent.add(group)

    const connectorStartRadius = 6.03
    const connectorEndRadius = orbitRadius - 0.72 * resonatorScale
    const connectorLength = connectorEndRadius - connectorStartRadius
    const connector = mesh(THREE, connectorGeometry, materials.structure, `exterior-resonator-${index + 1}-mount`, true, true)
    connector.scale.x = connectorLength
    connector.position.set(
      Math.cos(angle) * (connectorStartRadius + connectorLength * 0.5),
      Math.sin(angle) * (connectorStartRadius + connectorLength * 0.5),
      group.position.z - 0.05,
    )
    connector.rotation.z = angle
    parent.add(connector)
    result.push(Object.freeze({ group, emitter, style, angle, baseX: x, baseY: y, baseRotation }))
  }
  return result
}

function createDepthArchitecture(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2HypnotizeMaterials>,
  ledSegments: Cinema2HypnotizeLedSegment[],
): ThreeNamespace.Group[] {
  const collars: ThreeNamespace.Group[] = []
  const collarGeometry = new THREE.TorusGeometry(6.08, 0.2, 10, 96)
  const innerCollarGeometry = new THREE.TorusGeometry(5.68, 0.075, 8, 96)
  const spokeGeometry = new THREE.BoxGeometry(4.45, 0.12, 0.18)
  const jointGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12)
  const ribGeometry = new THREE.BoxGeometry(0.18, 0.26, 1)
  const finGeometry = bevelledPolygon(THREE, [[3.9, -0.15], [5.45, -0.23], [5.88, 0], [5.45, 0.23], [3.9, 0.15]], 0.16, 0.025)
  const capsuleLedGeometry = new THREE.CapsuleGeometry(0.075, 0.42, 4, 8)
  const capsuleHousingGeometry = new THREE.CapsuleGeometry(0.12, 0.48, 4, 8)
  const diamondLedGeometry = new THREE.OctahedronGeometry(0.15, 0)
  const dotLedGeometry = new THREE.SphereGeometry(0.095, 10, 6)
  const chevronLedGeometry = bevelledPolygon(THREE, [[-0.3, 0.14], [0, -0.16], [0.3, 0.14], [0.18, 0.25], [0, 0.07], [-0.18, 0.25]], 0.075, 0.012)
  const collarSectorWidth = TAU / CINEMA2_HYPNOTIZE_STATIC_COUNTS.sectors
  const collarSegmentGap = 0.035
  const collarSegmentArc = (collarSectorWidth - 0.11 - collarSegmentGap * 2) / 3
  const collarRailSegmentGeometry = new THREE.TorusGeometry(5.79, 0.065, 7, 10, collarSegmentArc)
  const collarRailHousingGeometry = new THREE.TorusGeometry(5.79, 0.11, 8, 10, collarSegmentArc + 0.012)
  geometries.push(
    collarGeometry,
    innerCollarGeometry,
    spokeGeometry,
    ribGeometry,
    finGeometry,
    capsuleLedGeometry,
    capsuleHousingGeometry,
    diamondLedGeometry,
    dotLedGeometry,
    chevronLedGeometry,
    collarRailSegmentGeometry,
    collarRailHousingGeometry,
  )

  for (let layer = 0; layer < CINEMA2_HYPNOTIZE_STATIC_COUNTS.depthCollars; layer += 1) {
    const group = namedGroup(THREE, `depth-collar-${layer + 1}`)
    const scale = 1 - layer * 0.034
    group.position.z = 0.65 - layer * 1.48
    group.scale.set(scale, scale, 1)
    group.add(mesh(THREE, collarGeometry, layer % 2 ? materials.support : materials.structure, `collar-${layer + 1}-outer`, true, true))
    const inner = mesh(THREE, innerCollarGeometry, materials.support, `collar-${layer + 1}-inner`, true, true)
    inner.position.z = 0.09
    group.add(inner)

    for (let sector = 0; sector < CINEMA2_HYPNOTIZE_STATIC_COUNTS.sectors; sector += 1) {
      const angle = sector * TAU / CINEMA2_HYPNOTIZE_STATIC_COUNTS.sectors
      const spoke = mesh(THREE, spokeGeometry, materials.structure, `collar-${layer + 1}-sector-${sector + 1}`, true, true)
      spoke.position.set(Math.cos(angle) * 3.65, Math.sin(angle) * 3.65, -0.03)
      spoke.rotation.z = angle
      group.add(spoke)

      const joint = mesh(THREE, jointGeometry, materials.support, `collar-${layer + 1}-joint-${sector + 1}`, true, true)
      joint.rotation.x = Math.PI / 2
      joint.position.set(Math.cos(angle) * 5.88, Math.sin(angle) * 5.88, 0.04)
      group.add(joint)

      if (layer < 3 && sector % 2 === 0) {
        const fin = mesh(THREE, finGeometry, materials.structure, `collar-${layer + 1}-fin-${sector + 1}`, true, true)
        fin.rotation.z = angle
        fin.position.z = -0.13
        group.add(fin)
      }
    }

    const railRadius = 5.79
    for (let sector = 0; sector < CINEMA2_HYPNOTIZE_STATIC_COUNTS.sectors; sector += 1) {
      if (layer % 2 === 0) {
        const start = sector * TAU / CINEMA2_HYPNOTIZE_STATIC_COUNTS.sectors + 0.055
        for (let segment = 0; segment < 3; segment += 1) {
          const colorRole = (sector + layer + segment) % 5 === 0 ? 'warm' : segment === 1 && layer === 6 ? 'spectrum' : 'cool'
          const housing = mesh(THREE, collarRailHousingGeometry, materials.support, `collar-${layer + 1}-arc-light-${sector + 1}-${segment + 1}-housing`, true, true)
          housing.rotation.z = start + segment * (collarSegmentArc + collarSegmentGap) - 0.006
          housing.position.z = 0.125
          group.add(housing)
          const ledMaterial = cloneLedMaterial(materials[colorRole], `collar-${layer + 1}-arc-${sector + 1}-${segment + 1}-material`)
          const railMesh = mesh(THREE, collarRailSegmentGeometry, ledMaterial, `collar-${layer + 1}-arc-light-${sector + 1}-${segment + 1}`, false, false)
          railMesh.rotation.z = start + segment * (collarSegmentArc + collarSegmentGap)
          railMesh.position.z = 0.18
          group.add(railMesh)
          registerLedSegment(ledSegments, railMesh, ledMaterial, 'collar', layer, sector, segment, colorRole)
        }
      } else {
        addAlternatingLedDesign(THREE, group, materials, {
          layer,
          sector,
          radius: railRadius,
          capsule: capsuleLedGeometry,
          capsuleHousing: capsuleHousingGeometry,
          diamond: diamondLedGeometry,
          dot: dotLedGeometry,
          chevron: chevronLedGeometry,
        }, ledSegments)
      }
    }
    parent.add(group)
    collars.push(group)
  }

  // Twelve continuous ribs turn the rings into a single deep machine.
  for (let sector = 0; sector < CINEMA2_HYPNOTIZE_STATIC_COUNTS.sectors; sector += 1) {
    const angle = sector * TAU / CINEMA2_HYPNOTIZE_STATIC_COUNTS.sectors
    const front = new THREE.Vector3(Math.cos(angle) * 6.08, Math.sin(angle) * 6.08, 1.15)
    const back = new THREE.Vector3(Math.cos(angle) * 4.62, Math.sin(angle) * 4.62, -10.25)
    parent.add(orientedBox(THREE, ribGeometry, sector % 2 ? materials.support : materials.structure, front, back, `axial-rib-${sector + 1}`))
  }

  const rearBaffleGeometry = new THREE.CylinderGeometry(4.45, 4.45, 0.3, 96)
  geometries.push(rearBaffleGeometry)
  const rearBaffle = mesh(THREE, rearBaffleGeometry, materials.blackout, 'rear-optical-baffle', false, true)
  rearBaffle.rotation.x = Math.PI / 2
  rearBaffle.position.z = -10.45
  parent.add(rearBaffle)
  return collars
}

interface AlternateLedOptions {
  readonly layer: number
  readonly sector: number
  readonly radius: number
  readonly capsule: ThreeNamespace.BufferGeometry
  readonly capsuleHousing: ThreeNamespace.BufferGeometry
  readonly diamond: ThreeNamespace.BufferGeometry
  readonly dot: ThreeNamespace.BufferGeometry
  readonly chevron: ThreeNamespace.BufferGeometry
}

/** Gives every other collar a non-linear light signature instead of another square arc rail. */
function addAlternatingLedDesign(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  materials: Readonly<Cinema2HypnotizeMaterials>,
  options: Readonly<AlternateLedOptions>,
  ledSegments: Cinema2HypnotizeLedSegment[],
): void {
  const sectorWidth = TAU / CINEMA2_HYPNOTIZE_STATIC_COUNTS.sectors
  const center = (options.sector + 0.5) * sectorWidth
  const style = ((options.layer - 1) / 2) % 4
  const colorRole = (options.sector + options.layer) % 3 === 0 ? 'warm' : options.layer === 5 ? 'spectrum' : 'cool'

  if (style === 0) {
    for (const [index, offset] of [-0.17, 0, 0.17].entries()) {
      addLedPiece(THREE, parent, options.capsuleHousing, materials.support, options.radius, center + offset, 0.145, `collar-${options.layer + 1}-capsule-housing-${options.sector + 1}-${index + 1}`, angle => angle)
      const led = addAddressableLed(THREE, parent, options.capsule, materials[colorRole], options.radius, center + offset, 0.215, `collar-${options.layer + 1}-capsule-${options.sector + 1}-${index + 1}`, angle => angle)
      registerLedSegment(ledSegments, led.mesh, led.material, 'collar', options.layer, options.sector, index, colorRole)
    }
    return
  }

  if (style === 1) {
    for (const [index, offset] of [-0.14, 0, 0.14].entries()) {
      const led = addAddressableLed(THREE, parent, index === 1 ? options.dot : options.diamond, materials[colorRole], options.radius, center + offset, 0.22, `collar-${options.layer + 1}-prism-${options.sector + 1}-${index + 1}`, angle => angle)
      const marker = led.mesh
      marker.scale.set(index === 1 ? 1.15 : 0.75, index === 1 ? 1.15 : 1.75, 0.58)
      registerLedSegment(ledSegments, marker, led.material, 'collar', options.layer, options.sector, index, colorRole)
    }
    return
  }

  if (style === 2) {
    for (const [index, offset] of [-0.12, 0.12].entries()) {
      const led = addAddressableLed(THREE, parent, options.chevron, materials[colorRole], options.radius, center + offset, 0.21, `collar-${options.layer + 1}-chevron-${options.sector + 1}-${index + 1}`, angle => angle - Math.PI / 2)
      const chevron = led.mesh
      chevron.scale.setScalar(1.28)
      registerLedSegment(ledSegments, chevron, led.material, 'collar', options.layer, options.sector, index, colorRole)
    }
    return
  }

  for (const [index, offset] of [-0.19, -0.065, 0.065, 0.19].entries()) {
    const dotRole = index % 2 === 0 ? colorRole : 'spectrum'
    const led = addAddressableLed(THREE, parent, options.dot, materials[dotRole], options.radius, center + offset, 0.22, `collar-${options.layer + 1}-dot-${options.sector + 1}-${index + 1}`, angle => angle)
    const dot = led.mesh
    dot.scale.set(index % 2 === 0 ? 0.72 : 1.08, index % 2 === 0 ? 0.72 : 1.08, 0.58)
    registerLedSegment(ledSegments, dot, led.material, 'collar', options.layer, options.sector, index, dotRole)
  }
}

function addAddressableLed(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  geometry: ThreeNamespace.BufferGeometry,
  sourceMaterial: ThreeNamespace.MeshStandardMaterial,
  radius: number,
  angle: number,
  z: number,
  name: string,
  rotation: (angle: number) => number,
): { readonly mesh: ThreeNamespace.Mesh; readonly material: ThreeNamespace.MeshStandardMaterial } {
  const material = cloneLedMaterial(sourceMaterial, `${name}-material`)
  return { mesh: addLedPiece(THREE, parent, geometry, material, radius, angle, z, name, rotation), material }
}

function cloneLedMaterial(source: ThreeNamespace.MeshStandardMaterial, name: string): ThreeNamespace.MeshStandardMaterial {
  const material = source.clone()
  material.name = name
  material.toneMapped = false
  return material
}

function registerLedSegment(
  target: Cinema2HypnotizeLedSegment[],
  ledMesh: ThreeNamespace.Mesh,
  material: ThreeNamespace.MeshStandardMaterial,
  family: Cinema2HypnotizeLedSegment['family'],
  layer: number,
  sector: number,
  segment: number,
  colorRole: Cinema2HypnotizeLedSegment['colorRole'],
): void {
  target.push(Object.freeze({
    mesh: ledMesh,
    material,
    family,
    layer,
    sector,
    segment,
    colorRole,
    baseScale: Object.freeze([ledMesh.scale.x, ledMesh.scale.y, ledMesh.scale.z] as const),
    baseZ: ledMesh.position.z,
  }))
}

function addLedPiece(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  geometry: ThreeNamespace.BufferGeometry,
  material: ThreeNamespace.Material,
  radius: number,
  angle: number,
  z: number,
  name: string,
  rotation: (angle: number) => number,
): ThreeNamespace.Mesh {
  const result = mesh(THREE, geometry, material, name, false, false)
  result.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z)
  result.rotation.z = rotation(angle)
  parent.add(result)
  return result
}

function createIrisTurbine(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2HypnotizeMaterials>,
): ThreeNamespace.Group[] {
  parent.position.z = -3.8
  const bearingOuter = new THREE.TorusGeometry(3.12, 0.2, 10, 96)
  const bearingInner = new THREE.TorusGeometry(1.48, 0.12, 8, 72)
  const bearingTrim = new THREE.TorusGeometry(2.83, 0.045, 7, 96)
  const bladeGeometry = curvedVaneGeometry(THREE)
  const vaneInsetGeometry = bevelledPolygon(THREE, [[1.18, -0.055], [2.44, -0.17], [2.75, -0.075], [2.5, 0.07], [1.25, 0.11]], 0.055, 0.012)
  const hingeGeometry = new THREE.CylinderGeometry(0.11, 0.11, 0.3, 12)
  geometries.push(bearingOuter, bearingInner, bearingTrim, bladeGeometry, vaneInsetGeometry, hingeGeometry)
  parent.add(mesh(THREE, bearingOuter, materials.structure, 'turbine-outer-bearing', true, true))
  const trim = mesh(THREE, bearingTrim, materials.support, 'turbine-machined-trim', true, true)
  trim.position.z = 0.12
  parent.add(trim)
  const inner = mesh(THREE, bearingInner, materials.support, 'turbine-inner-bearing', true, true)
  inner.position.z = 0.13
  parent.add(inner)

  const vanes: ThreeNamespace.Group[] = []
  for (let index = 0; index < CINEMA2_HYPNOTIZE_STATIC_COUNTS.turbineVanes; index += 1) {
    const angle = index * TAU / CINEMA2_HYPNOTIZE_STATIC_COUNTS.turbineVanes
    const vane = namedGroup(THREE, `turbine-vane-${index + 1}`)
    vane.rotation.z = angle + 0.12
    vane.position.z = (index % 3) * 0.035
    vane.add(mesh(THREE, bladeGeometry, index % 2 ? materials.support : materials.structure, `turbine-vane-face-${index + 1}`, true, true))
    const inset = mesh(THREE, vaneInsetGeometry, materials.membrane, `turbine-vane-inset-${index + 1}`, true, true)
    inset.position.z = 0.095
    vane.add(inset)
    const hinge = mesh(THREE, hingeGeometry, materials.support, `turbine-vane-hinge-${index + 1}`, true, true)
    hinge.rotation.x = Math.PI / 2
    hinge.position.set(1.2, 0, 0.09)
    vane.add(hinge)
    parent.add(vane)
    vanes.push(vane)
  }
  return vanes
}

function createBraidedConductors(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2HypnotizeMaterials>,
): void {
  parent.position.z = -3.1
  const nodeGeometry = new THREE.IcosahedronGeometry(0.09, 1)
  geometries.push(nodeGeometry)
  for (let strand = 0; strand < CINEMA2_HYPNOTIZE_STATIC_COUNTS.conductorStrands; strand += 1) {
    const points: ThreeNamespace.Vector3[] = []
    const count = 144
    for (let index = 0; index < count; index += 1) {
      const phase = index / count * TAU
      const braid = phase * 6 + strand * Math.PI
      const radius = 3.64 + Math.sin(braid) * 0.18
      points.push(new THREE.Vector3(Math.cos(phase) * radius, Math.sin(phase) * radius, Math.cos(braid) * 0.16))
    }
    const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal')
    const tube = new THREE.TubeGeometry(curve, 180, 0.055, 7, true)
    geometries.push(tube)
    parent.add(mesh(THREE, tube, strand === 0 ? materials.cool : materials.warm, `braided-conductor-${strand + 1}`, false, false))
    for (let node = 0; node < 18; node += 1) {
      const point = curve.getPoint(node / 18)
      const marker = mesh(THREE, nodeGeometry, strand === 0 ? materials.cool : materials.warm, `conductor-${strand + 1}-node-${node + 1}`, false, false)
      marker.position.copy(point)
      parent.add(marker)
    }
  }
}

function createFilamentMembrane(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2HypnotizeMaterials>,
): void {
  parent.position.z = -3.4
  for (let index = 0; index < CINEMA2_HYPNOTIZE_STATIC_COUNTS.membraneFilaments; index += 1) {
    const angle = index * TAU / CINEMA2_HYPNOTIZE_STATIC_COUNTS.membraneFilaments
    const lobe = Math.sin(angle * 4) * 0.28
    const tangent = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0)
    const start = new THREE.Vector3(Math.cos(angle) * 1.55, Math.sin(angle) * 1.55, 0.02)
    const middle = new THREE.Vector3(Math.cos(angle) * (2.58 + lobe), Math.sin(angle) * (2.58 + lobe), -0.34)
      .add(tangent.multiplyScalar((index % 2 ? -1 : 1) * 0.32))
    const end = new THREE.Vector3(Math.cos(angle) * 3.42, Math.sin(angle) * 3.42, 0.08)
    const curve = new THREE.CatmullRomCurve3([start, middle, end], false, 'centripetal')
    const filament = new THREE.TubeGeometry(curve, 12, index % 3 === 0 ? 0.052 : 0.034, 5, false)
    geometries.push(filament)
    parent.add(mesh(THREE, filament, index % 4 === 0 ? materials.spectrum : materials.membrane, `membrane-filament-${index + 1}`, false, false))
  }
}

function createCoreLens(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2HypnotizeMaterials>,
): void {
  parent.position.z = -4.65
  const cageOuter = new THREE.TorusGeometry(1.18, 0.16, 10, 72)
  const cageInner = new THREE.TorusGeometry(0.79, 0.075, 8, 64)
  const lensGeometry = new THREE.IcosahedronGeometry(0.68, 4)
  const shellGeometry = new THREE.IcosahedronGeometry(0.79, 5)
  const pupilGeometry = new THREE.CircleGeometry(0.24, 48)
  const crownGeometry = new THREE.TorusKnotGeometry(0.91, 0.032, 96, 8, 2, 5)
  geometries.push(cageOuter, cageInner, lensGeometry, shellGeometry, pupilGeometry, crownGeometry)
  parent.add(mesh(THREE, cageOuter, materials.structure, 'core-outer-cage', true, true))
  const inner = mesh(THREE, cageInner, materials.spectrum, 'core-spectral-ring', false, false)
  inner.position.z = 0.14
  parent.add(inner)
  const lens = mesh(THREE, lensGeometry, materials.core, 'core-energy-lens', false, true)
  lens.position.z = 0.05
  parent.add(lens)
  const shell = mesh(THREE, shellGeometry, materials.optical, 'core-optical-shell', false, false)
  shell.position.z = 0.045
  parent.add(shell)
  const pupil = mesh(THREE, pupilGeometry, materials.blackout, 'core-pupil', false, false)
  pupil.position.z = 0.68
  parent.add(pupil)
  const crown = mesh(THREE, crownGeometry, materials.cool, 'core-corona', false, false)
  crown.position.z = -0.03
  parent.add(crown)
}

function createSpectralHalo(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2HypnotizeMaterials>,
): void {
  parent.position.z = -2.85
  const glintGeometry = new THREE.OctahedronGeometry(0.055, 0)
  const arcGeometry = new THREE.TorusGeometry(4.35, 0.024, 5, 14, 0.22)
  geometries.push(glintGeometry, arcGeometry)
  for (let index = 0; index < CINEMA2_HYPNOTIZE_STATIC_COUNTS.spectralGlints; index += 1) {
    const phase = index / CINEMA2_HYPNOTIZE_STATIC_COUNTS.spectralGlints * TAU
    const radius = 4.15 + seeded(index, 7) * 0.62
    const glint = mesh(THREE, glintGeometry, index % 4 === 0 ? materials.warm : materials.spectrum, `spectral-glint-${index + 1}`, false, false)
    glint.position.set(Math.cos(phase) * radius, Math.sin(phase) * radius, (seeded(index, 11) - 0.5) * 1.4)
    glint.scale.setScalar(0.55 + seeded(index, 13) * 1.35)
    parent.add(glint)
    if (index % 9 === 0) {
      const arc = mesh(THREE, arcGeometry, materials.spectrum, `spectral-arc-${index / 9 + 1}`, false, false)
      arc.rotation.z = phase
      arc.position.z = glint.position.z
      parent.add(arc)
    }
  }
}

function curvedVaneGeometry(THREE: typeof ThreeNamespace): ThreeNamespace.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0.84, -0.13)
  shape.quadraticCurveTo(1.72, -0.48, 2.92, -0.28)
  shape.quadraticCurveTo(3.28, -0.08, 2.94, 0.15)
  shape.quadraticCurveTo(1.88, 0.42, 0.92, 0.24)
  shape.quadraticCurveTo(0.72, 0.05, 0.84, -0.13)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 12 })
  geometry.translate(0, 0, -0.07)
  geometry.computeVertexNormals()
  return geometry
}

function bevelledPolygon(
  THREE: typeof ThreeNamespace,
  points: readonly (readonly [number, number])[],
  depth: number,
  bevelSize: number,
): ThreeNamespace.ExtrudeGeometry {
  const shape = new THREE.Shape()
  points.forEach(([x, y], index) => index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y))
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize, bevelThickness: bevelSize, curveSegments: 1 })
  geometry.translate(0, 0, -depth / 2)
  geometry.computeVertexNormals()
  return geometry
}

function orientedBox(
  THREE: typeof ThreeNamespace,
  geometry: ThreeNamespace.BufferGeometry,
  material: ThreeNamespace.Material,
  from: ThreeNamespace.Vector3,
  to: ThreeNamespace.Vector3,
  name: string,
): ThreeNamespace.Mesh {
  const result = mesh(THREE, geometry, material, name, true, true)
  const direction = to.clone().sub(from)
  result.position.copy(from).add(to).multiplyScalar(0.5)
  result.scale.z = direction.length()
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize())
  return result
}

function namedGroup(THREE: typeof ThreeNamespace, name: string): ThreeNamespace.Group {
  const group = new THREE.Group()
  group.name = name
  return group
}

function mesh(
  THREE: typeof ThreeNamespace,
  geometry: ThreeNamespace.BufferGeometry,
  material: ThreeNamespace.Material,
  name: string,
  castShadow: boolean,
  receiveShadow: boolean,
): ThreeNamespace.Mesh {
  const result = new THREE.Mesh(geometry, material)
  result.name = name
  result.castShadow = castShadow
  result.receiveShadow = receiveShadow
  return result
}

function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return value - Math.floor(value)
}
