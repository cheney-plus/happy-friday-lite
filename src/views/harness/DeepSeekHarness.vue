<template>
  <section class="harness-view">
    <iframe
      v-if="status.status === 'ready' && status.url"
      :key="frameKey"
      :src="status.url"
      class="harness-frame"
      :title="t('harness.title')"
      allow="clipboard-read; clipboard-write"
    ></iframe>

    <div v-else class="harness-state">
      <div v-if="status.status === 'starting' || status.status === 'idle'" class="state-content">
        <LoaderCircle class="state-spinner" :size="30" :stroke-width="1.8" />
        <h1>{{ t('harness.starting') }}</h1>
        <p>{{ t('harness.startingDetail') }}</p>
      </div>

      <div v-else-if="status.status === 'config-required'" class="state-content">
        <Settings :size="32" :stroke-width="1.5" />
        <h1>{{ t('harness.modelRequired') }}</h1>
        <p>{{ t('harness.modelRequiredDetail') }}</p>
        <button class="command-button" @click="openModelSettings">
          <Settings :size="16" :stroke-width="1.8" />
          {{ t('harness.openSettings') }}
        </button>
      </div>

      <div v-else class="state-content">
        <CircleAlert :size="32" :stroke-width="1.5" />
        <h1>{{ t('harness.startFailed') }}</h1>
        <p class="error-message">{{ status.error || t('harness.unknownError') }}</p>
        <button class="command-button" @click="restartHarness">
          <RotateCcw :size="16" :stroke-width="1.8" />
          {{ t('harness.retry') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onActivated, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  CircleAlert,
  LoaderCircle,
  RotateCcw,
  Settings
} from 'lucide-vue-next'
import { electronService } from '@/services/electron'

const { t } = useI18n()
const router = useRouter()
const frameKey = ref(0)
const status = ref({
  status: 'idle',
  url: null,
  model: null,
  toolCount: 0,
  error: null
})

let unlistenStatus = null
let statusSyncPromise = null

async function startHarness() {
  status.value = { ...status.value, status: 'starting', error: null }
  const next = await electronService.invoke('harness-start')
  if (next) status.value = next
}

function syncHarnessStatus() {
  if (statusSyncPromise) return statusSyncPromise

  statusSyncPromise = (async () => {
    const current = await electronService.invoke('harness-status')
    if (current) status.value = current

    // The sidecar survives route changes. Start it only when it is not running,
    // so returning to this view does not temporarily remove the ready iframe.
    if (!current || current.status === 'idle') await startHarness()
  })().finally(() => {
    statusSyncPromise = null
  })

  return statusSyncPromise
}

async function restartHarness() {
  status.value = { ...status.value, status: 'starting', error: null }
  const next = await electronService.invoke('harness-restart')
  if (next) {
    status.value = next
    frameKey.value += 1
  }
}

function openModelSettings() {
  router.push('/settings/model')
}

onMounted(() => {
  unlistenStatus = electronService.listen('harness-status-changed', event => {
    status.value = event.payload
  })
  syncHarnessStatus()
})

onActivated(() => {
  syncHarnessStatus()
})

onUnmounted(() => {
  if (unlistenStatus) unlistenStatus()
})
</script>

<style scoped>
.harness-view {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

.harness-frame {
  display: block;
  width: 100%;
  flex: 1;
  min-height: 0;
  border: 0;
  background: #fff;
}

.harness-state {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
}

.state-content {
  width: min(460px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--text-secondary);
}

.state-content h1 {
  margin: 16px 0 8px;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0;
}

.state-content p {
  margin: 0;
  max-width: 420px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.65;
}

.state-spinner {
  animation: harness-spin 0.9s linear infinite;
}

.error-message {
  overflow-wrap: anywhere;
}

.command-button {
  min-height: 34px;
  margin-top: 18px;
  padding: 7px 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  font-size: 13px;
  cursor: pointer;
}

.command-button:hover {
  background: var(--bg-hover);
}

@keyframes harness-spin {
  to { transform: rotate(360deg); }
}

</style>
