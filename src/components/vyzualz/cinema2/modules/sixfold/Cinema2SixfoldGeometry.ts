import type * as ThreeNamespace from 'three'

export interface Cinema2SixfoldMaterials {
  readonly structure: ThreeNamespace.MeshStandardMaterial
  readonly support: ThreeNamespace.MeshStandardMaterial
  readonly mirror: ThreeNamespace.MeshPhysicalMaterial
  readonly glass: ThreeNamespace.MeshPhysicalMaterial
  readonly light: ThreeNamespace.MeshStandardMaterial
  readonly core: ThreeNamespace.MeshPhysicalMaterial
  readonly blackout: ThreeNamespace.MeshStandardMaterial
}

export interface Cinema2SixfoldLedBar {
  readonly material: ThreeNamespace.MeshStandardMaterial
  readonly cell: number
  readonly layer: number
  readonly side: number
  readonly segment: number
}

export interface Cinema2SixfoldRig {
  readonly root: ThreeNamespace.Group
  readonly frames: readonly ThreeNamespace.Group[]
  readonly frameLights: readonly ThreeNamespace.Group[]
  readonly ledBars: readonly Cinema2SixfoldLedBar[]
  readonly satelliteCells: readonly ThreeNamespace.Group[]
  readonly facets: readonly ThreeNamespace.Group[]
  readonly facetPanels: readonly ThreeNamespace.Mesh[]
  readonly iris: ThreeNamespace.Group
  readonly irisBlades: readonly ThreeNamespace.Group[]
  readonly mechanisms: readonly ThreeNamespace.Object3D[]
  readonly locks: readonly ThreeNamespace.Group[]
  readonly illumination: ThreeNamespace.Group
  readonly rearBaffle: ThreeNamespace.Mesh
  readonly detailMedium: ThreeNamespace.Group
  readonly detailHigh: ThreeNamespace.Group
  readonly geometries: readonly ThreeNamespace.BufferGeometry[]
}

const FRAME_COUNT = 5
const SECTOR_COUNT = 6
const TAU = Math.PI * 2
const BASE_RADIUS = 3.42
const LAYER_STEP = 1.18
const SHELL_RADIUS = 3.78
const LED_RADIUS = 2.65
const SATELLITE_DISTANCE = SHELL_RADIUS * Math.sqrt(3)
export const CINEMA2_SIXFOLD_FRAME_SCALE_STEP = 0.095

