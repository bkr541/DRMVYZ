export const MOIRE_ORB_PATTERNS = [
  {value:'core-ignition',label:'Core Ignition'},
  {value:'counter-rotation',label:'Counter Rotation'},
  {value:'vertical-surge',label:'Vertical Surge'},
  {value:'ring-chase',label:'Ring Chase'},
  {value:'pressure-lock',label:'Pressure Lock'},
  {value:'radial-discharge',label:'Radial Discharge'},
] as const
export type MoireOrbPattern = typeof MOIRE_ORB_PATTERNS[number]['value']
export const MOIRE_ORB_PATTERN_IDS = MOIRE_ORB_PATTERNS.map(p=>p.value)
export const REACTOR_SEGMENT_COUNT=48, REACTOR_FIXTURE_COUNT=12
const wave=(v:number)=>.5+.5*Math.sin(v)
/** Native geometry/light vocabulary. Timing and musical facts are supplied by shared runtimes. */
export function reactorPattern(pattern:MoireOrbPattern,phase:number,index:number) {
 const ring=Math.floor(index/16),u=(index%16)/16,bank=index%2
 switch(pattern){
  case 'core-ignition':return {light:.15+.85*Math.pow(wave(phase*2-ring*1.1-u*3),3),turn:phase*.12*(ring+1),tilt:.12*Math.sin(phase*.25+ring),scale:1,aimY:-1.5+Math.sin(phase*.4)*1.5,aimRadius:1.2,aimTurn:phase*.25}
  case 'counter-rotation':return {light:.12+.88*Math.pow(wave(u*Math.PI*4+phase*(ring%2?-3:3)),5),turn:phase*(ring%2?-.22:.22),tilt:.22*Math.sin(phase*.4+ring),scale:1,aimY:bank?3:-3,aimRadius:3,aimTurn:phase*(bank?-.5:.5)}
  case 'vertical-surge':return {light:.08+.92*Math.pow(wave(phase*3-ring*2),4),turn:phase*.07,tilt:.35*Math.sin(phase*.3+ring),scale:1,aimY:Math.sin(phase*.65+index*.25)*8,aimRadius:2,aimTurn:phase*.12}
  case 'ring-chase':return {light:.07+.93*Math.pow(wave(u*Math.PI*2-phase*2+ring*.8),10),turn:phase*.06,tilt:.16*Math.sin(phase*.3+ring),scale:1,aimY:Math.sin(phase*.6+index)*3.5,aimRadius:4,aimTurn:phase*.7+index*.3}
  case 'pressure-lock':return {light:.3+.7*Math.pow(wave(phase*4+ring*.4),7),turn:phase*.035,tilt:.06*Math.sin(phase),scale:1-.12*wave(phase),aimY:Math.sin(phase*.2)*.5,aimRadius:.3,aimTurn:phase*.1}
  case 'radial-discharge':return {light:.12+.88*Math.pow(wave(phase*2-ring*.9-u),4),turn:phase*.18,tilt:.32*Math.sin(phase*.4+ring),scale:1+.13*Math.pow(wave(phase*2-ring*.8),3),aimY:Math.sin(phase*.4+index*.8)*9,aimRadius:11,aimTurn:phase*.3+index*.35}
 }
}

/** Sparse, independently addressed core / wall / deck scores: more fixtures does not mean more constant light. */
export function reactorCellPattern(pattern:MoireOrbPattern,phase:number,domain:'core'|'wall'|'deck',index:number){
 const u=domain==='wall'?Math.floor(index/8)/12:(index%24)/24,row=domain==='wall'?index%4:Math.floor((index%48)/24),side=domain==='wall'?Math.floor((index%8)/4):0,offset=domain==='core'?0:domain==='deck'?.9:1.8
 const circular=(a:number,b:number)=>Math.abs((((a-b)+.5)%1+1)%1-.5)
 switch(pattern){
  case 'core-ignition':{const head=((phase*.1+(domain==='wall'?.5:0))%1+1)%1;return .015+.9*Math.max(0,1-circular(u,head)*(domain==='core'?5:3.8))*Math.pow(wave(phase*1.7-row*.8-offset-side*.22),2)}
  case 'counter-rotation':return .01+.95*Math.pow(wave(u*Math.PI*2+phase*((domain==='wall'?side:row)%2?-2.2:2.2)+row*Math.PI*.6+side*Math.PI),10)
  case 'vertical-surge':return .01+.95*Math.pow(wave(phase*2.8-row*.95-offset-u*.6-side*.3),12)
  case 'ring-chase':return .008+.98*Math.pow(wave(u*Math.PI*2-phase*2.5-offset-side*.7),24)
  case 'pressure-lock':return domain==='core'?.3+.65*Math.pow(wave(phase*3-row*.3),6):.015+.16*Math.pow(wave(phase*2-row*Math.PI),10)
  case 'radial-discharge':return .01+.95*Math.pow(wave(phase*2.5-offset-u*.5-side*.35),8)
 }
}
