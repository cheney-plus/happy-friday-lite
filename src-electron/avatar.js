/**
 * 用户头像管理（共享逻辑）
 * ============================================
 * 为 set_avatar 工具与启动时默认头像分配提供统一能力：
 *   - 内置头像库目录解析（dev: public/images，prod: dist/images，asar 内可透明读取）
 *   - 稀有 / 普通头像分组
 *   - 图片读取为 data URL
 *   - ensureDefaultAvatar：首次启动时为未设置头像的用户随机分配 5 个普通头像
 *
 * 稀有头像（白鹿 / 彩虹鹦鹉 / 发光水母 / 星空鲸）仅能通过 set_avatar 工具的口令解锁，
 * 默认头像只从普通池中选取，以保持稀有头像的稀缺性。
 *
 * 反作弊：头像源文件始终留在应用打包资源内，不会以图片形式落入用户数据目录；
 * 仅"当前选中"的那一张以 data URL 写入 config.json，不导出整库、不落地图片文件。
 */

import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { loadConfig, saveConfig } from './config.js'

// 稀有头像清单（文件名，不含路径）
export const RARE_AVATARS = ['白鹿.png', '彩虹鹦鹉.png', '发光水母.png', '星空鲸.png']

/**
 * 解析内置头像库目录
 * - dev：项目根/public/images
 * - prod：应用包/dist/images（asar 内，Electron fs 透明读取）
 * @returns {string} 头像库目录绝对路径
 */
export function resolveAvatarDir() {
  const appPath = app.getAppPath()
  return app.isPackaged
    ? path.join(appPath, 'dist', 'images')
    : path.join(appPath, 'public', 'images')
}

/**
 * 列出头像库全部 .png 文件，并按稀有/普通分组
 * @returns {{ rare: string[], common: string[], all: string[] }}
 */
export function listAvatars() {
  const dir = resolveAvatarDir()
  if (!fs.existsSync(dir)) {
    throw new Error(`头像库目录不存在: ${dir}`)
  }
  const all = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.png'))
  const rareSet = new Set(RARE_AVATARS)
  const rare = all.filter(f => rareSet.has(f))
  const common = all.filter(f => !rareSet.has(f))
  return { rare, common, all }
}

/**
 * 读取图片为 data URL
 * @param {string} filePath 图片绝对路径
 * @returns {string} data:image/png;base64,...
 */
export function readAsDataUrl(filePath) {
  const buf = fs.readFileSync(filePath)
  return `data:image/png;base64,${buf.toString('base64')}`
}

/**
 * 从数组中随机取一个元素
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * 从数组中随机取 N 个不重复元素（Fisher-Yates 洗牌算法取前 N 个）
 * @template T
 * @param {T[]} arr
 * @param {number} n 要取的元素数量
 * @returns {T[]}
 */
export function pickRandomN(arr, n) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(n, copy.length))
}

/**
 * 将一个已获得的头像记录到 config.avatarHistory（按 name 去重）。
 * 反作弊：仅记录"当前选中"的那一张头像的 dataUrl，不导出整库。
 *
 * @param {Object} config 配置对象（会被原地修改，但本函数不负责 saveConfig）
 * @param {{ name: string, dataUrl: string, rarity?: string, updatedAt?: string }} entry 头像条目
 */
export function recordAvatarToHistory(config, entry) {
  if (!entry || !entry.name || !entry.dataUrl) return
  if (!Array.isArray(config.avatarHistory)) {
    config.avatarHistory = []
  }
  // 按 name 去重：已记录过则不重复追加（保留首次获得时间）
  if (config.avatarHistory.some(a => a.name === entry.name)) {
    return
  }
  config.avatarHistory.push({
    name: entry.name,
    dataUrl: entry.dataUrl,
    rarity: entry.rarity || 'common',
    obtainedAt: entry.updatedAt || new Date().toISOString()
  })
}

