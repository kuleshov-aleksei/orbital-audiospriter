<template>
  <div class="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
    <div>
      <h2 class="text-xl font-semibold text-zinc-100">Phase 4 — Editor + loudness</h2>
      <p class="mt-1 max-w-3xl text-sm text-zinc-400">
        Cut samples into pieces at the playhead, select a piece and delete it, then normalize
        loudness to a target LUFS value (default −23, EBU R128).
      </p>
    </div>

    <section class="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
      <div class="flex flex-col gap-4">
        <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 class="text-sm font-semibold text-zinc-200">Import</h3>
          <p v-if="!store.sourceGranted" class="mt-2 text-xs text-zinc-500">
            Open a samples folder on the <span class="text-zinc-300">Home</span> tab first.
          </p>
          <template v-else>
            <p class="mt-2 text-xs text-zinc-500">
              All audio files in the source folder are imported automatically.
            </p>
            <button
              type="button"
              class="mt-2 w-full rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="importing"
              @click="importAllSamples()">
              {{ importing ? `Importing… ${importDone}/${importTotal}` : "Re-scan folder" }}
            </button>
            <p v-if="importError" class="mt-2 text-sm text-red-400">{{ importError }}</p>
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
                {{ keptDurationOf(sample).toFixed(2) }} s kept · {{ sample.chunks.length }} piece{{
                  sample.chunks.length === 1 ? "" : "s"
                }}
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
            {{ selected.sampleRate }} Hz · mono · {{ keptDuration.toFixed(2) }} s kept of
            {{ selected.duration.toFixed(2) }} s · {{ selected.chunks.length }} piece{{
              selected.chunks.length === 1 ? "" : "s"
            }}
          </p>

          <div
            v-if="selected"
            ref="waveformEl"
            class="mt-4 h-36 w-full rounded-lg border border-zinc-700/60 bg-zinc-800/80"></div>
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
              title="Split the piece under the playhead"
              :disabled="!wavesurferReady || !canCut"
              @click="cutAtPlayhead()">
              ✂ Cut
            </button>
            <button
              type="button"
              class="btn-danger"
              title="Delete the selected piece"
              :disabled="!selectedChunk"
              @click="deleteSelectedChunk()">
              🗑 Delete piece
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
              Piece in
              <input
                v-model.number="chunkIn"
                type="number"
                :min="0"
                :max="selected ? selected.duration : 0"
                step="0.01"
                class="ml-1 w-20 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-200"
                @change="commitChunkRange()" />
            </label>
            <label class="text-xs text-zinc-500">
              Piece out
              <input
                v-model.number="chunkOut"
                type="number"
                :min="0"
                :max="selected ? selected.duration : 0"
                step="0.01"
                class="ml-1 w-20 rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-xs text-zinc-200"
                @change="commitChunkRange()" />
            </label>
          </div>

          <div v-if="selected" class="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" class="btn-secondary" :disabled="!canUndo" @click="undoChunks()">
              Undo edit
            </button>
            <button type="button" class="btn-secondary" @click="resetChunks()">Reset pieces</button>
          </div>

          <p v-if="selected" class="mt-2 text-xs text-zinc-600">
            Space/K play · J/L ±2s · Delete removes the selected piece · drag the waveform to select
            a range, then Cut splits at both ends · piece bounds are absolute source seconds.
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h3 class="text-sm font-semibold text-zinc-200">Loudness normalization</h3>
          <label class="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            Target
            <input
              v-model.number="store.targetLufs"
              type="number"
              min="-50"
              max="0"
              step="0.1"
              class="w-20 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200"
              title="Target integrated loudness in LUFS (-50 to 0)" />
            LUFS
          </label>
          <div class="mt-2 flex flex-wrap gap-1">
            <button
              v-for="preset in LUFS_PRESETS"
              :key="preset"
              type="button"
              class="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-300 transition hover:bg-zinc-700"
              :class="{ 'ring-1 ring-violet-500/70': preset === store.targetLufs }"
              @click="store.targetLufs = preset">
              {{ preset }}
            </button>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <p v-if="selected && measuredLufs !== null" class="text-xs text-zinc-400">
              <span class="text-zinc-500">Measured:</span>
              <span class="font-mono text-zinc-100">{{ measuredLufs.toFixed(1) }} LUFS</span>
            </p>
            <p v-else-if="selected" class="text-xs text-zinc-500">Selected piece is silent.</p>
          </div>
          <button
            type="button"
            class="btn mt-2"
            :disabled="!selected || measuredLufs === null || normalizing"
            @click="normalizeSelected()">
            {{ normalizing ? "Normalizing…" : `Normalize to ${store.targetLufs} LUFS` }}
          </button>
          <button
            type="button"
            class="btn-secondary mt-2"
            :disabled="store.samples.length === 0 || normalizing"
            @click="normalizeAll()">
            {{
              normalizing
                ? `Normalizing ${normalizeDone}/${normalizeTotal}…`
                : `Normalize all (${store.samples.length})`
            }}
          </button>
          <div v-if="selected?.loudness" class="mt-2 space-y-1 text-[11px] text-zinc-500">
            <p>
              Applied
              <span class="font-mono text-zinc-300">
                {{ selected.loudness.gainDb > 0 ? "+" : ""
                }}{{ selected.loudness.gainDb.toFixed(1) }}
                dB
              </span>
              via {{ selected.loudness.method === "loudnorm" ? "loudnorm" : "EBU R128" }} ·
              <span class="text-zinc-400">after ≈ {{ measuredLufs?.toFixed(1) }} LUFS</span>
            </p>
            <button
              type="button"
              class="text-violet-300 transition hover:text-violet-200"
              @click="undoNormalizeUi()">
              ↺ Undo normalization
            </button>
          </div>
          <p v-if="normalizeError" class="mt-2 text-sm text-red-400">{{ normalizeError }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue"
import WaveSurfer from "wavesurfer.js"
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js"
import type { Region } from "wavesurfer.js/dist/plugins/regions.js"
import { useProjectStore } from "@/stores/project"
import { decodeAudioFile } from "@/services/audioDecode"
import { normalizeAudio } from "@/services/ffmpegClient"
import { listAudioFiles, readFileBytes } from "@/services/fsAccess"
import type { Sample, SampleChunk } from "@/types/audio"
import { DEFAULT_TARGET_LUFS } from "@/types/audio"
import { chunksTotalDuration, spliceChunks } from "@/utils/chunks"
import { measureLoudness } from "@/utils/loudness"
import { pcmToWav16 } from "@/utils/wav"

defineOptions({ name: "EditorView" })

const store = useProjectStore()

const LUFS_PRESETS: readonly number[] = [-14, -16, -18, -20, -23, -26]

const normalizing = ref(false)
const normalizeDone = ref(0)
const normalizeTotal = ref(0)
const normalizeError = ref<string | null>(null)
const measuredLufs = ref<number | null>(null)

const importing = ref(false)
const importDone = ref(0)
const importTotal = ref(0)
const importError = ref<string | null>(null)
const ignoredFiles = ref(new Set<string>())

const selectedId = ref<string | null>(null)
const selected = computed(() => store.samples.find((s) => s.id === selectedId.value) ?? null)

const waveformEl = useTemplateRef<HTMLElement>("waveformEl")
let wavesurfer: WaveSurfer | null = null
let regions: RegionsPlugin | null = null
const wavesurferReady = ref(false)

const isPlaying = ref(false)
const currentTime = ref(0)

const CHUNK_COLOR = "rgba(147,197,253,0.22)"
const CHUNK_COLOR_SELECTED = "transparent"
const SELECTION_COLOR = "rgba(139,92,246,0.22)"

const regionByChunk = new Map<string, Region>()

const selectedChunkId = ref<string | null>(null)
const selectedChunk = computed(
  () => selected.value?.chunks.find((c) => c.id === selectedChunkId.value) ?? null,
)
const keptDuration = computed(() =>
  selected.value ? chunksTotalDuration(selected.value.chunks) : 0,
)

const chunkIn = ref(0)
const chunkOut = ref(0)

const selection = ref<{ start: number; end: number } | null>(null)
let selectionRegion: Region | null = null
let dragSelecting = false
let dragStartX = 0
let dragStartTime = 0

interface ChunkSnapshot {
  id: string
  chunks: SampleChunk[]
}
const undoStack = ref<ChunkSnapshot[]>([])
const canUndo = computed(() => undoStack.value.length > 0)

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
    waveColor: "rgb(96,165,250)",
    progressColor: "rgb(37,99,235)",
    cursorColor: "rgb(212,212,216)",
    cursorWidth: 1,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
  })
  const regionsInstance = instance.registerPlugin(RegionsPlugin.create())
  regions = regionsInstance
  wavesurfer = instance

  waveformEl.value.removeEventListener("pointerdown", onWavePointerDown)
  waveformEl.value.addEventListener("pointerdown", onWavePointerDown)

  instance.on("play", () => (isPlaying.value = true))
  instance.on("pause", () => (isPlaying.value = false))
  instance.on("timeupdate", (time) => (currentTime.value = time))
}

