import { defineStore } from "pinia"
import { ref } from "vue"
import type { ProjectState, Sample } from "@/types/audio"
import { DEFAULT_TARGET_LUFS } from "@/types/audio"

export const useProjectStore = defineStore("project", () => {
  const sourceDirHandle = ref<FileSystemDirectoryHandle | null>(null)
  const outputDirHandle = ref<FileSystemDirectoryHandle | null>(null)
  const samples = ref<Sample[]>([])
  const targetLufs = ref<number>(DEFAULT_TARGET_LUFS)
  const packId = ref<string>("")
  const gap = ref<number>(0)

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
    samples,
    targetLufs,
    packId,
    gap,
    snapshot,
  }
})
