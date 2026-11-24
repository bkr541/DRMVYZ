# PixGrid targeted crash hardening (November 24, 2026)

## Scope

This change retains the existing PixGrid engine, presets, Deck schema, authoring controls, transition and choreography implementations. It targets the responsiveness failure observed after selecting a newly created Deck, also reported with Pixel Parade. The provided logs show a renderer responsiveness loss and a later GPU abnormal exit during shutdown; they do not establish a specific GPU driver, memory, or JavaScript root cause.

## Changes

- The Preset Manager background preview is retired while the Deck Builder dialog owns the preview, including its successful creation confirmation. Preset registration and selection still occur at Create Preset; the selected stage mounts on Done/Close. Existing project persistence is retained; registration telemetry is not a durable-storage acknowledgement.
- Runtime compiler resolution belongs to the active surface lifecycle and same-task handoffs are coalesced. Identical effective dimensions do not invalidate prepared frames. A redundant transition synchronization is removed.
- Adaptive logical quality is supplied together with logical dimensions so normalization cannot silently restore the authored matrix size. The authored settings are untouched. Stable runtime projection identity allows the existing canonical-state cache to work.
- Dedicated PixGrid canvases skip shared-context WebGL state readbacks and explicit flushes; shared-context behavior remains the default. Shader setup cleans up a vertex shader if fragment compilation fails. Thrown context acquisition failures use the normal Canvas2D path.
- Non-output Preset Manager and Deck Builder previews use a bounded 1x-DPR backing store (at most 2,073,600 pixels); live and casting resolution policy is unchanged. Coordinate transforms hoist invariant trigonometry and scale clamps out of the pixel loop.
- GPU auto-retries are capped at three per mounted surface (1, 2 and 5 seconds); manual Retry GPU resets the budget. A terminal JavaScript rendering failure retires the frame loop and offers Restart PixGrid; switching to another preset can also restart a failed surface. A GPU command submission or a completed fallback draw marks engine readiness; this is not a GPU completion fence.
- Existing performance telemetry receives `pixGrid` registration, initialization, first-frame, failure, recovery, retirement and throttled frame summaries with frame timing and compiler/cache counts. These are diagnostic events, not a watchdog for native synchronous stalls.

## Validation and acceptance

Focused tests: `npx vitest run src/components/vyzualz/react/pixGrid/__tests__/PixGridGpuRenderer.test.ts src/components/vyzualz/react/pixGrid/__tests__/PixGridSurface.test.tsx src/components/vyzualz/react/pixGrid/__tests__/PixGridDeckCompileCoordinator.test.ts src/components/vyzualz/react/pixGrid/__tests__/PixGridRenderedPixelRegression.test.ts`.
Run `npm run typecheck` and the existing Preset Manager Deck browser acceptance test (`npm run test:e2e:pix-grid-deck-preset-manager` if available in package scripts). The browser test now asserts that the background PixGrid surface is absent during authoring and confirmation, and returns after Done.

On macOS Electron, repeat the original upload/Create Preset/Done workflow with the same media, then edit and reopen the Deck, restart the application, exercise Pixel Parade, fixed/adaptive quality, GPU recovery, and live output/casting. Inspect `first-frame-start`, `first-frame-complete`, `render-summary`, and GPU/failure events in the application log. If a native stall still occurs, capture a macOS process sample during the freeze. Full native stability, persistence durability, and performance parity remain release gates; this patch is not a claim that the specific observed crash has been reproduced or definitively eliminated.
