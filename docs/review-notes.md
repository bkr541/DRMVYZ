# Review notes (temporary, development only)

A floating **Review notes** button in the bottom right of the visualizer lets you type a note about the preset on screen, optionally with a screenshot of the current frame. Notes are written to `.review-notes/` by the dev server so they can be read and worked through later. None of it is part of a production build.

## Using it

- Run the app with the dev server (`npm run dev`). A pencil button sits in the **middle of the app header**, on every page; a badge shows how many notes are open in the whole app.
- Click it. A panel hangs from the button. Choose what the note is about, what kind it is, type it, and save it (**Save note** or ⌘/Ctrl + Enter).
  - **About:** the preset on stage (only while the visualizer is showing one), **this page** (React, Preset Manager, Media Manager, Show Manager, Lyric Manager, Performance Manager or Admin), or **the whole app**. The default is the preset when there is one, else the page.
  - **Kind:** Bug, Gap (something missing), Change (something that exists should be different) or Idea.
  - **Area** (optional): where in the page, in your words, for example "upload modal" or "header".
  - **Screenshot this window:** captures the app window and attaches the PNG when the note is saved (**Retake screenshot** takes it again, **Remove** drops it). The capture hides the review controls and includes the stage and its overlays. Electron captures the rendered window directly. Browser capture reconstructs the page and skips video or canvas elements that the browser cannot read.
- The panel lists the notes for the chosen place (**Here**), or every open note in the app, grouped by place (**Everything open**). **Mark done** / **Reopen** and **Delete** are on each note. Typing in the panel never reaches the app's own shortcuts (Space does not play or pause).
- Each note also records what the screen was showing: the page, the route, the window size and the theme, and, with a preset on stage, whether it is playing, the tempo, the canvas size and the preset's control values.

## Where it is saved

- One markdown file per place: a preset (`.review-notes/cinema2__drmvyz.cinema2.inertia.md`), a page (`.review-notes/app__media.md`, `app__admin.md`, ...) or the whole app (`.review-notes/app__general.md`).
- Screenshots: `.review-notes/screenshots/<note-id>.png`.
- `.review-notes/INDEX.md` is regenerated on every change and lists every place with open notes, each with its kind and area, for example ``- `n_k3f` [bug] Upload loses tags. (upload modal) 📎``. A page or whole-app place reads as "Media Manager (app)".
- The folder is git-ignored. Each note has a readable body and one machine-readable line (`<!-- note: {json} -->`) that is the source of truth when the file is read back. Never delete the folder to clean up: it holds the real notes. The browser check removes only its own fixture files.

## Working through the notes (for Claude)

```sh
npm run review-notes -- list                          # every open note in every place, with its kind, area, file and screenshot
npm run review-notes -- list --all                    # open and done
npm run review-notes -- done <id> "what was changed"  # marks it done and records what changed
npm run review-notes -- reopen <id>
```

Read `.review-notes/INDEX.md` (or run `list`), open any screenshots, make the changes, then mark each note done with a line saying what changed. Use the command rather than editing the file by hand: the file is rewritten from the JSON line.

## How it is kept out of production

- `src/dev/reviewNotes/reviewNotesPlugin.ts` is a Vite plugin with `apply: 'serve'`, so the endpoints exist only in the dev server. Requests need an `x-review-notes: 1` header, which a web page on another origin cannot send without a pre-flight the server never answers; file names are sanitised, screenshots must be PNG, WebP or JPEG data URLs, and bodies are capped.
- `ApplicationWorkspaceFrame` (the header) and `ReactView` (which says which preset is on stage) load the dev code with `import.meta.env.DEV ? lazy(() => import(...)) : null`, so a production build removes it and its modules, including `html-to-image`, which is a dev dependency used only for the window screenshot.
- Electron exposes native screenshot capture only in development and limits it to the main app window's trusted dev origin.
- The folder `.review-notes/` is in `.gitignore`.

## Checks

- `npx vitest run --config vitest.node.config.ts src/dev/reviewNotes` covers the file format (round trip, awkward text, type and area), the store and the endpoints (one file per place, screenshots, status, delete, concurrent saves, refusals, an unknown type ignored, list-all).
- `npm run test:e2e:review-notes` (needs a dev server at `PLAYWRIGHT_BASE_URL`, default `http://127.0.0.1:5174`) drives the real control on a fixture page with a header and an animated WebGL canvas with a label over it: the button is in the middle of the header, the default place with and without a preset, typing is isolated from shortcuts, the window screenshot has the header, the WebGL canvas (not blank), the label still over the canvas and no notes panel, the files on disk, list-everything, mark done and delete.
- The browser capture can differ slightly from the screen for fonts and effects. The Electron capture uses the rendered pixels.
