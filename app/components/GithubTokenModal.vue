<template>
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
        <UInput v-model="draft" type="password" placeholder="github_pat_…" class="w-full" autocomplete="off" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="tokenOpen = false">取消</UButton>
        <UButton :disabled="!draft.trim()" @click="save">保存并继续</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const { tokenOpen, tokenUrl, saveToken } = useGithubActions()
const draft = ref('')

function save() {
  saveToken(draft.value)
  draft.value = ''
}
</script>
