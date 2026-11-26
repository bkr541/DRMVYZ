export const EVERYWHERE_SCREEN_VERTEX = /* glsl */ `
attribute vec4 aProgram; // exposure, seed, aspect, hero
attribute vec4 aMediaPose; // scale, offset x/y, rotation
attribute vec4 aMediaEffects; // power, channel, distortion, vertical stretch
attribute vec4 aEyePose; // gaze x/y, blink, roll back
varying vec2 vUv;
varying vec2 vWall;
varying vec2 vCabinet;
varying vec4 vProgram;
varying vec4 vEyePose;
varying vec4 vMediaPose;
varying vec4 vMediaEffects;
void main() {
  vec4 local = instanceMatrix * vec4(position,1.0);
  vUv = uv;
  vWall = local.xy / vec2(30.0,15.0) + .5;
  vCabinet = instanceMatrix[3].xy / vec2(30.0,15.0) + .5;
  vProgram = aProgram;
  vEyePose = aEyePose;
  vMediaPose = aMediaPose;
  vMediaEffects = aMediaEffects;
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
uniform float uSourceMode; // eyes, single, pool (including loading)
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
varying vec4 vMediaPose;
varying vec4 vMediaEffects;

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
// The photograph is a frontal projection of a curved eye. Work in globe
// coordinates (equal pixel radii for the 4:3 source), not translated UVs.
const vec2 eyeCenter=vec2(.50,.53);
const vec2 globeRadius=vec2(.62,.8266667);
float irisDistance(vec2 uv) {
  return length((uv-eyeCenter)/vec2(.315,.355));
}
float irisMask(vec2 uv) {
  return 1.0-smoothstep(.97,1.04,irisDistance(uv));
}
float eyeApertureUpper(float side) { return .865-.31*pow(side,1.85); }
float eyeApertureLower(float side) { return .168+.17*pow(side,2.1); }
vec3 scleraStrip(float x, float height) {
  float side=abs(x-.5)*2.0;
  return eyeSample(vec2(x,mix(eyeApertureLower(side),eyeApertureUpper(side),height)));
}
vec3 eyeGlobeNormal(vec2 uv) {
  vec2 p=(uv-eyeCenter)/globeRadius;
  return vec3(p,sqrt(max(0.0,1.0-dot(p,p))));
}
vec3 inverseEyeRotation(vec3 n, float yaw, float pitch) {
  // Inverse of yaw about vertical and pitch about horizontal. A positive
  // gaze moves the pupil right/up, and the far side of the iris foreshortens.
  float cy=cos(yaw), sy=sin(yaw), cp=cos(pitch), sp=sin(pitch);
  vec3 q=vec3(cy*n.x-sy*n.z,n.y,sy*n.x+cy*n.z);
  return vec3(q.x,cp*q.y-sp*q.z,sp*q.y+cp*q.z);
}
vec3 animatedEye(vec2 uv, vec4 pose) {
  vec3 original=eyeSample(uv);
  if (dot(abs(pose),vec4(1.0))<.001) return original;
  float side=clamp(abs(uv.x-.5)*2.0,0.0,1.0);
  float upper=.89-.42*pow(side,1.65);
  float lower=.175+.24*pow(side,1.65);
  vec3 picture=original;
  float yaw=pose.x*.34;
  float pitch=pose.y*.25+pose.w*.98;
  float travel=smoothstep(0.0,.012,length(vec2(yaw,pitch)));
  if (travel>0.0) {
    // Keep the photographed eyelids/lashes still. The more closely fitted
    // gaze aperture is separate from the existing blink closure geometry.
    float gazeUpper=eyeApertureUpper(side);
    float gazeLower=eyeApertureLower(side);
    float aperture=smoothstep(gazeLower,gazeLower+.018,uv.y)*(1.0-smoothstep(gazeUpper-.018,gazeUpper,uv.y));
    vec3 sourceNormal=inverseEyeRotation(eyeGlobeNormal(uv),yaw,pitch);
    vec2 sourceUV=eyeCenter+sourceNormal.xy*globeRadius;
    // Only the forward-facing hemisphere of the source can carry the iris;
    // without this check, a large upward roll could reveal a mirrored pupil.
    float movedIris=irisMask(sourceUV)*smoothstep(0.0,.04,sourceNormal.z);
    // Reveal sclera behind the rotating iris using the photographed whites.
    // Preserve the source eye everywhere not covered by the old or new iris.
    // Map two-dimensional white patches into the aperture, rather than
    // stretching single columns into horizontal bands. Feather beyond the
    // original dark limbus so no stationary iris outline remains.
    float height=mix(.10,.90,clamp((uv.y-gazeLower)/max(.01,gazeUpper-gazeLower),0.0,1.0));
    float leftX=.035+.115*clamp(uv.x/.65,0.0,1.0);
    float rightX=.965-.115*clamp((1.0-uv.x)/.65,0.0,1.0);
    vec3 sclera=mix(scleraStrip(leftX,height),scleraStrip(rightX,height),smoothstep(.25,.75,uv.x));
    float eraseIris=1.0-smoothstep(1.045,1.30,irisDistance(uv));
    vec3 emptyEye=mix(original,sclera,eraseIris);
    vec3 moved=mix(emptyEye,eyeSample(sourceUV),movedIris);
    picture=mix(original,moved,aperture*travel);
  }
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

vec2 contentUV(vec2 uv) {
  if (uLayout > .5 && uLayout < 1.5) return uv;
  vec2 q=(uv-.5-vMediaPose.yz)/max(.01,vMediaPose.x);
  q.y/=max(.1,vMediaEffects.w);
  float c=cos(vMediaPose.w),s=sin(vMediaPose.w);
  q=mat2(c,-s,s,c)*q;
  q.x+=vMediaEffects.z*.055*sin(q.y*65.0+uLook.x*9.0);
  return q+.5;
}
vec4 mediaPicture(sampler2D tex, float aspect, float screenAspect, vec2 uv, vec4 transform, float rotation) {
  vec2 fit=vec2(1.0);
  if (uMediaFit < .5) fit=screenAspect>aspect ? vec2(screenAspect/aspect,1.0) : vec2(1.0,aspect/screenAspect);
  else if (uMediaFit < 1.5) fit=screenAspect>aspect ? vec2(1.0,aspect/screenAspect) : vec2(screenAspect/aspect,1.0);
  vec2 q=(contentUV(uv)-.5)*fit/max(transform.zw,vec2(.01));
  float c=cos(rotation),s=sin(rotation);
  q=mat2(c,-s,s,c)*q+transform.xy;
  float inside=step(0.0,q.x)*step(q.x,1.0)*step(0.0,q.y)*step(q.y,1.0);
  vec4 result=texture2D(tex,clamp(vec2(q.x,1.0-q.y),0.0,1.0));
  result.a*=inside;
  if(vMediaEffects.z>.01) {
    vec2 offset=vec2(vMediaEffects.z*.012,0.0);
    vec4 echo=texture2D(tex,clamp(vec2(q.x,1.0-q.y)+offset,0.0,1.0));
    result.rgb.r=mix(result.r,echo.r,vMediaEffects.z*.6);
    result.a=max(result.a,echo.a*inside*vMediaEffects.z*.25);
  }
  return result;
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
  if (uSourceMode < .5 && uHasEye > .5) {
    // Do not mirror animated pictures: synchronized world-left/right gazes
    // must look in the same direction across all cabinets.
    picture = animatedEye(curved,vEyePose);
    // Lift the photographic feed only; opaque user media retains its prior exposure.
    picture = pow(max(picture,vec3(0.0)),vec3(.82))*1.16;
    float alternate = smoothstep(.52,.90,seed)*(1.0-vProgram.w);
    picture = mix(picture,picture*vec3(.80,1.05,1.16),alternate*.33);
  }
  bool span=uLayout>.5 && uLayout<1.5;
  float screenAspect=span ? 2.0 : vProgram.z;
  vec2 source=span ? vWall : curved;
  float channel=0.0;
  if (uSourceMode > .5) picture=vec3(.002,.003,.004);
  if (uSourceMode > .5 && uSourceMode < 1.5 && uHasMedia > .5) {
    vec4 media=mediaPicture(uMedia,uMediaAspect,screenAspect,source,uMediaTransform,uMediaRotation);
    picture=mix(picture,linearColor(media.rgb),clamp(media.a*uMediaOpacity,0.0,1.0));
  }
  if (uSourceMode > 1.5) {
    channel=mod((span ? 0.0 : vMediaEffects.y)+uProgram.y,3.0);
    for (int i=0;i<3;i++) {
      if ((channel<.5 && uPoolAspect.x>0.0) || (channel>.5 && channel<1.5 && uPoolAspect.y>0.0) || (channel>1.5 && uPoolAspect.z>0.0)) break;
      channel=mod(channel+1.0,3.0);
    }
    vec4 feed=vec4(0.0);
    vec4 identityTransform=vec4(.5,.5,1.0,1.0);
    if(channel<.5 && uPoolAspect.x>0.0) feed=mediaPicture(uPool0,uPoolAspect.x,screenAspect,source,identityTransform,0.0);
    else if(channel>.5 && channel<1.5 && uPoolAspect.y>0.0) feed=mediaPicture(uPool1,uPoolAspect.y,screenAspect,source,identityTransform,0.0);
    else if(channel>1.5 && uPoolAspect.z>0.0) feed=mediaPicture(uPool2,uPoolAspect.z,screenAspect,source,identityTransform,0.0);
    picture=mix(picture,linearColor(feed.rgb),feed.a);
  }
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
  float power=uSourceMode>.5 ? vMediaEffects.x : 1.0;
  vec3 rgb = power*picture*uTint*detail*edgeFalloff*breakUp*uLook.y*vProgram.x + glass;
  gl_FragColor=vec4(rgb,glassAlpha);
  #include <colorspace_fragment>
}`
