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
uniform bool uBlackout;
uniform sampler2D uOverrideTexture;
out vec4 outColor;

void main() {
  ivec2 framebufferCell = ivec2(gl_FragCoord.xy);
  ivec2 cell = ivec2(framebufferCell.x, int(uLogicalSize.y) - 1 - framebufferCell.y);
  vec4 compositedPixel = texelFetch(uOverrideTexture, cell, 0);
  vec3 logicalColor = uBlackout ? vec3(0.0) : compositedPixel.rgb;
  float alpha = uBlackout ? 0.0 : compositedPixel.a;
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
  // Off emitters remain truly off. A black background therefore produces exact
  // black cells and gaps instead of a gray matrix veil.
  vec3 inactiveCell = uBackground * (0.42 + cellMask * 0.18);
  vec3 linearEmitter = toLinear(emitter)
    * uCellBrightness
    * uGlobalIntensity
    * edgeFalloff
    * contentAlpha;
  vec3 linearColor = toLinear(inactiveCell);
  linearColor += linearEmitter * cellMask;
  linearColor += linearEmitter * glowMask * (0.2 + 0.55 * uGlow);
  // Compress all channels by the same scalar so cyan, emerald, red, and other
  // saturated emitters retain hue instead of whitening at high intensity.
  float peak = max(linearColor.r, max(linearColor.g, linearColor.b));
  linearColor *= 1.0 / (1.0 + peak * 0.42);
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
