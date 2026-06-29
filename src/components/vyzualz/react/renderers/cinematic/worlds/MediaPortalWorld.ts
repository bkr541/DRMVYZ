import { resolveMediaPortalSettings } from '../../../CinematicWorldSettings'
import { FULLSCREEN_VERT_SRC } from '../../../shaders/runtime/FullscreenPass'
import type { ShaderProgram } from '../../../shaders/runtime/ShaderProgram'
import type { ShaderTexture } from '../../../shaders/runtime/ShaderTexture'
import { useMediaStore } from '../../../../../../stores/mediaStore'
import type {
  CinematicFrameContext, CinematicRendererResetReason, CinematicViewport,
  CinematicWebGLServices, CinematicWebGLWorldDefinition, CinematicWebGLWorldInitializeInput,
  CinematicWebGLWorldRenderer, CinematicWorldRenderTarget,
} from '../../CinematicWorldRenderer'
import { MediaPortalSourceManager } from '../MediaPortalSourceManager'
import { defineCinematicWorldDirection } from '../CinematicWorldDirection'

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D uMedia;
uniform sampler2D uMask;
uniform vec2 uResolution;
uniform vec2 uMediaSize;
uniform float uTime;
uniform float uBass;
uniform float uBeat;
uniform float uFit;
uniform float uZoom;
uniform vec2 uPan;
uniform float uRotation;
uniform vec2 uMirror;
uniform float uDisplacement;
uniform float uScanlines;
uniform float uChromatic;
uniform float uEdgeGlow;
uniform float uRipple;
uniform float uPixelation;
uniform float uFeedback;
uniform float uReveal;
uniform float uBeatFlash;
uniform float uBassWarp;
uniform float uShape;
uniform float uHasMask;
uniform float uMaskMode;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
float shapeMask(vec2 p) {
  if (uShape < .5) return step(max(abs(p.x), abs(p.y)), 1.0);
  if (uShape < 1.5) return step(length(p), 1.0);
  if (uShape < 2.5) { float arch=max(abs(p.x)-.72, p.y-.55); arch=max(arch,length(vec2(p.x,p.y-.48))-.74); return 1.-step(0.,arch); }
  if (uShape < 3.5) return step(max(abs(p.x)*.86+p.y*.5, -p.y), .92);
  if (uShape < 4.5) { float n=sin(p.x*13.+sin(p.y*17.))*0.11; return step(length(p)+n, .9); }
  float n=sin(p.x*8.+uTime)+sin(p.y*11.-uTime*.7); return step(length(p)+n*.055, .9);
}
void main() {
  vec2 uv=v_uv;
  vec2 p=(uv-.5)*2.; p.x*=uResolution.x/max(1.,uResolution.y);
  float a=uResolution.x/max(1.,uResolution.y), ma=uMediaSize.x/max(1.,uMediaSize.y);
  vec2 fit=vec2(1.);
  if (uFit < .5) { if(ma>a) fit.y=a/ma; else fit.x=ma/a; }
  else if (uFit < 1.5 || uFit > 2.5) { if(ma>a) fit.x=ma/a; else fit.y=a/ma; }
  vec2 q=(uv-.5-uPan)/max(.001,uZoom);
  float c=cos(uRotation), s=sin(uRotation); q=mat2(c,-s,s,c)*q;
  q=(q-.5)*fit+.5; q=mix(q,1.-q,uMirror);
  float ripple=sin(length(p)*24.-uTime*5.)*uRipple*.004;
  q += normalize(p+vec2(.001))*ripple*(1.+uBass*uBassWarp*4.);
  q += vec2(sin(q.y*25.+uTime),cos(q.x*21.-uTime*.8))*uDisplacement*.006*(1.+uBass*3.);
  if(uPixelation>0.001){float px=mix(900.,24.,uPixelation);q=floor(q*px)/px;}
  float ca=uChromatic*.008;
  vec3 col=vec3(texture(uMedia,q+vec2(ca,0)).r,texture(uMedia,q).g,texture(uMedia,q-vec2(ca,0)).b);
  float mask=shapeMask(p);
  if(uHasMask>.5){vec4 m=texture(uMask,v_uv);float mv=mix(m.a,dot(m.rgb,vec3(.299,.587,.114)),uMaskMode);mask*=smoothstep(.08,.92,mv);}
  mask*=smoothstep(1.-uReveal,1.-uReveal+.08,1.-length(p)*.72);
  float edge=clamp((shapeMask(p*.96)-shapeMask(p*1.04))*uEdgeGlow,0.,1.);
  col += mix(uPrimary,uSecondary,.5+.5*sin(uTime))*edge;
  col *= 1.-uScanlines*(.5+.5*sin(gl_FragCoord.y*3.14159));
  col += uBeat*uBeatFlash;
  vec3 bg=mix(vec3(.005,.008,.015),uSecondary*.08,.5+.5*sin(length(p)*5.-uTime));
  outColor=vec4(mix(bg,col,mask),1.);
}`

function shapeIndex(shape: string): number {
  return Math.max(0, ['rectangle','circle','arch','triangle','fracture','organic','customMask'].indexOf(shape))
}

class MediaPortalWorld implements CinematicWebGLWorldRenderer {
  private services: CinematicWebGLServices | null = null
  private program: ShaderProgram | null = null
  private mediaTexture: ShaderTexture | null = null
  private maskTexture: ShaderTexture | null = null
  private mediaManager = new MediaPortalSourceManager()
  private maskManager = new MediaPortalSourceManager()
  private mediaElement: HTMLImageElement | HTMLVideoElement | null = null
  private maskElement: HTMLImageElement | HTMLVideoElement | null = null
  private sourceId: string | null | undefined
  private maskId: string | null | undefined
  private viewport: CinematicViewport = { width: 1, height: 1, dpr: 1 }
  private mediaUploaded = false
  private maskUploaded = false
  private mediaDiagnostic: string | null = null
  private maskDiagnostic: string | null = null

  initialize(input: CinematicWebGLWorldInitializeInput): void {
    this.services = input.services
    this.program = input.services.compileProgram({ vertSrc: FULLSCREEN_VERT_SRC, fragSrc: FRAGMENT, label: 'cinematic/world/mediaPortal' })
    this.mediaTexture = input.services.createTexture({ filter: 'linear', wrap: 'clamp' })
    this.maskTexture = input.services.createTexture({ filter: 'linear', wrap: 'clamp' })
    this.uploadFallback(this.mediaTexture)
    this.uploadFallback(this.maskTexture)
  }
  resize(viewport: CinematicViewport): void { this.viewport = viewport }
  render(frame: CinematicFrameContext, target: CinematicWorldRenderTarget): void {
    if (!this.services || !this.program || !this.mediaTexture || !this.maskTexture) return
    const settings = resolveMediaPortalSettings(frame.config.worldSettings)
    if (settings.sourceMediaId !== this.sourceId) {
      this.sourceId = settings.sourceMediaId
      void this.loadSource(settings.sourceMediaId, settings.loop, settings.muted, false)
    }
    const customMaskRequested = frame.config.portalShape === 'customMask'
    const nextMask = customMaskRequested ? frame.config.customMaskId : null
    if (nextMask !== this.maskId) {
      this.maskId = nextMask
      void this.loadSource(nextMask, true, true, true)
    }
    if (customMaskRequested && !nextMask) this.maskDiagnostic = 'Custom mask is missing. Choose a durable image asset.'
    else if (!customMaskRequested) this.maskDiagnostic = null

    const mediaVideo = typeof HTMLVideoElement !== 'undefined' && this.mediaElement instanceof HTMLVideoElement
      ? this.mediaElement
      : null
    if (mediaVideo) {
      mediaVideo.loop = settings.loop
      mediaVideo.muted = settings.muted
      if (frame.isPlaying && mediaVideo.paused) void mediaVideo.play().catch(() => undefined)
      if (!frame.isPlaying && !mediaVideo.paused) mediaVideo.pause()
    }
    if (this.mediaElement && (!mediaVideo || mediaVideo.readyState >= 2) && (!this.mediaUploaded || mediaVideo)) {
      this.mediaTexture.uploadImage(this.mediaElement)
      this.mediaUploaded = true
    }
    const maskVideo = typeof HTMLVideoElement !== 'undefined' && this.maskElement instanceof HTMLVideoElement
      ? this.maskElement
      : null
    if (this.maskElement && (!maskVideo || maskVideo.readyState >= 2) && (!this.maskUploaded || maskVideo)) {
      this.maskTexture.uploadImage(this.maskElement)
      this.maskUploaded = true
    }
    const mediaWidth = mediaVideo
      ? mediaVideo.videoWidth || 1
      : (this.mediaElement as HTMLImageElement | null)?.naturalWidth || 1
    const mediaHeight = mediaVideo
      ? mediaVideo.videoHeight || 1
      : (this.mediaElement as HTMLImageElement | null)?.naturalHeight || 1
    const p=this.program; p.activate(); p.setVec2('uResolution',target.width,target.height); p.setVec2('uMediaSize',mediaWidth,mediaHeight);
    p.setFloat('uTime',frame.elapsedTimeSec); p.setFloat('uBass',frame.audio.smoothed.bass); p.setFloat('uBeat',frame.beat.hit?1:0)
    p.setFloat('uFit',['contain','cover','stretch','centerCrop'].indexOf(settings.fit)); p.setFloat('uZoom',settings.zoom); p.setVec2('uPan',settings.panX,settings.panY)
    p.setFloat('uRotation',settings.rotation); p.setVec2('uMirror',settings.mirrorX?1:0,settings.mirrorY?1:0)
    p.setFloat('uDisplacement',settings.displacement); p.setFloat('uScanlines',settings.scanlines); p.setFloat('uChromatic',frame.config.material.chromaticAberration)
    p.setFloat('uEdgeGlow',settings.edgeGlow); p.setFloat('uRipple',settings.ripple); p.setFloat('uPixelation',settings.pixelation); p.setFloat('uFeedback',frame.config.material.feedback)
    p.setFloat('uReveal',settings.revealAmount); p.setFloat('uBeatFlash',settings.beatFlash); p.setFloat('uBassWarp',settings.bassWarping)
    p.setFloat('uShape',shapeIndex(frame.config.portalShape)); p.setFloat('uHasMask',this.maskElement?1:0); p.setFloat('uMaskMode',settings.maskMode==='luminance'?1:0)
    p.setVec3('uPrimary',0.05,0.85,0.95); p.setVec3('uSecondary',0.42,0.16,0.96)
    this.services.fullscreenPass.run(p,target.framebuffer,target.width,target.height,[
      { uniformName:'uMedia',unit:0,texture:this.mediaTexture.handle! }, { uniformName:'uMask',unit:1,texture:this.maskTexture.handle! },
    ],{clear:true})
  }
  reset(_reason: CinematicRendererResetReason): void { /* Keep loaded media stable across seeks and timing resets. */ }
  getDiagnostic(): string | null { return [this.mediaDiagnostic, this.maskDiagnostic].filter(Boolean).join(' ') || null }
  onContextLost(): void { this.program=null }
  dispose(): void { this.mediaManager.dispose(); this.maskManager.dispose(); this.mediaElement=null; this.maskElement=null; this.program=null; this.services=null; this.mediaDiagnostic=null; this.maskDiagnostic=null }

  private async loadSource(id: string | null, loop: boolean, muted: boolean, mask: boolean): Promise<void> {
    const item = id ? useMediaStore.getState().items.find(candidate => candidate.id === id || candidate.dbId === id || candidate.storagePath === id) ?? null : null
    const manager = mask ? this.maskManager : this.mediaManager
    if (mask) { this.maskElement = null; this.maskUploaded = false; this.maskDiagnostic = null }
    else { this.mediaElement = null; this.mediaUploaded = false; this.mediaDiagnostic = null }
    const result = await manager.load(item,{loop,muted})
    if ((mask ? this.maskId : this.sourceId) !== id) return
    if (mask) {
      this.maskElement = result.status==='ready' ? result.element : null
      this.maskUploaded = false
      this.maskDiagnostic = result.message
    } else {
      this.mediaElement = result.status==='ready' ? result.element : null
      this.mediaUploaded = false
      this.mediaDiagnostic = result.message
    }
    if (result.message && result.status !== 'missing' && import.meta.env.DEV) console.warn(`[MediaPortal] ${result.message}`)
  }
  private uploadFallback(texture: ShaderTexture): void {
    texture.uploadBytes(2, 2, new Uint8Array([
      7,17,26,255, 19,217,232,255,
      19,217,232,255, 7,17,26,255,
    ]))
  }
}

const mediaPortalDirection = defineCinematicWorldDirection({
  supportedCameraRigs: ['locked','dolly','orbit','autoDirector'],
  safeCameraRange: { minDistance: 0.9, maxDistance: 4.2, maxLateral: 1.1 },
  shots: [
    { id:'media-establish', rig:'locked', sections:['intro','verse','breakdown','outro','unknown'], action:'establish' },
    { id:'media-reveal', rig:'dolly', sections:['build','preDrop'], action:'reveal' },
    { id:'media-impact', rig:'orbit', sections:['drop'], action:'impact' },
  ],
  dropActions:['impact','reveal'], revealActions:['reveal','open'], retreatActions:['retreat','close'],
})

export const mediaPortalWorldDefinition: CinematicWebGLWorldDefinition = {
  id:'mediaPortal', label:'Media Portal', backend:'webgl2', direction: mediaPortalDirection, capabilities:{ backend:'webgl2', cameraRigs:['locked','dolly','orbit','autoDirector'],
    modulationTargets:['portalAperture','distortion','refraction','bloom','chromaticAberration','feedback','impact'], supportsGeometryPasses:false,
    supportsFullscreenPasses:true,supportsTextureInputs:true,supportsPostProcessing:true,supportsFeedback:true }, create:()=>new MediaPortalWorld(),
}
