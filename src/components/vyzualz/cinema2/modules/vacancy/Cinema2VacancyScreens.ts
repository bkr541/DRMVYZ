/** The analog-static screen shader for every television in the VACANCY tower, drawn as one instanced layer. */
export const VACANCY_SCREEN_VERTEX = /* glsl */ `
attribute vec4 aScreen; // brightness, seed, corner radius (fraction of height), aspect (width / height)
varying vec2 vUv;
varying vec4 vScreen;
varying vec2 vWallUv;
uniform vec4 uWallBounds;
void main() {
  vec4 local = instanceMatrix * vec4(position, 1.0);
  vWallUv = (local.xy - uWallBounds.xy) / uWallBounds.zw;
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
uniform vec3 uHighlight;
uniform float uAccent;
uniform float uInterference;
uniform sampler2D uMedia;
uniform float uHasMedia;
uniform float uMediaLayout;
uniform float uMediaAspect;
uniform float uMediaOpacity;
uniform float uStaticOverMedia;
uniform float uMediaFit;
uniform vec4 uMediaTransform;
uniform float uMediaRotation;
uniform vec4 uWallBounds;
varying vec2 vWallUv;
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
  float roll = fract(vUv.y + t * (.035 + uInterference * seed * .17) + seed * 7.0);
  // Chunky analog static, re-rolled every frame, with finer grain under it.
  vec2 cell = floor(vec2(vUv.x * 150.0 * aspect, vUv.y * 110.0));
  float coarse = hash12(cell + floor(t * 24.0) * 17.31 + seed * 91.7);
  float fine = hash12(floor(vUv * vec2(520.0 * aspect, 390.0)) + floor(t * 30.0) * 7.77 + seed * 13.0);
  float grain = mix(coarse, fine, .5);
  // Rolling horizontal banding and fine scanlines.
  float bands = .5 + .5 * sin((roll * 5.0) * 6.2831853);
  float scan = .5 + .5 * sin(vUv.y * 330.0 * 3.14159);
  float luma = .95 + (grain - .5) * .34 * uGrain + (bands - .5) * .12 * min(uGrain, 1.0) - (1.0 - scan) * .07 * uScan;
  // CRT falloff: the picture is dimmer toward the corners.
  float vignette = 1.0 - .3 * dot(p * vec2(.78, 1.0), p * vec2(.78, 1.0));
  luma = max(luma, 0.0) * vignette;
  vec3 picture = uTint * luma;
  if (uHasMedia > .5) {
    vec2 uv = uMediaLayout > .5 ? vWallUv : vUv;
    float screenAspect = uMediaLayout > .5 ? uWallBounds.z / uWallBounds.w : aspect;
    vec2 fit = vec2(1.0);
    if (uMediaFit < .5) fit = screenAspect > uMediaAspect ? vec2(screenAspect / uMediaAspect, 1.0) : vec2(1.0, uMediaAspect / screenAspect);
    else if (uMediaFit < 1.5) fit = screenAspect > uMediaAspect ? vec2(1.0, uMediaAspect / screenAspect) : vec2(screenAspect / uMediaAspect, 1.0);
    vec2 q = (uv - .5) * fit / max(uMediaTransform.zw, vec2(.01));
    float cs = cos(uMediaRotation), sn = sin(uMediaRotation);
    uv = mat2(cs, -sn, sn, cs) * q + uMediaTransform.xy;
    vec4 source = texture2D(uMedia, clamp(vec2(uv.x, 1.0 - uv.y), 0.0, 1.0));
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    vec3 image = pow(max(source.rgb, vec3(0.0)), vec3(2.2)) * uTint * vignette;
    image *= 1.0 - (1.0 - scan) * .07 * uScan;
    image = mix(image, uTint * luma, uStaticOverMedia);
    picture = mix(picture, image, source.a * inside * uMediaOpacity);
  }
  vec3 colour = mix(picture, uHighlight * max(luma, 0.0), uAccent) * uIntensity * vScreen.x;
  gl_FragColor = vec4(colour, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
