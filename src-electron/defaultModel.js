/**
 * 系统默认模型（千问）
 * ==========
 * 提供开箱即用的默认模型配置，每台电脑可免费试用 30 次。
 * API Key 经过 AES-256-GCM 加密存储在代码中，运行时解密，不暴露在用户文件中。
 *
 * 试用计数按机器维度统计，使用 IOPlatformUUID 绑定硬件，
 * 计数文件以机器 ID 派生密钥加密，防止手工篡改或重置。
 */

import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getDataDir } from './config.js'

// ========== 加密的 API Key 常量（AES-256-GCM）==========
// 密钥分两段存储，运行时拼接，增加静态分析难度
const _K1 = '5fa989d11ccfd4fa73533bf8047ff6b2'
const _K2 = '3d184e779d3e8fcbe03a25abd3c4e116'
const _IV = '7757800c937791a31f7e027a'
const _CIPHER = 'd06edd1b0bdd2a7850ed7ce190b4a23e8c66a65d0fc09d4a708506dfb0f1f261dae48aadd3183a47affb8df34f5e7f878f58ee131f369d964675b2ccbc1aa869a8bfa2a069c7d21081bb46f3c71f1bd739807e02ae985caa6fd2d46b68bcad20e51afb560d8486b3ca1996a5db44925fae60eb71'
const _TAG = 'e26765e76924568dabcbe2f342fe2c82'

// 默认模型配置（不含 API Key）
export const DEFAULT_MODEL_ID = 'system-default-qwen'
const DEFAULT_MODEL_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_CHAT_MODEL = 'qwen3.7-plus'
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-v4'

// 免费试用次数上限
export const TRIAL_LIMIT = 30

let cachedApiKey = null

/**
 * 解密 API Key
 * @returns {string}
 */
