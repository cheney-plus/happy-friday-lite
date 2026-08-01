<template>
  <Teleport to="body">
    <Transition name="drawer-overlay">
      <div v-if="visible" class="avatar-drawer-overlay" @click="close">
        <Transition name="drawer-slide">
          <div v-if="visible" class="avatar-drawer" @click.stop>
            <!-- Body -->
            <div class="drawer-body">
              <nav class="drawer-nav">
                <button
                  v-for="item in navItems"
                  :key="item.key"
                  :class="['nav-item', { active: activeSection === item.key }]"
                  @click="activeSection = item.key"
                >
                  <component :is="item.icon" :size="18" :stroke-width="1.6" />
                  <span>{{ item.label }}</span>
                </button>
              </nav>
              <div class="drawer-content">
                <component :is="currentComponent" @close="close" />
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Brain, Sparkles, Plug, BarChart3 } from 'lucide-vue-next';
import SkillsManagement from './drawer/SkillsManagement.vue';
import MemoryManagement from './drawer/MemoryManagement.vue';
import MCPConnection from './drawer/MCPConnection.vue';
import UsageStatistics from './drawer/UsageStatistics.vue';

const { t } = useI18n();

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const activeSection = ref('skills');

const navItems = computed(() => [
  { key: 'memory', label: t('drawer.nav.memory'), icon: Brain },
  { key: 'skills', label: t('drawer.nav.skills'), icon: Sparkles },
  { key: 'mcp', label: t('drawer.nav.mcp'), icon: Plug },
  { key: 'usage', label: t('drawer.nav.usage'), icon: BarChart3 }
]);

const componentMap = {
  memory: MemoryManagement,
  skills: SkillsManagement,
  mcp: MCPConnection,
  usage: UsageStatistics
};

const currentComponent = computed(() => componentMap[activeSection.value] || SkillsManagement);

const close = () => {
  visible.value = false;
};

const handleEsc = (e) => {
  if (e.key === 'Escape' && visible.value) {
    close();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleEsc);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEsc);
});
</script>

<style scoped>
.avatar-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 99998;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
}

.avatar-drawer {
  width: 640px;
  height: 480px;
  max-height: 85vh;
  background-color: var(--bg-primary);
  border-radius: 12px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.drawer-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.drawer-nav {
  width: 152px;
  flex-shrink: 0;
  background-color: var(--bg-secondary);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 11px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s, color 0.15s;
  text-align: left;
}

.nav-item:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.drawer-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* Refined scrollbar */
.drawer-nav::-webkit-scrollbar,
.drawer-content ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.drawer-nav::-webkit-scrollbar-track,
.drawer-content ::-webkit-scrollbar-track {
  background: transparent;
}

.drawer-nav::-webkit-scrollbar-thumb,
.drawer-content ::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.drawer-nav::-webkit-scrollbar-thumb:hover,
.drawer-content ::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.drawer-nav {
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

/* Animations */
.drawer-overlay-enter-active,
.drawer-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-overlay-enter-from,
.drawer-overlay-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.2, 0.64, 1);
}

.drawer-slide-leave-active {
  transition: all 0.15s ease;
}

.drawer-slide-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.drawer-slide-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* Dark mode */
[data-theme='dark'] .avatar-drawer {
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
}

[data-theme='dark'] .nav-item.active {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
</style>
