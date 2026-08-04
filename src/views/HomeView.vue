<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
    <div>
      <h2 class="text-xl font-semibold text-zinc-100">Orbital AudioSpriter</h2>
      <p class="mt-1 max-w-3xl text-sm text-zinc-400">
        Chrome-only PWA for preparing orbital sound packs: open a folder, trim + normalize samples
        to -23 LUFS, assign events, and export an audiosprite (.mp3/.ogg/.m4a + .json + .ts).
      </p>
    </div>

    <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 class="text-sm font-semibold text-zinc-200">Phase 2 — File System Access</h3>
      <p class="mt-1 text-xs text-zinc-500">
        Directory handles are persisted in IndexedDB and re-validated on reload; permission can be
        re-requested in place.
      </p>

      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-zinc-800 bg-black/20 p-4">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-sm font-medium text-zinc-200">Samples folder</h4>
            <span
              class="inline-block rounded px-2 py-0.5 text-xs font-medium"
              :class="chipClass(store.sourceDirStatus)">
              {{ statusLabel(store.sourceDirStatus) }}
            </span>
          </div>
          <p v-if="store.sourceDirHandle" class="mt-2 truncate font-mono text-xs text-zinc-400">
            {{ store.sourceDirHandle.name }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="btn" @click="openSource()">
              {{ store.sourceDirHandle ? "Change folder" : "Open samples folder" }}
            </button>
            <button
              v-if="store.sourceDirHandle && store.sourceDirStatus === 'prompt'"
              type="button"
              class="btn-secondary"
              @click="reGrant('source')">
              Re-request access
            </button>
            <button
              v-if="store.sourceDirHandle && store.sourceDirStatus === 'denied'"
              type="button"
              class="btn-secondary"
              @click="reGrant('source')">
              Re-request access
            </button>
            <button
              v-if="store.sourceDirHandle"
              type="button"
              class="btn-danger"
              @click="detach('source')">
              Detach
            </button>
          </div>
        </div>

        <div class="rounded-lg border border-zinc-800 bg-black/20 p-4">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-sm font-medium text-zinc-200">Output folder (orbital repo)</h4>
            <span
              class="inline-block rounded px-2 py-0.5 text-xs font-medium"
              :class="chipClass(store.outputDirStatus)">
              {{ statusLabel(store.outputDirStatus) }}
            </span>
          </div>
          <p v-if="store.outputDirHandle" class="mt-2 truncate font-mono text-xs text-zinc-400">
            {{ store.outputDirHandle.name }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="btn" @click="openOutput()">
              {{ store.outputDirHandle ? "Change folder" : "Open output folder" }}
            </button>
            <button
              v-if="store.outputDirHandle && store.outputDirStatus === 'prompt'"
              type="button"
              class="btn-secondary"
              @click="reGrant('output')">
              Re-request access
            </button>
            <button
              v-if="store.outputDirHandle && store.outputDirStatus === 'denied'"
              type="button"
              class="btn-secondary"
              @click="reGrant('output')">
              Re-request access
            </button>
            <button
              v-if="store.outputDirHandle"
              type="button"
              class="btn-danger"
              @click="detach('output')">
              Detach
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="store.sourceGranted"
        class="mt-4 rounded-lg border border-zinc-800 bg-black/20 p-4">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-sm font-medium text-zinc-200">Audio files</h4>
          <button type="button" class="btn-secondary" @click="refreshFiles()">Refresh</button>
        </div>
        <p v-if="filesError" class="mt-2 text-sm text-red-400">{{ filesError }}</p>
        <p v-else-if="files.length === 0" class="mt-2 text-sm text-zinc-500">
          No audio files in this folder.
        </p>
        <ul v-else class="mt-2 max-h-64 divide-y divide-zinc-800/60 overflow-auto">
          <li
            v-for="file in files"
            :key="file.name"
            class="flex items-center justify-between gap-4 py-1.5">
            <span class="truncate font-mono text-xs text-zinc-300">{{ file.name }}</span>
            <span class="shrink-0 font-mono text-xs text-zinc-500">{{
              formatBytes(file.size)
            }}</span>
          </li>
        </ul>
      </div>

      <div v-if="store.sourceGranted" class="mt-4 flex items-center gap-3">
        <button
          type="button"
          class="btn-secondary"
          :disabled="probeStatus === 'writing'"
          @click="probeWrite()">
          {{ probeStatus === "writing" ? "Writing…" : "Probe write-back" }}
        </button>
        <p v-if="probeStatus === 'done'" class="text-sm text-emerald-400">
          Wrote <code class="font-mono">__audiosprter_write_probe.txt</code> to the samples folder.
        </p>
        <p v-else-if="probeStatus === 'error'" class="text-sm text-red-400">{{ probeError }}</p>
        <p v-else class="text-xs text-zinc-500">
          Creates a small text file in the samples folder to prove create+writable works.
        </p>
      </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2">
      <div
        v-for="phase in phases"
        :key="phase.title"
        class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 class="text-sm font-semibold text-zinc-200">{{ phase.title }}</h3>
        <p class="mt-1 text-xs text-zinc-500">{{ phase.description }}</p>
        <p class="mt-3">
          <span
            class="inline-block rounded px-2 py-0.5 text-xs font-medium"
            :class="phase.done ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'"
            >{{ phase.done ? "done" : "pending" }}</span
          >
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"
import { useProjectStore } from "@/stores/project"
import type { DirStatus } from "@/stores/project"
import { listAudioFiles, writeFileToDir } from "@/services/fsAccess"
import type { AudioFileEntry } from "@/services/fsAccess"
import { formatBytes } from "@/utils/format"

defineOptions({ name: "HomeView" })

const store = useProjectStore()

const files = ref<AudioFileEntry[]>([])
const filesError = ref<string | null>(null)
const probeStatus = ref<"idle" | "writing" | "done" | "error">("idle")
const probeError = ref<string | null>(null)

const phases = [
  {
    title: "Phase 1 — Scaffold + spike",
    description: "Vue/Vite/PWA shell and ffmpeg.wasm codec/filter verification.",
    done: true,
  },
  {
    title: "Phase 2 — File System Access",
    description: "Open dirs, read/write files, persist handles in IndexedDB.",
    done: false,
  },
  {
    title: "Phase 3 — Import + editor",
    description: "decodeAudioData → PCM, wavesurfer.js waveform, trim regions, undo.",
    done: false,
  },
  {
    title: "Phase 4 — Loudness",
    description: "JS EBU R128 to -23 LUFS with before/after preview.",
    done: false,
  },
  {
    title: "Phase 5 — Per-sample save",
    description: "Encode mono MP3 and write back to the source dir.",
    done: false,
  },
  {
    title: "Phase 6 — Event assignment",
    description: "Multi-assign orbital events, alias suggestions.",
    done: false,
  },
  {
    title: "Phase 7 — Sprite export",
    description: "Sample-accurate concat, 3 formats, .json + .ts generation.",
    done: false,
  },
  {
    title: "Phase 8 — Polish",
    description: "Error states, permission flows, offline verification.",
    done: false,
  },
]

function statusLabel(status: DirStatus): string {
  switch (status) {
    case "granted":
      return "access granted"
    case "prompt":
      return "needs re-request"
    case "denied":
      return "access denied"
    default:
      return "not chosen"
  }
}

function chipClass(status: DirStatus): string {
  switch (status) {
    case "granted":
      return "bg-emerald-500/10 text-emerald-400"
    case "prompt":
      return "bg-amber-500/10 text-amber-400"
    case "denied":
      return "bg-red-500/10 text-red-400"
    default:
      return "bg-zinc-800 text-zinc-400"
  }
}

async function openSource(): Promise<void> {
  try {
    await store.openSourceDir()
    await refreshFiles()
  } catch {
    // picker cancelled or API unavailable
  }
}

async function openOutput(): Promise<void> {
  try {
    await store.openOutputDir()
  } catch {
    // picker cancelled or API unavailable
  }
}

async function reGrant(scope: "source" | "output"): Promise<void> {
  await store.ensurePermission(scope)
  if (scope === "source") await refreshFiles()
}

async function detach(scope: "source" | "output"): Promise<void> {
  await store.detachDir(scope)
  if (scope === "source") files.value = []
}

async function refreshFiles(): Promise<void> {
  const dir = store.sourceDirHandle
  if (!dir || store.sourceDirStatus !== "granted") {
    files.value = []
    return
  }
  filesError.value = null
  try {
    files.value = await listAudioFiles(dir)
  } catch (error) {
    filesError.value = error instanceof Error ? error.message : String(error)
  }
}

async function probeWrite(): Promise<void> {
  const dir = store.sourceDirHandle
  if (!dir) return
  probeStatus.value = "writing"
  probeError.value = null
  try {
    const payload = new TextEncoder().encode(
      `orbital-audiospriter write probe\n${new Date().toISOString()}\n`,
    )
    await writeFileToDir(dir, "__audiosprter_write_probe.txt", payload)
    probeStatus.value = "done"
    await refreshFiles()
  } catch (error) {
    probeStatus.value = "error"
    probeError.value = error instanceof Error ? error.message : String(error)
  }
}

onMounted(async () => {
  await store.restoreFromIndexedDb()
  await refreshFiles()
})
</script>

<style scoped>
@reference "../style.css";

.btn {
  @apply rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50;
}
.btn-secondary {
  @apply rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50;
}
.btn-danger {
  @apply rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-red-500/20 hover:text-red-300;
}
</style>
