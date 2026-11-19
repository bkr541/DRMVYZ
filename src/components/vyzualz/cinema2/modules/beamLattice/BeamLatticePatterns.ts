export const BEAM_LATTICE_PATTERNS=[
 {value:'reference-fan',label:'Reference Fan'},
 {value:'counter-sweep',label:'Counter Sweep'},
 {value:'iris-gate',label:'Iris Gate'},
 {value:'scissor-cross',label:'Scissor Cross'},
 {value:'bank-relay',label:'Bank Relay'},
 {value:'pressure-cage',label:'Pressure Cage'},
 {value:'radial-release',label:'Radial Release'},
] as const
export type BeamLatticePattern=typeof BEAM_LATTICE_PATTERNS[number]['value']
export const BEAM_LATTICE_PATTERN_IDS=BEAM_LATTICE_PATTERNS.map(p=>p.value)
/**
 * Each bank is a true ray mesh. These are local emitter-pivot transforms, not screen-space lines; `x` is the visual sweep angle in radians (the module compensates
 * for the source's 20x stretch of the fan normal, so the number means what it says; the tilt test caps it at 0.22 rad, past which the fans fold away from the viewer). Banks 0-3 are the upper, lower, right and left fans, and every program gives
 * them different parts so the field moves as an ensemble instead of four copies of one motion.
 */
export function beamLatticePattern(pattern:BeamLatticePattern,phase:number,bank:number){
 const side=bank%2===0?1:-1,quarter=bank*Math.PI/2
 const wave=.5+.5*Math.sin(phase*2-quarter)
 switch(pattern){
  // The reference: the original four-bank field, untouched.
  case 'reference-fan':return {x:0,y:0,z:0,width:1,length:1,light:1}
  // Opposite banks sweep against each other through a wide arc, and the light chases around the four banks.
  case 'counter-sweep':return {x:.2*Math.sin(phase+bank*.9)*side,y:0,z:0,width:1.08,length:1.2,light:.45+1.1*wave}
  // Each bank opens and closes like an iris, one after another, and flashes at the open.
  case 'iris-gate':return {x:.05*Math.sin(phase*1.4),y:0,z:0,width:.7+.7*wave,length:1.35,light:.2+1.7*wave**3}
  // The banks sweep through each other: upper/lower and right/left cross on opposite beats.
  case 'scissor-cross':return {x:.21*Math.sin(phase*1.2+(bank>1?Math.PI/2:0))*side,y:0,z:0,width:1.15,length:1.5,light:.55+.9*wave}
  // One bank at a time takes the light, handing it round the field.
  case 'bank-relay':return {x:.1*Math.sin(phase+quarter)*side,y:0,z:0,width:1+.25*wave,length:1.4,light:.32+1.8*Math.max(0,Math.sin(phase*2-quarter))**2}
  // The fans lean in and squeeze toward the viewer with a heartbeat pulse.
  case 'pressure-cage':return {x:-.14-.06*wave,y:0,z:0,width:.9+.2*wave,length:1.65,light:.4+1.5*wave**3}
  // The fans throw wide and pulse outward, alternating direction by bank.
  case 'radial-release':return {x:.2*Math.sin(phase*.8+bank)*side,y:0,z:0,width:1.45,length:1.2,light:.6+1.1*wave}
 }
}
