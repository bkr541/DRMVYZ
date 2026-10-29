import { createSwitchItFlecks } from './Cinema2SwitchItFlecks'
import { buildSwitchItMaskShadow } from './Cinema2SwitchItMaskShadow'
import { SWITCH_IT_MOTION_GLSL } from './Cinema2SwitchItShaders'
import { SWITCH_IT_VISUAL_DEFAULTS, type SwitchItPose, type SwitchItVisualControls } from './Cinema2SwitchItMotion'
import type * as Three from 'three'
import { buildSwitchItMaskGeometry, SWITCH_IT_MASK_REGISTRATION } from './Cinema2SwitchItMask'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { getCinema2ThreeRenderer } from '../three/Cinema2ThreeRendererHost'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'
import { applyCinema2CameraFrame } from '../three/Cinema2ThreeCameraLightMapping'
import { buildSwitchItHuman, buildSwitchItEyes, decorateSwitchItGeometry, type SwitchItStaticState } from './Cinema2SwitchItGeometry'

const VERTEX=`
${SWITCH_IT_MOTION_GLSL}
attribute vec3 aCenter;
attribute float aSeed;
uniform float uState;
uniform float uPart;
varying vec3 vPosition;
varying vec3 vNormal;
varying float vSeed;
void main(){
 vec3 p=position;
 if(uPart>.5 && uPart<1.5 && uState>2.5 && aCenter.y>.45){
  float strength=smoothstep(.45,1.2,aCenter.y);
  p+=vec3((aSeed-.5)*.28,strength*(.03+aSeed*.22),aSeed*.06);
 }
 if(uAnimated>.5 && uPart<1.5)p+=normal*uRelief*(.25+.75*aSeed);
 if(uAnimated>.5 && uPart>.5 && uPart<1.5){
  float selected=fract(aSeed*17.123)<uFragmentAmount?1.0:0.0;
  float lift=clamp(uPeel*uWeights.z+uCrown*(uWeights.w+uWeights.x)*smoothstep(-.3,1.2,aCenter.y)+(uAudioLift+uAudioCrest*smoothstep(.15,1.1,aCenter.y))*switchEyeClearance(aCenter.xy),0.0,1.0)*selected;
  p+=vec3(aCenter.x*(.2+aSeed),(.08+aSeed*.3)*smoothstep(-.7,1.1,aCenter.y),.15+aSeed*.4)*uReach*lift*smoothstep(-.98,-.84,aCenter.y);
 }
 vPosition=uPart<.5?p:position;vNormal=normal;vSeed=aSeed;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`
const FRAGMENT=`
precision highp float;
${SWITCH_IT_MOTION_GLSL}
uniform float uState;
uniform float uPart;
varying vec3 vPosition;
varying vec3 vNormal;
varying float vSeed;
uniform sampler2D uMaskShadow;
uniform vec4 uShadowBounds;
uniform float uShadowPresence;
void main(){
 vec3 p=vPosition;
 bool shell=uPart<1.5;
 bool fragment=uPart>.5&&uPart<1.5;
 if(fragment){
   if(uAnimated<.5){if(uState<2.5||p.y<-.94||vSeed>.36)discard;}
   else if(uFragmentAmount<=0.0||fract(vSeed*17.123)>=uFragmentAmount||uReach<=0.0||p.y<-.94||(uPeel*uWeights.z+uCrown*(uWeights.w+uWeights.x)+uAudioLift+uAudioCrest)<.001||(switchHumanField(p,vSeed)>0.0&&uAudioLift+uAudioCrest<.001)||((uPeel*uWeights.z+uCrown*(uWeights.w+uWeights.x))<.001&&switchEyeClearance(p.xy)<.99))discard;
 }
 if(uPart>3.5 && uEyes<=0.0)discard;
 vec3 n=normalize(vNormal);
 float rim=pow(1.0-abs(n.z),1.8);
 vec3 color;
 if(shell){
  float facets=.035+.065*vSeed;
  float light=pow(max(dot(n,normalize(vec3(-.9,.6,.15))),0.0),2.0)*.38+rim*.7;
  color=(uAnimated>.5?uShell:vec3(.012,.023,.045))*facets*10.0+(uAnimated>.5?uRim:vec3(.66,.79,.9))*light;
  if(uPart>.5 && uState>2.5 && p.y>.55)color=mix(color,vec3(.8,.06,.16),vSeed*.8);
 } else if(uPart<5.5) { color=vec3(.85,.98,1.0); }
 else { color=vec3(.003,.002,.012); }

 if(uAnimated>.5){
   if(uPart>3.5&&uPart<5.5)color=uEnergy*uEyes;

   if(shell&&p.y>-.94)color=mix(color,uEnergy,uFlare*smoothstep(-.94,-.3,p.y));
   color*=uMaster;
 }
 if(uPart<.5){
   vec2 projected=p.xy-vec2(.035,-.045);
   vec2 shadowUv=(projected-uShadowBounds.xy)*uShadowBounds.zw;
   float visible=1.0;
   if(uAnimated>.5)visible=smoothstep(-.04,.04,switchMaskField(vec3(projected,0.0)));
   else if(uState>1.5&&uState<2.5)visible=smoothstep(-.04,.04,projected.x);
   float contact=texture2D(uMaskShadow,shadowUv).a*visible*uShadowPresence;
   color*=1.0-.18*contact;
 }
 gl_FragColor=vec4(color,1.0);
}`

