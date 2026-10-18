import { defineStore } from 'pinia'

export const useKnowledgeStore = defineStore('knowledge', {
  state: () => ({
    // 会话恢复状态：{ selectedKB, title, categoryId, currentPath }
    // 由知识库视图写入会话，启动恢复时被 useKnowledgeBase 消费后清空
    sessionState: null
  }),
  actions: {}
})
