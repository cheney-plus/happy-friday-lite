<template>
  <div class="file-open-settings-page">
    <button class="back-btn" :aria-label="t('note.back')" @click="goBack">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>

    <h1 class="page-title">{{ t('settings.fileOpen') }}</h1>
    <p class="page-desc">{{ t('settings.fileOpenDesc') }}</p>
    <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>

    <div class="settings-content">
      <!-- 文档默认打开方式 -->
      <div class="settings-group">
        <div class="group-title">{{ t('settings.docOpenModes') }}</div>
        <div class="group-content">
          <div class="setting-item">
            <div class="item-label-group">
              <span class="item-hint">{{ t('settings.docOpenModesHint') }}</span>
            </div>
          </div>
          <div class="setting-item" v-for="group in docOpenGroups" :key="group.key">
            <span class="item-label">{{ group.label }}</span>
            <div class="mode-options">
              <div
                :class="['mode-option', { active: settings.docOpenModes[group.key] === 'internal' }]"
                @click="selectDocOpenMode(group.key, 'internal')"
              >{{ t('settings.docOpenInternal') }}</div>
              <div
                :class="['mode-option', { active: settings.docOpenModes[group.key] === 'system' }]"
                @click="selectDocOpenMode(group.key, 'system')"
              >{{ t('settings.docOpenSystem') }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 系统文件关联 -->
      <div class="settings-group">
        <div class="group-title">{{ t('settings.fileAssoc') }}</div>
        <div class="group-content">
          <div class="setting-item">
            <div class="item-label-group">
              <span class="item-hint">{{ t('settings.fileAssocHint') }}</span>
            </div>
          </div>
          <div class="setting-item" v-for="item in fileAssocItems" :key="item.key">
            <span class="item-label">{{ item.label }}</span>
            <div class="file-assoc-row">
              <span v-if="item.statusText" class="item-hint file-assoc-status" :class="{ active: item.assocEnabled }">{{ item.statusText }}</span>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  :checked="item.assocEnabled"
                  :disabled="fileAssocUnsupported || fileAssocBusy"
                  @change="onFileAssocToggle(item.key, $event)"
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/store';
import { electronService } from '@/services/electron';

const router = useRouter();
const { t } = useI18n();
const appStore = useAppStore();

const goBack = () => router.push('/settings');

const settings = reactive({
  docOpenModes: { ...appStore.docOpenModes }
});

// 文档默认打开方式分组（Markdown / Word / Excel / PPT）
const docOpenGroups = computed(() => [
  { key: 'markdown', label: t('settings.docTypeMarkdown') },
  { key: 'word', label: t('settings.docTypeWord') },
  { key: 'excel', label: t('settings.docTypeExcel') },
  { key: 'ppt', label: t('settings.docTypePpt') }
]);

// 设置 Markdown/Word/Excel/PPT 文档的默认打开方式（内置 / 系统默认应用）
const selectDocOpenMode = async (group, value) => {
  if (value !== 'internal' && value !== 'system') return;
  if (settings.docOpenModes[group] === value) return;
  settings.docOpenModes[group] = value;
  appStore.setDocOpenModes({ [group]: value });
  try {
    const config = await electronService.invoke('get-config');
    if (config) {
      config.docOpenModes = { ...(config.docOpenModes || {}), ...appStore.docOpenModes };
      await electronService.invoke('save-config', config);
    }
  } catch (_e) {}
};

// ========== 系统文件关联：本客户端设为系统默认打开程序 ==========

const fileAssocState = ref({ supported: true, exts: {} });
const fileAssocBusy = ref(false);
const errorMsg = ref('');
let errorMsgTimer = null;

const fileAssocUnsupported = computed(() => fileAssocState.value.supported === false);

const fileAssocItems = computed(() => docOpenGroups.value.map(group => {
  const extStates = fileAssocState.value.exts?.[group.key] || [];
  const assocEnabled = extStates.length > 0 && extStates.every(e => e.isDefault);
  let statusText = '';
  if (!fileAssocState.value.supported) {
    statusText = t('settings.fileAssocUnsupported');
  } else if (extStates.length > 0) {
    statusText = assocEnabled ? t('settings.fileAssocActive') : t('settings.fileAssocInactive');
  }
  return { key: group.key, label: group.label, assocEnabled, statusText };
}));

function showError(message) {
  errorMsg.value = message;
  if (errorMsgTimer) clearTimeout(errorMsgTimer);
  errorMsgTimer = setTimeout(() => { errorMsg.value = ''; }, 4000);
}

async function refreshFileAssocStatus() {
  try {
    fileAssocState.value = await electronService.invoke('file-assoc-get-status');
  } catch (_e) { /* 保持当前状态 */ }
}

async function onFileAssocToggle(group, event) {
  const enable = event.target.checked;
  fileAssocBusy.value = true;
  try {
    const res = await electronService.invoke(enable ? 'file-assoc-set' : 'file-assoc-clear', { groups: [group] });
    if (!res?.success) {
      showError(res?.error === 'darwin-unsupported' ? t('settings.fileAssocDarwinTip') : t('settings.fileAssocFailed'));
    }
  } catch (_e) {
    showError(t('settings.fileAssocFailed'));
  } finally {
    fileAssocBusy.value = false;
    await refreshFileAssocStatus();
  }
}

onMounted(refreshFileAssocStatus);
</script>

<style scoped>
.file-open-settings-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 40px 48px;
  position: relative;
}

.back-btn {
  position: absolute;
  top: 12px;
  left: 16px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  transition: background-color 0.15s;
  border-radius: 6px;
}

.back-btn:hover {
  background-color: var(--bg-hover);
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
  max-width: 720px;
  width: 100%;
  text-align: left;
}

.page-desc {
  margin: 0 0 22px;
  max-width: 720px;
  width: 100%;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.5;
}

.error-banner {
  max-width: 720px;
  width: 100%;
  margin: 0 0 12px;
  padding: 8px 14px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 13px;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
  width: 100%;
}

.settings-group {
  background-color: var(--bg-primary);
}

.group-title {
  font-size: 14px;
  color: var(--text-tertiary);
  padding: 16px 0 10px;
  font-weight: 400;
}

.group-content {
  background-color: var(--bg-secondary);
  border-radius: 10px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  min-height: 52px;
}

.setting-item:last-child {
  border-bottom: none;
}

.item-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.item-label-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-right: 16px;
}

.item-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 400;
  line-height: 1.4;
}

.mode-options {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--bg-primary);
  border-radius: 8px;
  padding: 4px;
}

.mode-option {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  white-space: nowrap;
}

.mode-option:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.mode-option.active {
  background-color: var(--text-primary);
  color: var(--bg-primary);
  font-weight: 500;
}

.file-assoc-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-assoc-status {
  white-space: nowrap;

  &.active {
    color: #10b981;
  }
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--text-tertiary);
  border-radius: 24px;
  transition: background-color 0.25s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: var(--bg-primary);
  border-radius: 50%;
  transition: transform 0.25s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #10b981;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}
</style>
