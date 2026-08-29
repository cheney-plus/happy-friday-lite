<template>
  <div class="history-page">
    <!-- 头部 -->
    <header class="history-header">
      <h1 class="page-title">{{ t('history.title') }}</h1>
    </header>

    <!-- 搜索栏 -->
    <div class="filter-bar">
      <div class="search-box">
        <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          :placeholder="t('history.searchPlaceholder')"
        />
        <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- 内容区（滚动层，全宽） -->
    <div class="history-scroll">
      <div class="history-content">
      <!-- 加载中 -->
      <div v-if="loading" class="state-wrap">
        <div class="loading-spinner"></div>
        <p class="state-text">{{ t('history.loading') }}</p>
      </div>

      <!-- 空状态（没有任何历史记录） -->
      <div v-else-if="allSessions.length === 0 && !hasMore" class="state-wrap">
        <svg class="state-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <p class="state-title">{{ t('history.empty') }}</p>
        <p class="state-text">{{ t('history.emptyDesc') }}</p>
      </div>

      <!-- 最近 3 个月无对话，但存在更早的历史 -->
      <div v-else-if="allSessions.length === 0 && hasMore" class="state-wrap">
        <svg class="state-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p class="state-title">{{ t('history.noRecent') }}</p>
        <p class="state-text">{{ t('history.noRecentDesc') }}</p>
      </div>

      <!-- 无搜索结果 -->
      <div v-else-if="filteredSessions.length === 0" class="state-wrap">
        <svg class="state-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <p class="state-title">{{ t('history.noResults') }}</p>
        <p class="state-text">{{ t('history.noResultsDesc') }}</p>
      </div>

      <!-- 会话列表（按日期分组） -->
      <div v-else class="session-groups">
        <!-- 多选操作栏 -->
        <div v-if="selectedIds.size > 0" class="batch-bar">
          <span class="batch-count">{{ t('history.selectedCount', { count: selectedIds.size }) }}</span>
          <button class="btn btn-text-danger btn-sm" @click="handleBatchDelete">
            {{ t('history.batchDelete') }}
          </button>
          <button class="btn btn-cancel btn-sm" @click="clearSelection">
            {{ t('history.cancel') }}
          </button>
        </div>
        <div
          v-for="group in groupedSessions"
          :key="group.label"
          class="session-group"
        >
          <div class="group-header">
            <span class="group-label">{{ group.label }}</span>
          </div>
          <div class="group-items">
            <div
              v-for="session in group.sessions"
              :key="session.id"
              class="session-row"
              :class="{ 'is-selected': selectedIds.has(session.id), 'is-multi': selectedIds.size > 0 }"
              @click="openSession(session)"
              @contextmenu.prevent="showContextMenu($event, session)"
            >
              <!-- 多选框 -->
              <span
                v-if="selectedIds.size > 0 || multiSelectMode"
                class="row-check"
                @click.stop="toggleSelect(session.id)"
              >
                <svg v-if="selectedIds.has(session.id)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <span class="row-time">{{ formatTime(session.updatedAt || session.createdAt) }}</span>
              <div class="row-content">
                <div class="row-title-wrap">
                  <svg class="row-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span class="row-title">{{ session.title || t('history.newConversation') }}</span>
                </div>
                <p class="row-preview" v-if="session.preview">{{ session.preview }}</p>
              </div>
              <!-- 三点菜单 -->
              <button
                class="row-menu-btn"
                :class="{ 'is-active': activeMenuId === session.id }"
                @click.stop="toggleMenu($event, session)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="12" cy="19" r="2"/>
                </svg>
                <!-- 下拉菜单 -->
                <div v-if="activeMenuId === session.id" class="row-menu-dropdown">
                  <button class="dropdown-item" @click.stop="enterMultiSelect(session)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="9 11 12 14 22 4"></polyline>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <span>{{ t('history.multiSelect') }}</span>
                  </button>
                  <div class="menu-divider-sm"></div>
                  <button class="dropdown-item dropdown-delete" @click.stop="handleRowMenuDelete(session)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>{{ t('history.delete') }}</span>
                  </button>
                  <button class="dropdown-item" @click.stop="handleRowMenuRename(session)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <span>{{ t('history.rename') }}</span>
                  </button>
                  <button class="dropdown-item" @click.stop="handleRowMenuSaveAsNote(session)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                      <line x1="12" y1="6" x2="12" y2="13"></line>
                      <line x1="9" y1="10" x2="15" y2="10"></line>
                    </svg>
                    <span>{{ t('history.saveAsNote') }}</span>
                  </button>
                  <button class="dropdown-item" @click.stop="handleRowMenuShare(session)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    <span>{{ t('history.share') }}</span>
                  </button>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 加载更早的历史记录 -->
      <div
        v-if="hasMore && !loading"
        class="load-more-hint"
        :class="{ 'is-loading': loadingMore }"
        @click="loadMore"
      >
        <span v-if="loadingMore" class="load-more-spinner"></span>
        <span>{{ loadingMore ? t('history.loadMoreLoading') : t('history.loadMore') }}</span>
      </div>
      <div v-else-if="!hasMore && !loading && allSessions.length > 0" class="load-more-hint">
        {{ t('history.noMoreHistory') }}
      </div>
    </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu-overlay"
        @click="closeContextMenu"
        @contextmenu.prevent="closeContextMenu"
      >
        <div
          class="context-menu"
          :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
          @click.stop
        >
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
          <button class="menu-item" @click="handleContextMenuSaveAsNote">
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
          <div class="menu-divider"></div>
          <button class="menu-item" @click="handleOpenNewTab">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14"></path>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
            <span>{{ t('history.openInNewTab') }}</span>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 重命名弹窗 -->
    <Teleport to="body">
      <div v-if="renameModal.visible" class="modal-overlay" @click.self="closeRenameModal">
        <div class="modal-box rename-modal">
          <div class="modal-title">{{ t('history.renameTitle') }}</div>
          <input
            v-model="renameModal.value"
            class="modal-input"
            :placeholder="t('history.renamePlaceholder')"
            @keydown.enter="confirmRename"
            ref="renameInputRef"
          />
          <div class="modal-actions">
            <button class="btn btn-cancel" @click="closeRenameModal">{{ t('history.cancel') }}</button>
            <button class="btn btn-confirm" @click="confirmRename">{{ t('history.confirm') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 删除确认弹窗 -->
    <Teleport to="body">
      <div v-if="deleteModal.visible" class="modal-overlay" @click.self="closeDeleteModal">
        <div class="modal-box delete-modal">
          <div class="delete-modal-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="modal-title">{{ t('history.confirmDelete') }}</div>
          <div class="modal-desc">{{ t('history.deleteWarning', { title: deleteModal.sessionTitle }) }}</div>
          <div class="modal-actions">
            <button class="btn btn-cancel" @click="closeDeleteModal">{{ t('history.cancel') }}</button>
            <button class="btn btn-danger" @click="confirmDelete">{{ t('history.delete') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 分享链接弹窗 -->
    <Teleport to="body">
      <div v-if="shareModal.visible" class="modal-overlay" @click.self="closeShareModal">
        <div class="modal-box share-modal">
          <div class="modal-title">{{ t('history.shareTitle') }}</div>
          <div class="modal-desc">{{ t('history.shareDesc', { title: shareModal.sessionTitle }) }}</div>
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
          <div class="modal-actions">
            <button v-if="shareModal.url" class="btn btn-confirm" @click="openShareLink">{{ t('history.shareOpen') }}</button>
            <button class="btn btn-cancel" @click="closeShareModal">{{ t('history.close') }}</button>
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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { electronService } from '@/services/electron';
import { useNoteStore } from '@/store/modules/note';
import { marked } from 'marked';
import { buildConversationSummaryPrompt } from '@/config/prompts';

const router = useRouter();
const { t } = useI18n();
const noteStore = useNoteStore();

const loading = ref(false);
const loadingMore = ref(false);
const allSessions = ref([]);
const searchQuery = ref('');
const activeMenuId = ref(null);
const selectedIds = ref(new Set());
const multiSelectMode = ref(false);

// 分页：每次加载 3 个月的历史记录
const MONTHS_PER_PAGE = 1;
const loadedMonths = ref(MONTHS_PER_PAGE);
const hasMore = ref(false);

// 计算「months 个月前」的 ISO 时间字符串
const getMonthsAgoISO = (months) => {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
};

const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  session: null
});

const renameModal = ref({
  visible: false,
  value: '',
  session: null
});

const deleteModal = ref({
  visible: false,
  sessionTitle: '',
  session: null
});

const shareModal = ref({
  visible: false,
  loading: false,
  url: '',
  copied: false,
  sessionTitle: '',
  error: '',
  session: null
});

const renameInputRef = ref(null);
const shareLinkInputRef = ref(null);

const saveToastVisible = ref(false);
const saveToastMessage = ref('');

// 加载最近 3 个月的会话（含统计信息）
const loadSessions = async () => {
  loading.value = true;
  try {
    const startDate = getMonthsAgoISO(MONTHS_PER_PAGE);
    const result = await electronService.invoke('get_sessions_with_stats', { startDate });
    allSessions.value = result?.sessions || [];
    hasMore.value = !!result?.hasMore;
    loadedMonths.value = MONTHS_PER_PAGE;
  } catch (err) {
    console.error('Failed to load sessions:', err);
    allSessions.value = [];
    hasMore.value = false;
  } finally {
    loading.value = false;
  }
};

// 加载更早的 3 个月历史记录
const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return;
  loadingMore.value = true;
  try {
    const previousMonths = loadedMonths.value;
    const newLoadedMonths = previousMonths + MONTHS_PER_PAGE;
    const newStartDate = getMonthsAgoISO(newLoadedMonths);
    const endDate = getMonthsAgoISO(previousMonths);
    const result = await electronService.invoke('get_sessions_with_stats', {
      startDate: newStartDate,
      endDate
    });
    const newSessions = result?.sessions || [];
    // 合并并去重
    const existingIds = new Set(allSessions.value.map(s => s.id));
    const merged = [...allSessions.value];
    for (const s of newSessions) {
      if (!existingIds.has(s.id)) {
        merged.push(s);
      }
    }
    merged.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    allSessions.value = merged;
    loadedMonths.value = newLoadedMonths;
    hasMore.value = !!result?.hasMore;
  } catch (err) {
    console.error('Failed to load more sessions:', err);
  } finally {
    loadingMore.value = false;
  }
};

// 过滤后的会话列表
const filteredSessions = computed(() => {
  let result = allSessions.value;

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    result = result.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.preview || '').toLowerCase().includes(q)
    );
  }

  return result;
});

