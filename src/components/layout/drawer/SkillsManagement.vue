<template>
  <div class="skills-management">
    <!-- Header (fixed, no scroll) -->
    <div class="panel-header">
      <h2 class="section-title">{{ t('drawer.skills.title') }}</h2>
      <div class="header-actions">
        <button class="add-skill-btn" :disabled="busy" @click="handleAddSkill">
          <Plus :size="14" :stroke-width="2" />
          {{ t('drawer.skills.addSkill') }}
        </button>
        <button class="close-btn" @click="emit('close')">
          <X :size="16" :stroke-width="2" />
        </button>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="panel-body">
      <div class="skills-section">
        <h3 class="subsection-title">{{ t('drawer.skills.installed') }}</h3>
        <div class="skills-grid">
          <div v-for="skill in skills" :key="skill.id" class="skill-card">
            <div class="skill-name">{{ skill.name }}</div>
            <div
              class="skill-desc"
              @mouseenter="showDescTooltip($event, skill.description)"
              @mouseleave="hideDescTooltip"
            >{{ skill.description }}</div>
            <button
              class="skill-delete-btn"
              :title="t('drawer.skills.delete')"
              @click.stop="handleDelete(skill)"
            >
              <Trash2 :size="12" :stroke-width="2" />
            </button>
          </div>
          <div v-if="!loading && skills.length === 0" class="empty-hint">
            {{ t('drawer.skills.emptyInstalled') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Transient notice -->
    <Transition name="menu-fade">
      <div v-if="notice" class="notice" :class="notice.type">{{ notice.text }}</div>
    </Transition>

    <!-- Full-description hover tooltip (fixed → escapes scroll/overflow) -->
    <div
      v-if="tooltip.visible"
      class="desc-tooltip"
      :style="tooltip.style"
    >{{ tooltip.text }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Plus, Trash2, X } from 'lucide-vue-next';

const { t } = useI18n();

const emit = defineEmits(['close']);

const skills = ref([]);
const loading = ref(false);
const busy = ref(false);
const notice = ref(null);
let noticeTimer = null;

// 描述悬浮 tooltip：使用 fixed 定位以逃出滚动容器的 overflow 裁剪
const tooltip = ref({ visible: false, text: '', style: {} });

const showNotice = (text, type = 'info') => {
  notice.value = { text, type };
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = null;
  }, 2800);
};

const showDescTooltip = (e, text) => {
  if (!text) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const maxW = 320;
  // 水平：尽量贴左，越界则右移
  let x = rect.left;
  if (x + maxW > window.innerWidth - 8) {
    x = Math.max(8, window.innerWidth - 8 - maxW);
  }
  // 垂直：选择上下空间较大的一侧展开（tooltip 不限高、无滚动条，
  // 鼠标移入即消失，故不裁剪、不滚动，整段展示）
  const spaceBelow = window.innerHeight - rect.bottom - 6;
  const spaceAbove = rect.top - 6;
  let style;
  if (spaceBelow >= spaceAbove) {
    style = { left: x + 'px', top: Math.max(8, rect.bottom + 6) + 'px' };
  } else {
    // 上方展开：用 bottom 锚定，向上生长
    style = { left: x + 'px', bottom: Math.max(8, window.innerHeight - rect.top + 6) + 'px' };
  }
  tooltip.value = { visible: true, text, style };
};

const hideDescTooltip = () => {
  tooltip.value = { ...tooltip.value, visible: false };
};

const loadSkills = async () => {
  loading.value = true;
  try {
    const list = await window.electronAPI?.invoke('agent-list-skills');
    skills.value = Array.isArray(list) ? list : [];
  } catch (e) {
    console.error('load skills failed', e);
    skills.value = [];
  } finally {
    loading.value = false;
  }
};

const handleAddSkill = async () => {
  if (busy.value) return;
  busy.value = true;
  try {
    const res = await window.electronAPI?.invoke('agent-import-skill');
    if (!res) return;
    if (res.success) {
      await loadSkills();
    } else if (!res.canceled) {
      const msg = res.duplicate
        ? t('drawer.skills.duplicate')
        : `${t('drawer.skills.importFailed')}: ${res.error || ''}`;
      showNotice(msg, 'error');
    }
  } catch (e) {
    showNotice(`${t('drawer.skills.importFailed')}: ${e?.message || e}`, 'error');
  } finally {
    busy.value = false;
  }
};

const handleDelete = async (skill) => {
  try {
    const res = await window.electronAPI?.invoke('agent-delete-skill', { id: skill.id });
    if (!res) return;
    if (res.success) {
      await loadSkills();
    } else if (!res.canceled) {
      showNotice(`${t('drawer.skills.deleteFailed')}: ${res.error || ''}`, 'error');
    }
  } catch (e) {
    showNotice(`${t('drawer.skills.deleteFailed')}: ${e?.message || e}`, 'error');
  }
};

onMounted(() => {
  loadSkills();
});

onUnmounted(() => {
  clearTimeout(noticeTimer);
});
</script>

<style scoped>
.skills-management {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
}

/* Fixed header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px 7px;
  flex-shrink: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.add-skill-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 5px;
  font-size: 11px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s, border-color 0.15s;
}

.add-skill-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.add-skill-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* Scrollable body */
.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.skills-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.subsection-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
}

/* Uniform 2-column grid */
.skills-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

/* Uniform card: fixed height so every card is the same size */
.skill-card {
  position: relative;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  height: 96px;
  box-sizing: border-box;
  cursor: default;
}

.skill-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  /* 单行 + 省略号，保证高度一致 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 给右上角删除按钮留出空间 */
  padding-right: 20px;
}

.skill-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Small delete button, top-right */
.skill-delete-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  opacity: 0.5;
  transition: opacity 0.15s, background-color 0.15s, color 0.15s;
}

.skill-card:hover .skill-delete-btn {
  opacity: 1;
}

.skill-delete-btn:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.15s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
}

.empty-hint {
  grid-column: 1 / -1;
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 10px 0;
}

/* Transient notice */
.notice {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  padding: 7px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  color: var(--text-primary);
  z-index: 20;
}

.notice.error {
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}

/* Full-description hover tooltip */
.desc-tooltip {
  position: fixed;
  max-width: 320px;
  padding: 8px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: normal;
  word-break: break-word;
  pointer-events: none;
  z-index: 9999;
}

[data-theme='dark'] .notice,
[data-theme='dark'] .desc-tooltip {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}
</style>
