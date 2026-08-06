import { defineStore } from "pinia"
import { computed, ref } from "vue"
import type { LoudnessResult, OrbitalEvent, ProjectState, Sample, SampleChunk } from "@/types/audio"
import { DEFAULT_GAP, DEFAULT_TARGET_LUFS } from "@/types/audio"
import {
  chunksTotalDuration,
  clampChunkRange,
  clipChunks,
  removeChunkById,
  removeRange,
  spliceChunks,
  splitChunkAt,
} from "@/utils/chunks"
import {
  clearDirectoryHandle,
  listAudioFiles,
  openDirectoryPicker,
  persistDirectoryHandle,
  queryPermission,
  readFileBytes,
  requestPermission,
  restoreDirectoryHandle,
} from "@/services/fsAccess"
import type { DirScope } from "@/services/fsAccess"
import { decodeAudioFile } from "@/services/audioDecode"
import {
  applyEventMapping,
  buildEventMapping,
  EVENT_MAPPING_FILE,
  loadEventMapping,
  saveEventMapping,
} from "@/services/eventMapping"

export type DirStatus = "not-chosen" | PermissionState

export const useProjectStore = defineStore("project", () => {
  const sourceDirHandle = ref<FileSystemDirectoryHandle | null>(null)
  const outputDirHandle = ref<FileSystemDirectoryHandle | null>(null)
  const sourceDirStatus = ref<DirStatus>("not-chosen")
  const outputDirStatus = ref<DirStatus>("not-chosen")
  const samples = ref<Sample[]>([])
  const targetLufs = ref<number>(DEFAULT_TARGET_LUFS)
  const packId = ref<string>("")
  const gap = ref<number>(DEFAULT_GAP)

  const hasSourceDir = computed(() => sourceDirHandle.value !== null)
  const hasOutputDir = computed(() => outputDirHandle.value !== null)
  const sourceGranted = computed(() => sourceDirStatus.value === "granted")
  const outputGranted = computed(() => outputDirStatus.value === "granted")

  async function restoreFromIndexedDb(): Promise<void> {
    const [source, output] = await Promise.all([
      restoreDirectoryHandle("source"),
      restoreDirectoryHandle("output"),
    ])
    if (source) {
      sourceDirHandle.value = source
      sourceDirStatus.value = await queryPermission(source)
    }
    if (output) {
      outputDirHandle.value = output
      outputDirStatus.value = await queryPermission(output)
    }
  }

  /**
   * Import every audio file in the source dir into the store (idempotent: skips
   * files that already have a sample and files the user removed / that failed to
   * decode). Shared by Home and Editor so the config is complete before any save.
   */
  const importing = ref(false)
  const importTotal = ref(0)
  const importDone = ref(0)
  const ignoredFileNames = ref(new Set<string>())

  async function importSamplesFromSource(): Promise<void> {
    const dir = sourceDirHandle.value
    if (!dir || sourceDirStatus.value !== "granted" || importing.value) return
    importing.value = true
    try {
      const files = await listAudioFiles(dir)
      const existing = new Set(samples.value.map((s) => s.fileName))
      const toImport = files.filter(
        (f) => !existing.has(f.name) && !ignoredFileNames.value.has(f.name),
      )
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
          samples.value.push(sample)
        } catch {
          ignoredFileNames.value.add(entry.name)
        }
        importDone.value++
      }
    } finally {
      importing.value = false
    }
  }

  /**
   * Load the persisted pack config (event assignments, pack name, gap) from the
   * source dir mapping file and apply it. Call after the source dir is restored
   * and samples are imported so assignments land on the real samples.
   */
  async function loadPackConfig(): Promise<void> {
    const dir = sourceDirHandle.value
    if (!dir) return
    const mapping = await loadEventMapping(dir)
    if (!mapping) return
    if (mapping.packId) packId.value = mapping.packId
    if (mapping.gap) gap.value = mapping.gap
    applyEventMapping(samples.value, mapping)
  }

  async function openDir(scope: DirScope): Promise<void> {
    const handle = await openDirectoryPicker("readwrite")
    if (scope === "source") {
      sourceDirHandle.value = handle
      sourceDirStatus.value = await queryPermission(handle)
    } else {
      outputDirHandle.value = handle
      outputDirStatus.value = await queryPermission(handle)
    }
    await persistDirectoryHandle(scope, handle)
  }

  function openSourceDir(): Promise<void> {
    return openDir("source")
  }

  function openOutputDir(): Promise<void> {
    return openDir("output")
  }

  async function ensurePermission(scope: DirScope): Promise<PermissionState> {
    const handle = scope === "source" ? sourceDirHandle.value : outputDirHandle.value
    if (!handle) return "denied"
    const status = await requestPermission(handle, "readwrite")
    if (scope === "source") sourceDirStatus.value = status
    else outputDirStatus.value = status
    return status
  }

  async function detachDir(scope: DirScope): Promise<void> {
    await clearDirectoryHandle(scope)
    if (scope === "source") {
      sourceDirHandle.value = null
      sourceDirStatus.value = "not-chosen"
    } else {
      outputDirHandle.value = null
      outputDirStatus.value = "not-chosen"
    }
  }

  function addSample(sample: Sample): void {
    samples.value.push(sample)
  }

  function removeSample(id: string): void {
    samples.value = samples.value.filter((s) => s.id !== id)
  }

  /** Replace a sample's assigned events wholesale. */
  function setAssignedEvents(id: string, events: OrbitalEvent[]): void {
    const sample = samples.value.find((s) => s.id === id)
    if (sample) sample.assignedEvents = events
  }

  /**
   * Rename a sample. Returns an error message on failure or null on success.
   * The name cannot be empty and must stay unique among samples.
   */
  function renameSample(id: string, newName: string): string | null {
    const trimmed = newName.trim()
    if (!trimmed) return "name cannot be empty"
    const sample = samples.value.find((s) => s.id === id)
    if (!sample) return "sample not found"
    if (
      samples.value.some((s) => s.id !== id && s.fileName.toLowerCase() === trimmed.toLowerCase())
    ) {
      return `"${trimmed}" is already used by another sample`
    }
    sample.fileName = trimmed
    return null
  }

  /**
   * Toggle an event on a sample, keeping the "one sfx per event" invariant:
   * assigning an event steals it from any other sample that currently owns it.
   * Returns whether the event is now assigned to the sample.
   */
  function toggleAssignedEvent(id: string, event: OrbitalEvent): boolean {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample) return false
    const wasAssigned = sample.assignedEvents.includes(event)
    for (const other of samples.value) {
      if (other.assignedEvents.includes(event)) {
        other.assignedEvents = other.assignedEvents.filter((e) => e !== event)
      }
    }
    if (wasAssigned) return false
    sample.assignedEvents = [...sample.assignedEvents, event]
    return true
  }

  function setChunks(id: string, chunks: SampleChunk[]): void {
    const sample = samples.value.find((s) => s.id === id)
    if (sample) sample.chunks = chunks
  }

  /**
   * Split the chunk containing the given playback time (spliced). Returns the
   * id of the right-hand chunk when a cut happened, otherwise null.
   */
  function cutSample(id: string, atSplicedSeconds: number): string | null {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample || !sample.pcm) return null
    const next = splitChunkAt(sample.chunks, atSplicedSeconds, sample.sampleRate)
    if (!next) return null
    sample.chunks = next
    return next[1]?.id ?? null
  }

  /**
   * Ripple-delete a chunk. When no chunks remain the sample is removed.
   * Returns true when the sample was removed entirely.
   */
  function deleteChunk(id: string, chunkId: string): boolean {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample) return false
    const next = removeChunkById(sample.chunks, chunkId)
    if (next.length === sample.chunks.length) return false
    if (next.length === 0) {
      removeSample(id)
      return true
    }
    sample.chunks = next
    return false
  }

  /**
   * Derive a unique source-style file name for an extracted piece of `name`,
   * e.g. `click.wav` -> `click__part1.mp3`. Extracted pieces are always
   * exported as MP3. Never collides with an existing sample's file name (so it
   * round-trips through the event mapping and save).
   */
  function derivedFileName(name: string): string {
    const dot = name.lastIndexOf(".")
    const base = dot > 0 ? name.slice(0, dot) : name
    const taken = new Set(samples.value.map((s) => s.fileName))
    let n = 1
    while (true) {
      const candidate = `${base}__part${n}.mp3`
      if (!taken.has(candidate)) return candidate
      n++
    }
  }

  /**
   * Promote a single chunk into its own independent sample: slice the source
   * PCM for that chunk and register a new sample owning just that slice. The
   * original sample is left untouched. Returns the new sample's id, or null
   * when the chunk/sample doesn't exist.
   */
  function extractChunkAsSample(id: string, chunkId: string): string | null {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample || !sample.pcm) return null
    const chunk = sample.chunks.find((c) => c.id === chunkId)
    if (!chunk) return null

    const startSample = Math.round(chunk.start * sample.sampleRate)
    const endSample = Math.round(chunk.end * sample.sampleRate)
    const slice = sample.pcm.slice(startSample, endSample)
    const duration = (endSample - startSample) / sample.sampleRate

    const newId = crypto.randomUUID()
    const extracted: Sample = {
      id: newId,
      fileName: derivedFileName(sample.fileName),
      fileHandle: null,
      pcm: slice,
      sampleRate: sample.sampleRate,
      duration,
      chunks: [{ id: crypto.randomUUID(), start: 0, end: duration }],
      loudness: undefined,
      targetLufs: sample.targetLufs,
      assignedEvents: [],
    }

    samples.value.push(extracted)
    return newId
  }

  /**
   * Slice `[start, end]` (spliced seconds) out of a sample into a new sample.
   * The original sample is left untouched. Returns the new sample, or null
   * when nothing overlaps the range.
   */
  function sliceSpliced(id: string, start: number, end: number): Sample | null {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample || !sample.pcm) return null
    const kept = clipChunks(sample.chunks, start, end)
    if (kept.length === 0) return null
    const spliced = spliceChunks(sample.pcm, kept, sample.sampleRate)
    const duration = chunksTotalDuration(kept)
    const newId = crypto.randomUUID()
    const extracted: Sample = {
      id: newId,
      fileName: derivedFileName(sample.fileName),
      fileHandle: null,
      pcm: spliced,
      sampleRate: sample.sampleRate,
      duration,
      chunks: [{ id: crypto.randomUUID(), start: 0, end: duration }],
      loudness: undefined,
      targetLufs: sample.targetLufs,
      assignedEvents: [],
    }
    return extracted
  }

  /**
   * Slice a spliced time range into its own independent sample, leaving the
   * original untouched. Returns the new id, or null when nothing overlaps the
   * range.
   */
  function extractRangeAsSample(id: string, start: number, end: number): string | null {
    const extracted = sliceSpliced(id, start, end)
    if (!extracted) return null
    samples.value.push(extracted)
    return extracted.id
  }

  /**
   * Delete a spliced time range (ripple): keep everything before and after it.
   * Returns true when the sample was removed entirely.
   */
  function deleteRange(id: string, start: number, end: number): boolean {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample) return false
    const remaining = removeRange(sample.chunks, start, end)
    if (remaining.length === 0) {
      removeSample(id)
      return true
    }
    sample.chunks = remaining
    return false
  }

  /**
   * Trim to a spliced time range: remove everything outside it. Returns true
   * when the sample was removed entirely.
   */
  function trimToRange(id: string, start: number, end: number): boolean {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample) return false
    const kept = clipChunks(sample.chunks, start, end)
    if (kept.length === 0) {
      removeSample(id)
      return true
    }
    sample.chunks = kept
    return false
  }

  /** Adjust a chunk's absolute boundaries (clamped to neighbours). */
  function setChunkRange(id: string, chunkId: string, start: number, end: number): boolean {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample) return false
    const range = clampChunkRange(sample.chunks, chunkId, start, end, sample.duration)
    if (!range) return false
    const chunk = sample.chunks.find((c) => c.id === chunkId)
    if (!chunk) return false
    chunk.start = range.start
    chunk.end = range.end
    return true
  }

  /** Record the result of the last loudness normalization. */
  function setLoudness(id: string, loudness: LoudnessResult | undefined): void {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample) return
    if (loudness === undefined) {
      sample.loudness = undefined
    } else {
      sample.loudness = loudness
    }
  }

  /** Multiply the sample PCM by a linear gain factor (in place). */
  function scaleSamplePcm(id: string, factor: number): void {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample || !sample.pcm) return
    for (let i = 0; i < sample.pcm.length; i++) {
      sample.pcm[i] *= factor
    }
  }

  /** Set the per-sample target loudness used by the last normalization. */
  function setSampleTargetLufs(id: string, lufs: number): void {
    const sample = samples.value.find((s) => s.id === id)
    if (sample) sample.targetLufs = lufs
  }

  /**
   * Reverse the last normalization by applying the inverse gain. Returns
   * false when the sample has no recorded normalization to undo.
   */
  function undoNormalize(id: string): boolean {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample || !sample.loudness || !sample.pcm) return false
    const factor = Math.pow(10, -sample.loudness.gainDb / 20)
    for (let i = 0; i < sample.pcm.length; i++) {
      sample.pcm[i] *= factor
    }
    sample.loudness = undefined
    sample.targetLufs = DEFAULT_TARGET_LUFS
    return true
  }

  /**
   * Persist the current pack config (event assignments, pack name, gap) to the
   * mapping file in the source dir. Throws when the source dir is missing or
   * not writable. Returns a human-readable summary of what was written.
   */
  async function saveMapping(): Promise<string> {
    const dir = sourceDirHandle.value
    if (!dir) throw new Error("source folder is not chosen")
    const status = await ensurePermission("source")
    if (status !== "granted") {
      throw new Error("source folder is not writable; re-grant access on the Home tab")
    }
    const mapping = buildEventMapping(samples.value, packId.value, gap.value)
    await saveEventMapping(dir, mapping)
    return `Saved ${EVENT_MAPPING_FILE} (${Object.keys(mapping.samples).length} samples)`
  }

  function snapshot(): ProjectState {
    return {
      sourceDirHandle: sourceDirHandle.value,
      outputDirHandle: outputDirHandle.value,
      samples: samples.value,
      targetLufs: targetLufs.value,
      packId: packId.value,
      gap: gap.value,
    }
  }

  return {
    sourceDirHandle,
    outputDirHandle,
    sourceDirStatus,
    outputDirStatus,
    samples,
    targetLufs,
    packId,
    gap,
    hasSourceDir,
    hasOutputDir,
    sourceGranted,
    outputGranted,
    importing,
    importTotal,
    importDone,
    ignoredFileNames,
    restoreFromIndexedDb,
    importSamplesFromSource,
    loadPackConfig,
    openSourceDir,
    openOutputDir,
    ensurePermission,
    detachDir,
    addSample,
    removeSample,
    setAssignedEvents,
    renameSample,
    toggleAssignedEvent,
    setChunks,
    cutSample,
    deleteChunk,
    extractChunkAsSample,
    extractRangeAsSample,
    deleteRange,
    trimToRange,
    setChunkRange,
    setLoudness,
    scaleSamplePcm,
    setSampleTargetLufs,
    undoNormalize,
    saveMapping,
    snapshot,
  }
})
