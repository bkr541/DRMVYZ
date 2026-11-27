/** The score operates on the original emissive texture and the expanded crop-circle field, never on replacement geometry. */
export const SIGNS_PATTERN_OPTIONS = [
  { value: 'signal-breath', label: 'Signal Breath' },
  { value: 'radial-relay', label: 'Radial Relay' },
  { value: 'counter-sweep', label: 'Counter Sweep' },
  { value: 'cross-talk', label: 'Cross Talk' },
  { value: 'inward-lock', label: 'Inward Lock' },
  { value: 'full-contact', label: 'Full Contact' },
  { value: 'orbit-code', label: 'Orbit Code' },
  { value: 'afterimage', label: 'Afterimage' },
] as const
export type SignsPattern = typeof SIGNS_PATTERN_OPTIONS[number]['value']
export const SIGNS_PATTERNS = SIGNS_PATTERN_OPTIONS.map(option => option.value)
export const SIGNS_DEFAULT_PATTERN: SignsPattern = 'signal-breath'
export const SIGNS_PALETTE = {
  signTint: [1, 1, 1, 1], accentColor: [.18, .88, 1, 1],
  orbitColor: [.92, .38, .12, 1], structureColor: [.035, .04, .05, 1],
  backgroundColor: [0, 0, 0, 1],
} as const
export const SIGNS_PALETTE_LABELS = { signTint: 'Original Neon Tint', accentColor: 'Signal Accent', orbitColor: 'Outer Field', structureColor: 'Dark Structure', backgroundColor: 'Background' } as const
export const SIGNS_SCALARS = [
  ['intensity', 'Intensity', 'master-controls', 1, 0, 2],
  ['reactivity', 'Audio Reactivity', 'master-controls', .65, 0, 1],
  ['rotationRate', 'Rotation Rate', 'design', .65, 0, 2],
  ['chaseRate', 'Chase Rate', 'design', 1, 0, 2],
  ['chaseDepth', 'Chase Depth', 'design', .72, 0, 1],
  ['accentMix', 'Signal Accent', 'design', .28, 0, 1],
  ['markerLevel', 'Line Expansion', 'design', .72, 0, 1.5],
  ['bloom', 'Bloom', 'effects', .48, 0, 1],
  ['finishMix', 'Cinematic Finish', 'effects', 1, 0, 1],
] as const
export const SIGNS_DEFAULTS = Object.fromEntries(SIGNS_SCALARS.map(([key,, , value]) => [key, value])) as Record<typeof SIGNS_SCALARS[number][0], number>
const tau = Math.PI * 2
/** Four-beat phase is shared by shader and the expanded field. Smooth masks avoid hard flashes. */
export function signsMask(pattern: SignsPattern, angle: number, radius: number, phase: number): number {
  const wave = (v: number) => .5 + .5 * Math.cos(v)
  const a = angle * tau, p = phase * tau
  switch (pattern) {
    case 'signal-breath': return .72 + .28 * wave(p)
    case 'radial-relay': return wave(a - p) ** 2.3
    case 'counter-sweep': return Math.max(wave(a * 2 - p) ** 3.25, .65 * wave(a * 2 + p) ** 3.1)
    case 'cross-talk': return wave(a * 4 + Math.PI * Math.sin(p)) ** 1.7
    case 'inward-lock': return wave(radius * 13.5 + p * 2) ** 2.6
    case 'full-contact': return .5 + .5 * wave(p * 2 - radius * 8.5) ** 1.9
    case 'orbit-code': return wave(a * 6 - p * 2) ** 3.2
    case 'afterimage': return Math.max(wave(a - p) ** 4.5, .55 * wave(a - p + 1.1) ** 3.2, .26 * wave(a - p + 2.2) ** 2.4)
  }
}
/** GLSL mirrors signsMask; all eight masks are evaluated from UVs in a single material pass. */
export const SIGNS_MASK_GLSL = `
float signsWave(float x) { return .5 + .5*cos(x); }
float signsMask(int i, float a, float r, float p) {
 if(i==0) return .72+.28*signsWave(p);
 if(i==1) return pow(signsWave(a-p),2.3);
 if(i==2) return max(pow(signsWave(a*2.-p),3.25),.65*pow(signsWave(a*2.+p),3.1));
 if(i==3) return pow(signsWave(a*4.+3.14159265*sin(p)),1.7);
 if(i==4) return pow(signsWave(r*13.5+p*2.),2.6);
 if(i==5) return .5+.5*pow(signsWave(p*2.-r*8.5),1.9);
 if(i==6) return pow(signsWave(a*6.-p*2.),3.2);
 return max(max(pow(signsWave(a-p),4.5),.55*pow(signsWave(a-p+1.1),3.2)),.26*pow(signsWave(a-p+2.2),2.4));
}`
