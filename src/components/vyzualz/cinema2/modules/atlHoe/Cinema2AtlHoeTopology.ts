import atlHoeParts from '../../presets/atlHoeParts.json'

export const CINEMA2_ATL_HOE_ATTRIBUTE_NAMES = Object.freeze({
  role: '_atl_role',
  zone: '_atl_zone',
  route: '_atl_route',
  phase: '_atl_phase',
  level: '_atl_level',
  random: '_atl_random',
})

export const CINEMA2_ATL_HOE_ROLES = Object.freeze([
  'sign', 'windows', 'crown', 'spire', 'streetlight', 'road', 'star', 'lightning', 'foliageAccent', 'atmosphere',
] as const)
export type Cinema2AtlHoeRole = typeof CINEMA2_ATL_HOE_ROLES[number]

export const CINEMA2_ATL_HOE_ZONES = Object.freeze([
  'farLeft', 'left', 'centerLeft', 'center', 'centerRight', 'right', 'farRight',
] as const)
export type Cinema2AtlHoeZone = typeof CINEMA2_ATL_HOE_ZONES[number]

export const CINEMA2_ATL_HOE_LANDMARKS = Object.freeze([
  'waffleSign', 'bankOfAmerica', 'westin', 'truist', 'georgiaPacific', 'interstate', 'sky',
] as const)
export type Cinema2AtlHoeLandmark = typeof CINEMA2_ATL_HOE_LANDMARKS[number]

export const CINEMA2_ATL_HOE_ROUTE_COUNT = 8

export const cinema2AtlHoeRoleCode = (role: Cinema2AtlHoeRole): number => CINEMA2_ATL_HOE_ROLES.indexOf(role)

const entries = <T extends Cinema2AtlHoeRole>(role: T, names: readonly string[]) => names.map(name => [name, role] as const)

/**
 * Authoritative mapping from glTF mesh/material part to semantic lighting role.
 * Spatial zone, route, phase, level and seeded identity live per vertex in the
 * generated asset; this map selects the shader family without relying on part order.
 */
export const CINEMA2_ATL_HOE_SEMANTIC_PART_ROLES: Readonly<Record<string, Cinema2AtlHoeRole>> = Object.freeze(Object.fromEntries([
  ...entries('sign', atlHoeParts.signFaces),
  ...entries('windows', [...atlHoeParts.windows, ...atlHoeParts.windowsCool]),
  ...entries('crown', ['bofaCore', 'bofaGlow', 'beacon', 'spireBoaTip', 'spireWestinRim', 'spireTruistCap']),
  ...entries('spire', ['spireBoa', 'spireWestinMast', 'spireTruistEdge']),
  ...entries('streetlight', [...atlHoeParts.lampOrbs, ...atlHoeParts.lampHalos]),
  ...entries('road', ['roadGlow']),
  ...entries('star', atlHoeParts.stars),
  ...entries('lightning', [...atlHoeParts.bolts, ...atlHoeParts.boltTops]),
  ...entries('foliageAccent', ['foliageFaint', 'foliageLit']),
  ...entries('atmosphere', [...atlHoeParts.skySurfaces, ...atlHoeParts.skyBands]),
]))

export const CINEMA2_ATL_HOE_TOPOLOGY_DIAGNOSTICS = Object.freeze(['off', 'role', 'zone', 'route', 'phase', 'level', 'random'] as const)
export type Cinema2AtlHoeTopologyDiagnostic = typeof CINEMA2_ATL_HOE_TOPOLOGY_DIAGNOSTICS[number]

export const cinema2AtlHoeDiagnosticCode = (diagnostic: Cinema2AtlHoeTopologyDiagnostic): number =>
  CINEMA2_ATL_HOE_TOPOLOGY_DIAGNOSTICS.indexOf(diagnostic)

export function readCinema2AtlHoeTopologyDiagnostic(value: unknown): Cinema2AtlHoeTopologyDiagnostic {
  return CINEMA2_ATL_HOE_TOPOLOGY_DIAGNOSTICS.includes(value as Cinema2AtlHoeTopologyDiagnostic)
    ? value as Cinema2AtlHoeTopologyDiagnostic
    : 'off'
}
