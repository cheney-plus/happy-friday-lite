<template>
  <div class="question-box" @click="closeAllDropdowns">
    <div class="input-wrapper">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onActivated, nextTick } from 'vue';

const props = defineProps({
  isFolder: { type: Boolean, default: false },
  contextLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
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
  { value: 'memoryless', label: '无忆模式' }
];

const currentModeLabel = computed(() => {
  const mode = chatModes.find(m => m.value === currentMode.value);
  return mode?.label || '对话模式';
});

const placeholderText = computed(() => {
  if (props.disabled) return '请先选择知识库';
  return props.isFolder ? '基于当前文件夹提问...' : '基于当前知识库提问...';
});

const modelSettings = ref({
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
    icon: providerIcons[model.provider] || providerIcons.other
  }));
});

const currentModelName = computed(() => {
  const model = customModels.value.find(m => m.id === modelSettings.value.modelId);
  if (!model) return '选择模型';
  const thinkLabel = modelSettings.value.thinkMode === 'deep' ? '· 深度' : '· 快速';
  return `${model.modelName} ${thinkLabel}`;
});

const toggleModeDropdown = (event) => {
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

  const selectedModel = customModels.value.find(m => m.id === modelSettings.value.modelId);
  if (!selectedModel) return;

  emit('ask', {
    question: text,
    mode: currentMode.value,
    modelId: selectedModel.id,
    thinkMode: modelSettings.value.thinkMode
  });

  inputText.value = '';
  nextTick(() => {
    autoResize();
  });
};

onMounted(() => {
  document.addEventListener('scroll', closeAllDropdowns, true);
  loadCustomModels();
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

.dropdown-btn span { font-size: 12.5px; }

.dropdown-btn {
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.dropdown-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--text-tertiary);
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
