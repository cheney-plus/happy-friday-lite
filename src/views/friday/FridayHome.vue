<template>
  <div class="friday-home">
    <div class="friday-content">
      <div class="logo-section">
        <div class="logo-main">
          <img :src="logoImage" alt="Friday" class="logo-image" draggable="false" />
          <img :src="happyFridayTextImage" alt="Happy Friday" class="happy-friday-text-image" draggable="false" />
        </div>
        <p class="logo-subtitle">{{ t('friday.greeting') }}</p>
      </div>

      <div class="input-section">
        <FridayComposer
          :model-binding="composerBinding"
          variant="home"
          @send="handleSend"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore, useFridayStore, useTabStore } from '@/store';
import { NEW_SESSION_ID, fridayChatLocation, getFridayTabId } from '@/utils/fridayNavigation';
import FridayComposer from '@/views/friday/components/FridayComposer.vue';
import { loadModelConfig } from '@/views/friday/composables/useModelCatalog';

// FridayLayout 会注入本 Tab 自己的路由，避免多 Tab 场景下误读其它 Tab 的全局路由
const injectedRoute = inject('fridayRoute', null);
const injectedNavigate = inject('fridayNavigate', null);
const route = injectedRoute || useRoute();
const router = useRouter();
const navigate = injectedNavigate || ((location) => router.push(location));
const { t } = useI18n();
const appStore = useAppStore();
const fridayStore = useFridayStore();
const tabStore = useTabStore();
const inputText = ref('');
// 输入文本通过稳定对象交给输入框组件承载，页面模板不读取其值
const composerBinding = { ref: inputText };

const isDark = computed(() => appStore.theme === 'dark');
const logoImage = new URL('@/assets/images/friday-w.webp', import.meta.url).href;
const happyFridayTextImage = computed(() => (
  isDark.value
    ? new URL('@/assets/images/HPTEXT-w.png', import.meta.url).href
    : new URL('@/assets/images/HPTEXT-b.png', import.meta.url).href
));

function handleSend(payload) {
  if (!loadModelConfig(payload.modelId)) {
    window.alert(t('friday.modelRequired'));
    router.push('/settings/model');
    return;
  }
  const tabId = getFridayTabId(route, tabStore);
  fridayStore.setPendingLaunch(tabId, payload);
  inputText.value = '';
  navigate(fridayChatLocation(route, { sessionId: NEW_SESSION_ID }, tabStore));
}
</script>

<style scoped>
.friday-home {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: 40px 20px;
  background-color: var(--bg-primary);
  overflow: hidden;
}

.friday-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  max-width: 800px;
  width: 100%;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.logo-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-image {
  height: 100px;
  width: auto;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.happy-friday-text-image {
  width: min(360px, 88vw);
  height: auto;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.logo-subtitle {
  font-size: 20px;
  font-weight: 400;
  color: var(--text-primary);
  letter-spacing: 3px;
  margin: 0;
}

.input-section {
  width: 100%;
}
</style>
