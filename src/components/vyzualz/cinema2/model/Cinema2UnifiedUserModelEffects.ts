import { Cinema2ModelCinematicMaterials } from './Cinema2ModelCinematicMaterials'
import { Cinema2ModelCinematicStage } from './Cinema2ModelCinematicStage'
import type * as Three from 'three'
import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleParameterReadFacet, Cinema2ModuleUpdateContext } from '../modules/Cinema2ModuleContracts'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { Cinema2UserModelPreviewEffects } from './Cinema2UserModelPreviewEffects'
import { prepareCinema2UserModel, type Cinema2PreparedUserModel } from './Cinema2UserModelPreparation'
import { Cinema2MainframeBeatClockResolver, resolveCinema2MainframeTimeSec, type Cinema2MainframeBeatClockFrame } from '../modules/mainframe/Cinema2MainframePatternEngine'
import { resolveCinema2MainframeSourceIdentity, selectCinema2MainframeAudio } from '../modules/mainframe/Cinema2MainframeAudioDelivery'
import { cinema2RepresentationPatternProperty, cinema2ResolveFractureDetail, CINEMA2_USER_MODEL_PROXY_LIMITS, isCinema2UserModelPreview, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const scalar = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback
const vector = (value: unknown, min: number, max: number) => Array.isArray(value) && value.length === 3 ? value.map(v => scalar(v, 0, min, max)) : [0, 0, 0]

/** A mode owns derived GPU buffers/materials, never the private model lease or its source geometry. */
interface Representation {
  readonly kind: Cinema2UserModelPreviewKind
  readonly key: string
  readonly root: Three.Group
  readonly effects: Cinema2UserModelPreviewEffects
  readonly cinematic: Cinema2ModelCinematicMaterials | null
  readonly sourceMaterials: readonly Three.Material[]
  readonly textureBindings: readonly TextureBinding[]
  readonly otherMaterials: readonly { material: Three.Material; opacity: number; transparent: boolean; depthWrite: boolean }[]
  lastUpdate?: Cinema2ModuleUpdateContext
  lastQuality?: Cinema2RenderQualityLevel
}
interface TextureBinding { material: Three.Material; slot: string; original: Three.Texture }
interface SourceTexture extends TextureBinding { mesh: Three.Mesh; index: number }
interface Attachment {
  readonly identity: string | undefined
  readonly root: Three.Object3D
  readonly source: Three.Group
  readonly pivot: Three.Group
  readonly stage: Cinema2ModelCinematicStage | null
  readonly prepared: Cinema2PreparedUserModel | null
  readonly textures: readonly SourceTexture[]
  readonly residents: Map<string, Representation>
  readonly failed: Map<string, string>
  active: Representation | null
  outgoing: Representation | null
  elapsed: number
  duration: number
  easing: string
  requested: string | null
  problem: string | null
  pending?: { key: string; cancel: () => void }
}

function textureSlots(material: Three.Material): [string, Three.Texture][] {
  return Object.entries(material).filter((entry): entry is [string, Three.Texture] => !!entry[1] && (entry[1] as Three.Texture).isTexture === true)
}
function materialList(mesh: Three.Mesh): Three.Material[] { return Array.isArray(mesh.material) ? mesh.material : [mesh.material] }
function textureValue(material: Three.Material, slot: string): Three.Texture | null | undefined { return (material as unknown as Record<string, Three.Texture | null | undefined>)[slot] }
function setTexture(material: Three.Material, slot: string, value: Three.Texture | null | undefined): void {
  if (textureValue(material, slot) === value) return
  ;(material as unknown as Record<string, Three.Texture | null | undefined>)[slot] = value
  material.needsUpdate = true
}

/**
 * One scene slot, one normalized source, one immutable rest-pose preparation. The bridge owns the
 * camera, model lease, output target and clock. Only representation subtrees change here.
 * At most two mode renderers are resident (including the outgoing one during a transition).
 */
export class Cinema2UnifiedUserModelEffects {
  readonly afterVisibility = true
  private attachment: Attachment | null = null
  private latest: Cinema2ModuleUpdateContext | null = null
  private timestamp: number | null = null
  private readonly clock = new Cinema2MainframeBeatClockResolver()
  private sharedTiming: { timing: Readonly<Cinema2MainframeBeatClockFrame>; motionBeats: number } | undefined
  private previousTime: number | null = null
  private previousIdentity: string | null = null
  private previousGeneration: number | null = null
  private fallbackBeats = 0
  private stageContext: Cinema2ModuleUpdateContext | null = null
  constructor(private readonly library: Cinema2ThreeLibrary, readonly defaultKind: Cinema2UserModelPreviewKind, private readonly fixedPreview = false) {}

  update(context: Cinema2ModuleUpdateContext): void {
    const now = context.frame.timestampMs
    // The transition is an operator UI action, not a new audio transport. It also completes while paused.
    const delta = this.timestamp === null || !Number.isFinite(now) ? 0 : clamp((now - this.timestamp) / 1000, 0, .25)
    this.timestamp = Number.isFinite(now) ? now : null
    this.latest = context
    if (this.attachment?.outgoing) this.attachment.elapsed += delta
    const { frame, parameters } = context, audio = selectCinema2MainframeAudio(frame.audio, frame.transport?.trackId)
    const timing = this.clock.resolve(frame, parameters.get('bpmSync') !== false), time = resolveCinema2MainframeTimeSec(frame), identity = resolveCinema2MainframeSourceIdentity(frame, audio)
    if (this.previousTime === null || identity !== this.previousIdentity || frame.contextGeneration !== this.previousGeneration || time < this.previousTime || time - this.previousTime > .75) this.fallbackBeats = timing.beats
    else if (!audio && frame.transport?.playing && frame.transport.sourcePresent && !frame.transport.paused) this.fallbackBeats += clamp(time - this.previousTime, 0, .25) * timing.bpm / 60
    this.sharedTiming = { timing, motionBeats: audio ? timing.beats : this.fallbackBeats }
    this.previousTime = time; this.previousIdentity = identity; this.previousGeneration = frame.contextGeneration
  }

  attach(root: Three.Object3D, userModel?: boolean, _animations?: readonly Three.AnimationClip[], assetId?: string): void {
    if (!userModel || this.attachment?.root === root) return
    if (this.attachment) this.detach(this.attachment.root)
    const T = this.library.THREE, source = new T.Group(), pivot = new T.Group()
    source.name = 'UnifiedModelSource'; pivot.name = 'UnifiedModelTransform'
    let prepared: Cinema2PreparedUserModel | null = null, problem: string | null = null
    try { prepared = prepareCinema2UserModel(this.library, root, CINEMA2_USER_MODEL_PROXY_LIMITS.high.dust) }
    catch (error) { problem = error instanceof Error ? error.message : 'Model preparation failed; original representation retained.' }
    const textures: SourceTexture[] = []
    root.traverse(object => {
      const mesh = object as Three.Mesh
      if (!mesh.isMesh) return
      materialList(mesh).forEach((material, index) => {
        for (const [slot, original] of textureSlots(material)) textures.push({ mesh, index, material, slot, original })
      })
    })
    for (const child of [...root.children]) source.add(child)
    if (prepared) { pivot.position.copy(prepared.center); source.position.copy(prepared.center).multiplyScalar(-1) }
    pivot.add(source); root.add(pivot)
    this.attachment = { root, stage: this.fixedPreview ? null : new Cinema2ModelCinematicStage(this.library, root), identity: assetId, source, pivot, prepared, textures, residents: new Map(), failed: new Map(), active: null, outgoing: null, elapsed: 0, duration: 0, easing: 'linear', requested: null, problem }
  }

  private create(a: Attachment, kind: Cinema2UserModelPreviewKind, key: string, detail: number, sliceCount = 14, sliceAxis = 'y'): Representation | null {
    if (!a.prepared || a.failed.has(key)) return null
    const cached = a.residents.get(key)
    if (cached) return cached
    const T = this.library.THREE, root = new T.Group()
    root.name = `UnifiedRepresentation:${kind}`
    const sourceMaterials: Three.Material[] = [], effects = new Cinema2UserModelPreviewEffects(this.library, kind, detail, sliceCount, sliceAxis)
    try {
      // Clone only nodes and per-mode materials. The imported vertex/index buffers and textures remain shared.
      for (const child of a.source.children) root.add(child.clone(true))
      const sourceMeshes: Three.Mesh[] = [], modeMeshes: Three.Mesh[] = []
      a.source.traverse(object => { if ((object as Three.Mesh).isMesh) sourceMeshes.push(object as Three.Mesh) })
      root.traverse(object => { if ((object as Three.Mesh).isMesh) modeMeshes.push(object as Three.Mesh) })
      modeMeshes.forEach((mesh, meshIndex) => {
        const originals = materialList(sourceMeshes[meshIndex]!)
        const clones = originals.map((material, index) => {
          const clone = material.clone(); sourceMaterials.push(clone)
          // Preserve original texture identity even if this mode is constructed at a lower quality tier.
          for (const binding of a.textures) if (binding.mesh === sourceMeshes[meshIndex] && binding.index === index) setTexture(clone, binding.slot, binding.original)
          return clone
        })
        mesh.material = Array.isArray(mesh.material) ? clones : clones[0]!
      })
      effects.attach(root, true, a.prepared)
      if (!effects.hasUsableRepresentation(root)) throw new Error(effects.getDiagnostics()[0]?.message ?? 'Representation is not supported by this model.')
      const textureBindings: TextureBinding[] = [], otherMaterials: Representation['otherMaterials'][number][] = [], seen = new Set<Three.Material>()
      root.traverse(object => {
        const mesh = object as Three.Mesh
        if (!mesh.isMesh) return
        for (const material of materialList(mesh)) if (!seen.has(material)) {
          seen.add(material)
          if (!(material as Three.MeshStandardMaterial).isMeshStandardMaterial && material.type !== 'LineMaterial') otherMaterials.push({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite })
          for (const [slot, original] of textureSlots(material)) textureBindings.push({ material, slot, original })
        }
      })
      root.position.copy(a.prepared.center).multiplyScalar(-1)
      root.visible = false; a.pivot.add(root)
      const result = { kind, key, root, effects, cinematic: this.fixedPreview ? null : new Cinema2ModelCinematicMaterials(this.library, root), sourceMaterials, textureBindings, otherMaterials }
      a.residents.set(key, result)
      return result
    } catch (error) {
      effects.dispose(); root.removeFromParent(); for (const material of sourceMaterials) material.dispose()
      a.failed.set(key, error instanceof Error ? error.message : 'Representation preparation failed.')
      return null
    }
  }

  private release(a: Attachment, representation: Representation): void {
    representation.cinematic?.dispose(); representation.effects.dispose(); representation.root.removeFromParent()
    for (const material of representation.sourceMaterials) material.dispose()
    a.residents.delete(representation.key)
  }

  private progress(a: Attachment): number {
    const t = a.duration > 0 ? clamp(a.elapsed / a.duration) : 1
    return a.easing === 'smoothstep' ? t * t * (3 - 2 * t) : t
  }

  private select(a: Attachment, kind: Cinema2UserModelPreviewKind, detail: number, duration: number, easing: string, sliceCount: number, sliceAxis: string): void {
    const key = kind === 'shatter' ? `${kind}:${detail}` : kind === 'slices' ? `${kind}:${sliceCount}:${sliceAxis}` : kind
    if (a.pending && a.pending.key !== key) { a.pending.cancel(); a.pending = undefined }
    if (a.requested === key) return
    a.requested = key
    const initial = !a.active
    // Reverse an in-flight transition without a discontinuity when the operator selects its source.
    if (a.outgoing?.key === key && a.active) {
      const old = a.active; a.active = a.outgoing; a.outgoing = old
      a.elapsed = a.duration - Math.min(a.elapsed, a.duration)
      return
    }
    if (a.outgoing && a.active) {
      // A third target has a bounded two-mode budget. Retain the dominant visible representation.
      const dominant = this.progress(a) < .5 ? a.outgoing : a.active
      const other = dominant === a.active ? a.outgoing : a.active
      a.active = dominant; a.outgoing = null; other.root.visible = false
    }
    if (a.active?.key === key) return
    for (const resident of a.residents.values()) if (resident !== a.active && resident.key !== key) this.release(a, resident)
    // Heavy cold builds run between frames, not in the draw callback. Keep the previous
    // representation (or lease source) visible. Idle work is canceled on selection/model replacement.
    if (!a.residents.has(key) && !a.failed.has(key) && a.prepared && (kind === 'shatter' || kind === 'voxel' || kind === 'slices' || kind === 'hologram') && typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => {
        if (this.attachment !== a || a.pending?.key !== key) return
        a.pending = undefined
        this.create(a, kind, key, detail, sliceCount, sliceAxis)
        a.requested = null
      }, { timeout: 800 })
      a.pending = { key, cancel: () => window.cancelIdleCallback(id) }
      return
    }
    let next = this.create(a, kind, key, detail, sliceCount, sliceAxis)
    if (!next) {
      // Keep a valid Form visible rather than a broken proxy or an empty stage.
      const reason = a.failed.get(key) ?? a.problem ?? 'Representation unavailable.'
      a.problem = `${kind}: ${reason}`
      if (a.active?.kind === 'form') return
      for (const resident of a.residents.values()) if (resident !== a.active && resident.kind !== 'form') this.release(a, resident)
      next = this.create(a, 'form', 'form', 24)
      if (!next) return
    } else a.problem = null
    if (next === a.active) return
    a.outgoing = a.active && duration > 0 ? a.active : null
    if (a.active && !a.outgoing) a.active.root.visible = false
    a.active = next; a.elapsed = 0; a.duration = duration; a.easing = easing
    if (!initial || kind !== this.defaultKind) { next.effects.startRepresented(); next.lastUpdate = undefined }
  }

  private parametersFor(mode: Cinema2UserModelPreviewKind, original: Cinema2ModuleParameterReadFacet): Cinema2ModuleParameterReadFacet {
    const nameFor = (name: string) => name === 'pattern' && mode !== this.defaultKind ? cinema2RepresentationPatternProperty(mode) : name
    return {
      get: name => this.fixedPreview && name === 'effectPose' ? 'representation' : this.fixedPreview && ['shatterSpread', 'sliceSeparation', 'voxelSeparation'].includes(name) ? scalar(original.get(name), 1, .05, 1) : name === 'modelYaw' ? 0 : name === 'modelScale' ? 1 : original.get(nameFor(name)),
      getAuthored: name => original.getAuthored(nameFor(name)),
      resolve: name => original.resolve(nameFor(name)),
      getEditRevision: original.getEditRevision ? name => original.getEditRevision!(nameFor(name)) : undefined,
    }
  }

  private syncTextures(a: Attachment, representation: Representation): void {
    // Use the bridge's existing tiered texture copies rather than allocating a second texture cache.
    for (const binding of representation.textureBindings) {
      const source = a.textures.find(entry => entry.slot === binding.slot && entry.original === binding.original)
      if (source) setTexture(binding.material, binding.slot, textureValue(materialList(source.mesh)[source.index]!, source.slot))
    }
  }

  beforeDraw(quality: Cinema2RenderQualityLevel = 'high'): void {
    const a = this.attachment, context = this.latest
    if (!a || !context) return
    const p = context.parameters, selected = p.get('representation'), defaultMode = p.get('defaultRepresentation')
    const kind = this.fixedPreview ? this.defaultKind : isCinema2UserModelPreview(selected) ? selected : isCinema2UserModelPreview(defaultMode) ? defaultMode : this.defaultKind
    const detail = cinema2ResolveFractureDetail(this.fixedPreview ? 'auto' : p.get('shardDetail'), quality, a.prepared?.triangleCount ?? 0)
    const sliceCount = Math.round(scalar(p.get('sliceCount'), 14, 2, quality === 'low' ? 14 : 24))
    const requestedAxis = p.get('sliceAxis'), sliceAxis = requestedAxis === 'x' || requestedAxis === 'z' ? requestedAxis : 'y'
    const duration = this.fixedPreview ? 0 : scalar(p.get('transitionDuration'), 0, 0, 3)
    this.select(a, kind, detail, duration, p.get('transitionEasing') === 'linear' ? 'linear' : 'smoothstep', sliceCount, sliceAxis)
    if (a.prepared) {
      const pos = vector(p.get('modelPosition'), -2, 2), rot = vector(p.get('modelRotation'), -180, 180), yaw = scalar(p.get('modelYaw'), 0, -180, 180)
      const unit = a.prepared.extent / 2
      a.pivot.position.set(a.prepared.center.x + pos[0] * unit, a.prepared.center.y + pos[1] * unit, a.prepared.center.z + pos[2] * unit)
      a.pivot.rotation.set(rot[0] * Math.PI / 180, (rot[1] + yaw) * Math.PI / 180, rot[2] * Math.PI / 180)
      a.pivot.scale.setScalar(scalar(p.get('modelScale'), 1, .5, 1.2))
    }
    a.stage?.update(p, this.stageContext === context ? 0 : context.frame.deltaTimeSec, quality); this.stageContext = context
    const progress = a.outgoing ? this.progress(a) : 1
    if (a.outgoing && progress >= 1) { a.outgoing.root.visible = false; a.outgoing = null }
    a.source.visible = !a.active
    for (const resident of a.residents.values()) {
      try {
      // Keep cached pattern controllers on the same published musical timeline, even while not drawn.
      if (resident.lastUpdate !== context) {
        resident.effects.update({ ...context, parameters: this.parametersFor(resident.kind, p) }, this.sharedTiming)
        resident.lastUpdate = context
      }
      const gain = resident === a.active ? progress : resident === a.outgoing ? 1 - progress : 0
      resident.root.visible = gain > 0
      if (gain <= 0) continue
      if (resident.lastQuality !== quality) { this.syncTextures(a, resident); resident.lastQuality = quality }
      resident.cinematic?.restore()
      resident.effects.setTransitionOpacity(gain)
        resident.effects.beforeDraw(quality)
        // GLTF unlit material slots do not participate in the PBR-only preview controls.
        // Fade those actual surfaces as well, without touching lease-owned materials.
        for (const { material, opacity, transparent, depthWrite } of resident.otherMaterials) {
          material.opacity = opacity * gain * scalar(p.get('opacity'), 1, .1, 1) * (resident.kind === 'hologram' ? 1 - scalar(p.get('hologramTransparency'), 0, 0, .9) : 1)
          const translucent = resident.kind === 'hologram' || transparent || material.opacity < 1
          if (material.transparent !== translucent) material.needsUpdate = true
          material.transparent = translucent; material.depthWrite = depthWrite && !translucent
        }
        resident.cinematic?.apply(p, context.frame.elapsedTimeSec)
      } catch (error) {
        a.failed.set(resident.key, error instanceof Error ? error.message : 'Representation draw failed.')
        a.problem = a.failed.get(resident.key)!
        this.release(a, resident); a.active = null; a.outgoing = null; a.requested = null
        for (const remaining of a.residents.values()) remaining.root.visible = false
        a.source.visible = true
        break
      }
    }
  }

  detach(root: Three.Object3D): void {
    const a = this.attachment
    if (!a || a.root !== root) return
    a.pending?.cancel(); a.pending = undefined
    for (const resident of a.residents.values()) this.release(a, resident)
    for (const child of [...a.source.children]) root.add(child)
    a.stage?.dispose(); this.stageContext = null; a.pivot.removeFromParent(); a.prepared?.dispose(); this.attachment = null
  }
  dispose(): void { if (this.attachment) this.detach(this.attachment.root); this.latest = null; this.timestamp = null; this.clock.reset(); this.sharedTiming = undefined; this.previousTime = null; this.previousIdentity = null; this.previousGeneration = null; this.fallbackBeats = 0 }
  estimateAdditionalGpuBytes(): number { return [...(this.attachment?.residents.values() ?? [])].reduce((sum, mode) => sum + mode.effects.estimateAdditionalGpuBytes(), 0) }
  getDiagnostics(): readonly { code: string; message: string }[] {
    const a = this.attachment
    if (!a) return []
    return [...(a.problem ? [{ code: 'CINEMA2_USER_MODEL_FORM_LIMIT', message: a.problem }] : []), ...(a.active?.effects.getDiagnostics() ?? [])]
  }
  inspect() {
    const a = this.attachment
    return { ...a?.active?.effects.inspect(), defaultKind: this.defaultKind, activeRepresentation: a?.active?.kind ?? 'form', requestedRepresentation: a?.requested?.split(':')[0] ?? null, modelIdentity: a?.identity ?? null, attachmentCount: a ? 1 : 0, residentRepresentations: a ? [...a.residents.keys()] : [], pendingRepresentation: a?.pending?.key ?? null, transitionProgress: a?.outgoing ? this.progress(a) : 1, transform: a ? { position: a.pivot.position.toArray(), rotation: a.pivot.rotation.toArray(), scale: a.pivot.scale.toArray() } : null }
  }
}
