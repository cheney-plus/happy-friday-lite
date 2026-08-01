<template>
  <div class="friday-container" @click="closeAllDropdowns">
    <div class="friday-content">
      <div class="logo-section">
        <div class="logo-badge">{{ t('friday.badge') }}</div>
        <div class="logo-main">
          <img :src="logoImage" alt="Friday" class="logo-image" />
        </div>
        <p class="logo-subtitle">{{ t('friday.greeting') }}</p>
      </div>

      <div class="input-section">
        <div class="input-wrapper">
          <!-- 挂载的文档标签 -->
          <div class="attachment-area" v-if="attachments.length > 0">
            <div v-for="(att, idx) in attachments" :key="att.id" class="attachment-tag" :class="'tag-' + att.type">
              <span class="tag-icon-wrap">
                <svg v-if="att.type === 'kb'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </span>
              <span class="tag-name">{{ att.name }}</span>
              <span class="tag-type-badge">{{ att.typeLabel }}</span>
              <button class="tag-remove" @click="removeAttachment(idx)" :title="t('friday.remove')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          <textarea
            v-model="inputText"
            class="main-input"
            :placeholder="t('friday.placeholder')"
            rows="1"
            @input="autoResize"
            ref="textareaRef"
          ></textarea>

          <div class="input-actions">
            <div class="action-left">
              <button class="action-btn dropdown-btn" @click.stop="toggleModeDropdown($event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>{{ currentModeLabel }}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <button class="action-btn dropdown-btn" @click.stop="toggleModelDropdown($event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <span>{{ currentModelName }}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

            </div>

            <div class="action-right">
              <button class="action-btn icon-only" @click.stop="toggleLinkDropdown($event)" :title="t('friday.referenceNoteFile')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>

              <button v-if="currentMode !== 'agent'" class="action-btn icon-only" @click.stop="toggleKbDropdown($event)" :title="t('friday.referenceKb')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
              </button>

              <button class="send-btn" :class="{ active: inputText.trim() }" @click="handleSend">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <Teleport to="body">
          <div v-if="showLinkDropdown" class="dropdown-overlay" :style="linkDropdownStyle" @click.stop>
            <div class="dropdown-panel link-dropdown">
              <div class="link-menu-item item-note" @click="openNoteSelect">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <span>{{ t('friday.selectNote') }}</span>
              </div>
              <div class="link-menu-item item-kb-file" @click="openKbFileSelect">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>{{ t('friday.selectKbFile') }}</span>
              </div>
            </div>
          </div>

          <div v-if="showKbDropdown" class="dropdown-overlay" :style="kbDropdownStyle" @click.stop>
            <div class="dropdown-panel kb-dropdown">
              <div v-if="selectableKbList.length === 0" class="kb-empty">{{ t('friday.kbEmpty') }}</div>
              <template v-else>
                <div class="kb-item" @click="selectKnowledgeBase(t('friday.allKb'), null)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="kb-item-icon-fallback">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                  </svg>
                  <span class="kb-item-name">{{ t('friday.allKb') }}</span>
                </div>
                <template v-for="category in selectableKbList" :key="category.id">
                  <div v-if="category.items.length > 0" class="kb-category">
                    <div class="kb-category-name">{{ category.name }}</div>
                  <div
                    v-for="item in category.items"
                    :key="item.id"
                    class="kb-item"
                    @click="selectKnowledgeBase(item.name, category.id)"
                  >
                    <img v-if="item.coverIndex != null && coverOptions[item.coverIndex]" class="kb-item-icon" :src="coverOptions[item.coverIndex]" alt="" />
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="kb-item-icon-fallback">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                    <span class="kb-item-name">{{ item.name }}</span>
                  </div>
                </div>
              </template>
              </template>
            </div>
          </div>

          <div v-if="showModeDropdown" class="dropdown-overlay" :style="modeDropdownStyle" @click.stop>
            <div class="dropdown-panel mode-dropdown">
              <div
                v-for="mode in chatModes"
                :key="mode.value"
                class="dropdown-item"
                :class="{ active: currentMode === mode.value }"
                @click="selectMode(mode.value)"
              >
                {{ mode.label }}
              </div>
            </div>
          </div>

          <div v-if="showModelDropdown" class="dropdown-overlay" :style="modelDropdownStyle" @click.stop>
            <div class="dropdown-panel model-dropdown">
              <div class="model-row model-toggle-row">
                <span class="model-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  {{ t('friday.webSearch') }}
                </span>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="modelSettings.webSearch">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="model-row model-think-row">
                <span class="model-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  {{ t('friday.thinkMode') }}
                </span>
                <div class="think-tabs">
                  <button
                    class="think-tab"
                    :class="{ active: modelSettings.thinkMode === 'fast' }"
                    @click="modelSettings.thinkMode = 'fast'"
                  >{{ t('friday.thinkFast') }}</button>
                  <button
                    class="think-tab"
                    :class="{ active: modelSettings.thinkMode === 'deep' }"
                    @click="modelSettings.thinkMode = 'deep'"
                  >{{ t('friday.thinkDeep') }}</button>
                </div>
              </div>

              <div class="model-model-list">
                <div
                  v-for="model in modelList"
                  :key="model.id"
                  class="model-item"
                  :class="{ active: modelSettings.modelId === model.id }"
                  @click="selectModel(model.id)"
                >
                  <img :src="model.icon" class="model-icon" alt="" />
                  <div class="model-info">
                    <span class="model-name">{{ model.name }}</span>
                    <span v-if="model.embeddingName" class="model-embedding-name">{{ t('friday.embedding') }}: {{ model.embeddingName }}</span>
                  </div>
                  <svg v-if="modelSettings.modelId === model.id" class="model-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
            </div>
          </div>
        </Teleport>
      </div>

      <div class="features-section">
        <div
          v-for="feature in features"
          :key="feature.id"
          class="feature-card"
          @click="handleFeatureClick(feature.id)"
        >
          <div class="feature-icon-wrap" :style="{ '--feature-color': feature.color }">
            <div class="feature-icon" v-html="feature.icon"></div>
          </div>
          <span class="feature-label">{{ feature.label }}</span>
          <span class="feature-desc">{{ feature.desc }}</span>
        </div>
      </div>
    </div>

    <ChatHistoryDrawer />

    <SelectNoteDialog
      :visible="showNoteDialog"
      @close="showNoteDialog = false"
      @confirm="handleNoteConfirm"
    />

    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="showKbFileDialog" class="kb-file-overlay" @click.self="showKbFileDialog = false">
          <Transition name="dialog-scale">
            <div v-if="showKbFileDialog" class="kb-file-dialog">
              <div class="kb-file-header">
                <div class="header-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span>{{ t('friday.selectKbFile') }}</span>
                </div>
                <button class="dialog-close" @click="showKbFileDialog = false">
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
                        :class="{ active: selectedKbForFile === item.id }"
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
                    <p>{{ selectedKbForFile ? t('friday.fileEmptySelected') : t('friday.fileEmptyUnselected') }}</p>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onDeactivated, onActivated, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/store';
import ChatHistoryDrawer from '@/components/chat/ChatHistoryDrawer.vue';
import SelectNoteDialog from '@/views/knowledge/components/SelectNoteDialog.vue';
import { coverOptions, DEFAULT_CATEGORIES } from '@/views/knowledge/constants';

const router = useRouter();
const { t } = useI18n();
const appStore = useAppStore();
const inputText = ref('');
const textareaRef = ref(null);

const isDark = computed(() => appStore.theme === 'dark');
const logoImage = computed(() => {
  return isDark.value
    ? new URL('@/assets/images/friday-b.png', import.meta.url).href
    : new URL('@/assets/images/friday-w.png', import.meta.url).href;
});

const showModeDropdown = ref(false);
const showModelDropdown = ref(false);
const showKbDropdown = ref(false);
const showLinkDropdown = ref(false);
const showNoteDialog = ref(false);
const showKbFileDialog = ref(false);
const currentMode = ref('chat');
const modeDropdownStyle = ref({});
const modelDropdownStyle = ref({});
const kbDropdownStyle = ref({});
const linkDropdownStyle = ref({});

// 知识库列表
const kbList = ref(JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)));

