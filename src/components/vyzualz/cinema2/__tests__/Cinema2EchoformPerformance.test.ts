import { describe, expect, it } from 'vitest'
import { ECHOFORM_PATTERN_IDS, ECHOFORM_PATTERN_OPTIONS, EchoformWaveBank, evaluateEchoformPerformance } from '../modules/echoform/Cinema2EchoformPerformance'
import { CINEMA2_MAINFRAME_PATTERN_IDS, evaluateCinema2MainframePattern } from '../modules/mainframe/Cinema2MainframePatternEngine'
import { CINEMA2_MAINFRAME_ZERO_IMPULSES, CINEMA2_MAINFRAME_ZERO_SIGNALS } from '../modules/mainframe/Cinema2MainframeReactivity'
import type { Cinema2MainframeMusicalEvent } from '../modules/mainframe/Cinema2MainframeMusicAdapter'
import { CINEMA2_ECHOFORM_PRESET_MANIFEST, CINEMA2_ECHOFORM_PATTERN_ID } from '../presets/Cinema2EchoformPreset'
import { CINEMA2_ECHOWAVE_PRESET_MANIFEST } from '../presets/Cinema2EchowavePreset'

const light = evaluateCinema2MainframePattern({ pattern:'outward-bus', beats: 5.3, signals: { ...CINEMA2_MAINFRAME_ZERO_SIGNALS, overall:0.7, bass:0.6, mid:0.4 }, impulses:{...CINEMA2_MAINFRAME_ZERO_IMPULSES,kick:0.7,snare:0.5}, active:true })
const event = (id:string, timeSec:number, kind: Cinema2MainframeMusicalEvent['kind'] = 'kick'): Cinema2MainframeMusicalEvent => ({id,timeSec,kind,strength:1,confidence:1,source:null,upstreamIdentity:null,trackId:null,sourceId:null,analysisRevision:null,timelineRevision:null})

describe('Echoform enhanced reactor', () => {
  it('keeps old IDs, exposes twelve selectable routines and leaves Echowave on six', () => {
    expect(ECHOFORM_PATTERN_IDS.slice(0,6)).toEqual(CINEMA2_MAINFRAME_PATTERN_IDS)
    expect(CINEMA2_ECHOFORM_PRESET_MANIFEST.parameters?.find(p=>p.id===CINEMA2_ECHOFORM_PATTERN_ID)?.options).toEqual(ECHOFORM_PATTERN_OPTIONS)
    expect(CINEMA2_ECHOWAVE_PRESET_MANIFEST.parameters?.find(p=>String(p.id)==='echowave-pattern')?.options).toHaveLength(6)
    expect(CINEMA2_ECHOWAVE_PRESET_MANIFEST.parameters?.some(p=>p.label==='Orbit Count')).toBe(false)
  })
  it('authors twelve distinct spatial states, not only different IDs', () => {
    const signatures = ECHOFORM_PATTERN_IDS.map(id=> {
      const p=evaluateEchoformPerformance(id,5.3,0,1,0.85,0.8,light,true,[],1)
      return JSON.stringify([p.orbit,p.contraction,p.vortex,p.scanGain,p.fragment,p.assemble,p.echo,p.stereo,p.darkness])
    })
    expect(new Set(signatures).size).toBe(12)
  })
  it('deduplicates canonical wave events, bounds the pool, alternates snares and expires/resets', () => {
    const bank=new EchoformWaveBank()
    const first=event('a',2,'snare')
    expect(bank.update([first,first],2.1,true)).toHaveLength(1)
    expect(bank.update([event('b',2.2,'snare')],2.2,true).map(w=>w.side)).toEqual([-1,1])
    expect(bank.update(Array.from({length:20},(_,i)=>event(`k${i}`,2.3+i*0.01)),2.5,true)).toHaveLength(6)
    expect(bank.update([],4,true)).toEqual([])
    expect(bank.update([first],2.1,true)).toEqual([])
    bank.reset();expect(bank.update([first],2.1,true)).toHaveLength(1)
    expect(bank.update([],2.1,false)).toEqual([])
  })
  it('does not invent impacts while stopped and yields a brighter release after a confident build', () => {
    const idle=evaluateEchoformPerformance('system-surge',4,0,1,1,1,light,false,[{age:0,gain:1,side:0}],1)
    expect(idle.impact).toBe(0);expect(idle.waves).toEqual([]);expect(idle.motion).toBe(0)
    const build={...light,buildCharge:1,impulses:CINEMA2_MAINFRAME_ZERO_IMPULSES}
    const pre=evaluateEchoformPerformance('system-surge',4,0,1,1,1,build,true,[],1)
    const drop=evaluateEchoformPerformance('system-surge',4,0,1,1,1,{...build,impulses:{...CINEMA2_MAINFRAME_ZERO_IMPULSES,drop:1}},true,[],1)
    expect(pre.darkness).toBeGreaterThan(0.9);expect(drop.darkness).toBe(0);expect(drop.impact).toBe(1);expect(drop.contraction).toBe(0)
  })
})
