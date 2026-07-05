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
