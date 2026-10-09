<template>
  <UButton
    :color="p.phase === 'done' ? 'success' : 'primary'"
    :variant="p.phase === 'idle' ? 'solid' : 'soft'"
    :icon="icon"
    :loading="p.phase === 'dispatching' || p.phase === 'running'"
    size="lg"
    @click="onClick"
  >
    {{ label }}
  </UButton>

  <UModal v-model:open="confirmOpen" title="确认全量抓取？" :description="`本次会消耗 ${cost} 次 SerpApi 额度（上次抓取后剩余 ${run.quota?.left ?? '?'} 次），抓完自动重新部署，约 4–6 分钟。`">
    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-key-round" @click="confirmOpen = false; tokenOpen = true">
          换 token
        </UButton>
        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" @click="confirmOpen = false">取消</UButton>
          <UButton icon="i-lucide-play" @click="confirmOpen = false; start()">开始</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup name="FetchButton" lang="ts">
import type { RunFile } from '~/types/flyhome'
import type { RunProgress } from '~/composables/useGithubActions'

defineProps<{ run: RunFile }>()

const { tokenOpen, withToken, runWorkflow } = useGithubActions()
const toast = useToast()
const confirmOpen = ref(false)
const p = reactive<RunProgress>({ phase: 'idle', status: '', runUrl: '' })

const cost = config.arrivalGroups.length * scheduledPairCount()

const label = computed(() => ({
  idle: '抓取最新价格',
  dispatching: '正在触发…',
  running: p.status || '抓取中…',
  done: '已更新，点此刷新',
  failed: '失败，重试',
}[p.phase]))

const icon = computed(() => ({
  idle: 'i-lucide-cloud-download',
  dispatching: 'i-lucide-loader',
  running: 'i-lucide-loader',
  done: 'i-lucide-refresh-cw',
  failed: 'i-lucide-triangle-alert',
}[p.phase]))

function onClick() {
  if (p.phase === 'done') return location.reload()
  if (p.phase === 'dispatching' || p.phase === 'running') return
  withToken(() => { confirmOpen.value = true })
}

async function start() {
  try {
    const conclusion = await runWorkflow({}, p)
    if (conclusion === 'success') {
      toast.add({ title: '抓取完成，站点已重新部署', description: '刷新页面查看最新价格。', color: 'success' })
    } else {
      toast.add({ title: `流程结束：${conclusion}`, description: '通常是额度不够被跳过，或抓取报错；点开 Actions 看日志。', color: 'warning', actions: [{ label: '查看 Actions', to: p.runUrl, target: '_blank' }] })
    }
  } catch (err) {
    p.phase = 'failed'
    toast.add({ title: '触发失败', description: (err as Error).message, color: 'error' })
  }
}
</script>
