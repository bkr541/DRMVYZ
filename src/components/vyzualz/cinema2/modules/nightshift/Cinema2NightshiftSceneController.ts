import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { evaluateNightshiftCell, NIGHTSHIFT_COLORS, nightshiftCoverageMask, type NightshiftCell, type NightshiftControls, type NightshiftPattern } from './Cinema2NightshiftDomain'
import type { NightshiftMusic } from './Cinema2NightshiftAudio'
import { Cinema2NightshiftSign } from './Cinema2NightshiftSign'

export interface NightshiftSceneFrame { controls: NightshiftControls; phase: number; angle: number; pattern: NightshiftPattern; outgoingPattern: NightshiftPattern | null; blend: number; music: NightshiftMusic; glintPhase: number }
// Compensate for the textured glass emission and authored dim/medium tile levels.
// Apply after spatial/audio shading so brighter peaks retain their travelling
// dark intervals, coverage mask and authoritative master/floor zero states.
export const NIGHTSHIFT_FLOOR_OUTPUT_GAIN = 9

/** Spatial native response, capped by the user's coverage and zone limits. */
export function shadeNightshiftMusicCell(cell: NightshiftCell, baseGain: number, coverage: number, music: NightshiftMusic, pattern: NightshiftPattern = 'nightshift', phase = 0): number {
  const r = cell.row, c = cell.column, x = Math.abs(c - 4.5), y = Math.abs(r - 4.5)
  const radius = x + y, parity = (r + c) % 2
  let kickDistance = r / 9, dropDistance = radius / 10, kickMask = 1, dropMask = 1, width = .12
  if (pattern === 'crossfade-checker') {
    kickMask = parity === Math.floor(phase / 2) % 2 ? 1 : .12
    dropDistance = Math.max(x, y) / 5; dropMask = parity ? .25 : 1
  } else if (pattern === 'runway') {
    kickMask = Math.exp(-(x * x) / 1.5); dropDistance = x / 5; width = .16
  } else if (pattern === 'diamond-ripple') {
    kickDistance = radius / 10; width = .085
  } else if (pattern === 'diagonal-relay') {
    kickDistance = (r + c) / 18; dropDistance = (r + 9 - c) / 18; width = .1
  } else if (pattern === 'quadrant-exchange') {
    const quadrant = (r >= 5 ? 2 : 0) + (c >= 5 ? 1 : 0)
    kickMask = quadrant === Math.floor(phase / 2) % 4 ? 1 : .08
    dropDistance = Math.max(x, y) / 5; dropMask = quadrant % 2 ? .3 : 1
  } else if (pattern === 'midnight-sparse') {
    // Choose sparse addresses within the low coverage ranks. Independent hashes
    // can otherwise hide the entire moving accent behind the user's mask.
    const address = ((r * 37 + c * 19) % 100) / 100
    kickMask = address < .18 ? 1 : 0
    dropMask = address < .22 ? .8 : 0; width = .14
  } else if (pattern === 'full-house') {
    kickDistance = Math.hypot(x, y) / 6.4; dropDistance = kickDistance; width = .2
  }
  const rowAccent = kickMask * Math.exp(-(((kickDistance - music.musicKickTravel) / width) ** 2))
  const ringAccent = dropMask * Math.exp(-(((dropDistance - music.musicDropTravel) / width) ** 2))
  const concentration = 1 - .32 * music.musicBuild * Math.min(1, dropDistance)
  return Math.min(1, Math.max(0, baseGain * music.musicLevel * concentration
    + nightshiftCoverageMask(cell, coverage) * (.18 * music.musicKick * rowAccent + .25 * music.musicDrop * ringAccent
      + .12 * music.musicImpact * (.25 + .75 * Math.max(0, 1 - radius / 10)))))
}

