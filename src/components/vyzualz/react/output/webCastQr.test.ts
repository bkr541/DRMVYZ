import { describe, it, expect } from 'vitest'
import { webCastQrPath } from './webCastQr'
describe('STAGELESS Cast QR',()=>{
  it('renders deterministic QR version 5 with a four-module quiet zone',()=>{
    const link='https://cast.stagelessstudio.com/#'+'a'.repeat(64)
    const path=webCastQrPath(link)
    expect(path).toBe(webCastQrPath(link))
    expect(path).toContain('M4 4h1v1h-1z')
    expect(path).not.toBe(webCastQrPath(link.replace(/a$/,'b')))
    expect([...path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].every(m=>Number(m[1])>=4&&Number(m[1])<=40&&Number(m[2])>=4&&Number(m[2])<=40)).toBe(true)
  })
  it('rejects payloads beyond its byte-mode capacity',()=>expect(()=>webCastQrPath('x'.repeat(107))).toThrow())
})
