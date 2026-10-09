const TOKEN_KEY = 'flyhome.githubToken'
const API = `https://api.github.com/repos/${config.github.repo}`

// Module-level so every button shares one token prompt; only used inside <ClientOnly>.
const tokenOpen = ref(false)
const afterToken = ref<null | (() => void)>(null)

export type RunPhase = 'idle' | 'dispatching' | 'running' | 'done' | 'failed'

export interface RunProgress {
  phase: RunPhase
  status: string
  runUrl: string
}

export function useGithubActions() {
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) ?? '' } catch { return '' }
  }

  function saveToken(token: string) {
    try { localStorage.setItem(TOKEN_KEY, token.trim()) } catch {}
    tokenOpen.value = false
    const next = afterToken.value
    afterToken.value = null
    next?.()
  }

  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY) } catch {}
  }

  /** Runs `then` right away if a token is stored, otherwise after the user saves one. */
  function withToken(then: () => void) {
    if (getToken()) return then()
    afterToken.value = then
    tokenOpen.value = true
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
      clearToken()
      throw new Error(res.status === 401 ? 'token 无效，已清除，请重新填写' : 'token 没有这个仓库的 Actions 写权限')
    }
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    return res.status === 204 ? null : res.json()
  }

  /**
   * Dispatches the fetch workflow and follows the run it creates until it finishes.
   * The dispatch call returns nothing, so the run is located by creation time.
   */
  async function runWorkflow(inputs: Record<string, string>, progress: RunProgress) {
    progress.phase = 'dispatching'
    const since = new Date(Date.now() - 5000).toISOString()
    await gh(`/actions/workflows/${config.github.workflow}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: config.github.branch, inputs }),
    })
    progress.phase = 'running'
    progress.status = '排队中…'

    let runId: number | null = null
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, runId ? 10000 : 4000))
      if (!runId) {
        const data = await gh(`/actions/workflows/${config.github.workflow}/runs?event=workflow_dispatch&created=>${since}&per_page=1`)
        const run = data?.workflow_runs?.[0]
        if (!run) continue
        runId = run.id
        progress.runUrl = run.html_url
      }
      const run = await gh(`/actions/runs/${runId}`)
      if (run.status === 'completed') {
        progress.phase = run.conclusion === 'success' ? 'done' : 'failed'
        return run.conclusion as string
      }
      const jobs = await gh(`/actions/runs/${runId}/jobs`)
      const active = jobs?.jobs?.find((j: any) => j.status === 'in_progress')
      progress.status = active ? `${active.name === 'fetch' ? '抓取中' : '部署中'}…` : '排队中…'
    }
    progress.phase = 'failed'
    return 'timeout'
  }

  return { tokenOpen, tokenUrl: 'https://github.com/settings/personal-access-tokens/new', getToken, saveToken, withToken, runWorkflow }
}
