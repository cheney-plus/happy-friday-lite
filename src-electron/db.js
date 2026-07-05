import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import initSqlJs from 'sql.js'

let dataDir = null
let db = null

export function setDataDir(dir) {
  dataDir = dir
}

function generateId() {
  return crypto.randomUUID()
}

function nowISO() {
  return new Date().toISOString()
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

// 原始查询函数（支持 UPDATE/DELETE 等无结果集语句，也支持 SELECT 返回行）
// 供 RAG 队列等模块使用
export function queryAllRaw(sql, params = []) {
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    return queryAll(sql, params)
  }
  db.run(sql, params)
  saveDb()
  return []
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params)
  return rows.length > 0 ? rows[0] : null
}

function runSql(sql, params = []) {
  db.run(sql, params)
}

function saveDb() {
  const data = db.export()
  const buffer = Buffer.from(data)
  const dbPath = path.join(dataDir, 'friday.db')
  fs.writeFileSync(dbPath, buffer)
}

async function initDatabase() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const SQL = await initSqlJs()
  const dbPath = path.join(dataDir, 'friday.db')

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '新对话',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      knowledgeBaseId TEXT,
      notebookId TEXT,
      title TEXT NOT NULL DEFAULT '新建笔记',
      content TEXT NOT NULL DEFAULT '',
      contentText TEXT NOT NULL DEFAULT '',
      isDeleted INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '新建笔记本',
      description TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS schedule_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      start TEXT NOT NULL DEFAULT '',
      end TEXT NOT NULL DEFAULT '',
      startTime TEXT NOT NULL DEFAULT '',
      endTime TEXT NOT NULL DEFAULT '',
      allDay INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#60a5fa',
      reminder INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'important',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `)

  // 迁移：为旧版 schedule_events 表补充 priority 列（已存在则忽略）
  try {
    db.run("ALTER TABLE schedule_events ADD COLUMN priority TEXT NOT NULL DEFAULT 'important'")
  } catch (_e) {
    // 列已存在，忽略
  }

  // RAG: 文件索引状态表
  db.run(`
    CREATE TABLE IF NOT EXISTS file_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kb_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      last_modified TEXT NOT NULL,
      index_status TEXT NOT NULL DEFAULT 'pending',
      last_indexed_at TEXT,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(kb_type, file_path)
    );
  `)

  // 迁移：为旧版 file_status 表补充 chunk_count 列（已存在则忽略）
  try {
    db.run('ALTER TABLE file_status ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0')
  } catch (_e) {
    // 列已存在，忽略
  }

  // RAG: 父块文档存储表（Small-to-Big 检索）
  db.run(`
    CREATE TABLE IF NOT EXISTS parent_docs (
      uuid TEXT PRIMARY KEY,
      doc_id TEXT NOT NULL,
      content TEXT NOT NULL,
      source_path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      file_created_at TEXT,
      file_modified_at TEXT,
      extra_metadata TEXT
    );
  `)

  // ========== Agent 智能体相关表 ==========
  // agent_threads: Agent 会话（与 sessions 表独立，避免污染对话历史）
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '新 Agent 会话',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `)

  // agent_memories: 跨会话记忆（与 StoreBackend 双向同步）
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_memories (
      id TEXT PRIMARY KEY,
      threadId TEXT,
      namespace TEXT NOT NULL DEFAULT 'memories',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `)

  // agent_tool_logs: 工具调用审计日志（「改进」能力的数据源）
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_tool_logs (
      id TEXT PRIMARY KEY,
      threadId TEXT,
      requestId TEXT,
      toolName TEXT NOT NULL,
      arguments TEXT,
      output TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      durationMs INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );
  `)

  db.run('CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId)')
  db.run('CREATE INDEX IF NOT EXISTS idx_notes_knowledgeBaseId ON notes(knowledgeBaseId)')
  db.run('CREATE INDEX IF NOT EXISTS idx_notes_notebookId ON notes(notebookId)')
  db.run('CREATE INDEX IF NOT EXISTS idx_notes_isDeleted ON notes(isDeleted)')
  db.run('CREATE INDEX IF NOT EXISTS idx_schedule_events_start ON schedule_events(start)')
  db.run('CREATE INDEX IF NOT EXISTS idx_schedule_events_end ON schedule_events(end)')
  db.run('CREATE INDEX IF NOT EXISTS idx_file_status_kb_type ON file_status(kb_type)')
  db.run('CREATE INDEX IF NOT EXISTS idx_file_status_index_status ON file_status(index_status)')
  db.run('CREATE INDEX IF NOT EXISTS idx_parent_docs_doc_id ON parent_docs(doc_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_parent_docs_source_path ON parent_docs(source_path)')
  db.run('CREATE INDEX IF NOT EXISTS idx_agent_memories_threadId ON agent_memories(threadId)')
  db.run('CREATE INDEX IF NOT EXISTS idx_agent_memories_namespace ON agent_memories(namespace)')
  db.run('CREATE INDEX IF NOT EXISTS idx_agent_tool_logs_threadId ON agent_tool_logs(threadId)')
  db.run('CREATE INDEX IF NOT EXISTS idx_agent_tool_logs_requestId ON agent_tool_logs(requestId)')

  saveDb()
  await migrateFromJson()
}

