<template>
  <div class="file-card" @click="$emit('open', file)" @dblclick="$emit('open', file)" @contextmenu.prevent.stop="$emit('contextmenu', $event)">
    <!-- 索引状态指示器（仅对非文件夹文件显示） -->
    <div
      v-if="!file.isDirectory && indexStatus !== null"
      class="index-status-indicator"
      :class="indexStatusClass"
      :title="indexStatusTitle"
    ></div>
    <div class="file-preview">
      <div class="file-type-icon" :class="file.type">
        <component :is="getFileIconComponent(file.type)" />
      </div>
    </div>
    <div class="file-info">
      <h3 class="file-name">{{ file.name }}</h3>
      <div class="file-meta">
        <div class="meta-left">
          <span class="meta-type" :class="file.type">{{ getTypeLabel(file.type) }}</span>
          <span v-if="file.isDirectory && file.count" class="meta-count">{{ file.count }}</span>
        </div>
        <div class="meta-right">
          <span v-if="file.modifiedTime" class="meta-date">{{ formatDate(file.modifiedTime) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { FILE_ICON_MAP, UnknownFileIcon } from './icons';
import { FILE_TYPE_LABELS } from '../constants';

const props = defineProps({
  file: { type: Object, required: true },
  ragRefreshKey: { type: Number, default: 0 }
});

defineEmits(['open', 'contextmenu']);

function getFileIconComponent(type) {
  return FILE_ICON_MAP[type] || UnknownFileIcon;
}

function getTypeLabel(type) {
  return FILE_TYPE_LABELS[type] || '文件';
}

function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }
  return (d.getMonth() + 1) + '/' + d.getDate();
}

// RAG 索引状态: null=未知/文件夹, 'success'=已索引(绿), 'pending'/'processing'=处理中(黄), 'failed'=失败(红), 其他=未索引(红)
const indexStatus = ref(null);

const indexStatusClass = computed(() => {
  switch (indexStatus.value) {
    case 'success':
      return 'status-success';
    case 'pending':
    case 'processing':
      return 'status-processing';
    case 'failed':
      return 'status-failed';
    default:
      return 'status-not-indexed';
  }
});

const indexStatusTitle = computed(() => {
  switch (indexStatus.value) {
    case 'success':
      return '已索引';
    case 'pending':
      return '等待索引';
    case 'processing':
      return '索引中';
    case 'failed':
      return '索引失败';
    default:
      return '未索引';
  }
});

async function loadIndexStatus() {
  if (props.file.isDirectory || !props.file.path) {
    indexStatus.value = null;
    return;
  }
  try {
    const api = window.electronAPI;
    if (!api) return;
    const result = await api.invoke('rag-get-file-status', { filePath: props.file.path });
    if (result && result.success) {
      indexStatus.value = result.status;
    }
  } catch (e) {
    // 静默失败，不影响卡片显示
  }
}

onMounted(loadIndexStatus);
watch(() => props.file.path, loadIndexStatus);
watch(() => props.ragRefreshKey, loadIndexStatus);

// 暴露刷新方法，供父组件在索引完成后调用
defineExpose({
  refreshStatus: loadIndexStatus
});
</script>

<style scoped lang="scss">
.file-card {
  width: 140px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  position: relative;

  // RAG 索引状态指示器（右上角）
  .index-status-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    z-index: 1;
    box-shadow: 0 0 0 2px var(--bg-primary);

    &.status-success {
      background: #10b981;
    }

    &.status-processing {
      background: #f59e0b;
      animation: pulse 1.5s ease-in-out infinite;
    }

    &.status-failed,
    &.status-not-indexed {
      background: #ef4444;
    }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  &:hover {
    border-color: var(--text-tertiary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-3px);
  }

  .file-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60px;
    margin-bottom: 6px;

    .file-type-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 12px;
      transition: all 0.25s ease;

      &.folder { background: #E3F2FD; color: #1560F7; }
      &.markdown { background: #E8F5E9; color: #4CAF50; }
      &.pdf { background: #FFEBEE; color: #F44336; }
      &.txt { background: #F5F5F5; color: #9E9E9E; }
      &.excel { background: #E8F5E9; color: #4CAF50; }
      &.word { background: #E3F2FD; color: #2196F3; }
      &.note { background: #FFF8E1; color: #FFC107; }
      &.ppt { background: #FFF3E0; color: #FF9800; }
      &.epub { background: #F3E5F5; color: #9C27B0; }
      &.html { background: #E0F7FA; color: #00BCD4; }
      &.xml { background: #ECEFF1; color: #607D8B; }
      &.json { background: #FFF3E0; color: #FF9800; }
      &.unknown { background: #ECEFF1; color: #90A4AE; }
    }
  }

  &:hover .file-type-icon {
    transform: scale(1.08);
  }

  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;

    .file-name {
      font-size: 12.5px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0 0 6px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.4;
      text-align: center;
      word-break: break-all;
      min-height: 35px;
    }

    .file-meta {
      margin-top: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 6px;
      font-size: 11px;
      color: var(--text-tertiary);

      .meta-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .meta-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .meta-date { color: var(--text-tertiary); }

      .meta-type {
        &.folder { color: #1560F7; }
        &.markdown { color: #4CAF50; }
        &.pdf { color: #F44336; }
        &.txt { color: #9E9E9E; }
        &.excel { color: #4CAF50; }
        &.word { color: #2196F3; }
        &.note { color: #FFC107; }
        &.ppt { color: #FF9800; }
        &.epub { color: #9C27B0; }
        &.html { color: #00BCD4; }
        &.xml { color: #607D8B; }
        &.json { color: #FF9800; }
        &.unknown { color: #90A4AE; }
      }
    }
  }
}
</style>
