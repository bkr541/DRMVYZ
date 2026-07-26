import type {
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorMacroScanPlan,
  LaserDmxShowDirectorOpticalPrimitiveType,
} from '../../ReactTypes'
import {
  LASER_DMX_SCANNER_DOMAIN_VERSION,
  createDefaultLaserDmxScannerHead,
  validateLaserDmxScanPath,
  type LaserDmxLegacyScannerPlan,
  type LaserDmxScanPath,
  type LaserDmxScanPoint,
  type LaserDmxScannerColorChannels,
  type LaserDmxScannerOpticalCopy,
  type LaserDmxScannerVec3,
} from './LaserDmxScannerDomain'
import {
  createLaserDmxOpticalCopies,
  type LaserDmxOpticalCopyDescriptor,
  type LaserDmxOpticalDistribution,
} from './LaserDmxFixtureOptics'

export interface CreateLaserDmxMacroScannerPlanInput {
  fixture: LaserDmxShowDirectorFixture
  macro: LaserDmxShowDirectorMacroScanPlan
  origin: LaserDmxScannerVec3
  primitiveType: Exclude<LaserDmxShowDirectorOpticalPrimitiveType, 'auto'>
  color: LaserDmxScannerColorChannels
}

export interface LaserDmxMacroPlannerDiagnostics {
  topologyCacheKey: string
  raySlotCount: number
  pathPointCount: number
  visibleSlotCount: number
  blankedTravelPointCount: number
  totalDutyCycle: number
}

export interface LaserDmxMacroScannerPlanResult extends LaserDmxLegacyScannerPlan {
  diagnostics: LaserDmxMacroPlannerDiagnostics
}

const EPSILON = 1e-9

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function rotatePoint(x: number, y: number, centerX: number, centerY: number, rotationDeg: number): { x: number; y: number } {
  const radians = rotationDeg * Math.PI / 180
  const dx = x - centerX
  const dy = y - centerY
  return {
    x: centerX + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: centerY + dx * Math.sin(radians) + dy * Math.cos(radians),
  }
}

function scenePoint(
  macro: LaserDmxShowDirectorMacroScanPlan,
  x: number,
  y: number,
  z = macro.depth,
): LaserDmxScannerVec3 {
  const rotated = rotatePoint(x, y, macro.centerX, macro.centerY, macro.rotationDeg)
  return {
    x: clamp(rotated.x, 0.015, 0.985),
    y: clamp(rotated.y, 0.015, 0.985),
    z: clamp(z, -1, 1),
  }
}

function slotPoint(
  macro: LaserDmxShowDirectorMacroScanPlan,
  slot: number,
  index: number,
  color: LaserDmxScannerColorChannels,
  options: { blanked?: boolean; edge?: boolean; z?: number } = {},
): LaserDmxScanPoint {
  const angle = (slot - 0.5) * macro.fanSpreadDeg * Math.PI / 180
  const radius = clamp(Math.max(macro.radius, macro.width * 0.5, 0.12), 0.04, 0.8)
  const x = macro.centerX + Math.sin(angle) * radius
  const y = macro.centerY - Math.cos(angle) * radius * clamp(macro.height / Math.max(macro.width, 0.05), 0.32, 1.4)
  const edgeDwell = options.edge ? macro.edgeDwellMicros : 0
  return {
    id: `${macro.cueFrameId}:slot-${index + 1}${options.blanked ? ':blank' : ''}`,
    position: scenePoint(macro, x, y, options.z),
    blanked: Boolean(options.blanked || macro.shutterClosed),
    dwellMicros: options.blanked ? 0 : macro.pointDwellMicros + edgeDwell,
    cornerDwellMicros: options.blanked ? 0 : macro.cornerDwellMicros,
    intensity: options.blanked || macro.shutterClosed ? 0 : clamp01(macro.intensity),
    color: { ...color },
    cornerBehavior: options.blanked ? 'blank' : 'dwell',
    sourceTargetId: `macro-slot:${index}`,
    intendedRaySlotId: `slot-${index + 1}`,
  }
}

