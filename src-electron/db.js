import fs from 'fs'
import path from 'path'
import initSqlJs from 'sql.js'

let dataDir = null
let db = null
let saveTimer = null
let dirty = false

export function setDataDir(dir) { dataDir = dir }
function nowISO() { return new Date().toISOString() }

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}
function queryOne(sql, params = []) { return queryAll(sql, params)[0] || null }

export function queryAllRaw(sql, params = []) {
  if (sql.trim().toUpperCase().startsWith('SELECT')) return queryAll(sql, params)
  db.run(sql, params)
  saveDb()
  return []
}

function persistDb() {
  if (!db || !dataDir) return
  fs.writeFileSync(path.join(dataDir, 'friday.db'), Buffer.from(db.export()))
}
function saveDb() {
  dirty = true
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (!dirty || !db) return
    dirty = false
    persistDb()
  }, 200)
}

async function initDatabase() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  const SQL = await initSqlJs()
  const dbPath = path.join(dataDir, 'friday.db')
  db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database()

  // Enterprise business data lives exclusively on the Go service. Remove the
  // legacy local tables from existing installations as part of this upgrade.
  for (const table of ['messages', 'sessions', 'notes', 'notebooks', 'schedule_events', 'automation_runs', 'automation_tasks', 'llm_usage_records']) {
    db.run(`DROP TABLE IF EXISTS ${table}`)
  }

  // These tables support capabilities not migrated to the service yet.
  db.run(`CREATE TABLE IF NOT EXISTS file_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kb_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    last_modified TEXT NOT NULL,
    index_status TEXT NOT NULL DEFAULT 'pending',
    last_indexed_at TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(kb_type, file_path)
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS parent_docs (
    uuid TEXT PRIMARY KEY, doc_id TEXT NOT NULL, content TEXT NOT NULL,
    source_path TEXT NOT NULL, file_type TEXT, file_size INTEGER,
    file_created_at TEXT, file_modified_at TEXT, extra_metadata TEXT
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS agent_threads (
    id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT 'New Agent Session',
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS agent_memories (
    id TEXT PRIMARY KEY, threadId TEXT, namespace TEXT NOT NULL DEFAULT 'memories',
    key TEXT NOT NULL, value TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  )`)
  db.run(`CREATE TABLE IF NOT EXISTS agent_tool_logs (
    id TEXT PRIMARY KEY, threadId TEXT, requestId TEXT, toolName TEXT NOT NULL,
    arguments TEXT, output TEXT, status TEXT NOT NULL DEFAULT 'success',
    durationMs INTEGER DEFAULT 0, createdAt TEXT NOT NULL
  )`)
  db.run('CREATE INDEX IF NOT EXISTS idx_file_status_kb_type ON file_status(kb_type)')
  db.run('CREATE INDEX IF NOT EXISTS idx_parent_docs_source_path ON parent_docs(source_path)')
  db.run('CREATE INDEX IF NOT EXISTS idx_agent_memories_threadId ON agent_memories(threadId)')
  db.run('CREATE INDEX IF NOT EXISTS idx_agent_tool_logs_threadId ON agent_tool_logs(threadId)')
  saveDb()
}

export async function initDb() { await initDatabase() }
export function flushDb() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  if (dirty && db) { dirty = false; persistDb() }
}
export function closeDb() { flushDb(); if (db) { db.close(); db = null } }

export function upsertFileStatus(kbType, filePath, lastModified, indexStatus = 'pending') {
  db.run(`INSERT INTO file_status(kb_type,file_path,last_modified,index_status) VALUES(?,?,?,?)
    ON CONFLICT(kb_type,file_path) DO UPDATE SET last_modified=excluded.last_modified,index_status=excluded.index_status`, [kbType, filePath, lastModified, indexStatus])
  saveDb()
}
export function getFileStatus(kbType, filePath) { return queryOne('SELECT * FROM file_status WHERE kb_type=? AND file_path=?', [kbType, filePath]) }
export function getFileStatusByKbType(kbType) { return queryAll('SELECT * FROM file_status WHERE kb_type=? ORDER BY id', [kbType]) }
export function getFileStatusByStatus(kbType, status) { return queryAll('SELECT * FROM file_status WHERE kb_type=? AND index_status=? ORDER BY id', [kbType, status]) }
export function updateFileStatus(kbType, filePath, indexStatus) {
  db.run('UPDATE file_status SET index_status=?,last_indexed_at=? WHERE kb_type=? AND file_path=?', [indexStatus, indexStatus === 'success' ? nowISO() : null, kbType, filePath])
  saveDb()
}
export function deleteFileStatus(kbType, filePath) { db.run('DELETE FROM file_status WHERE kb_type=? AND file_path=?', [kbType, filePath]); saveDb() }
export function deleteFileStatusByKbType(kbType) { db.run('DELETE FROM file_status WHERE kb_type=?', [kbType]); saveDb() }
export function setFileChunkCount(kbType, filePath, chunkCount) { db.run('UPDATE file_status SET chunk_count=? WHERE kb_type=? AND file_path=?', [chunkCount || 0, kbType, filePath]); saveDb() }
export function getVectorCount(kbType) { return queryOne('SELECT COALESCE(SUM(chunk_count),0) AS total FROM file_status WHERE kb_type=?', [kbType])?.total || 0 }

export function insertParentDoc(args) { insertParentDocsBatch([args]) }
export function insertParentDocsBatch(docs) {
  db.exec('BEGIN TRANSACTION')
  try {
    for (const args of docs) db.run(`INSERT OR REPLACE INTO parent_docs(uuid,doc_id,content,source_path,file_type,file_size,file_created_at,file_modified_at,extra_metadata) VALUES(?,?,?,?,?,?,?,?,?)`, [args.uuid, args.docId, args.content, args.sourcePath, args.fileType || null, args.fileSize || null, args.fileCreatedAt || null, args.fileModifiedAt || null, args.extraMetadata ? JSON.stringify(args.extraMetadata) : null])
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
  saveDb()
}
function parseParentDoc(row) {
  if (row?.extra_metadata) { try { row.extra_metadata = JSON.parse(row.extra_metadata) } catch {} }
  return row
}
export function getParentDoc(uuid) { return parseParentDoc(queryOne('SELECT * FROM parent_docs WHERE uuid=?', [uuid])) }
export function getParentDocs(uuids) {
  if (!uuids?.length) return []
  return queryAll(`SELECT * FROM parent_docs WHERE uuid IN (${uuids.map(() => '?').join(',')})`, uuids).map(parseParentDoc)
}
export function deleteParentDocsBySourcePath(sourcePath) { db.run('DELETE FROM parent_docs WHERE source_path=?', [sourcePath]); saveDb() }
export function deleteParentDocsByKbType(_kbType, kbRootPath) { db.run('DELETE FROM parent_docs WHERE source_path LIKE ?', [`${kbRootPath}%`]); saveDb() }
