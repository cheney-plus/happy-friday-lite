<template>
  <div class="settings-page">
    <h1 class="settings-title">设置</h1>

    <div class="settings-content">
      <!-- 通用设置 -->
      <div class="settings-group">
        <div class="group-title">通用设置</div>
        <div class="group-content">
          <div class="setting-item">
            <span class="item-label">界面显示</span>
            <div class="theme-select-wrapper" ref="themeSelectRef">
              <div class="theme-select-trigger" @click="toggleThemeDropdown">
                <span>{{ currentThemeLabel }}</span>
                <svg class="theme-select-arrow" :class="{ expanded: showThemeDropdown }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <div v-if="showThemeDropdown" class="theme-dropdown-menu">
                <div
                  v-for="option in themeOptions"
                  :key="option.value"
                  :class="['theme-dropdown-item', { active: settings.displayMode === option.value }]"
                  @click="selectTheme(option.value)"
                >
                  <span>{{ option.label }}</span>
                  <svg v-if="settings.displayMode === option.value" class="check-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="setting-item">
            <span class="item-label">字体大小</span>
            <div class="font-size-options">
              <div
                v-for="option in fontSizeOptions"
                :key="option.value"
                :class="['font-size-option', { active: settings.fontSize === option.value }]"
                @click="settings.fontSize = option.value"
              >
                {{ option.label }}
              </div>
            </div>
          </div>
          <div class="setting-item">
            <span class="item-label">开机自动启动</span>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.autoStart" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-item">
            <span class="item-label">接收消息提醒</span>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.messageNotify" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-item clickable" @click="goToModelSettings">
            <span class="item-label">模型设置</span>
            <span class="item-link">
              支持自定义模型
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </span>
          </div>
        </div>
      </div>

      <!-- AI工具 -->
      <div class="settings-group">
        <div class="group-title">AI工具</div>
        <div class="group-content">
          <div class="setting-item">
            <span class="item-label">随时唤起Friday</span>
            <span class="shortcut-key">⌘ + Space</span>
          </div>
          <div class="setting-item">
            <span class="item-label">快捷截图</span>
            <span class="shortcut-key">⌘ + J</span>
          </div>
          <div class="setting-item clickable">
            <span class="item-label">AI划词工具栏</span>
            <span class="item-link">
              仅在ima中使用
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </span>
          </div>
          <div class="setting-item">
            <span class="item-label">开启笔记内容补全</span>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.noteFimCompletion" @change="saveNoteFimCompletion" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 浏览设置 -->
      <div class="settings-group">
        <div class="group-title">浏览设置</div>
        <div class="group-content">
          <div class="setting-item">
            <span class="item-label">网页默认用 ima 打开</span>
            <button class="action-btn">去设置</button>
          </div>
          <div class="setting-item clickable">
            <span class="item-label">搜索方式</span>
            <span class="item-link">
              Microsoft Bing
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </span>
          </div>
          <div class="setting-item">
            <span class="item-label">启动时候复上次打开的标签页</span>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.restoreTabs" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 书签 -->
      <div class="settings-group">
        <div class="group-title">书签</div>
        <div class="group-content">
          <div class="setting-item">
            <span class="item-label">展示书签栏</span>
            <label class="toggle-switch">
              <input type="checkbox" v-model="settings.showBookmarkBar" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-item clickable">
            <span class="item-label">书签管理器</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-icon"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="setting-item clickable">
            <span class="item-label">导入书签</span>
            <div class="import-action">
              <span class="red-dot"></span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-icon"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 关于 -->
      <div class="settings-group">
        <div class="group-title">关于</div>
        <div class="group-content">
          <div class="setting-item clickable">  
            <span class="item-label">关于&nbsp;friday.copilot</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-icon"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="setting-item">
            <span class="item-label">版本号&nbsp;1.0.1(0512)</span>
            <button class="text-btn">检查并更新</button>
          </div>
          <div class="setting-item clickable">
            <span class="item-label">功能介绍</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-icon"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
          <div class="setting-item clickable">
            <span class="item-label">帮助与反馈</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="arrow-icon"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      </div>

      <div class="footer-links">
        <a href="#" class="footer-link">服务协议</a>
        <span class="footer-divider">|</span>
        <a href="#" class="footer-link">开源版权声明</a>
        <span class="footer-divider">|</span>
        <a href="#" class="footer-link">隐私保护指引</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, onUnmounted, onDeactivated } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '@/store';
import { useTheme } from '@/utils/theme';
import { electronService } from '@/services/electron';

const router = useRouter();
const appStore = useAppStore();
const { currentMode, setTheme: applyTheme, initTheme } = useTheme();

const showThemeDropdown = ref(false);
const themeSelectRef = ref(null);

const themeOptions = [
  { value: 'light', label: '浅色模式' },
  { value: 'dark', label: '深色模式' },
  { value: 'system', label: '跟随系统' }
];

