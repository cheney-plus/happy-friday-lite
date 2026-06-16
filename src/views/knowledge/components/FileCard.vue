<template>
  <div class="file-card" @click="$emit('open', file)" @dblclick="$emit('open', file)">
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
import { FILE_ICON_MAP, UnknownFileIcon } from './icons';
import { FILE_TYPE_LABELS } from '../constants';

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

defineProps({
  file: { type: Object, required: true }
});

defineEmits(['open']);
</script>

<style scoped lang="scss">
.file-card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: var(--text-tertiary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-3px);
  }

  .file-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    margin-bottom: 8px;

    .file-type-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 12px;
      transition: all 0.25s ease;

      &.folder { color: #1560F7; }
      &.markdown { background: #E8F5E9; color: #4CAF50; }
      &.pdf { background: #FFEBEE; color: #F44336; }
      &.txt { background: #F5F5F5; color: #9E9E9E; }
      &.excel { background: #E8F5E9; color: #4CAF50; }
      &.word { background: #E3F2FD; color: #2196F3; }
      &.note { background: #FFF8E1; color: #FFC107; }
      &.ppt { background: #FFF3E0; color: #FF9800; }
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
      margin: 0 0 auto 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.4;
      text-align: center;
    }

    .file-meta {
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
        &.unknown { color: #90A4AE; }
      }
    }
  }
}
</style>
