import { Cinema2StartersRenderer } from '../../components/vyzualz/cinema2/modules/starters/Cinema2StartersRenderer'

// Times the real Starters renderer on a real WebGL2 canvas, across control settings that move the work around (idle, music-driven, the lid fully open with the balls at
// their widest and largest). See scripts/run-starters-gpu-budget.mjs.
const base = {
  target: null, time: 0, intensity: 1, caseOpen: 0, ballSpread: 1, ballScale: 1, ballWiggle: 0.8, ballRotation: 0.65, cameraMotion: 0.55, cameraOrbit: 0.7, cameraPan: 0.55, cameraSpeed: 0.4,
  centerLight: 0.85, grassDensity: 0.72, ambientMotion: 0.45, glow: 0.38, vignette: 0.35, energy: 0, bass: 0, kick: 0, snare: 0, build: 0, drop: 0, highs: 0,
  background: [0.005, 0.06, 0.025], grass: [0.02, 0.64, 0.18], leather: [0.68, 0.29, 0.055], ballRed: [0.9, 0.055, 0.12], ballWhite: [0.92, 0.94, 0.9], metal: [0.58, 0.62, 0.6],
} as const
const scenarios: Record<string, Record<string, unknown>> = {
  idle: { time: 0 },
  music: { time: 12.3, caseOpen: 0.55, energy: 0.6, bass: 0.5, kick: 0.7, snare: 0.3, highs: 0.4, build: 0.3 },
  drop: { time: 31.7, caseOpen: 1, drop: 1, kick: 1, snare: 0.8, energy: 1, bass: 1, build: 1, highs: 1, ballWiggle: 1.5, ballRotation: 1.5 },
  widest: { time: 5.5, caseOpen: 1, ballSpread: 1.6, ballScale: 1.5, drop: 1, cameraMotion: 1, cameraOrbit: 1, cameraPan: 1, cameraSpeed: 1, ambientMotion: 1 },
}
const canvas = document.getElementById('starters') as HTMLCanvasElement
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false })!
let renderer: Cinema2StartersRenderer | null = null
;(window as unknown as Record<string, unknown>).__startersBudget = {
  scenarios: Object.keys(scenarios),
  gpu(): string {
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown'
  },
  /** Median wall-clock milliseconds per frame (each frame is finished before the clock stops) and the share of pixels that are not black. */
  run(scenario: string, width: number, height: number, frames: number) {
    canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height)
    renderer ??= new Cinema2StartersRenderer(gl)
    const state = { ...base, ...scenarios[scenario], width, height }
    const one = new Uint8Array(4), times: number[] = []
    for (let i = 0; i < frames + 1; i++) { const t0 = performance.now(); renderer.draw(state as never); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one); gl.finish(); times.push(performance.now() - t0) }
    times.shift() // the first frame includes compiling the shader
    times.sort((a, b) => a - b)
    const pixels = new Uint8Array(width * height * 4); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let lit = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > 12) lit++
    return { ms: times[Math.floor(times.length / 2)]!, litShare: lit / (width * height) }
  },
}
