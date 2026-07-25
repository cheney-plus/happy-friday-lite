<template>
  <div class="knowledge-base">
    <KbSidebar
      :collapsed="sidebarCollapsed"
      :is-resizing="isResizing"
      :sidebar-width="sidebarWidth"
      :search-mode="searchMode"
      :search-query="searchQuery"
      :filtered-categories="filteredCategories"
      :selected-k-b="selectedKB"
      :search-input-ref="searchInputRef"
      @toggle-sidebar="toggleSidebar"
      @enter-search="enterSearchMode"
      @exit-search="exitSearchMode"
      @update:search-query="searchQuery = $event"
      @toggle-category="toggleCategory"
      @add-kb="addKnowledgeBase"
      @select-kb="selectKnowledgeBase"
      @show-context-menu="showContextMenu"
      @open-agent-dir="openAgentDir"
    />

    <div
      v-if="!sidebarCollapsed"
      class="sidebar-resize-handle"
      @mousedown="onResizeStart"
    ></div>

    <button
      v-if="sidebarCollapsed"
      class="sidebar-expand-btn"
      @click="toggleSidebar"
      title="展开侧边栏"
    >
      <SidebarIcon />
    </button>

    <KbMainContent
      :selected-k-b="selectedKB"
      :current-title="currentTitle"
      :current-category-id="currentCategoryId"
      :can-go-back="canGoBack"
      :can-go-forward="canGoForward"
      :path-segments="pathSegments"
      :files="files"
      :current-path="currentPath"
      @go-back="goBack"
      @go-forward="goForward"
      @navigate-to-segment="navigateToSegment"
      @refresh="refreshCurrentDir"
      @show-file-context-menu="showFileContextMenu"
      @show-file-item-context-menu="showFileItemContextMenu"
      @open-file="openFile"
      @open-search-result="handleOpenSearchResult"
    />

    <!-- 知识库右键菜单 -->
    <KbContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @close="hideContextMenu"
    >
      <div class="context-menu-item" @mousedown="handleEditKB">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>编辑</span>
      </div>
      <div v-if="!contextMenu.item?.protected" class="context-menu-item danger" @mousedown="handleDeleteKB">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        <span>删除</span>
      </div>
    </KbContextMenu>

    <!-- 文件区域右键菜单 -->
    <KbContextMenu
      :visible="fileContextMenu.visible"
      :x="fileContextMenu.x"
      :y="fileContextMenu.y"
      @close="hideFileContextMenu"
    >
      <div class="context-menu-item" @mousedown="openNewFolderDialog">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          <line x1="12" y1="11" x2="12" y2="17"></line>
          <line x1="9" y1="14" x2="15" y2="14"></line>
        </svg>
        <span>新建文件夹</span>
      </div>
      <div class="context-menu-item" @mousedown="openInFinder">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>打开本地文件夹</span>
      </div>
    </KbContextMenu>

    <!-- 文件/文件夹右键菜单 -->
    <KbContextMenu
      :visible="fileItemContextMenu.visible"
      :x="fileItemContextMenu.x"
      :y="fileItemContextMenu.y"
      @close="hideFileItemContextMenu"
    >
      <div
        v-if="canBuildIndex(fileItemContextMenu.item)"
        class="context-menu-item"
        @mousedown="handleBuildIndex"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
        <span>构建索引</span>
      </div>
      <div class="context-menu-item" @mousedown="handleRenameFile">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>重命名</span>
      </div>
      <div class="context-menu-item danger" @mousedown="handleDeleteFile">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        <span>删除</span>
      </div>
    </KbContextMenu>

    <!-- 新建文件夹对话框 -->
    <NewFolderDialog
      :visible="showNewFolderDialog"
      :folder-name="newFolderName"
      :input-ref="newFolderInputRef"
      @close="closeNewFolderDialog"
      @confirm="confirmNewFolder"
      @update:folder-name="newFolderName = $event"
    />

    <!-- 重命名对话框 -->
    <NewFolderDialog
      :visible="showRenameDialog"
      :folder-name="renameName"
      :input-ref="renameInputRef"
      title="重命名"
      placeholder="请输入新名称"
      @close="closeRenameDialog"
      @confirm="confirmRename"
      @update:folder-name="renameName = $event"
    />

    <!-- 创建/编辑知识库对话框 -->
    <CreateKbDialog
      :visible="showCreateDialog"
      :is-editing="!!editingKBId"
      :category-name="currentCategoryName"
      :form="newKB"
      :name-input-ref="kbNameInputRef"
      @close="closeCreateDialog"
      @confirm="confirmCreateKB"
      @update:form="Object.assign(newKB, $event)"
      @select-cover="selectCover"
    />

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      :visible="showDeleteConfirm"
      :message="deleteConfirmMessage"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- 构建索引进度弹窗 -->
    <div v-if="buildIndexState.visible" class="build-index-overlay">
      <div class="build-index-modal">
        <div class="build-index-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
          </svg>
          <span>构建索引</span>
        </div>
        <div class="build-index-body">
          <div class="build-index-file" :title="buildIndexState.fileName">{{ buildIndexState.fileName }}</div>
          <div class="build-index-status" :class="buildIndexState.status">
            <span v-if="buildIndexState.status === 'processing'" class="loading-dot"></span>
            {{ buildIndexStatusText }}
          </div>
          <div v-if="buildIndexState.phase === 'embedding' && buildIndexState.totalChunks > 0" class="build-index-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: buildIndexProgressPercent + '%' }"></div>
            </div>
            <div class="progress-text">{{ buildIndexState.currentChunk }}/{{ buildIndexState.totalChunks }}</div>
          </div>
        </div>
        <div class="build-index-footer">
          <button
            v-if="buildIndexState.status === 'processing'"
            class="btn-stop"
            @click="handleStopBuildIndex"
          >停止</button>
          <button
            v-else
            class="btn-close"
            @click="handleCloseBuildIndex"
          >关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
