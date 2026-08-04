# orbital-audiospriter

Chrome-only PWA to prepare orbital sound packs: open a source folder, trim + loudness-normalize
samples (-23 LUFS), assign orbital events, and export a complete audiosprite
(`<pack_id>.mp3/.ogg/.m4a` + `<pack_id>.json` + `<pack_id>.ts`).

Spec: [`AUDIOSPRITER.md`](./AUDIOSPRITER.md).

## Quickstart

1. Install dependencies:

```bash
pnpm install
```

2. Copy the ffmpeg core into `public/ffmpeg` (run automatically on `predev`/`prebuild`, but you can
   run it manually):

```bash
pnpm prepare:ffmpeg
```

3. Run the dev server, open the **Spike** tab and run both checks:

```bash
pnpm dev
```

## Scripts

| Script             | Description                                   |
| ------------------ | --------------------------------------------- |
| `pnpm dev`         | Vite dev server                               |
| `pnpm build`       | Production build (+ PWA service worker)       |
| `pnpm preview`     | Preview the production build                  |
| `pnpm typecheck`   | `vue-tsc --noEmit`                            |
| `pnpm test`        | `vitest` (watch)                              |
| `pnpm test:run`    | `vitest run`                                  |
| `pnpm lint`        | ESLint (fix) on `src/`                        |
| `pnpm lint:check`  | ESLint (no fix) on `src/`                     |
| `pnpm prettier`    | Prettier write                                |
| `pnpm prepare:ffmpeg` | Copy `@ffmpeg/core-st` umd into `public/ffmpeg` |

## Capability matrix (Phase 1 spike)

Populated from the Spike tab (also self-test encoded sizes). Fill once verified:

| Feature        | Required by   | Status |
| -------------- | ------------- | ------ |
| `libmp3lame`   | .mp3 (sprite + per-sample save) | ⏳ spike |
| `libvorbis`    | .ogg (sprite)                   | ⏳ spike |
| `aac`/`libfdk_aac` | .m4a (sprite)               | ⏳ spike |
| `libopus`      | optional .ogg alt               | ⏳ spike |
| `loudnorm`     | optional; fallback JS EBU R128  | ⏳ spike |
| `volume`       | JS-gain path always available   | ⏳ spike |

Fallbacks if missing: custom minimal core via `ffmpegwasm/ffmpeg.wasm-core` build scripts, or
pure-JS EBU R128 normalization.

## Stack

Vue 3.5 + TypeScript + Vite 8 + Tailwind 4 + Pinia, `@ffmpeg/ffmpeg` + `@ffmpeg/core-st`
(single-thread, no COOP/COEP), wavesurfer.js v7 (Phase 3), `vite-plugin-pwa`, vitest.
Mirrors orbital's frontend conventions (eslint flat config, prettier, `@/*` alias, script-setup SFCs).