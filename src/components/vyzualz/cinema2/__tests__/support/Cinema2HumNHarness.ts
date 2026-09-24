import { vi, expect } from 'vitest'
import { createCinemaMockWebGL } from '../../../cinema/__tests__/CinemaWebGLTestUtils'
import {
  CINEMA2_HUMN_PRESET_ID,
  Cinema2AudioIntelligenceBridge,
  Cinema2Runtime,
  cinema2NativePresetRegistry,
} from '../../index'
import type { Cinema2ParameterId } from '../../contracts/Cinema2NativePresetManifest'
import { humMusicFrame, type HumFrameInput } from './Cinema2HumNFrameFactory'

// Everything below drives the PRODUCTION runtime: Audio Intelligence bridge ->
// Visual Director -> Choreography -> canonical targets -> native HUM:N module ->
// shader uniforms. Nothing here reads parameter state as a shortcut.

class FakeCanvas extends EventTarget {
  width = 640
  height = 360
  readonly getContext: ReturnType<typeof vi.fn>
  constructor(gl: WebGL2RenderingContext) {
    super()
    this.getContext = vi.fn((kind: string) => (kind === 'webgl2' ? gl : null))
  }
}

type Numeric = { mock: { calls: unknown[][] } }

export interface Harness {
  /** `trackId: null` models an unloaded source (no track identity). */
  step(input: Omit<HumFrameInput, 'frameId' | 'timeSec' | 'trackId'> & { trackId?: string | null; timeSec?: number; frames?: number; dt?: number }): void
  uniform(name: string): number
  vec4(name: string): readonly number[]
  drawCount(): number
  set(id: Cinema2ParameterId, value: number | boolean | string): void
  pause(paused: boolean): void
  get(id: Cinema2ParameterId): unknown
  snapshot(): string
  /** Mutable host transport (source presence, pause, ...). */
  transport: { sourcePresent: boolean; playing: boolean; analysisActive: boolean; paused: boolean; trackId: string | null; timeSec: number }
  /** The runtime's canvas, so tests can dispatch WebGL context loss/restore events. */
  canvas: EventTarget
  runtime: Cinema2Runtime
  dispose(): void
}

export function createHarness(options: { seed?: string; state?: Record<string, number | boolean> } = {}): Harness {
  const gl = createCinemaMockWebGL()
  gl.getUniformLocation = vi.fn((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
  const callbacks = new Map<number, FrameRequestCallback>()
  let nextRafId = 1
  let rafClock = 0
  let sequence = 0
  let upstream = humMusicFrame({ frameId: 1, timeSec: 10 })
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => upstream,
    getPublicationMeta: () => ({ sequence, publishedAtMs: upstream.timeSec * 1000, publisherId: 'hum-n-reactivity', kind: 'frame' as const }),
  })
  const transport = { sourcePresent: true, playing: true, analysisActive: true, paused: false, trackId: 'hum-n-reactivity-track' as string | null, timeSec: 10 }
  const canvas = new FakeCanvas(gl)
  const created = Cinema2Runtime.create(canvas as unknown as HTMLCanvasElement, {
    transportSource: { getState: () => transport },
    presetId: CINEMA2_HUMN_PRESET_ID,
    presetRegistry: cinema2NativePresetRegistry,
    audioIntelligenceBridge: bridge,
    randomness: { mode: 'deterministic', seed: options.seed ?? 'hum-n-reactivity-seed' },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      const id = nextRafId++
      callbacks.set(id, callback)
      return id
    },
    cancelAnimationFrame: (id: number) => { callbacks.delete(id) },
  })
  if (!created.runtime) throw new Error(`HUM:N runtime failed: ${created.error}`)
  const runtime = created.runtime
  runtime.resize({ width: 640, height: 360, dpr: 1 })
  runtime.start()
  let frameId = 1
  let timeSec = 10
  // Structural markers are properties of the analysed track, so they persist across steps.
  const sticky: Partial<HumFrameInput> = {}

  const calls = (name: string, fn: unknown) => (fn as Numeric).mock.calls.filter(call => (call[0] as { name?: string } | null)?.name === name)

  const harness: Harness = {
    runtime,
    transport,
    canvas,
    step(input) {
      for (const key of ['dropMoments', 'phrases', 'sectionType', 'sectionStartSec', 'sectionEndSec', 'dropConfidence'] as const) {
        if (key in input) (sticky as Record<string, unknown>)[key] = (input as Record<string, unknown>)[key]
      }
      const frames = input.frames ?? 1
      const dt = input.dt ?? 1 / 30
      for (let index = 0; index < frames; index++) {
        frameId += 1
        timeSec = input.timeSec != null && index === 0 ? input.timeSec : transport.paused ? timeSec : timeSec + dt
        transport.timeSec = timeSec
        transport.trackId = input.trackId === undefined ? 'hum-n-reactivity-track' : input.trackId
        // Rhythm events fire on the first frame of the step only.
        const first = index === 0
        upstream = humMusicFrame({
          ...sticky,
          ...input,
          trackId: input.trackId ?? undefined,
          frameId,
          timeSec,
          beat: first && input.beat,
          downbeat: first && input.downbeat,
          kick: first ? input.kick : 0,
          snare: first ? input.snare : 0,
        })
        sequence += 1
        rafClock += dt * 1000
        const entry = [...callbacks.entries()][0]
        if (!entry) throw new Error('No HUM:N frame is scheduled.')
        callbacks.delete(entry[0])
        entry[1](rafClock)
      }
    },
    uniform(name) {
      const found = calls(name, gl.uniform1f)
      if (found.length === 0) throw new Error(`Uniform ${name} was never set`)
      return Number(found[found.length - 1]![1])
    },
    vec4(name) {
      const found = calls(name, gl.uniform4f)
      return found[found.length - 1]!.slice(1) as number[]
    },
    drawCount: () => (gl as unknown as { __calls: { drawCount: number } }).__calls.drawCount,
    pause(paused) {
      transport.paused = paused
    },
    set(id, value) {
      expect(runtime.getParameterState().setPersistentValue(id, value)).toMatchObject({ ok: true })
    },
    get: id => runtime.getParameterState().getValue(id),
    snapshot: () => JSON.stringify(runtime.getParameterState().getSnapshot()),
    dispose: () => runtime.dispose(),
  }
  for (const [id, value] of Object.entries(options.state ?? {})) harness.set(id as Cinema2ParameterId, value)
  return harness
}