import { SidebarIcon } from './components/icons';
import KbSidebar from './components/KbSidebar.vue';
import KbMainContent from './components/KbMainContent.vue';
import KbContextMenu from './components/KbContextMenu.vue';
import NewFolderDialog from './components/NewFolderDialog.vue';
import CreateKbDialog from './components/CreateKbDialog.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import { electronService } from '@/services/electron';
import { useSidebar } from './composables/useSidebar';
import { useFileSystem } from './composables/useFileSystem';
import { useKnowledgeBase } from './composables/useKnowledgeBase';
import { useContextMenu } from './composables/useContextMenu';

const showDeleteConfirm = ref(false);
const deleteConfirmMessage = ref('');
const pendingDeleteItem = ref(null);
const pendingDeleteCategoryId = ref('');
const pendingDeleteFile = ref(null);

// 构建索引进度弹窗状态
const buildIndexState = reactive({
  visible: false,
  fileName: '',
  filePath: '',
  phase: '',         // start / loading / chunking / embedding / done / cancelled / failed
  currentChunk: 0,
  totalChunks: 0,
  status: ''         // processing / success / cancelled / failed
});

const buildIndexStatusText = computed(() => {
  switch (buildIndexState.phase) {
    case 'start': return '准备中...';
    case 'loading': return '加载文档中...';
    case 'chunking': return '文档分块中...';
    case 'embedding': return '向量化中...';
    case 'done': return '索引完成';
    case 'cancelled': return '已停止，索引已清理';
    case 'failed': return '索引失败';
    default: return '处理中...';
  }
});

const buildIndexProgressPercent = computed(() => {
  if (buildIndexState.totalChunks === 0) return 0;
  return Math.round((buildIndexState.currentChunk / buildIndexState.totalChunks) * 100);
});

const sidebar = useSidebar();

const {
  sidebarCollapsed,
  sidebarWidth,
  isResizing,
  searchMode,
  searchQuery,
  searchInputRef,
  toggleSidebar,
  onResizeStart,
  enterSearchMode,
  exitSearchMode
} = sidebar;

const fileSystem = useFileSystem();

const {
  files,
  showNewFolderDialog,
  newFolderName,
  newFolderInputRef,
  showRenameDialog,
  renameName,
  renameInputRef,
  canGoBack,
  canGoForward,
  pathSegments,
  loadDataDir,
  goBack,
  goForward,
  navigateToSegment,
  openFile,
  openSearchResult,
  refreshCurrentDir,
  openNewFolderDialog,
  closeNewFolderDialog,
  confirmNewFolder,
  openRenameDialog,
  closeRenameDialog,
  confirmRename,
  deleteFileOrFolder
} = fileSystem;

