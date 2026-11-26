import type * as THREE from 'three'
import { cinema2StableId, type Cinema2ModuleTypeId, type Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import type { Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'
import { createCinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { Cinema2PatternAutoPerformance } from './mainframe/Cinema2PatternAutoPerformance'
import { resolveCinema2AfterhoursTriggerEventIdentity } from './Cinema2AfterhoursNativeModule'
import { Cinema2MainframePatternController, resolveCinema2MainframeTriggerEventIdentity, type Cinema2MainframeTriggerId } from './mainframe/Cinema2MainframePatternController'
import { Cinema2MainframeBeatClockResolver } from './mainframe/Cinema2MainframePatternEngine'
import {
  WIREFRAME_PORTAL_DEFAULT_PATTERN, WIREFRAME_PORTAL_PATTERN_IDS, WIREFRAME_PORTAL_TRANSITION_BEATS, WIREFRAME_PORTAL_TRIGGER_IDS, type WireframePortalPattern,
} from './wireframePortal/WireframePortalPatterns'
import { WireframePortalScene, type WireframePortalControls } from './wireframePortal/WireframePortalScene'

export const CINEMA2_WIREFRAME_PORTAL_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('wireframe-portal-native')

type Rgb = readonly number[]
export const WIREFRAME_PORTAL_PALETTE = {
  steelColor: [.23, .26, .3, 1], hotColor: [1, .36, .12, 1], edgeColor: [.36, .62, .78, 1], coldRimColor: [.75, .85, 1, 1], redRimColor: [1, .16, .1, 1],
} as const satisfies Record<string, Rgb>
export const WIREFRAME_PORTAL_BACKGROUND = [.01, .012, .018, 1] as const

/**
 * Drives the kinetic truss from the shared beat clock and the shared Pattern controller. The sweep phase advances in beats, so it runs faster on a faster
 * track, holds while paused and idles at the 120 BPM reference with no source. Pattern, Pattern Change, the Trigger and Auto Performance's build and drop
 * programs choose what the bays and beams do; kicks and drops arrive as the `flash` and `blast` channels from choreography.
 */
export class Cinema2WireframePortalController {
  readonly afterVisibility = true
  private scene: WireframePortalScene | null = null
  private context: Cinema2ModuleUpdateContext | null = null
  private readonly clock = new Cinema2BeatClock()
  private readonly triggerClock = new Cinema2MainframeBeatClockResolver()
  private readonly selection = new Cinema2MainframePatternController<WireframePortalPattern>(WIREFRAME_PORTAL_PATTERN_IDS, WIREFRAME_PORTAL_DEFAULT_PATTERN)
  private readonly policy = new Cinema2PatternControlResolver<Cinema2MainframeTriggerId>()
  // Auto Performance owns one thing: the program on stage during a build (Fold) or a drop (Detonate) and, between them, a program chosen by how the passage
  // feels. The saved Pattern, Pattern Change and Trigger are never written to.
  private readonly performance = new Cinema2PatternAutoPerformance<WireframePortalPattern>({
    buildPattern: 'fold', dropPattern: 'detonate', buildMaxBeats: 32, dropBeats: 8,
    mood: { options: { calm: ['lattice', 'ripple'], driving: ['rotor', 'extrude'], tense: ['fold', 'rotor'], peak: ['extrude', 'detonate'] } },
  })
  private autoWasEnabled = false
  private overrideReason: string | null = null
  private pattern: WireframePortalPattern = WIREFRAME_PORTAL_DEFAULT_PATTERN
  private previousPattern: WireframePortalPattern = WIREFRAME_PORTAL_DEFAULT_PATTERN
  private transitionStart: number | null = null
  private beats = 0
  private phase = 0
  private lastBeats: number | null = null
  private lastTimestamp: number | null = null
  private previousTime: number | null = null
  private previousTriggerBeat: number | null = null
  private identity: string | null = null
  private authoredPattern: WireframePortalPattern | null = null
  private editRevision: number | null = null

  constructor(private readonly library: Cinema2ThreeLibrary) {}

  attach(root: THREE.Object3D): void { this.scene = new WireframePortalScene(this.library, root) }

  update(context: Cinema2ModuleUpdateContext): void {
    this.context = context
    const { frame, parameters } = context
    const time = frame.audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
    const identity = JSON.stringify([frame.contextGeneration, frame.transport?.trackId, frame.audio?.upstream.sourceId, frame.audio?.upstream.analysisRevision, frame.audio?.upstream.timelineRevision, frame.audio?.discontinuity.generation])
    const reset = identity !== this.identity || (this.previousTime != null && time < this.previousTime - .01)
    if (reset) { this.clock.reset(); this.selection.reset(); this.policy.reset(); this.performance.reset(); this.triggerClock.reset(); this.lastBeats = null }
    const active = !frame.transport?.paused && (!frame.transport?.sourcePresent || frame.transport.animationActive !== false)
    const idleDelta = this.lastTimestamp == null ? 0 : Math.max(0, (frame.timestampMs - this.lastTimestamp) / 1000)
    const delta = Math.min(.1, Math.max(0, frame.transport?.sourcePresent ? frame.deltaTimeSec : idleDelta))
    this.lastTimestamp = frame.timestampMs
    const timingFrame = {
      ...frame, elapsedTimeSec: frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec, deltaTimeSec: active ? delta : 0,
      ...(frame.transport ? { transport: { ...frame.transport, animationActive: active } } : {}),
    }
    this.beats = this.clock.update(timingFrame, parameters.get('bpmSync') !== false).beats
    const beatDelta = this.lastBeats == null ? 0 : Math.max(0, this.beats - this.lastBeats)
    if (active) this.phase += beatDelta * this.number('motionRate', 1, 0, 2) * Math.PI / 4

    const authored = readPattern(parameters.get('pattern'))
    const revision = parameters.getEditRevision?.('pattern') ?? 0
    const edited = (this.editRevision != null && revision !== this.editRevision) || (this.authoredPattern != null && authored !== this.authoredPattern)
    const savedTrigger = (WIREFRAME_PORTAL_TRIGGER_IDS as readonly string[]).includes(parameters.get('trigger') as string) ? parameters.get('trigger') as Cinema2MainframeTriggerId : 'bar4'
    const auto = parameters.get('autoPerformance') === true && this.number('reactivity', .65, 0, 1) > 0 && frame.transport?.sourcePresent === true && (frame.transport.playing || frame.transport.paused) && frame.mood != null
    const authorityRestored = this.autoWasEnabled && !auto
    this.autoWasEnabled = auto
    // With Auto Performance on, Pattern Change and the Trigger are the music's choice; the saved values apply again, unchanged, the moment it is off.
    const controls = this.policy.update({ saved: { patternChange: parameters.get('patternChange') === true, trigger: savedTrigger }, mood: frame.mood, autoPerformance: auto })
    const triggerTiming = this.triggerClock.resolve(timingFrame, true)
    const drop = resolveCinema2AfterhoursTriggerEventIdentity(frame, 'drop', this.previousTime)
    const selected = this.selection.update({
      authoredPattern: authored, patternChange: controls.patternChange, trigger: controls.trigger,
      triggerEventId: controls.trigger === 'drop' ? drop : resolveCinema2MainframeTriggerEventIdentity(frame, controls.trigger, this.previousTime, drop, { previousBeat: this.previousTriggerBeat, current: triggerTiming }),
      absoluteBeat: this.beats, reset, reselect: edited,
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
    this.lastBeats = this.beats
    this.previousTriggerBeat = triggerTiming.beats
    this.previousTime = time
    this.identity = identity
    this.authoredPattern = authored
    this.editRevision = revision
  }

  beforeDraw(quality: Cinema2RenderQualityLevel = 'high', camera?: Readonly<{ position: readonly [number, number, number] }>): void {
    if (!this.context || !this.scene) return
    const blend = this.transitionStart == null ? 1 : Math.min(1, Math.max(0, (this.beats - this.transitionStart) / WIREFRAME_PORTAL_TRANSITION_BEATS))
    if (blend >= 1) this.transitionStart = null
    this.scene.draw(this.controls(), {
      phase: this.phase, beats: this.beats, pattern: this.pattern, previousPattern: this.previousPattern, blend,
      flash: this.number('flash', 0, 0, 1), blast: this.number('blast', 0, 0, 1), quality, ...(camera ? { eye: camera.position } : {}),
    })
  }

  inspect(): Readonly<Record<string, unknown>> {
    return { ...this.scene?.inspect(), pattern: this.pattern, activePattern: this.pattern, beats: this.beats, phase: this.phase, performanceOverride: this.overrideReason, ...this.policy.inspect() }
  }

  dispose(): void {
    this.scene?.dispose()
    this.scene = null
    this.context = null
    this.clock.reset(); this.triggerClock.reset(); this.selection.reset(); this.policy.reset(); this.performance.reset()
  }

  private controls(): WireframePortalControls {
    const n = (name: string, fallback: number, min: number, max: number) => this.number(name, fallback, min, max)
    const c = (name: string, fallback: Rgb): Rgb => {
      const value = this.context!.parameters.get(name)
      return Array.isArray(value) && value.length >= 3 ? value.map(Number) : fallback
    }
    return {
      intensity: n('intensity', 1, 0, 2), kinetics: n('kinetics', 1, 0, 1.5),
      spatialSpread: n('spatialSpread', 1, .95, 1.2), structuralDensity: n('structuralDensity', 1, 0, 1), depthDistribution: n('depthDistribution', 1, .95, 1.2), jointHeat: n('jointHeat', 1, 0, 2), edgeLighting: n('edgeLighting', 1, 0, 1.5), pinLighting: n('pinLighting', 1, 0, 1.5),
      beamLighting: n('beamLighting', 1, 0, 2), strobe: n('strobe', .5, 0, 1), rimLighting: n('rimLighting', 1, 0, 2), steelRoughness: n('steelRoughness', .36, .1, .7),
      emberDrift: n('emberDrift', .5, 0, 1), haze: n('haze', .35, 0, 1), dust: n('dust', .5, 0, 1),
      steelColor: c('steelColor', WIREFRAME_PORTAL_PALETTE.steelColor), hotColor: c('hotColor', WIREFRAME_PORTAL_PALETTE.hotColor), edgeColor: c('edgeColor', WIREFRAME_PORTAL_PALETTE.edgeColor),
      coldRimColor: c('coldRimColor', WIREFRAME_PORTAL_PALETTE.coldRimColor), redRimColor: c('redRimColor', WIREFRAME_PORTAL_PALETTE.redRimColor), background: c('background', WIREFRAME_PORTAL_BACKGROUND),
    }
  }

  private number(name: string, fallback: number, min: number, max: number): number {
    const value = this.context?.parameters.get(name)
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
  }
}

function readPattern(value: unknown): WireframePortalPattern { return (WIREFRAME_PORTAL_PATTERN_IDS as readonly unknown[]).includes(value) ? value as WireframePortalPattern : WIREFRAME_PORTAL_DEFAULT_PATTERN }

export const cinema2WireframePortalModuleDefinition = createCinema2ThreeSceneModuleDefinition({
  typeId: CINEMA2_WIREFRAME_PORTAL_MODULE_TYPE_ID,
  resourceKey: 'wireframe-portal:bridge',
  createModelController: library => new Cinema2WireframePortalController(library),
})
