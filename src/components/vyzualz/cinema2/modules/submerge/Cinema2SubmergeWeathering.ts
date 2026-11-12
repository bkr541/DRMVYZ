import type { MeshStandardMaterial } from 'three'

/** Object-space corrosion stays attached to each glyph during currents and rotation. */
export function applySubmergeWeathering(material: MeshStandardMaterial, enabled: { value: number }, seed: number): void {
  material.onBeforeCompile = shader => {
    shader.uniforms.uCorrosion = enabled
    shader.uniforms.uCorrosionSeed = { value: seed }
    shader.vertexShader = `varying vec3 vCorrosionPosition;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCorrosionPosition = position;')
    shader.fragmentShader = `
      varying vec3 vCorrosionPosition; uniform float uCorrosion; uniform float uCorrosionSeed;
      float corrosionHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float corrosionNoise(vec3 p){vec3 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(corrosionHash(i),corrosionHash(i+vec3(1,0,0)),f.x),
          mix(corrosionHash(i+vec3(0,1,0)),corrosionHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(corrosionHash(i+vec3(0,0,1)),corrosionHash(i+vec3(1,0,1)),f.x),
          mix(corrosionHash(i+vec3(0,1,1)),corrosionHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      ${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 corrosionP=vCorrosionPosition+vec3(uCorrosionSeed*3.17,0.,uCorrosionSeed);
        float corrosionLarge=corrosionNoise(corrosionP*4.2);
        float corrosionFine=corrosionNoise(corrosionP*39.);
        float corrosion=smoothstep(.17,.53,corrosionLarge*.75+corrosionNoise(corrosionP*11.)*.25);
        float mineral=pow(corrosionNoise(corrosionP*vec3(18.,1.4,12.)),5.);
        vec3 oxide=mix(vec3(.08,.018,.005),vec3(.4,.13,.035),corrosionNoise(corrosionP*8.));
        vec3 steel=vec3(.11,.145,.14)*(0.65+corrosionFine*.5);
        vec3 aged=mix(steel,oxide,corrosion);
        aged=mix(aged,vec3(.23,.26,.19),min(.4,mineral));
        diffuseColor.rgb=mix(diffuseColor.rgb,aged*(.5+diffuseColor.rgb),uCorrosion);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,min(1.,.56+roughnessFactor*.3+corrosion*.25),uCorrosion);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor=mix(metalnessFactor,mix(.7,.06,corrosion),uCorrosion);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float pitHeight=(corrosionFine*.0012-corrosion*.002)*uCorrosion;
        vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);
        vec3 s0=cross(q1,normal),s1=cross(normal,q0);
        float determinant=dot(q0,s0);
        vec3 pitGradient=sign(determinant)*(dFdx(pitHeight)*s0+dFdy(pitHeight)*s1);
        normal=normalize(abs(determinant)*normal-pitGradient);`)
  }
  material.customProgramCacheKey = () => 'submerge-corroded-metal-v1'
  material.needsUpdate = true
}
