<template>
  <div class="module-settings-page">
    <header class="page-header">
      <button class="back-btn" :aria-label="t('note.back')" @click="goBack">
        <ChevronLeft :size="20" :stroke-width="2" />
      </button>
      <div class="page-heading">
        <h1>{{ t('settings.sidebarModulesTitle') }}</h1>
        <p>{{ t('settings.sidebarModulesDesc') }}</p>
      </div>
      <button v-if="hasHiddenModules" class="enable-all-btn" @click="enableAll">
        <Check :size="16" :stroke-width="2.2" />
        {{ t('settings.enableAllModules') }}
      </button>
    </header>

    <section v-for="group in moduleGroups" :key="group.title" class="module-section">
      <h2>{{ t(group.title) }}</h2>
      <div class="module-list">
        <article v-for="item in group.items" :key="item.key" class="module-row" :class="{ disabled: !isEnabled(item.key) }">
          <div class="module-icon" :class="`module-icon-${item.key}`">
            <component :is="item.iconComponent" :size="20" :stroke-width="1.8" />
          </div>
          <div class="module-copy">
            <h3>{{ t(`settings.${item.key}Module`) }}</h3>
            <p>{{ t(`settings.${item.key}ModuleDesc`) }}</p>
          </div>
          <label class="toggle-switch" :aria-label="t(`settings.${item.key}Module`)">
            <input type="checkbox" :checked="isEnabled(item.key)" @change="toggleModule(item.key, $event.target.checked)" />
            <span class="toggle-slider"></span>
          </label>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Check, ChevronLeft } from 'lucide-vue-next';
import { useAppStore } from '@/store';
import { sidebarMenuConfig, sidebarBottomMenuConfig } from '@/config/menu';
import { electronService } from '@/services/electron';

const router = useRouter();
const appStore = useAppStore();
const { t } = useI18n();

const moduleGroups = computed(() => [
  { title: 'settings.sidebarPrimary', items: sidebarMenuConfig },
  { title: 'settings.sidebarUtilities', items: sidebarBottomMenuConfig.filter((item) => item.key !== 'settings') }
]);

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
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 40px 48px;
}

.page-header {
  min-height: 62px;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 26px;
}

.back-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 0;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: background-color .15s, border-color .15s, transform .15s;
}

.back-btn:hover {
  background: var(--bg-hover);
  border-color: var(--text-tertiary);
  transform: translateX(-1px);
}

.page-heading {
  min-width: 0;
  flex: 1;
}

.page-heading h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.25;
}

.page-heading p {
  margin: 5px 0 0;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.45;
}

.enable-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 7px 11px;
  color: #059669;
  background: var(--accent-light);
  border: 1px solid transparent;
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color .15s, border-color .15s;
}

.enable-all-btn:hover {
  background: rgba(16, 185, 129, .18);
  border-color: rgba(5, 150, 105, .22);
}

.module-section + .module-section {
  margin-top: 22px;
}

.module-section h2 {
  margin: 0 0 10px;
  color: var(--text-tertiary);
  font-size: 14px;
  font-weight: 400;
}

.module-list {
  overflow: hidden;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.module-row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 76px;
  padding: 13px 18px;
  border-bottom: 1px solid var(--border-color);
  transition: background-color .18s, opacity .18s;
}

.module-row:last-child { border-bottom: 0; }
.module-row:hover { background: var(--bg-hover); }
.module-row.disabled { opacity: .56; }

.module-icon {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.module-icon-schedule { color: #0f766e; }
.module-icon-automation { color: #2563eb; }
.module-icon-harness { color: #7c3aed; }
.module-icon-history { color: #b45309; }

.module-copy { min-width: 0; flex: 1; }
.module-copy h3 { margin: 0; color: var(--text-primary); font-size: 14px; font-weight: 500; }
.module-copy p { margin: 4px 0 0; color: var(--text-tertiary); font-size: 12px; line-height: 1.4; }

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex: 0 0 auto;
}

.toggle-switch input { width: 0; height: 0; opacity: 0; }
.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--text-tertiary);
  border-radius: 999px;
  cursor: pointer;
  transition: background-color .2s;
}

.toggle-slider::before {
  position: absolute;
  bottom: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  content: '';
  background: var(--bg-primary);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .15);
  transition: transform .2s;
}

.toggle-switch input:checked + .toggle-slider { background: #10b981; }
.toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); }
.toggle-switch input:focus-visible + .toggle-slider { outline: 2px solid var(--accent-color); outline-offset: 2px; }

@media (max-width: 620px) {
  .module-settings-page { padding: 24px 20px 36px; }
  .page-header { align-items: flex-start; }
  .page-heading h1 { font-size: 21px; }
  .enable-all-btn { margin-top: 1px; padding: 7px; }
  .enable-all-btn svg { margin: 0; }
  .enable-all-btn { font-size: 0; }
  .module-row { padding: 13px 14px; }
}
</style>
