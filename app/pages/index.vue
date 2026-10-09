<template>
  <UContainer class="space-y-6 py-6 lg:py-8">
    <AppHeader :run="latest" />

    <div class="grid gap-6 lg:grid-cols-12">
      <aside class="min-w-0 lg:col-span-4 xl:col-span-3">
        <div class="lg:sticky lg:top-6">
          <SettingsPanel v-model="settings" @reset="reset" />
        </div>
      </aside>

      <main class="min-w-0 space-y-6 lg:col-span-8 xl:col-span-9">
        <StatCards :ranked="ranked" :currency="latest.currency" />

        <PriceMatrix
          v-model:selected="selectedOut"
          :items="matrixItems"
          :cities="settings.cities"
          :weekdays="settings.weekdays"
          :currency="latest.currency"
          @pick="onPick"
        />

        <ClientOnly>
          <CustomQuery v-model:selected="selectedOut" />
          <GithubTokenModal />
        </ClientOnly>

        <section class="space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="flex items-center gap-2 font-medium text-highlighted">
              <UIcon name="i-lucide-list-ordered" class="size-4 text-primary" />
              方案排行
              <span class="text-sm font-normal text-muted">{{ ranked.length }} 条（同价变体已折叠）</span>
            </h2>
            <UButton
              v-if="selectedOut"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-x"
              @click="selectedOut = null"
            >
              只看 {{ fmtDate(selectedOut) }} 出发 · 清除
            </UButton>
          </div>

          <div v-if="!ranked.length" class="rounded-xl border border-dashed border-default p-10 text-center text-sm text-muted">
            没有符合条件的方案，试试放宽中转次数或多选几个城市。
          </div>
          <div v-else class="space-y-3">
            <FlightCard v-for="(it, i) in visible" :key="it.id + it.query.id" :it="it" :rank="i + 1" :currency="latest.currency" />
            <div v-if="visible.length < ranked.length" class="text-center">
              <UButton color="neutral" variant="soft" icon="i-lucide-chevrons-down" @click="limit += 20">
                再看 20 条（剩余 {{ ranked.length - visible.length }}）
              </UButton>
            </div>
          </div>
        </section>

        <TrendChart :selected-out="selectedOut" :cities="settings.cities" :currency="latest.currency" />

        <footer class="pb-4 text-center text-xs text-dimmed">
          数据来自 Google Flights（经 SerpApi），人民币往返总价、含 1 件随身行李；高铁时长与票价为估算，可在 flyhome.config.json 调整。
        </footer>
      </main>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const { settings, reset } = useSettings()
const selectedOut = useState<string | null>('selectedOut', () => null)
const limit = ref(20)

const { ranked } = useRanked(settings, selectedOut)
// The matrix ignores the date selection so every row stays comparable.
const { filtered: matrixItems } = useRanked(settings, ref(null))

const visible = computed(() => ranked.value.slice(0, limit.value))

watch([selectedOut, () => settings.value.sort], () => { limit.value = 20 })

function onPick({ out, city }: { out: string, city: string }) {
  selectedOut.value = out
  settings.value.cities = [city]
}
</script>