const currentPath = computed(() => fileSystem.currentPath.value);

const {
  selectedKB,
  currentTitle,
  currentCategoryId,
  filteredCategories,
  showCreateDialog,
  currentCategoryName,
  kbNameInputRef,
  editingKBId,
  newKB,
  loadCategoriesFromDisk,
  toggleCategory,
  selectKnowledgeBase,
  addKnowledgeBase,
  selectCover,
  closeCreateDialog,
  confirmCreateKB,
  editKnowledgeBase,
  deleteKnowledgeBase
} = useKnowledgeBase(fileSystem, sidebar);

const {
  contextMenu,
  fileContextMenu,
  fileItemContextMenu,
  showContextMenu,
  hideContextMenu,
  showFileContextMenu,
  hideFileContextMenu,
  showFileItemContextMenu,
  hideFileItemContextMenu
} = useContextMenu();

function handleEditKB() {
  const item = contextMenu.item;
  const categoryId = contextMenu.categoryId;
  hideContextMenu();
  editKnowledgeBase({ item, categoryId });
}

function handleDeleteKB() {
  const item = contextMenu.item;
  const categoryId = contextMenu.categoryId;
  hideContextMenu();
  pendingDeleteItem.value = item;
  pendingDeleteCategoryId.value = categoryId;
  deleteConfirmMessage.value = `删除「${item?.name}」会导致该知识库下所有文件被删除，是否确认删除？`;
  showDeleteConfirm.value = true;
}

function confirmDelete() {
  showDeleteConfirm.value = false;

  if (pendingDeleteFile.value) {
    deleteFileOrFolder(pendingDeleteFile.value);
    pendingDeleteFile.value = null;
    return;
  }

  deleteKnowledgeBase({ item: pendingDeleteItem.value, categoryId: pendingDeleteCategoryId.value });
  pendingDeleteItem.value = null;
  pendingDeleteCategoryId.value = '';
}

function cancelDelete() {
  showDeleteConfirm.value = false;
  pendingDeleteItem.value = null;
  pendingDeleteCategoryId.value = '';
  pendingDeleteFile.value = null;
}

function handleRenameFile() {
  const item = fileItemContextMenu.item;
  hideFileItemContextMenu();
  if (item) {
    openRenameDialog(item);
  }
}

// 判断文件是否可以构建索引（非文件夹 + 非工作区）
function canBuildIndex(item) {
  return item && !item.isDirectory && currentCategoryId.value !== 'agent';
}

// 右键"构建索引"：手动触发单个文件的向量化，弹窗显示进度
function handleBuildIndex() {
  const item = fileItemContextMenu.item;
  hideFileItemContextMenu();
  if (!item || !item.path) return;

  // 立即弹出进度弹窗
  buildIndexState.visible = true;
  buildIndexState.fileName = item.name;
  buildIndexState.filePath = item.path;
  buildIndexState.phase = 'start';
  buildIndexState.currentChunk = 0;
  buildIndexState.totalChunks = 0;
  buildIndexState.status = 'processing';

  electronService.invoke('rag-build-index', { filePath: item.path })
    .catch(e => console.error('[RAG] build-index failed:', e));
}

// 停止构建索引：取消当前任务，后端会清理已插入的向量
function handleStopBuildIndex() {
  electronService.invoke('rag-stop-build-index')
    .catch(e => console.error('[RAG] stop-build-index failed:', e));
}

// 关闭进度弹窗（仅在任务完成/停止/失败后可用）
function handleCloseBuildIndex() {
  buildIndexState.visible = false;
}

// rag-build-progress 事件处理：更新弹窗进度
function onBuildProgress(data) {
  if (!buildIndexState.visible || data.file !== buildIndexState.filePath) return;
  if (data.phase) buildIndexState.phase = data.phase;
  if (data.currentChunk !== undefined) buildIndexState.currentChunk = data.currentChunk;
  if (data.totalChunks !== undefined) buildIndexState.totalChunks = data.totalChunks;
}

