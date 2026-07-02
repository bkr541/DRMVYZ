import type { LaserDmxFixtureFrame, LaserDmxSettings } from '../ReactTypes'
import type { ProductionAtmosphereFrame } from './LaserDmxAtmosphereEngine'
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
  pixelScale: number
}

export interface SpatialStageRenderInput {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  /** Device-pixel ratio used for fixed-size strokes and editor affordances. */
  dpr?: number
  rig: ProductionRig
  settings: LaserDmxSettings
  frames: LaserDmxFixtureFrame[]
  glowAmount: number
  hazeAmount: number
  atmosphere: ProductionAtmosphereFrame
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

export function resolveSpatialStagePixelScale(dpr: number | undefined): number {
  return Number.isFinite(dpr) ? Math.max(1, Math.min(4, dpr!)) : 1
}

export function resolveSpatialStagePreviewZoom(zoom: number | undefined): number {
  return Number.isFinite(zoom) ? Math.max(0.5, Math.min(3, zoom!)) : 1
}

export function shouldRenderSpatialStageEditorGuides(stage: Pick<ProductionStageModel, 'editor'>): boolean {
  return stage.editor.guidesVisible
}

function buildCameraBasis(camera: ProductionCameraView, W: number, H: number, dpr = 1, previewZoom = 1): CameraBasis {
  const forward = normalize(subtract(camera.target, camera.position))
  let right = normalize(cross(forward, { x: 0, y: 1, z: 0 }))
  if (length(right) < EPSILON) right = { x: 1, y: 0, z: 0 }
  const up = normalize(cross(right, forward))
  const radians = Math.max(10, Math.min(120, camera.fieldOfViewDeg)) * Math.PI / 180
  const focalLength = ((H * 0.5) / Math.tan(radians * 0.5)) * resolveSpatialStagePreviewZoom(previewZoom)
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
    pixelScale: resolveSpatialStagePixelScale(dpr),
  }
}

export function projectProductionStagePoint(
  point: ProductionStageVector3,
  camera: ProductionCameraView,
  W: number,
  H: number,
  previewZoom = 1,
): ProjectedPoint {
  const basis = buildCameraBasis(camera, W, H, 1, previewZoom)
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
  ctx.lineWidth = width * basis.pixelScale
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()
}

