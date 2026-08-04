# orbital-audiospriter

Chrome-only PWA to prepare orbital sound packs: open a source folder of audio samples, edit each
sample in a browser (trim + loudness-normalize), assign orbital events, and export a
complete audiosprite - `<pack_id>.mp3/.ogg/.m4a` + `<pack_id>.json` + `<pack_id>.ts` - written
straight back to disk via the File System Access API.

No backend. All audio processing (decode, loudness, encode) runs in-browser via
**ffmpeg.wasm** in a Web Worker; the File System Access API does the read/write, so files never
leave your machine.

## Requirements

- **Chrome (or Edge/Opera) on desktop** - the File System Access API is required and is not
  available in Firefox/Safari. Unsupported browsers get a notice screen instead of the app.

## The workflow

1. Pick a folder of audio samples and an output folder (both via a directory picker).
2. Open a sample - a basic audio editor opens with a waveform.
3. Trim parts of the sample (cut at the playhead, delete pieces) and apply perceived loudness
   normalization (−23 LUFS is recommended).
4. Save the edited sample back as mono `.mp3` in the source folder (not a download - written
   in place).
5. Assign one or more orbital events to each sample (join_room, mute, deafen, camera_start,
   message, viewer_joined, ...). One sample can own several events; aliases are supported.
6. Export: the app concatenates the edited samples sample-accurately with a configurable gap and
   generates the audiosprite files plus orbital's `.ts` sprite definition into the output folder.
7. Register the generated pack in the orbital project as usual.

## Features

- Full editor: waveform (wavesurfer.js), transport, playhead, trim/cut, undo
- Loudness normalization to a configurable target LUFS (−23 default) with measured before/after
- Per-sample mono MP3 save-back to the source directory
- Event assignment (one sample can be bound to multiple events)
- Sample-accurate sprite assembly with configurable inter-sample gap
- Output in all three formats howler expects: `.ogg`, `.m4a`, `.mp3` (time-aligned), plus
  `.json` (audiosprite format, compatible with `pnpm run convert:soundsprite`) and `.ts`
  (byte-compatible with orbital's `convert-soundsprite.js` output)
- Offline-capable PWA (service worker precaches the app shell + WASM)

## Quickstart

```bash
make install        # pnpm install
make prepare-ffmpeg # copy @ffmpeg/core-st into public/ffmpeg
make dev            # Vite dev server -> http://localhost:5173
```

Open the **FFmpeg test** tab and run both checks to confirm the capability matrix in a real browser.

## Architecture

- Vue 3 + TypeScript + Vite + Tailwind CSS + Pinia (mirrors orbital)
- `@ffmpeg/ffmpeg` + `@ffmpeg/core-st` (single-thread core - no COOP/COEP headers required),
  lazy-loaded into a dedicated Web Worker on first encode
- `wavesurfer.js` v7 for waveform display and trim regions
- `vite-plugin-pwa` (Workbox) for the offline shell + WASM precache
- `vitest` for unit tests (loudness math, sprite/ts generation)

## Make targets

Conventions mirror orbital (`make help` lists everything):

| Target         | Description                                     |
| -------------- | ----------------------------------------------- |
| `make install` | Install dependencies                            |
| `make dev`     | Vite dev server                                 |
| `make build`   | Production build (+ PWA service worker)         |
| `make preview` | Preview the production build                    |
| `make typecheck` | `vue-tsc --noEmit`                            |
| `make lint` / `make lint-check` | ESLint with/without autofix     |
| `make prettier`| Prettier formatter                              |
| `make test` / `make test-run` | vitest watch / once                 |
| `make prepare-ffmpeg` | Copy `@ffmpeg/core-st` into `public/ffmpeg` |
| `make clean`   | Remove `dist`, `dev-dist`, `node_modules`       |

Straight `pnpm` wrappers exist too: `pnpm dev`, `pnpm typecheck`, `pnpm test:run`, `pnpm lint`, etc.
