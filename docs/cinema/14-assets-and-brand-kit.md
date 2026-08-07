# Cinema Stage 14: Asset Bindings and Brand Kit Bridge

Stage 14 adds the canonical bridge between Cinema compositions, DRMVYZ's existing media library, and the existing Brand Kit store. Cinema persists stable asset IDs and authored binding metadata only. Signed URLs, blob URLs, decoded image/video elements, WebGL textures, and live Brand Kit snapshots remain runtime-owned and reconstructable.

## Production path

```text
React engine selection
→ ReactView canonical media + Brand Kit subscriptions
→ CinemaWorkspaceFrameBridge / CinemaMediaLibraryBridge
→ CinemaCanvas
→ CinemaRuntime-owned CinemaAssetManager
→ CinemaGraphExecutor node initialize/render contexts
```

The React store remains the active-engine owner. `useMediaStore` remains the media source of truth, `useBrandKitStore` remains the Brand Kit source of truth, and `useCinemaStore` remains the versioned authored Cinema owner.

## Persisted asset contract

`CinemaAssetBindingDefinition` is normalized through `normalizeCinemaAssetBinding`. Stable fields include role, fit, crop, position, scale, rotation, original-color preservation, semantic Brand Kit colorization, opacity, and blend mode. Stage 14 adds `brandColorPolicy` with three policies:

- `exact`: resolves the semantic Brand Kit color and reasserts it after master, modulation, performance, and clamp stages.
- `derived`: starts from the semantic Brand Kit color but allows later resolution stages to transform or replace it.
- `free`: keeps the authored color independent from Brand Kit.

Composition, package, and persisted-store schemas advance to version 3. Version-2 bindings that already use `colorizeWithBrandRole` migrate to `brandColorPolicy: "derived"`.

## Runtime asset lifecycle

`CinemaMediaLibraryBridge` converts canonical media records into runtime-only snapshots using a stable Cinema asset ID derived from the canonical media ID. `CinemaAssetManager` owns:

- signed/runtime URL consumption;
- image and video decode lifecycle;
- owned object URL creation and revocation;
- WebGL texture creation and deletion;
- replacement and deletion invalidation;
- context-loss texture abandonment and context-restoration reconstruction;
- deterministic missing, deleted, incompatible, and unavailable fallbacks.

Node contracts receive the authored binding list plus a runtime asset service. Renderer nodes never own a visible canvas, WebGL context, animation loop, or persisted media resource.

## Validation and history

Pure asset resolution validates missing/deleted assets, MIME and role compatibility, instance overrides, node-output references, and recursive node-output dependencies. Missing visual assets use a checkerboard or transparent fallback according to role, audio uses silence, and fonts use the system-font fallback.

`deleteCinemaAssetBinding` atomically removes the binding, dependent node references, and matching instance overrides. Existing whole-document history restores the complete graph on undo.

## Stage 15 handoff

Stage 15 can implement image, video, logo, text, and lyrics renderer nodes against `CinemaAssetRuntimeService`, `CinemaAssetBindingDefinition`, and the semantic Brand Kit resolver without introducing a second media store, Brand Kit store, WebGL owner, or temporary persisted URL.
