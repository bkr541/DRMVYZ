# SYS-08 source persistence and lifecycle

## Ownership and compatibility

Named pools are owned by `reactStore.canvasOrchestrationSettings.mediaPools`, not the
paged media library or signed URL cache. Cinema's version-1 workspace holds a
`poolId` per registered preset instance. Each current pool-capable manifest has
one authored pool slot; internal rotation channels are transient decoders, not
independent user assignments. The existing legacy migration is retained for a
missing field; an explicit null or malformed value does not inherit the CANVAS
pointer. Reconciliation runs on migration/merge, source saves, canonical pool
deletion/replacement and CANVAS engine resets. Empty pools remain intentional
selections; confirmed missing pools clear to null. Suppressed individual
descriptors are cleared with an orphaned pool to avoid reviving old sources.

There is no speculative persisted multi-slot pool schema: the regression
asserts the current single-pool-slot inventory. An additional authored pool
slot would require explicit per-slot selection and a deterministic legacy-slot
migration before release. Direct replacement intent is scoped by runtime and
slot. Source UI composition uses explicit model and media slot declarations;
Monument remains an exclusive typography/model choice and fixed model controls
are unchanged. A synthetic mixed manifest checks composition without adding a
preset to the catalog.

## Retirement and fallback

Pool membership/account changes invalidate transient feeds synchronously even
when rendering is suspended; wrappers forward the shared subscription and
Overdrive cancels its single decoder. Signing checks current account and
membership. Direct replacement cancels the previous pending decode while
keeping the last committed frame; confirmed Media Manager deletion removes
persisted direct assignments and retires affected live resources through the
existing composed deletion guard's commit hook. Temporary paging, refresh or
unresolved URLs do not delete persisted selections. A failed cloud deletion
does not commit the direct-source cleanup.

Everywhere uses Default Eyes when no usable media remains; other affected
presets continue through their existing authored native/auto fallback paths.
No choreography, authored source mode or audio intelligence logic is changed.
The Active Source UI counts compatible pool members and displays committed
individual content; model thumbnails are bound to the exact lookup key.
Stage retirement preserves an initial saved assignment that is still decoding
when its canonical reference has not been removed. Model runtime generation
and pinned-version lease behavior are retained, not replaced.

## Verification in the patch environment

Node v22.16.0; source archive has no installed dependencies.
- Baseline regression attempt: `npm exec --offline -- vitest run src/stores/cinema2WorkspacePersistence.test.ts` exited 1 (ENOTCACHED).
- `npm ci --offline --ignore-scripts --no-audit --no-fund` exited 1 (uncached Zustand dependency).
- Targeted Vitest invocation for workspace persistence, deletion guards,
  Everywhere pool/lifecycle, media slot runtime, Overdrive, Active Source,
  model panel and media notices exited 1 (Vitest not cached).
- `npm run test:e2e:cinema2-everywhere` exited 1 (missing @playwright/test).
- `npm run test:e2e:cinema2-release` exited 1; manifest technical status incomplete.
- `npm run typecheck` and `npm run build` timed out under an 8-second local
  cap; neither passed.
- `npm run test:cinema2:release-policy` passed 23/23 existing dependency-free
  policy/evidence tests. This is not proof of live source rendering.
- Changed TypeScript/TSX files passed TypeScript parser diagnostics (syntax
  only). Git staged whitespace check and independent archive-baseline apply
  check are required before delivery.

Pending: execute the new regression suites with installed dependencies;
verify live browser reload/reentry, signed URL refresh, mixed fixture,
model-version races and actual fallback frames using the existing QA harness.
Real Electron, GPU, Cast and visual acceptance were not performed. Remote
individual-media deletion outside the canonical local deletion transaction
has not been verified; do not treat media-library absence as proof of deletion.
