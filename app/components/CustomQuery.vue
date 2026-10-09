<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 font-medium text-highlighted">
          <UIcon name="i-lucide-calendar-search" class="size-4 text-primary" />
          查指定日期
        </div>
        <p class="text-xs text-dimmed">不在上面列表里的日期单独抓一次，{{ cost }} 次额度，约 4 分钟后显示</p>
      </div>
    </template>

    <div class="flex flex-wrap items-end gap-3">
      <UFormField label="出发日期" size="sm">
        <UInput v-model="out" type="date" :min="minOut" class="w-40" />
      </UFormField>
      <UFormField label="返回日期" size="sm" :hint="retTouched ? '' : `默认 +${config.trip.days} 天`">
        <UInput v-model="ret" type="date" :min="out || minOut" class="w-40" @input="retTouched = true" />
      </UFormField>
      <UButton
        :color="p.phase === 'done' ? 'success' : 'primary'"
        :icon="icon"
        :loading="p.phase === 'dispatching' || p.phase === 'running'"
        :disabled="!valid && p.phase === 'idle'"
        @click="onClick"
      >
        {{ label }}
      </UButton>
      <p v-if="out && !valid" class="text-xs text-error">出发要在明天之后，返回要晚于出发。</p>
    </div>

    <div v-if="customQueries.length" class="mt-4 border-t border-default pt-3">
      <p class="mb-2 text-xs text-dimmed">已查过的自定义日期（出发日过了会自动清掉；点一下只看那天）</p>
      <div class="flex flex-wrap gap-1.5">
        <UButton
          v-for="q in customQueries"
          :key="q.id"
          size="xs"
          :variant="selected === q.out ? 'solid' : 'soft'"
          :color="selected === q.out ? 'primary' : 'neutral'"
          icon="i-lucide-calendar"
          @click="emit('update:selected', selected === q.out ? null : q.out)"
        >
          {{ fmtDate(q.out) }} → {{ fmtDate(q.ret, false) }}
          <span class="opacity-60">· {{ q.fetchedAt ? fmtDateTime(q.fetchedAt) : '' }}</span>
        </UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { RunProgress } from '~/composables/useGithubActions'

defineProps<{ selected: string | null }>()
const emit = defineEmits<{ 'update:selected': [string | null] }>()

const { withToken, runWorkflow } = useGithubActions()
const toast = useToast()
const p = reactive<RunProgress>({ phase: 'idle', status: '', runUrl: '' })

const cost = config.arrivalGroups.length
const minOut = addDaysIso(todayIso(), 1)
const out = ref('')
const ret = ref('')
const retTouched = ref(false)

watch(out, (v) => {
  if (v && !retTouched.value) ret.value = addDaysIso(v, config.trip.days)
})

const valid = computed(() => Boolean(out.value && ret.value && out.value >= minOut && ret.value > out.value))

const label = computed(() => ({
  idle: '抓这组日期',
  dispatching: '正在触发…',
  running: p.status || '抓取中…',
  done: '已更新，点此刷新',
  failed: '失败，重试',
}[p.phase]))

const icon = computed(() => ({
  idle: 'i-lucide-search',
  dispatching: 'i-lucide-loader',
  running: 'i-lucide-loader',
  done: 'i-lucide-refresh-cw',
  failed: 'i-lucide-triangle-alert',
}[p.phase]))

function onClick() {
  if (p.phase === 'done') return location.reload()
  if (p.phase === 'dispatching' || p.phase === 'running') return
  if (!valid.value) return
  withToken(start)
}

async function start() {
  try {
    const conclusion = await runWorkflow({ out: out.value, ret: ret.value }, p)
    if (conclusion === 'success') {
      toast.add({ title: `${fmtDate(out.value)} 的价格已抓到`, description: '站点已重新部署，刷新页面查看。', color: 'success' })
    } else {
      toast.add({ title: `流程结束：${conclusion}`, description: '点开 Actions 看日志。', color: 'warning', actions: [{ label: '查看 Actions', to: p.runUrl, target: '_blank' }] })
    }
  } catch (err) {
    p.phase = 'failed'
    toast.add({ title: '触发失败', description: (err as Error).message, color: 'error' })
  }
}
</script>
