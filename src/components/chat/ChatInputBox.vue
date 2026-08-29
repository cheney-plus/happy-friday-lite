<template>
  <div class="chat-input-box" @click="closeAllDropdowns">
    <div class="input-wrapper">
      <div v-if="noteReferences && noteReferences.length > 0" class="note-references">
        <NoteReferenceTag
          v-for="ref in noteReferences"
          :key="ref.id"
          :from="ref.from"
          :to="ref.to"
          :text="ref.text"
          @remove="$emit('removeReference', ref.id)"
        />
      </div>

      <!-- 挂载的文档附件 -->
      <div class="attachment-area" v-if="attachments && attachments.length > 0">
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
          <button class="tag-remove" @click="$emit('removeAttachment', idx)" :title="t('friday.remove')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <textarea
        :value="modelValue"
        class="main-input"
        :placeholder="isStreaming ? t('friday.aiThinking') : placeholder"
        rows="1"
        @input="handleInput"
        @keydown.enter.exact="handleSendKeydown"
        :disabled="isStreaming"
        ref="textareaRef"
      ></textarea>

      <div class="input-actions">
        <div class="action-left">
          <slot name="actions-left"></slot>
        </div>

        <div class="action-right">
          <template v-if="showReferenceButtons">
            <button class="action-btn icon-only" @click.stop="toggleLinkDropdown($event)" :title="t('friday.referenceNoteFile')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>

            <button v-if="showKbButton" class="action-btn icon-only" @click.stop="toggleKbDropdown($event)" :title="t('friday.referenceKb')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
              </svg>
            </button>
          </template>

          <Transition name="btn-switch" mode="out-in">
            <button
              v-if="isStreaming"
              key="stop"
              class="stop-btn"
              @click="$emit('stop')"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"></rect>
              </svg>
            </button>
            <button
              v-else
              key="send"
              class="send-btn"
              :class="{ active: modelValue.trim() }"
              @click="$emit('send')"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </Transition>
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
          <div v-if="!selectableKbList || selectableKbList.length === 0" class="kb-empty">{{ t('friday.kbEmpty') }}</div>
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
    </Teleport>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import NoteReferenceTag from './NoteReferenceTag.vue';
import { coverOptions } from '@/views/knowledge/constants';

const { t } = useI18n();

const props = defineProps({
  modelValue: String,
  placeholder: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
  noteReferences: { type: Array, default: () => [] },
  showReferenceButtons: { type: Boolean, default: false },
  showKbButton: { type: Boolean, default: true },
  attachments: { type: Array, default: () => [] },
  selectableKbList: { type: Array, default: () => [] },
  // 下拉弹出方向：'down' 向下（默认），'up' 向上（适用于输入框靠近视口底部的场景）
  dropdownDirection: { type: String, default: 'down' }
});

const emit = defineEmits(['update:modelValue', 'send', 'stop', 'removeReference', 'selectNote', 'selectKbFile', 'selectKb', 'removeAttachment']);

const textareaRef = ref(null);
const showLinkDropdown = ref(false);
const showKbDropdown = ref(false);
const linkDropdownStyle = ref({});
const kbDropdownStyle = ref({});

function focus() {
  nextTick(() => {
    textareaRef.value?.focus();
  });
}

defineExpose({ focus });

const closeAllDropdowns = () => {
  showLinkDropdown.value = false;
  showKbDropdown.value = false;
};

const toggleDropdown = (name, event) => {
  const isLink = name === 'link';
  const showRef = isLink ? showLinkDropdown : showKbDropdown;
  const styleRef = isLink ? linkDropdownStyle : kbDropdownStyle;
  const wasOpen = showRef.value;
  showLinkDropdown.value = false;
  showKbDropdown.value = false;
  if (wasOpen) return;
  const rect = event.currentTarget.getBoundingClientRect();
  showRef.value = true;
  if (props.dropdownDirection === 'up') {
    // 向上弹出：以按钮顶部为基准，使用 bottom 定位让面板向上展开
    styleRef.value = {
      position: 'fixed',
      bottom: (window.innerHeight - rect.top) + 8 + 'px',
      left: rect.left + 'px',
      zIndex: '9999'
    };
  } else {
    styleRef.value = {
      position: 'fixed',
      top: rect.bottom + 8 + 'px',
      left: rect.left + 'px',
      zIndex: '9999'
    };
  }
};

