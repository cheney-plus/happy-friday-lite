import https from 'https'
import http from 'http'
import { AppError } from './error.js'
import { CHAT_CHUNK, CHAT_REASONING_CHUNK, CHAT_ERROR } from './events.js'

function buildApiUrl(baseUrl) {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`
}

function buildStreamBody(model, messages, enableThinking) {
  const body = {
    model: model.modelName,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    stream: true
  }

  switch (model.provider) {
    case 'qwen':
      body.enable_thinking = enableThinking
      break
    case 'minimax':
      if (enableThinking) {
        body.reasoning_split = true
      }
      break
    case 'deepseek':
    case 'zhipu':
    case 'kimi':
    case 'doubao':
      body.thinking = { type: enableThinking ? 'enabled' : 'disabled' }
      break
  }

  return body
}

export function streamChat(mainWindow, messages, model, requestId, sessionId, enableThinking, cancelToken) {
  const url = new URL(buildApiUrl(model.baseUrl))
  const body = buildStreamBody(model, messages, enableThinking)
  const bodyStr = JSON.stringify(body)

  const isHttps = url.protocol === 'https:'
  const client = isHttps ? https : http

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${model.apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr)
    }
  }

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errorData = ''
        res.on('data', chunk => { errorData += chunk.toString() })
        res.on('end', () => {
          const errorMsg = `API request failed (${res.statusCode}): ${errorData}`
          mainWindow.webContents.send(CHAT_ERROR, {
            requestId,
            sessionId: sessionId || null,
            error: errorMsg
          })
          reject(AppError.llm(errorMsg))
        })
        return
      }

      let buffer = ''
      let fullContent = ''
      let fullReasoning = ''

      res.on('data', (chunk) => {
        if (cancelToken && cancelToken.cancelled) {
          req.destroy()
          resolve({ fullContent, fullReasoning })
          return
        }

        buffer += chunk.toString()

        while (buffer.includes('\n')) {
          const newlinePos = buffer.indexOf('\n')
          const line = buffer.substring(0, newlinePos).trim()
          buffer = buffer.substring(newlinePos + 1)

          if (!line) continue

          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim()

            if (data === '[DONE]') {
              resolve({ fullContent, fullReasoning })
              return
            }

            try {
              const parsed = JSON.parse(data)

              if (parsed.error) {
                const errorMsg = parsed.error.message || 'Unknown API error'
                mainWindow.webContents.send(CHAT_ERROR, {
                  requestId,
                  sessionId: sessionId || null,
                  error: errorMsg
                })
                reject(AppError.llm(errorMsg))
                return
              }

              const reasoning = parsed.choices?.[0]?.delta?.reasoning_content
              if (reasoning) {
                fullReasoning += reasoning
                mainWindow.webContents.send(CHAT_REASONING_CHUNK, {
                  requestId,
                  sessionId: sessionId || null,
                  content: reasoning
                })
              }

              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
                mainWindow.webContents.send(CHAT_CHUNK, {
                  requestId,
                  sessionId: sessionId || null,
                  content
                })
              }
            } catch (_e) {
              // ignore SSE parse errors
            }
          }
        }
      })

      res.on('end', () => {
        resolve({ fullContent, fullReasoning })
      })

      res.on('error', (err) => {
        reject(AppError.llm(`Stream error: ${err.message}`))
      })
    })

    req.on('error', (err) => {
      reject(AppError.llm(`Request error: ${err.message}`))
    })

    req.write(bodyStr)
    req.end()
  })
}

export async function generateTitle(model, userMessage) {
  const url = buildApiUrl(model.baseUrl)

  const body = {
    model: model.modelName,
    messages: [
      { role: 'system', content: '请用5-10个字总结概括以下用户的消息内容，只需要总结概括，不要展开扩展。不要加引号或其他格式。' },
      { role: 'user', content: userMessage }
    ],
    stream: false,
    max_tokens: 50
  }

  switch (model.provider) {
    case 'qwen':
      body.enable_thinking = false
      break
    case 'minimax':
      break
    case 'deepseek':
    case 'zhipu':
    case 'kimi':
    case 'doubao':
      body.thinking = { type: 'disabled' }
      break
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${model.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      return '新对话'
    }

    const parsed = await response.json()
    const title = parsed.choices?.[0]?.message?.content?.trim() || '新对话'
    return title || '新对话'
  } catch (_e) {
    return '新对话'
  }
}
