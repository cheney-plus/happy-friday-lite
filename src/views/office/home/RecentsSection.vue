<template>
  <section class="recents">
    <div class="recents-toolbar">
      <div class="filter-pills" role="tablist">
        <button
          v-for="f in filters"
          :key="f.key"
          class="filter-pill"
          :class="{ active: filter === f.key }"
          @click="$emit('update:filter', f.key)"
        >
          {{ f.label }}
        </button>
      </div>
      <div class="recents-heading">
        <span class="section-label">{{ t('office.secRecent') }}</span>
        <span class="file-count">{{ t('office.filesCount', { n: entries.length }) }}</span>
      </div>
    </div>

    <p v-if="entries.length === 0" class="empty">
      {{ filter === 'all' ? t('office.emptyRecent') : t('office.emptyFiltered') }}
    </p>
    <div v-else class="recent-table">
      <div class="recent-columns">
        <span class="col-name">{{ t('office.colName') }}</span>
        <span class="col-path">{{ t('office.colLocation') }}</span>
        <span>{{ t('office.colModified') }}</span>
        <span class="col-size">{{ t('office.colSize') }}</span>
        <span />
        <span />
      </div>
      <ul class="recent-list">
        <RecentRow
          v-for="entry in entries"
          :key="entry.path"
          :entry="entry"
          @open="$emit('open', $event)"
          @toggle-star="$emit('toggle-star', $event)"
          @remove="$emit('remove', $event)"
          @reveal="$emit('reveal', $event)"
        />
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import RecentRow from './RecentRow.vue';

defineProps({
  entries: { type: Array, required: true },
  filter: { type: String, required: true },
});
defineEmits(['update:filter', 'open', 'toggle-star', 'remove', 'reveal']);

const { t } = useI18n();

const filters = computed(() => [
  { key: 'all', label: t('office.filterAll') },
  { key: 'docs', label: t('office.filterDocs') },
  { key: 'sheets', label: t('office.filterSheets') },
  { key: 'slides', label: t('office.filterSlides') },
  { key: 'pdf', label: t('office.filterPdf') },
]);
</script>

<style scoped lang="scss">
.recents-toolbar {
  position: sticky;
  top: -28px;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0 14px;
  background: var(--of-bg-content);
}

.recents-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  transform: translateY(2px);
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--of-text-tertiary);
}

.file-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--of-text-tertiary);
}

.filter-pills {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 3px;
  border-radius: 10px;
  background: var(--of-checkbox-bg);
  flex-shrink: 0;
}

.filter-pill {
  padding: 7px 15px;
  border: none;
  border-radius: 8px;
  background: none;
  font: inherit;
  font-size: 14px;
  color: var(--of-text-secondary);
  cursor: pointer;
  white-space: nowrap;

  &:hover { color: var(--of-text-primary); }

  &.active {
    background: var(--of-surface);
    color: var(--of-text-primary);
    font-weight: 600;
    box-shadow: var(--of-shadow-pill);
  }
}

.empty {
  color: var(--of-text-muted);
  font-size: 14px;
  padding: 32px 0;
  text-align: center;
}

.recent-table {
  border: 1px solid var(--of-border);
  border-radius: 12px;
  background: var(--of-surface);
}

.recent-columns {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 160px 110px 76px 24px 28px;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--of-border-subtle);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--of-text-secondary);

  .col-name { grid-column: 1 / 3; }
  .col-size { text-align: right; }
}

.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