function steppedFanPoints(
  macro: LaserDmxShowDirectorMacroScanPlan,
  color: LaserDmxScannerColorChannels,
): LaserDmxScanPoint[] {
  const visible = macro.raySlots.map((slot, index) => slotPoint(macro, slot, index, color, {
    edge: index === 0 || index === macro.raySlots.length - 1,
  }))
  if (!macro.blankBetweenSlots || visible.length <= 1) return visible
  const points: LaserDmxScanPoint[] = []
  visible.forEach((point, index) => {
    points.push(point)
    if (index < visible.length - 1) {
      points.push({
        ...point,
        id: `${point.id}:travel-blank`,
        blanked: true,
        dwellMicros: 0,
        cornerDwellMicros: 0,
        intensity: 0,
        cornerBehavior: 'blank',
        intendedRaySlotId: undefined,
      })
    }
  })
  return points
}

function smoothFanPoints(
  macro: LaserDmxShowDirectorMacroScanPlan,
  color: LaserDmxScannerColorChannels,
): LaserDmxScanPoint[] {
  const slots = macro.raySlots.length > 1 ? macro.raySlots : [0, 1]
  return [
    slotPoint(macro, slots[0] ?? 0, 0, color, { edge: true }),
    slotPoint(macro, slots[slots.length - 1] ?? 1, 1, color, { edge: true }),
  ].map(point => ({ ...point, cornerBehavior: 'continuous', intendedRaySlotId: undefined }))
}

function circlePoints(
  macro: LaserDmxShowDirectorMacroScanPlan,
  color: LaserDmxScannerColorChannels,
  arc = false,
): LaserDmxScanPoint[] {
  const count = Math.max(arc ? 3 : 6, macro.pathPointCount || macro.raySlots.length || 12)
  const start = arc ? Math.PI : -Math.PI / 2
  const range = arc ? Math.PI : Math.PI * 2
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (arc ? count - 1 : count)
    const angle = start + range * t
    const x = macro.centerX + Math.cos(angle) * macro.radius
    const y = macro.centerY + Math.sin(angle) * macro.radius * clamp(macro.height / Math.max(macro.width, 0.05), 0.35, 1.35)
    return {
      id: `${macro.cueFrameId}:${arc ? 'arc' : 'circle'}-${index + 1}`,
      position: scenePoint(macro, x, y),
      blanked: macro.shutterClosed,
      dwellMicros: macro.pointDwellMicros,
      cornerDwellMicros: arc && (index === 0 || index === count - 1) ? macro.edgeDwellMicros : macro.cornerDwellMicros,
      intensity: macro.shutterClosed ? 0 : clamp01(macro.intensity),
      color: { ...color },
      cornerBehavior: 'continuous' as const,
      intendedRaySlotId: `slot-${index + 1}`,
    }
  })
}

function polygonPoints(
  macro: LaserDmxShowDirectorMacroScanPlan,
  color: LaserDmxScannerColorChannels,
): LaserDmxScanPoint[] {
  const count = Math.max(3, macro.pathPointCount || macro.raySlots.length || 6)
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + index / count * Math.PI * 2
    return {
      id: `${macro.cueFrameId}:polygon-${index + 1}`,
      position: scenePoint(
        macro,
        macro.centerX + Math.cos(angle) * macro.radius,
        macro.centerY + Math.sin(angle) * macro.radius * clamp(macro.height / Math.max(macro.width, 0.05), 0.35, 1.35),
      ),
      blanked: macro.shutterClosed,
      dwellMicros: macro.pointDwellMicros,
      cornerDwellMicros: macro.cornerDwellMicros,
      intensity: macro.shutterClosed ? 0 : clamp01(macro.intensity),
      color: { ...color },
      cornerBehavior: 'dwell' as const,
      intendedRaySlotId: `slot-${index + 1}`,
    }
  })
}

function wavePoints(
  macro: LaserDmxShowDirectorMacroScanPlan,
  color: LaserDmxScannerColorChannels,
): LaserDmxScanPoint[] {
  const count = Math.max(5, macro.pathPointCount || macro.raySlots.length || 12)
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0.5 : index / (count - 1)
    const phase = macro.phase * Math.PI * 2
    const x = macro.centerX + (t - 0.5) * macro.width
    const y = macro.centerY + Math.sin(t * Math.PI * 2 + phase) * macro.height * 0.5
    return {
      id: `${macro.cueFrameId}:wave-${index + 1}`,
      position: scenePoint(macro, x, y),
      blanked: macro.shutterClosed,
      dwellMicros: macro.pointDwellMicros,
      cornerDwellMicros: macro.cornerDwellMicros,
      intensity: macro.shutterClosed ? 0 : clamp01(macro.intensity),
      color: { ...color },
      cornerBehavior: 'continuous' as const,
      intendedRaySlotId: `slot-${index + 1}`,
    }
  })
}

