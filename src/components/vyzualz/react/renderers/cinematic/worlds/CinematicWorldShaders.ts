export const CINEMATIC_WORLD_COMMON_UNIFORMS = [
  'uResolution',
  'uTime',
  'uTransportTime',
  'uBass',
  'uMid',
  'uHigh',
  'uVolume',
  'uBeat',
  'uBeatPhase',
  'uImpactAge',
  'uDownbeat',
  'uSectionIntensity',
  'uDrop',
  'uSeed',
  'uQuality',
  'uVariation',
  'uPrimary',
  'uSecondary',
  'uAccent',
] as const

const HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uTransportTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uVolume;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uImpactAge;
uniform float uDownbeat;
uniform float uSectionIntensity;
uniform float uDrop;
uniform float uSeed;
uniform float uQuality;
uniform vec4 uVariation;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;

float hash11(float p) {
  return fract(sin(p * 127.1 + uSeed * 0.0137) * 43758.5453123);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 0.017) * 43758.5453123);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
`

export const EVENT_HORIZON_FRAGMENT_SOURCE = `${HEADER}
uniform float uCoreRadius;
uniform float uRingRadius;
uniform float uRingThickness;
uniform float uAccretionTilt;
uniform float uLensingStrength;
uniform float uDepthLayers;
uniform float uRotationSpeed;
uniform float uShockwaveStrength;
uniform float uDropExpansion;

float starLayer(vec2 p, float layer) {
  vec2 cell = floor(p);
  vec2 local = fract(p) - 0.5;
  float chance = hash21(cell + layer * 41.7);
  float radius = mix(0.018, 0.055, hash11(chance * 91.0 + layer));
  float star = smoothstep(radius, 0.0, length(local));
  float twinkle = 0.45 + 0.55 * sin(uTime * (1.2 + layer * 0.17) + chance * 18.0);
  return star * step(0.86 - uHigh * 0.08, chance) * twinkle;
}

void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  p.x *= uResolution.x / max(1.0, uResolution.y);

  float pressure = uBass * (0.08 + uLensingStrength * 0.10);
  float dropExpansion = uDrop * uDropExpansion;
  float coreRadius = uCoreRadius + pressure + dropExpansion * 0.10;
  float rawRadius = length(p);
  float lens = uLensingStrength / (0.18 + rawRadius * rawRadius * 4.5);
  vec2 warped = p * (1.0 + lens * 0.12);
  warped += normalize(p + vec2(0.0001)) * sin(rawRadius * 22.0 - uTime * 1.7) * lens * 0.008;

  vec3 color = vec3(0.0015, 0.0025, 0.008);
  int maxLayers = int(mix(2.0, 7.0, uQuality / 3.0));
  for (int i = 0; i < 7; i++) {
    if (i >= maxLayers || float(i) >= uDepthLayers) break;
    float layer = float(i) + 1.0;
    float scale = 4.0 + layer * 3.8;
    vec2 starUv = warped * scale + vec2(uTime * 0.012 * layer, -uTime * 0.008 * layer);
    float stars = starLayer(starUv + uVariation.xy * layer, layer);
    color += mix(uSecondary, uPrimary, layer / 7.0) * stars * (0.12 + layer * 0.035);
  }

  vec2 ringP = rotate2d(uAccretionTilt * 1.1) * p;
  ringP.y /= max(0.28, 1.0 - abs(uAccretionTilt) * 0.58);
  float ringRadius = length(ringP);
  float angle = atan(ringP.y, ringP.x);
  float turbulent = sin(angle * (8.0 + uVariation.x * 2.0) - uTime * uRotationSpeed * 6.0);
  turbulent += sin(angle * 19.0 + ringRadius * 44.0 + uTime * uRotationSpeed * 2.3) * 0.35;
  float ringTarget = uRingRadius + turbulent * uRingThickness * 0.32 + pressure * 0.22;
  float ring = smoothstep(uRingThickness, 0.0, abs(ringRadius - ringTarget));
  float ringHot = smoothstep(uRingThickness * 0.46, 0.0, abs(ringRadius - ringTarget));
  float doppler = 0.5 + 0.5 * cos(angle - uTime * uRotationSpeed);
  vec3 accretion = mix(uSecondary, uPrimary, doppler);
  accretion = mix(accretion, uAccent, ringHot * (0.35 + uHigh * 0.65));
  color += accretion * ring * (0.65 + uSectionIntensity * 0.7 + uBass * 0.8);
  color += uAccent * ringHot * (0.55 + uDrop * 0.9);

  float photonRing = smoothstep(0.028, 0.0, abs(rawRadius - coreRadius * 1.17));
  color += mix(uPrimary, vec3(1.0), 0.38) * photonRing * (0.65 + uBass * 1.2);

  float shockRadius = coreRadius + 0.12 + uImpactAge * (0.72 + uShockwaveStrength * 0.35);
  float shock = smoothstep(0.028, 0.0, abs(rawRadius - shockRadius));
  shock *= exp(-uImpactAge * 3.2) * uShockwaveStrength;
  color += mix(uAccent, vec3(1.0), 0.45) * shock * (0.5 + uBeat * 1.5);

  float halo = smoothstep(coreRadius * 2.7, coreRadius * 0.9, rawRadius);
  color += uPrimary * halo * lens * 0.055 * (0.6 + uBass);

  float core = smoothstep(coreRadius + 0.018, coreRadius - 0.012, rawRadius);
  color *= 1.0 - core;
  color += vec3(0.0, 0.0, 0.002) * core;

  float vignette = smoothstep(1.55, 0.28, length(p));
  color *= 0.32 + 0.68 * vignette;
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

