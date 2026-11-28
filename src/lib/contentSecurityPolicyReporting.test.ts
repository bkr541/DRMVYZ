import { describe, expect, it, vi } from 'vitest'

const warn = vi.hoisted(() => vi.fn())
vi.mock('./logger', () => ({ createLogger: () => ({ warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }) }))
const { installContentSecurityPolicyReporting } = await import('./contentSecurityPolicyReporting')

const violation = (directive: string, blockedURI: string) => Object.assign(new Event('securitypolicyviolation'), { effectiveDirective: directive, blockedURI, sourceFile: '' })

describe('Content Security Policy reporting', () => {
  it('logs each distinct block once, without query strings (signed links carry tokens)', () => {
    const target = new EventTarget()
    const stop = installContentSecurityPolicyReporting(target as never)
    target.dispatchEvent(violation('connect-src', 'https://tracker.example/collect?token=secret'))
    target.dispatchEvent(violation('connect-src', 'https://tracker.example/collect?token=other'))
    target.dispatchEvent(violation('script-src-elem', 'inline'))
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0]![1]).toEqual({ directive: 'connect-src', blocked: 'https://tracker.example/collect', source: null })
    stop()
    target.dispatchEvent(violation('img-src', 'https://x.example/a.png'))
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
