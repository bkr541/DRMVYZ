/** The score operates on the original emissive texture, never on replacement geometry. */
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
  orbitColor: [.92, .38, .12, 1], structureColor: [.09, .10, .12, 1],
  backgroundColor: [.006, .009, .015, 1],
} as const
export const SIGNS_PALETTE_LABELS = { signTint: 'Original Neon Tint', accentColor: 'Signal Accent', orbitColor: 'Outer Markers', structureColor: 'Dark Structure', backgroundColor: 'Background' } as const
export const SIGNS_SCALARS = [
  ['intensity', 'Intensity', 'master-controls', 1, 0, 2],
  ['reactivity', 'Audio Reactivity', 'master-controls', .65, 0, 1],
  ['rotationRate', 'Rotation Rate', 'design', .65, 0, 2],
  ['chaseRate', 'Chase Rate', 'design', 1, 0, 2],
  ['chaseDepth', 'Chase Depth', 'design', .65, 0, 1],
  ['accentMix', 'Signal Accent', 'design', .35, 0, 1],
  ['markerLevel', 'Outer Markers', 'design', .45, 0, 1.5],
  ['bloom', 'Bloom', 'effects', .38, 0, 1],
  ['finishMix', 'Cinematic Finish', 'effects', 1, 0, 1],
] as const
export const SIGNS_DEFAULTS = Object.fromEntries(SIGNS_SCALARS.map(([key,, , value]) => [key, value])) as Record<typeof SIGNS_SCALARS[number][0], number>
const tau = Math.PI * 2
/** Four-beat phase is shared by shader and surrounding practical fixtures. Smooth masks avoid hard flashes. */
export function signsMask(pattern: SignsPattern, angle: number, radius: number, phase: number): number {
  const wave = (v: number) => .5 + .5 * Math.cos(v)
  const a = angle * tau, p = phase * tau
  switch (pattern) {
    case 'signal-breath': return .65 + .35 * wave(p)
    case 'radial-relay': return wave(a - p) ** 3
    case 'counter-sweep': return Math.max(wave(a * 2 - p) ** 4, .55 * wave(a * 2 + p) ** 4)
    case 'cross-talk': return wave(a * 4 + Math.PI * Math.sin(p)) ** 2
    case 'inward-lock': return wave(radius * 12 + p * 2) ** 3
    case 'full-contact': return .45 + .55 * wave(p * 2 - radius * 8) ** 2
    case 'orbit-code': return wave(a * 6 - p * 2) ** 4
    case 'afterimage': return Math.max(wave(a - p) ** 5, .45 * wave(a - p + 1.1) ** 3, .2 * wave(a - p + 2.2) ** 2)
  }
}
/** GLSL mirrors signsMask; all eight masks are evaluated from UVs in a single material pass. */
export const SIGNS_MASK_GLSL = `
float signsWave(float x) { return .5 + .5*cos(x); }
float signsMask(int i, float a, float r, float p) {
 if(i==0) return .65+.35*signsWave(p);
 if(i==1) return pow(signsWave(a-p),3.);
 if(i==2) return max(pow(signsWave(a*2.-p),4.),.55*pow(signsWave(a*2.+p),4.));
 if(i==3) return pow(signsWave(a*4.+3.14159265*sin(p)),2.);
 if(i==4) return pow(signsWave(r*12.+p*2.),3.);
 if(i==5) return .45+.55*pow(signsWave(p*2.-r*8.),2.);
 if(i==6) return pow(signsWave(a*6.-p*2.),4.);
 return max(max(pow(signsWave(a-p),5.),.45*pow(signsWave(a-p+1.1),3.)),.2*pow(signsWave(a-p+2.2),2.));
}`
