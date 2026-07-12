<template>
  <div class="model-settings-page">
    <button class="back-btn" @click="goBack">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
    <h1 class="page-title">模型设置</h1>

    <div class="settings-content">
      <div class="settings-group">
        <div class="group-content">
          <div class="setting-item">
            <span class="item-label">首选模型</span>
            <div class="model-select-wrapper" ref="modelSelectRef">
              <div
                :class="['model-select-trigger', { 'no-selection': !selectedModelData, 'highlight-pulse': !selectedModelData }]"
                @click="toggleModelDropdown"
              >
                <div v-if="selectedModelData" class="selected-model-info">
                  <img :src="selectedModelData.providerIcon" :alt="selectedModelData.providerLabel" class="model-provider-icon" />
                  <div class="selected-model-text">
                    <span>{{ selectedModelData.providerLabel }} {{ selectedModelData.modelName }}</span>
                    <span v-if="selectedModelData.isDefault" class="default-badge">系统默认</span>
                    <span v-if="selectedModelData.embeddingModelName" class="selected-embedding-label">Embedding: {{ selectedModelData.embeddingModelName }}</span>
                  </div>
                </div>
                <span v-else class="select-hint-text">点击选择模型</span>
                <svg class="model-select-arrow" :class="{ expanded: showModelDropdown }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
          </div>
          <div v-if="defaultModelTrial && selectedModelData?.isDefault" class="trial-info-bar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>免费试用剩余 {{ defaultModelTrial.remaining }} / {{ defaultModelTrial.limit }} 次，超过后请添加自己的模型</span>
          </div>
          <div v-if="defaultModelTrial && !defaultModelTrial.available && (!selectedModelData || selectedModelData.isDefault)" class="trial-info-bar trial-exhausted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <span>免费试用次数已用尽，请添加自己的模型</span>
          </div>
        </div>
      </div>

      <div class="group-title">自定义模型</div>
      <div class="custom-models-container">
        <div class="add-model-btn" @click="showAddModal = true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>添加模型</span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">添加模型</h3>
            <button class="close-btn" @click="closeModal">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">模型厂商</label>
              <div class="custom-select" ref="providerSelectRef">
                <div class="select-trigger" @click="toggleProviderDropdown">
                  <div v-if="selectedProvider" class="selected-option">
                    <img :src="selectedProvider.icon" :alt="selectedProvider.label" class="provider-icon" />
                    <span>{{ selectedProvider.label }}</span>
                  </div>
                  <span v-else class="placeholder">选择模型厂商</span>
                  <svg class="select-arrow" :class="{ expanded: showProviderDropdown }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
                <div v-if="showProviderDropdown" class="dropdown-menu">
                  <div
                    v-for="provider in providerList"
                    :key="provider.value"
                    class="dropdown-item"
                    @click="selectProvider(provider)"
                  >
                    <img v-if="provider.icon" :src="provider.icon" :alt="provider.label" class="provider-icon" />
                    <span>{{ provider.label }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">API Key</label>
              <div class="input-wrapper">
                <input
                  :type="showApiKey ? 'text' : 'password'"
                  v-model="formData.apiKey"
                  placeholder="输入你的API Key"
                  class="form-input"
                />
                <button class="toggle-visibility" @click="showApiKey = !showApiKey">
                  <svg v-if="!showApiKey" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">对话模型名称</label>
              <input
                type="text"
                v-model="formData.modelName"
                placeholder="输入对话模型名称"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Embedding 模型<span class="optional-tag">可选</span></label>
              <input
                type="text"
                v-model="formData.embeddingModelName"
                placeholder="输入 Embedding 模型名称，如 text-embedding-v4"
                class="form-input"
              />
            </div>

            <div v-if="formData.provider === 'other'" class="form-group">
              <label class="form-label">对话模型地址</label>
              <input
                type="text"
                v-model="formData.modelUrl"
                placeholder="输入完整的对话模型 API 地址，如 https://api.example.com/v1/chat/completions"
                class="form-input"
              />
            </div>

            <div v-if="formData.provider === 'other'" class="form-group form-group-checkbox">
              <label class="checkbox-label">
                <input type="checkbox" v-model="formData.useSeparateEmbeddingConfig" />
                <span>Embedding 模型使用不同的地址和 API Key</span>
              </label>
            </div>

            <div v-if="formData.provider === 'other' && formData.useSeparateEmbeddingConfig" class="form-group">
              <label class="form-label">Embedding API Key</label>
              <div class="input-wrapper">
                <input
                  :type="showEmbeddingApiKey ? 'text' : 'password'"
                  v-model="formData.embeddingApiKey"
                  placeholder="输入 Embedding 模型的 API Key"
                  class="form-input"
                />
                <button class="toggle-visibility" @click="showEmbeddingApiKey = !showEmbeddingApiKey">
                  <svg v-if="!showEmbeddingApiKey" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                </button>
              </div>
            </div>

            <div v-if="formData.provider === 'other' && formData.useSeparateEmbeddingConfig" class="form-group">
              <label class="form-label">Embedding 模型地址</label>
              <input
                type="text"
                v-model="formData.embeddingUrl"
                placeholder="输入完整的 Embedding 模型 API 地址，如 https://api.example.com/v1/embeddings"
                class="form-input"
              />
            </div>

            <p class="form-hint">自定义配置，请遵守法规并关注模型使用Token消耗</p>
          </div>

          <div class="modal-footer">
            <button class="save-btn" @click="handleSave" :disabled="!isFormValid">保存</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="showModelDropdown" class="model-dropdown-overlay" :style="dropdownPosition" ref="modelDropdownRef">
        <div class="model-dropdown-menu">
          <!-- 系统默认模型 -->
          <div
            v-if="defaultModelInfo"
            :class="['model-dropdown-item', { active: selectedModel === defaultModelInfo.id, disabled: defaultModelTrial && !defaultModelTrial.available }]"
            @click="selectModel(defaultModelInfo)"
          >
            <div class="model-item-content">
              <img :src="getModelProviderIcon(defaultModelInfo.provider)" :alt="defaultModelInfo.providerLabel" class="model-item-icon" />
              <div class="model-item-text">
                <div class="model-item-name">
                  {{ defaultModelInfo.providerLabel }} {{ defaultModelInfo.modelName }}
                  <span class="default-badge">系统默认</span>
                </div>
                <div class="model-item-desc">
                  {{ getModelDescription(defaultModelInfo) }}
                  <span class="model-item-embedding">· Embedding: {{ defaultModelInfo.embeddingModelName }}</span>
                  <span v-if="defaultModelTrial" class="model-item-trial">· 剩余 {{ defaultModelTrial.remaining }} 次</span>
                </div>
              </div>
            </div>
            <div class="model-item-actions">
              <svg v-if="selectedModel === defaultModelInfo.id" class="check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>
          <!-- 自定义模型 -->
          <div
            v-for="model in customModels"
            :key="model.id"
            :class="['model-dropdown-item', { active: selectedModel === model.id }]"
            @click="selectModel(model)"
          >
            <div class="model-item-content">
              <img :src="getModelProviderIcon(model.provider)" :alt="model.providerLabel" class="model-item-icon" />
              <div class="model-item-text">
                <div class="model-item-name">{{ model.providerLabel }} {{ model.modelName }}</div>
                <div class="model-item-desc">
                  {{ getModelDescription(model) }}
                  <span v-if="model.embeddingModelName" class="model-item-embedding">· Embedding: {{ model.embeddingModelName }}</span>
                </div>
              </div>
            </div>
            <div class="model-item-actions">
              <svg v-if="selectedModel === model.id" class="check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <button class="delete-btn" @click.stop="confirmDeleteModel(model)" title="删除模型">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
        <div class="delete-confirm-dialog">
          <div class="delete-confirm-content">
            <p class="delete-confirm-title">确认删除</p>
            <p class="delete-confirm-message">确定要删除模型「{{ deleteTarget?.providerLabel }} {{ deleteTarget?.modelName }}」吗？</p>
            <p class="delete-confirm-hint">此操作不可撤销</p>
          </div>
          <div class="delete-confirm-actions">
            <button class="cancel-btn" @click="showDeleteConfirm = false">取消</button>
            <button class="confirm-delete-btn" @click="executeDelete">删除</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, onDeactivated } from 'vue';
