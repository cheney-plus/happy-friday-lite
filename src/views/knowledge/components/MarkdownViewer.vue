<template>
  <div class="markdown-viewer">
    <div class="md-content" ref="contentRef" v-html="renderedHtml"></div>
    <div v-if="loading" class="md-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="md-error">
      <span>{{ error }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue';
import { marked } from 'marked';

const props = defineProps({
  filePath: { type: String, required: true }
});

const renderedHtml = ref('');
const loading = ref(true);
const error = ref('');
const contentRef = ref(null);
const emit = defineEmits(['toc-ready', 'active-section']);
let headingObserver;

function buildToc() {
  const headings = [...(contentRef.value?.querySelectorAll('h1,h2,h3,h4,h5,h6') || [])];
  const used = new Map();
  const items = headings.map((el) => {
    const title = el.textContent.trim() || '未命名章节';
    const base = title.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || 'section';
    const count = used.get(base) || 0; used.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    el.id = id;
    return { id, title, level: Number(el.tagName.slice(1)) };
  });
  emit('toc-ready', items);
  headingObserver?.disconnect();
  headingObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (visible) emit('active-section', visible.target.id);
  }, { root: contentRef.value?.parentElement, rootMargin: '-10% 0px -75% 0px' });
  headings.forEach(h => headingObserver.observe(h));
}

function scrollToSection(item) { contentRef.value?.querySelector(`#${CSS.escape(item.id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
defineExpose({ scrollToSection });

marked.setOptions({
  breaks: true,
  gfm: true
});

async function loadMarkdown() {
  loading.value = true;
  error.value = '';
  const api = window.electronAPI;
  if (!api) {
    error.value = 'Electron API 不可用';
    loading.value = false;
    return;
  }
  try {
    const result = await api.invoke('kb-read-file', { filePath: props.filePath });
    if (!result.success) {
      error.value = result.error || '读取文件失败';
      loading.value = false;
      return;
    }
    renderedHtml.value = marked.parse(result.content || '');
    loading.value = false;
    await nextTick();
    buildToc();
  } catch (e) {
    error.value = '加载文件失败: ' + (e.message || e);
    loading.value = false;
  }
}

onMounted(() => {
  loadMarkdown();
});
onBeforeUnmount(() => headingObserver?.disconnect());
</script>

<style scoped lang="scss">
.markdown-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--bg-primary);
}

.md-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 40px;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.8;
  -webkit-user-select: text;
  user-select: text;

  :deep(*) {
    -webkit-user-select: text;
    user-select: text;
  }

  :deep(h1) {
    font-size: 26px;
    font-weight: 700;
    margin: 24px 0 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }

  :deep(h2) {
    font-size: 22px;
    font-weight: 600;
    margin: 20px 0 12px;
  }

  :deep(h3) {
    font-size: 18px;
    font-weight: 600;
    margin: 16px 0 10px;
  }

  :deep(h4),
  :deep(h5),
  :deep(h6) {
    font-size: 16px;
    font-weight: 600;
    margin: 14px 0 8px;
  }

  :deep(p) {
    margin: 0 0 12px;
  }

  :deep(a) {
    color: var(--accent-color);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 12px;
    padding-left: 24px;
  }

  :deep(li) {
    margin: 4px 0;
  }

  :deep(blockquote) {
    margin: 12px 0;
    padding: 8px 16px;
    border-left: 3px solid var(--accent-color);
    background: var(--bg-secondary);
    border-radius: 0 6px 6px 0;
    color: var(--text-secondary);
  }

  :deep(code) {
    font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    padding: 2px 6px;
    background: var(--bg-secondary);
    border-radius: 4px;
  }

  :deep(pre) {
    margin: 12px 0;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
    overflow-x: auto;

    code {
      padding: 0;
      background: transparent;
      font-size: 13px;
      line-height: 1.6;
    }
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 14px;

    th,
    td {
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      text-align: left;
    }

    th {
      background: var(--bg-secondary);
      font-weight: 600;
    }
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 8px;
    margin: 8px 0;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid var(--border-color);
    margin: 20px 0;
  }
}

.md-loading,
.md-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
  background: var(--bg-primary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
