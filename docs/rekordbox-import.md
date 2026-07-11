# Rekordbox Import Intelligence

DRMVYZ supports two Rekordbox metadata paths: a native Electron USB parser and a browser-compatible XML importer.

## Recommended desktop USB flow

1. Export tracks from Rekordbox to a prepared USB.
2. Start DRMVYZ with `npm run electron:dev`, `npm run electron:start`, or an installed desktop build.
3. In the audio dock, choose **Rekordbox → Scan USB…** and select the USB root.
4. DRMVYZ reads the USB metadata in the Electron main process and returns only normalized track/cue data to React.
5. Load a track from the USB. DRMVYZ matches the native file path to the parsed Rekordbox track and hydrates cues, loops, BPM, key, and beat-grid seeds.

The selected USB root is expected to contain:

```txt
/PIONEER/rekordbox/export.pdb
/PIONEER/USBANLZ/**/*.DAT
/PIONEER/USBANLZ/**/*.EXT
/PIONEER/USBANLZ/**/*.2EX
```

`rekordbox.xml` does not need to be stored on the USB for this desktop flow.

## XML fallback flow

1. Export Rekordbox XML from Rekordbox.
2. In the DRMVYZ audio dock, choose **Rekordbox → Import XML…**.
3. Load or replace audio tracks.
4. DRMVYZ matches selected audio files by absolute path, USB-relative path, filename, filename stem, or title.
5. Matched tracks hydrate with Rekordbox metadata and cue markers before normal DRMVYZ audio intelligence runs.

The XML route remains useful in a normal browser, for unsupported USB database versions, or as a troubleshooting fallback.

## Native architecture

The Electron main process installs `native/rekordbox/rekordboxUsbBridge.cjs`. A context-isolated preload exposes only these narrow operations:

- open a native USB-root folder picker and parse it
- parse a known USB root inferred from a loaded track
- resolve a selected Electron `File` to its native path with `webUtils.getPathForFile`

Node integration stays disabled in the React renderer. The full USB is never copied into browser memory; the main process reads only Rekordbox metadata files and sends a normalized `RekordboxLibrary` over IPC.

## Parsed ANLZ metadata

The built-in parser reads:

- `PPTH` analyzed audio paths for track matching
- `PQTZ` beat grids, BPM values, and downbeats
- `PCO2` extended hot cues, memory cues, cue comments, colors, and loops
- `PCOB` legacy hot cues, memory cues, and loops

## Optional `export.pdb` enrichment

`rekordbox-parser` is installed as an optional production dependency. When available, DRMVYZ merges `export.pdb` fields with ANLZ data, including:

- title and artist
- album, genre, and label
- musical key and BPM
- rating, color, and comments
- canonical device audio path

If the optional package cannot be installed or cannot parse a particular database version, DRMVYZ falls back to its built-in ANLZ parser and surfaces a warning instead of blocking cue import.

## Automatic USB-root detection

Electron no longer exposes the legacy `File.path` property. DRMVYZ’s preload uses `webUtils.getPathForFile` to resolve selected audio files safely. Files loaded from paths such as these trigger a best-effort automatic metadata scan:

```txt
/Volumes/<USB name>/...       # macOS
E:/...                        # Windows
/media/<user>/<USB name>/...  # Linux
/run/media/<user>/<USB>/...   # Linux
```

Expected flow:

```txt
Load track from Rekordbox USB
  → infer USB root
  → native bridge parses export.pdb + ANLZ
  → match the loaded file
  → hydrate cues, loops, metadata, and beat grid
```

## Browser behavior

`npm run dev` still launches the browser-safe application. Browsers cannot expose native file paths or let the React renderer directly parse arbitrary USB files. In that mode, **Scan USB…** can only perform a limited File System Access API probe, and XML remains the reliable cue-import route.

## Packaging

```bash
npm run desktop:pack
npm run desktop:dist:mac
npm run desktop:dist:win
npm run desktop:dist:linux
```

Electron Builder writes outputs to `release/`. macOS microphone permission text is included in the packaged application. Code signing and notarization credentials are intentionally not committed to the repository.
