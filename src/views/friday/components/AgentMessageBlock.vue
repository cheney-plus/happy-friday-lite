<template>
  <div class="agent-response-block">
    <div class="agent-response-header">
      <div class="avatar ai-avatar"><span class="avatar-icon">✦</span></div>
      <span class="ai-name">{{ t('friday.assistantName') }}</span>
    </div>
    <div class="agent-timeline">
      <template v-for="(seg, si) in segments" :key="seg.id || `${si}`">
        <div v-if="seg.type === 'text' && seg.content" class="agent-text-body">
          <div class="markdown-body" v-html="renderSegmentMarkdown(seg)"></div>
          <span v-if="seg.isStreaming" class="streaming-cursor"></span>
        </div>
        <ToolCallSection
          v-else-if="seg.type === 'tool'"
          :tool-name="seg.toolName"
          :arguments="seg.arguments"
          :output="seg.output"
          :status="seg.status"
          :default-collapsed="seg.status === 'success' && !seg.requireApproval"
        />
      </template>
      <div v-if="thinking" class="thinking-indicator">
        <span class="thinking-text">{{ t('friday.thinking') }}</span>
        <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
      </div>
    </div>
    <div v-if="showActions" class="agent-footer">
      <div class="footer-left">
        <button class="action-icon-btn" type="button" @click="$emit('action', 'add')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          <span class="tooltip">{{ t('friday.save') }}</span>
        </button>
        <button class="action-icon-btn" type="button" @click="$emit('action', 'copy')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="tooltip">{{ t('friday.copy') }}</span>
        </button>
      </div>
      <div class="footer-right">
        <button class="action-icon-btn" type="button" @click="$emit('action', 'rollback')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 14 4 9 9 4"></polyline>
            <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
          </svg>
          <span class="tooltip">{{ t('friday.rollback') }}</span>
        </button>
      </div>
    </div>
    <div v-if="showDivider" class="message-divider"></div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import ToolCallSection from '@/components/chat/ToolCallSection.vue';
import { renderMarkdown } from '@/utils/markdown';

defineProps({
  segments: { type: Array, default: () => [] },
  thinking: { type: Boolean, default: false },
  showActions: { type: Boolean, default: false },
  showDivider: { type: Boolean, default: false }
});

defineEmits(['action']);

const { t } = useI18n();

const segmentHtmlCache = new Map();

function renderSegmentMarkdown(segment) {
  const key = segment.id || segment;
  const content = segment.content || '';
  const cached = segmentHtmlCache.get(key);
  if (cached && cached.content === content) return cached.html;
  const html = renderMarkdown(content);
  segmentHtmlCache.set(key, { content, html });
  if (segmentHtmlCache.size > 100) {
    const firstKey = segmentHtmlCache.keys().next().value;
    segmentHtmlCache.delete(firstKey);
  }
  return html;
}
</script>

<style scoped>
.agent-response-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.agent-response-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.agent-response-header .avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-response-header .ai-avatar {
  background: linear-gradient(135deg, #6ee7b7 0%, #34d399 50%, #10b981 100%);
}

.agent-response-header .avatar-icon {
  font-size: 16px;
  color: #ffffff;
  font-weight: 700;
}

.agent-response-header .ai-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.agent-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-left: 44px;
}

.agent-text-body {
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--text-primary);
}

.agent-text-body .markdown-body {
  white-space: normal;
  user-select: text;
}

.agent-text-body .markdown-body :deep(p) {
  margin: 0 0 8px;
}

.agent-text-body .markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.agent-text-body .markdown-body :deep(h1),
.agent-text-body .markdown-body :deep(h2),
.agent-text-body .markdown-body :deep(h3) {
  margin: 16px 0 8px;
  font-weight: 600;
}

.agent-text-body .markdown-body :deep(ul),
.agent-text-body .markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.agent-text-body .markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

[data-theme='dark'] .agent-text-body .markdown-body :deep(code) {
  background: rgba(255, 255, 255, 0.1);
}

.agent-text-body .markdown-body :deep(pre) {
  margin: 10px 0;
  padding: 14px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 10px;
  overflow-x: auto;
}

.agent-text-body .markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}

.agent-text-body .markdown-body :deep(blockquote) {
  margin: 10px 0;
  padding: 8px 14px;
  border-left: 3px solid #10b981;
  background: rgba(16, 185, 129, 0.06);
  border-radius: 0 8px 8px 0;
  color: var(--text-secondary);
}

.agent-text-body .markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 0.9em;
}

.agent-text-body .markdown-body :deep(th),
.agent-text-body .markdown-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  text-align: left;
}

.agent-response-block .message-divider {
  width: 100%;
  height: 1px;
  background: var(--border-color);
  margin-top: 8px;
}

.agent-timeline .streaming-cursor {
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

.thinking-indicator {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  font-size: 14px;
  color: var(--text-tertiary, #999);
}

.thinking-dots span {
  display: inline-block;
  opacity: 0;
  animation: thinking-dot 1.4s infinite;
}

.thinking-dots span:nth-child(1) { animation-delay: 0s; }
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking-dot {
  0%, 60%, 100% { opacity: 0; }
  30% { opacity: 1; }
}

.agent-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  padding-left: 44px;
}

.agent-footer .footer-left,
.agent-footer .footer-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.agent-footer .action-icon-btn {
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
  position: relative;
}

.agent-footer .action-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.agent-footer .tooltip {
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
  pointer-events: none;
}

.agent-footer .action-icon-btn:hover .tooltip {
  opacity: 1;
  visibility: visible;
}

.agent-text-body .markdown-body :deep(.code-block-wrapper) {
  margin: 10px 0;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.04);
}

.agent-text-body .markdown-body :deep(.code-block-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
}

.agent-text-body .markdown-body :deep(.code-block-lang) {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.agent-text-body .markdown-body :deep(.code-copy-btn) {
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
}

.agent-text-body .markdown-body :deep(a) {
  color: #10b981;
  text-decoration: none;
}
</style>
