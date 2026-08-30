<template>
  <div class="module-settings-page">
    <button class="back-btn" :aria-label="t('note.back')" @click="goBack">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>

    <h1 class="page-title">{{ t('settings.sidebarModulesTitle') }}</h1>
    <p class="page-desc">{{ t('settings.sidebarModulesDesc') }}</p>

    <div class="settings-content">
      <section class="preview-panel">
        <div class="preview-rail">
          <div class="preview-avatar">
            <img :src="avatarSrc" alt="" />
          </div>
          <div class="preview-menu">
            <button
              v-for="item in sidebarMenuConfig"
              :key="item.key"
              type="button"
              class="preview-item"
              :class="[`preview-item-${item.key}`, { off: !isEnabled(item.key), highlight: highlightedKey === item.key }]"
              :aria-pressed="isEnabled(item.key)"
              :aria-label="t(`settings.${item.key}Module`)"
              :title="t(`settings.${item.key}Module`)"
              @click="toggleModule(item.key, !isEnabled(item.key))"
              @mouseenter="highlightedKey = item.key"
              @mouseleave="highlightedKey = ''"
            >
              <component :is="item.iconComponent" :size="18" :stroke-width="1.7" />
            </button>
          </div>
          <div class="preview-bottom">
            <button
              v-for="item in utilityItems"
              :key="item.key"
              type="button"
              class="preview-item"
              :class="[`preview-item-${item.key}`, { off: !isEnabled(item.key), highlight: highlightedKey === item.key }]"
              :aria-pressed="isEnabled(item.key)"
              :aria-label="t(`settings.${item.key}Module`)"
              :title="t(`settings.${item.key}Module`)"
              @click="toggleModule(item.key, !isEnabled(item.key))"
              @mouseenter="highlightedKey = item.key"
              @mouseleave="highlightedKey = ''"
            >
              <component :is="item.iconComponent" :size="18" :stroke-width="1.7" />
            </button>
            <div class="preview-item preview-item-settings locked" :title="t('settings.settingsAlwaysVisible')">
              <Settings :size="18" :stroke-width="1.7" />
            </div>
          </div>
        </div>

        <div class="preview-meta">
          <div class="preview-meta-top">
            <span class="preview-kicker">{{ t('settings.sidebarPreviewTitle') }}</span>
            <span class="preview-count">{{ t('settings.sidebarModulesHint', { count: enabledModuleCount, total: sidebarModuleCount }) }}</span>
          </div>
          <p class="preview-hint">{{ t('settings.sidebarPreviewHint') }}</p>
          <div class="preview-chips">
            <button
              v-for="item in sidebarModuleConfig"
              :key="item.key"
              type="button"
              class="module-chip"
              :class="[`module-chip-${item.key}`, { off: !isEnabled(item.key), highlight: highlightedKey === item.key }]"
              :aria-pressed="isEnabled(item.key)"
              @click="toggleModule(item.key, !isEnabled(item.key))"
              @mouseenter="highlightedKey = item.key"
              @mouseleave="highlightedKey = ''"
            >
              <component :is="item.iconComponent" :size="14" :stroke-width="1.8" />
              <span>{{ t(`settings.${item.key}Module`) }}</span>
            </button>
          </div>
          <div class="preview-actions">
            <button v-if="hasHiddenModules" class="action-btn" type="button" @click="enableAll">
              {{ t('settings.enableAllModules') }}
            </button>
            <span v-else class="all-on-badge">
              <Check :size="14" :stroke-width="2.4" />
              {{ t('settings.allModulesEnabled') }}
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Check, Settings } from 'lucide-vue-next';
import { useAppStore } from '@/store';
import { sidebarMenuConfig, sidebarBottomMenuConfig, sidebarModuleConfig } from '@/config/menu';
import { electronService } from '@/services/electron';

const router = useRouter();
const appStore = useAppStore();
const { t } = useI18n();

const highlightedKey = ref('');
const avatarSrc = `${import.meta.env.BASE_URL}images/icon.png`;
const utilityItems = sidebarBottomMenuConfig.filter((item) => item.key !== 'settings');
const sidebarModuleCount = sidebarModuleConfig.length;

