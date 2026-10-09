<template>
  <div class="grid gap-3 sm:grid-cols-3">
    <UCard v-for="s in stats" :key="s.label" :ui="{ body: 'p-4 sm:p-4' }">
      <div class="flex items-start justify-between">
        <div class="min-w-0">
          <p class="text-xs text-muted">{{ s.label }}</p>
          <p class="tabular mt-1 truncate text-2xl font-semibold text-highlighted">{{ s.value }}</p>
          <p class="mt-1 truncate text-xs text-dimmed">{{ s.hint }}</p>
        </div>
        <div class="flex size-9 shrink-0 items-center justify-center rounded-xl" :class="s.tone">
          <UIcon :name="s.icon" class="size-4" />
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { Scored } from '~/types/flyhome'

const props = defineProps<{ ranked: Scored[], currency: string }>()

const stats = computed(() => {
  const list = props.ranked
  if (!list.length) {
    return [{ label: '没有符合条件的方案', value: '—', hint: '放宽筛选试试', icon: 'i-lucide-search-x', tone: 'bg-elevated text-muted' }]
  }
  const cheapest = [...list].sort((a, b) => a.price - b.price)[0]!
  const best = [...list].sort((a, b) => a.score - b.score)[0]!
  const fastest = [...list].sort((a, b) => totalHours(a) - totalHours(b))[0]!
  const describe = (it: Scored) => `${it.origin}→${it.city} · ${fmtDate(it.query.out, false)} 出发 · ${it.stops ? `${it.stops} 次中转` : '直飞'}`
  return [
    { label: '最低票价', value: fmtMoney(cheapest.price, props.currency), hint: describe(cheapest), icon: 'i-lucide-tag', tone: 'bg-success/10 text-success' },
    { label: '最佳性价比（综合成本）', value: `≈ ${fmtMoney(best.score, props.currency)}`, hint: `${describe(best)} · 票价 ${fmtMoney(best.price, props.currency)}`, icon: 'i-lucide-sparkles', tone: 'bg-primary/10 text-primary' },
    { label: '最快到家', value: fmtHours(totalHours(fastest)), hint: `${describe(fastest)} · ${fmtMoney(fastest.price, props.currency)}`, icon: 'i-lucide-zap', tone: 'bg-warning/10 text-warning' },
  ]
})

function totalHours(it: Scored) {
  return it.totalDuration / 60 + it.onwardHours
}
</script>
