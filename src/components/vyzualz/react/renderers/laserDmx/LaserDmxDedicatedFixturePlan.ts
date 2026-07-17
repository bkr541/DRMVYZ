import type { LaserDmxShowDirectorGoboPattern, LaserDmxShowDirectorVideoWallSource } from '../../ReactTypes'
import type { LaserDmxSceneColor, LaserDmxSceneFrame, LaserDmxSceneVec3 } from './LaserDmxSceneFrame'
import { resolveLaserDmxDepthSliceIndex, resolveLaserDmxDepthQualityPolicy } from './LaserDmxDepthCompositing'
import { clipLaserDmxSceneSegment, projectLaserDmxScenePoint } from './LaserDmxSpatialModel'
import { createLaserDmxOpticalCopies } from './LaserDmxFixtureOptics'
import type { LaserDmxWebGLViewport } from './LaserDmxWebGLBeamPlan'

export interface LaserDmxMovingHeadConeInstance {
  id: string
  origin: LaserDmxSceneVec3
  target: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  intensity: number
  sourceWidthCssPx: number
  fieldWidthCssPx: number
  hotspot: number
  edgeSoftness: number
  zoom: number
  iris: number
  frost: number
  focus: number
  goboPattern: number
  goboAmount: number
  goboRotationRad: number
  prismCopyIndex: number
  prismCopyCount: number
  depthSlice: number
  sortDepth: number
}

export interface LaserDmxWashFieldInstance {
  id: string
  origin: LaserDmxSceneVec3
  target: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  intensity: number
  sourceWidthCssPx: number
  fieldWidthCssPx: number
  edgeSoftness: number
  zoom: number
  frost: number
  ellipticity: number
  depthSlice: number
  sortDepth: number
}

export interface LaserDmxLedFixtureInstance {
  id: string
  position: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  intensity: number
  halfHeightCssPx: number
  aspect: number
  rotationRad: number
  segments: number
  behavior: 0 | 1 | 2 | 3
  phase: number
  gradient: number
  depthSlice: number
  sortDepth: number
}

export interface LaserDmxFlashFixtureInstance {
  id: string
  kind: 'strobe' | 'blinder'
  position: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  intensity: number
  radiusCssPx: number
  aspect: number
  rotationRad: number
  warmth: number
  atmosphereLift: number
  depthSlice: number
  sortDepth: number
}

export interface LaserDmxVideoSurfaceInstance {
  id: string
  position: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  intensity: number
  halfHeightCssPx: number
  aspect: number
  rotationRad: number
  sourceVariant: number
  phase: number
  depthSlice: number
  sortDepth: number
}

export interface LaserDmxDedicatedFixtureRenderPlan {
  movingHeads: LaserDmxMovingHeadConeInstance[]
  washes: LaserDmxWashFieldInstance[]
  leds: LaserDmxLedFixtureInstance[]
  flashes: LaserDmxFlashFixtureInstance[]
  videoSurfaces: LaserDmxVideoSurfaceInstance[]
  hazeSourceCount: number
  co2SourceCount: number
  universalRibbonFixtureCount: 0
}

