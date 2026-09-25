import {
  cinema2StableId,
  type Cinema2JsonObject,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import { multiplyMatrices, translationMatrix } from '../spatial/Cinema2LightMatrices'
import type { Cinema2DispatchedTargetAction } from '../parameters/Cinema2TargetRuntime'
import { Cinema2HumNAutoColor } from './humn/Cinema2HumNAutoColor'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import { buildCinema2HumNMesh, type Cinema2HumNMeshDensity } from './humn/Cinema2HumNMesh'
import {
  Cinema2HumNPerformanceRuntime,
  CINEMA2_HUMN_NEUTRAL_POSE,
  cinema2HumNAutoDropStrength,
  cinema2HumNDirectorContext,
  cinema2HumNDirectionFromUnit,
  selectCinema2HumNDropGesture,
  selectCinema2HumNStructuralVariant,
  type Cinema2HumNStructuralKind,
} from './humn/Cinema2HumNPerformance'
import { Cinema2HumNRenderer, type Cinema2HumNDrawState } from './humn/Cinema2HumNRenderer'
import { createCinema2HumNRigState, evaluateCinema2HumNRig } from './humn/Cinema2HumNRig'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleUpdateContext,
  Cinema2ModuleTypeDefinition,
} from './Cinema2ModuleContracts'

export const CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('hum-n-native-render')
export const CINEMA2_HUMN_NATIVE_MODULE_VERSION = 2 as const

export type Cinema2HumNFragmentEventKind = 'beat' | 'downbeat' | 'kick' | 'snare'

/** The point of the figure Figure Scale grows about (metres, bind pose): the middle of the head, so a close-up keeps the face in frame. */
export const CINEMA2_HUMN_FRAMING_ANCHOR = Object.freeze({ x: 0, y: 0.74, z: 0 })
export const CINEMA2_HUMN_FIGURE_SCALE_LIMITS = Object.freeze({ min: 0.4, max: 2.5 })

/** Fraction of the triangles that turn over (leave/enter the filled set) per beat. */
const FILL_TURNOVER_PER_BEAT = 0.045
/** Gradient bands travel this many palette steps per beat. */
const GRADIENT_SCROLL_PER_BEAT = 0.35
/** Largest distance (metres) a kicked triangle is thrown at Fragment Jitter 1. */
const JITTER_METRES = 0.07
const SPARSE_EDGE_SHARE = 0.62

const DEFAULT_WIREFRAME: readonly [number, number, number, number] = [245 / 255, 247 / 255, 250 / 255, 1]
const DEFAULT_PRIMARY: readonly [number, number, number, number] = [72 / 255, 240 / 255, 221 / 255, 1]
const DEFAULT_SECONDARY: readonly [number, number, number, number] = [1, 61 / 255, 200 / 255, 1]
const DEFAULT_ACCENT: readonly [number, number, number, number] = [200 / 255, 1, 74 / 255, 1]

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseFragmentEventKind(payload: unknown): Cinema2HumNFragmentEventKind | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const kind = (payload as { kind?: unknown }).kind
  return kind === 'beat' || kind === 'downbeat' || kind === 'kick' || kind === 'snare' ? kind : null
}

function parseStructuralEventKind(payload: unknown): Cinema2HumNStructuralKind | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const kind = (payload as { kind?: unknown }).kind
  return kind === 'drop' || kind === 'phrase' || kind === 'section' ? kind : null
}

function frameTimeSec(frame: { transport?: { timeSec: number }; audio: { upstream: { timeSec: number } } | null; elapsedTimeSec: number }): number {
  return frame.transport?.timeSec ?? frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec
}

function frameBeatSec(frame: { transport?: { bpm?: number | null }; audio: { rhythm: { bpm: { available: boolean; value: number | null } } } | null }): number | null {
  const analysed = frame.audio?.rhythm.bpm
  if (analysed?.available && typeof analysed.value === 'number' && analysed.value > 0) return 60 / analysed.value
  const host = frame.transport?.bpm
  return typeof host === 'number' && host > 0 ? 60 / host : null
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readMotionRate(value: unknown): number {
  if (value === '1/2x') return 0.5
  if (value === '2x') return 2
  if (value === '4x') return 4
  return 1
}

function readColor(value: unknown, fallback: readonly [number, number, number, number]): readonly [number, number, number, number] {
  if (Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component))) {
    return value as unknown as readonly [number, number, number, number]
  }
  return fallback
}

