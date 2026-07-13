import type {
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
  LaserDmxShowDirectorPerformanceSceneVariation,
  LaserDmxShowDirectorFixtureRuntimeOverrides,
} from './LaserDmxShowDirectorPerformanceProgram'
import type { LaserDmxShowDirectorBeamTarget } from './ReactTypes'
import {
  cageWall,
  cardinalAperture,
  cathedralWing,
  controlledStarburst,
  corridorPreservingSideFan,
  createCentralDiamondVoid,
  createCentralVerticalCorridor,
  createEllipticalAperture,
  crossfirePair,
  localDiamondEdge,
  localParallelFan,
  mirroredChevron,
  narrowSpearBank,
  nestedDiamondLayer,
  type LaserDmxLocalGeometryBounds,
  type LaserDmxLocalGeometryPoint,
  type LaserDmxNegativeSpaceZone,
} from './LaserDmxShowDirectorLocalGeometry'

export interface LaserDmxShowcaseFixtureGeometrySpec {
  key: string
  groupKey: string
  x: number
  y: number
}

type GeometryPayload = {
  id?: string
  address?: LaserDmxShowDirectorPerformanceAddress
  fixture?: LaserDmxShowDirectorFixtureRuntimeOverrides
}

type GeometryResolverContext = {
  fixture: LaserDmxShowcaseFixtureGeometrySpec
  sceneId: string
  payloadId: string
  family: string
  originalTargets: readonly LaserDmxShowDirectorBeamTarget[]
}

type GeometryResolver = (context: GeometryResolverContext) => LaserDmxShowDirectorBeamTarget[]

export const SHOWCASE_GEOMETRY_BOUNDS: LaserDmxLocalGeometryBounds = Object.freeze({
  minX: 0,
  maxX: 18,
  minY: 0,
  maxY: 11,
})

const SHOWCASE_CENTER: LaserDmxLocalGeometryPoint = Object.freeze({ x: 9, y: 5.5 })

function point(x: number, y: number): LaserDmxLocalGeometryPoint {
  return { x, y }
}

function targetFamily(targets: readonly LaserDmxShowDirectorBeamTarget[]): string {
  const id = targets[0]?.id ?? 'local'
  return id.replace(/-\d+$/, '')
}

function payloadTargets(payload: GeometryPayload): LaserDmxShowDirectorBeamTarget[] {
  if (payload.fixture?.targetPoints?.length) return payload.fixture.targetPoints.map(target => ({ ...target }))
  if (payload.fixture?.targetPosition) {
    return [{
      id: `${payload.id ?? 'payload'}-position`,
      x: payload.fixture.targetPosition.x,
      y: payload.fixture.targetPosition.y,
    }]
  }
  return []
}

function fixtureMatchesAddress(
  fixture: LaserDmxShowcaseFixtureGeometrySpec,
  address: LaserDmxShowDirectorPerformanceAddress | undefined,
): boolean {
  if (!address) return true
  const checks: boolean[] = []
  if (address.fixtureSemanticKeys?.length) checks.push(address.fixtureSemanticKeys.includes(fixture.key))
  if (address.groupSemanticKeys?.length) checks.push(address.groupSemanticKeys.includes(fixture.groupKey))
  if (address.fixtureKinds?.length) checks.push(address.fixtureKinds.includes('laser'))
  if (address.fixtureIds?.length) checks.push(false)
  if (checks.length === 0) return true
  return address.match === 'all' ? checks.every(Boolean) : checks.some(Boolean)
}

function localizePayload<T extends GeometryPayload>(
  payload: T,
  sceneId: string,
  fixtures: readonly LaserDmxShowcaseFixtureGeometrySpec[],
  resolver: GeometryResolver,
): T {
  const originalTargets = payloadTargets(payload)
  if (!payload.fixture || originalTargets.length === 0) return payload
  const addressedFixtures = fixtures.filter(fixture => fixtureMatchesAddress(fixture, payload.address))
  if (addressedFixtures.length === 0) return payload
  const payloadId = payload.id ?? sceneId
  const family = targetFamily(originalTargets)
  const targetPointsByFixtureSemanticKey = Object.fromEntries(addressedFixtures.flatMap(fixture => {
    const targets = resolver({ fixture, sceneId, payloadId, family, originalTargets })
    return targets.length ? [[fixture.key, targets] as const] : []
  }))
  if (Object.keys(targetPointsByFixtureSemanticKey).length === 0) return payload
  const fixture: LaserDmxShowDirectorFixtureRuntimeOverrides = {
    ...payload.fixture,
    targetPoints: undefined,
    targetPosition: undefined,
    targetPointsByFixtureSemanticKey,
  }
  return { ...payload, fixture }
}

