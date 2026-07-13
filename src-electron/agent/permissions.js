/**
 * 文件系统权限规则
 * =================
 * 设计参考：Agent智能体设计.md 2.3
 *
 * 通过 FilesystemPermission 细粒度控制 Agent 对沙箱内文件的访问。
 *
 * 核心策略：强制把所有 LLM 生成的文件管控到 /SANDBOX/ 下，
 *          避免污染 Agent 根目录（只有 SKILL/、memories/ 等系统目录例外）。
 *
 * 注意：JS 版 deepagents 的 FilesystemPermission.mode 仅支持 'allow' | 'deny'，
 *      不支持 Python 版的 'interrupt' 模式。
 *      因此对「需审批的写操作」（如 SKILL/AGENTS.md 修改），
 *      通过 interruptOn + when 回调在 humanInTheLoop.js 中实现路径级审批。
 *
 * 规则评估顺序（首条匹配决定结果）：
 *   1. /SKILL/**      读写 allow            Skill 文件，Agent 可创建/修改技能
 *   2. /memories/**   读写 allow            跨会话记忆，Agent 自我成长
 *   3. /SANDBOX/**    读写 allow            Agent 工作区，所有生成文件均存放于此
 *   4. /**（write）   deny                  兜底：禁止在根目录其他位置写入，防止污染
 *   5. 其他读取       默认 allow            便于 ls 查看根目录结构、SKILL 列表等
 *
 * 路径规则（POSIX 风格，相对于 rootDir，virtualMode=true 时由 backend 解析）
 *
 * @returns {FilesystemPermission[]}
 */
export function buildPermissions() {
  return [
    // 1. SKILL 目录：Agent 可读写，支持通过 Agent 创建/修改技能文件
    //    SKILL 文件也可通过前端管理界面维护
    {
      operations: ['read', 'write'],
      paths: ['/SKILL/**'],
      mode: 'allow'
    },

    // 2. /memories/ 路由：跨会话记忆存储，读写允许
    {
      operations: ['read', 'write'],
      paths: ['/memories/**'],
      mode: 'allow'
    },

    // 3. /SANDBOX/ 目录：Agent 工作区，所有 LLM 生成的文件均存放于此
    //    python_repl、shell 命令、write_file 等工具的输出文件都应放在这里
    //    使用 {,/**} brace expansion 同时匹配 /SANDBOX 自身和 /SANDBOX/**
    {
      operations: ['read', 'write'],
      paths: ['/SANDBOX{,/**}'],
      mode: 'allow'
    },

    // 4. 兜底：禁止在根目录其他位置写入（防止污染根目录）
    //    规则按声明顺序评估，前面的 allow 规则已覆盖允许的子目录，
    //    此规则仅拦截未匹配的路径，确保 LLM 不能在 /foo.txt、/random/bar.txt 等位置写入
    {
      operations: ['write'],
      paths: ['/**'],
      mode: 'deny'
    }
    // 5. 读取：未显式声明的路径默认允许（permissive default）
    //    便于 ls / 查看根目录结构、列出 SKILL 子目录等
  ]
}

export default buildPermissions()
