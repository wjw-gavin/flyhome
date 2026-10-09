<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 font-medium text-highlighted">
          <UIcon name="i-lucide-trending-down" class="size-4 text-primary" />
          价格走势
        </div>
        <UTabs v-if="hasInsights" v-model="tab" :items="tabs" :content="false" size="xs" color="neutral" />
      </div>
    </template>

    <div v-if="tab === 'ours'">
      <p class="mb-3 text-xs text-muted">
        每次抓取后各城市的最低往返价（{{ selectedOut ? `出发 ${fmtDate(selectedOut)}` : '所有出发日期取最低' }}）。
        <template v-if="runDates.length < 2">目前只有 {{ runDates.length }} 次抓取记录，多跑几天才能看出趋势。</template>
      </p>
      <ClientOnly>
        <VChart :option="oursOption" :theme="theme" autoresize class="h-64 w-full" />
      </ClientOnly>
    </div>
    <div v-else>
      <p class="mb-3 text-xs text-muted">
        Google Flights 对这组日期近 60 天的最低价记录<template v-if="!selectedOut">（请先在上方选一个出发日期）</template>。
      </p>
      <ClientOnly>
        <VChart v-if="googleOption" :option="googleOption" :theme="theme" autoresize class="h-64 w-full" />
        <div v-else class="flex h-64 items-center justify-center text-sm text-dimmed">没有可用的历史数据</div>
      </ClientOnly>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'

const props = defineProps<{ selectedOut: string | null, cities: string[], currency: string }>()

const colorMode = useColorMode()
const theme = computed(() => (colorMode.value === 'dark' ? 'dark' : undefined))
const hasInsights = latest.queries.some(q => q.priceInsights)
const tab = ref<'ours' | 'google'>('ours')
const tabs = [
  { label: '我的抓取记录', value: 'ours' },
  { label: 'Google 近 60 天', value: 'google' },
]

const base = computed<EChartsOption>(() => ({
  backgroundColor: 'transparent',
  grid: { left: 48, right: 16, top: 32, bottom: 28 },
  tooltip: { trigger: 'axis', valueFormatter: v => `${Math.round(Number(v)).toLocaleString('en-US')} ${props.currency}` },
  legend: { top: 0, textStyle: { fontSize: 11 } },
  yAxis: { type: 'value', scale: true, axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { opacity: 0.3 } } },
}))

const runDates = computed(() => [...new Set(priceHistory.map(h => h.run))].sort())

const oursOption = computed<EChartsOption>(() => {
  const points = priceHistory.filter(h => props.cities.includes(h.city) && (!props.selectedOut || h.out === props.selectedOut))
  const series = props.cities.map(city => ({
    name: city,
    type: 'line' as const,
    smooth: true,
    symbolSize: 8,
    connectNulls: true,
    data: runDates.value.map((run) => {
      const vals = points.filter(p => p.run === run && p.city === city).map(p => p.min)
      return vals.length ? Math.min(...vals) : null
    }),
  }))
  return { ...base.value, xAxis: { type: 'category', data: runDates.value.map(d => d.slice(5)), axisLabel: { fontSize: 11 } }, series }
})

const googleOption = computed<EChartsOption | null>(() => {
  const q = latest.queries.find(x => x.out === props.selectedOut)
  const hist = q?.priceInsights?.history
  if (!hist?.length) return null
  return {
    ...base.value,
    legend: undefined,
    xAxis: { type: 'category', data: hist.map(([ts]) => new Date(ts * 1000).toISOString().slice(5, 10)), axisLabel: { fontSize: 11 } },
    series: [{ name: '最低价', type: 'line', smooth: true, showSymbol: false, areaStyle: { opacity: 0.12 }, data: hist.map(([, p]) => p) }],
  }
})
</script>
