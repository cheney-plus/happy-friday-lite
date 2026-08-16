<template>
  <div class="app-container" :class="{ 'is-share-view': isShareView }">
    <TabBar v-if="!isShareView" />
    <div class="main-body">
      <Sidebar v-if="!isShareView" />
      <main class="main-content">
        <div class="content-wrapper">
          <router-view v-slot="{ Component }">
            <keep-alive :max="8">
              <component v-if="!isHarnessRoute" :is="Component" :key="route.fullPath" />
            </keep-alive>
          </router-view>
          <DeepSeekHarness v-if="hasVisitedHarness" v-show="isHarnessRoute" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import Sidebar from '@/components/layout/Sidebar.vue';
import TabBar from '@/components/layout/TabBar.vue';
import DeepSeekHarness from '@/views/harness/DeepSeekHarness.vue';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
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
const { currentMode, initTheme, setTheme: applyThemeFromConfig } = useTheme();

// 分享视图：隐藏侧边栏/标签栏，全屏展示对话界面
const isShareView = computed(() => route.meta?.share === true || !isElectronEnvironment());
const isHarnessRoute = computed(() => route.name === 'harness');
const hasVisitedHarness = ref(false);

let unlistenConfig = null;

watch(
  () => route.name,
  (name) => {
    if (name === 'harness') hasVisitedHarness.value = true;
  },
  { immediate: true }
);

watch(
  () => route.fullPath,
  (newPath) => {
    if (!newPath || newPath === '/') return;

    const rootPath = '/' + newPath.split('/')[1];
    const menu = allMenuConfigs.find(m => m.path === rootPath);
    if (!menu) {
      // 处理文件查看器路由
      if (rootPath === '/file-viewer') {
        const params = new URLSearchParams(newPath.split('?')[1] || '');
        const filePath = params.get('path') || '';
        const fileName = params.get('name') || '文件';
        const fileType = params.get('type') || 'unknown';
        const existingTab = tabStore.openedTabs.find(t => t.id === `file-${filePath}`);
        if (!existingTab) {
          tabStore.addFileTab({ path: filePath, name: fileName, type: fileType });
        } else {
          tabStore.setActiveTab(existingTab.id);
          tabStore.updateTabFullPath(existingTab.id, newPath);
        }
      }
      return;
    }

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
        // 主题以本地 localStorage（useTheme）为权威源。
        // 旧版本未将 theme 持久化到 config，config.theme 可能停留在默认 'light'；
        // 若直接采用，后续 config-changed 广播（如切换头像）会用过期值覆盖当前主题。
        // 因此以本地主题为准同步 appStore，并在 config 不同步时回写纠正。
        if (config.theme !== currentMode.value) {
          config.theme = currentMode.value;
          try {
            await electronService.invoke('save-config', config);
          } catch (_e) {}
        }
        appStore.setTheme(currentMode.value);
        if (config.noteFimCompletion !== undefined) {
          appStore.setNoteFimCompletion(config.noteFimCompletion);
        }
        if (config.scheduleDefaultView) {
          appStore.setScheduleDefaultView(config.scheduleDefaultView);
        }
        appStore.setSidebarModules(config.sidebarModules);
        if (config.avatar !== undefined) {
          appStore.setAvatar(config.avatar);
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
      if (data.scheduleDefaultView) {
        appStore.setScheduleDefaultView(data.scheduleDefaultView);
      }
      if (data.sidebarModules !== undefined) {
        appStore.setSidebarModules(data.sidebarModules);
      }
      if (data.avatar !== undefined) {
        appStore.setAvatar(data.avatar);
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
  min-height: 0;
  overflow-y: auto;
  background-color: var(--bg-primary);
  border-radius: var(--content-radius);
  margin: 0;
}

/* 分享视图：全屏展示，去除内边距与圆角 */
.app-container.is-share-view .main-body {
  padding: 0;
}

.app-container.is-share-view .content-wrapper {
  border-radius: 0;
}
</style>
