import {
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorDepthLayer,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorScannerConfig,
  type LaserDmxShowDirectorScannerPatternType,
  type LaserDmxShowDirectorState,
} from './ReactTypes'
import {
  createLaserDmxScannerPattern,
  updateLaserDmxScannerPatternGeometry,
} from './laserDmxScannerAuthoring'
import type {
  LaserDmxShowDirectorMixedFixtureAction,
  LaserDmxShowDirectorPerformanceAddress,
  LaserDmxShowDirectorPerformanceEnergyEnvelopeKey,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
  LaserDmxShowDirectorScannerFixtureAction,
} from './LaserDmxShowDirectorPerformanceProgram'

export const LASER_DMX_PHYSICAL_CONTENT_AUTHORING_VERSION = 'physical-scanner-content-v1'

export type LaserDmxBuiltInFixtureRole =
  | 'heroFan'
  | 'supportingFan'
  | 'aerialScan'
  | 'geometricOutline'
  | 'tunnel'
  | 'corridor'
  | 'accentBeam'
  | 'textureScanner'
  | 'diffractionScanner'
  | 'heldTensionBeam'
  | 'upperAirCanopy'
  | 'frontAirRake'
  | 'movingHeadArchitecture'
  | 'sectionColorBed'
  | 'snareStrobe'
  | 'phraseBlinder'
  | 'pixelRhythm'
  | 'atmosphere'
  | 'co2Impact'
  | 'emissiveVideo'

export interface LaserDmxPhysicalContentAudit {
  showId: string
  fixtureCount: number
  laserFixtureCount: number
  nativeScannerCount: number
  singleApertureScannerCount: number
  explicitOpticalScannerCount: number
  persistentTargetNetworkCount: number
  radialSpokeRiskCount: number
  unblankedDisconnectedPathCount: number
  maximumOpticalCopyCount: number
  minimumPathContinuity: number
  roleCounts: Record<string, number>
}

interface ScannerProfile {
  pattern: LaserDmxShowDirectorScannerPatternType
  scanRatePps: number
  durationBeats: number
  fanWidth: number
  radius: number
  size: number
  depthLayer: LaserDmxShowDirectorDepthLayer
  opticalMode: LaserDmxShowDirectorScannerConfig['optics']['mode']
  opticalCopyCount: number
  role: LaserDmxBuiltInFixtureRole
}

const NON_LASER_ONLY_SHOWS = new Set([
  'led-bar-grid-performance',
  'moving-head-sweep-performance',
  'strobe-blinder-hits-performance',
  'haze-co2-drops-performance',
])

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function semanticText(fixture: LaserDmxShowDirectorFixture): string {
  return `${fixture.semanticKey ?? ''} ${fixture.label}`.toLowerCase()
}

function hasAny(value: string, terms: readonly string[]): boolean {
  return terms.some(term => value.includes(term))
}

export function inferLaserDmxBuiltInFixtureRole(
  showId: string,
  fixture: LaserDmxShowDirectorFixture,
  fixtureIndex = 0,
): LaserDmxBuiltInFixtureRole {
  const semantic = semanticText(fixture)
  switch (fixture.kind) {
    case 'movingHead': return 'movingHeadArchitecture'
    case 'parWash': return 'sectionColorBed'
    case 'strobe': return 'snareStrobe'
    case 'blinder': return 'phraseBlinder'
    case 'ledBar':
    case 'ledTube': return 'pixelRhythm'
    case 'haze': return 'atmosphere'
    case 'co2Jet': return 'co2Impact'
    case 'videoWall': return 'emissiveVideo'
    case 'laser': break
  }

  if (hasAny(semantic, ['diffraction', 'prism', 'spectral', 'pulse matrix'])) return 'diffractionScanner'
  if (hasAny(semantic, ['tunnel', 'depth', 'relay'])) return 'tunnel'
  if (hasAny(semantic, ['corridor', 'mirror cage', 'hourglass'])) return 'corridor'
  if (hasAny(semantic, ['upper', 'canopy', 'crown', 'roof', 'arch'])) return 'upperAirCanopy'
  if (hasAny(semantic, ['lower', 'front', 'audience', 'rake', 'floor'])) return 'frontAirRake'
  if (hasAny(semantic, ['texture', 'tracer', 'fragment', 'shard', 'hat', 'detail'])) return 'textureScanner'
  if (hasAny(semantic, ['accent', 'spear', 'edge', 'strike', 'pin'])) return 'accentBeam'
  if (hasAny(semantic, ['diamond', 'polygon', 'frame', 'lattice', 'origami', 'vector', 'chevron', 'outline'])) return 'geometricOutline'
  if (hasAny(semantic, ['hold', 'slit', 'spine', 'tension'])) return 'heldTensionBeam'
  if (hasAny(semantic, ['hero', 'center', 'core', 'primary', 'apex', 'beacon'])) return 'heroFan'
  if (showId.includes('cardinal') || showId.includes('festival') || showId.includes('club') || showId.includes('dubstep')) {
    return fixtureIndex % 3 === 0 ? 'heroFan' : 'supportingFan'
  }
  return fixtureIndex % 4 === 3 ? 'textureScanner' : 'aerialScan'
}

