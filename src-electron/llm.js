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

const NOTE_AI_SYSTEM_PROMPTS = {
  interpret: '你是 Friday，一个专业的文本分析助手。你擅长解读和分析文本内容，能够深入理解文本的含义、背景和逻辑，为用户提供清晰、准确的解读。',
  refine: '你是 Friday，一个专业的文本编辑助手。你擅长精炼和压缩文本，能够在保留核心含义的前提下，去除冗余信息，使文本更加简洁有力。',
  polish: '你是 Friday，一个专业的文本润色助手。你擅长优化文本的表达方式，改善用词和句式，使文本更加流畅、优美、专业，同时保持原意不变。',
  expand: '你是 Friday，一个专业的文本创作助手。你擅长扩展和丰富文本内容，能够基于已有内容进行合理的延伸和补充，使文本更加详尽、充实。',
  translate: '你是 Friday，一个专业的翻译助手。你擅长将文本翻译成不同的语言，翻译准确、自然、流畅，能够根据上下文选择最合适的表达方式。',
  summarize: '你是 Friday，一个专业的文本总结助手。你擅长从文本中提取核心要点，生成简洁明了的总结，帮助用户快速理解文本的主要内容。',
  continue_write: '你是 Friday，一个专业的文本续写助手。你擅长根据已有内容进行合理的续写，保持风格一致、逻辑连贯，使续写内容自然衔接。',
  fix_grammar: '你是 Friday，一个专业的语法修正助手。你擅长发现和修正文本中的语法错误、拼写错误和标点问题，使文本更加规范和准确。',
  generate_plan: '你是 Friday，一个专业的任务规划助手。你擅长根据文本内容生成结构化的任务计划，将复杂目标分解为可执行的步骤。',
  generate_table: '你是 Friday，一个专业的数据整理助手。你擅长从文本中提取关键信息并生成结构化的表格，使信息呈现更加清晰有序。'
}

const NOTE_AI_USER_PROMPTS = {
  interpret: '以下是笔记的完整内容：\n\n{{noteContent}}\n\n请针对以下选中的文本进行解读：\n\n{{selectedText}}\n\n要求：\n1. 结合笔记的整体背景理解选中文本的含义\n2. 解释选中文本的核心概念和逻辑\n3. 如有必要，补充相关的背景知识\n4. 解读要清晰、准确、有条理',
  refine: '以下是笔记的完整内容：\n\n{{noteContent}}\n\n请精炼以下选中的文本：\n\n{{selectedText}}\n\n要求：\n1. 保留核心含义和关键信息\n2. 去除冗余和重复表述\n3. 使表达更加简洁有力\n4. 只输出精炼后的文本，不要添加额外说明',
  polish: '以下是笔记的完整内容：\n\n{{noteContent}}\n\n请润色以下选中的文本：\n\n{{selectedText}}\n\n要求：\n1. 改善用词和句式，使表达更加流畅优美\n2. 保持原意不变\n3. 统一文本风格和语气\n4. 只输出润色后的文本，不要添加额外说明',
  expand: '以下是笔记的完整内容：\n\n{{noteContent}}\n\n请扩写以下选中的文本：\n\n{{selectedText}}\n\n要求：\n1. 基于选中文本的核心含义进行合理延伸\n2. 补充相关的细节、示例或论证\n3. 保持与笔记整体风格一致\n4. 只输出扩写后的文本，不要添加额外说明',
  translate: '以下是笔记的完整内容：\n\n{{noteContent}}\n\n请将以下选中的文本翻译成英文：\n\n{{selectedText}}\n\n要求：\n1. 翻译准确、自然、流畅\n2. 根据上下文选择最合适的表达方式\n3. 保持原文的语气和风格\n4. 只输出翻译后的文本，不要添加额外说明',
  summarize: '以下是笔记的完整内容：\n\n{{noteContent}}\n\n请总结以下选中的文本：\n\n{{selectedText}}\n\n要求：\n1. 提取核心要点和关键信息\n2. 总结简洁明了，避免冗余\n3. 保持逻辑清晰，层次分明\n4. 只输出总结内容，不要添加额外说明',
  continue_write: '以下是笔记的完整内容：\n\n{{noteContent}}\n\n请续写以下选中的文本：\n\n{{selectedText}}\n\n要求：\n1. 根据选中文本的上下文和风格进行自然续写\n2. 保持逻辑连贯，内容衔接自然\n3. 续写内容与笔记整体风格一致\n4. 只输出续写的文本，不要添加额外说明',
  fix_grammar: '以下是笔记的完整内容：\n\n{{noteContent}}\n\n请修正以下选中文本的语法错误：\n\n{{selectedText}}\n\n要求：\n1. 修正所有语法、拼写和标点错误\n2. 保持原文含义不变\n3. 使表达更加规范和准确\n4. 只输出修正后的文本，不要添加额外说明',
  generate_plan: '以下是笔记的完整内容：\n\n{{noteContent}}\n\n请根据以下选中的文本生成任务计划：\n\n{{selectedText}}\n\n要求：\n1. 将内容分解为可执行的任务步骤\n2. 每个步骤明确具体，可操作\n3. 按优先级和逻辑顺序排列\n4. 使用 Markdown 格式输出',
  generate_table: '以下是笔记的完整内容：\n\n{{noteContent}}\n\n请根据以下选中的文本生成表格：\n\n{{selectedText}}\n\n要求：\n1. 从文本中提取关键信息并组织成表格\n2. 表格结构清晰，列名明确\n3. 信息分类合理，便于阅读\n4. 使用 Markdown 表格格式输出'
}

export function streamNoteAI(mainWindow, action, noteContent, selectedText, model, requestId, cancelToken) {
  const systemPrompt = NOTE_AI_SYSTEM_PROMPTS[action] || NOTE_AI_SYSTEM_PROMPTS.interpret
  const userPrompt = (NOTE_AI_USER_PROMPTS[action] || NOTE_AI_USER_PROMPTS.interpret)
    .replace('{{noteContent}}', noteContent)
    .replace('{{selectedText}}', selectedText)

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
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