export const INFINITE_CORRIDOR_FRAGMENT_SOURCE = `${HEADER}
uniform float uCorridorDensity;
uniform float uTravelSpeed;
uniform float uTunnelWidth;
uniform float uArchThickness;
uniform float uAlternatingLights;
uniform float uFogDensity;
uniform float uCameraSway;
uniform float uVanishingOffset;
uniform float uStructureStyle;

float corridorStructure(vec2 q, float width, float style) {
  float arch = abs(length(vec2(q.x, q.y + 0.32)) - width);
  float pillars = min(abs(abs(q.x) - width), abs(q.y + 0.72));
  float octagon = abs(max(abs(q.x) * 0.86 + abs(q.y + 0.18) * 0.52, abs(q.y + 0.18)) - width);
  if (style < 0.5) return arch;
  if (style < 1.5) return pillars;
  return octagon;
}

void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  p.x *= uResolution.x / max(1.0, uResolution.y);
  float sway = sin(uTime * 0.37 * uVariation.w + uVariation.x * 6.2831) * uCameraSway;
  vec2 vanish = vec2(uVanishingOffset + sway, sin(uTime * 0.23) * uCameraSway * 0.28);
  vec2 ray = (p - vanish) / (1.0 + uBass * 0.055);

  vec3 color = vec3(0.002, 0.004, 0.009);
  float travel = uTransportTime * uTravelSpeed * 0.18 + uTime * uTravelSpeed * 0.035;
  int steps = int(mix(18.0, 48.0, uQuality / 3.0));
  float density = mix(0.45, 1.35, uCorridorDensity);

  for (int i = 0; i < 48; i++) {
    if (i >= steps) break;
    float fi = float(i);
    float slice = fract(fi / float(steps) + travel);
    float z = 0.045 + slice * slice * 1.45;
    float perspective = 0.12 + z * 1.55;
    vec2 q = ray / perspective;
    q.y += 0.10 + z * 0.08;

    float width = uTunnelWidth * (0.82 + 0.08 * sin(fi * 0.91 + uVariation.y));
    float dist = corridorStructure(q, width, uStructureStyle);
    float thickness = uArchThickness / perspective * density;
    float structure = smoothstep(thickness, 0.0, dist);

    float fade = exp(-z * (0.65 + uFogDensity * 2.4));
    float lane = mod(fi + floor(travel * float(steps)), 2.0);
    float alternate = mix(0.28, 1.0, step(0.5, lane));
    float beatSegment = smoothstep(0.42, 0.0, abs(fract(slice + uBeatPhase) - 0.5));
    beatSegment *= 0.32 + uBeat * 1.2 + exp(-uImpactAge * 5.0) * 0.7;

    vec3 segmentColor = mix(uSecondary, uPrimary, alternate);
    segmentColor = mix(segmentColor, uAccent, beatSegment * uAlternatingLights);
    color += segmentColor * structure * fade * (0.11 + uBass * 0.035 + 0.055 * fi / float(steps));

    float floorLine = smoothstep(thickness * 0.7, 0.0, abs(q.y + width * 0.74));
    color += uSecondary * floorLine * fade * 0.035;
  }

  float vanishingGlow = exp(-length(ray) * (5.2 - uVolume * 1.3));
  color += mix(uSecondary, uPrimary, uHigh) * vanishingGlow * (0.18 + uSectionIntensity * 0.18);
  float atmosphere = noise21(p * 2.5 + uTime * 0.04) * uFogDensity;
  color += uPrimary * atmosphere * 0.018 * (1.0 - length(ray) * 0.35);
  color *= smoothstep(1.65, 0.18, length(p));
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

export const FRACTURE_RIFT_FRAGMENT_SOURCE = `${HEADER}
uniform float uOpeningAmount;
uniform float uEdgeComplexity;
uniform float uShardDensity;
uniform float uCrackPropagation;
uniform float uFractureMotion;
uniform float uInnerDepth;
uniform float uShardDrift;
uniform float uOpeningShape;
uniform float uInnerSurface;

