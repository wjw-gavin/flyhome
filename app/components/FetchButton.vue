<template>
  <UButton
    :color="phase === 'done' ? 'success' : 'primary'"
    :variant="phase === 'idle' ? 'solid' : 'soft'"
    :icon="icon"
    :loading="phase === 'dispatching' || phase === 'running'"
    size="lg"
    @click="onClick"
  >
    {{ label }}
  </UButton>

  <UModal v-model:open="tokenOpen" title="需要一个 GitHub token" description="token 只存在这台浏览器里，用来触发仓库的抓取流程。">
    <template #body>
      <div class="space-y-3 text-sm">
        <ol class="list-decimal space-y-1 pl-5 text-muted">
          <li>
            打开
            <ULink :to="tokenUrl" target="_blank" class="text-primary">GitHub → Fine-grained tokens</ULink>
            ，Repository access 只选 <code class="rounded bg-elevated px-1">{{ config.github.repo }}</code>
          </li>
          <li>Permissions → Repository → <b>Actions: Read and write</b>，其他不用</li>
          <li>生成后粘贴到下面</li>
        </ol>
        <UInput v-model="tokenDraft" type="password" placeholder="github_pat_…" class="w-full" autocomplete="off" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="tokenOpen = false">取消</UButton>
        <UButton :disabled="!tokenDraft.trim()" @click="saveToken">保存并开始抓取</UButton>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="confirmOpen" title="确认抓取？" :description="`本次会消耗 ${cost} 次 SerpApi 额度（上次抓取后剩余 ${run.quota?.left ?? '?'} 次），抓完自动重新部署，约 3–5 分钟。`">
    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-key-round" @click="confirmOpen = false; tokenOpen = true">
          换 token
        </UButton>
        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" @click="confirmOpen = false">取消</UButton>
          <UButton icon="i-lucide-play" @click="confirmOpen = false; dispatch()">开始</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { RunFile } from '~/types/flyhome'

const props = defineProps<{ run: RunFile }>()

const TOKEN_KEY = 'flyhome.githubToken'
const API = `https://api.github.com/repos/${config.github.repo}`
const tokenUrl = `https://github.com/settings/personal-access-tokens/new`

type Phase = 'idle' | 'dispatching' | 'running' | 'done' | 'failed'
const phase = ref<Phase>('idle')
const status = ref('')
const runUrl = ref('')
const tokenOpen = ref(false)
const confirmOpen = ref(false)
const tokenDraft = ref('')
const toast = useToast()

const pairs = Math.floor((config.trip.toDays - config.trip.fromDays) / config.trip.stepDays) + 1
const cost = config.arrivalGroups.length * pairs

const label = computed(() => ({
  idle: '抓取最新价格',
  dispatching: '正在触发…',
  running: status.value || '抓取中…',
  done: '已更新，点此刷新',
  failed: '失败，重试',
}[phase.value]))

const icon = computed(() => ({
  idle: 'i-lucide-cloud-download',
  dispatching: 'i-lucide-loader',
  running: 'i-lucide-loader',
  done: 'i-lucide-refresh-cw',
  failed: 'i-lucide-triangle-alert',
}[phase.value]))

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) ?? '' } catch { return '' }
}

function onClick() {
  if (phase.value === 'done') return location.reload()
  if (phase.value === 'dispatching' || phase.value === 'running') return
  if (!getToken()) { tokenOpen.value = true; return }
  confirmOpen.value = true
}

function saveToken() {
  try { localStorage.setItem(TOKEN_KEY, tokenDraft.value.trim()) } catch {}
  tokenDraft.value = ''
  tokenOpen.value = false
  confirmOpen.value = true
}

async function gh(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${getToken()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  })
  if (res.status === 401 || res.status === 403) {
    try { localStorage.removeItem(TOKEN_KEY) } catch {}
    throw new Error(res.status === 401 ? 'token 无效，已清除，请重新填写' : 'token 没有这个仓库的 Actions 写权限')
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  return res.status === 204 ? null : res.json()
}

async function dispatch() {
  phase.value = 'dispatching'
  const since = new Date(Date.now() - 5000).toISOString()
  try {
    await gh(`/actions/workflows/${config.github.workflow}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: config.github.branch }),
    })
    phase.value = 'running'
    status.value = '排队中…'
    await poll(since)
  } catch (err) {
    phase.value = 'failed'
    toast.add({ title: '触发失败', description: (err as Error).message, color: 'error' })
  }
}

// The dispatch call returns nothing, so find the run it created by creation time, then follow it.
async function poll(since: string) {
  let runId: number | null = null
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, runId ? 10000 : 4000))
    if (!runId) {
      const data = await gh(`/actions/workflows/${config.github.workflow}/runs?event=workflow_dispatch&created=>${since}&per_page=1`)
      const run = data?.workflow_runs?.[0]
      if (!run) continue
      runId = run.id
      runUrl.value = run.html_url
    }
    const run = await gh(`/actions/runs/${runId}`)
    if (run.status === 'completed') {
      if (run.conclusion === 'success') {
        phase.value = 'done'
        toast.add({ title: '抓取完成，站点已重新部署', description: '刷新页面查看最新价格。', color: 'success' })
      } else {
        phase.value = 'failed'
        toast.add({ title: `流程结束：${run.conclusion}`, description: '通常是额度不够被跳过，或抓取报错；点开 Actions 看日志。', color: 'warning', actions: [{ label: '查看 Actions', to: runUrl.value, target: '_blank' }] })
      }
      return
    }
    const jobs = await gh(`/actions/runs/${runId}/jobs`)
    const active = jobs?.jobs?.find((j: any) => j.status === 'in_progress')
    status.value = active ? `${active.name === 'fetch' ? '抓取中' : '部署中'}…` : '排队中…'
  }
  phase.value = 'failed'
  toast.add({ title: '等太久了', description: '流程还没结束，去 Actions 页看看。', color: 'warning' })
}
</script>
