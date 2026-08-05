# Audio Intelligence batch dataset CLI

This development-only command analyzes a directory of local audio files with the same browser decoding and DRMVYZ analyzers used by the application. It writes canonical Audio Intelligence JSON beside each track and maintains a dataset manifest at the input root.

## Basic usage

```bash
npm run audio:batch -- \
  --input "/Users/you/Music/DRMVYZ Genre Dataset" \
  --recursive \
  --genre-from-parent \
  --skip-existing
```

Supported extensions are WAV, MP3, FLAC, M4A, MP4, and OGG. Processing is sequential so each track receives the full analyzer without several Chromium jobs competing for memory and CPU.

## Recommended directory structure

```text
DRMVYZ Genre Dataset/
├── Melodic Dubstep/
│   ├── Track A.wav
│   └── Track A.drmvyz-ai.json
├── Heavy Dubstep/
│   ├── Track B.mp3
│   └── Track B.drmvyz-ai.json
└── drmvyz-audio-intelligence-manifest.json
```

`--genre-from-parent` stores the immediate parent directory as a manifest label. Labels remain separate from the measured analyzer payload.

## Resume and replacement behavior

`--skip-existing` skips a sidecar only when all of the following are current:

- source-file SHA-256
- browser golden schema version
- Track Audio Intelligence analyzer version
- RGB waveform analyzer version
- complete payload and payload SHA-256

Corrupt, incomplete, changed, or stale sidecars are analyzed again. Use `--overwrite` to intentionally regenerate every sidecar.

Both sidecars and the manifest use temporary files followed by a same-directory rename so interrupted writes do not leave partial JSON behind. The manifest is updated after every analyzed, skipped, or failed track.

## Options

```text
--recursive
--genre-from-parent
--genre <label>
--skip-existing
--overwrite
--fail-fast
--include-hidden
--extensions wav,mp3,flac,m4a,mp4,ogg
--output beside
--manifest <path>
--chromium <path>
--timeout-ms <number>
```

Chrome is discovered automatically from common macOS, Windows, and Linux locations. Use `--chromium` or `DRMVYZ_CHROMIUM_EXECUTABLE` when it is installed elsewhere.

## Output contract

Each `*.drmvyz-ai.json` file is the existing canonical browser golden fixture. Its payload contains:

- `trackAnalysis` from `analyzeTrackBuffer(audioBuffer)`
- `rgbWaveform` from `analyzeRgbWaveform(audioBuffer)`

The command does not change production analyzers, application state, track loading, the Track Timeline Visualizer, or any visual engine. It is repository tooling for local development datasets only.

## Focused tests

```bash
npm run test:audio:batch
```
