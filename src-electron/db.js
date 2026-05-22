import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { AppError } from './error.js'

let dataDir = null

export function setDataDir(dir) {
  dataDir = dir
}

function readJsonFile(filename) {
  const filePath = path.join(dataDir, filename)
  if (!fs.existsSync(filePath)) {
    return null
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (e) {
    console.error(`Failed to read ${filename}:`, e)
    return null
  }
}

function writeJsonFile(filename, data) {
  const filePath = path.join(dataDir, filename)
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error(`Failed to write ${filename}:`, e)
    return false
  }
}

function generateId() {
  return crypto.randomUUID()
}

function nowISO() {
  return new Date().toISOString()
}

export function createSession(title) {
  const data = readJsonFile('sessions.json') || []
  const now = nowISO()
  const session = {
    id: generateId(),
    title: title || '新对话',
    createdAt: now,
    updatedAt: now
  }
  data.push(session)
  writeJsonFile('sessions.json', data)
  return session
}

export function getSessions() {
  const data = readJsonFile('sessions.json') || []
  return data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export function getSession(sessionId) {
  const data = readJsonFile('sessions.json') || []
  return data.find(s => s.id === sessionId) || null
}

export function deleteSession(sessionId) {
  let sessions = readJsonFile('sessions.json') || []
  sessions = sessions.filter(s => s.id !== sessionId)
  writeJsonFile('sessions.json', sessions)

  let messages = readJsonFile('messages.json') || []
  messages = messages.filter(m => m.sessionId !== sessionId)
  writeJsonFile('messages.json', messages)
}

export function updateSessionTitle(sessionId, title) {
  const data = readJsonFile('sessions.json') || []
  const idx = data.findIndex(s => s.id === sessionId)
  if (idx >= 0) {
    data[idx].title = title
    data[idx].updatedAt = nowISO()
    writeJsonFile('sessions.json', data)
    return true
  }
  return false
}

export function updateSessionTimestamp(sessionId) {
  const data = readJsonFile('sessions.json') || []
  const idx = data.findIndex(s => s.id === sessionId)
  if (idx >= 0) {
    data[idx].updatedAt = nowISO()
    writeJsonFile('sessions.json', data)
  }
}

export function saveMessage(sessionId, role, content) {
  const data = readJsonFile('messages.json') || []
  const now = nowISO()
  const maxId = data.reduce((max, m) => Math.max(max, m.id || 0), 0)
  const message = {
    id: maxId + 1,
    sessionId,
    role,
    content,
    createdAt: now
  }
  data.push(message)
  writeJsonFile('messages.json', data)
  return message
}

export function getMessages(sessionId) {
  const data = readJsonFile('messages.json') || []
  return data
    .filter(m => m.sessionId === sessionId)
    .sort((a, b) => a.id - b.id)
}

export function rollbackSession(sessionId, messageId) {
  let data = readJsonFile('messages.json') || []
  data = data.filter(m => !(m.sessionId === sessionId && m.id >= messageId))
  writeJsonFile('messages.json', data)
  updateSessionTimestamp(sessionId)
}

export function createNote(knowledgeBaseId, title) {
  const data = readJsonFile('notes.json') || []
  const now = nowISO()
  const note = {
    id: generateId(),
    knowledgeBaseId: knowledgeBaseId || null,
    title: title || '新建笔记',
    content: '',
    contentText: '',
    isDeleted: false,
    createdAt: now,
    updatedAt: now
  }
  data.unshift(note)
  writeJsonFile('notes.json', data)
  return note
}

export function getNotes(knowledgeBaseId) {
  const data = readJsonFile('notes.json') || []
  let filtered = data.filter(n => !n.isDeleted)
  if (knowledgeBaseId) {
    filtered = filtered.filter(n => n.knowledgeBaseId === knowledgeBaseId)
  }
  return filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export function getNote(noteId) {
  const data = readJsonFile('notes.json') || []
  return data.find(n => n.id === noteId && !n.isDeleted) || null
}

export function updateNote(noteId, title, content, contentText) {
  const data = readJsonFile('notes.json') || []
  const idx = data.findIndex(n => n.id === noteId)
  if (idx >= 0) {
    data[idx].title = title
    data[idx].content = content
    data[idx].contentText = contentText
    data[idx].updatedAt = nowISO()
    writeJsonFile('notes.json', data)
    return data[idx]
  }
  return null
}

export function softDeleteNote(noteId) {
  const data = readJsonFile('notes.json') || []
  const idx = data.findIndex(n => n.id === noteId)
  if (idx >= 0) {
    data[idx].isDeleted = true
    data[idx].updatedAt = nowISO()
    writeJsonFile('notes.json', data)
    return true
  }
  return false
}

export function searchNotes(query) {
  const data = readJsonFile('notes.json') || []
  const q = (query || '').toLowerCase()
  return data.filter(n =>
    !n.isDeleted &&
    (n.title.toLowerCase().includes(q) || n.contentText.toLowerCase().includes(q))
  )
}

export function getScheduleEvents() {
  const data = readJsonFile('schedule_events.json') || []
  return data.sort((a, b) => {
    if (a.start < b.start) return -1
    if (a.start > b.start) return 1
    return (a.startTime || '').localeCompare(b.startTime || '')
  })
}

export function getScheduleEventsByDateRange(start, end) {
  const data = readJsonFile('schedule_events.json') || []
  return data.filter(e => e.start <= end && e.end >= start)
}

export function getScheduleEvent(eventId) {
  const data = readJsonFile('schedule_events.json') || []
  return data.find(e => e.id === eventId) || null
}

export function createScheduleEvent(args) {
  const data = readJsonFile('schedule_events.json') || []
  const now = nowISO()
  const newEvent = {
    id: generateId(),
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
  data.push(newEvent)
  writeJsonFile('schedule_events.json', data)
  return newEvent
}

export function updateScheduleEvent(eventId, args) {
  const data = readJsonFile('schedule_events.json') || []
  const idx = data.findIndex(e => e.id === eventId)
  if (idx >= 0) {
    if (args.title !== undefined) data[idx].title = args.title
    if (args.startDate !== undefined) data[idx].start = args.startDate
    if (args.endDate !== undefined) data[idx].end = args.endDate
    if (args.startTime !== undefined) data[idx].startTime = args.startTime
    if (args.endTime !== undefined) data[idx].endTime = args.endTime
    if (args.allDay !== undefined) data[idx].allDay = args.allDay
    if (args.description !== undefined) data[idx].description = args.description
    if (args.color !== undefined) data[idx].color = args.color
    if (args.reminder !== undefined) data[idx].reminder = args.reminder
    if (args.completed !== undefined) data[idx].completed = args.completed
    data[idx].updatedAt = nowISO()
    writeJsonFile('schedule_events.json', data)
    return data[idx]
  }
  return null
}

export function deleteScheduleEvent(eventId) {
  let data = readJsonFile('schedule_events.json') || []
  data = data.filter(e => e.id !== eventId)
  writeJsonFile('schedule_events.json', data)
}