/** Native supplied-mask portrait. Motion is supplied as resolved presentation poses; no local musical detector. */
export class Cinema2SwitchItRenderer {
  private readonly renderer: Three.WebGLRenderer
  private readonly scene: Three.Scene
  private readonly camera: Three.PerspectiveCamera
  private readonly target: Three.WebGLRenderTarget
  private readonly guard: Cinema2GlStateGuard
  private readonly materials: Three.Material[]=[]
  private readonly geometries: Three.BufferGeometry[]=[]
  private readonly uniforms: Array<{uState:{value:number};uPart:{value:number}}>=[]
  private readonly root: Three.Group
  private readonly motionUniforms
  private readonly fragments: Three.Mesh
  private readonly flecks: Three.Points
  private readonly maskMaterials: Three.MeshStandardMaterial[]=[]
  private readonly columnUniforms
  private readonly skull: Three.Group
  private readonly column: Three.Mesh
  private readonly maskState={value:0}
  private readonly textures: Three.Texture[]=[]
  private disposed=false
  constructor(gl: WebGL2RenderingContext,library: Cinema2ThreeLibrary,maskSource: Three.Object3D){
    const {THREE}=library
    this.renderer=getCinema2ThreeRenderer(library,gl).renderer
    this.guard=new Cinema2GlStateGuard(gl);this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera()
    this.target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});(this.target as unknown as {isXRRenderTarget:boolean}).isXRRenderTarget=true
    this.target.texture.colorSpace=THREE.SRGBColorSpace
    this.root=new THREE.Group();this.scene.add(this.root)
    const d=SWITCH_IT_VISUAL_DEFAULTS
    this.motionUniforms={uFlecks:{value:0},uParticlePhase:{value:0},uGesture:{value:0},uAudioLift:{value:0},uAudioCrest:{value:0},uAudioGlint:{value:0},uAnimated:{value:0},uWeights:{value:new THREE.Vector4(1,0,0,0)},uReveal:{value:0},uPeel:{value:0},uCrown:{value:0},uMaster:{value:1},uRelief:{value:0},uReach:{value:d.reach},uFragmentAmount:{value:1},uEyes:{value:1},uMaskShadow:{value:null as Three.Texture|null},uShadowBounds:{value:new THREE.Vector4()},uShadowPresence:{value:0},uFlare:{value:0},uShell:{value:new THREE.Vector3(...d.shell)},uRim:{value:new THREE.Vector3(...d.rim)},uEnergy:{value:new THREE.Vector3(...d.energy)},uSkull:{value:new THREE.Vector3(...d.skull)}}
    this.columnUniforms={uColumn:{value:new THREE.Vector3(...d.column)},uColumnLevel:{value:1}}
    const mesh=(geometry: Three.BufferGeometry,part:number,parent:Three.Object3D=this.root)=>{
      const g=decorateSwitchItGeometry(THREE,geometry);if(g!==geometry)geometry.dispose()
      this.geometries.push(g)
      const uniforms={...this.motionUniforms,uState:{value:0},uPart:{value:part}};this.uniforms.push(uniforms)
      const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms,side:THREE.DoubleSide})
      this.materials.push(material);const value=new THREE.Mesh(g,material);parent.add(value);return value
    }
    const human=buildSwitchItHuman(THREE)
    mesh(human,0)
    const fragments=mesh(human.clone(),1);this.fragments=fragments;fragments.renderOrder=1
    const order=Array.from({length:human.getAttribute('position').count/3},(_,i)=>i).sort((a,b)=>human.getAttribute('aSeed').getX(a*3)-human.getAttribute('aSeed').getX(b*3))
    fragments.geometry.setIndex(order.flatMap(i=>[i*3,i*3+1,i*3+2]))
    const flecks=createSwitchItFlecks(THREE,human,this.motionUniforms);this.flecks=flecks.mesh;this.root.add(flecks.mesh);this.geometries.push(flecks.geometry);this.materials.push(flecks.material)
    fragments.material.polygonOffset=true;fragments.material.polygonOffsetFactor=-1;fragments.material.polygonOffsetUnits=-1
    for(const eye of buildSwitchItEyes(THREE))mesh(eye,4)
    this.skull=new THREE.Group();this.root.add(this.skull);this.skull.position.z=SWITCH_IT_MASK_REGISTRATION.depthOffset
    for(const part of buildSwitchItMaskGeometry(THREE,maskSource)){
      this.geometries.push(part.geometry)
      const material=part.material.clone()
      // Each renderer owns its texture objects; source images are retained only by the module.
      const clonedTextures=new Map<Three.Texture,Three.Texture>()
      const owned=material as unknown as Record<string,unknown>
      for(const [key,value] of Object.entries(material))if((value as Three.Texture|null)?.isTexture){
        const texture=value as Three.Texture
        let clone=clonedTextures.get(texture)
        if(!clone){clone=texture.clone();clone.needsUpdate=true;clonedTextures.set(texture,clone);this.textures.push(clone)}
        owned[key]=clone
      }
      material.transparent=true;material.opacity=1;material.depthWrite=false;material.depthTest=false;material.side=THREE.FrontSide
      material.color.setRGB(.95,.12,.19);material.emissive.setRGB(.015,.001,.003)
      material.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,this.motionUniforms)
        shader.uniforms.uSwitchState=this.maskState
        shader.vertexShader='varying vec3 vSwitchPosition;\n'+shader.vertexShader
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSwitchPosition=position;')
        shader.fragmentShader=SWITCH_IT_MOTION_GLSL+'\nuniform float uSwitchState; varying vec3 vSwitchPosition;\n'+shader.fragmentShader
        shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
          float revealCoverage=1.0;
          if(uAnimated>.5)revealCoverage=smoothstep(-.025,.025,switchMaskField(vSwitchPosition));
          else if(uSwitchState>1.5&&uSwitchState<2.5)revealCoverage=smoothstep(-.025,.025,vSwitchPosition.x);
          if(revealCoverage<.001)discard;
          diffuseColor.a*=revealCoverage;`)
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
          outgoingLight+=(uAnimated>.5?uSkull*.32*(1.0+uAudioGlint):vec3(.3,.035,.06))*pow(1.0-abs(normal.z),3.0);

          if(uAnimated>.5){outgoingLight=mix(outgoingLight,uEnergy,uFlare);outgoingLight*=uMaster;}
          #include <opaque_fragment>`)
      }
      material.customProgramCacheKey=()=> 'switch-it-solid-overlay-v4'
      this.maskMaterials.push(material);this.materials.push(material);const mask=new THREE.Mesh(part.geometry,material);mask.renderOrder=10;this.skull.add(mask)
    }
    this.scene.add(new THREE.AmbientLight(0xffffff,.8))
    for(const [x,y,z,intensity] of [[-3,4,5,3.5],[3,1,4,2]]){
      const light=new THREE.DirectionalLight(0xffffff,intensity);light.position.set(x,y,z);this.scene.add(light)
    }
    const shadow=buildSwitchItMaskShadow(THREE,this.skull.children.map(object=>(object as Three.Mesh).geometry))
    this.textures.push(shadow.texture);this.motionUniforms.uMaskShadow.value=shadow.texture;this.motionUniforms.uShadowBounds.value.copy(shadow.bounds)
    const columnGeometry=new THREE.PlaneGeometry(1.45,5);columnGeometry.translate(0,0,-.92);this.geometries.push(columnGeometry)
    const columnMaterial=new THREE.ShaderMaterial({uniforms:this.columnUniforms,transparent:true,depthWrite:false,vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 uColumn;uniform float uColumnLevel;varying vec2 vUv;void main(){float a=pow(max(0.0,1.0-abs(vUv.x-.5)*2.0),.5);gl_FragColor=vec4(uColumn,a*.5*uColumnLevel);}'})
    this.materials.push(columnMaterial);this.column=new THREE.Mesh(columnGeometry,columnMaterial);this.column.renderOrder=-1;this.root.add(this.column)
  }
  draw(exec: Cinema2ModuleRenderExecutionContext,state: SwitchItStaticState|SwitchItPose,controls:SwitchItVisualControls=SWITCH_IT_VISUAL_DEFAULTS):void{
    if(this.disposed)return
    if(!exec.camera||!exec.depthAvailable)throw new Error('Switch It static preview requires shared camera and depth.')
    const animated=typeof state!=='string'
    const mode=typeof state==='string'?['human','skull','hybrid','crown'].indexOf(state):0
    const u=this.motionUniforms
    u.uAnimated.value=animated?1:0
    for(const uniforms of this.uniforms)uniforms.uState.value=mode
    this.maskState.value=mode
    this.skull.visible=animated||mode!==0;this.column.visible=animated||mode!==0
    if(animated){
      const pose=state as SwitchItPose
      const tier=exec.lightingEnvironment?.quality??'high',fraction=tier==='low'?.4:tier==='medium'?.7:1
      this.fragments.geometry.setDrawRange(0,Math.floor(this.fragments.geometry.getAttribute('position').count/3*fraction)*3)
      this.flecks.geometry.setDrawRange(0,tier==='low'?40:tier==='medium'?96:160)
      const gesture=Math.min(1,pose.peel+pose.crown+controls.audioLift+controls.audioCrest)
      this.flecks.visible=controls.flecks>0&&controls.fragmentAmount>0&&controls.reach>0&&controls.master>0&&gesture>0
      u.uFlecks.value=controls.flecks*controls.fragmentAmount;u.uGesture.value=gesture;u.uParticlePhase.value=controls.particlePhase
      u.uWeights.value.fromArray(pose.weights);u.uReveal.value=pose.reveal;u.uPeel.value=pose.peel;u.uCrown.value=pose.crown
      u.uAudioLift.value=controls.audioLift;u.uAudioCrest.value=controls.audioCrest;u.uAudioGlint.value=controls.audioGlint;
      u.uMaster.value=controls.master;u.uRelief.value=controls.relief;u.uReach.value=controls.reach;u.uFragmentAmount.value=controls.fragmentAmount
      u.uEyes.value=controls.eyesEnabled?controls.eyeIntensity:0;u.uShadowPresence.value=.45
      u.uFlare.value=controls.flareEnabled?controls.flareStrength*Math.max(pose.flare,controls.audioFlare):0
      for(const [uniform,value] of [[u.uShell,controls.shell],[u.uRim,controls.rim],[u.uEnergy,controls.energy],[u.uSkull,controls.skull]] as const)uniform.value.fromArray(value)
      for(const material of this.maskMaterials){material.color.setRGB(...controls.skull);material.emissive.setRGB(controls.skull[0]*.015,controls.skull[1]*.015,controls.skull[2]*.015)}
      this.columnUniforms.uColumn.value.fromArray(controls.column)
      this.columnUniforms.uColumnLevel.value=controls.columnIntensity*controls.master*pose.column*Math.min(1,2*Math.max(pose.reveal,pose.peel,pose.crown))
      const fit=Math.min(1,exec.width/exec.height)*controls.portraitScale
      this.root.scale.setScalar(fit);this.root.position.y=.22*(1-fit)
    }else{this.flecks.visible=false;u.uEyes.value=1;u.uShadowPresence.value=mode===0?0:.45;this.root.scale.setScalar(1);this.root.position.y=0;this.columnUniforms.uColumnLevel.value=1}
    this.guard.capture()
    try{
      this.renderer.resetState();this.renderer.shadowMap.enabled=false
      applyCinema2CameraFrame(this.camera,exec.camera)
      ;(this.renderer as unknown as {setRenderTargetFramebuffer(target:Three.WebGLRenderTarget,framebuffer:WebGLFramebuffer):void}).setRenderTargetFramebuffer(this.target,exec.target!)
      this.target.viewport.set(0,0,exec.width,exec.height);this.target.scissor.set(0,0,exec.width,exec.height)
      this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.camera);this.renderer.setRenderTarget(null)
    }finally{this.renderer.resetState();this.guard.restore()}
  }
  estimateGpuBytes():number{return this.geometries.reduce((sum,g)=>sum+(g.index?.array.byteLength??0)+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0),0)+this.textures.reduce((sum,texture)=>{const image=texture.image as {width?:number;height?:number}|undefined;return sum+(image?.width??0)*(image?.height??0)*4*4/3},0)}
  dispose():void{if(this.disposed)return;this.disposed=true;for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose();for(const texture of this.textures)texture.dispose();this.scene.clear();this.target.dispose()}
}