// 按日期分组
const groupedSessions = computed(() => {
  const groups = [];
  const map = new Map();

  for (const session of filteredSessions.value) {
    const d = new Date(session.updatedAt || session.createdAt);
    const key = formatDateFull(d);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(session);
  }

  // 按日期降序排列
  const sortedKeys = Array.from(map.keys()).sort((a, b) => {
    return new Date(b) - new Date(a);
  });

  for (const key of sortedKeys) {
    groups.push({ label: key, sessions: map.get(key) });
  }

  return groups;
});

// 格式化时间（HH:MM）
const formatTime = (dateStr) => {
  try {
    const d = new Date(dateStr);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
};

// 格式化完整中文日期（2026年5月16日）
const formatDateFull = (date) => {
  try {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}年${month}月${day}日`;
  } catch {
    return '';
  }
};

// 在新标签页打开会话
const openSession = (session) => {
  if (selectedIds.value.size > 0) return;
  router.push({
    name: 'friday-chat',
    params: { sessionId: session.id },
    query: { mode: session.mode || 'chat', title: session.title || '' }
  });
};

// 三点菜单
const toggleMenu = (event, session) => {
  if (activeMenuId.value === session.id) {
    activeMenuId.value = null;
  } else {
    activeMenuId.value = session.id;
  }
};

const closeRowMenu = () => {
  activeMenuId.value = null;
};

const handleRowMenuRename = (session) => {
  renameModal.value = {
    visible: true,
    value: session.title || '',
    session
  };
  closeRowMenu();
  nextTick(() => {
    if (renameInputRef.value) {
      renameInputRef.value.focus();
      renameInputRef.value.select();
    }
  });
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

const handleRowMenuSaveAsNote = async (session) => {
  closeRowMenu();
  const model = loadModelConfig();
  if (!model) {
    showSaveToast('未配置大模型');
    return;
  }
  showSaveToast(t('history.saveAsNoteToast'));

  try {
    const messages = await electronService.invoke('get_session_messages', { sessionId: session.id });
    if (!messages || messages.length === 0) {
      showSaveToast('暂无对话内容');
      return;
    }

    const transcript = messages
      .map(msg => {
        if (msg.role === 'user') return `【用户】${msg.content}`;
        if (msg.role === 'assistant') {
          if (msg.content) return `【周五】${msg.content}`;
          if (msg.metadata?.segments) {
            const textParts = msg.metadata.segments.filter(s => s.type === 'text' && s.content).map(s => s.content);
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

    const cleanup = () => {
      unlistenChunk();
      unlistenDone();
      if (unlistenError) unlistenError();
    };

    const unlistenDone = electronService.listen('chat-done', async (event) => {
      const data = event.payload;
      if (data.requestId !== summaryRequestId || summaryDone) return;
      summaryDone = true;
      cleanup();

      const finalContent = summaryContent || data.fullContent || '';
      if (!finalContent.trim()) {
        showSaveToast(t('history.saveAsNoteFailed'));
        return;
      }

      try {
        const lines = finalContent.split('\n');
        let title = '对话总结';
        for (const line of lines) {
          const match = line.match(/^#\s+(.+)/);
          if (match) { title = match[1].trim(); break; }
        }
        if (title === '对话总结') {
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) { title = trimmed.slice(0, 30); break; }
          }
        }

        const htmlContent = marked.parse(finalContent);
        const plainText = stripMarkdown(finalContent);
        const note = await noteStore.importNote(null, null, title, htmlContent, plainText);
        showSaveToast(note ? t('history.saveAsNoteSuccess') : t('history.saveAsNoteFailed'));
      } catch (err) {
        console.error('Failed to save note:', err);
        showSaveToast(t('history.saveAsNoteFailed'));
      }
    });

    unlistenError = electronService.listen('chat-error', (event) => {
      const data = event.payload;
      if (data.requestId !== summaryRequestId || summaryDone) return;
      summaryDone = true;
      cleanup();
      showSaveToast(t('history.saveAsNoteFailed'));
    });

    electronService.invoke('chat_without_memory', {
      requestId: summaryRequestId,
      model,
      message: prompt,
      enableThinking: false
    }).catch(() => {
      if (!summaryDone) {
        summaryDone = true;
        cleanup();
        showSaveToast(t('history.saveAsNoteFailed'));
      }
    });
  } catch (err) {
    console.error('Failed to load session messages:', err);
    showSaveToast('加载对话失败');
  }
};

const handleRowMenuDelete = (session) => {
  deleteModal.value = {
    visible: true,
    sessionTitle: session.title || t('history.newConversation'),
    session
  };
  closeRowMenu();
};

// 分享
const handleRowMenuShare = (session) => {
  closeRowMenu();
  openShareModal(session);
};

const handleShare = () => {
  const session = contextMenu.value.session;
  if (!session) return;
  closeContextMenu();
  openShareModal(session);
};

const openShareModal = async (session) => {
  shareModal.value = {
    visible: true,
    loading: true,
    url: '',
    copied: false,
    sessionTitle: session.title || t('history.newConversation'),
    error: '',
    session
  };
  try {
    const result = await electronService.invoke('get-share-link', { sessionId: session.id });
    if (result && result.success && result.url) {
      shareModal.value.loading = false;
      shareModal.value.url = result.url;
    } else {
      shareModal.value.loading = false;
      shareModal.value.error = (result && result.error) || t('history.shareError');
    }
  } catch (err) {
    console.error('Failed to get share link:', err);
    shareModal.value.loading = false;
    shareModal.value.error = t('history.shareError');
  }
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
    // clipboard API 不可用时回退到选中文本手动复制
    selectShareLink();
  }
};

const openShareLink = () => {
  const url = shareModal.value.url;
  if (!url) return;
  electronService.invoke('open-external', url);
};

// 多选
const enterMultiSelect = (session) => {
  closeRowMenu();
  multiSelectMode.value = true;
  selectedIds.value = new Set([session.id]);
};

const toggleSelect = (id) => {
  const newSet = new Set(selectedIds.value);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  selectedIds.value = newSet;
};

const clearSelection = () => {
  selectedIds.value = new Set();
  multiSelectMode.value = false;
};

const handleBatchDelete = async () => {
  const count = selectedIds.value.size;
  deleteModal.value = {
    visible: true,
    sessionTitle: `${count} ${t('history.items')}`,
    session: null,
    isBatch: true
  };
};

const confirmBatchDelete = async () => {
  try {
    for (const id of selectedIds.value) {
      await electronService.invoke('delete_session', { sessionId: id });
    }
    allSessions.value = allSessions.value.filter(s => !selectedIds.value.has(s.id));
  } catch (err) {
    console.error('Failed to batch delete sessions:', err);
  }
  clearSelection();
  closeDeleteModal();
};

// 右键菜单
const showContextMenu = (event, session) => {
  const menuWidth = 180;
  const menuHeight = 160;
  const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
  const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
  contextMenu.value = {
    visible: true,
    x,
    y,
    session
  };
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

const handleOpenNewTab = () => {
  const session = contextMenu.value.session;
  if (session) openSession(session);
  closeContextMenu();
};

// 右键菜单-保存为笔记
const handleContextMenuSaveAsNote = () => {
  const session = contextMenu.value.session;
  if (!session) return;
  closeContextMenu();
  handleRowMenuSaveAsNote(session);
};

// 重命名
const handleRename = () => {
  const session = contextMenu.value.session;
  if (!session) return;
  renameModal.value = {
    visible: true,
    value: session.title || '',
    session
  };
  closeContextMenu();
  nextTick(() => {
    if (renameInputRef.value) {
      renameInputRef.value.focus();
      renameInputRef.value.select();
    }
  });
};

const closeRenameModal = () => {
  renameModal.value.visible = false;
  renameModal.value.session = null;
};

const confirmRename = async () => {
  const session = renameModal.value.session;
  const newTitle = renameModal.value.value.trim();
  if (!session || !newTitle) return;

  try {
    await electronService.invoke('update_session_title', { sessionId: session.id, title: newTitle });
    session.title = newTitle;
  } catch (err) {
    console.error('Failed to rename session:', err);
  }
  closeRenameModal();
};

// 删除
const handleDelete = () => {
  const session = contextMenu.value.session;
  if (!session) return;
  deleteModal.value = {
    visible: true,
    sessionTitle: session.title || t('history.newConversation'),
    session
  };
  closeContextMenu();
};

const closeDeleteModal = () => {
  deleteModal.value.visible = false;
  deleteModal.value.session = null;
};

const confirmDelete = async () => {
  if (deleteModal.value.isBatch) {
    await confirmBatchDelete();
    return;
  }
  const session = deleteModal.value.session;
  if (!session) return;

  try {
    await electronService.invoke('delete_session', { sessionId: session.id });
    allSessions.value = allSessions.value.filter(s => s.id !== session.id);
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
  closeDeleteModal();
};

// 监听会话标题更新事件
let unlistenTitleUpdate = null;

onMounted(async () => {
  await loadSessions();

  unlistenTitleUpdate = electronService.listen('session-title-updated', (event) => {
    const data = event.payload;
    if (data && data.sessionId) {
      const session = allSessions.value.find(s => s.id === data.sessionId);
      if (session) {
        session.title = data.title;
      }
    }
  });

  // 点击外部关闭下拉菜单
  document.addEventListener('click', handleGlobalClick);
});

const handleGlobalClick = (e) => {
  if (activeMenuId.value !== null && !e.target.closest('.row-menu-btn') && !e.target.closest('.row-menu-dropdown')) {
    activeMenuId.value = null;
  }
};

onUnmounted(() => {
  if (unlistenTitleUpdate) {
    unlistenTitleUpdate();
  }
  document.removeEventListener('click', handleGlobalClick);
});
</script>

<style scoped>
.history-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  overflow: hidden;
}

/* ========== 头部 ========== */
.history-header {
  width: 100%;
  max-width: 720px;
  padding: 28px 24px 0;
  box-sizing: border-box;
  flex-shrink: 0;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.03em;
}

/* ========== 搜索栏 ========== */
.filter-bar {
  width: 100%;
  max-width: 720px;
  padding: 16px 24px 8px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 400px;
  margin: 0 auto;
  padding: 9px 14px;
  background: var(--bg-secondary);
  border: 1.5px solid transparent;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.search-box:focus-within {
  border-color: var(--border-color);
  background: var(--bg-primary);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.search-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13.5px;
  color: var(--text-primary);
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  transition: all 0.15s;
}

.clear-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ========== 滚动层（全宽，滚动条靠窗边） ========== */
.history-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
}

.history-scroll::-webkit-scrollbar {
  width: 5px;
}

.history-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.history-scroll::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.history-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* ========== 内容区（居中） ========== */
.history-content {
  width: 100%;
  max-width: 720px;
  padding: 0 24px 32px;
  box-sizing: border-box;
  margin: 0 auto;
}

/* 状态占位 */
.state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 12px;
}

.state-icon {
  color: var(--text-tertiary);
  opacity: 0.5;
}

.state-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}

.state-text {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ========== 加载更多 ========== */
.load-more-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  padding: 16px 0 8px;
  font-size: 12.5px;
  color: var(--text-tertiary);
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease;
}

.load-more-hint:hover {
  color: var(--accent-color);
}

.load-more-hint.is-loading {
  cursor: default;
  pointer-events: none;
}

.load-more-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ========== 分组列表 ========== */
.session-groups {
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.session-group {
  margin-bottom: 8px;
  width: 100%;
}

.group-header {
  padding: 18px 4px 10px;
}

.group-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.group-items {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ========== 会话行（核心设计） ========== */
.session-row {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 14px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
  width: 100%;
  box-sizing: border-box;
}

.session-row:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.session-row:active {
  background: var(--bg-active);
}

.row-time {
  flex-shrink: 0;
  width: 44px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  line-height: 22px;
  font-variant-numeric: tabular-nums;
}

.row-content {
  flex: 1;
  min-width: 0;
}

.row-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
}

.row-icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
  margin-top: 1px;
}

.row-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 22px;
}

.row-preview {
  margin: 4px 0 0 24px;
  font-size: 12.5px;
  color: var(--text-tertiary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* ========== 多选操作栏 ========== */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  margin-bottom: 8px;
  width: 100%;
  max-width: 720px;
  box-sizing: border-box;
}

.batch-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  flex: 1;
}

/* ========== 多选框 ========== */
.row-check {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: transparent;
  margin-top: 2px;
}

.row-check:hover {
  border-color: var(--text-tertiary);
}

.session-row.is-selected > .row-check {
  background: var(--text-primary);
  border-color: var(--text-primary);
  color: #fff;
}

/* ========== 三点菜单按钮 ========== */
.row-menu-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
  opacity: 0;
}

.session-row:hover .row-menu-btn,
.row-menu-btn.is-active {
  opacity: 1;
}

.row-menu-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.row-menu-btn.is-active {
  color: var(--text-primary);
}

/* ========== 三点下拉菜单 ========== */
.row-menu-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 100;
  min-width: 130px;
  padding: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.05);
  animation: dropdownIn 0.12s ease;
}

@keyframes dropdownIn {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  border-radius: 5px;
  transition: background 0.12s;
}

.dropdown-item:hover {
  background: var(--bg-hover);
}

.dropdown-delete {
  color: #dc2626;
}

.dropdown-delete:hover {
  background: rgba(220, 38, 38, 0.08);
}

.menu-divider-sm {
  height: 1px;
  margin: 3px 6px;
  background: var(--border-color);
}

/* ========== 选中状态 ========== */
.session-row.is-selected {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.session-row.is-multi {
  cursor: default;
}

.session-row.is-multi:hover:not(.is-selected) {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

/* ========== 按钮尺寸变体 ========== */
.btn-sm {
  padding: 5px 14px;
  font-size: 12.5px;
}

/* ========== 右键菜单 ========== */
.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 172px;
  padding: 5px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  animation: menuIn 0.12s ease;
}

@keyframes menuIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.12s;
}

.menu-item:hover {
  background: var(--bg-hover);
}

.delete-item {
  color: #dc2626;
}

.delete-item:hover {
  background: rgba(220, 38, 38, 0.08);
}

.menu-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--border-color);
}

/* ========== 弹窗通用样式 ========== */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-box {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 24px;
  min-width: 360px;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: modalIn 0.2s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.modal-input {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.18s;
  box-sizing: border-box;
}

.modal-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.modal-desc {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-confirm {
  background: var(--accent-color);
  color: #fff;
}

.btn-confirm:hover {
  opacity: 0.9;
}

.btn-danger {
  background: #dc2626;
  color: #fff;
}

.btn-danger:hover {
  opacity: 0.9;
}

.btn-text-danger {
  background: transparent;
  color: #dc2626;
}

.btn-text-danger:hover {
  background: rgba(220, 38, 38, 0.08);
}

/* 删除弹窗特殊样式 */
.delete-modal {
  text-align: center;
  min-width: 340px;
}

.delete-modal-icon {
  color: #f59e0b;
  margin-bottom: 12px;
}

/* ========== 分享弹窗 ========== */
.share-modal {
  min-width: 420px;
  max-width: 480px;
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
  font-family: inherit;
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
