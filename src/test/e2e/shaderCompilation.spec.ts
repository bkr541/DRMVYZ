/**
 * Real WebGL2 compilation coverage for every registered Shader scene.
 *
 * The deterministic Vitest source validator catches reserved identifiers and
 * source-contract regressions in environments without a browser. This suite is
 * the stronger browser-backed gate and asks Chromium's actual WebGL2 compiler
 * to compile and link every registered pass.
 */
import { expect, test } from '@playwright/test'
import { shaderRegistry } from '../../components/vyzualz/react/shaders/registry'
import { getShaderSourceUnits } from '../../components/vyzualz/react/shaders/registry/ShaderSourceValidator'

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

test.use({
  video: 'off',
  trace: 'off',
  screenshot: 'off',
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    ...(systemChromium ? { executablePath: systemChromium } : {}),
  },
})

test('all registered Shader scenes compile and link in WebGL2', async ({ page }) => {
  const sources = shaderRegistry.getAll().flatMap(scene =>
    getShaderSourceUnits(scene)
      .filter(unit => unit.stage === 'fragment')
      .map(fragment => {
        const vertex = getShaderSourceUnits(scene).find(unit =>
          unit.stage === 'vertex' && unit.pass?.id === fragment.pass?.id,
        ) ?? getShaderSourceUnits(scene).find(unit => unit.stage === 'vertex')!

        return {
          sceneId: scene.id,
          sceneName: scene.name,
          label: fragment.label.replace(/\/frag$/, ''),
          vertSrc: vertex.source,
          fragSrc: fragment.source,
        }
      }),
  )

  const result = await page.evaluate((programSources) => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return { webgl2: false, failures: [] as string[] }

    const failures: string[] = []
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return { shader: null, log: 'createShader() returned null' }
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) || 'Unknown compiler error'
        gl.deleteShader(shader)
        return { shader: null, log }
      }
      return { shader, log: '' }
    }

    for (const source of programSources) {
      const vert = compile(gl.VERTEX_SHADER, source.vertSrc)
      if (!vert.shader) {
        failures.push(`${source.sceneId} (${source.sceneName}) ${source.label} vertex: ${vert.log}`)
        continue
      }

      const frag = compile(gl.FRAGMENT_SHADER, source.fragSrc)
      if (!frag.shader) {
        gl.deleteShader(vert.shader)
        failures.push(`${source.sceneId} (${source.sceneName}) ${source.label} fragment: ${frag.log}`)
        continue
      }

      const program = gl.createProgram()
      if (!program) {
        gl.deleteShader(vert.shader)
        gl.deleteShader(frag.shader)
        failures.push(`${source.sceneId} (${source.sceneName}) ${source.label} link: createProgram() returned null`)
        continue
      }

      gl.attachShader(program, vert.shader)
      gl.attachShader(program, frag.shader)
      gl.linkProgram(program)
      gl.deleteShader(vert.shader)
      gl.deleteShader(frag.shader)

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        failures.push(`${source.sceneId} (${source.sceneName}) ${source.label} link: ${gl.getProgramInfoLog(program) || 'Unknown linker error'}`)
      }
      gl.deleteProgram(program)
    }

    return { webgl2: true, failures }
  }, sources)

  test.skip(!result.webgl2, 'This browser environment does not expose WebGL2; Vitest source validation remains the deterministic fallback.')
  expect(result.failures).toEqual([])
})