function localizeMutationArray<T extends GeometryPayload>(
  mutations: readonly T[] | undefined,
  sceneId: string,
  fixtures: readonly LaserDmxShowcaseFixtureGeometrySpec[],
  resolver: GeometryResolver,
): T[] | undefined {
  return mutations?.map(mutation => localizePayload(mutation, sceneId, fixtures, resolver))
}

function localizeScene(
  scene: LaserDmxShowDirectorPerformanceScene,
  fixtures: readonly LaserDmxShowcaseFixtureGeometrySpec[],
  resolver: GeometryResolver,
): LaserDmxShowDirectorPerformanceScene {
  return {
    ...localizePayload(scene, scene.id, fixtures, resolver),
    variations: localizeMutationArray<LaserDmxShowDirectorPerformanceSceneVariation>(scene.variations, scene.id, fixtures, resolver),
    beatMutations: localizeMutationArray(scene.beatMutations, scene.id, fixtures, resolver),
    kickMutations: localizeMutationArray(scene.kickMutations, scene.id, fixtures, resolver),
    snareMutations: localizeMutationArray(scene.snareMutations, scene.id, fixtures, resolver),
    transientMutations: localizeMutationArray(scene.transientMutations, scene.id, fixtures, resolver),
    barMutations: localizeMutationArray(scene.barMutations, scene.id, fixtures, resolver),
    barProgression: localizeMutationArray(scene.barProgression, scene.id, fixtures, resolver),
    fourBarVariations: localizeMutationArray(scene.fourBarVariations, scene.id, fixtures, resolver),
    eightBarRecruitment: localizeMutationArray(scene.eightBarRecruitment, scene.id, fixtures, resolver),
    sixteenBarEvolution: localizeMutationArray(scene.sixteenBarEvolution, scene.id, fixtures, resolver),
    sectionEntryMutations: localizeMutationArray<LaserDmxShowDirectorPerformanceMutationBase>(scene.sectionEntryMutations, scene.id, fixtures, resolver),
    sectionBodyMutations: localizeMutationArray<LaserDmxShowDirectorPerformanceMutationBase>(scene.sectionBodyMutations, scene.id, fixtures, resolver),
    sectionExitMutations: localizeMutationArray<LaserDmxShowDirectorPerformanceMutationBase>(scene.sectionExitMutations, scene.id, fixtures, resolver),
  }
}

function localizeProgram(
  program: LaserDmxShowDirectorPerformanceProgram,
  fixtures: readonly LaserDmxShowcaseFixtureGeometrySpec[],
  resolver: GeometryResolver,
  authoringVersion: string,
  notes: readonly string[],
): LaserDmxShowDirectorPerformanceProgram {
  return {
    ...program,
    diagnostics: {
      ...program.diagnostics,
      authoringVersion,
      notes: [...(program.diagnostics?.notes ?? []), ...notes],
    },
    scenes: program.scenes.map(scene => localizeScene(scene, fixtures, resolver)),
  }
}

function rayCount(originalTargets: readonly LaserDmxShowDirectorBeamTarget[], minimum = 3): number {
  return Math.max(minimum, Math.min(12, originalTargets.length))
}

function averageTarget(targets: readonly LaserDmxShowDirectorBeamTarget[]): LaserDmxLocalGeometryPoint {
  const sum = targets.reduce((accumulator, target) => ({
    x: accumulator.x + target.x,
    y: accumulator.y + target.y,
  }), { x: 0, y: 0 })
  return targets.length > 0
    ? { x: sum.x / targets.length, y: sum.y / targets.length }
    : SHOWCASE_CENTER
}

function localId(context: GeometryResolverContext, role: string): string {
  return `${context.sceneId}-${context.payloadId}-${context.fixture.key}-${role}`
}

