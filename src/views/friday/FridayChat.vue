<template>
  <div class="friday-container" @click="closeAllDropdowns">
    <div class="friday-content">
      <div class="logo-section">
        <div class="logo-badge">定制化个人知识智能服务助手</div>
        <div class="logo-main">
          <img :src="logoImage" alt="Friday" class="logo-image" />
        </div>
        <p class="logo-subtitle">Hello，我是周五！</p>
      </div>

      <div class="input-section">
        <div class="input-wrapper">
          <!-- 挂载的文档标签 -->
          <div class="attachment-area" v-if="attachments.length > 0">
            <div v-for="(att, idx) in attachments" :key="att.id" class="attachment-tag" :class="'tag-' + att.type">
              <span class="tag-icon-wrap">
                <svg v-if="att.type === 'kb'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </span>
              <span class="tag-name">{{ att.name }}</span>
              <span class="tag-type-badge">{{ att.typeLabel }}</span>
              <button class="tag-remove" @click="removeAttachment(idx)" title="移除">
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
              <button class="action-btn icon-only" @click.stop="toggleLinkDropdown($event)" title="引用笔记/文件">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>

              <button class="action-btn icon-only" @click.stop="toggleKbDropdown($event)" title="引用知识库">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
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
              <div class="link-menu-item" @click="openNoteSelect">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <span>选择笔记</span>
              </div>
              <div class="link-menu-item" @click="openKbFileSelect">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>选择知识库文件</span>
              </div>
            </div>
          </div>

          <div v-if="showKbDropdown" class="dropdown-overlay" :style="kbDropdownStyle" @click.stop>
            <div class="dropdown-panel kb-dropdown">
              <div v-if="kbList.length === 0" class="kb-empty">暂无知识库</div>
              <template v-else>
                <div class="kb-item" @click="selectKnowledgeBase('全部知识库')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="kb-item-icon-fallback">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                  </svg>
                  <span class="kb-item-name">全部知识库</span>
                </div>
                <template v-for="category in kbList" :key="category.id">
                  <div v-if="category.items.length > 0" class="kb-category">
                    <div class="kb-category-name">{{ category.name }}</div>
                  <div
                    v-for="item in category.items"
                    :key="item.id"
                    class="kb-item"
                    @click="selectKnowledgeBase(item.name)"
                  >
                    <img v-if="item.coverIndex != null && coverOptions[item.coverIndex]" class="kb-item-icon" :src="coverOptions[item.coverIndex]" alt="" />
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="kb-item-icon-fallback">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
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
                  联网搜索
                </span>
                <label class="toggle-switch">
                  <input type="checkbox" v-model="modelSettings.webSearch">
                  <span class="toggle-slider"></span>
                </label>
              </div>

              <div class="model-row model-think-row">
                <span class="model-label">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  思考模式
                </span>
                <div class="think-tabs">
                  <button
                    class="think-tab"
                    :class="{ active: modelSettings.thinkMode === 'fast' }"
                    @click="modelSettings.thinkMode = 'fast'"
                  >快速</button>
                  <button
                    class="think-tab"
                    :class="{ active: modelSettings.thinkMode === 'deep' }"
                    @click="modelSettings.thinkMode = 'deep'"
                  >深度</button>
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
                    <span v-if="model.embeddingName" class="model-embedding-name">Embedding: {{ model.embeddingName }}</span>
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
                  <span>选择知识库文件</span>
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
                  <div class="sidebar-label">知识库</div>
                  <div class="kb-file-list">
                    <div
                      v-for="category in kbList"
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
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
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
                    <p>{{ selectedKbForFile ? '该知识库暂无文件' : '请从左侧选择知识库' }}</p>
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
import { ref, computed, onMounted, onUnmounted, onDeactivated, onActivated, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { electronService } from '@/services/electron';
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

// 知识库文件选择相关
const selectedKbForFile = ref('');
const kbFileList = ref([]);
const fileBreadcrumb = ref([]);
const currentKbRootPath = ref('');

// 挂载的文档附件
let attachmentIdCounter = 0;
const attachments = ref([]);

const chatModes = [
  { value: 'chat', label: '对话模式' },
  { value: 'memoryless', label: '无忆模式' },
  { value: 'agent', label: 'Agent 模式' }
];

const currentModeLabel = computed(() => {
  const mode = chatModes.find(m => m.value === currentMode.value);
  return mode?.label || '对话模式';
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
      const selectedId = localStorage.getItem(SELECTED_MODEL_KEY);
      if (selectedId && customModels.value.find(m => m.id === selectedId)) {
        modelSettings.value.modelId = selectedId;
      } else if (customModels.value.length > 0) {
        modelSettings.value.modelId = customModels.value[0].id;
      } else {
        modelSettings.value.modelId = '';
      }
    } else {
      customModels.value = [];
      modelSettings.value.modelId = '';
    }
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
  return customModels.value.map(model => ({
    id: model.id,
    name: `${model.providerLabel} ${model.modelName}`,
    embeddingName: model.embeddingModelName || '',
    icon: providerIcons[model.provider] || providerIcons.other,
    badge: ''
  }));
});

