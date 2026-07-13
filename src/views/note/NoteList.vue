<template>
  <div class="note-page">
    <div
      class="note-sidebar"
      :class="{ collapsed: sidebarCollapsed, 'is-resizing': isResizing }"
      :style="{ width: sidebarCollapsed ? '0px' : sidebarWidth + 'px' }"
      @selectstart.prevent
    >
      <div class="sidebar-inner">
        <div class="sidebar-topbar" v-if="!searchMode">
          <button class="topbar-btn" @click="toggleSidebar" :title="sidebarCollapsed ? '' : '收起侧边栏'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          </button>
          <div class="topbar-actions">
            <div class="new-note-btn-group" ref="newNoteBtnRef">
              <button class="new-note-main-btn" @click="createNewNote" title="新建笔记">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
              </button>
              <button class="new-note-dropdown-btn" @click.stop="toggleNewNoteMenu" title="更多选项">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <Teleport to="body">
                <div v-if="newNoteMenuVisible" class="new-note-dropdown-menu" :style="newNoteMenuStyle" @click.stop>
                  <div class="dropdown-item" @click="createNewNote">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                    新建笔记
                  </div>
                  <div class="dropdown-item" @click="openImportDialog">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    导入笔记
                  </div>
                </div>
              </Teleport>
            </div>
            <button class="topbar-btn" @click="enterSearchMode">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
          </div>
        </div>

        <div class="sidebar-search" v-else>
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="搜索(按ESC退出)..."
            @keydown.escape="exitSearchMode"
          />
        </div>

      <div class="sidebar-header">
        <div class="folder-trigger" ref="folderTriggerRef" @click.stop="toggleFolderMenu">
          <span class="folder-name">{{ currentFolderName }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>

        <Teleport to="body">
          <div v-if="folderMenuVisible" class="folder-dropdown" :style="folderMenuStyle" @click.stop>
            <div
              v-for="folder in folders"
              :key="folder.id"
              :class="['folder-item', { active: currentFolder === folder.id }]"
              @click="selectFolder(folder.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <div class="folder-info">
                <span class="folder-item-name">{{ folder.name }}</span>
                <span class="folder-count">{{ folder.count }}篇笔记</span>
              </div>
              <div
                v-if="folder.id !== 'all'"
                class="folder-more-btn"
                @click.stop="toggleFolderItemMenu($event, folder)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
              </div>
            </div>
          </div>

          <Teleport to="body">
            <div
              v-if="folderItemMenuVisible"
              class="folder-item-menu"
              :style="folderItemMenuStyle"
              @click.stop
            >
              <div class="folder-item-menu-option" @click="handleRenameNotebook">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                重命名
              </div>
              <div class="folder-item-menu-option danger" @click="handleDeleteNotebook">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                删除
              </div>
            </div>
          </Teleport>
        </Teleport>

      </div>

      <div class="note-items" @contextmenu.prevent>
        <div
          v-for="note in notes"
          :key="note.id"
          :class="['note-item', { active: selectedNoteId === note.id }]"
          @click="selectNote(note.id)"
          @contextmenu.prevent="showContextMenu($event, note)"
        >
          <div class="note-title">{{ note.title }}</div>
          <div class="note-meta">
            <span class="note-time">{{ formatTime(note.updatedAt) }}</span>
            <span class="note-subtitle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              {{ getNotebookName(note.notebookId) }}
            </span>
            <span v-if="note.knowledgeBaseId" class="note-extra">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
              {{ note.knowledgeBaseId }}
            </span>
          </div>
        </div>
      </div>

      <Teleport to="body">
        <div v-if="contextMenu.visible" class="context-menu" :style="contextMenu.style" @click.stop>
          <div class="context-item" @click="handleAction('addToKnowledge')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8M8 12h8"></path></svg>
            添加到知识库
            <svg class="arrow-right" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div
            class="context-item has-submenu"
            @mouseenter="showNotebookSubmenu"
            @mouseleave="hideNotebookSubmenuWithDelay"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            移动到笔记本
            <svg class="arrow-right" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div
            v-if="notebookSubmenuVisible"
            class="notebook-submenu"
            :style="notebookSubmenuStyle"
            @mouseenter="cancelHideNotebookSubmenu"
            @mouseleave="hideNotebookSubmenu"
          >
            <div class="submenu-item" @click="handleAction('createNewNotebook')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              新建笔记本
            </div>
            <div class="submenu-divider"></div>
            <div v-if="notebookStore.loading" class="submenu-item loading">
              <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
              加载中...
            </div>
            <template v-else-if="notebookStore.notebooks.length > 0">
              <div
                v-for="notebook in notebookStore.notebooks"
                :key="notebook.id"
                :class="['submenu-item', { active: contextMenu.targetNote?.notebookId === notebook.id }]"
                @click="moveToNotebook(notebook.id)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                {{ notebook.name }}
              </div>
            </template>
            <div v-else class="submenu-item empty-hint">暂无笔记本</div>
          </div>
          <div class="context-item" @click="handleAction('duplicate')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            创建副本
          </div>
          <div class="context-divider"></div>
          <div class="context-item danger" @click="handleAction('delete')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            删除
          </div>
        </div>
      </Teleport>
      </div>

      <div v-if="tocVisible" class="toc-overlay">
        <div class="toc-header">
          <span class="toc-title">目录</span>
          <button class="toc-close-btn" @click="tocVisible = false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="toc-list">
          <div
            v-for="(heading, index) in tocHeadings"
            :key="index"
            class="toc-item"
            :class="'toc-level-' + heading.level"
            @click="scrollToHeading(index)"
          >
            <span class="toc-item-prefix" v-if="heading.level === 1">H1</span>
            <span class="toc-item-prefix" v-else-if="heading.level === 2">H2</span>
            <span class="toc-item-prefix" v-else>H3</span>
            <span class="toc-item-text">{{ heading.text }}</span>
          </div>
          <div v-if="tocHeadings.length === 0" class="toc-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <p>暂无标题结构</p>
            <p class="toc-empty-hint">添加标题后可在此查看目录</p>
          </div>
        </div>
      </div>
    </div>

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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
    </button>

    <div class="note-editor-area">
      <div v-if="selectedNote" class="editor-container">
        <NoteEditor
          ref="noteEditorRef"
          :key="selectedNoteId"
          v-model="selectedNote.content"
          :note-id="selectedNoteId"
          :placeholder="t('note.editorPlaceholder')"
          :toc-visible="tocVisible"
          :sidebar-collapsed="sidebarCollapsed"
          @change="onEditorChange"
          @toggle-toc="handleToggleToc"
          @close-sidebar="handleCloseSidebar"
          @close-toc="handleCloseToc"
        />
      </div>
      <div v-else class="editor-empty">
        <div class="empty-hint">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <p>{{ t('note.selectToEdit') }}</p>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="importDialogVisible" class="import-dialog-overlay" @click.self="closeImportDialog">
        <div class="import-dialog">
          <div class="import-dialog-header">
            <div class="import-dialog-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><polyline points="9 15 12 18 15 15"></polyline></svg>
              导入
            </div>
            <button class="import-dialog-close" @click="closeImportDialog">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="import-dialog-content">
            <div
              class="upload-area"
              :class="{ 'drag-over': isDragOver }"
              @drop.prevent="handleDrop"
              @dragover.prevent="isDragOver = true"
              @dragleave.prevent="isDragOver = false"
              @click="triggerFileInput"
            >
              <svg class="file-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <circle cx="16" cy="17" r="3" fill="currentColor"></circle>
                <line x1="14.5" y1="17" x2="10" y2="17" stroke-width="2"></line>
                <polyline points="11.5 15.5 13.5 17 11.5 18.5" stroke-width="1.5"></polyline>
              </svg>
              <div class="upload-text">MarkDown文件</div>
              <div class="upload-hint">最多一次上传文件≤100个，单文件≤10MB 选择文件</div>
              <input
                ref="fileInputRef"
                type="file"
                multiple
                accept=".md,.markdown,.txt"
                style="display: none"
                @change="handleFileSelect"
              />
            </div>
          </div>

        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="createNotebookDialogVisible" class="create-notebook-overlay" @click.self="closeCreateNotebookDialog">
        <div class="create-notebook-dialog">
          <div class="create-notebook-header">
            <div class="create-notebook-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              创建笔记本
            </div>
            <button class="create-notebook-close" @click="closeCreateNotebookDialog">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="create-notebook-content">
            <input
              ref="notebookNameInputRef"
              v-model="newNotebookName"
              type="text"
              placeholder="请输入笔记本的名称"
              class="notebook-name-input"
              @keydown.enter="confirmCreateNotebook"
            />
          </div>

          <div class="create-notebook-footer">
            <button
              class="create-notebook-btn"
              :disabled="!newNotebookName.trim()"
              @click="confirmCreateNotebook"
            >
              确认
            </button>
          </div>
        </div>
      </div>

      <div v-if="renameNotebookDialogVisible" class="create-notebook-overlay" @click.self="closeRenameNotebookDialog">
        <div class="create-notebook-dialog">
          <div class="create-notebook-header">
            <div class="create-notebook-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              重命名笔记本
            </div>
            <button class="create-notebook-close" @click="closeRenameNotebookDialog">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="create-notebook-content">
            <input
              ref="renameNotebookInputRef"
              v-model="renameNotebookNewName"
              type="text"
              placeholder="请输入新的笔记本名称"
              class="notebook-name-input"
              @keydown.enter="confirmRenameNotebook"
            />
          </div>

          <div class="create-notebook-footer">
            <button
              class="create-notebook-btn"
              :disabled="!renameNotebookNewName.trim()"
              @click="confirmRenameNotebook"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, onBeforeUnmount, nextTick, onDeactivated, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import NoteEditor from './NoteEditor.vue';
import { useNoteStore } from '@/store/modules/note';
import { useNotebookStore } from '@/store/modules/notebook';
import { electronService } from '@/services/electron';
import { extractPlainText } from '@/utils/text';
import { clearAllChatSessions } from '@/utils/chatSessionCache';
import { useTabStore } from '@/store/modules/tabs';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

const { t } = useI18n();
const noteStore = useNoteStore();
const notebookStore = useNotebookStore();
const tabStore = useTabStore();

const noteEditorRef = ref(null);
const currentFolder = ref('all');

// Agent 写笔记工具完成后需要刷新列表
const NOTE_WRITE_TOOLS = ['create_note', 'update_note'];
let unlistenAgentToolResult = null;
const folderMenuVisible = ref(false);
const folderTriggerRef = ref(null);
const tocVisible = ref(false);
const newNoteMenuVisible = ref(false);
const newNoteBtnRef = ref(null);
const importDialogVisible = ref(false);
const isDragOver = ref(false);
const fileInputRef = ref(null);
let newNoteMenuStyle = reactive({ left: '0px', top: '0px' });

const notebookSubmenuVisible = ref(false);
let notebookSubmenuStyle = reactive({ left: '0px', top: '0px' });
const createNotebookDialogVisible = ref(false);
const newNotebookName = ref('');
const notebookNameInputRef = ref(null);
const createNotebookTargetNoteId = ref(null);
const folderItemMenuVisible = ref(false);
const folderItemMenuStyle = reactive({ left: '0px', top: '0px' });
const selectedFolderForAction = ref(null);
const renameNotebookDialogVisible = ref(false);
const renameNotebookNewName = ref('');
const renameNotebookInputRef = ref(null);

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 280;
const SIDEBAR_DEFAULT_WIDTH = 200;
const sidebarWidth = ref(SIDEBAR_DEFAULT_WIDTH);
const sidebarCollapsed = ref(false);
const isResizing = ref(false);
const searchMode = ref(false);
const searchQuery = ref('');
const searchInputRef = ref(null);

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
};

