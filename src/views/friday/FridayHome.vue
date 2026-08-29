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
          v-model="inputText"
          variant="home"
          @send="handleSend"
        />
      </div>

      <div class="features-section">
        <div
          v-for="feature in features"
          :key="feature.id"
          class="feature-card"
        >
          <div class="feature-icon-wrap" :style="{ '--feature-color': feature.color }">
            <div class="feature-icon" v-html="feature.icon"></div>
          </div>
          <span class="feature-label">{{ feature.label }}</span>
          <span class="feature-desc">{{ feature.desc }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAppStore, useFridayStore } from '@/store';
import { NEW_SESSION_ID, fridayChatLocation, getFridayTabId } from '@/utils/fridayNavigation';
import FridayComposer from '@/views/friday/components/FridayComposer.vue';
import { loadModelConfig } from '@/views/friday/composables/useModelCatalog';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const appStore = useAppStore();
const fridayStore = useFridayStore();
const inputText = ref('');

const isDark = computed(() => appStore.theme === 'dark');
const logoImage = new URL('@/assets/images/friday-w.png', import.meta.url).href;
const happyFridayTextImage = computed(() => (
  isDark.value
    ? new URL('@/assets/images/HPTEXT-w.png', import.meta.url).href
    : new URL('@/assets/images/HPTEXT-b.png', import.meta.url).href
));

const features = computed(() => [
  {
    id: 'office',
    label: t('friday.featureOffice'),
    desc: t('friday.featureOfficeDesc'),
    color: '#8b5cf6',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'
  },
  {
    id: 'document',
    label: t('friday.featureDocument'),
    desc: t('friday.featureDocumentDesc'),
    color: '#3b82f6',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
  },
  {
    id: 'writing',
    label: t('friday.featureWriting'),
    desc: t('friday.featureWritingDesc'),
    color: '#10b981',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
  },
  {
    id: 'knowledge',
    label: t('friday.featureKnowledge'),
    desc: t('friday.featureKnowledgeDesc'),
    color: '#f59e0b',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="12" cy="10" r="2.5"/><line x1="14" y1="12" x2="16" y2="14"/></svg>'
  },
  {
    id: 'schedule',
    label: t('friday.featureSchedule'),
    desc: t('friday.featureScheduleDesc'),
    color: '#ec4899',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
  }
]);

function handleSend(payload) {
  if (!loadModelConfig(payload.modelId)) {
    window.alert(t('friday.modelRequired'));
    router.push('/settings/model');
    return;
  }
  fridayStore.setPendingLaunch(getFridayTabId(route), payload);
  router.push(fridayChatLocation(route, { sessionId: NEW_SESSION_ID }));
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

.features-section {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}

.feature-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  min-width: 100px;
  border-radius: 14px;
}

.feature-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--feature-color, #9ca3af) 10%, transparent);
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--feature-color, #6b7280);
}

.feature-label {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
}

.feature-desc {
  font-size: 11.5px;
  color: var(--text-tertiary);
  text-align: center;
}
</style>
