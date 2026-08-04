/**
 * 内置工具：头像替换（set_avatar）
 * =================================================
 * 设计参考：Agent智能体设计.md 2.9 内置工具清单
 *
 * 从应用内置头像库中随机选取一个头像并应用为当前用户头像。
 * 头像库解析 / 分组 / 读取等共享逻辑见 src-electron/avatar.js。
 *
 * 反作弊设计：
 *   - 头像源文件仅存在于应用打包资源内（dev: public/images，prod: dist/images，
 *     生产环境位于 app.asar 内），不会以图片形式落入用户数据目录。
 *   - 仅将"当前选中"的那一个头像以 data URL 形式写入 config.json，绝不导出整库。
 *   - 稀有头像（白鹿 / 彩虹鹦鹉 / 发光水母 / 星空鲸）需口令解锁；口令仅存在于
 *     本 handler 代码中，不写入 schema / description / 系统提示词，因此 LLM 无法
 *     泄露口令，用户只能凭已知口令解锁稀有头像。
 *
 * 无需审批：可逆的个性化外观变更，由用户主动发起。
 */

import path from 'path'
import { z } from 'zod'
import { registerTool } from '../registry.js'
import { loadConfig, saveConfig } from '../../../config.js'
import { CONFIG_CHANGED } from '../../../events.js'
import { resolveAvatarDir, listAvatars, readAsDataUrl, pickRandom, recordAvatarToHistory } from '../../../avatar.js'

// 解锁稀有头像的口令（仅存在于 handler 内，不对外暴露）。
// 以 base64 形式存储，运行时解码后比较，避免在打包源码（app.asar）中被直接 grep 出明文。
const RARE_KEYWORD = Buffer.from('5p2t5bee6ZO26KGM6ZmI5p2w', 'base64').toString('utf8')

const schema = z.object({
  keyword: z
    .string()
    .optional()
    .describe(
      '用户在消息中提供的口令/关键词（可选）。若用户原话中疑似包含口令，请将其原样传入；' +
      '口令匹配时可解锁稀有头像。用户未提及口令时不要捏造。'
    )
})

async function handler(args, ctx) {
  const keyword = (args?.keyword || '').trim()
  ctx.logger.info(`[set_avatar] keyword=${keyword ? '(provided)' : '(none)'}`)

  // 口令匹配 → 稀有池；否则 → 普通池
  const isRare = !!(keyword && keyword === RARE_KEYWORD)
  const pool = isRare ? 'rare' : 'common'

  const { rare, common } = listAvatars()
  let candidates = isRare ? rare : common
  if (candidates.length === 0) {
    ctx.logger.warn(`[set_avatar] 头像池为空: pool=${pool}`)
    return `头像库暂无可用头像。`
  }

  // 读取当前头像，随机时排除当前头像以避免重复
  // （若排除后池空，例如池仅一张且即当前，则回退保留原池）
  const config = loadConfig()
  const currentFile = config.avatar?.name ? `${config.avatar.name}.png` : null
  if (currentFile) {
    const filtered = candidates.filter(f => f !== currentFile)
    if (filtered.length > 0) {
      candidates = filtered
      ctx.logger.info(`[set_avatar] 排除当前头像: ${currentFile}`)
    }
  }

  const chosen = pickRandom(candidates)
  const absPath = path.join(resolveAvatarDir(), chosen)
  const dataUrl = readAsDataUrl(absPath)

  // 仅将当前选中头像写入 config.avatar（data URL），不导出整库、不落地图片文件
  config.avatar = {
    dataUrl,
    name: path.basename(chosen, '.png'),
    rarity: isRare ? 'rare' : 'common',
    updatedAt: new Date().toISOString()
  }
  // 记录到历史已获得头像（按 name 去重），供记忆管理界面切换
  recordAvatarToHistory(config, config.avatar)
  saveConfig(config)
  ctx.logger.info(`[set_avatar] 已更新头像: ${chosen} (${config.avatar.rarity})`)

  // 广播 config-changed，前端实时刷新头像
  try {
    ctx.mainWindow?.webContents?.send(CONFIG_CHANGED, config)
  } catch (e) {
    ctx.logger.warn(`[set_avatar] 广播 config-changed 失败: ${e.message}`)
  }

  if (isRare) {
    return `✨ 恭喜！已为你解锁稀有头像「${config.avatar.name}」，应用头像已更新。`
  }
  return `已为你随机替换应用头像为「${config.avatar.name}」，应用头像已更新。`
}

registerTool({
  name: 'set_avatar',
  description:
    '替换应用的用户头像。从内置头像库中随机选取一个头像并立即应用，应用头像会实时刷新。' +
    '若用户在消息中提供了口令，请将其原样作为 keyword 传入；口令匹配时可解锁稀有头像。' +
    '未提供口令或口令不匹配时，从普通头像池中随机选取。' +
    '当用户想换个头像、更换头像、刷新头像时调用本工具。',
  schema,
  handler,
  meta: { requireApproval: false }
})
