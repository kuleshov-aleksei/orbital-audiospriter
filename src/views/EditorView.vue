<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
    <div>
      <h2 class="text-xl font-semibold text-zinc-100">Phase 3 — Import + editor</h2>
      <p class="mt-1 max-w-3xl text-sm text-zinc-400">
        Decode samples with the native <code class="text-violet-300">AudioContext</code> (mono 44.1
        kHz), trim with region handles, and undo trim edits.
      </p>
    </div>

    <section class="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div class="flex flex-col gap-4">
        <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 class="text-sm font-semibold text-zinc-200">Import</h3>
          <p v-if="!store.sourceGranted" class="mt-2 text-xs text-zinc-500">
            Open a samples folder on the <span class="text-zinc-300">Home</span> tab first.
          </p>
          <template v-else>
            <select
              v-model="importName"
              class="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none">
              <option value="">
                {{ availableFiles.length === 0 ? "No audio files" : "Choose a file…" }}
              </option>
              <option v-for="file in availableFiles" :key="file.name" :value="file.name">
                {{ file.name }} · {{ formatBytes(file.size) }}
              </option>
            </select>
            <button
              type="button"
              class="mt-2 w-full rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!importName || importStatus === 'importing'"
              @click="importSelected()">
              {{ importStatus === "importing" ? "Importing…" : "Import" }}
            </button>
            <p v-if="importStatus === 'error'" class="mt-2 text-sm text-red-400">
              {{ importError }}
            </p>
            <button
              type="button"
              class="mt-2 text-xs text-zinc-500 transition hover:text-zinc-300"
              @click="refreshAvailable()">
              Refresh file list
            </button>
          </template>
        </div>

        <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 class="text-sm font-semibold text-zinc-200">Samples</h3>
          <p v-if="store.samples.length === 0" class="mt-2 text-xs text-zinc-500">
            Nothing imported yet.
          </p>
          <ul v-else class="mt-2 flex max-h-80 flex-col gap-1 overflow-auto">
            <li
              v-for="sample in store.samples"
              :key="sample.id"
              class="group cursor-pointer rounded-lg border px-3 py-2 transition"
              :class="
                sample.id === selectedId
                  ? 'border-violet-600/60 bg-violet-600/10'
                  : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'
              "
              @click="selectSample(sample.id)">
              <div class="flex items-center justify-between gap-2">
                <span class="truncate font-mono text-xs text-zinc-200">{{ sample.fileName }}</span>
                <button
                  type="button"
                  class="text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  title="Remove sample"
                  @click.stop="removeSampleUi(sample.id)">
                  ✕
                </button>
              </div>
              <div class="mt-0.5 text-[11px] text-zinc-500">
                {{ sample.duration.toFixed(2) }} s · trim {{ sample.trimStart.toFixed(2) }}–{{
                  sample.trimEnd.toFixed(2)
                }}
                s
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 class="text-sm font-semibold text-zinc-200">
            {{ selected ? selected.fileName : "No sample selected" }}
          </h3>
          <p v-if="selected" class="mt-1 text-xs text-zinc-500">
            {{ selected.sampleRate }} Hz · mono · {{ selected.duration.toFixed(2) }} s total ·
            region {{ selected.trimStart.toFixed(2) }}–{{ selected.trimEnd.toFixed(2) }} s
          </p>

          <div v-if="selected" ref="waveformEl" class="mt-4 h-36 w-full"></div>
          <p v-else class="mt-4 py-10 text-center text-sm text-zinc-600">
            Import or select a sample.
          </p>

          <div v-if="selected" class="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" class="btn" :disabled="!wavesurferReady" @click="togglePlay()">
              {{ isPlaying ? "Pause" : "Play" }}
            </button>
            <button
              type="button"
              class="btn-secondary"
              title="Back 2 seconds (J)"
              :disabled="!wavesurferReady"
              @click="seekBy(-2)">
              « 2s
            </button>
            <button
              type="button"
              class="btn-secondary"
              title="Forward 2 seconds (L)"
              :disabled="!wavesurferReady"
              @click="seekBy(2)">
              2s »
            </button>
            <span class="font-mono text-xs text-zinc-400">
              {{ formatTime(currentTime) }} / {{ selected ? formatTime(selected.duration) : "" }}
            </span>
            <span class="h-4 w-px bg-zinc-700"></span>
            <button
              type="button"
              class="btn-danger"
              title="Split at playhead into two samples"
              :disabled="!wavesurferReady || !canSplit"
              @click="splitAtPlayhead()">
              ✂ Split
            </button>
            <button
              type="button"
              class="btn-secondary"
              title="Zoom out"
              :disabled="!wavesurferReady"
              @click="zoomBy(-1)">
              −
            </button>
            <span class="font-mono text-xs text-zinc-500">{{ zoomLevel.toFixed(1) }}×</span>
            <button
              type="button"
              class="btn-secondary"
              title="Zoom in"
              :disabled="!wavesurferReady"
              @click="zoomBy(1)">
              +
            </button>
            <span class="h-4 w-px bg-zinc-700"></span>
            <label class="text-xs text-zinc-500">
              Trim start
              <input
                v-model.number="trimStartInput"
                type="number"
                :min="0"
                :max="trimEndInput"
                step="0.01"
                class="ml-1 w-20 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-200" />
            </label>
            <label class="text-xs text-zinc-500">
              Trim end
              <input
                v-model.number="trimEndInput"
                type="number"
                :min="trimStartInput"
                :max="selected ? selected.duration : 0"
                step="0.01"
                class="ml-1 w-20 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-200" />
            </label>
          </div>

          <div v-if="selected" class="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" class="btn-secondary" :disabled="!canUndo" @click="undoTrim()">
              Undo trim
            </button>
            <button type="button" class="btn-secondary" @click="resetTrim()">Reset trim</button>
          </div>

          <p v-if="selected" class="mt-2 text-xs text-zinc-600">
            Keys: Space or K toggles play · J back 2s · L forward 2s · Split cuts at the playhead.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue"