float fractureMetric(vec2 p) {
  if (uOpeningShape < 0.5) {
    return abs(p.x * 0.86 + sin(p.y * 5.0 + uVariation.x * 5.0) * 0.12) + abs(p.y) * 0.08;
  }
  if (uOpeningShape < 1.5) {
    vec2 q = rotate2d(0.58 + uVariation.y * 0.18) * p;
    return abs(q.x + sin(q.y * 7.0) * 0.10) + abs(q.y) * 0.06;
  }
  return length(p * vec2(0.88, 1.18));
}

float shardShape(vec2 p, float angle, float size) {
  vec2 q = rotate2d(angle) * p;
  float triangle = max(abs(q.x) * 0.72 + q.y * 0.48, -q.y);
  return smoothstep(size, size * 0.42, triangle);
}

void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  p.x *= uResolution.x / max(1.0, uResolution.y);

  float transientMotion = exp(-uImpactAge * 5.2) * uFractureMotion;
  vec2 displaced = p;
  displaced.x += sin(p.y * 14.0 + uTime * 2.2) * transientMotion * 0.018;
  displaced.y += cos(p.x * 11.0 - uTime * 1.8) * transientMotion * 0.012;

  float metric = fractureMetric(displaced);
  float angular = atan(displaced.y, displaced.x);
  float edgeNoise = (noise21(vec2(angular * 2.4, metric * 9.0 + uVariation.x * 4.0)) - 0.5);
  edgeNoise += sin(angular * 17.0 + uVariation.y * 5.0) * 0.12;
  float radius = mix(0.14, 0.74, uOpeningAmount) + edgeNoise * 0.14 * uEdgeComplexity;
  float opening = smoothstep(radius + 0.025, radius - 0.035, metric);
  float edge = smoothstep(0.050, 0.0, abs(metric - radius));

  vec3 color = vec3(0.003, 0.004, 0.010);
  vec2 innerUv = displaced / max(0.12, radius);
  innerUv *= 1.0 + uInnerDepth * (0.15 + length(innerUv) * 0.22);
  float innerPattern;
  if (uInnerSurface < 0.5) {
    innerPattern = 0.5 + 0.5 * sin(innerUv.x * 15.0 + sin(innerUv.y * 9.0) + uTime * 0.8);
  } else if (uInnerSurface < 1.5) {
    vec2 grid = abs(fract(innerUv * 5.0 + uTime * vec2(0.08, -0.05)) - 0.5);
    innerPattern = smoothstep(0.18, 0.02, min(grid.x, grid.y));
  } else {
    innerPattern = noise21(innerUv * 5.5 + vec2(uTime * 0.12, -uTime * 0.09));
  }
  float innerGlow = (0.34 + innerPattern * 0.66 + uBass * 0.45 + uDrop * 0.55) * uSectionIntensity;
  vec3 innerColor = mix(uSecondary, uPrimary, innerPattern);
  innerColor = mix(innerColor, uAccent, uHigh * 0.55);
  color = mix(color, innerColor * innerGlow, opening);

  float crackAngle = fract(angular / 6.2831853 * (8.0 + uEdgeComplexity * 14.0) + edgeNoise * 0.8);
  float crackLine = smoothstep(0.045, 0.0, abs(crackAngle - 0.5));
  crackLine *= smoothstep(radius + 0.58 * uCrackPropagation, radius + 0.02, metric);
  crackLine *= 1.0 - opening;
  color += mix(uPrimary, uAccent, uHigh) * crackLine * (0.18 + transientMotion * 0.8);
  color += mix(uPrimary, vec3(1.0), 0.28) * edge * (0.85 + uBass + uDrop * 0.6);

  int shardCount = int(mix(6.0, 20.0, uQuality / 3.0) * uShardDensity);
  for (int i = 0; i < 20; i++) {
    if (i >= shardCount) break;
    float fi = float(i);
    float h = hash11(fi * 17.13 + 4.0);
    float a = h * 6.2831853 + uVariation.x * 4.0;
    float drift = sin(uTime * (0.18 + hash11(fi + 9.0) * 0.34) + fi) * uShardDrift * 0.05;
    float radial = radius + 0.08 + hash11(fi * 3.7) * 0.38 + drift;
    vec2 center = vec2(cos(a), sin(a)) * radial;
    vec2 local = displaced - center;
    float shard = shardShape(local, a + fi, 0.018 + hash11(fi * 8.2) * 0.035);
    float facing = 0.35 + 0.65 * sin(uTime + fi * 1.7) * sin(uTime + fi * 1.7);
    color += mix(uSecondary, uAccent, h) * shard * facing * (0.28 + uHigh * 0.8);
  }

  color *= smoothstep(1.55, 0.22, length(p));
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

