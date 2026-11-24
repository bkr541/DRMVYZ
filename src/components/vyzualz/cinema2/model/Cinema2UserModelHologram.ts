import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2PreparedUserModel } from './Cinema2UserModelPreparation'

export const CINEMA2_HOLOGRAM_LIMITS = Object.freeze({ edgeInputTriangles: 120_000, edgeVertices: 200_000 })
/** Projection happens on the actual PBR surfaces; contour echoes use actual model edges. */
export class Cinema2UserModelHologram {
  readonly group: Three.Group
  readonly amount = { value: 0 }
  readonly phase = { value: 0 }
  readonly mode = { value: 0 }
  readonly color: { value: Three.Color }
  readonly accent: { value: Three.Color }
  readonly strength = { value: 1 }
  readonly lineDensity = { value: 1 }
  readonly echoes: Three.Group[] = []
  readonly materials: Three.LineBasicMaterial[] = []
  edgeProblem: string | null = null
  private geometries: Three.BufferGeometry[] = []
  private restore: (() => void)[] = []
  constructor(library: Cinema2ThreeLibrary, root: Three.Object3D, meshes: readonly Three.Mesh[], prepared: Cinema2PreparedUserModel) {
    const T = library.THREE
    this.group = new T.Group(); this.group.name = 'ActualModelProjection'
    this.color = { value: new T.Color() }; this.accent = { value: new T.Color() }
    root.updateWorldMatrix(true, true)
    const centered = new T.Matrix4().makeTranslation(-prepared.center.x, -prepared.center.y, -prepared.center.z).multiply(root.matrixWorld.clone().invert())
    const seen = new Set<Three.Material>()
    for (const mesh of meshes) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (seen.has(material)) continue
      seen.add(material)
      const compile = material.onBeforeCompile, key = material.customProgramCacheKey, baseKey = key.call(material)
      const local = { value: new T.Matrix4().makeScale(1 / prepared.extent, 1 / prepared.extent, 1 / prepared.extent).multiply(centered).multiply(mesh.matrixWorld) }
      material.onBeforeCompile = (shader, renderer) => {
        compile.call(material, shader, renderer)
        Object.assign(shader.uniforms, { c2HoloRest: local, c2HoloAmount: this.amount, c2HoloPhase: this.phase, c2HoloMode: this.mode, c2HoloColor: this.color, c2HoloAccent: this.accent, c2HoloStrength: this.strength, c2HoloLineDensity: this.lineDensity })
        shader.vertexShader = 'uniform mat4 c2HoloRest; varying vec3 vC2Holo;\n' + shader.vertexShader
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvC2Holo = (c2HoloRest * vec4(position, 1.)).xyz;')
        shader.fragmentShader = 'uniform float c2HoloAmount, c2HoloPhase, c2HoloMode, c2HoloStrength, c2HoloLineDensity; uniform vec3 c2HoloColor, c2HoloAccent; varying vec3 vC2Holo;\n' + shader.fragmentShader
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float holoAxis = c2HoloMode > 4.5 ? vC2Holo.x + vC2Holo.y : vC2Holo.y;
          float holoLines = .5 + .5 * sin(holoAxis * 280. * c2HoloLineDensity - c2HoloPhase * 7.);
          float holoScan = pow(.5 + .5 * sin(holoAxis * 8. - c2HoloPhase * 2.), 18.);
          float holoPulse = c2HoloMode > 3.5 && c2HoloMode < 4.5 ? .65 + .35 * sin(c2HoloPhase * 3.) : 1.;
          float holoSignal = .88 + .12 * sin(floor(vC2Holo.y * 72.) * 17. + floor(c2HoloPhase * 8.));
          vec3 holoLight = (c2HoloColor * (c2HoloMode < .5 ? .045 : .16 + .4 * holoLines) + c2HoloAccent * holoScan * (c2HoloMode < .5 ? .15 : 1.)) * holoPulse * c2HoloStrength;
          outgoingLight = mix(outgoingLight, outgoingLight * .12 + holoLight, c2HoloAmount);
          diffuseColor.a *= mix(1., (.38 + .42 * holoLines + .2 * holoScan) * holoSignal, c2HoloAmount);
          #include <opaque_fragment>
        `)
      }
      material.customProgramCacheKey = () => baseKey + ':c2-model-hologram-v2'; material.needsUpdate = true
      this.restore.push(() => { material.onBeforeCompile = compile; material.customProgramCacheKey = key; material.needsUpdate = true })
    }
    try {
      if (prepared.triangleCount > CINEMA2_HOLOGRAM_LIMITS.edgeInputTriangles) throw new Error('Projection uses actual model surfaces; contour echoes are disabled because the edge preparation budget was exceeded.')
      for (let echo = 0; echo < 3; echo++) {
        const group = new T.Group(), material = new T.LineBasicMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending })
        this.echoes.push(group); this.materials.push(material); this.group.add(group)
      }
      let vertices = 0
      for (const mesh of meshes) {
        const geometry = new T.EdgesGeometry(mesh.geometry, 18); this.geometries.push(geometry)
        vertices += geometry.attributes.position.count
        if (vertices > CINEMA2_HOLOGRAM_LIMITS.edgeVertices) throw new Error('Projection uses actual model surfaces; contour echoes exceed the bounded edge count and are disabled.')
        geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(centered, mesh.matrixWorld))
        for (let echo = 0; echo < 3; echo++) this.echoes[echo].add(new T.LineSegments(geometry, this.materials[echo]))
      }
    } catch (error) { this.edgeProblem = error instanceof Error ? error.message : 'Contour echoes unavailable; surface projection remains active.'; this.releaseEdges() }
  }
  animate(pattern: number, phase: number, amount: number, extent: number, opacity: number, strength: number, primary: readonly number[], accent: readonly number[]): void {
    this.amount.value = amount; this.phase.value = phase; this.mode.value = pattern; this.strength.value = strength
    this.color.value.setRGB(primary[0], primary[1], primary[2], 'srgb'); this.accent.value.setRGB(accent[0], accent[1], accent[2], 'srgb')
    for (let i = 0; i < this.echoes.length; i++) {
      const echo = this.echoes[i], material = this.materials[i]
      echo.visible = amount > .00001 && (i === 0 || pattern === 2 || pattern === 5)
      echo.position.set(i ? (i === 1 ? -1 : 1) * extent * .1 * amount * (1 + .15 * Math.sin(phase)) : 0, pattern === 5 && i ? (i === 1 ? -1 : 1) * extent * .08 * amount : 0, 0)
      material.color.copy(i ? this.accent.value : this.color.value).multiplyScalar(strength)
      material.opacity = opacity * amount * (i ? .2 : pattern === 0 ? .8 : .45)
    }
  }
  get additionalGpuBytes(): number { return this.geometries.reduce((n, geometry) => n + Object.values(geometry.attributes).reduce((sum, attr) => sum + attr.array.byteLength, 0), 0) }
  private releaseEdges(): void { for (const geometry of this.geometries) geometry.dispose(); for (const material of this.materials) material.dispose(); this.geometries = []; this.materials.length = 0; this.echoes.length = 0; this.group.clear() }
  dispose(): void { for (const restore of this.restore.splice(0)) restore(); this.releaseEdges(); this.group.removeFromParent() }
}
