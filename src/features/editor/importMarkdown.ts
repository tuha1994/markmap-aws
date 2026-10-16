import { isMarkdownWithinLimit } from '../../lib/markdown/byteLength';

export const MARKDOWN_IMPORT_BYTE_LIMIT = 262144;
export const MAP_TITLE_MAX_LENGTH = 120;

const UNSAFE_TITLE_CHARACTERS = /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;

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

  const title = (file.name.slice(0, -3).trim() || 'Imported map').normalize('NFC');
  if (UNSAFE_TITLE_CHARACTERS.test(title)) {
    throw new MarkdownImportError('Imported map titles cannot contain control or bidirectional characters.');
  }
  if (title.length > MAP_TITLE_MAX_LENGTH) {
    throw new MarkdownImportError('Imported map titles must be 120 characters or fewer.');
  }
  return { title, markdown };
}