function timeAtClientX(clientX: number): number {
  if (!waveformEl.value || !wavesurfer) return 0
  const rect = waveformEl.value.getBoundingClientRect()
  const ratio = (clientX - rect.left) / rect.width
  return Math.min(1, Math.max(0, ratio)) * wavesurfer.getDuration()
}

function onWavePointerDown(event: PointerEvent): void {
  if (!dragSelecting && wavesurferReady.value && wavesurfer) {
    dragSelecting = true
    dragStartX = event.clientX
    dragStartTime = timeAtClientX(event.clientX)
    selection.value = { start: dragStartTime, end: dragStartTime }
    renderSelection()
    window.addEventListener("pointermove", onWavePointerMove)
    window.addEventListener("pointerup", onWavePointerUp)
  }
}

function onWavePointerMove(event: PointerEvent): void {
  if (!dragSelecting) return
  if (Math.abs(event.clientX - dragStartX) < 4) return
  const t = timeAtClientX(event.clientX)
  const start = Math.min(dragStartTime, t)
  const end = Math.max(dragStartTime, t)
  if (end - start >= 0.02) selection.value = { start, end }
  renderSelection()
}

function onWavePointerUp(): void {
  window.removeEventListener("pointermove", onWavePointerMove)
  window.removeEventListener("pointerup", onWavePointerUp)
  dragSelecting = false
  const sel = selection.value
  if (!sel || sel.end - sel.start < 0.02) {
    selection.value = null
  }
  renderSelection()
}

