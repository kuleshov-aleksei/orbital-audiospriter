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

    <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 class="text-sm font-semibold text-zinc-200">Sprite pack</h3>
      <p class="mt-1 text-xs text-zinc-500">
        Name of the audio sprite (snake_case, used as the file base name at export) and the silence
        gap between samples. Saved to the project mapping file.
      </p>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label class="text-xs text-zinc-500">
          Pack name
          <input
            v-model="store.packId"
            type="text"
            placeholder="e.g. my_new_pack"
            class="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-200"
            :class="{ 'border-red-500/60': !packIdValid }"
            spellcheck="false" />
        </label>
        <label class="text-xs text-zinc-500">
          Gap between samples (s)
          <input
            v-model.number="store.gap"
            type="number"
            min="0"
            max="5"
            step="0.01"
            class="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-200" />
        </label>
      </div>
      <p v-if="!packIdValid" class="mt-2 text-xs text-red-400">
        Use lowercase letters, numbers and underscores only (e.g.
        <code class="font-mono">my_new_pack</code>).
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="btn"
          :disabled="!packIdValid || packSaving"
          @click="savePack()">
          {{ packSaving ? "Saving…" : "Save pack settings" }}
        </button>
        <p
          v-if="packStatus"
          class="text-sm"
          :class="packError ? 'text-red-400' : 'text-emerald-400'">
          {{ packStatus }}
        </p>
        <p v-else class="text-xs text-zinc-500">
          Persists the pack name + gap to <code class="font-mono">__audiosprter.events.json</code>.
        </p>
      </div>
    </section>

    <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 class="text-sm font-semibold text-zinc-200">Export sprite</h3>
      <p class="mt-1 text-xs text-zinc-500">
        Concatenates the assigned samples (kept pieces only) with the gap above and writes
        <code class="font-mono">{{ store.packId || "&lt;pack_id&gt;" }}.ogg/.m4a/.mp3</code> plus
        the audiosprite <code class="font-mono">.json</code> and orbital
        <code class="font-mono">.ts</code> to the output folder.
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="btn"
          :disabled="exporting || !canExport"
          :title="exportDisabledReason"
          @click="exportSprite()">
          {{ exporting ? "Exporting…" : "Export sprite" }}
        </button>
        <p
          v-if="exportStatus"
          class="text-sm"
          :class="exportError ? 'text-red-400' : 'text-emerald-400'">
          {{ exportStatus }}
        </p>
        <p v-else-if="!store.outputGranted" class="text-xs text-zinc-500">
          Choose an output folder (the orbital repo) on the Home tab first.
        </p>
        <p v-else-if="assignedCount === 0" class="text-xs text-zinc-500">
          No events assigned yet — assign events in the Editor first.
        </p>
      </div>
      <p v-if="exporting" class="mt-2 text-xs text-zinc-500">
        Assembling {{ assignedCount }} sample{{ assignedCount === 1 ? "" : "s" }} and encoding to
        MP3/OGG/M4A…
      </p>
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
import { computed, onMounted, ref } from "vue"
import { useProjectStore } from "@/stores/project"
import type { DirStatus } from "@/stores/project"
import { listAudioFiles, writeFileToDir } from "@/services/fsAccess"
import { buildEventMapping, loadEventMapping, saveEventMapping } from "@/services/eventMapping"
import { encodeSprite } from "@/services/ffmpegClient"
import type { AudioFileEntry } from "@/services/fsAccess"
import { formatBytes } from "@/utils/format"
import { buildAudiospriteJson, buildSoundSpriteTs, buildSprite } from "@/utils/sprite"
import { pcmToWav16 } from "@/utils/wav"

defineOptions({ name: "HomeView" })

const store = useProjectStore()

const files = ref<AudioFileEntry[]>([])
const filesError = ref<string | null>(null)
const probeStatus = ref<"idle" | "writing" | "done" | "error">("idle")
const probeError = ref<string | null>(null)

const packSaving = ref(false)
const packStatus = ref<string | null>(null)
const packError = ref(false)

const PACK_ID_RE = /^[a-z0-9_]+$/
const packIdValid = computed(() => PACK_ID_RE.test(store.packId))

const exporting = ref(false)
const exportStatus = ref<string | null>(null)
const exportError = ref(false)

const assignedCount = computed(
  () => store.samples.filter((s) => s.assignedEvents.length > 0).length,
)

const canExport = computed(
  () => store.outputGranted && assignedCount.value > 0 && packIdValid.value,
)