async function migrateFromJson() {
  const migratedFlag = path.join(dataDir, '.sqlite-migrated')
  if (fs.existsSync(migratedFlag)) return

  const migrateArray = (filename, insertFn) => {
    const filePath = path.join(dataDir, filename)
    if (!fs.existsSync(filePath)) return
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      if (!Array.isArray(data)) return
      db.exec('BEGIN TRANSACTION')
      try {
        for (const item of data) insertFn(item)
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    } catch (_e) {}
  }

  migrateArray('sessions.json', (s) => {
    db.run(
      'INSERT OR IGNORE INTO sessions (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
      [s.id, s.title, s.createdAt, s.updatedAt]
    )
  })

  migrateArray('messages.json', (m) => {
    db.run(
      'INSERT OR IGNORE INTO messages (id, sessionId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)',
      [m.id, m.sessionId, m.role, m.content, m.createdAt]
    )
  })

  migrateArray('notes.json', (n) => {
    db.run(
      'INSERT OR IGNORE INTO notes (id, knowledgeBaseId, notebookId, title, content, contentText, isDeleted, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [n.id, n.knowledgeBaseId || null, n.notebookId || null, n.title, n.content, n.contentText, n.isDeleted ? 1 : 0, n.createdAt, n.updatedAt]
    )
  })

  migrateArray('notebooks.json', (nb) => {
    db.run(
      'INSERT OR IGNORE INTO notebooks (id, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
      [nb.id, nb.name || '新建笔记本', nb.description || '', nb.createdAt, nb.updatedAt]
    )
  })

  migrateArray('schedule_events.json', (e) => {
    db.run(
      'INSERT OR IGNORE INTO schedule_events (id, title, start, end, startTime, endTime, allDay, description, color, reminder, completed, priority, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [e.id, e.title, e.start, e.end, e.startTime, e.endTime, e.allDay ? 1 : 0, e.description, e.color, e.reminder ? 1 : 0, e.completed ? 1 : 0, e.priority || 'important', e.createdAt, e.updatedAt]
    )
  })

  saveDb()
  fs.writeFileSync(migratedFlag, new Date().toISOString())
}

export async function initDb() {
  await initDatabase()
}

// 确保数据库内容写入磁盘（备份前调用）
export function flushDb() {
  if (db) {
    saveDb()
  }
}

export function closeDb() {
  if (db) {
    saveDb()
    db.close()
    db = null
  }
}

function normalizeEvent(row) {
  if (!row) return row
  row.allDay = !!row.allDay
  row.reminder = !!row.reminder
  row.completed = !!row.completed
  if (!row.priority) row.priority = 'important'
  return row
}

function normalizeNote(row) {
  if (!row) return row
  row.isDeleted = !!row.isDeleted
  return row
}

export function createSession(title) {
  const now = nowISO()
  const id = generateId()
  db.run(
    'INSERT INTO sessions (id, title, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
    [id, title || '新对话', now, now]
  )
  saveDb()
  return { id, title: title || '新对话', createdAt: now, updatedAt: now }
}

export function getSessions() {
  return queryAll('SELECT * FROM sessions ORDER BY updatedAt DESC')
}

