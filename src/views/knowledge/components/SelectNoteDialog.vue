<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
        <Transition name="dialog-scale">
          <div v-if="visible" class="select-note-dialog">
            <!-- 头部：标题 + 搜索 + 关闭 -->
            <div class="dialog-header">
              <div class="header-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <span>选择笔记</span>
              </div>
              <div class="header-right">
                <Transition name="search-expand">
                  <div v-if="searchExpanded" class="header-search">
                    <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      ref="searchInputRef"
                      v-model="searchQuery"
                      class="search-input"
                      type="text"
                      placeholder="搜索笔记..."
                      @keydown.escape="collapseSearch"
                      @blur="handleSearchBlur"
                    />
                    <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                </Transition>
                <button v-if="!searchExpanded" class="search-toggle" @click="expandSearch" title="搜索">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
                <button class="dialog-close" @click="$emit('close')">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            <div class="dialog-body">
              <!-- 左侧：笔记本分类 -->
              <div class="notebook-panel">
                <div class="panel-label">笔记本</div>
                <div class="notebook-list">
                  <div
                    class="notebook-item"
                    :class="{ active: selectedNotebookId === 'all' }"
                    @click="selectNotebook('all')"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    <span class="notebook-name">全部笔记</span>
                    <span class="notebook-count">{{ allNotes.length }}</span>
                  </div>
                  <div
                    v-for="nb in notebooks"
                    :key="nb.id"
                    class="notebook-item"
                    :class="{ active: selectedNotebookId === nb.id }"
                    @click="selectNotebook(nb.id)"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    <span class="notebook-name">{{ nb.name }}</span>
                    <span class="notebook-count">{{ getNoteCountByNotebook(nb.id) }}</span>
                  </div>
                </div>
              </div>

              <!-- 右侧：笔记列表 -->
              <div class="note-panel">
                <div class="note-list" v-if="filteredNotes.length > 0">
                  <div
                    v-for="note in filteredNotes"
                    :key="note.id"
                    class="note-item"
                    :class="{ selected: selectedNoteIds.includes(note.id) }"
                    @click="toggleNote(note.id)"
                  >
                    <div class="note-checkbox" :class="{ checked: selectedNoteIds.includes(note.id) }">
                      <svg v-if="selectedNoteIds.includes(note.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div class="note-info">
                      <div class="note-title">{{ note.title || '未命名笔记' }}</div>
                      <div class="note-meta">
                        <span class="meta-notebook">{{ getNotebookName(note.notebookId) }}</span>
                        <span class="meta-dot">·</span>
                        <span class="meta-time">{{ formatTime(note.updatedAt) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="note-empty">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <p>{{ searchQuery ? '未找到匹配的笔记' : '暂无笔记' }}</p>
                </div>
              </div>
            </div>

            <!-- 底部：操作栏 -->
            <div class="dialog-footer">
              <span class="selected-count" v-if="selectedNoteIds.length > 0">
                已选择 <strong>{{ selectedNoteIds.length }}</strong> 篇笔记
              </span>
              <span v-else class="selected-count placeholder">请选择要添加的笔记</span>
              <div class="footer-actions">
                <button class="btn btn-cancel" @click="$emit('close')">取消</button>
                <button
                  class="btn btn-confirm"
                  :disabled="selectedNoteIds.length === 0 || saving"
                  @click="handleConfirm"
                >
                  <svg v-if="saving" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                  </svg>
                  {{ saving ? '保存中' : '确认添加' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useNoteStore } from '@/store/modules/note';
import { useNotebookStore } from '@/store/modules/notebook';
import { formatRelativeTime as formatTime } from '../utils';

const props = defineProps({
  visible: Boolean,
  saving: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'confirm']);

const noteStore = useNoteStore();
const notebookStore = useNotebookStore();

const searchQuery = ref('');
const searchInputRef = ref(null);
const searchExpanded = ref(false);
const selectedNotebookId = ref('all');
const selectedNoteIds = ref([]);

function expandSearch() {
  searchExpanded.value = true;
  nextTick(() => {
    searchInputRef.value?.focus();
  });
}

function collapseSearch() {
  if (searchQuery.value) return;
  searchExpanded.value = false;
}

function handleSearchBlur() {
  if (!searchQuery.value) {
    searchExpanded.value = false;
  }
}

const notebooks = computed(() => notebookStore.notebooks);
const allNotes = computed(() => noteStore.notes);

const filteredNotes = computed(() => {
  let result = allNotes.value;
  if (selectedNotebookId.value !== 'all') {
    result = result.filter(n => n.notebookId === selectedNotebookId.value);
  }
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(n => {
      const title = (n.title || '').toLowerCase();
      const content = (n.contentText || n.content || '').toLowerCase();
      return title.includes(q) || content.includes(q);
    });
  }
  return result;
});

function getNoteCountByNotebook(notebookId) {
  return allNotes.value.filter(n => n.notebookId === notebookId).length;
}

function getNotebookName(notebookId) {
  if (!notebookId) return '未分类';
  const nb = notebooks.value.find(n => n.id === notebookId);
  return nb ? nb.name : '未分类';
}

function selectNotebook(id) {
  selectedNotebookId.value = id;
}

function toggleNote(noteId) {
  const idx = selectedNoteIds.value.indexOf(noteId);
  if (idx >= 0) {
    selectedNoteIds.value.splice(idx, 1);
  } else {
    selectedNoteIds.value.push(noteId);
  }
}

function handleConfirm() {
  const selected = allNotes.value.filter(n => selectedNoteIds.value.includes(n.id));
  emit('confirm', selected);
}

async function loadData() {
  await Promise.all([
    notebookStore.fetchNotebooks(),
    noteStore.fetchNotes(null, null)
  ]);
}

watch(() => props.visible, (val) => {
  if (val) {
    selectedNotebookId.value = 'all';
    selectedNoteIds.value = [];
    searchQuery.value = '';
    searchExpanded.value = false;
    loadData();
  }
});
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.select-note-dialog {
  background: var(--bg-primary, #fff);
  border-radius: 14px;
  width: 680px;
  max-width: 92vw;
  height: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border-color, rgba(0, 0, 0, 0.06));
  overflow: hidden;
}

/* ========== 头部 ========== */
.dialog-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color, #ececec);
  flex-shrink: 0;

  .header-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    flex-shrink: 0;
  }

  .header-search {
    width: 220px;
    display: flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 10px;
    background: var(--bg-secondary, #f4f4f5);
    border-radius: 8px;
    border: 1px solid transparent;
    transition: all 0.15s;
    flex-shrink: 0;

    &:focus-within {
      background: var(--bg-primary, #fff);
      border-color: var(--accent-color, #1560F7);
      box-shadow: 0 0 0 3px rgba(21, 96, 247, 0.1);
    }

    .search-icon {
      color: var(--text-tertiary, #aaa);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 13px;
      background: transparent;
      color: var(--text-primary, #333);
      font-family: inherit;

      &::placeholder {
        color: var(--text-tertiary, #b0b0b0);
      }
    }

    .search-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: var(--text-tertiary, #aaa);
      cursor: pointer;
      padding: 2px;
      border-radius: 4px;

      &:hover {
        color: var(--text-secondary, #666);
        background: var(--bg-hover, rgba(0, 0, 0, 0.06));
      }
    }
  }

  .dialog-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    background: transparent;
    color: var(--text-tertiary, #999);
    cursor: pointer;
    border-radius: 7px;
    transition: all 0.15s;
    flex-shrink: 0;

    &:hover {
      background: var(--bg-hover, #f0f0f0);
      color: var(--text-primary, #333);
    }
  }

  .search-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    background: transparent;
    color: var(--text-tertiary, #999);
    cursor: pointer;
    border-radius: 7px;
    transition: all 0.15s;
    flex-shrink: 0;

    &:hover {
      background: var(--bg-hover, #f0f0f0);
      color: var(--text-primary, #333);
    }
  }
}

.search-expand-enter-active,
.search-expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.search-expand-enter-from,
.search-expand-leave-to {
  opacity: 0;
  width: 0;
  padding: 0;
  margin-right: -6px;
}

/* ========== 主体 ========== */
.dialog-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 笔记本面板 */
.notebook-panel {
  width: 190px;
  border-right: 1px solid var(--border-color, #ececec);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--bg-secondary, #fafafa);

  .panel-label {
    padding: 12px 14px 6px;
    font-size: 11px;
    color: var(--text-tertiary, #aaa);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .notebook-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px 8px;
  }

  .notebook-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 7px;
    cursor: pointer;
    transition: all 0.12s;
    color: var(--text-secondary, #666);
    margin-bottom: 2px;

    &:hover {
      background: var(--bg-hover, rgba(0, 0, 0, 0.04));
      color: var(--text-primary, #333);
    }

    &.active {
      background: rgba(21, 96, 247, 0.1);
      color: var(--accent-color, #1560F7);
      font-weight: 500;

      .notebook-count {
        background: rgba(21, 96, 247, 0.15);
        color: var(--accent-color, #1560F7);
      }
    }

    .notebook-name {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .notebook-count {
      font-size: 10.5px;
      color: var(--text-tertiary, #aaa);
      background: var(--bg-primary, #fff);
      padding: 1px 7px;
      border-radius: 10px;
      flex-shrink: 0;
      font-weight: 500;
      min-width: 20px;
      text-align: center;
    }
  }
}

/* 笔记面板 */
.note-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;

  .note-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .note-item {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 11px 12px;
    border-radius: 9px;
    cursor: pointer;
    transition: all 0.12s;
    margin-bottom: 2px;

    &:hover {
      background: var(--bg-hover, #f5f5f5);
    }

    &.selected {
      background: rgba(21, 96, 247, 0.06);
    }

    .note-checkbox {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      border: 2px solid var(--border-color, #d4d4d8);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
      transition: all 0.15s;
      color: #fff;

      &.checked {
        background: var(--accent-color, #1560F7);
        border-color: var(--accent-color, #1560F7);
      }
    }

    .note-info {
      flex: 1;
      min-width: 0;
    }

    .note-title {
      font-size: 13.5px;
      color: var(--text-primary, #1a1a1a);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 4px;
      line-height: 1.4;
    }

    .note-meta {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11.5px;
      color: var(--text-tertiary, #999);

      .meta-dot {
        opacity: 0.6;
      }
    }
  }

  .note-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--text-tertiary, #c0c0c0);
    padding: 40px;

    p {
      margin: 0;
      font-size: 13px;
    }
  }
}

/* ========== 底部 ========== */
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 18px;
  border-top: 1px solid var(--border-color, #ececec);
  flex-shrink: 0;

  .selected-count {
    font-size: 13px;
    color: var(--text-secondary, #666);

    strong {
      color: var(--accent-color, #1560F7);
      font-weight: 600;
    }

    &.placeholder {
      color: var(--text-tertiary, #b0b0b0);
    }
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 7px 18px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-cancel {
    background: var(--bg-secondary, #f0f0f0);
    color: var(--text-secondary, #555);

    &:hover {
      background: var(--bg-hover, #e8e8e8);
      color: var(--text-primary, #333);
    }
  }

  .btn-confirm {
    background: var(--accent-color, #1560F7);
    color: #fff;

    &:hover:not(:disabled) {
      filter: brightness(1.08);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 滚动条美化 */
.notebook-list::-webkit-scrollbar,
.note-list::-webkit-scrollbar {
  width: 6px;
}

.notebook-list::-webkit-scrollbar-track,
.note-list::-webkit-scrollbar-track {
  background: transparent;
}

.notebook-list::-webkit-scrollbar-thumb,
.note-list::-webkit-scrollbar-thumb {
  background: var(--border-color, #d4d4d8);
  border-radius: 3px;

  &:hover {
    background: var(--text-tertiary, #aaa);
  }
}

/* 动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-scale-leave-active {
  transition: all 0.15s ease;
}

.dialog-scale-enter-from {
  opacity: 0;
  transform: scale(0.94) translateY(10px);
}

.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
