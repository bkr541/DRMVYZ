import { describe,expect,it } from 'vitest'
import { Cinema2HoneyParticles,HONEY_PARTICLE_CAPACITY } from '../modules/honey/Cinema2HoneyParticles'
import { buildHoneyLayout } from '../modules/honey/Cinema2HoneyLayout'
import { honeyRuntimeFixture } from './support/HoneyRuntimeFixture'
const base={active:true,reset:false,deltaSeconds:.1,enabled:true,amount:1,reactivity:1,high:0,air:0,flux:0,drop:0}
const pool=()=>new Cinema2HoneyParticles(buildHoneyLayout())
const snapshot=(p:Cinema2HoneyParticles)=>Array.from(p.data.subarray(0,p.fill('high')*5))
describe('HONEY fixed world ember pool',()=>{
  it('has reproducible seeds, finite positions, bounded tiers and distinct depths',()=>{
    const a=pool(),b=pool();a.update(base);b.update(base);expect(snapshot(a)).toEqual(snapshot(b))
    const counts=['low','medium','high'].map(q=>a.fill(q as keyof typeof HONEY_PARTICLE_CAPACITY));expect(counts[0]).toBeLessThan(counts[1]!);expect(counts[1]).toBeLessThan(counts[2]!)
    expect(counts[2]).toBeLessThanOrEqual(400);expect(snapshot(a).every(Number.isFinite)).toBe(true)
    const z=snapshot(a).filter((_,i)=>i%5===2);expect(Math.min(...z)).toBeLessThan(1);expect(Math.max(...z)).toBeGreaterThan(2)
  })
  it('holds on pause, resets on seek/re-entry and stops drawing on hard-off or zero amount',()=>{
    const a=pool();a.update({...base,reset:true});const initial=snapshot(a);a.update(base);const moving=snapshot(a);expect(moving).not.toEqual(initial)
    a.update({...base,active:false,deltaSeconds:10});expect(snapshot(a)).toEqual(moving)
    a.update({...base,reset:true});expect(snapshot(a)).toEqual(initial)
    a.update({...base,enabled:false});expect(a.fill('high')).toBe(0)
    a.update({...base,active:false});expect(snapshot(a)).toEqual(initial)
    a.update({...base,amount:0});expect(a.fill('high')).toBe(0)
  })
  it('reacts to high/air/flux and canonical drop lift; reactivity zero restores baseline count',()=>{
    const a=pool();a.update(base);const idle=a.fill('high');a.update({...base,high:1,air:1,flux:1,drop:1});expect(a.fill('high')).toBe(400);expect(a.inspect().lift).toBe(1)
    a.update({...base,reactivity:0,high:1,air:1,drop:1});expect(a.inspect().lift).toBe(0);expect(a.fill('high')).toBe(idle)
  })
  it('uses the existing native transport lifecycle and controls rather than wall clock time',()=>{
    const h=honeyRuntimeFixture();h.tick();const moving=h.tick();expect(moving.inspection.particles.age).toBeGreaterThan(0)
    h.pause(true);expect(h.tick().inspection.particles.age).toBe(moving.inspection.particles.age)
    h.set('particles',false);expect(h.tick().inspection.particles.enabled).toBe(false)
    h.set('particles',true);h.present(false);expect(h.tick().inspection.particles.age).toBe(0)
    h.reenter();expect(h.tick().inspection.particles.age).toBe(0)
  })
})
