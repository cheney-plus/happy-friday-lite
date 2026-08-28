<template>
  <div class="history-drawer-wrapper">
    <button
      class="drawer-toggle-btn"
      :class="{ active: isOpen, hidden: isOpen }"
      @click="toggleDrawer"
      :title="t('history.title')"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    </button>

    <Transition name="drawer">
      <div v-if="isOpen" class="history-drawer">
        <div class="drawer-header">
          <span class="drawer-title">{{ t('history.title') }}</span>
          <button class="drawer-close-btn" @click="isOpen = false">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="drawer-body">
          <div v-if="loading" class="drawer-empty">
            <span>{{ t('history.loading') }}</span>
          </div>

          <div v-else-if="sessions.length === 0" class="drawer-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>{{ t('history.empty') }}</span>
          </div>

          <div v-else class="session-list">
            <div
              v-for="session in sessions"
              :key="session.id"
              class="session-item"
              @click="openSession(session)"
            >
              <div class="session-info">
                <span class="session-title">{{ session.title }}</span>
                <span class="session-time">{{ formatDateTime(session.createdAt) }}</span>
              </div>
              <button class="session-menu-btn" @click.stop="toggleMenu(session.id, $event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5"></circle>
                  <circle cx="12" cy="12" r="1.5"></circle>
                  <circle cx="12" cy="19" r="1.5"></circle>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div v-if="sessions.length > 0" class="drawer-footer" @click="goToHistoryPage">
          <span>{{ t('history.viewAll') }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>

        <Teleport to="body">
          <div
            v-if="activeMenuSessionId"
            class="session-menu-overlay"
            :style="menuStyle"
            @click.stop="closeMenu"
          >
            <div class="session-menu" @click.stop>
              <button class="menu-item delete-item" @click="handleDelete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>{{ t('history.delete') }}</span>
              </button>
              <button class="menu-item" @click="handleRename">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>{{ t('history.rename') }}</span>
              </button>
              <button class="menu-item" @click="handleSaveAsNote">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  <line x1="12" y1="6" x2="12" y2="13"></line>
                  <line x1="9" y1="10" x2="15" y2="10"></line>
                </svg>
                <span>{{ t('history.saveAsNote') }}</span>
              </button>
              <button class="menu-item" @click="handleShare">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                <span>{{ t('history.share') }}</span>
              </button>
            </div>
          </div>
        </Teleport>

      </div>
    </Transition>

    <Teleport to="body">
      <div v-if="showRenameModal" class="rename-modal-overlay" @click.self="showRenameModal = false">
        <div class="rename-modal">
          <div class="rename-modal-title">{{ t('history.renameTitle') }}</div>
          <input
            v-model="renameValue"
            class="rename-input"
            :placeholder="t('history.renamePlaceholder')"
            @keydown.enter="confirmRename"
            ref="renameInputRef"
          />
          <div class="rename-modal-actions">
            <button class="rename-cancel-btn" @click="showRenameModal = false">{{ t('history.cancel') }}</button>
            <button class="rename-confirm-btn" @click="confirmRename">{{ t('history.confirm') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="shareModal.visible" class="rename-modal-overlay" @click.self="closeShareModal">
        <div class="rename-modal share-modal">
          <div class="rename-modal-title">{{ t('history.shareTitle') }}</div>
          <div class="share-desc">{{ t('history.shareDesc', { title: shareModal.sessionTitle }) }}</div>
          <div v-if="shareModal.loading" class="share-loading">
            <span class="share-spinner"></span>
            <span>{{ t('history.shareLoading') }}</span>
          </div>
          <template v-else-if="shareModal.url">
            <div class="share-link-box">
              <input class="share-link-input" :value="shareModal.url" readonly ref="shareLinkInputRef" @click="selectShareLink" />
              <button class="share-copy-btn" :class="{ copied: shareModal.copied }" @click="copyShareLink">
                <span v-if="shareModal.copied">{{ t('history.shareCopied') }}</span>
                <span v-else>{{ t('history.shareCopy') }}</span>
              </button>
            </div>
            <div class="share-tip">{{ t('history.shareTip') }}</div>
          </template>
          <div v-else class="share-error">{{ shareModal.error || t('history.shareError') }}</div>
          <div class="rename-modal-actions">
            <button v-if="shareModal.url" class="rename-confirm-btn" @click="openShareLink">{{ t('history.shareOpen') }}</button>
            <button class="rename-cancel-btn" @click="closeShareModal">{{ t('history.close') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Transition name="toast-fade">
      <div v-if="saveToastVisible" class="save-toast">
        {{ saveToastMessage }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, onDeactivated } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { electronService } from '@/services/electron';
import { useNoteStore } from '@/store/modules/note';
import { marked } from 'marked';
import { buildConversationSummaryPrompt } from '@/config/prompts';

const emit = defineEmits(['open-session']);

const router = useRouter();
const { t } = useI18n();
const noteStore = useNoteStore();
const isOpen = ref(false);
const loading = ref(false);
const sessions = ref([]);
const activeMenuSessionId = ref(null);
const menuStyle = ref({});
const showRenameModal = ref(false);
const renameValue = ref('');
const renameInputRef = ref(null);
const renamingSessionId = ref(null);

const shareModal = ref({
  visible: false,
  loading: false,
  url: '',
  copied: false,
  sessionTitle: '',
  error: '',
  session: null
});
const shareLinkInputRef = ref(null);

const saveToastVisible = ref(false);
const saveToastMessage = ref('');

const toggleDrawer = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    loadSessions();
  }
};

const loadSessions = async () => {
  loading.value = true;
  try {
    const result = await electronService.invoke('get_sessions');
    sessions.value = (result || []).slice(0, 20);
  } catch (err) {
    console.error('Failed to load sessions:', err);
  } finally {
    loading.value = false;
  }
};

const goToHistoryPage = () => {
  router.push('/history');
  isOpen.value = false;
};

const formatDateTime = (dateStr) => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `今天 ${h}:${m}`;
    } else if (diffDays === 1) {
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `昨天 ${h}:${m}`;
    } else if (diffDays < 7) {
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${diffDays}天前 ${h}:${m}`;
    } else {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${month}/${day} ${h}:${m}`;
    }
  } catch {
    return dateStr;
  }
};

