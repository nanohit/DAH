import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function markdownToHtml(markdown: string): string {
  if (!markdown) {
    return '';
  }

  const paragraphs = markdown
    .replace(/\r\n|\n\r|\r/g, '\n')
    .split('\n\n')
    .map((paragraph) => {
      const parts = paragraph.split('\n').map((line) => escapeHtml(line));
      return `<p>${parts.join('<br />')}</p>`;
    });

  const joined = paragraphs.join('');

  const withFormatting = joined
    .replace(/(\*\*)([^*]+?)(\*\*)/g, '<strong>$2</strong>')
    .replace(/(\*)([^*]+?)(\*)/g, '<em>$2</em>')
    .replace(/\[(.+?)\]\((https?:\/(?:\/)?[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>');

  return sanitizeHtml(withFormatting);
}

function decodeHtml(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function htmlToMarkdown(html: string): string {
  if (!html) {
    return '';
  }

  const sanitized = sanitizeHtml(html);

  const breakTokens = sanitized
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<p>(.*?)<\/p>/gi, (_, content) => `${content}\n\n`)
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<[^>]+>/g, '');

  return decodeHtml(breakTokens)
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
