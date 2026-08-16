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
              v-model="fileSearchQuery"
              class="search-input"
              placeholder="搜索文件..."
              @keydown.escape="closeSearch"
              @blur="handleSearchBlur"
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

    <!-- 搜索结果列表 -->
    <div class="file-grid list search-results" v-if="selectedKB && isSearching" @contextmenu.prevent="$emit('show-file-context-menu', $event)">
      <div class="list-header">
        <span class="col-name">名称</span>
        <span class="col-type">类型</span>
        <span class="col-size">大小</span>
        <span class="col-time">更新时间</span>
      </div>
      <div
        v-for="file in searchResults"
        :key="file.path"
        class="list-row search-row"
        @click="handleSearchResultClick(file)"
        @contextmenu.stop.prevent="$emit('show-file-item-context-menu', $event, file)"
      >
        <div class="col-name">
          <component :is="getFileIconComponent(file.type)" class="row-icon" :class="file.type" />
          <div class="row-name-wrap">
            <span class="row-name">{{ file.name }}</span>
            <span class="row-path" v-if="file.relativePath && file.relativePath !== file.name">{{ file.relativePath }}</span>
          </div>
        </div>
        <span class="col-type">{{ getTypeLabel(file.type) }}</span>
        <span class="col-size">{{ formatSize(file) }}</span>
        <span class="col-time">{{ formatTime(file.modifiedTime) }}</span>
      </div>
      <EmptyState v-if="searchResults.length === 0" variant="search" message="未找到匹配的文件" />
    </div>

    <!-- 正常文件视图 -->
    <div
      ref="fileGridRef"
      class="file-grid"
      :class="[viewMode, { 'is-empty': filteredFiles.length === 0, 'is-dropping': isDraggingExternal }]"
      v-else-if="selectedKB"
      @contextmenu.prevent="handleGridContextMenu"
      @mousedown.self="startMarqueeSelection"
      @dragenter.prevent="onExternalDragEnter"
      @dragover.prevent="onExternalDragOver"
      @dragleave="onExternalDragLeave"
      @drop.prevent="onExternalDrop($event, currentPath)"
    >
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
          :data-file-path="file.path"
          :class="{ selected: isSelected(file) }"
          @mousedown.stop="selectFile(file, $event)"
          @dblclick="$emit('open-file', file)"
          @contextmenu.stop.prevent="handleItemContextMenu($event, file)"
          @dragenter.prevent="file.isDirectory && onExternalDragEnter($event)"
          @dragover.prevent="file.isDirectory && onExternalDragOver($event)"
          @drop.stop.prevent="file.isDirectory && onExternalDrop($event, file.path)"
        >
          <div class="col-name">
            <component :is="getFileIconComponent(file.type)" class="row-icon" :class="file.type" />
            <span class="row-name">{{ file.name }}</span>
          </div>
          <span class="col-type">{{ getTypeLabel(file.type) }}</span>
          <span class="col-size">{{ formatSize(file) }}</span>
          <span class="col-time">{{ formatTime(file.modifiedTime) }}</span>
        </div>
        <EmptyState v-if="filteredFiles.length === 0 && files.length > 0" variant="search" message="未找到匹配的文件" />
        <EmptyState v-if="files.length === 0" message="此文件夹为空" />
      </template>

      <!-- 宫格视图 -->
      <template v-else>
        <div
          v-for="file in filteredFiles"
          :key="file.path"
          class="file-card-wrapper"
          :data-file-path="file.path"
          @mousedown.stop="selectFile(file, $event)"
          @contextmenu.stop.prevent="handleItemContextMenu($event, file)"
          @dragenter.prevent="file.isDirectory && onExternalDragEnter($event)"
          @dragover.prevent="file.isDirectory && onExternalDragOver($event)"
          @drop.stop.prevent="file.isDirectory && onExternalDrop($event, file.path)"
        >
          <FileCard
            :file="file"
            :selected="isSelected(file)"
            :rag-refresh-key="ragRefreshKey"
            @open="$emit('open-file', $event)"
            @contextmenu="handleItemContextMenu($event, file)"
          />
        </div>
        <EmptyState v-if="filteredFiles.length === 0 && files.length > 0" variant="search" message="未找到匹配的文件" />
        <EmptyState v-if="files.length === 0" message="此文件夹为空" />

      </template>
      <div v-if="marqueeStyle" class="selection-marquee" :style="marqueeStyle"></div>
      <div v-if="isDraggingExternal" class="drop-hint">松开以复制到此目录</div>
    </div>
    <div class="empty-state" v-else>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
      </svg>
      <h2>选择一个知识库</h2>
      <p>从左侧选择或创建一个知识库开始</p>
    </div>

    <KbQuestionBox
      :is-folder="isFolderView"
      :context-label="questionBoxContextLabel"
      :category-id="currentCategoryId"
      :disabled="!selectedKB"
      :current-path="currentPath || ''"
      @ask="handleAsk"
    />

    <!-- 个人/本地知识库提问对话弹窗 -->
    <KbChatDialog
      v-if="currentCategoryId !== 'agent'"
      :visible="chatDialogVisible"
      :is-folder="isFolderView"
      :context-label="questionBoxContextLabel"
      :kb-name="currentTitle"
      :kb-category-id="currentCategoryId"
      :folder-path="chatDialogFolderPath"
      :top-k="10"
      :initial-question="chatDialogInitialQuestion"
      :mode="chatDialogMode"
      :model="chatDialogModel"
      :think-mode="chatDialogThinkMode"
      @close="closeChatDialog"
    />

    <!-- Agent 工作区对话弹窗 -->
    <KbAgentChatDialog
      v-else
      :visible="chatDialogVisible"
      :context-label="questionBoxContextLabel"
      :kb-name="currentTitle"
      :kb-category-id="currentCategoryId"
      :folder-path="chatDialogFolderPath"
      :initial-question="chatDialogInitialQuestion"
      :initial-attachments="chatDialogAttachments"
      :model="chatDialogModel"
      :think-mode="chatDialogThinkMode"
      @close="closeChatDialog"
    />

    <!-- 网页上传对话框 -->
    <NewFolderDialog
      :visible="showWebpageDialog"
      :folder-name="webpageUrl"
      :input-ref="webpageInputRef"
      title="上传网页"
      placeholder="请输入网页地址，如 https://example.com"
      @close="closeWebpageDialog"
      @confirm="confirmWebpageUpload"
      @update:folder-name="webpageUrl = $event"
    />

    <!-- 上传笔记选择对话框 -->
    <SelectNoteDialog
      :visible="showNoteDialog"
      :saving="isSavingNote"
      @close="closeNoteDialog"
      @confirm="confirmNoteUpload"
    />

    <!-- 上传格式错误提示 -->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="showUploadError" class="dialog-overlay" @click.self="showUploadError = false">
          <Transition name="dialog-scale">
            <div v-if="showUploadError" class="dialog-card">
              <div class="dialog-icon-wrap warn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h3 class="dialog-title">不支持的文件格式</h3>
              <p class="dialog-desc" style="white-space: pre-line;">{{ uploadErrorMsg }}</p>
              <div class="dialog-actions">
                <button class="dialog-btn confirm-btn" @click="showUploadError = false">我知道了</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import FileCard from './FileCard.vue';
