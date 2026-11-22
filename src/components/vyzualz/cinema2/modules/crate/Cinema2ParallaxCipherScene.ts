import type * as Three from 'three'
import type { Cinema2Color, Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleUpdateContext } from '../Cinema2ModuleContracts'
import { Cinema2PatternControlResolver } from '../../conductor/Cinema2PatternControls'
import { Cinema2BeatClock } from '../Cinema2BeatClock'
import { Cinema2PatternAutoPerformance } from '../mainframe/Cinema2PatternAutoPerformance'
import { resolveCinema2AfterhoursTriggerEventIdentity } from '../Cinema2AfterhoursNativeModule'
import { Cinema2MainframePatternController, resolveCinema2MainframeTriggerEventIdentity, type Cinema2MainframeTriggerId } from '../mainframe/Cinema2MainframePatternController'
import { Cinema2MainframeBeatClockResolver } from '../mainframe/Cinema2MainframePatternEngine'
import { CINEMA2_SAY_IT_FONT_FAMILY, type Cinema2GlyphMetrics } from '../sayIt/Cinema2SayItTextLayout'
import { disposeObject } from '../three/Cinema2ThreeAssetCache'
import { CINEMA2_SAY_IT_GLYPH_ASSET_ID } from '../three/Cinema2ThreeAssetManifest'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import {
  PARALLAX_CIPHER_TEXT, layoutParallaxCipherGlyphs, sampleParallaxCipherEye,
} from './Cinema2ParallaxCipherLayout'
import { PARALLAX_CIPHER_PALETTE_DEFAULTS, type ParallaxCipherPaletteName } from './Cinema2ParallaxCipherPalette'
import {
  PARALLAX_CIPHER_TEXT_TRANSITION_BEATS, REST_LETTER, blendParallaxCipherLetter, evaluateParallaxCipherLetter, evaluateParallaxCipherTransition, scaleParallaxCipherLetter,
  type ParallaxCipherLetterPose,
} from './Cinema2ParallaxCipherTextEffects'
import {
  CINEMA2_PARALLAX_CIPHER_DEFAULT_PATTERN, CINEMA2_PARALLAX_CIPHER_PATTERN_IDS, CINEMA2_PARALLAX_CIPHER_TRIGGER_IDS, PARALLAX_CIPHER_BANK_COUNT,
  blendParallaxCipherBank, blendParallaxCipherScene, evaluateParallaxCipherBank, evaluateParallaxCipherScene, parallaxCipherScatterVector,
  type Cinema2ParallaxCipherPattern, type ParallaxCipherBankPose, type ParallaxCipherScenePose,
} from './Cinema2ParallaxCipherPatterns'

type GlyphPose = ReturnType<typeof layoutParallaxCipherGlyphs>[number]
type AssetMesh = Three.Mesh<Three.BufferGeometry, Three.Material | Three.Material[]>

export const PARALLAX_CIPHER_LIGHTS = [
  'near-cyan-contours', 'near-magenta-contours', 'far-cyan-contours', 'far-magenta-contours',
  'letter-bevels', 'registration-dots', 'red-alignment-marker', 'weave-neon',
] as const
type LightRole = typeof PARALLAX_CIPHER_LIGHTS[number]
type Rgb = readonly [number, number, number]
/** A glowing material: its authored sRGB color is tinted by the chosen palette color, then multiplied by its authored gain, Intensity, its lighting control and its bank's pattern glow. */
interface GlowEntry { material: Three.MeshBasicMaterial; palette: ParallaxCipherPaletteName; base: Rgb; gain: number; role: LightRole; bank: number | null }
/** A lit material whose color (and optionally emissive) is tinted by a palette color. */
interface TintEntry { material: Three.MeshStandardMaterial | Three.LineBasicMaterial; palette: ParallaxCipherPaletteName; color: Rgb; emissive?: Rgb }
const hexRgb = (hex: number): Rgb => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255]
const bankId = (index: number, side: number) => index * 2 + (side > 0 ? 1 : 0)
const TRANSITION_BEATS = 2
/** Where the parallax dust drifts: two depth layers of pinpoints that flow toward the viewer through the corridor, so the camera's swing sweeps them across each other. */
const DUST_COUNT = 300
const DUST_NEAR = 7, DUST_FAR = -22
const DUST_SPEED = .42
interface DustLayer { points: Three.Points; material: Three.PointsMaterial; palette: ParallaxCipherPaletteName; base: Float32Array; phase: Float32Array; colors: Float32Array }
const BACKDROP_LEFT: Rgb = [.018, .033, .051]
const BACKDROP_RIGHT: Rgb = [.040, .020, .040]
function readPattern(value: unknown): Cinema2ParallaxCipherPattern { return (CINEMA2_PARALLAX_CIPHER_PATTERN_IDS as readonly unknown[]).includes(value) ? value as Cinema2ParallaxCipherPattern : CINEMA2_PARALLAX_CIPHER_DEFAULT_PATTERN }

