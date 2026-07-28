# DRMVYZ Appearance Contract

## Canonical owner

`src/features/appearance` is the only runtime owner of application appearance. The canonical preference is `AppearanceTheme`, with the stable IDs `dark`, `light`, and `cdj`.

Startup calls `bootstrapAppearanceTheme()` before React mounts. It reads the versioned global local-storage cache and applies `document.documentElement.dataset.theme`, preventing a React-mount theme flash where the current bootstrap architecture is available. Authenticated hydration then reconciles the user-scoped cache with `public.user_settings.theme`.

## Field ownership

| Field | Status | Runtime behavior |
| --- | --- | --- |
| `features/appearance.theme` | Active runtime preference | Canonical React and CSS theme source |
| `user_settings.theme` | Active remote preference | Round-trips `dark`, `light`, or `cdj` |
| `drmvyz:appearance:theme:v1` | Active startup cache | Applied before React mounts |
| `drmvyz:appearance:user:v1:<userId>` | Active user cache | Reconciled with the database by timestamp |
| `WorkspacePreset.theme` | Compatibility-only legacy field | Preserved on read/write; does not override canonical appearance |
| `GlobalSettings.theme`, `accentIntensity` | Compatibility-only legacy fields | Preserved for session round trips; do not drive root CSS tokens |
| `GlobalSettings.showScanlines`, `showGlow`, `showGrid`, `showLogo`, `showModuleBorders`, `transparentBg`, `fontDensity` | Reserved or engine-local presentation | Not a second application-theme contract |
| `visualStore.scanlines`, `visualStore.logoScale` | Engine/output presentation | Not global application appearance |
| `ReferenceSlot.accent_color` | Reference-view metadata | Not global application appearance |
| `BrandKit.use_for_app_accent` | Reserved personalization field | Does not create a second theme selector |

Legacy workspace values are translated only when the value is already an exact live theme ID and no canonical value exists. Historical names such as `cyan-green` remain readable and round-trippable but cannot override the appearance service.

Invalid local or database values normalize to Dark. The existing database columns and serialized fields are retained. CDJ continues to use its authored root CSS token set.