export function getSessionsWithStats() {
  const sessions = queryAll('SELECT * FROM sessions ORDER BY updatedAt DESC')
  return sessions.map(s => {
    const stats = queryOne(
      'SELECT COUNT(*) as messageCount FROM messages WHERE sessionId = ?',
      [s.id]
    )
    const firstUserMsg = queryOne(
      "SELECT content FROM messages WHERE sessionId = ? AND role = 'user' ORDER BY id ASC LIMIT 1",
      [s.id]
    )
    return {
      ...s,
      messageCount: stats ? stats.messageCount : 0,
      preview: firstUserMsg ? firstUserMsg.content : ''
    }
  })
}

export function getSession(sessionId) {
  return queryOne('SELECT * FROM sessions WHERE id = ?', [sessionId])
}

export function deleteSession(sessionId) {
  db.run('DELETE FROM messages WHERE sessionId = ?', [sessionId])
  db.run('DELETE FROM sessions WHERE id = ?', [sessionId])
  saveDb()
}

export function updateSessionTitle(sessionId, title) {
  db.run(
    'UPDATE sessions SET title = ?, updatedAt = ? WHERE id = ?',
    [title, nowISO(), sessionId]
  )
  saveDb()
  return db.getRowsModified() > 0
}

export function updateSessionTimestamp(sessionId) {
  db.run(
    'UPDATE sessions SET updatedAt = ? WHERE id = ?',
    [nowISO(), sessionId]
  )
  saveDb()
}

export function saveMessage(sessionId, role, content) {
  const now = nowISO()
  db.run(
    'INSERT INTO messages (sessionId, role, content, createdAt) VALUES (?, ?, ?, ?)',
    [sessionId, role, content, now]
  )
  const row = queryOne('SELECT last_insert_rowid() as id')
  const id = row ? row.id : 0
  saveDb()
  return { id, sessionId, role, content, createdAt: now }
}

export function getMessages(sessionId) {
  return queryAll('SELECT * FROM messages WHERE sessionId = ? ORDER BY id ASC', [sessionId])
}

export function rollbackSession(sessionId, messageId) {
  db.run(
    'DELETE FROM messages WHERE sessionId = ? AND id >= ?',
    [sessionId, messageId]
  )
  updateSessionTimestamp(sessionId)
}

export function createNote(knowledgeBaseId, notebookId, title) {
  const now = nowISO()
  const id = generateId()
  db.run(
    'INSERT INTO notes (id, knowledgeBaseId, notebookId, title, content, contentText, isDeleted, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
    [id, knowledgeBaseId || null, notebookId || null, title || '新建笔记', '', '', now, now]
  )
  saveDb()
  return {
    id,
    knowledgeBaseId: knowledgeBaseId || null,
    notebookId: notebookId || null,
    title: title || '新建笔记',
    content: '',
    contentText: '',
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  }
}

export function importNote(knowledgeBaseId, notebookId, title, content, contentText) {
  const now = nowISO()
  const id = generateId()
  db.run(
    'INSERT INTO notes (id, knowledgeBaseId, notebookId, title, content, contentText, isDeleted, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
    [id, knowledgeBaseId || null, notebookId || null, title || '新建笔记', content || '', contentText || '', now, now]
  )
  saveDb()
  return {
    id,
    knowledgeBaseId: knowledgeBaseId || null,
    notebookId: notebookId || null,
    title: title || '新建笔记',
    content: content || '',
    contentText: contentText || '',
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  }
}

export function getNotes(knowledgeBaseId, notebookId) {
  if (knowledgeBaseId && notebookId) {
    return queryAll(
      'SELECT * FROM notes WHERE isDeleted = 0 AND knowledgeBaseId = ? AND notebookId = ? ORDER BY updatedAt DESC',
      [knowledgeBaseId, notebookId]
    ).map(normalizeNote)
  }
  if (knowledgeBaseId) {
    return queryAll(
      'SELECT * FROM notes WHERE isDeleted = 0 AND knowledgeBaseId = ? ORDER BY updatedAt DESC',
      [knowledgeBaseId]
    ).map(normalizeNote)
  }
  if (notebookId) {
    return queryAll(
      'SELECT * FROM notes WHERE isDeleted = 0 AND notebookId = ? ORDER BY updatedAt DESC',
      [notebookId]
    ).map(normalizeNote)
  }
  return queryAll(
    'SELECT * FROM notes WHERE isDeleted = 0 ORDER BY updatedAt DESC'
  ).map(normalizeNote)
}

