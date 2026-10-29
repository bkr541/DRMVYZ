/** Shared masks keep the human shell, textured GLB and eyes on the same reveal boundaries. */
export const SWITCH_IT_MOTION_GLSL = `
uniform float uAnimated;
uniform float uAudioLift;
uniform float uAudioCrest;
uniform float uAudioGlint;
uniform vec4 uWeights;
uniform float uReveal;
uniform float uPeel;
uniform float uCrown;
uniform float uMaster;
uniform float uRelief;
uniform float uReach;
uniform float uFragmentAmount;
uniform float uEyes;
uniform float uFlare;
uniform vec3 uShell;
uniform vec3 uRim;
uniform vec3 uEnergy;
uniform vec3 uSkull;
float switchEyeClearance(vec2 p){
 float d=min(length((p-vec2(.277,.22))/vec2(.21,.14)),length((p-vec2(-.277,.22))/vec2(.21,.14)));
 return smoothstep(1.0,1.35,d);
}
float switchNoise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float switchLateral(vec3 p){return p.x-(mix(2.1,-2.1,uReveal));}
float switchTwin(vec3 p){return abs(p.x)-mix(2.1,-.15,uReveal);}
float switchHumanField(vec3 p,float seed){
 float crown=uPeel*(.4+.6*smoothstep(-.9,.8,p.y))+uCrown*.3*smoothstep(.4,1.2,p.y)-seed;
 return dot(uWeights,vec4(switchLateral(p),switchTwin(p),uPeel-seed,crown));
}
float switchMaskField(vec3 p){
 float seed=switchNoise(floor(p.xy*120.0));
 float crown=(uPeel+uCrown*.45)*1.2-seed-.01;
 return dot(uWeights,vec4(switchLateral(p),switchTwin(p),uPeel*1.2-seed-.01,crown));
}
`