const enabledModuleCount = computed(() => Object.values(appStore.sidebarModules).filter(Boolean).length);
const hasHiddenModules = computed(() => Object.values(appStore.sidebarModules).some((enabled) => !enabled));
const isEnabled = (key) => appStore.sidebarModules[key] !== false;

const persistModules = async (nextModules, previousModules) => {
  appStore.setSidebarModules(nextModules);
  try {
    const config = await electronService.invoke('get-config');
    if (!config) return;
    config.sidebarModules = nextModules;
    const result = await electronService.invoke('save-config', config);
    if (result?.success === false) throw new Error(result.error || 'Failed to save configuration');
  } catch (_error) {
    appStore.setSidebarModules(previousModules);
  }
};

const toggleModule = (key, enabled) => {
  if (isEnabled(key) === enabled) return;
  const previousModules = { ...appStore.sidebarModules };
  persistModules({ ...previousModules, [key]: enabled }, previousModules);
};

const enableAll = () => {
  const previousModules = { ...appStore.sidebarModules };
  const nextModules = Object.keys(previousModules).reduce((modules, key) => ({ ...modules, [key]: true }), {});
  persistModules(nextModules, previousModules);
};

const goBack = () => router.push('/settings');
</script>

<style scoped>
.module-settings-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 40px 48px;
  position: relative;
}

.back-btn {
  position: absolute;
  top: 12px;
  left: 16px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  transition: background-color 0.15s;
  border-radius: 6px;
}

.back-btn:hover {
  background-color: var(--bg-hover);
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
  max-width: 720px;
  width: 100%;
  text-align: left;
}

.page-desc {
  margin: 0 0 22px;
  max-width: 720px;
  width: 100%;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.5;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
  width: 100%;
}

.preview-panel {
  display: flex;
  align-items: stretch;
  gap: 18px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.preview-rail {
  width: 52px;
  flex: 0 0 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px var(--border-color);
}

.preview-avatar {
  width: 26px;
  height: 26px;
  margin-bottom: 12px;
  border-radius: 50%;
  overflow: hidden;
}

.preview-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-menu,
.preview-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.preview-menu {
  flex: 1;
}

.preview-bottom {
  padding-top: 8px;
}

.preview-item {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 9px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.15s, opacity 0.18s, color 0.15s;
}

.preview-item:hover,
.preview-item.highlight {
  background: var(--bg-hover);
}

.preview-item.off {
  opacity: 0.28;
}

.preview-item.off:hover,
.preview-item.off.highlight {
  opacity: 0.7;
}

.preview-item.locked {
  cursor: default;
  opacity: 0.9;
}

.preview-item-note,
.module-chip-note { color: #2563eb; }
.preview-item-knowledge,
.module-chip-knowledge { color: #0d9488; }
.preview-item-schedule,
.module-chip-schedule { color: #d97706; }
.preview-item-automation,
.module-chip-automation { color: #4f46e5; }
.preview-item-harness,
.module-chip-harness { color: #7c3aed; }
.preview-item-history,
.module-chip-history { color: #b45309; }
.preview-item-settings { color: var(--text-secondary); }

.preview-meta {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding: 4px 4px 4px 0;
}

.preview-meta-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.preview-kicker {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.preview-count {
  color: var(--text-tertiary);
  font-size: 12px;
  white-space: nowrap;
}

.preview-hint {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.preview-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.module-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--bg-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.15s, opacity 0.18s, border-color 0.15s;
}

.module-chip:hover,
.module-chip.highlight {
  background: var(--bg-hover);
}

.module-chip.off {
  opacity: 0.45;
}

.module-chip.off:hover,
.module-chip.off.highlight {
  opacity: 0.8;
}

.preview-actions {
  display: flex;
  align-items: center;
  min-height: 28px;
}

.action-btn {
  background-color: var(--text-primary);
  color: var(--bg-primary);
  border: none;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  font-family: inherit;
  transition: opacity 0.15s;
}

.action-btn:hover {
  opacity: 0.85;
}

.all-on-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #059669;
  font-size: 13px;
  font-weight: 500;
}

@media (max-width: 620px) {
  .module-settings-page {
    padding: 28px 20px 40px;
  }

  .page-title {
    font-size: 21px;
  }

  .preview-panel {
    gap: 14px;
    padding: 12px;
  }

  .preview-meta-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
