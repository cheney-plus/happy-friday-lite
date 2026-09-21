<template>
  <div ref="rootRef" class="office-workspace">
    <div v-if="!available" class="office-unavailable">
      <p>{{ t('office.unavailable') }}</p>
      <code>npm run office:build</code>
    </div>

    <!-- 首页 Tab（/office）：Office 入口（复刻上游 happyoffice 首页布局） -->
    <div v-else-if="isHomeRoute" class="office-home-wrap">
      <OfficeHome
        ref="homeRef"
        @new-doc="handleNewDoc"
        @open-local="handleOpenLocal"
        @open-recent="handleOpenRecent"
      />
    </div>

    <!-- 编辑器 Tab（/office/:editor）：原生编辑器视图占位区（由主进程全区域摆放，关闭 Tab 时自动保存） -->
    <div v-else class="office-canvas" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onActivated, onDeactivated, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useFridayStore, useTabStore } from '@/store';
import { loadModelConfig } from '@/views/friday/composables/useModelCatalog';
import OfficeHome from './home/OfficeHome.vue';

const EDITOR_TYPES = ['docs', 'sheets', 'slides', 'pdf'];

const api = window.electronAPI;
const fridayStore = useFridayStore();
const tabStore = useTabStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

// 实例角色由路由决定且在实例生命周期内恒定（不同路由是不同 keep-alive 实例）：
// /office 为首页 Tab；/office/<type> 为对应编辑器独立 Tab
const routeEditor = EDITOR_TYPES.includes(route.params.editor) ? route.params.editor : null;
const isHomeRoute = !routeEditor;
const editorTabId = routeEditor ? `office-${routeEditor}` : null;

const rootRef = ref(null);
const homeRef = ref(null);
const available = ref(true);
// 防止打开/新建动作重入（编辑器 Tab 无内置工具栏 UI）
const busy = ref(false);
const currentFile = ref(null);

function baseName(p) {
  return p.split('/').pop().split('\\').pop();
}

function refreshHome() {
  homeRef.value?.refresh();
}

function setTabTitle(title) {
  if (editorTabId) tabStore.updateTabTitle(editorTabId, title || '');
}

// ---- 首页 Tab：跳转到独立编辑器 Tab ---------------------------------------

function openEditorTab(type, filePath = null) {
  if (!api || !EDITOR_TYPES.includes(type)) return;
  tabStore.pendingOfficeAction = { type, filePath };
  router.push(`/office/${type}`);
}

function handleNewDoc(type) {
  openEditorTab(type);
}

function handleOpenRecent(entry) {
  if (entry?.path) openEditorTab(entry.type, entry.path);
}

async function handleOpenLocal() {
  if (!api) return;
  try {
    const res = await api.invoke('office-open-dialog');
    if (res && res.success) {
      openEditorTab(res.type, res.filePath);
    } else {
      refreshHome();
    }
  } catch {
    refreshHome();
  }
}

// ---- 编辑器 Tab：视图边界同步 ---------------------------------------------

