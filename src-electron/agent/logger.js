/**
 * Agent 统一日志器
 * ================
 * 设计参考：Agent智能体设计.md 2.11
 *
 * - 统一前缀 `[Agent]`，子模块加二级前缀（如 `[Agent][Tool]`、`[Agent][HITL]`）
 * - 关键位置必打：Agent 创建、工具注册、工具调用前后、Skill 加载、权限审批、IPC 调用、错误
 */

const PREFIX = '[Agent]'

/**
 * 创建带二级前缀的子日志器
 * @param {string} subPrefix 子模块前缀，如 'Tool' / 'HITL' / 'IPC'
 * @returns {{ info, warn, error, debug }}
 */
export function createLogger(subPrefix = '') {
  const tag = subPrefix ? `${PREFIX}[${subPrefix}]` : PREFIX

  return {
    info(...args) {
      console.log(tag, ...args)
    },
    warn(...args) {
      console.warn(tag, ...args)
    },
    error(...args) {
      console.error(tag, ...args)
    },
    debug(...args) {
      // 调试日志默认开启，便于排查问题；生产可改为条件开关
      console.log(tag, ...args)
    }
  }
}

// 默认导出主日志器
export default createLogger()