/** Private scene objects built over the original plate and SAY IT glyph buffers. */
export class Cinema2ParallaxCipherScene {
  private readonly THREE: Cinema2ThreeLibrary['THREE']
  private readonly materials: Three.Material[] = []
  private readonly geometry: Three.BufferGeometry[] = []
  private readonly edges = new Map<Three.BufferGeometry, Three.EdgesGeometry>()
  private readonly glyphSources = new Map<string, AssetMesh>()
  private readonly plateBanks: { object: Three.Group; turn: number; tip: number; side: number; offset: number; index: number; baseX: number; baseY: number }[] = []
  private readonly glows: GlowEntry[] = []
  private readonly tints: TintEntry[] = []
  private readonly bounceLights: { light: Three.PointLight; palette: ParallaxCipherPaletteName; base: number; color: Rgb }[] = []
  private tone: { left: Three.Vector3; right: Three.Vector3 } | null = null
  private params: Cinema2ModuleUpdateContext['parameters'] | null = null
  private readonly beatClock = new Cinema2BeatClock()
  private readonly triggerClock = new Cinema2MainframeBeatClockResolver()
  private readonly selection = new Cinema2MainframePatternController<Cinema2ParallaxCipherPattern>(CINEMA2_PARALLAX_CIPHER_PATTERN_IDS, CINEMA2_PARALLAX_CIPHER_DEFAULT_PATTERN)
  private readonly policy = new Cinema2PatternControlResolver<Cinema2MainframeTriggerId>()
  // Auto Performance owns one thing: the pattern on stage during a build (Collapse) or a drop (Shatter) and, between them, a pattern chosen by how the passage feels.
  // The saved Pattern, Pattern Change and Trigger are never written to.
  private readonly performance = new Cinema2PatternAutoPerformance<Cinema2ParallaxCipherPattern>({
    buildPattern: 'collapse', dropPattern: 'shatter', buildMaxBeats: 32, dropBeats: 8,
    mood: { options: { calm: ['reading-line', 'open-gate'], driving: ['counter-spiral', 'cascade'], tense: ['collapse', 'counter-spiral'], peak: ['cascade', 'shatter'] } },
  })
  private autoWasEnabled = false
  private overrideReason: string | null = null
  private pattern: Cinema2ParallaxCipherPattern = CINEMA2_PARALLAX_CIPHER_DEFAULT_PATTERN
  private previousPattern: Cinema2ParallaxCipherPattern = CINEMA2_PARALLAX_CIPHER_DEFAULT_PATTERN
  private transitionStart: number | null = null
  private beats = 0
  private lastBeats: number | null = null
  private previousTimeSec: number | null = null
  private previousTriggerBeat: number | null = null
  private previousTimestamp: number | null = null
  private identity: string | null = null
  private authoredPattern: Cinema2ParallaxCipherPattern | null = null
  private editRevision: number | null = null
  private bankPoses: ParallaxCipherBankPose[] = []
  private scenePose: ParallaxCipherScenePose = { scatter: 0, recoil: 1, weaveScale: 1, weaveSpin: 0 }
  private stagger = 1
  private readonly lampTube: Three.CylinderGeometry
  private readonly dotMesh: Three.SphereGeometry
  private readonly foldedInset: Three.BufferGeometry
  private readonly chrome: Three.MeshStandardMaterial
  private readonly bevels: readonly Three.MeshBasicMaterial[]
  private localFontLoad: AbortController | null = null
  private localFontRoot: Three.Object3D | null = null
  private fontMetrics: Readonly<Cinema2GlyphMetrics> | undefined
  private textRoot: Three.Group | null = null
  private glyphs: { node: Three.Group; pose: GlyphPose }[] = []
  private glyphSignature: string | null = null
  /** The line on stage. It follows the typed line the current beat selects, and changes over through the active pattern's transition. */
  private shownText: string = PARALLAX_CIPHER_TEXT
  private lines: readonly string[] = [PARALLAX_CIPHER_TEXT]
  private shownLine = 0
  private lineBump = 0
  private lastDropId: string | null = null
  private lastBumpBeat: number | null = null
  private textTransition: { start: number; pattern: Cinema2ParallaxCipherPattern; swapped: boolean } | null = null
  private letterGlow = 1
  private time = 0
  private knot: Three.Group | null = null
  private plateCount = 0
  /** Shared by every neon material: the chase's phase (one cycle every two beats) and its strength. At zero strength the neon is the plain glow. */
  private readonly neon = { phase: { value: 0 }, chase: { value: 0 } }
  private readonly dust: DustLayer[] = []
  private dustTexture: Three.DataTexture | null = null

