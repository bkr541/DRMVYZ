import {
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorDepthLayer,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorOpticalPrimitiveType,
  type LaserDmxShowDirectorState,
} from './ReactTypes'

interface ProfessionalOpticsPatch {
  primitiveType: LaserDmxShowDirectorOpticalPrimitiveType
  rayCount: number
  fanWidth?: number
  opticalSoftness?: number
  sourceIntensity?: number
  atmosphereResponse?: number
  zoom?: number
  iris?: number
  frost?: number
  goboAmount?: number
  prismFacets?: 1 | 3 | 5
  depthLayer?: LaserDmxShowDirectorDepthLayer
}

function semanticText(fixture: LaserDmxShowDirectorFixture): string {
  return `${fixture.semanticKey} ${fixture.label}`.toLowerCase()
}

function fixtureSpecificPatch(fixture: LaserDmxShowDirectorFixture): ProfessionalOpticsPatch {
  switch (fixture.kind) {
    case 'laser':
      return { primitiveType: 'fan', rayCount: 7, opticalSoftness: 0.06, sourceIntensity: 0.94, atmosphereResponse: 0.9, prismFacets: 1 }
    case 'movingHead':
      return { primitiveType: 'washCone', rayCount: 1, opticalSoftness: 0.34, sourceIntensity: 0.9, atmosphereResponse: 0.94, zoom: 0.44, iris: 0.88, frost: 0.08 }
    case 'parWash':
      return { primitiveType: 'washCone', rayCount: 1, opticalSoftness: 0.78, sourceIntensity: 0.78, atmosphereResponse: 1, zoom: 0.82, iris: 1, frost: 0.62 }
    case 'strobe':
      return { primitiveType: 'strobeField', rayCount: 1, opticalSoftness: 0.2, sourceIntensity: 1, atmosphereResponse: 1 }
    case 'blinder':
      return { primitiveType: 'blinderBank', rayCount: 4, opticalSoftness: 0.46, sourceIntensity: 1, atmosphereResponse: 0.92 }
    case 'co2Jet':
      return { primitiveType: 'co2Burst', rayCount: 1, opticalSoftness: 0.84, sourceIntensity: 0.72, atmosphereResponse: 1, depthLayer: 'frontAir' }
    case 'haze':
      return { primitiveType: 'auto', rayCount: 1, opticalSoftness: 1, sourceIntensity: 0.48, atmosphereResponse: 1, depthLayer: 'midAir' }
    case 'ledBar':
    case 'ledTube':
      return { primitiveType: 'auto', rayCount: 1, opticalSoftness: 0.3, sourceIntensity: 0.86, atmosphereResponse: 0.56 }
    case 'videoWall':
    default:
      return { primitiveType: 'auto', rayCount: 1, opticalSoftness: 0.2, sourceIntensity: 0.72, atmosphereResponse: 0.42, depthLayer: 'deepAir' }
  }
}

