# Cinema 2.0 bundled decoders

These files are copied from the installed `three` package (`examples/jsm/libs`) by `npm run cinema2:decoders:sync` and verified by
`npm run cinema2:decoders:check`. They are loaded only when a shipped model uses `KHR_draco_mesh_compression` or `KHR_texture_basisu`.

| Folder | Files | Source | License |
|---|---|---|---|
| `draco/` | `draco_decoder.js`, `draco_decoder.wasm`, `draco_wasm_wrapper.js` (the glTF build) | Google Draco, https://github.com/google/draco | Apache-2.0 |
| `basis/` | `basis_transcoder.js`, `basis_transcoder.wasm` | Binomial Basis Universal, https://github.com/BinomialLLC/basis_universal | Apache-2.0 |