// rag-task-complete 事件处理：任务完成/取消/失败时更新弹窗状态
function onBuildTaskComplete(data) {
  if (!buildIndexState.visible || data.filePath !== buildIndexState.filePath) return;
  buildIndexState.status = data.status;
  if (data.status === 'success') buildIndexState.phase = 'done';
  else if (data.status === 'cancelled') buildIndexState.phase = 'cancelled';
  else buildIndexState.phase = 'failed';
}

function handleDeleteFile() {
  const item = fileItemContextMenu.item;
  hideFileItemContextMenu();
  if (!item) return;
  pendingDeleteFile.value = item;
  if (item.isDirectory) {
    deleteConfirmMessage.value = `删除「${item.name}」会导致该文件夹下所有文件被删除，是否确认删除？`;
  } else {
    deleteConfirmMessage.value = `确认删除「${item.name}」？此操作不可撤销。`;
  }
  showDeleteConfirm.value = true;
}

function handleOpenSearchResult(file) {
  openSearchResult(file);
}

function openInFinder() {
  hideFileContextMenu();
  const dirPath = fileSystem.currentPath.value;
  if (dirPath) {
    electronService.invoke('kb-open-in-explorer', { path: dirPath });
  }
}

function openAgentDir() {
  const dataDir = fileSystem.dataDir.value;
  if (dataDir) {
    electronService.invoke('kb-open-in-explorer', { path: dataDir + '/knowledge/agent' });
  }
}

// ========== 知识库目录监听：外部文件变更时自动刷新 ==========
// 后端 fileWatcher.js 监听 knowledge/ 目录变化，防抖后通过 kb-directory-changed 事件通知前端。
// 前端策略（平衡性能与实时性）：
//   1. 若变更目录是当前正在浏览目录 → 刷新当前目录列表（内容变化）
//   2. 若变更目录是当前目录的直接子目录 → 刷新当前目录列表（子目录 count 字段会变）
//   3. 若变更目录是 knowledge 根或某分类目录（personal/local/agent）→ 重新加载侧边栏知识库列表
//   4. 否则忽略（无关目录变更）

/**
 * 将路径分隔符统一规范化为 '/'，便于跨平台比较
 * （前端 currentPath 用 '/' 拼接，但 dataDir 在 Windows 上可能含 '\\'，需统一）
 */
function normalizePath(p) {
  if (!p) return p;
  return p.replace(/\\/g, '/');
}

/**
 * 判断 ancestor 是否是 target 的祖先目录或自身（路径已规范化为 '/' 分隔符）
 * @param {string} ancestor 候选祖先路径（已规范化）
 * @param {string} target 目标路径（已规范化）
 * @returns {boolean}
 */
function isAncestorOrSelf(ancestor, target) {
  if (!ancestor || !target) return false;
  if (ancestor === target) return true;
  return target.startsWith(ancestor + '/');
}

/**
 * 获取 target 相对 ancestor 的剩余路径（去掉 ancestor 前缀和分隔符）。
 * 若 target 不是 ancestor 的后代/自身，返回 null。
 * 路径需已规范化为 '/' 分隔符。
 */
function relPathUnder(ancestor, target) {
  if (!ancestor || !target) return null;
  if (ancestor === target) return '';
  if (target.startsWith(ancestor + '/')) return target.slice(ancestor.length + 1);
  return null;
}

// 防抖：避免短时间内多次刷新
let refreshDebounceTimer = null;
function debouncedRefreshCurrentDir() {
  if (refreshDebounceTimer) clearTimeout(refreshDebounceTimer);
  refreshDebounceTimer = setTimeout(() => {
    refreshDebounceTimer = null;
    refreshCurrentDir();
  }, 150);
}

let reloadCategoriesTimer = null;
function debouncedReloadCategories() {
  if (reloadCategoriesTimer) clearTimeout(reloadCategoriesTimer);
  reloadCategoriesTimer = setTimeout(() => {
    reloadCategoriesTimer = null;
    loadCategoriesFromDisk();
  }, 150);
}

let unsubKbDirChanged = null;
let unsubBuildProgress = null;
let unsubBuildTaskComplete = null;

