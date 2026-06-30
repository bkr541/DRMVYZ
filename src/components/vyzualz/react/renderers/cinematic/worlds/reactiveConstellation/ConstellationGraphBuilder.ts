import type {
  ReactiveConstellationPolyhedronStyle,
  ReactiveConstellationSettings,
  ReactiveConstellationTopologyStyle,
} from '../../../../CinematicWorldSettings'
import {
  clamp,
  createSeededRandom,
  distanceSquared3,
  hashSeed,
  seededUnit,
  subtract3,
  type ConstellationVec3,
} from './ConstellationMath'

export type ConstellationMeshStyle = Exclude<ReactiveConstellationPolyhedronStyle, 'mixed'>

export interface ConstellationGraphNode {
  id: number
  position: ConstellationVec3
  rotation: ConstellationVec3
  scaleVariation: number
  prominence: number
  paletteMix: number
  meshStyle: ConstellationMeshStyle
}

export interface ConstellationGraphEdge {
  a: number
  b: number
  distance: number
}

export interface ConstellationGraph {
  nodes: ConstellationGraphNode[]
  edges: ConstellationGraphEdge[]
}

export interface BuildConstellationGraphInput {
  seed: number
  nodeCount: number
  settings: ReactiveConstellationSettings
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const MESH_STYLES: readonly ConstellationMeshStyle[] = ['tetrahedron', 'octahedron', 'icosahedron', 'irregularCrystal']

function meshStyleFor(style: ReactiveConstellationPolyhedronStyle, seed: number, index: number): ConstellationMeshStyle {
  if (style !== 'mixed') return style
  return MESH_STYLES[Math.floor(seededUnit(hashSeed(seed, index + 701)) * MESH_STYLES.length) % MESH_STYLES.length]
}

function clusterPositions(count: number, random: () => number): ConstellationVec3[] {
  const clusterCount = Math.max(3, Math.min(6, Math.round(Math.sqrt(count) / 1.8)))
  return Array.from({ length: count }, (_, index) => {
    const cluster = index % clusterCount
    const angle = cluster / clusterCount * Math.PI * 2
    const center = {
      x: Math.cos(angle) * 0.52,
      y: Math.sin(angle * 1.7) * 0.32,
      z: Math.sin(angle) * 0.46,
    }
    const radius = Math.pow(random(), 0.7) * 0.34
    const azimuth = random() * Math.PI * 2
    const elevation = (random() - 0.5) * Math.PI
    return {
      x: center.x + Math.cos(azimuth) * Math.cos(elevation) * radius,
      y: center.y + Math.sin(elevation) * radius,
      z: center.z + Math.sin(azimuth) * Math.cos(elevation) * radius,
    }
  })
}

function chainPositions(count: number, random: () => number): ConstellationVec3[] {
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0.5 : index / (count - 1)
    const angle = t * Math.PI * 4.5
    const radius = 0.24 + Math.sin(t * Math.PI * 3) * 0.08
    return {
      x: (t - 0.5) * 1.7,
      y: Math.sin(angle) * radius + (random() - 0.5) * 0.04,
      z: Math.cos(angle) * radius + (random() - 0.5) * 0.04,
    }
  })
}

function triangulatedPositions(count: number, random: () => number): ConstellationVec3[] {
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 0.5) / Math.max(1, count)
    const y = 1 - t * 2
    const radius = Math.sqrt(Math.max(0, 1 - y * y))
    const angle = index * GOLDEN_ANGLE + (random() - 0.5) * 0.12
    const shell = 0.72 + random() * 0.25
    return { x: Math.cos(angle) * radius * shell, y: y * shell, z: Math.sin(angle) * radius * shell }
  })
}

function starburstPositions(count: number, random: () => number): ConstellationVec3[] {
  const rayCount = Math.max(4, Math.min(12, Math.round(Math.sqrt(count) * 1.35)))
  const positions: ConstellationVec3[] = [{ x: 0, y: 0, z: 0 }]
  for (let index = 1; index < count; index += 1) {
    const ray = (index - 1) % rayCount
    const layer = Math.floor((index - 1) / rayCount) + 1
    const maxLayer = Math.max(1, Math.ceil((count - 1) / rayCount))
    const angle = ray / rayCount * Math.PI * 2 + (random() - 0.5) * 0.08
    const elevation = ((ray % 3) - 1) * 0.34 + (random() - 0.5) * 0.12
    const radius = (layer / maxLayer) * (0.75 + random() * 0.18)
    positions.push({
      x: Math.cos(angle) * Math.cos(elevation) * radius,
      y: Math.sin(elevation) * radius,
      z: Math.sin(angle) * Math.cos(elevation) * radius,
    })
  }
  return positions
}

