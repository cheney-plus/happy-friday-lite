export const DEFAULT_SYSTEM_PROMPT = '你是 Friday，一个定制化个人知识智能服务助手。你友好、专业，善于帮助用户解答问题和完成任务。'

export function defaultConfig() {
  return {
    language: 'zh-CN',
    theme: 'light',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    noteFimCompletion: true,
    backup: {
      enabled: false,
      interval: 'daily',
      lastBackupAt: null,
      autoDir: null,
      maxKeep: 7
    },
    // 对话历史自动清理：默认关闭，开启后按阈值清理超过指定时间未活动的会话
    history: {
      autoClean: false,
      cleanBefore: '3months', // '1month' | '3months' | '6months' | '1year'
      lastCleanAt: null
    },
    rag: {},
    python: {
      path: null
    }
  }
}
