import type { Color, MeshStandardMaterial, Vector4 } from 'three'
import { LIVEWIRE_LED_HEIGHT, LIVEWIRE_MAX_BARS } from './Cinema2LivewireGlyphs'

export interface LivewireLightUniforms {
  program: { value: Vector4 }
  accent: { value: Vector4 }
  bars: { value: Vector4[] }
  count: { value: number }
  tint: { value: Color }
  intensity: { value: number }
}

const LIGHT_PROGRAM = `
  uniform vec4 uProgram;  // pattern, phase, coverage, normalized glyph position
  uniform vec4 uAccent;   // kick, snare, transient, drop
  uniform int uBarCount;
  float livewireBar(float index, float height) {
    float bar = index / max(1.0, float(uBarCount) - 1.0);
    float pattern = uProgram.x;
    float phase = uProgram.y;
    float coverage = uProgram.z;
    float glyph = uProgram.w;
    float roll = 0.5 + 0.5 * sin(6.283185 * (phase - glyph - bar * 0.34));
    float top = smoothstep(0.44, 0.84, height);
    float bottom = 1.0 - smoothstep(0.15, 0.57, height);
    // Keep one strong contour segment on each glyph, with quiet companions.
    float leading = 1.0 - step(0.5, index);
    float companion = step(0.5, index) * (1.0 - step(1.5, index));
    float value = 0.42 * top + 0.26 * roll + 0.74 * leading + 0.24 * companion * roll;
    if (pattern > 0.5 && pattern < 1.5) value = 0.81 * roll + 0.19 * (1.0 - bar);
    if (pattern > 1.5 && pattern < 2.5) value = 0.76 * smoothstep(-0.48, 0.12, cos(6.283185 * (phase + step(0.5, glyph) * 0.5))) + 0.24 * top;
    if (pattern > 2.5 && pattern < 3.5) value = 0.89 * top + 0.11 * roll;
    if (pattern > 3.5 && pattern < 4.5) value = 0.89 * bottom + 0.11 * roll;
    if (pattern > 4.5) value = 0.73 * (0.5 + 0.5 * cos(6.283185 * (phase - abs(glyph - 0.5) * 2.0 - bar * 0.24))) + 0.27 * bottom;
    float pulse = uAccent.x * smoothstep(0.45, 1.0, roll) * (0.45 + 0.55 * bottom);
    float hit = uAccent.y * top * 0.38 + uAccent.z * roll * 0.26;
    float dropBank = step(1.0, index) * smoothstep(0.24, 0.82, abs(glyph - 0.5) * 2.0) * (0.56 * top + 0.44 * bottom);
    float threshold = mix(0.94, 0.33, coverage);
    float lit = smoothstep(threshold, threshold + 0.16, value + pulse + hit + uAccent.w * dropBank * 0.63);
    return 0.006 + lit * 0.994;
  }
`

const METAL = `
  varying vec3 vLivewireSurface;
  uniform vec4 uBars[${LIVEWIRE_MAX_BARS}];
  uniform vec3 uLedTint;
  uniform float uLedIntensity;
  float channelDistance(vec2 p, vec4 bar) {
    vec2 edge = bar.zw - bar.xy;
    float t = clamp(dot(p - bar.xy, edge) / max(dot(edge, edge), 1e-5), 0.0, 1.0);
    return length(p - bar.xy - edge * t);
  }
  float finishHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float finishNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(finishHash(i), finishHash(i + vec2(1.0, 0.0)), f.x),
      mix(finishHash(i + vec2(0.0, 1.0)), finishHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`

export function applyLivewireLedMaterial(material: MeshStandardMaterial, values: LivewireLightUniforms) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uProgram = values.program
    shader.uniforms.uAccent = values.accent
    shader.uniforms.uBarCount = values.count
    shader.vertexShader = `varying vec2 vBar;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBar = uv;')
    shader.fragmentShader = `varying vec2 vBar;\n${LIGHT_PROGRAM}\n${shader.fragmentShader}`
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float drivenBar = livewireBar(vBar.x, vBar.y);
        totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(0.88, 0.98, 1.0) * max(max(emissive.r, emissive.g), emissive.b), 0.21 * smoothstep(0.42, 1.0, drivenBar)) * drivenBar;`)
  }
  material.customProgramCacheKey = () => 'livewire-recessed-led-v2'
  material.needsUpdate = true
}

export function applyLivewireMetalMaterial(material: MeshStandardMaterial, values: LivewireLightUniforms) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uProgram = values.program
    shader.uniforms.uAccent = values.accent
    shader.uniforms.uBarCount = values.count
    shader.uniforms.uBars = values.bars
    shader.uniforms.uLedTint = values.tint
    shader.uniforms.uLedIntensity = values.intensity
    shader.vertexShader = `varying vec3 vLivewireSurface;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLivewireSurface = position;')
    shader.fragmentShader = `${LIGHT_PROGRAM}\n${METAL}\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 surface = vLivewireSurface;
        float milling = finishNoise(surface.xy * vec2(10.0, 146.0) + surface.z * 24.0);
        float steelCloud = finishNoise(surface.xy * vec2(6.8, 12.0) + surface.z * 17.0);
        float layer = smoothstep(0.119, 0.167, surface.z) * (1.0 - smoothstep(0.183, 0.224, surface.z));
        float face = smoothstep(0.24, 0.27, surface.z);
        float nearby = 1.0;
        float spill = 0.0;
        for (int index = 0; index < ${LIVEWIRE_MAX_BARS}; ++index) {
          if (index >= uBarCount) break;
          vec4 bar = uBars[index];
          float distanceToBar = channelDistance(surface.xy, bar);
          nearby = min(nearby, distanceToBar);
          float barHeight = (bar.y + bar.w) * ${0.5 / LIVEWIRE_LED_HEIGHT} + 0.5;
          float lamp = livewireBar(float(index), barHeight);
          float lip = exp(-abs(distanceToBar - 0.055) * 72.0);
          spill = max(spill, lamp * (0.19 * lip + 0.045 * exp(-distanceToBar * 15.0)));
        }
        float machined = smoothstep(0.007, 0.016, abs(nearby - 0.106));
        diffuseColor.rgb *= mix(0.20, 0.86, face) * mix(0.89, 1.12, steelCloud)
          * mix(0.65, 1.0, machined) * (0.94 + milling * 0.12) + layer * 0.33;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (steelCloud - 0.47) * 0.26 + (milling - 0.5) * 0.19
          + (1.0 - machined) * 0.15 - layer * 0.10, 0.08, 0.93);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float frontMetal = smoothstep(0.14, 0.23, surface.z);
        totalEmissiveRadiance += uLedTint * spill * frontMetal * uLedIntensity;`)
  }
  material.customProgramCacheKey = () => 'livewire-milled-gunmetal-v2'
  material.needsUpdate = true
}