import EmptyState from './EmptyState.vue';
import KbQuestionBox from './KbQuestionBox.vue';
import KbChatDialog from './KbChatDialog.vue';
import KbAgentChatDialog from './KbAgentChatDialog.vue';
import NewFolderDialog from './NewFolderDialog.vue';
import SelectNoteDialog from './SelectNoteDialog.vue';
import { isAllowedFile, ALLOWED_EXTENSIONS } from '../constants';
import { getFileType, getFileIconComponent, getTypeLabel, formatFileSize } from '../utils';
import { Readability } from '@mozilla/readability';

// 转义 HTML 文本，防止标题/URL 中的特殊字符破坏文档结构
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 视图偏好持久化：在 localStorage 中保留用户的视图模式与排序选择
const VIEW_PREFS_KEY = 'happy-friday-kb-view-prefs';
function loadViewPrefs() {
  try {
    const raw = localStorage.getItem(VIEW_PREFS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function saveViewPrefs() {
  try {
    localStorage.setItem(VIEW_PREFS_KEY, JSON.stringify({
      viewMode: viewMode.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value
    }));
  } catch (e) {
    // 静默失败：持久化仅作体验优化，不应阻塞用户操作
  }
}

const props = defineProps({
  selectedKB: String,
  currentTitle: String,
  currentCategoryId: String,
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
  'show-file-item-context-menu',
  'open-file',
  'open-search-result'
]);

const fileGridRef = ref(null);
const selectedPaths = ref(new Set());
const marquee = ref(null);
const isDraggingExternal = ref(false);
let externalDragDepth = 0;

const marqueeStyle = computed(() => {
  if (!marquee.value) return null;
  const { startX, startY, endX, endY } = marquee.value;
  return {
    left: Math.min(startX, endX) + 'px',
    top: Math.min(startY, endY) + 'px',
    width: Math.abs(endX - startX) + 'px',
    height: Math.abs(endY - startY) + 'px'
  };
});

function isSelected(file) {
  return selectedPaths.value.has(file.path);
}

function selectFile(file, event) {
  if (event.button !== 0) return;
  const next = new Set(selectedPaths.value);
  if (event.metaKey || event.ctrlKey) {
    next.has(file.path) ? next.delete(file.path) : next.add(file.path);
  } else {
    next.clear();
    next.add(file.path);
  }
  selectedPaths.value = next;
}

function selectedFiles(fallback) {
  const selected = props.files.filter(file => selectedPaths.value.has(file.path));
  return selected.length ? selected : (fallback ? [fallback] : []);
}

function handleItemContextMenu(event, file) {
  if (!isSelected(file)) selectedPaths.value = new Set([file.path]);
  emit('show-file-item-context-menu', event, selectedFiles(file));
}

function handleGridContextMenu(event) {
  selectedPaths.value = new Set();
  emit('show-file-context-menu', event);
}

function startMarqueeSelection(event) {
  if (event.button !== 0 || !fileGridRef.value) return;
  const rect = fileGridRef.value.getBoundingClientRect();
  marquee.value = {
    startX: event.clientX - rect.left + fileGridRef.value.scrollLeft,
    startY: event.clientY - rect.top + fileGridRef.value.scrollTop,
    endX: event.clientX - rect.left + fileGridRef.value.scrollLeft,
    endY: event.clientY - rect.top + fileGridRef.value.scrollTop
  };
  selectedPaths.value = new Set();
  document.addEventListener('mousemove', updateMarqueeSelection);
  document.addEventListener('mouseup', finishMarqueeSelection, { once: true });
}

function updateMarqueeSelection(event) {
  if (!marquee.value || !fileGridRef.value) return;
  const grid = fileGridRef.value;
  const rect = grid.getBoundingClientRect();
  marquee.value.endX = event.clientX - rect.left + grid.scrollLeft;
  marquee.value.endY = event.clientY - rect.top + grid.scrollTop;
  const left = Math.min(marquee.value.startX, marquee.value.endX) + rect.left - grid.scrollLeft;
  const top = Math.min(marquee.value.startY, marquee.value.endY) + rect.top - grid.scrollTop;
  const right = Math.max(marquee.value.startX, marquee.value.endX) + rect.left - grid.scrollLeft;
  const bottom = Math.max(marquee.value.startY, marquee.value.endY) + rect.top - grid.scrollTop;
  const next = new Set();
  grid.querySelectorAll('[data-file-path]').forEach(element => {
    const item = element.getBoundingClientRect();
    if (item.left < right && item.right > left && item.top < bottom && item.bottom > top) {
      next.add(element.dataset.filePath);
    }
  });
  selectedPaths.value = next;
}

function finishMarqueeSelection() {
  marquee.value = null;
  document.removeEventListener('mousemove', updateMarqueeSelection);
}

function onExternalDragEnter() {
  externalDragDepth++;
  isDraggingExternal.value = true;
}

function onExternalDragOver(event) {
  event.dataTransfer.dropEffect = 'copy';
  isDraggingExternal.value = true;
}

function onExternalDragLeave() {
  externalDragDepth--;
  if (externalDragDepth <= 0) {
    externalDragDepth = 0;
    isDraggingExternal.value = false;
  }
}

async function onExternalDrop(event, destination) {
  externalDragDepth = 0;
  isDraggingExternal.value = false;
  const api = window.electronAPI;
  const paths = Array.from(event.dataTransfer?.files || []).map(file => {
    try {
      return file.path || api.getPathForFile?.(file);
    } catch (e) {
      return '';
    }
  }).filter(Boolean);
  if (!api || !destination || paths.length === 0) return;
  const result = await api.invoke('kb-copy-drop-items', {
    srcPaths: paths,
    destDir: destination,
    allowedExtensions: props.currentCategoryId === 'agent' ? null : ALLOWED_EXTENSIONS
  });
  if (result?.failed?.length) {
    uploadErrorMsg.value = '部分项目未复制：仅允许支持的文档格式，且同名文件会被覆盖。';
    showUploadError.value = true;
  }
  emit('refresh');
}

const searchVisible = ref(false);
const fileSearchQuery = ref('');
const searchInputRef = ref(null);
const searchResults = ref([]);
const isSearching = computed(() => fileSearchQuery.value.trim().length > 0);
let searchTimer = null;
// 从 localStorage 恢复用户上次的视图偏好；首次访问或读取失败时回退到默认值
const savedViewPrefs = loadViewPrefs();
const viewMode = ref(savedViewPrefs?.viewMode || 'grid');
const showSortMenu = ref(false);
const sortWrapperRef = ref(null);
const sortBy = ref(savedViewPrefs?.sortBy || 'name');
const sortOrder = ref(savedViewPrefs?.sortOrder || 'asc');

// 视图偏好变化时持久化
watch([viewMode, sortBy, sortOrder], saveViewPrefs);

const isFolderView = computed(() => props.pathSegments && props.pathSegments.length > 1);

// 提问上下文标签：知识库视图显示知识库名，文件夹视图显示当前文件夹名
const questionBoxContextLabel = computed(() => {
  if (!props.selectedKB) return '';
  if (isFolderView.value && props.pathSegments && props.pathSegments.length > 0) {
    return props.pathSegments[props.pathSegments.length - 1].name;
  }
  return props.currentTitle || '';
});

// 提问弹窗状态
const chatDialogVisible = ref(false);
const chatDialogInitialQuestion = ref('');
const chatDialogMode = ref('chat');
const chatDialogModel = ref(null);
const chatDialogThinkMode = ref('fast');
const chatDialogFolderPath = ref('');
const chatDialogAttachments = ref([]);

function handleAsk(payload) {
  if (!props.selectedKB) return;

  // 加载模型配置
  const model = loadModelConfig(payload?.modelId);
  if (!model) {
    alert('未配置大模型，请先在设置中添加自己的模型');
    return;
  }

  chatDialogModel.value = model;
  chatDialogInitialQuestion.value = payload.question;
  chatDialogMode.value = payload.mode || 'chat';
  chatDialogThinkMode.value = payload.thinkMode || 'fast';
  chatDialogAttachments.value = payload.attachments || [];
  if (props.currentCategoryId === 'agent') {
    // Agent 工作区：始终传入当前路径（含根目录），让大模型感知用户所在位置
    chatDialogFolderPath.value = props.currentPath || '';
  } else {
    // 个人/本地知识库：文件夹视图时传入当前路径作为过滤条件；知识库视图留空
    chatDialogFolderPath.value = isFolderView.value ? (props.currentPath || '') : '';
  }
  chatDialogVisible.value = true;
}

function closeChatDialog() {
  chatDialogVisible.value = false;
  chatDialogInitialQuestion.value = '';
  chatDialogModel.value = null;
  chatDialogAttachments.value = [];
}

function loadModelConfig(modelId) {
  try {
    const stored = localStorage.getItem('happy-friday-custom-models');
    if (stored) {
      const models = JSON.parse(stored);
      let model = models.find(m => m.id === modelId);
      if (!model && models.length > 0) {
        const selectedId = localStorage.getItem('happy-friday-selected-model');
        model = selectedId ? models.find(m => m.id === selectedId) : models[0];
      }
      return model || null;
    }
  } catch (e) {
    console.error('Failed to load model config:', e);
  }
  return null;
}

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
const showUploadError = ref(false);
const uploadErrorMsg = ref('');

// 网页上传对话框
const showWebpageDialog = ref(false);
const webpageUrl = ref('');
const webpageInputRef = ref(null);
const isSavingWebpage = ref(false);

// 笔记上传对话框
const showNoteDialog = ref(false);
const isSavingNote = ref(false);

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
      if (!filePaths || !filePaths.length) return;

      // 校验文件格式（工作区不限制文件格式）
      if (props.currentCategoryId !== 'agent') {
        const invalidFiles = filePaths.filter(f => !isAllowedFile(f));
        if (invalidFiles.length > 0) {
          const names = invalidFiles.map(f => f.split('/').pop() || f.split('\\').pop());
          uploadErrorMsg.value = `以下文件格式不支持：${names.join('、')}\n\n仅允许上传：PDF、PPT/PPTX、DOC/DOCX、XLS/XLSX、HTML、TXT/CSV/JSON/XML、EPUB 等文本类文件`;
          showUploadError.value = true;
          return;
        }
      }

      const copiedPaths = [];
      for (const src of filePaths) {
        const result = await api.invoke('kb-copy-file', { srcPath: String(src), destDir });
        console.log('[Upload] copy file result:', result);
        if (result && result.success && result.path) {
          copiedPaths.push(result.path);
        }
      }
      emit('refresh');
      // 上传后不自动向量化，由用户右键"构建索引"手动触发
    } else if (type === 'folder') {
      const folderPath = await api.invoke('open-file-dialog', {
        properties: ['openDirectory']
      });
      if (!folderPath) return;
      // 文件夹上传时过滤非法格式文件（工作区不限制文件格式）
      const result = await api.invoke('kb-copy-folder', {
        srcPath: String(folderPath),
        destDir,
        allowedExtensions: props.currentCategoryId === 'agent' ? null : ALLOWED_EXTENSIONS
      });
      console.log('[Upload] copy folder result:', result);
      emit('refresh');
      // 上传后不自动向量化，由用户右键"构建索引"手动触发
    } else if (type === 'note') {
      showNoteDialog.value = true;
    } else if (type === 'webpage') {
      webpageUrl.value = '';
      showWebpageDialog.value = true;
      nextTick(() => {
        webpageInputRef.value?.focus();
      });
    }
  } catch (e) {
    console.error('[Upload] error:', e);
  }
}

