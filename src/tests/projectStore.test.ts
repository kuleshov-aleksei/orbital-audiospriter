import { describe, expect, it } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import { useProjectStore } from "@/stores/project"
import { DEFAULT_TARGET_LUFS } from "@/types/audio"
import type { Sample } from "@/types/audio"

function makeSample(overrides: Partial<Sample> = {}): Sample {
  return {
    id: "a",
    fileName: "hit.mp3",
    fileHandle: null,
    pcm: new Float32Array(44100),
    sampleRate: 44100,
    duration: 1,
    trimStart: 0,
    trimEnd: 1,
    targetLufs: DEFAULT_TARGET_LUFS,
    assignedEvents: [],
    ...overrides,
  }
}

describe("project store splitSample", () => {
  it("splits a sample into two segments sharing the pcm", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample())

    const [leftId, rightId] = store.splitSample("a", 0.4)

    expect(store.samples).toHaveLength(2)
    const left = store.samples[0]
    const right = store.samples[1]
    expect(left).not.toBeNull()
    expect(right).not.toBeNull()
    expect(left.fileName).toBe("hit (1)")
    expect(right.fileName).toBe("hit (2)")
    expect(left.trimStart).toBe(0)
    expect(left.trimEnd).toBe(0.4)
    expect(right.trimStart).toBe(0.4)
    expect(right.trimEnd).toBe(1)
    expect(left.pcm).toBe(right.pcm)
    expect(left.fileHandle).toBeNull()
    expect(leftId).toBe(left.id)
    expect(rightId).toBe(right.id)
  })

  it("refuses a cut outside the trim window", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ trimStart: 0.2, trimEnd: 0.8 }))

    expect(store.splitSample("a", 0.1)).toEqual([])
    expect(store.splitSample("a", 0.9)).toEqual([])
    expect(store.samples).toHaveLength(1)
  })

  it("no-ops for unknown ids and null pcm", () => {
    setActivePinia(createPinia())
    const store = useProjectStore()
    store.addSample(makeSample({ pcm: null }))

    expect(store.splitSample("missing", 0.4)).toEqual([])
    expect(store.splitSample("a", 0.4)).toEqual([])
    expect(store.samples).toHaveLength(1)
  })
})
