<template>
  <div class="note-edit" :class="{ 'is-dark': isDark }">
    <div class="note-edit-header">
      <div class="header-left">
        <button v-if="!isShareMode" class="header-btn" @click="goBack" :title="t('note.back')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
      </div>

      <div class="header-center">
        <div class="note-title-display">
          {{ noteTitle || '新建笔记' }}
        </div>
      </div>

      <div class="header-right">
        <span v-if="!isShareMode" class="save-status" :class="{ saved: isSaved }">
          <svg v-if="isSaved" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>
          {{ isSaved ? t('note.saved') : t('note.unsaved') }}
        </span>
        <button v-if="!isShareMode" class="header-btn" :title="t('note.export')" @click="handleExport">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        </button>
        <button v-if="!isShareMode" class="header-btn" :title="t('note.more')" @click="toggleMoreMenu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
        </button>
      </div>

      <Teleport to="body">
        <div v-if="moreMenuVisible" class="note-more-menu" :style="moreMenuStyle">
          <div class="more-menu-item" @click="handleCopyContent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            {{ t('note.copyMarkdown') }}
          </div>
          <div class="more-menu-divider"></div>
          <div class="more-menu-item danger" @click="handleDelete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            {{ t('note.delete') }}
          </div>
        </div>
      </Teleport>
    </div>

    <div class="note-edit-body">
      <NoteEditor
        v-model="noteContent"
        :placeholder="t('note.editorPlaceholder')"
        :note-id="noteId"
        :share-mode="isShareMode"
        @change="onEditorChange"
      />
    </div>

    <div v-if="!isShareMode" class="note-edit-footer">
      <div class="footer-left">
        <span class="word-count">{{ wordCount }} {{ t('note.words') }}</span>
        <span class="char-count">{{ charCount }} {{ t('note.characters') }}</span>
      </div>
      <div class="footer-right">
        <span class="note-id" v-if="noteId">ID: {{ noteId }}</span>
        <span class="last-saved" v-if="lastSavedTime">{{ t('note.lastSaved') }} {{ lastSavedTime }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch, onDeactivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/store';
import { useNoteStore } from '@/store/modules/note';
import { isElectronEnvironment } from '@/config/menu';
import NoteEditor from './NoteEditor.vue';
import { extractPlainText } from '@/utils/text';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const appStore = useAppStore();
const noteStore = useNoteStore();

const noteId = computed(() => route.params.id);
// 分享模式：通过分享链接在浏览器中打开（只读查看），复用笔记界面
const isShareMode = computed(() => route.meta?.share === true || !isElectronEnvironment());
const isDark = computed(() => appStore.theme === 'dark');
const noteTitle = ref('');
const noteContent = ref('');
const isSaved = ref(true);
const wordCount = ref(0);
const charCount = ref(0);
const lastSavedTime = ref('');
const moreMenuVisible = ref(false);
const moreMenuStyle = reactive({ left: '0px', top: '0px' });

const onEditorChange = (content) => {
  noteContent.value = content;
  const plainText = extractPlainText(content);
  const normalizedText = plainText.replace(/\s+/g, ' ').trim();

  const firstLine = (plainText.split('\n').find(line => line.trim() !== '') || '').trim();
  noteTitle.value = firstLine ? (firstLine.length > 20 ? firstLine.substring(0, 20) : firstLine) : '新建笔记';

  updateStats(normalizedText);
  isSaved.value = false;
  scheduleSave(normalizedText);
};

const updateStats = (normalizedText) => {
  wordCount.value = normalizedText ? normalizedText.split(/\s+/).filter(Boolean).length : 0;
  charCount.value = normalizedText.length;
};

const scheduleSave = (normalizedText) => {
  const id = noteId.value;
  if (!id) return;
  const contentText = normalizedText !== undefined
    ? normalizedText
    : extractPlainText(noteContent.value).replace(/\s+/g, ' ').trim();
  noteStore.scheduleSave(id, noteTitle.value, noteContent.value, contentText);
  isSaved.value = false;
};

const goBack = async () => {
  await noteStore.flushPendingSave();
  router.push({ name: 'note' });
};

const handleExport = () => {
  const blob = new Blob([noteContent.value], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${noteTitle.value || t('note.untitled')}.md`;
  a.click();
  URL.revokeObjectURL(url);
};

const toggleMoreMenu = async (e) => {
  if (moreMenuVisible.value) {
    moreMenuVisible.value = false;
    return;
  }
  const target = e.currentTarget;
  const rect = target.getBoundingClientRect();
  moreMenuStyle.left = `${rect.right - 180}px`;
  moreMenuStyle.top = `${rect.bottom + 4}px`;
  moreMenuVisible.value = true;
};

const handleCopyContent = () => {
  navigator.clipboard.writeText(noteContent.value);
  moreMenuVisible.value = false;
};

const handleDelete = async () => {
  moreMenuVisible.value = false;
  const id = noteId.value;
  if (id) {
    await noteStore.deleteNote(id);
  }
  router.push({ name: 'note' });
};

const handleClickOutside = () => {
  if (moreMenuVisible.value) {
    moreMenuVisible.value = false;
  }
};

watch(() => noteStore.saving, (saving) => {
  if (!saving) {
    isSaved.value = true;
    lastSavedTime.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
});

onMounted(async () => {
  document.addEventListener('click', handleClickOutside);
  const id = noteId.value;
  if (!id) return;

  if (isShareMode.value) {
    // 分享模式：通过 HTTP 接口加载笔记内容（浏览器环境下无 IPC）
    try {
      const res = await fetch(`/api/share/note/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data && data.success && data.note) {
        noteTitle.value = data.note.title || '未命名笔记';
        noteContent.value = data.note.content || '';
      }
    } catch (err) {
      console.error('Failed to load share note:', err);
    }
    return;
  }

  const note = await noteStore.fetchNote(id);
  if (note) {
    noteTitle.value = note.title;
    noteContent.value = note.content;
    updateStats(extractPlainText(noteContent.value).replace(/\s+/g, ' ').trim());
  }
});

onBeforeUnmount(async () => {
  document.removeEventListener('click', handleClickOutside);
  if (!isShareMode.value) {
    await noteStore.flushPendingSave();
  }
});

onDeactivated(() => {
  moreMenuVisible.value = false;
});
</script>

<style scoped>
.note-edit {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-primary);
}

.note-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-color);
  gap: 12px;
  min-height: 48px;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background-color: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.header-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 0;
}

.note-title-display {
  width: 100%;
  max-width: 480px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  text-align: center;
  padding: 6px 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.save-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 4px 8px;
  border-radius: 4px;
  user-select: none;
}

.save-status.saved {
  color: #22c55e;
}

.note-edit-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-bottom: 16px;
}

.note-edit-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-tertiary);
  user-select: none;
}

.footer-left,
.footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.note-more-menu {
  position: fixed;
  z-index: 99999;
  background-color: var(--bg-primary);
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.08);
  padding: 6px 0;
  min-width: 180px;
  animation: menu-in 0.12s ease-out;
}

[data-theme='dark'] .note-more-menu {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.2);
}

@keyframes menu-in {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.more-menu-item {
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

.more-menu-item:hover {
  background-color: var(--bg-hover);
}

.more-menu-item.danger {
  color: #ef4444;
}

.more-menu-item svg {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.more-menu-item.danger svg {
  color: #ef4444;
}

.more-menu-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 4px 12px;
}
</style>
