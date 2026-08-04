const TARGET_RATE = 44100

export interface DecodedAudio {
  /** mono PCM at 44.1 kHz — waveform source and sprite assembly input */
  pcm: Float32Array
  sampleRate: number
  duration: number
  channels: number
  originalSampleRate: number
}

/** Average channel data into a single mono track (identity for mono sources). */
export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]
  const n = channels[0].length
  const mono = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (const channel of channels) sum += channel[i]
    mono[i] = sum / channels.length
  }
  return mono
}

function channelsOf(buffer: AudioBuffer): Float32Array[] {
  return Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
}

async function resampleTo(buffer: AudioBuffer, targetRate: number): Promise<Float32Array> {
  if (buffer.sampleRate === targetRate) return mixToMono(channelsOf(buffer))
  const length = Math.max(1, Math.ceil(buffer.duration * targetRate))
  const ctx = new OfflineAudioContext(1, length, targetRate)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start()
  const rendered = await ctx.startRendering()
  return rendered.getChannelData(0)
}

/**
 * Decode any format Chrome understands (mp3/ogg/m4a/wav/flac/opus) to mono 44.1 kHz PCM.
 * OfflineAudioContext avoids autoplay-policy gestures and detaches the input buffer.
 */
export async function decodeAudioFile(
  bytes: Uint8Array<ArrayBuffer>,
  fileName: string,
): Promise<DecodedAudio> {
  let buffer: AudioBuffer
  try {
    const ctx = new OfflineAudioContext(1, 1, TARGET_RATE)
    buffer = await ctx.decodeAudioData(bytes.buffer)
  } catch (error) {
    throw new Error(
      `Could not decode "${fileName}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
  const originalSampleRate = buffer.sampleRate
  const channels = buffer.numberOfChannels
  const pcm = await resampleTo(buffer, TARGET_RATE)
  return {
    pcm,
    sampleRate: TARGET_RATE,
    duration: pcm.length / TARGET_RATE,
    channels,
    originalSampleRate,
  }
}