function prismGeometry(context: GeometryResolverContext): LaserDmxShowDirectorBeamTarget[] {
  const { fixture, family, originalTargets } = context
  const origin = point(fixture.x, fixture.y)
  const left = fixture.x < SHOWCASE_CENTER.x
  const centerVoid = createCentralDiamondVoid('prism-central-diamond-void', SHOWCASE_GEOMETRY_BOUNDS, 1.25, 1.05)
  const base = {
    idPrefix: localId(context, fixture.groupKey),
    semanticRole: fixture.groupKey,
    origin,
    bounds: SHOWCASE_GEOMETRY_BOUNDS,
    localTargetCenter: SHOWCASE_CENTER,
    rayCount: rayCount(originalTargets),
    fanSpreadDegrees: 52,
    exclusionZones: [centerVoid] as readonly LaserDmxNegativeSpaceZone[],
    negativeSpacePolicy: 'redirect' as const,
  }

  if (fixture.groupKey === 'prism-upper-inner') {
    const targetCenter = point(left ? 13.2 : 4.8, 9.1)
    if (context.sceneId.includes('drop-2') && !family.includes('spears')) {
      return nestedDiamondLayer({
        ...base,
        semanticRole: 'drop-two-inner-diamond-layer',
        localTargetCenter: targetCenter,
        rayCount: Math.min(6, rayCount(originalTargets, 6)),
      }, 2)
    }
    return crossfirePair({
      ...base,
      semanticRole: 'upper-inner-x',
      localTargetCenter: targetCenter,
      fanSpreadDegrees: family.includes('spears') ? 8 : 20,
      targetDistance: Math.hypot(targetCenter.x - origin.x, targetCenter.y - origin.y),
      allowZoneCrossing: true,
    })
  }
  if (fixture.groupKey === 'prism-center-accent') {
    return controlledStarburst({
      ...base,
      semanticRole: 'center-impact-pair',
      localTargetCenter: point(9, family.includes('spears') ? 2.4 : 4.1),
      rayCount: Math.min(4, rayCount(originalTargets, 2)),
      fanSpreadDegrees: family.includes('spears') ? 12 : 48,
      allowZoneCrossing: true,
    })
  }
  if (fixture.groupKey === 'prism-middle-side') {
    return nestedDiamondLayer({
      ...base,
      semanticRole: 'middle-diamond-layer',
      localTargetCenter: SHOWCASE_CENTER,
      rayCount: Math.min(6, rayCount(originalTargets)),
    }, family.includes('diamond') ? 2 : 1)
  }
  if (fixture.groupKey === 'prism-lower-inner' || fixture.groupKey === 'prism-lower-outer') {
    if (family.includes('diamond')) {
      return localDiamondEdge({
        ...base,
        semanticRole: 'lower-diamond-edge',
        localTargetCenter: SHOWCASE_CENTER,
      }, fixture.groupKey === 'prism-lower-outer' ? 5.8 : 4.2, fixture.groupKey === 'prism-lower-outer' ? 4 : 3)
    }
    return cathedralWing({
      ...base,
      semanticRole: 'lower-triangular-wing',
      orientation: 'lower',
      localTargetCenter: point(left ? 5.2 : 12.8, 4.8),
      fanSpreadDegrees: family.includes('spears') ? 10 : 46,
    })
  }
  if (family.includes('diamond')) {
    return localDiamondEdge({
      ...base,
      semanticRole: 'upper-outer-diamond-frame',
      localTargetCenter: SHOWCASE_CENTER,
    }, 6.2, 4.5)
  }
  return cathedralWing({
    ...base,
    semanticRole: 'upper-outer-frame',
    orientation: 'upper',
    localTargetCenter: point(left ? 5.1 : 12.9, 6.2),
    fanSpreadDegrees: family.includes('spears') ? 10 : 52,
  })
}

function cardinalBank(fixture: LaserDmxShowcaseFixtureGeometrySpec): 'top' | 'bottom' | 'left' | 'right' | 'upperLeft' | 'upperRight' | 'lowerLeft' | 'lowerRight' {
  if (fixture.groupKey === 'cardinal-top') return 'top'
  if (fixture.groupKey === 'cardinal-bottom') return 'bottom'
  if (fixture.groupKey === 'cardinal-left') return 'left'
  if (fixture.groupKey === 'cardinal-right') return 'right'
  if (fixture.groupKey === 'cardinal-upper-left') return 'upperLeft'
  if (fixture.groupKey === 'cardinal-upper-right') return 'upperRight'
  if (fixture.groupKey === 'cardinal-lower-left') return 'lowerLeft'
  return 'lowerRight'
}

function cardinalOutwardCenter(fixture: LaserDmxShowcaseFixtureGeometrySpec): LaserDmxLocalGeometryPoint {
  const paired = fixture.key.includes('paired')
  switch (cardinalBank(fixture)) {
    case 'top': return point(paired ? 13.4 : 4.6, 4)
    case 'bottom': return point(paired ? 4.6 : 13.4, 7)
    case 'left': return point(6.3, paired ? 8.8 : 2.2)
    case 'right': return point(11.7, paired ? 2.2 : 8.8)
    case 'upperLeft': return point(6.4, 4.2)
    case 'upperRight': return point(11.6, 4.2)
    case 'lowerLeft': return point(6.4, 6.8)
    case 'lowerRight': return point(11.6, 6.8)
  }
}

