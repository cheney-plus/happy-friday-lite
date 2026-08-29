<template>
  <div class="ai-message-wrapper">
    <div class="ai-message-block">
      <div class="ai-header">
        <div class="avatar ai-avatar">
          <span class="avatar-icon">✦</span>
        </div>
        <span class="ai-name">{{ displayName }}</span>
      </div>

      <div v-if="hasReasoning" class="thinking-section">
        <span class="thinking-toggle" @click="toggleThinking">
          思考过程
          <svg
            class="thinking-arrow"
            :class="{ collapsed: thinkingCollapsed }"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
        <div v-show="!thinkingCollapsed" class="thinking-body">
          <div class="markdown-body" v-html="renderedReasoning"></div>
          <span v-if="reasoningStreaming" class="streaming-cursor"></span>
        </div>
      </div>

      <div class="ai-body">
        <div class="markdown-body" v-html="renderedContent"></div>
        <span v-if="isStreaming" class="streaming-cursor"></span>
      </div>

      <div v-if="showActions && !isStreaming" class="ai-footer">
        <div class="footer-left">
          <button class="action-icon-btn" @click="$emit('action', 'add')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <span class="tooltip">保存</span>
          </button>
          <button class="action-icon-btn" :class="{ 'copied': copied }" @click="handleCopy">
            <svg v-if="!copied" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span class="tooltip">{{ copied ? '已复制' : '复制' }}</span>
          </button>
        </div>
        <div class="footer-right">
          <button v-if="showRollback" class="action-icon-btn" @click="$emit('action', 'rollback')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 14 4 9 9 4"></polyline>
              <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
            </svg>
            <span class="tooltip">回退</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="showDivider && !isStreaming" class="message-divider"></div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { handleCodeCopyClick, renderMarkdown, stripMarkdown } from '@/utils/markdown';

const props = defineProps({
  content: { type: String, default: '' },
  displayName: { type: String, default: '周五' },
  showDivider: { type: Boolean, default: true },
  isStreaming: { type: Boolean, default: false },
  showActions: { type: Boolean, default: true },
  showRollback: { type: Boolean, default: true },
  reasoning: { type: String, default: '' },
  reasoningStreamingContent: { type: String, default: '' }
});

defineEmits(['action']);

const copied = ref(false);
const thinkingCollapsed = ref(false);
let cachedContent = '';
let cachedHtml = '';

const hasReasoning = computed(() => !!(props.reasoning || props.reasoningStreamingContent));

const reasoningStreaming = computed(() => props.isStreaming && !!props.reasoningStreamingContent);

const effectiveReasoning = computed(() =>
  props.reasoningStreamingContent || props.reasoning || ''
);

const renderedReasoning = computed(() => {
  const quoted = effectiveReasoning.value
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
  return renderMarkdown(quoted);
});

function toggleThinking() {
  thinkingCollapsed.value = !thinkingCollapsed.value;
}

const renderedContent = computed(() => {
  const content = props.content || '';
  if (!content) {
    cachedContent = '';
    cachedHtml = '';
    return '';
  }

  // During streaming, keep completed paragraphs rendered and only parse the tail.
  // This avoids reparsing the entire response for every animation-frame update.
  if (props.isStreaming && content.indexOf('\n\n') >= 0) {
    const boundary = content.lastIndexOf('\n\n');
    const stableContent = content.slice(0, boundary + 2);
    const tail = content.slice(boundary + 2);
    if (cachedContent && !stableContent.startsWith(cachedContent)) {
      cachedContent = '';
      cachedHtml = '';
    }
    if (stableContent !== cachedContent) {
      cachedContent = stableContent;
      cachedHtml = renderMarkdown(stableContent);
    }
    return cachedHtml + renderMarkdown(tail);
  }

  cachedContent = content;
  cachedHtml = renderMarkdown(content);
  return cachedHtml;
});