function branchingPositions(count: number, random: () => number): ConstellationVec3[] {
  const positions: ConstellationVec3[] = [{ x: 0, y: -0.18, z: 0 }]
  const branchFactor = count > 56 ? 3 : 2
  for (let index = 1; index < count; index += 1) {
    const parent = Math.floor((index - 1) / branchFactor)
    const parentPosition = positions[parent]
    const depth = Math.floor(Math.log(index * (branchFactor - 1) + 1) / Math.log(branchFactor))
    const branch = (index - 1) % branchFactor
    const angle = seededUnit(hashSeed(index, 17)) * Math.PI * 2 + branch * Math.PI * 0.7
    const length = Math.max(0.11, 0.32 - depth * 0.024) * (0.85 + random() * 0.3)
    positions.push({
      x: parentPosition.x + Math.cos(angle) * length,
      y: parentPosition.y + 0.16 + random() * 0.1,
      z: parentPosition.z + Math.sin(angle) * length,
    })
  }
  return positions
}

function ringPositions(count: number, random: () => number): ConstellationVec3[] {
  const ringCount = count >= 48 ? 2 : 1
  return Array.from({ length: count }, (_, index) => {
    const ring = index % ringCount
    const slot = Math.floor(index / ringCount)
    const slots = Math.ceil(count / ringCount)
    const angle = slot / Math.max(1, slots) * Math.PI * 2 + ring * 0.18
    const radius = 0.58 + ring * 0.28 + (random() - 0.5) * 0.04
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle * 2 + ring) * 0.11,
      z: Math.sin(angle) * radius,
    }
  })
}

function splitClusterPositions(count: number, random: () => number): ConstellationVec3[] {
  return Array.from({ length: count }, (_, index) => {
    const cluster = index % 2
    const centerX = cluster === 0 ? -0.52 : 0.52
    const radius = Math.pow(random(), 0.65) * 0.4
    const azimuth = random() * Math.PI * 2
    const elevation = (random() - 0.5) * Math.PI
    return {
      x: centerX + Math.cos(azimuth) * Math.cos(elevation) * radius,
      y: Math.sin(elevation) * radius,
      z: Math.sin(azimuth) * Math.cos(elevation) * radius,
    }
  })
}

function makePositions(style: ReactiveConstellationTopologyStyle, count: number, random: () => number): ConstellationVec3[] {
  switch (style) {
    case 'chain': return chainPositions(count, random)
    case 'triangulated': return triangulatedPositions(count, random)
    case 'starburst': return starburstPositions(count, random)
    case 'branching': return branchingPositions(count, random)
    case 'ring': return ringPositions(count, random)
    case 'splitClusters': return splitClusterPositions(count, random)
    default: return clusterPositions(count, random)
  }
}

function addEdge(
  edges: ConstellationGraphEdge[],
  edgeKeys: Set<string>,
  positions: readonly ConstellationVec3[],
  from: number,
  to: number,
): void {
  if (from === to || from < 0 || to < 0 || from >= positions.length || to >= positions.length) return
  const a = Math.min(from, to)
  const b = Math.max(from, to)
  const key = `${a}:${b}`
  if (edgeKeys.has(key)) return
  edgeKeys.add(key)
  edges.push({ a, b, distance: Math.max(0.0001, Math.sqrt(distanceSquared3(positions[a], positions[b]))) })
}

function connectNearest(
  positions: readonly ConstellationVec3[],
  neighborCount: number,
  predicate: (a: number, b: number) => boolean = () => true,
): ConstellationGraphEdge[] {
  const edgeKeys = new Set<string>()
  const edges: ConstellationGraphEdge[] = []
  const wanted = Math.max(1, Math.min(neighborCount, Math.max(1, positions.length - 1)))
  for (let index = 0; index < positions.length; index += 1) {
    const nearest = positions
      .map((position, other) => ({
        other,
        distanceSquared: index === other || !predicate(index, other)
          ? Number.POSITIVE_INFINITY
          : distanceSquared3(positions[index], position),
      }))
      .sort((a, b) => a.distanceSquared - b.distanceSquared)
      .slice(0, wanted)
    for (const candidate of nearest) {
      if (Number.isFinite(candidate.distanceSquared)) addEdge(edges, edgeKeys, positions, index, candidate.other)
    }
  }
  return edges
}

