import bossBattleImageUrl from '../../../../assets/boss-battle-reference.png'
import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
} from './Cinema2ModuleContracts'

export const CINEMA2_BOSS_BATTLE_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('boss-battle-native')
export const CINEMA2_BOSS_BATTLE_NATIVE_MODULE_VERSION = 1 as const
export const CINEMA2_BOSS_BATTLE_IMAGE_URL = bossBattleImageUrl

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform vec2 u_imageResolution;
out vec4 outColor;

void main() {
  float viewportAspect = u_resolution.x / max(u_resolution.y, 1.0);
  float imageAspect = u_imageResolution.x / max(u_imageResolution.y, 1.0);
  vec2 uv = v_uv;
  if (viewportAspect > imageAspect) {
    uv.x = (uv.x - 0.5) * viewportAspect / imageAspect + 0.5;
  } else {
    uv.y = (uv.y - 0.5) * imageAspect / viewportAspect + 0.5;
  }
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    outColor = vec4(0.002, 0.018, 0.022, 1.0);
    return;
  }
  outColor = texture(u_source, uv);
}
`

class BossBattleImageRenderer {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass
  private readonly texture: WebGLTexture
  private readonly image = new Image()
  private imageWidth = 1344
  private imageHeight = 896
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    const compiled = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema 2.0 Boss Battle',
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: ['u_source', 'u_resolution', 'u_imageResolution'],
    })
    if (!compiled.program) throw new Error(`Boss Battle shader compilation failed: ${compiled.error.log}`)
    this.program = compiled.program
    this.pass = new FullscreenPass(gl)
    const texture = gl.createTexture()
    if (!texture) throw new Error('Boss Battle could not allocate its image texture.')
    this.texture = texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 9, 11, 255]))
    gl.bindTexture(gl.TEXTURE_2D, null)
    this.image.decoding = 'async'
    this.image.onload = () => this.uploadImage()
    this.image.src = bossBattleImageUrl
  }

  draw({ target, width, height }: Cinema2ModuleRenderExecutionContext): void {
    if (this.disposed) return
    this.program.activate()
    this.program.setVec2('u_resolution', width, height)
    this.program.setVec2('u_imageResolution', this.imageWidth, this.imageHeight)
    this.pass.run(this.program, target, width, height, [{ unit: 0, texture: this.texture, uniformName: 'u_source' }])
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.image.onload = null
    this.image.src = ''
    this.gl.deleteTexture(this.texture)
    this.pass.dispose()
    this.program.dispose()
  }

  private uploadImage(): void {
    if (this.disposed || !this.image.naturalWidth || !this.image.naturalHeight) return
    this.imageWidth = this.image.naturalWidth
    this.imageHeight = this.image.naturalHeight
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.image)
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false)
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)
  }
}

export const cinema2BossBattleNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_BOSS_BATTLE_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_BOSS_BATTLE_NATIVE_MODULE_VERSION,
  create(context: Cinema2ModuleCreateContext) {
    const provider = Object.freeze({
      id: `${context.module.id}:boss-battle-image`,
      moduleId: context.module.id,
      intent: 'fullscreen' as const,
      execute(execution: Cinema2ModuleRenderExecutionContext) {
        const renderer = context.resources.acquire(
          'boss-battle:image-renderer-v1',
          'BossBattleImageRenderer',
          gl => new BossBattleImageRenderer(gl),
          value => value.dispose(),
        )
        renderer.draw(execution)
      },
    })
    return {
      lifecycle: { update: () => {}, dispose: () => {} },
      render: { providers: Object.freeze([provider]) },
    }
  },
})