function basePatternForShow(showId: string, role: LaserDmxBuiltInFixtureRole): LaserDmxShowDirectorScannerPatternType {
  if (role === 'tunnel') return 'tunnel'
  if (role === 'corridor') return 'mirroredCorridor'
  if (role === 'geometricOutline') return 'polygon'
  if (role === 'heldTensionBeam') return 'holdBeam'
  if (role === 'upperAirCanopy') return 'arc'
  if (role === 'frontAirRake' || role === 'heroFan' || role === 'supportingFan') return 'fanSweep'
  if (role === 'textureScanner') return 'wave'
  if (role === 'diffractionScanner') return showId.includes('matrix') ? 'diffractionGrid' : 'diffractionLine'
  if (role === 'accentBeam') return 'lineSweep'
  if (showId.includes('cyan-mirror') || showId.includes('hourglass')) return 'mirroredCorridor'
  if (showId.includes('emerald-tunnel')) return 'tunnel'
  if (showId.includes('origami') || showId.includes('vector') || showId.includes('apex')) return 'polygon'
  if (showId.includes('aurora') || showId.includes('ribbon')) return 'wave'
  return 'fanSweep'
}

function scannerProfile(
  showId: string,
  fixture: LaserDmxShowDirectorFixture,
  fixtureIndex: number,
): ScannerProfile {
  const role = inferLaserDmxBuiltInFixtureRole(showId, fixture, fixtureIndex)
  const pattern = basePatternForShow(showId, role)
  const hero = role === 'heroFan' || role === 'tunnel' || role === 'corridor' || role === 'geometricOutline'
  const texture = role === 'textureScanner'
  const explicitOptical = role === 'diffractionScanner'
  const depthLayer: LaserDmxShowDirectorDepthLayer = role === 'upperAirCanopy'
    ? 'upperAir'
    : role === 'frontAirRake'
      ? 'cameraFacingAir'
      : role === 'tunnel' || role === 'geometricOutline'
        ? 'deepAir'
        : role === 'corridor'
          ? 'midAir'
          : texture
            ? 'frontAir'
            : fixture.depthLayer ?? fixture.beam.targetDepthLayer ?? 'midAir'
  return {
    pattern,
    scanRatePps: texture ? 18_000 : hero ? 30_000 : 24_000,
    durationBeats: pattern === 'holdBeam' ? 1 : texture ? 0.25 : hero ? 0.5 : 0.75,
    fanWidth: role === 'heroFan' ? 82 : role === 'supportingFan' ? 58 : role === 'frontAirRake' ? 74 : clamp(fixture.optics.fanWidth || fixture.beam.beamSpread || 48, 18, 92),
    radius: role === 'geometricOutline' ? 0.32 : role === 'corridor' || role === 'tunnel' ? 0.28 : texture ? 0.18 : 0.24,
    size: role === 'corridor' || role === 'tunnel' ? 0.66 : role === 'geometricOutline' ? 0.58 : texture ? 0.32 : 0.5,
    depthLayer,
    opticalMode: explicitOptical ? (pattern === 'diffractionGrid' ? 'gridDiffraction' : 'lineDiffraction') : 'normal',
    opticalCopyCount: explicitOptical ? (pattern === 'diffractionGrid' ? 9 : 5) : 1,
    role,
  }
}