function renderSelection(): void {
  if (!regions) return
  if (selectionRegion) {
    selectionRegion.remove()
    selectionRegion = null
  }
  const sel = selection.value
  if (sel && sel.end - sel.start >= 0.02 && wavesurferReady.value) {
    selectionRegion = regions.addRegion({
      start: sel.start,
      end: sel.end,
      color: SELECTION_COLOR,
      drag: false,
      resize: false,
    })
  }
}

function keptDurationOf(sample: Sample): number {
  return chunksTotalDuration(sample.chunks)
}

function syncChunkInputs(): void {
  const chunk = selectedChunk.value
  chunkIn.value = chunk ? chunk.start : 0
  chunkOut.value = chunk ? chunk.end : 0
}

function applySelectionColor(): void {
  for (const [chunkId, region] of regionByChunk) {
    const isSelected = chunkId === selectedChunkId.value
    region.setOptions({ color: isSelected ? CHUNK_COLOR_SELECTED : CHUNK_COLOR })
    if (region.element) {
      region.element.style.boxShadow = isSelected ? "inset 0 0 0 1.5px rgb(37,99,235)" : "none"
    }
  }
}

function selectChunk(chunkId: string): void {
  selectedChunkId.value = chunkId
  applySelectionColor()
  syncChunkInputs()
}