function tunnelPoints(
  macro: LaserDmxShowDirectorMacroScanPlan,
  color: LaserDmxScannerColorChannels,
  corridor = false,
): LaserDmxScanPoint[] {
  const count = Math.max(6, macro.pathPointCount || macro.raySlots.length || 8)
  return Array.from({ length: count }, (_, index) => {
    const t = count <= 1 ? 0 : index / (count - 1)
    const bankSide = macro.fixtureMemberCount <= 1 ? (index % 2 === 0 ? -1 : 1) : macro.fixtureMemberIndex < macro.fixtureMemberCount / 2 ? -1 : 1
    const depth = clamp(macro.depth + (t - 0.5) * 0.8, -1, 1)
    const opening = corridor ? 0.38 + Math.abs(t - 0.5) * 0.62 : 1 - t * 0.72
    const x = macro.centerX + bankSide * macro.width * 0.5 * opening
    const y = macro.centerY + (corridor ? (t - 0.5) * macro.height : Math.sin(t * Math.PI * 2) * macro.height * 0.35 * opening)
    return {
      id: `${macro.cueFrameId}:${corridor ? 'corridor' : 'tunnel'}-${index + 1}`,
      position: scenePoint(macro, x, y, depth),
      blanked: macro.shutterClosed,
      dwellMicros: macro.pointDwellMicros,
      cornerDwellMicros: macro.cornerDwellMicros,
      intensity: macro.shutterClosed ? 0 : clamp01(macro.intensity),
      color: { ...color },
      cornerBehavior: 'continuous' as const,
      intendedRaySlotId: `slot-${index + 1}`,
    }
  })
}

function parallelPoint(
  macro: LaserDmxShowDirectorMacroScanPlan,
  color: LaserDmxScannerColorChannels,
): LaserDmxScanPoint[] {
  const memberT = macro.fixtureMemberCount <= 1 ? 0.5 : macro.fixtureMemberIndex / (macro.fixtureMemberCount - 1)
  const x = macro.centerX + (memberT - 0.5) * macro.width
  return [{
    id: `${macro.cueFrameId}:parallel-${macro.fixtureMemberIndex + 1}`,
    position: scenePoint(macro, x, macro.centerY - macro.height * 0.45),
    blanked: macro.shutterClosed,
    dwellMicros: Math.max(1_000, macro.pointDwellMicros),
    cornerDwellMicros: 0,
    intensity: macro.shutterClosed ? 0 : clamp01(macro.intensity),
    color: { ...color },
    cornerBehavior: 'dwell',
    intendedRaySlotId: `fixture-slot-${macro.fixtureMemberIndex + 1}`,
  }]
}

function gridPoints(
  macro: LaserDmxShowDirectorMacroScanPlan,
  color: LaserDmxScannerColorChannels,
): LaserDmxScanPoint[] {
  const count = Math.max(4, macro.pathPointCount || macro.raySlots.length || 9)
  const side = Math.max(2, Math.ceil(Math.sqrt(count)))
  const points: LaserDmxScanPoint[] = []
  for (let row = 0; row < side; row += 1) {
    for (let column = 0; column < side; column += 1) {
      const orderedColumn = row % 2 === 0 ? column : side - 1 - column
      const x = macro.centerX + (orderedColumn / Math.max(1, side - 1) - 0.5) * macro.width
      const y = macro.centerY + (row / Math.max(1, side - 1) - 0.5) * macro.height
      points.push({
        id: `${macro.cueFrameId}:grid-${points.length + 1}`,
        position: scenePoint(macro, x, y),
        blanked: macro.shutterClosed,
        dwellMicros: macro.pointDwellMicros,
        cornerDwellMicros: macro.cornerDwellMicros,
        intensity: macro.shutterClosed ? 0 : clamp01(macro.intensity),
        color: { ...color },
        cornerBehavior: 'continuous',
        intendedRaySlotId: `slot-${points.length + 1}`,
      })
      if (points.length >= count) return points
    }
  }
  return points
}

