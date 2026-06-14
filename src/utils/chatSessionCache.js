const chatSessionCache = new Map();

export function getChatSession(noteId) {
  return chatSessionCache.get(noteId) || null;
}

export function setChatSession(noteId, session) {
  chatSessionCache.set(noteId, session);
}

export function clearAllChatSessions() {
  chatSessionCache.clear();
}

export function clearChatSession(noteId) {
  chatSessionCache.delete(noteId);
}