import { useRouter } from 'vue-router';
import { electronService } from '@/services/electron';

const router = useRouter();

const goBack = () => {
  router.push('/settings');
};

const selectedModel = ref('');

const showAddModal = ref(false);
const showApiKey = ref(false);
const showEmbeddingApiKey = ref(false);
const showDeleteConfirm = ref(false);
const showProviderDropdown = ref(false);
const showModelDropdown = ref(false);
const providerSelectRef = ref(null);
const modelSelectRef = ref(null);
const modelDropdownRef = ref(null);

// 系统默认模型信息（不含 API Key）+ 试用状态
const defaultModelInfo = ref(null);
const defaultModelTrial = ref(null);

const providerList = [
  { value: 'doubao', label: '豆包', icon: new URL('@/assets/images/豆包.png', import.meta.url).href, baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { value: 'qwen', label: '千问', icon: new URL('@/assets/images/千问.png', import.meta.url).href, baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { value: 'zhipu', label: '智谱', icon: new URL('@/assets/images/智谱logo.png', import.meta.url).href, baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { value: 'deepseek', label: 'DeepSeek', icon: new URL('@/assets/images/deepseek.png', import.meta.url).href, baseUrl: 'https://api.deepseek.com' },
  { value: 'kimi', label: 'Kimi', icon: new URL('@/assets/images/kimi-icon.png', import.meta.url).href, baseUrl: 'https://api.moonshot.cn/v1' },
  { value: 'minimax', label: 'MiniMax', icon: new URL('@/assets/images/MiniMax.png', import.meta.url).href, baseUrl: 'https://api.minimaxi.com/v1' },
  { value: 'other', label: '其他', icon: new URL('@/assets/images/其他模型.png', import.meta.url).href, baseUrl: '' }
];

const selectedProvider = computed(() => {
  return providerList.find(p => p.value === formData.value.provider) || null;
});

const formData = ref({
  provider: '',
  apiKey: '',
  modelName: '',
  embeddingModelName: '',
  modelUrl: '',
  useSeparateEmbeddingConfig: false,
  embeddingApiKey: '',
  embeddingUrl: ''
});

const customModels = ref([]);

const selectedModelData = computed(() => {
  if (!selectedModel.value) return null;
  // 检查是否为系统默认模型
  if (defaultModelInfo.value && selectedModel.value === defaultModelInfo.value.id) {
    return {
      ...defaultModelInfo.value,
      providerIcon: getModelProviderIcon(defaultModelInfo.value.provider)
    };
  }
  const model = customModels.value.find(m => m.id === selectedModel.value);
  if (!model) return null;
  return {
    ...model,
    providerIcon: getModelProviderIcon(model.provider)
  };
});

const getModelProviderIcon = (provider) => {
  const found = providerList.find(p => p.value === provider);
  return (found && found.icon) || new URL('@/assets/images/其他模型.png', import.meta.url).href;
};

const getModelDescription = (model) => {
  const descriptions = {
    doubao: '通用对话与创作',
    qwen: '多模态理解与生成',
    zhipu: '复杂任务分析',
    deepseek: '逻辑推理与代码',
    kimi: '长文本处理',
    minimax: '智能对话助手'
  };
  return descriptions[model.provider] || '自定义模型';
};

const toggleModelDropdown = () => {
  showModelDropdown.value = !showModelDropdown.value;
};

const selectModel = (model) => {
  // 试用次数用尽的默认模型不允许选择
  if (model.isDefault && defaultModelTrial.value && !defaultModelTrial.value.available) {
    return;
  }
  selectedModel.value = model.id;
  showModelDropdown.value = false;
  localStorage.setItem('happy-friday-selected-model', model.id);
  syncModelsToConfig();
};

const deleteTarget = ref(null);

const confirmDeleteModel = (model) => {
  deleteTarget.value = model;
  showDeleteConfirm.value = true;
  showModelDropdown.value = false;
};

const executeDelete = () => {
  if (!deleteTarget.value) return;

  const targetId = deleteTarget.value.id;
  customModels.value = customModels.value.filter(m => m.id !== targetId);
  saveCustomModels();
  syncModelsToConfig();

  if (selectedModel.value === targetId) {
    // 删除首选后：优先选第一个自定义模型，没有则回退到默认模型（若有试用次数）
    if (customModels.value.length > 0) {
      selectedModel.value = customModels.value[0].id;
    } else if (defaultModelInfo.value && defaultModelTrial.value && defaultModelTrial.value.available) {
      selectedModel.value = defaultModelInfo.value.id;
    } else {
      selectedModel.value = '';
    }
    localStorage.setItem('happy-friday-selected-model', selectedModel.value);
  }

  showDeleteConfirm.value = false;
  deleteTarget.value = null;
};

const dropdownPosition = computed(() => {
  if (!modelSelectRef.value) return {};
  const rect = modelSelectRef.value.getBoundingClientRect();
  return {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 280)}px`,
    zIndex: 1050
  };
});

const toggleProviderDropdown = () => {
  showProviderDropdown.value = !showProviderDropdown.value;
};

const selectProvider = (provider) => {
  formData.value.provider = provider.value;
  showProviderDropdown.value = false;
};

const handleClickOutside = (event) => {
  if (providerSelectRef.value && !providerSelectRef.value.contains(event.target)) {
    showProviderDropdown.value = false;
  }
  if (showModelDropdown.value &&
      modelSelectRef.value && !modelSelectRef.value.contains(event.target) &&
      modelDropdownRef.value && !modelDropdownRef.value.contains(event.target)) {
    showModelDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  loadDefaultModelInfo();
  loadCustomModels();
});

// 从后端加载系统默认模型信息（不含 API Key）和试用状态
const loadDefaultModelInfo = async () => {
  try {
    const result = await electronService.invoke('get-default-model');
    if (result && result.model) {
      defaultModelInfo.value = result.model;
    }
    if (result && result.trial) {
      defaultModelTrial.value = result.trial;
    }
  } catch (e) {
    console.error('Failed to load default model info:', e);
  }
};

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

onDeactivated(() => {
  showModelDropdown.value = false;
  showProviderDropdown.value = false;
  showAddModal.value = false;
  showDeleteConfirm.value = false;
});

const STORAGE_KEY = 'happy-friday-custom-models';

const loadCustomModels = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      customModels.value = JSON.parse(stored);
    }
    const savedSelected = localStorage.getItem('happy-friday-selected-model');
    if (savedSelected) {
      // 已保存的首选模型：可能是自定义模型或系统默认模型
      if (customModels.value.find(m => m.id === savedSelected)) {
        selectedModel.value = savedSelected;
      } else if (defaultModelInfo.value && savedSelected === defaultModelInfo.value.id) {
        selectedModel.value = savedSelected;
      } else if (customModels.value.length > 0) {
        selectedModel.value = customModels.value[0].id;
      } else {
        selectedModel.value = '';
      }
    } else if (customModels.value.length > 0) {
      // 没有保存首选，但有自定义模型：选第一个
      selectedModel.value = customModels.value[0].id;
    } else {
      // 没有自定义模型，也没有保存首选：不自动选（下拉框高亮提示用户选择）
      selectedModel.value = '';
    }
  } catch (error) {
    console.error('Failed to load custom models:', error);
  }
};

const saveCustomModels = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customModels.value));
  } catch (error) {
    console.error('Failed to save custom models:', error);
  }
};

const syncModelsToConfig = async () => {
  try {
    const config = await electronService.invoke('get-config');
    if (config) {
      config.customModels = customModels.value.map(m => ({
        id: m.id,
        provider: m.provider,
        providerLabel: m.providerLabel,
        apiKey: m.apiKey,
        modelName: m.modelName,
        embeddingModelName: m.embeddingModelName || '',
        baseUrl: m.baseUrl,
        useSeparateEmbeddingConfig: m.useSeparateEmbeddingConfig || false,
        embeddingApiKey: m.embeddingApiKey || '',
        embeddingBaseUrl: m.embeddingBaseUrl || ''
      }));
      config.selectedModelId = selectedModel.value;
      await electronService.invoke('save-config', config);
    }
  } catch (e) {
    console.error('Failed to sync models to config:', e);
  }
};

const isFormValid = computed(() => {
  const baseValid = formData.value.provider && formData.value.apiKey && formData.value.modelName;
  if (formData.value.provider === 'other') {
    if (!baseValid || !formData.value.modelUrl) return false;
    if (formData.value.useSeparateEmbeddingConfig) {
      return !!(formData.value.embeddingApiKey && formData.value.embeddingUrl);
    }
    return true;
  }
  return baseValid;
});

const closeModal = () => {
  showAddModal.value = false;
  resetForm();
};

const resetForm = () => {
  formData.value = {
    provider: '',
    apiKey: '',
    modelName: '',
    embeddingModelName: '',
    modelUrl: '',
    useSeparateEmbeddingConfig: false,
    embeddingApiKey: '',
    embeddingUrl: ''
  };
  showApiKey.value = false;
  showEmbeddingApiKey.value = false;
};

const handleSave = () => {
  if (isFormValid.value) {
    const provider = providerList.find(p => p.value === formData.value.provider);
    const isOther = formData.value.provider === 'other';
    const newModel = {
      id: `model_${Date.now()}`,
      provider: formData.value.provider,
      providerLabel: provider?.label || '未知',
      apiKey: formData.value.apiKey,
      modelName: formData.value.modelName,
      embeddingModelName: formData.value.embeddingModelName || '',
      baseUrl: isOther ? formData.value.modelUrl : (provider?.baseUrl || ''),
      createdAt: Date.now()
    };

    if (isOther) {
      newModel.useSeparateEmbeddingConfig = !!formData.value.useSeparateEmbeddingConfig;
      if (formData.value.useSeparateEmbeddingConfig) {
        newModel.embeddingApiKey = formData.value.embeddingApiKey;
        newModel.embeddingBaseUrl = formData.value.embeddingUrl;
      }
    }

    customModels.value.push(newModel);
    saveCustomModels();
    // 新增模型后自动选为首选模型
    selectedModel.value = newModel.id;
    localStorage.setItem('happy-friday-selected-model', newModel.id);
    syncModelsToConfig();
    closeModal();
  }
};
</script>

<style scoped>
.model-settings-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 40px;
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
  transition: all 0.15s;
  border-radius: 6px;
}

.back-btn:hover {
  background-color: var(--bg-hover);
}

.back-btn svg {
  display: block;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 28px;
  max-width: 720px;
  width: 100%;
  text-align: left;
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
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  min-height: 52px;
}

.item-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.model-select-wrapper {
  position: relative;
  flex: 1;
  max-width: 320px;
}

.model-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}

.model-select-trigger:hover {
  background-color: var(--bg-hover);
}

/* 未选择首选模型时：高亮边框 + 脉冲动画，引导用户点击 */
.model-select-trigger.no-selection {
  border-color: var(--accent-color, #3b82f6);
  background-color: var(--bg-primary);
  animation: highlightPulse 2s ease-in-out infinite;
}

.model-select-trigger.no-selection:hover {
  border-color: var(--accent-color, #3b82f6);
  background-color: var(--bg-hover);
}

@keyframes highlightPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0);
  }
}

.select-hint-text {
  font-size: 14px;
  color: var(--accent-color, #3b82f6);
  font-weight: 500;
}

.default-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 500;
  color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 6px;
  vertical-align: middle;
}

.trial-info-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 12px;
  color: var(--text-secondary);
  background-color: rgba(59, 130, 246, 0.06);
  border-top: 1px solid var(--border-color);
}

.trial-info-bar svg {
  color: #3b82f6;
  flex-shrink: 0;
}

.trial-info-bar.trial-exhausted {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.06);
}

.trial-info-bar.trial-exhausted svg {
  color: #ef4444;
}

.model-item-trial {
  color: #3b82f6;
  opacity: 0.8;
}

.model-dropdown-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.model-dropdown-item.disabled:hover {
  background-color: transparent;
}

.selected-model-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.selected-model-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.selected-embedding-label {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 400;
}

.model-provider-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 5px;
}

.model-select-arrow {
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.model-select-arrow.expanded {
  transform: rotate(180deg);
}

.model-dropdown-overlay {
  pointer-events: auto;
}

.model-dropdown-menu {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  max-height: 300px;
  overflow-y: auto;
  animation: modelDropdownIn 0.2s ease;
  padding: 6px;
}

@keyframes modelDropdownIn {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.model-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  cursor: pointer;
  border-radius: 10px;
  transition: background-color 0.15s;
}

.model-dropdown-item:hover {
  background-color: var(--bg-hover);
}

.model-dropdown-item.active {
  background-color: var(--accent-light);
}

.model-item-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.model-item-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
  border-radius: 6px;
  flex-shrink: 0;
}

.model-item-text {
  flex: 1;
  min-width: 0;
}

.model-item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.model-item-desc {
  font-size: 12px;
  color: var(--text-tertiary);
}

.model-item-embedding {
  color: var(--text-tertiary);
  opacity: 0.8;
}

.check-icon {
  flex-shrink: 0;
}

.model-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  border-radius: 4px;
  opacity: 0;
  transition: all 0.15s;
}

.model-dropdown-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
}

.custom-models-container {
  background-color: var(--bg-secondary);
  border-radius: 10px;
  padding: 8px;
}

.add-model-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  cursor: pointer;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 14px;
}

.add-model-btn svg {
  color: var(--text-tertiary);
}

.no-model-hint {
  font-size: 14px;
  color: var(--text-tertiary);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-container {
  background-color: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 480px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: color 0.15s;
  border-radius: 4px;
}

.close-btn:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.close-btn svg {
  display: block;
}

.modal-body {
  padding: 24px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-of-type {
  margin-bottom: 12px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.optional-tag {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 400;
  margin-left: 6px;
}

.form-group-checkbox {
  padding: 4px 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  width: 15px;
  height: 15px;
  cursor: pointer;
  accent-color: var(--text-primary);
  margin: 0;
}

.select-wrapper {
  position: relative;
}

.custom-select {
  position: relative;
}

.select-trigger {
  width: 100%;
  padding: 10px 36px 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  background-color: var(--bg-primary);
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.select-trigger:hover,
.select-trigger:focus {
  border-color: var(--text-primary);
}

.selected-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.placeholder {
  color: var(--text-tertiary);
}

.provider-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  border-radius: 4px;
}

.select-arrow {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
}

.select-arrow.expanded {
  transform: translateY(-50%) rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 240px;
  overflow-y: auto;
  animation: dropdownFadeIn 0.15s ease;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  font-size: 14px;
  color: var(--text-primary);
}

.dropdown-item:hover {
  background-color: var(--bg-hover);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input {
  width: 100%;
  padding: 10px 42px 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  background-color: var(--bg-primary);
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--text-primary);
}

.form-input::placeholder {
  color: var(--text-tertiary);
}

.toggle-visibility {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: color 0.15s;
  border-radius: 4px;
}

.toggle-visibility:hover {
  color: var(--text-secondary);
}

.toggle-visibility svg {
  display: block;
}

.form-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
  margin: 0;
}

.modal-footer {
  padding: 16px 24px 20px;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.save-btn {
  background-color: var(--text-tertiary);
  color: var(--bg-primary);
  border: none;
  padding: 8px 28px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.save-btn:not(:disabled) {
  background-color: var(--text-primary);
  color: var(--bg-primary);
}

.save-btn:not(:disabled):hover {
  opacity: 0.85;
}

.save-btn:disabled {
  cursor: not-allowed;
}

.delete-confirm-dialog {
  background-color: var(--bg-primary);
  border-radius: 12px;
  width: 90%;
  max-width: 360px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.25s ease;
}

.delete-confirm-content {
  padding: 24px;
}

.delete-confirm-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.delete-confirm-message {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 6px;
}

.delete-confirm-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

.delete-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.cancel-btn {
  background-color: transparent;
  color: var(--text-primary);
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  font-family: inherit;
  transition: background-color 0.15s;
}

.cancel-btn:hover {
  background-color: var(--bg-hover);
}

.confirm-delete-btn {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}

.confirm-delete-btn:hover {
  opacity: 0.9;
}

[data-theme='dark'] .model-dropdown-menu {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}

[data-theme='dark'] .modal-container {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

[data-theme='dark'] .dropdown-menu {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

[data-theme='dark'] .delete-confirm-dialog {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}
</style>
