<template>
  <div class="friday-layout" :class="{ 'is-immersive-home': immersiveChrome }">
    <ConversationHistorySidebar
      v-if="!historyCollapsed"
      :sessions="historySessions"
      :current-session-id="currentSessionId"
      :loading="historyLoading"
      @select="openSession"
      @create="createNewConversation"
      @deleted="onSessionDeleted"
      @renamed="onSessionRenamed"
      @collapse="collapseHistory"
    />

    <div class="friday-main">
      <div class="friday-outlet">
        <keep-alive>
          <component :is="childComponent" :key="childViewKey" />
        </keep-alive>
      </div>

      <button
        v-if="historyCollapsed"
        class="history-expand-btn"
        type="button"
        :title="t('friday.historyExpand')"
        @click="expandHistory"
      >
        <Clock :size="18" :stroke-width="2" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, provide, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Clock } from 'lucide-vue-next';
import { useTabStore } from '@/store';
import { fridayChatLocation, fridayHomeLocation, getFridayTabId, isNewSessionId } from '@/utils/fridayNavigation';
import ConversationHistorySidebar from '@/views/friday/components/ConversationHistorySidebar.vue';
import FridayHome from '@/views/friday/FridayHome.vue';
import FridayConversation from '@/views/friday/FridayConversation.vue';
import { useConversationHistory } from '@/views/friday/composables/useConversationHistory';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const tabStore = useTabStore();
const { historySessions, historyLoading } = useConversationHistory();
const historyCollapsed = ref(true);
provide('fridayHistoryCollapsed', historyCollapsed);

// 外层 keep-alive 以 __tab 为 key，每个 Tab 对应一个 FridayLayout 实例。
// 隐藏 Tab 必须使用自己的路由快照，若继续跟随全局路由会与激活 Tab 的视图互相串台。
const ownTabId = getFridayTabId(route, tabStore) || '';
const isShare = computed(() => route.meta?.share === true);
const ownFullPath = ref(
  tabStore.openedTabs.find(tab => tab.id === ownTabId)?.fullPath || route.fullPath
);

// 本 Tab 自己的路由对象，供子视图（Home / Conversation）读取，避免读到其它 Tab 的路由
const fridayRoute = reactive({
  name: 'friday',
  path: '/friday',
  fullPath: ownFullPath.value,
  params: {},
  query: {},
  meta: {}
});

function applyFridayRoute(fullPath) {
  const resolved = router.resolve(fullPath);
  fridayRoute.name = resolved.name || 'friday';
  fridayRoute.path = resolved.path;
  fridayRoute.fullPath = resolved.fullPath;
  fridayRoute.params = { ...resolved.params };
  fridayRoute.query = { ...resolved.query };
  fridayRoute.meta = resolved.meta || {};
}

watch(ownFullPath, applyFridayRoute, { immediate: true });

// 只有激活 Tab 跟随全局路由；隐藏 Tab 保留自己最后的路径
watch(
  () => route.fullPath,
  (fullPath) => {
    if (isShare.value || !ownTabId || tabStore.activeTabId === ownTabId) {
      ownFullPath.value = fullPath;
    }
  }
);

// Tab 级导航：激活 Tab 走全局路由；隐藏 Tab 只更新自身路径（如后台流式会话完成后对齐 sessionId）
function navigate(location, { replace = false } = {}) {
  const resolved = router.resolve(location);
  if (isShare.value || !ownTabId || tabStore.activeTabId === ownTabId) {
    return replace ? router.replace(location) : router.push(location);
  }
  ownFullPath.value = resolved.fullPath;
  tabStore.updateTabFullPath(ownTabId, resolved.fullPath);
  return Promise.resolve();
}

provide('fridayRoute', fridayRoute);
provide('fridayNavigate', navigate);

const isChatView = computed(() => fridayRoute.name === 'friday-chat');
const childComponent = computed(() => (isChatView.value ? FridayConversation : FridayHome));
// 同一 Tab 内切换首页/对话时复用组件实例，会话切换由 FridayConversation 自行处理
const childViewKey = computed(() => (isChatView.value ? 'friday-chat' : 'friday'));

const isFridayHome = computed(() => fridayRoute.name === 'friday');
const immersiveChrome = computed(() => isFridayHome.value && historyCollapsed.value);

const currentSessionId = computed(() => {
  const sessionId = fridayRoute.params.sessionId;
  return isNewSessionId(sessionId) ? '' : sessionId;
});

function openSession(session) {
  if (!session?.id) return;
  if (session.id === currentSessionId.value && fridayRoute.name === 'friday-chat') return;
  navigate(fridayChatLocation(fridayRoute, {
    sessionId: session.id,
    query: {
      mode: session.mode || 'chat',
      title: session.title || ''
    }
  }, tabStore));
}

function createNewConversation() {
  goHome();
}

function collapseHistory() {
  historyCollapsed.value = true;
}

function expandHistory() {
  historyCollapsed.value = false;
}

function goHome() {
  // Navigation must not change the history panel state selected by the user.
  const location = fridayHomeLocation(fridayRoute, tabStore);

  // Persist the target before navigation so a tab switch cannot restore its old chat URL.
  if (ownTabId) tabStore.updateTabFullPath(ownTabId, router.resolve(location).fullPath);
  if (fridayRoute.name !== 'friday') navigate(location);
}

function onSessionDeleted(sessionId) {
  if (sessionId === currentSessionId.value) {
    goHome();
  }
}

function onSessionRenamed({ sessionId, title }) {
  if (sessionId === currentSessionId.value && title) {
    navigate(fridayChatLocation(fridayRoute, {
      sessionId,
      query: {
        ...fridayRoute.query,
        title
      }
    }, tabStore), { replace: true });
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

.friday-layout.is-immersive-home {
  background: var(--bg-secondary);
}

.friday-layout.is-immersive-home :deep(.friday-home) {
  background-color: transparent;
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
  right: 16px;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 10px;
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
