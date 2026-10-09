<template>
  <UCard :ui="{ body: 'p-4 sm:p-5' }" class="transition-shadow hover:shadow-md">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
      <!-- rank + airline -->
      <div class="flex items-center gap-3 lg:w-52 lg:shrink-0">
        <span class="tabular w-6 text-right text-sm text-dimmed">{{ rank }}</span>
        <div class="flex -space-x-2">
          <img
            v-for="logo in logos"
            :key="logo"
            :src="logo"
            alt=""
            class="size-8 rounded-full bg-white object-contain p-0.5 ring-2 ring-default"
            loading="lazy"
          >
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-highlighted">{{ it.airlines.join(' + ') }}</p>
          <p class="truncate text-xs text-dimmed">{{ it.segments.map(s => s.flightNumber).join(' · ') }}</p>
        </div>
      </div>

      <!-- timeline -->
      <div class="flex flex-1 items-center gap-3">
        <div class="text-right">
          <p class="tabular text-lg font-semibold text-highlighted">{{ fmtTime(first.dep) }}</p>
          <p class="text-xs text-muted">{{ it.origin }}</p>
        </div>
        <div class="relative flex-1 px-1">
          <p class="mb-1 text-center text-xs text-muted">{{ fmtDuration(it.totalDuration) }}</p>
          <div class="relative h-0.5 rounded bg-accented">
            <span
              v-for="(l, i) in it.layovers"
              :key="l.id"
              class="absolute top-1/2 size-2 -translate-y-1/2 rounded-full ring-2 ring-default"
              :class="l.overnight ? 'bg-error' : 'bg-warning'"
              :style="{ left: `${((i + 1) / (it.layovers.length + 1)) * 100}%` }"
            />
          </div>
          <p class="mt-1 text-center text-xs" :class="it.stops ? 'text-warning' : 'text-success'">
            <template v-if="it.stops">
              {{ it.layovers.map(l => `${l.id} ${fmtDuration(l.duration)}`).join(' · ') }}
            </template>
            <template v-else>直飞</template>
          </p>
        </div>
        <div>
          <p class="tabular text-lg font-semibold text-highlighted">
            {{ fmtTime(last.arr) }}
            <sup v-if="days > 0" class="text-xs text-error">+{{ days }}</sup>
          </p>
          <p class="text-xs text-muted">{{ it.dest }} {{ it.city }}</p>
        </div>
      </div>

      <!-- price -->
      <div class="flex items-center justify-between gap-4 lg:w-44 lg:shrink-0 lg:flex-col lg:items-end lg:gap-0">
        <div class="text-right">
          <p class="tabular text-2xl font-semibold text-highlighted">{{ fmtMoney(it.price, currency) }}</p>
          <p class="text-xs text-muted">往返总价</p>
        </div>
        <UTooltip :text="breakdown">
          <p class="tabular text-sm text-primary">综合 ≈ {{ fmtMoney(it.score, currency) }}</p>
        </UTooltip>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-1.5">
      <UBadge color="neutral" variant="subtle" size="sm" icon="i-lucide-calendar">
        {{ fmtDate(it.query.out) }} → {{ fmtDate(it.query.ret) }}
      </UBadge>
      <UBadge v-for="t in tags" :key="t.label" :color="t.color" variant="subtle" size="sm" :icon="t.icon">
        {{ t.label }}
      </UBadge>
      <UTooltip v-if="it.variants" text="同一天、同航司、同落地、同价还有其他中转组合，去 Google 里看全部">
        <UBadge color="neutral" variant="subtle" size="sm" icon="i-lucide-layers">+{{ it.variants }} 个同价变体</UBadge>
      </UTooltip>
      <UBadge v-if="it.onward" :color="it.onwardEstimated ? 'warning' : 'neutral'" variant="outline" size="sm" icon="i-lucide-train-front">
        {{ it.onward.station }} → {{ config.home.name }} {{ fmtHours(it.onwardHours) }} · ¥{{ it.onward.trainCny }}{{ it.onwardEstimated ? '（粗估）' : '' }}
      </UBadge>

      <div class="ml-auto flex items-center gap-1">
        <UButton size="xs" color="neutral" variant="ghost" :icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" @click="open = !open">
          航段
        </UButton>
        <UButton size="xs" color="primary" variant="soft" icon="i-lucide-external-link" :to="it.query.googleUrl" target="_blank">
          Google
        </UButton>
        <UButton size="xs" color="neutral" variant="soft" :to="tripLink('ctrip', it.origin, it.dest, it.query.out, it.query.ret)" target="_blank">
          携程
        </UButton>
        <UButton size="xs" color="neutral" variant="soft" :to="tripLink('trip', it.origin, it.dest, it.query.out, it.query.ret)" target="_blank">
          Trip.com
        </UButton>
      </div>
    </div>

    <div v-if="open" class="mt-4 space-y-2 border-t border-default pt-4 text-sm">
      <template v-for="(s, i) in it.segments" :key="s.flightNumber + i">
        <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <span class="tabular text-muted">{{ fmtTime(s.dep) }} – {{ fmtTime(s.arr) }}</span>
          <span class="text-highlighted">
            {{ s.from }} {{ s.fromName }} → {{ s.to }} {{ s.toName }}
            <span class="text-dimmed">· {{ fmtDuration(s.duration) }}</span>
          </span>
          <span />
          <span class="text-xs text-dimmed">
            {{ s.airline }} {{ s.flightNumber }}<template v-if="s.airplane"> · {{ s.airplane }}</template><template v-if="s.legroom"> · 座距 {{ s.legroom }}</template>
            <template v-if="s.extensions?.length"> · {{ s.extensions.join('，') }}</template>
          </span>
        </div>
        <div v-if="it.layovers[i]" class="flex items-center gap-2 pl-1 text-xs" :class="it.layovers[i]!.overnight ? 'text-error' : 'text-warning'">
          <UIcon name="i-lucide-timer" class="size-3.5" />
          {{ it.layovers[i]!.id }} {{ it.layovers[i]!.name }} 中转 {{ fmtDuration(it.layovers[i]!.duration) }}
          <template v-if="it.layovers[i]!.overnight">（隔夜）</template>
        </div>
      </template>
      <p v-if="it.extensions.length" class="text-xs text-dimmed">{{ it.extensions.join('，') }}</p>
      <p class="text-xs text-dimmed">价格为 Google Flights 给出的往返总价（去程为此航班，回程按最低价搭配）；实际请在购票平台核对。</p>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { Scored } from '~/types/flyhome'