function physicalScannerForFixture(
  showId: string,
  fixture: LaserDmxShowDirectorFixture,
  fixtureIndex: number,
  bounds: { columns: number; rows: number },
): LaserDmxShowDirectorScannerConfig {
  const profile = scannerProfile(showId, fixture, fixtureIndex)
  const base = createLaserDmxScannerPattern(fixture, profile.pattern, bounds)
  const geometry = updateLaserDmxScannerPatternGeometry(base, fixture, bounds, {
    size: profile.size,
    fanWidth: profile.fanWidth,
    radius: profile.radius,
  })
  const alternating = fixtureIndex % 2 === 1
  const explicitOptical = profile.opticalCopyCount > 1
  return {
    ...geometry,
    enabled: true,
    scanRatePps: profile.scanRatePps,
    durationBeats: profile.durationBeats,
    direction: geometry.path.repeatMode === 'pingPong' ? 'alternating' : alternating ? 'reverse' : 'forward',
    reversePath: alternating,
    phase: ((fixtureIndex * 0.173) + (stableHash(`${showId}:${fixture.semanticKey ?? fixture.label}`) % 97) / 97) % 1,
    fanWidth: profile.fanWidth,
    radius: profile.radius,
    size: profile.size,
    depthLayer: profile.depthLayer,
    switchBoundary: 'bar',
    shutterClosed: false,
    path: {
      ...geometry.path,
      retraceBlanking: true,
      blankingDelayMicros: 18,
      pointDwellMicros: profile.pattern === 'holdBeam' ? 900 : profile.role === 'geometricOutline' ? 28 : 20,
      cornerDwellMicros: profile.role === 'geometricOutline' ? 52 : 32,
      points: geometry.path.points.map((point, pointIndex) => ({
        ...point,
        blanked: point.blanked,
        dwellMicros: profile.pattern === 'holdBeam' ? 900 : point.dwellMicros,
        ...(profile.role === 'geometricOutline' && pointIndex % 2 === 0 ? { cornerDwellMicros: 56 } : {}),
      })),
    },
    optics: {
      mode: profile.opticalMode,
      copyCount: profile.opticalCopyCount,
      spreadDeg: explicitOptical ? 7 : 0,
      apertureCount: 1,
    },
    advanced: {
      ...geometry.advanced,
      maximumVelocity: 18_000,
      maximumAcceleration: 1_200_000,
      shutterExposureSeconds: 1 / 60,
      calibrationProfileId: 'default',
    },
    migration: {
      status: 'native',
      version: 1,
      sourceTargetIds: [],
      ambiguous: false,
      warnings: [],
    },
  }
}

