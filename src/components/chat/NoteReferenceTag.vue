<template>
  <div class="note-reference-tag" :class="{ readonly }" @mouseenter="!readonly && (showClose = true)" @mouseleave="showClose = false">
    <div class="icon-wrapper">
      <svg v-if="!showClose || readonly" class="note-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
      </svg>
      
      <Transition name="fade">
        <button v-if="showClose && !readonly" class="close-btn" @click.stop="$emit('remove')" title="移除引用">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </Transition>
    </div>
    
    <span class="tag-text">{{ displayText }}</span>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  from: Number,
  to: Number,
  text: { type: String, default: '' },
  readonly: { type: Boolean, default: false }
});

defineEmits(['remove']);

const showClose = ref(false);

const displayText = computed(() => {
  if (props.text) {
    return props.text;
  }
  return `引用 ${props.from}-${props.to}`;
});
</script>

<style scoped>
.note-reference-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 11px;
  color: #374151;
  cursor: default;
  transition: all 0.15s ease;
}

[data-theme='dark'] .note-reference-tag {
  background: #2a2a2a;
  border-color: #404040;
  color: #d1d1d1;
}

.note-reference-tag:hover {
  border-color: #9ca3af;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}

[data-theme='dark'] .note-reference-tag:hover {
  border-color: #6b7280;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
}

.icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}

.note-icon {
  position: absolute;
  color: #6b7280;
}

[data-theme='dark'] .note-icon {
  color: #9ca3af;
}

.close-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 50%;
  background: rgba(107, 114, 128, 0.15);
  color: #4b5563;
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: rgba(107, 114, 128, 0.25);
  color: #1f2937;
}

[data-theme='dark'] .close-btn {
  background: rgba(156, 163, 175, 0.15);
  color: #d1d5db;
}

[data-theme='dark'] .close-btn:hover {
  background: rgba(156, 163, 175, 0.25);
  color: #f3f4f6;
}

.tag-text {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.08s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
