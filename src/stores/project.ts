import { defineStore } from "pinia"
import { computed, ref } from "vue"
import type { LoudnessResult, OrbitalEvent, ProjectState, Sample, SampleChunk } from "@/types/audio"
import { DEFAULT_GAP, DEFAULT_TARGET_LUFS } from "@/types/audio"
import { clampChunkRange, removeChunkById, splitChunkAt } from "@/utils/chunks"
import {
  clearDirectoryHandle,
  openDirectoryPicker,
  persistDirectoryHandle,
  queryPermission,
  requestPermission,
  restoreDirectoryHandle,
} from "@/services/fsAccess"
import type { DirScope } from "@/services/fsAccess"

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
    restoreFromIndexedDb,
    openSourceDir,
    openOutputDir,
    ensurePermission,
    detachDir,
    addSample,
    removeSample,
    setAssignedEvents,
    toggleAssignedEvent,
    setChunks,
    cutSample,
    deleteChunk,
    setChunkRange,
    setLoudness,
    scaleSamplePcm,
    setSampleTargetLufs,
    undoNormalize,
    snapshot,
  }
})
