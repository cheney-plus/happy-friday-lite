import {
  Bot
} from 'lucide-vue-next'
import OfficeIcon from '@/components/icons/OfficeIcon.vue'
import CalendarIcon from '@/components/icons/CalendarIcon.vue'
import KnowledgeIcon from '@/components/icons/KnowledgeIcon.vue'
import NoteIcon from '@/components/icons/NoteIcon.vue'
import DrawingIcon from '@/components/icons/DrawingIcon.vue'
import HarnessIcon from '@/components/icons/HarnessIcon.vue'
import AutomationIcon from '@/components/icons/AutomationIcon.vue'
import HistoryIcon from '@/components/icons/HistoryIcon.vue'
import SettingsIcon from '@/components/icons/SettingsIcon.vue'

export const sidebarMenuConfig = [
  { key: 'note', path: '/note', icon: 'NoteIcon', iconComponent: NoteIcon, i18nKey: 'note.title' },
  { key: 'drawing', path: '/drawing', icon: 'DrawingIcon', iconComponent: DrawingIcon, i18nKey: 'drawing.title' },
  { key: 'knowledge', path: '/knowledge', icon: 'KnowledgeIcon', iconComponent: KnowledgeIcon, i18nKey: 'knowledge.title' },
  { key: 'office', path: '/office', icon: 'OfficeIcon', iconComponent: OfficeIcon, i18nKey: 'office.title' },
  { key: 'schedule', path: '/schedule', icon: 'CalendarIcon', iconComponent: CalendarIcon, i18nKey: 'schedule.title' },
  { key: 'automation', path: '/automation', icon: 'AutomationIcon', iconComponent: AutomationIcon, i18nKey: 'automation.title' },
  { key: 'harness', path: '/harness', icon: 'HarnessIcon', iconComponent: HarnessIcon, i18nKey: 'harness.title' }
]

export const sidebarBottomMenuConfig = [
  { key: 'history', path: '/history', icon: 'HistoryIcon', iconComponent: HistoryIcon, i18nKey: 'history.title' },
  { key: 'settings', path: '/settings', icon: 'SettingsIcon', iconComponent: SettingsIcon, i18nKey: 'settings.title' }
]

// Settings stays available so a hidden module can always be restored.
export const sidebarModuleConfig = [
  ...sidebarMenuConfig,
  ...sidebarBottomMenuConfig.filter((item) => item.key !== 'settings')
]

export const fridayMenuConfig = {
  key: 'friday',
  path: '/friday',
  icon: 'Bot',
  iconComponent: Bot,
  i18nKey: 'friday.title'
}

export const allMenuConfigs = [
  ...sidebarMenuConfig,
  ...sidebarBottomMenuConfig,
  fridayMenuConfig
]

export const isElectronEnvironment = () => {
  return !!window.electronAPI
}
