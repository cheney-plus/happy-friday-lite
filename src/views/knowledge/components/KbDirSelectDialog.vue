<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
        <Transition name="dialog-scale">
          <div v-if="visible" class="kb-dir-dialog">
            <!-- 头部 -->
            <div class="dialog-header">
              <div class="header-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>选择知识库目录</span>
              </div>
              <button class="dialog-close" @click="$emit('close')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- 主体 -->
            <div class="dialog-body">
              <div v-if="loading" class="loading-state">
                <span class="spinner"></span>
                <span>加载中...</span>
              </div>
              <div v-else-if="kbTree.length === 0" class="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <p>暂无知识库目录</p>
              </div>
              <div v-else class="kb-tree">
                <div v-for="category in kbTree" :key="category.id" class="kb-category">
                  <div class="category-header" @click="toggleCategory(category)">
                    <svg class="chevron" :class="{ expanded: category.expanded }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span class="category-name">{{ category.name }}</span>
                    <span class="category-count">{{ category.items.length }}</span>
                  </div>
                  <Transition name="expand">
                    <div v-if="category.expanded" class="category-items">
                      <div
                        v-for="item in category.items"
                        :key="item.path"
                        class="kb-item"
                        :class="{ selected: selectedPath === item.path }"
                        @click="selectItem(item)"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                        <span class="kb-name">{{ item.name }}</span>
                        <svg v-if="selectedPath === item.path" class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>

            <!-- 底部 -->
            <div class="dialog-footer">
              <span v-if="selectedName" class="selected-hint">
                已选择：<strong>{{ selectedName }}</strong>
              </span>
              <span v-else class="selected-hint placeholder">请选择一个知识库目录</span>
              <div class="footer-actions">
                <button class="btn-cancel" @click="$emit('close')">取消</button>
                <button class="btn-confirm" :disabled="!selectedPath || saving" @click="handleConfirm">
                  <span v-if="saving" class="btn-spinner"></span>
                  {{ saving ? '保存中...' : '确定' }}
                </button>
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

const props = defineProps({
  visible: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'confirm']);

const api = window.electronAPI;
const loading = ref(false);
const saving = ref(false);
const dataDir = ref('');
const kbTree = ref([]);
const selectedPath = ref('');
const selectedName = ref('');

async function loadDataDir() {
  if (!api) return;
  try {
    dataDir.value = await api.invoke('kb-get-data-dir');
  } catch (e) {
    console.error('Failed to get data dir:', e);
  }
}

async function loadKbTree() {
  loading.value = true;
  try {
    if (!dataDir.value) {
      await loadDataDir();
    }
    if (!dataDir.value) return;

    const knowledgeDir = dataDir.value + '/knowledge';
    const categories = [
      { id: 'personal', name: '个人知识库' },
      { id: 'agent', name: 'Agent知识库' },
      { id: 'local', name: '本地知识库' }
    ];

    const tree = [];
    for (const cat of categories) {
      const catDir = knowledgeDir + '/' + cat.id;
      try {
        const entries = await api.invoke('kb-read-dir', { dirPath: catDir });
        const items = entries
          .filter(e => e.isDirectory)
          .map(e => ({
            name: e.name,
            path: e.path
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

        if (items.length > 0) {
          tree.push({
            id: cat.id,
            name: cat.name,
            expanded: true,
            items
          });
        }
      } catch (e) {
        // 目录可能不存在，跳过
      }
    }
    kbTree.value = tree;
  } finally {
    loading.value = false;
  }
}

function toggleCategory(category) {
  category.expanded = !category.expanded;
}

function selectItem(item) {
  selectedPath.value = item.path;
  selectedName.value = item.name;
}

async function handleConfirm() {
  if (!selectedPath.value) return;
  saving.value = true;
  emit('confirm', {
    path: selectedPath.value,
    name: selectedName.value
  });
}

watch(() => props.visible, (val) => {
  if (val) {
    selectedPath.value = '';
    selectedName.value = '';
    loadKbTree();
  } else {
    saving.value = false;
  }
});
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.kb-dir-dialog {
  width: 460px;
  max-height: 70vh;
  background: var(--bg-primary, #fff);
  border-radius: 14px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
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

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  min-height: 200px;
  max-height: 400px;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--border-color, #ddd);
    border-radius: 3px;
  }
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 200px;
  color: var(--text-tertiary, #999);
  font-size: 13px;

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color, #ddd);
    border-top-color: var(--accent-color, #1560F7);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 200px;
  color: var(--text-tertiary, #aaa);
  font-size: 13px;
}

.kb-tree {
  padding: 4px 8px;
}

.kb-category {
  margin-bottom: 2px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.12s;
  user-select: none;

  &:hover {
    background: var(--bg-hover, #f5f5f5);
  }

  .chevron {
    color: var(--text-tertiary, #999);
    transition: transform 0.15s;
    flex-shrink: 0;

    &.expanded {
      transform: rotate(90deg);
    }
  }

  .category-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #333);
    flex: 1;
  }

  .category-count {
    font-size: 11px;
    color: var(--text-tertiary, #aaa);
    background: var(--bg-secondary, #f0f0f0);
    padding: 1px 7px;
    border-radius: 10px;
  }
}

.category-items {
  padding-left: 20px;
  overflow: hidden;
}

.kb-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.12s;
  user-select: none;
  color: var(--text-secondary, #555);

  &:hover {
    background: var(--bg-hover, #f5f5f5);
  }

  &.selected {
    background: rgba(21, 96, 247, 0.1);
    color: var(--accent-color, #1560F7);
    font-weight: 500;
  }

  .kb-name {
    flex: 1;
    font-size: 13px;
  }

  .check-icon {
    color: var(--accent-color, #1560F7);
    flex-shrink: 0;
  }
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color, #ececec);
  flex-shrink: 0;
  gap: 12px;

  .selected-hint {
    font-size: 12px;
    color: var(--text-secondary, #555);

    &.placeholder {
      color: var(--text-tertiary, #aaa);
    }

    strong {
      color: var(--accent-color, #1560F7);
    }
  }

  .footer-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-cancel, .btn-confirm {
    padding: 7px 18px;
    border-radius: 8px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    border: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-cancel {
    background: var(--bg-secondary, #f0f0f0);
    color: var(--text-secondary, #555);

    &:hover {
      background: var(--bg-hover, #e8e8e8);
    }
  }

  .btn-confirm {
    background: var(--accent-color, #1560F7);
    color: #fff;

    &:hover:not(:disabled) {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active,
.dialog-scale-leave-active {
  transition: all 0.2s ease;
}
.dialog-scale-enter-from,
.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
}
</style>
