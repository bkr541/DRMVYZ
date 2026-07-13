import type {
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorFixtureKind,
  LaserDmxShowDirectorState,
} from './ReactTypes'
import {
  LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS,
  getRigBackedPerformanceShowDefinition,
  type LaserDmxShowDirectorRigBackedPerformanceShowDefinition,
  type LaserDmxShowDirectorSourceRigLayoutId,
} from './LaserDmxShowDirectorRigBackedPerformanceShows'
import { estimateLaserDmxShowDirectorFixtureBeamDemand } from './LaserDmxShowDirectorBeamBudget'

export interface LaserDmxShowDirectorRigFixtureInspection {
  id: string
  semanticKey: string
  label: string
  kind: LaserDmxShowDirectorFixtureKind
  groupId: string | null
  groupSemanticKey: string | null
  availableProperties: string[]
  localTargetCount: number
}

export interface LaserDmxShowDirectorRigInspectionReport {
  sourceRigLayoutId: LaserDmxShowDirectorSourceRigLayoutId
  fixtureCount: number
  fixtureIds: string[]
  fixtureSemanticKeys: string[]
  fixtureKinds: Record<string, number>
  groups: Array<{ id: string; semanticKey: string; label: string }>
  beamCapableFixtureCount: number
  nonBeamFixtureCount: number
  fixtures: LaserDmxShowDirectorRigFixtureInspection[]
  candidateAuthoredBankAssignments: Record<string, string[]>
  unsupportedPropertyWarnings: string[]
}

const AVAILABLE_PROPERTIES: Readonly<Record<LaserDmxShowDirectorFixtureKind, readonly string[]>> = Object.freeze({
  laser: ['enabled', 'brightness', 'color', 'beam.targetMode', 'beam.targets', 'beam.beamSpread', 'beam.focus', 'beamVisualRole'],
  movingHead: ['enabled', 'brightness', 'color', 'rotation', 'beam.targetMode', 'beam.targets', 'beam.beamSpread', 'beam.focus', 'component.movingHeadPanTiltStyle'],
  ledBar: ['enabled', 'brightness', 'color', 'component.ledDirection', 'component.ledCellCount'],
  ledTube: ['enabled', 'brightness', 'color', 'component.ledDirection', 'component.ledCellCount'],
  strobe: ['enabled', 'brightness', 'color', 'component.strobeRate', 'trigger.fadeOutMs'],
  blinder: ['enabled', 'brightness', 'color', 'trigger.fadeOutMs'],
  parWash: ['enabled', 'brightness', 'color', 'beam.beamSpread', 'beam.focus'],
  videoWall: ['enabled', 'brightness', 'component.videoWallBrightness', 'component.videoWallSource'],
  haze: ['enabled', 'brightness', 'color', 'component.hazeIntensity'],
  co2Jet: ['enabled', 'brightness', 'color', 'component.co2BurstDurationMs', 'trigger.fadeOutMs'],
})

function isBeamCapableFixture(fixture: LaserDmxShowDirectorFixture): boolean {
  return fixture.kind === 'laser' || fixture.kind === 'movingHead'
}

export function inspectRigBackedPerformanceShowSource(
  definition: LaserDmxShowDirectorRigBackedPerformanceShowDefinition,
): LaserDmxShowDirectorRigInspectionReport | null {
  const rig = definition.createCanonicalRig()
  if (!rig) return null
  const groupById = new Map(rig.groups.map(group => [group.id, group]))
  const unsupportedPropertyWarnings: string[] = []
  for (const [bankKey, bank] of Object.entries(definition.fixtureBanks)) {
    for (const semanticKey of bank.address.fixtureSemanticKeys ?? []) {
      if (!rig.fixtures.some(fixture => fixture.semanticKey === semanticKey)) {
        unsupportedPropertyWarnings.push(`Bank "${bankKey}" references missing fixture semantic key "${semanticKey}".`)
      }
    }
  }
  for (const fixture of rig.fixtures) {
    if (!AVAILABLE_PROPERTIES[fixture.kind]?.length) unsupportedPropertyWarnings.push(`Fixture "${fixture.semanticKey}" has no authored action capability map.`)
  }
  const fixtureKinds = rig.fixtures.reduce<Record<string, number>>((counts, fixture) => {
    counts[fixture.kind] = (counts[fixture.kind] ?? 0) + 1
    return counts
  }, {})
  return {
    sourceRigLayoutId: definition.sourceRigLayoutId,
    fixtureCount: rig.fixtures.length,
    fixtureIds: rig.fixtures.map(fixture => fixture.id),
    fixtureSemanticKeys: rig.fixtures.map(fixture => fixture.semanticKey ?? fixture.id),
    fixtureKinds,
    groups: rig.groups.map(group => ({ id: group.id, semanticKey: group.semanticKey ?? group.id, label: group.label })),
    beamCapableFixtureCount: rig.fixtures.filter(isBeamCapableFixture).length,
    nonBeamFixtureCount: rig.fixtures.filter(fixture => !isBeamCapableFixture(fixture)).length,
    fixtures: rig.fixtures.map(fixture => {
      const group = fixture.groupId ? groupById.get(fixture.groupId) : null
      return {
        id: fixture.id,
        semanticKey: fixture.semanticKey ?? fixture.id,
        label: fixture.label,
        kind: fixture.kind,
        groupId: fixture.groupId,
        groupSemanticKey: group?.semanticKey ?? null,
        availableProperties: [...AVAILABLE_PROPERTIES[fixture.kind]],
        localTargetCount: fixture.beam.targets?.length ?? 0,
      }
    }),
    candidateAuthoredBankAssignments: Object.fromEntries(Object.entries(definition.fixtureBanks).map(([key, bank]) => [
      key,
      [...(bank.address.fixtureSemanticKeys ?? [])],
    ])),
    unsupportedPropertyWarnings,
  }
}