import WaveSurfer from "wavesurfer.js"
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js"
import { useProjectStore } from "@/stores/project"
import { decodeAudioFile } from "@/services/audioDecode"
import { listAudioFiles, readFileBytes } from "@/services/fsAccess"
import type { AudioFileEntry } from "@/services/fsAccess"
import type { Sample } from "@/types/audio"
import { DEFAULT_TARGET_LUFS } from "@/types/audio"
import { formatBytes } from "@/utils/format"
import { pcmToWav16 } from "@/utils/wav"

defineOptions({ name: "EditorView" })

const store = useProjectStore()

const availableFiles = ref<AudioFileEntry[]>([])
const importName = ref("")
const importStatus = ref<"idle" | "importing" | "done" | "error">("idle")
const importError = ref<string | null>(null)

const selectedId = ref<string | null>(null)
const selected = computed(() => store.samples.find((s) => s.id === selectedId.value) ?? null)

const waveformEl = useTemplateRef<HTMLElement>("waveformEl")
let wavesurfer: WaveSurfer | null = null
let regions: RegionsPlugin | null = null
const wavesurferReady = ref(false)

const isPlaying = ref(false)
const currentTime = ref(0)

interface TrimSnapshot {
  id: string
  start: number
  end: number
}
const undoStack = ref<TrimSnapshot[]>([])
const canUndo = computed(() => undoStack.value.length > 0)

