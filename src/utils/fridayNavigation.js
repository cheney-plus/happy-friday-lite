export const NEW_SESSION_ID = 'new';

export function getFridayTabId(route) {
  const tabId = route?.query?.__tab;
  return typeof tabId === 'string' && tabId ? tabId : '';
}

export function withFridayTabQuery(route, extra = {}) {
  const query = { ...extra };
  const tabId = getFridayTabId(route);
  if (tabId) query.__tab = tabId;
  return query;
}

export function isNewSessionId(sessionId) {
  if (!sessionId) return true;
  return sessionId === NEW_SESSION_ID || String(sessionId).startsWith('new-');
}

export function resolveFridayTabPath(fullPath, tabId) {
  if (!fullPath) return `/friday?__tab=${encodeURIComponent(tabId)}`;
  const [path, search] = fullPath.split('?');
  if (path === '/friday' || path === '/friday/') {
    return `/friday?__tab=${encodeURIComponent(tabId)}`;
  }
  const params = new URLSearchParams(search || '');
  params.set('__tab', tabId);
  return `${path}?${params.toString()}`;
}

export function fridayChatLocation(route, { sessionId, query = {} } = {}) {
  return {
    name: 'friday-chat',
    params: { sessionId: sessionId || NEW_SESSION_ID },
    query: withFridayTabQuery(route, query)
  };
}

export function fridayHomeLocation(route) {
  return {
    name: 'friday',
    query: withFridayTabQuery(route)
  };
}
