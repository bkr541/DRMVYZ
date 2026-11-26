import { describe,expect,it } from 'vitest'
import { HONEY_PATTERN_IDS } from '../modules/honey/Cinema2HoneyDomain'
import { buildHoneyLayout,isHoneyPoseSafe } from '../modules/honey/Cinema2HoneyLayout'
import { sampleHoneyPattern } from '../modules/honey/Cinema2HoneyPatterns'
import { advanceHoneyCell,createHoneyCellState,HONEY_MOTION_DEFAULTS,staticHoneyCell,targetHoneyCell } from '../modules/honey/Cinema2HoneyMotion'
import { Cinema2HoneyAudio,HONEY_AUDIO_DEFAULTS,type HoneyAudioChannels,type HoneyCueKind } from '../modules/honey/Cinema2HoneyAudio'

const visible=buildHoneyLayout().filter(c=>Math.abs(c.x)<6&&Math.abs(c.y)<4)
const k=HONEY_MOTION_DEFAULTS
const geometry=(p:ReturnType<typeof staticHoneyCell>['pose'])=>[p.elevation,p.rotation,p.tiltX,p.tiltY,p.x,p.y]
const mean=(values:number[])=>values.reduce((sum,v)=>sum+v,0)/values.length

describe('HON-01 kinetic architecture',()=>{
  it('distinguishes all eight programs by geometry alone at default controls, not palette or emitters',()=>{
    const signatures=HONEY_PATTERN_IDS.map(pattern=>{
      const poses=[]
      for(let beat=0;beat<8;beat+=.25)for(const cell of visible){
        const target=targetHoneyCell(cell,sampleHoneyPattern(pattern,cell,beat),k)
        expect(isHoneyPoseSafe(target.pose)).toBe(true)
        poses.push(target.pose.elevation-cell.elevation)
      }
      expect(Math.max(...poses)).toBeGreaterThan(1.6)
      return poses
    })
    for(let i=0;i<signatures.length;i++)for(let j=0;j<i;j++){
      const a=signatures[i]!,b=signatures[j]!
      expect(Math.sqrt(mean(a.map((v,n)=>(v-b[n]!)**2)))).toBeGreaterThan(.35)
    }
    // Gravity settle must actually retract and lift; the old static island mask barely tilted.
    const gravity=visible.flatMap(cell=>Array.from({length:32},(_,i)=>targetHoneyCell(cell,sampleHoneyPattern('submerge',cell,i/4),k)))
    expect(gravity.some(c=>c.elevation<.2)).toBe(true)
    expect(mean(gravity.map(c=>Math.abs(c.pose.tiltX)>.01?1:0))).toBeGreaterThan(.1)
  })
  it('reconstructs the original axial layout and aligns before the sleeve, with no palette or identity mutation',()=>{
    for(const cell of visible){
      const state=createHoneyCellState(cell),home=staticHoneyCell(cell)
      // Convergence is authored to rest after its local plateau; hold that target to test seating.
      const rest=targetHoneyCell(cell,sampleHoneyPattern('convergence',cell,5),k)
      expect(geometry(rest.pose)).toEqual(geometry(home.pose))
      for(let i=0;i<240;i++){
        const target=i<120?targetHoneyCell(cell,sampleHoneyPattern('convergence',cell,i/30),k):rest
        advanceHoneyCell(state,target,1/60,k)
        expect(isHoneyPoseSafe(state.current.pose)).toBe(true)
        expect(state.current.id).toBe(cell.id);expect(state.current.finish).toBe(cell.finish)
      }
      expect(Math.abs(state.current.elevation-home.elevation)).toBeLessThan(.001)
      expect(Math.abs(state.current.pose.rotation)).toBeLessThan(.001)
    }
  })
  it('uses shared bands and canonical cues for deeper impact, build compression and selective high detail',()=>{
    const home=visible.map(staticHoneyCell)
    const render=(patch:Partial<HoneyAudioChannels>,kind?:HoneyCueKind,reactivity=1)=>{
      const audio=new Cinema2HoneyAudio(),channels={...HONEY_AUDIO_DEFAULTS,...patch}
      for(let i=0;i<(kind==='kick'?8:20);i++)audio.update({channels,cues:i===1&&kind?[{kind,id:'canonical',strength:1}]:[],active:true,reset:i===0,boundary:false,deltaSeconds:.02,reactivity,available:true})
      return home.map(cell=>audio.apply(cell,k))
    }
    const base=render({}),bass=render({bass:1}),high=render({high:1}),build=render({tension:1},'build'),drop=render({},'drop'),kick=render({},'kick')
    const delta=(cells:typeof home)=>mean(cells.map((c,i)=>c.elevation-home[i]!.elevation))
    expect(mean(bass.map((c,i)=>Math.abs(c.elevation-home[i]!.elevation)))).toBeGreaterThan(.12)
    expect(delta(build)).toBeLessThan(-.06);expect(delta(drop)).toBeGreaterThan(.075);expect(delta(kick)).toBeGreaterThan(.015)
    expect(high.map(c=>c.pose)).toEqual(base.map(c=>c.pose));expect(high.map(c=>c.channels)).not.toEqual(base.map(c=>c.channels))
    expect(render({bass:1},'drop',0)).toEqual(home)
    expect([...bass,...high,...build,...drop,...kick].every(c=>isHoneyPoseSafe(c.pose))).toBe(true)
  })
})