const toggleModeDropdown = (event) => {
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  showModeDropdown.value = !showModeDropdown.value;
  showModelDropdown.value = false;
  showKbDropdown.value = false;
  showLinkDropdown.value = false;
  if (showModeDropdown.value) {
    modeDropdownStyle.value = {
      position: 'fixed',
      top: rect.bottom + 8 + 'px',
      left: rect.left + 'px',
      zIndex: '9999'
    };
  }
};

const toggleModelDropdown = (event) => {
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  showModelDropdown.value = !showModelDropdown.value;
  showModeDropdown.value = false;
  showKbDropdown.value = false;
  showLinkDropdown.value = false;
  if (showModelDropdown.value) {
    modelDropdownStyle.value = {
      position: 'fixed',
      top: rect.bottom + 8 + 'px',
      left: rect.left + 'px',
      zIndex: '9999'
    };
  }
};

const toggleKbDropdown = (event) => {
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  showKbDropdown.value = !showKbDropdown.value;
  showModeDropdown.value = false;
  showModelDropdown.value = false;
  showLinkDropdown.value = false;
  if (showKbDropdown.value) {
    kbDropdownStyle.value = {
      position: 'fixed',
      top: rect.bottom + 8 + 'px',
      left: rect.left + 'px',
      zIndex: '9999'
    };
  }
};

const toggleLinkDropdown = (event) => {
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  showLinkDropdown.value = !showLinkDropdown.value;
  showModeDropdown.value = false;
  showModelDropdown.value = false;
  showKbDropdown.value = false;
  if (showLinkDropdown.value) {
    linkDropdownStyle.value = {
      position: 'fixed',
      top: rect.bottom + 8 + 'px',
      left: rect.left + 'px',
      zIndex: '9999'
    };
  }
};

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
    typeLabel: '文件',
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
      typeLabel: '笔记',
      name: note.title || '未命名笔记',
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

const selectKnowledgeBase = (kbName) => {
  attachments.value.push({
    id: ++attachmentIdCounter,
    type: 'kb',
    typeLabel: '知识库',
    name: kbName
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

const selectModel = (modelId) => {
  modelSettings.value.modelId = modelId;
  localStorage.setItem(SELECTED_MODEL_KEY, modelId);
};

const currentModelName = computed(() => {
  const model = customModels.value.find(m => m.id === modelSettings.value.modelId);
  if (!model) return '选择模型';
  const thinkLabel = modelSettings.value.thinkMode === 'deep' ? '· 深度' : '· 快速';
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

  const selectedModel = customModels.value.find(m => m.id === modelSettings.value.modelId);

  if (!selectedModel) return;

  if (currentMode.value === 'agent') {
    console.log('Agent mode is not yet implemented');
    return;
  }

  router.push({
    name: 'friday-chat',
    params: { sessionId: `new-${Date.now()}` },
    query: {
      q: text,
      mode: currentMode.value,
      modelId: selectedModel.id,
      thinkMode: modelSettings.value.thinkMode
    }
  });
};

onMounted(() => {
  document.addEventListener('scroll', closeAllDropdowns, true);
  loadCustomModels();
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
  inputText.value = '';
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }
  loadCustomModels();
});

const features = [
  {
    id: 'record',
    label: '录音纪要',
    desc: '会议转写摘要',
    color: '#8b5cf6',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>'
  },
  {
    id: 'document',
    label: '文档解读',
    desc: '多格式智能分析',
    color: '#3b82f6',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
  },
  {
    id: 'writing',
    label: '智能写作',
    desc: '辅助创作润色',
    color: '#10b981',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
  },
  {
    id: 'image',
    label: '图像生成',
    desc: 'AI 绘图创作',
    color: '#f59e0b',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
  },
  {
    id: 'quick',
    label: '快捷访问',
    desc: '常用功能入口',
    color: '#ec4899',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>'
  }
];

const autoResize = () => {
  const textarea = textareaRef.value;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }
};

const handleFeatureClick = (id) => {
  console.log(`Feature "${id}" is not yet implemented`);
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
  padding: 8px;
}

.kb-empty {
  padding: 16px 12px;
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
}

.kb-category {
  margin-bottom: 4px;
}

.kb-category-name {
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.kb-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.kb-item:hover {
  background: var(--bg-hover);
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

.feature-card:hover {
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
