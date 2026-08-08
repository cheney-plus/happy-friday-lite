/**
 * 大模型账户余额查询
 * =================
 * 针对各厂商开放的余额查询接口实现差异化查询。
 *
 * 已支持：
 *   - deepseek: GET https://api.deepseek.com/user/balance
 *   - kimi (Moonshot): GET https://api.moonshot.cn/v1/users/me/balance
 *
 * 其他厂商（豆包/千问/智谱/MiniMax）暂未公开稳定的 OpenAPI 余额查询端点，
 * 返回 supported=false，前端会展示「暂不支持该厂商余额查询」。
 *
 * 返回统一结构：
 *   {
 *     supported: boolean,
 *     available: boolean|null,   // 是否可用（部分厂商返回）
 *     currency: string,         // 货币
 *     totalBalance: number,     // 总余额
 *     grantedBalance: number,   // 赠金余额（部分厂商）
 *     toppedUpBalance: number,  // 充值余额（部分厂商）
 *     voucherBalance: number,   // 代金券余额（部分厂商）
 *     cashBalance: number,      // 现金余额（部分厂商）
 *     raw: object,              // 原始响应（便于前端展示细节）
 *     error: string|null
 *   }
 */

async function httpGet(url, apiKey, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      signal: controller.signal
    })
    const text = await res.text()
    let parsed = null
    try {
      parsed = JSON.parse(text)
    } catch (_e) {
      // 非 JSON 响应
    }
    return { ok: res.ok, status: res.status, body: parsed, rawText: text }
  } finally {
    clearTimeout(timer)
  }
}

function toNumber(v) {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// DeepSeek: GET /user/balance
// 响应：{ is_available, balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }] }
async function queryDeepSeek(model) {
  const baseUrl = (model.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '')
  const url = `${baseUrl}/user/balance`
  const { ok, status, body, rawText } = await httpGet(url, model.apiKey)
  if (!ok) {
    throw new Error(`DeepSeek 余额查询失败 (${status}): ${rawText || body?.error?.message || ''}`)
  }
  if (!body) {
    throw new Error('DeepSeek 余额查询返回非 JSON 响应')
  }
  // 取第一个余额条目（通常是 CNY 或 USD）
  const info = (body.balance_infos && body.balance_infos[0]) || {}
  return {
    supported: true,
    available: body.is_available === true,
    currency: info.currency || 'CNY',
    totalBalance: toNumber(info.total_balance),
    grantedBalance: toNumber(info.granted_balance),
    toppedUpBalance: toNumber(info.topped_up_balance),
    voucherBalance: 0,
    cashBalance: toNumber(info.topped_up_balance),
    raw: body,
    error: null
  }
}

// Kimi / Moonshot: GET /v1/users/me/balance
// 响应：{ code, data: { available_balance, voucher_balance, cash_balance }, scode, status }
async function queryKimi(model) {
  const baseUrl = (model.baseUrl || 'https://api.moonshot.cn/v1').replace(/\/+$/, '')
  // baseUrl 已含 /v1，避免重复拼接
  const path = baseUrl.endsWith('/v1') ? '/users/me/balance' : '/v1/users/me/balance'
  const url = `${baseUrl}${path}`
  const { ok, status, body, rawText } = await httpGet(url, model.apiKey)
  if (!ok) {
    const msg = body?.error?.message || rawText || ''
    throw new Error(`Kimi 余额查询失败 (${status}): ${msg}`)
  }
  if (!body || !body.data) {
    throw new Error('Kimi 余额查询返回格式异常')
  }
  const data = body.data
  return {
    supported: true,
    available: toNumber(data.available_balance) > 0,
    currency: 'CNY',
    totalBalance: toNumber(data.available_balance),
    grantedBalance: toNumber(data.voucher_balance),
    toppedUpBalance: toNumber(data.cash_balance),
    voucherBalance: toNumber(data.voucher_balance),
    cashBalance: toNumber(data.cash_balance),
    raw: body,
    error: null
  }
}

/**
 * 查询模型账户余额
 * @param {Object} model - 模型配置（含 provider / baseUrl / apiKey）
 * @returns {Promise<Object>} 统一格式的余额信息
 */
export async function queryBalance(model) {
  if (!model || !model.apiKey) {
    return {
      supported: false,
      available: null,
      currency: '',
      totalBalance: 0,
      grantedBalance: 0,
      toppedUpBalance: 0,
      voucherBalance: 0,
      cashBalance: 0,
      raw: null,
      error: '未配置 API Key'
    }
  }

  const provider = model.provider
  try {
    switch (provider) {
      case 'deepseek':
        return await queryDeepSeek(model)
      case 'kimi':
        return await queryKimi(model)
      default:
        // 豆包（火山 ARK）、千问（DashScope）、智谱、MiniMax 等厂商
        // 暂未开放可直接通过 API Key 调用的稳定余额查询接口
        return {
          supported: false,
          available: null,
          currency: '',
          totalBalance: 0,
          grantedBalance: 0,
          toppedUpBalance: 0,
          voucherBalance: 0,
          cashBalance: 0,
          raw: null,
          error: null
        }
    }
  } catch (e) {
    return {
      supported: true,
      available: null,
      currency: '',
      totalBalance: 0,
      grantedBalance: 0,
      toppedUpBalance: 0,
      voucherBalance: 0,
      cashBalance: 0,
      raw: null,
      error: e?.message || String(e)
    }
  }
}
