export function getAssistantContent(msg) {
  if (!msg || msg.role !== 'assistant') return '';
  if (msg.content?.trim()) return msg.content;
  if (Array.isArray(msg.segments) && msg.segments.length) {
    return msg.segments
      .filter(seg => seg.type === 'text' && seg.content)
      .map(seg => seg.content)
      .join('\n\n');
  }
  return '';
}

export function mapHistoryMessage(raw) {
  const msg = {
    role: raw.role,
    content: raw.content,
    id: raw.id,
    reasoning: raw.reasoning || raw.metadata?.reasoning
  };
  if (raw.metadata?.segments && Array.isArray(raw.metadata.segments)) {
    msg.segments = raw.metadata.segments;
  }
  return msg;
}

export function findTurnStartUserIndex(messages, aiMsgIndex) {
  if (aiMsgIndex <= 0 || messages[aiMsgIndex]?.role !== 'assistant') return -1;
  let index = aiMsgIndex - 1;
  while (index >= 0 && messages[index].role !== 'assistant') {
    index--;
  }
  const start = index + 1;
  if (start < aiMsgIndex && messages[start]?.role === 'user') return start;
  return -1;
}

export function formatClock(date = new Date()) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