const GOBO_INDEX: Record<LaserDmxShowDirectorGoboPattern, number> = {
  open: 0, circle: 1, dots: 2, bars: 3, triangle: 4, star: 5, breakup: 6, radial: 7, grid: 8,
}
const VIDEO_INDEX: Record<LaserDmxShowDirectorVideoWallSource, number> = {
  placeholder: 0, reactVisual: 1, media: 2, camera: 3,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function rotateTarget(origin: LaserDmxSceneVec3, target: LaserDmxSceneVec3, yawDeg: number, pitchDeg: number): LaserDmxSceneVec3 {
  const yaw = yawDeg * Math.PI / 180
  const pitch = pitchDeg * Math.PI / 180
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const dz = target.z - origin.z
  const yawX = dx * Math.cos(yaw) - dy * Math.sin(yaw)
  const yawY = dx * Math.sin(yaw) + dy * Math.cos(yaw)
  return {
    x: origin.x + yawX,
    y: origin.y + yawY * Math.cos(pitch) - dz * Math.sin(pitch),
    z: origin.z + yawY * Math.sin(pitch) + dz * Math.cos(pitch),
  }
}

function ledBehavior(direction: LaserDmxSceneFrame['fixtures'][number]['component']['ledDirection'], segments: number): 0 | 1 | 2 | 3 {
  if (segments <= 1) return 0
  if (direction === 'chase' || direction === 'leftToRight' || direction === 'rightToLeft') return 2
  if (direction === 'centerOut' || direction === 'edgesIn') return 3
  return 1
}

export function buildLaserDmxDedicatedFixtureRenderPlan(
  frame: LaserDmxSceneFrame,
  viewport: LaserDmxWebGLViewport,
  continuousDepthAvailable = true,
): LaserDmxDedicatedFixtureRenderPlan {
  const aspect = clamp(viewport.backingWidth / Math.max(1, viewport.backingHeight), 0.5, 3)
  const depthPolicy = resolveLaserDmxDepthQualityPolicy(frame.quality.qualityTier, continuousDepthAvailable)
  const strongestBeamByFixture = new Map<string, LaserDmxSceneFrame['beams'][number]>()
  for (const beam of frame.beams) {
    if (!beam.enabled || beam.intensity <= 0.001 || (beam.fixtureKind !== 'movingHead' && beam.fixtureKind !== 'parWash')) continue
    const current = strongestBeamByFixture.get(beam.fixtureId)
    if (!current || beam.intensity > current.intensity) strongestBeamByFixture.set(beam.fixtureId, beam)
  }

  const movingHeads: LaserDmxMovingHeadConeInstance[] = []
  const washes: LaserDmxWashFieldInstance[] = []
  const leds: LaserDmxLedFixtureInstance[] = []
  const flashes: LaserDmxFlashFixtureInstance[] = []
  const videoSurfaces: LaserDmxVideoSurfaceInstance[] = []
  const strobeStrength = frame.transientEvents.find(event => event.kind === 'strobe')?.strength ?? 0
  const blinderStrength = frame.transientEvents.find(event => event.kind === 'blinder')?.strength ?? 0

  for (const fixture of frame.fixtures) {
    if (!fixture.enabled || fixture.intensity <= 0.001) continue
    const projected = projectLaserDmxScenePoint(frame.camera, fixture.position, aspect)
    if (!projected.visible) continue
    const depthSlice = resolveLaserDmxDepthSliceIndex(projected.clipDepth, depthPolicy.sliceCount)
    const perspective = clamp(projected.perspectiveScale, 0.78, 1.28)
    const rotationRad = fixture.rotationDeg * Math.PI / 180
    const beam = strongestBeamByFixture.get(fixture.id)

    if ((fixture.kind === 'movingHead' || fixture.kind === 'parWash') && beam) {
      const clipped = clipLaserDmxSceneSegment(frame.camera, beam.origin, beam.target)
      if (!clipped) continue
      const origin = projectLaserDmxScenePoint(frame.camera, clipped.origin, aspect)
      const target = projectLaserDmxScenePoint(frame.camera, clipped.target, aspect)
      if (!origin.visible && !target.visible) continue
      const baseOrigin = { x: origin.x, y: origin.y, z: origin.clipDepth }
      const baseTarget = { x: target.x, y: target.y, z: target.clipDepth }
      if (fixture.kind === 'movingHead') {
        const prismCopyLimit = frame.quality.qualityTier === 'low' || frame.quality.qualityTier === 'medium' ? 3 : 5
        const prismCopies = createLaserDmxOpticalCopies({
          distribution: 'prism',
          copyCount: Math.min(prismCopyLimit, fixture.optics.prismFacets),
          spreadDeg: fixture.optics.prismFacets > 1 ? 4.5 + fixture.optics.zoom * 2.5 : 0,
          totalEnergy: 1,
        })
        prismCopies.forEach((copy, index) => {
          const copyTarget = rotateTarget(baseOrigin, baseTarget, copy.angularOffsetDeg.yaw, copy.angularOffsetDeg.pitch)
          movingHeads.push({
            id: `${fixture.id}-moving-head-${index + 1}`,
            origin: baseOrigin,
            target: copyTarget,
            color: fixture.color,
            intensity: clamp(fixture.intensity * fixture.optics.sourceIntensity * copy.intensityScale, 0, 2.4),
            sourceWidthCssPx: clamp((1.5 + fixture.optics.iris * 2.4) * perspective, 1, 6),
            fieldWidthCssPx: clamp((11 + fixture.optics.zoom * 34) * (0.32 + fixture.optics.iris * 0.68) * perspective, 6, 62),
            hotspot: clamp(0.45 + beam.focus * 0.45, 0.35, 0.95),
            edgeSoftness: clamp(fixture.optics.opticalSoftness + fixture.optics.frost * 0.55, 0.04, 0.92),
            zoom: fixture.optics.zoom,
            iris: fixture.optics.iris,
            frost: fixture.optics.frost,
            focus: beam.focus,
            goboPattern: GOBO_INDEX[fixture.optics.goboPattern],
            goboAmount: fixture.optics.goboAmount,
            goboRotationRad: fixture.optics.goboRotation * Math.PI / 180 + frame.transport.audioTimeSec * 0.22,
            prismCopyIndex: index,
            prismCopyCount: prismCopies.length,
            depthSlice,
            sortDepth: (baseOrigin.z + copyTarget.z) * 0.5,
          })
        })
      } else {
        washes.push({
          id: `${fixture.id}-wash-field`,
          origin: baseOrigin,
          target: baseTarget,
          color: fixture.color,
          intensity: clamp(fixture.intensity * fixture.optics.sourceIntensity, 0, 1.8),
          sourceWidthCssPx: clamp((2.5 + fixture.optics.iris * 3.2) * perspective, 2, 8),
          fieldWidthCssPx: clamp((28 + fixture.optics.zoom * 64) * perspective, 22, 110),
          edgeSoftness: clamp(0.52 + fixture.optics.opticalSoftness * 0.38 + fixture.optics.frost * 0.3, 0.45, 0.98),
          zoom: fixture.optics.zoom,
          frost: fixture.optics.frost,
          ellipticity: clamp(0.72 + Math.abs(Math.sin(rotationRad)) * 0.28, 0.65, 1),
          depthSlice,
          sortDepth: (baseOrigin.z + baseTarget.z) * 0.5,
        })
      }
      continue
    }

    if (fixture.kind === 'ledBar' || fixture.kind === 'ledTube') {
      const segments = Math.max(1, fixture.component.ledCellCount)
      const direction = fixture.component.ledDirection === 'rightToLeft' ? -1 : 1
      leds.push({
        id: `${fixture.id}-led`,
        position: { x: projected.x, y: projected.y, z: projected.clipDepth },
        color: fixture.color,
        intensity: clamp(fixture.intensity * fixture.optics.sourceIntensity, 0, 1.8),
        halfHeightCssPx: fixture.kind === 'ledTube' ? 3.6 : 4.4,
        aspect: fixture.kind === 'ledTube' ? 5.2 : 6.4,
        rotationRad,
        segments,
        behavior: ledBehavior(fixture.component.ledDirection, segments),
        phase: frame.transport.audioTimeSec * direction + frame.musicalState.beatPhase,
        gradient: fixture.component.ledDirection === 'centerOut' || fixture.component.ledDirection === 'edgesIn' ? 1 : 0.45,
        depthSlice,
        sortDepth: projected.clipDepth,
      })
      continue
    }

    if (fixture.kind === 'strobe' && strobeStrength > 0.001) {
      flashes.push({
        id: `${fixture.id}-strobe`, kind: 'strobe',
        position: { x: projected.x, y: projected.y, z: projected.clipDepth }, color: fixture.color,
        intensity: clamp(fixture.intensity * strobeStrength * 3.2, 0, 4), radiusCssPx: 18,
        aspect: 2.8, rotationRad, warmth: 0, atmosphereLift: 0.65, depthSlice, sortDepth: projected.clipDepth,
      })
      continue
    }

    if (fixture.kind === 'blinder') {
      const impulse = Math.max(blinderStrength, frame.musicalState.downbeat ? 0.72 : 0.28)
      flashes.push({
        id: `${fixture.id}-blinder`, kind: 'blinder',
        position: { x: projected.x, y: projected.y, z: projected.clipDepth }, color: fixture.color,
        intensity: clamp(fixture.intensity * impulse * 2.4, 0, 3.5), radiusCssPx: 24,
        aspect: 1.15, rotationRad, warmth: 0.38, atmosphereLift: 0.85, depthSlice, sortDepth: projected.clipDepth,
      })
      continue
    }

    if (fixture.kind === 'videoWall') {
      videoSurfaces.push({
        id: `${fixture.id}-video`, position: { x: projected.x, y: projected.y, z: projected.clipDepth },
        color: fixture.color,
        intensity: clamp(fixture.intensity * fixture.optics.sourceIntensity * fixture.component.videoWallBrightness, 0, 1.5),
        halfHeightCssPx: 38, aspect: 16 / 9, rotationRad,
        sourceVariant: VIDEO_INDEX[fixture.component.videoWallSource],
        phase: frame.transport.audioTimeSec * 0.18, depthSlice, sortDepth: projected.clipDepth,
      })
    }
  }

  const sort = <T extends { sortDepth: number; id: string }>(items: T[]) => items.sort((a, b) => a.sortDepth - b.sortDepth || a.id.localeCompare(b.id))
  return {
    movingHeads: sort(movingHeads),
    washes: sort(washes),
    leds: sort(leds),
    flashes: sort(flashes),
    videoSurfaces: sort(videoSurfaces),
    hazeSourceCount: frame.atmosphereSources.filter(source => source.kind === 'haze').length,
    co2SourceCount: frame.atmosphereSources.filter(source => source.kind === 'co2').length,
    universalRibbonFixtureCount: 0,
  }
}
