/**
 * DEVELOPER-ONLY harness for the Cinema 2.0 rendering upgrade. Open `/src/test/browser/cinema2-render-validation.html` in the Vite dev server
 * (add `?controls=1` for the on-screen feature toggles) or drive it from `scripts/cinema2-assets/accept-render-upgrade.mjs`.
 *
 * It renders the validation scene through the same path the engine uses: the shared Three renderer from `Cinema2ThreeRendererHost` drawing into an
 * engine-owned framebuffer (float color + depth texture), then the real `ambient-occlusion` and `anti-aliasing` effect instances on the raw GL
 * context, with pooled intermediate targets. Nothing here touches a preset.
 */
import type * as ThreeNamespace from 'three'
import {
  cinema2StableId,
  type Cinema2EffectId,
  type Cinema2EffectManifest,
  type Cinema2RenderQualityLevel,
} from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import type { Cinema2EffectInstance, Cinema2EffectRenderExecutionContext } from '../../components/vyzualz/cinema2/effects/Cinema2EffectContracts'
import { cinema2NativeEffectRegistry } from '../../components/vyzualz/cinema2/effects/Cinema2EffectRegistry'
import { Cinema2GlStateGuard } from '../../components/vyzualz/cinema2/modules/three/Cinema2GlStateGuard'
import { Cinema2ThreeAssetCache } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetCache'
import { Cinema2ThreeAssetRegistry } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetRegistry'
import { cinema2ThreeDecoderPool } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeDecoders'
import {
  applyCinema2EnvironmentProfile,
  loadCinema2EnvironmentAsset,
  loadCinema2EnvironmentTexture,
} from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeEnvironmentProfiles'
import { prepareCinema2LightingRig } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeLightingRigs'
import { loadCinema2ThreeLibrary, type Cinema2ThreeLibrary } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeLibrary'
import { getCinema2ThreeRenderer } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeRendererHost'
import { configureCinema2ShadowMap, resolveCinema2ShadowProfile } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeShadowProfiles'
import { detectCinema2RenderCapabilities, resolveCinema2RenderFeatures } from '../../components/vyzualz/cinema2/render/Cinema2RenderQualityProfiles'
import { Cinema2RenderDiagnostics } from '../../components/vyzualz/cinema2/runtime/Cinema2RenderDiagnostics'
import { getCinema2RenderTargetPool, type Cinema2PooledTarget } from '../../components/vyzualz/cinema2/runtime/Cinema2RenderTargetPool'
import { buildValidationScene, type ValidationModelKind, type ValidationScene } from './cinema2RenderValidationScene'

export type EnvironmentChoice = 'none' | 'studio' | 'exr'
export interface ValidationFeatures {
  ambientOcclusion: boolean
  /** `off`, `fxaa`, `smaa` or `auto` (the tier's choice). */
  antiAliasing: 'off' | 'fxaa' | 'smaa' | 'auto'
  shadows: boolean
  environment: EnvironmentChoice
  model: ValidationModelKind
  /** Show the occlusion buffer instead of the composite. */
  occlusionOnly: boolean
}

interface ValidationApi {
  prepare(): Promise<unknown>
  setFeatures(features: Partial<ValidationFeatures>): Promise<unknown>
  renderFrames(count: number, timeSec?: number): Promise<unknown>
  resize(width: number, height: number): Promise<unknown>
  recoverContext(): Promise<unknown>
  lodLevelAt(distance: number): number
  /** Pixel rectangle (top-left origin) that a named object covers in the current frame. */
  screenRect(name: string): { x: number; y: number; width: number; height: number } | null
  status(): unknown
}
declare global { interface Window { __cinema2RenderValidation?: ValidationApi } }

const FIXTURE_ROOT = '/src/test/fixtures/render-validation'
const query = new URLSearchParams(location.search)
const requestedQuality = query.get('quality')
const tier: Cinema2RenderQualityLevel = requestedQuality === 'low' || requestedQuality === 'medium' ? requestedQuality : 'high'
const errors: string[] = []
window.addEventListener('error', event => errors.push(event.message))
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)))