function decryptApiKey() {
  if (cachedApiKey) return cachedApiKey
  const key = Buffer.from(_K1 + _K2, 'hex')
  const iv = Buffer.from(_IV, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(Buffer.from(_TAG, 'hex'))
  let decrypted = decipher.update(_CIPHER, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  cachedApiKey = decrypted
  return cachedApiKey
}

/**
 * 获取系统默认模型完整配置（含解密后的 API Key）
 * 注意：返回值包含敏感信息，仅用于后端调用 LLM，不可发送给前端
 * @returns {Object} 模型配置对象
 */
export function getDefaultModelConfig() {
  return {
    id: DEFAULT_MODEL_ID,
    provider: 'qwen',
    providerLabel: '千问',
    apiKey: decryptApiKey(),
    modelName: DEFAULT_CHAT_MODEL,
    embeddingModelName: DEFAULT_EMBEDDING_MODEL,
    baseUrl: DEFAULT_MODEL_BASE_URL,
    isDefault: true
  }
}

/**
 * 获取默认模型的安全信息（不含 API Key），可发送给前端
 * @returns {Object}
 */
export function getDefaultModelInfo() {
  return {
    id: DEFAULT_MODEL_ID,
    provider: 'qwen',
    providerLabel: '千问',
    modelName: DEFAULT_CHAT_MODEL,
    embeddingModelName: DEFAULT_EMBEDDING_MODEL,
    isDefault: true,
    isSystem: true
  }
}

// ========== 机器 ID ==========

let cachedMachineId = null

/**
 * 获取机器唯一标识（macOS 使用 IOPlatformUUID）
 * @returns {string}
 */
function getMachineId() {
  if (cachedMachineId) return cachedMachineId
  try {
    if (process.platform === 'darwin') {
      const out = execSync(
        'ioreg -d2 -c IOPlatformExpertDevice | awk -F\\" \'/IOPlatformUUID/{print $(NF-1)}\'',
        { encoding: 'utf-8', timeout: 3000 }
      ).trim()
      if (out) {
        cachedMachineId = out
        return cachedMachineId
      }
    } else if (process.platform === 'win32') {
      const out = execSync('wmic csproduct get UUID', { encoding: 'utf-8', timeout: 3000 })
        .split('\n').map(s => s.trim()).filter(Boolean)[1] || ''
      if (out) {
        cachedMachineId = out
        return cachedMachineId
      }
    } else if (process.platform === 'linux') {
      const out = execSync('cat /etc/machine-id', { encoding: 'utf-8', timeout: 3000 }).trim()
      if (out) {
        cachedMachineId = out
        return cachedMachineId
      }
    }
  } catch (e) {
    // 读取失败时回退
  }
  // 回退：使用固定常量 + dataDir 派生（仍具备一定机器绑定）
  cachedMachineId = 'fallback-' + crypto.createHash('sha256').update(getDataDir() || 'default').digest('hex').slice(0, 32)
  return cachedMachineId
}

// ========== 试用计数存储 ==========

const TRIAL_FILE = '.app_trial_cache'
const TRIAL_BACKUP_FILE = '.app_trial_bak'

/**
 * 从机器 ID 派生计数文件的加解密密钥
 */
function deriveTrialKey() {
  const mid = getMachineId()
  // 用机器 ID + 应用内置盐派生 32 字节密钥
  return crypto.createHash('sha256').update(mid + '::happy-friday-v1').digest()
}

/**
 * 读取试用计数（解密）
 * @returns {{ count: number, machineId: string } | null}
 */
function readTrialData() {
  const dataDir = getDataDir()
  if (!dataDir) return null
  const key = deriveTrialKey()

  // 尝试主文件，再尝试备份文件
  for (const fname of [TRIAL_FILE, TRIAL_BACKUP_FILE]) {
    const fpath = path.join(dataDir, fname)
    try {
      if (!fs.existsSync(fpath)) continue
      const raw = fs.readFileSync(fpath, 'utf-8').trim()
      const parts = raw.split(':')
      if (parts.length !== 3) continue
      const iv = Buffer.from(parts[0], 'hex')
      const tag = Buffer.from(parts[1], 'hex')
      const cipher = Buffer.from(parts[2], 'hex')
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      let json = decipher.update(cipher, 'hex', 'utf8')
      json += decipher.final('utf8')
      const data = JSON.parse(json)
      if (data && typeof data.count === 'number') {
        return data
      }
    } catch (e) {
      // 解密失败，继续尝试下一个文件
    }
  }
  return null
}

/**
 * 写入试用计数（加密，双副本）
 * @param {{ count: number, machineId: string }} data
 */
function writeTrialData(data) {
  const dataDir = getDataDir()
  if (!dataDir) return
  const key = deriveTrialKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let enc = cipher.update(JSON.stringify(data), 'utf8', 'hex')
  enc += cipher.final('hex')
  const tag = cipher.getAuthTag()
  const content = `${iv.toString('hex')}:${tag.toString('hex')}:${enc}`

  try {
    fs.writeFileSync(path.join(dataDir, TRIAL_FILE), content, 'utf-8')
  } catch (e) { /* ignore */ }
  try {
    fs.writeFileSync(path.join(dataDir, TRIAL_BACKUP_FILE), content, 'utf-8')
  } catch (e) { /* ignore */ }
}

/**
 * 获取当前试用使用情况
 * @returns {{ count: number, limit: number, remaining: number, available: boolean }}
 */
export function getTrialStatus() {
  const data = readTrialData()
  const count = data ? data.count : 0
  const remaining = Math.max(0, TRIAL_LIMIT - count)
  return {
    count,
    limit: TRIAL_LIMIT,
    remaining,
    available: remaining > 0
  }
}

/**
 * 递增试用计数（每次使用默认模型调用一次）
 * @returns {{ count: number, limit: number, remaining: number, available: boolean }}
 */
export function incrementTrialUsage() {
  const data = readTrialData()
  const newData = {
    count: (data ? data.count : 0) + 1,
    machineId: getMachineId(),
    firstUsedAt: data ? data.firstUsedAt : new Date().toISOString(),
    lastUsedAt: new Date().toISOString()
  }
  writeTrialData(newData)
  const remaining = Math.max(0, TRIAL_LIMIT - newData.count)
  return {
    count: newData.count,
    limit: TRIAL_LIMIT,
    remaining,
    available: remaining > 0
  }
}

/**
 * 判断默认模型是否可用（还有试用次数）
 * @returns {boolean}
 */
export function isDefaultModelAvailable() {
  return getTrialStatus().available
}

/**
 * 解析模型配置：如果使用默认模型，检查试用次数并注入真实配置（含解密 API Key）
 * 如果试用次数已用尽，抛出错误提示用户添加自己的模型
 * @param {Object} model 前端传入的模型配置
 * @returns {Object} 可用于 LLM 调用的模型配置
 */
export function resolveModelConfig(model) {
  if (!model) return model
  const isDefault = model.isDefault || model.id === DEFAULT_MODEL_ID
  if (!isDefault) return model

  if (!isDefaultModelAvailable()) {
    const status = getTrialStatus()
    throw new Error(`系统默认模型免费试用次数已用尽（${status.limit}/${status.limit}），请在设置中添加自己的模型`)
  }
  incrementTrialUsage()
  return getDefaultModelConfig()
}
