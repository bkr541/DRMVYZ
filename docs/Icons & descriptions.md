# Icons & descriptions

Every icon in the application, grouped by the page it appears on.

Each entry is: **Icon name** — what it does — **Unique** or **Shared**.

- **Shared** means the same icon, doing the same job, is used on more than one page (or on every page, for the App Shell).
- **Unique** means it is used on that page's UI only.
- Icon names are the names in the icon library (`AppIcon`), shown in plain words where that is clearer.
- Not covered: the Layout Lab mock-ups (design experiments, not product pages) and icons that are drawn from data at run time, such as engine, fixture and preset artwork.

---

## App Shell (header, sidebar, audio dock — present on every page)

- **Page header (left, on every page):** DRMVYZ logo, page name, a "|" divider, then the page's own action keys. See "Header action keys" below.
- **Header action keys**
  - **Create (plus)** — create a new item. Used by Media Manager (New Media), Preset Manager (Create preset), Show Manager (New Show). — **Shared**
  - **Create collection (folder with plus)** — create a new collection or group. Media Manager only. — **Unique**
  - **Open (folder)** — open a saved item from a browser. Show Manager (Open Show). — **Unique**
  - **Save (disk)** — save the current work. Lyric, Media, Preset and Show Manager. — **Shared**
  - **Save + Make Active (disk with mark)** — save and make that version the active one. Lyric and Show Manager. — **Shared**
  - **Duplicate (copy)** — copy the selected item. Preset Manager header (placeholder, does nothing yet). — **Shared** (same icon as Copy/Duplicate elsewhere)
  - **Delete (trash)** — delete the selected item; turns red on hover. Media and Preset Manager headers. — **Shared**
  - **Show Lyrics** — show or hide active lyrics in the visualizer. Lyric Manager; Show Manager (currently disabled). — **Shared**
  - **Undo / Redo** — step back or forward through edits. Show Manager header. — **Shared** (also in the Lyric Manager timeline)
  - **List** — expand or collapse the Track Timeline row icons. Lyric Manager. — **Unique**
- **Header right side**
  - **Notification bell** — open the notification drawer. — **Shared**
  - **Settings (gear)** — open Profile and settings. — **Shared**
  - **Loading (spinner)** — system status: something is loading or saving. — **Shared**
- **Sidebar**
  - **Brand** — DRMVYZ logo. — **Shared**
  - **navReact / navShow / navMedia / navLyrics / navPreset** — go to the React, Show, Media, Lyric and Preset pages. — **Shared**
  - **Chevron right** — expand or collapse the sidebar. — **Shared**
  - **Sliders** — open workspace options. — **Shared**
- **Audio dock**
  - **Previous / Next** — skip to the previous or next track. — **Unique**
  - **Play / Pause** — start or stop playback. — **Shared**
  - **Volume** — track volume. — **Shared**
  - **Plus (Load/Add audio)** — load a track, or append one to the playlist. — **Shared**
  - **Minus** — zoom the waveform out. — **Unique**
  - **Rotate left** — reset BPM to the detected value. — **Shared**
  - **Sliders** — audio source and Rekordbox tools. — **Shared**
  - **Mic** — live audio input as the source. — **Shared**
  - **Tap** — tap tempo. — **Unique**
  - **Cue** — set the cue point, or jump to it. — **Unique**
  - **Sync** — BPM sync on/off. — **Shared** (also Refresh in React output)
  - **Playlist** — open the loaded-tracks list. — **Unique**
  - **Delete** — remove a track from the playlist. — **Shared**
  - **Loading** — track is being analyzed. — **Shared**

## React

- **Output status (power)** — arm or disarm production output. — **Unique**
- **Reveal (eye)** — reveal the output window. — **Shared** (eye is also used as "preview" and "show password")
- **Blackout** — black out the output. — **Unique**
- **Cast** — open output/cast settings. — **Unique**
- **Window / Borderless / Expand** — output window mode. — **Unique**
- **Aspect ratios (16:9, 16:10, 4:3, 3:2, 1:1, 9:16)** — choose the output aspect ratio. — **Unique**
- **People** — list available output devices. — **Unique**
- **Sync** — refresh the device list. — **Shared**
- **Apple / Google / Windows** — platform label on a device or connection. — **Unique**
- **Record / Stop** — start and stop recording. — **Unique**
- **Camera** — export the current frame as a PNG. — **Unique**
- **Engine icons (Canvas, Cinema, Headliner, Laser, Orbit, PixGrid, Shader)** — identify each visual engine. — **Unique** (Canvas is also on the Show Manager)
- **Settings** — Inspector tab header. — **Shared**
- **Grid** — React Workspace tab header, and performance pads. — **Shared**
- **List** — list layout. — **Shared**
- **Camera focus** — focus the camera on the scene. — **Unique**
- **Chevron down / right** — expand or collapse a group, or step to the next item. — **Shared**
- **Left** — back, or previous boundary suggestion in the Track Map. — **Shared**
- **Close (x)** — close a dialog or remove an item. — **Shared**
- **Plus** — add a layer, route, fixture or font. — **Shared**
- **Delete** — delete a layer, route, fixture or font. — **Shared**
- **Copy** — duplicate a layer, beam or reaction group. — **Shared**
- **Move** — drag or reposition. — **Shared** (also in the Lyric timeline)
- **Up / Down** — reorder. — **Shared**
- **Lock / Unlock** — lock or unlock a PixGrid layer. — **Shared** (lock is also on the sign-in page)
- **Eye / Eye off** — show or hide a layer. — **Shared**
- **Search** — search presets and fonts. — **Shared**
- **Check** — confirm, or "analysis done". — **Shared**
- **Warning** — beat grid out of sync, retry. — **Shared**
- **Info** — explanatory notice or tooltip. — **Shared**
- **Loading** — analysis in progress. — **Shared**
- **Rotate left** — restore analyzed values, or retry analysis. — **Shared**
- **Wand** — AI action. — **Shared**
- **Sliders / Layers** — group headers in the diagnostics and canvas shell. — **Shared**
- **Waveform / Bars / Energy / Rhythm / Beats / Sections / Ruler / Timeline / Tree / Tag** — Track Map lanes and music-intelligence readouts. — **Unique**
- **Split / Grid snap** — timeline tools. — **Unique**
- **Mic** — live input. — **Shared**
- **Music** — track. — **Shared**
- **Lyrics** — lyric lane. — **Shared**
- **Play** — preview or play. — **Shared**
- **Text / SVG / Shape / Font / FX / Mirror / Orbit / Scope / Constellation / Corridor / Storm** — engine and preset category icons. — **Unique** (Shape is also in Settings)

