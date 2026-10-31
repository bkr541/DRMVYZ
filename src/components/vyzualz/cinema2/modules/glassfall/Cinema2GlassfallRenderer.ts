import { GLASSFALL_DIRECTOR_NEUTRAL, type GlassfallDirectorModifiers } from './Cinema2GlassfallDirector'
import { GLASSFALL_DEFAULT_CONTROLS, glassfallIllumination, glassfallModulo, type GlassfallControls, type GlassfallPhases } from './Cinema2GlassfallMotion'
import { GLASSFALL_SILENCE, type GlassfallAudioFacts } from './Cinema2GlassfallAudio'
import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { getCinema2ThreeRenderer } from '../three/Cinema2ThreeRendererHost'
import { applyCinema2CameraFrame } from '../three/Cinema2ThreeCameraLightMapping'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { buildGlassfallSymbolGeometries, glassfallCells, GLASSFALL_SYMBOL_Z, GLASSFALL_PANEL_FRONT_Z, GLASSFALL_REAR_Z } from './Cinema2GlassfallGeometry'

/** Real lit, raised meshes, using the same shared Three host as Backstreet.
 * Native geometry and side materials carry depth; glow never substitutes for it. */
export class Cinema2GlassfallRenderer {
  private readonly renderer: Three.WebGLRenderer
  private readonly guard: Cinema2GlStateGuard
  private readonly scene: Three.Scene
  private readonly camera: Three.PerspectiveCamera
  private readonly target: Three.WebGLRenderTarget
  private readonly symbols: Three.Group
  private readonly panelGroup: Three.Group
  private readonly rear: Three.Mesh
  private readonly key: Three.DirectionalLight
  private readonly triangle: Three.BufferGeometry
  private readonly panelGeometry: Three.BoxGeometry
  private readonly postGeometry: Three.CylinderGeometry
  private readonly geometries: Three.BufferGeometry[] = []
  private readonly materials: Three.Material[] = []
  private panelInstances: Three.InstancedMesh | null = null
  private readonly cellMaterials: Three.Material[] = []
  private animated = false
  private aspect = 0
  private disposed = false
  constructor(private readonly library: Cinema2ThreeLibrary, gl: WebGL2RenderingContext, source: Three.Object3D) {
    const { THREE } = library
    this.renderer = getCinema2ThreeRenderer(library, gl).renderer
    this.guard = new Cinema2GlStateGuard(gl)
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#030611')
    this.camera = new THREE.PerspectiveCamera(2 * Math.atan(3.1 / 12) * 180 / Math.PI, 1, .1, 30)
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true })
    ;(this.target as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true
    this.target.texture.colorSpace = THREE.SRGBColorSpace
    const symbols = buildGlassfallSymbolGeometries(THREE, source)
    this.triangle = symbols.triangle
    this.geometries.push(this.triangle)
    this.symbols = new THREE.Group(); this.panelGroup = new THREE.Group()
    this.scene.add(this.symbols, this.panelGroup)
    const material = (value: Three.Material) => { this.materials.push(value); return value }
    const rearMaterial = material(new THREE.MeshStandardMaterial({ color: '#10152d', roughness: .72, metalness: .18 }))
    const rearGeometry = new THREE.BoxGeometry(24, 12, .06); this.geometries.push(rearGeometry)
    this.rear = new THREE.Mesh(rearGeometry, rearMaterial); this.rear.position.z = GLASSFALL_REAR_Z - .03
    this.rear.receiveShadow = true; this.scene.add(this.rear)
    this.scene.add(new THREE.HemisphereLight('#afc6ff', '#030408', 1.0))
    this.key = new THREE.DirectionalLight('#d8e5ff', 3.2); this.key.position.set(-2.5, 3, 4)
    this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024)
    Object.assign(this.key.shadow.camera, { left: -7, right: 7, top: 4, bottom: -4, near: .1, far: 16 })
    this.key.shadow.bias = -.0003; this.key.shadow.normalBias = .008
    this.scene.add(this.key)
    const violet = new THREE.PointLight('#6633ff', 12, 12, 2); violet.position.set(2, 1, 1.2)
    const cyan = new THREE.PointLight('#16adff', 12, 12, 2); cyan.position.set(-2, -1, .8)
    this.scene.add(violet, cyan)
    this.panelGeometry = new THREE.BoxGeometry(.505, .525, .10)
    this.postGeometry = new THREE.CylinderGeometry(.012, .012, .20, 6)
    this.geometries.push(this.panelGeometry, this.postGeometry)
  }
  private rebuild(aspect: number, animated: boolean) {
    const { THREE } = this.library
    this.panelInstances?.dispose()
    for (const material of this.cellMaterials) material.dispose()
    this.cellMaterials.length = 0
    this.symbols.clear(); this.panelGroup.clear()
    // Materials/geometry are shared by every cell and retained through resize.
    if (this.materials.length === 1) {
      for (const color of ['#00d4ed', '#7725ff', '#c8d9ff', '#152337']) {
        this.materials.push(new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: color === '#152337' ? .05 : .75, roughness: .24, metalness: .25, clearcoat: .8 }))
        this.materials.push(new THREE.MeshStandardMaterial({ color: '#142136', emissive: color, emissiveIntensity: .08, roughness: .3, metalness: .65 }))
      }
      this.materials.push(new THREE.MeshStandardMaterial({ color: '#080a11', roughness: .3, metalness: .4 }))
      this.materials.push(new THREE.MeshStandardMaterial({ color: '#121721', roughness: .35, metalness: .7 }))
    }
    const cells = glassfallCells(animated ? aspect / .75 / .9 : aspect, animated)
    for (const cell of cells) {
      const group = new THREE.Group(); group.position.set(cell.x, cell.y, GLASSFALL_SYMBOL_Z)
      const triangle = new THREE.Mesh(this.triangle, [this.materials[1 + cell.color * 2], this.materials[2 + cell.color * 2]])
      triangle.castShadow = true
      if (cell.inverted) group.rotation.z = Math.PI
      group.add(triangle); group.userData = { ...cell }
      if (animated) {
        const trace = { uGlassfallPhase: { value: 0 }, uGlassfallTrace: { value: 0 } }
        group.userData.trace = trace
        for (const mesh of [triangle]) {
          const materials = (mesh.material as Three.Material[]).map(material => material.clone())
          mesh.material = materials; this.cellMaterials.push(...materials)
          materials[0].onBeforeCompile = shader => {
            Object.assign(shader.uniforms, trace)
            shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGlassfallPosition;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlassfallPosition = position.xy;')
            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vGlassfallPosition; uniform float uGlassfallPhase; uniform float uGlassfallTrace;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat angle = atan(vGlassfallPosition.y, vGlassfallPosition.x) / 6.2831853; float arc = fract(angle - uGlassfallPhase + 1.0); float reveal = pow(0.5 + 0.5 * cos(arc * 6.2831853), 6.0); totalEmissiveRadiance *= mix(1.0, 0.035 + 2.2 * reveal, uGlassfallTrace);')
          }
          materials[0].customProgramCacheKey = () => 'glassfall-contour-trace-v1'
        }
      }
      this.symbols.add(group)
      // Actual dark mounting posts establish the air gap above the black panels.
      for (const x of [-.22, .22]) {
        const post = new THREE.Mesh(this.postGeometry, this.materials[10]); post.rotation.x = Math.PI / 2
        post.position.set(x, 0, .07 - GLASSFALL_SYMBOL_Z); post.castShadow = true; group.add(post)
      }
    }
    const columns = Math.ceil(aspect * 3.1 / 2 / .52) + 2
    const rows = 5
    const panels = new THREE.InstancedMesh(this.panelGeometry, this.materials[9], (columns * 2 + 1) * (rows * 2 + 1))
    const matrix = new THREE.Matrix4(); let i = 0
    for (let y = -rows; y <= rows; y++) for (let x = -columns; x <= columns; x++) {
      matrix.makeTranslation(x * .52, y * .55, GLASSFALL_PANEL_FRONT_Z - .05)
      panels.setMatrixAt(i++, matrix)
    }
    this.panelInstances = panels
    panels.castShadow = true; panels.receiveShadow = true; this.panelGroup.add(panels)
    this.aspect = aspect; this.animated = animated
  }
  draw(exec: Cinema2ModuleRenderExecutionContext, depth = true, oblique = false, controls?: GlassfallControls, phases: GlassfallPhases = { travel: 0, score: 0 }, audio: GlassfallAudioFacts = GLASSFALL_SILENCE, response = 0, director: GlassfallDirectorModifiers = GLASSFALL_DIRECTOR_NEUTRAL) {
    if (this.disposed) return
    const aspect = exec.width / exec.height
    if (aspect !== this.aspect || Boolean(controls) !== this.animated) this.rebuild(aspect, Boolean(controls))
    for (const group of this.symbols.children) {
      group.position.z = depth ? GLASSFALL_SYMBOL_Z : .03
      if (controls) {
        const c = controls, cell = group.userData
        group.position.x = cell.x * c.spacing
        const band = cell.y - (cell.inverted ? .26 : 0)
        group.position.y = (glassfallModulo(band - phases.travel + 3.3, 6.6) - 3.3 + (cell.inverted ? .26 : 0)) * c.spacing
        const baseIllumination = glassfallIllumination(c.pattern, cell.x, cell.y, cell.inverted, phases.score)
        const rhythmic = cell.inverted ? audio.snare : audio.kick
        const illumination = Math.min(1, Math.max(0, baseIllumination * (1 + response * (.3 * audio.energy * director.activity - .4 * audio.vocal)) + response * (director.impact * (.45 * rhythmic + .35 * audio.drop))))
        const relief = c.relief * (1 + response * (.18 * audio.bass + .12 * audio.build * director.tension))
        const rgb = cell.color === 3 ? [.08, .13, .21] : [c.cyan, c.violet, c.highlight][cell.color]
        const ink = new this.library.THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], this.library.THREE.SRGBColorSpace)
        for (const mesh of [group.children[0] as Three.Mesh]) {
          const materials = mesh.material as Three.MeshStandardMaterial[]
          const tint = ink.clone()
          const master = c.intensity
          materials[0].color.copy(tint).multiplyScalar(.12 + .88 * master * (.25 + .75 * illumination))
          materials[0].emissive.copy(tint); materials[0].emissiveIntensity = (cell.color === 3 ? .05 : .75) * master * illumination
          materials[1].emissive.copy(tint); materials[1].emissiveIntensity = .08 * master * illumination
          mesh.scale.z = relief
        }
        cell.trace.uGlassfallPhase.value = phases.score / 3 + cell.x * .10 + response * audio.high * .12 * director.contour
        cell.trace.uGlassfallTrace.value = c.pattern === 'prismTrace' ? 1 : 0
        for (const post of group.children.slice(1)) {
          post.visible = depth
          const back = GLASSFALL_SYMBOL_Z - .06 * relief
          post.scale.y = (back - GLASSFALL_PANEL_FRONT_Z) / .20
          post.position.z = (back + GLASSFALL_PANEL_FRONT_Z) / 2 - GLASSFALL_SYMBOL_Z
        }
      }
    }
    const c = controls ?? GLASSFALL_DEFAULT_CONTROLS
    this.symbols.scale.set(controls ? c.scale : 1, controls ? c.scale : 1, 1)
    this.panelGroup.scale.copy(this.symbols.scale)
    this.panelGroup.position.y = controls ? -glassfallModulo(phases.travel * c.spacing, .55) * c.scale : 0
    if (controls) {
      const rear = this.materials[0] as Three.MeshStandardMaterial, panel = this.materials[9] as Three.MeshStandardMaterial
      rear.color.setRGB(c.background[0], c.background[1], c.background[2], this.library.THREE.SRGBColorSpace)
      if (c.reflectionStrength !== undefined) { panel.roughness = .95 - .70 * c.reflectionStrength; panel.metalness = .1 + .3 * c.reflectionStrength }
      panel.color.setRGB(c.panel[0], c.panel[1], c.panel[2], this.library.THREE.SRGBColorSpace)
    }
    this.panelGroup.visible = depth
    this.rear.position.z = depth ? GLASSFALL_REAR_Z - .03 : -.08
    if (exec.camera && !oblique) {
      applyCinema2CameraFrame(this.camera, exec.camera)
    } else {
      this.camera.matrixAutoUpdate = true; this.camera.matrixWorldAutoUpdate = true
      this.camera.aspect = aspect
      this.camera.position.set(oblique ? 1.7 : .18, oblique ? -.8 : -.12, 6)
      this.camera.lookAt(0, 0, 0); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true)
    }
    this.guard.capture()
    const shadows = this.renderer.shadowMap.enabled, type = this.renderer.shadowMap.type
    try {
      this.renderer.resetState(); this.renderer.shadowMap.enabled = depth; this.renderer.shadowMap.type = this.library.THREE.PCFSoftShadowMap
      ;(this.renderer as unknown as { setRenderTargetFramebuffer(target: Three.WebGLRenderTarget, framebuffer: WebGLFramebuffer): void }).setRenderTargetFramebuffer(this.target, exec.target!)
      this.target.viewport.set(0, 0, exec.width, exec.height); this.target.scissor.set(0, 0, exec.width, exec.height)
      this.renderer.setRenderTarget(this.target); this.renderer.clear(); this.renderer.render(this.scene, this.camera); this.renderer.setRenderTarget(null)
    } finally { this.renderer.shadowMap.enabled = shadows; this.renderer.shadowMap.type = type; this.renderer.resetState(); this.guard.restore() }
  }
  estimateGpuBytes() {
    return this.geometries.reduce((sum, geometry) => sum + (geometry.index?.array.byteLength ?? 0) + Object.values(geometry.attributes).reduce((n, attribute) => n + attribute.array.byteLength, 0), 0) + 1024 * 1024 * 4
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of [...this.materials, ...this.cellMaterials]) material.dispose()
    this.key.shadow.map?.dispose(); this.key.shadow.mapPass?.dispose()
    this.panelInstances?.dispose(); this.scene.clear(); this.target.dispose()
  }
}
