/**
 * 文件系统权限规则
 * =================
 * 设计参考：Agent智能体设计.md 2.3
 *
 * 通过 FilesystemPermission 细粒度控制 Agent 对沙箱内文件的访问。
 *
 * 注意：JS 版 deepagents 的 FilesystemPermission.mode 仅支持 'allow' | 'deny'，
 *      不支持 Python 版的 'interrupt' 模式。
 *      因此对「需审批的写操作」（如 SKILL/AGENTS.md 修改），
 *      通过 interruptOn + when 回调在 humanInTheLoop.js 中实现路径级审批。
 *
 * 路径规则（POSIX 风格，相对于 rootDir）：
 *   /SKILL/**      读 allow / 写 deny    Skill 文件由前端管理，Agent 不可直接修改
 *   /memories/**   读写 allow            Agent 自我成长
 *   /sandbox/**    读写 allow            Agent 工作区
 *   其他           读写 allow            默认允许（FilesystemBackend 已沙箱化）
 *
 * @returns {FilesystemPermission[]}
 */
export function buildPermissions() {
  return [
    // SKILL 目录：Agent 只读，禁止直接写入（保护技能文件）
    // 写操作需通过前端管理界面，或通过 interruptOn 走审批流程
    {
      operations: ['write'],
      paths: ['/SKILL/**'],
      mode: 'deny'
    },
    // 显式声明允许的区域（虽然默认就是允许，但明确声明便于审计）
    {
      operations: ['read', 'write'],
      paths: ['/memories/**', '/sandbox/**'],
      mode: 'allow'
    }
    // 其他路径：默认允许（FilesystemBackend.rootDir 已锁定沙箱边界）
  ]
}

export default buildPermissions()
