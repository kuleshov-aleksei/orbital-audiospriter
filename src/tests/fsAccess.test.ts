import { describe, expect, it } from "vitest"
import { AUDIO_EXTENSIONS, isAudioFile } from "@/services/fsAccess"
import { formatBytes } from "@/utils/format"

describe("isAudioFile", () => {
  it("accepts common audio extensions case-insensitively", () => {
    expect(isAudioFile("ding.wav")).toBe(true)
    expect(isAudioFile("DING.MP3")).toBe(true)
    expect(isAudioFile("pop.ogg")).toBe(true)
    expect(isAudioFile("plop.m4a")).toBe(true)
    expect(isAudioFile("click.flac")).toBe(true)
  })

  it("rejects non-audio and extensionless files", () => {
    expect(isAudioFile("notes.txt")).toBe(false)
    expect(isAudioFile("README")).toBe(false)
    expect(isAudioFile("archive.zip")).toBe(false)
    expect(isAudioFile("cover.png")).toBe(false)
  })

  it("covers every extension the app declares", () => {
    expect(AUDIO_EXTENSIONS.length).toBeGreaterThan(0)
    for (const ext of AUDIO_EXTENSIONS) {
      expect(isAudioFile(`sample.${ext}`)).toBe(true)
    }
  })
})

describe("formatBytes", () => {
  it("formats byte sizes", () => {
    expect(formatBytes(0)).toBe("—")
    expect(formatBytes(-5)).toBe("—")
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(1024)).toBe("1.0 KB")
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB")
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB")
  })
})