  constructor(private readonly library: Cinema2ThreeLibrary) {
    this.THREE = library.THREE
    const { THREE } = this
    this.lampTube = this.ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 5))
    this.dotMesh = this.ownGeometry(new THREE.SphereGeometry(1, 7, 5))
    this.foldedInset = this.createFoldedInset()
    this.chrome = this.ownMaterial(new THREE.MeshStandardMaterial({
      color: 0xe2e7f4, emissive: 0xc8d6f2, emissiveIntensity: .16, metalness: .63, roughness: .23,
    }))
    this.tints.push({ material: this.chrome, palette: 'letterColor', color: hexRgb(0xe2e7f4), emissive: hexRgb(0xc8d6f2) })
    this.bevels = [this.glow(0x42dfef, .68, 'leftBankColor', 'letter-bevels', null, THREE.FrontSide, 'across'), this.glow(0xff60bb, .68, 'rightBankColor', 'letter-bevels', null, THREE.FrontSide, 'across')]
  }

  attach(root: Three.Object3D, _userModel?: boolean, _clips?: readonly Three.AnimationClip[], id?: string): void {
    root.updateMatrixWorld(true)
    const source: AssetMesh[] = []
    root.traverse(object => { if ((object as AssetMesh).isMesh) source.push(object as AssetMesh) })
    const original = [...root.children]
    if (id === CINEMA2_SAY_IT_GLYPH_ASSET_ID) {
      for (const mesh of source) this.glyphSources.set(mesh.name, mesh)
      this.textRoot = this.group(root, 'cipher-text')
      this.syncText()
      if (import.meta.env.DEV && ['127.0.0.1', 'localhost', '[::1]'].includes(globalThis.location?.hostname ?? '')) {
        this.localFontLoad = new AbortController()
        void this.loadLocalChopsic(this.localFontLoad.signal)
      }
    } else {
      if (!source.length) throw new Error('Parallax Cipher is missing the original Paradox Weave plates.')
      this.buildEnvironment(root, source)
    }
    const library = this.group(root, 'source-mesh-library')
    library.visible = false
    library.add(...original)
  }

  update({ frame, parameters }: Cinema2ModuleUpdateContext): void {
    this.params = parameters
    this.lines = this.readLines(parameters)
    this.stagger = this.number('depthStagger', 1, 0, 1.5)
    this.time = frame.elapsedTimeSec
    this.updateTiming(frame, parameters)
  }

  /** The beat position, the Pattern Change controller and the transition between patterns. Pattern selection is the shared Mainframe controller; nothing here keeps a second musical clock. */
  private updateTiming(frame: Cinema2ModuleUpdateContext['frame'], parameters: Cinema2ModuleUpdateContext['parameters']): void {
    const time = frame.audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
    const identity = JSON.stringify([frame.contextGeneration, frame.transport?.trackId, frame.audio?.upstream.sourceId, frame.audio?.upstream.analysisRevision, frame.audio?.upstream.timelineRevision, frame.audio?.discontinuity.generation])
    const reset = identity !== this.identity || (this.previousTimeSec != null && time < this.previousTimeSec - .01)
    if (reset) { this.beatClock.reset(); this.selection.reset(); this.policy.reset(); this.performance.reset(); this.triggerClock.reset(); this.lastBeats = null }
    const active = !frame.transport?.paused && (!frame.transport?.sourcePresent || frame.transport.animationActive !== false)
    const idleDelta = this.previousTimestamp == null ? 0 : Math.max(0, (frame.timestampMs - this.previousTimestamp) / 1000)
    const delta = Math.min(.1, Math.max(0, frame.transport?.sourcePresent ? frame.deltaTimeSec : idleDelta))
    this.previousTimestamp = frame.timestampMs
    const timingFrame = { ...frame, elapsedTimeSec: frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec, deltaTimeSec: active ? delta : 0, ...(frame.transport ? { transport: { ...frame.transport, animationActive: active } } : {}) }
    this.beats = this.beatClock.update(timingFrame, parameters.get('bpmSync') !== false).beats
    const authored = readPattern(parameters.get('pattern'))
    const revision = parameters.getEditRevision?.('pattern') ?? 0
    const edited = (this.editRevision != null && revision !== this.editRevision) || (this.authoredPattern != null && authored !== this.authoredPattern)
    const savedTrigger = (CINEMA2_PARALLAX_CIPHER_TRIGGER_IDS as readonly string[]).includes(parameters.get('trigger') as string) ? parameters.get('trigger') as Cinema2MainframeTriggerId : 'bar4'
    const auto = parameters.get('autoPerformance') === true && this.number('reactivity', .65, 0, 1) > 0 && frame.transport?.sourcePresent === true && (frame.transport.playing || frame.transport.paused) && frame.mood != null
    const authorityRestored = this.autoWasEnabled && !auto
    this.autoWasEnabled = auto
    // With Auto Performance on, Pattern Change and the Trigger are the music's choice; the saved values apply again, unchanged, the moment it is off.
    const controls = this.policy.update({ saved: { patternChange: parameters.get('patternChange') === true, trigger: savedTrigger }, mood: frame.mood, autoPerformance: auto })
    const triggerTiming = this.triggerClock.resolve(timingFrame, true)
    const drop = resolveCinema2AfterhoursTriggerEventIdentity(frame, 'drop', this.previousTimeSec)
    const selected = this.selection.update({
      authoredPattern: authored, patternChange: controls.patternChange, trigger: controls.trigger,
      triggerEventId: controls.trigger === 'drop' ? drop : resolveCinema2MainframeTriggerEventIdentity(frame, controls.trigger, this.previousTimeSec, drop, { previousBeat: this.previousTriggerBeat, current: triggerTiming }),
      absoluteBeat: this.beats, reset: reset || edited,
    })
    const performing = this.performance.update({
      enabled: auto, absoluteBeat: this.beats, buildCharge: frame.mood?.silence && frame.mood.silence > .5 ? 0 : frame.director?.context.build.available ? frame.director.context.build.value ?? 0 : 0,
      dropEventId: drop, patternEdited: edited, reset, basePattern: selected.activePattern, patternChange: controls.patternChange, mood: frame.mood, deltaTimeSec: frame.deltaTimeSec, seed: identity,
    })
    this.overrideReason = performing.reason
    const next = performing.pattern ?? selected.activePattern
    if (next !== this.pattern) {
      this.previousPattern = this.pattern
      this.pattern = next
      // A manual edit, a reset or Auto Performance being turned off takes effect at once; only a Trigger- or music-driven change eases in.
      this.transitionStart = edited || reset || authorityRestored ? null : this.beats
    }
    if (reset || edited || authorityRestored) this.transitionStart = null
    if (reset) { this.lineBump = 0; this.lastDropId = null; this.lastBumpBeat = null; this.textTransition = null }
    // On a drop, Auto Performance brings the other typed line on stage; the saved hold time resumes from there.
    // One line change per drop: a run of closely spaced drop events (a long drop is reported more than once) counts as one.
    if (auto && drop && drop !== this.lastDropId && this.lines.length > 1 && (this.lastBumpBeat == null || this.beats - this.lastBumpBeat >= 8 || this.beats < this.lastBumpBeat)) {
      this.lineBump += 1
      this.lastBumpBeat = this.beats
    }
    this.lastDropId = drop
    this.lastBeats = this.beats
    this.previousTriggerBeat = triggerTiming.beats
    this.previousTimeSec = time
    this.identity = identity
    this.authoredPattern = authored
    this.editRevision = revision
  }

  private readLines(parameters: Cinema2ModuleUpdateContext['parameters']): readonly string[] {
    const first = String(parameters.get('cipherText') ?? PARALLAX_CIPHER_TEXT)
    const second = parameters.get('lineMode') === 'one' ? '' : String(parameters.get('lineTwoText') ?? '')
    return second.trim() ? [first, second] : [first]
  }

  /** The typed line the beat position selects: Line 1 and Line 2 alternate every Line Hold bars. */
  private currentLine(): number {
    if (this.lines.length < 2) return 0
    const parsed = Number(this.params?.get('lineHold'))
    const hold = Math.max(1, Math.min(16, Math.round(Number.isFinite(parsed) ? parsed : 4))) * 4
    return (Math.floor(Math.max(0, this.beats) / hold) + this.lineBump) % 2
  }

  /** Editing the shown line swaps it at once; the beat moving to the other line takes it through the transition, which swaps the text at its midpoint. */
  private advanceText(): void {
    const line = this.currentLine()
    const desired = this.lines[Math.min(line, this.lines.length - 1)]!
    const t = this.textTransition
    if (t && (this.beats < t.start || this.number('textMotion', 1, 0, 1.5) <= 0)) this.textTransition = null
    if (this.textTransition) {
      const progress = (this.beats - this.textTransition.start) / PARALLAX_CIPHER_TEXT_TRANSITION_BEATS
      if (progress >= 0.5 && !this.textTransition.swapped) { this.shownText = desired; this.shownLine = line; this.textTransition.swapped = true }
      else if (this.textTransition.swapped) this.shownText = desired
      if (progress >= 1) this.textTransition = null
      return
    }
    if (line !== this.shownLine && this.number('textMotion', 1, 0, 1.5) > 0 && this.shownText !== desired) {
      this.textTransition = { start: this.beats, pattern: this.pattern, swapped: false }
      return
    }
    this.shownLine = line
    this.shownText = desired
  }

  private computePoses(): void {
    this.advanceText()
    const eased = this.transitionStart == null ? 1 : Math.min(1, Math.max(0, (this.beats - this.transitionStart) / TRANSITION_BEATS))
    const k = eased * eased * (3 - 2 * eased)
    if (eased >= 1) this.transitionStart = null
    for (let index = 0; index < PARALLAX_CIPHER_BANK_COUNT; index += 1) {
      for (const side of [-1, 1]) {
        const to = evaluateParallaxCipherBank(this.pattern, this.beats, index, side)
        this.bankPoses[bankId(index, side)] = k < 1 ? blendParallaxCipherBank(evaluateParallaxCipherBank(this.previousPattern, this.beats, index, side), to, k) : to
      }
    }
    const scene = evaluateParallaxCipherScene(this.pattern, this.beats)
    this.scenePose = k < 1 ? blendParallaxCipherScene(evaluateParallaxCipherScene(this.previousPattern, this.beats), scene, k) : scene
  }

  /** The recoil and sway follow the camera that is actually drawing (any Camera Mode, any speed); without one they follow the authored path. */
  beforeDraw(_quality?: unknown, camera?: Readonly<{ position: readonly [number, number, number] }>): void {
    // The line changes over inside computePoses, so the glyphs are rebuilt after it.
    this.computePoses()
    this.syncText()
    const eye = camera?.position ?? sampleParallaxCipherEye(this.time)
    const displacement = Math.min(1, Math.abs(eye[0]) / 4.25)
    const sway = eye[0] / 4.35
    const { scatter, recoil: recoilScale, weaveScale, weaveSpin } = this.scenePose
    const twist = this.number('bankTwist', 1, 0, 1.5)
    const spread = this.number('plateSpread', 1, .6, 1.5)
    const motion = Math.min(1.5, this.number('textMotion', 1, 0, 1.5))
    const score = this.number('scoreAmount', .5, 0, 1)
    const ripple = score * this.number('letterRipple', 0, 0, 1)
    const release = score * this.number('dropRelease', 0, 0, 1)
    const count = this.glyphs.length
    const blend = this.transitionStart == null ? 1 : Math.min(1, Math.max(0, (this.beats - this.transitionStart) / TRANSITION_BEATS))
    const mix = blend * blend * (3 - 2 * blend)
    const textProgress = this.textTransition ? (this.beats - this.textTransition.start) / PARALLAX_CIPHER_TEXT_TRANSITION_BEATS : 0
    let glowSum = 0
    this.glyphs.forEach(({ node, pose }, index) => {
      const phase = pose.glyph.characterIndex * 1.43
      const recoil = Math.sin(this.beats * 1.15 + phase) * displacement * recoilScale
      let letter: ParallaxCipherLetterPose = evaluateParallaxCipherLetter(this.pattern, this.beats, index, count)
      if (mix < 1) letter = blendParallaxCipherLetter(evaluateParallaxCipherLetter(this.previousPattern, this.beats, index, count), letter, mix)
      letter = scaleParallaxCipherLetter(letter, Math.min(1, motion))
      if (motion > 1) letter = blendParallaxCipherLetter(letter, evaluateParallaxCipherLetter(this.pattern, this.beats, index, count), motion - 1)
      const passing = this.textTransition ? scaleParallaxCipherLetter(evaluateParallaxCipherTransition(this.textTransition.pattern, textProgress, index, count), Math.min(1, motion)) : REST_LETTER
      // The snare's ripple runs along the word; it is the score's letter cue.
      const wave = ripple * Math.sin(this.beats * 2 - index * 1.1)
      node.rotation.set(recoil * .22 + letter.rotX + passing.rotX + wave * .3, sway * Math.cos(phase) * .47 * recoilScale + letter.rotY + passing.rotY, recoil * .09 + letter.rotZ + passing.rotZ + wave * .12)
      const thrown = parallaxCipherScatterVector(pose.glyph.characterIndex)
      const throw_ = scatter + release * .6
      node.position.set(
        pose.position[0] + thrown[0] * throw_ + letter.dx + passing.dx,
        pose.position[1] + thrown[1] * throw_ + letter.dy + passing.dy + wave * .16,
        pose.position[2] + thrown[2] * throw_ + letter.dz + passing.dz,
      )
      node.scale.setScalar(pose.scale * letter.scale * passing.scale)
      glowSum += letter.glow * passing.glow
    })
    this.letterGlow = count ? glowSum / count : 1
    for (const { object, turn, tip, side, offset, index, baseX, baseY } of this.plateBanks) {
      const pose = this.bankPoses[bankId(index, side)] ?? { spread: 1, twist: 0, tip: 0, lift: 0, glow: 1 }
      // The score's plate cue: a kick lifts and widens the banks nearest the viewer first.
      const pulse = score * this.number('platePulse', 0, 0, 1)
      const near = 1 - index / PARALLAX_CIPHER_BANK_COUNT
      const followThrough = Math.sin(this.beats * .85 - offset) * displacement
      object.position.x = baseX * spread * (pose.spread + .05 * pulse * near + .12 * release)
      object.position.y = baseY + pose.lift + .2 * pulse * near
      object.rotation.y = turn + side * ((sway * .13 + .065 * followThrough) + pose.twist) * twist
      object.rotation.z = tip + side * ((.10 * sway + .037 * followThrough) + pose.tip) * twist
    }
    if (this.knot) {
      this.knot.rotation.y = .72 - sway * .26 + weaveSpin
      this.knot.scale.setScalar(2.45 * this.number('weaveScale', 1, .5, 1.6) * weaveScale * (1 + .15 * release))
    }
    this.neon.phase.value = this.beats * Math.PI
    this.neon.chase.value = this.number('neonChase', .6, 0, 1.5) * (.7 + .9 * score * this.number('platePulse', 0, 0, 1))
    this.driftDust(score)
    this.applyLook()
  }

  /** The dust flows toward the viewer and wavers a little; each point fades in and out at the ends of its run, so nothing pops. The kick lifts its brightness. */
  private driftDust(score: number): void {
    const level = this.number('dust', .5, 0, 1.5) * (1 + .8 * score * this.number('platePulse', 0, 0, 1))
    const range = DUST_NEAR - DUST_FAR
    for (const layer of this.dust) {
      layer.points.visible = level > .001
      if (!layer.points.visible) continue
      const position = layer.points.geometry.getAttribute('position') as Three.BufferAttribute
      const color = layer.points.geometry.getAttribute('color') as Three.BufferAttribute
      for (let index = 0; index < position.count; index += 1) {
        const phase = layer.phase[index]!
        const run = ((layer.base[index * 3 + 2]! - DUST_FAR + this.time * DUST_SPEED * (.6 + .8 * (phase % 1))) % range + range) % range
        const edge = Math.min(run, range - run) / (range * .12)
        const fade = Math.min(1, edge) * (.55 + .45 * Math.sin(this.time * 1.3 + phase * 6.1))
        position.setXYZ(index, layer.base[index * 3]! + Math.sin(this.time * .17 + phase * 4) * .22, layer.base[index * 3 + 1]! + Math.sin(this.time * .23 + phase * 7) * .26, DUST_FAR + run)
        color.setXYZ(index, fade, fade, fade)
      }
      position.needsUpdate = true
      color.needsUpdate = true
      layer.material.opacity = Math.min(1, level)
    }
  }

  private number(name: string, fallback: number, min: number, max: number): number {
    const value = this.params?.get(name)
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
  }

  private paletteColor(name: ParallaxCipherPaletteName): Rgb {
    const value = this.params?.get(name)
    const color = Array.isArray(value) && value.length >= 3 && value.every(component => typeof component === 'number' && Number.isFinite(component)) ? value as unknown as Cinema2Color : PARALLAX_CIPHER_PALETTE_DEFAULTS[name]
    return [color[0], color[1], color[2]]
  }

  /** Every color and glow follows the palette and the lighting controls; a material's authored color is scaled by (chosen / authored) so the defaults are the original look. */
  private applyLook(): void {
    const { THREE } = this
    const palette = Object.fromEntries((Object.keys(PARALLAX_CIPHER_PALETTE_DEFAULTS) as ParallaxCipherPaletteName[]).map(name => [name, this.paletteColor(name)])) as Record<ParallaxCipherPaletteName, Rgb>
    const tint = (base: Rgb, name: ParallaxCipherPaletteName): Rgb => {
      const authored = PARALLAX_CIPHER_PALETTE_DEFAULTS[name], chosen = palette[name]
      return [0, 1, 2].map(channel => Math.min(1, base[channel]! * chosen[channel]! / Math.max(.001, authored[channel]!))) as unknown as Rgb
    }
    const intensity = this.number('intensity', 1, 0, 2)
    const score = this.number('scoreAmount', .5, 0, 1)
    const pulseNow = this.number('platePulse', 0, 0, 1)
    const roleGain: Record<LightRole, number> = {
      'near-cyan-contours': this.number('nearContours', 1, 0, 2), 'near-magenta-contours': this.number('nearContours', 1, 0, 2),
      'far-cyan-contours': this.number('farContours', 1, 0, 2), 'far-magenta-contours': this.number('farContours', 1, 0, 2),
      'letter-bevels': this.number('letterBevels', 1, 0, 2), 'registration-dots': this.number('registrationDots', 1, 0, 2), 'red-alignment-marker': this.number('redMarker', 1, 0, 2),
      'weave-neon': this.number('weaveGlow', .7, 0, 2),
    }
    for (const entry of this.glows) {
      const [r, g, b] = tint(entry.base, entry.palette)
      const pattern = entry.bank == null ? 1 : (this.bankPoses[entry.bank]?.glow ?? 1) * (1 + 1.2 * score * pulseNow)
      const letters = entry.role === 'letter-bevels' ? this.letterGlow : 1
      entry.material.color.setRGB(r, g, b, THREE.SRGBColorSpace).multiplyScalar(entry.gain * intensity * roleGain[entry.role] * pattern * letters)
    }
    const dustGain = intensity * Math.max(1, this.number('dust', .5, 0, 1.5))
    for (const layer of this.dust) layer.material.color.setRGB(...palette[layer.palette], THREE.SRGBColorSpace).multiplyScalar(dustGain)
    for (const entry of this.tints) {
      entry.material.color.setRGB(...tint(entry.color, entry.palette), THREE.SRGBColorSpace)
      if (entry.emissive) (entry.material as Three.MeshStandardMaterial).emissive.setRGB(...tint(entry.emissive, entry.palette), THREE.SRGBColorSpace)
    }
    for (const { light, palette: name, base, color } of this.bounceLights) {
      light.intensity = base * intensity
      light.color.setRGB(...tint(color, name), THREE.SRGBColorSpace)
    }
    if (this.tone) {
      this.tone.left.set(...tint(BACKDROP_LEFT, 'leftBankColor'))
      this.tone.right.set(...tint(BACKDROP_RIGHT, 'rightBankColor'))
    }
  }

  inspect(): Readonly<Record<string, unknown>> {
    return {
      presentation: 'parallax-cipher', plateCount: this.plateCount, glyphCount: this.glyphs.length,
      glyphFont: this.fontMetrics?.font.family ?? CINEMA2_SAY_IT_FONT_FAMILY,
      glyphDepths: this.glyphs.map(({ pose }) => pose.position[2]), lightingFamilies: PARALLAX_CIPHER_LIGHTS,
      pattern: this.pattern, beats: this.beats, shownText: this.shownText, shownLine: this.shownLine, lineCount: this.lines.length, textTransition: this.textTransition != null, performanceOverride: this.overrideReason, ...this.policy.inspect(), bankCount: this.plateBanks.length,
    }
  }

  dispose(): void {
    this.localFontLoad?.abort()
    if (this.localFontRoot) disposeObject(this.localFontRoot)
    this.localFontRoot = null
    for (const material of this.materials) material.dispose()
    for (const geometry of this.geometry) geometry.dispose()
    for (const layer of this.dust) { layer.points.geometry.dispose(); layer.material.dispose() }
    this.dust.length = 0
    this.dustTexture?.dispose()
    this.dustTexture = null
    this.glyphSources.clear()
    this.edges.clear()
    this.glyphs = []
    this.plateBanks.length = 0
    this.glows.length = 0
    this.tints.length = 0
    this.bounceLights.length = 0
    this.tone = null
    this.beatClock.reset(); this.selection.reset(); this.policy.reset(); this.performance.reset(); this.triggerClock.reset()
    this.textRoot = null
    this.knot = null
  }

  private async loadLocalChopsic(signal: AbortSignal): Promise<void> {
    // The personal-use asset lives in the ignored workspace, outside Vite's public build directory.
    const base = '/artifacts/parallax-cipher'
    try {
      const metricsResponse = await fetch(`${base}/chopsic-metrics.json`, { signal })
      if (!metricsResponse.ok) return
      const metrics = await metricsResponse.json() as Cinema2GlyphMetrics
      if (metrics.version !== 1 || metrics.font?.family !== 'Chopsic' || metrics.repertoire?.firstCodePoint !== 32
        || metrics.repertoire.lastCodePoint !== 126 || metrics.repertoire.fallbackCodePoint !== 63) return
      const meshResponse = await fetch(`${base}/chopsic.glb`, { signal })
      if (!meshResponse.ok) return
      const { scene } = await new this.library.GLTFLoader().parseAsync(await meshResponse.arrayBuffer(), '')
      const sources = new Map<string, AssetMesh>()
      scene.traverse(object => { if ((object as AssetMesh).isMesh) sources.set(object.name, object as AssetMesh) })
      const complete = Array.from({ length: 94 }, (_, index) => metrics.glyphs?.[String(index + 33)]?.mesh)
        .every(name => Boolean(name && sources.has(name) && sources.has(`${name}-led`)))
      if (signal.aborted || !complete) {
        disposeObject(scene)
        return
      }
      this.localFontRoot = scene
      this.fontMetrics = metrics
      this.glyphSources.clear()
      for (const [name, mesh] of sources) this.glyphSources.set(name, mesh)
      this.glyphSignature = null
    } catch {
      // An absent or unusable local preview leaves the bundled mesh library available.
    }
  }

  private syncText(): void {
    const signature = `${this.shownText}|${this.stagger.toFixed(3)}`
    if (!this.textRoot || this.glyphSignature === signature) return
    this.glyphSignature = signature
    this.textRoot.clear()
    this.glyphs = []
    const outlines = this.group(this.textRoot, 'glyph-meshes')
    for (const pose of layoutParallaxCipherGlyphs(this.shownText, this.fontMetrics, this.stagger)) {
      const source = this.glyphSources.get(pose.glyph.mesh)
      if (!source) throw new Error(`Parallax Cipher is missing glyph "${pose.glyph.mesh}".`)
      const node = this.group(outlines, pose.glyph.id)
      node.position.set(...pose.position)
      node.scale.setScalar(pose.scale)
      node.add(new this.THREE.Mesh(source.geometry, this.chrome))
      const contour = this.glyphSources.get(`${pose.glyph.mesh}-led`)
      if (contour) {
        const bevel = this.lightGroup(node, 'letter-bevels')
        bevel.add(new this.THREE.Mesh(contour.geometry, this.bevels[pose.glyph.characterIndex % this.bevels.length]!))
      }
      this.glyphs.push({ node, pose })
    }
  }

  private buildEnvironment(root: Three.Object3D, source: readonly AssetMesh[]): void {
    const { THREE } = this
    const scene = this.group(root, 'parallax-cipher')
    const redGlb = source.find(mesh => !Array.isArray(mesh.material) && mesh.material.name === 'Material')
    const plates = source.filter(mesh => mesh !== redGlb)
    const wallMaterial = [0x263543, 0x352d43, 0x18252e, 0x282430].map(color =>
      this.tinted(this.ownMaterial(new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: .28, metalness: .54, roughness: .38, side: THREE.DoubleSide,
      })), color, color, (color === 0x263543 || color === 0x18252e) ? 'leftBankColor' : 'rightBankColor'))
    const rankedPlates = plates.map(mesh => {
      const extent = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3())
      return { mesh, extent: extent.length() }
    }).sort((a, b) => b.extent - a.extent)
    const transfer = this.tinted(this.ownMaterial(new THREE.MeshStandardMaterial({
      color: 0x364351, emissive: 0x182236, emissiveIntensity: .55, metalness: .63, roughness: .27, side: THREE.DoubleSide,
    })), 0x364351, 0x182236, 'weaveColor')
    const red = this.glow(0xff3a46, 1.5, 'redMarkerColor', 'red-alignment-marker', null, THREE.DoubleSide, null)
    const knot = this.group(scene, 'original-paradox-weave')
    this.knot = knot
    knot.position.set(0, -.78, -7.35)
    knot.rotation.set(.18, .72, .14)
    knot.scale.setScalar(2.45)
    const backJoint = this.tinted(this.ownMaterial(new THREE.LineBasicMaterial({ color: 0x7f8ea8 })), 0x7f8ea8, undefined, 'weaveColor')
    const weaveNeon = this.glow(0xa9c8ff, .8, 'weaveColor', 'weave-neon')
    const weaveTubes = this.lightGroup(knot, 'weave-neon')
    for (const [index, plate] of plates.entries()) {
      this.copyPlate(knot, plate, transfer)
      if (index % 6 === 0) this.outline(knot, plate, backJoint)
      if (index % 4 === 1) this.neonEdges(weaveTubes, plate, null, .0085, weaveNeon, 8)
    }
    const alignment = this.lightGroup(knot, 'red-alignment-marker')
    if (redGlb) this.copyPlate(alignment, redGlb, red)
    const indexing = this.lightGroup(scene, 'registration-dots')
    const dotColors = [this.glow(0x61d9ef, .62, 'leftBankColor', 'registration-dots'), this.glow(0xf68ebe, .75, 'rightBankColor', 'registration-dots')]
    for (const [index, depth] of [6, 2.2, -1.9, -6.4, -11.2, -16.4, -22].entries()) {
      for (const side of [-1, 1]) {
        const variant = side > 0 ? 1 : 0
        const cyan = variant === 0
        const near = depth >= 0
        const warm = cyan ? 0x61e6f5 : 0xf876c7
        const sideName = cyan ? 'cyan' : 'magenta'
        const role = near ? (cyan ? 'near-cyan-contours' : 'near-magenta-contours') : (cyan ? 'far-cyan-contours' : 'far-magenta-contours')
        const lines = this.tinted(this.ownMaterial(new THREE.LineBasicMaterial({ color: cyan ? 0x4b9bb3 : 0xaa588e })), cyan ? 0x4b9bb3 : 0xaa588e, undefined, cyan ? 'leftBankColor' : 'rightBankColor')
        const rig = this.group(scene, `plate-bank-${sideName}-${index + 1}`)
        const turn = side * (.37 + (index % 3) * .18)
        const tip = side * (.22 + (index % 4) * .11) * (index % 2 ? -1 : 1)
        const baseX = side * (5.9 + (index % 2) * .68 + (side > 0 ? .21 : 0)), baseY = (index % 3 - 1) * .92 + side * .36
        rig.position.set(baseX, baseY, depth)
        rig.rotation.set(.22 * (index % 2 ? -1 : 1), turn, tip)
        this.plateBanks.push({ object: rig, turn, tip, side, offset: index * .6 + variant, index, baseX, baseY })
        const contour = this.lightGroup(rig, role)
        const light = this.glow(warm, near ? 1.7 : 1.02, cyan ? 'leftBankColor' : 'rightBankColor', role, bankId(index, side))
        const tube = this.glow(warm, near ? .95 : .6, cyan ? 'leftBankColor' : 'rightBankColor', role, bankId(index, side))
        for (let slice = 0; slice < 3; slice += 1) {
          const plate = rankedPlates[index * 4 + slice * 7 + variant]?.mesh
          if (!plate) continue
          const wall = this.group(rig, `source-plate-${slice + 1}`)
          wall.position.set(side * (.35 + .32 * slice), (slice - 1) * 1.13, -.7 * slice)
          wall.rotation.z = side * slice * .24
          wall.scale.set(1.85 - .21 * slice, 2.65 - .25 * slice, 1.45)
          this.copyPlate(wall, plate, wallMaterial[variant + slice % 2 * 2]!)
          if (slice < 2) this.insetPlate(wall, plate, wallMaterial[variant + 2]!, (index + slice) % 2 ? 1 : -1)
          this.outline(wall, plate, lines)
          wall.updateMatrix()
          this.neonEdges(contour, plate, wall.matrix, near ? .026 : .016, tube, near ? 20 : 12)
        }
        const rim: Cinema2Vector3[] = [
          [-side * .34, 2.85, -1.02], [-side * .79, 1.75, -.1], [-side * .84, -.58, .18],
          [-side * .42, -1.19, .62], [-side * .3, -2.55, .4],
        ]
        for (let segment = 1; segment < rim.length; segment += 1) {
          this.beam(contour, rim[segment - 1]!, rim[segment]!, near ? .017 : .012, light)
        }
        for (let dot = 0; dot < 7; dot += 1) {
          const marker = new THREE.Mesh(this.dotMesh, dotColors[variant]!)
          marker.position.set(side * (2.75 + dot * .29), -2.2 - dot * .025, depth + .28)
          marker.scale.setScalar(dot % 3 === 0 ? .051 : .024)
          indexing.add(marker)
        }
      }
    }
    // The two long rails per side are neon tubes now: the chase runs down them toward the viewer, cyan on the left and magenta on the right.
    const rails = [
      [this.glow(0x61e6f5, .75, 'leftBankColor', 'far-cyan-contours'), this.glow(0x61e6f5, .4, 'leftBankColor', 'far-cyan-contours')],
      [this.glow(0xf876c7, .75, 'rightBankColor', 'far-magenta-contours'), this.glow(0xf876c7, .4, 'rightBankColor', 'far-magenta-contours')],
    ] as const
    for (const side of [-1, 1]) {
      const [low, high] = rails[side < 0 ? 0 : 1]
      this.beam(scene, [side * 4.65, -2.37, 8], [side * 3.7, -2.66, -21], .034, low)
      this.beam(scene, [side * 4.68, 3.1, 7.8], [side * 3.8, 2.56, -20], .024, high)
    }
    this.buildDust(scene)
    const endpoint = this.lightGroup(scene, 'red-alignment-marker')
    for (const side of [-1, 1]) {
      this.beam(endpoint, [side * .46, -1.87, -3.4], [side * .17, -2.07, -3.34], .018, red)
      this.beam(endpoint, [side * .17, -2.07, -3.34], [side * .46, -2.27, -3.4], .018, red)
    }
    this.point(scene, 'cyan-bounce', [-3.8, 1.35, 4.1], 0x46d6f2, 46, 17, 'leftBankColor')
    this.point(scene, 'magenta-bounce', [3.85, .2, .2], 0xff559f, 47, 18, 'rightBankColor')
    this.point(scene, 'red-knot-bounce', [1.6, -.4, -7.2], 0xf73452, 34, 10, 'redMarkerColor')
    this.backdrop(scene)
  }

  private backdrop(scene: Three.Object3D): void {
    const { THREE } = this
    this.tone = { left: new THREE.Vector3(...BACKDROP_LEFT), right: new THREE.Vector3(...BACKDROP_RIGHT) }
    const material = this.ownMaterial(new THREE.ShaderMaterial({
      uniforms: { leftTone: { value: this.tone.left }, rightTone: { value: this.tone.right } },
      vertexShader: `varying vec2 field; void main() { field = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 field;
        uniform vec3 leftTone;
        uniform vec3 rightTone;
        void main() {
          vec2 p = (field - vec2(.5, .48)) * vec2(2.2, 2.6);
          float depth = exp(-5.0 * dot(p, p));
          vec3 tone = mix(leftTone, rightTone, smoothstep(-.42,.42,p.x));
          gl_FragColor = vec4(tone * (.20 + .8 * depth), 1.0);
          #include <colorspace_fragment>
        }`,
      toneMapped: false,
    }))
    const plane = new THREE.Mesh(this.ownGeometry(new THREE.PlaneGeometry(110, 82)), material)
    plane.position.z = -37
    plane.name = 'distant-blue-violet-field'
    scene.add(plane)
  }

  private group(parent: Three.Object3D, name: string): Three.Group {
    const group = new this.THREE.Group()
    group.name = name
    parent.add(group)
    return group
  }

  private lightGroup(parent: Three.Object3D, role: LightRole): Three.Group {
    const group = this.group(parent, role)
    group.userData.lightingFamily = role
    return group
  }

  private copyPlate(parent: Three.Object3D, source: AssetMesh, material: Three.Material): void {
    const mesh = new this.THREE.Mesh(source.geometry, material)
    mesh.name = source.name
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(source.matrixWorld)
    parent.add(mesh)
    this.plateCount += 1
  }

  private createFoldedInset(): Three.BufferGeometry {
    const { THREE } = this
    const vertices = [
      -.92, -.91, 0, .18, -.91, 0, -.04, .02, 0, -.92, .02, 0,
      -.92, .02, 0, -.04, .02, 0, -.54, .9, .17, -.92, .9, .17,
    ]
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7])
    geometry.computeVertexNormals()
    return this.ownGeometry(geometry)
  }

  private insetPlate(parent: Three.Object3D, source: AssetMesh, material: Three.Material, flip: number): void {
    const { THREE } = this
    if (!source.geometry.boundingBox) source.geometry.computeBoundingBox()
    const bounds = source.geometry.boundingBox!
    const inset = new THREE.Mesh(this.foldedInset, material)
    inset.name = 'folded-plate-inset'
    inset.matrixAutoUpdate = false
    inset.matrix.copy(source.matrixWorld).scale(new THREE.Vector3(bounds.max.x * flip, bounds.max.y, bounds.max.x))
    parent.add(inset)
  }

  private outline(parent: Three.Object3D, source: AssetMesh, material: Three.LineBasicMaterial): void {
    const contour = new this.THREE.LineSegments(this.edgesOf(source), material)
    contour.matrixAutoUpdate = false
    contour.matrix.copy(source.matrixWorld)
    parent.add(contour)
  }

  private beam(parent: Three.Object3D, from: Cinema2Vector3, to: Cinema2Vector3, radius: number, material: Three.Material): void {
    const { THREE } = this
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const direction = end.clone().sub(start)
    const mesh = new THREE.Mesh(this.lampTube, material)
    mesh.position.copy(start).lerp(end, .5)
    mesh.scale.set(radius, direction.length(), radius)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    parent.add(mesh)
  }

  private point(parent: Three.Object3D, name: string, at: Cinema2Vector3, color: number, intensity: number, range: number, palette: ParallaxCipherPaletteName): void {
    const light = new this.THREE.PointLight(color, intensity, range)
    light.position.set(...at)
    light.name = name
    parent.add(light)
    this.bounceLights.push({ light, palette, base: intensity, color: hexRgb(color) })
  }

  private tinted<M extends Three.MeshStandardMaterial | Three.LineBasicMaterial>(material: M, color: number, emissive: number | undefined, palette: ParallaxCipherPaletteName): M {
    this.tints.push({ material, palette, color: hexRgb(color), ...(emissive == null ? {} : { emissive: hexRgb(emissive) }) })
    return material
  }

  /** A glowing line, dot or bevel. Its color and brightness are applied every frame from the palette, Intensity, its lighting control and its bank's pattern glow. */
  private glow(color: number, gain: number, palette: ParallaxCipherPaletteName, role: LightRole, bank: number | null = null, side: Three.Side = this.THREE.FrontSide, lane: 'depth' | 'across' | null = 'depth'): Three.MeshBasicMaterial {
    const material = this.ownMaterial(new this.THREE.MeshBasicMaterial({ color, side, toneMapped: false }))
    material.color.multiplyScalar(gain)
    if (lane) this.neonize(material, lane)
    this.glows.push({ material, palette, base: hexRgb(color), gain, role, bank })
    return material
  }

  /**
   * Gives a glowing material its neon chase: a bright pulse that travels along the corridor toward the viewer (or across the word) once every two beats, hottest at its
   * centre where the color burns toward white, like gas in a tube. The material keeps its plain color and the palette still drives it; the pulse only multiplies it, and
   * at a Neon Chase of 0 it multiplies by one.
   */
  private neonize(material: Three.MeshBasicMaterial, lane: 'depth' | 'across'): void {
    const { phase, chase } = this.neon
    material.onBeforeCompile = shader => {
      shader.uniforms['neonPhase'] = phase
      shader.uniforms['neonChase'] = chase
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vNeonWorld;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 neonLocal = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            neonLocal = instanceMatrix * neonLocal;
          #endif
          vNeonWorld = (modelMatrix * neonLocal).xyz;`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vNeonWorld;\nuniform float neonPhase;\nuniform float neonChase;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float neonLane = ${lane === 'across' ? 'vNeonWorld.x * 0.9' : 'vNeonWorld.z * 0.5 + vNeonWorld.y * 0.12'};
          float neonWave = pow(0.5 + 0.5 * sin(neonLane - neonPhase), 5.0);
          float neonTop = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(neonTop), neonChase * 0.4 * neonWave) * (1.0 + neonChase * 1.5 * neonWave);`)
    }
    material.customProgramCacheKey = () => `parallax-cipher-neon-${lane}`
  }

  private edgesOf(source: AssetMesh): Three.EdgesGeometry {
    let edges = this.edges.get(source.geometry)
    if (!edges) {
      edges = this.ownGeometry(new this.THREE.EdgesGeometry(source.geometry, 23))
      this.edges.set(source.geometry, edges)
    }
    return edges
  }

  /** A real tube along each of a plate's longest edges, instanced into one draw call: the thick neon line that sits over the plate's 1px outline. `frame` places the plate in `parent`'s space (a wall's own transform). */
  private neonEdges(parent: Three.Object3D, source: AssetMesh, frame: Three.Matrix4 | null, radius: number, material: Three.Material, limit: number): void {
    const { THREE } = this
    const position = this.edgesOf(source).getAttribute('position')
    const toParent = frame ? frame.clone().multiply(source.matrixWorld) : source.matrixWorld
    const segments: { a: Three.Vector3; b: Three.Vector3; length: number }[] = []
    for (let index = 0; index + 1 < position.count; index += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(toParent)
      const b = new THREE.Vector3().fromBufferAttribute(position, index + 1).applyMatrix4(toParent)
      segments.push({ a, b, length: a.distanceTo(b) })
    }
    const picked = segments.filter(segment => segment.length > .14).sort((x, y) => y.length - x.length).slice(0, limit)
    if (!picked.length) return
    const tubes = new THREE.InstancedMesh(this.lampTube, material, picked.length)
    const matrix = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3(), turn = new THREE.Quaternion(), middle = new THREE.Vector3(), size = new THREE.Vector3()
    picked.forEach(({ a, b }, index) => {
      direction.subVectors(b, a)
      const length = direction.length()
      turn.setFromUnitVectors(up, direction.normalize())
      matrix.compose(middle.addVectors(a, b).multiplyScalar(.5), turn, size.set(radius, length, radius))
      tubes.setMatrixAt(index, matrix)
    })
    tubes.instanceMatrix.needsUpdate = true
    tubes.frustumCulled = false
    tubes.name = 'neon-edges'
    parent.add(tubes)
  }

  /** Two layers of dust, one in each bank's color. They are small round points whose positions are driven every frame (see driftDust). */
  private buildDust(scene: Three.Object3D): void {
    const { THREE } = this
    const size = 32, data = new Uint8Array(size * size * 4)
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const d = Math.hypot((x + .5) / size - .5, (y + .5) / size - .5) * 2
      data.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - d) ** 2)], (y * size + x) * 4)
    }
    this.dustTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
    this.dustTexture.needsUpdate = true
    let seed = 0x9e3779b9
    const random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
    for (const [side, palette] of [[-1, 'leftBankColor'], [1, 'rightBankColor']] as const) {
      const base = new Float32Array(DUST_COUNT * 3), phase = new Float32Array(DUST_COUNT), colors = new Float32Array(DUST_COUNT * 3)
      for (let index = 0; index < DUST_COUNT; index += 1) {
        base.set([side * (.6 + random() * 7), -2.9 + random() * 6.4, DUST_FAR + random() * (DUST_NEAR - DUST_FAR)], index * 3)
        phase[index] = random()
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base), 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      const material = new THREE.PointsMaterial({ map: this.dustTexture, size: .15, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, toneMapped: false })
      const points = new THREE.Points(geometry, material)
      points.name = `parallax-dust-${side < 0 ? 'cyan' : 'magenta'}`
      points.frustumCulled = false
      scene.add(points)
      this.dust.push({ points, material, palette, base, phase, colors })
    }
  }

  private ownGeometry<G extends Three.BufferGeometry>(geometry: G): G { this.geometry.push(geometry); return geometry }
  private ownMaterial<M extends Three.Material>(material: M): M { this.materials.push(material); return material }
}
