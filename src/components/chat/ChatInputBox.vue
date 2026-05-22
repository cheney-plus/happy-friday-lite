<template>
  <div class="chat-input-box">
    <div class="input-wrapper">
      <div v-if="noteReferences && noteReferences.length > 0" class="note-references">
        <NoteReferenceTag
          v-for="ref in noteReferences"
          :key="ref.id"
          :from="ref.from"
          :to="ref.to"
          @remove="$emit('removeReference', ref.id)"
        />
      </div>
      
      <textarea
        :value="modelValue"
        class="main-input"
        :placeholder="isStreaming ? 'AI 正在思考...' : placeholder"
        rows="1"
        @input="handleInput"
        @keydown.enter.exact="handleSendKeydown"
        :disabled="isStreaming"
        ref="textareaRef"
      ></textarea>

      <div class="input-actions">
        <div class="action-left">
        </div>

        <div class="action-right">
          <button class="action-btn icon-only" title="联网搜索">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path>
            </svg>
          </button>

          <button class="action-btn icon-only" title="附件">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>

          <button class="action-btn icon-only" title="图片">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="6" cy="6" r="3"></circle>
              <circle cx="6" cy="18" r="3"></circle>
              <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
              <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
              <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
            </svg>
          </button>

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
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import NoteReferenceTag from './NoteReferenceTag.vue';

const props = defineProps({
  modelValue: String,
  placeholder: { type: String, default: '' },
  isStreaming: { type: Boolean, default: false },
  noteReferences: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue', 'send', 'stop', 'removeReference']);

const textareaRef = ref(null);

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
  justify-content: flex-end;
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
</style>