function showSpecificPatch(showId: string, fixture: LaserDmxShowDirectorFixture): Partial<ProfessionalOpticsPatch> {
  const semantic = semanticText(fixture)
  if (fixture.kind !== 'laser') return {}

  if (showId === 'prism-cathedral') {
    if (semantic.includes('apex') || semantic.includes('crown') || semantic.includes('spine') || semantic.includes('center')) {
      return { primitiveType: 'diamondPlane', rayCount: 4, fanWidth: 54, depthLayer: 'deepAir', prismFacets: 3 }
    }
    if (semantic.includes('upper') || semantic.includes('arch')) {
      return { primitiveType: 'canopy', rayCount: 7, fanWidth: 72, depthLayer: 'upperAir' }
    }
    return { primitiveType: 'layeredFan', rayCount: 7, fanWidth: 62, depthLayer: 'midAir' }
  }

  if (showId === 'cardinal-fan-reactor') {
    if (semantic.includes('lower') || semantic.includes('audience')) {
      return { primitiveType: 'audienceRake', rayCount: 7, fanWidth: 78, depthLayer: 'cameraFacingAir' }
    }
    if (semantic.includes('core') || semantic.includes('inner') || semantic.includes('primary')) {
      return { primitiveType: 'crossBank', rayCount: 6, fanWidth: 58, depthLayer: 'deepAir', prismFacets: 3 }
    }
    return { primitiveType: 'layeredFan', rayCount: 8, fanWidth: 76, depthLayer: 'midAir' }
  }

  if (showId === 'cyan-mirror-cage') {
    if (semantic.includes('inner')) return { primitiveType: 'mirroredCorridor', rayCount: 8, fanWidth: 64, depthLayer: 'frontAir' }
    if (semantic.includes('middle') || semantic.includes('mid')) return { primitiveType: 'rotatingLattice', rayCount: 8, fanWidth: 72, depthLayer: 'midAir' }
    return { primitiveType: 'tunnel', rayCount: 7, fanWidth: 68, depthLayer: 'deepAir' }
  }

  if (showId.includes('festival-front')) {
    if (semantic.includes('upper') || semantic.includes('top')) return { primitiveType: 'canopy', rayCount: 8, fanWidth: 82, depthLayer: 'upperAir' }
    if (semantic.includes('center') || semantic.includes('hero')) return { primitiveType: 'sheet', rayCount: 9, fanWidth: 88, depthLayer: 'midAir' }
    return { primitiveType: 'layeredFan', rayCount: 7, fanWidth: 70, depthLayer: 'frontAir' }
  }

  if (showId.includes('dubstep-drop')) {
    if (semantic.includes('center') || semantic.includes('hero')) return { primitiveType: 'apertureBurst', rayCount: 9, fanWidth: 96, depthLayer: 'deepAir', prismFacets: 3 }
    if (semantic.includes('outer')) return { primitiveType: 'scannerWave', rayCount: 7, fanWidth: 74, depthLayer: 'frontAir' }
    return { primitiveType: 'crossBank', rayCount: 6, fanWidth: 64, depthLayer: 'midAir' }
  }

  if (showId.includes('small-club')) {
    return semantic.includes('center')
      ? { primitiveType: 'layeredFan', rayCount: 6, fanWidth: 58, depthLayer: 'midAir' }
      : { primitiveType: 'fan', rayCount: 5, fanWidth: 48, depthLayer: 'frontAir' }
  }

  const existingMode = fixture.beam.targetMode
  if (existingMode === 'cross') return { primitiveType: 'crossBank', rayCount: 6 }
  if (existingMode === 'mirror') return { primitiveType: 'mirroredCorridor', rayCount: 7 }
  if (existingMode === 'sweep') return { primitiveType: 'scannerWave', rayCount: 6 }
  if (existingMode === 'fan') return { primitiveType: 'fan', rayCount: Math.max(5, Math.min(9, fixture.optics.rayCount)) }
  return { primitiveType: 'auto' }
}

function migrateFixture(showId: string, fixture: LaserDmxShowDirectorFixture): LaserDmxShowDirectorFixture {
  const base = fixtureSpecificPatch(fixture)
  const show = showSpecificPatch(showId, fixture)
  const patch = { ...base, ...show }
  return {
    ...fixture,
    depthLayer: patch.depthLayer ?? fixture.depthLayer,
    optics: {
      ...fixture.optics,
      primitiveType: patch.primitiveType,
      rayCount: patch.rayCount,
      fanWidth: patch.fanWidth ?? fixture.beam.beamSpread ?? fixture.optics.fanWidth,
      opticalSoftness: patch.opticalSoftness ?? fixture.optics.opticalSoftness,
      sourceIntensity: patch.sourceIntensity ?? fixture.optics.sourceIntensity,
      atmosphereResponse: patch.atmosphereResponse ?? fixture.optics.atmosphereResponse,
      zoom: patch.zoom ?? fixture.optics.zoom,
      iris: patch.iris ?? fixture.optics.iris,
      frost: patch.frost ?? fixture.optics.frost,
      prismFacets: patch.prismFacets ?? fixture.optics.prismFacets,
      goboAmount: patch.goboAmount ?? fixture.optics.goboAmount,
    },
  }
}

/**
 * Patch 7 migration boundary. It changes only optical presentation metadata;
 * fixture IDs, semantic keys, targets, triggers, groups, and performance programs remain untouched.
 */
export function migrateLaserDmxShowDirectorToProfessionalOptics(
  showId: string,
  state: LaserDmxShowDirectorState,
): LaserDmxShowDirectorState {
  const normalized = normalizeLaserDmxShowDirectorState(state)
  return {
    ...normalized,
    fixtures: normalized.fixtures.map(fixture => migrateFixture(showId, fixture)),
  }
}
