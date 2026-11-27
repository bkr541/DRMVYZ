import { Cinema2PatternControlResolver } from '../conductor/Cinema2PatternControls'
import { cinema2StableId, type Cinema2Color, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_AFTERHOURS_TRIGGER_IDS, resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from './Cinema2AfterhoursNativeModule'
import { Cinema2MediaSlotRuntime } from '../media/Cinema2MediaSlotRuntime'
import { Cinema2EverywherePool, EVERYWHERE_POOL_SLOTS } from './everywhere/Cinema2EverywherePool'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import type { Cinema2ModuleCreateContext, Cinema2ModuleRenderExecutionContext, Cinema2ModuleTypeDefinition, Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { Cinema2CorridorRenderer, CORRIDOR_PATTERNS, type CorridorLook, type CorridorPattern } from './corridor/Cinema2CorridorRenderer'
import { Cinema2MainframePatternController, createCinema2MainframePatternCycle } from './mainframe/Cinema2MainframePatternController'

export const CINEMA2_CORRIDOR_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('corridor-native')
export const CINEMA2_GOONZ_CORRIDOR_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('goonz-corridor-native')
export const CORRIDOR_COLORS: Pick<CorridorLook, 'voidColor' | 'wall' | 'amber' | 'hot' | 'markings'> = {
  voidColor: [0.002, 0.0016, 0.00135, 1],
  wall: [0.106, 0.086, 0.067, 1],
  amber: [1, 0.22, 0.018, 1],
  hot: [1, 0.76, 0.41, 1],
  markings: [0.85, 0.28, 0.08, 1],
}

const DEFAULT_LOOK: Readonly<CorridorLook> = {
  ...CORRIDOR_COLORS, travel: 0.58, phase: 0.08, roll: 0.032, sway: 0, width: 2.35, density: 0.38, intensity: 0.86,
  haze: 0.23, pattern: 'night-transit', kick: 0, bass: 0, extensionBuild: 0, transient: 0, build: 0, drop: 0,
}

// Program cadence is intentionally phrase-length for every visual pattern:
// changing the light arrangement must not cause rapid artwork cuts.
export function corridorPoolTrigger(_pattern: CorridorPattern): Cinema2AfterhoursTriggerId {
  return 'phrase'
}

/** Runtime-only phase and pattern authority; persistent values remain in Parameter State. */
export class Cinema2CorridorPerformance {
  private readonly clock = new Cinema2BeatClock()
  private readonly policy = new Cinema2PatternControlResolver<Cinema2AfterhoursTriggerId>()
  private readonly patterns: Cinema2MainframePatternController<CorridorPattern>
  private identity = ''
  private previousTime: number | null = null
  private lastBeat: number | null = null
  private distance = 0
  private phase = 0
  private authored: CorridorPattern = 'night-transit'
  private look: Readonly<CorridorLook> = DEFAULT_LOOK
  private lastMediaTrigger: Cinema2AfterhoursTriggerId | null = null
  poolFrame = { identity: '', reset: false, paused: true, event: null as string | null, patternChanged: false }

  constructor(sample: (index: number) => number) {
    this.patterns = new Cinema2MainframePatternController(createCinema2MainframePatternCycle(
      sample, CORRIDOR_PATTERNS.map(pattern => pattern.value),
    ), 'night-transit')
  }

  update({ frame, parameters }: Cinema2ModuleUpdateContext) {
    const identity = JSON.stringify([
      frame.contextGeneration, frame.transport?.trackId, frame.audio?.upstream.sourceId, frame.audio?.upstream.publisherId,
      frame.audio?.upstream.analysisRevision, frame.audio?.upstream.timelineRevision, frame.audio?.discontinuity.generation,
    ])
    const time = frame.audio?.upstream.timeSec ?? frame.transport?.timeSec ?? frame.elapsedTimeSec
    const reset = identity !== this.identity || (this.previousTime != null
      && (time < this.previousTime - 0.03 || time - this.previousTime > Math.max(0.85, frame.deltaTimeSec * 6)))
    if (reset) {
      this.clock.reset()
      this.policy.reset()
      this.patterns.reset()
      this.lastBeat = null
      this.distance = 0
      this.phase = 0
    }
    const read = (key: string, fallback: number, min: number, max: number) => {
      const value = parameters.get(key)
      return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
    }
    const color = (key: keyof typeof CORRIDOR_COLORS): Cinema2Color => {
      const value = parameters.get(key)
      return Array.isArray(value) && value.length === 4 && value.every(channel => typeof channel === 'number' && Number.isFinite(channel))
        ? [value[0], value[1], value[2], value[3]]
        : CORRIDOR_COLORS[key]
    }
    const playing = frame.transport?.playing === true && frame.transport.animationActive && !frame.transport.paused
    const paused = frame.transport?.paused === true && !reset
    const auto = parameters.get('autoPerformance') === true && frame.transport?.sourcePresent === true
    const motion = read('motion', 0.75, 0, 1)
    const signal = (key: string, held: number) => {
      if (!auto || motion === 0) return 0
      if (paused) return held
      return playing ? read(key, 0, 0, 1) * motion : 0
    }
    const beat = this.clock.update(frame, parameters.get('bpmSync') !== false && frame.transport?.bpmSync !== false).beats
    const delta = this.lastBeat == null ? 0 : Math.max(0, Math.min(1, beat - this.lastBeat))
    const desired = CORRIDOR_PATTERNS.find(pattern => pattern.value === parameters.get('pattern'))?.value ?? 'night-transit'
    const savedTrigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.find(trigger => trigger === parameters.get('trigger')) ?? 'bar4'
    const controls = this.policy.update({
      saved: { patternChange: parameters.get('patternChange') === true, trigger: savedTrigger },
      mood: frame.mood,
      autoPerformance: auto && (playing || paused),
    })
    const holdingSilent = !reset && desired === this.authored && auto && playing
      && controls.automatic && !controls.patternChange && (frame.mood?.silence ?? 0) > 0.5
    const selection = holdingSilent ? null : this.patterns.update({
      authoredPattern: desired, patternChange: controls.patternChange, trigger: controls.trigger,
      triggerEventId: playing ? resolveCinema2AfterhoursTriggerEventIdentity(frame, controls.trigger, reset ? null : this.previousTime) : null,
      absoluteBeat: beat, reset,
    })
    if (selection?.changed) this.phase = 0
    const build = signal('build', this.look.build)
    const kick = reset ? 0 : signal('kick', this.look.kick)
    const bass = reset ? 0 : signal('bass', this.look.bass)
    // The shared director build signal is already smoothed; the slower mechanical
    // attack lets the housings extend progressively instead of stepping outward.
    const dt = Number.isFinite(frame.deltaTimeSec) ? Math.max(0, Math.min(.25, frame.deltaTimeSec)) : 0
    const previousExtension = this.look.extensionBuild
    const extensionBuild = reset || !auto || motion === 0 || (!playing && !paused) ? 0
      : paused ? previousExtension
      : previousExtension + (build - previousExtension) * (1 - Math.exp(-dt / (build > previousExtension ? .65 : .32)))
    const drop = signal('drop', this.look.drop)
    const roll = read('roll', 0.54, 0, 1)
    const density = read('density', 0.38, 0.05, 0.85)
    if (playing) {
      this.distance += delta * motion * read('transit', 1, 0.2, 1.8) * (1.24 + build * 0.42 + read('bass', 0, 0, 1) * (auto ? 0.20 : 0))
      this.phase += delta * motion * (0.45 + build * 0.14)
    }
    this.look = {
      travel: paused ? this.look.travel : 0.58 + this.distance + kick * 0.09 + drop * 0.82,
      phase: this.phase + DEFAULT_LOOK.phase,
      roll: roll * (0.06 * Math.cos(this.phase * 0.75) + 0.065 * Math.sin(this.phase * 0.43)) * motion,
      sway: Math.sin(this.phase * 0.46) * (0.079 * motion),
      width: read('width', 2.35, 1.8, 3.3),
      density: paused && auto ? this.look.density : Math.max(0.05, Math.min(0.85, density + signal('energy', 0) * 0.12 - signal('vocal', 0) * 0.10)),
      intensity: read('intensity', 0.86, 0, 1.45),
      haze: read('haze', 0.23, 0, 1),
      pattern: selection?.activePattern ?? this.look.pattern,
      kick, bass, extensionBuild, transient: signal('transient', this.look.transient), build, drop,
      voidColor: color('voidColor'), wall: color('wall'), amber: color('amber'), hot: color('hot'), markings: color('markings'),
    }
    const mediaTrigger = CINEMA2_AFTERHOURS_TRIGGER_IDS.find(trigger => trigger === parameters.get('poolTrigger'))
      ?? corridorPoolTrigger(this.look.pattern)
    this.poolFrame = { identity, reset, paused: !playing,
      // Only a cadence change re-arms the shared pool. A simultaneous pattern
      // change must not swallow a fresh phrase event.
      patternChanged: mediaTrigger !== this.lastMediaTrigger,
      event: playing && motion > 0 && !(auto && (frame.mood?.silence ?? 0) > .5)
        ? resolveCinema2AfterhoursTriggerEventIdentity(frame, mediaTrigger, reset ? null : this.previousTime) : null,
    }
    this.lastMediaTrigger = mediaTrigger
    this.identity = identity
    this.previousTime = time
    this.lastBeat = beat
    this.authored = desired
    return this.look
  }

  inspect() {
    return {
      ...this.policy.inspect(),
      activePattern: this.look.pattern, travel: this.look.travel, phase: this.look.phase,
      density: this.look.density, drop: this.look.drop,
      bass: this.look.bass, kick: this.look.kick, extensionBuild: this.look.extensionBuild,
    }
  }
}

function createCorridorModuleDefinition(squareCassettes: boolean): Readonly<Cinema2ModuleTypeDefinition> {
  return {
    typeId: squareCassettes ? CINEMA2_GOONZ_CORRIDOR_MODULE_TYPE_ID : CINEMA2_CORRIDOR_MODULE_TYPE_ID,
    version: 1,
    create(context: Cinema2ModuleCreateContext) {
      const performance = new Cinema2CorridorPerformance(index => context.randomness.sample('corridor-pattern-cycle', index))
      const renderer = context.resources.acquire(squareCassettes ? 'goonz-corridor:cassettes' : 'corridor:cassettes', 'CorridorRenderer', gl => new Cinema2CorridorRenderer(gl, squareCassettes), value => value.dispose())
      const source = context.mediaPoolSource
      // Reuse the existing three-channel named-pool runtime in an isolated lease.
      const pool = source ? context.resources.acquire(squareCassettes ? 'goonz-corridor:pool' : 'corridor:pool', 'CorridorMediaPool', gl =>
        new Cinema2EverywherePool(source, new Cinema2MediaSlotRuntime(gl, EVERYWHERE_POOL_SLOTS)), value => value.dispose()) : null
      let reportedBytes = renderer.bytes
      context.resources.reportGpuBytes(reportedBytes)
      let look = DEFAULT_LOOK
      return {
        lifecycle: {
          update: (frame: Cinema2ModuleUpdateContext) => {
            look = performance.update(frame)
            const { identity, event, reset, paused, patternChanged } = performance.poolFrame
            pool?.update(identity, event, reset, paused, patternChanged)
          },
          dispose: () => { /* GPU resources are released by the engine-owned lease. */ },

        },
        render: { providers: [{
          id: `${context.module.id}:passage`,
          moduleId: context.module.id,
          intent: 'world' as const,
          execute: (execution: Cinema2ModuleRenderExecutionContext) => {
            const poolFeeds = pool?.getResources() ?? []
            const usePool = source?.getSelection() != null
            // An active pool takes precedence, including while its feeds load.
            const feeds = usePool ? poolFeeds.slice(0, Math.min(3, pool?.count ?? 0)) : [context.media.get('panelMedia')]
            renderer.draw(execution, look, feeds, usePool ? pool?.step ?? 0 : 0)
            const bytes = renderer.bytes + poolFeeds.reduce((sum, feed) => sum + (feed ? feed.width * feed.height * 4 : 0), 0)
            if (bytes !== reportedBytes) { context.resources.reportGpuBytes(bytes); reportedBytes = bytes }
          },
        }] },
        inspect: () => ({ ...performance.inspect(), userMedia: context.media.get('panelMedia') != null,
          poolMediaCount: pool?.count ?? 0, poolStep: pool?.step ?? 0, poolReadyChannels: pool?.getResources().filter(Boolean).length ?? 0 }),
      }
    },
  }
}

export const cinema2CorridorNativeModuleDefinition = createCorridorModuleDefinition(false)
export const cinema2GoonzCorridorNativeModuleDefinition = createCorridorModuleDefinition(true)
