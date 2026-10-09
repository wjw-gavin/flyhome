<template>
  <UCard :ui="{ body: 'space-y-6' }">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 font-medium text-highlighted">
          <UIcon name="i-lucide-sliders-horizontal" class="size-4 text-primary" />
          筛选与打分
        </div>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" @click="emit('reset')">
          重置
        </UButton>
      </div>
    </template>

    <section class="space-y-2">
      <p class="text-xs font-medium uppercase tracking-wide text-dimmed">出发机场</p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="o in config.origins"
          :key="o"
          size="sm"
          :variant="settings.origins.includes(o) ? 'solid' : 'outline'"
          :color="settings.origins.includes(o) ? 'primary' : 'neutral'"
          @click="toggle('origins', o)"
        >
          {{ o }} {{ ORIGIN_NAMES[o] ?? '' }}
        </UButton>
      </div>
    </section>

    <section class="space-y-2">
      <p class="text-xs font-medium uppercase tracking-wide text-dimmed">落地城市</p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="c in cityNames"
          :key="c"
          size="sm"
          :variant="settings.cities.includes(c) ? 'solid' : 'outline'"
          :color="settings.cities.includes(c) ? 'primary' : 'neutral'"
          @click="toggle('cities', c)"
        >
          {{ c }}
          <span class="ml-1 text-xs opacity-70">{{ config.cities[c]!.join('/') }}</span>
        </UButton>
      </div>
    </section>

    <section v-if="weekdayOptions.length > 1" class="space-y-2">
      <p class="text-xs font-medium uppercase tracking-wide text-dimmed">出发星期</p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="d in weekdayOptions"
          :key="d"
          size="sm"
          :variant="settings.weekdays.includes(d) ? 'solid' : 'outline'"
          :color="settings.weekdays.includes(d) ? 'primary' : 'neutral'"
          @click="toggleWeekday(d)"
        >
          {{ fmtWeekday(d) }}
        </UButton>
      </div>
    </section>

    <div class="grid grid-cols-2 gap-3">
      <UFormField label="最多中转" size="sm">
        <USelect v-model="settings.maxStops" :items="STOP_ITEMS" class="w-full" />
      </UFormField>
      <UFormField label="排序" size="sm">
        <USelect v-model="settings.sort" :items="SORT_ITEMS" class="w-full" />
      </UFormField>
    </div>

    <USeparator />

    <section class="space-y-5">
      <div>
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="text-default">我的一小时值多少钱</span>
          <span class="tabular font-medium text-highlighted">¥{{ settings.hourValue }}</span>
        </div>
        <USlider v-model="settings.hourValue" :min="0" :max="300" :step="10" />
        <p class="mt-1 text-xs text-dimmed">每多花 1 小时（飞行、中转、高铁），综合成本加这么多；设为 0 就是纯比价格。</p>
      </div>
      <div>
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="text-default">每次中转额外扣</span>
          <span class="tabular font-medium text-highlighted">¥{{ settings.stopPenalty }}</span>
        </div>
        <USlider v-model="settings.stopPenalty" :min="0" :max="1000" :step="50" />
      </div>
      <div>
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="text-default">隔夜中转再扣</span>
          <span class="tabular font-medium text-highlighted">¥{{ settings.overnightPenalty }}</span>
        </div>
        <USlider v-model="settings.overnightPenalty" :min="0" :max="1000" :step="50" />
      </div>
      <USwitch v-model="settings.includeOnward" :label="`算上高铁回${config.home.name}`" description="把机场到高铁站、高铁的时间和票价一起算进综合成本；没单独配置的城市按 8 小时 ¥600 估" />
    </section>
  </UCard>
</template>

<script setup lang="ts">
import type { Settings } from '~/types/flyhome'

const settings = defineModel<Settings>({ required: true })
const emit = defineEmits<{ reset: [] }>()

const ORIGIN_NAMES: Record<string, string> = { DXB: '迪拜', AUH: '阿布扎比' }
const STOP_ITEMS = [
  { label: '仅直飞', value: 0 },
  { label: '最多 1 次', value: 1 },
  { label: '最多 2 次', value: 2 },
]
const SORT_ITEMS = [
  { label: '性价比（综合成本）', value: 'score' },
  { label: '票价最低', value: 'price' },
  { label: '到家最快', value: 'duration' },
]

// Only weekdays that actually occur in the data (scheduled Thu/Fri/Sat plus any custom dates).
const weekdayOptions = [...new Set(allQueries.map(q => weekdayOf(q.out)))].sort()

function toggle(key: 'origins' | 'cities', v: string) {
  const list = settings.value[key]
  const i = list.indexOf(v)
  if (i >= 0) {
    if (list.length === 1) return
    list.splice(i, 1)
  } else {
    list.push(v)
  }
}

function toggleWeekday(d: number) {
  const list = settings.value.weekdays
  const i = list.indexOf(d)
  if (i >= 0) {
    if (list.filter(x => weekdayOptions.includes(x)).length === 1) return
    list.splice(i, 1)
  } else {
    list.push(d)
  }
}
</script>
