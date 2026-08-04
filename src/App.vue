<script setup lang="ts">
import { ref } from "vue"
import HomeView from "@/views/HomeView.vue"
import SpikeView from "@/views/SpikeView.vue"

defineOptions({ name: "App" })

const view = ref<"home" | "spike">("home")
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-10 border-b border-zinc-800 bg-[#0f0f14]/90 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <div class="flex items-center gap-2">
          <span class="inline-block h-6 w-6">
            <img src="/favicon.svg" alt="" class="h-6 w-6" />
          </span>
          <span class="text-sm font-semibold text-zinc-100">AudioSpriter</span>
        </div>
        <nav class="flex gap-1">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm transition"
            :class="view === 'home' ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-400 hover:text-zinc-200'"
            @click="view = 'home'"
          >
            Home
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm transition"
            :class="view === 'spike' ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-400 hover:text-zinc-200'"
            @click="view = 'spike'"
          >
            Spike
          </button>
        </nav>
      </div>
    </header>

    <main>
      <HomeView v-if="view === 'home'" />
      <SpikeView v-else />
    </main>
  </div>
</template>