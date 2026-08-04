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
    snapshot,
  }
})