function closeWebpageDialog() {
  showWebpageDialog.value = false;
  webpageUrl.value = '';
  isSavingWebpage.value = false;
}

function closeNoteDialog() {
  showNoteDialog.value = false;
  isSavingNote.value = false;
}

async function confirmNoteUpload(selectedNotes) {
  const api = window.electronAPI;
  const destDir = String(props.currentPath || '');
  if (!api || !destDir || !selectedNotes || selectedNotes.length === 0) return;

  isSavingNote.value = true;
  let failedNotes = [];
  const savedPaths = [];
  try {
    for (const note of selectedNotes) {
      const result = await api.invoke('kb-save-note', {
        noteId: note.id,
        title: note.title || '未命名笔记',
        destDir
      });
      if (!result || !result.success) {
        failedNotes.push(note.title || '未命名笔记');
      } else if (result.path) {
        savedPaths.push(result.path);
      }
    }
    if (failedNotes.length > 0) {
      uploadErrorMsg.value = `以下笔记保存失败：${failedNotes.join('、')}`;
      showUploadError.value = true;
    }
    closeNoteDialog();
    emit('refresh');
    // 上传后不自动向量化，由用户右键"构建索引"手动触发
  } catch (e) {
    console.error('[Upload note] error:', e);
    uploadErrorMsg.value = `笔记保存失败：${e.message}`;
    showUploadError.value = true;
    closeNoteDialog();
  }
}

