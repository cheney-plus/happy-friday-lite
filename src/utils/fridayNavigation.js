export const NEW_SESSION_ID = 'new';

export function getFridayTabId(route, tabStore) {
  const tabId = route?.query?.__tab;
  if (typeof tabId === 'string' && tabId) return tabId;
  if (typeof tabStore?.activeTabId === 'string' && tabStore.activeTabId) return tabStore.activeTabId;
  return '';
}

export function withFridayTabQuery(route, extra = {}, tabStore) {
  const query = { ...extra };
  const tabId = getFridayTabId(route, tabStore);
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

export function fridayChatLocation(route, { sessionId, query = {} } = {}, tabStore) {
  return {
    name: 'friday-chat',
    params: { sessionId: sessionId || NEW_SESSION_ID },
    query: withFridayTabQuery(route, query, tabStore)
  };
}

export function fridayHomeLocation(route, tabStore) {
  return {
    name: 'friday',
    query: withFridayTabQuery(route, {}, tabStore)
  };
}
