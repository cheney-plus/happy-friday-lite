export class CancellationTokens {
  constructor() {
    this._tokens = new Map()
  }

  insert(requestId) {
    const token = { cancelled: false }
    this._tokens.set(requestId, token)
    return token
  }

  cancel(requestId) {
    const token = this._tokens.get(requestId)
    if (token) {
      token.cancelled = true
      return true
    }
    return false
  }

  remove(requestId) {
    this._tokens.delete(requestId)
  }

  isCancelled(token) {
    return token && token.cancelled
  }
}
