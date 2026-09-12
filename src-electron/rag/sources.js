function normalizeSnippet(content, maxSnippetLength) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length <= maxSnippetLength) return text;
  return `${text.slice(0, Math.max(0, maxSnippetLength - 3)).trimEnd()}...`;
}

function basename(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

export function formatRagSources(results = [], options = {}) {
  const maxSnippetLength = Number(options.maxSnippetLength) > 0
    ? Number(options.maxSnippetLength)
    : 220;
  const seen = new Set();
  const sources = [];

  for (const result of results || []) {
    if (!result) continue;
    const metadata = result.metadata && typeof result.metadata === 'object'
      ? { ...result.metadata }
      : {};
    const filePath = result.parentInfo?.sourcePath || result.source || metadata.source || '';
    const dedupeKey = metadata.noteId || result.parentInfo?.uuid || filePath || result.content;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const title = metadata.title || basename(filePath || result.source) || 'Untitled source';
    sources.push({
      title,
      source: result.source || filePath,
      filePath,
      kbType: result.kbType || '',
      confidence: typeof result.confidence === 'number' ? result.confidence : null,
      snippet: normalizeSnippet(result.content, maxSnippetLength),
      metadata
    });
  }

  return sources;
}
