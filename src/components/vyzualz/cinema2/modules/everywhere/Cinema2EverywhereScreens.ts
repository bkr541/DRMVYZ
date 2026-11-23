export const EVERYWHERE_SCREEN_VERTEX = /* glsl */ `
attribute vec4 aProgram; // exposure, seed, aspect, hero
varying vec2 vUv;
varying vec2 vWall;
varying vec4 vProgram;
void main() {
  vec4 local = instanceMatrix * vec4(position,1.0);
  vUv = uv;
  vWall = local.xy / vec2(15.4,8.7) + .5;
  vProgram = aProgram;
  gl_Position = projectionMatrix * modelViewMatrix * local;
}`

export const EVERYWHERE_SCREEN_FRAGMENT = /* glsl */ `
uniform sampler2D uEye;
uniform sampler2D uMedia;
uniform float uHasEye;
uniform float uHasMedia;
uniform float uLayout;
uniform float uMediaAspect;
uniform float uMediaFit;
uniform float uMediaOpacity;
uniform vec4 uMediaTransform;
uniform float uMediaRotation;
uniform vec4 uLook; // phase, intensity, scan, glare
uniform vec2 uReaction; // wobble, interference
uniform vec3 uTint;
uniform vec3 uCool;
uniform vec3 uWarm;
varying vec2 vUv;
varying vec2 vWall;
varying vec4 vProgram;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx)*.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
vec3 linearColor(vec3 v) { return pow(max(v,vec3(0.0)),vec3(2.2)); }

void main() {
  vec2 p = vUv*2.0-1.0;
  vec2 edge = abs(p)-vec2(.81,.79);
  float mask = length(max(edge,0.0))+min(max(edge.x,edge.y),0.0)-.19;
  // Anti-alias the glass edge instead of discarding entire pixels at oblique angles.
  float glassAlpha = 1.0 - smoothstep(-.008, max(.005, fwidth(mask)), mask);
  if (glassAlpha <= .001) discard;
  float seed = vProgram.y;
  float r2 = dot(p,p);
  vec2 curved = .5 + p*(.50 - .048*r2);
  curved.x += .008 * uReaction.x * sin(vUv.y*24.0-uLook.x*4.0+seed*6.28);
  float row = sin(vUv.y*720.0)*.5+.5;
  float detail = 1.0-uLook.z*.14*row*(1.0-smoothstep(.0012,.0048,fwidth(vUv.y)));
  float line = exp(-pow((fract(vUv.y + uLook.x*.18+seed*.23)-.5)*8.0,2.0));
  vec3 picture = vec3(.036,.025,.017)*(1.0+hash(floor(curved*144.0))*1.5);
  if (uHasEye > .5) {
    vec2 signalUV = curved;
    signalUV.x = mix(signalUV.x,1.0-signalUV.x,step(.65,seed)*(1.0-vProgram.w));
    signalUV.x += (seed-.5)*.052*(1.0-vProgram.w);
    picture = linearColor(texture2D(uEye,clamp(vec2(signalUV.x,1.0-signalUV.y),.001,.999)).rgb);
    float alternate = smoothstep(.52,.90,seed)*(1.0-vProgram.w);
    picture = mix(picture,picture*vec3(.72,1.05,1.25),alternate*.46);
  }
  if (uHasMedia > .5) {
    float screenAspect = uLayout > .5 ? 15.4/8.7 : vProgram.z;
    vec2 source = uLayout > .5 ? vWall : curved;
    vec2 fit = vec2(1.0);
    if (uMediaFit < .5) fit = screenAspect > uMediaAspect ? vec2(screenAspect/uMediaAspect,1.0) : vec2(1.0,uMediaAspect/screenAspect);
    else if (uMediaFit < 1.5) fit = screenAspect > uMediaAspect ? vec2(1.0,uMediaAspect/screenAspect) : vec2(screenAspect/uMediaAspect,1.0);
    vec2 q = (source-.5)*fit/max(uMediaTransform.zw,vec2(.01));
    float c=cos(uMediaRotation),s=sin(uMediaRotation);
    source = mat2(c,-s,s,c)*q + uMediaTransform.xy;
    vec4 media = texture2D(uMedia,clamp(vec2(source.x,1.0-source.y),0.0,1.0));
    float inside = step(0.0,source.x)*step(source.x,1.0)*step(0.0,source.y)*step(source.y,1.0);
    // The media alpha and fit mask determine the blend. Transparent pixels must
    // reveal the original eye feed, not punch black holes into it.
    picture = mix(picture,linearColor(media.rgb),clamp(media.a * inside * uMediaOpacity,0.0,1.0));
  }
  float edgeFalloff = 1.0-.26*dot(p*vec2(.82,1.0),p*vec2(.82,1.0));
  float rim = exp(-abs(mask+.055)*28.0);
  float glint = exp(-pow((p.y - .66 + p.x*.28)*7.1,2.0)) * exp(-pow((p.x+.48)*2.3,2.0));
  vec3 glass = (uCool*(.21*glint + rim*.043*max(0.0,-p.x)) + uWarm * rim*.067*max(0.0,p.x))*uLook.w;
  float breakUp = 1.0-uReaction.y*line*.38;
  vec3 rgb = picture*uTint*detail*edgeFalloff*breakUp*uLook.y*vProgram.x + glass;
  gl_FragColor=vec4(rgb,glassAlpha);
  #include <colorspace_fragment>
}`
