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
