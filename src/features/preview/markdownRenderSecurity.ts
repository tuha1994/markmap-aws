const unsafeScheme = /^(?:javascript|data|file|blob|vbscript):/i;

type ParsedDelimited = { value: string; end: number };

function parseBalanced(value: string, start: number, open: string, close: string): ParsedDelimited | undefined {
  if (value[start] !== open) return undefined;
  let depth = 0;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) { escaped = false; continue; }
    if (character === '\\') { escaped = true; continue; }
    if (character === open) depth += 1;
    if (character === close && --depth === 0) return { value: value.slice(start + 1, index), end: index + 1 };
  }
  return undefined;
}

function normalizeReference(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isSafeUrl(value: string): boolean {
  const url = value.trim();
  return /^https?:\/\//i.test(url) && !unsafeScheme.test(url);
}

function destinationUrl(destination: string): string {
  const trimmed = destination.trim();
  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>');
    return end === -1 ? trimmed : trimmed.slice(1, end);
  }
  return trimmed.split(/\s+/, 1)[0] ?? '';
}

function replaceInlineImages(markdown: string): { markdown: string; imageReferences: Set<string> } {
  const imageReferences = new Set<string>();
  let result = '';
  for (let index = 0; index < markdown.length;) {
    if (markdown[index] !== '!' || markdown[index + 1] !== '[') { result += markdown[index++]; continue; }
    const alt = parseBalanced(markdown, index + 1, '[', ']');
    if (!alt) { result += markdown[index++]; continue; }
    const next = markdown[alt.end];
    if (next === '(') {
      const destination = parseBalanced(markdown, alt.end, '(', ')');
      if (destination) { result += alt.value; index = destination.end; continue; }
    }
    if (next === '[') {
      const reference = parseBalanced(markdown, alt.end, '[', ']');
      if (reference) {
        imageReferences.add(normalizeReference(reference.value || alt.value));
        result += alt.value;
        index = reference.end;
        continue;
      }
    }
    imageReferences.add(normalizeReference(alt.value));
    result += alt.value;
    index = alt.end;
  }
  return { markdown: result, imageReferences };
}

function sanitizeReferenceDefinitions(markdown: string, imageReferences: Set<string>): string {
  return markdown.split('\n').map((line) => {
    const match = /^(\s{0,3})\[([^\]]+)\]:\s*(?:<([^>]*)>|(\S+))(?:\s+.*)?$/.exec(line);
    if (!match) return line;
    const label = normalizeReference(match[2]);
    const url = match[3] ?? match[4] ?? '';
    return imageReferences.has(label) || !isSafeUrl(url) ? '' : line;
  }).join('\n');
}

function sanitizeInlineLinks(markdown: string): string {
  let result = '';
  for (let index = 0; index < markdown.length;) {
    if (markdown[index] !== '[' || markdown[index - 1] === '\\') { result += markdown[index++]; continue; }
    const label = parseBalanced(markdown, index, '[', ']');
    if (!label || markdown[label.end] !== '(') { result += markdown[index++]; continue; }
    const destination = parseBalanced(markdown, label.end, '(', ')');
    if (!destination) { result += markdown[index++]; continue; }
    result += isSafeUrl(destinationUrl(destination.value)) ? markdown.slice(index, destination.end) : label.value;
    index = destination.end;
  }
  return result;
}

function parseHtmlTag(markdown: string, start: number): ParsedDelimited | undefined {
  let quote = '';
  for (let index = start + 1; index < markdown.length; index += 1) {
    const character = markdown[index];
    if (quote) { if (character === quote) quote = ''; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '>') return { value: markdown.slice(start + 1, index), end: index + 1 };
  }
  return undefined;
}

function imageAlt(tag: string): string {
  const attribute = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
  return attribute?.[1] ?? attribute?.[2] ?? attribute?.[3] ?? '';
}

function removeHtmlImages(markdown: string): string {
  let result = '';
  for (let index = 0; index < markdown.length;) {
    if (markdown[index] !== '<') { result += markdown[index++]; continue; }
    const tag = parseHtmlTag(markdown, index);
    if (!tag) { result += markdown[index++]; continue; }
    result += /^\s*img(?:\s|\/|$)/i.test(tag.value) ? imageAlt(tag.value) : markdown.slice(index, tag.end);
    index = tag.end;
  }
  return result;
}

export function sanitizeMarkdownForMarkmap(markdown: string): string {
  const images = replaceInlineImages(markdown);
  const withoutImageDefinitions = sanitizeReferenceDefinitions(images.markdown, images.imageReferences);
  const withoutUnsafeLinks = sanitizeInlineLinks(withoutImageDefinitions);
  return removeHtmlImages(withoutUnsafeLinks).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}