<template>
  <div class="kb-main">
    <div class="main-header">
      <div class="header-left">
        <button class="nav-btn" @click="$emit('go-back')" :disabled="!canGoBack">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button class="nav-btn" @click="$emit('go-forward')" :disabled="!canGoForward">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <div class="breadcrumb" v-if="selectedKB">
          <template v-for="(segment, index) in pathSegments" :key="index">
            <span
              class="breadcrumb-item"
              :class="{ active: index === pathSegments.length - 1 }"
              @click="$emit('navigate-to-segment', index)"
            >{{ segment.name }}</span>
            <svg v-if="index < pathSegments.length - 1" class="breadcrumb-sep" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </template>
        </div>
        <h1 v-else class="page-title">{{ currentTitle }}</h1>
      </div>
      <div class="header-right">
        <Transition name="search-expand">
          <div v-if="searchVisible" class="search-inline">
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              class="search-input"
              placeholder="搜索文件..."
              @keydown.escape="closeSearch"
            />
            <button class="search-close" @click="closeSearch">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </Transition>
        <div v-if="!searchVisible" class="tooltip-btn" data-tooltip="搜索">
          <button class="icon-btn" @click="toggleSearch">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>
        <div class="tooltip-btn" :data-tooltip="viewMode === 'grid' ? '列表' : '宫格'">
          <button class="icon-btn" @click="viewMode = viewMode === 'grid' ? 'list' : 'grid'">
            <svg v-if="viewMode === 'grid'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </button>
        </div>
        <div class="sort-wrapper" ref="sortWrapperRef">
          <div class="tooltip-btn" data-tooltip="排序">
            <button class="icon-btn" :class="{ active: showSortMenu }" @click="toggleSortMenu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="4" y1="6" x2="20" y2="6"></line>
              <line x1="7" y1="12" x2="17" y2="12"></line>
              <line x1="10" y1="18" x2="14" y2="18"></line>
            </svg>
          </button>
          </div>
          <Transition name="dropdown">
            <div v-if="showSortMenu" class="sort-menu">
              <div
                v-for="opt in sortOptions"
                :key="opt.key"
                class="sort-option"
                :class="{ active: sortBy === opt.key }"
                @click="selectSort(opt.key)"
              >
                <span>{{ opt.label }}</span>
                <svg v-if="sortBy === opt.key && sortOrder === 'asc'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <svg v-if="sortBy === opt.key && sortOrder === 'desc'" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </div>
            </div>
          </Transition>
        </div>
        <div class="upload-wrapper" ref="uploadWrapperRef">
          <div class="tooltip-btn" data-tooltip="上传">
            <button class="icon-btn" :class="{ active: showUploadMenu }" @click="toggleUploadMenu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </button>
          </div>
          <Transition name="dropdown">
            <div v-if="showUploadMenu" class="upload-menu">
              <div class="upload-option" @click="handleUpload('file')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <span>本地文件</span>
              </div>
              <div class="upload-option" @click="handleUpload('folder')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>本地文件夹</span>
              </div>
              <div class="upload-option" @click="handleUpload('note')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span>笔记</span>
              </div>
              <div class="upload-option" @click="handleUpload('webpage')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <span>网页</span>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <div class="file-grid" :class="viewMode" v-if="selectedKB" @contextmenu.prevent="$emit('show-file-context-menu', $event)">
      <!-- 列表视图 -->
      <template v-if="viewMode === 'list'">
        <div class="list-header">
          <span class="col-name">名称</span>
          <span class="col-type">类型</span>
          <span class="col-size">大小</span>
          <span class="col-time">更新时间</span>
        </div>
        <div
          v-for="file in filteredFiles"
          :key="file.path"
          class="list-row"
          @click="$emit('open-file', file)"
        >
          <div class="col-name">
            <component :is="getFileIconComponent(file.type)" class="row-icon" :class="file.type" />
            <span class="row-name">{{ file.name }}</span>
          </div>
          <span class="col-type">{{ getTypeLabel(file.type) }}</span>
          <span class="col-size">{{ formatSize(file) }}</span>
          <span class="col-time">{{ formatTime(file.modifiedTime) }}</span>
        </div>
        <div v-if="filteredFiles.length === 0 && files.length > 0" class="empty-folder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p>未找到匹配的文件</p>
        </div>
        <div v-if="files.length === 0" class="empty-folder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>此文件夹为空</p>
        </div>
      </template>

      <!-- 宫格视图 -->
      <template v-else>
        <FileCard
          v-for="file in filteredFiles"
          :key="file.path"
          :file="file"
          @open="$emit('open-file', $event)"
        />
        <div v-if="filteredFiles.length === 0 && files.length > 0" class="empty-folder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p>未找到匹配的文件</p>
        </div>
        <div v-if="files.length === 0" class="empty-folder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>此文件夹为空</p>
        </div>
      </template>
    </div>
    <div class="empty-state" v-else>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
      <h2>选择一个知识库</h2>
      <p>从左侧选择或创建一个知识库开始</p>
    </div>

    <KbQuestionBox />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import FileCard from './FileCard.vue';
