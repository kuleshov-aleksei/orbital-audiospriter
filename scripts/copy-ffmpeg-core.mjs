import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const corePkg = join(root, "node_modules", "@ffmpeg", "core-st")
const outDir = join(root, "public", "ffmpeg")

if (!existsSync(corePkg)) {
  console.error("[copy-ffmpeg-core] @ffmpeg/core-st is not installed. Run `pnpm install` first.")
  process.exit(1)
}

function findFile(dir, name, results = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      findFile(p, name, results)
    } else if (entry === name) {
      results.push(p)
    }
  }
  return results
}

const umdJs = findFile(join(corePkg, "dist"), "ffmpeg-core.js")
const wasm = findFile(join(corePkg, "dist"), "ffmpeg-core.wasm")

if (umdJs.length !== 1 || wasm.length !== 1) {
  console.error(`[copy-ffmpeg-core] expected 1 ffmpeg-core.js + 1 ffmpeg-core.wasm, found ${umdJs.length}/${wasm.length}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

// @ffmpeg/ffmpeg 0.12 loads the core in a module worker via `import(coreURL).default`,
// but core-st 0.11 ships a classic UMD script. Append a default export to turn it into
// a real ESM module: the top-level `var createFFmpegCore` stays module-scoped and the
// UMD tail no-ops (module/exports are undefined in ESM).
//
// The 0.11 glue differs from what the 0.12 loader expects in several ways:
//   - no `setLogger`/`setProgress`/`setTimeout`/`exec`/`ret`/`reset` (0.12-only API)
//   - `run()` is a dead path in this glue (its `xd` gate is hardcoded false), so the
//     0.12 loader's `exec` must be emulated by calling the wasm `_main` export directly
//     with an argv pointer array (exactly how ffmpeg.wasm 0.11 drove this same core)
//   - with EXIT_RUNTIME active, the first command's `exit()` closes the tty streams and
//     subsequent runs produce no stdout/stderr; `noExitRuntime: true` keeps the runtime
//     (and streams) alive across commands, while error exits still surface as ExitStatus
//   - no mainScriptUrlOrBlob/wasmURL support (it would resolve the wasm relative to the
//     worker script's own URL), so `locateFile` pins core file fetches to /ffmpeg/
//
// The wrapper therefore:
//   1. injects `locateFile` pinning core file fetches to /ffmpeg/ and `noExitRuntime`
//   2. shims `setLogger` by routing stdout/stderr (config print/printErr) to the log
//      callback as `{ type, message }` events, and no-ops `setProgress`/`setTimeout`
//   3. shims `exec(...args)` (argv via _malloc/stringToUTF8, run `_main`, map ExitStatus
//      to the exit code), storing the result in `ret` with `reset()` clearing it
const source = readFileSync(umdJs[0], "utf-8")
const esm = `${source}
export default function (config = {}) {
  const logListeners = new Set()
  const emit = (type, message) => {
    for (const cb of logListeners) {
      try {
        cb({ type, message: String(message) })
      } catch (err) {
        console.warn("[ffmpeg-core] log callback error:", err)
      }
    }
  }
  return createFFmpegCore({
    ...config,
    noExitRuntime: true,
    print: (line) => emit("stdout", line),
    printErr: (line) => emit("stderr", line),
    locateFile: (path) => "/ffmpeg/" + path,
  }).then((module) => {
    const buildArgv = (core, args) => {
      const argvPtr = core._malloc((args.length + 1) * 4)
      const ptrs = []
      for (let i = 0; i < args.length; i++) {
        const s = String(args[i])
        const p = core._malloc(s.length + 1)
        core.stringToUTF8(s, p, s.length + 1)
        ptrs.push(p)
        core.HEAP32[(argvPtr >> 2) + i] = p
      }
      core.HEAP32[(argvPtr >> 2) + args.length] = 0
      return { argvPtr, free: () => { for (const p of ptrs) core._free(p); core._free(argvPtr) } }
    }
    if (typeof module.setLogger !== "function") {
      module.setLogger = (callback) => {
        logListeners.add(callback)
        return () => logListeners.delete(callback)
      }
    }
    if (typeof module.setProgress !== "function") {
      module.setProgress = () => {}
    }
    if (typeof module.exec !== "function") {
      module.setTimeout = () => {}
      module.ret = null
      module.exec = (...args) => {
        const flat = args.length === 1 && Array.isArray(args[0]) ? args[0] : args
        const { argvPtr, free } = buildArgv(module, flat)
        let code = 0
        try {
          code = module._main(flat.length, argvPtr)
        } catch (err) {
          if (err && err.name === "ExitStatus") {
            code = typeof err.status === "number" ? err.status : 0
          } else {
            free()
            throw err
          }
        }
        free()
        module.ret = code
        return code
      }
      module.reset = () => {
        module.ret = null
      }
    }
    return module
  })
}
`
writeFileSync(join(outDir, "ffmpeg-core.js"), esm)

cpSync(wasm[0], join(outDir, "ffmpeg-core.wasm"))

for (const target of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  const bytes = statSync(join(outDir, target)).size
  console.log(`[copy-ffmpeg-core] ${join(outDir, target)} (${(bytes / 1024 / 1024).toFixed(1)} MB, ${target.endsWith(".js") ? "esm-wrapped" : "raw"})`)
}