function pointsForMacro(
  macro: LaserDmxShowDirectorMacroScanPlan,
  color: LaserDmxScannerColorChannels,
): LaserDmxScanPoint[] {
  if (macro.family === 'heldBeam') return [slotPoint(macro, macro.raySlots[0] ?? 0.5, 0, color)]
  if (macro.family === 'parallelSheet') return parallelPoint(macro, color)
  if (macro.family === 'smoothFanSweep') return smoothFanPoints(macro, color)
  if (macro.family === 'sequentialCircle') return circlePoints(macro, color)
  if (macro.family === 'arcSweep') return circlePoints(macro, color, true)
  if (macro.family === 'polygonOutline') return polygonPoints(macro, color)
  if (macro.family === 'progressiveWave') return wavePoints(macro, color)
  if (macro.family === 'tunnel') return tunnelPoints(macro, color)
  if (macro.family === 'corridor') return tunnelPoints(macro, color, true)
  if (macro.family === 'gridScan' || macro.family === 'gridDiffraction') return gridPoints(macro, color)
  if (macro.family === 'lineDiffraction') return smoothFanPoints(macro, color)
  if (macro.family === 'burstDiffraction') return [slotPoint(macro, 0.5, 0, color)]
  return steppedFanPoints(macro, color)
}

function aggregationTargets(points: readonly LaserDmxScanPoint[], macro: LaserDmxShowDirectorMacroScanPlan): Array<{ id: string; target: LaserDmxScannerVec3 }> {
  if (macro.family === 'smoothFanSweep' || macro.family === 'lineDiffraction') {
    return macro.raySlots.map((slot, index) => {
      const point = slotPoint(macro, slot, index, { r: 1, g: 1, b: 1, a: 1 })
      return { id: `slot-${index + 1}`, target: point.position }
    })
  }
  return points.flatMap(point => point.intendedRaySlotId && !point.blanked
    ? [{ id: point.intendedRaySlotId, target: { ...point.position } }]
    : [])
}

function presentationModeForMacro(
  macro: LaserDmxShowDirectorMacroScanPlan,
): LaserDmxScanPath['presentationMode'] {
  if (macro.family === 'heldBeam' || macro.family === 'parallelSheet' || macro.family === 'burstDiffraction') {
    return 'heldRay'
  }
  if (
    macro.family === 'steppedFan'
    || macro.family === 'mirroredFan'
    || macro.family === 'opposedFans'
    || macro.family === 'crossingFans'
    || macro.family === 'xFan'
    || macro.family === 'centerOutFan'
    || macro.family === 'outsideInFan'
  ) {
    return 'intentionalRays'
  }
  return 'scannedPath'
}