async function loadSample(id: string, preserveChunk = false): Promise<void> {
  const previousChunkId = selectedChunkId.value
  selectedId.value = id
  await nextTick()
  const sample = selected.value
  if (!sample || !sample.pcm || !waveformEl.value) return
  ensureWavesurfer()
  if (!wavesurfer || !regions || !sample.chunks.length) return
  isPlaying.value = false
  currentTime.value = 0
  selection.value = null
  if (selectionRegion) {
    selectionRegion.remove()
    selectionRegion = null
  }
  const spliced = spliceChunks(sample.pcm, sample.chunks, sample.sampleRate)
  const measured = measureLoudness(spliced, sample.sampleRate)
  measuredLufs.value = Number.isFinite(measured.integratedLufs) ? measured.integratedLufs : null
  const wav = pcmToWav16(spliced, sample.sampleRate)
  await wavesurfer.loadBlob(new Blob([wav.buffer as ArrayBuffer]))
  regionByChunk.clear()
  regions.clearRegions()
  let cursor = 0
  for (const chunk of sample.chunks) {
    const start = cursor
    const end = cursor + (chunk.end - chunk.start)
    cursor = end
    const region = regions.addRegion({
      start,
      end,
      color: CHUNK_COLOR,
      drag: false,
      resize: false,
    })
    region.on("click", () => selectChunk(chunk.id))
    regionByChunk.set(chunk.id, region)
  }
  selectedChunkId.value =
    preserveChunk && sample.chunks.some((c) => c.id === previousChunkId)
      ? previousChunkId
      : (sample.chunks[0]?.id ?? null)
  applySelectionColor()
  syncChunkInputs()
  wavesurferReady.value = true
}

function pushUndo(): void {
  const sample = selected.value
  if (!sample) return
  undoStack.value.push({ id: sample.id, chunks: sample.chunks.map((c) => ({ ...c })) })
}

function undoChunks(): void {
  const snap = undoStack.value.pop()
  if (!snap) return
  store.setChunks(snap.id, snap.chunks)
  if (snap.id === selectedId.value) void loadSample(snap.id, true)
}

function resetChunks(): void {
  const sample = selected.value
  if (!sample) return
  pushUndo()
  store.setChunks(sample.id, [{ id: crypto.randomUUID(), start: 0, end: sample.duration }])
  void loadSample(sample.id)
}

const canCut = computed(() => {
  if (!selected.value || !wavesurferReady.value) return false
  if (selection.value) return selection.value.end - selection.value.start >= 0.02
  return currentTime.value > 0.05 && currentTime.value < keptDuration.value - 0.05
})

function cutAtPlayhead(): void {
  const sample = selected.value
  if (!sample || !canCut.value) return
  pushUndo()
  let keepChunkId = selectedChunkId.value
  const sel = selection.value
  if (sel) {
    const middle = store.cutSample(sample.id, sel.start)
    store.cutSample(sample.id, sel.end)
    if (middle) keepChunkId = middle
  } else {
    const rightId = store.cutSample(sample.id, currentTime.value)
    keepChunkId = rightId ?? keepChunkId
  }
  selection.value = null
  if (selectionRegion) {
    selectionRegion.remove()
    selectionRegion = null
  }
  selectedChunkId.value = keepChunkId
  void loadSample(sample.id, true)
}

function deleteSelectedChunk(): void {
  const sample = selected.value
  const chunk = selectedChunk.value
  if (!sample || !chunk) return
  pushUndo()
  const removedAll = store.deleteChunk(sample.id, chunk.id)
  if (removedAll) {
    removeSampleUi(sample.id)
    return
  }
  void loadSample(sample.id, false)
}