const openSession = (session) => {
  router.push({
    name: 'friday-chat',
    params: { sessionId: session.id },
    query: { mode: session.mode || 'chat', title: session.title }
  });
  isOpen.value = false;
};

const toggleMenu = (sessionId, event) => {
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();

  if (activeMenuSessionId.value === sessionId) {
    activeMenuSessionId.value = null;
    return;
  }

  activeMenuSessionId.value = sessionId;
  menuStyle.value = {
    position: 'fixed',
    top: rect.bottom + 4 + 'px',
    right: (window.innerWidth - rect.right) + 'px',
    zIndex: '10000'
  };
};

const closeMenu = () => {
  activeMenuSessionId.value = null;
};

const handleDelete = async () => {
  if (!activeMenuSessionId.value) return;
  const sessionId = activeMenuSessionId.value;
  try {
    await electronService.invoke('delete_session', { sessionId });
    sessions.value = sessions.value.filter(s => s.id !== sessionId);
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
  closeMenu();
};

const handleRename = () => {
  if (!activeMenuSessionId.value) return;
  const session = sessions.value.find(s => s.id === activeMenuSessionId.value);
  renameValue.value = session?.title || '';
  renamingSessionId.value = activeMenuSessionId.value;
  showRenameModal.value = true;
  closeMenu();
  nextTick(() => {
    if (renameInputRef.value) {
      renameInputRef.value.focus();
      renameInputRef.value.select();
    }
  });
};

const confirmRename = async () => {
  const sessionId = renamingSessionId.value;
  const newTitle = renameValue.value.trim();
  if (!sessionId || !newTitle) return;

  try {
    await electronService.invoke('update_session_title', { sessionId, title: newTitle });
    const session = sessions.value.find(s => s.id === sessionId);
    if (session) {
      session.title = newTitle;
    }
  } catch (err) {
    console.error('Failed to rename session:', err);
  }

  showRenameModal.value = false;
  renamingSessionId.value = null;
};

const showSaveToast = (message) => {
  saveToastMessage.value = message;
  saveToastVisible.value = true;
  setTimeout(() => {
    saveToastVisible.value = false;
  }, 2500);
};

const loadModelConfig = () => {
  try {
    const stored = localStorage.getItem('happy-friday-custom-models');
    if (!stored) return null;
    const models = JSON.parse(stored);
    const findById = (id) => id ? models.find(m => m.id === id) : null;
    return findById(localStorage.getItem('happy-friday-selected-model')) || models[0] || null;
  } catch (e) {
    console.error('Failed to load model config:', e);
    return null;
  }
};

const stripMarkdown = (text) => {
  return text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```.*\n?/g, ''))
    .replace(/`[^`]+`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const handleSaveAsNote = async () => {
  const sessionId = activeMenuSessionId.value;
  if (!sessionId) return;
  closeMenu();

  const model = loadModelConfig();
  if (!model) {
    showSaveToast(t('history.noModelConfig'));
    return;
  }

  showSaveToast(t('history.saveAsNoteToast'));

  try {
    const messages = await electronService.invoke('get_session_messages', { sessionId });
    if (!messages || messages.length === 0) {
      showSaveToast(t('history.noSessionContent'));
      return;
    }

    const transcript = messages
      .map(msg => {
        if (msg.role === 'user') {
          return `【用户】${msg.content}`;
        } else if (msg.role === 'assistant') {
          if (msg.content) {
            return `【周五】${msg.content}`;
          }
          if (msg.metadata && msg.metadata.segments && Array.isArray(msg.metadata.segments)) {
            const textParts = msg.metadata.segments
              .filter(s => s.type === 'text' && s.content)
              .map(s => s.content);
            return textParts.length ? `【周五】${textParts.join('\n')}` : '';
          }
          return '';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n\n');

  const prompt = buildConversationSummaryPrompt(transcript);

    const summaryRequestId = `summary_${Date.now()}`;
    let summaryContent = '';
    let summaryDone = false;
    let unlistenError = null;

    const unlistenChunk = electronService.listen('chat-chunk', (event) => {
      const data = event.payload;
      if (data.requestId !== summaryRequestId) return;
      summaryContent += data.content;
    });

    const unlistenDone = electronService.listen('chat-done', async (event) => {
      const data = event.payload;
      if (data.requestId !== summaryRequestId) return;
      if (summaryDone) return;
      summaryDone = true;

      unlistenChunk();
      unlistenDone();
      if (unlistenError) unlistenError();

      const finalContent = summaryContent || data.fullContent || '';

      if (!finalContent.trim()) {
        showSaveToast(t('history.summaryEmpty'));
        return;
      }

      try {
        const lines = finalContent.split('\n');
        let title = '对话总结';
        for (const line of lines) {
          const match = line.match(/^#\s+(.+)/);
          if (match) {
            title = match[1].trim();
            break;
          }
        }
        if (title === '对话总结') {
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              title = trimmed.slice(0, 30);
              break;
            }
          }
        }

        const htmlContent = marked.parse(finalContent);
        const plainText = stripMarkdown(finalContent);
        const note = await noteStore.importNote(null, null, title, htmlContent, plainText);
        if (note) {
          showSaveToast(t('history.saveAsNoteSuccess'));
        } else {
          showSaveToast(t('history.saveAsNoteFailed'));
        }
      } catch (err) {
        console.error('Failed to save summary note:', err);
        showSaveToast(t('history.saveAsNoteFailed'));
      }
    });

    unlistenError = electronService.listen('chat-error', (event) => {
      const data = event.payload;
      if (data.requestId !== summaryRequestId) return;
      if (summaryDone) return;
      summaryDone = true;

      unlistenChunk();
      unlistenDone();
      if (unlistenError) unlistenError();

      console.error('Summary error:', data.error);
      showSaveToast(t('history.summaryFailed'));
    });

    electronService
      .invoke('chat_without_memory', {
        requestId: summaryRequestId,
        model: model,
        message: prompt,
        enableThinking: false
      })
      .catch((err) => {
        console.error('Summary invoke error:', err);
        showSaveToast(t('history.summaryFailed'));
        unlistenChunk();
        unlistenDone();
        if (unlistenError) unlistenError();
      });
  } catch (err) {
    console.error('Failed to load session messages:', err);
    showSaveToast(t('history.loadSessionFailed'));
  }
};

const handleShare = () => {
  const sessionId = activeMenuSessionId.value;
  if (!sessionId) return;
  closeMenu();

  const session = sessions.value.find(s => s.id === sessionId);
  shareModal.value = {
    visible: true,
    loading: true,
    url: '',
    copied: false,
    sessionTitle: session?.title || '新对话',
    error: '',
    session
  };

  electronService.invoke('get-share-link', { sessionId })
    .then((result) => {
      if (result && result.success && result.url) {
        shareModal.value.loading = false;
        shareModal.value.url = result.url;
      } else {
        shareModal.value.loading = false;
        shareModal.value.error = (result && result.error) || '生成分享链接失败';
      }
    })
    .catch((err) => {
      console.error('Failed to get share link:', err);
      shareModal.value.loading = false;
      shareModal.value.error = '生成分享链接失败';
    });
};

const closeShareModal = () => {
  shareModal.value.visible = false;
  shareModal.value.url = '';
  shareModal.value.copied = false;
  shareModal.value.error = '';
  shareModal.value.session = null;
};

const selectShareLink = () => {
  if (shareLinkInputRef.value) {
    shareLinkInputRef.value.select();
  }
};

const copyShareLink = async () => {
  const url = shareModal.value.url;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    shareModal.value.copied = true;
    setTimeout(() => {
      if (shareModal.value.visible) shareModal.value.copied = false;
    }, 2000);
  } catch (err) {
    selectShareLink();
  }
};

const openShareLink = () => {
  const url = shareModal.value.url;
  if (!url) return;
  electronService.invoke('open-external', url);
};

const handleClickOutside = (e) => {
  if (showRenameModal.value) return;

  const target = e.target;

  if (activeMenuSessionId.value) {
    if (!target.closest('.session-menu') && !target.closest('.session-menu-btn')) {
      closeMenu();
    }
  }

  if (isOpen.value) {
    if (!target.closest('.history-drawer') && !target.closest('.drawer-toggle-btn') && !target.closest('.session-menu-overlay')) {
      isOpen.value = false;
    }
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true);
});

onDeactivated(() => {
  isOpen.value = false;
  showRenameModal.value = false;
});

defineExpose({ loadSessions });
</script>

<style scoped>
.history-drawer-wrapper {
  position: relative;
  display: flex;
  align-items: flex-start;
}

.drawer-toggle-btn {
  position: fixed;
  top: calc(var(--tab-bar-height, 46px) + 0px);
  right: 16px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.drawer-toggle-btn.hidden {
  opacity: 0;
  pointer-events: none;
}

.drawer-toggle-btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.drawer-toggle-btn.active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.history-drawer {
  position: fixed;
  top: calc(var(--tab-bar-height, 46px) + 12px);
  right: 12px;
  bottom: 30px;
  width: 200px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.04);
  z-index: 99;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 10px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
}

.drawer-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.drawer-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.drawer-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 16px;
  flex-shrink: 0;
  border-top: 1px solid var(--border-color);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.drawer-footer:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.drawer-body::-webkit-scrollbar {
  width: 4px;
}

.drawer-body::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 10px;
}

.drawer-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.drawer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 36px 16px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.session-item:hover {
  background: var(--bg-secondary);
}

.session-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
}

.session-time {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.2;
}

.session-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 6px;
  flex-shrink: 0;
  transition: all 0.12s ease;
  opacity: 0;
}