function drawFloorGrid(ctx: CanvasRenderingContext2D, basis: CameraBasis, stage: ProductionStageModel): void {
  if (!shouldRenderSpatialStageEditorGuides(stage) || !stage.floor.enabled) return
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
        ctx.arc(projected.x, projected.y, Math.max(basis.pixelScale, Math.min(3 * basis.pixelScale, projected.scale * 0.025)), 0, Math.PI * 2)
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
    const radius = Math.max(4 * basis.pixelScale, Math.min(80 * basis.pixelScale, Math.max(zone.size.x, zone.size.y, zone.size.z) * projected.scale * 0.4))
    ctx.save()
    ctx.strokeStyle = zone.kind === 'excluded' ? '#d85b67' : '#61d6aa'
    ctx.globalAlpha = 0.42
    ctx.setLineDash((zone.kind === 'excluded' ? [5, 4] : [2, 4]).map(value => value * basis.pixelScale))
    ctx.lineWidth = basis.pixelScale
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
  const width = Math.max(0.45 * basis.pixelScale, beamWidth * depthScale)
  const alpha = clamp01(intensity)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.globalAlpha = alpha * (0.08 + haze * 0.18) * glow
  ctx.lineWidth = width * (5 + haze * 7) * glow
  ctx.shadowColor = color
  ctx.shadowBlur = 16 * glow * basis.pixelScale
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
  ctx.shadowBlur = 8 * glow * basis.pixelScale
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.82).toFixed(3)})`
  ctx.lineWidth = Math.max(0.45 * basis.pixelScale, width * 0.28)
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
  const radius = Math.max(0.8 * basis.pixelScale, Math.min(8 * basis.pixelScale, width * projected.scale * 0.055))
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = clamp01(intensity)
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 12 * glow * basis.pixelScale
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
  ctx.arc(projected.x, projected.y, 2 * basis.pixelScale, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawFixtureOrigin(ctx: CanvasRenderingContext2D, basis: CameraBasis, point: Vec3, selected: boolean): void {
  const projected = projectWithBasis(point, basis)
  if (!projected.visible) return
  const radius = Math.max(3 * basis.pixelScale, Math.min(9 * basis.pixelScale, projected.scale * 0.07))
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = selected ? '#ffffff' : '#7e97a4'
  ctx.fillStyle = selected ? 'rgba(255,255,255,0.18)' : 'rgba(80,110,125,0.14)'
  ctx.globalAlpha = selected ? 0.9 : 0.55
  ctx.lineWidth = (selected ? 2 : 1) * basis.pixelScale
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


function drawWashFixture(
  ctx: CanvasRenderingContext2D,
  basis: CameraBasis,
  fixture: ProductionRig['fixtures'][number],
  frame: LaserDmxFixtureFrame,
  haze: number,
  glow: number,
  quality: ProductionStageModel['editor']['qualityTier'],
): void {
  const wash = frame.visual.wash
  if (!wash || frame.visual.intensity < 0.001) return
  const origin = projectWithBasis(fixture.transform.position, basis)
  const target = projectWithBasis(wash.worldTarget, basis)
  if (!origin.visible || !target.visible) return
  const radius = Math.max(10, Math.min(260, (0.45 + wash.spread * 2.2) * target.scale * 0.22))
  const softness = clamp01(wash.softness)
  const alpha = clamp01(frame.visual.intensity * frame.visual.rgba.a)
  const rgb = `${frame.visual.rgba.r},${frame.visual.rgba.g},${frame.visual.rgba.b}`

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const volume = ctx.createLinearGradient(origin.x, origin.y, target.x, target.y)
  volume.addColorStop(0, `rgba(${rgb},${(alpha * 0.18 * wash.atmosphericIntensity * haze).toFixed(3)})`)
  volume.addColorStop(1, `rgba(${rgb},${(alpha * 0.04 * wash.atmosphericIntensity * haze).toFixed(3)})`)
  ctx.fillStyle = volume
  ctx.beginPath()
  ctx.moveTo(origin.x, origin.y)
  ctx.lineTo(target.x - radius, target.y)
  ctx.quadraticCurveTo(target.x, target.y + radius * 0.35, target.x + radius, target.y)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  const layers = quality === 'low' ? 1 : quality === 'medium' ? 2 : 3
  for (let layer = layers; layer >= 1; layer -= 1) {
    const layerScale = layer / layers
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const gradient = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, radius * layerScale)
    gradient.addColorStop(0, `rgba(${rgb},${(alpha * (0.22 + glow * 0.18)).toFixed(3)})`)
    gradient.addColorStop(Math.max(0.05, 0.5 - softness * 0.25), `rgba(${rgb},${(alpha * 0.1).toFixed(3)})`)
    gradient.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(target.x, target.y, radius * layerScale, radius * (0.28 + softness * 0.28) * layerScale, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function drawStrobePanel(
  ctx: CanvasRenderingContext2D,
  basis: CameraBasis,
  fixture: ProductionRig['fixtures'][number],
  frame: LaserDmxFixtureFrame,
  glow: number,
): void {
  const projected = projectWithBasis(fixture.transform.position, basis)
  if (!projected.visible || frame.visual.intensity < 0.001) return
  const alpha = clamp01(frame.visual.intensity * frame.visual.rgba.a)
  const rgb = `${frame.visual.rgba.r},${frame.visual.rgba.g},${frame.visual.rgba.b}`
  const width = Math.max(12 * basis.pixelScale, Math.min(90 * basis.pixelScale, projected.scale * 0.42))
  const height = width * 0.34

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.shadowColor = frame.visual.color
  ctx.shadowBlur = (28 + glow * 42) * basis.pixelScale
  ctx.fillStyle = `rgba(${rgb},${Math.min(1, alpha * 0.95).toFixed(3)})`
  ctx.fillRect(projected.x - width / 2, projected.y - height / 2, width, height)
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const bloom = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, width * 2.6)
  bloom.addColorStop(0, `rgba(${rgb},${(alpha * 0.55).toFixed(3)})`)
  bloom.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = bloom
  ctx.fillRect(projected.x - width * 2.6, projected.y - width * 2.6, width * 5.2, width * 5.2)
  ctx.restore()

  if (frame.visual.flash?.pattern === 'fullStageWhiteout' && alpha > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.72, alpha * 0.52).toFixed(3)})`
    ctx.fillRect(0, 0, basis.W, basis.H)
    ctx.restore()
  }
}

