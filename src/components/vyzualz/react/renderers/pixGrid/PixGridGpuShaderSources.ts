export const PIX_GRID_FULLSCREEN_VERTEX_SHADER = `#version 300 es
precision highp float;
void main() {
  vec2 position = vec2(
    gl_VertexID == 1 ? 3.0 : -1.0,
    gl_VertexID == 2 ? 3.0 : -1.0
  );
  gl_Position = vec4(position, 0.0, 1.0);
}
`

export const PIX_GRID_LOGICAL_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uLogicalSize;
uniform int uPattern;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uMotion;
uniform float uBassReactivity;
uniform bool uBlackout;
uniform sampler2D uOverrideTexture;
out vec4 outColor;

float saturate(float value) { return clamp(value, 0.0, 1.0); }

void main() {
  ivec2 framebufferCell = ivec2(gl_FragCoord.xy);
  ivec2 cell = ivec2(framebufferCell.x, int(uLogicalSize.y) - 1 - framebufferCell.y);
  vec2 uv = (vec2(cell) + 0.5) / uLogicalSize;
  vec4 overridePixel = texelFetch(uOverrideTexture, cell, 0);
  if (uBlackout) {
    outColor = vec4(0.0);
    return;
  }

  float nx = uv.x * 2.0 - 1.0;
  float ny = uv.y * 2.0 - 1.0;
  float aspectX = nx * (uLogicalSize.x / uLogicalSize.y) / (16.0 / 9.0);
  float time = uTime * max(0.08, uMotion);
  float beatPulse = max(uBeat, max(0.0, 1.0 - uBeatPhase * 3.2));
  float value = 0.0;
  float colorMix = 0.0;
  float accent = 0.0;

  if (uPattern == 1) {
    float angle = time * 0.8;
    float c = cos(angle);
    float s = sin(angle);
    float rx = aspectX * c - ny * s;
    float ry = aspectX * s + ny * c;
    float diamond = abs(rx) + abs(ry);
    float rings = 0.5 + 0.5 * cos((diamond * 13.0 - time * 4.2) * 3.14159265);
    float diagonals = max(0.0, 1.0 - min(abs(rx - ry), abs(rx + ry)) * 18.0);
    float core = max(0.0, 1.0 - length(vec2(aspectX, ny)) * (5.5 - uBass * 1.8));
    value = saturate(rings * (0.52 + uMid * 0.08) + diagonals * 0.45 + core * (0.65 + uBass * 0.6) + beatPulse * core * 0.6);
    colorMix = saturate((atan(ny, aspectX) / 3.14159265 + 1.0) * 0.5 + rings * 0.18);
    accent = saturate(core + diagonals * beatPulse);
  } else if (uPattern == 2) {
    float lane = floor(uv.y * 7.0);
    float direction = mod(lane, 2.0) < 1.0 ? 1.0 : -1.0;
    float march = mod(float(cell.x) + direction * time * (12.0 + uHigh * 12.0) + lane * 9.0, 26.0);
    float body = march < 8.0 ? 1.0 : march < 10.0 ? 0.5 : 0.0;
    float stepLight = mod(float(cell.x) + lane * 3.0 + floor(time * 6.0), 11.0) < 1.0 ? 0.65 : 0.0;
    float lanePulse = 0.45 + 0.55 * sin((lane + 1.0) * 1.7 + time * 2.3);
    value = saturate(body * (0.52 + lanePulse * 0.35 + uMid * 0.06) + stepLight + beatPulse * body * 0.45);
    colorMix = mod(lane, 4.0) / 3.0;
    accent = saturate(((lane == 2.0 || lane == 5.0) ? body : 0.0) + beatPulse * stepLight);
  } else {
    float radius = length(vec2(aspectX, ny));
    float theta = atan(ny, aspectX);
    float pulseRadius = 0.16 + uBass * uBassReactivity * 0.28 + beatPulse * 0.08;
    float ringDistance = abs(radius - pulseRadius - (0.5 + 0.5 * sin(time * 2.4)) * 0.16);
    float ring = max(0.0, 1.0 - ringDistance * 24.0);
    float beacon = max(0.0, 1.0 - radius * (4.3 - uBass * 1.4));
    float spokes = pow(max(0.0, cos(theta * 8.0 + time * 2.2)), 9.0) * max(0.0, 1.0 - radius * 1.35);
    value = saturate(beacon * (0.7 + uBass * 0.8) + ring * (0.76 + uMid * 0.08) + spokes * (0.28 + beatPulse * 0.5));
    colorMix = saturate(radius * 0.7 + 0.25 * sin(theta * 4.0 + time));
    accent = saturate(beacon * beatPulse + ring * uHigh * 0.7);
  }

  vec3 baseColor = mix(uPrimary, uSecondary, colorMix);
  vec3 logicalColor = mix(baseColor, uAccent, accent * 0.72) * value;
  float alpha = value <= 0.025 ? 0.0 : smoothstep(0.025, 0.12, value);
  if (overridePixel.a > 0.0) {
    logicalColor = overridePixel.rgb;
    alpha = 1.0;
  }
  outColor = vec4(logicalColor, alpha);
}
`

export const PIX_GRID_PRESENTATION_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uLogicalTexture;
uniform vec2 uLogicalSize;
uniform vec2 uPresentationSize;
uniform vec3 uBackground;
uniform float uGap;
uniform float uRoundness;
uniform float uCellBrightness;
uniform float uGlow;
uniform float uDiffusion;
uniform float uGlobalIntensity;
uniform bool uRgbSubpixel;
uniform bool uShowBounds;
out vec4 outColor;

float roundedRectDistance(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec3 toLinear(vec3 color) { return pow(max(color, vec3(0.0)), vec3(2.2)); }
vec3 toSrgb(vec3 color) { return pow(max(color, vec3(0.0)), vec3(1.0 / 2.2)); }

void main() {
  float logicalAspect = uLogicalSize.x / uLogicalSize.y;
  float outputAspect = uPresentationSize.x / uPresentationSize.y;
  vec2 viewportSize = outputAspect > logicalAspect
    ? vec2(uPresentationSize.y * logicalAspect, uPresentationSize.y)
    : vec2(uPresentationSize.x, uPresentationSize.x / logicalAspect);
  vec2 viewportOrigin = (uPresentationSize - viewportSize) * 0.5;
  vec2 pixel = gl_FragCoord.xy;

  if (pixel.x < viewportOrigin.x || pixel.y < viewportOrigin.y
      || pixel.x >= viewportOrigin.x + viewportSize.x || pixel.y >= viewportOrigin.y + viewportSize.y) {
    outColor = vec4(uBackground, 1.0);
    return;
  }

  vec2 viewportUv = (pixel - viewportOrigin) / viewportSize;
  vec2 grid = viewportUv * uLogicalSize;
  ivec2 cell = clamp(ivec2(floor(grid)), ivec2(0), ivec2(uLogicalSize) - ivec2(1));
  vec2 local = fract(grid) - 0.5;
  vec4 logical = texelFetch(uLogicalTexture, cell, 0);

  float halfSizeScalar = max(0.05, 0.5 - clamp(uGap, 0.0, 0.45));
  vec2 halfSize = vec2(halfSizeScalar);
  float radius = halfSizeScalar * clamp(uRoundness, 0.0, 0.5) * 2.0;
  float distanceToCell = roundedRectDistance(local, halfSize, radius);
  float aa = max(fwidth(distanceToCell), 0.0008);
  float diffuserWidth = aa + clamp(uDiffusion, 0.0, 1.0) * 0.045;
  float cellMask = 1.0 - smoothstep(-diffuserWidth, diffuserWidth, distanceToCell);
  float glowWidth = 0.015 + clamp(uGlow, 0.0, 1.0) * 0.16;
  float glowMask = exp(-max(distanceToCell, 0.0) / glowWidth) * clamp(uGlow, 0.0, 1.0);
  float center = clamp(1.0 - length(local / halfSize) * 0.62, 0.0, 1.0);
  float edgeFalloff = mix(0.86, 1.08, center);

  vec3 emitter = logical.rgb;
  if (uRgbSubpixel) {
    float stripe = clamp((local.x / max(halfSize.x, 0.001) + 1.0) * 1.5, 0.0, 2.999);
    vec3 channelMask = stripe < 1.0 ? vec3(1.0, 0.12, 0.08)
      : stripe < 2.0 ? vec3(0.08, 1.0, 0.12)
      : vec3(0.08, 0.16, 1.0);
    emitter *= channelMask * 1.34;
  }

  float contentAlpha = logical.a;
  vec3 inactiveCell = uBackground * (0.42 + cellMask * 0.18) + vec3(0.0025) * cellMask;
  vec3 linearEmitter = toLinear(emitter)
    * uCellBrightness
    * uGlobalIntensity
    * edgeFalloff
    * contentAlpha;
  vec3 linearColor = toLinear(inactiveCell);
  linearColor += linearEmitter * cellMask;
  linearColor += linearEmitter * glowMask * (0.2 + 0.55 * uGlow);
  linearColor = linearColor / (vec3(1.0) + linearColor * 0.42);
  vec3 color = toSrgb(linearColor);

  if (uShowBounds) {
    vec2 edge = min(viewportUv, 1.0 - viewportUv);
    float border = 1.0 - smoothstep(0.0, 1.5 / max(viewportSize.x, viewportSize.y), min(edge.x, edge.y));
    color = mix(color, vec3(0.74, 0.96, 1.0), border * 0.65);
  }
  outColor = vec4(color, 1.0);
}
`

export function getPixGridGpuShaderProgramSources() {
  return [
    {
      label: 'PixGrid logical composition',
      vertSrc: PIX_GRID_FULLSCREEN_VERTEX_SHADER,
      fragSrc: PIX_GRID_LOGICAL_FRAGMENT_SHADER,
    },
    {
      label: 'PixGrid LED presentation',
      vertSrc: PIX_GRID_FULLSCREEN_VERTEX_SHADER,
      fragSrc: PIX_GRID_PRESENTATION_FRAGMENT_SHADER,
    },
  ] as const
}