// 可选择的知识库列表（排除 Agent 智能体目录）
const selectableKbList = computed(() => kbList.value.filter(c => c.id !== 'agent'));

// 知识库文件选择相关
const selectedKbForFile = ref('');
const kbFileList = ref([]);
const fileBreadcrumb = ref([]);
const currentKbRootPath = ref('');

// 挂载的文档附件
let attachmentIdCounter = 0;
const attachments = ref([]);

const chatModes = computed(() => [
  { value: 'chat', label: t('friday.modeChat') },
  { value: 'memoryless', label: t('friday.modeMemoryless') },
  { value: 'agent', label: t('friday.modeAgent') }
]);

const currentModeLabel = computed(() => {
  const mode = chatModes.value.find(m => m.value === currentMode.value);
  return mode?.label || t('friday.modeChat');
});

const modelSettings = ref({
  webSearch: true,
  thinkMode: 'fast',
  modelId: ''
});

const customModels = ref([]);

const STORAGE_KEY = 'happy-friday-custom-models';
const SELECTED_MODEL_KEY = 'happy-friday-selected-model';

const loadCustomModels = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      customModels.value = JSON.parse(stored);
    }
    const selectedId = localStorage.getItem(SELECTED_MODEL_KEY);
    const exists = customModels.value.some(m => m.id === selectedId);
    modelSettings.value.modelId = exists ? selectedId : (customModels.value[0]?.id || '');
  } catch (error) {
    console.error('Failed to load custom models:', error);
  }
};

