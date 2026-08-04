import { describe, expect, it } from "vitest"
import {
  applyEventMapping,
  buildEventMapping,
  EVENT_MAPPING_FILE,
  parseEventMapping,
} from "@/services/eventMapping"
import type { EventMapping } from "@/services/eventMapping"
import { DEFAULT_TARGET_LUFS } from "@/types/audio"
import type { Sample } from "@/types/audio"

function makeSample(fileName: string, events: Sample["assignedEvents"]): Sample {
  return {
    id: fileName,
    fileName,
    fileHandle: null,
    pcm: null,
    sampleRate: 44100,
    duration: 1,
    chunks: [{ id: "c0", start: 0, end: 1 }],
    targetLufs: DEFAULT_TARGET_LUFS,
    assignedEvents: events,
  }
}

describe("buildEventMapping", () => {
  it("keeps only samples that have assignments, keyed by file name", () => {
    const mapping = buildEventMapping(
      [makeSample("bell.wav", ["mute", "unmute"]), makeSample("quiet.mp3", [])],
      "my_new_pack",
      0.05,
    )
    expect(mapping.version).toBe(1)
    expect(mapping.packId).toBe("my_new_pack")
    expect(mapping.gap).toBe(0.05)
    expect(mapping.samples).toEqual({ "bell.wav": ["mute", "unmute"] })
  })

  it("returns an empty map when nothing is assigned", () => {
    expect(buildEventMapping([makeSample("a.wav", [])], "pack", 0).samples).toEqual({})
  })
})

describe("parseEventMapping", () => {
  it("round-trips a serialized mapping", () => {
    const mapping: EventMapping = {
      version: 1,
      packId: "my_pack",
      gap: 0.25,
      samples: { "bell.wav": ["mute", "unmute"], "pop.mp3": ["message"] },
    }
    expect(parseEventMapping(JSON.stringify(mapping))).toEqual(mapping)
  })

  it("defaults packId and gap when absent (older files)", () => {
    const parsed = parseEventMapping(JSON.stringify({ version: 1, samples: { "a.wav": ["mute"] } }))
    expect(parsed?.packId).toBe("")
    expect(parsed?.gap).toBe(0)
  })

  it("drops unknown event names", () => {
    const parsed = parseEventMapping(
      JSON.stringify({
        version: 1,
        packId: "p",
        gap: 0,
        samples: { "a.wav": ["mute", "not_an_event"] },
      }),
    )
    expect(parsed?.samples["a.wav"]).toEqual(["mute"])
  })

  it("returns null for invalid, wrong-version, or mis-shaped input", () => {
    expect(parseEventMapping("not json")).toBeNull()
    expect(parseEventMapping(JSON.stringify({ version: 2, samples: {} }))).toBeNull()
    expect(parseEventMapping(JSON.stringify({ version: 1 }))).toBeNull()
    expect(parseEventMapping(JSON.stringify([1, 2, 3]))).toBeNull()
  })
})

describe("applyEventMapping", () => {
  const base = { version: 1, packId: "", gap: 0 } as const

  it("restores assignments onto samples by file name", () => {
    const samples = [makeSample("bell.wav", []), makeSample("pop.mp3", ["mute"])]
    applyEventMapping(samples, {
      ...base,
      samples: { "bell.wav": ["join_room"], "missing.wav": ["message"] },
    })
    expect(samples[0].assignedEvents).toEqual(["join_room"])
    expect(samples[1].assignedEvents).toEqual(["mute"])
  })

  it("leaves samples with no entry untouched", () => {
    const samples = [makeSample("bell.wav", [])]
    applyEventMapping(samples, { ...base, samples: {} })
    expect(samples[0].assignedEvents).toEqual([])
  })

  it("dedupes events across files so one sfx owns each event", () => {
    const samples = [
      makeSample("bell.wav", []),
      makeSample("pop.mp3", []),
      makeSample("click.ogg", []),
    ]
    applyEventMapping(samples, {
      ...base,
      samples: {
        "bell.wav": ["mute"],
        "pop.mp3": ["mute", "unmute"],
        "click.ogg": ["unmute"],
      },
    })
    expect(samples[0].assignedEvents).toEqual(["mute"])
    expect(samples[1].assignedEvents).toEqual(["unmute"])
    expect(samples[2].assignedEvents).toEqual([])
  })
})

describe("EVENT_MAPPING_FILE", () => {
  it("does not collide with audio extensions", () => {
    expect(EVENT_MAPPING_FILE.endsWith(".wav")).toBe(false)
    expect(EVENT_MAPPING_FILE.endsWith(".mp3")).toBe(false)
  })
})
