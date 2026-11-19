# DVYDRM wordmark in the 3D Models library

Media Manager → 3D Models now includes **DVYDRM Wordmark**, the same standalone GLB used by Conduit (`/cinema2/models/conduit-wordmark.glb`). Selecting it opens the existing true-3D studio viewport with orbit, pan, zoom, Fit Model and Reset Camera. The original pearl, chrome and amber materials and all seven meshes are retained; Conduit and its shipped model bytes are unchanged.

The wordmark is a built-in library item. Its Media Details inspector has Info, Edit, and Output tabs. Info contains Details, Tags & Collections, and Additional Info. In **Edit**, use **Transform** to scale or rotate the model and **Materials** to change each material's base color, metalness, or roughness. The viewport updates as you edit. Use **Fit Model** to reframe it or **Restore Original** to undo the whole edit session.

Use **Download Edited GLB** to keep a separate file of the result. The library continues to open the original built-in GLB. Media Manager prompts you to download or discard pending geometry edits before navigating away. The header's **Save Changes** action saves tags and collections for the built-in entry.

Use the shared Tags & Collections fields and the header's **Save Changes** action to organize the wordmark. It appears in the collections you assign. Migration `0057_builtin_model_organization.sql` stores each account's assignments separately, using the same tags and collections as other media.

Model grid tiles are capped at 128 px, and list thumbnails are 72 px wide. The wordmark card displays a bundled WebP rendered from the original GLB with the studio viewport's lighting. Saved model cards display the thumbnail of their current version. To refresh the bundled image after a model change, run `node scripts/model-assets/verify-conduit-wordmark.mjs --write-thumbnail`.

The loader shares the saved-model GLB validation and geometry budgets. Known built-in IDs resolve to shipped URLs; arbitrary URLs cannot be injected. Selection replacement/account changes/discard cancel pending loads, and late results and active model resources are disposed. Failed loads can be retried by selecting the wordmark again.

The browser verifier exercises the actual 57,882-triangle, seven-mesh wordmark, including orbit, fit/reset, live editing, GLB export and restore. Run `node scripts/model-assets/verify-conduit-wordmark.mjs` to reproduce. Captures and the report are under ignored `artifacts/conduit-wordmark-model-viewer/`.

A broader existing editor-store suite has four image-source generation failures. The first failing case was reproduced against the unmodified HEAD store, independently of this feature; it was not changed or repeatedly rerun. The new built-in lifecycle tests pass.

Changes are uncommitted. The pre-existing deletion of the source crate Bass Sigil GLB is unrelated and was left untouched.

## Regenerating the thumbnail

`public/cinema2/models/conduit-wordmark-thumbnail.webp` is generated, not hand-made: run `node scripts/model-assets/verify-conduit-wordmark.mjs --write-thumbnail` after changing `conduit-wordmark.glb` (it captures the model, crops to the wordmark and writes the file). Nothing detects a stale thumbnail on its own.