const canvas = document.getElementById('cinema2-render-validation') as HTMLCanvasElement | null
if (!canvas) throw new Error('Validation canvas is missing.')
const validationCanvas: HTMLCanvasElement = canvas
let width = Math.max(320, Math.round(innerWidth))
let height = Math.max(180, Math.round(innerHeight))
validationCanvas.width = width
validationCanvas.height = height

const gl: WebGL2RenderingContext = (() => {
  const context = validationCanvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
  if (!context) throw new Error('WebGL2 is not available.')
  return context
})()

const features: ValidationFeatures = {
  ambientOcclusion: query.get('ao') === '1',
  antiAliasing: (['off', 'fxaa', 'smaa', 'auto'] as const).find(mode => mode === query.get('aa')) ?? 'off',
  shadows: query.get('shadows') === '1',
  environment: (['none', 'studio', 'exr'] as const).find(choice => choice === query.get('env')) ?? 'studio',
  model: (['plain', 'meshopt', 'draco', 'ktx2'] as const).find(kind => kind === query.get('model')) ?? 'plain',
  occlusionOnly: query.get('occlusion') === '1',
}

let library: Cinema2ThreeLibrary
let validationScene: ValidationScene
let diagnostics: Cinema2RenderDiagnostics | null = null
let framebuffer: WebGLFramebuffer | null = null
let colorTexture: WebGLTexture | null = null
let depthTexture: WebGLTexture | null = null
let aoEffect: Cinema2EffectInstance | null = null
let aaEffect: Cinema2EffectInstance | null = null
let sceneTarget: ThreeNamespace.WebGLRenderTarget | null = null
let guard: Cinema2GlStateGuard
let aaMode = ''
let contextRecoveries = 0
let lastLoss = { lost: false, restored: false }
let frameCounter = 0
let lastFrameCpuMs = 0
let loadedAssets: Record<string, unknown> = {}

const registry = new Cinema2ThreeAssetRegistry()
registry.register({ id: 'rv-plain', url: `${FIXTURE_ROOT}/fixture-plain.glb`, compression: 'none', license: 'generated-in-house' })
registry.register({ id: 'rv-meshopt', url: `${FIXTURE_ROOT}/fixture-meshopt.glb`, compression: 'meshopt', license: 'generated-in-house' })
registry.register({ id: 'rv-draco', url: `${FIXTURE_ROOT}/fixture-draco.glb`, compression: 'draco', license: 'generated-in-house' })
registry.register({ id: 'rv-ktx2', url: `${FIXTURE_ROOT}/fixture-ktx2.glb`, compression: 'none', textureCompression: 'ktx2', license: 'generated-in-house' })
registry.register({ id: 'rv-animated', url: `${FIXTURE_ROOT}/fixture-animated.glb`, compression: 'none', license: 'generated-in-house' })
const cache = new Cinema2ThreeAssetCache(registry)

const manifestFor = (typeId: string, id: string, parameters: Record<string, unknown>): Readonly<Cinema2EffectManifest> =>
  ({ id: cinema2StableId<Cinema2EffectId>(id), typeId, version: 1, enabled: true, order: 0, scope: 'output', parameters: { mix: 1, ...parameters } }) as never

function createEffect(typeId: string, id: string, parameters: Record<string, unknown>): Cinema2EffectInstance {
  const definition = cinema2NativeEffectRegistry.get(cinema2StableId(typeId), 1)
  if (!definition) throw new Error(`Effect ${typeId} is not registered.`)
  return definition.create({ gl, effect: manifestFor(typeId, id, parameters), history: {} as never })
}

