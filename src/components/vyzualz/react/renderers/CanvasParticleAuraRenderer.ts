import type {
  CanvasFitMode,
  CanvasParticleQuality,
  CanvasPresetColorMode,
  CanvasPresetSettings,
} from '../ReactTypes'
import { ShaderCompiler } from '../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../shaders/runtime/ShaderProgram'

type CanvasParticleSourceElement = HTMLVideoElement | HTMLImageElement

export type CanvasParticlePoint = {
  baseX: number
  baseY: number
  luma: number
  alpha: number
  r: number
  g: number
  b: number
  seed: number
}

export type CanvasParticleQualityProfile = {
  sampleWidth: number
  sampleHeight: number
  gridWidth: number
  gridHeight: number
  minParticles: number
  maxParticles: number
  maxDpr: number
  videoSampleIntervalMs: number
  staticSampleIntervalMs: number
  areaDivisor: number
}

/**
 * Particle Aura consumes the same musical vocabulary as Shared Performance Core.
 * Values are normalized to 0..1 before they reach the shader.
 */
export type CanvasParticleAudioFrame = {
  bass: number
  mid: number
  high: number
  beat: number
  kick: number
  snare: number
  hat: number
  downbeat: number
  energy: number
  energyTrend: number
  spectralFlux: number
  tension: number
  buildProgress: number
  dropImpact: number
  phraseProgress: number
  sectionProgress: number
  fourBarProgress: number
  vocalEnergy: number
}

export const CANVAS_PARTICLE_QUALITY_PROFILES: Record<CanvasParticleQuality, CanvasParticleQualityProfile> = {
  low: {
    sampleWidth: 112,
    sampleHeight: 64,
    gridWidth: 144,
    gridHeight: 81,
    minParticles: 640,
    maxParticles: 2200,
    maxDpr: 1,
    videoSampleIntervalMs: 180,
    staticSampleIntervalMs: 900,
    areaDivisor: 460,
  },
  balanced: {
    sampleWidth: 176,
    sampleHeight: 100,
    gridWidth: 224,
    gridHeight: 126,
    minParticles: 1200,
    maxParticles: 5200,
    maxDpr: 1.5,
    videoSampleIntervalMs: 100,
    staticSampleIntervalMs: 760,
    areaDivisor: 250,
  },
  high: {
    sampleWidth: 256,
    sampleHeight: 144,
    gridWidth: 320,
    gridHeight: 180,
    minParticles: 2200,
    maxParticles: 9000,
    maxDpr: 2,
    videoSampleIntervalMs: 66,
    staticSampleIntervalMs: 620,
    areaDivisor: 150,
  },
}

export function resolveCanvasParticleQualityProfile(quality: CanvasParticleQuality): CanvasParticleQualityProfile {
  return CANVAS_PARTICLE_QUALITY_PROFILES[quality] ?? CANVAS_PARTICLE_QUALITY_PROFILES.balanced
}

export function clampCanvasParticleRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function seededCanvasParticleNoise(seed: number): number {
  const value = Math.sin(seed * 128.317 + 19.19) * 43758.5453
  return value - Math.floor(value)
}

export function isCanvasParticleSourceReady(source: CanvasParticleSourceElement | null): boolean {
  if (!source) return false
  if (source instanceof HTMLVideoElement) return source.readyState >= 2 && source.videoWidth > 0 && source.videoHeight > 0
  return source.complete && source.naturalWidth > 0 && source.naturalHeight > 0
}

export function getCanvasParticleSourceSize(source: CanvasParticleSourceElement): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight }
  return { width: source.naturalWidth, height: source.naturalHeight }
}

export function resolveCanvasParticleBudget(
  settings: CanvasPresetSettings,
  profile: CanvasParticleQualityProfile,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const areaBudget = Math.max(profile.minParticles, Math.floor((viewportWidth * viewportHeight) / profile.areaDivisor))
  const maxParticles = Math.min(profile.maxParticles, areaBudget)
  const target = profile.minParticles + settings.particleDensity * (maxParticles - profile.minParticles)
  return clampCanvasParticleRange(Math.round(target), profile.minParticles, maxParticles)
}

export function resolveCanvasParticleGrid(
  settings: CanvasPresetSettings,
  profile: CanvasParticleQualityProfile,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  const densityScale = 0.72 + clampCanvasParticleRange(settings.particleDensity, 0, 1) * 0.42
  const viewportAspect = Math.max(0.2, viewportWidth / Math.max(1, viewportHeight))
  const profileAspect = profile.gridWidth / Math.max(1, profile.gridHeight)
  const width = Math.max(64, Math.round(profile.gridWidth * densityScale))
  const height = Math.max(36, Math.round((profile.gridHeight * densityScale * profileAspect) / viewportAspect))
  return { width, height }
}