function migrateFixture(
  showId: string,
  fixture: LaserDmxShowDirectorFixture,
  fixtureIndex: number,
  bounds: { columns: number; rows: number },
): LaserDmxShowDirectorFixture {
  if (fixture.kind !== 'laser') {
    const role = inferLaserDmxBuiltInFixtureRole(showId, fixture, fixtureIndex)
    return {
      ...fixture,
      semanticKey: fixture.semanticKey ?? `${showId}-${role}-${fixtureIndex + 1}`,
      optics: {
        ...fixture.optics,
        primitiveType: fixture.kind === 'movingHead' || fixture.kind === 'parWash'
          ? 'washCone'
          : fixture.kind === 'strobe'
            ? 'strobeField'
            : fixture.kind === 'blinder'
              ? 'blinderBank'
              : fixture.kind === 'co2Jet'
                ? 'co2Burst'
                : 'auto',
        rayCount: 1,
        diffractionMode: 'none',
        diffractionCopies: 1,
        apertureCount: 1,
      },
    }
  }

  const profile = scannerProfile(showId, fixture, fixtureIndex)
  const semanticIdentity = fixture.semanticKey ?? `${showId}-${profile.role}-${fixtureIndex + 1}`
  const scannerBase = physicalScannerForFixture(showId, fixture, fixtureIndex, bounds)
  const scanner: LaserDmxShowDirectorScannerConfig = {
    ...scannerBase,
    path: {
      ...scannerBase.path,
      points: scannerBase.path.points.map((point, pointIndex) => ({
        ...point,
        id: `${semanticIdentity}-scan-point-${pointIndex + 1}`,
      })),
    },
  }
  const primary = scanner.path.points.find(point => !point.blanked) ?? scanner.path.points[0]
  const explicitOptical = scanner.optics.copyCount > 1
  return {
    ...fixture,
    semanticKey: semanticIdentity,
    depthLayer: profile.depthLayer,
    beam: {
      ...fixture.beam,
      targetMode: profile.pattern === 'fanSweep' ? 'fan' : profile.pattern === 'mirroredCorridor' ? 'mirror' : profile.pattern === 'wave' ? 'sweep' : 'fixed',
      targetX: primary?.x ?? fixture.beam.targetX,
      targetY: primary?.y ?? fixture.beam.targetY,
      targetZ: primary?.z ?? fixture.beam.targetZ,
      targetDepthLayer: profile.depthLayer,
      targets: primary ? [{
        id: `${semanticIdentity}-compat-target`,
        x: primary.x,
        y: primary.y,
        ...(primary.z == null ? {} : { z: primary.z }),
        depthLayer: primary.depthLayer ?? profile.depthLayer,
      }] : [],
      beamSpread: profile.fanWidth,
    },
    optics: {
      ...fixture.optics,
      primitiveType: fixture.optics.primitiveType,
      rayCount: 1,
      fanWidth: profile.fanWidth,
      diffractionMode: 'none',
      diffractionCopies: 1,
      prismFacets: explicitOptical ? 3 : 1,
      apertureCount: 1,
      apertureSpacing: 0,
    },
    scanner,
  }
}

/**
 * Patch 5 content boundary. Built-ins are rewritten into native ordered paths,
 * while user projects and the legacy migration surface remain untouched.
 */
export function migrateLaserDmxBuiltInRigToPhysicalScannerContent(
  showId: string,
  state: LaserDmxShowDirectorState,
): LaserDmxShowDirectorState {
  const normalized = normalizeLaserDmxShowDirectorState(state)
  const bounds = normalized.settings.gridSize
  return normalizeLaserDmxShowDirectorState({
    ...normalized,
    fixtures: normalized.fixtures.map((fixture, index) => migrateFixture(showId, fixture, index, bounds)),
  })
}

function sectionEnergyKey(scene: LaserDmxShowDirectorPerformanceScene): LaserDmxShowDirectorPerformanceEnergyEnvelopeKey {
  if (scene.energyEnvelopeKey) return scene.energyEnvelopeKey
  const section = scene.section.types[0]
  if (section === 'intro') return 'intro'
  if (section === 'verse') return 'verse'
  if (section === 'build') return 'build'
  if (section === 'preDrop') return 'preDrop'
  if (section === 'breakdown' || section === 'bridge') return 'breakdown'
  if (section === 'outro') return 'outro'
  if (section === 'drop') {
    const occurrence = scene.section.dropOccurrence ?? scene.section.occurrence
    const dropTwo = occurrence?.minOccurrence != null && occurrence.minOccurrence >= 2
      || occurrence?.occurrences?.some(value => value >= 2)
    return dropTwo ? 'drop2' : 'drop1'
  }
  return 'verse'
}

