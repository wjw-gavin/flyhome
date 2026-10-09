<template>
  <header class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <UIcon name="i-lucide-plane-takeoff" class="size-6" />
        </div>
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
            FlyHome
            <span class="ml-2 text-base font-normal text-muted">回家机票比价</span>
          </h1>
          <p class="text-sm text-muted">
            {{ originLabel }} ⇄ {{ cityNames.slice(0, 4).join(' / ') }} 等 {{ cityNames.length }} 城 · 往返 {{ config.trip.days }} 天 · 最终回{{ config.home.name }} · 人民币
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <UTooltip :text="`抓取时间 ${fmtDateTime(run.fetchedAt)}（迪拜时间）`">
          <UBadge color="neutral" variant="subtle" icon="i-lucide-refresh-cw" size="lg">
            更新于 {{ fmtDateTime(run.fetchedAt) }}
          </UBadge>
        </UTooltip>
        <UTooltip text="SerpApi 免费额度，每次抓取按日期组数扣减，上次抓取后的余量">
          <UBadge v-if="run.quota" color="neutral" variant="subtle" icon="i-lucide-gauge" size="lg">
            本月剩余 {{ run.quota.left }}{{ run.quota.total ? ` / ${run.quota.total}` : '' }} 次
          </UBadge>
        </UTooltip>
        <ClientOnly>
          <FetchButton :run="run" />
        </ClientOnly>
        <UColorModeButton />
      </div>
    </div>

    <UAlert
      v-if="run.sample"
      color="warning"
      variant="subtle"
      icon="i-lucide-flask-conical"
      title="当前显示的是示例数据"
      description="航班和价格都是生成的，仅用于预览界面。配置 SERPAPI_KEY 并运行一次抓取后会被真实数据替换。"
    />
  </header>
</template>

<script setup lang="ts">
import type { RunFile } from '~/types/flyhome'

defineProps<{ run: RunFile }>()

const originLabel = config.origins.map(o => ({ DXB: '迪拜', AUH: '阿布扎比' }[o] ?? o)).join(' / ')
</script>
