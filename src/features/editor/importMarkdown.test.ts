import { describe, expect, it } from 'vitest';

import { MarkdownImportError, parseMarkdownFile } from './importMarkdown';

function markdownFile(name: string, markdown: string, type = 'text/markdown'): File {
  return new File([new TextEncoder().encode(markdown)], name, { type });
}

describe('parseMarkdownFile', () => {
  it('accepts UTF-8 .md input within the byte limit and derives its title', async () => {
    await expect(parseMarkdownFile(markdownFile('Architecture Plan.md', '# Architecture\n\né'))).resolves.toEqual({
      title: 'Architecture Plan',
      markdown: '# Architecture\n\né'
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
