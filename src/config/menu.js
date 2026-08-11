import {
  FolderKanban,
  FileText,
  CalendarDays,
  Workflow,
  Bot,
  Clock,
  Settings
} from 'lucide-vue-next'

export const sidebarMenuConfig = [
  { key: 'note', path: '/note', icon: 'FileText', iconComponent: FileText, i18nKey: 'note.title' },
  { key: 'knowledge', path: '/knowledge', icon: 'FolderKanban', iconComponent: FolderKanban, i18nKey: 'knowledge.title' },
  { key: 'schedule', path: '/schedule', icon: 'CalendarDays', iconComponent: CalendarDays, i18nKey: 'schedule.title' },
  { key: 'automation', path: '/automation', icon: 'Workflow', iconComponent: Workflow, i18nKey: 'automation.title' }
]

export const sidebarBottomMenuConfig = [
  { key: 'history', path: '/history', icon: 'Clock', iconComponent: Clock, i18nKey: 'history.title' },
  { key: 'settings', path: '/settings', icon: 'Settings', iconComponent: Settings, i18nKey: 'settings.title' }
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