const exportDisabledReason = computed(() => {
  if (!store.outputGranted) return "Choose an output folder on the Home tab first"
  if (assignedCount.value === 0) return "Assign events to at least one sample in the Editor first"
  if (!packIdValid.value) return "Enter a valid pack name first"
  return ""
})

async function exportSprite(): Promise<void> {
  const dir = store.outputDirHandle
  if (!dir || !canExport.value || exporting.value) return
  exporting.value = true
  exportStatus.value = null
  exportError.value = false
  try {
    await store.ensurePermission("output")
    if (store.outputDirStatus !== "granted") {
      throw new Error("output folder is not writable; re-grant access on the Home tab")
    }
    const { pack, pcm, sampleRate } = buildSprite(store.samples, store.packId, store.gap)
    if (pack.entries.length === 0) throw new Error("no assigned events to export")
    const wav = pcmToWav16(pcm, sampleRate)
    const encoded = await encodeSprite(wav)

    const writes: Array<[string, string, Uint8Array<ArrayBuffer> | string]> = []
    if (encoded.mp3) writes.push([`${store.packId}.mp3`, "mp3", encoded.mp3.bytes])
    if (encoded.ogg) writes.push([`${store.packId}.ogg`, "ogg", encoded.ogg.bytes])
    if (encoded.m4a) writes.push([`${store.packId}.m4a`, "m4a", encoded.m4a.bytes])
    writes.push([`${store.packId}.json`, "json", buildAudiospriteJson(store.packId, pack.entries)])
    writes.push([`${store.packId}.ts`, "ts", buildSoundSpriteTs(store.packId, pack.entries)])

    for (const [name, , data] of writes) {
      const payload = typeof data === "string" ? new TextEncoder().encode(data) : data
      await writeFileToDir(dir, name, payload)
    }

    const byteSummary = writes
      .filter(([, format]) => format !== "json" && format !== "ts")
      .map(([name, , data]) => `${name} (${formatBytes(data.length)})`)
      .join(", ")
    exportStatus.value = `Wrote ${writes.map(([name]) => name).join(", ")} to the output folder. ${byteSummary}`
  } catch (error) {
    exportError.value = true
    exportStatus.value = error instanceof Error ? error.message : String(error)
  } finally {
    exporting.value = false
  }
}

const phases = [
  {
    title: "Phase 1 — Scaffold + spike",
    description: "Vue/Vite/PWA shell and ffmpeg.wasm codec/filter verification.",
    done: true,
  },
  {
    title: "Phase 2 — File System Access",
    description: "Open dirs, read/write files, persist handles in IndexedDB.",
    done: true,
  },
  {
    title: "Phase 3 — Import + editor",
    description: "decodeAudioData → PCM, wavesurfer.js waveform, trim regions, undo.",
    done: true,
  },
  {
    title: "Phase 4 — Loudness",
    description: "JS EBU R128 to -23 LUFS with before/after preview.",
    done: true,
  },
  {
    title: "Phase 5 — Per-sample save",
    description: "Encode mono MP3 and write back to the source dir.",
    done: true,
  },
  {
    title: "Phase 6 — Event assignment",
    description: "Multi-assign orbital events, alias suggestions.",
    done: true,
  },
  {
    title: "Phase 7 — Sprite export",
    description: "Sample-accurate concat, 3 formats, .json + .ts generation.",
    done: true,
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

async function savePack(): Promise<void> {
  const dir = store.sourceDirHandle
  if (!dir || !packIdValid.value) return
  packSaving.value = true
  packStatus.value = null
  packError.value = false
  try {
    await store.ensurePermission("source")
    if (store.sourceDirStatus !== "granted") {
      throw new Error("source folder is not writable; re-grant access on the Home tab")
    }
    const mapping = buildEventMapping(store.samples, store.packId, store.gap)
    await saveEventMapping(dir, mapping)
    packStatus.value = `Saved ${store.packId} to the mapping file`
  } catch (error) {
    packError.value = true
    packStatus.value = error instanceof Error ? error.message : String(error)
  } finally {
    packSaving.value = false
  }
}

onMounted(async () => {
  await store.restoreFromIndexedDb()
  await refreshFiles()
  const dir = store.sourceDirHandle
  if (dir) {
    const mapping = await loadEventMapping(dir)
    if (mapping) {
      if (mapping.packId) store.packId = mapping.packId
      if (mapping.gap) store.gap = mapping.gap
    }
  }
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