function commitChunkRange(): void {
  const sample = selected.value
  const chunk = selectedChunk.value
  if (!sample || !chunk) return
  const start = Number(chunkIn.value)
  const end = Number(chunkOut.value)
  if (Number.isNaN(start) || Number.isNaN(end)) return
  pushUndo()
  if (store.setChunkRange(sample.id, chunk.id, start, end)) {
    void loadSample(sample.id, true)
  } else {
    undoStack.value.pop()
    syncChunkInputs()
  }
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
    case "Delete":
    case "Backspace":
      event.preventDefault()
      deleteSelectedChunk()
      break
  }
}

async function importAllSamples(): Promise<void> {
  const dir = store.sourceDirHandle
  if (!dir || store.sourceDirStatus !== "granted" || importing.value) return
  importing.value = true
  importError.value = null
  try {
    const files = await listAudioFiles(dir)
    const existing = new Set(store.samples.map((s) => s.fileName))
    const toImport = files.filter((f) => !existing.has(f.name) && !ignoredFiles.value.has(f.name))
    importTotal.value = toImport.length
    importDone.value = 0
    for (const entry of toImport) {
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
          chunks: [{ id: crypto.randomUUID(), start: 0, end: decoded.duration }],
          loudness: undefined,
          targetLufs: DEFAULT_TARGET_LUFS,
          assignedEvents: [],
        }
        store.addSample(sample)
      } catch {
        ignoredFiles.value.add(entry.name)
      }
      importDone.value++
    }
    if (!selected.value && store.samples.length > 0) {
      undoStack.value = []
      await loadSample(store.samples[0].id)
    }
  } catch (error) {
    importError.value = error instanceof Error ? error.message : String(error)
  } finally {
    importing.value = false
  }
}

function selectSample(id: string): void {
  undoStack.value = []
  void loadSample(id)
}

function removeSampleUi(id: string): void {
  const sample = store.samples.find((s) => s.id === id)
  if (sample) ignoredFiles.value.add(sample.fileName)
  store.removeSample(id)
  if (selectedId.value === id) {
    selectedId.value = null
    measuredLufs.value = null
    if (wavesurfer) {
      wavesurfer.destroy()
      wavesurfer = null
      regions = null
      wavesurferReady.value = false
      regionByChunk.clear()
    }
  }
}

async function normalizeSample(sample: Sample): Promise<void> {
  if (!sample.pcm) return
  const spliced = spliceChunks(sample.pcm, sample.chunks, sample.sampleRate)
  const measured = measureLoudness(spliced, sample.sampleRate)
  if (!Number.isFinite(measured.integratedLufs)) return
  const wav = pcmToWav16(spliced, sample.sampleRate)
  const result = await normalizeAudio(wav, store.targetLufs)
  store.scaleSamplePcm(sample.id, Math.pow(10, result.gainDb / 20))
  store.setLoudness(sample.id, result)
  store.setSampleTargetLufs(sample.id, store.targetLufs)
}

async function normalizeSelected(): Promise<void> {
  const sample = selected.value
  if (!sample || normalizing.value) return
  normalizing.value = true
  normalizeError.value = null
  try {
    await normalizeSample(sample)
    if (selectedId.value === sample.id) {
      void loadSample(sample.id, true)
    }
  } catch (error) {
    normalizeError.value = error instanceof Error ? error.message : String(error)
  } finally {
    normalizing.value = false
  }
}

function undoNormalizeUi(): void {
  const sample = selected.value
  if (!sample) return
  if (store.undoNormalize(sample.id)) {
    void loadSample(sample.id, true)
  }
}

async function normalizeAll(): Promise<void> {
  if (normalizing.value) return
  normalizing.value = true
  normalizeError.value = null
  const toNormalize = store.samples
  normalizeTotal.value = toNormalize.length
  normalizeDone.value = 0
  try {
    for (const sample of toNormalize) {
      if (sample.pcm) {
        try {
          await normalizeSample(sample)
        } catch (error) {
          normalizeError.value = `"${sample.fileName}": ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
      normalizeDone.value++
    }
    if (selected.value) {
      await loadSample(selected.value.id, true)
    }
  } finally {
    normalizing.value = false
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown)
  void importAllSamples()
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
