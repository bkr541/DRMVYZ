import type * as THREE from 'three'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2PatternEventLatch } from '../conductor/Cinema2PatternEventLatch'
import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import type { Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { Cinema2MainframePatternController } from './mainframe/Cinema2MainframePatternController'
import { Cinema2PatternAutoPerformance } from './mainframe/Cinema2PatternAutoPerformance'
import { createCinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'
import { Cinema2ThreeAnimationController } from './three/Cinema2ThreeAnimation'
import type { Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { SIGNS_DEFAULT_PATTERN, SIGNS_PATTERNS, SIGNS_PALETTE, SIGNS_DEFAULTS, SIGNS_MASK_GLSL, signsMask, type SignsPattern } from './signs/SignsPatterns'

export const CINEMA2_SIGNS_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('signs-native')
export const CINEMA2_SIGNS_ASSET_ID = 'cinema2-signs'
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n))
const TAU = Math.PI * 2

type SignsFieldSegment = {
  material: THREE.MeshBasicMaterial
  angle: number
  radius: number
  weight: number
  color: readonly [number, number, number]
}

const FIELD_RING_CONFIG = [
  { radius: 6.2, count: 16, length: 1.05, thickness: 0.16, weight: 0.95 },
  { radius: 8.6, count: 20, length: 1.2, thickness: 0.17, weight: 0.9 },
  { radius: 11.0, count: 24, length: 1.35, thickness: 0.18, weight: 0.86 },
  { radius: 13.7, count: 28, length: 1.45, thickness: 0.19, weight: 0.8 },
] as const
const FIELD_BASE_COLORS: readonly (readonly [number, number, number])[] = [
  [0.18, 0.96, 1],
  [1, 0.28, 0.82],
  [1, 0.93, 0.2],
  [0.32, 1, 0.22],
  [1, 0.46, 0.16],
  [0.42, 0.5, 1],
]

export class Cinema2SignsController {
  readonly afterVisibility = true
  private readonly clock = new Cinema2BeatClock()
  private readonly selection = new Cinema2MainframePatternController<SignsPattern>(SIGNS_PATTERNS, SIGNS_DEFAULT_PATTERN)
  private readonly eventLatch = new Cinema2PatternEventLatch<Cinema2AfterhoursTriggerId>()
  private readonly policy = new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly performance = new Cinema2PatternAutoPerformance<SignsPattern>({ buildPattern: 'inward-lock', dropPattern: 'full-contact', buildMaxBeats: 32, dropBeats: 8 })
  private context: Cinema2ModuleUpdateContext | null = null
  private animation: Cinema2ThreeAnimationController | null = null
  private duration = 0
  private neon: THREE.MeshStandardMaterial | null = null
  private backing: THREE.MeshStandardMaterial[] = []
  private fieldGroup: THREE.Group | null = null
  private fieldSegments: SignsFieldSegment[] = []
  private geometries: THREE.BufferGeometry[] = []
  private identity: string | null = null
  private previousTime: number | null = null
  private previousBeat: number | null = null
  private previousStamp: number | null = null
  private previousRevision: number | null = null
  private authored: SignsPattern | null = null
  private auto = false
  private wasPlaying = false
  private pattern: SignsPattern = SIGNS_DEFAULT_PATTERN
  private oldPattern: SignsPattern = SIGNS_DEFAULT_PATTERN
  private transitionBeat = 0
  private blend = 1
  private phase = 0
  private rotation = 0
  private overrideReason: string | null = null
  private readonly u
  constructor(private readonly library: Cinema2ThreeLibrary) {
    this.u = {
      signsPhase: { value: 0 }, signsDepth: { value: .65 }, signsAccent: { value: .35 }, signsThickness: { value: 1.25 },
      signsFrom: { value: 0 }, signsTo: { value: 0 }, signsBlend: { value: 1 },
      signsTint: { value: new library.THREE.Color(1, 1, 1) }, signsAccentColor: { value: new library.THREE.Color(.18, .88, 1) },
    }
  }
  attach(root: THREE.Object3D, _userModel?: boolean, clips: readonly THREE.AnimationClip[] = []) {
    const T = this.library.THREE
    // Preserve the imported scene but present it closer to the reference: larger in frame, darker backing, and extended crop-circle linework instead of extra decorative staging.
    root.scale.setScalar(.112)
    root.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const m = material as THREE.MeshStandardMaterial
        if (!m.isMeshStandardMaterial) continue
        if (!m.emissiveMap) { this.backing.push(m); continue }
        this.neon = m
        const inherited = m.onBeforeCompile.bind(m)
        m.onBeforeCompile = (shader, renderer) => {
          inherited(shader, renderer)
          Object.assign(shader.uniforms, this.u)
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nuniform float signsPhase, signsDepth, signsAccent, signsBlend, signsThickness;\nuniform int signsFrom, signsTo;\nuniform vec3 signsTint, signsAccentColor;\n${SIGNS_MASK_GLSL}`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n#ifdef USE_EMISSIVEMAP\nvec2 suv = vEmissiveMapUv;\nvec2 sp = suv*2.-1.;\nfloat sa = atan(sp.y,sp.x);\nfloat sr = length(sp);\nfloat sm = mix(signsMask(signsFrom,sa,sr,signsPhase), signsMask(signsTo,sa,sr,signsPhase),signsBlend);\nvec2 st = vec2(.0048,.0048)*signsThickness;\nvec3 original = totalEmissiveRadiance*signsTint;\nvec3 thickened = original;\nthickened = max(thickened, texture2D(emissiveMap, clamp(suv + vec2( st.x, 0.), 0., 1.)).rgb*signsTint);\nthickened = max(thickened, texture2D(emissiveMap, clamp(suv + vec2(-st.x, 0.), 0., 1.)).rgb*signsTint);\nthickened = max(thickened, texture2D(emissiveMap, clamp(suv + vec2(0.,  st.y), 0., 1.)).rgb*signsTint);\nthickened = max(thickened, texture2D(emissiveMap, clamp(suv + vec2(0., -st.y), 0., 1.)).rgb*signsTint);\nthickened = max(thickened, texture2D(emissiveMap, clamp(suv + st, 0., 1.)).rgb*signsTint*.92);\nthickened = max(thickened, texture2D(emissiveMap, clamp(suv - st, 0., 1.)).rgb*signsTint*.92);\nfloat luminance = max(max(thickened.r,thickened.g),thickened.b);\nvec3 shaped = mix(thickened, signsAccentColor*luminance, signsAccent*sm*.55);\ntotalEmissiveRadiance = shaped*mix(1.,.24+.76*sm,signsDepth);\n#endif`)
        }
        m.customProgramCacheKey = () => 'cinema2-signs-score-v2'
        m.needsUpdate = true
      }
    })
    if (!this.neon || !clips.length) throw new Error('SIGNS requires its original emissive texture and rotation clip.')
    this.animation = new Cinema2ThreeAnimationController(T, root, clips)
    this.duration = clips[0]!.duration
    this.animation.play(clips[0]!.name, { loop: 'repeat' })
    this.buildField(root)
  }
  private buildField(root: THREE.Object3D) {
    const T = this.library.THREE
    this.fieldGroup = new T.Group()
    const zBase = -.02
    for (const [ringIndex, ring] of FIELD_RING_CONFIG.entries()) {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * TAU + ringIndex * .11 + (i % 3) * .017
        const radius = ring.radius + Math.sin(i * 1.73 + ringIndex) * .18
        const tangent = angle + Math.PI / 2 + ((i + ringIndex) % 5 === 0 ? .21 : (i % 2 === 0 ? -.08 : .08))
        const length = ring.length * (1 + ((i + ringIndex) % 4 - 1.5) * .12)
        const geom = new T.PlaneGeometry(length, ring.thickness)
        const mat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: .92, depthWrite: false })
        const mesh = new T.Mesh(geom, mat)
        mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, zBase - ringIndex * .002)
        mesh.rotation.z = tangent
        this.fieldGroup.add(mesh)
        this.geometries.push(geom)
        this.fieldSegments.push({ material: mat, angle: ((angle % TAU) + TAU) % TAU / TAU, radius: clamp(radius / 13.9), weight: ring.weight, color: FIELD_BASE_COLORS[(i + ringIndex) % FIELD_BASE_COLORS.length]! })

        if ((i + ringIndex) % 3 === 0) {
          const nubGeom = new T.PlaneGeometry(ring.thickness * 1.25, ring.length * .42)
          const nubMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: .88, depthWrite: false })
          const nub = new T.Mesh(nubGeom, nubMat)
          nub.position.set(Math.cos(angle) * radius + Math.cos(tangent) * length * .16, Math.sin(angle) * radius + Math.sin(tangent) * length * .16, zBase - ringIndex * .0025)
          nub.rotation.z = tangent + Math.PI / 2
          this.fieldGroup.add(nub)
          this.geometries.push(nubGeom)
          this.fieldSegments.push({ material: nubMat, angle: ((angle % TAU) + TAU) % TAU / TAU, radius: clamp((radius + .22) / 13.9), weight: ring.weight * .88, color: FIELD_BASE_COLORS[(i + ringIndex + 2) % FIELD_BASE_COLORS.length]! })
        }
      }
    }
    root.add(this.fieldGroup)
  }
  update(context: Cinema2ModuleUpdateContext) {
    this.context = context
    const { frame, parameters } = context
    const time = frame.audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
    const id = JSON.stringify([frame.contextGeneration, frame.transport?.sourcePresent, frame.transport?.trackId, frame.audio?.upstream.sourceId, frame.audio?.upstream.analysisRevision, frame.audio?.upstream.timelineRevision, frame.audio?.discontinuity?.generation])
    const reset = id !== this.identity || (this.previousTime != null && (time < this.previousTime - .035 || time - this.previousTime > 1))
    if (reset) { this.clock.reset(); this.selection.reset(); this.eventLatch.reset(); this.policy.reset(); this.performance.reset(); this.previousBeat = null; this.phase = this.rotation = 0 }
    const idle = frame.transport?.sourcePresent === false && !frame.transport.paused
    const active = idle || (!frame.transport?.paused && frame.transport?.animationActive !== false)
    const dt = this.previousStamp == null || reset || !active ? 0 : clamp((frame.timestampMs - this.previousStamp) / 1000, 0, .1)
    const timing = { ...frame, elapsedTimeSec: 0, deltaTimeSec: dt, ...(frame.transport ? { transport: { ...frame.transport, animationActive: active } } : {}) }
    const beatState = this.clock.update(timing, parameters.get('bpmSync') !== false && !idle, 120)
    const beat = beatState.beats
    const step = this.previousBeat == null || !active ? 0 : clamp(beat - this.previousBeat, 0, 1)
    this.phase = (this.phase + step * this.num('chaseRate', 0, 2) / 4) % 1
    this.rotation = (this.rotation + (beatState.locked ? step / 32 : dt / Math.max(.001, this.duration || 33.3333)) * this.num('rotationRate', 0, 2)) % 1
    const saved = parameters.get('pattern') as SignsPattern
    const authored = SIGNS_PATTERNS.includes(saved) ? saved : SIGNS_DEFAULT_PATTERN
    const revision = parameters.getEditRevision?.('pattern') ?? 0
    const edited = this.authored !== null && (this.authored !== authored || this.previousRevision !== revision)
    const automatic = parameters.get('autoPerformance') === true && this.num('reactivity', 0, 1) > 0 && frame.transport?.sourcePresent === true && frame.mood != null
    const restored = this.auto && !automatic
    const trigger = parameters.get('trigger') as Cinema2AfterhoursTriggerId
    const policy = this.policy.update({ saved: { patternChange: parameters.get('patternChange') === true, trigger: CINEMA2_AFTERHOURS_TRIGGER_IDS.includes(trigger) ? trigger : 'bar4' }, mood: frame.mood, autoPerformance: automatic })
    const playing = frame.transport?.playing !== false && !frame.transport?.paused && !idle
    const drop = playing ? resolveCinema2AfterhoursTriggerEventIdentity(frame, 'drop', this.previousTime) : null
    const event = playing ? policy.trigger === 'drop' ? drop : resolveCinema2AfterhoursTriggerEventIdentity(frame, policy.trigger, this.previousTime) : null
    const silent = (frame.mood?.silence ?? 0) > .5
    const fresh = this.eventLatch.observe(policy.trigger, event)
    const qualified = fresh && this.wasPlaying && (!silent || policy.trigger === 'drop') ? event : null
    const base = this.selection.update({ authoredPattern: authored, patternChange: policy.patternChange, trigger: policy.trigger, triggerEventId: qualified, absoluteBeat: beat, reset, reselect: edited || restored })
    const result = this.performance.update({ enabled: automatic, absoluteBeat: beat, buildCharge: silent ? 0 : frame.director?.context.build.available ? frame.director.context.build.value ?? 0 : 0, dropEventId: drop, patternEdited: edited, reset, basePattern: base.activePattern, patternChange: policy.patternChange })
    const next = result.pattern ?? base.activePattern
    if (next !== this.pattern || reset || edited || restored) {
      const immediate = reset || edited || restored
      this.oldPattern = immediate ? next : this.pattern; this.pattern = next; this.transitionBeat = beat - (immediate ? 1 : 0)
    }
    const t = clamp(beat - this.transitionBeat); this.blend = t * t * (3 - 2 * t)
    this.overrideReason = result.reason
    this.previousBeat = beat; this.previousTime = time; this.previousStamp = frame.timestampMs; this.identity = id; this.authored = authored; this.previousRevision = revision; this.auto = automatic; this.wasPlaying = playing
  }
  private num(name: keyof typeof SIGNS_DEFAULTS, min: number, max: number) {
    const value = this.context?.parameters.get(name)
    return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : SIGNS_DEFAULTS[name]
  }
  private color(name: keyof typeof SIGNS_PALETTE, target: THREE.Color) {
    const value = this.context?.parameters.get(name)
    const rgb = Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(v => typeof v === 'number' && Number.isFinite(v)) ? value : SIGNS_PALETTE[name]
    return target.setRGB(rgb[0], rgb[1], rgb[2], this.library.THREE.SRGBColorSpace)
  }
  beforeDraw() {
    if (!this.neon) return
    this.animation?.sync(this.rotation * this.duration)
    this.u.signsPhase.value = this.phase * TAU
    this.u.signsFrom.value = SIGNS_PATTERNS.indexOf(this.oldPattern); this.u.signsTo.value = SIGNS_PATTERNS.indexOf(this.pattern); this.u.signsBlend.value = this.blend
    this.u.signsDepth.value = this.num('chaseDepth', 0, 1); this.u.signsAccent.value = this.num('accentMix', 0, 1)
    this.u.signsThickness.value = 1.25 + this.num('chaseDepth', 0, 1) * .45
    this.color('signTint', this.u.signsTint.value); this.color('accentColor', this.u.signsAccentColor.value)
    const intensity = this.num('intensity', 0, 2)
    this.neon.emissiveIntensity = 3.35 * intensity
    for (const m of this.backing) {
      this.color('structureColor', m.color)
      m.color.multiplyScalar(.22)
      m.roughness = 1
      m.metalness = 0
      m.emissive.setRGB(0, 0, 0)
    }
    const level = this.num('markerLevel', 0, 1.5)
    for (const segment of this.fieldSegments) {
      const from = signsMask(this.oldPattern, segment.angle, segment.radius, this.phase)
      const to = signsMask(this.pattern, segment.angle, segment.radius, this.phase)
      const mixValue = from + (to - from) * this.blend
      const gain = level * intensity * segment.weight * (.18 + .82 * mixValue)
      segment.material.color.setRGB(segment.color[0], segment.color[1], segment.color[2], this.library.THREE.SRGBColorSpace).multiplyScalar(gain)
      segment.material.opacity = clamp(.22 + gain * .42, 0, 1)
    }
    if (this.fieldGroup) this.fieldGroup.visible = level > 0 && intensity > 0
  }
  inspect() { return { ...this.policy.inspect(), pattern: this.pattern, overrideReason: this.overrideReason, phase: this.phase, rotation: this.rotation, blend: this.blend, clipDuration: this.duration, fieldSegmentCount: this.fieldSegments.length, neonAttached: !!this.neon } }
  dispose() {
    this.animation?.dispose(); this.animation = null
    this.fieldGroup?.removeFromParent(); this.fieldGroup = null
    this.geometries.forEach(g => g.dispose()); this.fieldSegments.forEach(segment => segment.material.dispose())
    this.geometries = []; this.fieldSegments = []; this.backing = []; this.neon = null; this.context = null
    this.clock.reset(); this.selection.reset(); this.eventLatch.reset(); this.policy.reset(); this.performance.reset()
  }
}
export const cinema2SignsNativeModuleDefinition = createCinema2ThreeSceneModuleDefinition({ typeId: CINEMA2_SIGNS_MODULE_TYPE_ID, resourceKey: 'signs-native:bridge', createModelController: library => new Cinema2SignsController(library) })
