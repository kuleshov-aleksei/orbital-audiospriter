const HEADER_SIZE = 44

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

export function pcmToWav16(samples: Float32Array, sampleRate: number): Uint8Array {
  const numSamples = samples.length
  const dataSize = numSamples * 2
  const buffer = new ArrayBuffer(HEADER_SIZE + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, "WAVE")
  writeAscii(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, "data")
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(HEADER_SIZE + i * 2, Math.round(clamped * 32767), true)
  }

  return new Uint8Array(buffer)
}

export interface Wav16Data {
  pcm: Float32Array
  sampleRate: number
}

export function wav16ToPcm(bytes: Uint8Array): Wav16Data {
  if (bytes.length < 44) throw new Error("wav file too short")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const riff = String.fromCharCode(...bytes.slice(0, 4))
  const wave = String.fromCharCode(...bytes.slice(8, 12))
  if (riff !== "RIFF" || wave !== "WAVE") throw new Error("not a RIFF/WAVE file")
  if (view.getUint16(20, true) !== 1) throw new Error("not a PCM wav file")
  const channels = view.getUint16(22, true)
  const sampleRate = view.getUint32(24, true)
  const bitsPerSample = view.getUint16(34, true)
  if (bitsPerSample !== 16) throw new Error(`unsupported bit depth: ${bitsPerSample}`)
  const dataSize = view.getUint32(40, true)
  const numFrames = dataSize / 2 / channels
  const pcm = new Float32Array(numFrames)
  for (let i = 0; i < numFrames; i++) {
    let sum = 0
    for (let c = 0; c < channels; c++) {
      sum += view.getInt16(44 + (i * channels + c) * 2, true)
    }
    pcm[i] = sum / channels / 32768
  }
  return { pcm, sampleRate }
}

export function createSineWave(
  durationSec: number,
  sampleRate: number,
  frequencyHz: number,
  amplitude = 0.5,
): Float32Array {
  const numSamples = Math.round(durationSec * sampleRate)
  const samples = new Float32Array(numSamples)
  const twoPiF = (2 * Math.PI * frequencyHz) / sampleRate
  for (let i = 0; i < numSamples; i++) {
    samples[i] = amplitude * Math.sin(twoPiF * i)
  }
  return samples
}