function readMeshDetail(value: unknown): { density: Cinema2HumNMeshDensity; edgeShare: number } {
  if (value === 'Sparse') return { density: 1, edgeShare: SPARSE_EDGE_SHARE }
  if (value === 'Dense') return { density: 2, edgeShare: 1 }
  return { density: 1, edgeShare: 1 }
}

function readFillStyle(value: unknown): number {
  if (value === 'Solid') return 0
  if (value === 'Gradient') return 1
  if (value === 'Stripe') return 2
  return 3
}

function validateConfig(config: Cinema2JsonObject | undefined): readonly Cinema2ModuleDiagnostic[] {
  if (config == null || config.label == null) return Object.freeze([])
  if (typeof config.label === 'string') return Object.freeze([])
  return Object.freeze([Object.freeze({
    code: 'CINEMA2_HUMN_MODULE_LABEL_INVALID',
    path: '$.config.label',
    message: 'HUM:N native renderer label must be a string when provided.',
  })])
}

type FrameDraw = Omit<Cinema2HumNDrawState, 'view' | 'projection' | 'model' | 'bones' | 'lineScale'>

export const cinema2HumNNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_HUMN_NATIVE_MODULE_VERSION,
  validate: (module: Readonly<Cinema2ModuleManifest>) => validateConfig(module.config),
  create: (context: Cinema2ModuleCreateContext) => {
    const beatClock = new Cinema2BeatClock()
    const autoColor = new Cinema2HumNAutoColor()
    const performance = new Cinema2HumNPerformanceRuntime()
    const rig = createCinema2HumNRigState()
    const eventSeeds: Record<Cinema2HumNFragmentEventKind, number> = { beat: 0, downbeat: 0, kick: 0, snare: 0 }
    const pendingStructural: { eventId: string; kind: Cinema2HumNStructuralKind }[] = []
    let downbeatCount = 0
    let audioGeneration: number | null = null
    let contextGeneration: number | null = null
    let density: Cinema2HumNMeshDensity = 1
    let figureScale = 1
    let draw: FrameDraw | null = null

    const resetPerformance = () => {
      performance.reset()
      pendingStructural.length = 0
    }
    const resetEventState = () => {
      resetPerformance()
      eventSeeds.beat = 0
      eventSeeds.downbeat = 0
      eventSeeds.kick = 0
      eventSeeds.snare = 0
      downbeatCount = 0
    }

    const provider = Object.freeze({
      id: `${context.module.id}:hum-n-native`,
      moduleId: context.module.id,
      intent: 'world' as const,
      execute: ({ camera, depthAvailable, height }: Cinema2ModuleRenderExecutionContext) => {
        if (!depthAvailable) throw new Error(`Cinema 2.0 HUM:N module "${context.module.id}" requires a render target with a depth attachment.`)
        if (!camera) throw new Error(`Cinema 2.0 HUM:N module "${context.module.id}" requires final Camera Runtime state.`)
        if (!draw) return
        const renderer = context.resources.acquire(
          `hum-n:figure:${density}`,
          'HumNFigureRenderer',
          (gl: WebGL2RenderingContext) => new Cinema2HumNRenderer(gl, buildCinema2HumNMesh(density)),
          (value: Cinema2HumNRenderer) => value.dispose(),
        )
        const anchor = CINEMA2_HUMN_FRAMING_ANCHOR
        const scale = figureScale
        // Grow about the framing anchor: T(anchor) * S * T(-anchor).
        const model = multiplyMatrices(
          translationMatrix(anchor.x, anchor.y, anchor.z),
          multiplyMatrices([scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1], translationMatrix(-anchor.x, -anchor.y, -anchor.z)),
        )
        renderer.draw({
          ...draw,
          lineScale: clampNumber(height / 1080, 0.6, 2),
          view: new Float32Array(camera.viewMatrix),
          projection: new Float32Array(camera.projectionMatrix),
          model: new Float32Array(model),
          bones: rig.skinMatrices,
        })
      },
    })

    return {
      lifecycle: {
        update: ({ frame, parameters }: Cinema2ModuleUpdateContext) => {
          // Event-local state must not survive a seek, source change or new context.
          const nextAudioGeneration = frame.audio?.discontinuity.generation ?? null
          if (audioGeneration !== nextAudioGeneration || contextGeneration !== frame.contextGeneration) {
            if (audioGeneration !== null || contextGeneration !== null) {
              resetEventState()
              autoColor.reset()
            }
            audioGeneration = nextAudioGeneration
            contextGeneration = frame.contextGeneration
          }
          const number = (name: string, fallback: number) => readNumber(parameters.get(name), fallback)
          const unit = (name: string, fallback: number) => clampNumber(number(name, fallback), 0, 1)

          const intensity = unit('masterIntensity', 0.75)
          const autoOn = readBoolean(parameters.get('autoPerformance'), true)
          const beat = beatClock.update(frame, readBoolean(parameters.get('bpmSync'), true))
          const motionRate = readMotionRate(parameters.get('motionRate'))

          // Auto Performance owns every pose the figure strikes. Without analysis there is no musical time, so nothing stays posed.
          if (!autoOn || frame.audio == null) {
            if (performance.activeCount > 0 || pendingStructural.length > 0) resetPerformance()
          } else if (pendingStructural.length > 0) {
            const nowSec = frameTimeSec(frame)
            const beatSec = frameBeatSec(frame)
            const director = cinema2HumNDirectorContext(frame.director as never)
            for (const pending of pendingStructural.splice(0)) {
              if (beatSec == null) continue // no musical time: never fabricate a tempo
              const strength = clampNumber(number(`${pending.kind}Strength`, 0), 0, 1)
              if (strength <= 0.001) continue
              const stream = context.randomness.eventStream(pending.eventId, `hum-n-structural-${pending.kind}`)
              const family = stream.next()
              const direction = cinema2HumNDirectionFromUnit(stream.next())
              const alt = stream.next()
              if (pending.kind === 'drop') {
                const gatedStrength = cinema2HumNAutoDropStrength(strength, director?.impact ?? null)
                if (gatedStrength == null) continue
                const gesture = selectCinema2HumNDropGesture(family, { auto: director, previous: performance.previousDropGesture })
                performance.trigger({ eventId: pending.eventId, kind: 'drop', gesture, strength: gatedStrength, startSec: nowSec, beatSec }, nowSec)
              } else {
                const variant = selectCinema2HumNStructuralVariant(pending.kind, family, director)
                const resolved = variant === 'lookLeft' && direction > 0 ? 'lookRight' : variant
                performance.trigger({ eventId: pending.eventId, kind: pending.kind, variant: resolved, sign: direction, alt, strength, startSec: nowSec, beatSec }, nowSec)
              }
            }
          }

          // Motion Amount is the user's base; music adds on top of it and only that added part is restrained by vocal presence.
          const userMotion = unit('motionAmount', 0.6)
          const intelligenceMotion = (unit('tensionMotionLift', 0) + unit('buildMotionLift', 0)) * (1 - unit('vocalMotionRestraint', 0))
          const motionAmount = clampNumber(userMotion + intelligenceMotion, 0, 1)
          const pose = autoOn && frame.audio != null
            ? performance.evaluate(frameTimeSec(frame), { gestureIntensity: intensity, motionAmount: userMotion })
            : CINEMA2_HUMN_NEUTRAL_POSE

          const beatFlicker = unit('beatFlicker', 0)
          const downbeatReveal = unit('downbeatReveal', 0)
          const kickJitter = unit('kickJitter', 0)
          const snareEyeCheek = unit('snareEyeCheek', 0)
          // On the beat grid the body dips on every beat; otherwise it dips on detected beats.
          const gridEnvelope = beat.locked ? Math.exp(-5 * (beat.beats % 1)) : 0
          const beatEnvelope = Math.max(gridEnvelope, beatFlicker)
          evaluateCinema2HumNRig({ beat: beat.beats * motionRate, motion: motionAmount, beatEnvelope, pose }, rig)

          const palette = autoColor.update(frame)
          const auto = readBoolean(parameters.get('autoColor'), true)
          const primary = readColor(parameters.get('skinPrimary'), DEFAULT_PRIMARY)
          const secondary = readColor(parameters.get('skinSecondary'), DEFAULT_SECONDARY)
          const accent = readColor(parameters.get('skinAccent'), DEFAULT_ACCENT)
          const wireframe = readColor(parameters.get('wireframeColor'), DEFAULT_WIREFRAME)
          const ink = readColor(parameters.get('patternInk'), [1, 1, 1, 1])
          const background = readColor(parameters.get('backgroundColor'), [0, 0, 0, 1])

          // Energy may only lower Line Presence, and never below 0.55x the user's value.
          const lowering = clampNumber(number('linePresenceLowering', 0) + number('autoLineSparse', 0), 0, 0.45)
          const flickerAmount = unit('flickerAmount', 0.5)
          const jitterAmount = unit('fragmentJitter', 0.4)
          const detail = readMeshDetail(parameters.get('meshDetail'))
          density = detail.density
          figureScale = clampNumber(number('figureScale', 1), CINEMA2_HUMN_FIGURE_SCALE_LIMITS.min, CINEMA2_HUMN_FIGURE_SCALE_LIMITS.max)
          const scrollBeats = beat.beats * motionRate
          const jitterEnvelope = jitterAmount * kickJitter

          draw = {
            background,
            wireframe: auto ? [palette.wireframe[0], palette.wireframe[1], palette.wireframe[2], 1] : wireframe,
            ink: auto ? [palette.ink[0], palette.ink[1], palette.ink[2], 1] : ink,
            colors: auto ? palette.colors : [[primary[0], primary[1], primary[2]], [secondary[0], secondary[1], secondary[2]], [accent[0], accent[1], accent[2]]],
            fill: unit('facetFill', 0.35),
            fillShift: scrollBeats * FILL_TURNOVER_PER_BEAT + downbeatCount * 0.2 * flickerAmount,
            fillStyle: readFillStyle(parameters.get('fillStyle')),
            gradientScroll: scrollBeats * GRADIENT_SCROLL_PER_BEAT,
            linePresence: unit('linePresence', 1) * (1 - lowering),
            lineWeight: clampNumber(number('lineWeight', 1), 0.5, 2),
            fragmentation: unit('fragmentation', 0.12),
            edgeShare: detail.edgeShare,
            edgeGlow: clampNumber(unit('ghostEdgeEmphasis', 0) + 0.3 * beatEnvelope * intensity, 0, 1),
            flicker: flickerAmount * beatFlicker,
            flickerDown: flickerAmount * downbeatReveal,
            snare: snareEyeCheek * flickerAmount,
            beatSeed: eventSeeds.beat,
            downSeed: eventSeeds.downbeat,
            kickSeed: eventSeeds.kick,
            jitter: jitterEnvelope * JITTER_METRES,
            kickJitter: jitterEnvelope,
            pulse: beatEnvelope * intensity,
          }
        },
        dispose: () => {
          beatClock.reset()
          autoColor.reset()
          resetEventState()
          draw = null
        },
      },
      handleAction: (action: string, event: Readonly<Cinema2DispatchedTargetAction>) => {
        if (action === 'structuralEvent') {
          const kind = parseStructuralEventKind(event.payload)
          if (kind && pendingStructural.length < 8) pendingStructural.push({ eventId: event.eventId, kind })
          return
        }
        if (action !== 'fragmentEvent') return
        const kind = parseFragmentEventKind(event.payload)
        if (!kind) return
        // Same stable event identity -> same seed -> same fragment subset.
        eventSeeds[kind] = context.randomness.eventStream(event.eventId, `hum-n-fragment-${kind}`).next()
        if (kind === 'downbeat') downbeatCount += 1
      },
      render: { providers: Object.freeze([provider]) },
    }
  },
})
