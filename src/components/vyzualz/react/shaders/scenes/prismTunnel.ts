import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { PRISM_RADIAL_TOPOLOGY_GLSL, PRISM_RADIAL_TOPOLOGY_LIMITS } from './prismRadialTopology'
import {
  PRISM_APERTURE_GLSL,
  PRISM_APERTURE_LIMITS,
} from './prismApertureController'
import {
  PRISM_DROP_TRANSFORMATION_LIMITS,
  PRISM_DROP_TRANSFORMATION_PARAMETER_ID,
} from './prismDropTransformationDirector'
import {
  PRISM_ECHO_AMOUNT_PARAMETER_ID,
  PRISM_ECHO_COUNT_PARAMETER_ID,
  PRISM_ECHO_DECAY_PARAMETER_ID,
  PRISM_ECHO_GLSL,
  PRISM_ECHO_LIMITS,
  PRISM_ECHO_SPACING_PARAMETER_ID,
} from './prismEchoSystem'
import {
  PRISM_FACET_CHOREOGRAPHY_LIMITS,
  PRISM_FACET_CHOREOGRAPHY_PARAMETER_ID,
  PRISM_FACET_ILLUMINATION_GLSL,
} from './prismFacetIlluminationChoreographer'
import {
  PRISM_ROTATION_DRAG_PARAMETER_ID,
  PRISM_ROTATION_DRIVE_PARAMETER_ID,
  PRISM_ROTATION_LIMITS,
  PRISM_ROTATION_TORQUE_PARAMETER_ID,
  createPrismRuntimeParameterController,
} from './prismRotationTorqueSystem'

