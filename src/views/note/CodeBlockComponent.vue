<template>
  <node-view-wrapper class="code-block-component">
    <div class="code-block-header">
      <select
        v-model="selectedLanguage"
        class="language-select"
      >
        <option value="">auto</option>
        <option value="javascript">JavaScript</option>
        <option value="typescript">TypeScript</option>
        <option value="python">Python</option>
        <option value="java">Java</option>
        <option value="cpp">C++</option>
        <option value="csharp">C#</option>
        <option value="go">Go</option>
        <option value="rust">Rust</option>
        <option value="php">PHP</option>
        <option value="ruby">Ruby</option>
        <option value="swift">Swift</option>
        <option value="kotlin">Kotlin</option>
        <option value="html">HTML</option>
        <option value="css">CSS</option>
        <option value="scss">SCSS</option>
        <option value="sql">SQL</option>
        <option value="json">JSON</option>
        <option value="yaml">YAML</option>
        <option value="markdown">Markdown</option>
        <option value="bash">Bash</option>
        <option value="shell">Shell</option>
        <option value="plaintext">Plain Text</option>
      </select>
      <div class="header-actions">
        <button class="action-btn" :title="copied ? t('note.codeBlock.copied') : t('note.codeBlock.copyCode')" @click="handleCopy">
          <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <button class="action-btn danger" :title="t('note.codeBlock.deleteBlock')" @click="handleDelete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
    <div class="code-block-content">
      <div class="line-numbers" contenteditable="false" aria-hidden="true">
        <div v-for="n in lineCount" :key="n" class="line-number">{{ n }}</div>
      </div>
      <pre><node-view-content as="code" /></pre>
    </div>
  </node-view-wrapper>
</template>

<script setup>
import { ref, computed } from 'vue';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  node: Object,
  updateAttributes: Function,
  deleteNode: Function
});

const copied = ref(false);

const selectedLanguage = computed({
  get: () => props.node.attrs.language || '',
  set: (val) => props.updateAttributes({ language: val || null })
});

const lineCount = computed(() => {
  const text = props.node.textContent || '';
  if (!text) return 1;
  return text.split('\n').length;
});

const handleCopy = async () => {
  const text = props.node.textContent || '';
  try {
    await navigator.clipboard.writeText(text);
  } catch (_e) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

const handleDelete = () => {
  props.deleteNode();
};
</script>

<style scoped>
.code-block-component {
  position: relative;
  margin: 0.5em 0;
  border-radius: 8px;
  overflow: hidden;
  background-color: #f0f0f0;
  border: 1px solid #d9d9d9;
}

.code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background-color: transparent;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background-color: transparent;
  color: #888;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background-color: #e0e0e0;
  color: #333;
}

.action-btn.danger:hover {
  background-color: #fee2e2;
  color: #ef4444;
}

.language-select {
  background-color: #f0f0f0;
  color: #555;
  border: none;
  border-radius: 4px;
  padding: 4px 24px 4px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  appearance: none;
  box-shadow: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
}

.language-select:hover {
  box-shadow: none;
}

.language-select:focus {
  box-shadow: none;
}

.language-select option {
  background-color: #f5f5f5;
  color: #333;
}

.code-block-content {
  display: flex;
  overflow: hidden;
}

.line-numbers {
  flex-shrink: 0;
  padding: 8px 0;
  text-align: right;
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  pointer-events: none;
  border-right: 1px solid #d9d9d9;
  min-width: 36px;
}

.line-number {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 20px;
  padding: 0 8px;
  color: #aaa;
}

pre {
  margin: 0;
  padding: 8px 16px;
  background-color: transparent;
  overflow-x: auto;
  flex: 1;
}

pre::-webkit-scrollbar {
  height: 6px;
}

pre::-webkit-scrollbar-track {
  background: #e0e0e0;
  border-radius: 3px;
}

pre::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 3px;
}

pre::-webkit-scrollbar-thumb:hover {
  background: #999;
}

pre :deep(code) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 20px;
  color: #333;
  tab-size: 2;
  text-shadow: none;
  display: block;
  white-space: pre !important;
  word-wrap: normal !important;
  overflow-wrap: normal !important;
}

pre :deep(p) {
  margin: 0;
  padding: 0;
  line-height: 20px;
  white-space: pre !important;
  word-wrap: normal !important;
  overflow-wrap: normal !important;
}

pre :deep(br) {
  line-height: 20px;
}

pre :deep(.hljs-comment),
pre :deep(.hljs-quote) {
  font-style: normal !important;
  color: #6a737d !important;
}

pre :deep(.hljs-keyword),
pre :deep(.hljs-selector-tag),
pre :deep(.hljs-section) {
  color: #d73a49 !important;
}

pre :deep(.hljs-string),
pre :deep(.hljs-addition),
pre :deep(.hljs-regexp) {
  color: #032f62 !important;
}

pre :deep(.hljs-number),
pre :deep(.hljs-literal) {
  color: #005cc5 !important;
}

pre :deep(.hljs-built_in),
pre :deep(.hljs-type),
pre :deep(.hljs-class) {
  color: #e36209 !important;
}

pre :deep(.hljs-function),
pre :deep(.hljs-title) {
  color: #6f42c1 !important;
}

pre :deep(.hljs-variable),
pre :deep(.hljs-attr),
pre :deep(.hljs-params) {
  color: #e2286e !important;
}

pre :deep(.hljs-symbol),
pre :deep(.hljs-bullet),
pre :deep(.hljs-meta) {
  color: #22863a !important;
}

pre :deep(.hljs-deletion) {
  color: #b31d28 !important;
}

pre :deep(.hljs-name),
pre :deep(.hljs-tag) {
  color: #22863a !important;
}

pre :deep(.hljs-attribute) {
  color: #6f42c1 !important;
}

pre :deep(.hljs-selector-class) {
  color: #6f42c1 !important;
}

pre :deep(.hljs-selector-id) {
  color: #005cc5 !important;
}
</style>