const trimStartInput = computed({
  get: () => selected.value?.trimStart ?? 0,
  set: (value) => commitTrim(value, selected.value?.trimEnd ?? 0),
})
const trimEndInput = computed({
  get: () => selected.value?.trimEnd ?? 0,
  set: (value) => commitTrim(selected.value?.trimStart ?? 0, value),
})

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(1).padStart(4, "0")}`
}

function ensureWavesurfer(): void {
  if (wavesurfer || !waveformEl.value) return
  const instance = WaveSurfer.create({
    container: waveformEl.value,
    height: 132,
    waveColor: "rgb(161,161,170)",
    progressColor: "rgb(139,92,246)",
    cursorColor: "rgb(212,212,216)",
    cursorWidth: 1,
    barWidth: 1,
    barGap: 1,
    barRadius: 2,
  })
  const regionsInstance = instance.registerPlugin(RegionsPlugin.create())
  regions = regionsInstance
  wavesurfer = instance

  instance.on("play", () => (isPlaying.value = true))
  instance.on("pause", () => (isPlaying.value = false))
  instance.on("timeupdate", (time) => (currentTime.value = time))
}

let gestureUndo: TrimSnapshot | null = null

async function loadSample(id: string): Promise<void> {
  selectedId.value = id
  await nextTick()
  const sample = selected.value
  if (!sample || !sample.pcm || !waveformEl.value) return
  ensureWavesurfer()
  if (!wavesurfer || !regions) return
  isPlaying.value = false
  currentTime.value = 0
  undoStack.value = []
  gestureUndo = null
  const wav = pcmToWav16(sample.pcm, sample.sampleRate)
  await wavesurfer.loadBlob(new Blob([wav.buffer as ArrayBuffer]))
  regions.clearRegions()
  const region = regions.addRegion({
    start: sample.trimStart,
    end: sample.trimEnd,
    color: "rgba(139,92,246,0.18)",
    drag: true,
    resize: true,
  })
  region.on("update", () => liveTrim(region.start, region.end))
  region.on("update-end", () => finishTrimGesture(region.start, region.end))
  wavesurferReady.value = true
}

function syncRegion(): void {
  const sample = selected.value
  const region = regions?.getRegions()[0]
  if (!sample || !region) return
  region.setOptions({ start: sample.trimStart, end: sample.trimEnd })
}

function applyTrimClamped(start: number, end: number, recordUndo: boolean): void {
  const sample = selected.value
  if (!sample) return
  const clampedEnd = Math.max(0, Math.min(end, sample.duration))
  const clampedStart = Math.min(Math.max(start, 0), clampedEnd)
  if (clampedStart === sample.trimStart && clampedEnd === sample.trimEnd) return
  if (recordUndo) {
    undoStack.value.push({ id: sample.id, start: sample.trimStart, end: sample.trimEnd })
  }
  store.updateSampleTrim(sample.id, clampedStart, clampedEnd)
}

function commitTrim(start: number, end: number): void {
  applyTrimClamped(start, end, true)
  syncRegion()
}

function liveTrim(start: number, end: number): void {
  if (!gestureUndo) {
    const sample = selected.value
    if (sample) gestureUndo = { id: sample.id, start: sample.trimStart, end: sample.trimEnd }
  }
  applyTrimClamped(start, end, false)
}

function finishTrimGesture(start: number, end: number): void {
  const sample = selected.value
  liveTrim(start, end)
  if (
    gestureUndo &&
    sample &&
    (gestureUndo.start !== sample.trimStart || gestureUndo.end !== sample.trimEnd)
  ) {
    undoStack.value.push(gestureUndo)
  }
  gestureUndo = null
  syncRegion()
}

function undoTrim(): void {
  const snap = undoStack.value.pop()
  if (!snap) return
  store.updateSampleTrim(snap.id, snap.start, snap.end)
  if (snap.id === selectedId.value) syncRegion()
}

function resetTrim(): void {
  const sample = selected.value
  if (!sample) return
  commitTrim(0, sample.duration)
}

function togglePlay(): void {
  if (!wavesurfer) return
  void wavesurfer.playPause()
}

const zoomLevel = ref(1)

function zoomBy(direction: -1 | 1): void {
  if (!wavesurfer) return
  const factor = direction === 1 ? 1.5 : 1 / 1.5
  const next = Math.max(1, Math.min(200, zoomLevel.value * factor))
  zoomLevel.value = Math.round(next * 100) / 100
  wavesurfer.zoom(Math.round(20 * zoomLevel.value))
}

const canSplit = computed(() => {
  const sample = selected.value
  if (!sample || !wavesurferReady.value) return false
  return currentTime.value > sample.trimStart + 0.05 && currentTime.value < sample.trimEnd - 0.05
})

function splitAtPlayhead(): void {
  const sample = selected.value
  if (!sample || !canSplit.value) return
  const [leftId] = store.splitSample(sample.id, currentTime.value)
  if (leftId) void loadSample(leftId)
}

function seekBy(delta: number): void {
  if (!wavesurfer) return
  wavesurfer.skip(delta)
}

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.tagName === "BUTTON" ||
      target.isContentEditable)
  ) {
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (!selected.value || !wavesurfer) return
  switch (event.code) {
    case "Space":
      event.preventDefault()
      togglePlay()
      break
    case "KeyK":
      togglePlay()
      break
    case "KeyJ":
      seekBy(-2)
      break
    case "KeyL":
      seekBy(2)
      break
  }
}

async function refreshAvailable(): Promise<void> {
  const dir = store.sourceDirHandle
  if (!dir || store.sourceDirStatus !== "granted") {
    availableFiles.value = []
    return
  }
  try {
    const imported = new Set(store.samples.map((s) => s.fileName))
    availableFiles.value = (await listAudioFiles(dir)).filter((f) => !imported.has(f.name))
    if (!importName.value && availableFiles.value.length > 0) {
      importName.value = availableFiles.value[0].name
    }
  } catch (error) {
    importError.value = error instanceof Error ? error.message : String(error)
  }
}

async function importSelected(): Promise<void> {
  const entry = availableFiles.value.find((f) => f.name === importName.value)
  if (!entry) return
  importStatus.value = "importing"
  importError.value = null
  try {
    const bytes = await readFileBytes(entry.handle)
    const decoded = await decodeAudioFile(bytes, entry.name)
    const sample: Sample = {
      id: crypto.randomUUID(),
      fileName: entry.name,
      fileHandle: entry.handle,
      pcm: decoded.pcm,
      sampleRate: decoded.sampleRate,
      duration: decoded.duration,
      trimStart: 0,
      trimEnd: decoded.duration,
      loudness: undefined,
      targetLufs: DEFAULT_TARGET_LUFS,
      assignedEvents: [],
    }
    store.addSample(sample)
    await refreshAvailable()
    await loadSample(sample.id)
    importStatus.value = "done"
  } catch (error) {
    importStatus.value = "error"
    importError.value = error instanceof Error ? error.message : String(error)
  }
}

function selectSample(id: string): void {
  void loadSample(id)
}

function removeSampleUi(id: string): void {
  store.removeSample(id)
  if (selectedId.value === id) {
    selectedId.value = null
    if (wavesurfer) {
      wavesurfer.destroy()
      wavesurfer = null
      regions = null
      wavesurferReady.value = false
    }
    if (importName.value) void refreshAvailable()
  }
}

onMounted(() => {
  refreshAvailable()
  window.addEventListener("keydown", handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown)
  wavesurfer?.destroy()
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
  @apply rounded-lg bg-rose-700/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50;
}
</style>