function allocateSceneTarget(): void {
  if (framebuffer) gl.deleteFramebuffer(framebuffer)
  if (colorTexture) gl.deleteTexture(colorTexture)
  if (depthTexture) gl.deleteTexture(depthTexture)
  const floatTargets = gl.getExtension('EXT_color_buffer_float') != null
  colorTexture = gl.createTexture()
  depthTexture = gl.createTexture()
  framebuffer = gl.createFramebuffer()
  gl.bindTexture(gl.TEXTURE_2D, colorTexture)
  if (floatTargets) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR)
  for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, depthTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null)
  for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.NEAREST)
  for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0)
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Validation framebuffer is incomplete (0x${status.toString(16)}).`)
}

interface ExternalFramebufferRenderer { setRenderTargetFramebuffer(target: unknown, framebuffer: WebGLFramebuffer): void }

async function loadEnvironment(): Promise<void> {
  const host = getCinema2ThreeRenderer(library, gl)
  if (features.environment === 'none') {
    validationScene.scene.environment = null
    return
  }
  const texture = features.environment === 'studio'
    ? await loadCinema2EnvironmentAsset(library, host.renderer, 'cinema2-studio-environment-neutral', { tier })
    : await loadCinema2EnvironmentTexture(library, host.renderer, `${FIXTURE_ROOT}/fixture-env.exr`, { tier })
  applyCinema2EnvironmentProfile(library.THREE, validationScene.scene, texture, { intensity: features.environment === 'exr' ? 0.3 : 0.4, rotationDegrees: [0, 20, 0] })
}

function cameraFrame(): NonNullable<Cinema2EffectRenderExecutionContext['camera']> {
  const camera = validationScene.camera
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  const viewProjection = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse)
  return { position: [camera.position.x, camera.position.y, camera.position.z], viewProjectionMatrix: Array.from(viewProjection.elements), near: camera.near, far: camera.far, aspect: camera.aspect } as never
}

function drawFrame(timeSec: number): void {
  const { THREE } = library
  const renderer = getCinema2ThreeRenderer(library, gl).renderer
  validationScene.update(timeSec)
  validationScene.setShadows(features.shadows)
  diagnostics?.beginFrame()
  const frameStart = performance.now()
  guard.capture()
  try {
    renderer.resetState()
    configureCinema2ShadowMap(THREE, renderer, resolveCinema2ShadowProfile(tier), features.shadows)
    if (!sceneTarget) {
      sceneTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true })
      ;(sceneTarget as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true
      sceneTarget.texture.colorSpace = THREE.SRGBColorSpace
    }
    ;(renderer as unknown as ExternalFramebufferRenderer).setRenderTargetFramebuffer(sceneTarget, framebuffer!)
    sceneTarget.viewport.set(0, 0, width, height)
    sceneTarget.scissor.set(0, 0, width, height)
    renderer.setRenderTarget(sceneTarget)
    renderer.setClearColor(0x04060a, 1)
    renderer.clear(true, true, true)
    renderer.render(validationScene.scene, validationScene.camera)
    renderer.setRenderTarget(null)
  } finally {
    renderer.resetState()
    guard.restore()
  }

  const camera = cameraFrame()
  const pool = getCinema2RenderTargetPool(gl)
  const colorInput = { id: 'scene-color', attachment: 'color' as const, texture: colorTexture!, width, height }
  const depthInput = { id: 'scene-depth', attachment: 'depth' as const, texture: depthTexture!, width, height }
  const context = (input: typeof colorInput, target: WebGLFramebuffer | null, parameters: Record<string, unknown>): Cinema2EffectRenderExecutionContext =>
    ({ frame: {} as never, input, inputs: [input, depthInput], target, width, height, mix: 1, parameters: { mix: 1, ...parameters } as never, quality: tier, camera } as never)

  const passes: string[] = []
  let current = colorInput
  let intermediate: Cinema2PooledTarget | null = null
  try {
    if (features.ambientOcclusion) {
      aoEffect ??= createEffect('ambient-occlusion', 'rv-ao', {})
      intermediate = pool.acquire(width, height, 'rgba16f')
      aoEffect.render(context(current, intermediate.framebuffer, { radius: 0.35, intensity: 1.6, bias: 0.06, power: 1.2, maxDistance: 60, output: features.occlusionOnly ? 'occlusion' : 'composite' }))
      current = { id: 'ao-output', attachment: 'color', texture: intermediate.texture, width, height }
      passes.push('ambient-occlusion')
    }
    aaEffect ??= createEffect('anti-aliasing', 'rv-aa', {})
    aaEffect.render(context(current, null, { mode: features.antiAliasing }))
    if (features.antiAliasing !== 'off') passes.push(`anti-aliasing:${features.antiAliasing}`)
    aaMode = features.antiAliasing
  } finally {
    if (intermediate) pool.release(intermediate)
  }
  diagnostics?.setActivePasses(passes)
  diagnostics?.endFrame()
  lastFrameCpuMs = performance.now() - frameStart
  frameCounter += 1
}

async function build(): Promise<void> {
  guard = new Cinema2GlStateGuard(gl)
  allocateSceneTarget()
  const capabilities = detectCinema2RenderCapabilities(gl)
  const resolved = resolveCinema2RenderFeatures(tier, capabilities)
  const ids = ['rv-plain', 'rv-meshopt', 'rv-draco', 'rv-ktx2', 'rv-animated']
  const [plain, meshopt, draco, ktx2, animated] = await Promise.all(ids.map(id => cache.acquire(library, id, tier)))
  loadedAssets = Object.fromEntries(([['plain', plain], ['meshopt', meshopt], ['draco', draco], ['ktx2', ktx2], ['animated', animated]] as const).map(([key, loaded]) => [key, {
    triangles: loaded!.triangleCount,
    gpuBytes: loaded!.gpuBytes,
    clips: loaded!.animations.map(clip => clip.name),
    nodes: loaded!.metadata.nodeNames,
    customAttributes: [...new Set(loaded!.metadata.meshes.flatMap(mesh => mesh.customAttributes))],
    extensions: loaded!.metadata.extensionsUsed,
    skins: loaded!.metadata.skinCount,
  }]))
  validationScene = await buildValidationScene({
    THREE: library.THREE,
    tier,
    maxAnisotropy: Math.min(capabilities.maxAnisotropy, resolved.textureAnisotropy),
    models: { plain: plain!, meshopt: meshopt!, draco: draco!, ktx2: ktx2!, animated: animated! },
  })
  await prepareCinema2LightingRig(library, validationScene.rig)
  await validationScene.setTexturedModel(features.model)
  await loadEnvironment()
}

function attachContextHandlers(): void {
  validationCanvas.addEventListener('webglcontextlost', event => {
    event.preventDefault()
    lastLoss = { lost: true, restored: false }
    // The engine retires effect instances when the context goes (their GL objects are already invalid).
    aoEffect?.dispose()
    aaEffect?.dispose()
    aoEffect = null
    aaEffect = null
    sceneTarget = null
    framebuffer = null
    colorTexture = null
    depthTexture = null
    diagnostics?.handleContextLost()
  })
  validationCanvas.addEventListener('webglcontextrestored', () => { lastLoss = { lost: true, restored: true } })
}

async function recoverContext(): Promise<unknown> {
  const extension = gl.getExtension('WEBGL_lose_context')
  if (!extension) throw new Error('WEBGL_lose_context is unavailable.')
  const lost = new Promise<void>(resolve => validationCanvas.addEventListener('webglcontextlost', () => resolve(), { once: true }))
  const restored = new Promise<void>(resolve => validationCanvas.addEventListener('webglcontextrestored', () => resolve(), { once: true }))
  extension.loseContext()
  await lost
  // Chrome only honours restoreContext() once the lost event has finished dispatching, so let the event loop turn first.
  await new Promise(resolve => setTimeout(resolve, 50))
  const duringLoss = gl.isContextLost()
  extension.restoreContext()
  await restored
  diagnostics?.handleContextRestored()
  // Everything GPU-side is gone: rebuild exactly what the engine would (renderer from the host, targets, effects, environment, shadow maps).
  allocateSceneTarget()
  validationScene.keyLight.shadow.map = null
  validationScene.scene.environment = null
  await loadEnvironment()
  contextRecoveries += 1
  drawFrame(1)
  return { duringLoss, ...snapshot() }
}

function snapshot() {
  const capabilities = detectCinema2RenderCapabilities(gl)
  return {
    tier,
    size: { width, height },
    features: { ...features },
    frames: frameCounter,
    lastFrameCpuMs,
    glError: gl.getError(),
    contextLost: gl.isContextLost(),
    loss: lastLoss,
    recoveries: contextRecoveries,
    errors: [...errors],
    scene: validationScene?.stats(),
    assets: loadedAssets,
    pool: getCinema2RenderTargetPool(gl).getStats(),
    decoders: cinema2ThreeDecoderPool.getSnapshot(),
    diagnostics: diagnostics?.getSnapshot(),
    capabilities,
    resolved: resolveCinema2RenderFeatures(tier, capabilities, { antiAliasing: features.antiAliasing }),
    shadow: { enabled: features.shadows, mapSize: validationScene?.keyLight.shadow.mapSize.x },
    aaMode,
  }
}

function renderControls(): void {
  const panel = document.getElementById('rv-controls')!
  if (query.get('controls') !== '1') return
  panel.hidden = false
  panel.innerHTML = `<h1>Render validation (dev)</h1>
    <label>Ambient occlusion <input type="checkbox" data-key="ambientOcclusion"></label>
    <label>Occlusion only <input type="checkbox" data-key="occlusionOnly"></label>
    <label>Anti-aliasing <select data-key="antiAliasing"><option>off</option><option>fxaa</option><option>smaa</option><option>auto</option></select></label>
    <label>Shadows <input type="checkbox" data-key="shadows"></label>
    <label>Environment <select data-key="environment"><option>none</option><option>studio</option><option>exr</option></select></label>
    <label>Textured model <select data-key="model"><option>plain</option><option>meshopt</option><option>draco</option><option>ktx2</option></select></label>
    <div id="rv-stats"></div>`
  panel.addEventListener('change', event => {
    const element = event.target as HTMLInputElement | HTMLSelectElement
    const key = element.dataset.key as keyof ValidationFeatures | undefined
    if (!key) return
    void api.setFeatures({ [key]: element instanceof HTMLInputElement && element.type === 'checkbox' ? element.checked : element.value } as Partial<ValidationFeatures>)
  })
  for (const element of panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-key]')) {
    const value = features[element.dataset.key as keyof ValidationFeatures]
    if (element instanceof HTMLInputElement) element.checked = Boolean(value)
    else element.value = String(value)
  }
}

function startLoop(): void {
  if (query.get('animate') !== '1') return
  const tick = (now: number) => {
    drawFrame(now / 1000)
    const stats = document.getElementById('rv-stats')
    if (stats && diagnostics) {
      const s = diagnostics.getSnapshot()
      stats.textContent = `${s.frame.fps.toFixed(0)} fps  ${s.frame.averageMs.toFixed(1)} ms\ndraws ${s.draw.drawCalls}  tris ${s.draw.triangles}\ngpu ~${(s.resources.estimatedGpuBytes / 1048576).toFixed(0)} MB`
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const api: ValidationApi = {
  async prepare() {
    library = await loadCinema2ThreeLibrary()
    attachContextHandlers()
    if (query.get('diagnostics') !== '0') {
      diagnostics = new Cinema2RenderDiagnostics(gl, {
        readThreeInfo: () => {
          const info = getCinema2ThreeRenderer(library, gl).renderer.info
          return { geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0 }
        },
      }).attach()
    }
    await build()
    renderControls()
    drawFrame(1)
    startLoop()
    return snapshot()
  },
  async setFeatures(next) {
    const previousModel = features.model
    const previousEnvironment = features.environment
    Object.assign(features, next)
    if (features.model !== previousModel) await validationScene.setTexturedModel(features.model)
    if (features.environment !== previousEnvironment) await loadEnvironment()
    drawFrame(1)
    return snapshot()
  },
  async renderFrames(count, timeSec = 1) {
    for (let index = 0; index < count; index += 1) drawFrame(timeSec + index / 60)
    return snapshot()
  },
  async resize(nextWidth, nextHeight) {
    width = Math.max(64, Math.round(nextWidth))
    height = Math.max(64, Math.round(nextHeight))
    validationCanvas.width = width
    validationCanvas.height = height
    allocateSceneTarget()
    drawFrame(1)
    return snapshot()
  },
  recoverContext,
  lodLevelAt: distance => validationScene.lodLevelAt(distance),
  screenRect(name) {
    const object = validationScene.scene.getObjectByName(name)
    if (!object) return null
    const { THREE } = library
    const camera = validationScene.camera
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let corner = 0; corner < 8; corner += 1) {
      const point = new THREE.Vector3(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z).project(camera)
      const px = (point.x * 0.5 + 0.5) * width
      const py = (1 - (point.y * 0.5 + 0.5)) * height
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py)
    }
    const x = Math.max(0, Math.floor(minX)), y = Math.max(0, Math.floor(minY))
    return { x, y, width: Math.min(width, Math.ceil(maxX)) - x, height: Math.min(height, Math.ceil(maxY)) - y }
  },
  status: snapshot,
}
window.__cinema2RenderValidation = Object.freeze(api)