## Show Manager

- **Create (plus)** — New Show (header). — **Shared**
- **Open (folder)** — Open Show (header). — **Unique**
- **Save / Save + Make Active** — save the show. — **Shared**
- **Show Lyrics** — disabled placeholder. — **Shared**
- **Undo / Redo** — undo or redo a show edit. — **Shared**
- **Stage tools (pointer, move, rotate right, grid snap, grid, split, zoom 20)** — placeholder stage tools, all disabled. — **Unique**
- **Component Library rows** — component and asset type icons. — **Unique**
- **Layers** — Component Library title. — **Shared**
- **Settings** — Inspector title. — **Shared**
- **Canvas** — Canvas engine. — **Shared**
- **Search** — search components (disabled). — **Shared**
- **More (vertical)** — more actions. — **Unique**
- **File** — show file in the browser. — **Shared**
- **Image** — Deck Builder image. — **Unique**
- **Up / Down** — reorder. — **Shared**
- **Left / Chevron right / Close** — navigate or close. — **Shared**
- **Eye off** — hidden layer. — **Shared**

## Media Manager

- **Create collection / Create (plus)** — header keys. — **Unique** / **Shared**
- **Save / Delete** — header keys for the selected media. — **Shared**
- **Add image** — add images to the library. — **Unique**
- **Folder / Folder add** — collection. — **Unique**
- **Grid / List** — switch library view. — **Shared**
- **Search / Close** — search and clear search. — **Shared**
- **Edit** — edit a collection. — **Shared**
- **Delete** — remove media. — **Shared**
- **Eye** — preview media. — **Shared**
- **Star / Star filled** — favorite or unfavorite (also on Preset Manager cards). — **Shared**
- **Download** — download. — **Shared**
- **Upload** — upload media. — **Shared**
- **Left / Up** — back, or up one folder. — **Shared**
- **Warning** — upload or derivative error. — **Shared**
- **Info** — details notice. — **Shared**
- **Layers** — Media Library title. — **Shared**
- **Music / Play / Pause** — audio track preview. — **Shared**
- **More / Lyric actions / Lyric versions / Wand** — audio track card: overflow menu, lyric actions, open active lyrics, AI extract lyrics. — **Unique**
- **Crop / Rotate left / Rotate right** — image edit tools. — **Unique**

## Preset Manager

- **Create / Save / Duplicate / Delete (header)** — placeholders that do nothing yet. — **Shared**
- **Layers** — Preset Library title. — **Shared**
- **Settings** — Inspector title. — **Shared**
- **Waveform** — audio-reactive preset. — **Shared**
- **Download** — My Downloads. — **Shared**
- **Star / Star filled** — favorite. — **Shared**
- **Store: play / right / chevron right / left / sliders** — preview, explore, open, back, filters. — **Shared**

## Lyric Manager

- **Show Lyrics / Save / Save + Make Active / List** — header keys. — **Shared** / **Shared** / **Shared** / **Unique**
- **Timeline toolbar: undo, redo, copy, delete, plus, move, scissors, align start, align end, bars, left, right, play, pause, volume** — edit and playback tools. — **Shared** (undo, redo, copy, delete, plus, move, play, pause, volume); **Unique** (scissors, align start, align end, bars)
- **File add / File import** — new lyric version, import. — **Unique**
- **Document list: edit, copy, check, close, delete** — rename, duplicate, make active, cancel, delete. — **Shared**
- **Upload / Check / File** — JSON lyric import. — **Shared**
- **Checklist** — review summary. — **Unique**
- **Eye** — preview. — **Shared**
- **Lyrics / Warning / Waveform / Search / Close / Chevron right / Left** — cue timeline status, search, navigation. — **Shared**

## Settings, Personalization and Sign-in

- **Close** — close the settings dialog. — **Shared**
- **Upload / Warning** — import and error notices. — **Shared**
- **Copy / Chevron** — developer logging panel. — **Shared**
- **Brand kit: brand, shape, plus, rotate left, close, chevron right** — logo, shape, add, reset, remove, expand. — **Shared**
- **Sign-in: mail, lock, user, eye, eye off, mic, check, warning** — form fields and states. — **Unique** (mail, user); **Shared** (the rest)