const providerIcons = {
  doubao: new URL('@/assets/images/豆包.png', import.meta.url).href,
  qwen: new URL('@/assets/images/千问.png', import.meta.url).href,
  zhipu: new URL('@/assets/images/智谱logo.png', import.meta.url).href,
  deepseek: new URL('@/assets/images/deepseek.png', import.meta.url).href,
  kimi: new URL('@/assets/images/kimi-icon.png', import.meta.url).href,
  minimax: new URL('@/assets/images/MiniMax.png', import.meta.url).href,
  other: new URL('@/assets/images/其他模型.png', import.meta.url).href
};

const modelList = computed(() => {
  const list = [];
  // 自定义模型
  for (const model of customModels.value) {
    list.push({
      id: model.id,
      name: `${model.providerLabel} ${model.modelName}`,
      embeddingName: model.embeddingModelName || '',
      icon: providerIcons[model.provider] || providerIcons.other,
      badge: ''
    });
  }
  return list;
});

// 下拉菜单配置：name -> { show, style }
const dropdownRefs = {
  mode: { show: showModeDropdown, style: modeDropdownStyle },
  model: { show: showModelDropdown, style: modelDropdownStyle },
  kb: { show: showKbDropdown, style: kbDropdownStyle },
  link: { show: showLinkDropdown, style: linkDropdownStyle }
};

// 通用下拉切换：再次点击已打开的下拉可关闭，否则打开目标并关闭其余
const toggleDropdown = (name, event) => {
  const target = dropdownRefs[name];
  if (!target) return;
  const wasOpen = target.show.value;
  Object.values(dropdownRefs).forEach(ref => { ref.show.value = false; });
  if (wasOpen) return;
  const rect = event.currentTarget.getBoundingClientRect();
  target.show.value = true;
  target.style.value = {
    position: 'fixed',
    top: rect.bottom + 8 + 'px',
    left: rect.left + 'px',
    zIndex: '9999'
  };
};

const toggleModeDropdown = (event) => toggleDropdown('mode', event);
const toggleModelDropdown = (event) => toggleDropdown('model', event);
const toggleKbDropdown = (event) => toggleDropdown('kb', event);
const toggleLinkDropdown = (event) => toggleDropdown('link', event);

const openNoteSelect = () => {
  showLinkDropdown.value = false;
  showNoteDialog.value = true;
};

const openKbFileSelect = () => {
  showLinkDropdown.value = false;
  selectedKbForFile.value = '';
  kbFileList.value = [];
  fileBreadcrumb.value = [];
  showKbFileDialog.value = true;
};

