const unsafeScheme = /^(?:javascript|data|file|blob|vbscript):/i;

function isSafeUrl(value: string): boolean {
  const url = value.trim();
  if (unsafeScheme.test(url)) return false;
  return /^https?:\/\//i.test(url) || url.startsWith('/') || url.startsWith('#');
}

export function sanitizeMarkdownForMarkmap(markdown: string): string {
  const withoutImages = markdown.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  const safeLinks = withoutImages.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, label: string, url: string) => {
    return isSafeUrl(url) ? `[${label}](${url})` : label;
  });

  return safeLinks.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