/** Builds the static production chamber. Motion is applied later through semantic groups, never by rebuilding geometry. */
export function createCinema2SixfoldGeometry(
  THREE: typeof ThreeNamespace,
  materials: Readonly<Cinema2SixfoldMaterials>,
): Cinema2SixfoldRig {
  const geometries: ThreeNamespace.BufferGeometry[] = []
  const root = namedGroup(THREE, 'sixfold-recursive-mirror-chamber')
  const chamber = namedGroup(THREE, 'recursive-chamber-layers')
  const illumination = namedGroup(THREE, 'illumination-network')
  const detailMedium = namedGroup(THREE, 'medium-detail')
  const detailHigh = namedGroup(THREE, 'high-detail')
  root.add(chamber, illumination, detailMedium, detailHigh)

  const frameGeometry = hexRingGeometry(THREE, BASE_RADIUS, 2.94, 0.25, 0.055)
  const innerRailGeometry = hexRingGeometry(THREE, 2.88, 2.72, 0.16, 0.035)
  const ledSegmentGeometry = new THREE.BoxGeometry(0.72, 0.085, 0.075)
  const ledHousingGeometry = new THREE.BoxGeometry(0.82, 0.14, 0.055)
  const jointGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.32, 12, 1, false)
  const boltGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8, 1, false)
  const braceGeometry = new THREE.CylinderGeometry(0.07, 0.07, 1, 8, 1, false)
  const thinBraceGeometry = new THREE.CylinderGeometry(0.032, 0.032, 1, 6, 1, false)
  geometries.push(frameGeometry, innerRailGeometry, ledSegmentGeometry, ledHousingGeometry, jointGeometry, boltGeometry, braceGeometry, thinBraceGeometry)

  const frames: ThreeNamespace.Group[] = []
  const frameLights: ThreeNamespace.Group[] = []
  const ledBars: Cinema2SixfoldLedBar[] = []
  const layerRadii: number[] = []
  for (let layer = 0; layer < FRAME_COUNT; layer += 1) {
    const scale = 1 - layer * CINEMA2_SIXFOLD_FRAME_SCALE_STEP
    const radius = BASE_RADIUS * scale
    layerRadii.push(radius)
    const frame = namedGroup(THREE, `recursive-frame-${layer + 1}`)
    frame.position.z = -layer * LAYER_STEP
    frame.scale.set(scale, scale, 1)

    const outer = mesh(THREE, frameGeometry, materials.structure, `frame-${layer + 1}-outer`, true, true)
    const inner = mesh(THREE, innerRailGeometry, materials.support, `frame-${layer + 1}-inner`, true, true)
    inner.position.z = 0.03
    frame.add(outer, inner)

    const layerLight = namedGroup(THREE, `frame-${layer + 1}-light`)
    addSegmentedLedLoop(THREE, layerLight, ledBars, {
      cell: 0,
      layer,
      radius: LED_RADIUS,
      z: 0.105,
      name: `frame-${layer + 1}`,
      ledGeometry: ledSegmentGeometry,
      housingGeometry: ledHousingGeometry,
      materials,
    })
    frame.add(layerLight)
    frameLights.push(layerLight)

    for (let sector = 0; sector < SECTOR_COUNT; sector += 1) {
      const angle = sector * TAU / SECTOR_COUNT + Math.PI / 6
      const joint = mesh(THREE, jointGeometry, materials.support, `frame-${layer + 1}-joint-${sector + 1}`, true, true)
      joint.rotation.x = Math.PI / 2
      joint.position.set(Math.cos(angle) * BASE_RADIUS, Math.sin(angle) * BASE_RADIUS, 0)
      frame.add(joint)

      const bolt = mesh(THREE, boltGeometry, materials.support, `frame-${layer + 1}-bolt-${sector + 1}`, false, false)
      bolt.rotation.x = Math.PI / 2
      bolt.position.set(Math.cos(angle) * BASE_RADIUS, Math.sin(angle) * BASE_RADIUS, 0.19)
      frame.add(bolt)
    }
    chamber.add(frame)
    frames.push(frame)
  }

  // Longitudinal trusses make the five frames one chamber rather than five floating outlines.
  for (let layer = 0; layer < FRAME_COUNT - 1; layer += 1) {
    for (let sector = 0; sector < SECTOR_COUNT; sector += 1) {
      const angle = sector * TAU / SECTOR_COUNT + Math.PI / 6
      const a = new THREE.Vector3(Math.cos(angle) * layerRadii[layer]!, Math.sin(angle) * layerRadii[layer]!, -layer * LAYER_STEP)
      const b = new THREE.Vector3(Math.cos(angle) * layerRadii[layer + 1]!, Math.sin(angle) * layerRadii[layer + 1]!, -(layer + 1) * LAYER_STEP)
      detailMedium.add(orientedCylinder(THREE, braceGeometry, materials.support, a, b, `depth-truss-${layer + 1}-${sector + 1}`, true))
      const tangent = angle + Math.PI / 2
      const offset = 0.16
      const a2 = a.clone().add(new THREE.Vector3(Math.cos(tangent) * offset, Math.sin(tangent) * offset, 0))
      const b2 = b.clone().add(new THREE.Vector3(-Math.cos(tangent) * offset, -Math.sin(tangent) * offset, 0))
      detailHigh.add(orientedCylinder(THREE, thinBraceGeometry, materials.structure, a2, b2, `cross-brace-${layer + 1}-${sector + 1}`, true))
    }
  }

  const facets = createFacetSystems(THREE, root, geometries, materials)
  const iris = createIris(THREE, root, illumination, detailHigh, geometries, materials)
  const locks = createLockingSystems(THREE, root, geometries, materials)
  const rearBaffle = createOuterShell(THREE, chamber, geometries, materials)
  const satelliteCells = createSatelliteHexField(THREE, root, geometries, ledBars, materials, ledSegmentGeometry, ledHousingGeometry)

  return Object.freeze({
    root,
    frames: Object.freeze(frames),
    frameLights: Object.freeze(frameLights),
    ledBars: Object.freeze(ledBars),
    satelliteCells: Object.freeze(satelliteCells),
    facets: Object.freeze(facets.groups),
    facetPanels: Object.freeze(facets.panels),
    iris: iris.group,
    irisBlades: Object.freeze(iris.blades),
    mechanisms: Object.freeze(iris.mechanisms),
    locks: Object.freeze(locks),
    illumination,
    rearBaffle,
    detailMedium,
    detailHigh,
    geometries: Object.freeze(geometries),
  })
}

