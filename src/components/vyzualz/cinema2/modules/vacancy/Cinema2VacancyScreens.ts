/** The analog-static screen shader for every television in the VACANCY tower, drawn as one instanced layer. */
export const VACANCY_SCREEN_VERTEX = /* glsl */ `
attribute vec4 aScreen; // brightness, seed, corner radius (fraction of height), aspect (width / height)
varying vec2 vUv;
varying vec4 vScreen;
void main() {
  vUv = uv;
  vScreen = aScreen;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`

export const VACANCY_SCREEN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uTint;
uniform float uIntensity;
uniform float uGrain;
uniform float uScan;
varying vec2 vUv;
varying vec4 vScreen;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float aspect = vScreen.w;
  vec2 p = (vUv - .5) * 2.0;
  // Rounded-rectangle glass mask, with a soft edge so the screen melts into the bezel.
  vec2 extent = vec2(aspect, 1.0);
  vec2 q = abs(p * extent) - (extent - vScreen.z * 2.0);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - vScreen.z * 2.0;
  float mask = 1.0 - smoothstep(-.035, .02, d);
  if (mask < .003) discard;

  float seed = vScreen.y;
  float t = uTime;
  // Vertical hold: the picture drifts and rolls slowly.
  float roll = fract(vUv.y + t * .035 + seed * 7.0);
  // Chunky analog static, re-rolled every frame, with finer grain under it.
  vec2 cell = floor(vec2(vUv.x * 150.0 * aspect, vUv.y * 110.0));
  float coarse = hash12(cell + floor(t * 24.0) * 17.31 + seed * 91.7);
  float fine = hash12(floor(vUv * vec2(520.0 * aspect, 390.0)) + floor(t * 30.0) * 7.77 + seed * 13.0);
  float grain = mix(coarse, fine, .5);
  // Rolling horizontal banding and fine scanlines.
  float bands = .5 + .5 * sin((roll * 5.0) * 6.2831853);
  float scan = .5 + .5 * sin(vUv.y * 330.0 * 3.14159);
  float luma = .95 + (grain - .5) * .34 * uGrain + (bands - .5) * .12 - (1.0 - scan) * .07 * uScan;
  // CRT falloff: the picture is dimmer toward the corners.
  float vignette = 1.0 - .3 * dot(p * vec2(.78, 1.0), p * vec2(.78, 1.0));
  luma = max(luma, 0.0) * vignette;
  vec3 colour = uTint * luma * uIntensity * vScreen.x;
  gl_FragColor = vec4(colour, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
