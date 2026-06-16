<template>
  <div class="question-box">
    <div class="input-wrapper">
      <textarea
        :value="question"
        class="main-input"
        placeholder="基于知识库提问"
        rows="1"
        @input="$emit('update:question', $event.target.value); autoResize($event)"
        ref="textareaRef"
      ></textarea>

      <div class="input-actions">
        <div class="action-left">
          <button class="action-btn dropdown-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>对话模式</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          <button class="action-btn dropdown-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10 15.3 15.3 0 0 1-4-10z"></path>
            </svg>
            <span>DS 快速</span>
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

          <button
            class="send-btn"
            :class="{ active: question.trim() }"
            @click="$emit('ask')"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  question: { type: String, default: '' }
});

defineEmits(['update:question', 'ask']);

function autoResize(event) {
  const textarea = event.target;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }
}
</script>

<style scoped lang="scss">
.question-box {
  flex-shrink: 0;
  padding: 12px 24px 20px;
}

.input-wrapper {
  max-width: 680px;
  margin: 0 auto;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 22px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: var(--text-tertiary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
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

.icon-only { padding: 6px 8px; }

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
  background: var(--text-secondary);
  color: #ffffff;
}

.send-btn:hover { transform: scale(1.06); }
</style>
