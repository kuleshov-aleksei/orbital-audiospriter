<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
    <div>
      <h2 class="text-xl font-semibold text-zinc-100">
        Phase 1 spike — codec/filter capability matrix
      </h2>
      <p class="mt-1 max-w-3xl text-sm text-zinc-400">
        Verifies the published <code class="text-violet-300">@ffmpeg/core-st</code> build supports
        what the spec needs: MP3 (libmp3lame), OGG (libvorbis/libopus), M4A (aac/libfdk_aac) and the
        <code class="text-violet-300">loudnorm</code> filter. No result here is fatal — each has a
        documented fallback.
      </p>
    </div>

    <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 class="text-sm font-semibold text-zinc-200">Capabilities</h3>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="capsStatus === 'running'"
          @click="runCapabilityCheck()">
          {{ capsStatus === "running" ? "Checking…" : caps ? "Re-check" : "Check capabilities" }}
        </button>
      </div>

      <p v-if="capsStatus === 'error'" class="mt-3 text-sm text-red-400">Failed: {{ capsError }}</p>

      <div v-if="verdict" class="mt-4 grid gap-6 md:grid-cols-2">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th class="py-1 pr-4">Feature</th>
              <th class="py-1 pr-4">Status</th>
              <th class="py-1">Encoder</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800">
            <tr>
              <td class="py-2 pr-4">MP3</td>
              <td class="py-2 pr-4">{{ verdict.mp3.ok ? "✓" : "✗" }}</td>
              <td class="py-2 font-mono text-xs">{{ verdict.mp3.encoder }}</td>
            </tr>
            <tr>
              <td class="py-2 pr-4">OGG</td>
              <td class="py-2 pr-4">{{ verdict.ogg.ok ? "✓" : "✗" }}</td>
              <td class="py-2 font-mono text-xs">{{ verdict.ogg.encoder }}</td>
            </tr>
            <tr>
              <td class="py-2 pr-4">M4A</td>
              <td class="py-2 pr-4">{{ verdict.m4a.ok ? "✓" : "✗" }}</td>
              <td class="py-2 font-mono text-xs">{{ verdict.m4a.encoder }}</td>
            </tr>
            <tr>
              <td class="py-2 pr-4">loudnorm filter</td>
              <td class="py-2 pr-4">{{ verdict.loudnorm ? "✓" : "✗" }}</td>
              <td class="py-2 font-mono text-xs">
                {{ verdict.loudnorm ? "available" : "fallback: JS EBU R128" }}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="text-sm leading-relaxed text-zinc-400">
          <p v-if="caps">
            Core:
            <span class="text-zinc-200"
              >{{ (caps.core.sizeBytes / 1024 / 1024).toFixed(1) }} MB</span
            >
            wasm, loaded in <span class="text-zinc-200">{{ caps.core.loadTimeMs }} ms</span>.
          </p>
          <p class="mt-2 text-xs text-zinc-500">Relevant encoders found: {{ relevantEncoders }}</p>
          <p class="mt-1 text-xs text-zinc-500">Relevant filters found: {{ relevantFilters }}</p>
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h3 class="text-sm font-semibold text-zinc-200">Encode self-test</h3>
      <p class="mt-1 text-xs text-zinc-500">
        Generates a 0.4 s sine WAV in-memory and encodes it to every available target format.
      </p>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="testStatus === 'running'"
          @click="handleSelfTest()">
          {{
            testStatus === "running" ? "Encoding…" : selftest ? "Run again" : "Run encode self-test"
          }}
        </button>
      </div>

      <p v-if="testStatus === 'error'" class="mt-3 text-sm text-red-400">Failed: {{ testError }}</p>

      <div v-if="selftest" class="mt-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-zinc-500">
              <th class="py-1 pr-6">Format</th>
              <th class="py-1 pr-6">Encoder</th>
              <th class="py-1 pr-6">Result</th>
              <th class="py-1">Bytes</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800">
            <tr v-for="f in selftest.formats" :key="f.format">
              <td class="py-2 pr-6 font-mono text-xs">{{ f.format }}</td>
              <td class="py-2 pr-6 font-mono text-xs">{{ f.encoder }}</td>
              <td class="py-2 pr-6">{{ f.ok ? "✓" : "✗" }}</td>
              <td class="py-2 font-mono text-xs">{{ f.ok ? f.bytes.toLocaleString() : "—" }}</td>
            </tr>
            <tr v-if="selftest.loudnorm">
              <td class="py-2 pr-6 font-mono text-xs">wav (loudnorm)</td>
              <td class="py-2 pr-6 font-mono text-xs">loudnorm:I=-23</td>
              <td class="py-2 pr-6">{{ selftest.loudnorm.ok ? "✓" : "✗" }}</td>
              <td class="py-2 font-mono text-xs">
                {{ selftest.loudnorm.ok ? selftest.loudnorm.bytes.toLocaleString() : "—" }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-zinc-200">ffmpeg worker log</h3>
        <button
          type="button"
          class="text-xs text-violet-400 transition hover:text-violet-300"
          @click="logsOpen = !logsOpen">
          {{ logsOpen ? "Collapse" : "Expand" }}
        </button>
      </div>
      <pre
        v-if="logsOpen"
        class="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 font-mono text-xs leading-relaxed text-zinc-400"
        >{{ logs.join("\n") || "No log output yet." }}</pre>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue"
import { checkCapabilities, getLogs, runSelfTest } from "@/services/ffmpegClient"
import {
  detectCapabilities,
  OPTIONAL_ENCODERS,
  REQUIRED_ENCODERS,
  REQUIRED_FILTERS,
} from "@/services/capabilities"
import type { Capabilities, SelfTestResult } from "@/workers/protocol"

defineOptions({ name: "SpikeView" })

const caps = ref<Capabilities | null>(null)
const verdict = ref<ReturnType<typeof detectCapabilities> | null>(null)
const capsStatus = ref<"idle" | "running" | "done" | "error">("idle")
const capsError = ref<string | null>(null)

const selftest = ref<SelfTestResult | null>(null)
const testStatus = ref<"idle" | "running" | "done" | "error">("idle")
const testError = ref<string | null>(null)

const logs = ref<string[]>([])
const logsOpen = ref(true)

const trackedEncoders = [...REQUIRED_ENCODERS, ...OPTIONAL_ENCODERS]
const relevantEncoders = computed(
  () =>
    caps.value?.encoders.filter((e) => trackedEncoders.includes(e as never)).join(", ") || "none",
)
const relevantFilters = computed(
  () =>
    caps.value?.filters
      .filter((f) => (REQUIRED_FILTERS as readonly string[]).includes(f))
      .join(", ") || "none",
)

function refreshLogs(): void {
  logs.value = getLogs()
}

async function runCapabilityCheck(): Promise<void> {
  capsStatus.value = "running"
  capsError.value = null
  try {
    caps.value = await checkCapabilities()
    verdict.value = detectCapabilities(caps.value.encoders, caps.value.filters)
    capsStatus.value = "done"
  } catch (error) {
    capsError.value = error instanceof Error ? error.message : String(error)
    capsStatus.value = "error"
  }
  refreshLogs()
  await nextTick()
}

async function handleSelfTest(): Promise<void> {
  testStatus.value = "running"
  testError.value = null
  try {
    selftest.value = await runSelfTest()
    testStatus.value = "done"
  } catch (error) {
    testError.value = error instanceof Error ? error.message : String(error)
    testStatus.value = "error"
  }
  refreshLogs()
  await nextTick()
}

onMounted(refreshLogs)
</script>
