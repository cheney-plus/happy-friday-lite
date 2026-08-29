<template>
  <div class="html-viewer">
    <div v-if="loading" class="html-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>
    <div v-else-if="error" class="html-error">
      <span>{{ error }}</span>
    </div>
    <iframe
      v-else
      class="html-iframe"
      ref="iframeRef"
      :srcdoc="htmlContent"
      @load="onFrameLoad"
      sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms allow-modals"
    ></iframe>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  filePath: { type: String, required: true }
});

const htmlContent = ref('');
const loading = ref(true);
const error = ref('');
const iframeRef = ref(null);
const emit = defineEmits(['toc-ready', 'active-section']);
let frameScrollHandler;

function onFrameLoad() {
  const doc = iframeRef.value?.contentDocument;
  if (!doc) return;
  const headings = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const used = new Map();
  const items = headings.map((el) => {
    const title = el.textContent.trim() || '未命名章节';
    const base = title.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || 'section';
    const count = used.get(base) || 0; used.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base; el.id = id;
    return { id, title, level: Number(el.tagName.slice(1)) };
  });
  emit('toc-ready', items);
  frameScrollHandler = () => {
    const visible = headings.filter(h => h.getBoundingClientRect().top <= 100).at(-1);
    if (visible) emit('active-section', visible.id);
  };
  doc.addEventListener('scroll', frameScrollHandler, { passive: true });
}
function scrollToSection(item) {
  const target = iframeRef.value?.contentDocument?.getElementById(item.id);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
defineExpose({ scrollToSection });

async function loadHtml() {
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
    htmlContent.value = result.content || '';
    loading.value = false;
  } catch (e) {
    error.value = '加载文件失败: ' + (e.message || e);
    loading.value = false;
  }
}

onMounted(() => {
  loadHtml();
});
onBeforeUnmount(() => {
  const doc = iframeRef.value?.contentDocument;
  if (doc && frameScrollHandler) doc.removeEventListener('scroll', frameScrollHandler);
});
</script>

<style scoped lang="scss">
.html-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #fff;
}

.html-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

.html-loading,
.html-error {
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
