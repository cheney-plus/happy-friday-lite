<template>
  <div class="app-container">
    <TabBar />
    <div class="main-body">
      <Sidebar />
      <main class="main-content">
        <div class="content-wrapper">
          <router-view v-slot="{ Component }">
            <keep-alive>
              <component :is="Component" :key="route.fullPath" />
            </keep-alive>
          </router-view>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import Sidebar from '@/components/layout/Sidebar.vue';
import TabBar from '@/components/layout/TabBar.vue';
import { onMounted, onUnmounted, watch } from 'vue';
import { useAppStore, useTabStore } from '@/store';
import { electronService } from '@/services/electron';
import { setI18nLanguage } from '@/i18n';
import { useRoute, useRouter } from 'vue-router';
import { allMenuConfigs, isElectronEnvironment } from '@/config/menu';
import { useTheme } from '@/utils/theme';

const appStore = useAppStore();
const tabStore = useTabStore();
const route = useRoute();
const router = useRouter();
const { initTheme, setTheme: applyThemeFromConfig } = useTheme();

let unlistenConfig = null;

watch(
  () => route.fullPath,
  (newPath) => {
    if (!newPath || newPath === '/') return;

    const rootPath = '/' + newPath.split('/')[1];
    const menu = allMenuConfigs.find(m => m.path === rootPath);
    if (!menu) return;

    const activeTab = tabStore.openedTabs.find(t => t.id === tabStore.activeTabId);
    if (activeTab) {
      const activeRootPath = '/' + activeTab.path.split('/')[1];
      if (activeRootPath === rootPath) {
        tabStore.updateTabFullPath(activeTab.id, newPath);
        return;
      }
    }

    if (rootPath === '/friday') {
      const tab = tabStore.addFridayTab();
      if (newPath !== '/friday') {
        tabStore.updateTabFullPath(tab.id, newPath);
      }
      router.replace(newPath !== '/friday' ? newPath : tab.fullPath);
    } else {
      tabStore.addTab({
        id: newPath,
        path: newPath,
        fullPath: newPath,
        i18nKey: menu.i18nKey,
        icon: menu.icon
      });
    }
  },
  { immediate: true }
);

onMounted(async () => {
  initTheme();

  if (isElectronEnvironment()) {
    try {
      const config = await electronService.invoke('get-config');
      if (config) {
        if (config.language) {
          appStore.setLanguage(config.language);
          setI18nLanguage(config.language);
        }
        if (config.theme) {
          appStore.setTheme(config.theme);
        }
        if (config.noteFimCompletion !== undefined) {
          appStore.setNoteFimCompletion(config.noteFimCompletion);
        }
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }

    unlistenConfig = electronService.listen('config-changed', (event) => {
      const data = event.payload;
      if (data.language) {
        appStore.setLanguage(data.language);
        setI18nLanguage(data.language);
      }
      if (data.theme) {
        appStore.setTheme(data.theme);
        applyThemeFromConfig(data.theme);
      }
      if (data.noteFimCompletion !== undefined) {
        appStore.setNoteFimCompletion(data.noteFimCompletion);
      }
    });
  } else {
    console.log('Running in browser mode, Electron APIs are disabled.');
  }
});

onUnmounted(() => {
  if (unlistenConfig) {
    unlistenConfig();
    unlistenConfig = null;
  }
});
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--bg-secondary);
}

.main-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 0 6px 6px 6px;
}

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content-wrapper {
  flex: 1;
  overflow-y: auto;
  background-color: var(--bg-primary);
  border-radius: var(--content-radius);
  margin: 0;
}
</style>