export const MONOLITH_GATE_FRAGMENT_SOURCE = `${HEADER}
uniform float uGateScale;
uniform float uColumnCount;
uniform float uSlabDepth;
uniform float uRingCount;
uniform float uLightShaftIntensity;
uniform float uGlyphDensity;
uniform float uOpeningAmount;
uniform float uLockStrength;
uniform float uCameraTravel;
uniform float uArchitectureStyle;

float columnDistance(vec2 p, float x, float halfWidth, float halfHeight) {
  vec2 q = p - vec2(x, 0.04);
  if (uArchitectureStyle < 0.5) return sdBox(q, vec2(halfWidth, halfHeight));
  if (uArchitectureStyle < 1.5) {
    float taper = halfWidth * mix(0.72, 1.18, clamp((q.y + halfHeight) / (2.0 * halfHeight), 0.0, 1.0));
    return sdBox(q, vec2(taper, halfHeight));
  }
  return max(abs(q.x) * 0.86 + abs(q.y) * 0.16 - halfWidth, abs(q.y) - halfHeight);
}

void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  p.x *= uResolution.x / max(1.0, uResolution.y);
  float cameraPush = sin(uTime * 0.16 + uVariation.x * 6.0) * uCameraTravel;
  p *= 1.0 + cameraPush * 0.08;
  p.y += cameraPush * 0.035;

  vec3 color = vec3(0.002, 0.003, 0.007);
  float scale = uGateScale;
  float opening = clamp(uOpeningAmount + uDrop * 0.32 + uBass * 0.08, 0.0, 1.0);
  float gateHalf = mix(0.10, scale * 0.48, opening);

  float depthGlow = 0.0;
  int depthSteps = int(mix(3.0, 8.0, uQuality / 3.0));
  for (int i = 0; i < 8; i++) {
    if (i >= depthSteps) break;
    float fi = float(i);
    float inset = fi / max(1.0, float(depthSteps - 1));
    vec2 q = p * (1.0 + inset * uSlabDepth * 0.65);
    float frame = min(
      abs(abs(q.x) - (scale * 0.54 + inset * 0.08)),
      abs(abs(q.y + 0.02) - (scale * 0.72 + inset * 0.06))
    );
    depthGlow += smoothstep(0.020 + inset * 0.010, 0.0, frame) * exp(-inset * 2.1);
  }
  color += mix(uSecondary, uPrimary, 0.42) * depthGlow * (0.13 + uSectionIntensity * 0.10);

  int columns = int(uColumnCount);
  for (int i = 0; i < 9; i++) {
    if (i >= columns) break;
    float t = columns <= 1 ? 0.5 : float(i) / float(columns - 1);
    float x = mix(-scale, scale, t);
    float dist = columnDistance(p, x, 0.055 + uSlabDepth * 0.018, scale * 0.82);
    float body = smoothstep(0.035, 0.0, dist);
    float rim = smoothstep(0.018, 0.0, abs(dist));
    float alternating = mod(float(i), 2.0);
    vec3 stone = mix(uSecondary * 0.16, uPrimary * 0.22, alternating);
    color = mix(color, stone, body * 0.92);
    color += mix(uPrimary, uAccent, alternating) * rim * (0.20 + uDownbeat * 0.95);

    vec2 glyphUv = vec2((p.x - x) / 0.11, (p.y + scale * 0.78) * (7.0 + uGlyphDensity * 11.0));
    float glyphCell = hash21(floor(glyphUv));
    float glyphLine = smoothstep(0.11, 0.02, abs(fract(glyphUv.y) - 0.5));
    glyphLine *= step(1.0 - uGlyphDensity, glyphCell) * body;
    color += uAccent * glyphLine * (0.18 + uHigh * 0.9 + uDownbeat * 0.8);
  }

  float topSlab = smoothstep(0.05, 0.0, sdBox(p - vec2(0.0, -scale * 0.78), vec2(scale * 1.16, 0.08 + uSlabDepth * 0.035)));
  float lowerSlab = smoothstep(0.05, 0.0, sdBox(p - vec2(0.0, scale * 0.84), vec2(scale * 1.08, 0.065)));
  color = mix(color, uSecondary * 0.20, max(topSlab, lowerSlab));

  float doorway = 1.0 - smoothstep(gateHalf, gateHalf + 0.028, abs(p.x));
  doorway *= 1.0 - smoothstep(scale * 0.76, scale * 0.82, abs(p.y));
  float innerDepth = 0.45 + 0.55 * noise21(p * 5.0 + vec2(0.0, -uTime * 0.08));
  vec3 gateLight = mix(uPrimary, uAccent, innerDepth + uHigh * 0.25);
  color = mix(color, gateLight * (0.24 + innerDepth * 0.55 + uDrop * 0.55), doorway);

  int rings = int(uRingCount);
  for (int i = 0; i < 6; i++) {
    if (i >= rings) break;
    float fi = float(i);
    float radius = gateHalf + 0.07 + fi * 0.075;
    float ring = smoothstep(0.018, 0.0, abs(length(p * vec2(1.0, 1.28)) - radius));
    color += mix(uPrimary, uAccent, fi / 6.0) * ring * (0.24 + uBass * 0.55 + uDownbeat * 0.9);
  }

  float lockSeam = smoothstep(0.025, 0.0, abs(p.x));
  lockSeam *= smoothstep(scale * 0.78, 0.0, abs(p.y));
  color += uAccent * lockSeam * uLockStrength * (1.0 - opening) * (0.35 + uBeat);

  float shaft = smoothstep(gateHalf * 1.15, 0.0, abs(p.x));
  shaft *= smoothstep(scale * 0.80, -scale * 0.65, p.y);
  shaft *= 0.5 + 0.5 * noise21(vec2(p.x * 18.0, p.y * 2.0 - uTime * 0.11));
  color += gateLight * shaft * uLightShaftIntensity * (0.10 + uVolume * 0.18 + uDownbeat * 0.22);

  color *= smoothstep(1.65, 0.22, length(p));
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

export const CINEMATIC_WORLD_SHADER_SOURCES = {
  eventHorizon: EVENT_HORIZON_FRAGMENT_SOURCE,
  infiniteCorridor: INFINITE_CORRIDOR_FRAGMENT_SOURCE,
  fractureRift: FRACTURE_RIFT_FRAGMENT_SOURCE,
  monolithGate: MONOLITH_GATE_FRAGMENT_SOURCE,
} as const