const enterSearchMode = () => {
  searchMode.value = true;
  nextTick(() => {
    if (searchInputRef.value) {
      searchInputRef.value.focus();
    }
  });
};

const exitSearchMode = async () => {
  searchMode.value = false;
  searchQuery.value = '';
  currentFolder.value = 'all';
  await noteStore.fetchNotes();
};

let searchDebounceTimer = null;

watch(searchQuery, (query) => {
  if (!searchMode.value) return;
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(async () => {
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      currentFolder.value = 'all';
      await noteStore.searchNotes(trimmedQuery);
    } else {
      await noteStore.fetchNotes();
    }
  }, 1000);
});

const onResizeStart = (e) => {
  e.preventDefault();
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = sidebarWidth.value;

  const onResizeMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, startWidth + delta));
    sidebarWidth.value = newWidth;
  };

  const onResizeEnd = () => {
    isResizing.value = false;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
};

const folders = computed(() => {
  const allNotes = noteStore.notes;
  const allCount = allNotes.length;
  const list = [{ id: 'all', name: '全部', count: allCount }];
  for (const nb of notebookStore.notebooks) {
    const nbCount = allNotes.filter(n => n.notebookId === nb.id).length;
    list.push({ id: nb.id, name: nb.name, count: nbCount });
  }
  return list;
});

