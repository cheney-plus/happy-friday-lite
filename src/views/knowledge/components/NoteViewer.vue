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
      <div class="note-body" v-html="note.content || ''"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  filePath: { type: String, required: true }
});

const loading = ref(true);
const error = ref('');
const note = ref({});

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
  } catch (e) {
    error.value = '加载笔记失败: ' + (e.message || e);
    loading.value = false;
  }
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

onMounted(() => {
  loadNote();
});
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
