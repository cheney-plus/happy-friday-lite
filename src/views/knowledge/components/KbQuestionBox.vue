<template>
  <div class="question-box" @click="closeAllDropdowns">
    <div class="input-wrapper">
      <!-- @ 附件标签区 -->
      <div class="attachment-area" v-if="attachments.length > 0">
        <div v-for="(att, idx) in attachments" :key="att.id" class="attachment-tag" :class="att.isDirectory ? 'tag-folder' : 'tag-file'">
          <span class="tag-icon-wrap">
            <svg v-if="att.isDirectory" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </span>
          <span class="tag-name">{{ att.name }}</span>
          <button class="tag-remove" @click.stop="removeAttachment(idx)" title="移除">
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
        :placeholder="placeholderText"
        rows="1"
        @input="autoResize"
        @keydown.enter.exact="handleSendKeydown"
        ref="textareaRef"
      ></textarea>

      <div class="input-actions">
        <div class="action-left">
          <button class="action-btn dropdown-btn" :class="{ 'mode-fixed': isAgentCategory }" @click.stop="toggleModeDropdown($event)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>{{ currentModeLabel }}</span>
            <svg v-if="!isAgentCategory" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          <!-- Agent 模式：@ 引用文件/文件夹按钮 -->
          <button v-if="isAgentCategory" class="action-btn icon-only" @click.stop="openFileSelect" title="引用文件或文件夹">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
          <button
            class="send-btn"
            :class="{ active: inputText.trim() }"
            @click="handleSend"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
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
            <div v-if="modelList.length === 0" class="model-empty">
              <span>暂无可用模型，请先在设置中配置</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Agent 模式：文件/文件夹选择对话框 -->
    <AgentFileSelectDialog
      :visible="showFileSelectDialog"
      :root-dir="agentRootDir"
      :initial-path="currentPath"
      @close="showFileSelectDialog = false"
      @select="handleFileSelect"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onActivated, nextTick } from 'vue';
import AgentFileSelectDialog from './AgentFileSelectDialog.vue';

const props = defineProps({
  isFolder: { type: Boolean, default: false },
  contextLabel: { type: String, default: '' },
  categoryId: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  currentPath: { type: String, default: '' }
});

const emit = defineEmits(['ask']);

const inputText = ref('');
const textareaRef = ref(null);

const showModeDropdown = ref(false);
const showModelDropdown = ref(false);
const modeDropdownStyle = ref({});
const modelDropdownStyle = ref({});
const currentMode = ref('chat');

const chatModes = [
  { value: 'chat', label: '对话模式' },
  { value: 'memoryless', label: '无忆模式' },
  { value: 'agent', label: 'Agent 模式' }
];

// Agent 工作区固定为 Agent 模式，不可切换
const isAgentCategory = computed(() => props.categoryId === 'agent');

watch(() => props.categoryId, (newCat) => {
  if (newCat === 'agent') {
    currentMode.value = 'agent';
  } else if (currentMode.value === 'agent') {
    currentMode.value = 'chat';
  }
}, { immediate: true });

const currentModeLabel = computed(() => {
  const mode = chatModes.find(m => m.value === currentMode.value);
  return mode?.label || '对话模式';
});

const placeholderText = computed(() => {
  if (props.disabled) return '请先选择知识库';
  if (props.categoryId === 'agent') return '在本目录执行 Agent 工作流...';
  return props.isFolder ? '基于当前文件夹提问...' : '基于当前知识库提问...';
});

const modelSettings = ref({
  thinkMode: 'fast',
  modelId: ''
});

const customModels = ref([]);

// 系统默认模型（不含 API Key，仅用于展示）
const DEFAULT_MODEL_ID = 'system-default-qwen';
const defaultModel = ref(null);

// ========== Agent 模式：@ 附件 ==========
let attachmentIdCounter = 0;
const attachments = ref([]);
const showFileSelectDialog = ref(false);
const agentRootDir = ref('');

async function ensureAgentRootDir() {
  if (agentRootDir.value) return;
  try {
    const api = window.electronAPI;
    if (api) {
      const dataDir = await api.invoke('kb-get-data-dir');
      if (dataDir) {
        agentRootDir.value = dataDir.replace(/\/$/, '') + '/knowledge/agent';
      }
    }
  } catch (e) {
    console.error('Failed to get data dir:', e);
  }
}

