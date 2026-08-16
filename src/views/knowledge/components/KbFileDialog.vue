<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="kb-file-overlay" @click.self="$emit('close')">
        <Transition name="dialog-scale">
          <div v-if="visible" class="kb-file-dialog">
            <div class="kb-file-header">
              <div class="header-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>{{ t('friday.selectKbFile') }}</span>
              </div>
              <button class="dialog-close" @click="$emit('close')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="kb-file-body">
              <div class="kb-file-sidebar">
                <div class="sidebar-label">{{ t('friday.kb') }}</div>
                <div class="kb-file-list">
                  <div
                    v-for="category in selectableKbList"
                    :key="category.id"
                    class="kb-file-category"
                  >
                    <div v-if="category.items.length > 0" class="category-title">{{ category.name }}</div>
                    <div
                      v-for="item in category.items"
                      :key="item.id"
                      class="kb-file-item"
                      :class="{ active: selectedKbId === item.id }"
                      @click="loadKbFiles(item, category.id)"
                    >
                      <img v-if="item.coverIndex != null && coverOptions[item.coverIndex]" class="kb-file-icon" :src="coverOptions[item.coverIndex]" alt="" />
                      <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="kb-file-icon-fallback">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                      </svg>
                      <span class="kb-file-name">{{ item.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="kb-file-main">
                <div class="file-breadcrumb" v-if="fileBreadcrumb.length > 0">
                  <span
                    v-for="(seg, idx) in fileBreadcrumb"
                    :key="idx"
                    class="breadcrumb-item"
                    @click="navigateFileTo(seg.path, idx)"
                  >
                    {{ seg.name }}
                    <svg v-if="idx < fileBreadcrumb.length - 1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </span>
                </div>
                <div class="file-content" v-if="kbFileList.length > 0">
                  <div
                    v-for="file in kbFileList"
                    :key="file.path"
                    class="file-row"
                    :class="{ folder: file.isDirectory }"
                    @click="file.isDirectory ? navigateFileTo(file.path) : selectKbFile(file)"
                  >
                    <svg v-if="file.isDirectory" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <span class="file-name">{{ file.name }}</span>
                  </div>
                </div>
                <div v-else class="file-empty">
                  <p>{{ selectedKbId ? t('friday.fileEmptySelected') : t('friday.fileEmptyUnselected') }}</p>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { coverOptions } from '@/views/knowledge/constants';

const props = defineProps({
  visible: { type: Boolean, default: false },
  selectableKbList: { type: Array, default: () => [] }
});

const emit = defineEmits(['close', 'select']);

const { t } = useI18n();

const selectedKbId = ref('');
const kbFileList = ref([]);
const fileBreadcrumb = ref([]);

const loadKbFiles = async (item, categoryId) => {
  const api = window.electronAPI;
  if (!api) return;
  selectedKbId.value = item.id;
  let dataDir = '';
  try {
    dataDir = await api.invoke('kb-get-data-dir');
  } catch (e) {
    console.error('Failed to get data dir:', e);
    return;
  }
  const kbDir = dataDir + '/knowledge/' + categoryId + '/' + item.name;
  await readKbDir(kbDir);
  fileBreadcrumb.value = [{ name: item.name, path: kbDir }];
};

const readKbDir = async (dirPath) => {
  const api = window.electronAPI;
  if (!api) return;
  try {
    const entries = await api.invoke('kb-read-dir', { dirPath });
    kbFileList.value = entries
      .filter(entry => entry.isDirectory || entry.name.includes('.'))
      .map(entry => ({
        ...entry,
        isDirectory: entry.isDirectory
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch (e) {
    console.error('Failed to read kb dir:', e);
    kbFileList.value = [];
  }
};

const navigateFileTo = async (path, idx) => {
  if (idx != null && idx < fileBreadcrumb.value.length - 1) {
    fileBreadcrumb.value = fileBreadcrumb.value.slice(0, idx + 1);
  } else if (idx == null) {
    const dirName = path.split('/').pop();
    fileBreadcrumb.value.push({ name: dirName, path });
  }
  await readKbDir(path);
};

const selectKbFile = (file) => {
  emit('select', { name: file.name, path: file.path });
};

watch(() => props.visible, (val) => {
  if (val) {
    selectedKbId.value = '';
    kbFileList.value = [];
    fileBreadcrumb.value = [];
  }
});
</script>

<style scoped>
.kb-file-overlay {
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

.kb-file-dialog {
  background: var(--bg-primary, #fff);
  border-radius: 14px;
  width: 720px;
  max-width: 92vw;
  height: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border-color, rgba(0, 0, 0, 0.06));
  overflow: hidden;
}

.kb-file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color, #ececec);
  flex-shrink: 0;
}

.kb-file-header .header-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
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
}

.dialog-close:hover {
  background: var(--bg-hover, #f0f0f0);
  color: var(--text-primary, #333);
}

.kb-file-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.kb-file-sidebar {
  width: 200px;
  border-right: 1px solid var(--border-color, #ececec);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--bg-secondary, #fafafa);
}

.kb-file-sidebar .sidebar-label {
  padding: 12px 14px 6px;
  font-size: 11px;
  color: var(--text-tertiary, #aaa);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kb-file-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.kb-file-category {
  margin-bottom: 4px;
}

.category-title {
  padding: 8px 10px 4px;
  font-size: 11px;
  color: var(--text-tertiary, #aaa);
  font-weight: 600;
}

.kb-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.12s;
  color: var(--text-secondary, #666);
  margin-bottom: 2px;
}

.kb-file-item:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
  color: var(--text-primary, #333);
}

.kb-file-item.active {
  background: rgba(21, 96, 247, 0.1);
  color: var(--accent-color, #1560F7);
  font-weight: 500;
}

.kb-file-icon {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  object-fit: cover;
  flex-shrink: 0;
}

.kb-file-icon-fallback {
  color: var(--text-tertiary, #aaa);
  flex-shrink: 0;
}

.kb-file-name {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kb-file-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.file-breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  font-size: 12.5px;
  color: var(--text-tertiary, #999);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: color 0.12s;
}

.breadcrumb-item:hover {
  color: var(--accent-color, #1560F7);
}

.file-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
  color: var(--text-primary, #333);
}

.file-row:hover {
  background: var(--bg-hover, #f5f5f5);
}

.file-row.folder {
  color: var(--text-secondary, #555);
}

.file-row svg {
  color: var(--text-tertiary, #999);
  flex-shrink: 0;
}

.file-name {
  font-size: 13.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary, #c0c0c0);
  font-size: 13px;
}

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
