-- Stable client-side draft identities make first-save retries idempotent.
-- A transport failure may hide a committed create response from the browser;
-- this index guarantees that retrying the same logical draft cannot create a
-- second lyric document. The client reconciles the existing canonical row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lyric_documents_user_client_logical_id
  ON public.lyric_documents (
    user_id,
    ((metadata ->> '_drmvyzLogicalDocumentId'))
  )
  WHERE NULLIF(metadata ->> '_drmvyzLogicalDocumentId', '') IS NOT NULL;
