import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import { useProjectStore } from "@/stores/project"
import { DEFAULT_TARGET_LUFS } from "@/types/audio"
import type { Sample } from "@/types/audio"
import { EVENT_MAPPING_FILE } from "@/services/eventMapping"

const mocks = vi.hoisted(() => {
  const mkDirHandle = () => ({
    name: "src",
    kind: "directory",
    queryPermission: vi.fn(async () => "granted" as const),
    requestPermission: vi.fn(async () => "granted" as const),
  })
  return {
    openDirectoryPicker: vi.fn(async () => mkDirHandle()),
    queryPermission: vi.fn<() => Promise<PermissionState>>(async () => "granted"),
    requestPermission: vi.fn<() => Promise<PermissionState>>(async () => "granted"),
    persistDirectoryHandle: vi.fn(async () => undefined),
    restoreDirectoryHandle: vi.fn(async () => null),
    clearDirectoryHandle: vi.fn(async () => undefined),
    listAudioFiles: vi.fn(async () => []),
    readFileBytes: vi.fn(async () => new Uint8Array(0)),
    writeFileToDir: vi.fn<
      (dir: FileSystemDirectoryHandle, name: string, data: Uint8Array<ArrayBuffer>) => Promise<void>
    >(async () => undefined),
  }
})

vi.mock("@/services/fsAccess", () => mocks)

function makeSample(overrides: Partial<Sample> = {}): Sample {
  return {
    id: "a",
    fileName: "hit.mp3",
    fileHandle: null,
    pcm: null,
    sampleRate: 44100,
    duration: 1,
    chunks: [{ id: "c0", start: 0, end: 1 }],
    targetLufs: DEFAULT_TARGET_LUFS,
    assignedEvents: [],
    ...overrides,
  }
}

function parseWritten(): { packId: string; gap: number; samples: Record<string, string[]> } {
  const bytes = mocks.writeFileToDir.mock.calls[0][2] as Uint8Array<ArrayBuffer>
  return JSON.parse(new TextDecoder().decode(bytes)) as {
    packId: string
    gap: number
    samples: Record<string, string[]>
  }
}

describe("project store saveMapping", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.writeFileToDir.mockClear()
    mocks.openDirectoryPicker.mockClear()
    mocks.requestPermission.mockReset()
    mocks.requestPermission.mockResolvedValue("granted")
  })

  it("persists assignments, pack id and gap to the mapping file", async () => {
    const store = useProjectStore()
    await store.openSourceDir()
    store.packId = "my_pack"
    store.gap = 0.15
    store.addSample(makeSample({ assignedEvents: ["mute"] }))

    const summary = await store.saveMapping()

    expect(mocks.writeFileToDir).toHaveBeenCalledTimes(1)
    expect(mocks.writeFileToDir.mock.calls[0][0]).toBe(store.sourceDirHandle)
    expect(mocks.writeFileToDir.mock.calls[0][1]).toBe(EVENT_MAPPING_FILE)
    const written = parseWritten()
    expect(written.packId).toBe("my_pack")
    expect(written.gap).toBe(0.15)
    expect(written.samples["hit.mp3"]).toEqual(["mute"])
    expect(summary).toBe(`Saved ${EVENT_MAPPING_FILE} (1 samples)`)
  })

  it("throws when the source dir is not chosen", async () => {
    const store = useProjectStore()
    store.addSample(makeSample({ assignedEvents: ["mute"] }))

    await expect(store.saveMapping()).rejects.toThrow("source folder is not chosen")
  })

  it("throws when the folder is not writable", async () => {
    mocks.requestPermission.mockResolvedValueOnce("denied")
    const store = useProjectStore()
    await store.openSourceDir()
    store.addSample(makeSample())

    await expect(store.saveMapping()).rejects.toThrow("not writable")
  })
})