function macroOpticalPlan(
  fixture: LaserDmxShowDirectorFixture,
  macro: LaserDmxShowDirectorMacroScanPlan,
  headId: string,
): {
  direct: ReturnType<typeof createLaserDmxOpticalCopies>[number]
  copies: LaserDmxScannerOpticalCopy[]
} {
  const distributionByMode: Record<Exclude<LaserDmxShowDirectorMacroScanPlan['opticalMode'], 'normal'>, LaserDmxOpticalDistribution> = {
    prism: 'prism',
    lineDiffraction: 'line',
    gridDiffraction: 'grid',
    burstDiffraction: 'burst',
  }
  const opticalCount = macro.opticalMode === 'normal'
    ? 1
    : Math.max(1, Math.min(25, Math.round(macro.opticalCopyCount)))
  const opticalDescriptors = createLaserDmxOpticalCopies({
    distribution: macro.opticalMode === 'normal' ? 'prism' : distributionByMode[macro.opticalMode],
    copyCount: opticalCount,
    spreadDeg: macro.opticalMode === 'normal' ? 0 : clamp(macro.opticalCopySpreadDeg, 0, 45),
    totalEnergy: 1,
    spectralSeparationDeg: clamp(fixture.optics.spectralSeparation ?? 0, 0, 4),
  })
  const apertureCount = Math.max(1, Math.min(8, Math.round(macro.apertureCount)))
  const apertureDescriptors = createLaserDmxOpticalCopies({
    distribution: 'multiAperture',
    copyCount: apertureCount,
    spreadDeg: 0,
    totalEnergy: 1,
    apertureSpacing: clamp(fixture.optics.apertureSpacing ?? 0.012, 0, 0.08),
  })
  const orientationRad = (fixture.optics.prismRotation ?? 0) * Math.PI / 180
  const combined: LaserDmxOpticalCopyDescriptor[] = opticalDescriptors.flatMap((optical, opticalIndex) =>
    apertureDescriptors.map((aperture, apertureIndex) => ({
      index: opticalIndex * apertureDescriptors.length + apertureIndex,
      distribution: apertureCount > 1 ? 'multiAperture' : optical.distribution,
      angularOffsetDeg: {
        yaw: optical.angularOffsetDeg.yaw * Math.cos(orientationRad) - optical.angularOffsetDeg.pitch * Math.sin(orientationRad),
        pitch: optical.angularOffsetDeg.yaw * Math.sin(orientationRad) + optical.angularOffsetDeg.pitch * Math.cos(orientationRad),
      },
      originOffset: { ...aperture.originOffset },
      spectralChannel: optical.spectralChannel,
      intensityScale: optical.intensityScale * aperture.intensityScale,
    })),
  )
  const directIndex = combined.reduce((bestIndex, descriptor, index, all) => {
    const score = Math.abs(descriptor.angularOffsetDeg.yaw) + Math.abs(descriptor.angularOffsetDeg.pitch)
      + Math.hypot(descriptor.originOffset.x, descriptor.originOffset.y, descriptor.originOffset.z) * 10
    const best = all[bestIndex]!
    const bestScore = Math.abs(best.angularOffsetDeg.yaw) + Math.abs(best.angularOffsetDeg.pitch)
      + Math.hypot(best.originOffset.x, best.originOffset.y, best.originOffset.z) * 10
    return score < bestScore ? index : bestIndex
  }, 0)
  const direct = combined[directIndex] ?? {
    index: 0,
    distribution: 'prism' as const,
    angularOffsetDeg: { yaw: 0, pitch: 0 },
    originOffset: { x: 0, y: 0, z: 0 },
    spectralChannel: 'full' as const,
    intensityScale: 1,
  }
  const copies = combined
    .filter((_, index) => index !== directIndex)
    .map((descriptor, index): LaserDmxScannerOpticalCopy => ({
      id: `${headId}:macro-optical-copy-${index + 1}`,
      fixtureId: fixture.id,
      scannerHeadId: headId,
      opticalCopyIndex: index + 1,
      kind: Math.hypot(descriptor.originOffset.x, descriptor.originOffset.y, descriptor.originOffset.z) > 1e-8
        ? 'multiEmitter'
        : macro.opticalMode === 'prism'
          ? 'prism'
          : macro.opticalMode === 'normal'
            ? 'beamSplitter'
            : 'diffraction',
      rotationDeg: descriptor.angularOffsetDeg.yaw,
      pitchDeg: descriptor.angularOffsetDeg.pitch,
      originOffset: { ...descriptor.originOffset },
      spectralChannel: descriptor.spectralChannel,
      intensityScale: descriptor.intensityScale,
    }))
  return { direct, copies }
}

