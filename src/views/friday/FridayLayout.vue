<template>
  <div class="friday-layout">
    <ConversationHistorySidebar
      v-if="!fridayStore.historyCollapsed"
      :sessions="historySessions"
      :current-session-id="currentSessionId"
      :loading="historyLoading"
      @select="openSession"
      @create="createNewConversation"
      @deleted="onSessionDeleted"
      @renamed="onSessionRenamed"
    />

    <div class="friday-main">
      <div class="friday-outlet">
        <router-view v-slot="{ Component, route: childRoute }">
          <component :is="Component" :key="String(childRoute.name)" />
        </router-view>
      </div>

      <button
        v-if="fridayStore.historyCollapsed"
        class="history-expand-btn"
        type="button"
        :title="t('friday.historyExpand')"
        @click="fridayStore.setHistoryCollapsed(false)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useFridayStore } from '@/store';
import { fridayChatLocation, fridayHomeLocation, isNewSessionId } from '@/utils/fridayNavigation';
import ConversationHistorySidebar from '@/views/friday/components/ConversationHistorySidebar.vue';
import { useConversationHistory } from '@/views/friday/composables/useConversationHistory';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const fridayStore = useFridayStore();
const { historySessions, historyLoading } = useConversationHistory();

const currentSessionId = computed(() => {
  const sessionId = route.params.sessionId;
  return isNewSessionId(sessionId) ? '' : sessionId;
});

function openSession(session) {
  if (!session?.id) return;
  if (session.id === currentSessionId.value && route.name === 'friday-chat') return;
  router.push(fridayChatLocation(route, {
    sessionId: session.id,
    query: {
      mode: session.mode || 'chat',
      title: session.title || ''
    }
  }));
}

function createNewConversation() {
  if (route.name === 'friday') return;
  router.push(fridayHomeLocation(route));
}

function onSessionDeleted(sessionId) {
  if (sessionId === currentSessionId.value) {
    router.push(fridayHomeLocation(route));
  }
}

function onSessionRenamed({ sessionId, title }) {
  if (sessionId === currentSessionId.value && title) {
    router.replace(fridayChatLocation(route, {
      sessionId,
      query: {
        ...route.query,
        title
      }
    }));
  }
}
</script>

<style scoped>
.friday-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
  background: var(--bg-primary);
  overflow: hidden;
}

.friday-main {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.friday-outlet {
  position: relative;
  z-index: 0;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.friday-outlet :deep(.friday-home),
.friday-outlet :deep(.conversation-page) {
  flex: 1;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.history-expand-btn {
  position: absolute;
  top: 12px;
  left: 16px;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  pointer-events: auto;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.history-expand-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
