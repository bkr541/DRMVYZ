export const EVERYWHERE_SCREEN_VERTEX = /* glsl */ `
attribute vec4 aProgram; // exposure, seed, aspect, hero
attribute vec4 aEyePose; // gaze x/y, blink, roll back
varying vec2 vUv;
varying vec2 vWall;
varying vec2 vCabinet;
varying vec4 vProgram;
varying vec4 vEyePose;
void main() {
  vec4 local = instanceMatrix * vec4(position,1.0);
  vUv = uv;
  vWall = local.xy / vec2(19.0,10.0) + .5;
  vCabinet = instanceMatrix[3].xy / vec2(19.0,10.0) + .5;
  vProgram = aProgram;
  vEyePose = aEyePose;
  gl_Position = projectionMatrix * modelViewMatrix * local;
}`

export const EVERYWHERE_SCREEN_FRAGMENT = /* glsl */ `
uniform sampler2D uEye;
uniform sampler2D uMedia;
uniform sampler2D uPool0;
uniform sampler2D uPool1;
uniform sampler2D uPool2;
uniform vec3 uPoolAspect; // zero means no ready feed
uniform vec4 uProgram; // CRT mode, channel step, kick, snare
uniform vec4 uMusic; // bass, high, build, drop
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
varying vec2 vCabinet;
varying vec4 vProgram;
varying vec4 vEyePose;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx)*.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
vec3 linearColor(vec3 v) { return pow(max(v,vec3(0.0)),vec3(2.2)); }

// Eye UVs are bottom-up, unlike the borrowed image. Landmarks are calibrated
// to the packaged 4:3 eye texture, not to user-provided pictures.
vec3 eyeSample(vec2 uv) {
  return linearColor(texture2D(uEye,clamp(vec2(uv.x,1.0-uv.y),.001,.999)).rgb);
}
float irisMask(vec2 uv, vec2 center) {
  return 1.0-smoothstep(.93,1.05,length((uv-center)/vec2(.315,.425)));
}
vec3 animatedEye(vec2 uv, vec4 pose) {
  vec3 original=eyeSample(uv);
  if (dot(abs(pose),vec4(1.0))<.001) return original;
  vec2 irisCenter=vec2(.50,.53);
  float side=clamp(abs(uv.x-.5)*2.0,0.0,1.0);
  float upper=.89-.42*pow(side,1.65);
  float lower=.175+.24*pow(side,1.65);
  float aperture=smoothstep(lower,lower+.035,uv.y)*(1.0-smoothstep(upper-.035,upper,uv.y));
  // Move the iris within a fixed lid aperture, not the entire photograph.
  // Reconstruct only newly exposed sclera from the source's two white regions.
  vec2 shift=vec2(pose.x*.18,pose.y*.15+pose.w*.56);
  float travel=smoothstep(.001,.065,length(shift));
  float whiteY=clamp(uv.y,.36,.63);
  vec3 sclera=mix(eyeSample(vec2(.095,whiteY)),eyeSample(vec2(.905,whiteY)),smoothstep(.30,.70,uv.x));
  vec3 emptyEye=mix(original,sclera,irisMask(uv,irisCenter));
  vec3 moved=mix(emptyEye,eyeSample(uv-shift),irisMask(uv-shift,irisCenter));
  vec3 picture=mix(original,moved,aperture*travel);
  // Pull the actual upper/lower lid pixels into the opening, forming a
  // curved closure with a lash crease. No black overlay or screen-wide squash.
  float blink=clamp(pose.z,0.0,1.0);
  float closeLine=mix(lower,upper,.19);
  float newUpper=mix(upper,closeLine,blink);
  float newLower=mix(lower,closeLine,blink);
  float upperY=mix(upper,1.0,clamp((uv.y-newUpper)/max(.01,1.0-newUpper),0.0,1.0));
  float lowerY=lower*clamp(uv.y/max(.01,newLower),0.0,1.0);
  vec3 upperLid=eyeSample(vec2(uv.x,upperY));
  vec3 lowerLid=eyeSample(vec2(uv.x,lowerY));
  float upperMask=smoothstep(newUpper-.012,newUpper+.012,uv.y);
  float lowerMask=1.0-smoothstep(newLower-.012,newLower+.012,uv.y);
  float closing=smoothstep(0.0,.07,blink);
  picture=mix(picture,upperLid,upperMask*closing);
  picture=mix(picture,lowerLid,lowerMask*closing);
  float crease=exp(-pow((uv.y-newUpper)/.009,2.0))*(1.0-smoothstep(.82,1.0,side));
  return picture*(1.0-.62*crease*blink);
}

vec4 poolPicture(sampler2D tex, float aspect, float screenAspect, vec2 uv) {
  vec2 fit = screenAspect > aspect ? vec2(1.0,aspect/screenAspect) : vec2(screenAspect/aspect,1.0);
  vec2 q = (uv-.5)*fit+.5;
  return texture2D(tex,clamp(vec2(q.x,1.0-q.y),.001,.999));
}

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
  float mode = uProgram.x;
  float tracking = exp(-pow((fract(vUv.y-uLook.x*.14+seed*.18)-.5)*13.0,2.0));
  if (mode == 3.0) curved.x += tracking * (.015+.05*uProgram.w) * sin(vUv.y*180.0+seed*12.0);
  if (mode == 1.0) curved.x += (hash(vec2(floor(vUv.y*65.0),floor(uLook.x*6.0)))-.5)*(.012+.035*uProgram.z);
  float row = sin(vUv.y*720.0)*.5+.5;
  float detail = 1.0-uLook.z*.14*row*(1.0-smoothstep(.0012,.0048,fwidth(vUv.y)));
  float line = exp(-pow((fract(vUv.y + uLook.x*.18+seed*.23)-.5)*8.0,2.0));
  vec3 picture = vec3(.036,.025,.017)*(1.0+hash(floor(curved*144.0))*1.5);
  if (uHasEye > .5) {
    // Do not mirror animated pictures: synchronized world-left/right gazes
    // must look in the same direction across all cabinets.
    picture = animatedEye(curved,vEyePose);
    // Lift the photographic feed only; opaque user media retains its prior exposure.
    picture = pow(max(picture,vec3(0.0)),vec3(.82))*1.16;
    float alternate = smoothstep(.52,.90,seed)*(1.0-vProgram.w);
    picture = mix(picture,picture*vec3(.80,1.05,1.16),alternate*.33);
  }
  if (uHasMedia > .5) {
    float screenAspect = uLayout > .5 ? 19.0/10.0 : vProgram.z;
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
  // A bounded set of shared feeds; every cabinet chooses a channel without
  // allocating a decoder or texture of its own. Span mode uses one wall feed.
  float channel = floor(seed*3.0);
  if (mode == 2.0) channel = floor((vCabinet.y+1.0)*3.0);
  if (mode == 3.0) channel = floor((vCabinet.x+1.0)*3.0);
  if (mode == 4.0) channel = floor(vCabinet.x*6.0)+floor(vCabinet.y*5.0);
  if (mode == 5.0) channel = floor(length(vCabinet-.5)*9.0);
  if (mode == 6.0) channel = vProgram.w>.5 ? 0.0 : floor(seed*3.0);
  if (uLayout > .5) channel = 0.0;
  channel = mod(channel+uProgram.y,3.0);
  // Fall through to another ready channel when a pool is small or loading.
  for (int i=0;i<3;i++) {
    if ((channel<.5 && uPoolAspect.x>0.0) || (channel>.5 && channel<1.5 && uPoolAspect.y>0.0) || (channel>1.5 && uPoolAspect.z>0.0)) break;
    channel=mod(channel+1.0,3.0);
  }
  vec2 poolUV=uLayout>.5 ? vWall : curved;
  float poolScreenAspect=uLayout>.5 ? 19.0/10.0 : vProgram.z;
  vec4 feed=vec4(0.0);
  if (channel<.5 && uPoolAspect.x>0.0) feed=poolPicture(uPool0,uPoolAspect.x,poolScreenAspect,poolUV);
  else if (channel<1.5 && channel>.5 && uPoolAspect.y>0.0) feed=poolPicture(uPool1,uPoolAspect.y,poolScreenAspect,poolUV);
  else if (channel>1.5 && uPoolAspect.z>0.0) feed=poolPicture(uPool2,uPoolAspect.z,poolScreenAspect,poolUV);
  picture=mix(picture,linearColor(feed.rgb),feed.a);
  float luma=dot(picture,vec3(.2126,.7152,.0722));
  float noise=hash(floor(vUv*vec2(330.0,190.0))+vec2(floor(uLook.x*12.0),seed*93.0));
  if (mode == 1.0) {
    // Brief, bounded snowy interference, leaving the programme readable.
    float snow=clamp(.08+.18*uProgram.z+.12*uMusic.y,0.0,.38);
    picture=mix(picture,vec3(noise*.65),snow*(.55+.45*tracking));
  } else if (mode == 2.0) {
    picture=mix(picture,luma*vec3(1.16,.87,.55),.40);
    picture*=1.0-.10*row;
  } else if (mode == 3.0) {
    picture=mix(picture,picture.brg,.13+.22*tracking*uProgram.w);
    picture+=vec3(noise*.14)*tracking*(.35+uProgram.w);
  } else if (mode == 4.0) {
    vec3 tint=mix(vec3(.72,1.05,1.18),vec3(1.18,.82,.69),step(1.0,channel));
    picture=mix(picture,picture*tint,.22+.20*uMusic.y);
  } else if (mode == 5.0) {
    float wave=exp(-pow((length(vWall-.5)-fract(uLook.x*.29)*.95)*9.0,2.0));
    picture*=.83+.30*wave+.20*uMusic.w*wave;
    picture+=uCool*wave*(.045+.10*uMusic.x);
  } else if (mode == 6.0) {
    picture=mix(picture,luma*vec3(.52,.87,1.16),.56);
    picture*=.82+.18*vProgram.w+.12*uMusic.z*vProgram.w;
    picture+=vec3(noise*.035);
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