const currentFolderName = computed(() => {
  const f = folders.value.find(f => f.id === currentFolder.value);
  return f ? f.name : '全部';
});

const notes = computed(() => noteStore.notes);
const selectedNoteId = computed(() => noteStore.currentNoteId);
const selectedNote = computed(() => noteStore.currentNote);

const tocHeadings = computed(() => {
  const note = selectedNote.value;
  if (!note?.content) return [];
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = note.content;
  const headingElements = tempDiv.querySelectorAll('h1, h2, h3');
  return Array.from(headingElements).map((el, index) => ({
    level: parseInt(el.tagName[1]),
    text: el.textContent.trim(),
    index
  })).filter(h => h.text);
});

const handleToggleToc = () => {
  if (sidebarCollapsed.value) {
    sidebarCollapsed.value = false;
    setTimeout(() => { tocVisible.value = true; }, 280);
  } else {
    tocVisible.value = !tocVisible.value;
  }
};

const handleCloseSidebar = () => {
  sidebarCollapsed.value = true;
};

const handleCloseToc = () => {
  tocVisible.value = false;
};

const scrollToHeading = (index) => {
  const editorContent = document.querySelector('.editor-content');
  if (!editorContent) return;
  const headings = editorContent.querySelectorAll('h1, h2, h3');
  if (!headings[index]) return;
  const target = headings[index];
  const containerRect = editorContent.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const offset = targetRect.top - containerRect.top + editorContent.scrollTop - containerRect.height / 3;
  editorContent.scrollTo({ top: offset, behavior: 'smooth' });
};

