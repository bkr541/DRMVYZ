import type * as Three from 'three'
import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import { Cinema2MainframePatternController } from '../modules/mainframe/Cinema2MainframePatternController'
import { Cinema2MainframeBeatClockResolver, resolveCinema2MainframeTimeSec } from '../modules/mainframe/Cinema2MainframePatternEngine'
import { resolveCinema2MainframeSourceIdentity, selectCinema2MainframeAudio, resolveCinema2MainframePlaybackState } from '../modules/mainframe/Cinema2MainframeAudioDelivery'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from '../modules/Cinema2AfterhoursNativeModule'
import { CINEMA2_USER_MODEL_PREVIEWS, CINEMA2_USER_MODEL_PROXY_LIMITS, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'

const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n))
const unit = (n: number) => ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1
interface Controls { pattern: number; phase: number; movement: number; intensity: number; opacity: number; emission: number; reaction: number; primary: readonly number[]; secondary: readonly number[]; accent: readonly number[] }
interface Original { material: Three.MeshStandardMaterial; color: Three.Color; emissive: Three.Color; intensity: number; opacity: number; transparent: boolean; wireframe: boolean }
interface Attached {
  root: Three.Object3D; pivot: Three.Group; source: Three.Group; accent: Three.Mesh; scan: Three.Mesh | null
  meshes: Three.Mesh[]; originals: Original[]; samples: Three.Vector3[]; slices: { center: Three.Vector3; size: Three.Vector3 }[]
  instanced: Three.InstancedMesh | null; points: Three.Points[]; layers: Three.Mesh[]; echoes: Three.Object3D[]
  primary: Three.MeshStandardMaterial; secondary: Three.MeshStandardMaterial; pointMaterials: Three.PointsMaterial[]
  geometries: Set<Three.BufferGeometry>; materials: Set<Three.Material>; extent: number
}
/** Runtime-only visual controller; source geometry stays owned by the private asset lease. */
export class Cinema2UserModelPreviewEffects {
  readonly afterVisibility = true
  private readonly attachments = new Map<Three.Object3D, Attached>()
  private readonly clock = new Cinema2MainframeBeatClockResolver()
  private readonly patterns: Cinema2MainframePatternController<string>
  private previousTime: number | null = null
  private previousIdentity: string | null = null
  private previousGeneration: number | null = null
  private previousEdit: number | null = null
  private lastImpulse: string | null = null
  private impulse = 0
  private previousDiscontinuity: string | null = null
  private controls: Controls = { pattern: 0, phase: 0, movement: 0.35, intensity: 0.8, opacity: 1, emission: 0.2, reaction: 0, primary: [0.55, 0.85, 1], secondary: [0.7, 0.3, 0.9], accent: [0.1, 0.9, 0.8] }
  private readonly dummy: Three.Object3D
  private readonly tint: Three.Color
  constructor(private readonly library: Cinema2ThreeLibrary, readonly kind: Cinema2UserModelPreviewKind) {
    this.patterns = new Cinema2MainframePatternController<string>(CINEMA2_USER_MODEL_PREVIEWS[kind], CINEMA2_USER_MODEL_PREVIEWS[kind][0])
    this.dummy = new library.THREE.Object3D(); this.tint = new library.THREE.Color()
  }
  update({ frame, parameters }: Cinema2ModuleUpdateContext): void {
    const number = (name: string, fallback: number, min = 0, max = 1) => { const value = parameters.get(name); return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback }
    const color = (name: string, fallback: readonly number[]) => { const value = parameters.get(name); return Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(n => typeof n === 'number' && Number.isFinite(n)) ? value as number[] : fallback }
    const audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
    const time = resolveCinema2MainframeTimeSec(frame), identity = resolveCinema2MainframeSourceIdentity(frame, audio)
    const discontinuity = audio?.discontinuity.occurred ? JSON.stringify(audio.discontinuity) : null
    const reset = this.previousIdentity !== null && identity !== this.previousIdentity || this.previousTime !== null && (time < this.previousTime - 1e-6 || time - this.previousTime > 0.75) || this.previousGeneration !== null && frame.contextGeneration !== this.previousGeneration || discontinuity !== null && discontinuity !== this.previousDiscontinuity
    const timing = this.clock.resolve(frame, parameters.get('bpmSync') !== false)
    const names: readonly string[] = CINEMA2_USER_MODEL_PREVIEWS[this.kind], value = parameters.get('pattern'), authored = typeof value === 'string' && names.includes(value) ? value : names[0]
    const triggerValue = parameters.get('trigger'), trigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(triggerValue as Cinema2AfterhoursTriggerId) ? triggerValue as Cinema2AfterhoursTriggerId : 'beat'
    const acceptedFrame = audio ? { ...frame, audio } : { ...frame, audio: null }
    const event = resolveCinema2AfterhoursTriggerEventIdentity(acceptedFrame, trigger, this.previousTime)
    const edit = parameters.getEditRevision?.('pattern') ?? 0
    const sameValueEdit = this.previousEdit !== null && edit !== this.previousEdit
    const selection = this.patterns.update({ authoredPattern: authored, patternChange: parameters.get('patternChange') === true, trigger, triggerEventId: event, absoluteBeat: timing.beats, reset: reset || sameValueEdit })
    const playing = resolveCinema2MainframePlaybackState(frame, audio) === 'playing'
    if (reset) { this.impulse = 0; this.lastImpulse = null }
    const dt = playing ? clamp(frame.deltaTimeSec, 0, 0.25) : 0
    this.impulse *= Math.exp(-dt / number('response', 0.35, 0.05, 1.5))
    const hit = playing ? audio?.rhythm.kick ?? audio?.rhythm.downbeat : null
    const structural = playing ? resolveCinema2AfterhoursTriggerEventIdentity(acceptedFrame, 'drop', this.previousTime) ?? resolveCinema2AfterhoursTriggerEventIdentity(acceptedFrame, 'phrase', this.previousTime) : null
    const impulseId = structural ?? hit?.id ?? null
    if (impulseId && impulseId !== this.lastImpulse && !reset) { this.impulse = structural ? 1 : 0.7; this.lastImpulse = impulseId }
    const energy = playing && audio?.features.overallEnergy.available ? clamp(audio.features.overallEnergy.value ?? 0) : 0
    const reaction = number('reactivity', 0.6) * clamp(energy * 0.5 + this.impulse * 0.7)
    this.controls = { pattern: names.indexOf(selection.activePattern), phase: timing.beats * Math.PI * 0.25 * number('speed', 1, 0, 3) * (number('movement', .35, 0, .8) > 0 ? 1 : 0), movement: number('movement', 0.35, 0, 0.8), intensity: number('intensity', 0.8, 0, 2), opacity: number('opacity', 1, 0.1, 1), emission: number('emission', 0.2, 0, 2), reaction, primary: color('primary', this.controls.primary), secondary: color('secondary', this.controls.secondary), accent: color('accent', this.controls.accent) }
    this.previousTime = time; this.previousIdentity = identity; this.previousGeneration = frame.contextGeneration; this.previousEdit = edit; this.previousDiscontinuity = discontinuity
  }
  attach(root: Three.Object3D, userModel?: boolean): void {
    if (!userModel) return
    const T = this.library.THREE
    root.updateMatrixWorld(true)
    const inverse = root.matrixWorld.clone().invert(), meshes: Three.Mesh[] = []
    root.traverse(object => { if ((object as Three.Mesh).isMesh) meshes.push(object as Three.Mesh) })
    const samples = sampleCinema2ModelSurface(this.library, meshes, inverse, 1536)
    if (!samples.length) return
    const bounds = new T.Box3().setFromPoints(samples), center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3()), extent = Math.max(size.x, size.y, size.z, 0.01)
    samples.forEach(point => point.sub(center))
    const pivot = new T.Group(), source = new T.Group(); pivot.name = 'UserModelPreview'; pivot.position.copy(center); source.position.copy(center).multiplyScalar(-1)
    for (const child of [...root.children]) source.add(child)
    pivot.add(source); root.add(pivot)
    const primary = new T.MeshStandardMaterial({ roughness: 0.45, metalness: 0.25 }), secondary = primary.clone()
    const geometries = new Set<Three.BufferGeometry>(), materials = new Set<Three.Material>([primary, secondary]), originals: Original[] = []
    for (const mesh of meshes) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const m = material as Three.MeshStandardMaterial
      if (m.isMeshStandardMaterial) originals.push({ material: m, color: m.color.clone(), emissive: m.emissive.clone(), intensity: m.emissiveIntensity, opacity: m.opacity, transparent: m.transparent, wireframe: m.wireframe })
    }
    const ringGeometry = new T.TorusGeometry(extent * 0.59, extent * 0.012, 6, 64), accentMaterial = new T.MeshBasicMaterial(), accent = new T.Mesh(ringGeometry, accentMaterial)
    accent.rotation.x = Math.PI / 2; accent.position.y = -size.y / 2 - extent * 0.035; pivot.add(accent); geometries.add(ringGeometry); materials.add(accentMaterial)
    const haloGeometry = new T.TorusGeometry(extent * .56, extent * .009, 5, 64), halo = new T.Mesh(haloGeometry, secondary); halo.position.z = -size.z / 2 - extent * .05; pivot.add(halo); geometries.add(haloGeometry)
    let instanced: Three.InstancedMesh | null = null, scan: Three.Mesh | null = null
    const points: Three.Points[] = [], pointMaterials: Three.PointsMaterial[] = [], layers: Three.Mesh[] = [], slices: Attached['slices'] = [], echoes: Three.Object3D[] = []
    if (this.kind === 'shatter' || this.kind === 'voxel') {
      const geometry = this.kind === 'shatter' ? new T.TetrahedronGeometry(extent * 0.055) : new T.BoxGeometry(extent * 0.065, extent * 0.065, extent * 0.065)
      geometries.add(geometry); instanced = new T.InstancedMesh(geometry, primary, this.kind === 'shatter' ? 96 : 320); instanced.instanceMatrix.setUsage(T.DynamicDrawUsage); instanced.frustumCulled = false; pivot.add(instanced)
    } else if (this.kind === 'dust') {
      for (let part = 0; part < 2; part++) {
        const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(1536 * 3), 3).setUsage(T.DynamicDrawUsage))
        const material = new T.PointsMaterial({ size: extent * 0.025, sizeAttenuation: true, transparent: true, depthWrite: false })
        const cloud = new T.Points(geometry, material); cloud.frustumCulled = false; pivot.add(cloud); points.push(cloud); pointMaterials.push(material); geometries.add(geometry); materials.add(material)
      }
    } else if (this.kind === 'slices') {
      const geometry = new T.BoxGeometry(1, 1, 1); geometries.add(geometry)
      for (let i = 0; i < 14; i++) {
        const band = samples.filter(p => clamp(Math.floor((p.y + size.y / 2) / Math.max(size.y, .001) * 14), 0, 13) === i)
        const box = new T.Box3().setFromPoints(band.length ? band : [new T.Vector3(0, (i / 13 - .5) * size.y, 0)])
        const bandSize = box.getSize(new T.Vector3()); bandSize.y = Math.max(size.y / 14 * .65, extent * .018); bandSize.x = Math.max(extent * .04, bandSize.x); bandSize.z = Math.max(extent * .04, bandSize.z)
        slices.push({ center: box.getCenter(new T.Vector3()), size: bandSize }); const layer = new T.Mesh(geometry, i % 2 ? secondary : primary); layers.push(layer); pivot.add(layer)
      }
    } else if (this.kind === 'hologram') {
      const geometry = new T.PlaneGeometry(extent * 1.2, extent * 1.2), material = new T.MeshBasicMaterial({ transparent: true, opacity: .3, side: T.DoubleSide, depthWrite: false })
      scan = new T.Mesh(geometry, material); scan.rotation.x = -Math.PI / 2; pivot.add(scan); geometries.add(geometry); materials.add(material)
      const echo = source.clone(true)
      echo.traverse(object => { const mesh = object as Three.Mesh; if (!mesh.isMesh) return; mesh.material = new T.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: .18 }); materials.add(mesh.material) })
      pivot.add(echo); echoes.push(echo)
    }
    this.attachments.set(root, { root, pivot, source, meshes, originals, samples, slices, instanced, points, layers, echoes, primary, secondary, pointMaterials, accent, scan, geometries, materials, extent })
  }
  beforeDraw(quality: Cinema2RenderQualityLevel = 'high'): void {
    const T = this.library.THREE, c = this.controls, p = c.pattern, phase = c.phase, m = c.movement, r = c.reaction
    for (const a of this.attachments.values()) {
      a.source.visible = this.kind === 'form' || this.kind === 'hologram'
      a.pivot.rotation.set(0, 0, 0); a.pivot.scale.setScalar(1)
      const e = a.extent, oscillation = Math.sin(phase)
      if (this.kind === 'form') {
        a.pivot.rotation.set(p === 3 ? .2 + Math.sin(phase) * m * .4 : 0, p === 1 ? .65 + oscillation * m * .12 : p === 5 ? phase * m * .5 + .3 : oscillation * m * .2, p === 2 ? -.18 : 0)
        a.pivot.position.y = a.pivot.userData.baseY ?? a.pivot.position.y
        a.pivot.userData.baseY = a.pivot.position.y
        if (p === 2) a.pivot.position.y += e * (.13 + oscillation * m * .1)
        a.pivot.scale.setScalar((p === 4 ? .82 + oscillation * m * .15 : 1) + r * m * .15)
      }
      for (let i = 0; i < a.originals.length; i++) {
        const o = a.originals[i], tint = o.material.name === 'side' ? c.secondary : c.primary
        this.tint.setRGB(tint[0], tint[1], tint[2], T.SRGBColorSpace)
        o.material.color.copy(o.color).multiply(this.tint).multiplyScalar(c.intensity)
        o.material.emissive.copy(o.emissive); o.material.emissiveIntensity = o.intensity + c.emission
        if (this.kind === 'hologram') { o.material.wireframe = true; o.material.emissive.copy(this.tint); o.material.emissiveIntensity = c.emission + .5 + r; o.material.opacity = (p === 4 ? .35 + .3 * Math.abs(oscillation) : .62) * c.opacity }
        else o.material.opacity = o.opacity * c.opacity
        const transparent = o.transparent || o.material.opacity < 1; if (o.material.transparent !== transparent) o.material.needsUpdate = true; o.material.transparent = transparent; o.material.depthWrite = o.material.opacity >= 1
      }
      for (const [material, rgb] of [[a.primary, c.primary], [a.secondary, c.secondary]] as const) { material.color.setRGB(rgb[0], rgb[1], rgb[2], T.SRGBColorSpace).multiplyScalar(c.intensity); material.emissive.copy(material.color); material.emissiveIntensity = c.emission + r * .25; material.opacity = c.opacity; if (material.transparent !== (c.opacity < 1)) material.needsUpdate = true; material.transparent = c.opacity < 1 }
      const accent = a.accent.material as Three.MeshBasicMaterial; accent.color.setRGB(c.accent[0], c.accent[1], c.accent[2], T.SRGBColorSpace).multiplyScalar(.7 + c.emission); accent.opacity = c.opacity; if (accent.transparent !== (c.opacity < 1)) accent.needsUpdate = true; accent.transparent = c.opacity < 1
      if (this.kind === 'hologram') {
        a.pivot.rotation.y = oscillation * m * .15; a.pivot.rotation.z = p === 3 ? .35 : 0; a.pivot.scale.y = p === 4 ? .85 + .1 * oscillation : 1
        if (a.scan) { a.scan.position.y = (p === 1 || p === 5 ? oscillation * .42 : p === 2 ? .22 : -.2) * e; a.scan.rotation.set(p === 5 ? 0 : -Math.PI / 2, 0, p === 5 ? Math.PI / 2 : 0); const material = a.scan.material as Three.MeshBasicMaterial; material.color.copy(accent.color); material.opacity = (p === 0 ? .08 : .22 + r * .2) * c.opacity }
        for (const echo of a.echoes) { echo.visible = p === 2 || p === 5; echo.position.x = (p === 2 ? .22 : -.12) * e; echo.traverse(object => { if ((object as Three.Mesh).isMesh) ((object as Three.Mesh).material as Three.MeshBasicMaterial).color.setRGB(c.secondary[0], c.secondary[1], c.secondary[2], T.SRGBColorSpace) }) }
      }
      if (a.instanced) {
        const count = CINEMA2_USER_MODEL_PROXY_LIMITS[quality][this.kind === 'shatter' ? 'shatter' : 'voxel']; a.instanced.count = count
        for (let i = 0; i < count; i++) {
          const sample = a.samples[Math.floor(i / count * a.samples.length)], x = sample.x / e, y = sample.y / e, z = sample.z / e
          const pos = this.dummy.position; pos.copy(sample)
          if (this.kind === 'shatter') {
            if (p === 0) pos.multiplyScalar(1.25 + m * (.3 + r + oscillation * .15))
            if (p === 1) pos.x += Math.sign(x || .01) * e * (.18 + m * .3 + r * .2)
            if (p === 2) { pos.y += (x * x + z * z) * e * 1.4; pos.x *= .9 }
            if (p === 3) { const angle = .5 + phase * m; pos.set(x * Math.cos(angle) - z * Math.sin(angle), y + .1 * Math.sin(i), x * Math.sin(angle) + z * Math.cos(angle)).multiplyScalar(e * 1.35) }
            if (p === 4) pos.z += Math.sin(x * 8 + phase) * e * (.15 + m * .2 + r * .15)
            if (p === 5) pos.multiplyScalar(.68 + r * m * .3)
            this.dummy.rotation.set(i * .7 + phase * m * .2, i * .4, p * .2); this.dummy.scale.setScalar(p === 5 ? 1.45 : .9 + r * .3)
          } else {
            const cell = e / 12; pos.set(Math.round(pos.x / cell) * cell, Math.round(pos.y / cell) * cell, Math.round(pos.z / cell) * cell)
            if (p === 1) pos.y += Math.abs(x) * e * .6 + Math.sin(phase) * m * e * .1
            if (p === 2) pos.x += (i % 2 ? 1 : -1) * e * (.12 + m * .2 + r * .2)
            if (p === 3) { const angle = .35 + phase * m * .25; pos.set(x * Math.cos(angle) - z * Math.sin(angle), y, x * Math.sin(angle) + z * Math.cos(angle)).multiplyScalar(e * 1.1) }
            if (p === 4) pos.z += Math.sin(y * 9 + phase) * e * (.12 + m * .25 + r * .2)
            if (p === 5) pos.multiplyScalar(.65)
            this.dummy.rotation.set(0, 0, 0); this.dummy.scale.setScalar((p === 5 ? .8 : 1) * (1 + r * m * .4 + (p === 0 ? oscillation * m * .12 : 0)))
          }
          this.dummy.updateMatrix(); a.instanced.setMatrixAt(i, this.dummy.matrix)
          const rgb = i % 3 ? c.primary : c.secondary; this.tint.setRGB(rgb[0], rgb[1], rgb[2], T.SRGBColorSpace); a.instanced.setColorAt(i, this.tint)
        }
        // Vertex instance colors carry palette hues; white material avoids multiplying two palette roles together.
        a.primary.color.setScalar(c.intensity); a.primary.emissive.setScalar(1); a.primary.emissiveIntensity = c.emission * .2
        a.instanced.instanceMatrix.needsUpdate = true; if (a.instanced.instanceColor) a.instanced.instanceColor.needsUpdate = true
      }
      for (let part = 0; part < a.points.length; part++) {
        const cloud = a.points[part], positions = cloud.geometry.attributes.position as Three.BufferAttribute, count = CINEMA2_USER_MODEL_PROXY_LIMITS[quality].dust / 2
        cloud.geometry.setDrawRange(0, count)
        for (let i = 0; i < count; i++) {
          const sample = a.samples[Math.floor(i / count * a.samples.length) + part > a.samples.length - 1 ? 0 : Math.floor(i / count * a.samples.length) + part], x = sample.x / e, y = sample.y / e, z = sample.z / e
          let px = sample.x, py = sample.y, pz = sample.z
          if (p === 0) { px += Math.sin(i * .7 + phase) * e * m * .06; pz += Math.cos(i * .4 + phase) * e * m * .06 }
          if (p === 1) { py += (unit(i) - .2) * e * (.3 + m + r * .3); px += Math.sin(phase + i) * e * m * .15 }
          if (p === 2) { const angle = i * 2.399 + phase * m; px = Math.cos(angle) * e * (.55 + z * .2); pz = Math.sin(angle) * e * (.55 + z * .2); py *= .7 }
          if (p === 3) { px += Math.sign(x || .01) * e * .25; py += Math.sin(i + phase) * e * m * .12 }
          if (p === 4) { pz += Math.sin(x * 9 + phase) * e * (.15 + m * .3 + r * .25); py *= .8 }
          if (p === 5) { px *= .6; py *= .5; pz *= .6 }
          positions.setXYZ(i, px, py, pz)
        }
        positions.needsUpdate = true; const mat = a.pointMaterials[part], rgb = part ? c.secondary : c.primary
        mat.color.setRGB(rgb[0], rgb[1], rgb[2], T.SRGBColorSpace).multiplyScalar(c.intensity * (1 + c.emission + r)); mat.opacity = c.opacity; mat.size = e * .018 * (1 + r * m)
      }
      for (let i = 0; i < a.layers.length; i++) {
        const layer = a.layers[i], band = a.slices[i], y = i / 13 - .5
        layer.visible = i % (quality === 'low' ? 3 : quality === 'medium' ? 2 : 1) === 0
        layer.position.copy(band.center); layer.scale.copy(band.size); layer.rotation.set(0, p === 0 ? Math.sin(phase + y * 2) * m * .12 : 0, 0)
        if (p === 1) layer.position.x += y * e * .6
        if (p === 2) { layer.rotation.y = y * 1.6; layer.position.z += y * e * .25 }
        if (p === 3) layer.position.x += (i % 2 ? 1 : -1) * e * (.12 + m * .2 + r * .15)
        if (p === 4) { layer.position.z += Math.sin(y * 8 + phase) * e * (.13 + m * .2 + r * .2); layer.rotation.y = Math.sin(phase + i) * m * .2 }
        if (p === 5) { layer.position.y *= .5; layer.scale.y *= .8; layer.rotation.z = -.14 }
      }
    }
  }
  detach(root: Three.Object3D): void {
    const a = this.attachments.get(root); if (!a) return
    root.remove(a.pivot); for (const geometry of a.geometries) geometry.dispose(); for (const material of a.materials) material.dispose(); a.instanced?.dispose()
    this.attachments.delete(root)
  }
  dispose(): void { for (const root of this.attachments.keys()) this.detach(root); this.patterns.reset(); this.clock.reset() }
  inspect() { return { kind: this.kind, pattern: CINEMA2_USER_MODEL_PREVIEWS[this.kind][this.controls.pattern], phase: this.controls.phase, reaction: this.controls.reaction, attachmentCount: this.attachments.size, limits: CINEMA2_USER_MODEL_PROXY_LIMITS } }
}
/** Bounded deterministic barycentric samples across the selected mesh's real triangles, in root-local coordinates. */
export function sampleCinema2ModelSurface(library: Cinema2ThreeLibrary, meshes: readonly Three.Mesh[], inverse: Three.Matrix4, count: number): Three.Vector3[] {
  const T = library.THREE, total = meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position?.count ?? 0) / 3, 0), result: Three.Vector3[] = []
  let start = 0
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), matrix = new T.Matrix4()
  for (const mesh of meshes) {
    const geometry = mesh.geometry, position = geometry.attributes.position, index = geometry.index
    if (!position) continue
    const triangles = (index?.count ?? position.count) / 3; matrix.multiplyMatrices(inverse, mesh.matrixWorld)
    for (let i = result.length; i < count; i++) {
      const target = Math.floor(i / count * total)
      if (target >= start + triangles) break
      const offset = Math.max(0, target - start) * 3
      a.fromBufferAttribute(position, index ? index.getX(offset) : offset); b.fromBufferAttribute(position, index ? index.getX(offset + 1) : offset + 1); c.fromBufferAttribute(position, index ? index.getX(offset + 2) : offset + 2)
      const u = Math.sqrt(unit(i + 1)), v = unit(i + 523)
      result.push(new T.Vector3().copy(a).multiplyScalar(1 - u).addScaledVector(b, u * (1 - v)).addScaledVector(c, u * v).applyMatrix4(matrix))
    }
    start += triangles
  }
  return result
}
