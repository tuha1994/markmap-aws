export function sanitizeMarkdownFilename(filename: string): string {
  const withoutExtension = filename.trim().replace(/\.md$/i, '');
  const sanitized = withoutExtension
    .replace(/[\\/:*?"<>|]+/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/(?: - )+/g, ' - ')
    .replace(/^(?: - )|(?: - )$/g, '')
    .trim();
  return `${sanitized || 'mind-map'}.md`;
}

export function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeMarkdownFilename(filename);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
