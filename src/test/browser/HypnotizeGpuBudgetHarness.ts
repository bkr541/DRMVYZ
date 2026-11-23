import { Cinema2HypnotizeRenderer } from '../../components/vyzualz/cinema2/modules/hypnotize/Cinema2HypnotizeRenderer'
import { CINEMA2_HYPNOTIZE_PATTERNS, CINEMA2_HYPNOTIZE_PATTERN_PROFILES } from '../../components/vyzualz/cinema2/modules/hypnotize/Cinema2HypnotizePatternEngine'
import { buildCinema2HypnotizeTunnelLayout, createCinema2HypnotizeTunnelFrame, updateCinema2HypnotizeTunnelFrame } from '../../components/vyzualz/cinema2/modules/hypnotize/Cinema2HypnotizeTunnel'

// Times the real Hypnotize ring-tunnel renderer on a real WebGL2 canvas, for every pattern and across how hard the music drives it, and the CPU cost of the per-frame
// animation. See scripts/run-hypnotize-gpu-budget.mjs. The old Three.js version cost 18 ms of CPU a frame; this has to stay under a small fraction of that.
const scenarios: Record<string, { energy: number; kick: number; downbeat: number; drop: number; scroll: number }> = {
  idle: { energy: 0, kick: 0, downbeat: 0, drop: 0, scroll: 0.3 },
  music: { energy: 0.6, kick: 0.7, downbeat: 0.3, drop: 0, scroll: 12.7 },
  drop: { energy: 1, kick: 1, downbeat: 1, drop: 1, scroll: 31.4 },
}
const canvas = document.getElementById('hypnotize') as HTMLCanvasElement
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, depth: true })!
const layout = buildCinema2HypnotizeTunnelLayout()
const frame = createCinema2HypnotizeTunnelFrame(layout)
let renderer: Cinema2HypnotizeRenderer | null = null

function viewProjection(aspect: number): number[] {
  const fov = (66 * Math.PI) / 180, near = 0.05, far = 150, f = 1 / Math.tan(fov / 2)
  // Column-major perspective, camera at z = 0.4 looking down -z.
  const p = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]
  p[12] += 0; p[14] += 0
  // translate by (0, 0, -0.4)
  p[12] = p[12] + p[8] * -0.4; p[13] = p[13] + p[9] * -0.4; p[14] = p[14] + p[10] * -0.4; p[15] = p[15] + p[11] * -0.4
  return p
}

function inputs(pattern: (typeof CINEMA2_HYPNOTIZE_PATTERNS)[number], scenario: (typeof scenarios)[string]) {
  return {
    patternFrame: { pattern, previousPattern: pattern, transition: 1, beats: 5.6 + scenario.scroll, profile: CINEMA2_HYPNOTIZE_PATTERN_PROFILES[pattern] },
    signals: { overallEnergy: scenario.energy, bassPressure: scenario.energy, highsAmount: scenario.energy * 0.6, fluxAmount: scenario.energy * 0.5, kickAccent: scenario.kick, snareAccent: scenario.kick * 0.5, downbeatAccent: scenario.downbeat, phraseAccent: scenario.drop * 0.5, dropAccent: scenario.drop },
    ledPowerGatingEnabled: true, scroll: scenario.scroll, rotationEven: scenario.scroll * 0.3, rotationOdd: -scenario.scroll * 0.2, twist: 0.21,
    intensity: 1, ledGain: 1, pulseDepth: 0.55, vocalRestraint: 1, beatAccent: scenario.kick, kickAccent: scenario.kick, downbeatAccent: scenario.downbeat, dropAccent: scenario.drop,
    overallEnergy: scenario.energy, ringsVisible: 28, lineGain: 1.7,
  }
}

;(window as unknown as Record<string, unknown>).__hypnotizeBudget = {
  patterns: [...CINEMA2_HYPNOTIZE_PATTERNS],
  scenarios: Object.keys(scenarios),
  gpu(): string {
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
  },
  /** Median wall-clock milliseconds per frame (each frame is finished before the clock stops), the median CPU milliseconds of the animation alone, and the share of pixels that are lit. */
  run(pattern: (typeof CINEMA2_HYPNOTIZE_PATTERNS)[number], scenario: string, width: number, height: number, frames: number) {
    canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height)
    renderer ??= new Cinema2HypnotizeRenderer(gl, layout)
    const input = inputs(pattern, scenarios[scenario]!)
    const vp = viewProjection(width / height)
    const one = new Uint8Array(4), times: number[] = [], cpu: number[] = []
    for (let i = 0; i < frames + 1; i++) {
      const c0 = performance.now()
      updateCinema2HypnotizeTunnelFrame(layout, frame, input)
      cpu.push(performance.now() - c0)
      const t0 = performance.now()
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      renderer.draw({ viewProjection: vp, cameraPosition: [0, 0, 0.4], lightA: [0.1, 0.78, 1], lightB: [0.55, 0.22, 1], core: [0.9, 0.97, 1], body: [0.05, 0.075, 0.11], radiusScale: 1, fog: 0.034, spill: 1, frame })
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one); gl.finish()
      times.push(performance.now() - t0)
    }
    times.shift(); cpu.shift() // the first frame includes compiling the shader
    times.sort((a, b) => a - b); cpu.sort((a, b) => a - b)
    const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let lit = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > 12) lit++
    return { ms: times[Math.floor(times.length / 2)]!, cpuMs: cpu[Math.floor(cpu.length / 2)]!, litShare: lit / (width * height) }
  },
}