const toggleLinkDropdown = (event) => toggleDropdown('link', event);
const toggleKbDropdown = (event) => toggleDropdown('kb', event);

const openNoteSelect = () => {
  showLinkDropdown.value = false;
  emit('selectNote');
};

const openKbFileSelect = () => {
  showLinkDropdown.value = false;
  emit('selectKbFile');
};

const selectKnowledgeBase = (kbName, categoryId) => {
  emit('selectKb', { name: kbName, categoryId: categoryId || null });
  showKbDropdown.value = false;
  nextTick(() => {
    textareaRef.value?.focus();
    autoResize();
  });
};

function handleInput(e) {
  const target = e.target;
  emit('update:modelValue', target.value);
  autoResize();
}

function handleSendKeydown(e) {
  if (e.isComposing) return;
  e.preventDefault();
  emit('send');
}

function autoResize() {
  const textarea = textareaRef.value;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }
}

watch(() => props.modelValue, async () => {
  await nextTick();
  autoResize();
});

onMounted(() => {
  document.addEventListener('scroll', closeAllDropdowns, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('scroll', closeAllDropdowns, true);
});
</script>

<style scoped>
.chat-input-box {
  flex-shrink: 0;
  padding: 8px 24px 14px;
}

.input-wrapper {
  width: 100%;
  max-width: 752px;
  margin: 0 auto;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 22px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.note-references {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 16px 4px;
}

.attachment-area {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 18px 2px;
}

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
}

.attachment-tag:hover {
  background: var(--bg-hover, #f0f0f0);
}

.attachment-tag:hover .tag-remove {
  opacity: 1;
}

.attachment-tag.tag-kb {
  --tag-accent: #10b981;
}

.attachment-tag.tag-note {
  --tag-accent: #6366f1;
}

.attachment-tag.tag-kb-file {
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
}

.tag-remove:hover {
  background: rgba(0, 0, 0, 0.08);
  color: var(--text-primary);
}

.input-wrapper:focus-within {
  border-color: var(--text-tertiary);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.main-input {
  width: 100%;
  padding: 12px 18px 4px;
  border: none;
  outline: none;
  resize: none;
  font-size: 15px;
  line-height: 1.5;
  color: var(--text-primary);
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 38px;
  max-height: 160px;
  overflow-y: auto;
}

.main-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.main-input::-webkit-scrollbar {
  width: 5px;
}

.main-input::-webkit-scrollbar-track {
  background: transparent;
}

.main-input::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 10px;
}

.main-input::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.main-input::placeholder {
  color: var(--text-tertiary);
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 14px 8px;
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
  gap: 4px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--bg-secondary);
}

.icon-only {
  padding: 6px 8px;
}

.icon-only:not(.send-btn) {
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
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

.send-btn:hover {
  transform: scale(1.06);
}

.stop-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--text-primary);
  color: #ffffff;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
  margin-left: 2px;
}

.stop-btn:hover {
  transform: scale(1.06);
  opacity: 0.85;
}

.stop-btn:active {
  transform: scale(0.94);
}

.btn-switch-enter-active {
  transition: all 0.2s ease;
}

.btn-switch-leave-active {
  transition: all 0.15s ease;
}

.btn-switch-enter-from {
  opacity: 0;
  transform: scale(0.7);
}

.btn-switch-leave-to {
  opacity: 0;
  transform: scale(0.7);
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
}

.link-menu-item:hover {
  background: var(--bg-hover);
}

.link-menu-item svg {
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: color 0.12s ease;
}

.link-menu-item:hover svg {
  color: #f59e0b;
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
</style>
