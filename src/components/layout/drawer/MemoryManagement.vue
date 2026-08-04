<template>
  <div class="memory-management">
    <!-- Header (fixed, no scroll) -->
    <div class="panel-header">
      <h2 class="section-title">{{ t('drawer.memory.title') }}</h2>
      <button class="close-btn" @click="emit('close')">
        <X :size="16" :stroke-width="2" />
      </button>
    </div>

    <!-- Scrollable body -->
    <div class="panel-body">
      <!-- ============ Friday 拟人 ID 卡片 ============ -->
      <div class="memory-section">
        <h3 class="subsection-title">{{ t('drawer.memory.fridayCard') }}</h3>
        <div class="friday-card">
          <div class="friday-avatar-wrap">
            <img
              v-if="currentAvatar?.dataUrl"
              :src="currentAvatar.dataUrl"
              class="friday-avatar"
              :alt="t('drawer.memory.fridayName')"
            />
            <div v-else class="friday-avatar fallback">
              <Brain :size="36" :stroke-width="1.4" />
            </div>
            <span
              v-if="currentAvatar?.rarity === 'rare'"
              class="rarity-badge rare"
              :title="t('drawer.memory.rare')"
            >
              <Crown :size="10" :stroke-width="2.2" />
            </span>
          </div>
          <div class="friday-info">
            <div class="info-row">
              <span class="info-label">{{ t('drawer.memory.name') }}</span>
              <span class="info-value name">{{ t('drawer.memory.fridayName') }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('drawer.memory.birthDate') }}</span>
              <span class="info-value">{{ t('drawer.memory.fridayBirthDate') }}</span>
            </div>
          </div>
          <!-- 已获头像入口：点击打开面板展示所有已获得的头像 -->
          <button
            class="obtained-btn"
            :disabled="avatarLoading"
            @click="avatarPanelVisible = true"
          >
            <Images :size="14" :stroke-width="1.8" />
            <span class="obtained-label">{{ t('drawer.memory.avatarHistory') }}</span>
            <span class="obtained-count">{{ avatarHistory.length }}</span>
            <ChevronRight :size="14" :stroke-width="2" class="obtained-arrow" />
          </button>
        </div>
      </div>

      <!-- ============ 记忆文件 ============ -->
      <div class="memory-section">
        <h3 class="subsection-title">{{ t('drawer.memory.memoryFiles') }}</h3>
        <div class="section-hint">{{ t('drawer.memory.memoryFilesHint') }}</div>

        <div v-if="memoryLoading" class="empty-hint">{{ t('drawer.memory.loading') }}</div>
        <div v-else class="memory-grid">
          <button
            v-for="mf in memoryFiles"
            :key="mf.fileName"
            class="memory-card"
            @click="openEdit(mf)"
          >
            <div class="memory-card-head">
              <span class="memory-icon">
                <component :is="fileIcon(mf.nameKey)" :size="16" :stroke-width="1.8" />
              </span>
              <span class="memory-filename">{{ mf.fileName }}</span>
              <span class="memory-edit">
                <Pencil :size="12" :stroke-width="2" />
              </span>
            </div>
            <div class="memory-card-title">{{ t(`drawer.memory.files.${mf.nameKey}`) }}</div>
            <div class="memory-card-desc">{{ t(`drawer.memory.files.${mf.descKey}`) }}</div>
            <div class="memory-card-meta">
              <span>{{ mf.content.length }} {{ t('drawer.memory.words') }}</span>
              <span v-if="mf.updatedAt" class="dot">·</span>
              <span v-if="mf.updatedAt">{{ formatTime(mf.updatedAt) }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Transient notice -->
    <Transition name="menu-fade">
      <div v-if="notice" class="notice" :class="notice.type">{{ notice.text }}</div>
    </Transition>

    <!-- Edit memory file modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="editModal.visible" class="mm-modal-overlay" @click.self="closeEdit">
          <div class="mm-modal">
            <div class="modal-header">
              <div class="modal-title-row">
                <component
                  :is="fileIcon(editModal.nameKey)"
                  :size="15"
                  :stroke-width="1.8"
                  class="modal-title-icon"
                />
                <h3 class="modal-title">
                  {{ t('drawer.memory.editTitle') }}
                  <span class="modal-title-file">{{ editModal.fileName }}</span>
                </h3>
              </div>
              <button class="modal-close" @click="closeEdit">
                <X :size="16" :stroke-width="2" />
              </button>
            </div>

            <div class="modal-body">
              <div class="mode-switch">
                <button
                  class="mode-btn"
                  :class="{ active: editModal.mode === 'edit' }"
                  @click="editModal.mode = 'edit'"
                >
                  <Pencil :size="12" :stroke-width="2" />
                  {{ t('drawer.memory.editMode') }}
                </button>
                <button
                  class="mode-btn"
                  :class="{ active: editModal.mode === 'preview' }"
                  @click="editModal.mode = 'preview'"
                >
                  <Eye :size="12" :stroke-width="2" />
                  {{ t('drawer.memory.previewMode') }}
                </button>
              </div>

              <textarea
                v-if="editModal.mode === 'edit'"
                v-model="editModal.content"
                class="md-textarea"
                spellcheck="false"
              ></textarea>
              <div v-else class="md-preview" v-html="previewHtml"></div>
            </div>

            <div class="modal-footer">
              <span class="footer-count">
                {{ editModal.content.length }} {{ t('drawer.memory.words') }}
              </span>
              <div class="footer-actions">
                <button class="modal-btn cancel" :disabled="editModal.saving" @click="closeEdit">
                  {{ t('drawer.memory.cancel') }}
                </button>
                <button
                  class="modal-btn confirm"
                  :disabled="editModal.saving"
                  @click="saveEdit"
                >
                  {{ editModal.saving ? t('drawer.memory.loading') : t('drawer.memory.save') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 已获头像面板 -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="avatarPanelVisible"
          class="mm-modal-overlay"
          @click.self="avatarPanelVisible = false"
        >
          <div class="mm-modal avatar-panel">
            <div class="modal-header">
              <div class="modal-title-row">
                <Images :size="15" :stroke-width="1.8" class="modal-title-icon" />
                <h3 class="modal-title">
                  {{ t('drawer.memory.avatarHistory') }}
                  <span class="modal-title-file">{{ avatarHistory.length }}</span>
                </h3>
              </div>
              <button class="modal-close" @click="avatarPanelVisible = false">
                <X :size="16" :stroke-width="2" />
              </button>
            </div>

            <div class="modal-body avatar-panel-body">
              <div class="section-hint">{{ t('drawer.memory.avatarHistoryHint') }}</div>

              <div v-if="avatarLoading" class="empty-hint">{{ t('drawer.memory.loading') }}</div>
              <div v-else-if="avatarHistory.length" class="avatar-grid">
                <button
                  v-for="av in avatarHistory"
                  :key="av.name"
                  class="avatar-chip"
                  :class="{
                    active: av.name === currentAvatar?.name,
                    rare: av.rarity === 'rare'
                  }"
                  :title="av.name"
                  @click="handleSwitchAvatar(av.name)"
                >
                  <img :src="av.dataUrl" :alt="av.name" class="avatar-img" />
                  <span v-if="av.rarity === 'rare'" class="chip-rare-mark">
                    <Crown :size="9" :stroke-width="2.4" />
                  </span>
                  <span class="avatar-name">{{ av.name }}</span>
                  <span
                    v-if="av.name === currentAvatar?.name"
                    class="chip-current"
                  >{{ t('drawer.memory.currentAvatar') }}</span>
                </button>
              </div>
              <div v-else class="empty-hint">{{ t('drawer.memory.noAvatarHistory') }}</div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { marked } from 'marked';
import {
  Brain, X, Pencil, Eye, Crown, Sparkles, User, BookOpen, Wrench,
  Images, ChevronRight
} from 'lucide-vue-next';

const { t } = useI18n();

const emit = defineEmits(['close']);

// ---- Friday 卡片 & 头像历史 ----
const currentAvatar = ref(null);
const avatarHistory = ref([]);
const avatarLoading = ref(false);
const avatarPanelVisible = ref(false);

// ---- 记忆文件 ----
const memoryFiles = ref([]);
const memoryLoading = ref(false);

// ---- 编辑弹窗 ----
const editModal = ref({
  visible: false,
  fileName: '',
  nameKey: '',
  content: '',
  mode: 'edit',
  saving: false
});

// ---- 通知 ----
const notice = ref(null);
let noticeTimer = null;

// ---- config-changed 监听（外部 set_avatar 更新头像时刷新）----
let unlistenConfig = null;

marked.setOptions({ breaks: true, gfm: true });

const showNotice = (text, type = 'info') => {
  notice.value = { text, type };
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = null;
  }, 2800);
};