const loadKbFiles = async (item, categoryId) => {
  const api = window.electronAPI;
  if (!api) return;
  selectedKbForFile.value = item.id;
  let dataDir = '';
  try {
    dataDir = await api.invoke('kb-get-data-dir');
  } catch (e) {
    console.error('Failed to get data dir:', e);
    return;
  }
  const kbDir = dataDir + '/knowledge/' + categoryId + '/' + item.name;
  currentKbRootPath.value = kbDir;
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
  attachments.value.push({
    id: ++attachmentIdCounter,
    type: 'kb-file',
    typeLabel: t('friday.tagFile'),
    name: file.name,
    path: file.path
  });
  showKbFileDialog.value = false;
  nextTick(() => {
    textareaRef.value?.focus();
    autoResize();
  });
};

const handleNoteConfirm = (selectedNotes) => {
  if (!selectedNotes || selectedNotes.length === 0) return;
  for (const note of selectedNotes) {
    attachments.value.push({
      id: ++attachmentIdCounter,
      type: 'note',
      typeLabel: t('friday.tagNote'),
      name: note.title || t('friday.untitledNote'),
      noteId: note.id,
      content: note.contentText || ''
    });
  }
  showNoteDialog.value = false;
  nextTick(() => {
    textareaRef.value?.focus();
    autoResize();
  });
};

const removeAttachment = (idx) => {
  attachments.value.splice(idx, 1);
};

const selectKnowledgeBase = (kbName, categoryId) => {
  attachments.value.push({
    id: ++attachmentIdCounter,
    type: 'kb',
    typeLabel: t('friday.tagKb'),
    name: kbName,
    categoryId: categoryId || null
  });
  showKbDropdown.value = false;
  nextTick(() => {
    textareaRef.value?.focus();
    autoResize();
  });
};

const selectMode = (mode) => {
  currentMode.value = mode;
  showModeDropdown.value = false;
};

// 切换到 Agent 模式时清除知识库附件（Agent 通过 retrieve_knowledge 工具自主检索）
watch(currentMode, (newMode) => {
  if (newMode === 'agent') {
    attachments.value = attachments.value.filter(a => a.type !== 'kb');
  }
});

const selectModel = (modelId) => {
  modelSettings.value.modelId = modelId;
  localStorage.setItem(SELECTED_MODEL_KEY, modelId);
};

const currentModelName = computed(() => {
  const model = customModels.value.find(m => m.id === modelSettings.value.modelId);
  if (!model) return t('friday.selectModel');
  const thinkLabel = modelSettings.value.thinkMode === 'deep' ? `· ${t('friday.thinkDeep')}` : `· ${t('friday.thinkFast')}`;
  return `${model.modelName} ${thinkLabel}`;
});

const closeAllDropdowns = () => {
  showModeDropdown.value = false;
  showModelDropdown.value = false;
  showKbDropdown.value = false;
  showLinkDropdown.value = false;
};

// 从磁盘扫描知识库列表
const loadKbListFromDisk = async () => {
  const api = window.electronAPI;
  if (!api) return;
  let dataDir = '';
  try {
    dataDir = await api.invoke('kb-get-data-dir');
  } catch (e) {
    console.error('Failed to get data dir:', e);
    return;
  }
  if (!dataDir) return;
  const baseDir = dataDir + '/knowledge';
  for (const category of kbList.value) {
    const catDir = baseDir + '/' + category.id;
    try {
      await api.invoke('kb-create-dir', { dirPath: catDir });
      const entries = await api.invoke('kb-read-dir', { dirPath: catDir });
      // 只添加磁盘上存在但列表中没有的文件夹
      for (const entry of entries) {
        if (entry.isDirectory && !category.items.some(i => i.name === entry.name)) {
          category.items.push({
            id: `kb-${category.id}-${entry.name}`,
            name: entry.name,
            coverIndex: null
          });
        }
      }
    } catch (e) {
      console.error(`Failed to load category ${category.id}:`, e);
    }
  }
};

