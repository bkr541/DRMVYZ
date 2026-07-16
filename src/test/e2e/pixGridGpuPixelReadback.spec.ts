import { expect, test } from '@playwright/test'
import {
  PIX_GRID_FULLSCREEN_VERTEX_SHADER,
  PIX_GRID_LOGICAL_FRAGMENT_SHADER,
  PIX_GRID_PRESENTATION_FRAGMENT_SHADER,
} from '../../components/vyzualz/react/renderers/pixGrid/PixGridGpuShaderSources'

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

test.use({
  video: 'off',
  trace: 'off',
  screenshot: 'off',
  launchOptions: {
    args: [
      '--no-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
    ...(systemChromium ? { executablePath: systemChromium } : {}),
  },
})

test('PixGrid renders deterministic two-pass WebGL pixels with transparent logical texels and dark cell gaps', async ({ page }) => {
  const result = await page.evaluate(({ vertexSource, logicalSource, presentationSource }) => {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
    })
    if (!gl) return { webgl2: false as const }

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'compile failure')
      return shader
    }
    const link = (fragmentSource: string) => {
      const vertex = compile(gl.VERTEX_SHADER, vertexSource)
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
      const program = gl.createProgram()!
      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link failure')
      return program
    }
    const uniform = (program: WebGLProgram, name: string) => {
      const location = gl.getUniformLocation(program, name)
      if (!location) throw new Error(`missing ${name}`)
      return location
    }

    const logicalProgram = link(logicalSource)
    const presentationProgram = link(presentationSource)
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)

    const logicalWidth = 16
    const logicalHeight = 9
    const logicalTexture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, logicalTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, logicalWidth, logicalHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

    const overrideTexture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, overrideTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const compositedPixels = new Uint8Array(logicalWidth * logicalHeight * 4)
    for (let y = 0; y < logicalHeight; y += 1) {
      for (let x = 0; x < logicalWidth; x += 1) {
        if (x !== 8 && y !== 4) continue
        const offset = (y * logicalWidth + x) * 4
        compositedPixels[offset] = 38
        compositedPixels[offset + 1] = 222
        compositedPixels[offset + 2] = 255
        compositedPixels[offset + 3] = 255
      }
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      logicalWidth,
      logicalHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      compositedPixels,
    )

    const framebuffer = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, logicalTexture, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('logical framebuffer incomplete')

    const draw = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.viewport(0, 0, logicalWidth, logicalHeight)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(logicalProgram)
      gl.uniform2f(uniform(logicalProgram, 'uLogicalSize'), logicalWidth, logicalHeight)
      gl.uniform1i(uniform(logicalProgram, 'uBlackout'), 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, overrideTexture)
      gl.uniform1i(uniform(logicalProgram, 'uOverrideTexture'), 1)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(presentationProgram)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, logicalTexture)
      gl.uniform1i(uniform(presentationProgram, 'uLogicalTexture'), 0)
      gl.uniform2f(uniform(presentationProgram, 'uLogicalSize'), logicalWidth, logicalHeight)
      gl.uniform2f(uniform(presentationProgram, 'uPresentationSize'), canvas.width, canvas.height)
      gl.uniform3f(uniform(presentationProgram, 'uBackground'), 0, 0, 0)
      gl.uniform1f(uniform(presentationProgram, 'uGap'), 0.22)
      gl.uniform1f(uniform(presentationProgram, 'uRoundness'), 0.25)
      gl.uniform1f(uniform(presentationProgram, 'uCellBrightness'), 0.9)
      gl.uniform1f(uniform(presentationProgram, 'uGlow'), 0.2)
      gl.uniform1f(uniform(presentationProgram, 'uDiffusion'), 0.1)
      gl.uniform1f(uniform(presentationProgram, 'uGlobalIntensity'), 0.9)
      gl.uniform1i(uniform(presentationProgram, 'uRgbSubpixel'), 0)
      gl.uniform1i(uniform(presentationProgram, 'uShowBounds'), 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.finish()
      const pixels = new Uint8Array(canvas.width * canvas.height * 4)
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      return pixels
    }

    const logicalPixels = new Uint8Array(logicalWidth * logicalHeight * 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.useProgram(logicalProgram)
    gl.viewport(0, 0, logicalWidth, logicalHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(uniform(logicalProgram, 'uLogicalSize'), logicalWidth, logicalHeight)
    gl.uniform1i(uniform(logicalProgram, 'uBlackout'), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, overrideTexture)
    gl.uniform1i(uniform(logicalProgram, 'uOverrideTexture'), 1)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.readPixels(0, 0, logicalWidth, logicalHeight, gl.RGBA, gl.UNSIGNED_BYTE, logicalPixels)

    const first = draw()
    const second = draw()
    let difference = 0
    for (let index = 0; index < first.length; index += 1) difference += Math.abs(first[index] - second[index])

    const luminance = (x: number, y: number) => {
      const offset = (y * canvas.width + x) * 4
      return first[offset] + first[offset + 1] + first[offset + 2]
    }
    const rgb = (x: number, y: number) => {
      const offset = (y * canvas.width + x) * 4
      return [first[offset], first[offset + 1], first[offset + 2]] as const
    }
    const cellWidth = canvas.width / logicalWidth
    const cellHeight = canvas.height / logicalHeight
    const centerX = Math.floor(8.5 * cellWidth)
    const centerY = Math.floor(4.5 * cellHeight)
    const centerLuminance = luminance(centerX, centerY)
    const centerRgb = rgb(centerX, centerY)
    const gapLuminance = luminance(Math.floor(9 * cellWidth), Math.floor(4.5 * cellHeight))
    const inactiveRgb = rgb(Math.floor(0.5 * cellWidth), Math.floor(0.5 * cellHeight))
    const alphas = Array.from({ length: logicalWidth * logicalHeight }, (_, index) => logicalPixels[index * 4 + 3])

    return {
      webgl2: true as const,
      deterministicDifference: difference,
      centerLuminance,
      centerRgb,
      gapLuminance,
      inactiveRgb,
      transparentLogicalTexels: alphas.filter(alpha => alpha === 0).length,
      activeLogicalTexels: alphas.filter(alpha => alpha > 0).length,
    }
  }, {
    vertexSource: PIX_GRID_FULLSCREEN_VERTEX_SHADER,
    logicalSource: PIX_GRID_LOGICAL_FRAGMENT_SHADER,
    presentationSource: PIX_GRID_PRESENTATION_FRAGMENT_SHADER,
  })

  test.skip(!result.webgl2, 'This browser environment does not expose WebGL2; Vitest shader and lifecycle coverage remains active.')
  if (!result.webgl2) return
  expect(result.deterministicDifference).toBe(0)
  expect(result.activeLogicalTexels).toBeGreaterThan(0)
  expect(result.transparentLogicalTexels).toBeGreaterThan(0)
  expect(result.centerLuminance).toBeGreaterThan(result.gapLuminance)
  expect(Math.max(...result.inactiveRgb)).toBe(0)
  expect(result.centerRgb[1]).toBeGreaterThan(result.centerRgb[0])
  expect(result.centerRgb[2]).toBeGreaterThan(result.centerRgb[0])
})
