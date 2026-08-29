import { Marked } from 'marked';

const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

const chatMarked = new Marked({
  gfm: true,
  breaks: true
});

chatMarked.use({
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    code({ text, lang }) {
      const language = escapeHtml(lang || '');
      const escapedText = escapeHtml(text);
      return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-block-lang">${language}</span><button type="button" class="code-copy-btn" data-code="${encodeURIComponent(text)}">${COPY_ICON}</button></div><pre><code class="language-${language}">${escapedText}</code></pre></div>`;
    }
  }
});

export function renderMarkdown(content) {
  if (!content) return '';
  return sanitizeHtml(chatMarked.parse(content));
}

export function stripMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```[^\n]*\n?/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function copyCodeFromButton(btn) {
  if (!btn) return;
  const code = decodeURIComponent(btn.dataset.code || '');
  try {
    await navigator.clipboard.writeText(code);
    btn.classList.add('copied');
    const originalSvg = btn.innerHTML;
    btn.innerHTML = CHECK_ICON;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = originalSvg;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy code:', err);
  }
}

export function handleCodeCopyClick(event) {
  const btn = event.target?.closest?.('.code-copy-btn');
  if (!btn) return;
  copyCodeFromButton(btn);
}
