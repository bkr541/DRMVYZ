import type { CanvasFitMode } from '../../ReactTypes'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { ShaderTexture } from '../../shaders/runtime/ShaderTexture'
import type { DirectWebGLSource, DirectWebGLTransform } from '../CanvasDirectWebGLLayer'
import { SINGULARITY_MODES, SINGULARITY_PALETTES, singularityBudget, type CanvasSingularitySettings } from './SingularitySettings'
import type { SingularityFrame } from './SingularityPerformance'
import * as S from './SingularityShaders'
const PALETTES = [[.12,.78,.88],[1,.24,.08],[.64,.26,1],[.7,.74,.84],[.36,1,.15],[1,.64,.12],[.12,.78,.88]] as const
type Target = { texture: WebGLTexture; fbo: WebGLFramebuffer; width: number; height: number }
export class SingularityRenderer {
  private programs: ShaderProgram[] = []
  private targets: Target[] = []
  private vao: WebGLVertexArrayObject | null = null
  private texture: ShaderTexture
  private source: DirectWebGLSource | null = null
  private stamp = ''
  private staging: HTMLCanvasElement | null = null
  private limit: number
  private sourceLimit: number
  private targetKey = ''
  private lastSettings: CanvasSingularitySettings | null = null
  private lastFrame = ''
  private constructor(private canvas: HTMLCanvasElement, private gl: WebGL2RenderingContext) {
    this.texture = new ShaderTexture(gl)
    this.sourceLimit = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE))
    this.limit = Math.min(this.sourceLimit, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS))
  }
  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: true })
    if (!gl) throw new Error('SINGULARITY requires WebGL2')
    const r = new SingularityRenderer(canvas, gl)
    try {
      const pairs = [[S.SINGULARITY_QUAD,S.SINGULARITY_ATMOSPHERE],[S.SINGULARITY_FRAGMENTS_VERTEX,S.SINGULARITY_FRAGMENTS_PIXEL],[S.SINGULARITY_QUAD,S.SINGULARITY_MEDIA],[S.SINGULARITY_PARTICLES_VERTEX,S.SINGULARITY_PARTICLES_PIXEL],[S.SINGULARITY_QUAD,S.SINGULARITY_BLUR],[S.SINGULARITY_QUAD,S.SINGULARITY_COMPOSITE]]
      for (const [vertSrc, fragSrc] of pairs) {
        const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label: `Singularity/${r.programs.length}`, vertSrc, fragSrc })
        if (!result.program) throw new Error(result.error.log)
        r.programs.push(result.program)
      }
      r.vao = gl.createVertexArray()
      if (!r.vao) throw new Error('SINGULARITY vertex allocation failed')
      return r
    } catch (error) { r.dispose(); throw error }
  }
  private releaseTargets() { for (const t of this.targets) { this.gl.deleteFramebuffer(t.fbo); this.gl.deleteTexture(t.texture) }; this.targets = []; this.targetKey = '' }
  private ensureTargets(w: number, h: number, divisor: number) {
    const key = `${w}:${h}:${divisor}`
    if (this.targetKey === key) return
    const gl = this.gl; this.releaseTargets()
    for (let i = 0; i < 3; i++) {
      const width = i === 0 ? w : Math.max(1, Math.ceil(w / divisor)), height = i === 0 ? h : Math.max(1, Math.ceil(h / divisor))
      const texture = gl.createTexture(), fbo = gl.createFramebuffer()
      if (!texture || !fbo) { gl.deleteTexture(texture); gl.deleteFramebuffer(fbo); throw new Error('SINGULARITY framebuffer allocation failed') }
      this.targets.push({ texture, fbo, width, height })
      gl.bindTexture(gl.TEXTURE_2D, texture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('SINGULARITY framebuffer incomplete')
    }
    this.targetKey = key
  }
  render({ source, settings: s, frame: f, fitMode, transform, viewport, dpr }: { source: DirectWebGLSource | null; settings: CanvasSingularitySettings; frame: SingularityFrame; fitMode: CanvasFitMode; transform: DirectWebGLTransform; viewport: { width: number; height: number }; dpr: number }) {
    const gl = this.gl
    if (!source || gl.isContextLost()) return false
    const video = 'videoWidth' in source
    if (video && (source.seeking || source.readyState < 2)) return false
    if ('naturalWidth' in source && !source.complete) return false
    const sw = video ? source.videoWidth : 'naturalWidth' in source ? source.naturalWidth : source.width
    const sh = video ? source.videoHeight : 'naturalHeight' in source ? source.naturalHeight : source.height
    if (!sw || !sh) return false
    const stamp = video ? `${sw}:${sh}:${source.currentTime}:${source.getVideoPlaybackQuality?.().totalVideoFrames ?? 0}` : 'naturalWidth' in source ? `${sw}:${sh}:${source.currentSrc}` : ''
    const fresh = source !== this.source || stamp !== this.stamp || stamp === ''
    if (fresh) {
      let pixels = source
      if (Math.max(sw, sh) > this.sourceLimit) {
        const c = this.staging ??= document.createElement('canvas'), ratio = this.sourceLimit / Math.max(sw,sh)
        const w = Math.max(1, Math.round(sw*ratio)), h = Math.max(1, Math.round(sh*ratio))
        if (c.width !== w) c.width = w; if (c.height !== h) c.height = h
        const ctx = c.getContext('2d'); if (!ctx) throw new Error('SINGULARITY source resize failed')
        ctx.clearRect(0,0,w,h); ctx.drawImage(source,0,0,w,h); pixels = c
      }
      gl.activeTexture(gl.TEXTURE0); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      if ('videoWidth' in pixels || 'naturalWidth' in pixels) this.texture.uploadImage(pixels)
      else { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true); this.texture.uploadCanvas(pixels); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false) }
      this.source = source; this.stamp = stamp
    }
    const budget = singularityBudget(s.quality, viewport.width, viewport.height)
    const ratio = Math.min(Math.max(1,dpr),budget.dpr,Math.min(this.limit,budget.edge)/Math.max(viewport.width,viewport.height))
    const w = Math.max(1,Math.round(viewport.width*ratio)), h = Math.max(1,Math.round(viewport.height*ratio))
    const key = JSON.stringify([w,h,viewport,transform,fitMode,f.motion,f.age,f.pattern,f.dissolve,f.glitch,f.hit,f.energy,f.accent])
    if (!fresh && !f.reset && this.lastSettings === s && key === this.lastFrame) return true
    this.lastSettings = s; this.lastFrame = key
    if (this.canvas.width !== w) this.canvas.width = w; if (this.canvas.height !== h) this.canvas.height = h
    this.ensureTargets(w,h,s.quality === 'high' ? 2 : 4)
    const [scene, bloomA, bloomB] = this.targets
    const [atmosphere, fragments, media, particles, blur, composite] = this.programs
    const fitRatio = fitMode === 'cover' ? Math.max(viewport.width/sw,viewport.height/sh) : Math.min(viewport.width/sw,viewport.height/sh)
    const fitW = fitMode === 'stretch' ? viewport.width : sw*fitRatio, fitH = fitMode === 'stretch' ? viewport.height : sh*fitRatio
    const tint = PALETTES[SINGULARITY_PALETTES.indexOf(s.palette)] ?? PALETTES[0]
    const common = (p: ShaderProgram) => {
      p.activate(); this.texture.bind(0); p.setSampler('source',0)
      p.setVec2('size',viewport.width,viewport.height); p.setVec2('fit',fitW,fitH)
      p.setVec2('position',viewport.width*transform.positionX/100,-viewport.height*transform.positionY/100)
      p.setFloat('scale',Math.max(.001,transform.scale*s.sourceScale)); p.setFloat('rotation',transform.rotation*Math.PI/180)
      p.setVec3('tint',tint[0],tint[1],tint[2]); p.setInt('mode',SINGULARITY_MODES.indexOf(s.mode)); p.setInt('pattern',f.pattern)
      p.setInt('ribbons',budget.ribbons); p.setInt('preserveColors',s.preserveColors || s.palette === 'source color' ? 1 : 0)
      for (const [name,value] of Object.entries({ seed:s.seed%100003,motion:f.motion,age:f.age,energy:f.energy,hit:f.hit,accent:f.accent,force:f.force,dissolve:f.dissolve,glitch:f.glitch,depth:s.depth,turbulence:s.turbulence,camera:s.camera,fragmentSize:s.fragmentSize,background:s.background,particleDensity:s.particleDensity })) p.setFloat(name,value)
    }
    gl.bindVertexArray(this.vao); gl.bindFramebuffer(gl.FRAMEBUFFER,scene.fbo); gl.viewport(0,0,w,h); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND)
    common(atmosphere); gl.drawArrays(gl.TRIANGLES,0,3)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA)
    const count = Math.round(budget.fragments*s.fragmentDensity)
    common(fragments); fragments.setInt('zone',0); gl.drawArraysInstanced(gl.TRIANGLES,0,3,Math.round(count*.4)); fragments.setInt('zone',1); gl.drawArraysInstanced(gl.TRIANGLES,0,3,Math.round(count*.45))
    common(media); gl.drawArrays(gl.TRIANGLES,0,3)
    if ((f.dissolve > .001 || s.mode === 'particle construct') && s.particleDensity > 0) {
      const total = Math.max(1,Math.floor(budget.particles*s.particleDensity)), cols = Math.min(total,Math.max(1,Math.floor(Math.sqrt(total*sw/sh)))), rows = Math.max(1,Math.floor(total/cols))
      common(particles); particles.setVec2('grid',cols,rows); particles.setFloat('pixelRatio',Math.max(.75,ratio)); if (s.trails > 0 && f.dissolve > .001) { particles.setFloat('trail', .75 + (1-s.trails)*.2); gl.drawArrays(gl.POINTS,0,cols*rows) }; particles.setFloat('trail',0); gl.drawArrays(gl.POINTS,0,cols*rows)
    }
    common(fragments); fragments.setInt('zone',2); gl.drawArraysInstanced(gl.TRIANGLES,0,3,Math.round(count*.15)); gl.disable(gl.BLEND)
    blur.activate(); blur.setSampler('imageTexture',0)
    const blurPass = (target: Target, input: Target, horizontal: boolean) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo); gl.viewport(0,0,target.width,target.height); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,input.texture)
      blur.setInt('threshold',horizontal?1:0); blur.setVec2('direction',horizontal?(.5+s.bloomRadius*2.5)/target.width:0,horizontal?0:(.5+s.bloomRadius*2.5)/target.height); gl.drawArrays(gl.TRIANGLES,0,3)
    }
    blurPass(bloomA,scene,true); blurPass(bloomB,bloomA,false)
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,w,h); composite.activate()
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,scene.texture); composite.setSampler('imageTexture',0)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,bloomB.texture); composite.setSampler('bloomTexture',1); composite.setFloat('glow',s.glow*(.85+f.hit*.65)); gl.drawArrays(gl.TRIANGLES,0,3)
    const error = gl.getError(); if (error !== gl.NO_ERROR) throw new Error(`SINGULARITY rendering failed (${error})`)
    return true
  }
  dispose() { const gl = this.gl; gl.useProgram(null); gl.bindVertexArray(null); this.programs.forEach(p=>p.dispose()); this.programs=[]; this.releaseTargets(); this.texture.dispose(); gl.deleteVertexArray(this.vao); this.vao=null; if(this.staging)this.staging.width=this.staging.height=0; this.source=null }
}
