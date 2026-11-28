// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/logger', () => ({
  getRecentLogEntries: () => [{
    timestamp: 0, level: 'warn', category: 'media',
    message: 'Upload of /Users/kody/Music/set.mp3 failed for dj@example.com at https://abc.supabase.co/storage/v1/object/sign/media/x.mp3?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefgh',
    context: { path: 'C:\\Users\\Kody\\Desktop\\a.png', id: 'a'.repeat(40) },
  }],
}))
const { collectIssueDiagnostics, issueReportRow, sanitizeDiagnosticText, validateIssueReport } = await import('./issueReport')

describe('issue reports (UX-01)', () => {
  it('removes links\' query strings, local user folders, tokens, emails and long ids from diagnostics', () => {
    const text = sanitizeDiagnosticText('see https://abc.supabase.co/storage/v1/object/sign/a.mp3?token=secret and /Users/kody/Music and eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefgh and dj@example.com and file:///Users/kody/a.mp3')
    expect(text).toBe('see https://abc.supabase.co/storage/v1/object/sign/a.mp3 and ~/Music and <token> and <email> and <app-file>')
  })

  it('collects the build, platform and a sanitized log, and nothing personal', () => {
    const diagnostics = collectIssueDiagnostics({ activity: { engine: 'cinema2', preset: 'drmvyz.cinema2.depth' } }) as { recentLog: { message: string; context?: string }[]; activity: Record<string, unknown> }
    const log = JSON.stringify(diagnostics.recentLog)
    for (const secret of ['kody', 'dj@example.com', 'token=', 'eyJ', 'a'.repeat(40)]) expect(log).not.toContain(secret)
    expect(diagnostics.activity).toEqual({ engine: 'cinema2', preset: 'drmvyz.cinema2.depth' })
  })

  it('sends diagnostics only when asked, and requires a description', () => {
    expect(issueReportRow({ category: 'other', summary: ' It froze ', steps: '', includeDiagnostics: false })).toMatchObject({ summary: 'It froze', steps: null, diagnostics: null })
    expect(issueReportRow({ category: 'other', summary: 'x', steps: '', includeDiagnostics: true }).diagnostics).not.toBeNull()
    expect(validateIssueReport({ summary: '  ', steps: '' })).toBe('Say what happened.')
  })
})