/** 同步编辑器视图边界：占满整个工作区（TabBar/Sidebar 保持可交互） */
async function syncBounds() {
  if (!api) return;
  await nextTick();
  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  try {
    await api.invoke('office-set-content-bounds', {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  } catch { /* ignore */ }
}

// rAF 节流的边界同步：resize 拖拽 / 最大化 / 侧栏收起等高频触发时每帧最多一次
let syncScheduled = false;
function scheduleSyncBounds() {
  if (syncScheduled) return;
  syncScheduled = true;
  requestAnimationFrame(() => {
    syncScheduled = false;
    syncBounds();
  });
}

// ---- 编辑器 Tab：打开/新建/恢复 -------------------------------------------

async function fetchEditorState() {
  try {
    const list = await api.invoke('office-get-state');
    return (list || []).find(s => s.type === routeEditor) || null;
  } catch {
    return null;
  }
}

async function openFileInEditor(filePath) {
  busy.value = true;
  try {
    await syncBounds();
    const res = await api.invoke('office-open-file', { filePath });
    if (res && res.success) {
      currentFile.value = res.filePath;
      setTabTitle(baseName(res.filePath));
    }
  } finally {
    busy.value = false;
  }
}

async function createBlankDoc() {
  busy.value = true;
  try {
    await syncBounds();
    const res = await api.invoke('office-new', { type: routeEditor });
    if (res && res.success) {
      currentFile.value = null;
      setTabTitle('');
    }
  } finally {
    busy.value = false;
  }
}

/** 恢复显示该类型的编辑器视图（Tab 切回时视图仍在） */
async function showOpenEditor() {
  const st = await fetchEditorState();
  if (!st || !st.open) return false;
  currentFile.value = st.filePath;
  await syncBounds();
  try { await api.invoke('office-show', { type: routeEditor }); } catch { /* ignore */ }
  return true;
}

/** 编辑器 Tab 激活入口：消费首页待办动作，或恢复显示/新建空白 */
async function activateEditor() {
  if (!api || busy.value) return;
  const pending = tabStore.pendingOfficeAction;
  if (pending && pending.type === routeEditor) {
    tabStore.pendingOfficeAction = null;
    if (pending.filePath) {
      await openFileInEditor(pending.filePath);
    } else {
      await createBlankDoc();
    }
    return;
  }
  const shown = await showOpenEditor();
  if (!shown) await createBlankDoc();
}

// ---- AI 模型与生命周期 -----------------------------------------------------

// 编辑器 AI 由 Friday 接管：把主窗口配置的模型推送给主进程桥接层
function pushAiModel() {
  const model = loadModelConfig();
  if (api && model) {
    api.invoke('office-set-ai-model', model).catch(() => {});
  }
}

let initialActivated = false;
let unwatchSaved = null;
let unwatchClosed = null;
let unwatchModel = null;
let onResize = null;
let resizeObserver = null;
let unwatchLayoutSync = null;

onMounted(() => {
  if (!api) { available.value = false; return; }
  onResize = () => { scheduleSyncBounds(); };
  window.addEventListener('resize', onResize);
  // 工作区元素尺寸因任何原因变化（窗口缩放、侧栏收起、布局调整）都重新同步视图边界
  if (rootRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleSyncBounds);
    resizeObserver.observe(rootRef.value);
  }
  pushAiModel();
  unwatchModel = watch(() => fridayStore.modelId, pushAiModel);
  unwatchLayoutSync = api.on?.('office-layout-sync', () => { syncBounds(); });
  if (api.on) {
    unwatchSaved = api.on('office-file-saved', ({ type, filePath }) => {
      if (type !== routeEditor || !filePath) return;
      currentFile.value = filePath;
      setTabTitle(baseName(filePath));
    });
    unwatchClosed = api.on('office-view-closed', ({ type }) => {
      if (type !== routeEditor) return;
      // 视图被主进程关闭（如切换文件的中途状态）；随后由 opened/激活流程刷新
      currentFile.value = null;
      setTabTitle('');
    });
  }
  if (routeEditor) {
    // 首次进入编辑器 Tab：消费待办动作或恢复/新建
    activateEditor().finally(() => { initialActivated = true; });
  }
});

onActivated(() => {
  if (!api) return;
  pushAiModel();
  if (isHomeRoute) {
    refreshHome();
    return;
  }
  // 首次挂载由 onMounted 处理，避免重复触发打开/新建
  if (initialActivated) activateEditor();
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
  if (resizeObserver) resizeObserver.disconnect();
  if (unwatchSaved) unwatchSaved();
  if (unwatchClosed) unwatchClosed();
  if (unwatchModel) unwatchModel();
  if (unwatchLayoutSync) unwatchLayoutSync();
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

.office-home-wrap > :deep(.office-home) {
  flex: 1;
  min-height: 0;
}

// ---- 编辑器模式 ----

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
