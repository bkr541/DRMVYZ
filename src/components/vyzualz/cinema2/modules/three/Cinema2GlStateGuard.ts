/**
 * Saves the small set of WebGL state that the render graph executor establishes per pass (and that a foreign renderer
 * such as Three.js changes), and restores it afterwards. Everything else is put back into a canonical unbound state.
 *
 * Why this and not a full capture: reading ~150 GL parameters cost about 1.4 ms per frame in the #5 spike, this set
 * costs about 0.3 ms and leaves the state the engine's later passes rely on identical to what they would have seen.
 * Restoring costs no GPU round trips.
 */
export class Cinema2GlStateGuard {
  private framebuffer: WebGLFramebuffer | null = null
  private readFramebuffer: WebGLFramebuffer | null = null
  private viewport: Int32Array = new Int32Array(4)
  private scissorBox: Int32Array = new Int32Array(4)
  private scissorTest = false
  private blend = false
  private depthTest = false
  private cullFace = false
  private depthFunc = 0
  private depthMask = true
  private colorMask: boolean[] = [true, true, true, true]
  private clearColor: Float32Array = new Float32Array(4)
  private vertexArray: WebGLVertexArrayObject | null = null
  private program: WebGLProgram | null = null
  private arrayBuffer: WebGLBuffer | null = null

  constructor(private readonly gl: WebGL2RenderingContext) {}

  capture(): this {
    const gl = this.gl
    this.framebuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)
    this.readFramebuffer = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)
    this.viewport = gl.getParameter(gl.VIEWPORT)
    this.scissorBox = gl.getParameter(gl.SCISSOR_BOX)
    this.scissorTest = gl.isEnabled(gl.SCISSOR_TEST)
    this.blend = gl.isEnabled(gl.BLEND)
    this.depthTest = gl.isEnabled(gl.DEPTH_TEST)
    this.cullFace = gl.isEnabled(gl.CULL_FACE)
    this.depthFunc = gl.getParameter(gl.DEPTH_FUNC)
    this.depthMask = gl.getParameter(gl.DEPTH_WRITEMASK)
    this.colorMask = gl.getParameter(gl.COLOR_WRITEMASK)
    this.clearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE)
    this.vertexArray = gl.getParameter(gl.VERTEX_ARRAY_BINDING)
    this.program = gl.getParameter(gl.CURRENT_PROGRAM)
    this.arrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING)
    return this
  }

  restore(): void {
    const gl = this.gl
    for (let unit = 0; unit < 16; unit++) {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)
    }
    gl.activeTexture(gl.TEXTURE0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arrayBuffer)
    gl.bindVertexArray(this.vertexArray)
    gl.useProgram(this.program)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffer)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.readFramebuffer)
    gl.viewport(this.viewport[0]!, this.viewport[1]!, this.viewport[2]!, this.viewport[3]!)
    gl.scissor(this.scissorBox[0]!, this.scissorBox[1]!, this.scissorBox[2]!, this.scissorBox[3]!)
    setCapability(gl, gl.SCISSOR_TEST, this.scissorTest)
    setCapability(gl, gl.BLEND, this.blend)
    setCapability(gl, gl.DEPTH_TEST, this.depthTest)
    setCapability(gl, gl.CULL_FACE, this.cullFace)
    gl.depthFunc(this.depthFunc)
    gl.depthMask(this.depthMask)
    gl.colorMask(this.colorMask[0]!, this.colorMask[1]!, this.colorMask[2]!, this.colorMask[3]!)
    gl.clearColor(this.clearColor[0]!, this.clearColor[1]!, this.clearColor[2]!, this.clearColor[3]!)
  }
}

function setCapability(gl: WebGL2RenderingContext, capability: number, enabled: boolean): void {
  if (enabled) gl.enable(capability)
  else gl.disable(capability)
}