const fontSizeOptions = [
  { value: 14, label: '小' },
  { value: 16, label: '标准' },
  { value: 18, label: '大' }
];

const currentThemeLabel = computed(() => {
  const option = themeOptions.find(opt => opt.value === currentMode.value);
  return option?.label || '浅色模式';
});

const settings = reactive({
  displayMode: currentMode,
  fontSize: 16,
  autoStart: true,
  messageNotify: false,
  restoreTabs: true,
  showBookmarkBar: false,
  noteFimCompletion: appStore.noteFimCompletion
});

const toggleThemeDropdown = () => {
  showThemeDropdown.value = !showThemeDropdown.value;
};

const selectTheme = (value) => {
  settings.displayMode = value;
  applyTheme(value);
  appStore.setTheme(value);
  showThemeDropdown.value = false;
};

const saveNoteFimCompletion = async () => {
  appStore.setNoteFimCompletion(settings.noteFimCompletion);
  try {
    const config = await electronService.invoke('get-config');
    if (config) {
      config.noteFimCompletion = settings.noteFimCompletion;
      await electronService.invoke('save-config', config);
    }
  } catch (_e) {}
};

const handleClickOutside = (event) => {
  if (themeSelectRef.value && !themeSelectRef.value.contains(event.target)) {
    showThemeDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  initTheme();
  settings.displayMode = currentMode.value;
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

onDeactivated(() => {
  showThemeDropdown.value = false;
});

const goToModelSettings = () => {
  router.push('/settings/model');
};
</script>

<style scoped>
.settings-page {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 40px;
}

.settings-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 28px;
  max-width: 720px;
  width: 100%;
  text-align: left;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
  width: 100%;
}

.settings-group {
  background-color: var(--bg-primary);
}

.group-title {
  font-size: 14px;
  color: var(--text-tertiary);
  padding: 16px 0 10px;
  font-weight: 400;
}

.group-content {
  background-color: var(--bg-secondary);
  border-radius: 10px;
  overflow: hidden;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  min-height: 52px;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.clickable {
  cursor: pointer;
}

.item-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.theme-select-wrapper {
  position: relative;
  flex: 1;
  max-width: 140px;
}

.theme-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.theme-select-trigger:hover {
  background-color: var(--bg-hover);
}

.theme-select-arrow {
  color: var(--text-tertiary);
  transition: transform 0.2s ease;
  flex-shrink: 0;
  margin-left: 8px;
}

.theme-select-arrow.expanded {
  transform: rotate(180deg);
}

.theme-dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  padding: 6px;
  z-index: 100;
  animation: themeDropdownIn 0.2s ease;
}

@keyframes themeDropdownIn {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.theme-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  cursor: pointer;
  border-radius: 10px;
  transition: background-color 0.15s;
  font-size: 14px;
  color: var(--text-primary);
}

.theme-dropdown-item:hover {
  background-color: var(--bg-hover);
}

.theme-dropdown-item.active {
  background-color: var(--accent-light);
}

.check-icon {
  flex-shrink: 0;
}

.font-size-options {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 4px;
}

.font-size-option {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.font-size-option:hover {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.font-size-option.active {
  background-color: var(--text-primary);
  color: var(--bg-primary);
  font-weight: 500;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--text-tertiary);
  border-radius: 24px;
  transition: background-color 0.25s ease;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: var(--bg-primary);
  border-radius: 50%;
  transition: transform 0.25s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #10b981;
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.shortcut-key {
  font-size: 13px;
  color: var(--text-primary);
  background-color: var(--bg-secondary);
  padding: 5px 12px;
  border-radius: 6px;
  font-family: inherit;
  letter-spacing: 0.3px;
}

.item-link {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.item-link svg {
  color: var(--text-tertiary);
}

.action-btn {
  background-color: var(--text-primary);
  color: var(--bg-primary);
  border: none;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  font-family: inherit;
  transition: opacity 0.15s;
}

.action-btn:hover {
  opacity: 0.85;
}

.arrow-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.import-action {
  display: flex;
  align-items: center;
  gap: 8px;
}

.red-dot {
  width: 8px;
  height: 8px;
  background-color: #ef4444;
  border-radius: 50%;
  flex-shrink: 0;
}

.text-btn {
  background-color: transparent;
  color: var(--text-primary);
  border: none;
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
  font-family: inherit;
}

.text-btn:hover {
  background-color: var(--bg-hover);
}

.footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 0 12px;
  flex-wrap: wrap;
}

.footer-link {
  font-size: 13px;
  color: var(--text-tertiary);
  text-decoration: none;
  transition: color 0.15s;
}

.footer-link:hover {
  color: var(--text-secondary);
}

.footer-divider {
  font-size: 13px;
  color: var(--text-tertiary);
}

[data-theme='dark'] .theme-dropdown-menu {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}
</style>
