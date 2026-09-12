export const ASSISTANT_NAME_MAX_LENGTH = 16;

export function getDefaultAssistantName(locale = '') {
  return String(locale || '').toLowerCase().startsWith('zh') ? '周五' : 'Friday';
}

export function normalizeAssistantName(name) {
  return String(name || '').trim().slice(0, ASSISTANT_NAME_MAX_LENGTH);
}

export function resolveAssistantName(customName, locale = '') {
  return normalizeAssistantName(customName) || getDefaultAssistantName(locale);
}