interface SegmentedLedLoopOptions {
  readonly cell: number
  readonly layer: number
  readonly radius: number
  readonly z: number
  readonly name: string
  readonly ledGeometry: ThreeNamespace.BufferGeometry
  readonly housingGeometry: ThreeNamespace.BufferGeometry
  readonly materials: Readonly<Cinema2SixfoldMaterials>
}

function addSegmentedLedLoop(
  THREE: typeof ThreeNamespace,
  parent: ThreeNamespace.Group,
  ledBars: Cinema2SixfoldLedBar[],
  options: Readonly<SegmentedLedLoopOptions>,
): void {
  for (let side = 0; side < SECTOR_COUNT; side += 1) {
    const startAngle = Math.PI / 6 + side * TAU / SECTOR_COUNT
    const endAngle = Math.PI / 6 + (side + 1) * TAU / SECTOR_COUNT
    const startX = Math.cos(startAngle) * options.radius
    const startY = Math.sin(startAngle) * options.radius
    const endX = Math.cos(endAngle) * options.radius
    const endY = Math.sin(endAngle) * options.radius
    const rotation = Math.atan2(endY - startY, endX - startX)
    for (let segment = 0; segment < 3; segment += 1) {
      const t = (segment + 0.5) / 3
      const x = startX + (endX - startX) * t
      const y = startY + (endY - startY) * t
      const housing = mesh(THREE, options.housingGeometry, options.materials.support, `${options.name}-led-housing-${side + 1}-${segment + 1}`, true, true)
      housing.position.set(x, y, options.z - 0.025)
      housing.rotation.z = rotation
      parent.add(housing)

      const ledMaterial = options.materials.light.clone()
      const led = mesh(THREE, options.ledGeometry, ledMaterial, `${options.name}-led-${side + 1}-${segment + 1}`, false, false)
      led.position.set(x, y, options.z + 0.035)
      led.rotation.z = rotation
      parent.add(led)
      ledBars.push(Object.freeze({ material: ledMaterial, cell: options.cell, layer: options.layer, side, segment }))
    }
  }
}

