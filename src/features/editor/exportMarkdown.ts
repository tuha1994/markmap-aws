const UNSAFE_FILENAME_CHARACTERS = /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
const WINDOWS_RESERVED_BASENAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

export function sanitizeMarkdownFilename(filename: string): string {
  const withoutExtension = filename.trim().replace(/\.md$/i, '').normalize('NFC');
  if (UNSAFE_FILENAME_CHARACTERS.test(withoutExtension)) {
    return 'mind-map.md';
  }

  const sanitized = withoutExtension
    .replace(/[\\/:*?"<>|]+/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/(?: - )+/g, ' - ')
    .replace(/^(?: - )|(?: - )$/g, '')
    .replace(/[. ]+$/u, '')
    .trim();
  if (!sanitized || WINDOWS_RESERVED_BASENAME.test(sanitized)) {
    return 'mind-map.md';
  }
  return `${sanitized}.md`;
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
