import { describe, expect, it, vi } from 'vitest';

import { downloadMarkdown, sanitizeMarkdownFilename } from './exportMarkdown';

describe('downloadMarkdown', () => {
  it('falls back to a safe Windows-compatible basename for reserved or hostile titles', () => {
    expect(sanitizeMarkdownFilename('CON')).toBe('mind-map.md');
    expect(sanitizeMarkdownFilename('Quarter\u202Ecod.exe')).toBe('mind-map.md');
    expect(sanitizeMarkdownFilename('Draft\u0000notes')).toBe('mind-map.md');
  });

  it('removes trailing Windows-invalid dots and spaces from an otherwise safe title', () => {
    expect(sanitizeMarkdownFilename('Architecture. ')).toBe('Architecture.md');
  });

  it('exports the exact current Markdown with a sanitized filename', async () => {
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return 'blob:markdown';
    });
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click,
      remove: vi.fn()
    } as unknown as HTMLAnchorElement);
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    downloadMarkdown('Q4 / Architecture?.md', '# Exact\n\nMarkdown');

    expect(sanitizeMarkdownFilename('Q4 / Architecture?.md')).toBe('Q4 - Architecture.md');
    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'text/markdown;charset=utf-8' }));
    const blob = createObjectURL.mock.calls[0]![0];
    await expect(blob.text()).resolves.toBe('# Exact\n\nMarkdown');
    expect(createElement).toHaveBeenCalledWith('a');
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:markdown');
  });
});