export const PRISM_TUNNEL: ShaderDefinition = {
  id: 'shader-neon-tunnel',
  name: 'Prism Tunnel',
  description: 'Layered radial prism: rotating nebula backdrop, per-facet spectral petals that grow, branch, and interconnect, and section/phrase staging. Five authored colours drive the petals (Primary→Secondary gradient), backdrop, accents, and rim; harmony only drifts their hue.',
  category: 'generator',
  version: 7,

  fragSrc: `#version 300 es
precision highp float;

uniform float uTime;
uniform float uBeatPhase;
uniform float uBeatHit;
uniform float uBass;
uniform float uSnareHit;
uniform float uKickHit;
uniform float uEnergy;
uniform vec2  uResolution;
uniform float uAspect;

uniform float uSpeed;
uniform float uTunnelRadius;
uniform float uAperture;
uniform float uWarp;
uniform float uFogDensity;
uniform float uGlow;
uniform vec4  uPrimaryColor;
uniform vec4  uSecondaryColor;
uniform vec4  uBackgroundColor;
uniform vec4  uAccentColor;
uniform vec4  uRimColor;
uniform float uRotation;
uniform float uRotationMotion;
uniform float uRotationTorque;
uniform float uRotationDrag;
uniform float uFacetChoreography;
uniform float uFacetChaseIndex;
uniform float uFacetChaseStrength;
uniform float uFacetAlternate;
uniform float uFacetOpposing;
uniform float uFacetFlare;
uniform float uEchoAmount;
uniform float uEchoCount;
uniform float uEchoSpacing;
uniform float uEchoDecay;
uniform float uDropTransformation;

// master controls
uniform float uMasterIntensity;
uniform float uMasterMotion;
uniform float uMasterBassReactivity;
uniform float uMasterFogDensity;

// Music Intelligence — all optional. Any uniform the current MI frame cannot
// fill is uploaded as 0, so every reference below has a graceful fallback.
uniform float uSub;
uniform float uLowMid;
uniform float uMid;
uniform float uHighMid;
uniform float uHigh;
uniform float uAir;
uniform float uHatHit;
uniform float uDownbeatHit;
uniform float uSpectralCentroid;
uniform float uSpectralFlux;
uniform float uComplexity;
uniform float uEnergyLong;
uniform float uEnergyDelta;
uniform float uTension;
uniform float uBuildProgress;
uniform float uDropImpact;
uniform float uPhrase8Hit;
uniform float uPhrase16Hit;
uniform float uPhrase16Progress;
uniform float uSectionIntensity;
uniform float uSectionChangePulse;
uniform float uKeyCode;
uniform float uModeCode;
uniform float uKeyConfidence;
uniform float uChordConfidence;
uniform float uChordChangeHit;
uniform float uPitchNormalized;
uniform float uVocalEnergy;
uniform float uDrumEnergy;
uniform float uBassStemEnergy;
uniform float uInstrumentEnergy;
uniform float uOtherStemEnergy;
uniform float uHasHarmonics;
uniform float uHasSections;
uniform float uHasStems;

out vec4 fragColor;

${PRISM_RADIAL_TOPOLOGY_GLSL}
${PRISM_APERTURE_GLSL}
${PRISM_FACET_ILLUMINATION_GLSL}
${PRISM_ECHO_GLSL}

float saturate(float value) { return clamp(value, 0.0, 1.0); }

float radialBand(float radius, float center, float width) {
  return 1.0 - smoothstep(width, width * 2.1, abs(radius - center));
}

vec3 prismHsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

vec3 prismRgb2hsv(vec3 c) {
  vec4 k = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, k.wz), vec4(c.gb, k.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1.0e-10)), d / (q.x + 1.0e-10), q.x);
}

/* Rotate a colour hue by deltaHue turns, keeping its saturation and value:
   harmony / per-facet variation TINTS the authored palette, never replaces it. */
vec3 prismHsvShift(vec3 hsv, float deltaHue) {
  return prismHsv2rgb(vec3(fract(hsv.x + deltaHue), hsv.y, hsv.z));
}

float prismHash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float prismValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = prismHash21(i);
  float b = prismHash21(i + vec2(1.0, 0.0));
  float c = prismHash21(i + vec2(0.0, 1.0));
  float d = prismHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float prismFbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.55;
  for (int o = 0; o < 3; o++) {
    sum += amp * prismValueNoise(p);
    p = p * 2.03 + vec2(11.7, 5.3);
    amp *= 0.5;
  }
  return sum;
}

// Branchless tent-filter read of a 6-band spectrum by a 0..1 position — keeps
// the per-facet spectral mapping cheap and portable (no dynamic indexing).
float prismBand6(float t, float b0, float b1, float b2, float b3, float b4, float b5) {
  float x = clamp(t, 0.0, 1.0) * 5.0;
  return b0 * clamp(1.0 - abs(x - 0.0), 0.0, 1.0)
       + b1 * clamp(1.0 - abs(x - 1.0), 0.0, 1.0)
       + b2 * clamp(1.0 - abs(x - 2.0), 0.0, 1.0)
       + b3 * clamp(1.0 - abs(x - 3.0), 0.0, 1.0)
       + b4 * clamp(1.0 - abs(x - 4.0), 0.0, 1.0)
       + b5 * clamp(1.0 - abs(x - 5.0), 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  uv.x *= uAspect;

  float beat = uBeatHit * 0.4 + uKickHit * 0.3 + uSnareHit * 0.15;
  float bass = uBass * uMasterBassReactivity;
  float motion = uSpeed * uMasterMotion;

  // Master Intensity is the whole composition's amount, not an output gain: it
  // scales every discretionary layer (nebula, rings, petal swing, branches,
  // arcs, rim, drop burst) around a thin always-present prism skeleton. 1.0 is
  // the tuned look, 0.0 a bare wireframe, 2.0 fully cranked.
  float ix = clamp(uMasterIntensity, 0.0, 2.0);
  float ixCore = 0.4 + 0.6 * min(ix, 1.0) + max(ix - 1.0, 0.0) * 0.5;

  // ── Music Intelligence resolve (each term degrades to a compact fallback) ──
  float bSub  = max(uSub, uBass * 0.9);
  float bLow  = max(uLowMid, mix(uBass, uMid, 0.5));
  float bMid  = max(uMid, uEnergy * 0.4);
  float bHiM  = max(uHighMid, mix(uMid, uHigh, 0.5));
  float bHigh = max(uHigh, uSnareHit * 0.5);
  float bAir  = max(uAir, uHigh * 0.8 + uHatHit * 0.4);
  float timbre = clamp(max(uSpectralCentroid, bHigh * 0.6 + bAir * 0.4), 0.0, 1.0);
  float flux = clamp(max(uSpectralFlux, beat * 0.5), 0.0, 1.0);
  float complexity = clamp(max(uComplexity, flux * 0.5 + bHigh * 0.35), 0.0, 1.0);
  float slowEnergy = clamp(max(uEnergyLong, uEnergy), 0.0, 1.0);

  float build = clamp(max(uBuildProgress, uTension * 0.85), 0.0, 1.0);
  float dropE = clamp(max(uDropImpact, max(uEnergyDelta, 0.0)), 0.0, 1.0);
  float sectionEnergy = mix(clamp(uEnergy, 0.0, 1.0), clamp(uSectionIntensity, 0.0, 1.0), uHasSections);
  float sectionPulse = clamp(uSectionChangePulse, 0.0, 1.0);
  float isDrop = max(dropE, mix(0.0, step(0.62, sectionEnergy), uHasSections));
  float isCalm = clamp((1.0 - sectionEnergy) * 0.8 - build * 0.4 - isDrop, 0.0, 1.0);

  // Phrase evolution — a slow index that rotates the palette + band mapping.
  float phraseEvo = mix(fract(uTime * 0.0125), uPhrase16Progress, uHasSections);
  float evoRot = floor(phraseEvo * 4.0) * 0.19 + phraseEvo * 0.09;
  float phraseAccent = max(uPhrase8Hit, uPhrase16Hit);

  // A small, bounded hue drift the authored palette is nudged by — evolves
  // with phrases, warms/cools with mode, kicks on chord changes. The authored
  // colours below stay dominant; this only tints them.
  float modeWarm = mix(0.0, mix(-0.05, 0.05, clamp(uModeCode, 0.0, 1.0)), uHasHarmonics);
  float chordSweep = clamp(uChordChangeHit * uHasHarmonics, 0.0, 1.0);
  float keyTint = mix(0.0, (fract(uKeyCode / 12.0) - 0.5) * 0.10, uHasHarmonics);
  float hueDrift = evoRot * 0.5 + modeWarm + chordSweep * 0.12 + build * 0.06
    + timbre * 0.03 - isCalm * 0.03 + keyTint;

  // Stem-split drives — each falls back to a full-mix source.
  float bassBreath = mix(bass, clamp(uBassStemEnergy, 0.0, 1.0), uHasStems);
  float drumsDrive = mix(beat, clamp(uDrumEnergy + uSnareHit * 0.4, 0.0, 1.0), uHasStems);
  float vocalDrive = mix(bMid, clamp(uVocalEnergy, 0.0, 1.0), uHasStems);
  float otherDrive = mix(timbre, clamp(uOtherStemEnergy + uInstrumentEnergy * 0.5, 0.0, 1.0), uHasStems);

  float hazeAmount = uFogDensity * uMasterFogDensity;

  vec3 primary = uPrimaryColor.rgb;
  vec3 secondary = uSecondaryColor.rgb;
  vec3 bgHsv = prismRgb2hsv(uBackgroundColor.rgb);
  vec3 accentHsv = prismRgb2hsv(uAccentColor.rgb);
  vec3 rimHsv = prismRgb2hsv(uRimColor.rgb);

  // ═══ Layer 1 — moving background: rotating nebula + sonar rings + room tint ═══
  float bgR = length(uv);
  float bgRot = -uRotation * 0.35 - uTime * motion * 0.05;
  vec2 bgUv = vec2(uv.x * cos(bgRot) - uv.y * sin(bgRot), uv.x * sin(bgRot) + uv.y * cos(bgRot));
  vec2 nebWarp = vec2(
    prismFbm(bgUv * 1.7 + uTime * 0.03),
    prismFbm(bgUv * 1.7 - uTime * 0.021 + 7.0)
  );
  float neb = prismFbm(bgUv * 2.3 + nebWarp * 1.4 + vec2(0.0, uTime * 0.04));
  neb = pow(clamp(neb, 0.0, 1.0), 1.7);
  float nebBreath = 0.55 + 0.45 * sin(uTime * 0.2 + phraseEvo * 6.28318530718);
  float nebAmt = (0.07 + otherDrive * 0.17 + slowEnergy * 0.05 + isDrop * 0.06)
               * (0.55 + nebBreath * 0.45) * (0.35 + hazeAmount * 0.65) * ix;
  vec3 nebCol = prismHsvShift(bgHsv, hueDrift * 0.5 + neb * 0.1) * (0.8 + build * 0.4);
  vec3 col = nebCol * neb * nebAmt * smoothstep(0.12, 1.35, bgR);

  float ringPulse = max(uDownbeatHit, max(uPhrase8Hit, sectionPulse));
  for (int ri = 0; ri < 3; ri++) {
    float rf = float(ri);
    float ringT = fract(uTime * 0.19 + rf * 0.333);
    float ring = radialBand(bgR, ringT * 1.75, 0.013) * (1.0 - ringT);
    col += prismHsvShift(accentHsv, hueDrift * 0.4 + rf * 0.05) * ring * (0.045 + ringPulse * 0.5) * ix;
  }

  // ═══ Layer 2 — the prism field ═══
  float rotAng = uRotation + uRotationMotion * uMasterMotion;
  float cs = cos(rotAng);
  float sn = sin(rotAng);
  vec2 radialUv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs);

  // uTunnelRadius stays the persisted compatibility id — it owns the
  // center-anchored radial scale, breathing here with the (stem) bass.
  float baseRadius = uTunnelRadius * (1.0 + uKickHit * 0.045 + bassBreath * 0.05 + isDrop * 0.05);
  PrismRadialElement topologyElement = prismTopologyAt(radialUv, baseRadius, uWarp);
  PrismRadialElement element = prismApplyAperture(topologyElement, baseRadius, uAperture);
  float facetIllumination = prismFacetIlluminationWeight(
    element,
    uFacetChoreography,
    uFacetChaseIndex,
    uFacetChaseStrength,
    uFacetAlternate,
    uFacetOpposing,
    uFacetFlare
  );

  float sectorAngle = PRISM_TOPOLOGY_TAU / float(PRISM_TOPOLOGY_ELEMENT_COUNT);
  float local = element.localAngle / (sectorAngle * 0.5);
  float angularCore = 1.0 - smoothstep(0.58, 1.0 - build * 0.18, abs(local));
  float angularEdge = smoothstep(0.72, 0.96, abs(local)) * (1.0 - smoothstep(0.96, 1.0, abs(local)));

  // Per-facet reactivity from the live choreography uniforms — active even when
  // the Facet Choreography amount is 0, so the petals move by default.
  float chaseCenter = mod(floor(uFacetChaseIndex), float(PRISM_TOPOLOGY_ELEMENT_COUNT));
  float chaseOpp = mod(chaseCenter + float(PRISM_TOPOLOGY_ELEMENT_COUNT) * 0.5, float(PRISM_TOPOLOGY_ELEMENT_COUNT));
  float chaseProx = prismFacetPulse(element.index, chaseCenter);
  float oppProx = prismFacetPulse(element.index, chaseOpp);
  float altMask = 1.0 - step(1.0, mod(element.index + floor(chaseCenter), 2.0));
  float facetPunch = clamp(
    chaseProx * uFacetChaseStrength * 0.7
    + altMask * uFacetAlternate * 0.5
    + max(chaseProx, oppProx) * uFacetOpposing * 0.6
    + uFacetFlare * 0.9
    + drumsDrive * 0.35
    + isDrop * 0.5,
    0.0, 1.7
  );

  // Per-facet spectral height — each facet tracks a slice of the spectrum and
  // the slice -> facet mapping rotates every phrase.
  float bandPos = fract(element.normalizedIndex + evoRot * 0.5);
  float bandEnergy = prismBand6(bandPos, bSub, bLow, bMid, bHiM, bHigh, bAir);
  float melodyCurl = (uPitchNormalized - 0.5) * uHasHarmonics;
  float petalGrow = (bandEnergy * (0.85 + uMasterBassReactivity * 0.3) + facetPunch * 0.42) * ixCore;

  float grownInner = max(element.innerRadius * (1.0 - petalGrow * 0.12), baseRadius * 0.012);
  float grownOuter = element.outerRadius * (1.0 + petalGrow * 0.34);
  grownOuter += element.outerRadius * facetPunch * (1.0 - smoothstep(0.0, 0.34, abs(local))) * 0.2;

  float radius = length(radialUv);
  float curveWave = sin(local * 1.57079632679 + melodyCurl * 1.4) * uWarp * 0.055;
  float bassBend = sin(local * 3.14159265359 + element.normalizedIndex * 6.28318530718) * bass * 0.035;
  float shapedRadius = radius + curveWave + bassBend + element.curvature * 0.014;

  float innerFeather = max(0.012, baseRadius * 0.035);
  float outerFeather = max(0.02, baseRadius * 0.05);
  float insideOuter = 1.0 - smoothstep(grownOuter - outerFeather, grownOuter + outerFeather, shapedRadius);
  float outsideInner = smoothstep(grownInner - innerFeather, grownInner + innerFeather, shapedRadius);
  float facetMask = insideOuter * outsideInner * angularCore;

  float span = max(grownOuter - grownInner, 0.001);
  float radialT = saturate((shapedRadius - grownInner) / span);
  float phase = radialT * 12.0 - uTime * motion * 1.9 + element.normalizedIndex * 7.0;
  float arcA = 0.5 + 0.5 * sin(phase);
  float arcB = radialBand(radialT, 0.34 + sin(uTime * motion * 0.32 + element.index) * 0.025, 0.035);
  float arcC = radialBand(radialT, 0.71 + cos(uTime * motion * 0.24 - element.index) * 0.02, 0.028);
  float arcGlow = max(pow(arcA, 8.0), max(arcB, arcC));

  // ═══ Colour — the authored Primary→Secondary gradient IS the petal
  //    colour; harmony + per-facet position only drift its hue slightly. ═══
  vec3 facetBase = mix(primary, secondary, clamp(element.normalizedIndex * 0.85 + radialT * 0.15, 0.0, 1.0));
  vec3 facetColor = prismHsvShift(prismRgb2hsv(facetBase), hueDrift + element.normalizedIndex * 0.05 + radialT * 0.04);

  float facetLight = facetMask * (0.32 * (0.5 + 0.5 * min(ix, 1.0))
    + (arcA * 0.46 + arcGlow * (0.62 + beat * 1.3 + facetPunch * 0.9)) * ix);
  vec3 iridescent = prismHsvShift(rimHsv, local * 0.5 + timbre * 0.22 + uTime * 0.02);
  float rimLight = angularEdge * insideOuter * outsideInner * (0.36 + uGlow * 0.34 + bHigh * 0.35);
  vec3 col2 = facetColor * facetLight * facetIllumination + iridescent * rimLight * ix;

  vec3 arcColor = prismHsvShift(accentHsv, hueDrift * 0.6 + timbre * 0.2 + radialT * 0.08);
  col2 += arcColor * arcGlow * facetMask * (0.4 + facetPunch * 0.8) * facetIllumination * ix;

  col += col2;

  // ═══ Interconnection + branching petals ═══
  float linkRad = mix(grownInner, grownOuter, 0.52);
  float linkRing = radialBand(shapedRadius, linkRad, 0.02)
    * (0.1 + beat * 0.4 + uDownbeatHit * 0.5 + facetPunch * 0.35) * (1.0 - isCalm * 0.5);
  float branchN = 2.0 + floor(complexity * 4.0);
  float branchLobe = pow(0.5 + 0.5 * cos(local * branchN * 3.14159265359 + uTime * motion * 1.2), 3.0);
  float branchBand = smoothstep(grownOuter * 0.78, grownOuter * 1.05, shapedRadius)
    * (1.0 - smoothstep(grownOuter * 1.05, grownOuter * 1.32, shapedRadius));
  float branchGlow = branchLobe * branchBand * angularCore
    * (0.22 + flux * 0.7 + facetPunch * 0.5) * (1.0 - isCalm * 0.5);
  col += prismHsvShift(accentHsv, hueDrift + 0.12) * (linkRing + branchGlow) * ix;

  // Phrase-evolving detail ring — fades in and out across each 16-phrase window.
  float detailOpacity = smoothstep(0.05, 0.4, phraseEvo) * (1.0 - smoothstep(0.72, 1.0, phraseEvo));
  float detailRing = radialBand(shapedRadius, mix(grownInner, grownOuter, 0.86), 0.011);
  col += prismHsvShift(accentHsv, hueDrift + 0.2) * detailRing * detailOpacity * facetMask * 0.45 * ix;

  // Center aperture glow + halo — vocal-lifted. Keeps a floor so the core never
  // goes fully dark, then swings with the master amount.
  float apertureGlow = exp(-radius * (5.8 / max(baseRadius, 0.15))) * (0.22 + uGlow * 0.75)
    * (0.9 + uEnergy * 0.25) * (1.0 + vocalDrive * 0.7);
  float halo = exp(-abs(radius - grownInner) * (14.0 / max(baseRadius, 0.2))) * 0.42;
  col += mix(uRimColor.rgb, facetColor, 0.4)
    * (apertureGlow + halo * facetMask * facetIllumination + halo * vocalDrive * 0.5)
    * ixCore;

  float haze = exp(-radius * 1.35) * hazeAmount * 0.09;
  col += prismHsvShift(bgHsv, 0.08) * haze;

  col *= 1.0 + bass * 0.34;
  col += beat * facetColor * (0.16 + facetMask * 0.4);
  col = mix(col, vec3(1.0), uSnareHit * 0.26 + phraseAccent * 0.05 + sectionPulse * 0.12);

  // Drop burst.
  col += prismHsvShift(rimHsv, 0.33) * isDrop * (0.14 + facetMask * 0.5) * ix;

  // Stage 5 structural echoes reconstruct bounded prior radial descriptors, now
  // hue-fanned per slot off the palette anchor. Not framebuffer feedback.
  vec3 echoes = vec3(0.0);
  echoes += prismStructuralEcho(uv, uPrismEchoOpacity0, uPrismEchoRotation0, uPrismEchoRotationMotion0, uPrismEchoAperture0, uPrismEchoBaseRadius0, uPrismEchoCurvature0, uPrismEchoFacetAmount0, uPrismEchoChaseIndex0, uPrismEchoChaseStrength0, uPrismEchoAlternate0, uPrismEchoOpposing0, uPrismEchoFlare0, facetColor, arcColor);
  echoes += prismStructuralEcho(uv, uPrismEchoOpacity1, uPrismEchoRotation1, uPrismEchoRotationMotion1, uPrismEchoAperture1, uPrismEchoBaseRadius1, uPrismEchoCurvature1, uPrismEchoFacetAmount1, uPrismEchoChaseIndex1, uPrismEchoChaseStrength1, uPrismEchoAlternate1, uPrismEchoOpposing1, uPrismEchoFlare1, prismHsvShift(accentHsv, 0.12), arcColor);
  echoes += prismStructuralEcho(uv, uPrismEchoOpacity2, uPrismEchoRotation2, uPrismEchoRotationMotion2, uPrismEchoAperture2, uPrismEchoBaseRadius2, uPrismEchoCurvature2, uPrismEchoFacetAmount2, uPrismEchoChaseIndex2, uPrismEchoChaseStrength2, uPrismEchoAlternate2, uPrismEchoOpposing2, uPrismEchoFlare2, prismHsvShift(accentHsv, 0.24), arcColor);
  echoes += prismStructuralEcho(uv, uPrismEchoOpacity3, uPrismEchoRotation3, uPrismEchoRotationMotion3, uPrismEchoAperture3, uPrismEchoBaseRadius3, uPrismEchoCurvature3, uPrismEchoFacetAmount3, uPrismEchoChaseIndex3, uPrismEchoChaseStrength3, uPrismEchoAlternate3, uPrismEchoOpposing3, uPrismEchoFlare3, prismHsvShift(accentHsv, 0.36), arcColor);
  col += echoes * ixCore;

  // Only a gentle exposure trim survives as a direct multiply — the amount work
  // is done per-layer above so the slider reshapes the composition, not just
  // its brightness.
  col *= 0.72 + 0.28 * ix;

  // Tension / build chromatic stress at the frame edge.
  float caAmt = build * 0.5 + uTension * 0.3;
  float edgeAmt = smoothstep(0.5, 1.25, length(uv));
  col.r *= 1.0 + caAmt * edgeAmt * 0.22;
  col.b *= 1.0 + caAmt * edgeAmt * 0.22;
  col.g *= 1.0 - caAmt * edgeAmt * 0.1;

  float vignette = saturate(1.08 - dot(uv * 0.36, uv * 0.36));
  col *= vignette;
  col = pow(max(col, 0.0), vec3(0.454));

  fragColor = vec4(col, 1.0);
}
`,

  params: [
    {
      id: 'speed',
      type: 'float',
      label: 'Speed',
      uniformName: 'uSpeed',
      min: 0.1, max: 4.0, step: 0.05,
      default: 1.2,
      modulatable: true,
    },
    {
      id: 'tunnelRadius',
      type: 'float',
      label: 'Radial Scale',
      uniformName: 'uTunnelRadius',
      min: PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.min,
      max: PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.max,
      step: 0.05,
      default: PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.default,
      modulatable: true,
    },
    {
      id: 'aperture',
      type: 'float',
      label: 'Aperture',
      uniformName: 'uAperture',
      min: PRISM_APERTURE_LIMITS.min,
      max: PRISM_APERTURE_LIMITS.max,
      step: 0.01,
      default: PRISM_APERTURE_LIMITS.default,
      modulatable: true,
    },
    {
      id: 'warp',
      type: 'float',
      label: 'Warp',
      uniformName: 'uWarp',
      min: PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.min,
      max: PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.max,
      step: 0.05,
      default: PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.default,
      modulatable: true,
    },
    {
      id: 'fogDensity',
      type: 'float',
      label: 'Fog Density',
      uniformName: 'uFogDensity',
      min: 0.0, max: 3.0, step: 0.05,
      default: 1.0,
      modulatable: false,
    },
    {
      id: 'glow',
      type: 'float',
      label: 'Glow',
      uniformName: 'uGlow',
      min: 0.0, max: 3.0, step: 0.05,
      default: 1.0,
      modulatable: true,
    },
    {
      // No brandRole: Prism Tunnel consumes plain uPrimaryColor/uSecondaryColor,
      // not the uBrand* palette uniforms. Tagging these with a brandRole made the
      // Cinema shader adapter overwrite the authored Design-tab value with the
      // node's brand-palette colour every frame, so the control did nothing.
      id: 'primaryColor',
      type: 'color',
      label: 'Primary Color',
      uniformName: 'uPrimaryColor',
      default: [0.0, 0.9, 0.85, 1.0],
    },
    {
      id: 'secondaryColor',
      type: 'color',
      label: 'Secondary Color',
      uniformName: 'uSecondaryColor',
      default: [0.1, 0.9, 0.3, 1.0],
    },
    {
      // Plain colour uniforms (no brandRole) — the adapter passes the authored
      // Design-tab value straight through. Background drives the nebula backdrop
      // + haze, Accent the travelling arcs + branch web + sonar rings, Rim the
      // iridescent facet edge + centre glow + drop burst.
      id: 'backgroundColor',
      type: 'color',
      label: 'Background Color',
      uniformName: 'uBackgroundColor',
      default: [0.02, 0.05, 0.12, 1.0],
    },
    {
      id: 'accentColor',
      type: 'color',
      label: 'Accent Color',
      uniformName: 'uAccentColor',
      default: [0.55, 0.35, 1.0, 1.0],
    },
    {
      id: 'rimColor',
      type: 'color',
      label: 'Rim Color',
      uniformName: 'uRimColor',
      default: [0.6, 0.95, 1.0, 1.0],
    },
    {
      id: 'rotation',
      type: 'float',
      label: 'Rotation',
      uniformName: 'uRotation',
      min: -3.14159, max: 3.14159, step: 0.01,
      default: 0.0,
      modulatable: true,
    },
    {
      id: PRISM_ROTATION_DRIVE_PARAMETER_ID,
      type: 'float',
      label: 'Rotation Drive',
      uniformName: 'uRotationMotion',
      min: PRISM_ROTATION_LIMITS.drive.min,
      max: PRISM_ROTATION_LIMITS.drive.max,
      step: 0.01,
      default: PRISM_ROTATION_LIMITS.drive.default,
      modulatable: true,
    },
    {
      id: PRISM_ROTATION_TORQUE_PARAMETER_ID,
      type: 'float',
      label: 'Torque',
      uniformName: 'uRotationTorque',
      min: PRISM_ROTATION_LIMITS.torque.min,
      max: PRISM_ROTATION_LIMITS.torque.max,
      step: 0.01,
      default: PRISM_ROTATION_LIMITS.torque.default,
      modulatable: false,
    },
    {
      id: PRISM_ROTATION_DRAG_PARAMETER_ID,
      type: 'float',
      label: 'Drag',
      uniformName: 'uRotationDrag',
      min: PRISM_ROTATION_LIMITS.drag.min,
      max: PRISM_ROTATION_LIMITS.drag.max,
      step: 0.01,
      default: PRISM_ROTATION_LIMITS.drag.default,
      modulatable: false,
    },
    {
      id: PRISM_DROP_TRANSFORMATION_PARAMETER_ID,
      type: 'float',
      label: 'Drop Transformation',
      uniformName: 'uDropTransformation',
      group: 'React',
      min: PRISM_DROP_TRANSFORMATION_LIMITS.min,
      max: PRISM_DROP_TRANSFORMATION_LIMITS.max,
      step: 0.01,
      default: PRISM_DROP_TRANSFORMATION_LIMITS.default,
      modulatable: false,
    },
    {
      id: PRISM_FACET_CHOREOGRAPHY_PARAMETER_ID,
      type: 'float',
      label: 'Facet Choreography',
      uniformName: 'uFacetChoreography',
      group: 'React',
      min: PRISM_FACET_CHOREOGRAPHY_LIMITS.min,
      max: PRISM_FACET_CHOREOGRAPHY_LIMITS.max,
      step: 0.01,
      default: PRISM_FACET_CHOREOGRAPHY_LIMITS.default,
      modulatable: true,
    },
    {
      id: PRISM_ECHO_AMOUNT_PARAMETER_ID,
      type: 'float',
      label: 'Echo Amount',
      uniformName: 'uEchoAmount',
      group: 'React',
      min: PRISM_ECHO_LIMITS.amount.min,
      max: PRISM_ECHO_LIMITS.amount.max,
      step: 0.01,
      default: PRISM_ECHO_LIMITS.amount.default,
      modulatable: true,
    },
    {
      id: PRISM_ECHO_COUNT_PARAMETER_ID,
      type: 'float',
      label: 'Echo Count',
      uniformName: 'uEchoCount',
      group: 'React',
      min: PRISM_ECHO_LIMITS.count.min,
      max: PRISM_ECHO_LIMITS.count.max,
      step: 1,
      default: PRISM_ECHO_LIMITS.count.default,
      modulatable: false,
    },
    {
      id: PRISM_ECHO_SPACING_PARAMETER_ID,
      type: 'float',
      label: 'Echo Spacing',
      uniformName: 'uEchoSpacing',
      group: 'React',
      min: PRISM_ECHO_LIMITS.spacing.min,
      max: PRISM_ECHO_LIMITS.spacing.max,
      step: 0.01,
      default: PRISM_ECHO_LIMITS.spacing.default,
      unit: 's',
      modulatable: false,
    },
    {
      id: PRISM_ECHO_DECAY_PARAMETER_ID,
      type: 'float',
      label: 'Echo Decay',
      uniformName: 'uEchoDecay',
      group: 'React',
      min: PRISM_ECHO_LIMITS.decay.min,
      max: PRISM_ECHO_LIMITS.decay.max,
      step: 0.01,
      default: PRISM_ECHO_LIMITS.decay.default,
      modulatable: false,
    },
  ],

  defaults: {
    speed:         1.2,
    tunnelRadius:  PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.default,
    aperture:      PRISM_APERTURE_LIMITS.default,
    warp:          PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.default,
    fogDensity:    1.0,
    glow:          1.0,
    primaryColor:  [0.0, 0.9, 0.85, 1.0],
    secondaryColor:[0.1, 0.9, 0.3,  1.0],
    backgroundColor:[0.02, 0.05, 0.12, 1.0],
    accentColor:   [0.55, 0.35, 1.0,  1.0],
    rimColor:      [0.6,  0.95, 1.0,  1.0],
    rotation:      0.0,
    [PRISM_ROTATION_DRIVE_PARAMETER_ID]: PRISM_ROTATION_LIMITS.drive.default,
    [PRISM_ROTATION_TORQUE_PARAMETER_ID]: PRISM_ROTATION_LIMITS.torque.default,
    [PRISM_ROTATION_DRAG_PARAMETER_ID]: PRISM_ROTATION_LIMITS.drag.default,
    [PRISM_DROP_TRANSFORMATION_PARAMETER_ID]: PRISM_DROP_TRANSFORMATION_LIMITS.default,
    [PRISM_FACET_CHOREOGRAPHY_PARAMETER_ID]: PRISM_FACET_CHOREOGRAPHY_LIMITS.default,
    [PRISM_ECHO_AMOUNT_PARAMETER_ID]: PRISM_ECHO_LIMITS.amount.default,
    [PRISM_ECHO_COUNT_PARAMETER_ID]: PRISM_ECHO_LIMITS.count.default,
    [PRISM_ECHO_SPACING_PARAMETER_ID]: PRISM_ECHO_LIMITS.spacing.default,
    [PRISM_ECHO_DECAY_PARAMETER_ID]: PRISM_ECHO_LIMITS.decay.default,
  },

  quality: {
    minimumTier:       'low',
    recommendedTier:   'medium',
    estimatedPassCount: 1,
  },

  thumbnail: { color: '#063333' },

  tags: ['prism', 'radial', 'facets', 'spectral', 'harmonic', 'nebula'],

  createRuntimeParameterController: createPrismRuntimeParameterController,
}
