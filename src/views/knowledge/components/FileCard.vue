<template>
  <div
    class="file-card"
    @click="$emit('open', file)"
    @dblclick="$emit('open', file)"
    @contextmenu.prevent.stop="$emit('contextmenu', $event)"
  >
    <!-- 索引状态指示器（仅对可索引的非文件夹文件显示，工作区不显示） -->
    <div
      v-if="!file.isDirectory && indexStatus && indexStatus !== 'excluded'"
      class="index-status-indicator"
      :class="indexStatusClass"
      :title="indexStatusTitle"
    ></div>

    <!-- 文件预览区 -->
    <div class="file-preview">
      <div class="file-type-icon" :class="file.type">
        <component :is="getFileIconComponent(file.type)" />
      </div>
      <!-- 文件夹数量徽章 -->
      <span v-if="file.isDirectory && file.count" class="folder-count-badge">{{ file.count }}</span>
    </div>

    <!-- 文件信息 -->
    <div class="file-info">
      <h3 class="file-name" :title="file.name">{{ file.name }}</h3>
      <div class="file-meta">
        <span class="meta-type" :class="file.type">{{ getTypeLabel(file.type) }}</span>
        <span v-if="file.size && !file.isDirectory" class="meta-sep">·</span>
        <span v-if="file.size && !file.isDirectory" class="meta-size">{{ formatFileSize(file.size) }}</span>
        <span v-if="file.modifiedTime" class="meta-date">{{ formatDate(file.modifiedTime) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { getFileIconComponent, getTypeLabel, formatDate, formatFileSize } from '../utils';

const props = defineProps({
  file: { type: Object, required: true },
  ragRefreshKey: { type: Number, default: 0 }
});

defineEmits(['open', 'contextmenu']);

// RAG 索引状态
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
    case 'excluded':
      return '';
    default:
      return '未索引';
  }
});

async function loadIndexStatus() {
  if (props.file.isDirectory || !props.file.path) {
    indexStatus.value = '';
    return;
  }
  try {
    const api = window.electronAPI;
    if (!api) return;
    const result = await api.invoke('rag-get-file-status', { filePath: props.file.path });
    if (result && result.success) {
      indexStatus.value = result.status || 'not-indexed';
    }
  } catch (e) {
    // 静默失败
  }
}

onMounted(loadIndexStatus);
watch(() => props.file.path, loadIndexStatus);
watch(() => props.ragRefreshKey, loadIndexStatus);

defineExpose({
  refreshStatus: loadIndexStatus
});
</script>

<style scoped lang="scss">
// 文件类型颜色（图标背景使用半透明，文字使用纯色）
$type-colors: (
  folder:   #1560F7,
  markdown: #4CAF50,
  pdf:      #F44336,
  txt:      #9E9E9E,
  excel:    #4CAF50,
  word:     #2196F3,
  note:     #FFC107,
  ppt:      #FF9800,
  epub:     #9C27B0,
  html:     #00BCD4,
  xml:      #607D8B,
  json:     #FF9800,
  unknown:  #90A4AE
);

.file-card {
  width: 140px;
  border: none;
  border-radius: 12px;
  padding: 12px 8px 8px;
  cursor: pointer;
  transition: background 0.2s ease;
  background: transparent;
  display: flex;
  flex-direction: column;
  position: relative;

  // 索引状态指示器（右上角小圆点）
  .index-status-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    z-index: 2;
    transition: opacity 0.2s;

    &.status-success { background: #10b981; }

    &.status-processing {
      background: #f59e0b;
      animation: pulse 1.5s ease-in-out infinite;
    }

    &.status-failed,
    &.status-not-indexed { background: #cbd5e1; }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  &:hover {
    background: var(--bg-hover);
  }

  &:active {
    background: var(--bg-active);
    transition-duration: 0.06s;
  }

  .file-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60px;
    margin-bottom: 8px;
    position: relative;

    .file-type-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 50px;
      height: 50px;
      border-radius: 13px;
      transition: transform 0.2s ease;

      @each $type, $color in $type-colors {
        &.#{$type} {
          background: rgba($color, 0.1);
          color: $color;
        }
      }
    }

    // 文件夹数量徽章
    .folder-count-badge {
      position: absolute;
      bottom: 0;
      right: calc(50% - 28px);
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-primary);
      border-radius: 8px;
      font-size: 9.5px;
      font-weight: 600;
      color: var(--text-secondary);
      box-shadow: 0 0 0 1px var(--border-color);
      z-index: 2;
    }
  }

  &:hover .file-type-icon {
    transform: scale(1.05);
  }

  .file-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .file-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.4;
      text-align: center;
      word-break: break-all;
      min-height: 33px;
    }

    .file-meta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 10px;
      color: var(--text-tertiary);
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;

      .meta-type {
        font-weight: 500;

        @each $type, $color in $type-colors {
          &.#{$type} { color: $color; }
        }
      }

      .meta-sep {
        opacity: 0.45;
      }

      .meta-size,
      .meta-date {
        color: var(--text-tertiary);
      }
    }
  }
}

// 深色模式适配
[data-theme='dark'] {
  .file-card {
    .file-preview {
      .file-type-icon {
        @each $type, $color in $type-colors {
          &.#{$type} {
            background: rgba($color, 0.15);
          }
        }
      }
    }

    .index-status-indicator {
      &.status-failed,
      &.status-not-indexed { background: #4b5563; }
    }
  }
}
</style>