function drawAudienceBlinder(
  ctx: CanvasRenderingContext2D,
  basis: CameraBasis,
  fixture: ProductionRig['fixtures'][number],
  frame: LaserDmxFixtureFrame,
  glow: number,
): void {
  drawStrobePanel(ctx, basis, fixture, frame, glow)
  const wash = frame.visual.wash
  if (!wash) return
  const origin = projectWithBasis(fixture.transform.position, basis)
  const target = projectWithBasis(wash.worldTarget, basis)
  if (!origin.visible || !target.visible) return
  const alpha = clamp01(frame.visual.intensity * frame.visual.rgba.a)
  const rgb = `${frame.visual.rgba.r},${frame.visual.rgba.g},${frame.visual.rgba.b}`
  const width = Math.max(30, Math.min(300, target.scale * (1.2 + wash.spread * 2.5)))
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  const gradient = ctx.createLinearGradient(origin.x, origin.y, target.x, target.y)
  gradient.addColorStop(0, `rgba(${rgb},${(alpha * 0.24).toFixed(3)})`)
  gradient.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.moveTo(origin.x, origin.y)
  ctx.lineTo(target.x - width, target.y + width * 0.22)
  ctx.lineTo(target.x + width, target.y + width * 0.22)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawLedBarFixture(
  ctx: CanvasRenderingContext2D,
  basis: CameraBasis,
  fixture: ProductionRig['fixtures'][number],
  frame: LaserDmxFixtureFrame,
  glow: number,
): void {
  const ledBar = frame.visual.ledBar
  if (!ledBar || ledBar.segmentColors.length === 0) return
  const count = ledBar.segmentColors.length
  const roll = fixture.transform.orientation.rollDeg * Math.PI / 180
  const halfLength = 1.25
  const axis = { x: Math.cos(roll), y: Math.sin(roll), z: 0 }
  for (let index = 0; index < count; index += 1) {
    const t0 = index / count - 0.5
    const t1 = (index + 1) / count - 0.5
    const a = add(fixture.transform.position, scale(axis, t0 * halfLength * 2))
    const b = add(fixture.transform.position, scale(axis, t1 * halfLength * 2))
    const pa = projectWithBasis(a, basis)
    const pb = projectWithBasis(b, basis)
    if (!pa.visible || !pb.visible) continue
    const intensity = clamp01(ledBar.segmentIntensities[index] ?? 0)
    if (intensity < 0.001) continue
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.strokeStyle = ledBar.segmentColors[index]
    ctx.globalAlpha = intensity
    ctx.lineCap = 'butt'
    ctx.lineWidth = Math.max(4 * basis.pixelScale, Math.min(24 * basis.pixelScale, (pa.scale + pb.scale) * 0.055))
    ctx.shadowColor = ledBar.segmentColors[index]
    ctx.shadowBlur = (10 + glow * 20) * basis.pixelScale
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
    ctx.restore()
  }
}

function drawProductionAtmosphere(
  ctx: CanvasRenderingContext2D,
  basis: CameraBasis,
  frame: ProductionAtmosphereFrame,
  fixtureFrames: LaserDmxFixtureFrame[],
): void {
  const haze = frame.settings.persistentHaze
  if (haze.enabled && haze.baseDensity > 0.001) {
    const layers = frame.settings.qualityTier === 'low' ? 2 : frame.settings.qualityTier === 'high' ? 5 : 3
    const ventilation = 1 - haze.ventilation * 0.72
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let index = 0; index < layers; index += 1) {
      const y = basis.H * (0.2 + (index / Math.max(1, layers - 1)) * 0.72)
      const radiusX = basis.W * (0.55 + haze.diffusion * 0.35)
      const radiusY = basis.H * (0.16 + haze.heightDistribution * 0.22)
      const driftPhase = frame.timeSec * haze.driftSpeed * 0.55 + haze.driftDirectionDeg * Math.PI / 180
      const turbulencePhase = frame.timeSec * (0.18 + haze.turbulence * 0.85) + index * 2.31
      const centerX = basis.W * 0.5
        + Math.cos(driftPhase) * basis.W * haze.driftSpeed * 0.08
        + Math.sin(turbulencePhase) * basis.W * haze.turbulence * 0.025
      const centerY = y + Math.cos(turbulencePhase * 0.73) * basis.H * haze.turbulence * 0.018
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, basis.W * 0.5, y, radiusX)
      const alpha = haze.baseDensity * ventilation * (0.035 + haze.diffusion * 0.035) * (0.9 + Math.sin(turbulencePhase) * haze.turbulence * 0.1) / layers
      gradient.addColorStop(0, `rgba(170,188,196,${alpha.toFixed(4)})`)
      gradient.addColorStop(1, 'rgba(90,110,120,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(-radiusX * 0.2, y - radiusY, basis.W + radiusX * 0.4, radiusY * 2)
    }
    ctx.restore()
  }

  if (frame.particles.length === 0) return
  const brightest = fixtureFrames.reduce<LaserDmxFixtureFrame | null>((best, candidate) => {
    if (!candidate.visual.strobeVisible) return best
    return !best || candidate.visual.intensity > best.visual.intensity ? candidate : best
  }, null)
  const tint = brightest?.visual.rgba ?? { r: 210, g: 230, b: 238, a: 1 }
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (const particle of frame.particles) {
    const projected = projectWithBasis(particle.position, basis)
    if (!projected.visible || particle.density < 0.002) continue
    const radius = Math.max(2 * basis.pixelScale, Math.min(90 * basis.pixelScale, particle.radius * projected.scale * (particle.medium === 'cryo' ? 0.75 : 1.15)))
    const alpha = clamp01(particle.density * (particle.medium === 'cryo' ? 0.42 : 0.24))
    const gradient = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, radius)
    gradient.addColorStop(0, `rgba(${tint.r},${tint.g},${tint.b},${alpha.toFixed(3)})`)
    gradient.addColorStop(0.45, `rgba(210,225,232,${(alpha * 0.48).toFixed(3)})`)
    gradient.addColorStop(1, 'rgba(180,200,210,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(projected.x - radius, projected.y - radius, radius * 2, radius * 2)
  }
  ctx.restore()
}

