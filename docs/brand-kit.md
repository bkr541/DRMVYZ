# Brand Kit

## Purpose

Brand Kit is the shared personalization system for palettes, logos, image assets, overlays, application accents, and engine-aware preset treatment. It provides one normalized source of brand identity without requiring each engine to invent a separate asset store.

## Canonical implementation

| Responsibility | Current authority |
| --- | --- |
| Types | `src/features/personalization/BrandKitTypes.ts` |
| Store | `src/features/personalization/brandKitStore.ts` |
| Database adapter | `src/features/personalization/brandKitDb.ts` |
| Normalization | `src/features/personalization/brandKitNormalization.ts` |
| Effective palette | `src/features/personalization/effectivePalette.ts` |
| Palette extraction | `src/features/personalization/paletteExtraction.ts` |
| Color-space utilities | `src/features/personalization/paletteColorSpace.ts` |
| Asset runtime | `src/features/personalization/brandAssetRuntime.ts` |
| Asset compositing | `src/features/personalization/brandAssetCompositor.ts` |
| React preset resolution | `src/features/personalization/resolveBrandedReactPreset.ts` |
| Effective React presets | `src/features/personalization/useEffectiveReactPresets.ts` |
| Active overlay | `src/features/personalization/useActiveBrandOverlay.ts` |
| Settings UI | `src/features/personalization/components/` |
| LaserDMX integration | `src/features/personalization/laserDmxPersonalization.ts` |

## Data model

Brand Kit data includes normalized identity, palette, extracted palette metadata, assets, and engine personalization settings as defined by `BrandKitTypes.ts`.

The store is the client authority. `brandKitDb.ts` persists supported fields through Supabase when configured. An unavailable database must be represented as a clear synchronization state, not by silently discarding local edits.

Normalization is required at every storage boundary. Renderer-facing code must not consume unvalidated database JSON directly.

## Palette authority

`effectivePalette.ts` resolves the palette available to engines. The effective palette may incorporate authored colors, extracted media colors, and configured fallback behavior.

Palette extraction and color-space conversion are preparation tasks. They must not run in the render hot loop.

Engines may map palette roles into their own typed color parameters, but they must retain a traceable relationship to the effective palette and must not mutate the saved Brand Kit while rendering.

## Assets and overlays

`brandAssetRuntime.ts` resolves stored assets into runtime image resources. `brandAssetCompositor.ts` applies supported compositing behavior.

`useActiveBrandOverlay.ts` owns the active React View overlay state. It must:

- Resolve only the selected valid asset
- Report idle, loading, ready, and error states
- Release replaced runtime resources
- Keep failed assets from blocking the base engine output
- Avoid storing decoded image objects in persistent state

Brand overlays are output treatment, not a substitute for an engine's own media source model.

## Engine integration

Current integration paths include:

- React preset palette and overlay resolution
- Shader palette uniforms, color parameters, and texture assets
- PixGrid recolor and overlay modes
- LaserDMX color personalization within fixture and safety limits
- Sound Drawing shortcuts and source treatment
- Application accent personalization

An engine integration must use the shared effective palette and asset runtime rather than reading Brand Kit storage independently.

## Preset resolution

`resolveBrandedReactPreset.ts` and `useEffectiveReactPresets.ts` derive runtime preset variants. Derived presets must preserve stable base preset identity and must not overwrite built-in definitions.

Branding is a runtime or user-authored overlay. Removing or disabling Brand Kit treatment must restore the canonical preset without requiring a reload.

## Persistence and synchronization

Persistent Brand Kit fields must remain serializable. Do not persist:

- `ImageBitmap`, `HTMLImageElement`, canvas, texture, or blob handles
- Subscription callbacks
- Loading promises
- Render diagnostics
- Temporary extracted-pixel buffers

Database failure, signed-URL expiry, missing assets, and incomplete palette extraction require explicit recoverable states.

## Accessibility and diagnostics

Palette and asset controls must use text labels in addition to swatches or thumbnails. Errors and synchronization status must not rely on color alone.

`BrandPersonalizationDiagnostics.tsx` is the user-facing diagnostic surface. Diagnostic history and extraction samples must remain bounded.

## Validation

Brand Kit tests cover storage foundations, settings, palette extraction, effective palette resolution, asset runtime and compositing, React integration, application accents, and LaserDMX personalization under `src/features/personalization/__tests__/`.