function createSatelliteHexField(
  THREE: typeof ThreeNamespace,
  root: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  ledBars: Cinema2SixfoldLedBar[],
  materials: Readonly<Cinema2SixfoldMaterials>,
  ledGeometry: ThreeNamespace.BufferGeometry,
  housingGeometry: ThreeNamespace.BufferGeometry,
): ThreeNamespace.Group[] {
  const field = namedGroup(THREE, 'satellite-hexagonal-field')
  root.add(field)
  const shellGeometry = hexRingGeometry(THREE, SHELL_RADIUS, 3.48, 0.32, 0.06)
  const frameGeometry = hexRingGeometry(THREE, BASE_RADIUS, 3.04, 0.24, 0.045)
  const insetGeometry = hexRingGeometry(THREE, 2.98, 2.78, 0.15, 0.032)
  const baffleGeometry = new THREE.CylinderGeometry(3.32, 3.32, 0.18, 6, 1, false)
  const hubGeometry = new THREE.CylinderGeometry(0.46, 0.46, 0.24, 6, 1, false)
  const spokeGeometry = new THREE.BoxGeometry(2.46, 0.095, 0.14)
  const seamGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12, 1, false)
  geometries.push(shellGeometry, frameGeometry, insetGeometry, baffleGeometry, hubGeometry, spokeGeometry, seamGeometry)

  const cells: ThreeNamespace.Group[] = []
  for (let cellIndex = 0; cellIndex < SECTOR_COUNT; cellIndex += 1) {
    const angle = cellIndex * TAU / SECTOR_COUNT
    const cell = namedGroup(THREE, `satellite-hex-${cellIndex + 1}`)
    cell.position.set(Math.cos(angle) * SATELLITE_DISTANCE, Math.sin(angle) * SATELLITE_DISTANCE, -0.38)

    const shell = mesh(THREE, shellGeometry, materials.blackout, `satellite-${cellIndex + 1}-shell`, true, true)
    const frame = mesh(THREE, frameGeometry, materials.structure, `satellite-${cellIndex + 1}-frame`, true, true)
    frame.position.z = 0.07
    const inset = mesh(THREE, insetGeometry, materials.support, `satellite-${cellIndex + 1}-inset`, true, true)
    inset.position.z = 0.15
    const baffle = mesh(THREE, baffleGeometry, materials.blackout, `satellite-${cellIndex + 1}-baffle`, false, true)
    baffle.rotation.x = Math.PI / 2
    baffle.position.z = -1.72
    const hub = mesh(THREE, hubGeometry, materials.structure, `satellite-${cellIndex + 1}-hub`, true, true)
    hub.rotation.x = Math.PI / 2
    hub.position.z = -0.08
    cell.add(shell, frame, inset, baffle, hub)

    for (let side = 0; side < SECTOR_COUNT; side += 1) {
      const spoke = mesh(THREE, spokeGeometry, materials.structure, `satellite-${cellIndex + 1}-spoke-${side + 1}`, true, true)
      const spokeAngle = side * TAU / SECTOR_COUNT
      spoke.position.set(Math.cos(spokeAngle) * 1.58, Math.sin(spokeAngle) * 1.58, -0.12)
      spoke.rotation.z = spokeAngle
      cell.add(spoke)

      const seam = mesh(THREE, seamGeometry, materials.support, `satellite-${cellIndex + 1}-seam-${side + 1}`, true, true)
      const seamAngle = Math.PI / 6 + side * TAU / SECTOR_COUNT
      seam.rotation.x = Math.PI / 2
      seam.position.set(Math.cos(seamAngle) * SHELL_RADIUS, Math.sin(seamAngle) * SHELL_RADIUS, 0.04)
      cell.add(seam)
    }

    const cellLights = namedGroup(THREE, `satellite-${cellIndex + 1}-led-network`)
    addSegmentedLedLoop(THREE, cellLights, ledBars, {
      cell: cellIndex + 1,
      layer: 0,
      radius: LED_RADIUS,
      z: 0.24,
      name: `satellite-${cellIndex + 1}`,
      ledGeometry,
      housingGeometry,
      materials,
    })
    cell.add(cellLights)
    field.add(cell)
    cells.push(cell)
  }
  return cells
}

function createFacetSystems(
  THREE: typeof ThreeNamespace,
  root: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2SixfoldMaterials>,
): { groups: ThreeNamespace.Group[]; panels: ThreeNamespace.Mesh[] } {
  const systems = namedGroup(THREE, 'articulated-mirror-facets')
  root.add(systems)
  const carrierGeometry = bevelledPolygon(THREE, [[0.68, -0.34], [1.66, -0.47], [1.95, 0], [1.66, 0.47], [0.68, 0.34]], 0.16, 0.045)
  const panelGeometry = bevelledPolygon(THREE, [[0.79, -0.25], [1.57, -0.34], [1.78, 0], [1.57, 0.34], [0.79, 0.25]], 0.09, 0.025)
  const hingeGeometry = new THREE.CylinderGeometry(0.115, 0.115, 0.72, 12)
  const pistonGeometry = new THREE.CylinderGeometry(0.045, 0.06, 1, 8)
  geometries.push(carrierGeometry, panelGeometry, hingeGeometry, pistonGeometry)
  const groups: ThreeNamespace.Group[] = []
  const panels: ThreeNamespace.Mesh[] = []
  for (let sector = 0; sector < SECTOR_COUNT; sector += 1) {
    const angle = sector * TAU / SECTOR_COUNT
    const group = namedGroup(THREE, `mirror-facet-system-${sector + 1}`)
    group.rotation.z = angle
    group.position.z = -0.62
    const carrier = mesh(THREE, carrierGeometry, materials.support, `facet-carrier-${sector + 1}`, true, true)
    const panel = mesh(THREE, panelGeometry, materials.mirror, `mirror-panel-${sector + 1}`, true, true)
    panel.position.z = 0.13
    panel.rotation.y = sector % 2 === 0 ? -0.055 : 0.055
    const hinge = mesh(THREE, hingeGeometry, materials.support, `facet-hinge-${sector + 1}`, true, true)
    hinge.position.set(0.72, 0, 0.02)
    hinge.rotation.x = Math.PI / 2
    const piston = mesh(THREE, pistonGeometry, materials.structure, `facet-actuator-${sector + 1}`, true, true)
    piston.position.set(1.18, -0.43, -0.08)
    piston.rotation.z = Math.PI / 2 + 0.32
    group.add(carrier, panel, hinge, piston)
    systems.add(group)
    groups.push(group)
    panels.push(panel)
  }
  return { groups, panels }
}

