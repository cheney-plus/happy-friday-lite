<template>
  <div class="office-workspace">
    <header ref="toolbarRef" class="office-toolbar">
      <button class="tb-btn back" @click="goBack" :title="t('office.backToKnowledge')">
        <ArrowLeft :size="16" />
      </button>
      <span class="divider" />
      <button class="tb-btn" @click="newDoc('docs')" :title="t('office.newDoc')">
        <FileText :size="16" /><span>{{ t('office.docs') }}</span>
      </button>
      <button class="tb-btn" @click="newDoc('sheets')" :title="t('office.newSheet')">
        <FileSpreadsheet :size="16" /><span>{{ t('office.sheets') }}</span>
      </button>
      <button class="tb-btn" @click="newDoc('slides')" :title="t('office.newSlides')">
        <Presentation :size="16" /><span>{{ t('office.slides') }}</span>
      </button>
      <span class="flex-1" />
      <span class="file-name" :title="currentFile || ''">
        <Loader2 v-if="busy" :size="14" class="spin" />
        <CircleDot v-else-if="dirty" :size="14" class="dirty-dot" />
        {{ fileDisplay }}
      </span>
      <span class="flex-1" />
      <button class="tb-btn danger" @click="closeActive" :title="t('office.closeFile')">
        <X :size="16" /><span>{{ t('office.close') }}</span>
      </button>
    </header>
    <div class="office-canvas">
      <div v-if="!available" class="office-unavailable">
        <p>{{ t('office.unavailable') }}</p>
        <code>npm run office:build</code>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ArrowLeft, FileText, FileSpreadsheet, Presentation, X, CircleDot, Loader2
} from 'lucide-vue-next';

const api = window.electronAPI;
const router = useRouter();
const { t } = useI18n();

const toolbarRef = ref(null);
const available = ref(true);
const busy = ref(false);
const dirty = ref(false);
const currentFile = ref(null);
const currentType = ref(null);

const fileDisplay = computed(() => {
  if (!currentFile.value) return currentType.value ? t(`office.${currentType.value}`) : '';
  return currentFile.value.split('/').pop().split('\\').pop();
});

function goBack() {
  router.push('/knowledge');
}

async function newDoc(type) {
  if (!api || busy.value) return;
  busy.value = true;
  try {
    const res = await api.invoke('office-new', { type });
    if (res && res.success) {
      currentType.value = type;
      currentFile.value = null;
      dirty.value = false;
    }
  } finally {
    busy.value = false;
  }
}

async function closeActive() {
  if (!api || !currentType.value || busy.value) return;
  busy.value = true;
  try {
    const proceed = await api.invoke('office-close', { type: currentType.value });
    if (proceed) {
      currentType.value = null;
      currentFile.value = null;
      dirty.value = false;
    }
  } finally {
    busy.value = false;
  }
}

async function syncFromState() {
  if (!api) { available.value = false; return; }
  try {
    const list = await api.invoke('office-get-state');
    const open = (list || []).find(s => s.open);
    if (open) {
      currentType.value = open.type;
      currentFile.value = open.filePath;
      dirty.value = await api.invoke('office-is-dirty', { type: open.type });
    } else {
      currentType.value = null;
      currentFile.value = null;
      dirty.value = false;
    }
  } catch (e) {
    available.value = false;
  }
}

let unwatchSaved = null;
let unwatchClosed = null;

onMounted(async () => {
  if (!api) { available.value = false; return; }
  await nextTick();
  // 主进程按工具栏实际高度摆放编辑器视图
  const h = toolbarRef.value ? toolbarRef.value.offsetHeight : 44;
  try { await api.invoke('office-set-toolbar-height', { height: h }); } catch { /* ignore */ }

  try {
    await api.invoke('office-hide-all');
    // 路由回到 Office 时恢复已打开的编辑器视图
    const list = await api.invoke('office-get-state');
    const open = (list || []).find(s => s.open);
    if (open) await api.invoke('office-show', { type: open.type });
  } catch { /* ignore */ }

  await syncFromState();

  if (api.on) {
    unwatchSaved = api.on('office-file-saved', ({ filePath }) => {
      currentFile.value = filePath;
      dirty.value = false;
    });
    unwatchClosed = api.on('office-view-closed', () => {
      currentType.value = null;
      currentFile.value = null;
      dirty.value = false;
    });
  }
});

onBeforeUnmount(() => {
  // 离开 Office 工作区：隐藏编辑器视图（不销毁），恢复产品导航
  if (api) {
    try { api.invoke('office-hide-all'); } catch { /* ignore */ }
  }
  if (unwatchSaved) unwatchSaved();
  if (unwatchClosed) unwatchClosed();
});
</script>

<style scoped lang="scss">
.office-workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.office-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background: var(--bg-secondary, #f9fafb);
  flex-shrink: 0;
}

.tb-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary, #374151);
  cursor: pointer;
  font-size: 12px;

  &:hover { background: var(--bg-tertiary, #eceff3); }
  &.danger:hover { background: #fee2e2; color: #dc2626; }
}

.divider {
  width: 1px;
  height: 18px;
  background: var(--border-color, #e5e7eb);
  margin: 0 4px;
}

.flex-1 { flex: 1; }

.file-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 40vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
}

.dirty-dot { color: #f59e0b; }

.spin { animation: office-spin 1s linear infinite; }
@keyframes office-spin { to { transform: rotate(360deg); } }

.office-canvas {
  flex: 1;
  position: relative;
  background: #ffffff;
}

.office-unavailable {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  color: var(--text-secondary, #6b7280);

  code {
    background: var(--bg-tertiary, #f3f4f6);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
  }
}
</style>
