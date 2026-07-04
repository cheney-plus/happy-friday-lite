/**
 * Agent 统一日志器
 *
 * 设计参考：src/views/knowledge/agent/Agent智能体设计.md §7
 * - 前缀统一 [Agent]，子模块加二级前缀（如 [Agent][Tool]、[Agent][IPC]）
 * - 级别：debug / info / warn / error
 * - 关键位置必打日志，便于排查问题
 */

const PREFIX = '[Agent]'

export const logger = {
  debug: (...a) => console.debug(PREFIX, ...a),
  info: (...a) => console.info(PREFIX, ...a),
  warn: (...a) => console.warn(PREFIX, ...a),
  error: (...a) => console.error(PREFIX, ...a),

  /**
   * 创建子模块日志器（带二级前缀）
   * @param {string} tag 子模块标签，如 'Tool'、'IPC'、'HITL'
   */
  scope: (tag) => ({
    debug: (...a) => console.debug(`${PREFIX}[${tag}]`, ...a),
    info: (...a) => console.info(`${PREFIX}[${tag}]`, ...a),
    warn: (...a) => console.warn(`${PREFIX}[${tag}]`, ...a),
    error: (...a) => console.error(`${PREFIX}[${tag}]`, ...a),
  }),
}