/**
 * 首次启动时为未设置头像的用户随机分配 5 个普通头像。
 * - 已设置过头像（config.avatar 含 dataUrl）则跳过，保留用户既有选择。
 * - 仅从普通池选取，稀有头像不参与默认分配，以保持其稀缺性。
 * - 头像库不可用时静默跳过（前端将回退到默认头像资源）。
 * - 随机选取 5 个普通头像：第一个设为当前头像，其余 4 个连同第一个一并记录到 avatarHistory，
 *   作为"已获得"头像供用户随时切换。
 * - 若普通池不足 5 个，则按实际数量分配。
 *
 * 需在 config 数据目录已初始化（setDataDir）后调用。
 * @returns {boolean} 是否本次分配了新头像
 */
export function ensureDefaultAvatar() {
  try {
    const config = loadConfig()
    if (config.avatar && config.avatar.dataUrl) {
      // 兜底：旧版本未记录 history 时，把当前头像补录进去
      if (!Array.isArray(config.avatarHistory) || config.avatarHistory.length === 0) {
        recordAvatarToHistory(config, config.avatar)
        saveConfig(config)
      }
      return false
    }
    const { common } = listAvatars()
    if (common.length === 0) {
      return false
    }
    const chosenList = pickRandomN(common, 5)
    const now = new Date().toISOString()

    // 第一个设为当前头像
    const first = chosenList[0]
    const firstDataUrl = readAsDataUrl(path.join(resolveAvatarDir(), first))
    config.avatar = {
      dataUrl: firstDataUrl,
      name: path.basename(first, '.png'),
      rarity: 'common',
      updatedAt: now
    }

    // 所有 5 个头像一并记录到历史，作为已获得头像
    recordAvatarToHistory(config, config.avatar)
    for (let i = 1; i < chosenList.length; i++) {
      const file = chosenList[i]
      const dataUrl = readAsDataUrl(path.join(resolveAvatarDir(), file))
      recordAvatarToHistory(config, {
        name: path.basename(file, '.png'),
        dataUrl,
        rarity: 'common',
        updatedAt: now
      })
    }
    saveConfig(config)
    console.log(`[avatar] 已分配 ${chosenList.length} 个默认头像: ${chosenList.join(', ')}`)
    return true
  } catch (e) {
    console.warn(`[avatar] ensureDefaultAvatar 失败: ${e?.message || e}`)
    return false
  }
}

/**
 * 获取当前头像 + 历史已获得头像列表（供记忆管理界面展示与切换）。
 * @returns {{ current: Object|null, history: Array }}
 */
export function getAvatarHistory() {
  const config = loadConfig()
  // 兜底：若 history 为空但 current 存在，补录 current
  const history = Array.isArray(config.avatarHistory) ? [...config.avatarHistory] : []
  if (history.length === 0 && config.avatar?.name) {
    history.push({
      name: config.avatar.name,
      dataUrl: config.avatar.dataUrl,
      rarity: config.avatar.rarity || 'common',
      obtainedAt: config.avatar.updatedAt || new Date().toISOString()
    })
  }
  return { current: config.avatar || null, history }
}

/**
 * 从历史已获得头像中切换到指定头像（按 name 匹配）。
 * 反作弊：仅能在已获得的头像间切换，不能凭空获得未解锁的头像。
 *
 * @param {string} name 头像名（不含扩展名）
 * @returns {{ success: boolean, avatar?: Object, error?: string }}
 */
export function setAvatarFromHistory(name) {
  if (!name) return { success: false, error: '缺少头像名' }
  const config = loadConfig()
  const history = Array.isArray(config.avatarHistory) ? config.avatarHistory : []
  const found = history.find(a => a.name === name)
  if (!found) {
    return { success: false, error: '该头像尚未获得' }
  }
  config.avatar = {
    dataUrl: found.dataUrl,
    name: found.name,
    rarity: found.rarity || 'common',
    updatedAt: new Date().toISOString()
  }
  saveConfig(config)
  console.log(`[avatar] 从历史切换头像: ${found.name}`)
  return { success: true, avatar: config.avatar }
}
