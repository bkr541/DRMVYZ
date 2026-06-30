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

function radialPosition(index: number, count: number, random: () => number): ConstellationVec3 {
  const t = (index + 0.5) / Math.max(1, count)
  const y = 1 - t * 2
  const radius = Math.sqrt(Math.max(0, 1 - y * y))
  const angle = index * GOLDEN_ANGLE + (random() - 0.5) * 0.26
  const shell = 0.5 + random() * 0.5
  return { x: Math.cos(angle) * radius * shell, y: y * shell, z: Math.sin(angle) * radius * shell }
}

function clusteredPosition(index: number, count: number, random: () => number): ConstellationVec3 {
  const clusterCount = Math.max(3, Math.min(6, Math.round(Math.sqrt(count) / 1.8)))
  const cluster = index % clusterCount
  const angle = cluster / clusterCount * Math.PI * 2
  const center = {
    x: Math.cos(angle) * 0.58,
    y: Math.sin(angle * 1.7) * 0.38,
    z: Math.sin(angle) * 0.48,
  }
  const radius = Math.pow(random(), 0.7) * 0.38
  const azimuth = random() * Math.PI * 2
  const elevation = (random() - 0.5) * Math.PI
  return {
    x: center.x + Math.cos(azimuth) * Math.cos(elevation) * radius,
    y: center.y + Math.sin(elevation) * radius,
    z: center.z + Math.sin(azimuth) * Math.cos(elevation) * radius,
  }
}

function helixPosition(index: number, count: number, random: () => number): ConstellationVec3 {
  const t = count <= 1 ? 0 : index / (count - 1)
  const angle = t * Math.PI * 5.5
  const radius = 0.42 + Math.sin(t * Math.PI * 3) * 0.12 + (random() - 0.5) * 0.08
  return {
    x: Math.cos(angle) * radius,
    y: (t - 0.5) * 1.65,
    z: Math.sin(angle) * radius,
  }
}

function layeredPosition(index: number, count: number, random: () => number): ConstellationVec3 {
  const layers = Math.max(3, Math.min(7, Math.round(Math.sqrt(count))))
  const layer = index % layers
  const row = Math.floor(index / layers)
  const rows = Math.ceil(count / layers)
  const angle = (row / Math.max(1, rows)) * Math.PI * 2 + layer * 0.38
  const radius = 0.2 + (layer / Math.max(1, layers - 1)) * 0.78
  return {
    x: Math.cos(angle) * radius + (random() - 0.5) * 0.1,
    y: (layer / Math.max(1, layers - 1) - 0.5) * 1.45,
    z: Math.sin(angle) * radius + (random() - 0.5) * 0.1,
  }
}

function basePosition(style: ReactiveConstellationTopologyStyle, index: number, count: number, random: () => number): ConstellationVec3 {
  switch (style) {
    case 'radial': return radialPosition(index, count, random)
    case 'helix': return helixPosition(index, count, random)
    case 'layered': return layeredPosition(index, count, random)
    default: return clusteredPosition(index, count, random)
  }
}

function buildEdges(positions: readonly ConstellationVec3[], neighborCount: number): ConstellationGraphEdge[] {
  const edgeKeys = new Set<string>()
  const edges: ConstellationGraphEdge[] = []
  const wanted = Math.max(1, Math.min(neighborCount, Math.max(1, positions.length - 1)))

  for (let index = 0; index < positions.length; index += 1) {
    const nearest = positions
      .map((position, other) => ({ other, distanceSquared: index === other ? Number.POSITIVE_INFINITY : distanceSquared3(positions[index], position) }))
      .sort((a, b) => a.distanceSquared - b.distanceSquared)
      .slice(0, wanted)
    for (const candidate of nearest) {
      const a = Math.min(index, candidate.other)
      const b = Math.max(index, candidate.other)
      const key = `${a}:${b}`
      if (edgeKeys.has(key)) continue
      edgeKeys.add(key)
      edges.push({ a, b, distance: Math.sqrt(candidate.distanceSquared) })
    }
  }
  return edges
}

export function buildConstellationGraph(input: BuildConstellationGraphInput): ConstellationGraph {
  const count = Math.max(1, Math.floor(input.nodeCount))
  const random = createSeededRandom(input.seed)
  const gravityScale = 1 - clamp(input.settings.centralGravity, 0, 1) * 0.68
  const positions = Array.from({ length: count }, (_, index) => {
    const base = basePosition(input.settings.topologyStyle, index, count, random)
    return {
      x: base.x * input.settings.networkSpread * gravityScale,
      y: base.y * input.settings.networkSpread * gravityScale,
      z: base.z * input.settings.depthSpread * gravityScale,
    }
  })
  const edges = buildEdges(positions, input.settings.neighborCount)
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
