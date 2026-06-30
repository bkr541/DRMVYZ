import type { LaserDmxFixtureFrame, LaserDmxSettings } from '../ReactTypes'
import {
  isMovingHeadFixtureKind,
  normalizeProductionStageModel,
  type ProductionCameraView,
  type ProductionRig,
  type ProductionStageModel,
  type ProductionStageVector3,
  type ProductionTarget,
} from '../LaserDmxProductionRig'

type Vec3 = ProductionStageVector3

interface ProjectedPoint {
  x: number
  y: number
  depth: number
  scale: number
  visible: boolean
}

interface CameraBasis {
  position: Vec3
  right: Vec3
  up: Vec3
  forward: Vec3
  focalLength: number
  near: number
  far: number
  W: number
  H: number
}

export interface SpatialStageRenderInput {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  rig: ProductionRig
  settings: LaserDmxSettings
  frames: LaserDmxFixtureFrame[]
  glowAmount: number
  hazeAmount: number
}

const EPSILON = 1e-6

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function add(a: Vec3, b: Vec3): Vec3 { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z } }
function subtract(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z } }
function scale(a: Vec3, amount: number): Vec3 { return { x: a.x * amount, y: a.y * amount, z: a.z * amount } }
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z }
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}
function length(a: Vec3): number { return Math.hypot(a.x, a.y, a.z) }
function normalize(a: Vec3): Vec3 {
  const len = length(a)
  return len > EPSILON ? scale(a, 1 / len) : { x: 0, y: 0, z: 1 }
}

function buildCameraBasis(camera: ProductionCameraView, W: number, H: number): CameraBasis {
  const forward = normalize(subtract(camera.target, camera.position))
  let right = normalize(cross(forward, { x: 0, y: 1, z: 0 }))
  if (length(right) < EPSILON) right = { x: 1, y: 0, z: 0 }
  const up = normalize(cross(right, forward))
  const radians = Math.max(10, Math.min(120, camera.fieldOfViewDeg)) * Math.PI / 180
  const focalLength = (H * 0.5) / Math.tan(radians * 0.5)
  return {
    position: camera.position,
    right,
    up,
    forward,
    focalLength,
    near: Math.max(0.01, camera.near),
    far: Math.max(camera.near + 1, camera.far),
    W,
    H,
  }
}

export function projectProductionStagePoint(point: ProductionStageVector3, camera: ProductionCameraView, W: number, H: number): ProjectedPoint {
  const basis = buildCameraBasis(camera, W, H)
  return projectWithBasis(point, basis)
}

function projectWithBasis(point: Vec3, basis: CameraBasis): ProjectedPoint {
  const relative = subtract(point, basis.position)
  const depth = dot(relative, basis.forward)
  if (!Number.isFinite(depth) || depth <= basis.near || depth >= basis.far) {
    return { x: 0, y: 0, depth, scale: 0, visible: false }
  }
  const cameraX = dot(relative, basis.right)
  const cameraY = dot(relative, basis.up)
  const projectionScale = basis.focalLength / depth
  const x = basis.W * 0.5 + cameraX * projectionScale
  const y = basis.H * 0.5 - cameraY * projectionScale
  return {
    x,
    y,
    depth,
    scale: projectionScale,
    visible: Number.isFinite(x) && Number.isFinite(y) && x > -basis.W && x < basis.W * 2 && y > -basis.H && y < basis.H * 2,
  }
}

function drawWorldLine(
  ctx: CanvasRenderingContext2D,
  basis: CameraBasis,
  from: Vec3,
  to: Vec3,
  strokeStyle: string,
  alpha: number,
  width = 1,
): void {
  const a = projectWithBasis(from, basis)
  const b = projectWithBasis(to, basis)
  if (!a.visible || !b.visible) return
  ctx.save()
  ctx.strokeStyle = strokeStyle
  ctx.globalAlpha = alpha
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()
}

