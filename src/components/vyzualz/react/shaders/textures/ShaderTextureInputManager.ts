import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import type {
  ShaderTexSourceSelection,
  ShaderTextureMeta,
  TextureInputValidation,
} from './shaderTextureInputTypes'
import { FALLBACK_TEX_META } from './shaderTextureInputTypes'
import { ShaderTextureSourceResolver } from './ShaderTextureSourceResolver'
import { ShaderNoiseTextureFactory }   from './ShaderNoiseTextureFactory'
import { ShaderMaskTexture }           from './ShaderMaskTexture'

// ── ShaderTextureInputManager ─────────────────────────────────────────────────
//
// Orchestrates all texture inputs declared by the active ShaderDefinition.
//
// Source routing:
//   fft / waveform         → injected WebGLTexture refs from ShaderAudioBridge
//   noise-white/value/blue → ShaderNoiseTextureFactory (shared cache)
//   mask / solid-color     → ShaderMaskTexture (parameter-keyed cache)
//   previous-frame /
//     shader-output        → render graph provides these; manager skips them
//   image / video / canvas → ShaderTextureSourceResolver (per-input cache)
//
// Usage per frame:
//   1. manager.setAudioTextures(spectrum, waveform)   (when audio updates)
//   2. manager.updateDynamic()                        (video / canvas frames)
//   3. const texMap = manager.getTextureMap()
//   4. shaderRenderGraph.execute(dims, texMap, applyUniforms)

export class ShaderTextureInputManager {
  private readonly _resolver:     ShaderTextureSourceResolver
  private readonly _noiseFactory: ShaderNoiseTextureFactory

  private _def: ShaderDefinition | null = null
  private readonly _selections  = new Map<string, ShaderTexSourceSelection>()
  private readonly _maskCache   = new Map<string, WebGLTexture>()
  private readonly _solidCache  = new Map<string, WebGLTexture>()

  private _spectrumTex:  WebGLTexture | null = null
  private _waveformTex:  WebGLTexture | null = null

  constructor(private readonly _gl: WebGL2RenderingContext) {
    this._resolver     = new ShaderTextureSourceResolver(_gl)
    this._noiseFactory = new ShaderNoiseTextureFactory(_gl)
  }

  // ── Scene lifecycle ───────────────────────────────────────────────────────

  /**
   * Call when the active ShaderDefinition changes.
   * Releases resolver entries for inputs that are no longer declared.
   */
  setDefinition(def: ShaderDefinition | null): void {
    this._def = def
    const active = new Set((def?.textureInputs ?? []).map(ti => ti.name))
    this._resolver.releaseUnreferenced(active)
    for (const name of [...this._selections.keys()]) {
      if (!active.has(name)) this._selections.delete(name)
    }
  }

  // ── Per-input selection ───────────────────────────────────────────────────

  setSelection(inputName: string, sel: ShaderTexSourceSelection): void {
    this._selections.set(inputName, sel)
  }

  clearSelection(inputName: string): void {
    this._selections.delete(inputName)
    this._resolver.release(inputName)
  }

  // ── Audio texture injection ───────────────────────────────────────────────

  /**
   * Inject audio textures from ShaderAudioBridge (or null when unavailable).
   * These are references only — the audio bridge owns the GPU objects.
   */
  setAudioTextures(spectrum: WebGLTexture | null, waveform: WebGLTexture | null): void {
    this._spectrumTex = spectrum
    this._waveformTex = waveform
  }

  // ── Dynamic source updates ────────────────────────────────────────────────

  /** Call once per frame to push new video / canvas frames to the GPU. */
  updateDynamic(): void {
    for (const [name, sel] of this._selections) {
      const el = sel.mediaElement
      if (!el) continue
      if ('videoWidth' in el && 'readyState' in el) {
        this._resolver.updateVideoFrame(name, el as HTMLVideoElement)
      } else if ('getContext' in el) {
        this._resolver.updateCanvasFrame(name, el as HTMLCanvasElement)
      }
    }
  }

  // ── Texture map for render graph ──────────────────────────────────────────

  /**
   * Build the externalTextures map to pass to ShaderRenderGraph.execute().
   * Required inputs with no source get the opaque-black fallback.
   * Optional inputs with no source are omitted (render graph supplies them
   * via ping-pong or pass outputs, or the shader uses a default sample).
   */
  getTextureMap(): ReadonlyMap<string, WebGLTexture> {
    const map    = new Map<string, WebGLTexture>()
    const inputs = this._def?.textureInputs ?? []

    for (const input of inputs) {
      const sel = this._selections.get(input.name)

      if (!sel || sel.sourceType === 'unset') {
        if (input.required) map.set(input.name, this._resolver.fallback.texture)
        continue
      }

      const tex = this._resolveSelection(input.name, sel)
      if (tex !== null) map.set(input.name, tex)
    }

    return map
  }

  // ── Metadata for UI / uniforms ────────────────────────────────────────────

  getMetadata(inputName: string): ShaderTextureMeta | null {
    const sel = this._selections.get(inputName)
    if (!sel || sel.sourceType === 'unset') return null
    return this._resolveMetadata(inputName, sel)
  }

  // ── Validation ────────────────────────────────────────────────────────────

  validate(): TextureInputValidation[] {
    const inputs = this._def?.textureInputs ?? []
    return inputs.map(input => {
      const required = input.required ?? false
      const sel      = this._selections.get(input.name)
      const available = this._isAvailable(input.name, sel)
      const warningMessage = required && !available
        ? `Required input "${input.label}" has no available source.`
        : null
      return { inputName: input.name, required, available, warningMessage }
    })
  }