function createIris(
  THREE: typeof ThreeNamespace,
  root: ThreeNamespace.Group,
  illumination: ThreeNamespace.Group,
  detailHigh: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2SixfoldMaterials>,
): { group: ThreeNamespace.Group; blades: ThreeNamespace.Group[]; mechanisms: ThreeNamespace.Object3D[] } {
  const group = namedGroup(THREE, 'central-iris')
  group.position.z = -4.82
  root.add(group)
  const bladeGeometry = bevelledPolygon(THREE, [[0.36, -0.12], [1.15, -0.29], [1.52, -0.02], [1.17, 0.31], [0.49, 0.25]], 0.12, 0.025)
  const bearingGeometry = hexRingGeometry(THREE, 1.92, 1.68, 0.24, 0.045)
  const innerBearingGeometry = hexRingGeometry(THREE, 1.62, 1.43, 0.18, 0.035)
  const coreGeometry = new THREE.CylinderGeometry(0.46, 0.46, 0.28, 48, 1, false)
  const apertureGeometry = new THREE.RingGeometry(0.24, 0.43, 48, 2)
  const apertureBackGeometry = new THREE.CircleGeometry(0.235, 48)
  const gearGeometry = new THREE.BoxGeometry(0.2, 0.09, 0.17)
  geometries.push(bladeGeometry, bearingGeometry, innerBearingGeometry, coreGeometry, apertureGeometry, apertureBackGeometry, gearGeometry)

  const outerBearing = mesh(THREE, bearingGeometry, materials.structure, 'iris-outer-bearing', true, true)
  const innerBearing = mesh(THREE, innerBearingGeometry, materials.core, 'iris-inner-bearing', true, true)
  innerBearing.position.z = 0.11
  group.add(outerBearing, innerBearing)

  const mechanisms: ThreeNamespace.Object3D[] = [outerBearing, innerBearing]
  const blades: ThreeNamespace.Group[] = []
  for (let index = 0; index < 12; index += 1) {
    const bladeRoot = namedGroup(THREE, `iris-blade-${index + 1}`)
    bladeRoot.rotation.z = index * TAU / 12 + 0.15
    bladeRoot.position.z = 0.16 + (index % 2) * 0.035
    bladeRoot.add(mesh(THREE, bladeGeometry, index % 2 ? materials.support : materials.structure, `iris-blade-face-${index + 1}`, true, true))
    group.add(bladeRoot)
    blades.push(bladeRoot)

    const tooth = mesh(THREE, gearGeometry, materials.support, `iris-gear-tooth-${index + 1}`, true, true)
    const angle = index * TAU / 12
    tooth.position.set(Math.cos(angle) * 2.02, Math.sin(angle) * 2.02, 0)
    tooth.rotation.z = angle
    detailHigh.add(tooth)
  }

  const lens = mesh(THREE, coreGeometry, materials.glass, 'iris-optical-lens', false, true)
  lens.rotation.x = Math.PI / 2
  lens.position.z = -0.08
  const apertureBack = mesh(THREE, apertureBackGeometry, materials.blackout, 'iris-aperture-black', false, false)
  apertureBack.position.z = 0.285
  const aperture = mesh(THREE, apertureGeometry, materials.light, 'iris-aperture-light', false, false)
  aperture.position.z = 0.29
  group.add(lens, apertureBack, aperture)

  const apertureLight = aperture.clone()
  apertureLight.name = 'iris-light-source'
  illumination.add(apertureLight)
  apertureLight.position.copy(group.position)
  apertureLight.position.z += 0.31
  return { group, blades, mechanisms }
}