export function getNote(noteId) {
  return normalizeNote(queryOne(
    'SELECT * FROM notes WHERE id = ? AND isDeleted = 0',
    [noteId]
  ))
}

export function updateNote(noteId, title, content, contentText, notebookId) {
  const now = nowISO()
  if (notebookId !== undefined) {
    db.run(
      'UPDATE notes SET title = ?, content = ?, contentText = ?, notebookId = ?, updatedAt = ? WHERE id = ?',
      [title, content, contentText, notebookId, now, noteId]
    )
  } else {
    db.run(
      'UPDATE notes SET title = ?, content = ?, contentText = ?, updatedAt = ? WHERE id = ?',
      [title, content, contentText, now, noteId]
    )
  }
  const modified = db.getRowsModified()
  saveDb()
  if (modified > 0) {
    return normalizeNote(queryOne('SELECT * FROM notes WHERE id = ?', [noteId]))
  }
  return null
}

export function softDeleteNote(noteId) {
  db.run(
    'UPDATE notes SET isDeleted = 1, updatedAt = ? WHERE id = ?',
    [nowISO(), noteId]
  )
  const modified = db.getRowsModified()
  saveDb()
  return modified > 0
}

export function searchNotes(query) {
  const q = `%${(query || '').toLowerCase()}%`
  return queryAll(
    "SELECT * FROM notes WHERE isDeleted = 0 AND (LOWER(title) LIKE ? OR LOWER(contentText) LIKE ?)",
    [q, q]
  ).map(normalizeNote)
}

export function getScheduleEvents() {
  return queryAll(
    'SELECT * FROM schedule_events ORDER BY start ASC, startTime ASC'
  ).map(normalizeEvent)
}

export function getScheduleEventsByDateRange(start, end) {
  return queryAll(
    'SELECT * FROM schedule_events WHERE start <= ? AND end >= ? ORDER BY start ASC, startTime ASC',
    [end, start]
  ).map(normalizeEvent)
}

export function getScheduleEvent(eventId) {
  return normalizeEvent(queryOne(
    'SELECT * FROM schedule_events WHERE id = ?',
    [eventId]
  ))
}

export function createScheduleEvent(args) {
  const now = nowISO()
  const id = generateId()
  const priority = args.priority || 'important'
  db.run(
    'INSERT INTO schedule_events (id, title, start, end, startTime, endTime, allDay, description, color, reminder, completed, priority, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id, args.title || '', args.startDate || '', args.endDate || '',
      args.startTime || '', args.endTime || '', args.allDay ? 1 : 0,
      args.description || '', args.color || '#60a5fa', args.reminder ? 1 : 0,
      args.completed ? 1 : 0, priority, now, now
    ]
  )
  saveDb()
  return {
    id,
    title: args.title || '',
    start: args.startDate || '',
    end: args.endDate || '',
    startTime: args.startTime || '',
    endTime: args.endTime || '',
    allDay: args.allDay || false,
    description: args.description || '',
    color: args.color || '#60a5fa',
    reminder: args.reminder || false,
    completed: args.completed || false,
    priority,
    createdAt: now,
    updatedAt: now
  }
}

