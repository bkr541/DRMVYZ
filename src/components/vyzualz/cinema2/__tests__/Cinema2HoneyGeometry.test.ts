import { describe,expect,it } from 'vitest'
import { buildHoneyGeometry } from '../modules/honey/Cinema2HoneyGeometry'
import { HONEY_CAP_RADIUS,HONEY_CAP_THICKNESS,HONEY_FLOOR,HONEY_PITCH,HONEY_SLEEVE_OUTER } from '../modules/honey/Cinema2HoneyDomain'

describe('HONEY physical assemblies',()=>{
  it('uses separate stationary and moving surfaces with finite unit normals and nondegenerate winding',()=>{
    const parts=buildHoneyGeometry();expect(parts).toHaveLength(11)
    expect(parts.filter(p=>p.moving).map(p=>p.name)).toEqual(['body','outer-channel-seat','plate-bevel','plate-face','inner-channel-seat'])
    expect(parts.filter(p=>!p.moving).map(p=>p.name)).toContain('cavity-floor')
    for(const mesh of parts){
      expect(mesh.vertices.length%18).toBe(0)
      for(let i=0;i<mesh.vertices.length;i+=18){
        const a=mesh.vertices.slice(i,i+3),b=mesh.vertices.slice(i+6,i+9),c=mesh.vertices.slice(i+12,i+15),n=mesh.vertices.slice(i+3,i+6)
        expect([...a,...b,...c,...n].every(Number.isFinite)).toBe(true)
        const u=b.map((v,k)=>v-a[k]!),v=c.map((v,k)=>v-a[k]!),cross=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!]
        expect(cross.reduce((sum,k,j)=>sum+k*n[j]!,0)).toBeGreaterThan(0);expect(Math.hypot(...n)).toBeCloseTo(1,6)
        for(const p of [a,b,c])if(mesh.moving){expect(Math.hypot(p[0]!,p[1]!)).toBeLessThanOrEqual(HONEY_CAP_RADIUS+1e-6);expect(p[2]).toBeGreaterThanOrEqual(-HONEY_CAP_THICKNESS-1e-6);expect(p[2]).toBeLessThanOrEqual(0)}
      }
    }
    expect(HONEY_PITCH-Math.sqrt(3)*HONEY_SLEEVE_OUTER).toBeGreaterThan(.02)
    expect(Math.min(...parts.find(p=>p.name==='cavity-floor')!.vertices.filter((_,i)=>i%6===2))).toBeCloseTo(HONEY_FLOOR)
  })
})