onMounted(async () => {
  await loadDataDir();
  await loadCategoriesFromDisk();

  // 订阅后端文件变更事件
  if (window.electronAPI && window.electronAPI.on) {
    unsubKbDirChanged = window.electronAPI.on('kb-directory-changed', ({ dirs }) => {
      if (!dirs || !dirs.length) return;
      // 后端已将路径分隔符统一规范化为 '/'，前端 currentPath/knowledgeRoot 也需规范化后再比较
      const normCurrentPath = normalizePath(fileSystem.currentPath.value);
      const normKnowledgeRoot = normalizePath(fileSystem.dataDir.value ? (fileSystem.dataDir.value + '/knowledge') : '');

      let needRefreshCurrent = false;
      let needReloadCategories = false;

      for (const dir of dirs) {
        if (!dir) continue;

        // 1. 变更目录就是当前目录 → 刷新（内容变化）
        if (normCurrentPath && dir === normCurrentPath) {
          needRefreshCurrent = true;
        }
        // 2. 变更目录是当前目录的直接子目录 → 刷新（子目录的 count 字段会变）
        if (normCurrentPath && isAncestorOrSelf(normCurrentPath, dir)) {
          const rel = relPathUnder(normCurrentPath, dir);
          if (rel !== null && !rel.includes('/') && rel !== '') {
            needRefreshCurrent = true;
          }
        }
        // 3. 变更目录是 knowledgeRoot 或其直接子目录（分类目录）→ 影响侧边栏知识库列表
        if (normKnowledgeRoot) {
          const rel = relPathUnder(normKnowledgeRoot, dir);
          if (rel !== null) {
            // rel 为空（变更在 knowledgeRoot）或 rel 是单段（变更在分类目录 personal/local/agent）
            if (rel === '' || !rel.includes('/')) {
              needReloadCategories = true;
            }
          }
        }
      }

      if (needRefreshCurrent) {
        debouncedRefreshCurrentDir();
      }
      if (needReloadCategories) {
        debouncedReloadCategories();
      }
    });

    // 订阅构建索引进度事件
    unsubBuildProgress = window.electronAPI.on('rag-build-progress', onBuildProgress);
    // 订阅构建索引完成事件
    unsubBuildTaskComplete = window.electronAPI.on('rag-task-complete', onBuildTaskComplete);
  }
});

onBeforeUnmount(() => {
  if (refreshDebounceTimer) {
    clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = null;
  }
  if (reloadCategoriesTimer) {
    clearTimeout(reloadCategoriesTimer);
    reloadCategoriesTimer = null;
  }
  if (unsubKbDirChanged) {
    unsubKbDirChanged();
    unsubKbDirChanged = null;
  }
  if (unsubBuildProgress) {
    unsubBuildProgress();
    unsubBuildProgress = null;
  }
  if (unsubBuildTaskComplete) {
    unsubBuildTaskComplete();
    unsubBuildTaskComplete = null;
  }
});
</script>

<style scoped lang="scss">
.knowledge-base {
  display: flex;
  height: 100%;
  background: var(--bg-primary);
  position: relative;
}

.sidebar-expand-btn {
  position: absolute;
  left: 8px;
  top: 12px;
  z-index: 10;
  padding: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s, transform 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &:active {
    transform: scale(0.92);
  }
}

.sidebar-resize-handle {
  width: 3px;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color 0.15s;
  border-radius: 2px;

  &:hover {
    background-color: var(--accent-color);
    opacity: 0.4;
  }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 5px;
  transition: background 0.15s;

  &:hover {
    background: var(--bg-hover);
  }

  &.danger {
    color: #e53935;

    &:hover {
      background: rgba(229, 57, 53, 0.08);
    }
  }
}

// 构建索引进度弹窗
.build-index-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.build-index-modal {
  width: 360px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  user-select: none;
}

.build-index-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.build-index-body {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.build-index-file {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.build-index-status {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;

  &.success { color: #10b981; }
  &.cancelled { color: #f59e0b; }
  &.failed { color: #ef4444; }
}

.loading-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6;
  animation: build-index-pulse 1.5s ease-in-out infinite;
}

@keyframes build-index-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.build-index-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-bar {
  height: 6px;
  background: var(--bg-hover);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: right;
}

.build-index-footer {
  padding: 12px 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--border-color);
}

.btn-stop, .btn-close {
  padding: 6px 16px;
  font-size: 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-stop {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
  }
}

.btn-close {
  background: var(--bg-hover);
  color: var(--text-primary);

  &:hover {
    background: var(--bg-active);
  }
}
</style>