const previewHtml = computed(() => {
  try {
    return marked.parse(editModal.value.content || '');
  } catch (_e) {
    return editModal.value.content || '';
  }
});

// 记忆文件名 → 图标映射
const ICON_MAP = {
  SOUL: Sparkles,
  USER: User,
  MEMORY: BookOpen,
  Agent: Wrench
};
const fileIcon = (nameKey) => ICON_MAP[nameKey] || Brain;

// 时间格式化：ISO → 简短显示
const formatTime = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (_e) {
    return '';
  }
};

// ============ 数据加载 ============

const loadAvatarHistory = async () => {
  avatarLoading.value = true;
  try {
    const res = await window.electronAPI?.invoke('agent-get-avatar-history');
    if (res) {
      currentAvatar.value = res.current || null;
      avatarHistory.value = Array.isArray(res.history) ? res.history : [];
    }
  } catch (e) {
    console.error('load avatar history failed', e);
  } finally {
    avatarLoading.value = false;
  }
};

const loadMemoryFiles = async () => {
  memoryLoading.value = true;
  try {
    const list = await window.electronAPI?.invoke('agent-list-memories');
    memoryFiles.value = Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('load memory files failed', e);
    memoryFiles.value = [];
  } finally {
    memoryLoading.value = false;
  }
};

