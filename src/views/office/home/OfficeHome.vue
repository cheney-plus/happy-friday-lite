<template>
  <div class="office-home" @dragenter.prevent="draggingFiles = true" @dragover.prevent="draggingFiles = true" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
    <div v-if="draggingFiles" class="drop-hint">{{ t('office.dropToOpen') }}</div>
    <HomeHero />
    <QuickCards @new="type => $emit('new-doc', type)" @open-local="$emit('open-local')" />
    <RecentsSection
      v-model:filter="filter"
      :entries="filteredEntries"
      @open="entry => $emit('open-recent', entry)"
      @toggle-star="toggleStar"
      @remove="removeRecent"
      @delete="deleteRecent"
      @reveal="reveal"
      @rename="renameRecent"
    />
  </div>
  <Teleport to="body">
    <div v-if="pendingDelete" class="delete-mask" @click.self="cancelDelete">
      <section class="delete-dialog" role="dialog" aria-modal="true" :aria-label="t('office.deleteTitle')">
        <div class="delete-icon" aria-hidden="true">!</div>
        <div class="delete-copy"><h2>{{ t('office.deleteTitle') }}</h2><p>{{ t('office.deleteConfirm', { name: pendingDelete.name || pendingDelete.path }) }}</p><span>{{ t('office.deleteHint') }}</span></div>
        <div class="delete-actions"><button type="button" class="delete-cancel" @click="cancelDelete">{{ t('office.cancel') }}</button><button type="button" class="delete-submit" @click="confirmDelete">{{ t('office.deleteAction') }}</button></div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import HomeHero from './HomeHero.vue';
import QuickCards from './QuickCards.vue';
import RecentsSection from './RecentsSection.vue';
import { useOfficeHome } from './useOfficeHome';

const emit = defineEmits(['new-doc', 'open-local', 'open-recent', 'open-file-path']);
const { t } = useI18n();
const api = window.electronAPI;

const {
  filter,
  filteredEntries,
  loadRecents,
  toggleStar,
  removeRecent,
  deleteRecent,
  reveal,
  renameRecent,
  pendingDelete,
  cancelDelete,
  confirmDelete,
} = useOfficeHome();

const draggingFiles = ref(false);
let dragLeaveTimer;
function onDragLeave() {
  clearTimeout(dragLeaveTimer);
  dragLeaveTimer = setTimeout(() => { draggingFiles.value = false; }, 80);
}
async function onDrop(event) {
  draggingFiles.value = false;
  clearTimeout(dragLeaveTimer);
  const file = Array.from(event.dataTransfer?.files || [])[0];
  if (!file) return;
  let filePath = file.path;
  if (!filePath && api?.getPathForFile) {
    try { filePath = api.getPathForFile(file); } catch { /* ignore */ }
  }
  if (filePath) emit('open-file-path', filePath);
}

onMounted(loadRecents);

defineExpose({ refresh: loadRecents });
</script>

<style scoped lang="scss">
// 上游 home.css 的设计 token → 映射到本产品的主题变量（深浅色跟随应用主题）
.office-home {
  --of-surface: var(--bg-primary, #ffffff);
  --of-surface-subtle: var(--bg-tertiary, #eceff3);
  --of-bg-content: var(--bg-primary, #ffffff);
  --of-bg-hover: var(--bg-tertiary, #eceff3);
  --of-bg-hover-subtle: var(--bg-tertiary, #eceff3);
  --of-checkbox-bg: var(--bg-tertiary, #ececec);
  --of-border: var(--border-color, #e5e7eb);
  --of-border-subtle: var(--border-color, #f0f0f0);
  --of-border-hover: var(--border-color, #d1d5db);
  --of-text-primary: var(--text-primary, #1f2937);
  --of-text-secondary: var(--text-secondary, #6b7280);
  --of-text-tertiary: var(--text-secondary, #9ca3af);
  --of-text-muted: var(--text-secondary, #9ca3af);
  --of-icon-muted: var(--text-secondary, #9ca3af);
  --of-accent: #0f7fff;
  --of-accent-soft: var(--bg-tertiary, #eaf0fd);
  --of-shadow-pill: 0 1px 2px rgb(0 0 0 / 8%);

  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 28px 36px 40px;
  overflow-y: auto;
  background: var(--of-bg-content);
  position: relative;
}

.drop-hint {
  position: absolute;
  inset: 12px;
  z-index: 8;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: color-mix(in srgb, var(--of-surface) 80%, transparent);
  color: var(--of-text-secondary);
  font-size: 14px;
  font-weight: 500;
}
.delete-mask { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 24px; background: rgb(0 0 0 / 32%); backdrop-filter: blur(4px); }
.delete-dialog { width: min(380px, 100%); padding: 20px 22px 18px; border: 1px solid var(--border-color, #e5e7eb); border-radius: 14px; background: var(--bg-primary, #fff); box-shadow: 0 16px 48px rgb(0 0 0 / 18%); }
.delete-icon { display: grid; width: 34px; height: 34px; place-items: center; margin-bottom: 14px; border-radius: 10px; background: rgb(220 38 38 / 10%); color: #dc2626; font-size: 19px; font-weight: 800; }
.delete-copy h2 { margin: 0 0 12px; color: var(--text-primary, #111827); font-size: 15px; font-weight: 600; }
.delete-copy p { margin: 0; color: var(--text-primary, #374151); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.delete-copy span { display: block; margin-top: 8px; color: var(--text-secondary, #6b7280); font-size: 12px; }
.delete-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.delete-actions button { padding: 7px 16px; border-radius: 8px; font: inherit; font-size: 13px; cursor: pointer; }
.delete-cancel { border: 1px solid var(--border-color, #d1d5db); background: none; color: var(--text-primary, #374151); }
.delete-submit { border: 1px solid #dc2626; background: #dc2626; color: #fff; }
.delete-cancel:hover { background: var(--bg-tertiary, #f3f4f6); }
.delete-submit:hover { background: #b91c1c; }
</style>