import KbQuestionBox from './KbQuestionBox.vue';
import { FILE_ICON_MAP, UnknownFileIcon } from './icons';
import { FILE_TYPE_LABELS } from '../constants';

const props = defineProps({
  selectedKB: String,
  currentTitle: String,
  canGoBack: Boolean,
  canGoForward: Boolean,
  pathSegments: Array,
  files: Array,
  currentPath: String
});

const emit = defineEmits([
  'go-back',
  'go-forward',
  'navigate-to-segment',
  'refresh',
  'show-file-context-menu',
  'open-file'
]);

const searchVisible = ref(false);
const searchQuery = ref('');
const searchInputRef = ref(null);
const viewMode = ref('grid');
const showSortMenu = ref(false);
const sortWrapperRef = ref(null);
const sortBy = ref('name');
const sortOrder = ref('asc');

const sortOptions = [
  { key: 'modifiedTime', label: '更新时间' },
  { key: 'name', label: '名称' },
  { key: 'size', label: '大小' },
  { key: 'type', label: '类型' }
];

function toggleSortMenu() {
  showSortMenu.value = !showSortMenu.value;
}

function selectSort(key) {
  if (sortBy.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = key;
    sortOrder.value = key === 'modifiedTime' ? 'desc' : 'asc';
  }
}

function closeSortMenu(e) {
  if (sortWrapperRef.value && !sortWrapperRef.value.contains(e.target)) {
    showSortMenu.value = false;
  }
}

const showUploadMenu = ref(false);
const uploadWrapperRef = ref(null);

function toggleUploadMenu() {
  showUploadMenu.value = !showUploadMenu.value;
  showSortMenu.value = false;
}

async function handleUpload(type) {
  showUploadMenu.value = false;
  const api = window.electronAPI;
  const destDir = String(props.currentPath || '');
  if (!api) {
    console.warn('[Upload] electronAPI not available');
    return;
  }
  if (!destDir) {
    console.warn('[Upload] currentPath is empty');
    return;
  }

  try {
    if (type === 'file') {
      const filePaths = await api.invoke('open-file-dialog', {
        properties: ['openFile', 'multiSelections']
      });
      console.log('[Upload] selected files:', filePaths);
      if (!filePaths || !filePaths.length) return;
      for (const src of filePaths) {
        const result = await api.invoke('kb-copy-file', { srcPath: String(src), destDir });
        console.log('[Upload] copy file result:', result);
      }
      emit('refresh');
    } else if (type === 'folder') {
      const folderPath = await api.invoke('open-file-dialog', {
        properties: ['openDirectory']
      });
      console.log('[Upload] selected folder:', folderPath);
      if (!folderPath) return;
      const result = await api.invoke('kb-copy-folder', { srcPath: String(folderPath), destDir });
      console.log('[Upload] copy folder result:', result);
      emit('refresh');
    } else if (type === 'note' || type === 'webpage') {
      // TODO: 待实现
    }
  } catch (e) {
    console.error('[Upload] error:', e);
  }
}