export function resolveCanvasParticleAdaptiveQuality({
  requested,
  current,
  fps,
  lowFpsWindows,
  highFpsWindows,
}: {
  requested: CanvasParticleQuality
  current: CanvasParticleQuality
  fps: number
  lowFpsWindows: number
  highFpsWindows: number
}): { quality: CanvasParticleQuality; lowFpsWindows: number; highFpsWindows: number } {
  const order: CanvasParticleQuality[] = ['low', 'balanced', 'high']
  const requestedIndex = order.indexOf(requested)
  const currentIndex = order.indexOf(current)
  const nextLowWindows = fps < 25 ? lowFpsWindows + 1 : 0
  const nextHighWindows = fps > 48 ? highFpsWindows + 1 : 0

  if (nextLowWindows >= 2 && currentIndex > 0) {
    return { quality: order[currentIndex - 1], lowFpsWindows: 0, highFpsWindows: 0 }
  }
  if (nextHighWindows >= 3 && currentIndex < requestedIndex) {
    return { quality: order[currentIndex + 1], lowFpsWindows: 0, highFpsWindows: 0 }
  }
  return { quality: current, lowFpsWindows: nextLowWindows, highFpsWindows: nextHighWindows }
}

function createCanvasParticleFallbackPoints(targetCount: number): CanvasParticlePoint[] {
  const points: CanvasParticlePoint[] = []
  const safeCount = Math.max(1, Math.round(targetCount))
  for (let index = 0; index < safeCount; index += 1) {
    const seed = index + 1
    const angle = seed * 2.399963
    const radius = Math.sqrt((index + 0.5) / safeCount) * 0.44
    const luma = 0.42 + seededCanvasParticleNoise(seed * 3.7) * 0.58
    points.push({
      baseX: 0.5 + Math.cos(angle) * radius,
      baseY: 0.5 + Math.sin(angle) * radius,
      luma,
      alpha: 0.72,
      r: 88 + Math.round(luma * 140),
      g: 176 + Math.round(luma * 70),
      b: 214 + Math.round(luma * 41),
      seed,
    })
  }
  return points
}

/**
 * Canvas2D compatibility sampler. The WebGL path no longer depends on CPU pixel
 * sampling; it uploads the live source texture every frame instead.
 */
export function sampleCanvasParticleSource({
  source,
  settings,
  sampleCanvas,
  profile,
  targetCount,
}: {
  source: CanvasParticleSourceElement | null
  settings: CanvasPresetSettings
  sampleCanvas: HTMLCanvasElement
  profile: CanvasParticleQualityProfile
  targetCount: number
}): CanvasParticlePoint[] {
  const safeTargetCount = Math.max(1, Math.round(targetCount))
  if (!source || !isCanvasParticleSourceReady(source)) return createCanvasParticleFallbackPoints(safeTargetCount)

  const sampleWidth = profile.sampleWidth
  const sampleHeight = profile.sampleHeight
  sampleCanvas.width = sampleWidth
  sampleCanvas.height = sampleHeight
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true })
  if (!sampleContext) return createCanvasParticleFallbackPoints(safeTargetCount)

  sampleContext.clearRect(0, 0, sampleWidth, sampleHeight)
  const sourceSize = getCanvasParticleSourceSize(source)
  const sourceAspect = sourceSize.width / Math.max(1, sourceSize.height)
  const sampleAspect = sampleWidth / sampleHeight
  let drawWidth = sampleWidth
  let drawHeight = sampleHeight
  let drawX = 0
  let drawY = 0
  if (sourceAspect > sampleAspect) {
    drawHeight = sampleWidth / sourceAspect
    drawY = (sampleHeight - drawHeight) / 2
  } else {
    drawWidth = sampleHeight * sourceAspect
    drawX = (sampleWidth - drawWidth) / 2
  }

  try {
    sampleContext.drawImage(source, drawX, drawY, drawWidth, drawHeight)
  } catch {
    return createCanvasParticleFallbackPoints(safeTargetCount)
  }

  let imageData: ImageData
  try {
    imageData = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight)
  } catch {
    return createCanvasParticleFallbackPoints(safeTargetCount)
  }

  const candidates: CanvasParticlePoint[] = []
  const threshold = 0.012 + settings.lumaThreshold * 0.075
  const stride = profile === CANVAS_PARTICLE_QUALITY_PROFILES.low && settings.particleDensity < 0.7 ? 2 : 1
  for (let y = 0; y < sampleHeight; y += stride) {
    for (let x = 0; x < sampleWidth; x += stride) {
      const index = (y * sampleWidth + x) * 4
      const r = imageData.data[index]
      const g = imageData.data[index + 1]
      const b = imageData.data[index + 2]
      const alpha = imageData.data[index + 3] / 255
      const luma = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
      const visible = alpha * (0.2 + luma * 0.8)
      if (visible <= threshold) continue
      const seed = (x + 1) * 0.731 + (y + 1) * 1.371
      candidates.push({
        baseX: (x + 0.5) / sampleWidth,
        baseY: (y + 0.5) / sampleHeight,
        luma,
        alpha,
        r,
        g,
        b,
        seed,
      })
    }
  }

  if (candidates.length === 0) return createCanvasParticleFallbackPoints(safeTargetCount)

  const points: CanvasParticlePoint[] = []
  const coverageCount = Math.min(safeTargetCount, candidates.length)
  const coverageStep = candidates.length / Math.max(1, coverageCount)
  for (let index = 0; index < coverageCount; index += 1) {
    const candidate = candidates[Math.min(candidates.length - 1, Math.floor((index + 0.5) * coverageStep))]
    points.push({ ...candidate, seed: candidate.seed + index * 0.019 })
  }
  for (let index = coverageCount; index < safeTargetCount; index += 1) {
    const candidate = candidates[index % candidates.length]
    const jitter = 0.0008 + settings.turbulence * 0.006
    points.push({
      ...candidate,
      baseX: clampCanvasParticleRange(candidate.baseX + (seededCanvasParticleNoise(index * 2.1) - 0.5) * jitter, 0, 1),
      baseY: clampCanvasParticleRange(candidate.baseY + (seededCanvasParticleNoise(index * 3.4) - 0.5) * jitter, 0, 1),
      seed: candidate.seed + index * 0.019,
    })
  }
  return points
}