export function createLaserDmxMacroScannerPlan(input: CreateLaserDmxMacroScannerPlanInput): LaserDmxMacroScannerPlanResult {
  if (
    input.fixture.kind !== 'laser'
    || !input.fixture.enabled
    || input.fixture.runtimeOutputGate?.open === false
    || input.macro.outputGateOpen === false
    || input.macro.lifecycleState === 'off'
    || input.macro.lifecycleState === 'blackout'
    || !input.fixture.beam.beamEnabled
  ) {
    return {
      heads: [], paths: [], opticalCopies: [],
      diagnostics: {
        topologyCacheKey: input.macro.topologyCacheKey,
        raySlotCount: input.macro.raySlots.length,
        pathPointCount: 0,
        visibleSlotCount: 0,
        blankedTravelPointCount: 0,
        totalDutyCycle: input.macro.totalDutyCycle,
      },
    }
  }
  const points = pointsForMacro(input.macro, input.color)
  const head = createDefaultLaserDmxScannerHead(
    input.fixture.id,
    0,
    input.fixture.scanner?.advanced.shutterExposureSeconds ?? 1 / 60,
    input.macro.phase,
  )
  head.scanPhase = clamp01(input.macro.phase)
  head.scanRatePps = clamp(input.macro.scanRatePps, 10, 100_000)
  head.maximumAngularVelocity = clamp(input.fixture.scanner?.advanced.maximumVelocity ?? head.maximumAngularVelocity, 1, 100_000)
  head.maximumAngularAcceleration = clamp(input.fixture.scanner?.advanced.maximumAcceleration ?? head.maximumAngularAcceleration, 1, 10_000_000)
  head.pointDwellMicros = clamp(input.macro.pointDwellMicros, 0, 1_000_000)
  head.cornerDwellMicros = clamp(input.macro.cornerDwellMicros, 0, 1_000_000)
  head.blankingDelayMicros = clamp(input.macro.blankingDelayMicros, 0, 100_000)
  head.retraceBlanking = input.macro.retraceBlanking
  head.physicalApertureCount = Math.max(1, Math.min(8, Math.round(input.macro.apertureCount)))
  const opticalPlan = macroOpticalPlan(input.fixture, input.macro, head.id)
  head.directIntensityScale = opticalPlan.direct.intensityScale
  head.directRotationDeg = opticalPlan.direct.angularOffsetDeg.yaw
  head.directPitchDeg = opticalPlan.direct.angularOffsetDeg.pitch
  head.directOriginOffset = { ...opticalPlan.direct.originOffset }
  head.directSpectralChannel = opticalPlan.direct.spectralChannel

  const presentationMode = presentationModeForMacro(input.macro)
  const path: LaserDmxScanPath = {
    schemaVersion: LASER_DMX_SCANNER_DOMAIN_VERSION,
    id: `${input.fixture.id}:macro-path:${input.macro.cueFrameId}`,
    fixtureId: input.fixture.id,
    scannerHeadId: head.id,
    points,
    closed: input.macro.family === 'sequentialCircle' || input.macro.family === 'polygonOutline',
    interpolation: input.macro.interpolation,
    repeatMode: input.macro.repeatMode,
    scanDirection: input.macro.direction,
    conversionKind: 'native',
    compatibilityMode: 'native',
    validationErrors: [],
    migrationWarnings: [],
    authoringPatternType: input.fixture.runtimeScanner?.patternType ?? input.fixture.scanner?.patternType ?? 'customPath',
    migrationStatus: 'native',
    macroControlled: true,
    cueFrameId: input.macro.cueFrameId,
    topologyId: input.macro.topologyId,
    topologyRevision: input.macro.topologyRevision,
    topologyCacheKey: input.macro.topologyCacheKey,
    presentationMode,
    exposureAggregation: presentationMode === 'scannedPath' ? 'none' : 'intendedSlots',
    intendedRaySlots: aggregationTargets(points, input.macro),
    totalDutyCycle: clamp(input.macro.totalDutyCycle, EPSILON, 1),
    clearTemporalHistory: input.macro.clearTemporalHistory,
    cueId: input.macro.cueId,
    macroId: input.macro.macroId,
    lifecycleState: input.macro.lifecycleState,
    patternAnimationActive: input.macro.patternAnimationActive,
    fixtureMovementActive: input.macro.fixtureMovementActive,
    movementProgress: input.macro.movementProgress,
    ownedParameters: [...(input.macro.ownedParameters ?? [])],
  }
  path.validationErrors = validateLaserDmxScanPath(path)
  const copies = opticalPlan.copies
  return {
    heads: [head],
    paths: [path],
    opticalCopies: copies,
    diagnostics: {
      topologyCacheKey: input.macro.topologyCacheKey,
      raySlotCount: input.macro.raySlots.length,
      pathPointCount: points.length,
      visibleSlotCount: path.intendedRaySlots?.length ?? 0,
      blankedTravelPointCount: points.filter(point => point.blanked).length,
      totalDutyCycle: path.totalDutyCycle ?? 1,
    },
  }
}