function scannerSectionAction(showId: string, scene: LaserDmxShowDirectorPerformanceScene): LaserDmxShowDirectorScannerFixtureAction {
  const key = sectionEnergyKey(scene)
  const tunnelIdentity = showId.includes('tunnel') || showId.includes('mirror') || showId.includes('hourglass')
  const outlineIdentity = showId.includes('cathedral') || showId.includes('origami') || showId.includes('vector') || showId.includes('apex')
  const action: LaserDmxShowDirectorMixedFixtureAction = {
    id: `${scene.id}-physical-scanner-section`,
    kind: 'scanner',
    retraceBlanking: true,
    switchBoundary: key === 'preDrop' ? 'beat' : 'bar',
    opticalMode: 'normal',
    opticalCopyCount: 1,
  }
  switch (key) {
    case 'intro': return { ...action, patternType: 'lineSweep', scanRatePps: 11_000, durationBeats: 4, fanWidth: 24, size: 0.28, radius: 0.14, depthLayer: 'deepAir', heldBeam: false }
    case 'verse': return { ...action, patternType: outlineIdentity ? 'arc' : 'wave', scanRatePps: 17_000, durationBeats: 2, fanWidth: 38, size: 0.42, radius: 0.2, depthLayer: 'midAir', direction: 'alternating' }
    case 'build': return { ...action, patternType: 'fanSweep', scanRatePps: 23_000, durationBeats: 1, fanWidth: 48, size: 0.5, radius: 0.22, depthLayer: 'midAir', direction: 'alternating' }
    case 'preDrop': return { ...action, patternType: 'holdBeam', scanRatePps: 8_000, durationBeats: 1, fanWidth: 10, size: 0.16, radius: 0.08, depthLayer: 'deepAir', heldBeam: true, shutterClosed: false }
    case 'drop1': return { ...action, patternType: tunnelIdentity ? 'tunnel' : outlineIdentity ? 'polygon' : 'fanSweep', scanRatePps: 31_000, durationBeats: 0.5, fanWidth: 78, size: 0.7, radius: 0.31, depthLayer: tunnelIdentity ? 'deepAir' : 'frontAir', direction: 'alternating' }
    case 'breakdown': return { ...action, patternType: outlineIdentity ? 'circle' : 'arc', scanRatePps: 14_000, durationBeats: 4, fanWidth: 32, size: 0.34, radius: 0.18, depthLayer: 'upperAir', direction: 'forward' }
    case 'drop2': return { ...action, patternType: tunnelIdentity ? 'mirroredCorridor' : outlineIdentity ? 'polygon' : 'fanSweep', scanRatePps: 34_000, durationBeats: 0.375, fanWidth: 88, size: 0.78, radius: 0.36, depthLayer: 'deepAir', direction: 'reverse', reversePath: true, opticalMode: showId.includes('prism') || showId.includes('spectral') ? 'prism' : 'normal', opticalCopyCount: showId.includes('prism') || showId.includes('spectral') ? 3 : 1 }
    case 'outro': return { ...action, patternType: 'lineSweep', scanRatePps: 10_000, durationBeats: 8, fanWidth: 20, size: 0.24, radius: 0.12, depthLayer: 'deepAir', direction: 'forward' }
  }
}

type ScannerChoreographyRole = 'hero' | 'support' | 'texture'

function scannerRoleBankNames(
  bankRoles: LaserDmxShowDirectorPerformanceProgram['bankRoles'],
  role: ScannerChoreographyRole,
): string[] {
  const include = role === 'hero'
    ? /hero|kick|core|center|primary|apex|impact|beacon/i
    : role === 'support'
      ? /secondary|support|outer|inner|left|right|fan|wing|wall|horizontal|vertical|movement|canopy|tunnel|corridor/i
      : /hat|texture|tracer|shard|lattice|detail|chevron|horizon|accent/i
  const exclude = /rest|all|strobe|blinder|haze|atmosphere|co2|led|wash|portal/i
  return Object.keys(bankRoles ?? {}).filter(name => include.test(name) && !exclude.test(name))
}