const handleSend = async () => {
  const text = inputText.value.trim();
  if (!text) return;

  // 查找选中的自定义模型
  const selectedModel = customModels.value.find(m => m.id === modelSettings.value.modelId);

  if (!selectedModel) {
    alert('未配置大模型，请先在设置中添加自己的模型');
    router.push('/settings/model');
    return;
  }

  // 所有模式统一支持 @ 引用笔记/知识库文件
  // - note / kb-file：直接将内容注入到首条用户消息中（LLM 上下文 10k 字符）
  // - kb：作为 RAG 检索源，仅在 chat/memoryless 模式生效（Agent 模式通过 watcher 自动清除 kb 附件）
  const noteAttachments = attachments.value.filter(a => a.type === 'note');
  const kbFileAttachments = attachments.value.filter(a => a.type === 'kb-file');

  let hasAtt = false;
  if (noteAttachments.length > 0 || kbFileAttachments.length > 0) {
    const attData = buildAttachmentData(text, noteAttachments, kbFileAttachments);
    if (attData) {
      // 通过 sessionStorage 传递：userMessage（简洁引用格式）+ attachments（元数据）
      sessionStorage.setItem('friday-att-data', JSON.stringify(attData));
      hasAtt = true;
    }
  }

  // 提取知识库附件信息（用于 chat/memoryless 模式的 RAG 检索）
  const kbAttachment = attachments.value.find(a => a.type === 'kb');
  const kbName = kbAttachment ? kbAttachment.name : '';
  const kbCategoryId = kbAttachment && kbAttachment.categoryId ? kbAttachment.categoryId : '';

  router.push({
    name: 'friday-chat',
    params: { sessionId: `new-${Date.now()}` },
    query: {
      q: text,
      mode: currentMode.value,
      modelId: selectedModel.id,
      thinkMode: modelSettings.value.thinkMode,
      kbName,
      kbCategoryId,
      ...(hasAtt ? { hasAtt: 'true' } : {})
    }
  });
};

// 构造 @ 引用相关数据
// 前端只构造简洁的引用格式（用户气泡 + 数据库存储）：
//   {text}\n\n---\n用户引用【笔记】：xxx\n用户引用【文档】：yyy
// 后端根据附件元数据 attachments 和 mode 构造 LLM 提示（不在前端展示）
const buildAttachmentData = (text, noteAttachments, kbFileAttachments) => {
  if (noteAttachments.length === 0 && kbFileAttachments.length === 0) {
    return null;
  }

  // 简洁引用格式（前端展示 + 数据库存储）
  const refLines = [];
  for (const note of noteAttachments) {
    refLines.push(`${t('friday.refNote')}${note.name}`);
  }
  for (const file of kbFileAttachments) {
    refLines.push(`${t('friday.refDoc')}${file.name}`);
  }
  const userMessage = `${text}\n\n---\n${refLines.join('\n')}`;

  // 附件元数据（供后端构造 LLM 消息时使用）
  const attachments = [];
  for (const note of noteAttachments) {
    attachments.push({ kind: 'note', name: note.name, noteId: note.noteId });
  }
  for (const file of kbFileAttachments) {
    attachments.push({ kind: 'file', name: file.name, path: file.path });
  }

  return { userMessage, attachments };
};

onMounted(() => {
  document.addEventListener('scroll', closeAllDropdowns, true);
  // loadCustomModels() 由 onActivated 统一触发（keep-alive 首次挂载时 onActivated 也会执行）
  loadKbListFromDisk();
});

onUnmounted(() => {
  document.removeEventListener('scroll', closeAllDropdowns, true);
});

onDeactivated(() => {
  showModeDropdown.value = false;
  showModelDropdown.value = false;
  showKbDropdown.value = false;
  showLinkDropdown.value = false;
});

onActivated(() => {
  // 保留输入框文字，仅重新计算高度以适配恢复后的内容
  nextTick(() => {
    autoResize();
  });
  loadCustomModels();
});

const features = computed(() => [
  {
    id: 'office',
    label: t('friday.featureOffice'),
    desc: t('friday.featureOfficeDesc'),
    color: '#8b5cf6',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'
  },
  {
    id: 'document',
    label: t('friday.featureDocument'),
    desc: t('friday.featureDocumentDesc'),
    color: '#3b82f6',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
  },
  {
    id: 'writing',
    label: t('friday.featureWriting'),
    desc: t('friday.featureWritingDesc'),
    color: '#10b981',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
  },
  {
    id: 'knowledge',
    label: t('friday.featureKnowledge'),
    desc: t('friday.featureKnowledgeDesc'),
    color: '#f59e0b',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="12" cy="10" r="2.5"/><line x1="14" y1="12" x2="16" y2="14"/></svg>'
  },
  {
    id: 'schedule',
    label: t('friday.featureSchedule'),
    desc: t('friday.featureScheduleDesc'),
    color: '#ec4899',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
  }
]);

