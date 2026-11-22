# Review notes (temporary, development only)

A floating **Review notes** button in the bottom right of the visualizer lets you type a note about the preset on screen, optionally with a screenshot of the current frame. Notes are written to `.review-notes/` by the dev server so they can be read and worked through later. None of it is part of a production build.

## Using it

- Run the app with the dev server (`npm run dev`). The pencil button appears at the bottom right of the visualizer stage; a badge shows how many notes are open for the preset on screen.
- Click it, type the note, optionally tick **Attach a screenshot of the current frame** (a preview shows what will be saved; **Retake** takes it again), then press **Save note** or ⌘/Ctrl + Enter.
- The panel lists that preset's notes, newest first. **Mark done** / **Reopen** and **Delete** are on each note. Typing in the panel never reaches the app's own shortcuts (Space does not play or pause).
- Each note also records what the screen was showing: playing or not, tempo, canvas size and, for Cinema 2.0 presets, the preset's control values.

## Where it is saved

- One markdown file per preset: `.review-notes/<engine>__<preset-id>.md`, for example `.review-notes/cinema2__drmvyz.cinema2.inertia.md`.
- Screenshots: `.review-notes/screenshots/<note-id>.png`.
- `.review-notes/INDEX.md` is regenerated on every change and lists every preset with open notes.
- The folder is git-ignored. Each note has a readable body and one machine-readable line (`<!-- note: {json} -->`) that is the source of truth when the file is read back.

## Working through the notes (for Claude)

```sh
npm run review-notes -- list                          # every open note, with its file and screenshot
npm run review-notes -- list --all                    # open and done
npm run review-notes -- done <id> "what was changed"  # marks it done and records what changed
npm run review-notes -- reopen <id>
```

Read `.review-notes/INDEX.md` (or run `list`), open any screenshots, make the changes, then mark each note done with a line saying what changed. Use the command rather than editing the file by hand: the file is rewritten from the JSON line.

## How it is kept out of production

- `src/dev/reviewNotes/reviewNotesPlugin.ts` is a Vite plugin with `apply: 'serve'`, so the endpoints exist only in the dev server. Requests need an `x-review-notes: 1` header, which a web page on another origin cannot send without a pre-flight the server never answers; file names are sanitised, screenshots must be PNG, WebP or JPEG data URLs, and bodies are capped.
- `ReactView` loads the button with `import.meta.env.DEV ? lazy(() => import(...)) : null`, so a production build removes it and its module.
- The folder `.review-notes/` is in `.gitignore`.

## Checks

- `npx vitest run --config vitest.node.config.ts src/dev/reviewNotes` covers the file format (round trip, awkward text), the store and the endpoints (one file per preset, screenshots, status, delete, concurrent saves, refusals).
- `npm run test:e2e:review-notes` (needs a dev server at `PLAYWRIGHT_BASE_URL`, default `http://127.0.0.1:5174`) drives the real component on a fixture page with an animated WebGL canvas: button position, typing isolated from shortcuts, a non-blank screenshot, files on disk, reload, mark done, reopen and delete. It cleans up after itself.
- **Not done:** the button has not been looked at inside the logged-in app itself (the app needs a login); it is mounted in `ReactView`'s visualizer stage, the same container the fixture mimics.