// ============ 头像切换 ============

const handleSwitchAvatar = async (name) => {
  if (name === currentAvatar.value?.name) return;
  try {
    const res = await window.electronAPI?.invoke('agent-set-avatar', { name });
    if (res?.success) {
      await loadAvatarHistory();
    } else {
      showNotice(`${t('drawer.memory.switchAvatarFailed')}: ${res?.error || ''}`, 'error');
    }
  } catch (e) {
    showNotice(`${t('drawer.memory.switchAvatarFailed')}: ${e?.message || e}`, 'error');
  }
};

// ============ 记忆文件编辑 ============

const openEdit = (mf) => {
  editModal.value = {
    visible: true,
    fileName: mf.fileName,
    nameKey: mf.nameKey,
    content: mf.content || '',
    mode: 'edit',
    saving: false
  };
};

const closeEdit = () => {
  if (editModal.value.saving) return;
  editModal.value.visible = false;
};

const saveEdit = async () => {
  if (editModal.value.saving) return;
  editModal.value.saving = true;
  try {
    const res = await window.electronAPI?.invoke('agent-write-memory', {
      fileName: editModal.value.fileName,
      content: editModal.value.content
    });
    if (res?.success) {
      showNotice(t('drawer.memory.saved'), 'info');
      editModal.value.visible = false;
      await loadMemoryFiles();
    } else {
      showNotice(`${t('drawer.memory.saveFailed')}: ${res?.error || ''}`, 'error');
    }
  } catch (e) {
    showNotice(`${t('drawer.memory.saveFailed')}: ${e?.message || e}`, 'error');
  } finally {
    editModal.value.saving = false;
  }
};

onMounted(() => {
  loadAvatarHistory();
  loadMemoryFiles();
  // 外部（如 set_avatar 工具）更新头像时刷新当前头像与历史
  unlistenConfig = window.electronAPI?.on('config-changed', () => {
    loadAvatarHistory();
  });
});

onUnmounted(() => {
  clearTimeout(noticeTimer);
  if (typeof unlistenConfig === 'function') {
    unlistenConfig();
  }
});
</script>

<style scoped>
.memory-management {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}

/* ============ Header ============ */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px 7px;
  flex-shrink: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* ============ Body ============ */
.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.memory-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.subsection-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
  margin-top: -3px;
}

/* ============ Friday 卡片 ============ */
.friday-card {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.friday-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.friday-avatar {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  object-fit: cover;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

.friday-avatar.fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.rarity-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid var(--bg-secondary);
  color: #fff;
}

.rarity-badge.rare {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
}

.friday-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.info-label {
  color: var(--text-tertiary);
  flex-shrink: 0;
  min-width: 48px;
}

.info-value {
  color: var(--text-primary);
}

.info-value.name {
  font-size: 14px;
  font-weight: 600;
}

/* ============ 已获头像入口按钮（ID 卡片右侧） ============ */
.obtained-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  flex-shrink: 0;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.obtained-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--text-tertiary);
  color: var(--text-primary);
}

.obtained-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.obtained-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--bg-hover);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.obtained-arrow {
  opacity: 0.55;
  transition: opacity 0.15s, transform 0.15s;
}

.obtained-btn:hover:not(:disabled) .obtained-arrow {
  opacity: 1;
  transform: translateX(1px);
}

/* ============ 头像历史网格 ============ */
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
}

.avatar-chip {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 4px 5px;
  border: 1.5px solid transparent;
  background: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s, background-color 0.15s, transform 0.1s;
}

