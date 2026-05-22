<template>
  <div class="thinking-process">
    <div class="thinking-header" @click="toggleCollapse">
      <span class="thinking-label">思考过程</span>
      <span v-if="duration > 0" class="thinking-duration">(用时{{ duration }}秒)</span>
      <svg
        class="thinking-arrow"
        :class="{ collapsed: isCollapsed }"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    </div>
    <div v-show="!isCollapsed" class="thinking-content">
      <div class="thinking-text">{{ content }}</div>
      <div v-if="isStreaming" class="thinking-cursor"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  content: String,
  isStreaming: Boolean
});

const isCollapsed = ref(false);
const duration = ref(0);
let startTime = null;
let timer = null;

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}

onMounted(() => {
  if (props.isStreaming) {
    startTime = Date.now();
    timer = setInterval(() => {
      if (startTime) {
        duration.value = Math.floor((Date.now() - startTime) / 1000);
      }
    }, 1000);
  }
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<style scoped>
.thinking-process {
  margin-bottom: 4px;
  border-radius: 12px;
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
  border-radius: 12px;
}

.thinking-header:hover {
  background: var(--bg-hover, rgba(0, 0, 0, 0.03));
}

.thinking-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #666);
}

.thinking-duration {
  font-size: 13px;
  color: var(--text-tertiary, #999);
}

.thinking-arrow {
  color: var(--text-tertiary, #999);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.thinking-arrow.collapsed {
  transform: rotate(180deg);
}

.thinking-content {
  padding: 0 16px 12px 16px;
}

.thinking-text {
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-tertiary, #888);
  white-space: pre-wrap;
  word-break: break-word;
}

.thinking-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background-color: var(--text-tertiary, #888);
  vertical-align: middle;
  margin-left: 2px;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
