import https from 'https'
import http from 'http'
import { AppError } from './error.js'
import { CHAT_CHUNK, CHAT_REASONING_CHUNK, CHAT_ERROR, NOTE_AI_CHUNK, NOTE_AI_ERROR } from './events.js'

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

const FIM_SYSTEM_PROMPT = `你是一个文本笔记补全助手。根据光标前后的内容，预测光标位置应该插入的文本。

规则：
- 只输出补全内容，不要输出任何解释、说明或多余文字
- 补全内容尽量简短，最长不超过一句话
- 保持与上下文风格一致
- 如果光标后有内容，确保补全能与后续内容自然衔接`

export function fimCompletion(model, prefix, suffix, cancelToken) {
  const url = buildApiUrl(model.baseUrl)

  const userContent = prefix
    ? (suffix
        ? `## 光标前的内容：\n${prefix}\n\n## 光标后的内容：\n${suffix}\n\n## 补全：`
        : `## 光标前的内容：\n${prefix}\n\n## 补全：`)
    : (suffix
        ? `## 光标后的内容：\n${suffix}\n\n## 补全：`
        : '')

  if (!userContent) {
    return Promise.resolve({ completion: '' })
  }

  const body = {
    model: model.modelName,
    messages: [
      { role: 'system', content: FIM_SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ],
    stream: false,
    max_tokens: 30
  }

  switch (model.provider) {
    case 'qwen':
      body.enable_thinking = false
      break
    case 'deepseek':
    case 'zhipu':
    case 'kimi':
    case 'doubao':
      body.thinking = { type: 'disabled' }
      break
  }

  return new Promise((resolve, reject) => {
    const controller = new AbortController()

    if (cancelToken) {
      Object.defineProperty(cancelToken, '_abortController', {
        value: controller,
        configurable: true,
        writable: true
      })
    }

    const signal = controller.signal

    if (cancelToken && cancelToken.cancelled) {
      resolve({ completion: '' })
      return
    }

    const checkCancel = () => {
      if (cancelToken && cancelToken.cancelled) {
        controller.abort()
        resolve({ completion: '' })
        return true
      }
      return false
    }

    fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${model.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal
    })
      .then(response => {
        if (checkCancel()) return

        if (!response.ok) {
          response.text().then(text => {
            reject(AppError.llm(`FIM API request failed (${response.status}): ${text}`))
          }).catch(() => {
            reject(AppError.llm(`FIM API request failed (${response.status})`))
          })
          return
        }

        return response.json()
      })
      .then(parsed => {
        if (checkCancel()) return
        if (!parsed) return

        const completion = parsed.choices?.[0]?.message?.content?.trim() || ''
        resolve({ completion })
      })
      .catch(err => {
        if (err.name === 'AbortError' || (cancelToken && cancelToken.cancelled)) {
          resolve({ completion: '' })
          return
        }
        reject(AppError.llm(`FIM request error: ${err.message}`))
      })
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

const NOTE_AI_SYSTEM_PROMPT = `你是 Friday，一个专业的智能写作助手。

## 核心能力
你具备文本解读、精炼、润色、扩写、翻译、总结、续写、语法修正、任务规划和数据整理等全方位写作能力。你能够深入理解文本含义，结合上下文背景对文本进行精准处理。

## 输出规范
- 你的输出直接给出结果，不添加任何多余的开场白、结束语或说明性文字
- 保持与原文风格一致，确保输出内容自然流畅
- 输出内容必须符合 Markdown 格式，保留所有原始的 Markdown 标签和格式。

## 当前任务
{{actionInstruction}}`

const NOTE_AI_ACTION_PROMPTS = {
  interpret: '解读用户选中的文本，结合笔记整体背景理解其含义、核心概念和逻辑，必要时补充相关背景知识，输出清晰有条理的解读内容。',
  refine: '精炼用户选中的文本，保留核心含义和关键信息，去除冗余和重复表述，使表达更加简洁有力。',
  polish: '润色用户选中的文本，改善用词和句式，使表达更加流畅优美，保持原意不变，统一文本风格和语气。',
  expand: '扩写用户选中的文本，基于核心含义进行合理延伸，补充相关细节、示例或论证，保持与笔记整体风格一致。',
  translate: '将用户选中的文本翻译成英文，翻译准确、自然、流畅，根据上下文选择最合适的表达方式，保持原文的语气和风格。',
  summarize: '总结用户选中的文本，提取核心要点和关键信息，总结简洁明了，保持逻辑清晰层次分明。',
  continue_write: '续写用户选中的文本，根据上下文和风格进行自然续写，保持逻辑连贯内容衔接自然，与笔记整体风格一致。',
  fix_grammar: '修正用户选中文本的语法、拼写和标点错误，保持原文含义不变，使表达更加规范和准确。',
  generate_plan: '根据用户选中的文本生成结构化的任务计划，将内容分解为可执行的具体步骤，按优先级和逻辑顺序排列。使用 Markdown 格式输出。',
  generate_table: '根据用户选中的文本生成表格，从文本中提取关键信息并组织成结构化表格，列名明确，信息分类合理。使用 Markdown 表格格式输出。',
  custom: '{{userInstruction}}'
}

function buildNoteAIUserContent(noteContent, selectedText) {
  let content = '## 笔记上下文\n\n'
  if (noteContent) {
    content += '**笔记全文**（仅作参考）：\n' + noteContent + '\n\n'
  }
  if (selectedText) {
    content += '**需要处理的文本**：\n' + selectedText
  }
  return content
}

export function streamNoteAI(mainWindow, action, noteContent, selectedText, model, requestId, cancelToken, userInstruction) {
  const actionPrompt = (NOTE_AI_ACTION_PROMPTS[action] || NOTE_AI_ACTION_PROMPTS.custom)
    .replace('{{userInstruction}}', userInstruction || '')
  const systemPrompt = NOTE_AI_SYSTEM_PROMPT.replace('{{actionInstruction}}', actionPrompt)
  const userContent = buildNoteAIUserContent(noteContent, selectedText)

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent }
  ]

  const url = new URL(buildApiUrl(model.baseUrl))
  const body = buildStreamBody(model, messages, false)
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
          mainWindow.webContents.send(NOTE_AI_ERROR, {
            requestId,
            error: errorMsg
          })
          reject(AppError.llm(errorMsg))
        })
        return
      }

      let buffer = ''
      let fullContent = ''

      res.on('data', (chunk) => {
        if (cancelToken && cancelToken.cancelled) {
          req.destroy()
          resolve({ fullContent })
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
              resolve({ fullContent })
              return
            }

            try {
              const parsed = JSON.parse(data)

              if (parsed.error) {
                const errorMsg = parsed.error.message || 'Unknown API error'
                mainWindow.webContents.send(NOTE_AI_ERROR, {
                  requestId,
                  error: errorMsg
                })
                reject(AppError.llm(errorMsg))
                return
              }

              const content = parsed.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
                mainWindow.webContents.send(NOTE_AI_CHUNK, {
                  requestId,
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
        resolve({ fullContent })
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
