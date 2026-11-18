# DVYDRM wordmark in the 3D Models library

Media Manager → 3D Models now includes **DVYDRM Wordmark**, the same standalone GLB used by Conduit (`/cinema2/models/conduit-wordmark.glb`). Selecting it opens the existing true-3D studio viewport with orbit, pan, zoom, Fit Model and Reset Camera. The original pearl, chrome and amber materials and all seven meshes are retained; Conduit and its shipped model bytes are unchanged.

The wordmark is a built-in, view-only library item. It does not require creating an account-owned model record or generating another extrusion. It participates in model search and grid/list display, and stays out of personal Favorites and collection results. Generation, save and deletion actions are unavailable for this preview. Existing image-source creation and saved model workflows continue through their existing paths.

The loader shares the saved-model GLB validation and geometry budgets. Known built-in IDs resolve to shipped URLs; arbitrary URLs cannot be injected. Selection replacement/account changes/discard cancel pending loads, and late results and active model resources are disposed. Failed loads can be retried by selecting the wordmark again.

Validation: 20 focused library, manager-selection and built-in lifecycle tests passed; TypeScript and focused ESLint passed. The production-browser review loads the actual 57,882-triangle, seven-mesh wordmark, verifies a usable viewport and orbit, checks Fit/Reset and view-only controls, and reports no page errors. Reproduce with `node scripts/model-assets/verify-conduit-wordmark.mjs`; captures and report are under ignored `artifacts/conduit-wordmark-model-viewer/`.

A broader existing editor-store suite has four image-source generation failures. The first failing case was reproduced against the unmodified HEAD store, independently of this feature; it was not changed or repeatedly rerun. The new built-in lifecycle tests pass.

Changes are uncommitted. The pre-existing deletion of the source crate Bass Sigil GLB is unrelated and was left untouched.
