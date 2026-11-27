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
  private markerGroup: THREE.Group | null = null
  private markers: THREE.MeshBasicMaterial[] = []
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
      signsPhase: { value: 0 }, signsDepth: { value: .65 }, signsAccent: { value: .35 },
      signsFrom: { value: 0 }, signsTo: { value: 0 }, signsBlend: { value: 1 },
      signsTint: { value: new library.THREE.Color(1, 1, 1) }, signsAccentColor: { value: new library.THREE.Color(.18, .88, 1) },
    }
  }
  attach(root: THREE.Object3D, _userModel?: boolean, clips: readonly THREE.AnimationClip[] = []) {
    const T = this.library.THREE
    // Keep the entire authored hierarchy and original material maps. The source is a ~20-unit XY sign.
    root.scale.setScalar(.1)
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
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nuniform float signsPhase, signsDepth, signsAccent, signsBlend;\nuniform int signsFrom, signsTo;\nuniform vec3 signsTint, signsAccentColor;\n${SIGNS_MASK_GLSL}`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n#ifdef USE_EMISSIVEMAP\nvec2 sp = vEmissiveMapUv*2.-1.;\nfloat sa = atan(sp.y,sp.x);\nfloat sr = length(sp);\nfloat sm = mix(signsMask(signsFrom,sa,sr,signsPhase), signsMask(signsTo,sa,sr,signsPhase),signsBlend);\nvec3 original = totalEmissiveRadiance;\nfloat luminance = max(max(original.r,original.g),original.b);\ntotalEmissiveRadiance = mix(original*signsTint,signsAccentColor*luminance,signsAccent*sm*.65)*mix(1.,.13+.87*sm,signsDepth);\n#endif`)
        }
        m.customProgramCacheKey = () => 'cinema2-signs-score-v1'
        m.needsUpdate = true
      }
    })
    if (!this.neon || !clips.length) throw new Error('SIGNS requires its original emissive texture and rotation clip.')
    this.animation = new Cinema2ThreeAnimationController(T, root, clips)
    this.duration = clips[0]!.duration
    this.animation.play(clips[0]!.name, { loop: 'repeat' })
    // Peripheral, low-density arc markers stay stationary while the original texture rotates behind the mask.
    this.markerGroup = new T.Group()
    for (let i = 0; i < 16; i++) {
      const g = new T.TorusGeometry(10.65, .035, 5, 12, .16)
      const m = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
      const mesh = new T.Mesh(g, m)
      mesh.rotation.z = i * TAU / 16 - .08
      mesh.position.z = .8
      this.markerGroup.add(mesh); this.markers.push(m); this.geometries.push(g)
    }
    root.add(this.markerGroup)
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
    this.color('signTint', this.u.signsTint.value); this.color('accentColor', this.u.signsAccentColor.value)
    const intensity = this.num('intensity', 0, 2)
    this.neon.emissiveIntensity = 2.9963853371 * intensity
    for (const m of this.backing) { this.color('structureColor', m.color); m.roughness = .72; m.metalness = .12 }
    const level = this.num('markerLevel', 0, 1.5)
    for (const [i, m] of this.markers.entries()) {
      const a = i / 16, from = signsMask(this.oldPattern, a, 1, this.phase), to = signsMask(this.pattern, a, 1, this.phase)
      this.color('orbitColor', m.color).multiplyScalar(level * intensity * (.12 + .88 * (from + (to - from) * this.blend)))
    }
    if (this.markerGroup) this.markerGroup.visible = level > 0 && intensity > 0
  }
  inspect() { return { ...this.policy.inspect(), pattern: this.pattern, overrideReason: this.overrideReason, phase: this.phase, rotation: this.rotation, blend: this.blend, clipDuration: this.duration, markerCount: this.markers.length, neonAttached: !!this.neon } }
  dispose() {
    this.animation?.dispose(); this.animation = null
    this.markerGroup?.removeFromParent(); this.markerGroup = null
    this.geometries.forEach(g => g.dispose()); this.markers.forEach(m => m.dispose())
    this.geometries = []; this.markers = []; this.backing = []; this.neon = null; this.context = null
    this.clock.reset(); this.selection.reset(); this.eventLatch.reset(); this.policy.reset(); this.performance.reset()
  }
}
export const cinema2SignsNativeModuleDefinition = createCinema2ThreeSceneModuleDefinition({ typeId: CINEMA2_SIGNS_MODULE_TYPE_ID, resourceKey: 'signs-native:bridge', createModelController: library => new Cinema2SignsController(library) })
