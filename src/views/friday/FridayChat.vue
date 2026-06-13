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

              <button class="action-btn icon-only">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
                </svg>
              </button>
            </div>

            <div class="action-right">
              <button class="action-btn icon-only">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>

              <button class="action-btn icon-only">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="6" cy="6" r="3"></circle>
                  <circle cx="6" cy="18" r="3"></circle>
                  <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                  <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
                  <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
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
                    <span v-if="model.badge" class="model-badge">{{ model.badge }}</span>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onDeactivated, onActivated } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { electronService } from '@/services/electron';
import { useAppStore } from '@/store';
import ChatHistoryDrawer from '@/components/chat/ChatHistoryDrawer.vue';

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
const currentMode = ref('chat');
const modeDropdownStyle = ref({});
const modelDropdownStyle = ref({});

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
    icon: providerIcons[model.provider] || providerIcons.other,
    badge: ''
  }));
});

const toggleModeDropdown = (event) => {
  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  showModeDropdown.value = !showModeDropdown.value;
  showModelDropdown.value = false;
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
  if (showModelDropdown.value) {
    modelDropdownStyle.value = {
      position: 'fixed',
      top: rect.bottom + 8 + 'px',
      left: rect.left + 'px',
      zIndex: '9999'
    };
  }
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
});

onUnmounted(() => {
  document.removeEventListener('scroll', closeAllDropdowns, true);
});

onDeactivated(() => {
  showModeDropdown.value = false;
  showModelDropdown.value = false;
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
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.model-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
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
