import type { Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'

export const GOONZ_EXTRA_PATTERNS = [
  { value: 'ricochet', label: 'Ricochet' },
  { value: 'helix', label: 'Helix' },
  { value: 'pressure-chamber', label: 'Pressure Chamber' },
  { value: 'impact-matrix', label: 'Impact Matrix' },
  { value: 'afterimage', label: 'Afterimage' },
  { value: 'overload', label: 'Overload' },
] as const
export type GoonzExtraPattern = typeof GOONZ_EXTRA_PATTERNS[number]['value']
export const GOONZ_PROGRAM_CADENCES = {
  'night-transit': 'phrase', relay: 'beat2', counterflow: 'beat4', shaft: 'bar',
  'signal-fault': 'beat2', gate: 'bar', ricochet: 'beat2', helix: 'bar',
  'pressure-chamber': 'bar4', 'impact-matrix': 'bar', afterimage: 'phrase', overload: 'beat2',
} as const satisfies Record<string, Cinema2AfterhoursTriggerId>
export function goonzPoolTrigger(pattern: keyof typeof GOONZ_PROGRAM_CADENCES): Cinema2AfterhoursTriggerId {
  return GOONZ_PROGRAM_CADENCES[pattern]
}

// The shared pattern controller owns entry and the shared beat clock owns time.
// Keep the long cycle bounded for shader precision, including during long sets.
export function goonzRoutineBeat(beat: number, start: number): number {
  return Math.max(0, beat - start) % 256
}

// Separate fixture and rail programs. All positions are in camera-relative bay
// units; fractional bay positions keep forward/reverse passes continuous as the
// geometry recycles. Long movements alternate across four 4-bar variations.
export const GOONZ_CHOREOGRAPHY_GLSL = `
uniform vec4 uGoonzTime; // routine beat, snare, downbeat, phrase
uniform vec4 uGoonzDesign; // perimeter, rail, complexity, silence
uniform vec4 uGoonzSpill; // wall strength, reach, casing, vocal
uniform vec4 uGoonzMedia; // screen choreography, readability, motion, CRT
uniform vec2 uGoonzSection; // section accent, unscaled director build
float gPacket(float x,float center,float width) { return 1.0-smoothstep(width*.28,width,abs(x-center)); }
float gPulse(float t,float subdivision) { return 1.0-smoothstep(.08,.78,fract(t*subdivision)); }
float gBank(float bank,float target) { return 1.0-step(.1,abs(bank-target)); }
float gLevel(float z,float bank,float lane,float seed,bool rail) {
  float t=uGoonzTime.x;
  float movement=floor(mod(t,32.0)/8.0);
  float local=mod(t,8.0);
  float variation=floor(t/32.0);
  float reverse=mod(movement+variation,2.0);
  float x=mix(z,11.0-z,reverse);
  float front=local*1.65-1.0;
  float density=clamp(uLook.z+.22*uGoonzDesign.z,0.0,1.0);
  float pick=smoothstep(1.0-density-.08,1.0-density+.05,seed);
  float group=mod(bank+lane+floor(z+.5)+variation,2.0);
  float p=gPulse(t,1.0), halfPulse=gPulse(t,2.0);
  float value=0.0;
  if (uPattern==0) {
    value=movement<1.0 ? pick*gPacket(z,8.0,3.2)*(.35+.65*p) : movement<2.0 ? pick*gBank(mod(bank,2.0),mod(floor(local/2.0),2.0)) : movement<3.0 ? gPacket(x,front,2.8)*(.55+.45*pick) : pick*.22*gPulse(t,.5);
  } else if (uPattern==1) {
    value=gPacket(x,front-(rail?1.2:bank*.48+lane*.24),movement==2.0?3.0:1.5);
    if (movement==3.0) value=max(value,gPacket(x,front-4.0,1.15)*halfPulse);
  } else if (uPattern==2) {
    float a=mix(x,11.0-x,mod(bank+movement,2.0));
    value=gPacket(a,front,1.7);
    if (local>3.0 && local<5.0) value=max(value,gPacket(z,5.5,2.4)*p);
  } else if (uPattern==3) {
    float target=mod(floor(local/(movement==2.0?1.0:2.0))+movement,2.0)*2.0+1.0;
    value=gBank(bank,target)*gPacket(x,front,3.2)+gBank(bank,mod(target+2.0,4.0))*halfPulse*.32;
    if (movement==3.0) value=max(value,gBank(mod(bank,2.0),0.0)*p*gPacket(z,5.0,4.5));
  } else if (uPattern==4) {
    float fault=hash(vec2(floor(z+.5)+floor(t*2.0)*13.0,bank*7.0+lane+variation));
    value=movement==0.0?pick*.45:movement==1.0?step(.67,fault)*halfPulse:movement==2.0?pick*step(.5,group)*p:pick*smoothstep(0.0,6.0,local);
  } else if (uPattern==5) {
    value=gPacket(x,front,1.15);
    if (movement==1.0) value=max(value,gPacket(x,front-3.2,1.0));
    if (movement>=2.0) value=max(gPacket(z,5.5-local*.85,1.15),gPacket(z,5.5+local*.85,1.15));
  } else if (uPattern==6) {
    float target=mod(floor(local*(movement==2.0?2.0:1.0))+variation,4.0);
    target=mix(target,mod(4.0-target,4.0),reverse);
    value=gBank(bank,target)*gPacket(x,front,2.8)+gBank(bank,mod(target+3.0,4.0))*gPacket(x,front-2.0,2.0)*.32;
  } else if (uPattern==7) {
    float turn=(x*(movement==2.0?.9:.48)-local*.85+bank*.25+lane*.09);
    value=(1.0-smoothstep(.06,.24,abs(fract(turn)-.5)))*(.55+.45*p);
  } else if (uPattern==8) {
    float gap=movement==3.0?local*.85:max(0.0,5.5-local*.85);
    value=max(gPacket(z,5.5-gap,1.3),gPacket(z,5.5+gap,1.3));
    if (movement==2.0) value*=local<6.0?.20:1.0;
  } else if (uPattern==9) {
    float target=mod(floor(local*(movement==3.0?2.0:1.0)),2.0);
    value=gBank(group,target)*(movement==3.0?halfPulse:p)*mix(.35,1.0,pick);
  } else if (uPattern==10) {
    float trail=front-x;
    value=max(gPacket(x,front,1.0),step(0.0,trail)*exp(-trail*.48)*step(trail,5.0)*.74);
    if (movement==3.0) value*=1.0-smoothstep(4.0,8.0,local);
  } else {
    float subdivisions=movement==0.0?1.0:movement==1.0?2.0:4.0;
    value=gBank(group,mod(floor(local*subdivisions),2.0))*gPulse(t,subdivisions)*mix(.35,1.0,pick);
    if (movement==3.0 && local>6.0) value=0.0;
  }
  // Secondary rail movement is offset from the panel packet and not tied to
  // a physical panel lane. Individual corners answer percussion independently.
  if (rail) value=max(value*.82,gPacket(11.0-x,front-1.8,1.15)*gBank(mod(bank,2.0),mod(floor(local/2.0),2.0))*.65);
  float kick=uAccents.x*gBank(group,0.0)*(uPattern==9?.96:.48);
  float snare=uGoonzTime.y*gBank(group,1.0)*(uPattern==4||rail?.86:.48);
  float down=uGoonzTime.z*gPacket(z,2.0+mod(movement*2.0,7.0),1.4)*.65;
  float phrase=uGoonzTime.w*gPacket(z,7.0,2.8)*gBank(mod(bank,2.0),mod(variation,2.0))*.45;
  float section=uGoonzSection.x*gPacket(z,5.5,2.6)*.45;
  // Director build chooses successive rhythmic subdivisions, spatial compression,
  // fixture recruitment and a sparse suspension. No full-field strobe.
  float build=uGoonzSection.y;
  float sub=build<.35?1.0:build<.70?2.0:4.0;
  float gap=mix(5.5,.5,build);
  float pressure=max(gPacket(z,5.5-gap,1.3+build),gPacket(z,5.5+gap,1.3+build));
  float recruit=step(seed,build*.88)*gBank(group,mod(floor(t*sub),2.0))*gPulse(t,sub);
  float charge=max(pressure*.75,recruit)*smoothstep(.12,.82,build);
  value=mix(value,max(value*.50,charge),build*.85*uGoonzDesign.z*min(1.0,uAccents.z/max(.001,build)));
  if (build>.90 && fract(t*.25)>.80) value*=mix(1.0,.14,uGoonzDesign.z);
  float drop=uAccents.w*gPacket(z,mix(10.5,1.2,uAccents.w),1.15+uAccents.w)*1.55;
  return clamp(max(value+kick+snare+down+phrase+section,drop)*(1.0-.92*uGoonzDesign.w),0.0,1.8);
}
`
