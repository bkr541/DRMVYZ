import { describe, expect, it } from 'vitest'
import migrationSql from '../../supabase/migrations/0026_lyric_write_ownership.sql?raw'

function compact(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

const sql = compact(migrationSql)

describe('0026 lyric write ownership migration contract', () => {
  it('makes each user-scoped client draft identity unique', () => {
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_lyric_documents_user_client_logical_id')
    expect(sql).toContain("ON public.lyric_documents ( user_id, ((metadata ->> '_drmvyzLogicalDocumentId')) )")
    expect(sql).toContain("WHERE NULLIF(metadata ->> '_drmvyzLogicalDocumentId', '') IS NOT NULL")
  })
})
