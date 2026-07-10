<template>
  <aside :class="['sidebar', { hidden: !appStore.sidebarVisible }]">
    <div class="sidebar-inner">
      <button
        ref="avatarBtnRef"
        class="sidebar-avatar"
        :class="{ active: showPopover }"
        @click="togglePopover"
        @mouseenter="showTooltip($event, t('common.user.name'))"
        @mouseleave="hideTooltip"
      >
        <span class="avatar-ring"></span>
        <img src="@/assets/images/user.png" alt="avatar" class="avatar-img" />
        <span class="status-dot" :title="t('common.user.online')"></span>
      </button>

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

    <Teleport to="body">
      <div v-if="showPopover" ref="popoverRef" class="avatar-popover" :style="popoverStyle" @click.stop>
        <div class="popover-header">
          <div class="popover-avatar">
            <img src="@/assets/images/user.png" alt="avatar" />
            <span class="popover-status-dot"></span>
          </div>
          <div class="popover-user-info">
            <div class="popover-username">{{ t('common.user.name') }}<span class="popover-greeting">，{{ greeting }}</span></div>
            <div class="popover-status">
              <span class="status-indicator"></span>
              {{ t('common.user.online') }}
            </div>
          </div>
        </div>

        <div class="popover-section">
          <div class="section-label">{{ t('common.user.quickTheme') }}</div>
          <div class="quick-options">
            <button
              v-for="opt in themeOptions"
              :key="opt.value"
              :class="['quick-btn', { active: currentMode === opt.value }]"
              @click="selectTheme(opt.value)"
            >
              <component :is="opt.icon" :size="16" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

        <div class="popover-section">
          <div class="section-label">{{ t('common.user.quickLanguage') }}</div>
          <div class="quick-options">
            <button
              :class="['quick-btn', { active: currentLanguage === 'zh-CN' }]"
              @click="selectLanguage('zh-CN')"
            >中文</button>
            <button
              :class="['quick-btn', { active: currentLanguage === 'en-US' }]"
              @click="selectLanguage('en-US')"
            >EN</button>
          </div>
        </div>

        <div class="popover-divider"></div>

        <button class="popover-menu-item" @click="goToSettings">
          <Settings :size="18" />
          <span>{{ t('common.user.settings') }}</span>
          <svg class="menu-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
        <button class="popover-menu-item" @click="goToAbout">
          <Info :size="18" />
          <span>{{ t('common.user.about') }}</span>
          <svg class="menu-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>
    </Teleport>
  </aside>
</template>

<script setup>
import { reactive, ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { useTheme } from '@/utils/theme';
import { setI18nLanguage } from '@/i18n';
import { electronService } from '@/services/electron';
import { sidebarMenuConfig, sidebarBottomMenuConfig } from '@/config/menu';
import { Sun, Moon, Monitor, Settings, Info } from 'lucide-vue-next';

const appStore = useAppStore();
const router = useRouter();
const { t } = useI18n();
const { currentMode, setTheme: applyTheme } = useTheme();

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

// ========== Avatar popover ==========
const avatarBtnRef = ref(null);
const popoverRef = ref(null);
const showPopover = ref(false);
const popoverStyle = reactive({});

const currentLanguage = ref(appStore.language || 'zh-CN');

const themeOptions = computed(() => [
  { value: 'light', label: t('settings.themeLight'), icon: Sun },
  { value: 'dark', label: t('settings.themeDark'), icon: Moon },
  { value: 'system', label: t('settings.themeSystem'), icon: Monitor }
]);

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return t('common.user.greetingMorning');
  if (hour < 18) return t('common.user.greetingAfternoon');
  return t('common.user.greetingEvening');
});

const updatePopoverPosition = () => {
  if (!avatarBtnRef.value) return;
  const rect = avatarBtnRef.value.getBoundingClientRect();
  popoverStyle.top = `${rect.top}px`;
  popoverStyle.left = `${rect.right + 10}px`;
};

const togglePopover = () => {
  if (showPopover.value) {
    showPopover.value = false;
    return;
  }
  hideTooltip();
  updatePopoverPosition();
  showPopover.value = true;
};

const selectTheme = (value) => {
  applyTheme(value);
  appStore.setTheme(value);
};

const selectLanguage = async (value) => {
  currentLanguage.value = value;
  appStore.setLanguage(value);
  setI18nLanguage(value);
  try {
    const config = await electronService.invoke('get-config');
    if (config) {
      config.language = value;
      await electronService.invoke('save-config', config);
    }
  } catch (_e) {}
};

const goToSettings = () => {
  showPopover.value = false;
  router.push('/settings');
};

const HELP_URL = 'https://github.com/cheney-plus/happy-friday-electron';

const goToAbout = () => {
  showPopover.value = false;
  electronService.invoke('open-external', HELP_URL);
};

const handleOutsideClick = (event) => {
  if (!showPopover.value) return;
  const target = event.target;
  if (
    popoverRef.value && !popoverRef.value.contains(target) &&
    avatarBtnRef.value && !avatarBtnRef.value.contains(target)
  ) {
    showPopover.value = false;
  }
};

const handleResize = () => {
  if (showPopover.value) updatePopoverPosition();
};

const onRouteChange = () => {
  showPopover.value = false;
};

onMounted(() => {
  document.addEventListener('click', handleOutsideClick);
  window.addEventListener('resize', handleResize);
  currentLanguage.value = appStore.language || 'zh-CN';
  router.afterEach(onRouteChange);
});

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick);
  window.removeEventListener('resize', handleResize);
});

watch(showPopover, (val) => {
  if (val) {
    requestAnimationFrame(updatePopoverPosition);
  }
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

/* Avatar popover */
.avatar-popover {
  position: fixed;
  width: 272px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.14);
  padding: 6px;
  z-index: 99998;
  animation: popover-in 0.18s cubic-bezier(0.34, 1.2, 0.64, 1);
}

@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateX(-8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

.popover-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px 14px;
}

.popover-avatar {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.popover-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.popover-status-dot {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 11px;
  height: 11px;
  background: #10b981;
  border-radius: 50%;
  border: 2.5px solid var(--bg-primary);
}

.popover-user-info {
  min-width: 0;
}

.popover-username {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.popover-greeting {
  font-weight: 400;
  font-size: 13px;
  color: var(--text-tertiary);
}

.popover-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 3px;
}

.status-indicator {
  width: 7px;
  height: 7px;
  background: #10b981;
  border-radius: 50%;
  flex-shrink: 0;
}

.popover-section {
  padding: 5px 12px 7px;
}

.section-label {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
  margin-bottom: 4px;
}

.quick-options {
  flex: 1;
  display: flex;
  gap: 3px;
  background-color: var(--bg-secondary);
  border-radius: 7px;
  padding: 3px;
}

.quick-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 6px;
  border: none;
  background: transparent;
  border-radius: 5px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s, color 0.15s;
  user-select: none;
}

.quick-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.quick-btn.active {
  background-color: var(--text-primary);
  color: var(--bg-primary);
  font-weight: 500;
}

.popover-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: 3px 12px;
}

.popover-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s;
  text-align: left;
}

.popover-menu-item:hover {
  background-color: var(--bg-hover);
}

.menu-arrow {
  color: var(--text-tertiary);
  margin-left: auto;
  flex-shrink: 0;
}

[data-theme='dark'] .avatar-popover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}
</style>
