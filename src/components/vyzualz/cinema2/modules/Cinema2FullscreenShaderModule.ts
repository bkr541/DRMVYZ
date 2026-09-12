import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2JsonObject,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
} from './Cinema2ModuleContracts'

export const CINEMA2_FULLSCREEN_SHADER_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('fullscreen-shader')
export const CINEMA2_FULLSCREEN_SHADER_MODULE_VERSION = 1 as const

const DEFAULT_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
out vec4 outColor;
void main() {
  outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`

function validateConfig(config: Cinema2JsonObject | undefined): readonly Cinema2ModuleDiagnostic[] {
  if (config == null) return Object.freeze([])
  if (config.fragmentSource != null && (typeof config.fragmentSource !== 'string' || config.fragmentSource.trim().length === 0)) {
    return Object.freeze([Object.freeze({
      code: 'CINEMA2_FULLSCREEN_SHADER_SOURCE_INVALID',
      path: '$.config.fragmentSource',
      message: 'Fullscreen shader fragmentSource must be a non-empty string when provided.',
    })])
  }
  if (config.label != null && typeof config.label !== 'string') {
    return Object.freeze([Object.freeze({
      code: 'CINEMA2_FULLSCREEN_SHADER_LABEL_INVALID',
      path: '$.config.label',
      message: 'Fullscreen shader label must be a string when provided.',
    })])
  }
  return Object.freeze([])
}

export const cinema2FullscreenShaderModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_FULLSCREEN_SHADER_MODULE_TYPE_ID,
  version: CINEMA2_FULLSCREEN_SHADER_MODULE_VERSION,
  validate: (module: Readonly<Cinema2ModuleManifest>) => validateConfig(module.config),
  create: (context: Cinema2ModuleCreateContext) => {
    const fragmentSource = typeof context.module.config?.fragmentSource === 'string'
      ? context.module.config.fragmentSource
      : DEFAULT_FRAGMENT_SOURCE
    const label = typeof context.module.config?.label === 'string'
      ? context.module.config.label
      : `Cinema2/${context.module.id}`

    const provider = Object.freeze({
      id: `${context.module.id}:fullscreen`,
      moduleId: context.module.id,
      intent: 'fullscreen' as const,
      execute: ({ frame, target, width, height }: Cinema2ModuleRenderExecutionContext) => {
        const program = context.resources.acquire(
          'fullscreen-program',
          'WebGLProgram',
          (gl: WebGL2RenderingContext) => {
            const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
              label,
              vertSrc: FULLSCREEN_VERT_SRC,
              fragSrc: fragmentSource,
              optionalUniforms: ['u_time', 'u_resolution', 'u_audioOverallEnergy', 'u_audioOverallEnergyAvailable'],
            })
            if (!result.program) {
              throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
            }
            return result.program
          },
          (value: ShaderProgram) => value.dispose(),
        )
        const pass = context.resources.acquire(
          'fullscreen-pass',
          'FullscreenPass',
          (gl: WebGL2RenderingContext) => new FullscreenPass(gl),
          (value: FullscreenPass) => value.dispose(),
        )
        // Uniform setters require this program to be current. FullscreenPass.run()
        // activates again before draw, so this keeps the shared pass contract intact.
        program.activate()
        program.setFloat('u_time', frame.elapsedTimeSec)
        program.setVec2('u_resolution', width, height)
        const overallEnergy = frame.audio?.features.overallEnergy
        const overallEnergyAvailable = overallEnergy?.available === true && typeof overallEnergy.value === 'number' && Number.isFinite(overallEnergy.value)
        program.setFloat('u_audioOverallEnergy', overallEnergyAvailable ? overallEnergy.value! : 0)
        program.setFloat('u_audioOverallEnergyAvailable', overallEnergyAvailable ? 1 : 0)
        pass.run(program, target, width, height, [])
      },
    })

    return {
      lifecycle: {
        update: () => {},
        dispose: () => {},
      },
      render: { providers: Object.freeze([provider]) },
    }
  },
})
