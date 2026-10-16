import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'

export interface Cinema2StartersRenderState {
  target: WebGLFramebuffer | null
  width: number
  height: number
  time: number
  intensity: number
  caseOpen: number
  ballSpread: number
  ballScale: number
  grassDensity: number
  ambientMotion: number
  glow: number
  vignette: number
  energy: number
  bass: number
  kick: number
  snare: number
  build: number
  drop: number
  highs: number
  background: readonly [number, number, number]
  grass: readonly [number, number, number]
  leather: readonly [number, number, number]
  ballRed: readonly [number, number, number]
  ballWhite: readonly [number, number, number]
  metal: readonly [number, number, number]
}

// Intentional blank baseline. The previous procedural scene was removed so the
// Starters visual can be rebuilt without inheriting its geometry or materials.
const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
out vec4 outColor;

void main() {
  outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`

export class Cinema2StartersRenderer {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass

  constructor(private readonly gl: WebGL2RenderingContext) {
    const compiled = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema 2.0 Starters blank baseline',
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: [],
    })
    if (!compiled.program) throw new Error(`Starters shader compilation failed: ${compiled.error.log}`)
    this.program = compiled.program
    this.pass = new FullscreenPass(gl)
  }

  draw(state: Readonly<Cinema2StartersRenderState>): void {
    this.program.activate()
    this.pass.run(this.program, state.target, state.width, state.height, [])
  }

  estimateGpuBytes(): number { return 16 * 1024 }
  dispose(): void { this.pass.dispose(); this.program.dispose() }
}
