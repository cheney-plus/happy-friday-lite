<template>
  <div class="skills-management">
    <!-- Header (fixed, no scroll) -->
    <div class="panel-header">
      <h2 class="section-title">{{ t('drawer.skills.title') }}</h2>
      <div class="header-actions">
        <button class="add-skill-btn" @click="handleAddSkill">
          <Plus :size="14" :stroke-width="2" />
          {{ t('drawer.skills.addSkill') }}
        </button>
        <button class="close-btn" @click="emit('close')">
          <X :size="16" :stroke-width="2" />
        </button>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="panel-body">
      <!-- Installed Skills -->
      <div class="skills-section">
        <h3 class="subsection-title">{{ t('drawer.skills.installed') }}</h3>
        <div class="skills-list">
          <div v-for="skill in installedSkills" :key="skill.id" class="skill-card installed">
            <div class="skill-card-main">
              <div class="skill-name">{{ skill.name }}</div>
              <div class="skill-desc">{{ skill.description }}</div>
            </div>
            <button class="skill-menu-btn" @click.stop="toggleMenu(skill.id)">
              <MoreHorizontal :size="16" />
            </button>
            <Transition name="menu-fade">
              <div v-if="openMenuId === skill.id" class="skill-menu">
                <button class="menu-option" @click.stop="handleSkillAction(skill, 'disable')">
                  {{ skill.enabled ? t('drawer.skills.disable') : t('drawer.skills.enable') }}
                </button>
                <button class="menu-option danger" @click.stop="handleSkillAction(skill, 'uninstall')">
                  {{ t('drawer.skills.uninstall') }}
                </button>
              </div>
            </Transition>
          </div>
          <div v-if="installedSkills.length === 0" class="empty-hint">
            {{ t('drawer.skills.emptyInstalled') }}
          </div>
        </div>
      </div>

      <!-- Built-in Skills -->
      <div class="skills-section">
        <h3 class="subsection-title">{{ t('drawer.skills.builtin') }}</h3>
        <div class="skills-grid">
          <div v-for="skill in builtinSkills" :key="skill.id" class="skill-card builtin">
            <div class="skill-name">{{ skill.name }}</div>
            <div class="skill-desc">{{ skill.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Plus, MoreHorizontal, X } from 'lucide-vue-next';

const { t } = useI18n();

const emit = defineEmits(['close']);

const openMenuId = ref(null);

const installedSkills = ref([
  {
    id: 'wechat-reading',
    name: '微信读书 skill',
    description: '微信读书助手 — 书籍搜索、管理书架、查看笔记划线、浏览书评、阅读统计、发现推荐好书',
    enabled: true
  }
]);

const builtinSkills = ref([
  {
    id: 'knowledge-base',
    name: '知识库管理',
    description: '知识库管理与元信息操作：内容导入/导出/移动/重命名、文件夹层级浏览与组织、按名称/标签/类型定位文件与文件夹、标签管理（给文件打/移除标签）...'
  },
  {
    id: 'note-manage',
    name: '笔记管理',
    description: '管理用户的笔记和笔记本（新建、追加、编辑笔记内容、推送、重命名、移动笔记，按标题定位笔记，按笔记本浏览笔记列表，导出笔记到 works...'
  },
  {
    id: 'create-skill',
    name: '创建skill',
    description: '创建新技能（skill）、修改并优化现有技能。当用户说"创建技能""新建 Skill""把这个流程变成技能""自动化我的 XX 流程"时触发。也适用于修...'
  },
  {
    id: 'generate-ppt',
    name: '生成ppt',
    description: 'PPT演示文稿的创建与多轮编辑。支持创建PPT、对已有PPT进行修改（新增/编辑/删除/移动页面）、全局风格调整。当用户提到PPT、演示文...'
  },
  {
    id: 'generate-report',
    name: '生成报告',
    description: '根据用户提供的数据或主题，自动生成结构化的分析报告，支持多种格式和模板选择。'
  },
  {
    id: 'generate-podcast',
    name: '生成播客',
    description: '将文本内容转换为播客风格的音频脚本，支持多角色对话、语气调整等。'
  }
]);

const toggleMenu = (id) => {
  openMenuId.value = openMenuId.value === id ? null : id;
};

const handleAddSkill = () => {
  // TODO: implement add skill dialog
};

const handleSkillAction = (_skill, _action) => {
  openMenuId.value = null;
  // TODO: implement skill actions
};
</script>

<style scoped>
.skills-management {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* Fixed header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px 7px;
  flex-shrink: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.add-skill-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 5px;
  font-size: 11px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  transition: background-color 0.15s, border-color 0.15s;
}

.add-skill-btn:hover {
  background-color: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.close-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
  flex-shrink: 0;
}

.close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* Scrollable body */
.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.skills-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.subsection-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0;
}

/* Installed skills list */
.skills-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skill-card {
  background-color: var(--bg-secondary);
  border-radius: 8px;
  padding: 10px 12px;
  transition: background-color 0.15s;
}

.skill-card.installed {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  position: relative;
  gap: 8px;
}

.skill-card-main {
  min-width: 0;
  flex: 1;
}

.skill-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
}

.skill-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.skill-menu-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s, color 0.15s;
}

.skill-menu-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.skill-menu {
  position: absolute;
  right: 12px;
  top: 36px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 3px;
  z-index: 10;
  min-width: 112px;
}

.menu-option {
  display: block;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: 5px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background-color 0.15s;
}

.menu-option:hover {
  background-color: var(--bg-hover);
}

.menu-option.danger {
  color: #ef4444;
}

.menu-option.danger:hover {
  background-color: rgba(239, 68, 68, 0.08);
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.15s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
}

/* Built-in skills grid */
.skills-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.skill-card.builtin {
  display: flex;
  flex-direction: column;
  gap: 3px;
  cursor: default;
}

.skill-card.builtin .skill-desc {
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 10px 0;
}

[data-theme='dark'] .skill-menu {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}
</style>