  dispose(): void {
    this._resolver.dispose()
    this._noiseFactory.disposeAll()
    for (const tex of this._maskCache.values())  this._gl.deleteTexture(tex)
    this._maskCache.clear()
    for (const tex of this._solidCache.values()) this._gl.deleteTexture(tex)
    this._solidCache.clear()
    this._selections.clear()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _resolveSelection(inputName: string, sel: ShaderTexSourceSelection): WebGLTexture | null {
    const type = sel.sourceType
    switch (type) {
      case 'fft':
        return this._spectrumTex ?? this._resolver.fallback.texture
      case 'waveform':
        return this._waveformTex ?? this._resolver.fallback.texture
      case 'noise':
      case 'noise-white':
        return this._noiseFactory.getWhiteNoise(sel.noiseSize ?? 128, sel.noiseSeed ?? 0)
      case 'noise-value':
        return this._noiseFactory.getValueNoise(sel.noiseSize ?? 256, sel.noiseSeed ?? 0)
      case 'noise-blue': {
        const blue = this._noiseFactory.getBlueNoise()
        return blue ?? this._noiseFactory.getValueNoise(sel.noiseSize ?? 256, sel.noiseSeed ?? 0)
      }
      case 'mask':
        return this._getMaskTex(sel)
      case 'solid-color':
        return this._getSolidTex(sel.color ?? [0, 0, 0, 255])
      case 'previous-frame':
      case 'shader-output':
        // Render graph provides these via its own texMap — don't inject here.
        return null
      default:
        return this._resolver.resolve(inputName, sel).texture
    }
  }

  private _resolveMetadata(inputName: string, sel: ShaderTexSourceSelection): ShaderTextureMeta {
    const type = sel.sourceType
    switch (type) {
      case 'fft':
        return { w: 512, h: 1, aspectRatio: 512, uvScaleX: 1, uvScaleY: 1, uvOffsetX: 0, uvOffsetY: 0, sourceType: 'fft', available: !!this._spectrumTex, dynamic: true }
      case 'waveform':
        return { w: 1024, h: 1, aspectRatio: 1024, uvScaleX: 1, uvScaleY: 1, uvOffsetX: 0, uvOffsetY: 0, sourceType: 'waveform', available: !!this._waveformTex, dynamic: true }
      case 'noise': case 'noise-white': {
        const sz = sel.noiseSize ?? 128
        return { w: sz, h: sz, aspectRatio: 1, uvScaleX: 1, uvScaleY: 1, uvOffsetX: 0, uvOffsetY: 0, sourceType: type, available: true, dynamic: false }
      }
      case 'noise-value': case 'noise-blue': {
        const sz = sel.noiseSize ?? 256
        return { w: sz, h: sz, aspectRatio: 1, uvScaleX: 1, uvScaleY: 1, uvOffsetX: 0, uvOffsetY: 0, sourceType: type, available: true, dynamic: false }
      }
      case 'mask': {
        const sz = sel.maskSize ?? 256
        return { w: sz, h: sz, aspectRatio: 1, uvScaleX: 1, uvScaleY: 1, uvOffsetX: 0, uvOffsetY: 0, sourceType: 'mask', available: true, dynamic: false }
      }
      case 'solid-color':
        return { w: 1, h: 1, aspectRatio: 1, uvScaleX: 1, uvScaleY: 1, uvOffsetX: 0, uvOffsetY: 0, sourceType: 'solid-color', available: true, dynamic: false }
      case 'previous-frame':
      case 'shader-output':
        return { ...FALLBACK_TEX_META, sourceType: type, available: true }
      default:
        return this._resolver.resolve(inputName, sel).meta
    }
  }

  private _isAvailable(inputName: string, sel: ShaderTexSourceSelection | undefined): boolean {
    if (!sel || sel.sourceType === 'unset') return false
    const type = sel.sourceType
    switch (type) {
      case 'fft':    return !!this._spectrumTex
      case 'waveform': return !!this._waveformTex
      case 'noise': case 'noise-white': case 'noise-value': case 'noise-blue':
      case 'mask': case 'solid-color': return true
      case 'previous-frame': case 'shader-output': return true
      default: {
        const el = sel.mediaElement
        if (!el) return false
        if ('naturalWidth' in el && 'complete' in el) {
          const img = el as HTMLImageElement
          return !!(img.complete && img.naturalWidth > 0)
        }
        if ('videoWidth' in el && 'readyState' in el) {
          const vid = el as HTMLVideoElement
          return (vid.readyState as number) >= 2 && vid.videoWidth > 0
        }
        if ('getContext' in el) {
          const cvs = el as HTMLCanvasElement
          return cvs.width > 0 && cvs.height > 0
        }
        return false
      }
    }
  }

  private _getMaskTex(sel: ShaderTexSourceSelection): WebGLTexture {
    const type   = sel.maskType   ?? 'radial'
    const size   = sel.maskSize   ?? 256
    const invert = sel.maskInvert ?? false
    const key    = `${type}-${size}-${invert ? '1' : '0'}`
    let tex = this._maskCache.get(key)
    if (!tex) {
      tex = ShaderMaskTexture.generate(this._gl, type, size, invert)
      this._maskCache.set(key, tex)
    }
    return tex
  }

  private _getSolidTex(color: readonly [number, number, number, number]): WebGLTexture {
    const key = color.join(',')
    let tex = this._solidCache.get(key)
    if (!tex) {
      tex = ShaderMaskTexture.createSolidColor(this._gl, color[0], color[1], color[2], color[3])
      this._solidCache.set(key, tex)
    }
    return tex
  }
}