async function handleCopy() {
  try {
    const htmlContent = renderedContent.value;
    const textContent = stripMarkdown(props.content);

    const clipboardItem = new ClipboardItem({
      'text/html': new Blob([htmlContent], { type: 'text/html' }),
      'text/plain': new Blob([textContent], { type: 'text/plain' })
    });

    await navigator.clipboard.write([clipboardItem]);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

onMounted(() => {
  document.addEventListener('click', handleCodeCopyClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleCodeCopyClick);
});
</script>

<style scoped>
.ai-message-wrapper {
  display: flex;
  flex-direction: column;
}

.ai-message-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ai-avatar {
  background: linear-gradient(135deg, #6ee7b7 0%, #34d399 50%, #10b981 100%);
}

.avatar-icon {
  font-size: 16px;
  color: #ffffff;
  font-weight: 700;
}

.ai-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.thinking-section {
  padding-left: 0;
}

.thinking-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: pointer;
  user-select: none;
  line-height: 1;
}

.thinking-toggle:hover {
  color: var(--text-secondary);
}

.thinking-arrow {
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.thinking-arrow.collapsed {
  transform: rotate(180deg);
}

.thinking-body {
  margin-top: 8px;
}

.thinking-body :deep(.markdown-body) {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-tertiary);
}

.thinking-body :deep(blockquote) {
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid var(--border-color);
  background: var(--bg-hover, rgba(0, 0, 0, 0.02));
  border-radius: 0 8px 8px 0;
  color: var(--text-tertiary);
}

.ai-body {
  padding-left: 0;
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--text-primary);
}

.markdown-body {
  white-space: normal;
  -webkit-user-select: text;
  user-select: text;
}

.markdown-body :deep(*) {
  -webkit-user-select: text;
  user-select: text;
}

.markdown-body :deep(p) {
  margin: 0 0 8px;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 16px 0 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.markdown-body :deep(h1) { font-size: 1.3em; }
.markdown-body :deep(h2) { font-size: 1.15em; }
.markdown-body :deep(h3) { font-size: 1.05em; }

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 14px;
  border-left: 3px solid #10b981;
  background: rgba(16, 185, 129, 0.06);
  border-radius: 0 8px 8px 0;
  color: var(--text-secondary);
}

.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

[data-theme='dark'] .markdown-body :deep(code) {
  background: rgba(255, 255, 255, 0.1);
}

.markdown-body :deep(.code-block-wrapper) {
  margin: 10px 0;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.04);
}

[data-theme='dark'] .markdown-body :deep(.code-block-wrapper) {
  background: rgba(255, 255, 255, 0.06);
}

.markdown-body :deep(.code-block-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
}

.markdown-body :deep(.code-block-lang) {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'Fira Code', monospace;
  text-transform: lowercase;
}

.markdown-body :deep(.code-copy-btn) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s ease;
  padding: 0;
}

.markdown-body :deep(.code-copy-btn:hover) {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-secondary);
}

[data-theme='dark'] .markdown-body :deep(.code-copy-btn:hover) {
  background: rgba(255, 255, 255, 0.1);
}

.markdown-body :deep(.code-copy-btn.copied) {
  color: #10b981;
}

.markdown-body :deep(.code-block-wrapper pre) {
  margin: 0;
  padding: 14px;
  background: transparent;
  border-radius: 0;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

[data-theme='dark'] .markdown-body :deep(.code-block-wrapper pre) {
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.markdown-body :deep(.code-block-wrapper pre::-webkit-scrollbar) {
  height: 4px;
}

.markdown-body :deep(.code-block-wrapper pre::-webkit-scrollbar-track) {
  background: transparent;
}

.markdown-body :deep(.code-block-wrapper pre::-webkit-scrollbar-thumb) {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 10px;
}

[data-theme='dark'] .markdown-body :deep(.code-block-wrapper pre::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.15);
}

.markdown-body :deep(pre) {
  margin: 10px 0;
  padding: 14px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 10px;
  overflow-x: auto;
}

[data-theme='dark'] .markdown-body :deep(pre) {
  background: rgba(255, 255, 255, 0.06);
}

.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.85em;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 0.9em;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  text-align: left;
}

.markdown-body :deep(th) {
  background: var(--bg-hover);
  font-weight: 600;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 12px 0;
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: #10b981;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 0.8s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.ai-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  padding-left: 0;
}

.footer-left,
.footer-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.action-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
  position: relative;
}

.action-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.action-icon-btn.copied {
  color: #10b981;
}

.action-icon-btn.copied:hover {
  background: rgba(16, 185, 129, 0.1);
}

.tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.8);
  color: #ffffff;
  font-size: 12px;
  border-radius: 6px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
  pointer-events: none;
  z-index: 10;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.8);
}

.action-icon-btn:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

.message-divider {
  width: 100%;
  height: 1px;
  background: var(--border-color);
}
</style>
