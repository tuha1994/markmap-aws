import { describe, expect, it } from 'vitest';

import { MarkdownImportError, parseMarkdownFile } from './importMarkdown';

function markdownFile(name: string, markdown: string, type = 'text/markdown'): File {
  return new File([new TextEncoder().encode(markdown)], name, { type });
}

describe('parseMarkdownFile', () => {
  it.each([
    ['Architecture Plan.md', 'Architecture Plan'],
    ['Architecture Plan.MARKDOWN', 'Architecture Plan']
  ])('accepts UTF-8 %s input within the byte limit and derives its title', async (name, title) => {
    await expect(parseMarkdownFile(markdownFile(name, '# Architecture\n\né'))).resolves.toEqual({
      title,
      markdown: '# Architecture\n\né'
    });
  });

  it('rejects a filename-derived title that exceeds the 120 character map limit', async () => {
    await expect(parseMarkdownFile(markdownFile(`${'a'.repeat(121)}.md`, '# Notes'))).rejects.toMatchObject({
      name: 'MarkdownImportError',
      message: 'Imported map titles must be 120 characters or fewer.'
    });
  });

  it('rejects invalid filename-derived titles before they can be proposed for a write', async () => {
    await expect(parseMarkdownFile(markdownFile('Quarter\u202Ecod.exe.md', '# Notes'))).rejects.toMatchObject({
      name: 'MarkdownImportError',
      message: 'Imported map titles cannot contain control or bidirectional characters.'
    });
  });

  it.each([
    ['extension', markdownFile('notes.txt', '# Notes')],
    ['size', markdownFile('notes.md', 'é'.repeat(131073))],
    ['decode', new File([new Uint8Array([0xc3, 0x28])], 'notes.md', { type: 'text/markdown' })]
  ])('rejects invalid %s input before it can be proposed for a write', async (_reason, file) => {
    await expect(parseMarkdownFile(file)).rejects.toBeInstanceOf(MarkdownImportError);
  });
});
