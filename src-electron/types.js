export const DEFAULT_SYSTEM_PROMPT = '你是 Friday，一个定制化个人知识智能服务助手。你友好、专业，善于帮助用户解答问题和完成任务。'

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
    // 用户头像：由 set_avatar 工具写入，结构为 { dataUrl, name, rarity, updatedAt }
    // 为 null 时前端回退到默认头像 src/assets/images/user.png
    avatar: null,
    // 历史已获得的头像列表：每次 set_avatar 应用新头像时追加（按 name 去重）。
    // 反作弊：仅记录用户实际获得过的头像，绝不导出整库。
    // 结构同 avatar：[{ name, dataUrl, rarity, obtainedAt }]
    avatarHistory: [],
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
