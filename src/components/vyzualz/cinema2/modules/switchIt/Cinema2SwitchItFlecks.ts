import type * as Three from 'three'
/** Flecks are derived from stable authored face identities, never a frame-random screen emitter. */
export function createSwitchItFlecks(THREE:typeof Three,human:Three.BufferGeometry,uniforms:Record<string,{value:unknown}>){
 const centers=human.getAttribute('aCenter'),seeds=human.getAttribute('aSeed'),positions:number[]=[],ids:number[]=[]
 const faces=Array.from({length:centers.count/3},(_,i)=>i*3).filter(i=>centers.getY(i)>-.5).sort((a,b)=>seeds.getX(a)-seeds.getX(b))
 for(let n=0;n<160;n++){const i=faces[Math.floor(n*faces.length/160)];positions.push(centers.getX(i),centers.getY(i),centers.getZ(i));ids.push(seeds.getX(i))}
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)).setAttribute('aSeed',new THREE.Float32BufferAttribute(ids,1))
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:`attribute float aSeed;uniform float uReach;uniform float uParticlePhase;uniform float uFlecks;uniform float uGesture;varying float vAlpha;void main(){vec3 p=position;float phase=uParticlePhase*6.28318+aSeed*31.0;p+=vec3(sin(phase)*.6,.1+abs(cos(phase))*.45,.12)*uReach*uGesture;p.z+=.08;float eye=min(length((p.xy-vec2(.277,.22))/vec2(.22,.15)),length((p.xy-vec2(-.277,.22))/vec2(.22,.15)));vAlpha=uFlecks*uGesture*smoothstep(1.0,1.35,eye);gl_PointSize=1.3+aSeed*1.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
  fragmentShader:`precision highp float;uniform vec3 uEnergy;uniform float uMaster;varying float vAlpha;void main(){vec2 p=gl_PointCoord;if(p.y+abs(p.x-.5)*1.7>.9||p.y<.12)discard;gl_FragColor=vec4(uEnergy*uMaster,vAlpha*.7);}`,
 })
 const mesh=new THREE.Points(geometry,material);mesh.renderOrder=2;mesh.visible=false
 return{mesh,geometry,material}
}
