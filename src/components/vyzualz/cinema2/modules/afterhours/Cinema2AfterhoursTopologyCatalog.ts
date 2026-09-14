import {
  CINEMA2_AFTERHOURS_TOPOLOGY_IDS,
  type Cinema2AfterhoursTopologyDefinition,
  type Cinema2AfterhoursTopologyId,
} from './Cinema2AfterhoursDomain'

function topology(definition: Cinema2AfterhoursTopologyDefinition): Cinema2AfterhoursTopologyDefinition {
  return Object.freeze({
    ...definition,
    allocationCycle: Object.freeze([...definition.allocationCycle]),
    scanner: Object.freeze({ ...definition.scanner }),
  })
}

export const CINEMA2_AFTERHOURS_TOPOLOGY_CATALOG: readonly Cinema2AfterhoursTopologyDefinition[] = Object.freeze([
  topology({
    id: 'wideFan', label: 'Wide Fan', role: 'fan', allocationCycle: ['bottom', 'overhead', 'side'],
    maxActiveBeams: 16, protectsCenterAperture: true, scanner: { yawAuthorityDeg: 34, pitchAuthorityDeg: 18 },
  }),
  topology({
    id: 'splitWings', label: 'Split Wings', role: 'wing', allocationCycle: ['side', 'bottom', 'side', 'overhead'],
    maxActiveBeams: 16, protectsCenterAperture: true, scanner: { yawAuthorityDeg: 28, pitchAuthorityDeg: 20 },
  }),
  topology({
    id: 'crossCanopy', label: 'Cross Canopy', role: 'cross', allocationCycle: ['side', 'overhead', 'bottom'],
    maxActiveBeams: 16, protectsCenterAperture: false, scanner: { yawAuthorityDeg: 24, pitchAuthorityDeg: 24 },
  }),
  topology({
    id: 'diamondStar', label: 'Diamond / Star', role: 'diamond', allocationCycle: ['bottom', 'overhead', 'side'],
    maxActiveBeams: 16, protectsCenterAperture: true, scanner: { yawAuthorityDeg: 20, pitchAuthorityDeg: 22 },
  }),
  topology({
    id: 'chevronRoof', label: 'Chevron / Roof', role: 'roof', allocationCycle: ['overhead', 'side', 'bottom'],
    maxActiveBeams: 16, protectsCenterAperture: true, scanner: { yawAuthorityDeg: 22, pitchAuthorityDeg: 18 },
  }),
  topology({
    id: 'radialCrown', label: 'Radial Crown', role: 'crown', allocationCycle: ['overhead', 'bottom', 'side'],
    maxActiveBeams: 16, protectsCenterAperture: true, scanner: { yawAuthorityDeg: 32, pitchAuthorityDeg: 24 },
  }),
  topology({
    id: 'sparseArchitecture', label: 'Sparse Architecture', role: 'architecture', allocationCycle: ['side', 'bottom', 'overhead'],
    maxActiveBeams: 4, protectsCenterAperture: true, scanner: { yawAuthorityDeg: 12, pitchAuthorityDeg: 10 },
  }),
  topology({
    id: 'fullRig', label: 'Full Rig', role: 'fullRig', allocationCycle: ['bottom', 'side', 'overhead', 'side'],
    maxActiveBeams: 16, protectsCenterAperture: true, scanner: { yawAuthorityDeg: 36, pitchAuthorityDeg: 26 },
  }),
])

const TOPOLOGY_BY_ID = new Map(CINEMA2_AFTERHOURS_TOPOLOGY_CATALOG.map(candidate => [candidate.id, candidate]))

export function getCinema2AfterhoursTopologyDefinition(
  id: Cinema2AfterhoursTopologyId,
): Cinema2AfterhoursTopologyDefinition {
  return TOPOLOGY_BY_ID.get(id) ?? TOPOLOGY_BY_ID.get(CINEMA2_AFTERHOURS_TOPOLOGY_IDS[0])!
}