export interface LaserDmxShowDirectorRigPerformanceEffectCountReport {
  mode: 'ledGrid' | 'movingHead'
  activeFixtureCount: number
  activeLedFixtureCount: number
  activeRowCount: number
  activeColumnCount: number
  simultaneousColorCount: number
  activeMovingHeadCount: number
  activeMovementBankCount: number
  representativeMovementSpread: number
  mirroredPairParticipation: number
  impactDurationBeats: number
  brightnessHierarchy: { minimum: number; average: number; maximum: number }
  legitimateBeamCount: number | null
}

function roundedAverage(values: readonly number[]): number {
  if (!values.length) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100
}

export function createRigBackedPerformanceEffectCountReport(
  showId: string,
  state: LaserDmxShowDirectorState,
): LaserDmxShowDirectorRigPerformanceEffectCountReport | null {
  const definition = getRigBackedPerformanceShowDefinition(showId)
  const metadata = definition?.effectCountReporting
  if (!definition || !metadata) return null
  const countedKinds = new Set(metadata.countedFixtureKinds)
  const active = state.fixtures.filter(fixture => fixture.enabled && fixture.brightness > 0.04 && countedKinds.has(fixture.kind))
  const activeKeys = new Set(active.map(fixture => fixture.semanticKey ?? fixture.id))
  const led = active.filter(fixture => fixture.kind === 'ledBar' || fixture.kind === 'ledTube')
  const heads = active.filter(fixture => fixture.kind === 'movingHead')
  const brightness = active.map(fixture => fixture.brightness)
  const activeMovementBankCount = (metadata.movementBankKeys ?? []).filter(bankKey => {
    const bank = definition.fixtureBanks[bankKey]
    return (bank?.address.fixtureSemanticKeys ?? []).some(key => activeKeys.has(key))
  }).length
  const mirroredPairParticipation = (metadata.mirroredFixturePairs ?? []).reduce((count, [left, right]) => (
    count + (activeKeys.has(left) && activeKeys.has(right) ? 2 : 0)
  ), 0)
  return {
    mode: metadata.mode,
    activeFixtureCount: active.length,
    activeLedFixtureCount: led.length,
    activeRowCount: new Set(led.map(fixture => fixture.y.toFixed(3))).size,
    activeColumnCount: new Set(led.map(fixture => fixture.x.toFixed(3))).size,
    simultaneousColorCount: new Set(active.map(fixture => fixture.color.toLowerCase())).size,
    activeMovingHeadCount: heads.length,
    activeMovementBankCount,
    representativeMovementSpread: roundedAverage(heads.map(fixture => fixture.beam.beamSpread)),
    mirroredPairParticipation,
    impactDurationBeats: metadata.maxImpactDurationBeats,
    brightnessHierarchy: {
      minimum: brightness.length ? Math.round(Math.min(...brightness) * 100) / 100 : 0,
      average: roundedAverage(brightness),
      maximum: brightness.length ? Math.round(Math.max(...brightness) * 100) / 100 : 0,
    },
    legitimateBeamCount: metadata.mode === 'movingHead'
      ? heads.reduce((sum, fixture) => sum + estimateLaserDmxShowDirectorFixtureBeamDemand(fixture), 0)
      : null,
  }
}

export function createAllRigBackedPerformanceSourceInspectionReports(): LaserDmxShowDirectorRigInspectionReport[] {
  return Object.values(LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS)
    .map(inspectRigBackedPerformanceShowSource)
    .filter((report): report is LaserDmxShowDirectorRigInspectionReport => report !== null)
}
