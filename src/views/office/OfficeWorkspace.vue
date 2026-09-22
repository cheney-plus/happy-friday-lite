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

    <!-- 编辑器 Tab（/office/:editor/:instId）：原生编辑器视图占位区（由主进程全区域摆放，关闭 Tab 时自动保存） -->
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
// /office 为首页 Tab；/office/<type>/<instId> 为对应编辑器视图的独立 Tab，
// instId 与主进程 office-host 的 viewId（<type>-<instId>）一一对应
const routeEditor = EDITOR_TYPES.includes(route.params.editor) ? route.params.editor : null;
const isHomeRoute = !routeEditor;
const viewId = routeEditor ? `${routeEditor}-${route.params.instId}` : null;
const editorTabId = viewId ? `office-${viewId}` : null;

const rootRef = ref(null);
const homeRef = ref(null);
const available = ref(true);
// 防止打开/新建动作重入（编辑器 Tab 无内置工具栏 UI）
const busy = ref(false);
const currentFile = ref(null);
// 本实例对应的路由路径（实例生命周期内恒定）。keep-alive 失活实例的 DOM 会被移入
// 分离容器（尺寸变为 0），其 ResizeObserver/resize/layout-sync 触发的边界推送会以
// 0×0 覆盖主进程布局、把正在显示的编辑器视图打没（表现为 Tab 切换后页面空白），
// 因此只有当前路由匹配的活跃实例才允许推送边界。
const ownPath = route.path;

function baseName(p) {
  return p.split('/').pop().split('\\').pop();
}

/** viewId（docs-3）→ 编辑器路由（/office/docs/3） */
function officeEditorPath(vid) {
  return `/office/${String(vid).replace('-', '/')}`;
}

function refreshHome() {
  homeRef.value?.refresh();
}

function setTabTitle(title) {
  if (editorTabId) tabStore.updateTabTitle(editorTabId, title || '');
}

function setTabFile(filePath) {
  if (editorTabId) tabStore.updateTabFilePath(editorTabId, filePath);
}

// ---- 首页 Tab：打开/新建（先建视图拿到 viewId，再跳转对应编辑器 Tab） -------

async function openEditorTab(type, filePath = null) {
  if (!api || busy.value || !EDITOR_TYPES.includes(type)) return;
  busy.value = true;
  try {
    const res = filePath
      ? await api.invoke('office-open-file', { filePath })
      : await api.invoke('office-new', { type });
    if (res && res.success && res.viewId) {
      await router.push(officeEditorPath(res.viewId));
    } else {
      refreshHome();
    }
  } catch {
    refreshHome();
  } finally {
    busy.value = false;
  }
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
    // 对话框选择后在主进程直接建视图，结果携带 viewId
    const res = await api.invoke('office-open-dialog');
    if (res && res.success && res.viewId) {
      await router.push(officeEditorPath(res.viewId));
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
  // 失活实例不推送（其 DOM 已移入 keep-alive 分离容器，测得 0×0）
  if (route.path !== ownPath) return;
  await nextTick();
  const el = rootRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  // 零尺寸（尚未布局/被隐藏）不推送，避免覆盖主进程的有效边界
  if (rect.width <= 0 || rect.height <= 0) return;
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
    return (list || []).find(s => s.viewId === viewId) || null;
  } catch {
    return null;
  }
}

async function openFileInEditor(filePath) {
  busy.value = true;
  try {
    await syncBounds();
    const res = await api.invoke('office-open-file', { filePath, viewId });
    if (res && res.success) {
      if (res.viewId && res.viewId !== viewId) {
        // 主进程去重后复用了已有视图：跳转到其实际所属 Tab
        await router.replace(officeEditorPath(res.viewId));
        return;
      }
      currentFile.value = res.filePath;
      setTabTitle(baseName(res.filePath));
      setTabFile(res.filePath);
    }
  } finally {
    busy.value = false;
  }
}

async function createBlankDoc() {
  busy.value = true;
  try {
    await syncBounds();
    const res = await api.invoke('office-new', { type: routeEditor, viewId });
    if (res && res.success) {
      if (res.viewId && res.viewId !== viewId) {
        await router.replace(officeEditorPath(res.viewId));
        return;
      }
      // sheets 新建会由主进程落盘空白工作簿文件并排队打开，
      // 随后 office-file-saved 事件会再以最终路径刷新一次
      currentFile.value = res.filePath ?? null;
      if (res.filePath) {
        setTabTitle(baseName(res.filePath));
        setTabFile(res.filePath);
      } else {
        setTabTitle('');
      }
    }
  } finally {
    busy.value = false;
  }
}

/** 恢复显示本 Tab 对应的编辑器视图（Tab 切回时视图仍在） */
async function showOpenEditor() {
  const st = await fetchEditorState();
  if (!st || !st.open) return false;
  currentFile.value = st.filePath;
  await syncBounds();
  try { await api.invoke('office-show', { viewId }); } catch { /* ignore */ }
  return true;
}

/** 编辑器 Tab 激活入口：恢复显示视图；视图丢失（重启/崩溃）则按原文件重开或新建空白 */
async function activateEditor() {
  if (!api || busy.value) return;
  if (await showOpenEditor()) return;
  const tab = tabStore.openedTabs.find(tb => tb.id === editorTabId);
  if (tab?.officeFilePath) {
    await openFileInEditor(tab.officeFilePath);
    return;
  }
  await createBlankDoc();
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
    unwatchSaved = api.on('office-file-saved', ({ viewId: savedViewId, filePath }) => {
      if (!viewId || savedViewId !== viewId || !filePath) return;
      currentFile.value = filePath;
      setTabTitle(baseName(filePath));
      setTabFile(filePath);
    });
    unwatchClosed = api.on('office-view-closed', ({ viewId: closedViewId }) => {
      if (!viewId || closedViewId !== viewId) return;
      // 视图被主进程关闭（崩溃等）；Tab 激活时会按原文件恢复或新建空白
      currentFile.value = null;
      setTabTitle('');
    });
  }
  if (routeEditor) {
    // 首次进入编辑器 Tab：恢复显示/按原文件重开/新建空白
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

/** 切换目标是否为另一个编辑器 Tab（/office/<type>/<instId>，由其 office-show 自行管理视图可见性） */
function targetIsEditorTab() {
  return EDITOR_TYPES.includes(route.path.split('/')[2]);
}

onDeactivated(() => {
  // 切换到其他 Tab：隐藏编辑器视图（不销毁），让出 TabBar/Sidebar 交互。
  // 注意：keep-alive 切换时旧实例 deactivated 晚于新实例 activated，
  // 若目标是另一个编辑器 Tab，新实例刚通过 office-show 显示了视图，
  // 此处不能再 hide-all，否则会把新 Tab 的视图藏掉导致页面空白。
  if (api && !targetIsEditorTab()) {
    try { api.invoke('office-hide-all'); } catch { /* ignore */ }
  }
});

onBeforeUnmount(() => {
  // 被 keep-alive 逐出时兜底隐藏（同样避免干扰仍活跃的编辑器 Tab）
  if (api && !targetIsEditorTab()) {
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