const formatTime = (dateStr) => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}天前`;
    return date.toLocaleDateString('zh-CN');
  } catch {
    return '';
  }
};

const getContentPreview = (contentText) => {
  const text = contentText.trim();
  if (!text) return '无附加文本';
  return text.length > 30 ? text.slice(0, 30) + '...' : text;
};

const getNotebookName = (notebookId) => {
  if (!notebookId) return '未分类';
  const notebook = notebookStore.notebooks.find(nb => nb.id === notebookId);
  return notebook ? notebook.name : '未知笔记本';
};

const selectNote = (id) => {
  noteStore.selectNote(id);
};

const createNewNote = async () => {
  newNoteMenuVisible.value = false;
  const notebookId = currentFolder.value !== 'all' ? currentFolder.value : null;
  const note = await noteStore.createNote(null, null, notebookId);
  if (!note) {
    console.error('Failed to create note: Electron API not available or create_note returned null');
    return;
  }
};

const toggleNewNoteMenu = async () => {
  if (newNoteMenuVisible.value) {
    newNoteMenuVisible.value = false;
    return;
  }
  folderMenuVisible.value = false;
  await nextTick();
  if (newNoteBtnRef.value) {
    const rect = newNoteBtnRef.value.getBoundingClientRect();
    newNoteMenuStyle.left = `${rect.right - 140}px`;
    newNoteMenuStyle.top = `${rect.bottom + 4}px`;
  }
  newNoteMenuVisible.value = true;
};

const openImportDialog = () => {
  newNoteMenuVisible.value = false;
  importDialogVisible.value = true;
};

const closeImportDialog = () => {
  importDialogVisible.value = false;
  isDragOver.value = false;
};

const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

const handleFileSelect = (event) => {
  const files = event.target.files;
  if (files && files.length > 0) {
    processFiles(files);
  }
};

const handleDrop = (event) => {
  isDragOver.value = false;
  const files = event.dataTransfer.files;
  if (files && files.length > 0) {
    processFiles(files);
  }
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 100;

const parseMarkdownTitle = (content) => {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
    return trimmed.length > 50 ? trimmed.substring(0, 50) : trimmed;
  }
  return '新建笔记';
};

const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

const processFiles = async (files) => {
  const fileArray = Array.from(files);

  if (fileArray.length > MAX_FILE_COUNT) {
    console.warn(`导入文件数量超过限制（最多${MAX_FILE_COUNT}个），仅导入前${MAX_FILE_COUNT}个`);
    fileArray.splice(MAX_FILE_COUNT);
  }

  const validFiles = fileArray.filter(file => {
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`文件 "${file.name}" 超过10MB限制，已跳过`);
      return false;
    }
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.md') && !ext.endsWith('.markdown') && !ext.endsWith('.txt')) {
      console.warn(`文件 "${file.name}" 不是支持的格式，已跳过`);
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) {
    closeImportDialog();
    return;
  }

  const notebookId = currentFolder.value !== 'all' ? currentFolder.value : null;
  let importedCount = 0;

  for (const file of validFiles) {
    try {
      const markdownContent = await readFileAsText(file);
      const title = parseMarkdownTitle(markdownContent);
      const htmlContent = marked.parse(markdownContent);
      const contentText = extractPlainText(htmlContent).replace(/\s+/g, ' ').trim();

      const note = await noteStore.importNote(null, notebookId, title, htmlContent, contentText);
      if (note) {
        importedCount++;
      }
    } catch (err) {
      console.error(`导入文件 "${file.name}" 失败:`, err);
    }
  }

  if (importedCount > 0) {
    await noteStore.fetchNotes(null, notebookId);
    if (noteStore.notes.length > 0) {
      noteStore.selectNote(noteStore.notes[0].id);
    }
  }

  closeImportDialog();

  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const toggleImportOtherMenu = () => {
  console.log('Toggle import other menu');
};

const onEditorChange = (content) => {
  const note = noteStore.currentNote;
  if (!note) return;

  const plainText = extractPlainText(content);
  const firstLine = (plainText.split('\n').find(line => line.trim() !== '') || '').trim();
  const title = firstLine ? (firstLine.length > 20 ? firstLine.substring(0, 20) : firstLine) : '新建笔记';
  const contentText = plainText.replace(/\s+/g, ' ').trim();

  noteStore.scheduleSave(note.id, title, content, contentText);
};

let folderMenuStyle = reactive({ left: '0px', top: '0px' });

const toggleFolderMenu = async () => {
  if (folderMenuVisible.value) {
    folderMenuVisible.value = false;
    return;
  }
  newNoteMenuVisible.value = false;
  await nextTick();
  if (folderTriggerRef.value) {
    const rect = folderTriggerRef.value.getBoundingClientRect();
    folderMenuStyle.left = `${rect.left}px`;
    folderMenuStyle.top = `${rect.bottom + 4}px`;
  }
  folderMenuVisible.value = true;

  try {
    await noteStore.fetchNotes();
    await notebookStore.fetchNotebooks();
  } catch (error) {
    console.error('Failed to refresh data for folder menu:', error);
  }
};

const selectFolder = async (id) => {
  currentFolder.value = id;
  folderMenuVisible.value = false;
  if (id === 'all') {
    await noteStore.fetchNotes();
  } else {
    await noteStore.fetchNotes(null, id);
  }
  if (noteStore.notes.length > 0) {
    noteStore.selectNote(noteStore.notes[0].id);
  } else {
    noteStore.currentNoteId = null;
  }
};

const toggleFolderItemMenu = (event, folder) => {
  event.stopPropagation();
  if (folderItemMenuVisible.value && selectedFolderForAction.value?.id === folder.id) {
    folderItemMenuVisible.value = false;
    return;
  }

  selectedFolderForAction.value = folder;
  const rect = event.target.getBoundingClientRect();
  folderItemMenuStyle.left = `${rect.right - 100}px`;
  folderItemMenuStyle.top = `${rect.top}px`;
  folderItemMenuVisible.value = true;
};

const handleRenameNotebook = () => {
  if (!selectedFolderForAction.value) return;
  renameNotebookNewName.value = selectedFolderForAction.value.name;
  folderItemMenuVisible.value = false;
  renameNotebookDialogVisible.value = true;
  nextTick(() => {
    if (renameNotebookInputRef.value) {
      renameNotebookInputRef.value.focus();
      renameNotebookInputRef.value.select();
    }
  });
};

const confirmRenameNotebook = async () => {
  const name = renameNotebookNewName.value.trim();
  if (!name || !selectedFolderForAction.value) return;

  await notebookStore.updateNotebook(selectedFolderForAction.value.id, name);

  closeRenameNotebookDialog();

  await notebookStore.fetchNotebooks();
};

const closeRenameNotebookDialog = () => {
  renameNotebookDialogVisible.value = false;
  renameNotebookNewName.value = '';
  selectedFolderForAction.value = null;
};

const handleDeleteNotebook = async () => {
  if (!selectedFolderForAction.value) return;

  const notebookName = selectedFolderForAction.value.name;
  const notebookId = selectedFolderForAction.value.id;

  folderItemMenuVisible.value = false;

  const confirmed = window.confirm(`确定要删除笔记本"${notebookName}"吗？\n\n注意：笔记本中的笔记不会被删除，但会变为"未分类"状态。`);
  if (!confirmed) return;

  await notebookStore.deleteNotebook(notebookId);

  if (currentFolder.value === notebookId) {
    currentFolder.value = 'all';
    await noteStore.fetchNotes();
  }

  selectedFolderForAction.value = null;
};

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  targetNoteId: null,
  targetNote: null,
  get style() {
    return {
      left: `${this.x}px`,
      top: `${this.y}px`
    };
  }
});

const showContextMenu = (e, note) => {
  contextMenu.visible = true;
  contextMenu.x = e.clientX;
  contextMenu.y = e.clientY;
  contextMenu.targetNoteId = note.id;
  contextMenu.targetNote = note;
  notebookSubmenuVisible.value = false;
};

const hideContextMenu = () => {
  contextMenu.visible = false;
  contextMenu.targetNoteId = null;
  contextMenu.targetNote = null;
  notebookSubmenuVisible.value = false;
  folderItemMenuVisible.value = false;
};

let notebookSubmenuHideTimer = null;

const showNotebookSubmenu = async () => {
  if (notebookSubmenuHideTimer) {
    clearTimeout(notebookSubmenuHideTimer);
    notebookSubmenuHideTimer = null;
  }

  await nextTick();
  const menuEl = document.querySelector('.context-menu');
  if (menuEl) {
    const rect = menuEl.getBoundingClientRect();
    const menuItemEl = menuEl.querySelector('.has-submenu');
    if (menuItemEl) {
      const itemRect = menuItemEl.getBoundingClientRect();
      notebookSubmenuStyle.left = `${itemRect.right + 4}px`;
      notebookSubmenuStyle.top = `${itemRect.top}px`;
    }
  }

  notebookSubmenuVisible.value = true;

  try {
    await notebookStore.fetchNotebooks();
  } catch (error) {
    console.error('Failed to fetch notebooks:', error);
  }
};

const hideNotebookSubmenuWithDelay = () => {
  notebookSubmenuHideTimer = setTimeout(() => {
    notebookSubmenuVisible.value = false;
    notebookSubmenuHideTimer = null;
  }, 200);
};

const cancelHideNotebookSubmenu = () => {
  if (notebookSubmenuHideTimer) {
    clearTimeout(notebookSubmenuHideTimer);
    notebookSubmenuHideTimer = null;
  }
};

const hideNotebookSubmenu = () => {
  notebookSubmenuVisible.value = false;
  if (notebookSubmenuHideTimer) {
    clearTimeout(notebookSubmenuHideTimer);
    notebookSubmenuHideTimer = null;
  }
};

const openCreateNotebookDialog = () => {
  createNotebookTargetNoteId.value = contextMenu.targetNoteId;
  hideContextMenu();
  createNotebookDialogVisible.value = true;
  newNotebookName.value = '';
  nextTick(() => {
    if (notebookNameInputRef.value) {
      notebookNameInputRef.value.focus();
    }
  });
};

const closeCreateNotebookDialog = () => {
  createNotebookDialogVisible.value = false;
  newNotebookName.value = '';
};

const confirmCreateNotebook = async () => {
  const name = newNotebookName.value.trim();
  if (!name) return;

  console.log('[NoteList] Creating new notebook and binding note:', {
    notebookName: name,
    targetNoteId: createNotebookTargetNoteId.value
  });

  try {
    const notebook = await notebookStore.createNotebook(name);
    console.log('[NoteList] Notebook created:', notebook);

    if (notebook) {
      if (createNotebookTargetNoteId.value) {
        console.log('[NoteList] Binding note to new notebook:', {
          noteId: createNotebookTargetNoteId.value,
          notebookId: notebook.id,
          notebookName: notebook.name
        });
        await moveNoteToNotebook(createNotebookTargetNoteId.value, notebook.id);
        console.log('[NoteList] ✅ Note successfully bound to new notebook');
      } else {
        console.warn('[NoteList] No target note to bind');
      }
    } else {
      console.error('[NoteList] ❌ Failed to create notebook - returned null');
    }
  } catch (error) {
    console.error('[NoteList] ❌ Error in confirmCreateNotebook:', error);
  }

  closeCreateNotebookDialog();
};

const moveToNotebook = async (notebookId) => {
  if (contextMenu.targetNoteId) {
    await moveNoteToNotebook(contextMenu.targetNoteId, notebookId);
  }
  hideContextMenu();
};

const moveNoteToNotebook = async (noteId, notebookId) => {
  console.log('[NoteList] Moving note to notebook:', { noteId, notebookId })
  const note = noteStore.notes.find(n => n.id === noteId);
  if (note) {
    await electronService.invoke('update_note', {
      noteId: note.id,
      title: note.title,
      content: note.content,
      contentText: note.contentText,
      notebookId
    });
    note.notebookId = notebookId;
    note.updatedAt = new Date().toISOString();
    console.log('[NoteList] Note moved successfully:', { noteId, notebookId })
  } else {
    console.error('[NoteList] Note not found:', noteId)
  }
};

const duplicateNote = async () => {
  if (!contextMenu.targetNoteId) return;

  const originalNote = noteStore.notes.find(n => n.id === contextMenu.targetNoteId);
  if (!originalNote) return;

  const newNote = await electronService.invoke('create_note', {
    knowledgeBaseId: originalNote.knowledgeBaseId,
    notebookId: originalNote.notebookId,
    title: originalNote.title + '-副本'
  });

  if (newNote) {
    await electronService.invoke('update_note', {
      noteId: newNote.id,
      title: newNote.title,
      content: originalNote.content,
      contentText: originalNote.contentText
    });
    newNote.content = originalNote.content;
    newNote.contentText = originalNote.contentText;
    noteStore.notes.unshift(newNote);
  }
};

const handleAction = async (action) => {
  if (action === 'delete' && contextMenu.targetNoteId) {
    await noteStore.deleteNote(contextMenu.targetNoteId);
  } else if (action === 'addToKnowledge') {
    console.log('Add to knowledge feature is not yet implemented');
  } else if (action === 'createNewNotebook') {
    openCreateNotebookDialog();
  } else if (action === 'duplicate') {
    await duplicateNote();
  }
  hideContextMenu();
};

const handleClickOutside = () => {
  if (contextMenu.visible || folderMenuVisible.value || newNoteMenuVisible.value || notebookSubmenuVisible.value || folderItemMenuVisible.value) {
    contextMenu.visible = false;
    folderMenuVisible.value = false;
    newNoteMenuVisible.value = false;
    notebookSubmenuVisible.value = false;
    folderItemMenuVisible.value = false;
  }
};

onMounted(async () => {
  document.addEventListener('click', handleClickOutside);
  await noteStore.fetchNotes();
  await notebookStore.fetchNotebooks();
  if (noteStore.notes.length > 0 && !noteStore.currentNoteId) {
    noteStore.selectNote(noteStore.notes[0].id);
  }

  // 监听 agent 工具调用结果，写笔记操作完成后刷新列表
  unlistenAgentToolResult = electronService.listen('agent-tool-result', async (event) => {
    const data = event.payload;
    if (data.status !== 'success') return;
    if (!NOTE_WRITE_TOOLS.includes(data.toolName)) return;
    // 按当前文件夹过滤刷新
    if (currentFolder.value === 'all') {
      await noteStore.fetchNotes();
    } else {
      await noteStore.fetchNotes(null, currentFolder.value);
    }
  });
});

onBeforeUnmount(async () => {
  document.removeEventListener('click', handleClickOutside);
  if (unlistenAgentToolResult) {
    unlistenAgentToolResult();
    unlistenAgentToolResult = null;
  }
  await noteStore.flushPendingSave();
  clearAllChatSessions();
});

const hasNoteTab = computed(() => tabStore.openedTabs.some(tab => tab.path === '/note' || tab.path.startsWith('/note')));

watch(hasNoteTab, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    clearAllChatSessions();
    noteEditorRef.value?.resetChatSession();
  }
});

onDeactivated(() => {
  folderMenuVisible.value = false;
  contextMenu.visible = false;
  notebookSubmenuVisible.value = false;
  createNotebookDialogVisible.value = false;
});
</script>

<style scoped>
.note-page {
  display: flex;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.note-sidebar {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  background-color: var(--bg-primary);
  position: relative;
  overflow: hidden;
  transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.note-sidebar :deep(*) {
  user-select: none;
  -webkit-user-select: none;
}

.note-sidebar :deep(::selection) {
  background: transparent;
}

.note-sidebar.is-resizing {
  transition: none;
}

.note-sidebar.collapsed {
  width: 0 !important;
}

.sidebar-inner {
  min-width: 200px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background-color: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.12s;
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 30;
}

.sidebar-expand-btn:hover {
  background-color: var(--bg-hover);
}

.sidebar-resize-handle {
  width: 2px;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color 0.15s;
}

.sidebar-resize-handle:hover {
  background-color: var(--bg-hover);
}

.sidebar-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px;
}

.sidebar-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px;
  height: 56px;
  box-sizing: border-box;
}

.search-icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: var(--text-primary);
  min-width: 0;
  height: 32px;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.topbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background-color: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.12s;
}

.topbar-btn:hover {
  background-color: var(--bg-hover);
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.new-note-btn-group {
  display: flex;
  align-items: center;
  position: relative;
}

.new-note-main-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px 0 0 8px;
  border: none;
  background-color: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.12s;
  padding: 0;
}

.new-note-main-btn:hover {
  background-color: var(--bg-hover);
}

.new-note-dropdown-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 32px;
  border-radius: 0 8px 8px 0;
  border: none;
  background-color: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.12s;
  padding: 0;
}

.new-note-dropdown-btn:hover {
  background-color: var(--bg-hover);
}

.new-note-dropdown-menu {
  position: fixed;
  z-index: 1000;
  min-width: 140px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.12s;
}

.dropdown-item:hover {
  background-color: var(--bg-hover);
}

.sidebar-header {
  padding: 0 12px 8px;
  position: relative;
}

.folder-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.12s;
  user-select: none;
}

.folder-trigger:hover {
  background-color: var(--bg-hover);
}

.folder-name {
  line-height: 1;
}

.note-items {
  flex: 1;
  overflow-y: auto;
  padding: 2px 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

.note-items::-webkit-scrollbar {
  width: 5px;
}

.note-items::-webkit-scrollbar-track {
  background: transparent;
}

.note-items::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
}

.note-items::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.25);
}

[data-theme='dark'] .note-items {
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

[data-theme='dark'] .note-items::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
}

[data-theme='dark'] .note-items::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.25);
}

.note-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.12s;
  border-left: 3px solid transparent;
}

.note-item:hover {
  background-color: var(--bg-hover);
}

.note-item.active {
  background-color: var(--bg-active);
  border-left-color: var(--text-primary);
}

.note-title {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-primary);
  margin-bottom: 1px;
  line-height: 1.35;
}

.note-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.note-time {
  white-space: nowrap;
}

.note-subtitle {
  white-space: nowrap;
}

.note-extra {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--text-tertiary);
}

.note-editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--bg-primary);
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-tertiary);
}

.empty-hint svg {
  opacity: 0.4;
}

.empty-hint p {
  font-size: 14px;
}

.toc-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-primary);
  z-index: 10;
  display: flex;
  flex-direction: column;
  animation: toc-slide-in 0.2s ease-out;
}

@keyframes toc-slide-in {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}

.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.toc-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.toc-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.12s;
}

.toc-close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.toc-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

.toc-list::-webkit-scrollbar {
  width: 5px;
}

.toc-list::-webkit-scrollbar-track {
  background: transparent;
}

.toc-list::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
}

[data-theme='dark'] .toc-list {
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

[data-theme='dark'] .toc-list::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
}

.toc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toc-item:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.toc-level-2 {
  padding-left: 32px;
}

.toc-level-3 {
  padding-left: 48px;
}

.toc-item-prefix {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  background-color: var(--bg-hover);
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 1.3;
}

.toc-level-1 .toc-item-prefix {
  color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
}

.toc-level-2 .toc-item-prefix {
  color: #8b5cf6;
  background-color: rgba(139, 92, 246, 0.1);
}

.toc-level-3 .toc-item-prefix {
  color: #6b7280;
  background-color: rgba(107, 114, 128, 0.1);
}

.toc-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.toc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  color: var(--text-tertiary);
  text-align: center;
  gap: 8px;
}

.toc-empty svg {
  opacity: 0.35;
}

.toc-empty p {
  font-size: 13px;
  margin: 0;
}

.toc-empty-hint {
  font-size: 12px !important;
  color: var(--text-tertiary);
  opacity: 0.7;
}
</style>

<style>
.folder-dropdown {
  position: fixed;
  z-index: 100001;
  background-color: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18), 0 0 1px rgba(0, 0, 0, 0.08);
  padding: 4px 0;
  min-width: 200px;
  animation: dropdown-in 0.1s ease-out;
}

[data-theme='dark'] .folder-dropdown {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.2);
}

@keyframes dropdown-in {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.1s;
  user-select: none;
  position: relative;
  border-radius: 6px;
}

.folder-item:hover {
  background-color: transparent;
}

.folder-item:hover::after {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  top: 3px;
  bottom: 3px;
  background-color: var(--bg-hover);
  border-radius: 5px;
  z-index: 0;
}

.folder-item.active {
  background-color: transparent;
}

.folder-item.active::before {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  top: 3px;
  bottom: 3px;
  background-color: var(--bg-active);
  border-radius: 5px;
  z-index: 0;
}

.folder-item.active > * {
  position: relative;
  z-index: 1;
}

.folder-item svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.folder-info {
  display: flex;
  flex-direction: column;
  gap: 0px;
  min-width: 0;
}

.folder-item-name {
  font-weight: 500;
  line-height: 1.25;
  font-size: 12px;
}

.folder-count {
  font-size: 10px;
  color: var(--text-tertiary);
}

.folder-more-btn {
  margin-left: auto;
  padding: 2px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.1s;
  cursor: pointer;
  color: var(--text-tertiary);
}

.folder-item:hover .folder-more-btn {
  opacity: 1;
}

.folder-more-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.folder-item-menu {
  position: fixed;
  z-index: 100002;
  background-color: var(--bg-primary);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.08);
  padding: 2px 0;
  min-width: 110px;
  animation: dropdown-in 0.1s ease-out;
}

[data-theme='dark'] .folder-item-menu {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.2);
}

.folder-item-menu-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.1s;
}

.folder-item-menu-option:hover {
  background-color: var(--bg-hover);
}

.folder-item-menu-option.danger {
  color: #ef4444;
}

.folder-item-menu-option.danger svg {
  color: #ef4444;
}

.context-menu {
  position: fixed;
  z-index: 99999;
  background-color: var(--bg-primary);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.08);
  padding: 6px 0;
  min-width: 180px;
  animation: dropdown-in 0.12s ease-out;
}

[data-theme='dark'] .context-menu {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.2);
}

.context-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  font-size: 13px;
  color: #1c1917;
  cursor: pointer;
  transition: background-color 0.1s;
  user-select: none;
}

[data-theme='dark'] .context-item {
  color: var(--text-primary);
}

.context-item:hover {
  background-color: var(--bg-hover);
}

[data-theme='dark'] .context-item:hover {
  background-color: var(--bg-hover);
}

.context-item svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.context-item.has-submenu {
  position: relative;
}

.context-item.has-submenu:hover {
  background-color: var(--bg-hover);
}

[data-theme='dark'] .context-item svg {
  color: var(--text-secondary);
}

.notebook-submenu {
  position: fixed;
  z-index: 100000;
  background-color: var(--bg-primary);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.08);
  padding: 6px 0;
  min-width: 160px;
  animation: dropdown-in 0.12s ease-out;
}

.context-item.danger {
  color: #ef4444;
}

.context-item.danger svg {
  color: #ef4444;
}

.context-item .arrow-right {
  margin-left: auto;
  opacity: 0.4;
}

.context-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 4px 12px;
}

[data-theme='dark'] .context-divider {
  background-color: var(--border-color);
}

.notebook-submenu {
  position: fixed;
  z-index: 100000;
  background-color: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.08);
  padding: 4px 0;
  min-width: 140px;
  animation: dropdown-in 0.1s ease-out;
}

[data-theme='dark'] .notebook-submenu {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.2);
}

.submenu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  font-size: 12px;
  color: #1c1917;
  cursor: pointer;
  transition: background-color 0.1s;
  user-select: none;
}

[data-theme='dark'] .submenu-item {
  color: var(--text-primary);
}

.submenu-item:hover {
  background-color: var(--bg-hover);
}

[data-theme='dark'] .submenu-item:hover {
  background-color: var(--bg-hover);
}

.submenu-item.active {
  background-color: var(--bg-active);
  color: var(--text-primary);
  font-weight: 500;
}

.submenu-item svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.submenu-item.loading {
  color: var(--text-tertiary);
  cursor: default;
  pointer-events: none;
}

.submenu-item.loading:hover {
  background-color: transparent;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.submenu-item.empty-hint {
  color: var(--text-tertiary);
  cursor: default;
  justify-content: center;
  font-size: 12px;
  pointer-events: none;
}

.submenu-item.empty-hint:hover {
  background-color: transparent;
}

.submenu-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 4px 12px;
}

.create-notebook-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100001;
  animation: fade-in 0.15s ease-out;
}

.create-notebook-dialog {
  background-color: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.08);
  animation: scale-in 0.2s ease-out;
}

[data-theme='dark'] .create-notebook-dialog {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 1px rgba(0, 0, 0, 0.2);
}

.create-notebook-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border-color);
}

.create-notebook-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.create-notebook-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.create-notebook-close:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.create-notebook-content {
  padding: 24px 20px;
}

.notebook-name-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.notebook-name-input:focus {
  border-color: var(--text-primary);
}

.notebook-name-input::placeholder {
  color: var(--text-tertiary);
}

.create-notebook-footer {
  padding: 14px 20px 18px;
  display: flex;
  justify-content: flex-end;
}

.create-notebook-btn {
  padding: 10px 28px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background-color: #6b7280;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.create-notebook-btn:not(:disabled) {
  background-color: #2563eb;
}

.create-notebook-btn:not(:disabled):hover {
  background-color: #1d4ed8;
}

.create-notebook-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: dialog-fade-in 0.2s ease-out;
}

@keyframes dialog-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.import-dialog {
  width: 400px;
  max-width: 90vw;
  background-color: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: dialog-scale-in 0.25s ease-out;
}

@keyframes dialog-scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.import-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
}

.import-dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.import-dialog-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.12s;
}

.import-dialog-close:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.import-dialog-content {
  padding: 0 20px 16px;
}

.upload-area {
  border: 2px dashed var(--border-color);
  border-radius: 10px;
  padding: 32px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: #f0fdf4;
}

.upload-area:hover {
  border-color: var(--color-primary, #4a9eff);
  background-color: #dcfce7;
}

.upload-area.drag-over {
  border-color: var(--color-primary, #4a9eff);
  background-color: #bbf7d0;
}

.file-icon {
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.upload-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