function closeUploadMenu(e) {
  if (uploadWrapperRef.value && !uploadWrapperRef.value.contains(e.target)) {
    showUploadMenu.value = false;
  }
}

const filteredFiles = computed(() => {
  let result = props.files;
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase();
    result = result.filter(file => file.name.toLowerCase().includes(query));
  }
  const sorted = [...result].sort((a, b) => {
    let cmp = 0;
    switch (sortBy.value) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'size': {
        const sa = Number(a.size) || 0;
        const sb = Number(b.size) || 0;
        cmp = sa - sb;
        break;
      }
      case 'modifiedTime': {
        const ta = new Date(a.modifiedTime || 0).getTime();
        const tb = new Date(b.modifiedTime || 0).getTime();
        cmp = ta - tb;
        break;
      }
      case 'type':
        cmp = (a.type || '').localeCompare(b.type || '');
        break;
    }
    return sortOrder.value === 'asc' ? cmp : -cmp;
  });
  return sorted;
});

function toggleSearch() {
  searchVisible.value = !searchVisible.value;
  if (searchVisible.value) {
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  } else {
    searchQuery.value = '';
  }
}

function closeSearch() {
  searchVisible.value = false;
  searchQuery.value = '';
}

function getFileIconComponent(type) {
  return FILE_ICON_MAP[type] || UnknownFileIcon;
}

function getTypeLabel(type) {
  return FILE_TYPE_LABELS[type] || '文件';
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return diffMin + '分钟前';
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return diffHour + '小时前';
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 2) return '昨天';
  if (diffDay < 7) return diffDay + '天前';
  return d.getMonth() + 1 + '/' + d.getDate();
}

function formatSize(file) {
  if (!file || file.isDirectory) return '-';
  const size = file.size;
  if (size == null || size === '') return '-';
  const bytes = Number(size);
  if (isNaN(bytes)) return '-';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

onMounted(() => {
  document.addEventListener('click', closeSortMenu);
  document.addEventListener('click', closeUploadMenu);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeSortMenu);
  document.removeEventListener('click', closeUploadMenu);
});
</script>

