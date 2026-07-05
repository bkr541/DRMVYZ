# Rekordbox Import Intelligence

DRMVYZ now has a browser-safe Rekordbox import layer for the performance deck.

## Current supported flow

1. Export Rekordbox XML from Rekordbox.
2. In the DRMVYZ audio dock, choose **RB XML** and select the XML file.
3. Load or replace audio tracks.
4. DRMVYZ matches selected audio files to Rekordbox tracks by USB relative path, filename, filename stem, or title.
5. Matched tracks are loaded with Rekordbox metadata, cue markers, loop regions, BPM/key seeds, and cue-seeded sections before the normal DRMVYZ audio intelligence pass runs.

The **RB USB** control can scan a selected folder/USB and load audio files directly when an XML export is present in the selection. It also detects `/PIONEER/rekordbox/export.pdb` and `/PIONEER/USBANLZ` analysis files so the app can explain when a full Rekordbox-device parser is needed.

## Imported data

- title, artist, album, genre, comments, rating, color
- BPM and musical key as trusted analysis seeds
- hot cues, memory cues, markers, and loops
- cue-seeded sections for labels like intro, build, drop, break, and outro

## Intentional limitation

The browser UI does not parse `export.pdb`, `.DAT`, `.EXT`, or `.2EX` yet. That should be implemented in an Electron/main-process bridge or a dedicated parser package so binary Rekordbox USB exports can be read without blocking the React render thread.

## Native/Electron USB parser bridge

The browser-safe `RB USB` path intentionally avoids `<input webkitdirectory>` because Brave/Chrome will try to enumerate or upload the entire USB. For the real USB flow, wire the native bridge into the Electron main/preload process and let Node read only Rekordbox metadata from disk.

### Main process wiring

```js
const path = require('node:path')
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { installRekordboxUsbBridge } = require('./native/rekordbox/rekordboxUsbBridge.cjs')

installRekordboxUsbBridge({ ipcMain, dialog, BrowserWindow })

const win = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    preload: path.join(__dirname, 'native/rekordbox/preloadRekordboxBridge.cjs'),
  },
})
```

### What the native bridge reads

When the user clicks `RB USB`, the bridge opens a native folder picker and expects the selected root to contain:

```txt
/PIONEER/rekordbox/export.pdb
/PIONEER/USBANLZ/**/*.DAT
/PIONEER/USBANLZ/**/*.EXT
/PIONEER/USBANLZ/**/*.2EX
```

It does **not** load the whole USB into the renderer. The main process reads metadata only and returns a DRMVYZ-native `RekordboxLibrary` object.

### Parsed metadata

The bridge now parses ANLZ files directly for:

- PPTH path tags for audio-file matching
- PQTZ beat grids and downbeats
- PCO2 extended hot cues, memory cues, comments, colors, and loops
- PCOB legacy hot cues, memory cues, and loops

If the optional `rekordbox-parser` package is available in the Electron main process, the bridge also enriches the ANLZ metadata with `export.pdb` fields such as artist, album, genre, label, key, rating, and comments. Without that optional package, DRMVYZ still imports beat grids, cue points, loops, and the analyzed audio path directly from ANLZ files.

### Automatic USB detection from a loaded track

In Electron runtimes that expose an absolute path on selected `File` objects, loading a track from `/Volumes/<USB name>/...`, a Windows drive root, or common Linux media mount paths triggers a native scan of that USB root automatically. That means the expected DJ flow becomes:

```txt
Load track from Rekordbox USB → DRMVYZ detects USB root → native bridge parses Rekordbox metadata → current track hydrates with cues/beat grid
```

If the app is running in a normal browser, absolute file paths are not available for privacy reasons. In that case the app falls back to explicit `RB USB` / `RB XML` import controls.
