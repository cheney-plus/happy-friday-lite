<template>
  <aside
    class="conversation-history"
    :style="{ '--history-width': `${fridayStore.historySidebarWidth}px` }"
    :aria-label="t('friday.historyTitle')"
  >
    <div class="history-heading">
      <span>{{ t('friday.historyTitle') }}</span>
      <button class="history-icon-btn" type="button" :title="t('friday.historyCollapse')" @click="fridayStore.setHistoryCollapsed(true)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <button class="history-icon-btn" type="button" :title="t('friday.newConversation')" @click="$emit('create')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        </svg>
      </button>
    </div>

    <label class="history-search" :class="{ focused: historySearchFocused || historySearch }">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="6.5"></circle>
        <path d="m16 16 4 4"></path>
      </svg>
      <input v-model="historySearch" type="search" :placeholder="t('friday.historySearch')" @focus="historySearchFocused = true" @blur="historySearchFocused = false" />
    </label>

    <div class="history-list">
      <div v-if="loading && !sessions.length" class="history-state">{{ t('history.loading') }}</div>
      <template v-else-if="filteredSessions.length">
        <button
          v-for="session in filteredSessions"
          :key="session.id"
          type="button"
          class="history-session"
          :class="{ active: session.id === currentSessionId }"
          :title="session.title || t('friday.untitledSession')"
          @click="$emit('select', session)"
        >
          <svg class="history-session-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="15" rx="3"></rect>
            <path d="m8 19-2 2"></path>
            <path d="M8 10h.01"></path>
            <path d="M12 10h.01"></path>
            <path d="M16 10h.01"></path>
          </svg>
          <span class="history-session-content">
            <span class="history-session-title">{{ session.title || t('friday.untitledSession') }}</span>
          </span>
          <button
            class="history-session-menu-btn"
            type="button"
            :title="t('friday.moreActions')"
            @click.stop="toggleHistorySessionMenu(session.id, $event)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5"></circle>
              <circle cx="12" cy="12" r="1.5"></circle>
              <circle cx="12" cy="19" r="1.5"></circle>
            </svg>
          </button>
        </button>
      </template>
      <div v-else class="history-state">{{ historySearch ? t('friday.historyNoMatch') : t('friday.historyEmpty') }}</div>
    </div>

    <div class="history-footer">{{ t('friday.historyFooter') }}</div>
    <div class="history-resizer" @mousedown.prevent="startHistoryResize"></div>
  </aside>

  <Teleport to="body">
    <div v-if="activeHistorySessionMenuId" class="history-session-menu-backdrop" @click="closeHistorySessionMenu">
      <div class="history-session-menu" :style="historySessionMenuStyle" @click.stop>
        <button type="button" class="history-menu-item" @click="renameHistorySession">
          <span>{{ t('history.rename') }}</span>
        </button>
        <button type="button" class="history-menu-item delete" @click="deleteHistorySession">
          <span>{{ t('history.delete') }}</span>
        </button>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="showHistoryRenameDialog" class="history-rename-overlay" @click.self="showHistoryRenameDialog = false">
      <div class="history-rename-dialog">
        <div class="history-rename-title">{{ t('history.renameTitle') }}</div>
        <input ref="historyRenameInput" v-model="historyRenameValue" class="history-rename-input" :placeholder="t('history.renamePlaceholder')" @keydown.enter="confirmHistoryRename" />
        <div class="history-rename-actions">
          <button type="button" @click="showHistoryRenameDialog = false">{{ t('history.cancel') }}</button>
          <button type="button" class="confirm" @click="confirmHistoryRename">{{ t('history.confirm') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { electronService } from '@/services/electron';
import { useFridayStore } from '@/store';

const props = defineProps({
  sessions: { type: Array, default: () => [] },
  currentSessionId: { type: String, default: '' },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['select', 'create', 'deleted', 'renamed']);

const { t } = useI18n();
const fridayStore = useFridayStore();

const historySearch = ref('');
const historySearchFocused = ref(false);
const activeHistorySessionMenuId = ref(null);
const historyRenameSessionId = ref(null);
const historySessionMenuStyle = ref({});
const showHistoryRenameDialog = ref(false);
const historyRenameValue = ref('');
const historyRenameInput = ref(null);
let historyResizeStartX = 0;
let historyResizeStartWidth = 0;

const filteredSessions = computed(() => {
  const keyword = historySearch.value.trim().toLowerCase();
  if (!keyword) return props.sessions;
  return props.sessions.filter(session => (session.title || t('friday.untitledSession')).toLowerCase().includes(keyword));
});

function toggleHistorySessionMenu(sessionId, event) {
  if (activeHistorySessionMenuId.value === sessionId) {
    activeHistorySessionMenuId.value = null;
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  activeHistorySessionMenuId.value = sessionId;
  historySessionMenuStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    right: `${window.innerWidth - rect.right}px`,
    zIndex: '10000'
  };
}

function closeHistorySessionMenu() {
  activeHistorySessionMenuId.value = null;
}

async function deleteHistorySession() {
  const sessionId = activeHistorySessionMenuId.value;
  if (!sessionId) return;
  try {
    await electronService.invoke('delete_session', { sessionId });
    fridayStore.removeHistorySession(sessionId);
    emit('deleted', sessionId);
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
  closeHistorySessionMenu();
}

async function renameHistorySession() {
  const sessionId = activeHistorySessionMenuId.value;
  const session = props.sessions.find(item => item.id === sessionId);
  if (!session) return;
  historyRenameSessionId.value = sessionId;
  closeHistorySessionMenu();
  historyRenameValue.value = session.title || '';
  showHistoryRenameDialog.value = true;
  nextTick(() => {
    historyRenameInput.value?.focus();
    historyRenameInput.value?.select();
  });
}

async function confirmHistoryRename() {
  const sessionId = historyRenameSessionId.value;
  const session = props.sessions.find(item => item.id === sessionId);
  const title = historyRenameValue.value.trim();
  if (!sessionId || !session || !title || title === session.title) {
    showHistoryRenameDialog.value = false;
    return;
  }
  try {
    await electronService.invoke('update_session_title', { sessionId, title });
    fridayStore.patchHistorySession(sessionId, { title });
    emit('renamed', { sessionId, title });
  } catch (err) {
    console.error('Failed to rename session:', err);
  }
  showHistoryRenameDialog.value = false;
}

function startHistoryResize(event) {
  historyResizeStartX = event.clientX;
  historyResizeStartWidth = fridayStore.historySidebarWidth;
  window.addEventListener('mousemove', resizeHistorySidebar);
  window.addEventListener('mouseup', stopHistoryResize);
}

function resizeHistorySidebar(event) {
  fridayStore.setHistorySidebarWidth(historyResizeStartWidth + event.clientX - historyResizeStartX);
}

function stopHistoryResize() {
  window.removeEventListener('mousemove', resizeHistorySidebar);
  window.removeEventListener('mouseup', stopHistoryResize);
  fridayStore.persistHistorySidebarWidth();
}

onUnmounted(stopHistoryResize);
</script>

<style scoped>
.conversation-history {
  width: var(--history-width, 240px);
  flex: 0 0 var(--history-width, 240px);
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 20px 12px 16px;
  background: #fbfcfb;
  border-right: 1px solid var(--border-color);
  position: relative;
}

[data-theme='dark'] .conversation-history {
  background: var(--bg-secondary);
}

.history-resizer {
  position: absolute;
  top: 0;
  right: -4px;
  bottom: 0;
  z-index: 3;
  width: 8px;
  cursor: col-resize;
}

.history-resizer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 3px;
  width: 2px;
  background: transparent;
  transition: background 0.15s ease;
}

.history-resizer:hover::after {
  background: var(--text-tertiary);
}

.history-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
}

.history-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.history-heading {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  padding: 0 8px;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 650;
}

.history-heading > span {
  margin-right: auto;
}

.history-search {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  margin: 14px 4px 10px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--text-tertiary);
  transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.history-search.focused {
  background: var(--bg-primary);
  border-color: var(--border-color);
  color: var(--text-secondary);
}

.history-search input {
  min-width: 0;
  width: 100%;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
}

.history-search input::placeholder {
  color: var(--text-primary);
  opacity: 0.72;
}

.history-search input::-webkit-search-cancel-button {
  display: none;
}

.history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-right: -8px;
  padding: 2px 8px 2px 0;
}

.history-list::-webkit-scrollbar {
  width: 4px;
}

.history-list::-webkit-scrollbar-track {
  background: transparent;
}

.history-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.history-session {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 36px;
  margin: 6px 0;
  padding: 4px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background 0.16s ease, color 0.16s ease;
}

.history-session:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.history-session.active {
  background: color-mix(in srgb, var(--text-primary) 7%, transparent);
  color: var(--text-primary);
}

.history-session-icon {
  flex: 0 0 auto;
  opacity: 0.82;
}

.history-session-content {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.history-session-title {
  overflow: hidden;
  color: inherit;
  font-size: 13px;
  font-weight: 520;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-session-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  border: 0;
  background: transparent;
  border-radius: 6px;
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: background 0.12s ease, color 0.12s ease, opacity 0.12s ease;
}

.history-session:hover .history-session-menu-btn,
.history-session-menu-btn:focus-visible {
  opacity: 1;
}

.history-session-menu-btn:hover,
.history-session-menu-btn:focus-visible {
  background: var(--bg-hover);
  color: var(--text-primary);
  outline: none;
}

.history-session-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
}

.history-session-menu {
  min-width: 120px;
  padding: 3px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  animation: historyMenuIn 0.12s ease-out;
}

@keyframes historyMenuIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.history-menu-item {
  display: block;
  width: 100%;
  padding: 7px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}

.history-menu-item:hover {
  background: var(--bg-hover);
}

.history-menu-item.delete {
  color: #ef4444;
}

.history-rename-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
}

.history-rename-dialog {
  width: min(360px, calc(100vw - 32px));
  padding: 24px;
  border-radius: 16px;
  background: var(--bg-primary);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
}

.history-rename-title {
  margin-bottom: 16px;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
}

.history-rename-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-primary);
  outline: none;
  font-family: inherit;
}

.history-rename-input:focus {
  border-color: var(--text-tertiary);
}

.history-rename-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.history-rename-actions button {
  padding: 8px 18px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.history-rename-actions button:first-child {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.history-rename-actions button.confirm {
  background: var(--text-primary);
  color: #ffffff;
}

.history-state {
  padding: 30px 10px;
  color: var(--text-primary);
  font-size: 12px;
  text-align: center;
}

.history-footer {
  margin: 12px 4px 0;
  padding-top: 13px;
  border-top: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
}

@media (max-width: 860px) {
  .conversation-history {
    display: none;
  }
}
</style>