function scannerRoleSectionAction(
  showId: string,
  scene: LaserDmxShowDirectorPerformanceScene,
  role: ScannerChoreographyRole,
): LaserDmxShowDirectorScannerFixtureAction {
  const section = scannerSectionAction(showId, scene)
  if (role === 'hero') return { ...section, id: `${section.id}-hero`, phase: 0 }
  if (role === 'support') {
    const patternType = section.patternType === 'holdBeam'
      ? 'holdBeam'
      : section.patternType === 'tunnel' || section.patternType === 'mirroredCorridor'
        ? 'arc'
        : section.patternType === 'polygon'
          ? 'lineSweep'
          : 'fanSweep'
    return {
      ...section,
      id: `${section.id}-support`,
      patternType,
      scanRatePps: Math.round((section.scanRatePps ?? 20_000) * 0.82),
      durationBeats: Math.max(0.5, (section.durationBeats ?? 1) * 1.25),
      fanWidth: Math.max(12, (section.fanWidth ?? 40) * 0.72),
      size: Math.max(0.18, (section.size ?? 0.5) * 0.78),
      radius: Math.max(0.1, (section.radius ?? 0.24) * 0.82),
      depthLayer: section.depthLayer === 'deepAir' ? 'midAir' : section.depthLayer,
      opticalMode: 'normal',
      opticalCopyCount: 1,
      phase: 0.25,
    }
  }
  return {
    ...section,
    id: `${section.id}-texture`,
    patternType: section.patternType === 'holdBeam' ? 'lineSweep' : section.patternType === 'circle' ? 'arc' : 'wave',
    scanRatePps: Math.round((section.scanRatePps ?? 20_000) * 0.62),
    durationBeats: Math.max(0.75, (section.durationBeats ?? 1) * 1.5),
    fanWidth: Math.max(10, (section.fanWidth ?? 40) * 0.42),
    size: Math.max(0.14, (section.size ?? 0.5) * 0.52),
    radius: Math.max(0.08, (section.radius ?? 0.24) * 0.58),
    depthLayer: 'upperAir',
    opticalMode: 'normal',
    opticalCopyCount: 1,
    heldBeam: false,
    phase: 0.5,
  }
}

function scannerMutation(
  id: string,
  action: LaserDmxShowDirectorMixedFixtureAction,
  address: LaserDmxShowDirectorPerformanceAddress = { fixtureKinds: ['laser'] },
): LaserDmxShowDirectorPerformanceMutationBase {
  return {
    id,
    address,
    fixtureActions: [action],
  }
}

function nonLaserSectionMutations(
  scene: LaserDmxShowDirectorPerformanceScene,
): LaserDmxShowDirectorPerformanceMutationBase[] {
  const key = sectionEnergyKey(scene)
  const brightness = key === 'intro' ? 0.24 : key === 'verse' ? 0.42 : key === 'build' ? 0.68 : key === 'preDrop' ? 0.18 : key === 'drop1' ? 0.86 : key === 'breakdown' ? 0.34 : key === 'drop2' ? 0.96 : 0.16
  const hazeAmount = key === 'intro' ? 0.2 : key === 'verse' ? 0.34 : key === 'build' ? 0.58 : key === 'preDrop' ? 0.38 : key === 'drop1' ? 0.72 : key === 'breakdown' ? 0.24 : key === 'drop2' ? 0.78 : 0.12
  const ledDirection = key === 'drop2' ? 'edgesIn' : key === 'build' ? 'centerOut' : key === 'breakdown' ? 'leftToRight' : 'chase'
  const movingStyle = key === 'preDrop' ? 'locked' : key === 'drop2' ? 'figureEight' : 'smoothSweep'
  return [
    {
      id: `${scene.id}-physical-moving-head-role`,
      address: { fixtureKinds: ['movingHead'] },
      fixtureActions: [{ id: `${scene.id}-moving-head-architecture`, kind: 'movingHead', brightness, movementStyle: movingStyle, fanSpread: key === 'drop2' ? 54 : key === 'drop1' ? 44 : key === 'build' ? 28 : 16 }],
    },
    {
      id: `${scene.id}-physical-led-role`,
      address: { fixtureKinds: ['ledBar', 'ledTube'] },
      fixtureActions: [{ id: `${scene.id}-led-rhythm`, kind: 'led', brightness: Math.min(0.9, brightness), direction: ledDirection }],
    },
    {
      id: `${scene.id}-physical-wash-role`,
      address: { fixtureKinds: ['parWash'] },
      fixtureActions: [{ id: `${scene.id}-wash-bed`, kind: 'wash', brightness: Math.min(0.82, brightness), fanSpread: key === 'drop1' || key === 'drop2' ? 84 : key === 'build' ? 68 : 48, focus: key === 'breakdown' ? 0.3 : 0.42 }],
    },
    {
      id: `${scene.id}-physical-haze-role`,
      address: { fixtureKinds: ['haze'] },
      fixtureActions: [{ id: `${scene.id}-haze-envelope`, kind: 'haze', brightness: hazeAmount, amount: hazeAmount }],
    },
  ]
}