const QUAD_VERT = new Float32Array([
  -1, -1, 0, 0,
   1, -1, 1, 0,
  -1,  1, 0, 1,
   1,  1, 1, 1,
])

const FULLSCREEN_VERTEX_SRC = /* glsl */`#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

const FEEDBACK_FRAGMENT_SRC = /* glsl */`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrevious;
uniform float uDecay;
uniform float uDiffusion;
uniform float uGlitch;
uniform float uSnare;
uniform float uTime;
uniform vec2 uFlow;
uniform vec2 uResolution;
out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 texel = 1.0 / max(uResolution, vec2(1.0));
  float row = floor(vUv.y * 42.0);
  float rowNoise = hash21(vec2(row, floor(uTime * 9.0)));
  float glitchGate = step(0.82 - uGlitch * 0.26 - uSnare * 0.28, rowNoise);
  vec2 glitchOffset = vec2((rowNoise - 0.5) * (uGlitch + uSnare) * 0.025 * glitchGate, 0.0);
  vec2 direction = uFlow * (0.35 + uDiffusion * 1.65) + glitchOffset;

  vec4 center = texture(uPrevious, vUv - direction);
  vec4 nearA = texture(uPrevious, vUv - direction * 1.8 + vec2(texel.x * 1.4, 0.0));
  vec4 nearB = texture(uPrevious, vUv - direction * 2.8 - vec2(texel.x * 1.4, 0.0));
  vec4 vertical = texture(uPrevious, vUv - direction * 1.2 + vec2(0.0, texel.y * 1.8));
  vec4 diffused = center * 0.54 + nearA * 0.18 + nearB * 0.16 + vertical * 0.12;
  float scanDecay = 0.92 + 0.08 * sin(gl_FragCoord.y * 1.7 + uTime * 2.0);
  fragColor = vec4(diffused.rgb * uDecay * scanDecay, diffused.a * uDecay);
}
`

const AURA_FRAGMENT_SRC = /* glsl */`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform vec2 uSourceResolution;
uniform vec2 uGrid;
uniform float uTime;
uniform float uIntensity;
uniform float uDensity;
uniform float uParticleSize;
uniform float uGlow;
uniform float uTrail;
uniform float uRgbSplit;
uniform float uGlitch;
uniform float uLumaThreshold;
uniform float uMotion;
uniform float uTurbulence;
uniform float uBassReactivity;
uniform float uBeatPulse;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uBeat;
uniform float uKick;
uniform float uSnare;
uniform float uHat;
uniform float uDownbeat;
uniform float uEnergy;
uniform float uEnergyTrend;
uniform float uSpectralFlux;
uniform float uTension;
uniform float uBuildProgress;
uniform float uDropImpact;
uniform float uPhraseProgress;
uniform float uSectionProgress;
uniform float uFourBarProgress;
uniform float uVocalEnergy;
uniform int uColorMode;
uniform int uFitMode;
uniform float uSourceScale;
uniform vec2 uSourcePosition;
uniform float uSourceRotation;
uniform bool uSourceReady;
out vec4 fragColor;

float saturate(float v) { return clamp(v, 0.0, 1.0); }
float hash11(float p) { return fract(sin(p * 127.1 + 311.7) * 43758.5453123); }
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
}

