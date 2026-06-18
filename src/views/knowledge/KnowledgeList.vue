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
      <div class="context-menu-item danger" @mousedown="handleDeleteKB">
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

    <!-- 功能开发中提示 -->
    <FeatureModal :visible="showModal" @close="showModal = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { SidebarIcon } from './components/icons';
import KbSidebar from './components/KbSidebar.vue';
import KbMainContent from './components/KbMainContent.vue';
import KbContextMenu from './components/KbContextMenu.vue';
import NewFolderDialog from './components/NewFolderDialog.vue';
import CreateKbDialog from './components/CreateKbDialog.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import FeatureModal from './components/FeatureModal.vue';
import { electronService } from '@/services/electron';
import { useSidebar } from './composables/useSidebar';
import { useFileSystem } from './composables/useFileSystem';
import { useKnowledgeBase } from './composables/useKnowledgeBase';
import { useContextMenu } from './composables/useContextMenu';

const showModal = ref(false);
const showDeleteConfirm = ref(false);
const deleteConfirmMessage = ref('');
const pendingDeleteItem = ref(null);
const pendingDeleteCategoryId = ref('');
const pendingDeleteFile = ref(null);

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

onMounted(async () => {
  await loadDataDir();
  await loadCategoriesFromDisk();
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
</style>
