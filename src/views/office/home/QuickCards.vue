<template>
  <div class="quick-cards">
    <button
      v-for="card in cards"
      :key="card.ext"
      class="quick-card"
      @click="$emit('new', card.type)"
    >
      <span class="file-badge" :style="{ background: card.color }">{{ card.ext }}</span>
      <span class="quick-text">
        <span class="quick-title-row">
          <span class="quick-title">{{ card.title }}</span>
          <span class="ai-chip">AI</span>
        </span>
        <span class="quick-sub">.{{ card.ext }}</span>
      </span>
    </button>
    <button class="quick-card" @click="$emit('open-local')">
      <span class="quick-folder">
        <Folder :size="18" />
      </span>
      <span class="quick-text">
        <span class="quick-title-row">
          <span class="quick-title">{{ t('office.openLocal') }}</span>
        </span>
        <span class="quick-sub">{{ openExts }}</span>
      </span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Folder } from 'lucide-vue-next';
import { badgeMeta } from './fileMeta';

defineEmits(['new', 'open-local']);

const { t } = useI18n();

// 本产品内置编辑器仅支持 docs/sheets/slides/pdf（上游的 Markdown/HTML 卡片不提供）
const cards = computed(() => [
  { type: 'docs', ext: 'docx', title: t('office.aiDocs'), color: badgeMeta('docs').color },
  { type: 'sheets', ext: 'xlsx', title: t('office.aiSheets'), color: badgeMeta('sheets').color },
  { type: 'slides', ext: 'pptx', title: t('office.aiSlides'), color: badgeMeta('slides').color },
  { type: 'pdf', ext: 'pdf', title: t('office.aiPdf'), color: badgeMeta('pdf').color },
]);

const openExts = '.docx / .xlsx / .csv / .pptx / .pdf';
</script>

<style scoped lang="scss">
.quick-cards {
  display: flex;
  align-items: stretch;
  gap: 10px;
  flex-wrap: wrap;
}

.quick-card {
  position: relative;
  flex: 1;
  min-width: 150px;
  max-width: 280px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 18px 16px;
  border: 1px solid var(--of-border);
  border-radius: 12px;
  background: var(--of-surface);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.12s,
    box-shadow 0.12s;

  &:hover {
    border-color: var(--of-border-hover);
    box-shadow: 0 3px 12px rgb(0 0 0 / 8%);
  }
}

.file-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.quick-folder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--of-bg-hover);
  color: var(--of-text-secondary);
  flex-shrink: 0;
}

.quick-text {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.quick-title-row {
  max-width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.quick-title {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--of-text-primary);
}

.ai-chip {
  padding: 1px 5px;
  border-radius: 5px;
  background: var(--of-accent-soft);
  color: var(--of-accent);
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.quick-sub {
  display: block;
  width: 100%;
  overflow: hidden;
  font-size: 12px;
  color: var(--of-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