vec2 fitSourceUv(vec2 uv, out float inside) {
  float outputAspect = uResolution.x / max(1.0, uResolution.y);
  float sourceAspect = uSourceResolution.x / max(1.0, uSourceResolution.y);
  vec2 result = uv;
  inside = 1.0;
  if (uFitMode == 2) return result;

  if (uFitMode == 0) {
    if (sourceAspect > outputAspect) {
      float contentHeight = outputAspect / sourceAspect;
      result.y = (uv.y - 0.5) / max(0.0001, contentHeight) + 0.5;
    } else {
      float contentWidth = sourceAspect / outputAspect;
      result.x = (uv.x - 0.5) / max(0.0001, contentWidth) + 0.5;
    }
    inside = step(0.0, result.x) * step(result.x, 1.0) * step(0.0, result.y) * step(result.y, 1.0);
  } else {
    if (sourceAspect > outputAspect) {
      float crop = outputAspect / sourceAspect;
      result.x = (uv.x - 0.5) * crop + 0.5;
    } else {
      float crop = sourceAspect / outputAspect;
      result.y = (uv.y - 0.5) * crop + 0.5;
    }
  }
  return result;
}

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec2 inverseSourceTransform(vec2 uv) {
  vec2 centered = uv - 0.5 - uSourcePosition;
  float angle = -uSourceRotation;
  float c = cos(angle);
  float s = sin(angle);
  centered = mat2(c, s, -s, c) * centered;
  centered /= max(0.01, uSourceScale);
  return centered + 0.5;
}

vec3 paletteColor(float luma, float seed, float state) {
  vec3 deepBlue = vec3(0.025, 0.22, 0.72);
  vec3 cyan = vec3(0.08, 0.86, 1.0);
  vec3 mint = vec3(0.18, 1.0, 0.54);
  vec3 violet = vec3(0.68, 0.16, 1.0);
  vec3 base = mix(deepBlue, cyan, saturate(luma * 1.25 + state * 0.18));
  base = mix(base, mint, saturate(uBuildProgress * 0.72 + uEnergyTrend * 0.25));
  base = mix(base, violet, saturate(uSnare * 0.55 + uTension * 0.2 + uMid * 0.08 + seed * uRgbSplit * 0.18));
  return base;
}