export function renderLaserDmxSpatialStage(input: SpatialStageRenderInput): void {
  const { ctx, W, H, rig, settings, frames } = input
  const stage = normalizeProductionStageModel(rig.stage)
  const basis = buildCameraBasis(stage.camera, W, H, input.dpr, stage.previewZoom)

  drawFloorGrid(ctx, basis, stage)
  drawAudienceRegion(ctx, basis, stage)
  drawMounts(ctx, basis, stage)
  drawZones(ctx, basis, stage)
  drawProductionAtmosphere(ctx, basis, input.atmosphere, frames)

  const fixtureById = new Map(rig.fixtures.map(fixture => [fixture.id, fixture]))
  const sourceFixtureById = new Map(settings.fixtures.map(fixture => [fixture.id, fixture]))
  const targetById = new Map(rig.targets.map(target => [target.id, target]))
  const maxPoints = stage.editor.qualityTier === 'low' ? 24 : stage.editor.qualityTier === 'medium' ? 56 : 120
  const haze = clamp01(input.hazeAmount + input.atmosphere.settings.persistentHaze.baseDensity * input.atmosphere.settings.persistentHaze.beamScatter * 0.55 + input.atmosphere.localHazeDensity * 0.45 + Math.min(0.35, input.atmosphere.particles.length / Math.max(1, input.atmosphere.budget) * 0.35))
  const glow = clamp01(input.glowAmount)

  const ordered = frames
    .map(frame => ({ frame, fixture: fixtureById.get(frame.fixtureId) }))
    .filter((entry): entry is { frame: LaserDmxFixtureFrame; fixture: ProductionRig['fixtures'][number] } => Boolean(entry.fixture))
    .sort((a, b) => {
      const aDepth = projectWithBasis(a.fixture.transform.position, basis).depth
      const bDepth = projectWithBasis(b.fixture.transform.position, basis).depth
      return bDepth - aDepth
    })

  if (shouldRenderSpatialStageEditorGuides(stage)) {
    for (const fixture of rig.fixtures) {
      if (fixture.kind !== 'hazer' && fixture.kind !== 'fogger' && fixture.kind !== 'cryoJet') continue
      const projected = projectWithBasis(fixture.transform.position, basis)
      if (!projected.visible) continue
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.strokeStyle = fixture.kind === 'cryoJet' ? '#d8f6ff' : fixture.kind === 'fogger' ? '#9bb8c5' : '#77a6b8'
      ctx.fillStyle = 'rgba(120,160,175,0.18)'
      ctx.globalAlpha = fixture.id === settings.selectedFixtureId ? 1 : 0.72
      ctx.beginPath()
      const iconWidth = 14 * basis.pixelScale
      const iconHeight = 8 * basis.pixelScale
      ctx.rect(projected.x - iconWidth / 2, projected.y - iconHeight / 2, iconWidth, iconHeight)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(projected.x, projected.y - 5 * basis.pixelScale)
      ctx.lineTo(projected.x, projected.y - (fixture.kind === 'cryoJet' ? 24 : 15) * basis.pixelScale)
      ctx.stroke()
      ctx.restore()
      if (settings.showFixtureOrigins) {
        drawFixtureOrigin(ctx, basis, fixture.transform.position, fixture.id === settings.selectedFixtureId)
      }
    }
  }

  for (const { frame, fixture } of ordered) {
    if (!frame.visual.strobeVisible || frame.visual.intensity < 0.001) continue
    const sourceFixture = sourceFixtureById.get(fixture.id)
    if (isMovingHeadFixtureKind(fixture.kind) && frame.visual.movingHead) {
      drawMovingHeadFixture(ctx, basis, fixture, frame, haze, glow)
      if (frame.visual.wash) drawWashFixture(ctx, basis, fixture, frame, haze, glow, stage.editor.qualityTier)
      if (stage.editor.guidesVisible && settings.showFixtureOrigins) {
        drawFixtureOrigin(ctx, basis, fixture.transform.position, fixture.id === settings.selectedFixtureId)
      }
      continue
    }
    if (fixture.kind === 'strobe') {
      drawStrobePanel(ctx, basis, fixture, frame, glow)
      if (stage.editor.guidesVisible && settings.showFixtureOrigins) drawFixtureOrigin(ctx, basis, fixture.transform.position, fixture.id === settings.selectedFixtureId)
      continue
    }
    if (fixture.kind === 'blinder') {
      drawAudienceBlinder(ctx, basis, fixture, frame, glow)
      if (stage.editor.guidesVisible && settings.showFixtureOrigins) drawFixtureOrigin(ctx, basis, fixture.transform.position, fixture.id === settings.selectedFixtureId)
      continue
    }
    if (fixture.kind === 'staticWash') {
      drawWashFixture(ctx, basis, fixture, frame, haze, glow, stage.editor.qualityTier)
      if (stage.editor.guidesVisible && settings.showFixtureOrigins) drawFixtureOrigin(ctx, basis, fixture.transform.position, fixture.id === settings.selectedFixtureId)
      continue
    }
    if (fixture.kind === 'ledBar') {
      drawLedBarFixture(ctx, basis, fixture, frame, glow)
      if (stage.editor.guidesVisible && settings.showFixtureOrigins) drawFixtureOrigin(ctx, basis, fixture.transform.position, fixture.id === settings.selectedFixtureId)
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
      ctx.lineWidth = Math.max(0.5 * basis.pixelScale, frame.visual.beamWidth * basis.pixelScale)
      ctx.shadowColor = frame.visual.color
      ctx.shadowBlur = 9 * focusedGlow * basis.pixelScale
      ctx.beginPath()
      let started = false
      for (const point of worldPoints) {
        const projected = projectWithBasis(point, basis)
        if (!projected.visible) continue
        if (!started) { ctx.moveTo(projected.x, projected.y); started = true } else ctx.lineTo(projected.x, projected.y)
      }
      if (started) ctx.stroke()
      ctx.restore()
      if (stage.editor.guidesVisible && settings.showPathPoints) {
        for (const point of worldPoints) drawPathGuidePoint(ctx, basis, point)
      }
    } else {
      for (const point of worldPoints) {
        drawPerspectiveBeam(ctx, basis, fixture.transform.position, point, frame.visual.color, frame.visual.intensity * frame.visual.rgba.a, frame.visual.beamWidth, focusedGlow, haze)
        if (stage.editor.guidesVisible && settings.showPathPoints) drawPathGuidePoint(ctx, basis, point)
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

    if (stage.editor.guidesVisible && settings.showFixtureOrigins) {
      drawFixtureOrigin(ctx, basis, fixture.transform.position, fixture.id === settings.selectedFixtureId)
    }
  }
}