.avatar-chip:hover {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

.avatar-chip.active {
  border-color: var(--accent-color, #3b82f6);
  background: var(--bg-hover);
}

.avatar-img {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--bg-primary);
}

.chip-rare-mark {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: #fff;
}

.avatar-name {
  font-size: 10.5px;
  color: var(--text-secondary);
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-chip.active .avatar-name {
  color: var(--text-primary);
  font-weight: 500;
}

.chip-current {
  font-size: 9.5px;
  font-weight: 600;
  color: var(--accent-color, #3b82f6);
  line-height: 1;
  margin-top: 1px;
}

/* ============ 记忆文件网格 ============ */
.memory-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.memory-card {
  position: relative;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border: 1px solid transparent;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: border-color 0.15s, background-color 0.15s;
}

.memory-card:hover {
  border-color: var(--border-color);
  background: var(--bg-hover);
}

.memory-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
}

.memory-icon {
  display: inline-flex;
  color: var(--accent-color, #3b82f6);
  flex-shrink: 0;
}

.memory-filename {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.memory-edit {
  display: inline-flex;
  opacity: 0.5;
  transition: opacity 0.15s;
}

.memory-card:hover .memory-edit {
  opacity: 1;
}

.memory-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  margin-top: 2px;
}

.memory-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.memory-card-meta {
  font-size: 10.5px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.memory-card-meta .dot {
  opacity: 0.6;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 10px 0;
}

/* ============ Notice ============ */
.notice {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  color: var(--text-primary);
  z-index: 20;
}

.notice.error {
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.15s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
}

/* ============ Modal ============ */
.mm-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  padding: 20px;
}

.mm-modal {
  width: 560px;
  max-width: 100%;
  max-height: 85vh;
  background: var(--bg-primary);
  border-radius: 10px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 已获头像面板：比编辑弹窗窄，内容区可滚动 */
.avatar-panel {
  width: 440px;
  max-height: 72vh;
}

.avatar-panel-body {
  overflow-y: auto;
  padding: 12px 16px 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.avatar-panel-body::-webkit-scrollbar {
  width: 6px;
}

.avatar-panel-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.modal-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.modal-title-icon {
  color: var(--accent-color, #3b82f6);
  flex-shrink: 0;
}

.modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.modal-title-file {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
}

.modal-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.modal-close:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.mode-switch {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 5px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.mode-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.mode-btn.active {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.md-textarea {
  width: 100%;
  box-sizing: border-box;
  flex: 1;
  min-height: 320px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  resize: none;
  outline: none;
  transition: border-color 0.15s;
}

.md-textarea:focus {
  border-color: var(--text-tertiary);
}

.md-preview {
  flex: 1;
  min-height: 320px;
  overflow-y: auto;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
}

.md-preview :deep(h1) {
  font-size: 18px;
  font-weight: 700;
  margin: 14px 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-color);
}

.md-preview :deep(h2) {
  font-size: 15px;
  font-weight: 600;
  margin: 12px 0 6px;
}

.md-preview :deep(h3) {
  font-size: 14px;
  font-weight: 600;
  margin: 10px 0 5px;
}

.md-preview :deep(p) {
  margin: 0 0 8px;
}

.md-preview :deep(ul),
.md-preview :deep(ol) {
  margin: 0 0 8px;
  padding-left: 22px;
}

.md-preview :deep(li) {
  margin: 3px 0;
}

.md-preview :deep(blockquote) {
  margin: 8px 0;
  padding: 6px 12px;
  border-left: 3px solid var(--accent-color, #3b82f6);
  background: var(--bg-primary);
  border-radius: 0 5px 5px 0;
  color: var(--text-secondary);
}

.md-preview :deep(code) {
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 1px 5px;
  background: var(--bg-primary);
  border-radius: 3px;
}

.md-preview :deep(pre) {
  margin: 8px 0;
  padding: 10px;
  background: var(--bg-primary);
  border-radius: 6px;
  overflow-x: auto;
}

.md-preview :deep(pre code) {
  padding: 0;
  background: transparent;
}

.md-preview :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 14px 0;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.footer-count {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.modal-btn {
  padding: 5px 14px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 5px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s, border-color 0.15s;
}

.modal-btn.cancel:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.modal-btn.confirm {
  background: var(--accent-color, #3b82f6);
  border-color: var(--accent-color, #3b82f6);
  color: #fff;
}

.modal-btn.confirm:hover:not(:disabled) {
  opacity: 0.9;
}

.modal-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* ============ Dark mode ============ */
[data-theme='dark'] .notice,
[data-theme='dark'] .mm-modal {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

[data-theme='dark'] .mm-modal {
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
}
</style>
