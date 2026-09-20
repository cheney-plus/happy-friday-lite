<template>
  <div ref="rootRef" class="office-workspace">
    <!-- 首页模式：Office 入口（复刻上游 happyoffice 首页布局） -->
    <div v-if="mode === 'home'" class="office-home-wrap">
      <div v-if="!available" class="office-unavailable">
        <p>{{ t('office.unavailable') }}</p>
        <code>npm run office:build</code>
      </div>
      <OfficeHome
        v-else
        ref="homeRef"
        @new-doc="newDoc"
        @open-local="openLocal"
        @open-recent="entry => openRecent(entry.path)"
      />
    </div>

    <!-- 编辑器模式：精简工具栏 + 编辑器视图占位区 -->
    <template v-else>
      <header class="office-toolbar">
        <button class="tb-btn" @click="goHome" :title="t('office.backHome')">
          <House :size="16" />
        </button>
        <span class="divider" />
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
      <div class="office-canvas" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, onActivated, onDeactivated, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  House, X, CircleDot, Loader2
} from 'lucide-vue-next';
import OfficeHome from './home/OfficeHome.vue';

const api = window.electronAPI;
const { t } = useI18n();

// 与 .office-toolbar 的 CSS 高度保持一致：编辑器视图摆放在工具栏以下
const TOOLBAR_HEIGHT = 44;

const rootRef = ref(null);
const homeRef = ref(null);
const available = ref(true);
const busy = ref(false);
const dirty = ref(false);
const mode = ref('home');
const currentFile = ref(null);
const currentType = ref(null);
// 用户主动回到首页时不自动恢复编辑器视图
const manualHome = ref(false);

const fileDisplay = computed(() => {
  if (!currentFile.value) return currentType.value ? t(`office.${currentType.value}`) : '';
  return currentFile.value.split('/').pop().split('\\').pop();
});

function refreshHome() {
  homeRef.value?.refresh();
}

/** 同步编辑器视图边界：内容区内、工具栏以下（TabBar/Sidebar 保持可交互） */
async function syncBounds() {
  if (!api) return;
  await nextTick();
  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  try {
    await api.invoke('office-set-content-bounds', {
      x: rect.left,
      y: rect.top + TOOLBAR_HEIGHT,
      width: rect.width,
      height: Math.max(0, rect.height - TOOLBAR_HEIGHT),
    });
  } catch { /* ignore */ }
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

async function newDoc(type) {
  if (!api || busy.value) return;
  busy.value = true;
  try {
    await syncBounds();
    const res = await api.invoke('office-new', { type });
    if (res && res.success) {
      manualHome.value = false;
      mode.value = 'editor';
      currentType.value = type;
      currentFile.value = null;
      dirty.value = false;
    }
  } finally {
    busy.value = false;
  }
}

async function openRecent(filePath) {
  if (!api || busy.value) return;
  busy.value = true;
  try {
    await syncBounds();
    const res = await api.invoke('office-open-file', { filePath });
    if (res && res.success) {
      manualHome.value = false;
      mode.value = 'editor';
      currentType.value = res.type;
      currentFile.value = res.filePath;
      dirty.value = false;
    }
  } finally {
    busy.value = false;
  }
}

async function openLocal() {
  if (!api || busy.value) return;
  busy.value = true;
  try {
    await syncBounds();
    const res = await api.invoke('office-open-dialog');
    if (res && res.success) {
      manualHome.value = false;
      mode.value = 'editor';
      currentType.value = res.type;
      currentFile.value = res.filePath;
      dirty.value = false;
    } else {
      loadRecents();
    }
  } finally {
    busy.value = false;
  }
}

function goHome() {
  manualHome.value = true;
  mode.value = 'home';
  if (api) {
    try { api.invoke('office-hide-all'); } catch { /* ignore */ }
  }
  refreshHome();
}

async function closeActive() {
  if (!api || !currentType.value || busy.value) return;
  busy.value = true;
  try {
    const proceed = await api.invoke('office-close', { type: currentType.value });
    if (proceed) {
      manualHome.value = false;
      mode.value = 'home';
      currentType.value = null;
      currentFile.value = null;
      dirty.value = false;
      refreshHome();
    }
  } finally {
    busy.value = false;
  }
}

let unwatchSaved = null;
let unwatchClosed = null;
let onResize = null;

onMounted(() => {
  if (!api) { available.value = false; return; }
  onResize = () => { syncBounds(); };
  window.addEventListener('resize', onResize);
  if (api.on) {
    unwatchSaved = api.on('office-file-saved', ({ filePath }) => {
      currentFile.value = filePath;
      dirty.value = false;
    });
    unwatchClosed = api.on('office-view-closed', () => {
      currentType.value = null;
      currentFile.value = null;
      dirty.value = false;
      mode.value = 'home';
      refreshHome();
    });
  }
});

onActivated(async () => {
  if (!api) return;
  await syncFromState();
  if (currentType.value && !manualHome.value) {
    // 路由回到 Office：恢复编辑器视图（先同步边界再显示）
    mode.value = 'editor';
    await syncBounds();
    try { await api.invoke('office-show', { type: currentType.value }); } catch { /* ignore */ }
  } else {
    mode.value = 'home';
  }
  refreshHome();
});

onDeactivated(() => {
  // 切换到其他 Tab：隐藏编辑器视图（不销毁），让出 TabBar/Sidebar 交互
  if (api) {
    try { api.invoke('office-hide-all'); } catch { /* ignore */ }
  }
});

onBeforeUnmount(() => {
  // 被 keep-alive 逐出时兜底隐藏
  if (api) {
    try { api.invoke('office-hide-all'); } catch { /* ignore */ }
  }
  if (onResize) window.removeEventListener('resize', onResize);
  if (unwatchSaved) unwatchSaved();
  if (unwatchClosed) unwatchClosed();
});
</script>

<style scoped lang="scss">
.office-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ---- 首页 ----

.office-home-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.office-home-wrap > :deep(.office-home),
.office-home-wrap > .office-unavailable {
  flex: 1;
  min-height: 0;
}

.divider {
  width: 1px;
  height: 18px;
  background: var(--border-color, #e5e7eb);
  margin: 0 4px;
}

// ---- 编辑器模式 ----

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