function enhanceScene(
  showId: string,
  scene: LaserDmxShowDirectorPerformanceScene,
  bankRoles: LaserDmxShowDirectorPerformanceProgram['bankRoles'],
): LaserDmxShowDirectorPerformanceScene {
  const scannerAction = scannerSectionAction(showId, scene)
  const key = sectionEnergyKey(scene)
  const hasLaser = !NON_LASER_ONLY_SHOWS.has(showId)
  const baseScannerAction: LaserDmxShowDirectorScannerFixtureAction = {
    ...scannerAction,
    id: `${scannerAction.id}-base`,
    patternType: undefined,
    opticalMode: 'normal',
    opticalCopyCount: 1,
  }
  const roleMutations = hasLaser
    ? (['hero', 'support', 'texture'] as const).flatMap(role => {
        const roleBanks = scannerRoleBankNames(bankRoles, role)
        return roleBanks.length > 0
          ? [scannerMutation(
              `${scene.id}-physical-scanner-${role}`,
              scannerRoleSectionAction(showId, scene, role),
              { bankRoles: roleBanks },
            )]
          : []
      })
    : []
  const sectionBodyMutations = [
    ...(scene.sectionBodyMutations ?? []),
    ...(hasLaser ? [scannerMutation(`${scene.id}-physical-scanner-body`, baseScannerAction), ...roleMutations] : []),
    ...nonLaserSectionMutations(scene),
  ]
  const barMutations = hasLaser
    ? [
        ...(scene.barMutations ?? []),
        {
          ...scannerMutation(`${scene.id}-physical-scanner-bar-handoff`, {
            id: `${scene.id}-physical-scanner-bar-action`, kind: 'scanner', direction: 'alternating', phase: 0.25, switchBoundary: 'bar', retraceBlanking: true,
          }),
          intervalBars: 1,
        },
        {
          ...scannerMutation(`${scene.id}-physical-scanner-four-bar`, {
            id: `${scene.id}-physical-scanner-four-bar-action`, kind: 'scanner', fanWidth: key === 'drop1' || key === 'drop2' ? 92 : key === 'build' ? 58 : 42, radius: key === 'drop1' || key === 'drop2' ? 0.38 : 0.24, switchBoundary: 'bar',
          }),
          intervalBars: 4,
          anchorBar: 0,
        },
      ]
    : scene.barMutations
  const fourBarVariations = scene.fourBarVariations
  const eightBarRecruitment = hasLaser
    ? [
        ...(scene.eightBarRecruitment ?? []),
        {
          ...scannerMutation(`${scene.id}-physical-scanner-eight-bar`, {
            id: `${scene.id}-physical-scanner-eight-bar-action`, kind: 'scanner', depthLayer: key === 'drop2' ? 'deepAir' : 'midAir', size: key === 'drop1' || key === 'drop2' ? 0.82 : 0.58, switchBoundary: 'phrase',
          }),
          stage: 1,
          cumulative: true,
        },
      ]
    : scene.eightBarRecruitment
  const sixteenBarEvolution = hasLaser
    ? [
        ...(scene.sixteenBarEvolution ?? []),
        scannerMutation(`${scene.id}-physical-scanner-sixteen-bar`, {
          id: `${scene.id}-physical-scanner-sixteen-bar-action`, kind: 'scanner', reversePath: key === 'drop2', direction: key === 'drop2' ? 'reverse' : 'alternating', phase: 0.5, pathResetToken: stableHash(`${showId}:${scene.id}`), switchBoundary: 'phrase',
        }),
      ]
    : scene.sixteenBarEvolution
  return {
    ...scene,
    sectionBodyMutations,
    barMutations,
    fourBarVariations,
    eightBarRecruitment,
    sixteenBarEvolution,
  }
}

