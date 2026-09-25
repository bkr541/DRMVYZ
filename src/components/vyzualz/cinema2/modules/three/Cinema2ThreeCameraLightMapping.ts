import type * as ThreeNamespace from 'three'
import type { Cinema2CameraFrame } from '../../spatial/Cinema2CameraRuntime'
import type { Cinema2LightingEnvironmentFrame, Cinema2ResolvedLightFrame } from '../../spatial/Cinema2LightingEnvironmentRuntime'

/**
 * Cinema 2.0 owns the camera and the lights; Three only receives them. Both mappings were calibrated in the #5 spike with
 * a white diffuse sphere: engine intensity 1 makes a white diffuse surface read as full white for ambient and directional
 * lights, and for spot/point lights at half their range (Three additionally windows a light by its range, so a surface at
 * half range reads about 88% of nominal).
 */
export const CINEMA2_THREE_MAX_LIGHTS = 8

/** Copies the engine's final camera state into a Three camera without letting Three recompute any matrix. */
export function applyCinema2CameraFrame(camera: ThreeNamespace.PerspectiveCamera, frame: Readonly<Cinema2CameraFrame>): void {
  camera.matrixAutoUpdate = false
  camera.matrixWorldAutoUpdate = false
  camera.projectionMatrix.fromArray(frame.projectionMatrix as unknown as number[])
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
  camera.matrixWorldInverse.fromArray(frame.viewMatrix as unknown as number[])
  camera.matrixWorld.copy(camera.matrixWorldInverse).invert()
  camera.near = frame.near
  camera.far = frame.far
}

interface LightCounts {
  ambient: number
  directional: number
  point: number
  spot: number
}

/**
 * A fixed pool of Three lights driven by the engine's light list. Adding or removing a light changes the shader
 * variant and recompiles, so unused slots stay in the scene at intensity 0 and the pool only grows (once) when the
 * engine reports more lights of a type than the pool holds.
 */
export class Cinema2ThreeLightRig {
  private readonly ambient: ThreeNamespace.AmbientLight[] = []
  private readonly directional: ThreeNamespace.DirectionalLight[] = []
  private readonly point: ThreeNamespace.PointLight[] = []
  private readonly spot: ThreeNamespace.SpotLight[] = []
  private readonly color: ThreeNamespace.Color

  constructor(
    private readonly THREE: typeof ThreeNamespace,
    private readonly scene: ThreeNamespace.Scene,
  ) {
    this.color = new THREE.Color()
  }

  /** Number of Three lights currently in the scene (including zero-intensity spares). */
  get lightCount(): number {
    return this.ambient.length + this.directional.length + this.point.length + this.spot.length
  }

  update(frame: Readonly<Cinema2LightingEnvironmentFrame>): void {
    const counts = countLights(frame.lights)
    this.grow(counts)
    for (const light of [...this.ambient, ...this.directional, ...this.point, ...this.spot]) light.intensity = 0
    const used: LightCounts = { ambient: 0, directional: 0, point: 0, spot: 0 }
    for (const light of frame.lights) {
      switch (light.type) {
        case 'ambient': this.applyAmbient(this.ambient[used.ambient++], light); break
        case 'directional': this.applyDirectional(this.directional[used.directional++], light); break
        case 'point': this.applyPoint(this.point[used.point++], light); break
        case 'spot': this.applySpot(this.spot[used.spot++], light); break
      }
    }
  }

  private setColor(target: ThreeNamespace.Color, light: Readonly<Cinema2ResolvedLightFrame>): void {
    target.copy(this.color.setRGB(light.color[0], light.color[1], light.color[2], this.THREE.SRGBColorSpace))
  }

  private applyAmbient(target: ThreeNamespace.AmbientLight | undefined, light: Readonly<Cinema2ResolvedLightFrame>): void {
    if (!target) return
    this.setColor(target.color, light)
    target.intensity = light.intensity * Math.PI
  }

  private applyDirectional(target: ThreeNamespace.DirectionalLight | undefined, light: Readonly<Cinema2ResolvedLightFrame>): void {
    if (!target) return
    this.setColor(target.color, light)
    target.intensity = light.intensity * Math.PI
    // Only the direction matters for a directional light: aim it from behind the origin along the engine's direction.
    target.position.set(-light.direction[0] * 10, -light.direction[1] * 10, -light.direction[2] * 10)
    target.target.position.set(0, 0, 0)
    target.updateMatrixWorld()
    target.target.updateMatrixWorld()
  }

  private applyPoint(target: ThreeNamespace.PointLight | undefined, light: Readonly<Cinema2ResolvedLightFrame>): void {
    if (!target) return
    this.setColor(target.color, light)
    target.position.set(light.position[0], light.position[1], light.position[2])
    target.distance = light.range
    target.decay = 2
    target.intensity = light.intensity * Math.PI * (light.range * 0.5) ** 2
    target.updateMatrixWorld()
  }

  private applySpot(target: ThreeNamespace.SpotLight | undefined, light: Readonly<Cinema2ResolvedLightFrame>): void {
    if (!target) return
    const outer = ((light.spot?.outerAngleDegrees ?? 30) * Math.PI) / 180
    const inner = ((light.spot?.innerAngleDegrees ?? 20) * Math.PI) / 180
    this.setColor(target.color, light)
    target.position.set(light.position[0], light.position[1], light.position[2])
    const aim = light.targetPosition ?? [light.position[0] + light.direction[0], light.position[1] + light.direction[1], light.position[2] + light.direction[2]]
    target.target.position.set(aim[0], aim[1], aim[2])
    target.angle = outer
    target.penumbra = outer > 0 ? Math.max(0, 1 - inner / outer) : 0
    target.distance = light.range
    target.decay = 2
    target.intensity = light.intensity * Math.PI * (light.range * 0.5) ** 2
    target.updateMatrixWorld()
    target.target.updateMatrixWorld()
  }

  private grow(counts: LightCounts): void {
    const { THREE, scene } = this
    while (this.ambient.length < counts.ambient) { const l = new THREE.AmbientLight(0xffffff, 0); scene.add(l); this.ambient.push(l) }
    while (this.directional.length < counts.directional) { const l = new THREE.DirectionalLight(0xffffff, 0); scene.add(l, l.target); this.directional.push(l) }
    while (this.point.length < counts.point) { const l = new THREE.PointLight(0xffffff, 0, 0, 2); scene.add(l); this.point.push(l) }
    while (this.spot.length < counts.spot) { const l = new THREE.SpotLight(0xffffff, 0, 0, 0.3, 0.4, 2); scene.add(l, l.target); this.spot.push(l) }
  }
}

function countLights(lights: readonly Readonly<Cinema2ResolvedLightFrame>[]): LightCounts {
  const counts: LightCounts = { ambient: 0, directional: 0, point: 0, spot: 0 }
  let total = 0
  for (const light of lights) {
    if (total >= CINEMA2_THREE_MAX_LIGHTS) break
    if (light.type in counts) { counts[light.type as keyof LightCounts] += 1; total += 1 }
  }
  return counts
}
