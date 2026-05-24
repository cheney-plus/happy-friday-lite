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
            <div class="new-note-btn" @click="createNewNote">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
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
            placeholder="搜索笔记..."
            @keydown.enter="onSearch"
            @keydown.escape="exitSearchMode"
            @blur="exitSearchMode"
          />
        </div>

      <div class="sidebar-header">
        <div class="folder-trigger" ref="folderTriggerRef" @click.stop="toggleFolderMenu">
          <span class="folder-name">{{ currentFolderName }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>

        <Teleport to="body">
          <div v-if="folderMenuVisible" class="folder-dropdown" :style="folderMenuStyle">
            <div
              v-for="folder in folders"
              :key="folder.id"
              :class="['folder-item', { active: currentFolder === folder.id }]"
              @click="selectFolder(folder.id)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <div class="folder-info">
                <span class="folder-item-name">{{ folder.name }}</span>
                <span class="folder-count">{{ folder.count }}篇笔记</span>
              </div>
            </div>
          </div>
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
            <span class="note-subtitle">{{ getContentPreview(note.contentText) }}</span>
            <span v-if="note.knowledgeBaseId" class="note-extra">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
              {{ note.knowledgeBaseId }}
            </span>
          </div>
        </div>
      </div>

      <Teleport to="body">
        <div v-if="contextMenu.visible" class="context-menu" :style="contextMenu.style">
          <div class="context-item" @click="handleAction('addToKnowledge')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8M8 12h8"></path></svg>
            添加到知识库
            <svg class="arrow-right" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="context-item" @click="handleAction('moveToNotebook')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            移动到笔记本
            <svg class="arrow-right" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
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
          :key="selectedNoteId"
          v-model="selectedNote.content"
          :placeholder="t('note.editorPlaceholder')"
          :toc-visible="tocVisible"
          @change="onEditorChange"
          @toggle-toc="handleToggleToc"
        />
      </div>
      <div v-else class="editor-empty">
        <div class="empty-hint">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <p>{{ t('note.selectToEdit') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, onBeforeUnmount, nextTick, onDeactivated } from 'vue';
import { useI18n } from 'vue-i18n';
import NoteEditor from './NoteEditor.vue';
import { useNoteStore } from '@/store/modules/note';
import { extractPlainText } from '@/utils/text';

const { t } = useI18n();
const noteStore = useNoteStore();

const currentFolder = ref('all');
const folderMenuVisible = ref(false);
const folderTriggerRef = ref(null);
const tocVisible = ref(false);

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
  await noteStore.fetchNotes();
};

const onSearch = async () => {
  if (searchQuery.value.trim()) {
    await noteStore.searchNotes(searchQuery.value.trim());
  } else {
    await noteStore.fetchNotes();
  }
};

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

const folders = reactive([
  { id: 'all', name: '全部', count: 0 },
]);

const currentFolderName = computed(() => {
  const f = folders.find(f => f.id === currentFolder.value);
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

const selectNote = (id) => {
  noteStore.selectNote(id);
};

const createNewNote = async () => {
  const note = await noteStore.createNote();
  if (!note) {
    console.error('Failed to create note: Electron API not available or create_note returned null');
    return;
  }
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
  await nextTick();
  if (folderTriggerRef.value) {
    const rect = folderTriggerRef.value.getBoundingClientRect();
    folderMenuStyle.left = `${rect.left}px`;
    folderMenuStyle.top = `${rect.bottom + 4}px`;
  }
  folderMenuVisible.value = true;
};

const selectFolder = (id) => {
  currentFolder.value = id;
  folderMenuVisible.value = false;
};

const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  targetNoteId: null,
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
};

const hideContextMenu = () => {
  contextMenu.visible = false;
  contextMenu.targetNoteId = null;
};

const handleAction = async (action) => {
  if (action === 'delete' && contextMenu.targetNoteId) {
    await noteStore.deleteNote(contextMenu.targetNoteId);
  } else if (action === 'addToKnowledge') {
    console.log('Add to knowledge feature is not yet implemented');
  } else if (action === 'moveToNotebook') {
    console.log('Move to notebook feature is not yet implemented');
  } else if (action === 'duplicate') {
    console.log('Duplicate note feature is not yet implemented');
  }
  hideContextMenu();
};

const handleClickOutside = () => {
  if (contextMenu.visible || folderMenuVisible.value) {
    contextMenu.visible = false;
    folderMenuVisible.value = false;
  }
};

onMounted(async () => {
  document.addEventListener('click', handleClickOutside);
  await noteStore.fetchNotes();
  if (noteStore.notes.length > 0 && !noteStore.currentNoteId) {
    noteStore.selectNote(noteStore.notes[0].id);
  }
});

onBeforeUnmount(async () => {
  document.removeEventListener('click', handleClickOutside);
  await noteStore.flushPendingSave();
});

onDeactivated(() => {
  folderMenuVisible.value = false;
  contextMenu.visible = false;
});
</script>

<style scoped>
.note-page {
  display: flex;
  height: 100%;
  overflow: hidden;
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
  flex-shrink: 0;
  margin: 12px 0 0 12px;
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

.new-note-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.12s;
  color: var(--text-primary);
}

.new-note-btn:hover {
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
  z-index: 99999;
  background-color: var(--bg-primary);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.08);
  padding: 6px 0;
  min-width: 200px;
  animation: dropdown-in 0.12s ease-out;
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
  gap: 10px;
  padding: 9px 16px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.1s;
  user-select: none;
}

.folder-item:hover {
  background-color: var(--bg-hover);
}

.folder-item.active {
  background-color: var(--bg-active);
}

.folder-item svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.folder-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.folder-item-name {
  font-weight: 500;
  line-height: 1.3;
}

.folder-count {
  font-size: 11px;
  color: var(--text-tertiary);
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

[data-theme='dark'] .context-item svg {
  color: var(--text-secondary);
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
</style>