const autoResize = () => {
  const textarea = textareaRef.value;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }
};

const handleFeatureClick = (id) => {
  // TODO: 各特性入口待实现
};
</script>

<style scoped>
.friday-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: 40px 20px;
  background-color: var(--bg-sidebar);
  overflow: hidden;
}

.friday-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  max-width: 800px;
  width: 100%;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.logo-badge {
  padding: 4px 12px;
  background: linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 100%);
  color: #065f46;
  font-size: 12px;
  font-weight: 500;
  border-radius: 12px;
  margin-bottom: 4px;
}

[data-theme='dark'] .logo-badge {
  background: linear-gradient(135deg, #065f46 0%, #047857 100%);
  color: #d1fae5;
}

.logo-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 32px;
  color: var(--text-primary);
}

.logo-image {
  height: 100px;
  width: auto;
  object-fit: contain;
  margin: 0;
}

.logo-subtitle {
  font-size: 16px;
  font-weight: 400;
  color: var(--text-secondary);
  letter-spacing: 3px;
  margin: 0;
}

.input-section {
  width: 100%;
  position: relative;
}

.input-wrapper {
  max-width: 750px;
  margin: 0 auto;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 28px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: var(--text-tertiary);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.attachment-area {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 18px 2px;

  .attachment-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 4px 3px 3px;
    background: var(--bg-secondary, #f7f7f7);
    border: 1px solid var(--border-color, #eee);
    border-radius: 8px;
    font-size: 12.5px;
    color: var(--text-primary);
    max-width: 260px;
    transition: all 0.15s ease;
    line-height: 1;

    &:hover {
      background: var(--bg-hover, #f0f0f0);

      .tag-remove {
        opacity: 1;
      }
    }

    &.tag-kb {
      --tag-accent: #10b981;
    }

    &.tag-note {
      --tag-accent: #6366f1;
    }

    &.tag-kb-file {
      --tag-accent: #f59e0b;
    }

    .tag-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--tag-accent, #10b981) 12%, transparent);
      color: var(--tag-accent, #10b981);
      flex-shrink: 0;
    }

    .tag-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 120px;
      font-weight: 500;
      font-size: 12.5px;
    }

    .tag-type-badge {
      font-size: 10px;
      font-weight: 500;
      color: var(--tag-accent, #10b981);
      background: color-mix(in srgb, var(--tag-accent, #10b981) 10%, transparent);
      padding: 1px 5px;
      border-radius: 4px;
      flex-shrink: 0;
      white-space: nowrap;
      line-height: 1.4;
    }

    .tag-remove {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border: none;
      background: transparent;
      color: var(--text-tertiary, #aaa);
      cursor: pointer;
      border-radius: 5px;
      opacity: 0;
      transition: all 0.12s;
      flex-shrink: 0;

      &:hover {
        background: rgba(0, 0, 0, 0.08);
        color: var(--text-primary);
      }
    }
  }
}

.main-input {
  width: 100%;
  padding: 18px 28px 6px;
  border: none;
  outline: none;
  resize: none;
  font-size: 16px;
  line-height: 1.5;
  color: var(--text-primary);
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 52px;
  max-height: 200px;
  overflow-y: auto;
}

.main-input::-webkit-scrollbar {
  width: 5px;
}

.main-input::-webkit-scrollbar-track {
  background: transparent;
}

.main-input::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 10px;
}

.main-input::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

.main-input::placeholder {
  color: var(--text-tertiary);
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px 12px;
}

.action-left,
.action-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 20px;
  font-size: 13.5px;
  font-weight: 500;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--bg-hover);
}

.dropdown-btn span {
  font-size: 13.5px;
}

.dropdown-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.dropdown-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--text-tertiary);
}

.icon-only {
  padding: 8px 10px;
}

.icon-only:not(.send-btn) {
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  background: var(--text-tertiary);
  color: #ffffff;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
  margin-left: 4px;
}

.send-btn.active {
  background: var(--text-primary);
  color: #ffffff;
}

.send-btn:hover {
  transform: scale(1.06);
}

.dropdown-overlay {
  animation: dropdownIn 0.15s ease-out;
}

@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

.dropdown-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
}

