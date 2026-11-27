// Source assets are still leased through the shared three-channel pool. These
// functions only program presentation; they never allocate or switch decoders.
export const GOONZ_MEDIA_GLSL = `
int gChannel(float row,float bank,float lane,float z) {
  float move=floor(mod(uGoonzTime.x,32.0)/8.0);
  float stepBeat=floor(uGoonzTime.x/4.0);
  float group=row+bank+lane;
  if(uPattern==1||uPattern==6||uPattern==7) group+=stepBeat;
  else if(uPattern==2||uPattern==9) group=bank+lane+move+floor(row*.5);
  else if(uPattern==5) group=floor(z)+move;
  else if(uPattern==4||uPattern==11) group+=floor(uGoonzTime.x/2.0);
  else if(uPattern==3) group=bank+lane+move;
  int desired=int(mod(group+uPoolStep,float(max(1,uFeedCount))));
  for(int i=0;i<3;i++) {
    int c=(desired+i)%max(1,uFeedCount);
    if(uFeedAspect[c]>0.0) return c;
  }
  return desired;
}
float gScreenPower(float level,float role,float bank,float z) {
  float hero=uGoonzMedia.y*step(1.5,role);
  float hold=max(.20+.72*smoothstep(.10,.72,level),hero*.90);
  if(uPattern==4) hold*=mix(1.0,.38,uGoonzTime.y*uGoonzMedia.w);
  if(uPattern==8) hold=max(hold,.82);
  if(uPattern==11) hold*=mix(.55,1.0,gPulse(uGoonzTime.x,2.0));
  hold=max(hold,uAccents.w*(1.0-smoothstep(3.0,10.0,z)));
  hold=max(hold,uGoonzSpill.w*.85);
  return mix(1.0,clamp(hold*(1.0-.85*uGoonzDesign.w),0.0,1.0),uGoonzMedia.x);
}
vec2 gContentUV(vec2 uv,float bank,float seed) {
  float t=uGoonzTime.x;
  float motion=uGoonzMedia.z*(1.0-.75*uGoonzMedia.y)*(1.0-.8*uAccents.w);
  vec2 p=uv-.5;
  float angle=motion*(uPattern==7?.11:uPattern==2?.055:.018)*sin(t*.785+bank);
  p=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*p;
  // Scale down to preserve a contained source during movement, not crop it.
  float shrink=1.0-motion*(.16+.08*sin(t*1.57+seed*6.28));
  return p/max(.68,shrink)+.5+motion*.035*vec2(sin(t*.785+bank),cos(t*.785+seed));
}
`