const props = defineProps<{ it: Scored, rank: number, currency: string }>()

const open = ref(false)
const first = computed(() => props.it.segments[0]!)
const last = computed(() => props.it.segments[props.it.segments.length - 1]!)
const days = computed(() => dayOffset(first.value.dep, last.value.arr))
const logos = computed(() => [...new Set(props.it.segments.map(s => s.airlineLogo).filter(Boolean))] as string[])

const LOW_COST = ['阿拉伯航空', 'Air Arabia', '迪拜航空', 'flydubai', 'Wizz', '亚洲航空', 'AirAsia', '酷航', 'Scoot', '靛蓝', 'IndiGo', '捷星', 'Jetstar']

const tags = computed(() => {
  const t: { label: string, color: 'success' | 'warning' | 'error' | 'info' | 'primary' | 'neutral', icon?: string }[] = []
  const it = props.it
  if (it.best) t.push({ label: 'Google 推荐', color: 'primary', icon: 'i-lucide-thumbs-up' })
  if (!it.stops) t.push({ label: '直飞', color: 'success', icon: 'i-lucide-move-right' })
  const depHour = Number(first.value.dep.slice(11, 13))
  if (depHour < 6) t.push({ label: '红眼起飞', color: 'warning', icon: 'i-lucide-moon' })
  if (it.layovers.some(l => l.overnight)) t.push({ label: '隔夜中转', color: 'error', icon: 'i-lucide-bed' })
  else if (it.layovers.some(l => l.duration >= 360)) t.push({ label: '长中转', color: 'warning', icon: 'i-lucide-timer' })
  if (it.airlines.some(a => LOW_COST.some(k => a.includes(k)))) t.push({ label: '低成本航司 · 行李另计', color: 'info', icon: 'i-lucide-luggage' })
  return t
})

const breakdown = computed(() => {
  const it = props.it
  const parts = [`票价 ${Math.round(it.price)}`, `飞行时间与中转折算 +${Math.round(it.flightCost - it.price)}`]
  if (it.onward) parts.push(`高铁段票价与时间折算 +${Math.round(it.score - it.flightCost)}`)
  return parts.join(' · ')
})
</script>