export function updateScheduleEvent(eventId, args) {
  const existing = queryOne('SELECT * FROM schedule_events WHERE id = ?', [eventId])
  if (!existing) return null

  const fields = []
  const values = []

  if (args.title !== undefined) { fields.push('title = ?'); values.push(args.title) }
  if (args.startDate !== undefined) { fields.push('start = ?'); values.push(args.startDate) }
  if (args.endDate !== undefined) { fields.push('end = ?'); values.push(args.endDate) }
  if (args.startTime !== undefined) { fields.push('startTime = ?'); values.push(args.startTime) }
  if (args.endTime !== undefined) { fields.push('endTime = ?'); values.push(args.endTime) }
  if (args.allDay !== undefined) { fields.push('allDay = ?'); values.push(args.allDay ? 1 : 0) }
  if (args.description !== undefined) { fields.push('description = ?'); values.push(args.description) }
  if (args.color !== undefined) { fields.push('color = ?'); values.push(args.color) }
  if (args.reminder !== undefined) { fields.push('reminder = ?'); values.push(args.reminder ? 1 : 0) }
  if (args.completed !== undefined) { fields.push('completed = ?'); values.push(args.completed ? 1 : 0) }
  if (args.priority !== undefined) { fields.push('priority = ?'); values.push(args.priority) }

  if (fields.length > 0) {
    fields.push('updatedAt = ?')
    values.push(nowISO())
    values.push(eventId)
    db.run(
      `UPDATE schedule_events SET ${fields.join(', ')} WHERE id = ?`,
      values
    )
    saveDb()
  }

  return normalizeEvent(queryOne('SELECT * FROM schedule_events WHERE id = ?', [eventId]))
}

export function deleteScheduleEvent(eventId) {
  db.run('DELETE FROM schedule_events WHERE id = ?', [eventId])
  saveDb()
}

export function createNotebook(name, description) {
  console.log('[DB] Creating notebook:', { name, description })
  const now = nowISO()
  const id = generateId()
  db.run(
    'INSERT INTO notebooks (id, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    [id, name || '新建笔记本', description || '', now, now]
  )
  saveDb()
  const notebook = {
    id,
    name: name || '新建笔记本',
    description: description || '',
    createdAt: now,
    updatedAt: now
  }
  console.log('[DB] Created notebook:', notebook)
  return notebook
}

export function getNotebooks() {
  const notebooks = queryAll('SELECT * FROM notebooks ORDER BY updatedAt DESC')
  console.log('[DB] Fetched notebooks:', notebooks.length, 'items')
  return notebooks
}

export function getNotebook(notebookId) {
  return queryOne('SELECT * FROM notebooks WHERE id = ?', [notebookId])
}

export function updateNotebook(notebookId, name, description) {
  console.log('[DB] Updating notebook:', { notebookId, name, description })
  const now = nowISO()
  db.run(
    'UPDATE notebooks SET name = ?, description = ?, updatedAt = ? WHERE id = ?',
    [name || '', description || '', now, notebookId]
  )
  const modified = db.getRowsModified()
  saveDb()
  if (modified > 0) {
    return queryOne('SELECT * FROM notebooks WHERE id = ?', [notebookId])
  }
  return null
}

export function deleteNotebook(notebookId) {
  db.run('DELETE FROM notebooks WHERE id = ?', [notebookId])
  db.run('UPDATE notes SET notebookId = NULL WHERE notebookId = ?', [notebookId])
  saveDb()
  return db.getRowsModified() > 0
}

// ========== RAG: file_status 表操作 ==========

// 插入或更新文件索引状态（不存在则插入，存在则更新）
export function upsertFileStatus(kbType, filePath, lastModified, indexStatus = 'pending') {
  db.run(
    `INSERT INTO file_status (kb_type, file_path, last_modified, index_status, last_indexed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(kb_type, file_path) DO UPDATE SET
       last_modified = excluded.last_modified,
       index_status = excluded.index_status`,
    [kbType, filePath, lastModified, indexStatus, indexStatus === 'success' ? nowISO() : null]
  )
  saveDb()
}

// 获取单个文件的索引状态
export function getFileStatus(kbType, filePath) {
  return queryOne(
    'SELECT * FROM file_status WHERE kb_type = ? AND file_path = ?',
    [kbType, filePath]
  )
}

// 获取某个知识库下所有文件状态
export function getFileStatusByKbType(kbType) {
  return queryAll(
    'SELECT * FROM file_status WHERE kb_type = ?',
    [kbType]
  )
}

// 获取某个知识库下指定状态的文件
export function getFileStatusByStatus(kbType, status) {
  return queryAll(
    'SELECT * FROM file_status WHERE kb_type = ? AND index_status = ?',
    [kbType, status]
  )
}

