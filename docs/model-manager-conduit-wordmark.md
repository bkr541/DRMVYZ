# DVYDRM wordmark in the 3D Models library

Media Manager → 3D Models now includes **DVYDRM Wordmark**, the same standalone GLB used by Conduit (`/cinema2/models/conduit-wordmark.glb`). Selecting it opens the existing true-3D studio viewport with orbit, pan, zoom, Fit Model and Reset Camera. The original pearl, chrome and amber materials and all seven meshes are retained; Conduit and its shipped model bytes are unchanged.

The wordmark is a built-in library item. Its Media Details inspector has Info, Edit, and Output tabs. Info contains Details, Tags & Collections, and Additional Info. Edit and Output are empty for the wordmark. User-created models use the same Info groups and keep their editing and export tools.

Use the shared Tags & Collections fields and the header's **Save Changes** action to organize the wordmark. It appears in the collections you assign. Migration `0057_builtin_model_organization.sql` stores each account's assignments separately, using the same tags and collections as other media.

The library uses larger model thumbnails in both grid and list view. The wordmark card displays a bundled WebP rendered from the original GLB with the studio viewport's lighting. Saved model cards display the thumbnail of their current version. To refresh the bundled image after a model change, run `node scripts/model-assets/verify-conduit-wordmark.mjs --write-thumbnail`.

The loader shares the saved-model GLB validation and geometry budgets. Known built-in IDs resolve to shipped URLs; arbitrary URLs cannot be injected. Selection replacement/account changes/discard cancel pending loads, and late results and active model resources are disposed. Failed loads can be retried by selecting the wordmark again.

Validation: 20 focused library, manager-selection and built-in lifecycle tests passed; TypeScript and focused ESLint passed. The production-browser review loads the actual 57,882-triangle, seven-mesh wordmark, verifies a usable viewport and orbit, checks Fit/Reset and view-only controls, and reports no page errors. Reproduce with `node scripts/model-assets/verify-conduit-wordmark.mjs`; captures and report are under ignored `artifacts/conduit-wordmark-model-viewer/`.

A broader existing editor-store suite has four image-source generation failures. The first failing case was reproduced against the unmodified HEAD store, independently of this feature; it was not changed or repeatedly rerun. The new built-in lifecycle tests pass.

Changes are uncommitted. The pre-existing deletion of the source crate Bass Sigil GLB is unrelated and was left untouched.

## Regenerating the thumbnail

`public/cinema2/models/conduit-wordmark-thumbnail.webp` is generated, not hand-made: run `node scripts/model-assets/verify-conduit-wordmark.mjs --write-thumbnail` after changing `conduit-wordmark.glb` (it captures the model, crops to the wordmark and writes the file). Nothing detects a stale thumbnail on its own.
