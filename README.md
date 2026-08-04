# orbital-audiospriter

Chrome-only PWA to prepare orbital sound packs: open a source folder, trim + loudness-normalize
samples (-23 LUFS), assign orbital events, and export a complete audiosprite
(`<pack_id>.mp3/.ogg/.m4a` + `<pack_id>.json` + `<pack_id>.ts`).

## Quickstart

```bash
make install        # pnpm install
make dev            # Vite dev server -> http://localhost:5173
```

Open the **FFmpeg test** tab and run both checks to confirm the capability matrix in a real browser

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