.mode-dropdown {
  min-width: 140px;
  padding: 6px;
}

.dropdown-item {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.12s ease;
  white-space: nowrap;
}

.dropdown-item:hover {
  background: var(--bg-hover);
}

.dropdown-item.active {
  background: #ecfdf5;
  color: #059669;
  font-weight: 600;
}

.model-dropdown {
  min-width: 320px;
  padding: 16px;
}

.link-dropdown {
  min-width: 180px;
  padding: 6px;
}

.link-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13.5px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.12s ease;

  &:hover {
    background: var(--bg-hover);
  }

  svg {
    color: var(--text-secondary);
    flex-shrink: 0;
    transition: color 0.12s ease;
  }

  &:hover svg {
    color: #f59e0b;
  }
}

/* 知识库文件选择弹窗 */
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

  .header-title {
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

    &:hover {
      background: var(--bg-hover, #f0f0f0);
      color: var(--text-primary, #333);
    }
  }
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

  .sidebar-label {
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

    &:hover {
      background: var(--bg-hover, rgba(0, 0, 0, 0.04));
      color: var(--text-primary, #333);
    }

    &.active {
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
  }
}

.kb-file-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;

  .file-breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 10px 14px;
    font-size: 12.5px;
    color: var(--text-tertiary, #999);
    flex-shrink: 0;
    flex-wrap: wrap;

    .breadcrumb-item {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      transition: color 0.12s;

      &:hover {
        color: var(--accent-color, #1560F7);
      }
    }
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

    &:hover {
      background: var(--bg-hover, #f5f5f5);
    }

    &.folder {
      color: var(--text-secondary, #555);
    }

    svg {
      color: var(--text-tertiary, #999);
      flex-shrink: 0;
    }

    .file-name {
      font-size: 13.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .file-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary, #c0c0c0);
    font-size: 13px;
  }
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

.kb-dropdown {
  min-width: 220px;
  max-width: 280px;
  max-height: 360px;
  overflow-y: auto;
  padding: 6px;
}

.kb-empty {
  padding: 12px 8px;
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
}

.kb-category {
  margin-bottom: 2px;
}

.kb-category-name {
  padding: 4px 8px 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kb-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.kb-item:hover {
  background: var(--bg-hover);
}

.kb-item:hover .kb-item-icon-fallback {
  color: #10b981;
}

.kb-item-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.kb-item-icon-fallback {
  width: 18px;
  height: 18px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: color 0.12s ease;
}

.kb-item-name {
  font-size: 13.5px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
}

.model-toggle-row {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.model-think-row {
  padding-top: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-color);
}

.model-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.toggle-switch {
  position: relative;
  width: 42px;
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
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: var(--text-tertiary);
  border-radius: 24px;
  transition: 0.25s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.25s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #10b981;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(18px);
}

.think-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 3px;
}

.think-tab {
  padding: 5px 14px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.think-tab.active {
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.think-tab:hover:not(.active) {
  color: var(--text-primary);
}

.model-model-list {
  margin-top: 12px;
}

.model-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.12s ease;
  gap: 10px;
}

.model-item:hover {
  background: var(--bg-secondary);
}

.model-item.active {
  background: #ecfdf5;
}

.model-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  object-fit: contain;
  flex-shrink: 0;
}

.model-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.model-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.model-embedding-name {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-item.active .model-name {
  color: #059669;
}

.model-badge {
  font-size: 11px;
  font-weight: 600;
  color: #10b981;
  background: #d1fae5;
  padding: 2px 8px;
  border-radius: 6px;
}

.model-check {
  flex-shrink: 0;
}

.features-section {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}

.feature-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 14px;
  min-width: 100px;
}

.feature-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--feature-color, #9ca3af) 10%, transparent);
  transition: all 0.25s ease;
}

.feature-card:hover .feature-icon-wrap {
  background: var(--feature-color, #9ca3af);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--feature-color, #9ca3af) 35%, transparent);
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--feature-color, #6b7280);
  transition: all 0.25s ease;
}

.feature-card:hover .feature-icon {
  color: #ffffff;
}

.feature-label {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.feature-desc {
  font-size: 11.5px;
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.4;
}
</style>
