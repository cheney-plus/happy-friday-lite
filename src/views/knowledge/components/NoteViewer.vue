<template>
  <div class="note-viewer">
    <div v-if="loading" class="note-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="note-error">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>{{ error }}</span>
    </div>
    <div v-else class="note-content">
      <div class="note-header">
        <h1 class="note-title">{{ note.title || '未命名笔记' }}</h1>
        <div class="note-meta">
          <span v-if="note.updatedAt">更新于 {{ formatTime(note.updatedAt) }}</span>
        </div>
      </div>
      <div class="note-body" ref="contentRef" v-html="note.content || ''"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue';
import { formatRelativeTime as formatTime } from '../utils';

const props = defineProps({
  filePath: { type: String, required: true }
});

const loading = ref(true);
const error = ref('');
const note = ref({});
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
    const id = count ? `${base}-${count + 1}` : base; el.id = id;
    return { id, title, level: Number(el.tagName.slice(1)) };
  });
  emit('toc-ready', items);
  headingObserver?.disconnect();
  headingObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (visible) emit('active-section', visible.target.id);
  }, { root: contentRef.value?.closest('.note-viewer'), rootMargin: '-10% 0px -75% 0px' });
  headings.forEach(h => headingObserver.observe(h));
}
function scrollToSection(item) { contentRef.value?.querySelector(`#${CSS.escape(item.id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
defineExpose({ scrollToSection });

async function loadNote() {
  loading.value = true;
  error.value = '';
  const api = window.electronAPI;
  if (!api) {
    error.value = 'Electron API 不可用';
    loading.value = false;
    return;
  }
  try {
    // 1. 读取 .note 元数据文件
    const fileResult = await api.invoke('kb-read-file', { filePath: props.filePath });
    if (!fileResult.success) {
      error.value = fileResult.error || '读取笔记引用失败';
      loading.value = false;
      return;
    }
    let meta;
    try {
      meta = JSON.parse(fileResult.content);
    } catch (e) {
      error.value = '笔记引用格式损坏';
      loading.value = false;
      return;
    }
    if (!meta.noteId) {
      error.value = '笔记引用缺少 noteId';
      loading.value = false;
      return;
    }

    // 2. 从数据库实时获取笔记内容
    const noteData = await api.invoke('get_note', { noteId: meta.noteId });
    if (!noteData) {
      error.value = '原笔记已被删除';
      loading.value = false;
      return;
    }
    note.value = noteData;
    loading.value = false;
    await nextTick();
    buildToc();
  } catch (e) {
    error.value = '加载笔记失败: ' + (e.message || e);
    loading.value = false;
  }
}

onMounted(() => {
  loadNote();
});
onBeforeUnmount(() => headingObserver?.disconnect());
</script>

<style scoped lang="scss">
.note-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--bg-primary);
}

.note-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 40px;
  color: var(--text-primary);
  font-size: 15px;
  line-height: 1.8;
  -webkit-user-select: text;
  user-select: text;
}

.note-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.note-title {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--text-primary);
}

.note-meta {
  font-size: 13px;
  color: var(--text-tertiary);
}

.note-body {
  :deep(*) {
    -webkit-user-select: text;
    user-select: text;
  }

  :deep(h1) {
    font-size: 24px;
    font-weight: 700;
    margin: 24px 0 16px;
  }

  :deep(h2) {
    font-size: 20px;
    font-weight: 600;
    margin: 20px 0 12px;
  }

  :deep(h3) {
    font-size: 17px;
    font-weight: 600;
    margin: 16px 0 10px;
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

.note-loading,
.note-error {
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