/** Preserve the existing Music Intelligence and Shared Performance scene model, while replacing its laser geometry vocabulary. */
export function migrateLaserDmxBuiltInPerformanceProgramToPhysicalScannerContent(
  showId: string,
  program: LaserDmxShowDirectorPerformanceProgram,
): LaserDmxShowDirectorPerformanceProgram {
  return {
    ...program,
    scenes: program.scenes.map(scene => enhanceScene(showId, scene, program.bankRoles)),
    bankRoles: {
      ...program.bankRoles,
      physicalScannerBank: { fixtureKinds: ['laser'] },
      movingHeadArchitecture: { fixtureKinds: ['movingHead'] },
      ledRhythmSupport: { fixtureKinds: ['ledBar', 'ledTube'] },
      impactStrobes: { fixtureKinds: ['strobe'] },
      phraseBlinders: { fixtureKinds: ['blinder'] },
      atmosphereBed: { fixtureKinds: ['haze', 'parWash'] },
      co2Impact: { fixtureKinds: ['co2Jet'] },
    },
    diagnostics: {
      ...program.diagnostics,
      authoringVersion: LASER_DMX_PHYSICAL_CONTENT_AUTHORING_VERSION,
      notes: Array.from(new Set([
        ...(program.diagnostics?.notes ?? []),
        'Built-in laser fixtures use one instantaneous beam and native ordered scanner paths.',
        'Section, bar, four-bar, eight-bar, and phrase scanner evolution is reconstructed from the Shared Performance timeline.',
        'Legacy target arrays remain supported for user projects but are not authoritative for this built-in show.',
      ])),
    },
  }
}

function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function auditLaserDmxBuiltInPhysicalContent(
  showId: string,
  state: LaserDmxShowDirectorState,
): LaserDmxPhysicalContentAudit {
  const normalized = normalizeLaserDmxShowDirectorState(state)
  const roleCounts: Record<string, number> = {}
  let nativeScannerCount = 0
  let laserFixtureCount = 0
  let singleApertureScannerCount = 0
  let explicitOpticalScannerCount = 0
  let persistentTargetNetworkCount = 0
  let radialSpokeRiskCount = 0
  let unblankedDisconnectedPathCount = 0
  let maximumOpticalCopyCount = 1
  let minimumPathContinuity = 1

  normalized.fixtures.forEach((fixture, index) => {
    const role = inferLaserDmxBuiltInFixtureRole(showId, fixture, index)
    roleCounts[role] = (roleCounts[role] ?? 0) + 1
    if (fixture.kind !== 'laser') return
    laserFixtureCount += 1
    if ((fixture.beam.targets?.length ?? 0) > 1) persistentTargetNetworkCount += 1
    const scanner = fixture.scanner
    if (!scanner?.enabled || scanner.migration.status !== 'native') return
    nativeScannerCount += 1
    maximumOpticalCopyCount = Math.max(maximumOpticalCopyCount, scanner.optics.copyCount)
    if (scanner.optics.apertureCount === 1 && scanner.optics.copyCount === 1) singleApertureScannerCount += 1
    if (scanner.optics.copyCount > 1) explicitOpticalScannerCount += 1
    if (scanner.optics.apertureCount === 1 && scanner.optics.copyCount === 1 && fixture.optics.rayCount > 1) radialSpokeRiskCount += 1
    const spans = scanner.path.points.slice(1).map((point, pointIndex) => pointDistance(scanner.path.points[pointIndex]!, point))
    const finiteSpans = spans.filter(value => Number.isFinite(value))
    const median = [...finiteSpans].sort((a, b) => a - b)[Math.floor(finiteSpans.length / 2)] ?? 0
    const discontinuities = spans.filter((span, spanIndex) => median > 0 && span > median * 3.5 && !scanner.path.points[spanIndex + 1]?.blanked).length
    if (discontinuities > 0) unblankedDisconnectedPathCount += 1
    const visibleSegments = Math.max(1, scanner.path.points.length - 1 - scanner.path.points.slice(1).filter(point => point.blanked).length)
    minimumPathContinuity = Math.min(minimumPathContinuity, visibleSegments / Math.max(1, scanner.path.points.length - 1))
  })

  return {
    showId,
    fixtureCount: normalized.fixtures.length,
    laserFixtureCount,
    nativeScannerCount,
    singleApertureScannerCount,
    explicitOpticalScannerCount,
    persistentTargetNetworkCount,
    radialSpokeRiskCount,
    unblankedDisconnectedPathCount,
    maximumOpticalCopyCount,
    minimumPathContinuity,
    roleCounts,
  }
}
