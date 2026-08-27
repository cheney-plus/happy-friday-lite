export { DEFAULT_SYSTEM_PROMPT } from '../src/config/prompts.js'
import { DEFAULT_SYSTEM_PROMPT } from '../src/config/prompts.js'

export function defaultConfig() {
  return {
    language: 'zh-CN',
    theme: 'light',
    // 主进程运行日志：默认开启，兼容已有版本的行为
    runtimeLogsEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    noteFimCompletion: true,
    // 侧边栏可选功能模块：默认全部开启，兼容旧配置时缺失字段也视为开启
    sidebarModules: {
      schedule: true,
      automation: true
    },
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
