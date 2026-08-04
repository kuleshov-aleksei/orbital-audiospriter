import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const corePkg = join(root, "node_modules", "@ffmpeg", "core-st")
const outDir = join(root, "public", "ffmpeg")

if (!existsSync(corePkg)) {
  console.error("[copy-ffmpeg-core] @ffmpeg/core-st is not installed. Run `pnpm install` first.")
  process.exit(1)
}

function findFiles(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      findFiles(p, results)
    } else if (entry === "ffmpeg-core.js" || entry === "ffmpeg-core.wasm") {
      results.push(p)
    }
  }
  return results
}

const files = findFiles(join(corePkg, "dist"))
if (files.length !== 2) {
  console.error(`[copy-ffmpeg-core] expected ffmpeg-core.js + ffmpeg-core.wasm, found: ${files.join(", ")}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
for (const file of files) {
  const target = join(outDir, file.split(/[\\/]/).pop())
  cpSync(file, target)
  const bytes = statSync(target).size
  console.log(`[copy-ffmpeg-core] ${target} (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
}