// 更新文件索引状态
export function updateFileStatus(kbType, filePath, indexStatus) {
  const lastIndexedAt = indexStatus === 'success' ? nowISO() : null
  db.run(
    'UPDATE file_status SET index_status = ?, last_indexed_at = ? WHERE kb_type = ? AND file_path = ?',
    [indexStatus, lastIndexedAt, kbType, filePath]
  )
  saveDb()
}

// 删除文件索引状态记录
export function deleteFileStatus(kbType, filePath) {
  db.run(
    'DELETE FROM file_status WHERE kb_type = ? AND file_path = ?',
    [kbType, filePath]
  )
  saveDb()
}

// 删除某个知识库下所有文件状态记录
export function deleteFileStatusByKbType(kbType) {
  db.run('DELETE FROM file_status WHERE kb_type = ?', [kbType])
  saveDb()
}

// 设置某个文件的子块（向量）数量，用于在单个 Zvec collection 中按 kb_type 统计向量数
export function setFileChunkCount(kbType, filePath, chunkCount) {
  db.run(
    'UPDATE file_status SET chunk_count = ? WHERE kb_type = ? AND file_path = ?',
    [chunkCount || 0, kbType, filePath]
  )
  saveDb()
}

// 获取某个知识库类型的向量总数（SUM chunk_count）
// Zvec collection.stats.docCount 只能返回所有知识库合计数，无法按 kb_type 分组，
// 故通过 file_status.chunk_count 累加得到每个知识库的向量数。
export function getVectorCount(kbType) {
  const row = queryOne(
    'SELECT COALESCE(SUM(chunk_count), 0) AS total FROM file_status WHERE kb_type = ?',
    [kbType]
  )
  return row ? (row.total || 0) : 0
}

// ========== RAG: parent_docs 表操作 ==========

// 插入父块文档
export function insertParentDoc(args) {
  db.run(
    `INSERT OR REPLACE INTO parent_docs
     (uuid, doc_id, content, source_path, file_type, file_size, file_created_at, file_modified_at, extra_metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      args.uuid,
      args.docId,
      args.content,
      args.sourcePath,
      args.fileType || null,
      args.fileSize || null,
      args.fileCreatedAt || null,
      args.fileModifiedAt || null,
      args.extraMetadata ? JSON.stringify(args.extraMetadata) : null
    ]
  )
  saveDb()
}

// 批量插入父块文档
export function insertParentDocsBatch(docs) {
  db.exec('BEGIN TRANSACTION')
  try {
    for (const args of docs) {
      db.run(
        `INSERT OR REPLACE INTO parent_docs
         (uuid, doc_id, content, source_path, file_type, file_size, file_created_at, file_modified_at, extra_metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          args.uuid,
          args.docId,
          args.content,
          args.sourcePath,
          args.fileType || null,
          args.fileSize || null,
          args.fileCreatedAt || null,
          args.fileModifiedAt || null,
          args.extraMetadata ? JSON.stringify(args.extraMetadata) : null
        ]
      )
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  saveDb()
}

// 获取单个父块文档
export function getParentDoc(uuid) {
  const row = queryOne('SELECT * FROM parent_docs WHERE uuid = ?', [uuid])
  if (row && row.extra_metadata) {
    try {
      row.extra_metadata = JSON.parse(row.extra_metadata)
    } catch (_e) {}
  }
  return row
}

// 获取多个父块文档
export function getParentDocs(uuids) {
  if (!uuids || uuids.length === 0) return []
  const placeholders = uuids.map(() => '?').join(',')
  const rows = queryAll(
    `SELECT * FROM parent_docs WHERE uuid IN (${placeholders})`,
    uuids
  )
  return rows.map(row => {
    if (row.extra_metadata) {
      try {
        row.extra_metadata = JSON.parse(row.extra_metadata)
      } catch (_e) {}
    }
    return row
  })
}

// 删除指定来源文件的所有父块
export function deleteParentDocsBySourcePath(sourcePath) {
  db.run('DELETE FROM parent_docs WHERE source_path = ?', [sourcePath])
  saveDb()
}

// 删除某个知识库类型下所有父块（通过 source_path 前缀匹配）
export function deleteParentDocsByKbType(kbType, kbRootPath) {
  db.run(
    'DELETE FROM parent_docs WHERE source_path LIKE ?',
    [`${kbRootPath}%`]
  )
  saveDb()
}
