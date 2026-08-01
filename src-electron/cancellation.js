export class CancellationTokens {
  constructor() {
    this._tokens = new Map()
  }

  insert(requestId) {
    // token.abort: 可选的即时中止函数（如 req.destroy / controller.abort）
    // cancel() 会在置 cancelled=true 的同时立即调用它，实现抢占式中止
    const token = { cancelled: false, abort: null }
    this._tokens.set(requestId, token)
    return token
  }

  /**
   * 注册即时中止函数。若注册时令牌已被取消，立即触发该函数。
   * 各流式函数在创建底层请求（http req / fetch AbortController）后调用此方法，
   * 也可直接赋值 token.abort = fn（效果一致）。
   */
  setAbort(requestId, abortFn) {
    const token = this._tokens.get(requestId)
    if (!token) return
    token.abort = abortFn
    if (token.cancelled) {
      try { abortFn() } catch (_e) { /* ignore */ }
    }
  }

  cancel(requestId) {
    const token = this._tokens.get(requestId)
    if (!token) return false
    token.cancelled = true
    // 立即中止底层请求（pending 阶段 / chunk 间隙 / 审批等待均生效）
    if (token.abort) {
      try { token.abort() } catch (_e) { /* ignore */ }
    }
    return true
  }

  remove(requestId) {
    this._tokens.delete(requestId)
  }

  get(requestId) {
    return this._tokens.get(requestId)
  }

  isCancelled(token) {
    return token && token.cancelled
  }
}
