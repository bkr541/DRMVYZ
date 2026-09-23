import { describe, expect, it } from 'vitest'
import { parseMainLogText } from './mainLogParser'

describe('parseMainLogText', () => {
  it('parses a scoped entry into timestamp/level/scope/message', () => {
    const [entry] = parseMainLogText('[2026-09-22 13:43:45.501] [info]  (main) logging ready — level=info\n')
    expect(entry).toMatchObject({
      timestampRaw: '2026-09-22 13:43:45.501',
      level: 'info',
      scope: 'main',
      message: 'logging ready — level=info',
    })
    expect(entry.timestamp).toEqual(new Date(2026, 8, 22, 13, 43, 45, 501).getTime())
  })

  it('parses an unscoped entry with an empty scope', () => {
    const [entry] = parseMainLogText('[2026-09-22 13:43:45.598] [info]         app ready — v1.0.0\n')
    expect(entry.scope).toBe('')
    expect(entry.message).toBe('app ready — v1.0.0')
  })

  it('folds unprefixed continuation lines (stack traces) into the previous entry', () => {
    const text = [
      '[2026-09-22 03:47:28.327] [error]        Error sending from webFrameMain:  Error: boom',
      '    at WebFrameMain.send (node:electron/js2c/browser_init:2:104635)',
      '    at WebContents.send (node:electron/js2c/browser_init:2:88680)',
      '[2026-09-22 03:47:29.000] [info]  next entry',
      '',
    ].join('\n')

    const entries = parseMainLogText(text)
    expect(entries).toHaveLength(2)
    expect(entries[0].message).toBe(
      'Error sending from webFrameMain:  Error: boom\n' +
      '    at WebFrameMain.send (node:electron/js2c/browser_init:2:104635)\n' +
      '    at WebContents.send (node:electron/js2c/browser_init:2:88680)',
    )
    expect(entries[1].message).toBe('next entry')
  })

  it('falls back to level "unknown" for an unrecognized level token', () => {
    const [entry] = parseMainLogText('[2026-09-22 13:43:45.501] [trace] something\n')
    expect(entry.level).toBe('unknown')
  })

  it('drops a torn leading line when reading a tail window', () => {
    const text = 'mid-line fragment from before the read start\n[2026-09-22 13:43:45.501] [info] clean entry\n'
    const withDrop = parseMainLogText(text, { dropLeadingPartialLine: true })
    expect(withDrop).toHaveLength(1)
    expect(withDrop[0].message).toBe('clean entry')

    const withoutDrop = parseMainLogText(text)
    expect(withoutDrop).toHaveLength(2)
    expect(withoutDrop[0].level).toBe('unknown')
  })

  it('returns an empty array for empty input', () => {
    expect(parseMainLogText('')).toEqual([])
  })
})
