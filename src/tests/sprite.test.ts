import { describe, expect, it } from "vitest"
import {
  buildAudiospriteJson,
  buildSoundSpriteTs,
  buildSprite,
  camelCasePackId,
} from "@/utils/sprite"
import { DEFAULT_TARGET_LUFS } from "@/types/audio"
import type { Sample } from "@/types/audio"

function makeSample(
  id: string,
  fileName: string,
  events: Sample["assignedEvents"],
  duration = 1,
): Sample {
  return {
    id,
    fileName,
    fileHandle: null,
    pcm: new Float32Array(44100 * duration),
    sampleRate: 44100,
    duration,
    chunks: [{ id: `${id}-c`, start: 0, end: duration }],
    targetLufs: DEFAULT_TARGET_LUFS,
    assignedEvents: events,
  }
}

describe("camelCasePackId", () => {
  it("converts snake_case to camelCase", () => {
    expect(camelCasePackId("my_new_pack")).toBe("myNewPack")
    expect(camelCasePackId("pack")).toBe("pack")
    expect(camelCasePackId("sfx_pack_2024")).toBe("sfxPack2024")
  })
})

describe("buildSprite", () => {
  it("concatenates assigned samples in order and creates entries per event", () => {
    const { pack, pcm, sampleRate } = buildSprite(
      [makeSample("a", "a.wav", ["mute"]), makeSample("b", "b.wav", ["unmute", "message"])],
      "my_pack",
      0,
    )
    expect(sampleRate).toBe(44100)
    expect(pcm.length).toBe(44100 * 2)
    expect(pack.entries).toEqual([
      { name: "mute", start: 0, end: 1 },
      { name: "unmute", start: 1, end: 2 },
      { name: "message", start: 1, end: 2 },
    ])
  })

  it("inserts silence gaps between samples", () => {
    const { pack, pcm } = buildSprite(
      [makeSample("a", "a.wav", ["mute"]), makeSample("b", "b.wav", ["unmute"])],
      "my_pack",
      0.5,
    )
    expect(pcm.length).toBe(44100 + 22050 + 44100)
    expect(pack.entries[1].start).toBeCloseTo(1.5, 3)
    expect(pack.entries[1].end).toBeCloseTo(2.5, 3)
  })

  it("lays the second sample at the gap offset (audio really has silence between clips)", () => {
    const gap = 0.5
    const first = makeSample("a", "a.wav", ["mute"])
    first.pcm!.fill(1.0)
    const second = makeSample("b", "b.wav", ["unmute"])
    second.pcm!.fill(0.5)
    const { pcm, pack } = buildSprite([first, second], "my_pack", gap)

    const firstEnd = Math.round(pack.entries.find((e) => e.name === "mute")!.end * 44100)
    const secondStart = Math.round(pack.entries.find((e) => e.name === "unmute")!.start * 44100)
    expect(secondStart - firstEnd).toBe(Math.round(gap * 44100))

    // First clip present and non-zero
    expect(Math.abs(pcm[0])).toBeCloseTo(1.0, 5)
    // Silence during the gap region
    const gapStart = firstEnd
    const gapEnd = secondStart
    for (let i = gapStart; i < gapEnd; i++) {
      expect(pcm[i]).toBeCloseTo(0, 5)
    }
    // Second clip present at its offset
    expect(Math.abs(pcm[secondStart])).toBeCloseTo(0.5, 5)
  })

  it("skips samples with no assigned events", () => {
    const { pack, pcm } = buildSprite(
      [makeSample("a", "a.wav", ["mute"]), makeSample("b", "b.wav", [])],
      "my_pack",
      0,
    )
    expect(pack.entries).toHaveLength(1)
    expect(pcm.length).toBe(44100)
  })

  it("keeps only the spliced pieces, not the full source", () => {
    const sample = makeSample("a", "a.wav", ["mute"], 2)
    sample.chunks = [{ id: "c", start: 0.5, end: 1.5 }]
    const { pcm } = buildSprite([sample], "my_pack", 0)
    expect(pcm.length).toBe(44100)
  })

  it("returns an empty pack for no assignments", () => {
    const { pack, pcm } = buildSprite([makeSample("a", "a.wav", [])], "my_pack", 0)
    expect(pack.entries).toEqual([])
    expect(pcm.length).toBe(0)
  })
})

describe("buildAudiospriteJson", () => {
  it("emits urls in howler load order (ogg, m4a, mp3)", () => {
    const json = JSON.parse(
      buildAudiospriteJson("my_pack", [{ name: "mute", start: 0, end: 1.25 }]),
    )
    expect(json.urls).toEqual(["my_pack.ogg", "my_pack.m4a", "my_pack.mp3"])
    expect(json.spritemap.mute).toEqual({ start: 0, end: 1.25 })
  })

  it("rounds timings to 3 decimals", () => {
    const json = JSON.parse(
      buildAudiospriteJson("p", [{ name: "mute", start: 0.123456, end: 1.111111 }]),
    )
    expect(json.spritemap.mute.start).toBe(0.123)
    expect(json.spritemap.mute.end).toBe(1.111)
  })
})

describe("buildSoundSpriteTs", () => {
  it("emits a valid TS module with millisecond timings", () => {
    const ts = buildSoundSpriteTs("my_new_pack", [
      { name: "mute", start: 0, end: 0.5 },
      { name: "message", start: 0.5, end: 1.25 },
    ])
    expect(ts).toContain('import type { SoundPackSprite } from "@/types/audio"')
    expect(ts).toContain("const myNewPackSprites: Record<string, SoundPackSprite> = {")
    expect(ts).toContain('"mute": { "name": "mute", "start": 0, "duration": 500 },')
    expect(ts).toContain('"message": { "name": "message", "start": 500, "duration": 750 },')
    expect(ts).toContain("export { myNewPackSprites }")
  })

  it("repeats the same timing for alias events", () => {
    const ts = buildSoundSpriteTs("pack", [
      { name: "mute", start: 0, end: 1 },
      { name: "unmute", start: 0, end: 1 },
    ])
    expect(ts).toContain('"mute": { "name": "mute", "start": 0, "duration": 1000 },')
    expect(ts).toContain('"unmute": { "name": "unmute", "start": 0, "duration": 1000 },')
  })
})
