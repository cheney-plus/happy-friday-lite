<template>
  <aside :class="['sidebar', { hidden: !appStore.sidebarVisible }]">
    <div class="sidebar-inner">
      <div class="sidebar-avatar">
        <img src="@/assets/images/user.png" alt="avatar" class="avatar-img" />
      </div>

      <nav class="sidebar-menu">
        <router-link
          v-for="item in sidebarMenuConfig"
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
          v-for="item in sidebarBottomMenuConfig"
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
  </aside>
</template>

<script setup>
import { reactive } from 'vue';
import { useAppStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { sidebarMenuConfig, sidebarBottomMenuConfig } from '@/config/menu';

const appStore = useAppStore();
const { t } = useI18n();

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
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  margin-bottom: 24px;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