function cardinalGeometry(context: GeometryResolverContext): LaserDmxShowDirectorBeamTarget[] {
  const { fixture, family, originalTargets } = context
  const origin = point(fixture.x, fixture.y)
  const aperture = createEllipticalAperture('cardinal-four-way-aperture', SHOWCASE_CENTER, 2.35, 1.7)
  const base = {
    idPrefix: localId(context, fixture.groupKey),
    semanticRole: `${fixture.groupKey}-local-bank`,
    origin,
    bounds: SHOWCASE_GEOMETRY_BOUNDS,
    localTargetCenter: SHOWCASE_CENTER,
    rayCount: rayCount(originalTargets),
    fanSpreadDegrees: family.includes('spears') ? 12 : family.includes('outward') ? 62 : 48,
    exclusionZones: [aperture] as readonly LaserDmxNegativeSpaceZone[],
    negativeSpacePolicy: 'redirect' as const,
  }
  if (family.includes('outward')) {
    return localParallelFan({
      ...base,
      semanticRole: `${fixture.groupKey}-outward-fan`,
      localTargetCenter: cardinalOutwardCenter(fixture),
      fanSpreadDegrees: 48,
    })
  }
  if (family.includes('spears')) {
    const bank = cardinalBank(fixture)
    const localCenter = cardinalOutwardCenter(fixture)
    return narrowSpearBank({
      ...base,
      semanticRole: `${fixture.groupKey}-spear-bank`,
      localTargetCenter: localCenter,
      rayCount: Math.min(3, rayCount(originalTargets, 2)),
      fanSpreadDegrees: 10,
    })
  }
  return cardinalAperture({
    ...base,
    semanticRole: family.includes('crossed') ? `${fixture.groupKey}-overlap-sector` : `${fixture.groupKey}-aperture-sector`,
    bank: cardinalBank(fixture),
    apertureCenter: SHOWCASE_CENTER,
    radiusX: family.includes('inward') ? 2.2 : 2.75,
    radiusY: family.includes('inward') ? 1.55 : 2.05,
    fanSpreadDegrees: family.includes('crossed') ? 66 : 48,
  })
}

export function createCyanMirrorCageCorridor(sceneId: string): Extract<LaserDmxNegativeSpaceZone, { kind: 'rect' }> {
  const width = sceneId.includes('breakdown') || sceneId.includes('outro')
    ? 4
    : sceneId.includes('drop')
      ? 2
      : sceneId.includes('build') || sceneId.includes('pre-drop')
        ? 2.4
        : 3.2
  return createCentralVerticalCorridor(`cyan-cage-corridor-${sceneId}`, SHOWCASE_GEOMETRY_BOUNDS, width, 0.35) as Extract<LaserDmxNegativeSpaceZone, { kind: 'rect' }>
}

function cageSideCenter(
  fixture: LaserDmxShowcaseFixtureGeometrySpec,
  corridor: Extract<LaserDmxNegativeSpaceZone, { kind: 'rect' }>,
  y: number,
): LaserDmxLocalGeometryPoint {
  return point(fixture.x < SHOWCASE_CENTER.x ? corridor.minX - 0.45 : corridor.maxX + 0.45, y)
}

