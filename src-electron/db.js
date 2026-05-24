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
      title TEXT NOT NULL DEFAULT '新建笔记',
      content TEXT NOT NULL DEFAULT '',
      contentText TEXT NOT NULL DEFAULT '',
      isDeleted INTEGER NOT NULL DEFAULT 0,
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
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `)

  db.run('CREATE INDEX IF NOT EXISTS idx_messages_sessionId ON messages(sessionId)')
  db.run('CREATE INDEX IF NOT EXISTS idx_notes_knowledgeBaseId ON notes(knowledgeBaseId)')
  db.run('CREATE INDEX IF NOT EXISTS idx_notes_isDeleted ON notes(isDeleted)')
  db.run('CREATE INDEX IF NOT EXISTS idx_schedule_events_start ON schedule_events(start)')
  db.run('CREATE INDEX IF NOT EXISTS idx_schedule_events_end ON schedule_events(end)')

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
      'INSERT OR IGNORE INTO notes (id, knowledgeBaseId, title, content, contentText, isDeleted, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [n.id, n.knowledgeBaseId || null, n.title, n.content, n.contentText, n.isDeleted ? 1 : 0, n.createdAt, n.updatedAt]
    )
  })

  migrateArray('schedule_events.json', (e) => {
    db.run(
      'INSERT OR IGNORE INTO schedule_events (id, title, start, end, startTime, endTime, allDay, description, color, reminder, completed, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [e.id, e.title, e.start, e.end, e.startTime, e.endTime, e.allDay ? 1 : 0, e.description, e.color, e.reminder ? 1 : 0, e.completed ? 1 : 0, e.createdAt, e.updatedAt]
    )
  })

  saveDb()
  fs.writeFileSync(migratedFlag, new Date().toISOString())
}

export async function initDb() {
  await initDatabase()
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

export function createNote(knowledgeBaseId, title) {
  const now = nowISO()
  const id = generateId()
  db.run(
    'INSERT INTO notes (id, knowledgeBaseId, title, content, contentText, isDeleted, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
    [id, knowledgeBaseId || null, title || '新建笔记', '', '', now, now]
  )
  saveDb()
  return {
    id,
    knowledgeBaseId: knowledgeBaseId || null,
    title: title || '新建笔记',
    content: '',
    contentText: '',
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  }
}

export function getNotes(knowledgeBaseId) {
  if (knowledgeBaseId) {
    return queryAll(
      'SELECT * FROM notes WHERE isDeleted = 0 AND knowledgeBaseId = ? ORDER BY updatedAt DESC',
      [knowledgeBaseId]
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

export function updateNote(noteId, title, content, contentText) {
  const now = nowISO()
  db.run(
    'UPDATE notes SET title = ?, content = ?, contentText = ?, updatedAt = ? WHERE id = ?',
    [title, content, contentText, now, noteId]
  )
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
  db.run(
    'INSERT INTO schedule_events (id, title, start, end, startTime, endTime, allDay, description, color, reminder, completed, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id, args.title || '', args.startDate || '', args.endDate || '',
      args.startTime || '', args.endTime || '', args.allDay ? 1 : 0,
      args.description || '', args.color || '#60a5fa', args.reminder ? 1 : 0,
      args.completed ? 1 : 0, now, now
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
