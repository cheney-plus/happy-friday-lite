<template>
  <aside :class="['sidebar', { hidden: !appStore.sidebarVisible }]">
    <div class="sidebar-inner">
      <button
        ref="avatarBtnRef"
        class="sidebar-avatar"
        :class="{ active: showDrawer }"
        @click="toggleDrawer"
        @mouseenter="showTooltip($event, t('common.user.name'))"
        @mouseleave="hideTooltip"
      >
        <span class="avatar-ring"></span>
        <img :src="avatarSrc" alt="avatar" class="avatar-img" />
        <span class="status-dot" :title="t('common.user.online')"></span>
      </button>

      <nav class="sidebar-menu">
        <router-link
          v-for="item in visibleSidebarMenuConfig"
          :key="item.key"
          :to="item.path"
          class="menu-item"
          active-class="active"
          @mouseenter="showTooltip($event, t(item.i18nKey))"
          @mouseleave="hideTooltip"
        >
          <component :is="item.iconComponent" :size="20" :stroke-width="1.6" />
        </router-link>
      </nav>

      <div class="sidebar-bottom">
        <router-link
          v-for="item in visibleSidebarBottomMenuConfig"
          :key="item.key"
          :to="item.path"
          class="menu-item"
          active-class="active"
          @mouseenter="showTooltip($event, t(item.i18nKey))"
          @mouseleave="hideTooltip"
        >
          <component :is="item.iconComponent" :size="20" :stroke-width="1.6" />
        </router-link>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="tooltip.visible" class="floating-tooltip" :style="tooltip.style">
        {{ tooltip.text }}
      </div>
    </Teleport>

    <AvatarDrawer v-model="showDrawer" />
  </aside>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { sidebarMenuConfig, sidebarBottomMenuConfig } from '@/config/menu';
import AvatarDrawer from './AvatarDrawer.vue';

const appStore = useAppStore();
const router = useRouter();
const { t } = useI18n();

const isModuleVisible = (item) => item.key === 'settings' || appStore.sidebarModules[item.key] !== false;
const visibleSidebarMenuConfig = computed(() => sidebarMenuConfig.filter(isModuleVisible));
const visibleSidebarBottomMenuConfig = computed(() => sidebarBottomMenuConfig.filter(isModuleVisible));

// 系统头像固定使用 public/images/icon.png，不支持更换。
const avatarSrc = '/images/icon.png';

const tooltip = reactive({
  visible: false,
  text: '',
  style: {}
});

const showTooltip = (event, text) => {
  const rect = event.currentTarget.getBoundingClientRect();
  tooltip.text = text;
  tooltip.style = {
    top: `${rect.top + rect.height / 2}px`,
    left: `${rect.right + 10}px`,
    transform: 'translateY(-50%)'
  };
  tooltip.visible = true;
};

const hideTooltip = () => {
  tooltip.visible = false;
};

// ========== Avatar drawer ==========
const showDrawer = ref(false);

const toggleDrawer = () => {
  hideTooltip();
  showDrawer.value = !showDrawer.value;
};

const onRouteChange = () => {
  showDrawer.value = false;
};

onMounted(() => {
  router.afterEach(onRouteChange);
});
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100%;
  background-color: var(--bg-sidebar);
  flex-shrink: 0;
  overflow: hidden;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar.hidden {
  width: 0;
}

.sidebar-inner {
  width: var(--sidebar-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
}

.sidebar-avatar {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: visible;
  flex-shrink: 0;
  margin-bottom: 24px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.sidebar-avatar:hover {
  transform: scale(1.12);
}

.sidebar-avatar:active {
  transform: scale(1.05);
}

.sidebar-avatar.active {
  transform: scale(1.08);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  display: block;
  position: relative;
  z-index: 2;
}

.avatar-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1.5px solid var(--accent-color);
  opacity: 0;
  z-index: 1;
  pointer-events: none;
  animation: avatar-breathe 3.2s ease-in-out infinite;
}

.sidebar-avatar:hover .avatar-ring {
  opacity: 0.5;
  border-color: var(--accent-color);
}

.sidebar-avatar.active .avatar-ring {
  opacity: 0.7;
}

@keyframes avatar-breathe {
  0%, 100% {
    opacity: 0;
    transform: scale(0.92);
  }
  50% {
    opacity: 0.35;
    transform: scale(1.08);
  }
}

.status-dot {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  border: 2px solid var(--bg-sidebar);
  z-index: 3;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6);
  animation: status-pulse 2.4s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
  }
}

.sidebar-menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  width: 100%;
}

.sidebar-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding-top: 8px;
}

.menu-item {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--text-primary);
  opacity: 0.85;
  transition: background-color 0.15s, opacity 0.15s, color 0.15s;
}

.menu-item:hover {
  background-color: var(--bg-hover);
  opacity: 1;
}

.menu-item.active {
  background-color: rgba(0, 0, 0, 0.08);
  color: var(--text-primary);
  opacity: 1;
}
</style>

<style>
.floating-tooltip {
  position: fixed;
  background-color: var(--text-primary);
  color: var(--bg-primary);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 99999;
  animation: tooltip-fade-in 0.12s ease-out;
}

.floating-tooltip::before {
  content: '';
  position: absolute;
  left: -5px;
  top: 50%;
  transform: translateY(-50%);
  border: 5px solid transparent;
  border-right-color: var(--text-primary);
  border-left: none;
}

@keyframes tooltip-fade-in {
  from { opacity: 0; transform: translateY(-50%) translateX(-2px); }
  to { opacity: 1; transform: translateY(-50%) translateX(0); }
}

</style>
