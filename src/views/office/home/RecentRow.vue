<template>
  <li class="recent-row">
    <div class="recent-item" :class="{ missing: entry.missing }" @click="$emit('open', entry)">
      <span class="recent-icon">
        <span class="file-badge small" :style="{ background: badge.color }">{{ badge.ext }}</span>
      </span>
      <span v-if="renaming" class="recent-name rename-box" @click.stop>
        <input
          ref="renameInput"
          v-model="renameValue"
          class="rename-input"
          :placeholder="t('office.renamePlaceholder')"
          @keydown.enter.prevent="commitRename"
          @keydown.esc.prevent="cancelRename"
          @blur="commitRename"
        />
      </span>
      <span v-else class="recent-name" :title="entry.name">{{ entry.name }}</span>
      <span class="recent-path" :title="entry.dir">{{ entry.dir }}</span>
      <span class="recent-time">{{ formatModified(entry.mtimeMs) }}</span>
      <span class="recent-size">{{ formatSize(entry.sizeBytes) }}</span>
      <button
        class="star-btn"
        :class="{ starred: entry.starred }"
        :title="entry.starred ? t('office.unstar') : t('office.star')"
        @click.stop="$emit('toggle-star', entry)"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 1.9l1.9 3.85 4.25.62-3.07 3 .72 4.23L8 11.6l-3.8 2 .72-4.23-3.07-3 4.25-.62z"
            :fill="entry.starred ? '#f5a623' : 'none'"
            :stroke="entry.starred ? '#f5a623' : 'currentColor'"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <span class="recent-actions" @click.stop>
        <button class="more-btn" :title="t('office.moreActions')" @click="menuOpen = !menuOpen">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="3.2" cy="8" r="1.4" fill="currentColor" />
            <circle cx="8" cy="8" r="1.4" fill="currentColor" />
            <circle cx="12.8" cy="8" r="1.4" fill="currentColor" />
          </svg>
        </button>
        <teleport to="body">
          <div v-if="menuOpen" class="menu-mask" @click="menuOpen = false" />
        </teleport>
        <div v-if="menuOpen" class="row-menu" role="menu">
          <button role="menuitem" @click="act('open')">{{ t('office.menuOpen') }}</button>
          <button role="menuitem" @click="act('rename')">{{ t('office.menuRename') }}</button>
          <button role="menuitem" @click="act('reveal')">{{ t('office.menuReveal') }}</button>
          <button role="menuitem" @click="copyPath">{{ t('office.menuCopyPath') }}</button>
          <div class="row-menu-divider" />
          <button role="menuitem" @click="act('remove')">{{ t('office.menuRemove') }}</button>
        </div>
      </span>
    </div>
  </li>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { badgeMeta, formatModified, formatSize } from './fileMeta';

const props = defineProps({
  entry: { type: Object, required: true },
});
const emit = defineEmits(['open', 'toggle-star', 'remove', 'reveal', 'rename']);

const { t } = useI18n();
const menuOpen = ref(false);
const renaming = ref(false);
const renameValue = ref('');
const renameInput = ref(null);

const badge = computed(() => {
  const meta = badgeMeta(props.entry.type);
  const ext = props.entry.name.split('.').pop()?.toLowerCase() || meta.exts[0];
  return { color: meta.color, ext };
});

function act(kind) {
  menuOpen.value = false;
  if (kind === 'open') emit('open', props.entry);
  else if (kind === 'rename') startRename();
  else if (kind === 'reveal') emit('reveal', props.entry);
  else if (kind === 'remove') emit('remove', props.entry);
}

function startRename() {
  // 预填去掉扩展名的基名，便于直接输入新名字
  const dot = props.entry.name.lastIndexOf('.');
  renameValue.value = dot > 0 ? props.entry.name.slice(0, dot) : props.entry.name;
  renaming.value = true;
  nextTick(() => {
    renameInput.value?.focus();
    renameInput.value?.select();
  });
}

function cancelRename() {
  renaming.value = false;
  renameValue.value = '';
}

async function commitRename() {
  if (!renaming.value) return;
  const name = renameValue.value.trim();
  renaming.value = false;
  renameValue.value = '';
  if (!name || name === props.entry.name) return;
  emit('rename', { entry: props.entry, newName: name });
}

async function copyPath() {
  menuOpen.value = false;
  try {
    await navigator.clipboard.writeText(props.entry.path);
  } catch { /* ignore */ }
}
</script>

<style scoped lang="scss">
.recent-row + .recent-row {
  border-top: 1px solid var(--of-border-subtle);
}

.recent-item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 160px 110px 76px 24px 28px;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: var(--of-surface-subtle);

    .star-btn { opacity: 1; }
  }

  &.missing {
    .recent-name,
    .recent-path,
    .recent-icon { opacity: 0.55; }
  }
}

.recent-icon {
  display: flex;
  align-items: center;
}

/* 与 QuickCards.vue 的 .file-badge 基础样式保持一致（scoped 隔离，需各自声明） */
.file-badge.small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.recent-name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--of-text-primary);
}

.rename-box {
  min-width: 0;
}

.rename-input {
  width: 100%;
  padding: 3px 8px;
  border: 1px solid var(--of-accent);
  border-radius: 6px;
  outline: none;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--of-text-primary);
  background: var(--of-surface);
}

.recent-path {
  font-size: 12px;
  color: var(--of-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl;
  text-align: left;
}

.recent-time,
.recent-size {
  font-size: 12px;
  color: var(--of-text-secondary);
  white-space: nowrap;
}

.recent-size { text-align: right; }

.star-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--of-icon-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;

  &:hover {
    background: var(--of-bg-hover-subtle);
    color: #f5a623;
  }

  &.starred {
    opacity: 1;

    &:hover { color: #f5a623; }
  }
}

.recent-actions {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--of-icon-muted);
  cursor: pointer;

  &:hover {
    background: var(--of-bg-hover-subtle);
    color: var(--of-text-primary);
  }
}

.menu-mask {
  position: fixed;
  inset: 0;
  z-index: 8;
}

.row-menu {
  position: absolute;
  top: 26px;
  right: 0;
  z-index: 9;
  min-width: 160px;
  padding: 4px;
  border: 1px solid var(--of-border);
  border-radius: 10px;
  background: var(--of-surface);
  box-shadow: 0 8px 24px rgb(0 0 0 / 14%);

  button {
    display: block;
    width: 100%;
    padding: 7px 10px;
    border: none;
    border-radius: 6px;
    background: none;
    font-size: 13px;
    color: var(--of-text-primary);
    text-align: left;
    cursor: pointer;

    &:hover { background: var(--of-bg-hover); }
  }
}

.row-menu-divider {
  height: 1px;
  margin: 4px 6px;
  background: var(--of-border-subtle);
}
</style>
