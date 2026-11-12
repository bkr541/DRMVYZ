import type * as Three from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2SayItBridge, type Cinema2SayItDrawState } from '../sayIt/Cinema2SayItBridge'
import type { Cinema2SayItQualityProfile } from '../sayIt/Cinema2SayItQuality'
import type { Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { applySubmergeWeathering } from './Cinema2SubmergeWeathering'
import { resolveSubmergeGlyphPoses, submergeMotionAmount, submergePatternFromController, type Cinema2SubmergeState } from './Cinema2SubmergeMotion'

/** Extends the shared glyph renderer; all GPU work remains inside its host/GL-state guard. */
export class Cinema2SubmergeBridge extends Cinema2SayItBridge {
  private readonly architecture: Three.Group
  private readonly shafts: Three.Mesh[] = []
  private readonly surface: Three.Mesh
  private readonly sunlights: Three.SpotLight[] = []
  private readonly ocean = { time: { value: 0 }, swell: { value: 0.7 }, light: { value: 1 }, sun: { value: null as unknown as Three.Color }, foam: { value: null as unknown as Three.Color } }
  private readonly ownedGeometries = new Set<Three.BufferGeometry>()
  private readonly ownedMaterials = new Set<Three.Material>()
  private readonly bubbles: Three.InstancedMesh
  private readonly particles: Three.Points<Three.BufferGeometry, Three.PointsMaterial>
  private readonly particlePositions = new Float32Array(384 * 3)
  private readonly dummy: Three.Object3D
  private readonly fog: Three.FogExp2
  private readonly stone: Three.MeshStandardMaterial
  private readonly causticUniforms = { time: { value: 0 }, strength: { value: 0.75 }, tint: { value: null as unknown as Three.Color } }
  private readonly seeds = Float32Array.from({ length: 384 * 3 }, (_, index) => {
    const value = Math.sin((index + 1) * 127.1) * 43758.5453
    return value - Math.floor(value)
  })
  private readonly weatheredMaterials = new WeakSet<Three.Material>()
  private readonly corrosion = { value: 1 }
  private released = false

  constructor(gl: WebGL2RenderingContext, library: Cinema2ThreeLibrary, asset: Readonly<Cinema2ThreeLoadedAsset>, private readonly getState: () => Readonly<Cinema2SubmergeState>) {
    super(gl, library, asset)
    const { THREE } = library
    this.dummy = new THREE.Object3D()
    this.fog = new THREE.FogExp2(0x07303d, 0.055)
    this.scene.fog = this.fog
    this.scene.background = new THREE.Color(0x07303d)
    this.causticUniforms.tint.value = new THREE.Color(0x70d8e5)
    this.architecture = new THREE.Group()
    this.scene.add(this.architecture)
    this.ocean.sun.value = new THREE.Color(0x91d9e5)
    this.ocean.foam.value = new THREE.Color(0xb9d5d8)
    this.stone = this.material(new THREE.MeshStandardMaterial({ color: 0x101d22, roughness: 0.96, metalness: 0 }))
    this.stone.onBeforeCompile = shader => {
      shader.uniforms.uWaterTime = this.causticUniforms.time
      shader.uniforms.uWaterStrength = this.causticUniforms.strength
      shader.uniforms.uWaterTint = this.causticUniforms.tint
      shader.vertexShader = `varying vec3 vWaterPosition;\n${shader.vertexShader}`
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWaterPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = `varying vec3 vWaterPosition; uniform float uWaterTime; uniform float uWaterStrength; uniform vec3 uWaterTint;\n${shader.fragmentShader}`
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec2 uv = vWaterPosition.xz;
          float caustic = pow(max(0.0, 1.0-abs(sin(uv.x*1.7+sin(uv.y*0.8+uWaterTime)+sin(uv.y*1.63-uv.x*.6)*1.2) + sin(uv.y*2.3-uWaterTime*0.7))), 9.0);
          float pool = exp(-pow((uv.x+uv.y*0.22-1.0)*0.35,2.0));
          totalEmissiveRadiance += uWaterTint * caustic * pool * uWaterStrength * 0.15;`)
    }
    this.stone.customProgramCacheKey = () => 'submerge-seabed-v3'
    const bed = this.geometry(new THREE.PlaneGeometry(55, 65, 64, 64))
    bed.rotateX(-Math.PI / 2)
    const positions = bed.getAttribute('position')
    for (let i=0;i<positions.count;i++) {
      const x=positions.getX(i),z=positions.getZ(i)
      positions.setY(i, Math.sin(x*0.31+z*0.17)*0.26 + Math.sin(z*0.7-x*0.2)*0.09)
    }
    bed.computeVertexNormals()
    const floor = new THREE.Mesh(bed, this.stone)
    floor.position.set(0,-3.8,-23)
    floor.receiveShadow = true
    this.architecture.add(floor)

    // Rolling, curling crests are actual displaced geometry above the lettering.
    // Shared beat time drives the whole water body; no independent simulation clock.
    const waveMaterial = this.material(new THREE.ShaderMaterial({
      uniforms: this.ocean, side: THREE.DoubleSide,
      vertexShader: `varying vec3 p; varying float crest; uniform float time; uniform float swell;
        void main(){ vec3 v=position; float a=v.x*0.48+v.z*0.24-time*0.8;
          float b=v.z*0.65-v.x*0.19+time*0.55;
          crest=sin(a); float curl=pow(max(0.0,crest),4.0);
          v.y+=(sin(a)*0.95+sin(b)*0.32)*swell;
          v.x+=curl*cos(a+0.7)*0.8*swell;
          v.z+=curl*sin(a+0.7)*0.45*swell;
          p=(modelMatrix*vec4(v,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(p,1.); }`,
      fragmentShader: `varying vec3 p; varying float crest; uniform float time; uniform float light; uniform vec3 sun; uniform vec3 foam;
        float noise(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);
          return mix(mix(fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453),fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453),f.x),
            mix(fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453),fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453),f.x),f.y);}
        void main(){ vec3 n=normalize(cross(dFdx(p),dFdy(p)));
          float ripples=(noise(p.xz*3.+vec2(time*.2,0.))*2.-1.);
          float opening=pow(max(0.,sin(p.x*.31+p.z*.13+time*.12)),8.);
          float froth=smoothstep(.76,.98,crest+0.13*ripples);
          float foamPatch=.15+.85*noise(p.xz*1.8+time*.1);
          vec3 color=vec3(.002,.012,.019)+sun*(opening*.22+abs(n.y)*.015)*light;
          color+=foam*froth*foamPatch*.75*light;
          float distanceFade=exp(-length(p.xz)*.025);
          gl_FragColor=vec4(color*distanceFade,1.); }`,
    }))
    this.surface = new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(60,65,144,112)),waveMaterial)
    this.surface.geometry.rotateX(-Math.PI/2)
    this.surface.position.set(0,3.8,-22)
    this.surface.frustumCulled=false
    this.scene.add(this.surface)
    const beamGeometry=this.geometry(new THREE.CylinderGeometry(.10,2.7,15,28,1,true))
    for (const [index,x] of [-4,1,7].entries()) {
      const light=new THREE.SpotLight(0x9cdeed,600,40,.27,.65,2)
      light.position.set(x,9,4-index*2)
      light.target.position.set(x+1,0,0.3-index*1.1)
      light.castShadow=index<2
      light.shadow.mapSize.set(512,512)
      light.shadow.bias=-.001
      this.scene.add(light,light.target);this.sunlights.push(light)
      const material=this.material(new THREE.ShaderMaterial({
        uniforms:this.ocean,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
        vertexShader:`varying vec2 v; varying vec3 p; void main(){v=uv;p=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
        fragmentShader:`varying vec2 v; varying vec3 p; uniform float time; uniform float light; uniform vec3 sun;
          void main(){float edge=pow(sin(v.x*3.14159),4.);float ends=sin(v.y*3.14159);
            float threads=.3+.7*pow(.5+.5*sin(v.x*71.+sin(v.y*12.+time*.17)),3.);
            float breakup=.6+.4*sin(p.y*.8+p.x*1.7+time*.2);
            gl_FragColor=vec4(sun,edge*ends*threads*breakup*.18*light);}`,
      }))
      const shaft=new THREE.Mesh(beamGeometry,material)
      const end=light.target.position.clone().sub(light.position).normalize().multiplyScalar(15)
      shaft.position.copy(light.position).addScaledVector(end,.5)
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),end.normalize())
      shaft.frustumCulled=false;this.shafts.push(shaft);this.scene.add(shaft)
    }
    const particleGeometry = this.geometry(new THREE.BufferGeometry())
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3))
    const particleMaterial = this.material(new THREE.PointsMaterial({ color: 0x9be8eb, size: 0.04, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending }))
    this.particles = new THREE.Points(particleGeometry, particleMaterial)
    this.particles.frustumCulled = false
    this.scene.add(this.particles)
    const bubbleMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x92dfe8, metalness: 0.5, roughness: 0.13, transparent: true, opacity: 0.28, depthWrite: false }))
    this.bubbles = new THREE.InstancedMesh(this.geometry(new THREE.SphereGeometry(1, 8, 6)), bubbleMaterial, 96)
    this.bubbles.frustumCulled = false
    this.scene.add(this.bubbles)
  }

  protected override applyState(exec: Cinema2ModuleRenderExecutionContext & { camera: NonNullable<Cinema2ModuleRenderExecutionContext['camera']>; lightingEnvironment: NonNullable<Cinema2ModuleRenderExecutionContext['lightingEnvironment']> }, draw: Readonly<Cinema2SayItDrawState>, profile: Readonly<Cinema2SayItQualityProfile>): void {
    const state = this.getState()
    const pattern = submergePatternFromController(draw.pattern)
    const poses = resolveSubmergeGlyphPoses(draw.poses, pattern, draw.patternPhaseBeats, state)
    // Geometric patterns never strobe the glyphs: illumination stays continuous and readable.
    super.applyState(exec, { ...draw, poses, pattern: 'solid', ledMusicIntensity: 0.14 + state.energy * 0.10 + state.highs * 0.08 }, profile)
    const { THREE } = this.library
    const [r, g, b] = state.water
    this.fog.color.setRGB(r * 0.15, g * 0.15, b * 0.15, THREE.SRGBColorSpace)
    this.fog.density = state.haze
    ;(this.scene.background as Three.Color).copy(this.fog.color)
    this.causticUniforms.time.value = state.beats * 0.5
    this.causticUniforms.strength.value = state.caustics * (0.65 + state.mids * 0.85 + state.bass * 0.25)
    this.causticUniforms.tint.value.setRGB(Math.min(1, r + 0.2), Math.min(1, g + 0.55), Math.min(1, b + 0.6), THREE.SRGBColorSpace)
    this.architecture.visible = state.architecture > 0
    this.stone.opacity = state.architecture
    const amount = submergeMotionAmount(state)
    this.scene.environmentIntensity *= 0.10
    this.ocean.time.value = state.beats * 0.5 * (state.safety === 'lockoff' ? 0 : 1)
    this.ocean.swell.value = state.waves * (0.55 + amount * 0.45 + state.bass * amount * 0.6)
    this.ocean.light.value = state.sunlight
    this.ocean.sun.value.setRGB(...state.sun, THREE.SRGBColorSpace)
    this.ocean.foam.value.setRGB(...state.foam, THREE.SRGBColorSpace)
    this.surface.visible = state.waves > 0
    for (const light of this.sunlights) {
      light.color.copy(this.ocean.sun.value)
      light.intensity = state.sunlight * (600 + 80 * Math.sin(state.beats * 0.09 + light.position.x))
    }
    for (const shaft of this.shafts) shaft.visible = state.sunlight > 0
    this.corrosion.value = state.material === 'ceramic' ? 1 : 0
    for (const [index, glyph] of this.glyphs.entries()) {
      if (!this.weatheredMaterials.has(glyph.material)) {
        applySubmergeWeathering(glyph.material, this.corrosion, index + 1)
        this.weatheredMaterials.add(glyph.material)
      }
      const glass = state.material === 'glass'
      if (glyph.material.transparent !== glass) { glyph.material.transparent = glass; glyph.material.needsUpdate = true }
      glyph.material.opacity = glass ? 0.65 : 1
      glyph.material.depthWrite = !glass
      glyph.material.metalness = state.material === 'metal' ? 0.9 : glass ? 0.12 : 0.04
      glyph.material.roughness = glass ? Math.max(profile.roughnessFloor, draw.roughness * 0.5) : draw.roughness
      glyph.mesh.scale.z = state.depth
      glyph.ledMesh.scale.z = state.depth
    }
    const count = Math.round((profile.quality === 'low' ? 96 : profile.quality === 'medium' ? 192 : 384) * state.particles)
    const time = state.beats * 0.5
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3
      this.particlePositions[offset] = (this.seeds[offset]! - 0.5) * 17 + Math.sin(time * 0.2 + index) * 0.16 * amount
      this.particlePositions[offset + 1] = ((this.seeds[offset + 1]! * 9 + time * 0.045 * amount) % 9) - 2.5
      this.particlePositions[offset + 2] = -this.seeds[offset + 2]! * 25
    }
    this.particles.geometry.setDrawRange(0, count)
    this.particles.geometry.getAttribute('position').needsUpdate = true
    this.particles.material.opacity = 0.24 + state.highs * 0.3
    this.bubbles.count = Math.round((profile.quality === 'low' ? 24 : profile.quality === 'medium' ? 48 : 96) * state.bubbles)
    for (let index = 0; index < this.bubbles.count; index += 1) {
      const seed = this.seeds[index * 3]!
      const speed = (pattern === 'upwelling' ? 0.7 : 0.32) * (1 + state.highs * 0.7) * amount
      this.dummy.position.set((index % 2 ? 1 : -1) * (2.9 + seed * 1.1) + Math.sin(time * 0.6 + index) * 0.1 * amount,
        ((this.seeds[index * 3 + 1]! * 7 + time * speed) % 7) - 2,
        -this.seeds[index * 3 + 2]! * 13)
      this.dummy.scale.setScalar(0.018 + seed * 0.045)
      this.dummy.updateMatrix()
      this.bubbles.setMatrixAt(index, this.dummy.matrix)
    }
    this.bubbles.instanceMatrix.needsUpdate = true
  }

  override estimateGpuBytes(): number {
    let bytes = super.estimateGpuBytes() + 96 * 16 * 4
    for (const geometry of this.ownedGeometries) {
      for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array.byteLength
      bytes += geometry.index?.array.byteLength ?? 0
    }
    return bytes
  }
  override dispose(): void {
    if (this.released) return
    this.released = true
    this.scene.remove(this.architecture, this.particles, this.bubbles, this.surface, ...this.shafts)
    for (const light of this.sunlights) { this.scene.remove(light, light.target); light.shadow.dispose() }
    for (const geometry of this.ownedGeometries) geometry.dispose()
    for (const material of this.ownedMaterials) material.dispose()
    this.bubbles.dispose()
    super.dispose()
  }
  private geometry<T extends Three.BufferGeometry>(geometry: T): T { this.ownedGeometries.add(geometry); return geometry }
  private material<T extends Three.Material>(material: T): T { this.ownedMaterials.add(material); return material }
}