/** Owns only clones/batch instance buffers. Cached source geometry/textures remain shared. */
export class Cinema2NightshiftSceneController {
  private ball: Three.Object3D | null = null
  private cells: NightshiftCell[] = []
  private panels: Three.InstancedMesh | null = null
  private readonly batches: Three.InstancedMesh[] = []
  private readonly owned: Three.Material[] = []
  private readonly ceiling: { mesh: Three.InstancedMesh; cells: NightshiftCell[] }[] = []
  private mirror: Three.MeshStandardMaterial | null = null
  private readonly signs: Cinema2NightshiftSign[] = []
  private lastKey = ''
  private readonly master = { value: 1 }
  private readonly floorGain = { value: 1 }
  private readonly ballGain = { value: 1 }
  private readonly ceilingGain = { value: 1 }
  private readonly glintPhase = { value: 0 }
  private readonly snare = { value: 0 }
  private readonly palette: { value: Three.Color }[]
  private readonly defaults: Three.Color[]
  private readonly color: Three.Color
  private readonly outgoingColor: Three.Color

  constructor(private readonly library: Cinema2ThreeLibrary) {
    const { THREE } = library
    this.color = new THREE.Color()
    this.outgoingColor = new THREE.Color()
    this.defaults = [NIGHTSHIFT_COLORS.magenta, NIGHTSHIFT_COLORS.cyan, NIGHTSHIFT_COLORS.blue, NIGHTSHIFT_COLORS.amber]
      .map(c => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace))
    this.palette = this.defaults.map(c => ({ value: c.clone() }))
  }

  attach(root: Three.Object3D): void {
    const { THREE } = this.library
    root.updateMatrixWorld(true)
    const panels: Three.Mesh[] = [], frames: Three.Mesh[] = [], strips: Three.Mesh[] = []
    root.traverse(object => {
      const mesh = object as Three.Mesh
      const name = typeof object.userData.name === 'string' ? object.userData.name : object.name
      if (name === 'nightshift.ball') this.ball = object
      if (!mesh.isMesh) return
      if (name.startsWith('nightshift.floor.cell.')) panels.push(mesh)
      else if (name.startsWith('nightshift.floor.frame.')) frames.push(mesh)
      else if (name.includes('ceiling') && name.includes('strip')) strips.push(mesh)
      else {
        const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Three.MeshStandardMaterial[]
        for (const mat of materials) {
          if (!mat.isMeshStandardMaterial) continue
          if (name === 'nightshift.ball.mirrors') { this.mirror = mat; this.decorate(mat, this.ballGain, true) }
          else if (name.startsWith('nightshift.ball.')) this.decorate(mat, this.ballGain)
          else this.decorate(mat)
        }
      }
    })
    if (!this.ball || !this.mirror || panels.length !== 100 || frames.length !== 100) throw new Error('NIGHTSHIFT model requires the ball pivot, mirrors and 100 addressed floor panels/frames.')
    const inverse = root.matrixWorld.clone().invert()
    const batch = (sources: Three.Mesh[], name: string, emissive: boolean) => {
      sources.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      const mat = (sources[0].material as Three.MeshStandardMaterial).clone()
      this.owned.push(mat)
      if (emissive) { mat.color.setRGB(1, 1, 1); mat.emissive.setRGB(1, 1, 1); mat.emissiveIntensity = 2.2 }
      this.decorate(mat, emissive ? this.floorGain : undefined, false, emissive)
      const mesh = new THREE.InstancedMesh(sources[0].geometry, mat, sources.length)
      mesh.name = name
      for (let i = 0; i < sources.length; i++) {
        mesh.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(inverse, sources[i].matrixWorld))
        if (emissive) {
          this.cells.push(sources[i].userData as NightshiftCell)
          mesh.setColorAt(i, this.color.setRGB(1, 1, 1))
        }
      }
      if (emissive && mesh.instanceColor) mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
      mesh.computeBoundingSphere()
      for (const source of sources) source.removeFromParent()
      root.add(mesh); this.batches.push(mesh)
      return mesh
    }
    this.panels = batch(panels, 'nightshift.floor.panels-instanced', true)
    batch(frames, 'nightshift.floor.frames-instanced', false)
    // Keep the shipped rail geometry/placement, but address its light surface in
    // segments so spatial programs can travel around the overhead installation.
    for (const source of strips) {
      source.geometry.computeBoundingBox()
      const size = source.geometry.boundingBox!.getSize(new THREE.Vector3())
      const alongX = size.x > size.z, length = alongX ? size.x : size.z
      const count = Math.ceil(length / .5)
      const material = (source.material as Three.MeshStandardMaterial).clone()
      material.color.setRGB(.002, .015, .02)
      material.emissive.setRGB(1, 1, 1); material.emissiveIntensity = 1.1
      this.decorate(material, this.ceilingGain, false, true)
      this.owned.push(material)
      const mesh = new THREE.InstancedMesh(source.geometry, material, count)
      mesh.name = `${source.name}-segments`
      const cells: NightshiftCell[] = []
      const placement = new THREE.Matrix4().multiplyMatrices(inverse, source.matrixWorld)
      for (let i = 0; i < count; i++) {
        const offset = ((i + .5) / count - .5) * length
        const transform = new THREE.Matrix4().makeTranslation(alongX ? offset : 0, 0, alongX ? 0 : offset)
          .scale(new THREE.Vector3(alongX ? 1 / count : 1, 1, alongX ? 1 : 1 / count))
        mesh.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(placement, transform))
        const point = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(placement, transform))
        cells.push({ row: Math.max(0, Math.min(9, Math.round((point.z + 7) / 16 * 9))),
          column: Math.max(0, Math.min(9, Math.round((point.x + 5.2) / 10.4 * 9))), paletteIndex: 1, level: 2 })
        mesh.setColorAt(i, this.color.setRGB(1, 1, 1))
      }
      mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage)
      mesh.computeBoundingSphere()
      source.removeFromParent(); root.add(mesh)
      this.batches.push(mesh); this.ceiling.push({ mesh, cells })
    }
    for (let side = 0; side < 4; side++) {
      const sign = new Cinema2NightshiftSign(this.library, side)
      this.signs.push(sign); root.add(sign.root)
    }
  }

  private decorate(material: Three.MeshStandardMaterial, zone?: { value: number }, reflection = false, instancedEmission = false): void {
    const prior = material.onBeforeCompile
    const priorKey = material.customProgramCacheKey.bind(material)
    const { THREE } = this.library
    material.onBeforeCompile = (shader, renderer) => {
      prior.call(material, shader, renderer)
      shader.uniforms.uNightshiftMaster = this.master
      shader.uniforms.uNightshiftZone = zone ?? { value: 1 }
      let header = 'uniform float uNightshiftMaster;\nuniform float uNightshiftZone;\n'
      if (reflection) {
        shader.uniforms.uNightshiftGlintPhase = this.glintPhase
        shader.uniforms.uNightshiftSnare = this.snare
        header += 'uniform float uNightshiftGlintPhase;\nuniform float uNightshiftSnare;\n'
        for (let i = 0; i < 4; i++) shader.uniforms[`uNightshiftPalette${i}`] = this.palette[i]
        header += this.palette.map((_, i) => `uniform vec3 uNightshiftPalette${i};`).join('\n') + '\n'
        const literal = (c: Three.Color) => `vec3(${c.toArray().map(v => v.toFixed(8)).join(',')})`
        header += `vec3 nightshiftRotateReflection(vec3 v) {
          float a = uNightshiftGlintPhase; float c = cos(a); float s = sin(a);
          return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
        }
        vec3 nightshiftReflection(vec3 s) {
          vec3 t = max(vec3(0.0), s - min(s.r, min(s.g, s.b)));
          float m = min(t.r, t.b); float c = min(t.g, t.b);
          float b = max(0.0, t.b - m - c); float a = max(0.0, t.r - m);
          return max(vec3(0.0), s
            + m * (uNightshiftPalette0 - ${literal(this.defaults[0])})
            + c * (uNightshiftPalette1 - ${literal(this.defaults[1])})
            + b * (uNightshiftPalette2 - ${literal(this.defaults[2])})
            + a * (uNightshiftPalette3 - ${literal(this.defaults[3])}))
            + vec3(.12 * uNightshiftSnare * smoothstep(.4, 2.0, max(s.r, max(s.g, s.b))));
        }\n`
        shader.fragmentShader = shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',
          THREE.ShaderChunk.envmap_physical_pars_fragment.replaceAll('envMapColor.rgb', 'nightshiftReflection(envMapColor.rgb)')
            .replaceAll('envMapRotation * reflectVec', 'nightshiftRotateReflection( envMapRotation * reflectVec )'))
      }
      shader.fragmentShader = header + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
        'outgoingLight *= uNightshiftMaster * uNightshiftZone;\n#include <opaque_fragment>')
      if (instancedEmission) shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif')
    }
    material.customProgramCacheKey = () => `${priorKey()}:nightshift-v2:${reflection}:${instancedEmission}`
    material.needsUpdate = true
  }

  apply(frame: NightshiftSceneFrame, cameraPosition?: readonly [number, number, number]): void {
    const { controls: c, pattern, outgoingPattern, blend, phase, music } = frame
    const { THREE } = this.library
    const viewAngle = cameraPosition ? Math.atan2(cameraPosition[0], cameraPosition[2] + 2.3) : 0
    for (const sign of this.signs) sign.apply(frame, shadeNightshiftMusicCell, viewAngle)
    this.master.value = c.master / .85
    this.floorGain.value = NIGHTSHIFT_FLOOR_OUTPUT_GAIN * c.floor / .8
    this.ballGain.value = c.ball / .75
    this.ceilingGain.value = c.ceiling / .7 * music.musicCeiling
    this.glintPhase.value = c.musicResponse === 0 ? 0 : frame.glintPhase
    this.snare.value = music.musicSnare
    this.ball!.rotation.y = frame.angle
    const colors = [c.colors.magenta, c.colors.cyan, c.colors.blue, c.colors.amber]
    colors.forEach((rgb, i) => this.palette[i].value.setRGB(...rgb, THREE.SRGBColorSpace))
    this.mirror!.color.setRGB(...c.colors.ball, THREE.SRGBColorSpace)
    for (const { mesh, cells } of this.ceiling) {
      cells.forEach((cell, index) => {
        const gain = (program: NightshiftPattern) => {
          const result = evaluateNightshiftCell(cell, program, phase, 1)
          return shadeNightshiftMusicCell(cell, .12 + .88 * result.gain, 1, music, program, phase)
        }
        const level = outgoingPattern ? gain(pattern) * blend + gain(outgoingPattern) * (1 - blend) : gain(pattern)
        this.color.copy(this.palette[1].value).multiplyScalar(level * (1 + .35 * music.musicSnare + .3 * music.musicBuild))
        mesh.setColorAt(index, this.color)
      })
      mesh.instanceColor!.needsUpdate = true
    }
    const coverage = c.coverage * music.musicCoverage
    const key = `${pattern}:${outgoingPattern}:${blend}:${phase.toFixed(5)}:${coverage}:${colors.flat().join(',')}:${Object.values(music).join(',')}`
    if (key !== this.lastKey) {
      this.lastKey = key
      this.cells.forEach((cell, index) => {
        const result = evaluateNightshiftCell(cell, pattern, phase, coverage)
        this.color.copy(this.palette[result.family].value).multiplyScalar(shadeNightshiftMusicCell(cell, result.gain, coverage, music, pattern, phase))
        if (outgoingPattern) {
          const outgoing = evaluateNightshiftCell(cell, outgoingPattern, phase, coverage)
          this.outgoingColor.copy(this.palette[outgoing.family].value).multiplyScalar(shadeNightshiftMusicCell(cell, outgoing.gain, coverage, music, outgoingPattern, phase))
          this.color.lerp(this.outgoingColor, 1 - blend)
        }
        this.panels!.setColorAt(index, this.color)
      })
      this.panels!.instanceColor!.needsUpdate = true
    }
  }

  dispose(): void {
    for (const sign of this.signs) sign.dispose()
    this.signs.length = 0
    for (const batch of this.batches) { batch.removeFromParent(); batch.dispose() }
    for (const mat of this.owned) mat.dispose()
    this.batches.length = 0; this.owned.length = 0; this.cells.length = 0; this.ceiling.length = 0
  }
}
