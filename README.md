# orbital-audiospriter

Chrome-only PWA to prepare orbital sound packs: open a source folder, trim + loudness-normalize
samples (-23 LUFS), assign orbital events, and export a complete audiosprite
(`<pack_id>.mp3/.ogg/.m4a` + `<pack_id>.json` + `<pack_id>.ts`).

Spec: [`AUDIOSPRITER.md`](./AUDIOSPRITER.md).

## Quickstart

```bash
make install        # pnpm install
make dev            # Vite dev server -> http://localhost:5173
```

Open the **Spike** tab and run both checks to confirm the capability matrix in a real browser
(streaming import from the worker cannot be exercised headlessly).

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

## Capability matrix (Phase 1 spike)

### Pre-verified in the `@ffmpeg/core-st` wasm binary

The official single-thread core ships these symbols (detected via string scan of `ffmpeg-core.wasm`):

| Feature        | Present | Required by |
| -------------- | :-----: | ----------- |
| `libmp3lame`   | ✓ | .mp3 (sprite + per-sample save) |
| `libvorbis`    | ✓ | .ogg (sprite) |
| `libopus`      | ✓ | optional .ogg alt |
| `libfdk_aac`   | ✓ | .m4a (sprite) — prefers `libfdk_aac` over native `aac` |
| `loudnorm`     | ✓ | optional two-pass; JS EBU R128 fallback exists |
| `ebur128`      | ✓ | backs `loudnorm` |
| `aresample`    | ✓ | resampling |
| `volume`       | ✓ | JS-gain path always available |

### Pending real-chrome validation (`make dev` → Spike tab)

- `-encoders` / `-filters` parse through the worker
- sine → mp3 / ogg / m4a encode self-test (byte sizes)
- `loudnorm=I=-23` two-pass run

Fallback if the browser run contradicts any row above: custom minimal core via
`ffmpegwasm/ffmpeg.wasm-core` build scripts, or pure-JS EBU R128 normalization.

## Stack

Vue 3.5 + TypeScript + Vite 8 + Tailwind 4 + Pinia, `@ffmpeg/ffmpeg` + `@ffmpeg/core-st`
(single-thread, no COOP/COEP), wavesurfer.js v7 (Phase 3), `vite-plugin-pwa`, vitest.
Mirrors orbital's frontend conventions (eslint flat config, prettier, `@/*` alias, script-setup SFCs).