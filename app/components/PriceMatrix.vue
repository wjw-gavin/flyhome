<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 font-medium text-highlighted">
          <UIcon name="i-lucide-calendar-days" class="size-4 text-primary" />
          出发日期 × 落地城市 · 最低往返价
        </div>
        <p class="text-xs text-dimmed">点日期只看那一天，点价格再限定城市；颜色越绿越便宜</p>
      </div>
    </template>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[640px] text-sm whitespace-nowrap">
        <thead>
          <tr class="border-b border-default text-xs text-muted">
            <th class="px-4 py-2 text-left font-medium">出发 → 返回</th>
            <th v-if="hasInsights" class="px-2 py-2 text-left font-medium">Google 价格水平</th>
            <th v-for="c in columns" :key="c" class="px-3 py-2 text-right font-medium">{{ c }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            class="border-b border-default/60 transition-colors last:border-0 hover:bg-elevated/60"
            :class="{ 'bg-primary/5': selected === row.out }"
          >
            <td class="px-4 py-2">
              <button class="flex items-center gap-2 text-left" @click="emit('update:selected', selected === row.out ? null : row.out)">
                <UIcon :name="selected === row.out ? 'i-lucide-circle-check' : 'i-lucide-circle'" class="size-3.5" :class="selected === row.out ? 'text-primary' : 'text-dimmed'" />
                <span class="font-medium text-highlighted">{{ fmtDate(row.out) }}</span>
                <span class="text-dimmed">→ {{ fmtDate(row.ret, false) }}</span>
                <UTooltip v-if="row.custom" :text="`自定义查询，抓取于 ${row.fetchedAt ? fmtDateTime(row.fetchedAt) : '?'}`">
                  <UBadge color="info" variant="subtle" size="xs" icon="i-lucide-calendar-search">自定义</UBadge>
                </UTooltip>
              </button>
            </td>
            <td v-if="hasInsights" class="px-2 py-2">
              <UBadge v-if="row.level" :color="LEVEL[row.level]?.color ?? 'neutral'" variant="subtle" size="sm">
                {{ LEVEL[row.level]?.label ?? row.level }}
              </UBadge>
            </td>
            <td v-for="c in columns" :key="c" class="px-3 py-2 text-right">
              <button
                v-if="row.cells[c]"
                class="tabular rounded-md px-2 py-0.5 font-medium transition-transform hover:scale-105"
                :style="cellStyle(row.cells[c]!)"
                :title="`${c} 最低 ${fmtMoney(row.cells[c]!, currency)}`"
                @click="emit('pick', { out: row.out, city: c })"
              >
                {{ Math.round(row.cells[c]!).toLocaleString('en-US') }}
              </button>
              <span v-else class="text-dimmed">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { Scored } from '~/types/flyhome'

const props = defineProps<{
  items: Scored[]
  cities: string[]
  weekdays: number[]
  currency: string
  selected: string | null
}>()
const emit = defineEmits<{ 'update:selected': [string | null], 'pick': [{ out: string, city: string }] }>()

const LEVEL: Record<string, { label: string, color: 'success' | 'neutral' | 'error' }> = {
  low: { label: '偏低', color: 'success' },
  typical: { label: '正常', color: 'neutral' },
  high: { label: '偏高', color: 'error' },
}

// Google only returns price_insights for single-airport searches; multi-airport runs have none.
const hasInsights = allQueries.some(q => q.priceInsights)

interface Row { id: string, out: string, ret: string, custom?: boolean, fetchedAt?: string, level?: string, cells: Record<string, number> }

const rows = computed(() => {
  // One row per date pair: arrival groups of the same pair merge; a custom query gets its own row.
  const rowKey = (q: { out: string, ret: string, custom?: boolean }) => `${q.out}_${q.ret}_${q.custom ? 'custom' : 'scan'}`
  const byKey = new Map<string, Row>()
  for (const q of allQueries) {
    if (!props.weekdays.includes(weekdayOf(q.out))) continue
    const key = rowKey(q)
    if (!byKey.has(key)) byKey.set(key, { id: key, out: q.out, ret: q.ret, custom: q.custom, fetchedAt: q.fetchedAt, level: q.priceInsights?.level, cells: {} })
  }
  for (const it of props.items) {
    const row = byKey.get(rowKey(it.query))
    if (!row) continue
    row.cells[it.city] = Math.min(row.cells[it.city] ?? Infinity, it.price)
  }
  return [...byKey.values()].sort((a, b) => a.out.localeCompare(b.out) || a.ret.localeCompare(b.ret))
})

// Only cities that actually have a price under the current filters, so the table stays narrow.
const columns = computed(() => props.cities.filter(c => rows.value.some(r => r.cells[c] !== undefined)))

const range = computed(() => {
  const values = rows.value.flatMap(r => Object.values(r.cells))
  return { min: Math.min(...values), max: Math.max(...values) }
})

const colorMode = useColorMode()

// Green (cheap) → amber → red (expensive) on a relative scale of what's currently shown.
function cellStyle(price: number) {
  const { min, max } = range.value
  const t = max === min ? 0 : (price - min) / (max - min)
  const hue = 140 - t * 140
  const dark = colorMode.value === 'dark'
  return {
    backgroundColor: `hsl(${hue} 70% 50% / ${dark ? 0.22 : 0.16})`,
    color: dark ? `hsl(${hue} 75% 72%)` : `hsl(${hue} 60% ${t > 0.5 ? 42 : 32}%)`,
  }
}
</script>