<style scoped lang="scss">
.kb-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;

  .main-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    background: var(--bg-primary);

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;

      .nav-btn {
        padding: 6px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
        color: var(--text-secondary);
        transition: all 0.2s;

        &:hover:not(:disabled) {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      }

      .page-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }

      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 2px;
        font-size: 14px;
        min-width: 0;
        overflow: hidden;

        .breadcrumb-item {
          color: var(--text-secondary);
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          white-space: nowrap;
          transition: all 0.15s;

          &:hover {
            background: var(--bg-hover);
            color: var(--text-primary);
          }

          &.active {
            color: var(--text-primary);
            font-weight: 600;
            cursor: default;

            &:hover {
              background: transparent;
            }
          }
        }

        .breadcrumb-sep {
          color: var(--text-tertiary);
          flex-shrink: 0;
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 4px;

      .tooltip-btn {
        position: relative;
        display: inline-flex;
        z-index: 10;

        &::after {
          content: attr(data-tooltip);
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%) scale(0.9);
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.75);
          color: #fff;
          font-size: 12px;
          border-radius: 4px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: all 0.15s ease;
        }

        &:hover::after {
          opacity: 1;
          transform: translateX(-50%) scale(1);
        }
      }

      .icon-btn {
        padding: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
        color: var(--text-secondary);
        transition: all 0.2s;

        &:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        &.active {
          background: var(--bg-hover);
          color: var(--text-primary);
        }
      }

      .sort-wrapper {
        position: relative;

        .sort-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          z-index: 20;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
          padding: 4px;
          min-width: 100px;

          .sort-option {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 7px 10px;
            font-size: 13px;
            color: var(--text-primary);
            cursor: pointer;
            border-radius: 5px;
            transition: all 0.15s;

            &:hover {
              background: var(--bg-hover);
              color: var(--text-primary);
            }

            &.active {
              color: var(--text-primary);
              font-weight: 500;
              svg { opacity: 1; }
            }

            svg { opacity: 0.5; }
          }
        }
      }

      .upload-wrapper {
        position: relative;

        .upload-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          z-index: 20;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
          padding: 4px;
          min-width: 130px;

          .upload-option {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            font-size: 13px;
            color: var(--text-primary);
            cursor: pointer;
            border-radius: 5px;
            transition: all 0.15s;

            svg {
              flex-shrink: 0;
              opacity: 0.7;
            }

            &:hover {
              background: var(--bg-hover);
              color: var(--text-primary);

              svg { opacity: 1; }
            }
          }
        }
      }
    }
  }

  .search-inline {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-secondary);
    border-radius: 6px;
    padding: 0 8px;
    height: 30px;
    overflow: hidden;

    .search-input {
      width: 140px;
      border: none;
      outline: none;
      background: transparent;
      font-size: 13px;
      color: var(--text-primary);
      padding: 0;

      &::placeholder {
        color: var(--text-tertiary);
      }
    }

    .search-close {
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--text-tertiary);
      padding: 2px;
      border-radius: 4px;
      flex-shrink: 0;
      transition: all 0.15s;

      &:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }
    }
  }

  .search-expand-enter-active,
  .search-expand-leave-active {
    transition: width 0.2s ease, opacity 0.2s ease;
  }

  .search-expand-enter-from,
  .search-expand-leave-to {
    width: 0;
    opacity: 0;
  }

  .dropdown-enter-active,
  .dropdown-leave-active {
    transition: all 0.15s ease;
  }

  .dropdown-enter-from,
  .dropdown-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }

  .file-grid {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: 20px 40px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 16px 24px;
    align-content: start;

    &.list {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 8px 24px;

      .list-header {
        display: flex;
        align-items: center;
        padding: 6px 12px;
        font-size: 12px;
        color: var(--text-tertiary);
        user-select: none;

        .col-name { flex: 1; }
        .col-type { width: 80px; text-align: center; }
        .col-size { width: 70px; text-align: center; }
        .col-time { width: 100px; text-align: right; }
      }

      .list-row {
        display: flex;
        align-items: center;
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        color: var(--text-primary);
        transition: background 0.15s;

        &:hover {
          background: var(--bg-hover);
        }

        .col-name {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;

          .row-icon {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
            color: var(--text-secondary);

            &.folder { color: #1560F7; }
            &.markdown { color: #4CAF50; }
            &.pdf { color: #F44336; }
            &.txt { color: #9E9E9E; }
            &.excel { color: #4CAF50; }
            &.word { color: #2196F3; }
            &.note { color: #FFC107; }
            &.ppt { color: #FF9800; }
          }

          .row-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }

        .col-type {
          width: 80px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 12.5px;
        }

        .col-size {
          width: 70px;
          text-align: center;
          color: var(--text-tertiary);
          font-size: 12.5px;
        }

        .col-time {
          width: 100px;
          text-align: right;
          color: var(--text-tertiary);
          font-size: 12.5px;
        }
      }

      .empty-folder {
        grid-column: auto;
        flex: 1;
        align-items: center;
        justify-content: center;
        padding: 40px 0;
      }
    }

    .empty-folder {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: var(--text-tertiary);

      svg {
        margin-bottom: 12px;
        opacity: 0.4;
      }

      p {
        font-size: 14px;
        margin: 0;
      }
    }
  }

  .empty-state {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: var(--text-tertiary);

    svg {
      margin-bottom: 16px;
      opacity: 0.3;
    }

    h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-secondary);
      margin: 0 0 8px;
    }

    p {
      font-size: 14px;
      margin: 0;
    }
  }
}
</style>