function drawFloorGrid(ctx: CanvasRenderingContext2D, basis: CameraBasis, stage: ProductionStageModel): void {
  if (!stage.floor.enabled) return
  const halfWidth = stage.floor.width / 2
  const depth = stage.floor.depth
  const y = stage.floor.elevation
  const divisionsX = stage.editor.qualityTier === 'low' ? 4 : stage.editor.qualityTier === 'medium' ? 8 : 12
  const divisionsZ = stage.editor.qualityTier === 'low' ? 4 : stage.editor.qualityTier === 'medium' ? 8 : 12

  const corners: Vec3[] = [
    { x: -halfWidth, y, z: 0 },
    { x: halfWidth, y, z: 0 },
    { x: halfWidth, y, z: depth },
    { x: -halfWidth, y, z: depth },
  ]
  const projected = corners.map(point => projectWithBasis(point, basis))
  if (projected.every(point => point.visible)) {
    ctx.save()
    const grad = ctx.createLinearGradient(0, basis.H, 0, basis.H * 0.25)
    grad.addColorStop(0, 'rgba(10,18,24,0.82)')
    grad.addColorStop(1, 'rgba(5,9,14,0.18)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(projected[0].x, projected[0].y)
    for (let i = 1; i < projected.length; i += 1) ctx.lineTo(projected[i].x, projected[i].y)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  for (let index = 0; index <= divisionsX; index += 1) {
    const x = -halfWidth + stage.floor.width * (index / divisionsX)
    drawWorldLine(ctx, basis, { x, y, z: 0 }, { x, y, z: depth }, '#47606d', 0.24)
  }
  for (let index = 0; index <= divisionsZ; index += 1) {
    const z = depth * (index / divisionsZ)
    drawWorldLine(ctx, basis, { x: -halfWidth, y, z }, { x: halfWidth, y, z }, '#47606d', 0.22)
  }
}

function drawAudienceRegion(ctx: CanvasRenderingContext2D, basis: CameraBasis, stage: ProductionStageModel): void {
  if (!stage.audience.enabled || !stage.editor.guidesVisible) return
  const halfX = stage.audience.size.x / 2
  const halfZ = stage.audience.size.z / 2
  const y = stage.audience.center.y
  const points = [
    { x: stage.audience.center.x - halfX, y, z: stage.audience.center.z - halfZ },
    { x: stage.audience.center.x + halfX, y, z: stage.audience.center.z - halfZ },
    { x: stage.audience.center.x + halfX, y, z: stage.audience.center.z + halfZ },
    { x: stage.audience.center.x - halfX, y, z: stage.audience.center.z + halfZ },
  ]
  for (let index = 0; index < points.length; index += 1) {
    drawWorldLine(ctx, basis, points[index], points[(index + 1) % points.length], '#4ac7db', 0.28, 1)
  }
}

function drawMounts(ctx: CanvasRenderingContext2D, basis: CameraBasis, stage: ProductionStageModel): void {
  if (!stage.editor.guidesVisible) return
  for (const surface of stage.mountingSurfaces) {
    drawWorldLine(ctx, basis, surface.start, surface.end, '#8f9ba4', 0.62, surface.kind === 'trussLine' ? 3 : 1)
    if (surface.kind === 'trussLine') {
      const span = subtract(surface.end, surface.start)
      const count = Math.max(2, Math.round(length(span)))
      for (let index = 0; index <= count; index += 1) {
        const point = add(surface.start, scale(span, index / count))
        const projected = projectWithBasis(point, basis)
        if (!projected.visible) continue
        ctx.save()
        ctx.globalAlpha = 0.52
        ctx.fillStyle = '#b9c4ca'
        ctx.beginPath()
        ctx.arc(projected.x, projected.y, Math.max(1, Math.min(3, projected.scale * 0.025)), 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
  }
}

function drawZones(ctx: CanvasRenderingContext2D, basis: CameraBasis, stage: ProductionStageModel): void {
  if (!stage.editor.guidesVisible) return
  for (const zone of stage.spatialZones) {
    const projected = projectWithBasis(zone.center, basis)
    if (!projected.visible) continue
    const radius = Math.max(4, Math.min(80, Math.max(zone.size.x, zone.size.y, zone.size.z) * projected.scale * 0.4))
    ctx.save()
    ctx.strokeStyle = zone.kind === 'excluded' ? '#d85b67' : '#61d6aa'
    ctx.globalAlpha = 0.42
    ctx.setLineDash(zone.kind === 'excluded' ? [5, 4] : [2, 4])
    ctx.lineWidth = 1
    if (zone.shape === 'sphere') {
      ctx.beginPath()
      ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.strokeRect(projected.x - radius, projected.y - radius * 0.5, radius * 2, radius)
    }
    ctx.restore()
  }
}

function targetPosition(target: ProductionTarget | undefined): Vec3 | null {
  if (!target) return null
  return target.kind === 'point' ? target.position : target.center
}

function patternPointToWorld(
  point: { x: number; y: number },
  compiledTarget: { x: number; y: number },
  target: Vec3,
  stage: ProductionStageModel,
  W: number,
  H: number,
): Vec3 {
  const dx = W > 0 ? (point.x - compiledTarget.x) / W * stage.dimensions.width : 0
  const dy = H > 0 ? -(point.y - compiledTarget.y) / H * stage.dimensions.height : 0
  return { x: target.x + dx, y: target.y + dy, z: target.z }
}

function drawPerspectiveBeam(
  ctx: CanvasRenderingContext2D,
  basis: CameraBasis,
  origin: Vec3,
  target: Vec3,
  color: string,
  intensity: number,
  beamWidth: number,
  glow: number,
  haze: number,
): void {
  const a = projectWithBasis(origin, basis)
  const b = projectWithBasis(target, basis)
  if (!a.visible || !b.visible || intensity < 0.001) return
  const depthScale = Math.max(0.35, Math.min(2.5, (a.scale + b.scale) * 0.035))
  const width = Math.max(0.45, beamWidth * depthScale)
  const alpha = clamp01(intensity)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha * (0.08 + haze * 0.18) * glow
  ctx.lineWidth = width * (5 + haze * 7) * glow
  ctx.shadowColor = color
  ctx.shadowBlur = 16 * glow
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha * 0.72
  ctx.lineWidth = width * 1.8
  ctx.shadowColor = color
  ctx.shadowBlur = 8 * glow
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.82).toFixed(3)})`
  ctx.lineWidth = Math.max(0.45, width * 0.28)
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()
}

function drawBeamEndDot(
  ctx: CanvasRenderingContext2D,
  basis: CameraBasis,
  point: Vec3,
  color: string,
  intensity: number,
  width: number,
  glow: number,
): void {
  const projected = projectWithBasis(point, basis)
  if (!projected.visible) return
  const radius = Math.max(0.8, Math.min(8, width * projected.scale * 0.055))
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = clamp01(intensity)
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 12 * glow
  ctx.beginPath()
  ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPathGuidePoint(ctx: CanvasRenderingContext2D, basis: CameraBasis, point: Vec3): void {
  const projected = projectWithBasis(point, basis)
  if (!projected.visible) return
  ctx.save()
  ctx.globalAlpha = 0.55
  ctx.fillStyle = '#ffff00'
  ctx.beginPath()
  ctx.arc(projected.x, projected.y, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawFixtureOrigin(ctx: CanvasRenderingContext2D, basis: CameraBasis, point: Vec3, selected: boolean): void {
  const projected = projectWithBasis(point, basis)
  if (!projected.visible) return
  const radius = Math.max(3, Math.min(9, projected.scale * 0.07))
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = selected ? '#ffffff' : '#7e97a4'
  ctx.fillStyle = selected ? 'rgba(255,255,255,0.18)' : 'rgba(80,110,125,0.14)'
  ctx.globalAlpha = selected ? 0.9 : 0.55
  ctx.lineWidth = selected ? 2 : 1
  ctx.beginPath()
  ctx.arc(projected.x, projected.y, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawGoboProjection(
  ctx: CanvasRenderingContext2D,
  basis: CameraBasis,
  target: Vec3,
  color: string,
  intensity: number,
  radiusWorld: number,
  goboIndex: number,
  rotationDeg: number,
): void {
  if (goboIndex <= 0 || intensity <= 0.001) return
  const projected = projectWithBasis(target, basis)
  if (!projected.visible) return
  const radius = Math.max(2, Math.min(48, radiusWorld * projected.scale))
  const sides = [0, 24, 4, 3, 5, 6][goboIndex % 6] ?? 5
  ctx.save()
  ctx.translate(projected.x, projected.y)
  ctx.rotate(rotationDeg * Math.PI / 180)
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.globalAlpha = clamp01(intensity) * 0.62
  ctx.lineWidth = Math.max(0.75, radius * 0.08)
  if (sides === 24) {
    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        ctx.beginPath()
        ctx.arc(x * radius * 0.55, y * radius * 0.55, radius * 0.12, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else {
    ctx.beginPath()
    for (let index = 0; index < sides; index += 1) {
      const angle = -Math.PI / 2 + index / sides * Math.PI * 2
      const r = sides === 5 && index % 2 === 1 ? radius * 0.45 : radius
      const x = Math.cos(angle) * r
      const y = Math.sin(angle) * r
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  }
  ctx.restore()
}

function drawMovingHeadFixture(
  ctx: CanvasRenderingContext2D,
  basis: CameraBasis,
  fixture: ProductionRig['fixtures'][number],
  frame: LaserDmxFixtureFrame,
  haze: number,
  glow: number,
): void {
  const movingHead = frame.visual.movingHead
  if (!movingHead) return
  const origin = fixture.transform.position
  const target = movingHead.worldTarget
  const irisScale = 0.2 + 0.8 * clamp01(movingHead.iris)
  const zoom = clamp01(movingHead.zoom)
  const frost = clamp01(movingHead.frost)
  const focus = clamp01(movingHead.focus)
  const kindScale = fixture.kind === 'movingHeadWash'
    ? 5.5 + zoom * 8
    : fixture.kind === 'movingHeadSpot'
      ? 1.8 + zoom * 4.2
      : 0.7 + zoom * 1.8
  const beamWidth = frame.visual.beamWidth * kindScale * irisScale * (1 + frost * 1.7)
  const opticalGlow = clamp01(glow * (0.5 + frost * 0.8 + (1 - focus) * 0.35))
  const opticalHaze = clamp01(haze + frost * 0.35)
  const facets = Math.max(0, Math.min(12, Math.round(movingHead.prismFacets)))

  if (fixture.kind === 'movingHeadWash') {
    const washRadius = 0.3 + zoom * 1.6
    for (let index = 0; index < 7; index += 1) {
      const angle = index / 7 * Math.PI * 2
      const washTarget = index === 0 ? target : {
        x: target.x + Math.cos(angle) * washRadius,
        y: target.y + Math.sin(angle) * washRadius * 0.55,
        z: target.z,
      }
      drawPerspectiveBeam(ctx, basis, origin, washTarget, frame.visual.color, frame.visual.intensity * (index === 0 ? 0.62 : 0.18), beamWidth, opticalGlow, opticalHaze)
    }
  } else if (facets >= 2) {
    const prismRadius = (0.12 + zoom * 0.55) * Math.max(1, facets / 3)
    const rotation = movingHead.prismRotation * Math.PI / 180
    for (let index = 0; index < facets; index += 1) {
      const angle = rotation + index / facets * Math.PI * 2
      const prismTarget = {
        x: target.x + Math.cos(angle) * prismRadius,
        y: target.y + Math.sin(angle) * prismRadius,
        z: target.z,
      }
      drawPerspectiveBeam(ctx, basis, origin, prismTarget, frame.visual.color, frame.visual.intensity * 0.72, beamWidth * 0.72, opticalGlow, opticalHaze)
      drawBeamEndDot(ctx, basis, prismTarget, frame.visual.color, frame.visual.intensity * 0.7, beamWidth, opticalGlow)
    }
  } else {
    drawPerspectiveBeam(ctx, basis, origin, target, frame.visual.color, frame.visual.intensity * frame.visual.rgba.a, beamWidth, opticalGlow, opticalHaze)
  }

  drawBeamEndDot(ctx, basis, target, frame.visual.color, frame.visual.intensity * frame.visual.rgba.a, beamWidth, opticalGlow)
  drawGoboProjection(
    ctx,
    basis,
    target,
    frame.visual.color,
    frame.visual.intensity * frame.visual.rgba.a,
    0.08 + zoom * 0.35,
    movingHead.goboIndex,
    movingHead.goboRotation,
  )
}

export function renderLaserDmxSpatialStage(input: SpatialStageRenderInput): void {
  const { ctx, W, H, rig, settings, frames } = input
  const stage = normalizeProductionStageModel(rig.stage)
  const basis = buildCameraBasis(stage.camera, W, H)

  drawFloorGrid(ctx, basis, stage)
  drawAudienceRegion(ctx, basis, stage)
  drawMounts(ctx, basis, stage)
  drawZones(ctx, basis, stage)

  const fixtureById = new Map(rig.fixtures.map(fixture => [fixture.id, fixture]))
  const sourceFixtureById = new Map(settings.fixtures.map(fixture => [fixture.id, fixture]))
  const targetById = new Map(rig.targets.map(target => [target.id, target]))
  const maxPoints = stage.editor.qualityTier === 'low' ? 24 : stage.editor.qualityTier === 'medium' ? 56 : 120
  const haze = clamp01(input.hazeAmount)
  const glow = clamp01(input.glowAmount)

  const ordered = frames
    .map(frame => ({ frame, fixture: fixtureById.get(frame.fixtureId) }))
    .filter((entry): entry is { frame: LaserDmxFixtureFrame; fixture: ProductionRig['fixtures'][number] } => Boolean(entry.fixture))
    .sort((a, b) => {
      const aDepth = projectWithBasis(a.fixture.transform.position, basis).depth
      const bDepth = projectWithBasis(b.fixture.transform.position, basis).depth
      return bDepth - aDepth
    })

  for (const { frame, fixture } of ordered) {
    if (!frame.visual.strobeVisible || frame.visual.intensity < 0.001) continue
    const sourceFixture = sourceFixtureById.get(fixture.id)
    if (isMovingHeadFixtureKind(fixture.kind) && frame.visual.movingHead) {
      drawMovingHeadFixture(ctx, basis, fixture, frame, haze, glow)
      if (settings.showFixtureOrigins || stage.editor.guidesVisible) {
        drawFixtureOrigin(ctx, basis, fixture.transform.position, fixture.id === settings.selectedFixtureId)
      }
      continue
    }
    const explicitTarget = sourceFixture?.targetId
      ? targetPosition(targetById.get(sourceFixture.targetId))
      : null
    const fallbackTarget = {
      x: (frame.visual.target.x / Math.max(1, W) - 0.5) * stage.dimensions.width,
      y: (1 - frame.visual.target.y / Math.max(1, H)) * stage.dimensions.height,
      z: stage.dimensions.depth * 0.5,
    }
    const resolvedTarget = explicitTarget ?? fallbackTarget
    const points = frame.visual.points.length > maxPoints
      ? frame.visual.points.filter((_, index) => index % Math.ceil(frame.visual.points.length / maxPoints) === 0)
      : frame.visual.points

    const pathKind = sourceFixture?.path.kind ?? 'staticBeam'
    const connected = new Set(['circle', 'spiral', 'lissajous', 'grid', 'constellation', 'tunnel', 'svgPath', 'textPath']).has(pathKind)
    const focusedGlow = glow * (1 - 0.85 * clamp01(frame.visual.focusFactor))
    const rollRad = fixture.transform.orientation.rollDeg * Math.PI / 180
    const cosRoll = Math.cos(rollRad)
    const sinRoll = Math.sin(rollRad)
    const worldPoints = points.map(point => {
      const world = patternPointToWorld(point, frame.visual.target, resolvedTarget, stage, W, H)
      const dx = world.x - resolvedTarget.x
      const dy = world.y - resolvedTarget.y
      return {
        x: resolvedTarget.x + dx * cosRoll - dy * sinRoll,
        y: resolvedTarget.y + dx * sinRoll + dy * cosRoll,
        z: world.z,
      }
    })

    if (connected && worldPoints.length > 1) {
      drawPerspectiveBeam(ctx, basis, fixture.transform.position, worldPoints[0], frame.visual.color, frame.visual.intensity * 0.6, frame.visual.beamWidth, focusedGlow, haze)
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.strokeStyle = frame.visual.color
      ctx.globalAlpha = clamp01(frame.visual.intensity * frame.visual.rgba.a * 0.72)
      ctx.lineWidth = Math.max(0.5, frame.visual.beamWidth)
      ctx.shadowColor = frame.visual.color
      ctx.shadowBlur = 9 * focusedGlow
      ctx.beginPath()
      let started = false
      for (const point of worldPoints) {
        const projected = projectWithBasis(point, basis)
        if (!projected.visible) continue
        if (!started) { ctx.moveTo(projected.x, projected.y); started = true } else ctx.lineTo(projected.x, projected.y)
      }
      if (started) ctx.stroke()
      ctx.restore()
      if (settings.showPathPoints) {
        for (const point of worldPoints) drawPathGuidePoint(ctx, basis, point)
      }
    } else {
      for (const point of worldPoints) {
        drawPerspectiveBeam(ctx, basis, fixture.transform.position, point, frame.visual.color, frame.visual.intensity * frame.visual.rgba.a, frame.visual.beamWidth, focusedGlow, haze)
        if (settings.showPathPoints) drawPathGuidePoint(ctx, basis, point)
      }
    }

    for (const point of worldPoints) {
      drawBeamEndDot(
        ctx,
        basis,
        point,
        frame.visual.color,
        frame.visual.intensity * frame.visual.rgba.a * 0.9,
        frame.visual.beamWidth,
        focusedGlow,
      )
    }

    if (settings.showFixtureOrigins || stage.editor.guidesVisible) {
      drawFixtureOrigin(ctx, basis, fixture.transform.position, fixture.id === settings.selectedFixtureId)
    }
  }
}