function cageGeometry(context: GeometryResolverContext): LaserDmxShowDirectorBeamTarget[] {
  const { fixture, family, originalTargets, payloadId, sceneId } = context
  const origin = point(fixture.x, fixture.y)
  const corridor = createCyanMirrorCageCorridor(sceneId)
  const sideCenter = cageSideCenter(fixture, corridor, averageTarget(originalTargets).y)
  const explicitBridge = fixture.groupKey.startsWith('cage-corner-')
    && (payloadId.includes('corridor-accents') || payloadId.includes('impact') || payloadId.includes('bridge'))
  const base = {
    idPrefix: localId(context, fixture.groupKey),
    semanticRole: fixture.groupKey,
    origin,
    bounds: SHOWCASE_GEOMETRY_BOUNDS,
    localTargetCenter: sideCenter,
    rayCount: rayCount(originalTargets),
    fanSpreadDegrees: 46,
    exclusionZones: [corridor] as readonly LaserDmxNegativeSpaceZone[],
    negativeSpacePolicy: 'redirect' as const,
  }

  if (explicitBridge) {
    return crossfirePair({
      ...base,
      semanticRole: 'accent-crossing-bridge',
      localTargetCenter: point(fixture.x < SHOWCASE_CENTER.x ? 12.4 : 5.6, fixture.y < SHOWCASE_CENTER.y ? 8.8 : 2.2),
      fanSpreadDegrees: 16,
      allowZoneCrossing: true,
    })
  }
  if (fixture.groupKey === 'cage-upper-outer') {
    return cageWall({
      ...base,
      semanticRole: 'upper-outer-cage-wall',
      localTargetCenter: sideCenter,
      rayCount: Math.min(6, rayCount(originalTargets)),
      fanSpreadDegrees: family.includes('wide') ? 58 : 38,
    })
  }
  if (fixture.groupKey === 'cage-upper-inner') {
    return mirroredChevron({
      ...base,
      semanticRole: 'upper-inner-diagonal',
      localTargetCenter: cageSideCenter(fixture, corridor, 6.8),
      fanSpreadDegrees: family.includes('spears') ? 12 : 36,
    })
  }
  if (fixture.groupKey === 'cage-middle-outer' || fixture.groupKey === 'cage-middle-inner') {
    if (family.includes('diamond')) {
      return localDiamondEdge({
        ...base,
        semanticRole: 'middle-arrowhead-diamond-edge',
        localTargetCenter: cageSideCenter(fixture, corridor, 5.5),
      }, fixture.groupKey === 'cage-middle-outer' ? 2.8 : 2.1, fixture.groupKey === 'cage-middle-outer' ? 3.2 : 2.5)
    }
    return corridorPreservingSideFan({
      ...base,
      semanticRole: 'middle-arrowhead',
      localTargetCenter: cageSideCenter(fixture, corridor, 5.5),
      rayCount: Math.min(5, rayCount(originalTargets)),
      fanSpreadDegrees: family.includes('chevrons') ? 34 : 52,
    }, corridor)
  }
  if (fixture.groupKey === 'cage-lower-outer' || fixture.groupKey === 'cage-lower-inner') {
    return cathedralWing({
      ...base,
      semanticRole: 'lower-triangular-support',
      orientation: 'lower',
      localTargetCenter: cageSideCenter(fixture, corridor, 4.4),
      fanSpreadDegrees: family.includes('spears') ? 10 : 40,
    })
  }
  return narrowSpearBank({
    ...base,
    semanticRole: 'corner-accent-spear',
    localTargetCenter: cageSideCenter(fixture, corridor, fixture.y < SHOWCASE_CENTER.y ? 8.2 : 2.8),
    rayCount: Math.min(3, rayCount(originalTargets, 2)),
    fanSpreadDegrees: 12,
  })
}

export function authorPrismCathedralLocalGeometry(
  program: LaserDmxShowDirectorPerformanceProgram,
  fixtures: readonly LaserDmxShowcaseFixtureGeometrySpec[],
): LaserDmxShowDirectorPerformanceProgram {
  return localizeProgram(program, fixtures, prismGeometry, 'showcase-04-local-geometry', [
    'Fixture-keyed local target families replace shared global target polygons.',
    'Upper frame, X, diamond, lower wing, and impact roles retain separate architecture.',
    'A central diamond void is explicitly authored for non-impact families.',
  ])
}

export function authorCardinalFanReactorLocalGeometry(
  program: LaserDmxShowDirectorPerformanceProgram,
  fixtures: readonly LaserDmxShowcaseFixtureGeometrySpec[],
): LaserDmxShowDirectorPerformanceProgram {
  return localizeProgram(program, fixtures, cardinalGeometry, 'showcase-04-local-geometry', [
    'Top, bottom, left, right, and diagonal banks own independent local target sectors.',
    'A four-way elliptical aperture is explicitly protected by ordinary bank geometry.',
    'Dense sections overlap sectors without assigning a shared all-to-all polygon.',
  ])
}

export function authorCyanMirrorCageLocalGeometry(
  program: LaserDmxShowDirectorPerformanceProgram,
  fixtures: readonly LaserDmxShowcaseFixtureGeometrySpec[],
): LaserDmxShowDirectorPerformanceProgram {
  return localizeProgram(program, fixtures, cageGeometry, 'showcase-04-local-geometry', [
    'Mirrored cage walls, diagonals, arrowheads, supports, and accent bridges use separate local families.',
    'A scene-scaled central vertical corridor is an explicit exclusion zone.',
    'Only explicitly marked corner impact or bridge payloads may cross the corridor.',
  ])
}
