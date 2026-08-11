# DRMVYZ Receiver V2 protocol handoff

Receiver V2 is the logical LAN protocol used by the Electron sender/receiver path. The wire contract is intentionally isolated from Electron in `drmvyzReceiverProtocol.cjs` so a Stage 6 Android/Google TV receiver can implement the same handshake and session semantics without importing Electron code.

## Discovery versus authorization

Existing DRMVYZ discovery remains responsible only for locating a receiver and obtaining its short-lived discovery token. Discovery is not authorization. A sender must complete Receiver V2 capability negotiation and pairing before it can create a session.

## Capability handshake

`GET /api/v2/capabilities`

Required request headers:

- `X-DRMVYZ-Receiver-Token`: token obtained from discovery.
- `X-DRMVYZ-Sender-Id`: stable sender identity.
- `X-DRMVYZ-Pairing-Token`: optional durable token from a previous approved pairing.

The response is normalized by `normalizeCapabilityDocument()` and includes:

- protocol name/version/minimum version,
- receiver identity,
- pairing-required and currently-paired state,
- receiver-authoritative display IDs, names, dimensions, scale, refresh rate, and primary flag,
- WebRTC transport/codec-negotiation policy, maximum resolution, maximum fps, bitrate ceiling, and diagnostics interval.

A sender must reject an incompatible protocol version instead of falling back to the legacy primary-display session path.

## Pairing

`POST /api/v2/pair`

The request contains protocol version, stable sender identity/name, and the discovery receiver token. The receiving device must ask the local operator to approve or deny the request. Approval returns a random durable pairing token. The sender stores that token as durable receiver trust and the receiver stores the corresponding sender trust record. Active sessions, sockets, peers, and target lists are never persisted.

Re-pairing rotates the bearer token and invalidates the old token.

## Session creation

`POST /api/v2/sessions`

The request contains:

- protocol version,
- stable sender identity,
- discovery receiver token,
- pairing token,
- selected receiver display ID,
- canonical DRMVYZ WebRTC source URL,
- window mode and aspect ratio,
- negotiated quality ceiling.

The receiver revalidates trust and current display topology before opening output. It must fail if the selected display disappeared; it must never silently redirect the session to the primary display.

The response contains the remote cast ID and one-session control token used for deterministic teardown.

## Session teardown

`POST /api/v2/sessions/:castId/stop`

The receiver validates the discovery token, durable sender trust, sender identity, and session control token before closing the output. Teardown is idempotent from the sender's perspective: a receiver that has already disappeared or already closed its window must not keep local sender state alive.

On receiver display removal, only sessions targeting that display are closed. Sender-side WebRTC disconnects get a short recovery grace period; if the peer does not recover, DRMVYZ marks the session failed and cleans the provider runtime exactly once.

## Media and diagnostics

Receiver V2 reuses the canonical final composited DRMVYZ canvas. One relay/capture pipeline follows the current canonical canvas across renderer changes, caps live transport at the negotiated policy (currently up to 1920×1080 landscape or 1080×1920 portrait, 60 fps, and a 12 Mbps video sender hint), and lets WebRTC SDP choose the actual codec.

Transport diagnostics are sampled at low frequency from WebRTC stats and are runtime-only. They may include encoded dimensions, fps, bitrate, RTT, and packet loss. Diagnostics are advisory and must never drive per-frame React state or become persisted project state.

## Stage 6 implementation boundary

A non-Electron receiver should reuse the constants, schema rules, target-ID semantics, pairing/session lifecycle, and HTTP/WebRTC message shapes above. Platform display enumeration, trust persistence, operator approval UI, media decode, and display presentation remain platform-owned implementations.