function openFileSelect() {
  ensureAgentRootDir();
  showFileSelectDialog.value = true;
}

function handleFileSelect(item) {
  attachments.value.push({
    id: ++attachmentIdCounter,
    name: item.name,
    path: item.path,
    virtualPath: item.virtualPath,
    isDirectory: item.isDirectory
  });
  showFileSelectDialog.value = false;
  nextTick(() => {
    textareaRef.value?.focus();
    autoResize();
  });
}

function removeAttachment(idx) {
  attachments.value.splice(idx, 1);
}

const STORAGE_KEY = 'happy-friday-custom-models';
const SELECTED_MODEL_KEY = 'happy-friday-selected-model';

const loadCustomModels = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      customModels.value = JSON.parse(stored);
    }
    const selectedId = localStorage.getItem(SELECTED_MODEL_KEY);
    if (selectedId) {
      if (customModels.value.find(m => m.id === selectedId)) {
        modelSettings.value.modelId = selectedId;
      } else if (selectedId === DEFAULT_MODEL_ID) {
        modelSettings.value.modelId = selectedId;
      } else if (customModels.value.length > 0) {
        modelSettings.value.modelId = customModels.value[0].id;
      } else {
        modelSettings.value.modelId = '';
      }
    } else if (customModels.value.length > 0) {
      modelSettings.value.modelId = customModels.value[0].id;
    } else {
      modelSettings.value.modelId = '';
    }
  } catch (error) {
    console.error('Failed to load custom models:', error);
  }
};

// 从后端加载系统默认模型信息
const loadDefaultModel = async () => {
  try {
    const result = await window.electronAPI?.invoke('get-default-model');
    if (result && result.model) {
      defaultModel.value = result.model;
    }
  } catch (e) {
    console.error('Failed to load default model:', e);
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
  if (defaultModel.value) {
    list.push({
      id: defaultModel.value.id,
      name: `${defaultModel.value.providerLabel} ${defaultModel.value.modelName}`,
      embeddingName: defaultModel.value.embeddingModelName || '',
      icon: providerIcons[defaultModel.value.provider] || providerIcons.other
    });
  }
  for (const model of customModels.value) {
    list.push({
      id: model.id,
      name: `${model.providerLabel} ${model.modelName}`,
      embeddingName: model.embeddingModelName || '',
      icon: providerIcons[model.provider] || providerIcons.other
    });
  }
  return list;
});

const currentModelName = computed(() => {
  if (defaultModel.value && modelSettings.value.modelId === defaultModel.value.id) {
    const thinkLabel = modelSettings.value.thinkMode === 'deep' ? '· 深度' : '· 快速';
    return `${defaultModel.value.modelName} ${thinkLabel}`;
  }
  const model = customModels.value.find(m => m.id === modelSettings.value.modelId);
  if (!model) return '选择模型';
  const thinkLabel = modelSettings.value.thinkMode === 'deep' ? '· 深度' : '· 快速';
  return `${model.modelName} ${thinkLabel}`;
});

const toggleModeDropdown = (event) => {
  if (isAgentCategory.value) return; // Agent 模式固定，不可切换
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  showModeDropdown.value = !showModeDropdown.value;
  showModelDropdown.value = false;
  if (showModeDropdown.value) {
    modeDropdownStyle.value = computeDropdownStyle(rect, 140);
  }
};

const toggleModelDropdown = (event) => {
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  showModelDropdown.value = !showModelDropdown.value;
  showModeDropdown.value = false;
  if (showModelDropdown.value) {
    modelDropdownStyle.value = computeDropdownStyle(rect, 360);
  }
};

// 计算下拉位置：下方空间不足时向上弹出
function computeDropdownStyle(rect, estimatedHeight) {
  const gap = 8;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const needHeight = estimatedHeight + gap;

  if (spaceBelow < needHeight && spaceAbove > spaceBelow) {
    // 向上弹出
    return {
      position: 'fixed',
      bottom: (window.innerHeight - rect.top + gap) + 'px',
      left: rect.left + 'px',
      zIndex: '9999'
    };
  }
  // 默认向下弹出
  return {
    position: 'fixed',
    top: rect.bottom + gap + 'px',
    left: rect.left + 'px',
    zIndex: '9999'
  };
}