.session-item:hover .session-menu-btn {
  opacity: 1;
}

.session-menu-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.session-menu-overlay {
  animation: menuIn 0.12s ease-out;
}

@keyframes menuIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.session-menu {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.04);
  padding: 3px;
  min-width: 150px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 450;
  cursor: pointer;
  border-radius: 7px;
  transition: all 0.1s ease;
  text-align: left;
}

.menu-item:hover {
  background: var(--bg-hover);
}

.menu-item.delete-item {
  color: #ef4444;
}

.menu-item.delete-item:hover {
  background: #fef2f2;
}

.rename-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.rename-modal {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 24px;
  width: 360px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
  animation: modalIn 0.2s ease-out;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.rename-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.rename-input {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-primary);
  outline: none;
  transition: border-color 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.rename-input:focus {
  border-color: var(--text-tertiary);
}

.rename-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.rename-cancel-btn,
.rename-confirm-btn {
  padding: 8px 18px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.rename-cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.rename-cancel-btn:hover {
  background: var(--border-color);
}

.rename-confirm-btn {
  background: var(--text-primary);
  color: #ffffff;
}

.rename-confirm-btn:hover {
  background: var(--text-secondary);
}

.drawer-enter-active {
  animation: drawerSlideIn 0.25s ease-out;
}

.drawer-leave-active {
  animation: drawerSlideOut 0.2s ease-in;
}

@keyframes drawerSlideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes drawerSlideOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(20px);
  }
}

.share-modal {
  min-width: 400px;
}

.share-desc {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin-bottom: 16px;
}

.share-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  color: var(--text-tertiary);
  font-size: 13.5px;
}

.share-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.share-link-box {
  display: flex;
  gap: 8px;
  margin: 4px 0 0;
}

.share-link-input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12.5px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  outline: none;
  cursor: text;
}

.share-link-input:focus {
  border-color: var(--accent-color);
  background: var(--bg-primary);
}

.share-copy-btn {
  flex-shrink: 0;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent-color);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.share-copy-btn:hover {
  opacity: 0.9;
}

.share-copy-btn.copied {
  background: #16a34a;
}

.share-tip {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.share-error {
  padding: 14px;
  margin-top: 4px;
  border-radius: 8px;
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
  font-size: 13px;
}

.save-toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 24px;
  background: var(--text-primary);
  color: var(--bg-primary);
  font-size: 14px;
  font-weight: 500;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  pointer-events: none;
}

.toast-fade-enter-active {
  transition: all 0.25s ease-out;
}

.toast-fade-leave-active {
  transition: all 0.2s ease-in;
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}
</style>