void main() {
  vec2 screenUv = vUv;
  vec2 centered = screenUv - 0.5;
  float rowId = floor(screenUv.y * (24.0 + uGlitch * 46.0));
  float timeSlice = floor(uTime * (6.0 + uSnare * 12.0));
  float sliceNoise = hash21(vec2(rowId, timeSlice));
  float glitchDrive = saturate(uGlitch * (0.34 + uEnergy * 0.4) + uSnare * 0.82 + uDropImpact * 0.24);
  float sliceGate = step(0.82 - glitchDrive * 0.42, sliceNoise);
  float sliceShift = (sliceNoise - 0.5) * glitchDrive * sliceGate * (0.035 + uSpectralFlux * 0.045);

  float flowTime = uTime * (0.12 + uMotion * 0.55);
  vec2 flowField = vec2(
    noise21(centered * (3.5 + uTurbulence * 4.5) + vec2(flowTime, -flowTime * 0.7)),
    noise21(centered.yx * (4.0 + uTurbulence * 5.0) + vec2(-flowTime * 0.8, flowTime))
  ) - 0.5;
  float diffuseState = saturate(uTurbulence * 0.45 + uBuildProgress * 0.34 + uTension * 0.24 + uDropImpact * 0.26);
  vec2 distortedScreenUv = screenUv;
  distortedScreenUv.x += sliceShift;
  distortedScreenUv += flowField * uMotion * (0.006 + diffuseState * 0.026);
  distortedScreenUv += centered * uBass * uBassReactivity * (0.004 + uKick * 0.018 + uDownbeat * 0.012);

  float inside = 1.0;
  vec2 sourceUv = fitSourceUv(inverseSourceTransform(distortedScreenUv), inside);
  if (!uSourceReady || inside < 0.5) {
    float fallback = smoothstep(0.42, 0.0, length(centered)) * (0.12 + uEnergy * 0.18);
    vec3 fallbackColor = paletteColor(fallback, hash21(gl_FragCoord.xy), uEnergy);
    fragColor = vec4(fallbackColor * fallback * 0.45, fallback * 0.45);
    return;
  }

  vec2 sourceTexel = 1.0 / max(uSourceResolution, vec2(1.0));
  vec4 sourceBase = texture(uSource, sourceUv);
  float preLuma = luminance(sourceBase.rgb);
  float depthScanner = exp(-abs(fract(screenUv.x + uTime * (0.055 + uEnergy * 0.06)) - 0.5) * 19.0);
  vec2 depthDirection = normalize(vec2(
    sin(uTime * 0.41 + uPhraseProgress * 6.283),
    cos(uTime * 0.36 + uFourBarProgress * 6.283)
  ) + vec2(0.0001));
  float depthAmount = (preLuma - 0.42) * (
    uBass * uBassReactivity * 0.042 +
    uDropImpact * 0.055 +
    uBuildProgress * uTurbulence * 0.028 +
    depthScanner * uMotion * 0.018
  );
  sourceUv += depthDirection * depthAmount;
  sourceUv.x += sliceShift * (0.75 + preLuma * 1.25);

  vec2 cellId = floor(screenUv * uGrid);
  vec2 cellUv = fract(screenUv * uGrid) - 0.5;
  float seed = hash21(cellId);
  vec2 sampleJitter = (vec2(hash21(cellId + 17.0), hash21(cellId + 43.0)) - 0.5) * sourceTexel * (0.5 + uTurbulence * 1.7);
  vec2 redUv = sourceUv + vec2(uRgbSplit * (0.0015 + uSnare * 0.007), 0.0);
  vec2 blueUv = sourceUv - vec2(uRgbSplit * (0.0015 + uHigh * 0.005), 0.0);
  vec4 source = texture(uSource, sourceUv + sampleJitter);
  vec3 splitColor = vec3(
    texture(uSource, redUv).r,
    source.g,
    texture(uSource, blueUv).b
  );
  source.rgb = mix(source.rgb, splitColor, saturate(uRgbSplit * 0.9 + uSnare * 0.24));

  float luma = luminance(source.rgb);
  float lumaRight = luminance(texture(uSource, sourceUv + vec2(sourceTexel.x * 2.0, 0.0)).rgb);
  float lumaUp = luminance(texture(uSource, sourceUv + vec2(0.0, sourceTexel.y * 2.0)).rgb);
  float edge = saturate((abs(luma - lumaRight) + abs(luma - lumaUp)) * 4.8);
  float detail = max(luma, edge * (0.72 + uGlow * 0.48));
  float threshold = mix(0.015, 0.24, uLumaThreshold);
  float visible = smoothstep(threshold - 0.11, threshold + 0.055, detail + source.a * 0.018);
  float densityGate = step(seed, 0.64 + uDensity * 0.36 + edge * 0.18);

  float pulse = saturate(uKick * 0.7 + uBeat * uBeatPulse * 0.48 + uDownbeat * 0.52 + uDropImpact * 0.58);
  float radius = mix(0.17, 0.43, saturate(uParticleSize / 5.0));
  radius *= 0.72 + luma * 0.44 + pulse * 0.34;
  float dotMask = smoothstep(radius, radius * 0.34, length(cellUv));
  float streakMask = smoothstep(0.2 + uParticleSize * 0.018, 0.035, abs(cellUv.y))
    * smoothstep(0.53, 0.19, abs(cellUv.x));
  float blockMask = smoothstep(0.5, 0.32, max(abs(cellUv.x), abs(cellUv.y)));
  float glitchShape = saturate(glitchDrive * sliceGate + uSpectralFlux * 0.22);
  float particleMask = mix(dotMask, streakMask, glitchShape * 0.78);
  particleMask = mix(particleMask, blockMask, saturate(uDownbeat * 0.18 + uDropImpact * 0.24));

  float scanner = 0.8 + 0.2 * sin(gl_FragCoord.y * 1.6 + uTime * (2.0 + uHigh * 7.0));
  float microFlicker = 0.76 + 0.24 * sin(uTime * (11.0 + uHigh * 23.0) + seed * 44.0);
  float hatSpark = 1.0 + uHat * step(0.74, seed) * 1.45;
  float alpha = visible * densityGate * particleMask * scanner * microFlicker * hatSpark;
  alpha *= uIntensity * (0.68 + luma * 0.62 + edge * 0.55);

  float paletteState = saturate(uEnergy * 0.45 + uSectionProgress * 0.22 + uPhraseProgress * 0.18);
  vec3 color = source.rgb;
  if (uColorMode == 1) color = paletteColor(luma, seed, paletteState);
  if (uColorMode == 2) {
    color = paletteColor(luma, seed, paletteState);
    color = mix(color, source.rgb * vec3(0.42, 0.72, 1.08), 0.25 + uVocalEnergy * 0.28);
  }

  float whiteCore = pow(saturate(luma + edge * 0.72), 2.4) * (0.28 + uGlow * 0.82 + uDropImpact * 0.62);
  whiteCore += depthScanner * visible * (0.08 + uEnergy * 0.18 + uDownbeat * 0.24);
  color += vec3(0.72, 0.92, 1.0) * whiteCore;
  color *= 0.72 + uGlow * 1.18 + uEnergy * 0.42 + pulse * 0.62;
  color += paletteColor(luma, seed, paletteState) * edge * (0.22 + uGlow * 0.46);

  float halo = smoothstep(radius * 2.1, radius * 0.65, length(cellUv)) * uGlow * 0.25;
  alpha = saturate(alpha + visible * densityGate * halo * (0.35 + uTrail * 0.2));
  fragColor = vec4(color * alpha, alpha);
}
`

const BLIT_FRAGMENT_SRC = /* glsl */`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uExposure;
uniform float uOutputAlpha;
uniform float uGlow;
uniform vec2 uResolution;
out vec4 fragColor;
void main() {
  vec2 texel = 1.0 / max(uResolution, vec2(1.0));
  vec4 c = texture(uTex, vUv);
  vec3 bloom = (
    texture(uTex, vUv + vec2(texel.x * 2.0, 0.0)).rgb +
    texture(uTex, vUv - vec2(texel.x * 2.0, 0.0)).rgb +
    texture(uTex, vUv + vec2(0.0, texel.y * 2.0)).rgb +
    texture(uTex, vUv - vec2(0.0, texel.y * 2.0)).rgb
  ) * 0.25;
  vec3 hdr = c.rgb + bloom * uGlow * 0.34;
  vec3 mapped = vec3(1.0) - exp(-hdr * uExposure);
  float alpha = clamp(max(c.a, max(mapped.r, max(mapped.g, mapped.b)) * 0.9) * uOutputAlpha, 0.0, 1.0);
  fragColor = vec4(mapped * alpha, alpha);
}
`

export type CanvasParticleAuraRenderParams = {
  settings: CanvasPresetSettings
  audio: CanvasParticleAudioFrame
  source: CanvasParticleSourceElement | null
  fitMode: CanvasFitMode
  sourceTransform: { scale: number; positionX: number; positionY: number; rotation: number }
  qualityProfile: CanvasParticleQualityProfile
  timeSec: number
  pixelRatio: number
}

export type CanvasParticleAuraCreateResult =
  | { renderer: CanvasParticleAuraRenderer; error: null }
  | { renderer: null; error: string }

export function compositeCanvasParticleLayerToCapture({
  context,
  particleCanvas,
  settings,
  width,
  height,
}: {
  context: CanvasRenderingContext2D
  particleCanvas: HTMLCanvasElement | null
  settings: CanvasPresetSettings
  width: number
  height: number
}): boolean {
  if (!particleCanvas?.width || !particleCanvas.height || settings.particleDensity <= 0.02) return false
  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = clampCanvasParticleRange(settings.intensity * 0.96 + settings.glow * 0.12, 0, 1)
  context.filter = 'none'
  try {
    context.drawImage(particleCanvas, 0, 0, width, height)
  } catch {
    context.restore()
    return false
  }
  context.restore()
  return true
}

function canvasFitModeToUniform(fitMode: CanvasFitMode): number {
  return fitMode === 'contain' ? 0 : fitMode === 'cover' ? 1 : 2
}

function canvasColorModeToUniform(mode: CanvasPresetColorMode): number {
  return mode === 'original' ? 0 : mode === 'palette' ? 1 : 2
}

export class CanvasParticleAuraRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private readonly feedbackProgram: ShaderProgram
  private readonly auraProgram: ShaderProgram
  private readonly blitProgram: ShaderProgram
  private readonly quadVao: WebGLVertexArrayObject
  private readonly quadBuffer: WebGLBuffer
  private readonly sourceTexture: WebGLTexture
  private previousTexture: WebGLTexture | null = null
  private currentTexture: WebGLTexture | null = null
  private previousFbo: WebGLFramebuffer | null = null
  private currentFbo: WebGLFramebuffer | null = null
  private width = 1
  private height = 1
  private sourceWidth = 1
  private sourceHeight = 1
  private sourceReady = false
  private uploadedSource: CanvasParticleSourceElement | null = null
  private uploadedSourceTime = Number.NaN
  private initialized = false
  private disposed = false

  static create(canvas: HTMLCanvasElement): CanvasParticleAuraCreateResult {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })
    if (!gl) return { renderer: null, error: 'WebGL2 unavailable for CANVAS Particle Aura' }

    try {
      return { renderer: new CanvasParticleAuraRenderer(canvas, gl), error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Particle Aura WebGL initialization failed'
      return { renderer: null, error: message }
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas
    this.gl = gl
    const compiler = new ShaderCompiler(gl)

    const feedback = ShaderProgram.create(gl, compiler, {
      label: 'canvas-particle-aura-feedback',
      vertSrc: FULLSCREEN_VERTEX_SRC,
      fragSrc: FEEDBACK_FRAGMENT_SRC,
      attributes: { aPos: 0, aUv: 1 },
    })
    if (!feedback.program) throw new Error(`Particle Aura feedback shader failed: ${feedback.error.log}`)
    this.feedbackProgram = feedback.program

    const aura = ShaderProgram.create(gl, compiler, {
      label: 'canvas-particle-aura-reconstruction',
      vertSrc: FULLSCREEN_VERTEX_SRC,
      fragSrc: AURA_FRAGMENT_SRC,
      attributes: { aPos: 0, aUv: 1 },
    })
    if (!aura.program) throw new Error(`Particle Aura reconstruction shader failed: ${aura.error.log}`)
    this.auraProgram = aura.program

    const blit = ShaderProgram.create(gl, compiler, {
      label: 'canvas-particle-aura-blit',
      vertSrc: FULLSCREEN_VERTEX_SRC,
      fragSrc: BLIT_FRAGMENT_SRC,
      attributes: { aPos: 0, aUv: 1 },
    })
    if (!blit.program) throw new Error(`Particle Aura blit shader failed: ${blit.error.log}`)
    this.blitProgram = blit.program

    const quadVao = gl.createVertexArray()
    const quadBuffer = gl.createBuffer()
    const sourceTexture = gl.createTexture()
    if (!quadVao || !quadBuffer || !sourceTexture) throw new Error('Particle Aura could not allocate WebGL resources')
    this.quadVao = quadVao
    this.quadBuffer = quadBuffer
    this.sourceTexture = sourceTexture

    gl.bindVertexArray(quadVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERT, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
  }

  resize(width: number, height: number): void {
    if (this.disposed) return
    const safeWidth = Math.max(1, Math.floor(width))
    const safeHeight = Math.max(1, Math.floor(height))
    if (this.width === safeWidth && this.height === safeHeight && this.previousTexture && this.currentTexture) return
    this.width = safeWidth
    this.height = safeHeight
    this.canvas.width = safeWidth
    this.canvas.height = safeHeight
    this.releaseFramebuffers()
    this.previousTexture = this.createRenderTexture(safeWidth, safeHeight)
    this.currentTexture = this.createRenderTexture(safeWidth, safeHeight)
    this.previousFbo = this.createFramebuffer(this.previousTexture)
    this.currentFbo = this.createFramebuffer(this.currentTexture)
    this.initialized = false
  }

  render(params: CanvasParticleAuraRenderParams): void {
    if (this.disposed || !this.previousTexture || !this.currentTexture || !this.previousFbo || !this.currentFbo) return
    const gl = this.gl
    const { settings, audio, source, fitMode, sourceTransform, qualityProfile, timeSec } = params
    this.updateSourceTexture(source)

    gl.viewport(0, 0, this.width, this.height)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)

    if (!this.initialized || settings.trailAmount <= 0.01) {
      this.clearFramebuffer(this.previousFbo)
      this.clearFramebuffer(this.currentFbo)
      this.initialized = true
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.currentFbo)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const decay = clampCanvasParticleRange(0.68 + settings.trailAmount * 0.265, 0.64, 0.945)
    const flowX = Math.sin(timeSec * 0.37 + audio.phraseProgress * Math.PI * 2) * settings.motionAmount * 0.0028
      + audio.snare * settings.glitchAmount * 0.004
    const flowY = Math.cos(timeSec * 0.31 + audio.fourBarProgress * Math.PI * 2) * settings.motionAmount * 0.0022
      - audio.buildProgress * settings.turbulence * 0.0018

    gl.disable(gl.BLEND)
    this.feedbackProgram.activate()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.previousTexture)
    this.feedbackProgram.setSampler('uPrevious', 0)
    this.feedbackProgram.setFloat('uDecay', decay)
    this.feedbackProgram.setFloat('uDiffusion', settings.trailAmount * (0.35 + settings.turbulence * 0.65))
    this.feedbackProgram.setFloat('uGlitch', settings.glitchAmount)
    this.feedbackProgram.setFloat('uSnare', audio.snare)
    this.feedbackProgram.setFloat('uTime', timeSec)
    this.feedbackProgram.setVec2('uFlow', flowX, flowY)
    this.feedbackProgram.setVec2('uResolution', this.width, this.height)
    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.auraProgram.activate()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
    this.auraProgram.setSampler('uSource', 0)
    const grid = resolveCanvasParticleGrid(settings, qualityProfile, this.width, this.height)
    this.auraProgram.setVec2('uResolution', this.width, this.height)
    this.auraProgram.setVec2('uSourceResolution', this.sourceWidth, this.sourceHeight)
    this.auraProgram.setVec2('uGrid', grid.width, grid.height)
    this.auraProgram.setFloat('uTime', timeSec)
    this.auraProgram.setFloat('uIntensity', settings.intensity)
    this.auraProgram.setFloat('uDensity', settings.particleDensity)
    this.auraProgram.setFloat('uParticleSize', settings.particleSize)
    this.auraProgram.setFloat('uGlow', settings.glow)
    this.auraProgram.setFloat('uTrail', settings.trailAmount)
    this.auraProgram.setFloat('uRgbSplit', settings.rgbSplit)
    this.auraProgram.setFloat('uGlitch', settings.glitchAmount)
    this.auraProgram.setFloat('uLumaThreshold', settings.lumaThreshold)
    this.auraProgram.setFloat('uMotion', settings.motionAmount)
    this.auraProgram.setFloat('uTurbulence', settings.turbulence)
    this.auraProgram.setFloat('uBassReactivity', settings.bassReactivity)
    this.auraProgram.setFloat('uBeatPulse', settings.beatPulse)
    this.auraProgram.setFloat('uBass', audio.bass)
    this.auraProgram.setFloat('uMid', audio.mid)
    this.auraProgram.setFloat('uHigh', audio.high)
    this.auraProgram.setFloat('uBeat', audio.beat)
    this.auraProgram.setFloat('uKick', audio.kick)
    this.auraProgram.setFloat('uSnare', audio.snare)
    this.auraProgram.setFloat('uHat', audio.hat)
    this.auraProgram.setFloat('uDownbeat', audio.downbeat)
    this.auraProgram.setFloat('uEnergy', audio.energy)
    this.auraProgram.setFloat('uEnergyTrend', audio.energyTrend)
    this.auraProgram.setFloat('uSpectralFlux', audio.spectralFlux)
    this.auraProgram.setFloat('uTension', audio.tension)
    this.auraProgram.setFloat('uBuildProgress', audio.buildProgress)
    this.auraProgram.setFloat('uDropImpact', audio.dropImpact)
    this.auraProgram.setFloat('uPhraseProgress', audio.phraseProgress)
    this.auraProgram.setFloat('uSectionProgress', audio.sectionProgress)
    this.auraProgram.setFloat('uFourBarProgress', audio.fourBarProgress)
    this.auraProgram.setFloat('uVocalEnergy', audio.vocalEnergy)
    this.auraProgram.setInt('uColorMode', canvasColorModeToUniform(settings.particleColorMode))
    this.auraProgram.setInt('uFitMode', canvasFitModeToUniform(fitMode))
    this.auraProgram.setFloat('uSourceScale', Math.max(0.01, sourceTransform.scale))
    this.auraProgram.setVec2('uSourcePosition', sourceTransform.positionX / 100, -sourceTransform.positionY / 100)
    this.auraProgram.setFloat('uSourceRotation', sourceTransform.rotation * Math.PI / 180)
    this.auraProgram.setBool('uSourceReady', this.sourceReady)
    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.disable(gl.BLEND)
    this.blitProgram.activate()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.currentTexture)
    this.blitProgram.setSampler('uTex', 0)
    this.blitProgram.setFloat('uExposure', 1.05 + settings.glow * 0.82 + audio.dropImpact * 0.72)
    this.blitProgram.setFloat('uOutputAlpha', clampCanvasParticleRange(settings.intensity * 1.1 + settings.glow * 0.18, 0, 1.25))
    this.blitProgram.setFloat('uGlow', settings.glow)
    this.blitProgram.setVec2('uResolution', this.width, this.height)
    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.disable(gl.BLEND)
    this.swapFeedbackTargets()
  }

  clear(): void {
    if (this.disposed) return
    if (this.previousFbo) this.clearFramebuffer(this.previousFbo)
    if (this.currentFbo) this.clearFramebuffer(this.currentFbo)
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    this.initialized = false
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    this.releaseFramebuffers()
    gl.deleteTexture(this.sourceTexture)
    gl.deleteBuffer(this.quadBuffer)
    gl.deleteVertexArray(this.quadVao)
    this.feedbackProgram.dispose()
    this.auraProgram.dispose()
    this.blitProgram.dispose()
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.useProgram(null)
  }

  private updateSourceTexture(source: CanvasParticleSourceElement | null): void {
    if (!source || !isCanvasParticleSourceReady(source)) {
      this.sourceReady = false
      return
    }
    const sourceTime = source instanceof HTMLVideoElement ? source.currentTime : 0
    if (this.uploadedSource === source && Math.abs(sourceTime - this.uploadedSourceTime) < 0.00001) return

    const gl = this.gl
    const sourceSize = getCanvasParticleSourceSize(source)
    try {
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.bindTexture(gl.TEXTURE_2D, null)
      this.sourceWidth = Math.max(1, sourceSize.width)
      this.sourceHeight = Math.max(1, sourceSize.height)
      this.sourceReady = true
      this.uploadedSource = source
      this.uploadedSourceTime = sourceTime
    } catch {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.bindTexture(gl.TEXTURE_2D, null)
      this.sourceReady = false
    }
  }

  private clearFramebuffer(framebuffer: WebGLFramebuffer): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  private createRenderTexture(width: number, height: number): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('Particle Aura texture allocation failed')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return texture
  }

  private createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    const gl = this.gl
    const framebuffer = gl.createFramebuffer()
    if (!framebuffer) throw new Error('Particle Aura framebuffer allocation failed')
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer)
      throw new Error('Particle Aura framebuffer is incomplete')
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return framebuffer
  }

  private releaseFramebuffers(): void {
    const gl = this.gl
    if (this.previousFbo) gl.deleteFramebuffer(this.previousFbo)
    if (this.currentFbo) gl.deleteFramebuffer(this.currentFbo)
    if (this.previousTexture) gl.deleteTexture(this.previousTexture)
    if (this.currentTexture) gl.deleteTexture(this.currentTexture)
    this.previousFbo = null
    this.currentFbo = null
    this.previousTexture = null
    this.currentTexture = null
  }

  private swapFeedbackTargets(): void {
    ;[this.previousTexture, this.currentTexture] = [this.currentTexture, this.previousTexture]
    ;[this.previousFbo, this.currentFbo] = [this.currentFbo, this.previousFbo]
  }
}
