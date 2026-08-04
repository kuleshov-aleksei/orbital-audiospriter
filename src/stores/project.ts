import { defineStore } from "pinia"
import { computed, ref } from "vue"
import type { ProjectState, Sample } from "@/types/audio"
import { DEFAULT_TARGET_LUFS } from "@/types/audio"
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
  const gap = ref<number>(0)

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

  function updateSampleTrim(id: string, trimStart: number, trimEnd: number): void {
    const sample = samples.value.find((s) => s.id === id)
    if (!sample) return
    sample.trimStart = trimStart
    sample.trimEnd = trimEnd
  }

  function splitSample(id: string, atSeconds: number): string[] {
    const index = samples.value.findIndex((s) => s.id === id)
    if (index === -1) return []
    const sample = samples.value[index]
    if (!sample.pcm) return []
    const cut = Math.max(0, Math.min(atSeconds, sample.duration))
    if (cut <= sample.trimStart + 0.05 || cut >= sample.trimEnd - 0.05) return []

    const dot = sample.fileName.lastIndexOf(".")
    const base = dot > 0 ? sample.fileName.slice(0, dot) : sample.fileName

    const left: Sample = {
      ...sample,
      id: crypto.randomUUID(),
      fileName: `${base} (1)`,
      fileHandle: null,
      trimStart: sample.trimStart,
      trimEnd: cut,
    }
    const right: Sample = {
      ...sample,
      id: crypto.randomUUID(),
      fileName: `${base} (2)`,
      fileHandle: null,
      trimStart: cut,
      trimEnd: sample.trimEnd,
    }
    samples.value.splice(index, 1, left, right)
    return [left.id, right.id]
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
    updateSampleTrim,
    splitSample,
    snapshot,
  }
})