function createLockingSystems(
  THREE: typeof ThreeNamespace,
  root: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2SixfoldMaterials>,
): ThreeNamespace.Group[] {
  const systems = namedGroup(THREE, 'structural-folding-locks')
  root.add(systems)
  const armGeometry = bevelledPolygon(THREE, [[0.7, -0.085], [2.55, -0.085], [2.72, 0], [2.55, 0.085], [0.7, 0.085]], 0.12, 0.025)
  const latchGeometry = new THREE.BoxGeometry(0.34, 0.28, 0.26)
  geometries.push(armGeometry, latchGeometry)
  const locks: ThreeNamespace.Group[] = []
  for (let sector = 0; sector < SECTOR_COUNT; sector += 1) {
    const angle = sector * TAU / SECTOR_COUNT + Math.PI / 6
    const lock = namedGroup(THREE, `folding-lock-${sector + 1}`)
    lock.rotation.z = angle
    lock.position.z = -2.15
    const arm = mesh(THREE, armGeometry, materials.structure, `lock-arm-${sector + 1}`, true, true)
    const latch = mesh(THREE, latchGeometry, materials.support, `lock-latch-${sector + 1}`, true, true)
    latch.position.set(2.55, 0, 0.04)
    latch.rotation.z = Math.PI / 4
    lock.add(arm, latch)
    systems.add(lock)
    locks.push(lock)
  }
  return locks
}

function createOuterShell(
  THREE: typeof ThreeNamespace,
  chamber: ThreeNamespace.Group,
  geometries: ThreeNamespace.BufferGeometry[],
  materials: Readonly<Cinema2SixfoldMaterials>,
): ThreeNamespace.Mesh {
  const rearGeometry = new THREE.CylinderGeometry(3.15, 3.15, 0.22, 6, 1, false)
  const shellGeometry = hexRingGeometry(THREE, 3.78, 3.48, 0.38, 0.06)
  geometries.push(rearGeometry, shellGeometry)
  const shell = mesh(THREE, shellGeometry, materials.blackout, 'outer-chamber-shell', true, true)
  shell.position.z = -0.12
  chamber.add(shell)
  const rear = mesh(THREE, rearGeometry, materials.blackout, 'rear-optical-baffle', false, true)
  rear.rotation.x = Math.PI / 2
  rear.position.z = -6.05
  chamber.add(rear)
  return rear
}

function hexRingGeometry(
  THREE: typeof ThreeNamespace,
  outerRadius: number,
  innerRadius: number,
  depth: number,
  bevelSize: number,
): ThreeNamespace.ExtrudeGeometry {
  const shape = new THREE.Shape()
  polygonPath(shape, outerRadius, 6, Math.PI / 6, false)
  const hole = new THREE.Path()
  polygonPath(hole, innerRadius, 6, Math.PI / 6, true)
  shape.holes.push(hole)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize, bevelThickness: bevelSize, curveSegments: 1 })
  geometry.translate(0, 0, -depth / 2)
  geometry.computeVertexNormals()
  return geometry
}

function polygonPath(
  path: ThreeNamespace.Path | ThreeNamespace.Shape,
  radius: number,
  sides: number,
  rotation: number,
  reverse: boolean,
): void {
  for (let step = 0; step <= sides; step += 1) {
    const index = reverse ? sides - step : step
    const angle = rotation + index * TAU / sides
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (step === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
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

function orientedCylinder(
  THREE: typeof ThreeNamespace,
  geometry: ThreeNamespace.BufferGeometry,
  material: ThreeNamespace.Material,
  from: ThreeNamespace.Vector3,
  to: ThreeNamespace.Vector3,
  name: string,
  shadow: boolean,
): ThreeNamespace.Mesh {
  const result = mesh(THREE, geometry, material, name, shadow, shadow)
  const midpoint = from.clone().add(to).multiplyScalar(0.5)
  const direction = to.clone().sub(from)
  result.position.copy(midpoint)
  result.scale.y = direction.length()
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
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
