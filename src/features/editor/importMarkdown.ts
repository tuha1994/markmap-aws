import { isMarkdownWithinLimit } from '../../lib/markdown/byteLength';

export const MARKDOWN_IMPORT_BYTE_LIMIT = 262144;

export class MarkdownImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownImportError';
  }
}

export type ParsedMarkdownFile = {
  title: string;
  markdown: string;
};

export async function parseMarkdownFile(file: File): Promise<ParsedMarkdownFile> {
  if (!file.name.toLocaleLowerCase().endsWith('.md')) {
    throw new MarkdownImportError('Choose a Markdown file with a .md extension.');
  }
  if (file.size > MARKDOWN_IMPORT_BYTE_LIMIT) {
    throw new MarkdownImportError('Markdown files must be 256 KiB or smaller.');
  }

  let markdown: string;
  try {
    const bytes = await file.arrayBuffer();
    markdown = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new MarkdownImportError('The selected file is not valid UTF-8 Markdown.');
  }

  if (!isMarkdownWithinLimit(markdown)) {
    throw new MarkdownImportError('Markdown files must be 256 KiB or smaller.');
  }

  const title = file.name.slice(0, -3).trim() || 'Imported map';
  return { title, markdown };
}
