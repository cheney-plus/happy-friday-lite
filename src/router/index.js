import { createRouter, createWebHashHistory } from 'vue-router'

export const routes = [
  {
    path: '/',
    redirect: '/friday'
  },
  {
    path: '/knowledge',
    name: 'knowledge',
    component: () => import('@/views/knowledge/KnowledgeList.vue')
  },
  {
    path: '/file-viewer',
    name: 'file-viewer',
    component: () => import('@/views/knowledge/FileViewerPage.vue')
  },
  {
    path: '/note',
    name: 'note',
    component: () => import('@/views/note/NoteList.vue')
  },
  {
    path: '/note/:id',
    name: 'note-edit',
    component: () => import('@/views/note/NoteEdit.vue')
  },
  {
    path: '/schedule',
    name: 'schedule',
    component: () => import('@/views/schedule/ScheduleCalendar.vue')
  },
  {
    path: '/schedule/:id',
    name: 'schedule-detail',
    component: () => import('@/views/schedule/ScheduleDetail.vue')
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/history/HistoryList.vue')
  },
  {
    path: '/history/:id',
    name: 'history-diff',
    component: () => import('@/views/history/HistoryDiff.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/settings/SettingsGeneral.vue')
  },
  {
    path: '/settings/model',
    name: 'settings-model',
    component: () => import('@/views/settings/SettingsModel.vue')
  },
  {
    path: '/friday',
    name: 'friday',
    component: () => import('@/views/friday/FridayChat.vue')
  },
  {
    path: '/friday/chat/:sessionId?',
    name: 'friday-chat',
    component: () => import('@/views/friday/FridayConversation.vue')
  },
  {
    // 内网分享：复用对话界面，通过 meta.share 标记为分享模式（隐藏输入框）
    path: '/share/:sessionId',
    name: 'share',
    component: () => import('@/views/friday/FridayConversation.vue'),
    meta: { share: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/knowledge'
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
