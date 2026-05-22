import {
  FolderKanban,
  FileText,
  CalendarDays,
  Bot,
  Clock,
  Settings
} from 'lucide-vue-next'

export const sidebarMenuConfig = [
  { key: 'workspace', path: '/workspace', icon: 'FolderKanban', iconComponent: FolderKanban, i18nKey: 'workspace.title' },
  { key: 'note', path: '/note', icon: 'FileText', iconComponent: FileText, i18nKey: 'note.title' },
  { key: 'schedule', path: '/schedule', icon: 'CalendarDays', iconComponent: CalendarDays, i18nKey: 'schedule.title' }
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
