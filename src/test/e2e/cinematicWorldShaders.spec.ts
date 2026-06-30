import { expect, test } from '@playwright/test'
import { FULLSCREEN_VERT_SRC } from '../../components/vyzualz/react/shaders/runtime/FullscreenPass'
import { CINEMATIC_WORLD_SHADER_SOURCES } from '../../components/vyzualz/react/renderers/cinematic/worlds/CinematicWorldShaders'
import {
  REACTIVE_CONSTELLATION_FRAGMENT_SOURCE,
  REACTIVE_CONSTELLATION_VERTEX_SOURCE,
} from '../../components/vyzualz/react/renderers/cinematic/worlds/reactiveConstellation/ConstellationShaders'

test.describe('Cinematic Worlds WebGL2 shader smoke', () => {
  test('compiles, links, and renders a non-empty frame for all worlds at low and ultra quality', async ({ page }) => {
    await page.goto('about:blank')
    const result = await page.evaluate(({ vertexSource, fragmentSources }) => {
      const canvas = document.createElement('canvas')
      canvas.width = 96
      canvas.height = 96
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
      })
      if (!gl) return { supported: false, worlds: [] as Array<Record<string, unknown>> }

      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type)
        if (!shader) return { shader: null, log: 'createShader returned null' }
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error'
          gl.deleteShader(shader)
          return { shader: null, log }
        }
        return { shader, log: '' }
      }

      const floatValues: Record<string, number> = {
        uTime: 2.4,
        uTransportTime: 7.2,
        uBass: 0.72,
        uMid: 0.45,
        uHigh: 0.58,
        uVolume: 0.64,
        uBeat: 0.9,
        uBeatPhase: 0.25,
        uKick: 0.82,
        uSnare: 0.76,
        uTransient: 0.88,
        uBarProgress: 0.42,
        uImpactAge: 0.12,
        uDownbeat: 0.8,
        uSectionIntensity: 1.2,
        uDrop: 1,
        uSeed: 42069,
        uCoreRadius: 0.18,
        uRingRadius: 0.36,
        uRingThickness: 0.07,
        uAccretionTilt: 0.4,
        uLensingStrength: 0.8,
        uDepthLayers: 5,
        uRotationSpeed: 0.4,
        uShockwaveStrength: 0.8,
        uDropExpansion: 0.2,
        uCorridorDensity: 0.7,
        uTravelSpeed: 0.7,
        uTunnelWidth: 0.75,
        uArchThickness: 0.06,
        uAlternatingLights: 0.9,
        uFogDensity: 0.4,
        uCameraSway: 0.1,
        uVanishingOffset: 0,
        uStructureStyle: 1,
        uOpeningAmount: 0.65,
        uEdgeComplexity: 0.8,
        uShardDensity: 0.7,
        uCrackPropagation: 0.8,
        uFractureMotion: 0.7,
        uInnerDepth: 0.8,
        uShardDrift: 0.5,
        uOpeningShape: 1,
        uInnerSurface: 1,
        uGateScale: 0.8,
        uColumnCount: 6,
        uSlabDepth: 0.7,
        uRingCount: 5,
        uLightShaftIntensity: 0.9,
        uGlyphDensity: 0.7,
        uLockStrength: 0.2,
        uCameraTravel: 0.2,
        uArchitectureStyle: 1,
        uMembraneScale: 0.72,
        uViscosity: 0.6,
        uStretch: 0.7,
        uRippleDensity: 7,
        uRippleSpeed: 0.8,
        uTearAmount: 0.5,
        uRefractionStrength: 0.8,
        uSurfaceDetail: 6,
        uEdgeSoftness: 0.08,
        uOpeningBias: 0.55,
        uMidSurfaceMotion: 0.9,
        uCathedralScale: 0.9,
        uArchCount: 12,
        uPillarCount: 8,
        uRibDensity: 0.7,
        uAisleDepth: 0.9,
        uStarDensity: 0.7,
        uMajesticSpeed: 0.18,
        uCameraDrift: 0.1,
        uIlluminationResponse: 0.9,
        uSymmetryCount: 8,
        uRecursionDepth: 6,
        uChamberDepth: 0.8,
        uMirrorScale: 0.88,
        uFeedbackAmount: 0.3,
        uFeedbackDrift: 0.2,
        uSnapStrength: 0.9,
        uFoldStrength: 0.9,
        uGateRadius: 0.58,
        uGearCount: 10,
        uLockProgress: 0.65,
        uUnlockResponse: 1,
        uRadialComplexity: 0.75,
        uMechanicalDepth: 0.8,
        uMechanicalProgress: 0.4,
        uUnlockState: 0.65,
        uToothDensity: 0.75,
        uStormIntensity: 1,
        uCloudDensity: 0.8,
        uCloudLayers: 6,
        uVortexStrength: 0.8,
        uWindSpeed: 0.7,
        uDebrisDensity: 0.65,
        uLightningFrequency: 0.7,
        uLightningBranching: 0.75,
        uGatewayRadius: 0.48,
        uAtmosphericDepth: 0.9,
        uTurbulence: 0.85,
        uLightningResponse: 1,
      }

      const worlds: Array<Record<string, unknown>> = []
      for (const [name, fragmentSource] of Object.entries(fragmentSources)) {
        for (const quality of [0, 3]) {
          const vertex = compile(gl.VERTEX_SHADER, vertexSource)
          const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
          if (!vertex.shader || !fragment.shader) {
            worlds.push({ name, quality, compileLog: `${vertex.log}\n${fragment.log}`, linkLog: '', error: -1, energy: 0 })
            continue
          }

          const program = gl.createProgram()
          if (!program) {
            worlds.push({ name, quality, compileLog: '', linkLog: 'createProgram returned null', error: -1, energy: 0 })
            continue
          }
          gl.attachShader(program, vertex.shader)
          gl.attachShader(program, fragment.shader)
          gl.linkProgram(program)
          const linkLog = gl.getProgramParameter(program, gl.LINK_STATUS)
            ? ''
            : gl.getProgramInfoLog(program) ?? 'unknown link error'
          gl.deleteShader(vertex.shader)
          gl.deleteShader(fragment.shader)
          if (linkLog) {
            gl.deleteProgram(program)
            worlds.push({ name, quality, compileLog: '', linkLog, error: -1, energy: 0 })
            continue
          }

          gl.useProgram(program)
          const activeUniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number
          for (let index = 0; index < activeUniformCount; index += 1) {
            const active = gl.getActiveUniform(program, index)
            if (!active) continue
            const location = gl.getUniformLocation(program, active.name)
            if (location === null) continue
            if (active.name === 'uResolution') gl.uniform2f(location, canvas.width, canvas.height)
            else if (active.name === 'uVariation') gl.uniform4f(location, 0.3, -0.2, 1.05, 0.92)
            else if (active.name === 'uPrimary') gl.uniform3f(location, 0.15, 0.9, 1.0)
            else if (active.name === 'uSecondary') gl.uniform3f(location, 0.5, 0.18, 0.95)
            else if (active.name === 'uAccent') gl.uniform3f(location, 1.0, 0.7, 0.2)
            else if (active.name === 'uQuality') gl.uniform1f(location, quality)
            else if (active.type === gl.FLOAT) gl.uniform1f(location, floatValues[active.name] ?? 0.5)
          }

          const vao = gl.createVertexArray()
          gl.bindVertexArray(vao)
          gl.viewport(0, 0, canvas.width, canvas.height)
          gl.clearColor(0, 0, 0, 1)
          gl.clear(gl.COLOR_BUFFER_BIT)
          gl.drawArrays(gl.TRIANGLES, 0, 3)
          const error = gl.getError()
          const pixels = new Uint8Array(canvas.width * canvas.height * 4)
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
          let energy = 0
          for (let index = 0; index < pixels.length; index += 4) {
            energy += pixels[index] + pixels[index + 1] + pixels[index + 2]
          }
          gl.bindVertexArray(null)
          gl.deleteVertexArray(vao)
          gl.deleteProgram(program)
          worlds.push({ name, quality, compileLog: '', linkLog: '', error, energy })
        }
      }

      return { supported: true, worlds }
    }, {
      vertexSource: FULLSCREEN_VERT_SRC,
      fragmentSources: CINEMATIC_WORLD_SHADER_SOURCES,
    })

    expect(result.supported).toBe(true)
    expect(result.worlds).toHaveLength(18)
    for (const world of result.worlds) {
      expect(world.compileLog, `${world.name} quality ${world.quality} compile`).toBe('')
      expect(world.linkLog, `${world.name} quality ${world.quality} link`).toBe('')
      expect(world.error, `${world.name} quality ${world.quality} draw`).toBe(0)
      expect(world.energy, `${world.name} quality ${world.quality} output`).toBeGreaterThan(0)
    }
  })

  test('compiles and draws instanced Reactive Constellation geometry with depth storage', async ({ page }) => {
    await page.goto('about:blank')
    const result = await page.evaluate(({ vertexSource, fragmentSource }) => {
      const canvas = document.createElement('canvas')
      canvas.width = 96
      canvas.height = 96
      const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: true, stencil: false })
      if (!gl) return { supported: false, compileLog: '', linkLog: '', error: -1, energy: 0, depthBits: 0 }

      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type)
        if (!shader) return { shader: null, log: 'createShader returned null' }
        gl.shaderSource(shader, source)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error'
          gl.deleteShader(shader)
          return { shader: null, log }
        }
        return { shader, log: '' }
      }

      const vertex = compile(gl.VERTEX_SHADER, vertexSource)
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
      if (!vertex.shader || !fragment.shader) {
        return { supported: true, compileLog: `${vertex.log}\n${fragment.log}`, linkLog: '', error: -1, energy: 0, depthBits: 0 }
      }
      const program = gl.createProgram()
      if (!program) return { supported: true, compileLog: '', linkLog: 'createProgram returned null', error: -1, energy: 0, depthBits: 0 }
      gl.attachShader(program, vertex.shader)
      gl.attachShader(program, fragment.shader)
      gl.linkProgram(program)
      const linkLog = gl.getProgramParameter(program, gl.LINK_STATUS) ? '' : gl.getProgramInfoLog(program) ?? 'unknown link error'
      gl.deleteShader(vertex.shader)
      gl.deleteShader(fragment.shader)
      if (linkLog) return { supported: true, compileLog: '', linkLog, error: -1, energy: 0, depthBits: 0 }

      gl.useProgram(program)
      const setFloat = (name: string, value: number) => {
        const location = gl.getUniformLocation(program, name)
        if (location !== null) gl.uniform1f(location, value)
      }
      const setVec3 = (name: string, x: number, y: number, z: number) => {
        const location = gl.getUniformLocation(program, name)
        if (location !== null) gl.uniform3f(location, x, y, z)
      }
      const viewProjection = gl.getUniformLocation(program, 'uViewProjection')
      if (viewProjection !== null) gl.uniformMatrix4fv(viewProjection, false, new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ]))
      setVec3('uCameraPosition', 0, 0, 2)
      setVec3('uPrimary', 0.12, 0.9, 1)
      setVec3('uSecondary', 0.55, 0.18, 0.95)
      setVec3('uAccent', 1, 0.72, 0.2)
      setFloat('uTime', 1.5)
      setFloat('uNodeScale', 0.65)
      setFloat('uNodeSpin', 0.2)
      setFloat('uMotion', 0.6)
      setFloat('uCameraOrbit', 0.1)
      setFloat('uGeometryRotation', 0.15)
      setFloat('uDepthPulse', 0.1)
      setFloat('uBeat', 0.8)
      setFloat('uIntensity', 0.9)
      setFloat('uGlow', 0.8)
      setFloat('uFaceOpacity', 0.9)
      setFloat('uRimIntensity', 1.1)
      setFloat('uWireframeAmount', 0.5)
      setFloat('uBrightness', 0.4)

      const vao = gl.createVertexArray()
      gl.bindVertexArray(vao)
      const bind = (location: number, size: number, values: number[], divisor = 0) => {
        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW)
        gl.enableVertexAttribArray(location)
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
        if (divisor) gl.vertexAttribDivisor(location, divisor)
        return buffer
      }
      const buffers = [
        bind(0, 3, [-0.62, -0.52, 0, 0.62, -0.52, 0, 0, 0.68, 0]),
        bind(1, 3, [0, 0, 1, 0, 0, 1, 0, 0, 1]),
        bind(2, 3, [1, 0, 0, 0, 1, 0, 0, 0, 1]),
        bind(3, 3, [0, 0, 0], 1),
        bind(4, 1, [1], 1),
        bind(5, 3, [0, 0, 0], 1),
        bind(6, 1, [0.8], 1),
        bind(7, 1, [0.45], 1),
      ]

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 1)
      gl.clearDepth(1)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.enable(gl.DEPTH_TEST)
      gl.depthFunc(gl.LEQUAL)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 1)
      const error = gl.getError()
      const depthBits = gl.getParameter(gl.DEPTH_BITS) as number
      const pixels = new Uint8Array(canvas.width * canvas.height * 4)
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      let energy = 0
      for (let index = 0; index < pixels.length; index += 4) energy += pixels[index] + pixels[index + 1] + pixels[index + 2]

      buffers.forEach(buffer => gl.deleteBuffer(buffer))
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
      return { supported: true, compileLog: '', linkLog: '', error, energy, depthBits }
    }, { vertexSource: REACTIVE_CONSTELLATION_VERTEX_SOURCE, fragmentSource: REACTIVE_CONSTELLATION_FRAGMENT_SOURCE })

    expect(result.supported).toBe(true)
    expect(result.compileLog).toBe('')
    expect(result.linkLog).toBe('')
    expect(result.error).toBe(0)
    expect(result.depthBits).toBeGreaterThan(0)
    expect(result.energy).toBeGreaterThan(0)
  })

})