const selectMode = (mode) => {
  currentMode.value = mode;
  showModeDropdown.value = false;
};

const selectModel = (modelId) => {
  modelSettings.value.modelId = modelId;
  localStorage.setItem(SELECTED_MODEL_KEY, modelId);
  showModelDropdown.value = false;
};

const closeAllDropdowns = () => {
  showModeDropdown.value = false;
  showModelDropdown.value = false;
};

const autoResize = () => {
  const textarea = textareaRef.value;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }
};

const handleSendKeydown = (e) => {
  if (e.isComposing) return;
  e.preventDefault();
  handleSend();
};

const handleSend = () => {
  const text = inputText.value.trim();
  if (!text || props.disabled) return;

  // 查找选中的模型：可能是自定义模型或系统默认模型
  let selectedModel = customModels.value.find(m => m.id === modelSettings.value.modelId);
  if (!selectedModel && defaultModel.value && modelSettings.value.modelId === defaultModel.value.id) {
    selectedModel = { id: defaultModel.value.id, isDefault: true };
  }
  if (!selectedModel) return;

  emit('ask', {
    question: text,
    mode: currentMode.value,
    modelId: selectedModel.id,
    thinkMode: modelSettings.value.thinkMode,
    attachments: attachments.value.length > 0 ? attachments.value.map(a => ({
      name: a.name,
      path: a.path,
      virtualPath: a.virtualPath,
      isDirectory: a.isDirectory
    })) : []
  });

  inputText.value = '';
  attachments.value = [];
  nextTick(() => {
    autoResize();
  });
};

onMounted(() => {
  document.addEventListener('scroll', closeAllDropdowns, true);
  loadCustomModels();
  loadDefaultModel();
});

onUnmounted(() => {
  document.removeEventListener('scroll', closeAllDropdowns, true);
});

onActivated(() => {
  inputText.value = '';
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }
  loadCustomModels();
  loadDefaultModel();
});
</script>

<style scoped lang="scss">
.question-box {
  flex-shrink: 0;
  padding: 12px 24px 20px;
}

.input-wrapper {
  max-width: 880px;
  margin: 0 auto;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 22px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: var(--text-tertiary);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.main-input {
  width: 100%;
  padding: 14px 20px 4px;
  border: none;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 40px;
  max-height: 160px;
  overflow-y: auto;
}

.main-input::-webkit-scrollbar { width: 4px; }
.main-input::-webkit-scrollbar-track { background: transparent; }
.main-input::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
.main-input::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }
.main-input::placeholder { color: var(--text-tertiary); }

/* @ 附件标签区 */
.attachment-area {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 20px 0;
}

.attachment-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px 3px 3px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--text-primary);
  max-width: 240px;
  line-height: 1;
  transition: all 0.15s ease;

  &:hover .tag-remove { opacity: 1; }

  &.tag-file { --tag-accent: #f59e0b; }
  &.tag-folder { --tag-accent: #1560F7; }

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
    max-width: 140px;
    font-weight: 500;
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

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px 10px;
}

.action-left,
.action-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 16px;
  font-size: 12.5px;
  font-weight: 500;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.action-btn:hover { background: var(--bg-secondary); }

.action-btn.icon-only {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn.icon-only:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.dropdown-btn span { font-size: 12.5px; }

.dropdown-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.dropdown-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--text-tertiary);
}

.dropdown-btn.mode-fixed {
  cursor: default;
  color: #059669;
  border-color: rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.06);
}

.dropdown-btn.mode-fixed:hover {
  background: rgba(16, 185, 129, 0.06);
  border-color: rgba(16, 185, 129, 0.3);
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--text-tertiary);
  color: #ffffff;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
  margin-left: 2px;
}

.send-btn.active {
  background: var(--text-primary);
  color: #ffffff;
}

.send-btn:hover { transform: scale(1.06); }

/* 下拉菜单 */
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

.model-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
}

.model-think-row {
  padding-top: 0;
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

.model-check {
  flex-shrink: 0;
}

.model-empty {
  padding: 16px 12px;
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: center;
}
</style>
