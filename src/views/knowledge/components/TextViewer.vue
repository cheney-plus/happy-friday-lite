<template>
  <div class="text-viewer">
    <div v-if="loading" class="text-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="text-error">
      <span>{{ error }}</span>
    </div>
    <div v-else class="text-content">
      <pre class="text-pre"><code>{{ content }}</code></pre>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  filePath: { type: String, required: true }
});

const content = ref('');
const loading = ref(true);
const error = ref('');

async function loadText() {
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
    let text = result.content || '';
    // JSON 格式化
    const ext = props.filePath.split('.').pop().toLowerCase();
    if (ext === 'json') {
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
      } catch (_) {
        // 解析失败则显示原始内容
      }
    }
    content.value = text;
    loading.value = false;
  } catch (e) {
    error.value = '加载文件失败: ' + (e.message || e);
    loading.value = false;
  }
}

onMounted(() => {
  loadText();
});
</script>

<style scoped lang="scss">
.text-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

.text-content {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.text-pre {
  margin: 0;
  padding: 24px 32px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  tab-size: 2;

  code {
    font-family: inherit;
  }
}

.text-loading,
.text-error {
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
