/** Authored internal 16-beat phrase. No additional Inspector control or audio clock. */
export const CINEMA2_LOGO_CYCLE_BEATS = 16
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export function cinema2UserModelLogoCycle(beats: number) {
  const phase = ((beats % CINEMA2_LOGO_CYCLE_BEATS) + CINEMA2_LOGO_CYCLE_BEATS) % CINEMA2_LOGO_CYCLE_BEATS / CINEMA2_LOGO_CYCLE_BEATS
  const attack = smooth(.125, .375, phase), release = 1 - smooth(.625, .875, phase)
  // The intact model is visible for two beats at both ends; particle gathering precedes surface restoration.
  const amount = attack * release
  const dissolve = attack * (1 - smooth(.75, .875, phase))
  const particleSpread = attack * (1 - smooth(.625, .75, phase))
  // Real camera sweep peaks during the return, then resolves to the original framing.
  const orbitRadians = .85 * smooth(.25, .72, phase) * (1 - smooth(.72, 1, phase))
  return { phase, amount, dissolve, particleSpread, orbitRadians }
}