function buildEdges(
  style: ReactiveConstellationTopologyStyle,
  positions: readonly ConstellationVec3[],
  neighborCount: number,
): ConstellationGraphEdge[] {
  const edgeKeys = new Set<string>()
  const edges: ConstellationGraphEdge[] = []
  const wanted = Math.max(1, Math.min(neighborCount, Math.max(1, positions.length - 1)))

  if (style === 'chain') {
    for (let index = 1; index < positions.length; index += 1) {
      for (let step = 1; step <= wanted; step += 1) addEdge(edges, edgeKeys, positions, index, index - step)
    }
    return edges
  }

  if (style === 'starburst') {
    const rayCount = Math.max(4, Math.min(12, Math.round(Math.sqrt(positions.length) * 1.35)))
    for (let index = 1; index < positions.length; index += 1) {
      const previous = index - rayCount
      addEdge(edges, edgeKeys, positions, index, previous > 0 ? previous : 0)
      if (wanted > 1) {
        const layerStart = Math.floor((index - 1) / rayCount) * rayCount + 1
        const offset = (index - layerStart + 1) % rayCount
        addEdge(edges, edgeKeys, positions, index, layerStart + offset)
      }
    }
    return edges
  }

  if (style === 'branching') {
    const branchFactor = positions.length > 56 ? 3 : 2
    for (let index = 1; index < positions.length; index += 1) {
      addEdge(edges, edgeKeys, positions, index, Math.floor((index - 1) / branchFactor))
      if (wanted > 1 && index > 1) addEdge(edges, edgeKeys, positions, index, index - 1)
    }
    return edges
  }

  if (style === 'ring') {
    const ringCount = positions.length >= 48 ? 2 : 1
    for (let index = 0; index < positions.length; index += 1) {
      for (let step = 1; step <= wanted; step += 1) {
        const next = (index + step * ringCount) % positions.length
        addEdge(edges, edgeKeys, positions, index, next)
      }
      if (ringCount > 1) addEdge(edges, edgeKeys, positions, index, index ^ 1)
    }
    return edges
  }

  if (style === 'splitClusters') {
    const within = connectNearest(positions, wanted, (a, b) => a % 2 === b % 2)
    for (const edge of within) addEdge(edges, edgeKeys, positions, edge.a, edge.b)
    let bridgeA = 0
    let bridgeB = 1
    let bridgeDistance = Number.POSITIVE_INFINITY
    for (let a = 0; a < positions.length; a += 2) {
      for (let b = 1; b < positions.length; b += 2) {
        const distance = distanceSquared3(positions[a], positions[b])
        if (distance < bridgeDistance) {
          bridgeDistance = distance
          bridgeA = a
          bridgeB = b
        }
      }
    }
    addEdge(edges, edgeKeys, positions, bridgeA, bridgeB)
    return edges
  }

  return connectNearest(positions, style === 'triangulated' ? Math.max(3, wanted) : wanted)
}

export function buildConstellationGraph(input: BuildConstellationGraphInput): ConstellationGraph {
  const count = Math.max(1, Math.floor(input.nodeCount))
  const random = createSeededRandom(input.seed)
  const rawPositions = makePositions(input.settings.topologyStyle, count, random)
  const positions = rawPositions.map(position => ({
    x: position.x * input.settings.networkSpread,
    y: position.y * input.settings.networkSpread,
    z: position.z * input.settings.depthSpread,
  }))
  const edges = buildEdges(input.settings.topologyStyle, positions, input.settings.neighborCount)
  const neighbors = Array.from({ length: count }, () => [] as number[])
  for (const edge of edges) {
    neighbors[edge.a].push(edge.b)
    neighbors[edge.b].push(edge.a)
  }

  const nodes = positions.map((position, index): ConstellationGraphNode => {
    const connected = neighbors[index]
    const centroid = connected.reduce((sum, neighbor) => ({
      x: sum.x + positions[neighbor].x,
      y: sum.y + positions[neighbor].y,
      z: sum.z + positions[neighbor].z,
    }), { x: 0, y: 0, z: 0 })
    const divisor = Math.max(1, connected.length)
    const direction = subtract3({ x: centroid.x / divisor, y: centroid.y / divisor, z: centroid.z / divisor }, position)
    const yaw = Math.atan2(direction.x, direction.z || 0.0001)
    const pitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z) || 0.0001)
    const roll = seededUnit(hashSeed(input.seed, index + 313)) * Math.PI * 2
    const variation = (seededUnit(hashSeed(input.seed, index + 911)) * 2 - 1) * input.settings.nodeScaleVariation
    return {
      id: index,
      position,
      rotation: { x: pitch, y: yaw, z: roll },
      scaleVariation: Math.max(0.35, 1 + variation * 0.62),
      prominence: clamp(connected.length / 8, 0.08, 1),
      paletteMix: seededUnit(hashSeed(input.seed, index + 1297)),
      meshStyle: meshStyleFor(input.settings.polyhedronStyle, input.seed, index),
    }
  })

  return { nodes, edges }
}
