# Mobile stage links, pad sync and the session database

Backend pieces for the mobile experience. Applied to the DRMVYZ project (`ofeiopgawwsftfunckps`) on 2026-11-16: migrations 0051, 0052 and 0053, and the `stage-link` Edge Function. The client does not use any of this yet.

## Desktop lease (0051)
One signed-in desktop or browser holds the account at a time. `claim_desktop_session` returns `claimed` or `blocked` (with the holding device's label); `heartbeat_desktop_session` keeps it alive (10-minute window); `list_my_online_desktops` and `join_own_performance_session` let a phone join its own account's session as a controller. 0051 removed the room-code model: no codes, no anonymous venue identities.

## Pad sets (0052)
`performance_pad_sets` holds one row per account (`pads` jsonb, at most 64 entries / 256 KB, plus `revision`). Clients read it directly (owner-only RLS) and write through `save_performance_pad_set(pads, schema_version, base_revision, device_id)`. `base_revision` is the revision last read (0 for none); a mismatch raises `40001` and the caller must reload, merge and retry. Anonymous identities cannot save.

## Stage links (0052, 0053)
A stage link lets a screen with only a URL join a phone's live visual. It is not an account session.
- `create_stage_link(label, ttl_minutes)` (signed-in, non-anonymous; 5 to 1440 minutes, default 720; at most 5 active) returns `id`, `token` and `expires_at`. The 64-character hex token is shown once; only its SHA-256 is stored.
- `revoke_stage_link(id)` is owner-only. Owners read their links (never the hash).
- `resolve_stage_link(token)` is **service role only**. It is reachable only through the Edge Function.
- The link's `id` names the signalling channel. The phone and the stage both join it; it carries only WebRTC offers, answers and ICE candidates.

### `stage-link` Edge Function
`POST /functions/v1/stage-link`, with the project's public key in the `apikey` and `Authorization` headers.
- `{ "action": "resolve", "token": "<64 hex>" }` returns `{ linkId, label, expiresAt, iceServers }`, or 404 when the link is unknown, expired or revoked, or 400 when malformed.
- `{ "action": "ice" }` requires a signed-in (non-anonymous) user and returns `{ iceServers }` for the phone's side.
- Rate limited per client address (20 resolves and 30 ICE requests a minute, best effort per isolate).
- ICE servers are Google STUN by default. Secrets that add a TURN relay for networks that block direct connections: `TURN_URLS` (comma separated), `TURN_USERNAME`, `TURN_CREDENTIAL`; or `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN` to mint short-lived Cloudflare credentials. None are set, so only STUN is offered.

## Validation
- `supabase/tests/performance_desktop_lease_security.sql` and `supabase/tests/pad_sets_and_stage_links_security.sql`: run with `supabase db query --linked -f <file>`; both roll back.
- `supabase/functions/_shared/stageLinkCore.test.ts`: `deno test`.
- Function checked live: malformed token 400, unknown token 404, `ice` without a user 401, a real link resolves 200, then 404 once deleted.