async function confirmWebpageUpload() {
  const url = webpageUrl.value.trim();
  if (!url) return;
  const api = window.electronAPI;
  const destDir = String(props.currentPath || '');
  if (!api || !destDir) return;

  isSavingWebpage.value = true;
  try {
    // 1. 主进程抓取原始 HTML（规避渲染进程跨域限制）
    const fetched = await api.invoke('kb-fetch-webpage', { url });
    if (!fetched.success) {
      uploadErrorMsg.value = `网页抓取失败：${fetched.error}`;
      showUploadError.value = true;
      closeWebpageDialog();
      return;
    }

    // 2. 用 DOMParser + Readability 解析正文，去除导航/广告/推荐位等噪音
    const doc = new DOMParser().parseFromString(fetched.html, 'text/html');
    // 注入 <base> 以便 Readability 解析相对链接
    if (fetched.finalUrl) {
      const base = doc.createElement('base');
      base.href = fetched.finalUrl;
      doc.head.prepend(base);
    }
    const article = new Readability(doc).parse();
    if (!article || !article.content) {
      uploadErrorMsg.value = '无法解析该网页的正文内容，请尝试其他网页地址';
      showUploadError.value = true;
      closeWebpageDialog();
      return;
    }

    const title = article.title || '未命名网页';
    const safeTitle = escapeHtml(title);
    const safeSource = escapeHtml(fetched.finalUrl || url);
    const lang = article.lang ? escapeHtml(article.lang) : '';

    // 3. 组装干净的独立 HTML 文档
    const cleanHtml = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
<meta name="source-url" content="${safeSource}">
</head>
<body>
<article>
<h1>${safeTitle}</h1>
${article.content}
</article>
</body>
</html>`;

    // 4. 保存到目标目录
    const result = await api.invoke('kb-save-webpage', {
      content: cleanHtml,
      title,
      destDir,
      sourceUrl: fetched.finalUrl || url
    });
    if (result.success) {
      closeWebpageDialog();
      emit('refresh');
      // 上传后不自动向量化，由用户右键"构建索引"手动触发
    } else {
      uploadErrorMsg.value = `网页保存失败：${result.error}`;
      showUploadError.value = true;
      closeWebpageDialog();
    }
  } catch (e) {
    console.error('[Upload webpage] error:', e);
    uploadErrorMsg.value = `网页保存失败：${e.message}`;
    showUploadError.value = true;
    closeWebpageDialog();
  }
}

function closeUploadMenu(e) {
  if (uploadWrapperRef.value && !uploadWrapperRef.value.contains(e.target)) {
    showUploadMenu.value = false;
  }
}

const filteredFiles = computed(() => {
  let result = props.files;
  if (fileSearchQuery.value.trim()) {
    const query = fileSearchQuery.value.trim().toLowerCase();
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
    fileSearchQuery.value = '';
  }
}

function closeSearch() {
  searchVisible.value = false;
  fileSearchQuery.value = '';
  searchResults.value = [];
}

// 延迟关闭搜索，避免点击搜索结果时 blur 先触发导致结果消失
function handleSearchBlur() {
  setTimeout(closeSearch, 200);
}

// 防抖递归搜索
function performSearch() {
  const query = fileSearchQuery.value.trim();
  if (!query) {
    searchResults.value = [];
    return;
  }
  const api = window.electronAPI;
  if (!api || !props.currentPath) {
    searchResults.value = [];
    return;
  }
  api.invoke('kb-search-files', {
    dirPath: props.currentPath,
    query,
    allowedExtensions: ALLOWED_EXTENSIONS
  }).then(results => {
    // 为搜索结果补充 type 字段
    searchResults.value = (results || []).map(item => ({
      ...item,
      type: item.isDirectory ? 'folder' : getFileType(item.name)
    }));
  }).catch(e => {
    console.error('[Search] error:', e);
    searchResults.value = [];
  });
}

watch(fileSearchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(performSearch, 250);
});

watch(() => props.files, () => {
  const available = new Set((props.files || []).map(file => file.path));
  selectedPaths.value = new Set([...selectedPaths.value].filter(path => available.has(path)));
}, { deep: true });

function handleSearchResultClick(file) {
  closeSearch();
  emit('open-search-result', file);
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
  return formatFileSize(file.size) || '-';
}

// RAG 索引状态刷新：当队列任务开始/完成或手动更新完成时，刷新文件卡片状态
const ragRefreshKey = ref(0);

function onRagTaskComplete() {
  ragRefreshKey.value++;
}
function onRagUpdateDone() {
  ragRefreshKey.value++;
}
// 任务开始时立即刷新，让 FileCard 显示 'processing' 状态（橙色脉冲圆点）
function onRagBuildProgress(data) {
  if (data && data.phase === 'start') {
    ragRefreshKey.value++;
  }
}

let unsubRagTaskComplete = null;
let unsubRagUpdateDone = null;
let unsubRagBuildProgress = null;

onMounted(() => {
  document.addEventListener('click', closeSortMenu);
  document.addEventListener('click', closeUploadMenu);
  if (window.electronAPI) {
    unsubRagTaskComplete = window.electronAPI.on('rag-task-complete', onRagTaskComplete);
    unsubRagUpdateDone = window.electronAPI.on('rag-update-done', onRagUpdateDone);
    unsubRagBuildProgress = window.electronAPI.on('rag-build-progress', onRagBuildProgress);
  }
});

onBeforeUnmount(() => {
  finishMarqueeSelection();
  // 清理防抖定时器，避免组件卸载后仍触发搜索
  if (searchTimer) {
    clearTimeout(searchTimer);
    searchTimer = null;
  }
  document.removeEventListener('click', closeSortMenu);
  document.removeEventListener('click', closeUploadMenu);
  if (unsubRagTaskComplete) unsubRagTaskComplete();
  if (unsubRagUpdateDone) unsubRagUpdateDone();
  if (unsubRagBuildProgress) unsubRagBuildProgress();
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
    grid-template-columns: repeat(auto-fill, 140px);
    gap: 16px 24px;
    align-content: start;
    position: relative;

    &.is-dropping {
      outline: 2px dashed var(--accent-color);
      outline-offset: -6px;
    }

    .file-card-wrapper {
      width: 140px;
    }

    .selection-marquee {
      position: absolute;
      pointer-events: none;
      background: color-mix(in srgb, var(--accent-color) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent-color) 45%, transparent);
      border-radius: 10px;
      z-index: 5;
    }

    .drop-hint {
      position: absolute;
      inset: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      color: var(--accent-color);
      font-size: 14px;
      font-weight: 500;
      background: color-mix(in srgb, var(--bg-primary) 80%, transparent);
      z-index: 6;
    }

    &.is-empty:not(.list) {
      align-content: center;
    }

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

        &.selected {
          background: color-mix(in srgb, var(--accent-color) 8%, transparent);
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
            &.epub { color: #9C27B0; }
            &.html { color: #00BCD4; }
            &.xml { color: #607D8B; }
            &.json { color: #FF9800; }
          }

          .row-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .row-name-wrap {
            display: flex;
            flex-direction: column;
            min-width: 0;
            flex: 1;
          }

          .row-path {
            font-size: 11px;
            color: var(--text-tertiary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 1px;
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

      // EmptyState 组件在 list 模式下需占满整行
      :deep(.empty-folder) {
        grid-column: auto;
        flex: 1;
        align-items: center;
        justify-content: center;
        padding: 40px 0;
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

.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.dialog-card {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 28px 32px 24px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.dialog-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.warn {
    background: rgba(250, 173, 20, 0.1);
    color: #faad14;
  }
}

[data-theme='dark'] .dialog-icon-wrap.warn {
  background: rgba(250, 173, 20, 0.15);
}

.dialog-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
}

.dialog-desc {
  font-size: 13.5px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.6;
  margin: 0;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 4px;
}

.dialog-btn {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.confirm-btn {
  background: var(--accent-color);
  color: #ffffff;
}

.confirm-btn:hover {
  opacity: 0.9;
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
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-scale-leave-active {
  transition: all 0.15s ease;
}

.dialog-scale-enter-from {
  opacity: 0;
  transform: scale(0.92);
}

.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
